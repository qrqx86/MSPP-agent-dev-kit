#!/usr/bin/env node
// PostToolUse (Write|Edit|MultiEdit): run Prettier/ESLint (JS/TS) or dotnet format (C#) if available in the project.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readInput, msg } = require('./lib.cjs');

const input = readInput();
const file = String((input.tool_input && input.tool_input.file_path) || '');
if (!file || !fs.existsSync(file) || /[\\/]node_modules[\\/]/.test(file)) process.exit(0);

const findUp = (start, test) => {
  let dir = path.dirname(path.resolve(start));
  for (;;) {
    const hit = test(dir);
    if (hit) return hit;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};
const win = process.platform === 'win32';
// Windows .cmd launchers need a shell: build one quoted command line. Elsewhere: no shell, raw arguments.
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const run = (bin, args, cwd) => (win && /\.cmd$/i.test(bin)
  ? spawnSync([bin, ...args].map(q).join(' '), { cwd, encoding: 'utf8', timeout: 60000, shell: true })
  : spawnSync(bin, args, { cwd, encoding: 'utf8', timeout: 60000 }));

const ext = path.extname(file).toLowerCase();

if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
  const root = findUp(file, (d) => (fs.existsSync(path.join(d, 'package.json')) ? d : null));
  if (!root) process.exit(0);
  const bin = (name) => {
    const p = path.join(root, 'node_modules', '.bin', win ? `${name}.cmd` : name);
    return fs.existsSync(p) ? p : null;
  };
  const prettier = bin('prettier');
  if (prettier) run(prettier, ['--write', file], root);
  const eslint = bin('eslint');
  if (eslint) {
    const r = run(eslint, ['--fix', '--no-warn-ignored', file], root);
    if (r.status === 1 && r.stdout && r.stdout.trim()) {
      process.stderr.write(`[pp-kit] ${msg('eslint', { file })}\n${r.stdout.trim().slice(0, 4000)}\n`);
      process.exit(2); // feed lint errors back to Claude
    }
  }
} else if (ext === '.cs') {
  const proj = findUp(file, (d) => {
    const f = fs.readdirSync(d).find((n) => n.endsWith('.csproj'));
    return f ? path.join(d, f) : null;
  });
  if (proj) run('dotnet', ['format', 'whitespace', proj, '--include', file], path.dirname(proj));
}
process.exit(0);
