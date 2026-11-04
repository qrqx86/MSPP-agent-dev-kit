#!/usr/bin/env node
// PreToolUse (Dataverse / Azure DevOps / GitHub / FlowAgent MCP tools): the shell hook cannot see MCP calls,
// so non-DEV environments are blocked here and write operations require confirmation.
'use strict';
const {
  readInput, loadConfig, toRegex, msg, findProjectRoot, projectDev, isDev, hostsIn, guidsIn, isOrgHost, block, ask,
} = require('./lib.cjs');

const input = readInput();
const tool = String(input.tool_name || '');
const args = input.tool_input || {};
const cfg = loadConfig();
const rx = (list) => list.map(toRegex);
const any = (list, s) => list.some((r) => r.test(s));
const server = tool.split('__')[1] || 'server';
const op = tool.split('__').pop() || '';

const allowed = any(rx(cfg.allowPatterns), `${tool} ${JSON.stringify(args)}`);
const prod = rx(cfg.prodPatterns);
const nonDev = rx(cfg.nonDevPatterns);
const envNames = rx(cfg.envNamePatterns);
const envKey = toRegex(cfg.mcpEnvKeyPattern);
const dev = projectDev(findProjectRoot(input.cwd));
const devLabel = dev ? (dev.host || dev.id) : '';

// Every string value of the arguments, with the name of its key.
const values = [];
(function walk(v, key) {
  if (typeof v === 'string') values.push({ key, v });
  else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
})(args, '');

if (!allowed) {
  let unverifiedId = null;
  for (const { key, v } of values) {
    // Power Platform hosts anywhere in the arguments.
    for (const h of hostsIn(v)) {
      if (any(prod, h) || any(nonDev, h)) block(msg('mcpBlockedEnv', { tool, target: h }));
      if (dev && dev.host && isOrgHost(h) && h !== dev.host) block(msg('mcpNotDev', { tool, target: h, dev: devLabel }));
    }
    // Environment arguments (URL, id or name): only these are checked for lifecycle words and GUIDs,
    // so titles and descriptions that mention "production" are not blocked.
    if (!envKey.test(key)) continue;
    if (any(prod, v) || any(envNames, v)) block(msg('mcpBlockedEnv', { tool, target: v }));
    for (const g of guidsIn(v)) {
      if (dev && dev.id && g !== dev.id) block(msg('mcpNotDev', { tool, target: g, dev: devLabel }));
      if (dev && !dev.id) unverifiedId = g;
    }
    const otherUrl = /^[a-z]+:\/\//i.test(v) && !hostsIn(v).length; // e.g. a GitHub or Azure DevOps URL
    if (dev && v.trim() && !otherUrl && !guidsIn(v).length && !hostsIn(v).length && !isDev(dev, v)) block(msg('mcpNotDev', { tool, target: v, dev: devLabel }));
  }
  if (unverifiedId) ask(msg('mcpUnverifiedId', { tool, target: unverifiedId }));
}

// Write operations: verb tokens of the operation name, e.g. wit_create_work_item, set_current_env.
const tokens = op.toLowerCase().split(/[_-]+/);
const read = new Set(cfg.mcpReadVerbs);
const write = new Set(cfg.mcpWriteVerbs);
if (!read.has(tokens[0]) && tokens.some((t) => write.has(t))) ask(msg('mcpAsk', { op, server }));
process.exit(0);
