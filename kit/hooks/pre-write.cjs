#!/usr/bin/env node
// PreToolUse (Write|Edit|MultiEdit|NotebookEdit): block content that looks like a secret.
'use strict';
const { readInput, loadConfig, toRegex, block } = require('./lib.cjs');

const input = readInput();
const ti = input.tool_input || {};
const file = String(ti.file_path || ti.notebook_path || '');
const parts = [ti.content, ti.new_string, ti.new_source, ...((ti.edits || []).map((e) => e.new_string))];
const text = parts.filter((p) => typeof p === 'string').join('\n');
if (!text) process.exit(0);

const cfg = loadConfig();
if (cfg.secretAllowFiles.map(toRegex).some((r) => r.test(file))) process.exit(0);

const PLACEHOLDER = /^(<.*>|\$\{.*\}|\{\{.*\}\}|\$\(.*\)|%.*%|\*+|x+)$|example|placeholder|dummy|changeme|your[-_]|redacted|process\.env|\$env:/i;

const rules = [
  { name: 'private key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/ },
  { name: 'Azure Storage/Service Bus access key', re: /(?:AccountKey|SharedAccessKey)=([A-Za-z0-9+/=]{20,})/, group: 1 },
  { name: 'Entra ID client secret', re: /\b[A-Za-z0-9_~.-]{3}\dQ~[A-Za-z0-9_~.-]{31,34}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'password/secret in a connection string', re: /(?:Password|Pwd|ClientSecret)\s*=\s*([^;"'\s<>]{6,})/i, group: 1 },
  { name: 'assigned password/secret', re: /["']?(?:password|passwd|pwd|client_?secret|api[_-]?key|access[_-]?key|secret)["']?\s*[:=]\s*["']([^"'\s]{8,})["']/i, group: 1 },
];

for (const line of text.split(/\r?\n/)) {
  if (/pp-kit:allow-secret/.test(line)) continue;
  for (const r of rules) {
    const m = line.match(r.re);
    if (!m) continue;
    const value = r.group ? m[r.group] : m[0];
    if (r.group && PLACEHOLDER.test(value)) continue;
    block(`Write blocked (${file || 'file'}): possible ${r.name}. Use environment variables, Key Vault, pipeline secrets or connection references. ` +
      'False positive? Add the comment "pp-kit:allow-secret" on that line.');
  }
}
process.exit(0);
