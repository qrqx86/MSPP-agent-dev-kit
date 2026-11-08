#!/usr/bin/env node
// PreToolUse (Write|Edit|MultiEdit|NotebookEdit): block content that looks like a secret, and writes of a
// subagent outside the paths allowed to it (config agentWritePaths, e.g. the reviewer only in reviews/).
'use strict';
const path = require('path');
const { readInput, loadConfig, toRegex, msg, block } = require('./lib.cjs');

const input = readInput();
const ti = input.tool_input || {};
const file = String(ti.file_path || ti.notebook_path || '');
const cfg = loadConfig();

// Path limits per subagent (agent_type is set by Claude Code when a subagent calls the tool).
const agent = String(input.agent_type || '');
const limits = (cfg.agentWritePaths || {})[agent];
if (agent && Array.isArray(limits)) {
  const norm = path.normalize(file).replace(/\\/g, '/');
  if (!file || !limits.map(toRegex).some((r) => r.test(norm))) block(msg('agentWritePath', { agent, file: file || '-' }));
}

const parts = [ti.content, ti.new_string, ti.new_source, ...((ti.edits || []).map((e) => e && e.new_string))];
const text = parts.filter((p) => typeof p === 'string').join('\n');
if (!text) process.exit(0);

if (cfg.secretAllowFiles.map(toRegex).some((r) => r.test(file.replace(/\\/g, '/')))) process.exit(0);

// Values that are clearly not secrets: placeholders, references to secret stores, variables, test values.
const PLACEHOLDER = /^(<.*>|\$\{.*\}|\{\{.*\}\}|\$\(.*\)|%.*%|\*+|x+|\.+)$|example|placeholder|dummy|changeme|your[-_]|redacted|process\.env|\$env:|secrets\.|variables\.|@Microsoft\.KeyVault|keyvault|\bfake|\bmock|\bsample|^test[-_]|[-_]test$|test-password/i;
// Identifiers (names of settings or variables, no digits) are not secret values.
const IDENTIFIER = /^[A-Za-z_.-]+$/;
// Paths and URLs (./dist/x, /usr/bin, https://...) are not secret values either.
const PATHLIKE = /^(\.{0,2}[\\/]|~[\\/]|[A-Za-z]:[\\/])|:\/\//;
const KEY = '(?:password|passwd|pwd|client_?secret|api[_-]?key|access[_-]?key|secret|token|(?<![a-z])pat(?![a-z]))';

const rules = [
  { name: 'privateKey', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/ },
  { name: 'storageKey', re: /(?:AccountKey|SharedAccessKey)=([A-Za-z0-9+/=]{20,})/, group: 1 },
  { name: 'sasToken', re: /[?&]sig=([A-Za-z0-9%+/=]{30,})/, group: 1 },
  { name: 'entraSecret', re: /\b[A-Za-z0-9_~.-]{3}\dQ~[A-Za-z0-9_~.-]{31,34}\b/ },
  { name: 'githubToken', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/ },
  { name: 'awsKey', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'connectionString', re: /(?:Password|Pwd|ClientSecret)\s*=\s*([^;"'\s<>]{6,})/i, group: 1 },
  // Quoted value: const password = "..."; "clientSecret": "..."
  { name: 'assignedSecret', re: new RegExp(`["']?[\\w.-]*${KEY}["']?\\s*[:=]\\s*["']([^"'\\s]{8,})["']`, 'i'), group: 1, id: true },
  // Unquoted value: .env (API_KEY=...), YAML (secret: ...), PowerShell ($pat = ...) – at least 12 characters.
  { name: 'assignedSecret', re: new RegExp(`^\\s*(?:export\\s+|\\$)?[\\w.-]*${KEY}[\\w.-]*\\s*[:=]\\s*([^\\s"'#,;{}()]{12,})\\s*(?:#.*)?$`, 'i'), group: 1, id: true, path: true },
];

for (const line of text.split(/\r?\n/)) {
  if (/pp-kit:allow-secret/.test(line)) continue;
  for (const r of rules) {
    const m = line.match(r.re);
    if (!m) continue;
    const value = r.group ? m[r.group] : m[0];
    if (r.group && PLACEHOLDER.test(value)) continue;
    if (r.id && IDENTIFIER.test(value)) continue;
    if (r.path && PATHLIKE.test(value)) continue;
    block(msg('secret', { file: file || 'file', kind: msg(`secret.${r.name}`) }));
  }
}
process.exit(0);
