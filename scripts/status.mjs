#!/usr/bin/env node
/**
 * Métriques factuelles du projet Bureau des Planqués.
 * N'écrit rien : affiche un JSON sur stdout.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ignored = new Set(['node_modules', 'dist', 'coverage', '.git']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function isSource(file) {
  return /\.(ts|tsx|css|mjs|json|md)$/.test(file);
}

function countLines(text) {
  return text === '' ? 0 : text.split('\n').length;
}

const files = await walk(root);
const sources = files.filter(isSource);
const byExt = {};
let totalLines = 0;
for (const file of sources) {
  const ext = file.split('.').pop();
  const text = await readFile(file, 'utf8').catch(() => '');
  const lines = countLines(text);
  totalLines += lines;
  byExt[ext] ??= { files: 0, lines: 0 };
  byExt[ext].files += 1;
  byExt[ext].lines += lines;
}

const tests = files.filter((file) => /\.(test|spec)\.(ts|tsx)$/.test(file));
const docs = files.filter((file) => file.endsWith('.md')).map((file) => relative(root, file));
const distIndex = await stat(join(root, 'dist/index.html')).then(() => true).catch(() => false);
const distSw = await stat(join(root, 'dist/sw.js')).then(() => true).catch(() => false);

let pkg = null;
try {
  pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
} catch {}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  root,
  files: {
    total: files.length,
    source: sources.length,
    tests: tests.length,
    byExt
  },
  totalLines,
  docs,
  scripts: pkg?.scripts ?? {},
  build: { distIndex, distSw }
}, null, 2));
