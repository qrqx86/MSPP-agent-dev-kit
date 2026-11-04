// Shared helpers for pp-kit hooks (Claude Code). Node >= 18, no dependencies.
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

function loadConfig() {
  const read = (f) => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')); } catch { return {}; }
  };
  const def = read('config.default.json');
  const user = read('config.json');
  const merged = { ...def, ...user };
  // Arrays are concatenated so user config extends the defaults.
  for (const k of ['prodPatterns', 'nonDevPatterns', 'allowPatterns', 'solutionRequired', 'secretAllowFiles', 'askPatterns', 'denyPatterns', 'teamAgents']) {
    merged[k] = [...(def[k] || []), ...(user[k] || [])];
  }
  return merged;
}

const toRegex = (p) => (typeof p === 'string' ? new RegExp(p, 'i') : new RegExp(p.pattern, p.flags || 'i'));

// A "pp-kit project" is any folder whose CLAUDE.md (in cwd or an ancestor) contains the marker <!-- pp-kit:project -->.
const MARKER = /pp-kit:project/i;

function readClaudeMd(root) {
  try { return fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'); } catch { return ''; }
}

function findProjectRoot(start) {
  let dir = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md')) && MARKER.test(readClaudeMd(dir))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// DEV environment declared in the project CLAUDE.md (agents operate only on DEV), e.g.
// "- DEV environment (the only one agents may use): URL https://contoso-dev.crm4.dynamics.com | ID <guid>"
function projectDev(root) {
  if (!root) return null;
  const line = readClaudeMd(root).split(/\r?\n/).find((l) => /DEV environment/i.test(l));
  if (!line) return null;
  const url = (line.match(/https:\/\/([a-z0-9-]+\.crm\d*\.dynamics\.com)/i) || [])[1];
  const id = (line.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i) || [])[1];
  if (!url && !id) return null; // still placeholders
  return { host: url ? url.toLowerCase() : null, id: id ? id.toLowerCase() : null };
}

// Work item tracker declared in the project CLAUDE.md: "- Work item tracker: github" (default: azure-devops).
function projectTracker(root) {
  const line = readClaudeMd(root).split(/\r?\n/).find((l) => /Work item tracker/i.test(l)) || '';
  return /\bgithub\b/i.test(line) ? 'github' : 'azure-devops';
}

// How a story id is written in commits and docs for the given tracker.
const storyRef = (tracker, id) => (tracker === 'github' ? `#${id}` : `AB#${id}`);

// True if a value (URL, host or id) designates the declared DEV environment.
function isDev(dev, value) {
  const v = String(value).toLowerCase().replace(/^["']|["']$/g, '');
  return (dev.host && v.includes(dev.host)) || (dev.id && v === dev.id);
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

module.exports = { readInput, loadConfig, toRegex, findProjectRoot, projectDev, projectTracker, storyRef, isDev, block, ask };
