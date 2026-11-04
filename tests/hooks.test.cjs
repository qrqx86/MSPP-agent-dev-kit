// Smoke tests for pp-kit hooks: node tests/hooks.test.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOKS = path.join(__dirname, '..', 'kit', 'hooks');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ppkit-'));
const proj = path.join(tmp, 'proj');
const other = path.join(tmp, 'other');
fs.mkdirSync(proj); fs.mkdirSync(other);
fs.writeFileSync(path.join(proj, 'CLAUDE.md'), '# Project\n<!-- pp-kit:project -->\n');

const runHook = (hook, payload, env) =>
  spawnSync(process.execPath, [path.join(HOOKS, hook)], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, ...env } });

let failed = 0;
const expect = (label, hook, payload, code) => {
  const r = runHook(hook, payload);
  const ok = r.status === code;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} (exit ${r.status}, expected ${code})${ok ? '' : '\n     ' + (r.stderr || r.stdout)}`);
};
const expectOut = (label, hook, payload, re, env) => {
  const r = runHook(hook, payload, env);
  const ok = r.status === 0 && re.test(r.stdout);
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : `\n     exit ${r.status} stdout=${r.stdout} stderr=${r.stderr}`}`);
};
const sh = (command, cwd = proj) => ({ tool_name: 'Bash', cwd, tool_input: { command } });
const wr = (content, file = 'src/a.ts') => ({ tool_name: 'Write', cwd: proj, tool_input: { file_path: path.join(proj, file), content } });

// PROD
expect('pac to prod URL blocked', 'pre-shell.cjs', sh('pac solution import --environment https://contoso-prod.crm4.dynamics.com/ --path x.zip'), 2);
expect('az pipeline production blocked', 'pre-shell.cjs', sh('az pipelines run --name release-production'), 2);
expect('pac to DEV allowed', 'pre-shell.cjs', sh('pac solution export --environment https://contoso-dev.crm4.dynamics.com/ --name X --path x.zip'), 0);
expect('git with "product" allowed', 'pre-shell.cjs', sh('git status', other), 0);
// Solution obligation
expect('pac pcf push without solution blocked', 'pre-shell.cjs', sh('pac pcf push --environment https://contoso-dev.crm4.dynamics.com/ --publisher-prefix cnt'), 2);
expect('pac pcf push with solution ok', 'pre-shell.cjs', sh('pac pcf push --environment https://contoso-dev.crm4.dynamics.com/ --solution-unique-name MySol'), 0);
expect('pac code push -s ok', 'pre-shell.cjs', sh('pac code push --environment https://contoso-dev.crm4.dynamics.com/ -s MySol'), 0);
expect('pa app push without solution blocked', 'pre-shell.cjs', sh('pa app push'), 2);
// Story reference
expect('commit without reference blocked', 'pre-shell.cjs', sh('git add . && git commit -m "feat: wizard"'), 2);
expect('commit with AB# ok', 'pre-shell.cjs', sh('git commit -m "feat: wizard AB#123"'), 0);
expect('commit with GitHub #ref ok', 'pre-shell.cjs', sh('git commit -m "feat: wizard #42"'), 0);
expect('commit with "C#" only blocked', 'pre-shell.cjs', sh('git commit -m "feat: C#7 plug-in"'), 2);
expect('commit outside project ok', 'pre-shell.cjs', sh('git commit -m "chore: x"', other), 0);
expect('amend --no-edit ok', 'pre-shell.cjs', sh('git commit --amend --no-edit'), 0);
// Secrets (built by concatenation so this file does not trip the hook itself)
const S = (...p) => p.join('');
expect('connection string with secret blocked', 'pre-write.cjs', wr(S('const c = "AuthType=ClientSecret;Url=https://x;ClientId=1;Client', 'Secret=AbCdEf123456";')), 2);
expect('assigned password blocked', 'pre-write.cjs', wr(S('const pass', 'word = "Sup3rS3cret!";')), 2);
expect('private key blocked', 'pre-write.cjs', wr(S('-----BEGIN ', 'PRIVATE KEY-----\nabc')), 2);
expect('Entra client secret blocked', 'pre-write.cjs', wr(S('x = abc', '8Q~', 'abcdefghijklmnopqrstuvwxyz01234567')), 2);
expect('TS type "password: string" ok', 'pre-write.cjs', wr('interface U { password: string }'), 0);
expect('placeholder ${{ }} ok', 'pre-write.cjs', wr(S('pass', 'word: "${{ secrets.PWD }}"'), '.github/workflows/a.yml'), 0);
expect('process.env ok', 'pre-write.cjs', wr('const pwd = process.env.PWD_TEST;'), 0);
expect('allow-secret ok', 'pre-write.cjs', wr(S('const pass', 'word = "Sup3rS3cret!"; // pp-kit:allow-secret')), 0);
// Stop hook outside git repo: silent
expect('stop outside repo silent', 'stop-reminder.cjs', { cwd: other }, 0);

// Deny, ask, CLIs, MCP, SessionStart, SubagentStop, kill switch
expect('pac admin delete denied', 'pre-shell.cjs', sh('pac admin delete --environment https://contoso-dev.crm4.dynamics.com/'), 2);
expect('dataverse to prod blocked', 'pre-shell.cjs', sh('dataverse data query --environment https://x-prod.crm4.dynamics.com accounts'), 2);
expectOut('import to DEV asks', 'pre-shell.cjs', sh('pac solution import --environment https://contoso-dev.crm4.dynamics.com/ --path x.zip'), /"permissionDecision":"ask"/);
expectOut('pa app push with solution asks', 'pre-shell.cjs', sh('pa app push --solution-id 123'), /"ask"/);
expectOut('gh workflow run asks', 'pre-shell.cjs', sh('gh workflow run release-core.yml -f environment=test'), /"ask"/);
expectOut('gh issue create asks', 'pre-shell.cjs', sh('gh issue create --title "DECISION: x" --label decision'), /"ask"/);
expect('gh issue view allowed', 'pre-shell.cjs', sh('gh issue view 42'), 0);
const ks = runHook('pre-shell.cjs', sh('pac admin delete --environment x'), { PPKIT_DISABLE_HOOKS: '1' });
console.log(`${ks.status === 0 ? 'OK  ' : 'FAIL'} kill switch PPKIT_DISABLE_HOOKS=1`); if (ks.status !== 0) failed++;
expect('MCP to prod blocked', 'pre-mcp.cjs', { tool_name: 'mcp__dataverse__read_query', tool_input: { env: 'https://a-prod.crm4.dynamics.com' } }, 2);
expectOut('MCP write asks', 'pre-mcp.cjs', { tool_name: 'mcp__dataverse__create_record', tool_input: { table: 'account' } }, /"ask"/);
expectOut('GitHub MCP write asks', 'pre-mcp.cjs', { tool_name: 'mcp__github__create_issue', tool_input: { title: 'x' } }, /"ask"/);
expect('MCP read allowed', 'pre-mcp.cjs', { tool_name: 'mcp__azure-devops__wit_get_work_item', tool_input: { id: 1 } }, 0);
fs.mkdirSync(path.join(proj, 'docs', 'project'), { recursive: true });
fs.writeFileSync(path.join(proj, 'docs', 'project', 'decisions.md'), '| #7 | 2026-11-04 | – | Use SPA | Open | – |\n| #8 | 2026-11-04 | #3 | X | Approved | – |\n');
expectOut('SessionStart shows open project decisions', 'session-start.cjs', { cwd: proj }, /Open project DECISIONS \(1,/);
expectOut('SessionStart outside git: asks for story ID', 'session-start.cjs', { cwd: proj }, /no story ID/);
expectOut('SubagentStop without Rules applied: block', 'subagent-stop.cjs', { cwd: proj, agent_type: 'dora-dataverse', last_assistant_message: 'Done.' }, /"decision":"block"/);
expectOut('SubagentStop with Rules applied: ok', 'subagent-stop.cjs', { cwd: proj, agent_type: 'dora-dataverse', last_assistant_message: '### Rules applied\n- X' }, /^$/);
expectOut('SubagentStop other agent: ignored', 'subagent-stop.cjs', { cwd: proj, agent_type: 'Explore', last_assistant_message: 'x' }, /^$/);
expectOut('SubagentStop outside project: ignored', 'subagent-stop.cjs', { cwd: other, agent_type: 'dora-dataverse', last_assistant_message: 'x' }, /^$/);

// Only DEV – lifecycle recognition everywhere, allow-list in projects with a declared DEV
const proj2 = path.join(tmp, 'proj2');
fs.mkdirSync(proj2);
const DEVID = '8fb51d37-0000-4000-8000-d64f613f6850';
fs.writeFileSync(path.join(proj2, 'CLAUDE.md'),
  `# P\n<!-- pp-kit:project -->\n- Work item tracker: github\n- DEV environment (the only one agents may use): URL https://contoso-demo-dev.crm4.dynamics.com | ID ${DEVID}\n`);
const sh2 = (command) => ({ tool_name: 'Bash', cwd: proj2, tool_input: { command } });
expect('TEST URL blocked everywhere', 'pre-shell.cjs', sh('pac solution list --environment https://contoso-test.crm4.dynamics.com/', other), 2);
expect('UAT URL blocked everywhere', 'pre-shell.cjs', sh('pac solution list --environment https://uat-contoso-01.crm4.dynamics.com/', other), 2);
expect('"latest" in host not mistaken for test', 'pre-shell.cjs', sh('pac solution list --environment https://latest-dev.crm4.dynamics.com/', other), 0);
expect('npx playwright test allowed', 'pre-shell.cjs', sh('npx playwright test --project=chromium'), 0);
expect('declared DEV allowed (URL)', 'pre-shell.cjs', sh2('pac solution export --environment https://contoso-demo-dev.crm4.dynamics.com/ --name X --path x.zip'), 0);
expect('declared DEV allowed (ID)', 'pre-shell.cjs', sh2(`pac solution list --environment ${DEVID}`), 0);
expect('other environment in project blocked', 'pre-shell.cjs', sh2('pac solution list --environment https://contoso-other-dev.crm4.dynamics.com/'), 2);
expect('other ID in project blocked', 'pre-shell.cjs', sh2('pac solution list --environment 11111111-2222-4333-8444-555555555555'), 2);
expect('curl to other org blocked', 'pre-shell.cjs', sh2('curl https://org84322999.crm4.dynamics.com/api/data/v9.2/WhoAmI'), 2);
expect('MCP other org in project blocked', 'pre-mcp.cjs', { tool_name: 'mcp__dataverse__read_query', cwd: proj2, tool_input: { url: 'https://contoso-other-dev.crm4.dynamics.com' } }, 2);
expect('MCP TEST blocked', 'pre-mcp.cjs', { tool_name: 'mcp__dataverse__read_query', cwd: other, tool_input: { url: 'https://contoso-test.crm4.dynamics.com' } }, 2);

// SessionStart with GitHub tracker on a story branch
spawnSync('git', ['init', '-q', '-b', 'feature/42-wizard'], { cwd: proj2 });
expectOut('SessionStart GitHub story ref', 'session-start.cjs', { cwd: proj2 }, /Active story: #42/);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} tests failed` : '\nAll tests passed');
process.exit(failed ? 1 : 0);
