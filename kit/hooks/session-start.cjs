#!/usr/bin/env node
// SessionStart: in pp-kit projects inject the active story (from the branch name) and its open decisions.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readInput, findProjectRoot, projectTracker, storyRef } = require('./lib.cjs');

const input = readInput();
const root = findProjectRoot(input.cwd);
if (!root) process.exit(0);
const tracker = projectTracker(root);

let branch = '';
try {
  branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch { /* not a git repo */ }

const m = branch.match(/(?:^|\/)(?:AB#?|#)?(\d{1,})(?:[-_]|$)/i);
const lines = [`[pp-kit] Power Platform project (work item tracker: ${tracker}).`];
if (!m) {
  lines.push(`Branch "${branch || '-'}" has no story ID: before changing code, ask for the user story ID (/story <ID>).`);
} else {
  const id = m[1];
  const dir = path.join(root, 'docs', 'stories', id);
  lines.push(`Active story: ${storyRef(tracker, id)} (branch ${branch}).`);
  if (!fs.existsSync(dir)) {
    lines.push(`docs/stories/${id}/ does not exist yet: run /story ${id} for spec and plan.`);
  } else {
    const dec = path.join(dir, 'decisions.md');
    if (fs.existsSync(dec)) {
      const open = fs.readFileSync(dec, 'utf8').split(/\r?\n/).filter((l) => /^\|/.test(l) && /\|\s*Open\s*\|/i.test(l));
      lines.push(open.length ? `Open DECISIONS (${open.length}) - do not proceed on these points:\n${open.join('\n')}` : 'No open DECISION recorded locally.');
    }
    const tasks = path.join(dir, 'tasks.md');
    if (fs.existsSync(tasks)) {
      const todo = fs.readFileSync(tasks, 'utf8').split(/\r?\n/).filter((l) => /^\|\s*T\d+/.test(l) && !/\|\s*done\s*\|\s*$/i.test(l));
      if (todo.length) lines.push(`Unfinished tasks:\n${todo.join('\n')}`);
    }
  }
}
// Open decisions of the whole project (register kept by Pia and the main session)
const reg = path.join(root, 'docs', 'project', 'decisions.md');
if (fs.existsSync(reg)) {
  const open = fs.readFileSync(reg, 'utf8').split(/\r?\n/).filter((l) => /^\|/.test(l) && /\|\s*Open\s*\|/i.test(l));
  if (open.length) lines.push(`Open project DECISIONS (${open.length}, register docs/project/decisions.md):\n${open.slice(0, 10).join('\n')}${open.length > 10 ? '\n...' : ''}`);
}
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') } }));
process.exit(0);
