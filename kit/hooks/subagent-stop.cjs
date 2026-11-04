#!/usr/bin/env node
// SubagentStop: team agents must close their result with the "Rules applied" section (pp-team-rules §7).
'use strict';
const { readInput, loadConfig, findProjectRoot } = require('./lib.cjs');

const input = readInput();
if (input.stop_hook_active) process.exit(0); // ask at most once
const cfg = loadConfig();
const agent = String(input.agent_type || '');
if (!cfg.teamAgents.includes(agent)) process.exit(0);
if (!findProjectRoot(input.cwd)) process.exit(0);

const msg = String(input.last_assistant_message || '');
if (!msg) process.exit(0);
if (/Rules applied/i.test(msg)) process.exit(0);

process.stdout.write(JSON.stringify({
  decision: 'block',
  reason: '[pp-kit] The result has no "### Rules applied" section. Add it (IDs of the rules followed, ' +
    'or "No applicable rule - assumption: ..."), together with "Assumptions and decisions" and "Files changed".',
}));
process.exit(0);
