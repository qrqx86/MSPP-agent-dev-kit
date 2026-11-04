#!/usr/bin/env node
// SessionStart: in pp-kit projects inject the active story (from the branch name), its open decisions and
// unfinished tasks, and the open decisions of the whole project.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readInput, loadConfig, toRegex, msg, findProjectRoot, projectTracker, storyRef } = require('./lib.cjs');

const input = readInput();
const root = findProjectRoot(input.cwd);
if (!root) process.exit(0);
const cfg = loadConfig();
const tracker = projectTracker(root);
const open = toRegex(`\\|\\s*(${cfg.openStatePattern || 'Open'})\\s*\\|`);
const done = toRegex(`\\|\\s*(${cfg.doneStatePattern || 'done'})\\s*\\|\\s*$`);
const rows = (f, keep) => {
  try { return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^\|/.test(l) && keep(l)); } catch { return null; }
};

let branch = '';
try {
  branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch { /* not a git repo */ }

const m = branch.match(/(?:^|\/)(?:AB#?|#)?(\d+)(?:[-_]|$)/i);
const lines = [msg('sessionProject', { tracker })];
if (!m) {
  lines.push(msg('sessionNoStory', { branch: branch || '-' }));
} else {
  const id = m[1];
  const dir = path.join(root, 'docs', 'stories', id);
  lines.push(msg('sessionStory', { ref: storyRef(tracker, id), branch }));
  if (!fs.existsSync(dir)) {
    lines.push(msg('sessionNoStoryDir', { id }));
  } else {
    const dec = rows(path.join(dir, cfg.storyDecisionsFile || 'decisions.md'), (l) => open.test(l));
    if (dec) lines.push(dec.length ? `${msg('sessionOpenDecisions', { n: dec.length })}\n${dec.join('\n')}` : msg('sessionNoOpenDecisions'));
    const todo = rows(path.join(dir, 'tasks.md'), (l) => /^\|\s*T\d+/.test(l) && !done.test(l));
    if (todo && todo.length) lines.push(`${msg('sessionTasks')}\n${todo.join('\n')}`);
  }
}
// Open decisions of the whole project (register kept by Pia and the main session).
const reg = rows(path.join(root, 'docs', 'project', cfg.projectDecisionsFile || 'decisions.md'), (l) => open.test(l));
if (reg && reg.length) {
  lines.push(`${msg('sessionProjectDecisions', { n: reg.length })}\n${reg.slice(0, 10).join('\n')}${reg.length > 10 ? '\n...' : ''}`);
}
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') } }));
process.exit(0);
