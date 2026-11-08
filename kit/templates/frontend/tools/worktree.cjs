#!/usr/bin/env node
// Worktrees for agents without a new "npm ci": node_modules is a junction to an installation with the
// same package-lock.json. Removal drops the junction first, so the shared node_modules is never deleted.
//   node tools/worktree.cjs new <path> <branch> [--app <dir>] [--from <dir with node_modules>]
//   node tools/worktree.cjs remove <path> [--app <dir>]
// <dir> is the app folder relative to the repository (default "."), e.g. src/codeapps/<app>.
// Recommended paths: short and outside OneDrive, e.g. C:\t\wt-<sprint>.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const [cmd, target, branch] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const app = opt('--app', '.');
const die = (m) => { console.error(`[worktree] ${m}`); process.exit(1); };
const git = (a, cwd = process.cwd()) => spawnSync('git', a, { cwd, encoding: 'utf8' });

const top = git(['rev-parse', '--show-toplevel']);
if (top.status) die('not inside a git repository');
const repo = top.stdout.trim();
if (!cmd || !target) die('usage: new <path> <branch> [--app <dir>] [--from <dir>] | remove <path> [--app <dir>]');
const wt = path.resolve(target);
const link = path.join(wt, app, 'node_modules');
const isLink = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };

if (cmd === 'new') {
  if (!branch) die('branch missing');
  const exists = git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0;
  const add = git(['worktree', 'add', ...(exists ? [wt, branch] : ['-b', branch, wt])], repo);
  if (add.status) die(add.stderr.trim());
  const from = path.resolve(opt('--from', path.join(repo, app)));
  const src = path.join(from, 'node_modules');
  // Line endings may differ (core.autocrlf in the new worktree): compare the content only.
  const lock = (d) => { try { return fs.readFileSync(path.join(d, 'package-lock.json'), 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } };
  if (!fs.existsSync(src)) { console.log(`OK worktree ${wt} (${branch}); no node_modules in ${from}: run npm ci there once`); process.exit(0); }
  if (lock(from) !== lock(path.join(wt, app))) { console.log(`OK worktree ${wt} (${branch}); package-lock.json differs from ${from}: run npm ci in the worktree`); process.exit(0); }
  fs.symlinkSync(src, link, process.platform === 'win32' ? 'junction' : 'dir');
  console.log(`OK worktree ${wt} (${branch}), node_modules -> ${src}`);
} else if (cmd === 'remove') {
  if (isLink(link)) fs.unlinkSync(link); // removes the junction only, never the shared installation
  else if (fs.existsSync(link)) console.log(`note: ${link} is a real folder, it is removed with the worktree`);
  const rm = git(['worktree', 'remove', wt], repo); // never --force: uncommitted work stays
  if (rm.status) die(`${rm.stderr.trim()} (commit or stash the changes first; do not use --force)`);
  console.log(`OK removed ${wt}`);
} else die(`unknown command ${cmd}`);
