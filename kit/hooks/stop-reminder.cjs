#!/usr/bin/env node
// Stop: in pp-kit projects, remind the user to run /review and /test when they are missing or stale.
'use strict';
const fs = require('fs');
const { readInput, loadConfig, findProjectRoot, msg } = require('./lib.cjs');
const { fingerprint, stateFile, DEFAULT_PATHS } = require('./state.cjs');

const input = readInput();
if (input.stop_hook_active) process.exit(0);
const root = findProjectRoot(input.cwd);
if (!root) process.exit(0);

const fp = fingerprint(root, loadConfig().codePaths || DEFAULT_PATHS);
if (!fp) process.exit(0); // not a git repository

const stale = (name) => {
  try { return !fs.readFileSync(stateFile(root, name), 'utf8').includes(fp); } catch { return true; }
};
const missing = [stale('review') && '/review', stale('test') && '/test'].filter(Boolean);
if (missing.length) {
  process.stdout.write(JSON.stringify({ systemMessage: msg('stopReminder', { missing: missing.join(msg('and')) }) }));
}
process.exit(0);
