#!/usr/bin/env node
// Quality gates of the front-end app with a short result (3-5 lines) instead of the full output.
// Runs the npm scripts that exist, in this order, and stops at the first failure:
//   build, lint, typecheck, i18n:check, test, budget       (or: --only lint,test)
// Usage, in the app folder: node tools/verify.cjs [--only <s,s>] [--app <dir>]
// The full log of a failed script is saved in .verify/<script>.log (add .verify/ to .gitignore).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const dir = path.resolve(opt('--app') || '.');
let pkg;
try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { console.error(`[verify] no package.json in ${dir}`); process.exit(1); }
const order = opt('--only') ? opt('--only').split(',') : ['build', 'lint', 'typecheck', 'i18n:check', 'test', 'budget'];
const scripts = order.filter((s) => pkg.scripts && pkg.scripts[s]);
const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim() || '-';
// Lines worth showing from a failed run: failing tests and files, errors, budget lines.
const INTERESTING = /(FAIL|✗|×|Error|error TS|ERR!|failed|exceeds|budget|AssertionError|Expected|Received)/i;

const done = [];
for (const s of scripts) {
  const t0 = Date.now();
  const r = spawnSync(`npm run -s ${s}`, { cwd: dir, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const secs = Math.round((Date.now() - t0) / 1000);
  if (r.status === 0) { done.push(`${s} ${secs}s`); continue; }
  const log = `${r.stdout || ''}\n${r.stderr || ''}`;
  fs.mkdirSync(path.join(dir, '.verify'), { recursive: true });
  const file = path.join('.verify', `${s.replace(/[^\w-]/g, '_')}.log`);
  fs.writeFileSync(path.join(dir, file), log);
  const lines = [...new Set(log.split(/\r?\n/).map((l) => l.trim()).filter((l) => INTERESTING.test(l)))].slice(0, 5);
  console.log(`FAIL ${s} (${secs}s) @${head}${done.length ? ` – passed: ${done.join(', ')}` : ''}`);
  (lines.length ? lines : log.trim().split(/\r?\n/).slice(-3)).forEach((l) => console.log(`  ${l.slice(0, 160)}`));
  console.log(`  log: ${file}`);
  process.exit(1);
}
console.log(`OK @${head}: ${done.join(', ') || 'no scripts found'}`);
