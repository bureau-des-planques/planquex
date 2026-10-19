#!/usr/bin/env node
/**
 * Métriques factuelles du projet Bureau des Planqués.
 * N'écrit rien : affiche un JSON sur stdout.
 *
 * Le décompte des cartes n'est jamais recopié : il se **dérive d'`ALL_CARDS`**
 * (`src/data/index.ts`), chargé par Vite tel qu'il est écrit. C'est la seule
 * source de ce nombre — `AGENTS.md` §7 et `README.md` renvoient ici, et
 * `scripts/compteurs.test.ts` échoue si un décompte en dur y revient.
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

/**
 * Décompte des cartes, lu sur `ALL_CARDS` — pas sur un littéral.
 * Vite sert de chargeur TypeScript : le module est évalué tel quel, sans build.
 */
async function cardReport() {
  const { createServer } = await import('vite');
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent'
  });
  try {
    const { ALL_CARDS: all } = await server.ssrLoadModule('/src/data/index.ts');
    const cards = all ?? [];
    return {
      total: cards.length,
      base: cards.filter((card) => !card.variantOf).length,
      variants: cards.filter((card) => card.variantOf).length,
      factions: [...new Set(cards.map((card) => card.faction))].sort()
    };
  } finally {
    await server.close();
  }
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
  cards: await cardReport(),
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
