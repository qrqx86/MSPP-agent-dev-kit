// Tests for the pp-kit hooks: node tests/hooks.test.cjs
// The hooks are copied to a temporary folder, so config.json tests do not touch the repository.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const E = JSON.parse(fs.readFileSync(path.join(__dirname, 'edition.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ppkit-'));
const HOOKS = path.join(tmp, 'hooks');
fs.cpSync(path.join(__dirname, '..', 'kit', 'hooks'), HOOKS, { recursive: true });
const proj = path.join(tmp, 'proj');     // pp-kit project, Azure DevOps (default tracker), no DEV declared
const proj2 = path.join(tmp, 'proj2');   // pp-kit project, GitHub tracker, DEV declared
const other = path.join(tmp, 'other');   // not a pp-kit project
[proj, proj2, other].forEach((d) => fs.mkdirSync(d));
fs.writeFileSync(path.join(proj, 'CLAUDE.md'), `# Project\n${E.marker}\n`);
const DEVHOST = 'contoso-demo-dev.crm4.dynamics.com';
const DEVID = '8fb51d37-0000-4000-8000-d64f613f6850';
const OTHERID = '11111111-2222-4333-8444-555555555555';
fs.writeFileSync(path.join(proj2, 'CLAUDE.md'),
  `# P\n${E.marker}\n${E.githubLine}\n${E.devLine.replace('{host}', DEVHOST).replace('{id}', DEVID)}\n`);

const run = (hook, payload, env) =>
  spawnSync(process.execPath, [path.join(HOOKS, hook)], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, ...env } });

let failed = 0;
let count = 0;
const report = (label, ok, r) => {
  count++;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : `\n     exit ${r.status} stdout=${(r.stdout || '').slice(0, 300)} stderr=${(r.stderr || '').slice(0, 300)}`}`);
};
const asks = (r) => /"permissionDecision":"ask"/.test(r.stdout || '');
const BLOCK = (label, hook, payload) => { const r = run(hook, payload); report(label, r.status === 2, r); };
const ALLOW = (label, hook, payload) => { const r = run(hook, payload); report(label, r.status === 0 && !asks(r), r); };
const ASK = (label, hook, payload) => { const r = run(hook, payload); report(label, r.status === 0 && asks(r), r); };
const OUT = (label, hook, payload, re, env) => { const r = run(hook, payload, env); report(label, r.status === 0 && re.test(r.stdout), r); };

const sh = (command, cwd = proj) => ({ tool_name: 'Bash', cwd, tool_input: { command } });
const sh2 = (command) => sh(command, proj2);
const shx = (command) => sh(command, other);
const mcp = (tool, toolInput, cwd = other) => ({ tool_name: tool, cwd, tool_input: toolInput });
const wr = (content, file = 'src/a.ts') => ({ tool_name: 'Write', cwd: proj, tool_input: { file_path: path.join(proj, file), content } });
const S = (...p) => p.join(''); // secret-like strings built by concatenation so this file does not trip the hook itself

// --- pre-shell: destructive commands -------------------------------------------
BLOCK('pac admin delete denied', 'pre-shell.cjs', shx('pac admin delete --environment https://contoso-dev.crm4.dynamics.com/'));
BLOCK('pac admin restore denied', 'pre-shell.cjs', shx('pac admin restore --target-env x --source-env y'));
BLOCK('pac admin copy denied', 'pre-shell.cjs', shx('pac admin copy --source-env x --target-env y'));
BLOCK('environment-management delete denied', 'pre-shell.cjs', shx('pac environment-management delete-environment-by-id --id x'));
BLOCK('pac data bulk-delete denied', 'pre-shell.cjs', shx('pac data bulk-delete schedule --entity account'));
ASK('pac data import asks', 'pre-shell.cjs', shx('pac data import --data data.zip --environment https://contoso-dev.crm4.dynamics.com'));
ASK('pac auth clear asks', 'pre-shell.cjs', shx('pac auth clear'));
BLOCK('denied command inside pwsh -Command denied', 'pre-shell.cjs', shx('pwsh -Command "pac admin delete --environment x"'));
BLOCK('denied command after cd denied', 'pre-shell.cjs', shx('cd repo && pac data bulk-delete schedule'));
ALLOW('commit message mentioning a denied command allowed', 'pre-shell.cjs', shx('git commit -m "docs: pac data bulk-delete is denied"'));
ALLOW('echo of a release command not asked', 'pre-shell.cjs', shx('echo "run: gh workflow run release.yml"'));
ALLOW('echo of a prod release command not blocked', 'pre-shell.cjs', shx('echo "gh workflow run release.yml -f environment=prod"'));

// --- pre-shell: only DEV ---------------------------------------------------------
BLOCK('pac to prod URL blocked', 'pre-shell.cjs', shx('pac solution import --environment https://contoso-prod.crm4.dynamics.com/ --path x.zip'));
BLOCK('TEST URL blocked everywhere', 'pre-shell.cjs', shx('pac solution list --environment https://contoso-test.crm4.dynamics.com/'));
BLOCK('UAT URL blocked everywhere', 'pre-shell.cjs', shx('pac solution list --environment https://uat-contoso-01.crm4.dynamics.com/'));
BLOCK('environment display name TEST blocked', 'pre-shell.cjs', shx('pac solution list --environment "Contoso TEST"'));
BLOCK('dataverse to prod blocked', 'pre-shell.cjs', shx('dataverse data query --environment https://x-prod.crm4.dynamics.com accounts'));
BLOCK('GCC High prod host blocked', 'pre-shell.cjs', shx('curl https://contoso-prod.crm.microsoftdynamics.us/api/data/v9.2/WhoAmI'));
BLOCK('release pipeline to production blocked', 'pre-shell.cjs', shx('az pipelines run --name release-production'));
BLOCK('gh workflow to prod blocked', 'pre-shell.cjs', shx('gh workflow run release.yml -f environment=prod'));
ASK('gh workflow to test asks', 'pre-shell.cjs', shx('gh workflow run release-core.yml -f environment=test'));
ALLOW('pac to DEV allowed', 'pre-shell.cjs', shx('pac solution export --environment https://contoso-dev.crm4.dynamics.com/ --name X --path x.zip'));
ALLOW('"latest" in host not mistaken for test', 'pre-shell.cjs', shx('pac solution list --environment https://latest-dev.crm4.dynamics.com/'));
ALLOW('vite build --mode production allowed', 'pre-shell.cjs', sh('npx vite build --mode production'));
ALLOW('node script --env production allowed', 'pre-shell.cjs', sh('node scripts/build.js --env production'));
ALLOW('work item title with "production" allowed', 'pre-shell.cjs', sh('az boards work-item show --id 5 --query "fields.title" # Prepare production release'));
ALLOW('npx playwright test allowed', 'pre-shell.cjs', sh('npx playwright test --project=chromium'));
ALLOW('git status allowed', 'pre-shell.cjs', shx('git status'));
ALLOW('pac solution unpack is local (no profile check)', 'pre-shell.cjs', sh('pac solution unpack --zipfile x.zip --folder solution/X'));
ALLOW('declared DEV allowed (URL)', 'pre-shell.cjs', sh2(`pac solution export --environment https://${DEVHOST}/ --name X --path x.zip`));
ALLOW('declared DEV allowed (ID)', 'pre-shell.cjs', sh2(`pac solution list --environment ${DEVID}`));
ALLOW('declared DEV allowed (--environment=URL)', 'pre-shell.cjs', sh2(`pac solution list --environment=https://${DEVHOST}`));
BLOCK('other environment in project blocked', 'pre-shell.cjs', sh2('pac solution list --environment https://contoso-other-dev.crm4.dynamics.com/'));
BLOCK('other ID in project blocked', 'pre-shell.cjs', sh2(`pac solution list --environment ${OTHERID}`));
BLOCK('DEV host as prefix of another domain blocked', 'pre-shell.cjs', sh2(`pac solution list --environment https://${DEVHOST}.evil.io`));
BLOCK('display name in project blocked (use URL/ID)', 'pre-shell.cjs', sh2('pac solution list --environment "Contoso Demo DEV"'));
BLOCK('curl to other org blocked', 'pre-shell.cjs', sh2('curl https://org84322999.crm4.dynamics.com/api/data/v9.2/WhoAmI'));
ALLOW('curl --url to GitHub allowed in project', 'pre-shell.cjs', sh2('curl --url https://api.github.com/repos/x/y'));
BLOCK('pa --environment-id other GUID blocked', 'pre-shell.cjs', sh2(`pa app push --environment-id ${OTHERID} --solution-id 1`));
BLOCK('pa -e other GUID blocked', 'pre-shell.cjs', sh2(`pa app push -e ${OTHERID} -s 1`));
ASK('pa -e DEV GUID with -s asks', 'pre-shell.cjs', sh2(`pa app push -e ${DEVID} -s 1`));

// --- pre-shell: solution obligation ---------------------------------------------
BLOCK('pac pcf push without solution blocked', 'pre-shell.cjs', sh('pac pcf push --environment https://contoso-dev.crm4.dynamics.com/ --publisher-prefix cnt'));
ASK('pac pcf push with solution asks', 'pre-shell.cjs', sh('pac pcf push --environment https://contoso-dev.crm4.dynamics.com/ --solution-unique-name MySol'));
ALLOW('pac code push -s ok', 'pre-shell.cjs', sh('pac code push --environment https://contoso-dev.crm4.dynamics.com/ -s MySol'));
BLOCK('pa app push without solution blocked', 'pre-shell.cjs', sh('pa app push'));
ASK('pa app push --solution-id asks', 'pre-shell.cjs', sh('pa app push --solution-id 123'));
ASK('pa app push -s asks', 'pre-shell.cjs', sh('pa app push -s 123'));

// --- pre-shell: story reference -------------------------------------------------
fs.writeFileSync(path.join(proj, 'msg-ok.txt'), 'feat: wizard\n\nAB#77\n');
fs.writeFileSync(path.join(proj, 'msg-no.txt'), 'feat: wizard\n');
BLOCK('commit without reference blocked', 'pre-shell.cjs', sh('git add . && git commit -m "feat: wizard"'));
ALLOW('commit with AB# ok (Azure DevOps project)', 'pre-shell.cjs', sh('git commit -m "feat: wizard AB#123"'));
BLOCK('commit with only #42 blocked in Azure DevOps project', 'pre-shell.cjs', sh('git commit -m "feat: wizard #42"'));
ALLOW('commit with #42 ok (GitHub project)', 'pre-shell.cjs', sh2('git commit -m "feat: wizard #42"'));
ALLOW('commit with owner/repo#42 ok (GitHub project)', 'pre-shell.cjs', sh2('git commit -m "feat: wizard contoso/app#42"'));
BLOCK('commit with "C#" only blocked', 'pre-shell.cjs', sh2('git commit -m "feat: C#7 plug-in"'));
BLOCK('reference outside the commit segment blocked', 'pre-shell.cjs', sh('git commit -m "feat: x" && echo AB#1'));
BLOCK('git -C "dir with spaces" commit checked', 'pre-shell.cjs', sh('git -C "my repo" commit -m "feat: x"'));
ALLOW('commit -F file with reference ok', 'pre-shell.cjs', sh('git commit -F msg-ok.txt'));
BLOCK('commit -F file without reference blocked', 'pre-shell.cjs', sh('git commit -F msg-no.txt'));
BLOCK('commit with editor blocked', 'pre-shell.cjs', sh('git commit'));
ALLOW('amend --no-edit ok', 'pre-shell.cjs', sh('git commit --amend --no-edit'));
ALLOW('git log --grep commit not checked', 'pre-shell.cjs', sh('git log --grep "commit"'));
ALLOW('commit outside project ok', 'pre-shell.cjs', shx('git commit -m "chore: x"'));

// --- pre-shell: confirmation, kill switch ---------------------------------------
ASK('import to DEV asks', 'pre-shell.cjs', sh('pac solution import --environment https://contoso-dev.crm4.dynamics.com/ --path x.zip'));
ASK('gh issue create asks', 'pre-shell.cjs', sh('gh issue create --title "DECISION: x" --label decision'));
ALLOW('gh issue view allowed', 'pre-shell.cjs', sh('gh issue view 42'));
{
  const r = run('pre-shell.cjs', shx('pac admin delete --environment x'), { PPKIT_DISABLE_HOOKS: '1' });
  report('kill switch PPKIT_DISABLE_HOOKS=1', r.status === 0, r);
}

// --- pre-mcp -----------------------------------------------------------------------
BLOCK('MCP to prod URL blocked', 'pre-mcp.cjs', mcp('mcp__dataverse__read_query', { env: 'https://a-prod.crm4.dynamics.com' }));
BLOCK('MCP TEST URL blocked', 'pre-mcp.cjs', mcp('mcp__dataverse__read_query', { url: 'https://contoso-test.crm4.dynamics.com' }));
BLOCK('MCP environment name TEST blocked', 'pre-mcp.cjs', mcp('mcp__plugin_power-automate_flowagent__set_current_env', { environment: 'Contoso TEST' }));
ASK('MCP write asks', 'pre-mcp.cjs', mcp('mcp__dataverse__create_record', { table: 'account' }));
ASK('MCP work item mentioning PROD asks, not blocked', 'pre-mcp.cjs', mcp('mcp__azure-devops__wit_create_work_item',
  { title: 'DECISION: release', description: 'TEST, STAGING and PROD only through the release pipeline' }));
ASK('MCP Production order table asks, not blocked', 'pre-mcp.cjs', mcp('mcp__dataverse__create_table', { displayName: 'Production order' }));
ASK('GitHub MCP write asks', 'pre-mcp.cjs', mcp('mcp__github__create_issue', { title: 'x' }));
ASK('FlowAgent edit_flow asks', 'pre-mcp.cjs', mcp('mcp__plugin_power-automate_flowagent__edit_flow', { flowId: 'x' }));
ASK('ADO comment asks', 'pre-mcp.cjs', mcp('mcp__azure-devops__wit_add_work_item_comment', { id: 1, text: 'x' }));
ALLOW('FlowAgent get_run_history is a read', 'pre-mcp.cjs', mcp('mcp__plugin_power-automate_flowagent__get_run_history', { flowId: 'x' }));
ALLOW('ADO get work item is a read', 'pre-mcp.cjs', mcp('mcp__azure-devops__wit_get_work_item', { id: 1 }));
BLOCK('MCP other org in project blocked', 'pre-mcp.cjs', mcp('mcp__dataverse__read_query', { url: 'https://contoso-other-dev.crm4.dynamics.com' }, proj2));
BLOCK('FlowAgent set_current_env other GUID blocked', 'pre-mcp.cjs', mcp('mcp__plugin_power-automate_flowagent__set_current_env', { environmentId: OTHERID }, proj2));
ASK('FlowAgent set_current_env DEV GUID asks', 'pre-mcp.cjs', mcp('mcp__plugin_power-automate_flowagent__set_current_env', { environmentId: DEVID }, proj2));
ALLOW('FlowAgent list_flows on DEV allowed', 'pre-mcp.cjs', mcp('mcp__plugin_power-automate_flowagent__list_flows', { environmentId: DEVID }, proj2));
ALLOW('MCP GitHub URL argument not mistaken for an environment', 'pre-mcp.cjs', mcp('mcp__github__get_issue', { url: 'https://github.com/x/y/issues/1' }, proj2));

// --- pre-write: paths allowed to a subagent (agentWritePaths: the reviewer only in reviews/) ---
{
  const kw = (file, extra = {}) => ({ tool_name: 'Write', cwd: proj, agent_type: 'kuno-quality', ...extra, tool_input: { file_path: path.join(proj, ...file.split('/')), content: 'Nessun rilievo.' } });
  ALLOW('reviewer writes its findings in docs/stories/<ID>/reviews/', 'pre-write.cjs', kw('docs/stories/S12/reviews/esito.md'));
  ALLOW('reviewer writes in docs/reviews/<date>/', 'pre-write.cjs', kw('docs/reviews/2026-11-08/esito.md'));
  BLOCK('reviewer cannot write source code', 'pre-write.cjs', kw('src/app.ts'));
  BLOCK('reviewer cannot escape reviews/ with ..', 'pre-write.cjs', kw('docs/stories/S12/reviews/../../../src/app.md'));
  BLOCK('reviewer cannot write other files of the story', 'pre-write.cjs', kw('docs/stories/S12/plan.md'));
  ALLOW('other agents are not limited by the reviewer paths', 'pre-write.cjs', kw('src/app.ts', { agent_type: 'cody-codeapps' }));
  ALLOW('main session (no agent_type) not limited', 'pre-write.cjs', kw('src/app.ts', { agent_type: undefined }));
}

// --- pre-write: secrets ------------------------------------------------------------
BLOCK('connection string with secret blocked', 'pre-write.cjs', wr(S('const c = "AuthType=ClientSecret;Url=https://x;ClientId=1;Client', 'Secret=AbCdEf123456";')));
BLOCK('assigned password blocked', 'pre-write.cjs', wr(S('const pass', 'word = "Sup3rS3cret!";')));
BLOCK('private key blocked', 'pre-write.cjs', wr(S('-----BEGIN ', 'PRIVATE KEY-----\nabc')));
BLOCK('Entra client secret blocked', 'pre-write.cjs', wr(S('x = abc', '8Q~', 'abcdefghijklmnopqrstuvwxyz01234567')));
BLOCK('unquoted .env API key blocked', 'pre-write.cjs', wr(S('API_', 'KEY=sk_live_51Hx9ab12345678901234'), '.env'));
BLOCK('unquoted PAT blocked', 'pre-write.cjs', wr(S('AZURE_DEVOPS_EXT_', 'PAT=', 'a'.repeat(20), '1234567890abcdefghijklmnopqrstuv'), '.env'));
BLOCK('YAML secret blocked', 'pre-write.cjs', wr(S('client', 'Secret: Zq8xT2vB9nW4mK7pL1sD'), 'config/a.yml'));
BLOCK('SAS token blocked', 'pre-write.cjs', wr(S('https://x.blob.core.windows.net/c?sv=2022&s', 'ig=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789%2B%3D')));
BLOCK('AWS key blocked', 'pre-write.cjs', wr(S('AK', 'IAIOSFODNN7EXAMPL1')));
ALLOW('TS type "password: string" ok', 'pre-write.cjs', wr('interface U { password: string }'));
ALLOW('placeholder ${{ }} ok', 'pre-write.cjs', wr(S('pass', 'word: "${{ secrets.PWD }}"'), '.github/workflows/a.yml'));
ALLOW('process.env ok', 'pre-write.cjs', wr('const pwd = process.env.PWD_TEST;'));
ALLOW('allow-secret ok', 'pre-write.cjs', wr(S('const pass', 'word = "Sup3rS3cret!"; // pp-kit:allow-secret')));
ALLOW('setting name (identifier) ok', 'pre-write.cjs', wr(S('{ "sec', 'ret": "ClientSecretName" }'), 'config/settings.json'));
ALLOW('test fixture password ok', 'pre-write.cjs', wr(S('const pass', 'word = "test-password-123";'), 'tests/e2e/a.spec.ts'));
ALLOW('PATH is not a PAT', 'pre-write.cjs', wr('PATH=/usr/local/bin:/opt/tools/bin', '.env'));
ALLOW('token path is not a secret', 'pre-write.cjs', wr(S('tok', 'enizerPath: ./src/tokenizer.js'), 'config/a.yml'));
ALLOW('Key Vault reference ok', 'pre-write.cjs', wr(S('client', 'Secret: @Microsoft.KeyVault(SecretUri=https://kv.vault.azure.net/secrets/x)'), 'config/a.yml'));

// --- SessionStart, SubagentStop, Stop -----------------------------------------------
OUT('SessionStart outside git: asks for story ID', 'session-start.cjs', { cwd: proj }, new RegExp(E.out.noStory));
fs.mkdirSync(path.join(proj, 'docs', 'project'), { recursive: true });
fs.writeFileSync(path.join(proj, 'docs', 'project', E.projectDecisionsFile), `| #7 | 2026-11-04 | – | Use SPA | ${E.openState} | – |\n| #8 | 2026-11-04 | #3 | X | ${E.approvedState} | – |\n`);
OUT('SessionStart shows open project decisions', 'session-start.cjs', { cwd: proj }, new RegExp(E.out.projectDecisions));
spawnSync('git', ['init', '-q', '-b', 'feature/42-wizard'], { cwd: proj2 });
OUT('SessionStart GitHub story ref', 'session-start.cjs', { cwd: proj2 }, new RegExp(`${E.out.activeStory}#42`));
OUT('SubagentStop without Rules applied: block', 'subagent-stop.cjs', { cwd: proj, agent_type: 'dora-dataverse', last_assistant_message: 'Done.' }, /"decision":"block"/);
OUT('SubagentStop with only a mention: block', 'subagent-stop.cjs', { cwd: proj, agent_type: 'dora-dataverse', last_assistant_message: `${E.rulesHeading}: see above` }, /"decision":"block"/);
OUT('SubagentStop with heading: ok', 'subagent-stop.cjs', { cwd: proj, agent_type: 'pia-planner', last_assistant_message: `x\n### ${E.rulesHeading}\n- X` }, /^$/);
OUT('SubagentStop other agent: ignored', 'subagent-stop.cjs', { cwd: proj, agent_type: 'Explore', last_assistant_message: 'x' }, /^$/);
OUT('SubagentStop outside project: ignored', 'subagent-stop.cjs', { cwd: other, agent_type: 'dora-dataverse', last_assistant_message: 'x' }, /^$/);
{
  // Review on uncommitted code, then commit: still up to date. Change after: stale.
  const g = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: proj2, encoding: 'utf8' });
  fs.mkdirSync(path.join(proj2, 'src'));
  fs.writeFileSync(path.join(proj2, 'src', 'a.ts'), 'export const a = 1;\n');
  const stamp = (n) => spawnSync(process.execPath, [path.join(HOOKS, 'state.cjs'), n], { cwd: proj2, encoding: 'utf8' });
  OUT('Stop: reminder when /review and /test never ran', 'stop-reminder.cjs', { cwd: proj2 }, new RegExp(E.out.reminder));
  stamp('review'); stamp('test');
  OUT('Stop: silent after review and test', 'stop-reminder.cjs', { cwd: proj2 }, /^$/);
  g('add', '.'); g('commit', '-q', '-m', 'feat: a #42');
  OUT('Stop: still silent after committing the reviewed code', 'stop-reminder.cjs', { cwd: proj2 }, /^$/);
  fs.writeFileSync(path.join(proj2, 'src', 'a.ts'), 'export const a = 2;\n');
  OUT('Stop: reminder after a change', 'stop-reminder.cjs', { cwd: proj2 }, new RegExp(E.out.reminder));
}
OUT('Stop outside repo silent', 'stop-reminder.cjs', { cwd: other }, /^$/);

// --- post-lint: runs the project Prettier with a path containing spaces (all platforms) --
{
  const app = path.join(tmp, 'my app');
  const bin = path.join(app, 'node_modules', '.bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(app, 'package.json'), '{}');
  const marker = path.join(bin, 'called.txt');
  if (process.platform === 'win32') fs.writeFileSync(path.join(bin, 'prettier.cmd'), `@echo %* > "${marker}"\r\n`);
  else { fs.writeFileSync(path.join(bin, 'prettier'), `#!/bin/sh\necho "$@" > "${marker}"\n`); fs.chmodSync(path.join(bin, 'prettier'), 0o755); }
  const file = path.join(app, 'src file.ts');
  fs.writeFileSync(file, 'const a=1\n');
  const r = run('post-lint.cjs', { tool_name: 'Write', tool_input: { file_path: file } });
  report('post-lint runs Prettier on a path with spaces', r.status === 0 && fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').includes('src file.ts'), r);
}

// --- configuration -------------------------------------------------------------------
fs.writeFileSync(path.join(HOOKS, 'config.json'), '{ "prodPatterns": [');
BLOCK('malformed config.json fails closed', 'pre-shell.cjs', shx('git status'));
fs.writeFileSync(path.join(HOOKS, 'config.json'), '{ "prodPatterns": ["("] }');
BLOCK('invalid regex in config.json fails closed', 'pre-shell.cjs', shx('git status'));
fs.writeFileSync(path.join(HOOKS, 'config.json'), '{ "nonDevPatterns": ["\\\\bcontoso-acc\\\\b"] }');
BLOCK('team pattern from config.json applied', 'pre-shell.cjs', shx('pac solution list --environment https://contoso-acc.crm4.dynamics.com'));
fs.writeFileSync(path.join(HOOKS, 'config.json'), '{ "mcpWriteAllowServers": ["azure-devops"] }');
ALLOW('MCP write on allowed server needs no confirmation', 'pre-mcp.cjs', mcp('mcp__azure-devops__wit_add_work_item_comment', { id: 1, text: 'x' }));
ASK('MCP write on other server still asks', 'pre-mcp.cjs', mcp('mcp__dataverse__create_record', { table: 'account' }));
BLOCK('allowed server still blocked on PROD', 'pre-mcp.cjs', mcp('mcp__azure-devops__wit_create_work_item', { env: 'https://a-prod.crm4.dynamics.com' }));
fs.rmSync(path.join(HOOKS, 'config.json'));

// --- pp.cjs (one-line commands of the main session) -------------------------------------
{
  const CFG = JSON.parse(fs.readFileSync(path.join(HOOKS, 'config.default.json'), 'utf8'));
  const repo = path.join(tmp, 'pp');
  fs.mkdirSync(path.join(repo, 'docs', 'project'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs', 'stories', 'S1'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'CLAUDE.md'), `# P\n${E.marker}\n`);
  const [todo, , done] = CFG.taskStates;
  fs.writeFileSync(path.join(repo, 'docs', 'stories', 'S1', 'tasks.md'), `| # | Task | State |\n|---|---|---|\n| B5 | a | b \\| c | ${todo} |\n| B6 | x | ${todo} |\n`);
  const reg = path.join(repo, 'docs', 'project', E.projectDecisionsFile);
  fs.writeFileSync(reg, `| Task | Date | Story | Decision | State | ADR |\n|---|---|---|---|---|---|\n| AB#1608 | 2026-11-08 | 1037 | x | ${E.openState} | – |\n| AB#1609 | 2026-11-08 | 1608 | y | ${E.openState} | – |\n| AB#11 | 2026-11-08 | – | z | ${E.openState} | – |\n`);
  const g = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  g('init', '-q'); g('config', 'user.email', 't@example.com'); g('config', 'user.name', 'T'); g('config', 'commit.gpgsign', 'false');
  const pp = (...a) => spawnSync(process.execPath, [path.join(HOOKS, 'pp.cjs'), ...a], { cwd: repo, encoding: 'utf8', env: { ...process.env, ADO_TOKEN: '' } });

  let r = pp('task', 'S1', 'B5', done, '--note', 'Mon 3a1b002');
  const tasks = fs.readFileSync(path.join(repo, 'docs', 'stories', 'S1', 'tasks.md'), 'utf8');
  report('pp task sets the state of the row only', r.status === 0 && tasks.includes(`| B5 | a | b \\| c | ${done} |`) && new RegExp(`\\| B6 \\| x \\| ${todo} \\|`).test(tasks) && tasks.includes('B5: Mon 3a1b002'), r);
  r = pp('task', 'S1', 'B5', 'not-a-state');
  report('pp task rejects an unknown state', r.status === 1, r);

  r = pp('decisions', 'open');
  report('pp decisions open lists the open rows', r.status === 0 && /AB#1608/.test(r.stdout) && /AB#1609/.test(r.stdout), r);
  r = pp('decisions', 'close', '1608=A', '--by', 'PO', '--quote', 'ok, go ahead');
  report('pp decisions close refuses an answer without explicit approval', r.status === 1 && /AB#1608[^\n]*\| [^|]*\| /.test(fs.readFileSync(reg, 'utf8')) && fs.readFileSync(reg, 'utf8').includes(`| x | ${E.openState} |`), r);
  r = pp('decisions', 'close', '1608=A', '1609=B', '--by', 'PO', '--quote', 'approve 1608 A');
  report('pp decisions close refuses a decision the answer does not name', r.status === 1 && fs.readFileSync(reg, 'utf8').includes(`| y | ${E.openState} |`), r);
  r = pp('decisions', 'close', '1608-1609=A', '--reject', '1609', '--by', 'PO', '--quote', 'approve 1608 A');
  report('pp decisions close refuses an ID approved and rejected together', r.status === 1 && fs.readFileSync(reg, 'utf8').includes(`| x | ${E.openState} |`), r);
  r = pp('decisions', 'close', '1608-1609=A', '--by', 'PO', '--quote', 'approve 1608-1609 A');
  const regTxt = fs.readFileSync(reg, 'utf8');
  report('pp decisions close updates the register by ID (range)', r.status === 0 && regTxt.includes(`| x | ${E.approvedState} |`) && regTxt.includes(`| y | ${E.approvedState} |`) && regTxt.includes(`| z | ${E.openState} |`) && /approve 1608-1609 A/.test(r.stdout), r);

  fs.writeFileSync(path.join(repo, 'a.txt'), 'a');
  r = pp('commit', 'docs: a', '--files', 'a.txt');
  report('pp commit refuses without a story reference', r.status === 1, r);
  r = pp('commit', 'docs: a', '--ab', '1241', '--checks', 'none', '--files', 'a.txt');
  const log = g('log', '-1', '--format=%B').stdout;
  report('pp commit adds the reference, AI and checks lines', r.status === 0 && /^docs: a AB#1241/.test(log) && /^AI[\w-]*: Claude Code$/m.test(log) && /: none$/m.test(log), r);
  report('pp commit commits only the given files', r.status === 0 && /\?\? docs\//.test(g('status', '--porcelain').stdout), r);

  const ppCmd = `node "C:/Users/Some One/.claude/hooks/pp-kit/pp.cjs"`;
  ASK('pp ado write asks for confirmation', 'pre-shell.cjs', shx(`${ppCmd} ado comment 1234 --text "x"`));
  ASK('pp decisions close --ado asks for confirmation', 'pre-shell.cjs', shx(`${ppCmd} decisions close 1608=A --by PO --quote "approve 1608" --ado`));
  ALLOW('pp ado --dry-run does not ask', 'pre-shell.cjs', shx(`${ppCmd} ado comment 1234 --dry-run --text "x"`));
  ALLOW('pp decisions close without --ado does not ask', 'pre-shell.cjs', shx(`${ppCmd} decisions close 1608=A --by PO --quote "approve 1608"`));

  // stats on a tiny transcript
  const tr = path.join(tmp, 't.jsonl');
  const L = (o) => JSON.stringify(o);
  fs.writeFileSync(tr, [
    L({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'u1', name: 'Agent', input: { subagent_type: 'cody-codeapps', prompt: 'x' } }] } }),
    L({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'u2', name: 'mcp__azure-devops__wit_work_item_write', input: {} }] } }),
    L({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'u2', content: 'x'.repeat(4000) }] } }),
    L({ type: 'user', message: { content: '<task-notification><tool-use-id>u1</tool-use-id><usage><subagent_tokens>250000</subagent_tokens></usage></task-notification>' } }),
    L({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'u3', name: 'Bash', input: { command: 'git commit -m "x AB#1"' } }] } }),
  ].join('\n'));
  r = pp('stats', tr);
  report('pp stats counts agents with tokens, MCP response size and commits', r.status === 0 && /cody-codeapps\s+1\s+250k/.test(r.stdout) && /wit_work_item_write\s+1\s+~\s*1k/.test(r.stdout) && /\b1 commit/.test(r.stdout), r);
}

// --- doctor.cjs (workstation check, run by hand) --------------------------------------
{
  const say = (text) => ({ cmd: 'node', args: ['-e', `"console.log('${text}')"`] });
  const doctor = (conf, cwd, ...args) => {
    fs.writeFileSync(path.join(HOOKS, 'config.json'), JSON.stringify(conf));
    const r = spawnSync(process.execPath, [path.join(HOOKS, 'doctor.cjs'), ...args], { cwd, encoding: 'utf8' });
    fs.rmSync(path.join(HOOKS, 'config.json'));
    return r;
  };
  const tool = (name, required, ok = true) => ({ name, required, ...(ok ? say('1.2.3') : { cmd: 'ppkit-missing-cli-xyz' }) });
  let r = doctor({ doctorTools: [tool('present', true), tool('optional', false, false)], doctorLogins: [] }, other);
  report('doctor: optional tool missing is a warning, exit 0', r.status === 0 && /^OK\s+present: 1\.2\.3/m.test(r.stdout) && /^WARN\s+optional/m.test(r.stdout), r);
  r = doctor({ doctorTools: [tool('required', true, false)], doctorLogins: [] }, other);
  report('doctor: required tool missing fails, exit 1', r.status === 1 && /^FAIL\s+required/m.test(r.stdout), r);
  const login = (name, text) => ({ name, required: true, devCheck: true, ...say(text) });
  r = doctor({ doctorTools: [], doctorLogins: [login('dev', `https://${DEVHOST}/`)] }, proj2);
  report('doctor: login towards the project DEV accepted', r.status === 0 && /^OK\s+dev/m.test(r.stdout), r);
  r = doctor({ doctorTools: [], doctorLogins: [login('other', 'https://contoso-other.crm4.dynamics.com/')] }, proj2);
  report('doctor: login without the project DEV fails', r.status === 1 && r.stdout.includes(DEVHOST), r);
  if (process.platform === 'win32') {
    spawnSync('git', ['init', '-q'], { cwd: proj2 });
    spawnSync('git', ['config', 'core.longpaths', 'false'], { cwd: proj2 });
    r = doctor({ doctorTools: [], doctorLogins: [] }, proj2, '--fix');
    const v = spawnSync('git', ['config', '--get', 'core.longpaths'], { cwd: proj2, encoding: 'utf8' }).stdout.trim();
    report('doctor --fix sets core.longpaths on Windows', r.status === 0 && v === 'true', r);
    fs.rmSync(path.join(proj2, '.git'), { recursive: true, force: true });
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} of ${count} tests failed` : `\nAll ${count} tests passed`);
process.exit(failed ? 1 : 0);
