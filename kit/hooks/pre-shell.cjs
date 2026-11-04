#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): PROD block, destructive-command deny, solution obligation,
// story reference on git commit, confirmation for release operations.
'use strict';
const { execFileSync } = require('child_process');
const { readInput, loadConfig, toRegex, findProjectRoot, projectDev, isDev, block, ask } = require('./lib.cjs');

const input = readInput();
const cmd = String((input.tool_input && input.tool_input.command) || '');
if (!cmd) process.exit(0);

const cfg = loadConfig();
const prod = cfg.prodPatterns.map(toRegex);
const allow = cfg.allowPatterns.map(toRegex);
const isAllowed = (s) => allow.some((r) => r.test(s));
const hitsProd = (s) => prod.some((r) => r.test(s));
const project = findProjectRoot(input.cwd);

// 1) Destructive commands: always denied ------------------------------------
for (const rule of cfg.denyPatterns) {
  if (toRegex(rule.match).test(cmd)) block(`Command denied (${rule.reason}). A person must run it, outside Claude Code.`);
}

// 2) Only DEV ---------------------------------------------------------------
// Everywhere: block PROD and TEST/STAGING environments recognised by name.
// In a project that declares its DEV environment in CLAUDE.md: allow-list, only that environment.
const nonDev = cfg.nonDevPatterns.map(toRegex);
const hitsBlocked = (s) => hitsProd(s) || nonDev.some((r) => r.test(s));
const dev = projectDev(project);
const MSG = 'Agents operate only on the DEV environment; TEST, STAGING and PROD are reached only through the release pipeline. ' +
  'False positive? Add allowPatterns to ~/.claude/hooks/pp-kit/config.json.';

if (new RegExp(cfg.remoteToolPattern, 'i').test(cmd) && !isAllowed(cmd)) {
  if (hitsBlocked(cmd)) block(`Command blocked: it references a TEST/STAGING/PROD environment. ${MSG}`);

  if (dev) {
    for (const m of cmd.matchAll(/(?:--environment|\s-env|--url)(?:\s+|=|:)["']?([^\s"']+)/gi)) {
      if (!isDev(dev, m[1])) block(`Command blocked: environment "${m[1]}" is not the project DEV environment (${dev.host || dev.id}). ${MSG}`);
    }
    if (dev.host) {
      for (const m of cmd.matchAll(/([a-z0-9-]+\.crm\d*\.dynamics\.com)/gi)) {
        if (m[1].toLowerCase() !== dev.host) block(`Command blocked: "${m[1]}" is not the project DEV environment (${dev.host}). ${MSG}`);
      }
    }
  }

  // pac without explicit --environment runs against the active auth profile.
  const isPac = /\bpac\s+(?!auth\b|help\b|--version\b|install\b|use\b)\w+/i.test(cmd);
  const hasEnv = /(--environment|\s-env)\b/i.test(cmd);
  if (cfg.checkActivePacProfile && isPac && !hasEnv) {
    let active = null;
    try {
      const out = execFileSync('pac', ['auth', 'list'], { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'], shell: process.platform === 'win32' });
      active = out.split(/\r?\n/).find((l) => /^\[\d+\]\s+\*/.test(l)) || null;
    } catch { /* pac missing or slow */ }
    if (active && !isAllowed(active)) {
      const desc = active.replace(/\s+/g, ' ').trim();
      if (hitsBlocked(active)) block(`Command blocked: the active pac profile points to TEST/STAGING/PROD (${desc}). Select the DEV profile with "pac auth select". ${MSG}`);
      if (dev && dev.host && !active.toLowerCase().includes(dev.host)) {
        block(`Command blocked: the active pac profile (${desc}) is not the project DEV environment (${dev.host}). Select the DEV profile or pass --environment.`);
      }
    }
  }
}

if (project) {
  // 3) Solution obligation -------------------------------------------------
  for (const rule of cfg.solutionRequired) {
    if (toRegex(rule.match).test(cmd) && !toRegex(rule.require).test(cmd)) {
      block(`Command blocked: no solution specified. Add ${rule.hint}. No component may live outside the project solution.`);
    }
  }

  // 4) Story reference on git commit ---------------------------------------
  if (cfg.requireStoryRef && /\bgit\b(\s+-\S+(\s+\S+)?)*\s+commit\b/i.test(cmd)) {
    const reusesMessage = /--amend\b.*--no-edit\b|--no-edit\b.*--amend\b|\s(-C|--reuse-message)\b/.test(cmd);
    if (!reusesMessage && !new RegExp(cfg.storyRefPattern).test(cmd)) {
      block('Commit blocked: no work item reference (e.g. "feat: ... AB#1234" for Azure Boards or "feat: ... #1234" for GitHub). Always work on a story with an ID.');
    }
  }
}

// 5) Release operations: ask the user (everywhere) ---------------------------
for (const rule of cfg.askPatterns) {
  if (toRegex(rule.match).test(cmd)) ask(`Confirmation required: ${rule.reason}. Check environment, solution and version before approving.`);
}

process.exit(0);
