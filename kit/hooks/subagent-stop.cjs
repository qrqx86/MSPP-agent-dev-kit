#!/usr/bin/env node
// SubagentStop: team agents must close their result with the rules section (pp-team-rules §7).
'use strict';
const { readInput, loadConfig, toRegex, msg, findProjectRoot } = require('./lib.cjs');

const input = readInput();
if (input.stop_hook_active) process.exit(0); // ask at most once
const cfg = loadConfig();
const agent = String(input.agent_type || '');
if (!cfg.teamAgents.includes(agent)) process.exit(0);
if (!findProjectRoot(input.cwd)) process.exit(0);

const text = String(input.last_assistant_message || '');
if (!text) process.exit(0);
// The section must be a heading ("### Rules applied"), not a passing mention.
const heading = new RegExp(`^\\s*#{2,4}\\s*(${toRegex(cfg.resultSectionPattern || 'Rules applied').source})`, 'im');
if (heading.test(text)) process.exit(0);

process.stdout.write(JSON.stringify({ decision: 'block', reason: `[pp-kit] ${msg('missingRulesSection')}` }));
process.exit(0);
