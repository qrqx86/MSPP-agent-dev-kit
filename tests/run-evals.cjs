// Behavioural evals of the agents (calls Claude, costs tokens).
// Usage: node tests/run-evals.cjs [--only <id>] [--list]
// Each scenario runs headless in plan mode (no changes) inside a temporary pp-kit project.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kit', 'evals', 'scenarios.json'), 'utf8'));
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx > 0 ? process.argv[onlyIdx + 1] : null;
if (process.argv.includes('--list')) { scenarios.forEach((s) => console.log(`${s.id}  (${s.agent})`)); process.exit(0); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ppkit-eval-'));
fs.copyFileSync(path.join(__dirname, '..', 'kit', 'templates', 'project', 'CLAUDE.md'), path.join(tmp, 'CLAUDE.md'));

// "(?i)" prefix (PCRE style) → JavaScript "i" flag.
const rx = (p) => (p.startsWith('(?i)') ? new RegExp(p.slice(4), 'i') : new RegExp(p));
scenarios.forEach((s) => [...s.expect, ...s.forbid].forEach(rx)); // fail fast on invalid patterns

// Negations (English, Italian, German) that turn a sentence into a refusal.
const NEGATION = /\b(not|no|never|don't|doesn't|won't|cannot|can't|without|instead of|non|mai|senza|nessun\w*|invece di|nicht|kein\w*|nie)\b|n't\b/i;

let failed = 0;
for (const s of scenarios.filter((x) => !only || x.id === only)) {
  // Prompt via stdin: avoids cmd.exe quoting issues with the npm .cmd launcher on Windows.
  const r = spawnSync('claude', ['-p', '--agent', s.agent, '--permission-mode', 'plan', '--output-format', 'text'],
    { cwd: tmp, input: s.prompt, encoding: 'utf8', timeout: 300000, shell: process.platform === 'win32' });
  const text = `${r.stdout || ''}`;
  const miss = s.expect.filter((p) => !rx(p).test(text));
  // A forbidden pattern counts only in a sentence that is not a refusal ("I won't run pac solution import ...").
  const sentences = text.split(/(?<=[.!?:;])\s+|\n+/);
  const bad = s.forbid.filter((p) => sentences.some((x) => rx(p).test(x) && !NEGATION.test(x)));
  const ok = r.status === 0 && !miss.length && !bad.length;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${s.id}`);
  if (!ok) {
    if (r.status !== 0) console.log(`     exit ${r.status}: ${(r.stderr || '').slice(0, 300)}`);
    miss.forEach((p) => console.log(`     expected: ${p}`));
    bad.forEach((p) => console.log(`     forbidden: ${p}`));
    console.log(`     answer: ${text.replace(/\s+/g, ' ').slice(0, 400)}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} scenarios failed` : '\nAll scenarios passed');
process.exit(failed ? 1 : 0);
