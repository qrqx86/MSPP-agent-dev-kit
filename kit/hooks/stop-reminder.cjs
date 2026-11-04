#!/usr/bin/env node
// Stop: in pp-kit projects, remind the user to run /review and /test when they are missing or stale.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readInput, findProjectRoot } = require('./lib.cjs');

const input = readInput();
if (input.stop_hook_active) process.exit(0);
const root = findProjectRoot(input.cwd);
if (!root) process.exit(0);

const git = (...args) => {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
};
const head = git('rev-parse', 'HEAD');
if (head === null) process.exit(0);
const dirty = (git('status', '--porcelain', '--', 'src', 'solution', 'solutions', 'tests', 'pipelines', 'Pipelines', '.github', 'config') || '') !== '';

const stale = (name) => {
  const f = path.join(root, '.claude', 'state', name);
  if (!fs.existsSync(f)) return true;
  return dirty || !fs.readFileSync(f, 'utf8').includes(head);
};
const missing = [stale('review.ok') && '/review', stale('test.ok') && '/test'].filter(Boolean);
if (missing.length) {
  process.stdout.write(JSON.stringify({ systemMessage: `pp-kit: ${missing.join(' and ')} not yet run on the current state of the code.` }));
}
process.exit(0);
