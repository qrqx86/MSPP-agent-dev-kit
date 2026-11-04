#!/usr/bin/env node
// Review/test state of the code. Fingerprint = git tree ids of the code folders in the WORKING TREE
// (committed or not), so committing reviewed code does not make the review stale.
// CLI: node state.cjs review|test   -> writes .claude/state/<name>.ok in the pp-kit project of the cwd.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DEFAULT_PATHS = ['src', 'solution', 'solutions', 'tests', 'pipelines', 'Pipelines', '.github', 'config'];

function fingerprint(root, paths = DEFAULT_PATHS) {
  const idx = path.join(os.tmpdir(), `ppkit-index-${process.pid}-${Date.now()}`);
  const env = { ...process.env, GIT_INDEX_FILE: idx };
  const git = (args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    try { git(['read-tree', 'HEAD']); } catch { git(['read-tree', '--empty']); }
    const existing = paths.filter((p) => fs.existsSync(path.join(root, p)));
    if (existing.length) git(['add', '-A', '--', ...existing]);
    const tree = git(['write-tree']);
    const listing = git(['ls-tree', tree, '--', ...paths]);
    return crypto.createHash('sha1').update(listing).digest('hex');
  } catch {
    return null; // not a git repository
  } finally {
    try { fs.rmSync(idx, { force: true }); } catch { /* ignore */ }
  }
}

const stateFile = (root, name) => path.join(root, '.claude', 'state', `${name}.ok`);

module.exports = { fingerprint, stateFile, DEFAULT_PATHS };

if (require.main === module) {
  const { findProjectRoot, loadConfig } = require('./lib.cjs');
  const name = process.argv[2];
  if (!/^(review|test)$/.test(name || '')) { console.error('usage: node state.cjs review|test'); process.exit(1); }
  const root = findProjectRoot(process.cwd()) || process.cwd();
  const fp = fingerprint(root, loadConfig().codePaths || DEFAULT_PATHS);
  if (!fp) { console.error('not a git repository'); process.exit(1); }
  fs.mkdirSync(path.dirname(stateFile(root, name)), { recursive: true });
  fs.writeFileSync(stateFile(root, name), `${new Date().toISOString()} ${fp}\n`);
  console.log(`${name}.ok ${fp}`);
}
