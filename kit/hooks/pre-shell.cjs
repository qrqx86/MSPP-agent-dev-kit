#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): destructive-command deny, DEV-only environment checks, solution obligation,
// story reference on git commit, confirmation for release operations.
// Limits: shell variables and scripts are not expanded (`$u=...; pac ... --environment $u` is only caught when the
// literal value is in the same command). The hooks are a safety net, not a sandbox.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  readInput, loadConfig, toRegex, msg, findProjectRoot, projectDev, projectTracker, storyRef, isDev,
  hostsIn, isOrgHost, tokenize, program, flagValues, block, ask,
} = require('./lib.cjs');

const input = readInput();
const cmd = String((input.tool_input && input.tool_input.command) || '');
if (!cmd.trim()) process.exit(0);

const cfg = loadConfig();
const rx = (list) => list.map(toRegex);
const any = (list, s) => list.some((r) => r.test(s));
const allowed = any(rx(cfg.allowPatterns), cmd);
const prod = rx(cfg.prodPatterns);
const nonDev = rx(cfg.nonDevPatterns);
const envNames = rx(cfg.envNamePatterns);
const project = findProjectRoot(input.cwd);
const dev = projectDev(project);
const segments = tokenize(cmd);
const devLabel = dev ? (dev.host || dev.id) : '';

// Each command of the line as "program args..." (quotes removed): rules match a command, not text inside a
// quoted argument such as a commit message. Wrappers like "pwsh -Command '<cmd>'" are expanded one level.
const commands = [];
for (const seg of segments) {
  const { name, args } = program(seg);
  commands.push([name, ...args].join(' '));
  const inner = ['pwsh', 'powershell', 'bash', 'sh', 'cmd'].includes(name) && flagValues(args, /^(-c|-command|\/c)$/i)[0];
  if (inner) for (const s of tokenize(inner)) { const p = program(s); commands.push([p.name, ...p.args].join(' ')); }
}
const isCommand = (re) => commands.some((c) => { const m = c.match(re); return m && m.index === 0; });

// 1) Destructive commands: always denied ------------------------------------
for (const rule of cfg.denyPatterns) {
  if (isCommand(toRegex(rule.match))) block(msg('deny', { reason: rule.reason }));
}

// 2) Only DEV -----------------------------------------------------------------
// Checked only on environment designators: Power Platform hosts, values of --environment-like flags, the active
// pac profile, and release commands. Words like "production" elsewhere (build modes, titles) are not checked.
if (!allowed) {
  const remote = new Set(cfg.remoteTools.map((t) => t.toLowerCase()));
  const envFlags = toRegex(cfg.envFlagPattern);
  const envFlagTools = new Set((cfg.envFlagTools || ['pac', 'pa', 'dataverse']).map((t) => t.toLowerCase()));
  const release = toRegex(cfg.releaseCommandPattern);

  const checkHost = (h) => {
    if (any(prod, h) || any(nonDev, h)) block(msg('blockedEnv', { target: h }));
    if (dev && dev.host && isOrgHost(h) && h !== dev.host) block(msg('notDev', { target: h, dev: devLabel }));
  };
  const checkEnvValue = (v) => {
    for (const h of hostsIn(v)) checkHost(h);
    if (any(prod, v) || any(envNames, v)) block(msg('blockedEnv', { target: v }));
    if (dev && !isDev(dev, v)) block(msg('notDev', { target: v, dev: devLabel }));
  };

  let pacWithoutEnv = false;
  for (const seg of segments) {
    const { name, args } = program(seg);
    const text = seg.join(' ');
    const rel = [name, ...args].join(' ').match(release);
    if (rel && rel.index === 0 && any(prod, text)) block(msg('releaseProd'));
    if (!remote.has(name)) continue;
    for (const h of hostsIn(text)) checkHost(h);
    // Environment flags are read only for the Power Platform CLIs (elsewhere --env/--url mean other things).
    const flags = name === 'pa' ? new RegExp(`${envFlags.source}|^-e$`, 'i') : envFlags;
    const values = envFlagTools.has(name) ? flagValues(args, flags) : [];
    values.forEach(checkEnvValue);

    // pac without an explicit environment runs against the active auth profile (local commands excepted).
    if (name === 'pac' && !values.length) {
      const verb = args.filter((a) => !/^-/.test(a)).slice(0, 2).join(' ').toLowerCase();
      const local = cfg.pacLocalCommands.some((c) => verb === c || verb.startsWith(`${c} `) || verb.split(' ')[0] === c);
      if (verb && !local) pacWithoutEnv = true;
    }
  }

  if (cfg.checkActivePacProfile && pacWithoutEnv) {
    const active = activePacProfile();
    if (active && !any(rx(cfg.allowPatterns), active)) {
      const desc = active.replace(/\s+/g, ' ').trim();
      const hosts = hostsIn(active);
      const names = active.replace(/\S+@\S+/g, ' ').replace(/https?:\/\/\S+/g, ' ');
      if (hosts.some((h) => any(prod, h) || any(nonDev, h)) || any(prod, names) || any(envNames, names)) {
        block(msg('profileBlocked', { profile: desc }));
      }
      if (dev && dev.host && hosts.length && !hosts.includes(dev.host)) block(msg('profileNotDev', { profile: desc, dev: devLabel }));
    }
  }
}

// Active pac profile line ("[n] * ..."), cached for 60 s: pac start-up is slow.
function activePacProfile() {
  const cache = path.join(os.tmpdir(), 'ppkit-pac-auth.json');
  try {
    const c = JSON.parse(fs.readFileSync(cache, 'utf8'));
    if (Date.now() - c.t < 60000) return c.active;
  } catch { /* no cache */ }
  let active = null;
  try {
    const out = execFileSync('pac', ['auth', 'list'], { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'], shell: process.platform === 'win32' });
    active = out.split(/\r?\n/).find((l) => /^\[\d+\]\s+\*/.test(l)) || null;
  } catch { return null; } // pac missing or slow
  try { fs.writeFileSync(cache, JSON.stringify({ t: Date.now(), active })); } catch { /* ignore */ }
  return active;
}

if (project) {
  // 3) Solution obligation -------------------------------------------------
  for (const rule of cfg.solutionRequired) {
    if (isCommand(toRegex(rule.match)) && !toRegex(rule.require).test(cmd)) block(msg('noSolution', { hint: rule.hint }));
  }

  // 4) Story reference on git commit ---------------------------------------
  if (cfg.requireStoryRef) {
    const tracker = projectTracker(project);
    const ref = toRegex((cfg.storyRefPatterns || {})[tracker] || 'AB#\\d+');
    for (const seg of segments) {
      const commit = gitCommitArgs(seg);
      if (!commit) continue;
      const reuses = (commit.includes('--amend') && commit.includes('--no-edit')) ||
        commit.some((a) => /^(-[Cc]|--reuse-message|--reedit-message|--fixup|--squash)(=|$)|^-[Cc]\S/.test(a));
      if (reuses) continue;
      const text = commitMessage(commit, input.cwd || project);
      if (text === null) block(msg('commitNoMessage', { example: storyRef(tracker, 1234) }));
      if (!ref.test(text)) block(msg('noStoryRef', { example: storyRef(tracker, 1234) }));
    }
  }
}

// Arguments after "commit" if the segment is a git commit (git options such as -C <dir> are skipped).
function gitCommitArgs(seg) {
  const { name, args } = program(seg);
  if (name !== 'git') return null;
  let i = 0;
  while (i < args.length && /^-/.test(args[i])) i += /^(-C|-c|--git-dir|--work-tree|--namespace)$/.test(args[i]) ? 2 : 1;
  return args[i] === 'commit' ? args.slice(i + 1) : null;
}

// Commit message from -m/--message and -F/--file; null when the editor would open.
function commitMessage(args, cwd) {
  const parts = [];
  let found = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    let m;
    if (a === '-m' || a === '--message') { parts.push(args[++i] || ''); found = true; } else if ((m = a.match(/^--message=(.*)$/s) || a.match(/^-m(.+)$/s))) { parts.push(m[1]); found = true; } else if (a === '-F' || a === '--file' || (m = a.match(/^--file=(.*)$/)) || (m = a.match(/^-F(.+)$/))) {
      const f = m ? m[1] : args[++i];
      found = true;
      try { parts.push(fs.readFileSync(path.resolve(cwd, f || ''), 'utf8')); } catch { parts.push(''); }
    }
  }
  return found ? parts.join('\n') : null;
}

// 5) Release and write operations: ask the user (everywhere) ------------------
for (const rule of cfg.askPatterns) {
  if (isCommand(toRegex(rule.match))) ask(msg('ask', { reason: rule.reason }));
}

process.exit(0);
