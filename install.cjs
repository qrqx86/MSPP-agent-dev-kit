#!/usr/bin/env node
// pp-kit installer: copies agents, skills, hooks and templates into ~/.claude
// and merges the hook entries into ~/.claude/settings.json (existing hooks are preserved).
// Usage: node install.cjs [--dry-run] [--uninstall]
// Optional: PPKIT_RULES_REPO=<folder> links an organization rulebook into skills/pp-standards/rules.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const DRY = process.argv.includes('--dry-run');
const UNINSTALL = process.argv.includes('--uninstall');
const KIT = path.join(__dirname, 'kit');
const CLAUDE = path.join(os.homedir(), '.claude');
const HOOK_DIR = path.join(CLAUDE, 'hooks', 'pp-kit');
const MARK = 'hooks/pp-kit/';
const log = (...a) => console.log(DRY ? '[dry-run]' : '', ...a);

function copyDir(src, dst, { keep = [] } = {}) {
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) {
      if (keep.includes(name) && fs.existsSync(d)) { log('keep    ', d); continue; }
      if (!DRY) fs.mkdirSync(d, { recursive: true });
      copyDir(s, d, { keep }); // keep applies at every level (e.g. skills/<x>/rules)
    } else {
      if (keep.includes(name) && fs.existsSync(d)) { log('keep    ', d); continue; }
      const same = fs.existsSync(d) && fs.readFileSync(d).equals(fs.readFileSync(s));
      if (same) continue;
      log(fs.existsSync(d) ? 'update  ' : 'create  ', d);
      if (!DRY) { fs.mkdirSync(dst, { recursive: true }); fs.copyFileSync(s, d); }
    }
  }
}

// rules/ of the pp-standards skill -> junction/symlink to an organization rulebook (optional).
function linkRules() {
  const repo = process.env.PPKIT_RULES_REPO;
  if (!repo) return;
  const dst = path.join(CLAUDE, 'skills', 'pp-standards', 'rules');
  let st = null;
  try { st = fs.lstatSync(dst); } catch { /* missing */ }
  if (st && st.isSymbolicLink()) { log('rules   ', dst, '->', fs.readlinkSync(dst)); return; }
  if (!fs.existsSync(repo)) { log('WARNING: rules folder not found:', repo); return; }
  const placeholder = st && st.isDirectory() && fs.readdirSync(dst).every((f) => f === 'README.md');
  if (st && !placeholder) { log('WARNING:', dst, 'contains its own files: not replaced'); return; }
  log('link    ', dst, '->', repo);
  if (!DRY) {
    if (st) fs.rmSync(dst, { recursive: true, force: true });
    fs.symlinkSync(path.resolve(repo), dst, process.platform === 'win32' ? 'junction' : 'dir');
  }
}

const listMd = (dir) => fs.readdirSync(path.join(KIT, dir)).filter((f) => f.endsWith('.md'));

// --- settings.json -------------------------------------------------------
const settingsPath = path.join(CLAUDE, 'settings.json');
const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
settings.hooks = settings.hooks || {};
// Drop previous pp-kit entries (idempotent re-install / uninstall).
for (const ev of Object.keys(settings.hooks)) {
  settings.hooks[ev] = settings.hooks[ev]
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(MARK)) }))
    .filter((g) => g.hooks.length);
  if (!settings.hooks[ev].length) delete settings.hooks[ev];
}

if (!UNINSTALL) {
  const cmd = (f) => `node "${path.join(HOOK_DIR, f).replace(/\\/g, '/')}"`;
  const add = (ev, matcher, file, timeout) => {
    settings.hooks[ev] = settings.hooks[ev] || [];
    const group = { hooks: [{ type: 'command', command: cmd(file), timeout }] };
    if (matcher) group.matcher = matcher;
    settings.hooks[ev].push(group);
  };
  add('PreToolUse', 'Bash|PowerShell', 'pre-shell.cjs', 15);
  add('PreToolUse', 'Write|Edit|MultiEdit|NotebookEdit', 'pre-write.cjs', 10);
  add('PreToolUse', 'mcp__.*(dataverse|azure-devops|ado|github|flowagent).*', 'pre-mcp.cjs', 10);
  add('PostToolUse', 'Write|Edit|MultiEdit', 'post-lint.cjs', 90);
  add('SessionStart', null, 'session-start.cjs', 10);
  add('SubagentStop', null, 'subagent-stop.cjs', 10);
  add('Stop', null, 'stop-reminder.cjs', 10);

  copyDir(path.join(KIT, 'agents'), path.join(CLAUDE, 'agents'));
  copyDir(path.join(KIT, 'skills'), path.join(CLAUDE, 'skills'), { keep: ['rules'] }); // rules/ may be a link to a rulebook
  copyDir(path.join(KIT, 'hooks'), HOOK_DIR, { keep: ['config.json'] });
  copyDir(path.join(KIT, 'templates'), path.join(CLAUDE, 'pp-kit', 'templates'));
  if (!DRY) {
    fs.mkdirSync(path.join(CLAUDE, 'pp-kit'), { recursive: true });
    fs.copyFileSync(path.join(KIT, 'templates', 'decision.md'), path.join(CLAUDE, 'pp-kit', 'decision.md'));
  }
  linkRules();
} else {
  const rm = (p) => { if (fs.existsSync(p)) { log('remove  ', p); if (!DRY) fs.rmSync(p, { recursive: true, force: true }); } };
  listMd('agents').forEach((f) => rm(path.join(CLAUDE, 'agents', f)));
  for (const s of fs.readdirSync(path.join(KIT, 'skills'))) {
    if (s === 'pp-standards') rm(path.join(CLAUDE, 'skills', s, 'SKILL.md')); // rules/ is left in place
    else rm(path.join(CLAUDE, 'skills', s));
  }
  rm(HOOK_DIR);
  rm(path.join(CLAUDE, 'pp-kit'));
}

const next = JSON.stringify(settings, null, 2) + '\n';
if (fs.existsSync(settingsPath) && fs.readFileSync(settingsPath, 'utf8') === next) {
  log('settings.json unchanged');
} else {
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  log('update  ', settingsPath, `(backup: settings.json.bak-ppkit-${ts})`);
  if (!DRY) {
    fs.mkdirSync(CLAUDE, { recursive: true });
    if (fs.existsSync(settingsPath)) fs.copyFileSync(settingsPath, `${settingsPath}.bak-ppkit-${ts}`);
    fs.writeFileSync(settingsPath, next);
  }
}
log(UNINSTALL ? 'pp-kit uninstalled.' : 'pp-kit installed. Restart Claude Code (or /agents) to load agents and hooks.');
