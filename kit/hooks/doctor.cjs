#!/usr/bin/env node
// Workstation and repository check (day 0 and start of every sprint). Not a hook: run it by hand.
// CLI: node doctor.cjs [--fix]
//   checks the CLIs in config "doctorTools", the CLI logins against the DEV of the project (CLAUDE.md),
//   the clone location (OneDrive, path length), git settings for Windows and free memory.
//   --fix sets the recommended git settings in the repository of the current folder.
// One line per check (OK / WARN / FAIL); exit 1 if a required check fails.
'use strict';
const os = require('os');
const { spawnSync } = require('child_process');
const { loadConfig, msg, findProjectRoot, projectDev } = require('./lib.cjs');

const FIX = process.argv.includes('--fix');
const cfg = loadConfig();
const cwd = process.cwd();
const root = findProjectRoot(cwd);
const dev = root ? projectDev(root) : null;
const win = process.platform === 'win32';

let fails = 0;
const line = (level, text) => {
  if (level === 'FAIL') fails++;
  console.log(`${level.padEnd(4)} ${text}`);
};
// CLIs installed with npm are .cmd shims on Windows: run through the shell.
const run = (cmd, args = [], timeout = 30000) => {
  const r = spawnSync([cmd, ...args].join(' '), { cwd, shell: true, encoding: 'utf8', timeout, windowsHide: true });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};
const firstLine = (s) => (s.split(/\r?\n/).find((l) => /\d+\.\d+/.test(l)) || s.split(/\r?\n/)[0] || '').trim().slice(0, 80);

// 1) Command line tools ----------------------------------------------------------
line('OK', msg('doctorNode', { version: process.version }));
for (const t of cfg.doctorTools || []) {
  const r = run(t.cmd, t.args || []);
  if (r.ok) line('OK', msg('doctorTool', { name: t.name, version: firstLine(r.out) }));
  else line(t.required ? 'FAIL' : 'WARN', msg('doctorToolMissing', { name: t.name, hint: t.hint || '' }));
}

// 2) Logins: every profile must point to the DEV of the project --------------------
if (!root) {
  line('WARN', msg('doctorNoProject'));
} else if (!dev || !dev.host) {
  line('WARN', msg('doctorNoDev'));
} else {
  for (const l of cfg.doctorLogins || []) {
    const r = run(l.cmd, l.args || []);
    if (!r.ok) line(l.required ? 'FAIL' : 'WARN', msg('doctorLoginMissing', { name: l.name, hint: (l.hint || '').replace('{dev}', dev.host) }));
    else if (l.devCheck && !r.out.toLowerCase().includes(dev.host)) line(l.required ? 'FAIL' : 'WARN', msg('doctorLoginNotDev', { name: l.name, dev: dev.host, hint: (l.hint || '').replace('{dev}', dev.host) }));
    else line('OK', msg('doctorLogin', { name: l.name }));
  }
}

// 3) Clone location and git settings ----------------------------------------------
const git = (args) => run('git', args, 10000);
const top = git(['rev-parse', '--show-toplevel']);
if (top.ok) {
  const repo = top.out.split(/\r?\n/)[0];
  const oneDrive = /onedrive/i.test(repo) || [process.env.OneDrive, process.env.OneDriveCommercial]
    .some((p) => p && repo.toLowerCase().replace(/\\/g, '/').startsWith(p.toLowerCase().replace(/\\/g, '/')));
  if (oneDrive) line('WARN', msg('doctorOneDrive', { repo }));
  const max = cfg.doctorMaxRepoPath || 80;
  if (repo.length > max) line('WARN', msg('doctorLongPath', { n: repo.length, max }));
  const want = [];
  if (win) want.push(['core.longpaths', 'true']);
  if (win && oneDrive) want.push(['windows.appendAtomically', 'false']);
  for (const [key, value] of want) {
    const cur = git(['config', '--get', key]).out.split(/\r?\n/)[0];
    if (cur === value) { line('OK', `git ${key}=${value}`); continue; }
    if (FIX && git(['config', key, value]).ok) line('OK', msg('doctorGitFixed', { key, value }));
    else line('WARN', msg('doctorGitSetting', { key, value }));
  }
} else {
  line('WARN', msg('doctorNoGit'));
}

// 4) Memory: several agents with builds and tests need free RAM -----------------------
const gb = (b) => Math.round((b / 1024 ** 3) * 10) / 10;
const total = gb(os.totalmem());
const free = gb(os.freemem());
const minTotal = cfg.doctorMinRamGb || 16;
const minFree = cfg.doctorMinFreeRamGb || 4;
line(total < minTotal || free < minFree ? 'WARN' : 'OK', msg('doctorRam', { total, free, minTotal, minFree }));

console.log(fails ? msg('doctorFailed', { n: fails }) : msg('doctorPassed'));
process.exit(fails ? 1 : 0);
