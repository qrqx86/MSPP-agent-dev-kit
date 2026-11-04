// Static checks of the kit: node tests/validate-kit.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const KIT = path.join(__dirname, '..', 'kit');
const errors = [];
const err = (f, m) => errors.push(`${path.relative(KIT, f)}: ${m}`);

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const frontmatter = (txt) => {
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
};
const field = (fm, k) => (fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm')) || [])[1];

// 1) Agents
const agents = fs.readdirSync(path.join(KIT, 'agents')).filter((f) => f.endsWith('.md'));
if (agents.length !== 11) errors.push(`expected 11 agents, found ${agents.length}`);
for (const a of agents) {
  const f = path.join(KIT, 'agents', a);
  const fm = frontmatter(fs.readFileSync(f, 'utf8'));
  if (!fm) { err(f, 'missing frontmatter'); continue; }
  if (field(fm, 'name') !== a.replace(/\.md$/, '')) err(f, 'name differs from file name');
  if (!field(fm, 'description') || field(fm, 'description').length < 60) err(f, 'description missing or too short');
  if (!/^(opus|sonnet|haiku|fable|inherit)$/.test(field(fm, 'model') || '')) err(f, 'model missing or invalid');
  for (const s of ['pp-standards', 'pp-team-rules']) if (!fm.includes(`- ${s}`)) err(f, `skill ${s} not preloaded`);
  if (a.startsWith('kuno') && /\b(Write|Edit)\b/.test(field(fm, 'tools') || '')) err(f, 'Kuno must not have Write/Edit');
}

// 2) Skills
const skillsDir = path.join(KIT, 'skills');
for (const s of fs.readdirSync(skillsDir)) {
  const f = path.join(skillsDir, s, 'SKILL.md');
  if (!fs.existsSync(f)) { err(f, 'SKILL.md missing'); continue; }
  const txt = fs.readFileSync(f, 'utf8');
  const fm = frontmatter(txt);
  if (!fm || field(fm, 'name') !== s || !field(fm, 'description')) err(f, 'invalid frontmatter name/description');
}
// Skills with external side effects: user-invoked only and with approval gates
for (const s of ['new-project', 'deploy-test', 'story', 'project-plan']) {
  const txt = fs.readFileSync(path.join(skillsDir, s, 'SKILL.md'), 'utf8');
  if (!/disable-model-invocation:\s*true/.test(txt)) errors.push(`skills/${s}: missing disable-model-invocation: true`);
}
for (const s of ['new-project', 'deploy-test', 'story', 'data-model', 'project-plan']) {
  const txt = fs.readFileSync(path.join(skillsDir, s, 'SKILL.md'), 'utf8');
  if (!/<!-- gate: [\w-]+ -->/.test(txt)) errors.push(`skills/${s}: no approval gate <!-- gate: ... -->`);
}

// 3) Rule IDs cited by agents, skills and templates must exist in pp-standards
const standards = fs.readFileSync(path.join(skillsDir, 'pp-standards', 'SKILL.md'), 'utf8');
const defined = new Set([...standards.matchAll(/^\|\s*([A-Z]{2,3}-\d{2})\s*\|/gm)].map((m) => m[1]));
const ruleId = /\b(ALM|NAM|DV|SEC|FE|CA|BE|AU|PC|OB|ACC|MUL|TST)-\d{2}\b/g;

// 4) Content rules over agents, skills and templates (hooks excluded: they match these on purpose)
const obsolete = [
  [/\bpac solution create(?![-\w])/, 'pac solution create does not exist (use pac solution init)'],
  [/\bpac data\b/, 'pac data does not exist'],
  [/\bpac test run\b/, 'Test Engine is deprecated'],
];
// Lines that explicitly warn against a command are allowed to name it.
const warning = /does not exist|do not exist|do not use|deprecated|replaced|→/i;
const realEnv = /https:\/\/(?!<)[a-z0-9-]+\.crm\d*\.dynamics\.com/i;
for (const f of walk(KIT).filter((p) => !p.includes(`${path.sep}hooks${path.sep}`) && /\.(md|json)$/.test(p))) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    if (warning.test(line)) continue;
    for (const [re, m] of obsolete) if (re.test(line)) err(f, `${m} – "${line.trim().slice(0, 80)}"`);
  }
  for (const m of txt.matchAll(ruleId)) if (!defined.has(m[0])) err(f, `rule ${m[0]} not defined in pp-standards`);
  const env = txt.match(realEnv);
  if (env) err(f, `real environment URL in the kit: ${env[0]}`);
  if (/AB#\d+/.test(txt) && !f.endsWith('.md')) err(f, 'real story ID in the kit');
}

if (errors.length) {
  console.log(errors.map((e) => `FAIL ${e}`).join('\n'));
  process.exit(1);
}
console.log(`OK  kit valid (${agents.length} agents, ${fs.readdirSync(skillsDir).length} skills, ${defined.size} rules)`);
