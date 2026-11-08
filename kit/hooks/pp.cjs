#!/usr/bin/env node
// pp: one-line commands for the repetitive work of the main session (not a hook).
// Every command prints one line per item, never the full JSON of a work item.
//   pp commit "<title>" --ab <id>... [--checks "<text>"] [--ai "<agents>"] [--files <f>...] [--push] [--dry-run]
//   pp task <story> <task> <state> [--note "<text>"] [--dry-run]
//   pp decisions open
//   pp decisions close <id>[-<id>]=<outcome>... [--reject <id>...] --quote "<answer of the PO>" --by "<person>"
//                      [--ado] [--ado-state <state>] [--dry-run]
//   pp ado comment <id> (--file <file.md> | --text "<markdown>") [--dry-run]
//   pp ado state <id> <state> [--dry-run]
//   pp stats <transcript.jsonl>
// Names of files, states and labels come from config.default.json / config.json and messages.json.
// Azure DevOps: organization and project from the project CLAUDE.md (or --org / --project), token from
// ADO_TOKEN, SYSTEM_ACCESSTOKEN or "az account get-access-token" (kept in memory only).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const { loadConfig, toRegex, msg, findProjectRoot, projectTracker, storyRef } = require('./lib.cjs');

const cfg = loadConfig();
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const FLAGS = ['--dry-run', '--push', '--ado']; // options without a value
const root = findProjectRoot(process.cwd()) || process.cwd();
const tracker = projectTracker(findProjectRoot(process.cwd()));
const today = new Date().toISOString().slice(0, 10);

const die = (text) => { console.error(`[pp] ${text}`); process.exit(1); };
const out = (text) => console.log(text);
// Values of an option (all words up to the next --option), and positional words.
function opt(names, { many = false } = {}) {
  const i = argv.findIndex((a) => names.includes(a));
  if (i < 0) return many ? [] : null;
  const vals = [];
  for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) vals.push(argv[j]);
  return many ? vals : (vals[0] ?? '');
}
function positional() {
  const res = [];
  for (let i = 0; i < argv.length; i++) {
    if (FLAGS.includes(argv[i])) continue;
    if (argv[i].startsWith('--')) { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) i++; continue; }
    res.push(argv[i]);
  }
  return res;
}
const ids = (list) => list.flatMap((s) => String(s).split(',')).map((s) => s.replace(/^(AB)?#/i, '')).filter(Boolean);
const range = (s) => {
  const m = String(s).match(/^(\d+)-(\d+)$/);
  if (!m) return [String(s).replace(/^(AB)?#/i, '')];
  const r = [];
  for (let n = +m[1]; n <= +m[2]; n++) r.push(String(n));
  return r;
};
const git = (args, opts = {}) => spawnSync('git', args, { cwd: root, encoding: 'utf8', ...opts });

// --- Markdown -> HTML (descriptions and comments of work items are HTML) -------------------
function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  const lines = String(md).replace(/\r/g, '').split('\n');
  const html = [];
  let list = null;
  let para = [];
  const flush = () => {
    if (para.length) { html.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; }
    if (list) { html.push(`</${list}>`); list = null; }
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m;
    if (!l.trim()) { flush(); continue; }
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { flush(); html.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r, k) => !(k === 1 && /^[\s|:-]+$/.test(r)));
      html.push('<table>' + body.map((r, k) => `<tr>${cells(r).map((c) => (k === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('')}</tr>`).join('') + '</table>');
      continue;
    }
    if ((m = l.match(/^\s*([-*]|\d+\.)\s+(.*)$/))) {
      if (para.length) { html.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; }
      const type = /\d/.test(m[1]) ? 'ol' : 'ul';
      if (list !== type) { if (list) html.push(`</${list}>`); html.push(`<${type}>`); list = type; }
      html.push(`<li>${inline(m[2])}</li>`);
      continue;
    }
    if (list) { html.push(`</${list}>`); list = null; }
    para.push(l);
  }
  flush();
  return html.join('');
}

// --- Azure DevOps REST (compact: one line per write) ---------------------------------------
function adoTarget() {
  const md = (() => { try { return fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'); } catch { return ''; } })();
  const find = (re) => { if (!re) return null; const m = md.match(toRegex(re)); return m ? m[1].trim() : null; };
  const org = opt(['--org']) || process.env.ADO_ORG || find(cfg.adoOrgPattern);
  const project = opt(['--project']) || process.env.ADO_PROJECT || find(cfg.adoProjectPattern);
  if (!org || !project || /[<>]/.test(org + project)) die(msg('ppNoAdo'));
  return { org: org.replace(/^https:\/\/dev\.azure\.com\//, '').replace(/\/$/, ''), project };
}
let token = null;
function adoToken() {
  if (token) return token;
  token = process.env.ADO_TOKEN || process.env.SYSTEM_ACCESSTOKEN;
  if (!token) {
    try {
      token = execFileSync('az', ['account', 'get-access-token', '--resource', '499b84ac-1321-427f-aa17-267ca6975798', '--query', 'accessToken', '-o', 'tsv'],
        { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 }).trim();
    } catch { die(msg('ppNoToken')); }
  }
  return token;
}
async function ado(method, url, body, type = 'application/json') {
  const { org, project } = adoTarget();
  const full = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/${url}`;
  const r = await fetch(full, { method, headers: { Authorization: `Bearer ${adoToken()}`, 'Content-Type': type }, body: JSON.stringify(body) });
  if (!r.ok) die(`${method} ${url}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function adoComment(id, markdown) {
  if (DRY) return out(msg('ppDry', { what: `comment #${id}: ${markdown.split('\n')[0].slice(0, 80)}` }));
  if (tracker === 'github') return gh(['issue', 'comment', id, '--body', markdown], `comment #${id}`);
  const r = await ado('POST', `wit/workItems/${id}/comments?format=html&api-version=7.1-preview.4`, { text: mdToHtml(markdown) });
  out(msg('ppAdoComment', { id, comment: r.id }));
}
async function adoState(id, state) {
  if (DRY) return out(msg('ppDry', { what: `#${id} -> ${state}` }));
  if (tracker === 'github') return gh(['issue', /^(closed|done|approved|rejected|approvato|respinto)$/i.test(state) ? 'close' : 'reopen', id], `#${id} ${state}`);
  const r = await ado('PATCH', `wit/workitems/${id}?api-version=7.1`, [{ op: 'add', path: '/fields/System.State', value: state }], 'application/json-patch+json');
  out(msg('ppAdoState', { id, state: r.fields && r.fields['System.State'] }));
}
function gh(args, what) {
  const r = spawnSync('gh', args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) die(`gh ${what}: ${(r.stderr || '').trim().slice(0, 200)}`);
  out(`OK ${what}`);
}

// --- Markdown tables of the registers -----------------------------------------------------------
// Cells of a table row; an escaped pipe (\|) inside a cell is kept.
const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
const rowOf = (cells) => `| ${cells.join(' | ')} |`;
function writeLines(file, lines, eol) { if (!DRY) fs.writeFileSync(file, lines.join(eol)); }
function readLines(file) {
  const txt = fs.readFileSync(file, 'utf8');
  return { lines: txt.split(/\r?\n/), eol: txt.includes('\r\n') ? '\r\n' : '\n' };
}

// --- commands ---------------------------------------------------------------------------------------
async function cmdCommit() {
  const [, title] = positional();
  if (!title) die(msg('ppUsageCommit'));
  const refs = ids(opt(['--ab', '--ref'], { many: true }));
  const refRe = toRegex((cfg.storyRefPatterns || {})[tracker] || 'AB#\\d+');
  if (!refs.length && !refRe.test(title)) die(msg('ppNoRef', { example: storyRef(tracker, 1234) }));
  const missing = refs.filter((id) => !title.includes(storyRef(tracker, id)));
  const subject = missing.length ? `${title} ${missing.map((id) => storyRef(tracker, id)).join(' ')}` : title;
  const parts = [subject];
  const detail = opt(['--detail', '--dettaglio']);
  if (detail) parts.push(detail);
  parts.push(`${msg('ppAiLabel')}: ${opt(['--ai']) || 'Claude Code'}`);
  const checks = opt(['--checks', '--verifiche']);
  if (!checks) die(msg('ppNoChecks'));
  parts.push(`${msg('ppChecksLabel')}: ${checks}`);
  for (const t of opt(['--trailer'], { many: true })) parts.push(t);
  const files = opt(['--files'], { many: true });
  if (DRY) { out(msg('ppDry', { what: `commit "${subject}"${files.length ? ` (${files.length} file)` : ''}` })); return; }
  if (files.length) { const a = git(['add', '--', ...files]); if (a.status) die(a.stderr.trim()); }
  const c = git(['commit', '-q', ...parts.flatMap((p) => ['-m', p]), ...(files.length ? ['--', ...files] : [])]);
  if (c.status) die((c.stderr || c.stdout).trim().split('\n').slice(-3).join(' '));
  const hash = git(['rev-parse', '--short', 'HEAD']).stdout.trim();
  out(msg('ppCommitted', { hash, subject }));
  if (argv.includes('--push')) {
    const p = git(['pull', '--rebase', '-q']);
    if (p.status) die(msg('ppPullFailed', { err: p.stderr.trim().split('\n').pop() }));
    const s = git(['push', '-q']);
    if (s.status) die(s.stderr.trim().split('\n').pop());
    out(msg('ppPushed', { hash: git(['rev-parse', '--short', 'HEAD']).stdout.trim() }));
  }
}

function cmdTask() {
  const [, story, task, ...stateWords] = positional();
  const state = stateWords.join(' ');
  const states = cfg.taskStates || [];
  if (!story || !task || !state) die(msg('ppUsageTask', { states: states.join(', ') }));
  if (states.length && !states.includes(state)) die(msg('ppBadState', { state, states: states.join(', ') }));
  const file = path.join(root, 'docs', 'stories', story, 'tasks.md');
  if (!fs.existsSync(file)) die(msg('ppNoFile', { file }));
  const { lines, eol } = readLines(file);
  const stateRe = new RegExp(`^(${states.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'i');
  const i = lines.findIndex((l) => /^\s*\|/.test(l) && cellsOf(l)[0] === task);
  if (i < 0) die(msg('ppNoRow', { what: task, file }));
  const cells = cellsOf(lines[i]);
  let k = cells.length - 1;
  while (k > 0 && !stateRe.test(cells[k])) k--;
  if (k === 0) k = cells.length - 1; // no known state: the last column is the state
  const before = cells[k];
  cells[k] = state;
  lines[i] = rowOf(cells);
  const note = opt(['--note', '--nota']);
  if (note) {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push('', `- ${today} ${task}: ${note}`, '');
  }
  writeLines(file, lines, eol);
  out(`${DRY ? '[dry-run] ' : ''}${story} ${task}: ${before} -> ${state}${note ? ' (+nota)' : ''}`);
}

function registerFiles() {
  const files = [path.join(root, 'docs', 'project', cfg.projectDecisionsFile || 'decisions.md')];
  const stories = path.join(root, 'docs', 'stories');
  if (fs.existsSync(stories)) {
    for (const d of fs.readdirSync(stories)) {
      const f = path.join(stories, d, cfg.storyDecisionsFile || 'decisions.md');
      if (fs.existsSync(f)) files.push(f);
    }
  }
  return files.filter((f) => fs.existsSync(f));
}

function cmdDecisionsOpen() {
  const file = path.join(root, 'docs', 'project', cfg.projectDecisionsFile || 'decisions.md');
  if (!fs.existsSync(file)) die(msg('ppNoFile', { file }));
  const open = toRegex(`^(${cfg.openStatePattern || 'Open'})$`);
  const rows = readLines(file).lines.filter((l) => /^\s*\|/.test(l));
  const header = rows[0];
  const hits = rows.slice(2).filter((l) => cellsOf(l).some((c) => open.test(c)));
  if (!hits.length) return out(msg('ppNoOpen'));
  out(header);
  out(rows[1]);
  hits.forEach((l) => out(l));
  out(msg('ppOpenHint', { n: hits.length }));
}

async function cmdDecisionsClose() {
  const quote = opt(['--quote', '--citazione']);
  const by = opt(['--by', '--da']);
  if (!quote || !by) die(msg('ppNeedQuote'));
  const approved = cfg.decisionStates && cfg.decisionStates.approved || 'Approved';
  const rejected = cfg.decisionStates && cfg.decisionStates.rejected || 'Rejected';
  const items = [];
  for (const p of positional().slice(2)) {
    const m = p.match(/^([^=]+)=(.*)$/s);
    if (!m) die(msg('ppUsageClose'));
    for (const id of range(m[1])) items.push({ id, outcome: m[2], state: approved });
  }
  for (const id of ids(opt(['--reject', '--respingi'], { many: true })).flatMap(range)) items.push({ id, outcome: rejected, state: rejected });
  if (!items.length) die(msg('ppUsageClose'));
  const twice = items.map((x) => x.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (twice.length) die(msg('ppTwice', { ids: [...new Set(twice)].join(', ') }));
  // Safety (explicit approvals only): the answer approves explicitly and names each decision it approves,
  // by ID or by its option, or approves all of them in so many words.
  const approveWord = toRegex(cfg.approvalPattern || '\\bapprov');
  const allWord = toRegex(cfg.approvalAllPattern || '\\b(all|every)\\b');
  for (const it of items.filter((x) => x.state === approved)) {
    const option = it.outcome.trim().split(/[\s:–-]+/)[0];
    const named = quote.includes(it.id) || (option && new RegExp(`(^|[^\\w])${option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`).test(quote)) || allWord.test(quote);
    if (!approveWord.test(quote) || !named) die(msg('ppQuoteNoApproval', { id: it.id }));
  }
  const open = toRegex(`^(${cfg.openStatePattern || 'Open'})$`);
  const files = registerFiles();
  for (const it of items) {
    let found = 0;
    for (const f of files) {
      const { lines, eol } = readLines(f);
      let changed = false;
      let header = [];
      for (let i = 0; i < lines.length; i++) {
        if (!/^\s*\|/.test(lines[i])) { header = []; continue; }
        const cells = cellsOf(lines[i]);
        if (!header.length) { header = cells; continue; }
        if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
        // The ID is in the first column (Task / work item); other columns hold dates and story numbers.
        if (!new RegExp(`(^|[^\\d])${it.id}([^\\d]|$)`).test(cells[0]) || !cells.some((c) => open.test(c))) continue;
        const k = cells.findIndex((c) => open.test(c));
        cells[k] = it.state;
        const o = header.findIndex((h) => toRegex(cfg.decisionOutcomeHeaderPattern || '^Outcome').test(h));
        if (o > 0 && o < cells.length) cells[o] = `${it.outcome}, ${by}, ${today}`;
        lines[i] = rowOf(cells);
        changed = true;
        found++;
      }
      if (changed) writeLines(f, lines, eol);
    }
    const comment = msg('ppOutcome', { outcome: it.outcome, by, date: today, quote });
    out(`${DRY ? '[dry-run] ' : ''}#${it.id}: ${it.state} – ${it.outcome} (${found ? msg('ppRegisterRows', { n: found }) : msg('ppNotInRegister')})`);
    if (argv.includes('--ado')) {
      await adoComment(it.id, comment);
      const s = opt(['--ado-state']);
      if (s) await adoState(it.id, s);
    } else {
      out(`   ${comment}`);
    }
  }
}

async function cmdAdo() {
  const [, sub, id, ...rest] = positional();
  if (!/^\d+$/.test(id || '')) die(msg('ppUsageAdo'));
  if (sub === 'comment') {
    const file = opt(['--file']);
    const text = file ? fs.readFileSync(path.resolve(process.cwd(), file), 'utf8') : opt(['--text']);
    if (!text) die(msg('ppUsageAdo'));
    return adoComment(id, text);
  }
  if (sub === 'state' && rest.length) return adoState(id, rest.join(' '));
  die(msg('ppUsageAdo'));
}

// --- stats of a session transcript -------------------------------------------------------------------
function cmdStats() {
  const [, file] = positional();
  if (!file || !fs.existsSync(file)) die(msg('ppUsageStats'));
  const byId = new Map();            // tool_use id -> { name, agent }
  const tools = {};                  // tool name -> { n, chars }
  const agents = {};                 // subagent type -> { n, tokens }
  const bash = {};                   // first words of shell commands -> n
  let commits = 0;
  let hookBlocks = 0;
  let inlineScripts = 0;
  const add = (o, k, f) => { o[k] = o[k] || { n: 0, chars: 0, tokens: 0 }; f(o[k]); };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.isSidechain) continue;
    const content = o.message && Array.isArray(o.message.content) ? o.message.content : [];
    for (const b of content) {
      if (b.type === 'tool_use') {
        const agent = (b.name === 'Agent' || b.name === 'Task') ? String((b.input && b.input.subagent_type) || 'general-purpose') : null;
        byId.set(b.id, { name: b.name, agent });
        add(tools, b.name, (t) => t.n++);
        if (agent) add(agents, agent, (a) => a.n++);
        const cmd = b.input && typeof b.input.command === 'string' ? b.input.command : '';
        if (cmd) {
          const key = cmd.trim().replace(/^cd\s+("[^"]*"|\S+)\s*(&&|;)\s*/, '').split(/\s+/).slice(0, 2).join(' ');
          bash[key] = (bash[key] || 0) + 1;
          if (/\bgit\b[^|;&]*\bcommit\b/.test(cmd)) commits++;
          if (/\b(python3?|py)\s+(-\s*<<|-c\b)|\bnode\s+-e\b|<<\s*'?EOF/.test(cmd)) inlineScripts++;
        }
      } else if (b.type === 'tool_result') {
        const t = byId.get(b.tool_use_id);
        const text = typeof b.content === 'string' ? b.content : JSON.stringify(b.content || '');
        if (t) add(tools, t.name, (x) => { x.chars += text.length; });
        if (b.is_error && /\[pp-kit\]/.test(text)) hookBlocks++;
      } else if (b.type === 'text' && typeof b.text === 'string') {
        // Background agents report their tokens in the completion notification.
        for (const m of b.text.matchAll(/<tool-use-id>([^<]+)<\/tool-use-id>[\s\S]*?<subagent_tokens>(\d+)<\/subagent_tokens>/g)) {
          const t = byId.get(m[1]);
          if (t && t.agent) agents[t.agent].tokens += Number(m[2]);
        }
      }
    }
    if (typeof (o.message && o.message.content) === 'string') {
      for (const m of o.message.content.matchAll(/<tool-use-id>([^<]+)<\/tool-use-id>[\s\S]*?<subagent_tokens>(\d+)<\/subagent_tokens>/g)) {
        const t = byId.get(m[1]);
        if (t && t.agent) agents[t.agent].tokens += Number(m[2]);
      }
    }
  }
  const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
  const sum = (o, f) => Object.values(o).reduce((s, x) => s + f(x), 0);
  out(msg('ppStatsAgents', { n: sum(agents, (a) => a.n), tokens: k(sum(agents, (a) => a.tokens)) }));
  Object.entries(agents).sort((a, b) => b[1].tokens - a[1].tokens || b[1].n - a[1].n)
    .forEach(([name, a]) => out(`  ${name.padEnd(28)} ${String(a.n).padStart(4)}  ${k(a.tokens).padStart(6)}`));
  const mcp = Object.entries(tools).filter(([n]) => n.startsWith('mcp__'));
  out(msg('ppStatsMcp', { n: mcp.reduce((s, [, t]) => s + t.n, 0), tokens: k(Math.round(mcp.reduce((s, [, t]) => s + t.chars, 0) / 4)) }));
  mcp.sort((a, b) => b[1].chars - a[1].chars).slice(0, 8)
    .forEach(([name, t]) => out(`  ${name.replace(/^mcp__/, '').padEnd(44)} ${String(t.n).padStart(4)}  ~${k(Math.round(t.chars / 4)).padStart(5)}`));
  out(msg('ppStatsShell', { commits, scripts: inlineScripts, blocks: hookBlocks }));
  Object.entries(bash).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([c, n]) => out(`  ${c.slice(0, 44).padEnd(44)} ${String(n).padStart(4)}`));
}

// --- main -------------------------------------------------------------------------------------------
(async () => {
  const [cmd, sub] = positional();
  if (cmd === 'commit') return cmdCommit();
  if (cmd === 'task') return cmdTask();
  if (cmd === 'decisions' && sub === 'open') return cmdDecisionsOpen();
  if (cmd === 'decisions' && sub === 'close') return cmdDecisionsClose();
  if (cmd === 'ado') return cmdAdo();
  if (cmd === 'stats') return cmdStats();
  out(msg('ppUsage'));
  process.exit(cmd ? 1 : 0);
})().catch((e) => die(e.message));
