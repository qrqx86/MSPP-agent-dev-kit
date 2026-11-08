#!/usr/bin/env node
// Git merge driver for JSON resource files (locales/<lang>/*.json): deep merge of the keys instead of
// line conflicts. On the same key changed on both sides the current branch ("ours", e.g. main) wins.
// Setup (once per clone):
//   git config merge.locales.name "deep merge of JSON resources"
//   git config merge.locales.driver "node tools/merge-locales.cjs %O %A %B"
//   .gitattributes:  **/locales/**/*.json merge=locales
// Exit 0 = merged into %A; exit 1 = not JSON, git falls back to a normal conflict.
'use strict';
const fs = require('fs');

const [, , basePath, oursPath, theirsPath] = process.argv;
const read = (p) => {
  try { const t = fs.readFileSync(p, 'utf8'); return t.trim() ? JSON.parse(t) : {}; } catch { return undefined; }
};
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function merge(base, ours, theirs) {
  if (same(ours, theirs)) return ours;
  if (same(base, ours)) return theirs; // only theirs changed
  if (same(base, theirs)) return ours; // only ours changed
  if (!isObj(ours) || !isObj(theirs)) return ours; // both changed the same value: ours wins
  const b = isObj(base) ? base : {};
  const res = {};
  for (const k of Object.keys(ours)) {
    if (!(k in theirs)) { if (!(k in b) || !same(b[k], ours[k])) res[k] = ours[k]; continue; } // deleted by theirs
    res[k] = merge(b[k], ours[k], theirs[k]);
  }
  for (const k of Object.keys(theirs)) {
    if (k in ours) continue;
    if (!(k in b) || !same(b[k], theirs[k])) res[k] = theirs[k]; // added by theirs (kept unless ours deleted it unchanged)
  }
  return res;
}

const base = read(basePath);
const ours = read(oursPath);
const theirs = read(theirsPath);
if (ours === undefined || theirs === undefined) process.exit(1);
const text = fs.readFileSync(oursPath, 'utf8');
const indent = (text.match(/^[ \t]+(?=")/m) || ['  '])[0];
const eol = text.includes('\r\n') ? '\r\n' : '\n';
fs.writeFileSync(oursPath, JSON.stringify(merge(base || {}, ours, theirs), null, indent).replace(/\n/g, eol) + eol);
process.exit(0);
