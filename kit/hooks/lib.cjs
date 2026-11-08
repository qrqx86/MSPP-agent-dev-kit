// Shared helpers for pp-kit hooks (Claude Code). Node >= 18, no dependencies.
// The code is identical in every edition of the kit: language and conventions live in
// config.default.json (patterns, file names) and messages.json (texts).
'use strict';
const fs = require('fs');
const path = require('path');

// Kill switch: PPKIT_DISABLE_HOOKS=1 disables every pp-kit hook.
if (process.env.PPKIT_DISABLE_HOOKS === '1') process.exit(0);

function readInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Hard block (exit 2, reason goes to Claude).
function block(message) {
  process.stderr.write(`[pp-kit] ${message}\n`);
  process.exit(2);
}

// Ask the user for confirmation instead of blocking.
function ask(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `[pp-kit] ${reason}` },
  }));
  process.exit(0);
}

function readJson(file, required) {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    // A broken config must not silently drop the team's own patterns: fail closed.
    if (required) block(`${p} is not valid JSON (${e.message}). Fix or remove it; pp-kit blocks until then.`);
    return {};
  }
}

const MESSAGES = readJson('messages.json');

// Message by key, with {placeholders}.
function msg(key, vars = {}) {
  const t = MESSAGES[key] || key;
  return t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

const toRegex = (p) => (typeof p === 'string' ? new RegExp(p, 'i') : new RegExp(p.pattern, p.flags || 'i'));

const ARRAY_KEYS = ['prodPatterns', 'nonDevPatterns', 'envNamePatterns', 'allowPatterns', 'solutionRequired', 'secretAllowFiles',
  'askPatterns', 'denyPatterns', 'teamAgents', 'mcpWriteVerbs', 'mcpReadVerbs', 'pacLocalCommands'];

let cached = null;
function loadConfig() {
  if (cached) return cached;
  const def = readJson('config.default.json', true);
  const user = readJson('config.json', true);
  const merged = { ...def, ...user };
  // Arrays are concatenated so user config extends the defaults.
  for (const k of ARRAY_KEYS) merged[k] = [...(def[k] || []), ...(user[k] || [])];
  // Validate every pattern: an invalid user regex must block, not end in a non-blocking crash.
  try {
    for (const k of ['prodPatterns', 'nonDevPatterns', 'envNamePatterns', 'allowPatterns', 'secretAllowFiles']) merged[k].forEach(toRegex);
    for (const k of ['askPatterns', 'denyPatterns', 'solutionRequired']) {
      merged[k].forEach((r) => { toRegex(r.match); if (r.require) toRegex(r.require); });
    }
    for (const list of Object.values(merged.agentWritePaths || {})) (Array.isArray(list) ? list : []).forEach(toRegex);
  } catch (e) {
    block(`Invalid pattern in the pp-kit configuration (${e.message}).`);
  }
  cached = merged;
  return merged;
}

function readClaudeMd(root) {
  try { return fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'); } catch { return ''; }
}

// A pp-kit project is any folder whose CLAUDE.md (in cwd or an ancestor) matches projectMarkerPattern.
function findProjectRoot(start) {
  const marker = toRegex(loadConfig().projectMarkerPattern || 'pp-kit:project');
  let dir = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md')) && marker.test(readClaudeMd(dir))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const GUID = /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi;
const guidsIn = (s) => [...String(s).matchAll(GUID)].map((m) => m[1].toLowerCase());

// Power Platform environment and site hosts (commercial, GCC High/DoD, China).
const PP_HOST = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:crm\d*\.(?:dynamics\.com|microsoftdynamics\.us|appsplatform\.us|dynamics\.cn)|powerappsportals\.(?:com|us)|powerpages\.microsoft\.com))(?![\w.-])/gi;
const hostsIn = (s) => [...String(s).matchAll(PP_HOST)].map((m) => m[1].toLowerCase());
const isOrgHost = (h) => /\.crm\d*\./.test(h);

// DEV environment declared in the project CLAUDE.md (line matching devLinePattern), e.g.
// "- DEV environment (the only one agents may use): URL https://contoso-dev.crm4.dynamics.com | ID <guid>"
function projectDev(root) {
  if (!root) return null;
  const re = toRegex(loadConfig().devLinePattern || 'DEV environment');
  const line = readClaudeMd(root).split(/\r?\n/).find((l) => re.test(l));
  if (!line) return null;
  const host = hostsIn(line).find(isOrgHost) || null;
  const id = guidsIn(line)[0] || null;
  if (!host && !id) return null; // still placeholders
  return { host, id };
}

// Work item tracker declared in the project CLAUDE.md ("- Work item tracker: github"); default from config.
function projectTracker(root) {
  const cfg = loadConfig();
  const re = toRegex(cfg.trackerLinePattern || 'Work item tracker');
  const line = readClaudeMd(root).split(/\r?\n/).find((l) => re.test(l)) || '';
  if (/\bgithub\b/i.test(line)) return 'github';
  if (/azure[- ]?devops/i.test(line)) return 'azure-devops';
  return cfg.defaultTracker || 'azure-devops';
}

// How a story id is written in commits and docs for the given tracker.
const storyRef = (tracker, id) => (tracker === 'github' ? `#${id}` : `AB#${id}`);

// True if a value (URL, host or GUID) designates the declared DEV environment. Exact match, no substrings.
function isDev(dev, value) {
  const v = String(value).toLowerCase().trim().replace(/^["']|["']$/g, '');
  const host = v.replace(/^[a-z]+:\/\//, '').split(/[/?#:]/)[0];
  return Boolean((dev.host && host === dev.host) || (dev.id && v === dev.id));
}

// Shell tokenizer: splits a command line into segments (on unquoted && || ; | & and newlines),
// each an array of tokens without quotes. Good enough for policy checks; not a full shell parser.
function tokenize(cmd) {
  const segments = [];
  let tokens = [];
  let cur = '';
  let has = false;
  let quote = null;
  const pushToken = () => { if (has) tokens.push(cur); cur = ''; has = false; };
  const pushSegment = () => { pushToken(); if (tokens.length) segments.push(tokens); tokens = []; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && '"\\$`'.includes(cmd[i + 1] || '')) cur += cmd[++i];
      else cur += c;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; has = true; continue; }
    if (c === '\\' && i + 1 < cmd.length && !/\s/.test(cmd[i + 1])) { cur += cmd[++i]; has = true; continue; }
    if (c === '\n' || c === ';') { pushSegment(); continue; }
    if (c === '&' || c === '|') { if (cmd[i + 1] === c) i++; pushSegment(); continue; }
    if (/\s/.test(c)) { pushToken(); continue; }
    cur += c; has = true;
  }
  pushSegment();
  return segments;
}

// Program of a segment: first token after env assignments and wrappers (npx, sudo, call, &).
function program(tokens) {
  let i = 0;
  while (i < tokens.length && (/^\w+=/.test(tokens[i]) || /^(sudo|call|npx|-y|--yes|exec|command|time)$/i.test(tokens[i]))) i++;
  const name = (tokens[i] || '').toLowerCase().split(/[\\/]/).pop().replace(/\.(exe|cmd|bat|ps1)$/, '');
  return { name, args: tokens.slice(i + 1) };
}

// Values of the flags matching flagRe: "--flag value", "--flag=value", "--flag:value".
function flagValues(args, flagRe) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const m = args[i].match(/^(-{1,2}[A-Za-z][\w-]*)(?:[=:](.*))?$/);
    if (!m || !flagRe.test(m[1])) continue;
    if (m[2] !== undefined) out.push(m[2]);
    else if (i + 1 < args.length && !/^-/.test(args[i + 1])) out.push(args[++i]);
  }
  return out;
}

module.exports = {
  readInput, loadConfig, toRegex, msg, findProjectRoot, projectDev, projectTracker, storyRef, isDev,
  hostsIn, guidsIn, isOrgHost, tokenize, program, flagValues, block, ask,
};
