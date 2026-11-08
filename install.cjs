#!/usr/bin/env node
// pp-kit installer: copies agents, skills, hooks and templates into ~/.claude
// and merges the hook entries into ~/.claude/settings.json (existing hooks are preserved).
// Usage: node install.cjs [--dry-run] [--uninstall] [--force]
//   --force      also overwrite agents/skills with the same name that were not installed by pp-kit
// Installed files changed by hand since the last install are backed up (<file>.bak-ppkit-<time>) and reported.
//   PPKIT_HOME   alternative Claude configuration folder (default ~/.claude), used by the tests
// Edition-specific settings (rules folder, texts) are in kit/install.json.
'use strict';
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const path = require('path');

const DRY = process.argv.includes('--dry-run');
const UNINSTALL = process.argv.includes('--uninstall');
const FORCE = process.argv.includes('--force');
const KIT = path.join(__dirname, 'kit');
const ED = JSON.parse(fs.readFileSync(path.join(KIT, 'install.json'), 'utf8'));
const T = ED.texts;
const CLAUDE = process.env.PPKIT_HOME || path.join(os.homedir(), '.claude');
const HOOK_DIR = path.join(CLAUDE, 'hooks', 'pp-kit');
const STATE_DIR = path.join(CLAUDE, 'pp-kit');
const MANIFEST = path.join(STATE_DIR, 'manifest.json');
const MARK = 'hooks/pp-kit/';
const log = (...a) => console.log(DRY ? '[dry-run]' : '', ...a);

// What pp-kit installed before: manifest, or (installs older than the manifest) everything with our names.
const legacy = !fs.existsSync(MANIFEST) && fs.existsSync(HOOK_DIR);
let owned = [];
let hashes = {}; // file (relative to the Claude folder) -> sha256 of what pp-kit installed last time
try {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  owned = m.items || [];
  hashes = m.files || {};
} catch { /* first install */ }
const isOwned = (rel) => legacy || owned.includes(rel);
const installed = [];
const files = {};
const TS = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const relOf = (d) => path.relative(CLAUDE, d).split(path.sep).join('/');

// Copy one file. A file changed by hand since the last install (hash differs from the manifest) is
// backed up and reported before it is replaced: changes to the kit belong in the kit repository.
function copyFile(s, d) {
  const src = fs.readFileSync(s);
  const rel = relOf(d);
  files[rel] = sha(src);
  if (!fs.existsSync(d)) { log(T.create, d); if (!DRY) { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); } return; }
  const cur = fs.readFileSync(d);
  if (cur.equals(src)) return;
  if (hashes[rel] && hashes[rel] !== sha(cur)) {
    log(T.modified, d, `(backup: ${path.basename(d)}.bak-ppkit-${TS})`);
    if (!DRY) fs.copyFileSync(d, `${d}.bak-ppkit-${TS}`);
  } else log(T.update, d);
  if (!DRY) fs.copyFileSync(s, d);
}

function copyDir(src, dst, { keep = [] } = {}) {
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) {
      if (keep.includes(name) && fs.existsSync(d)) { log(T.keep, d); continue; }
      if (!DRY) fs.mkdirSync(d, { recursive: true });
      copyDir(s, d, { keep }); // keep applies at every level (e.g. skills/<x>/rules)
    } else {
      if (keep.includes(name) && fs.existsSync(d)) { log(T.keep, d); continue; }
      copyFile(s, d);
    }
  }
}

// Agents and skills: one item per file/folder, never overwriting what belongs to the user.
function installItems(kind) {
  for (const name of fs.readdirSync(path.join(KIT, kind))) {
    const rel = `${kind}/${name}`;
    const s = path.join(KIT, kind, name);
    const d = path.join(CLAUDE, kind, name);
    if (fs.existsSync(d) && !isOwned(rel) && !FORCE) { log(T.notOurs, d); continue; }
    installed.push(rel);
    if (fs.statSync(s).isDirectory()) copyDir(s, d, { keep: ['rules'] }); // rules/ may be a link to a rulebook
    else copyFile(s, d);
  }
}

// rules/ of the standards skill -> junction/symlink to a rulebook folder (optional).
function linkRules() {
  const repo = process.env[ED.rulesEnv] || (ED.rulesDefault ? path.join(os.homedir(), ...ED.rulesDefault) : null);
  if (!repo) return;
  const dst = path.join(CLAUDE, 'skills', ED.rulesSkill, 'rules');
  let st = null;
  try { st = fs.lstatSync(dst); } catch { /* missing */ }
  if (st && st.isSymbolicLink()) { log(T.rules, dst, '->', fs.readlinkSync(dst)); return; }
  if (!fs.existsSync(ED.rulesCheck ? path.join(repo, ED.rulesCheck) : repo)) { log(T.rulesMissing, repo); return; }
  const placeholder = st && st.isDirectory() && fs.readdirSync(dst).every((f) => f === 'README.md');
  if (st && !placeholder) { log(T.rulesOwn, dst); return; }
  log(T.link, dst, '->', repo);
  if (!DRY) {
    if (st) fs.rmSync(dst, { recursive: true, force: true });
    fs.symlinkSync(path.resolve(repo), dst, process.platform === 'win32' ? 'junction' : 'dir');
  }
}

// --- settings.json -------------------------------------------------------
const settingsPath = path.join(CLAUDE, 'settings.json');
let settings = {};
if (fs.existsSync(settingsPath)) {
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (e) {
    console.error(`${T.badSettings} ${settingsPath}: ${e.message}`);
    process.exit(1);
  }
}
settings.hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};
// Drop previous pp-kit entries (idempotent re-install / uninstall); other hooks are kept as they are.
for (const ev of Object.keys(settings.hooks)) {
  if (!Array.isArray(settings.hooks[ev])) continue;
  settings.hooks[ev] = settings.hooks[ev]
    .map((g) => ({ ...g, hooks: (Array.isArray(g.hooks) ? g.hooks : []).filter((h) => !String(h.command || '').includes(MARK)) }))
    .filter((g) => g.hooks.length);
  if (!settings.hooks[ev].length) delete settings.hooks[ev];
}

const rm = (p) => { if (fs.existsSync(p)) { log(T.remove, p); if (!DRY) fs.rmSync(p, { recursive: true, force: true }); } };

if (!UNINSTALL) {
  const cmd = (f) => `node "${path.join(HOOK_DIR, f).replace(/\\/g, '/')}"`;
  const add = (ev, matcher, file, timeout) => {
    if (!Array.isArray(settings.hooks[ev])) settings.hooks[ev] = [];
    const group = { hooks: [{ type: 'command', command: cmd(file), timeout }] };
    if (matcher) group.matcher = matcher;
    settings.hooks[ev].push(group);
  };
  add('PreToolUse', 'Bash|PowerShell', 'pre-shell.cjs', 15);
  add('PreToolUse', 'Write|Edit|MultiEdit|NotebookEdit', 'pre-write.cjs', 10);
  add('PreToolUse', 'mcp__.*(dataverse|azure-devops|ado__|github|flowagent).*', 'pre-mcp.cjs', 10);
  add('PostToolUse', 'Write|Edit|MultiEdit', 'post-lint.cjs', 90);
  add('SessionStart', null, 'session-start.cjs', 10);
  add('SubagentStop', null, 'subagent-stop.cjs', 10);
  add('Stop', null, 'stop-reminder.cjs', 15);

  for (const f of ED.legacyCommands || []) {
    const p = path.join(CLAUDE, 'commands', f);
    if (fs.existsSync(p) && legacy) rm(p); // slash commands of kit v1, now skills
  }
  installItems('agents');
  installItems('skills');
  copyDir(path.join(KIT, 'hooks'), HOOK_DIR, { keep: ['config.json'] });
  copyDir(path.join(KIT, 'templates'), path.join(STATE_DIR, 'templates'));
  if (!DRY) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.copyFileSync(path.join(KIT, 'templates', ED.decisionTemplate), path.join(STATE_DIR, ED.decisionTemplate));
    fs.writeFileSync(MANIFEST, JSON.stringify({ items: installed, files }, null, 2) + '\n');
  }
  linkRules();
} else {
  const items = legacy ? ['agents', 'skills'].flatMap((k) => fs.readdirSync(path.join(KIT, k)).map((n) => `${k}/${n}`)) : owned;
  for (const rel of items) {
    const p = path.join(CLAUDE, ...rel.split('/'));
    if (rel === `skills/${ED.rulesSkill}`) rm(path.join(p, 'SKILL.md')); // rules/ is left in place
    else rm(p);
  }
  if (legacy) (ED.legacyCommands || []).forEach((f) => rm(path.join(CLAUDE, 'commands', f)));
  // Hooks: everything except the team's own config.json.
  if (fs.existsSync(HOOK_DIR)) for (const f of fs.readdirSync(HOOK_DIR)) if (f !== 'config.json') rm(path.join(HOOK_DIR, f));
  rm(STATE_DIR);
  if (fs.existsSync(path.join(HOOK_DIR, 'config.json'))) log(T.keep, path.join(HOOK_DIR, 'config.json'));
}

const next = JSON.stringify(settings, null, 2) + '\n';
if (fs.existsSync(settingsPath) && fs.readFileSync(settingsPath, 'utf8') === next) {
  log(T.settingsSame);
} else {
  log(T.update, settingsPath, `(backup: settings.json.bak-ppkit-${TS})`);
  if (!DRY) {
    fs.mkdirSync(CLAUDE, { recursive: true });
    if (fs.existsSync(settingsPath)) fs.copyFileSync(settingsPath, `${settingsPath}.bak-ppkit-${TS}`);
    fs.writeFileSync(settingsPath, next);
  }
}
log(UNINSTALL ? T.uninstalled : T.installed);
