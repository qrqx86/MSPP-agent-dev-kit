// Tests for the tools of the front-end template (kit/templates/frontend/tools): node tests/templates.test.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TOOLS = path.join(__dirname, '..', 'kit', 'templates', 'frontend', 'tools');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ppkit-tpl-'));
let failed = 0;
let count = 0;
const check = (label, ok, extra = '') => { count++; if (!ok) failed++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` ${extra}`}`); };
const node = (tool, args, cwd = tmp) => spawnSync(process.execPath, [path.join(TOOLS, tool), ...args], { cwd, encoding: 'utf8' });
const git = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
const w = (p, o) => fs.writeFileSync(p, typeof o === 'string' ? o : JSON.stringify(o, null, 2) + '\n');

// --- merge-locales -------------------------------------------------------------------------
{
  const [b, o, t] = ['base', 'ours', 'theirs'].map((n) => path.join(tmp, `${n}.json`));
  w(b, { app: { title: 'A', save: 'Salva' }, old: 'x' });
  w(o, { app: { title: 'A main', save: 'Salva', refresh: 'Aggiorna' }, old: 'x' });
  w(t, { app: { title: 'A branch', save: 'Salva', filter: 'Filtro' } });
  let r = node('merge-locales.cjs', [b, o, t]);
  const m = JSON.parse(fs.readFileSync(o, 'utf8'));
  check('merge-locales: keys added on both sides are kept', r.status === 0 && m.app.refresh === 'Aggiorna' && m.app.filter === 'Filtro', JSON.stringify(m));
  check('merge-locales: same key changed on both sides, ours wins', m.app.title === 'A main');
  check('merge-locales: key deleted by theirs and unchanged by ours is deleted', !('old' in m));
  check('merge-locales: no conflict markers', !fs.readFileSync(o, 'utf8').includes('<<<<<<<'));
  w(t, '{ broken');
  r = node('merge-locales.cjs', [b, o, t]);
  check('merge-locales: invalid JSON falls back to a git conflict (exit 1)', r.status === 1);

  // as a real git merge driver
  const repo = path.join(tmp, 'loc');
  fs.mkdirSync(path.join(repo, 'locales', 'it'), { recursive: true });
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 't@example.com'); git(repo, 'config', 'user.name', 'T'); git(repo, 'config', 'commit.gpgsign', 'false');
  git(repo, 'config', 'merge.locales.driver', `node "${path.join(TOOLS, 'merge-locales.cjs').replace(/\\/g, '/')}" %O %A %B`);
  w(path.join(repo, '.gitattributes'), '**/locales/**/*.json merge=locales\n');
  const f = path.join(repo, 'locales', 'it', 'common.json');
  w(f, { a: '1' });
  git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'base');
  git(repo, 'checkout', '-qb', 'feature');
  w(f, { a: '1', b: '2' }); git(repo, 'commit', '-qam', 'b');
  git(repo, 'checkout', '-q', 'main');
  w(f, { a: '1', c: '3' }); git(repo, 'commit', '-qam', 'c');
  r = git(repo, 'merge', '-q', '--no-edit', 'feature');
  const merged = JSON.parse(fs.readFileSync(f, 'utf8'));
  check('merge-locales as git merge driver: no conflict, both keys', r.status === 0 && merged.b === '2' && merged.c === '3', r.stdout + r.stderr);
}

// --- worktree ---------------------------------------------------------------------------------
{
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(path.join(repo, 'app', 'node_modules', 'pkg'), { recursive: true });
  w(path.join(repo, 'app', 'node_modules', 'pkg', 'index.js'), 'module.exports = 1;\n');
  w(path.join(repo, 'app', 'package-lock.json'), '{"lockfileVersion":3}\n');
  w(path.join(repo, '.gitignore'), 'node_modules/\n');
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 't@example.com'); git(repo, 'config', 'user.name', 'T'); git(repo, 'config', 'commit.gpgsign', 'false');
  git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'init');
  const wt = path.join(tmp, 'wt-s1');
  let r = node('worktree.cjs', ['new', wt, 'sprint-1', '--app', 'app'], repo);
  check('worktree new: node_modules linked to the shared installation', r.status === 0 && fs.existsSync(path.join(wt, 'app', 'node_modules', 'pkg', 'index.js')) && fs.lstatSync(path.join(wt, 'app', 'node_modules')).isSymbolicLink(), r.stdout + r.stderr);
  w(path.join(wt, 'app', 'dirty.txt'), 'x');
  r = node('worktree.cjs', ['remove', wt, '--app', 'app'], repo);
  check('worktree remove: refuses with uncommitted changes (no --force)', r.status === 1 && fs.existsSync(wt));
  check('worktree remove: the shared node_modules survives', fs.existsSync(path.join(repo, 'app', 'node_modules', 'pkg', 'index.js')));
  fs.rmSync(path.join(wt, 'app', 'dirty.txt'));
  r = node('worktree.cjs', ['remove', wt, '--app', 'app'], repo);
  check('worktree remove: removes the worktree, keeps the shared node_modules', r.status === 0 && !fs.existsSync(wt) && fs.existsSync(path.join(repo, 'app', 'node_modules', 'pkg', 'index.js')), r.stdout + r.stderr);
}

// --- verify -------------------------------------------------------------------------------------
{
  const app = path.join(tmp, 'app');
  fs.mkdirSync(app);
  const ok = 'node -e "process.exit(0)"';
  w(path.join(app, 'package.json'), { scripts: { build: ok, lint: ok, test: 'node -e "console.log(\'FAIL src/a.test.ts > saves\');process.exit(1)"', budget: ok } });
  let r = node('verify.cjs', [], app);
  check('verify: stops at the first failing script with a short result', r.status === 1 && /^FAIL test/m.test(r.stdout) && /passed: build \d+s, lint \d+s/.test(r.stdout) && /FAIL src\/a\.test\.ts/.test(r.stdout) && !/budget/.test(r.stdout) && r.stdout.trim().split('\n').length <= 7, r.stdout);
  check('verify: full log saved', fs.existsSync(path.join(app, '.verify', 'test.log')));
  r = node('verify.cjs', ['--only', 'build,lint'], app);
  check('verify --only: one OK line', r.status === 0 && /^OK @.*build \d+s, lint \d+s$/m.test(r.stdout) && r.stdout.trim().split('\n').length === 1, r.stdout);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} of ${count} template tests failed` : `\nAll ${count} template tests passed`);
process.exit(failed ? 1 : 0);
