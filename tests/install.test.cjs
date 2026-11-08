// Tests for install.cjs in a temporary Claude folder: node tests/install.test.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ppkit-home-'));
const INSTALL = path.join(__dirname, '..', 'install.cjs');
const ED = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kit', 'install.json'), 'utf8'));
const run = (...args) => spawnSync(process.execPath, [INSTALL, ...args], { encoding: 'utf8', env: { ...process.env, PPKIT_HOME: home, [ED.rulesEnv]: path.join(home, 'no-rules') } }); // never link a real rulebook
const p = (...s) => path.join(home, ...s);
const settings = () => JSON.parse(fs.readFileSync(p('settings.json'), 'utf8'));
const ppkitHooks = () => Object.values(settings().hooks || {}).filter(Array.isArray).flat()
  .flatMap((g) => g.hooks || []).filter((h) => String(h.command).includes('hooks/pp-kit/'));

let failed = 0;
const check = (label, ok, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` ${extra}`}`); };

// The user already has their own hook, their own "review" skill and an invalid hooks array.
fs.mkdirSync(p('skills', 'review'), { recursive: true });
fs.writeFileSync(p('skills', 'review', 'SKILL.md'), 'my own review skill');
fs.writeFileSync(p('settings.json'), JSON.stringify({
  model: 'x',
  hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }], Weird: 'not-an-array' },
}));

let r = run('--dry-run');
check('dry run succeeds', r.status === 0, r.stderr);
check('dry run writes nothing', !fs.existsSync(p('agents')) && ppkitHooks().length === 0);

r = run();
check('install succeeds', r.status === 0, r.stderr);
check('agents installed', fs.existsSync(p('agents', 'pia-planner.md')));
check('user skill with the same name not overwritten', fs.readFileSync(p('skills', 'review', 'SKILL.md'), 'utf8') === 'my own review skill');
check('installer reports the skipped skill', /SKIP|SALTO/.test(r.stdout));
check('pp-kit hooks registered', ppkitHooks().length === 7, JSON.stringify(settings().hooks));
check('user hook and settings kept', settings().model === 'x' && JSON.stringify(settings().hooks).includes('echo mine'));
check('non-array hook entry left alone', settings().hooks.Weird === 'not-an-array');
check('backup of settings.json written', fs.readdirSync(home).some((f) => f.startsWith('settings.json.bak-ppkit-')));
check('manifest written', fs.existsSync(p('pp-kit', 'manifest.json')));
check(`decision template at pp-kit/${ED.decisionTemplate}`, fs.existsSync(p('pp-kit', ED.decisionTemplate)));

r = run();
check('re-install is idempotent', r.status === 0 && ppkitHooks().length === 7);
check('manifest records file hashes', Object.keys(JSON.parse(fs.readFileSync(p('pp-kit', 'manifest.json'), 'utf8')).files || {}).includes('hooks/pp-kit/pre-shell.cjs'));

// A file of the kit patched by hand in ~/.claude: backed up and reported, then replaced.
const hook = p('hooks', 'pp-kit', 'pre-shell.cjs');
const original = fs.readFileSync(hook, 'utf8');
fs.writeFileSync(hook, `${original}
// local patch
`);
r = run();
const backups = fs.readdirSync(p('hooks', 'pp-kit')).filter((f) => f.startsWith('pre-shell.cjs.bak-ppkit-'));
check('hand-modified file reported', r.stdout.includes(ED.texts.modified), r.stdout);
check('hand-modified file backed up', backups.length === 1 && fs.readFileSync(p('hooks', 'pp-kit', backups[0]), 'utf8').includes('local patch'));
check('hand-modified file replaced by the kit version', fs.readFileSync(hook, 'utf8') === original);
r = run();
check('unchanged file not reported again', !r.stdout.includes(ED.texts.modified));

fs.writeFileSync(p('hooks', 'pp-kit', 'config.json'), '{ "allowPatterns": [] }');
r = run('--uninstall');
check('uninstall succeeds', r.status === 0, r.stderr);
check('agents removed', !fs.existsSync(p('agents', 'pia-planner.md')));
check('user skill kept on uninstall', fs.existsSync(p('skills', 'review', 'SKILL.md')));
check('team config.json kept on uninstall', fs.existsSync(p('hooks', 'pp-kit', 'config.json')));
check('pp-kit hooks unregistered, user hook kept', ppkitHooks().length === 0 && JSON.stringify(settings().hooks).includes('echo mine'));

fs.writeFileSync(p('settings.json'), '{ broken');
r = run();
check('invalid settings.json: install aborts without changes', r.status === 1 && fs.readFileSync(p('settings.json'), 'utf8') === '{ broken');

fs.rmSync(home, { recursive: true, force: true });
console.log(failed ? `\n${failed} install tests failed` : '\nAll install tests passed');
process.exit(failed ? 1 : 0);
