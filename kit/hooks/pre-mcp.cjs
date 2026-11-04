#!/usr/bin/env node
// PreToolUse (Dataverse / Azure DevOps / GitHub / FlowAgent MCP tools): the shell hook cannot see MCP calls,
// so non-DEV environments are blocked here and write operations require confirmation.
'use strict';
const { readInput, loadConfig, toRegex, findProjectRoot, projectDev, block, ask } = require('./lib.cjs');

const input = readInput();
const tool = String(input.tool_name || '');
const args = JSON.stringify(input.tool_input || {});
const cfg = loadConfig();

const hay = `${tool} ${args}`;
const allowed = cfg.allowPatterns.map(toRegex).some((r) => r.test(hay));
const blocked = [...cfg.prodPatterns, ...cfg.nonDevPatterns].map(toRegex).some((r) => r.test(hay));
if (!allowed && blocked) {
  block(`MCP call blocked (${tool}): it references a TEST/STAGING/PROD environment. Agents operate only on DEV.`);
}
const dev = projectDev(findProjectRoot(input.cwd));
if (!allowed && dev && dev.host) {
  for (const m of hay.matchAll(/([a-z0-9-]+\.crm\d*\.dynamics\.com)/gi)) {
    if (m[1].toLowerCase() !== dev.host) block(`MCP call blocked (${tool}): "${m[1]}" is not the project DEV environment (${dev.host}).`);
  }
}

// Tool name after the server prefix, e.g. mcp__dataverse__create_record -> create_record
const op = tool.split('__').pop() || '';
if (new RegExp(cfg.mcpWritePattern, 'i').test(op)) {
  ask(`Confirmation required: MCP write operation "${op}" on ${tool.split('__')[1] || 'server'}.`);
}
process.exit(0);
