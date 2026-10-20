import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fou des **exports sans appelant** — ticket #59.
 *
 * `noUnusedLocals` attrape les **locales** mortes, jamais les exports : un
 * `export const` que personne n'importe compile sans un mot. Le motif du dépôt pour
 * ce genre de contrôle est un test qui lit le code, comme `scripts/compteurs.test.ts` :
 * pas de linter de plus, et la liste d'exceptions se relit.
 *
 * La liste des exports est **dérivée** de `src/` à chaque exécution : il n'y a aucun
 * inventaire recopié à tenir à jour. Seules les exceptions sont écrites à la main,
 * avec leur raison, et elles sont vérifiées **dans les deux sens** : une exception
 * périmée (l'export a retrouvé un appelant) fait échouer le test, et une exception
 * qui ne nomme aucun export aussi.
 *
 * Un export est « appelé » dès que son nom apparaît comme identifiant ailleurs que
 * dans sa déclaration — dans `src/`, `scripts/` ou `vite.config.ts`. Les commentaires
 * sont retirés avant le comptage : une phrase qui parle d'un symbole ne l'appelle pas.
 * Les fichiers `*.test.ts` comptent comme appelants : un symbole que seul son test
 * importe n'est pas mort.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
/** Ce fichier nomme les exports morts : il ne peut pas se compter comme appelant. */
const SELF = fileURLToPath(import.meta.url);

const SOURCE_FILE = /\.(ts|tsx)$/;
const CALLER_FILE = /\.(ts|tsx|mjs)$/;

interface PublicExport {
  name: string;
  file: string;
  line: number;
}

interface Source {
  file: string;
  text: string;
}

function filesUnder(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path, pattern);
    return pattern.test(entry.name) ? [path] : [];
  });
}

/**
 * Retire les commentaires — blocs et lignes entières. Les commentaires de fin de
 * ligne restent : ils ne peuvent que garder un export en vie, jamais en tuer un.
 */
function withoutComments(text: string): string {
  // Un bloc est remplacé par des espaces **de même longueur en lignes** : les numéros
  // de ligne des messages doivent rester ceux du fichier.
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

const DECLARATION = /^export\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
const NAMED = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/** Les exports publics d'un fichier : `export const X` et `export { X, Y as Z }`. */
function exportsIn(text: string, file: string): PublicExport[] {
  const found: PublicExport[] = [];
  for (const match of text.matchAll(DECLARATION)) {
    found.push({ name: match[1], file, line: lineOf(text, match.index ?? 0) });
  }
  for (const match of text.matchAll(NAMED)) {
    for (const specifier of match[1].split(',')) {
      const name = specifier.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) found.push({ name, file, line: lineOf(text, match.index ?? 0) });
    }
  }
  return found;
}

function occurrences(text: string, name: string): number {
  return text.match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0;
}

/**
 * Les exports sans aucun appelant, dans l'ordre de `src/`. Le fichier qui déclare le
 * symbole compte aussi (une fonction exportée peut s'appeler elle-même) : on retire
 * donc **une** occurrence, celle de la déclaration.
 */
function deadExportsOf(exportsToCheck: readonly PublicExport[], corpus: readonly Source[]): PublicExport[] {
  return exportsToCheck.filter((entry) => {
    const uses = corpus.reduce((total, source) => {
      const count = occurrences(source.text, entry.name);
      return total + (source.file === entry.file ? count - 1 : count);
    }, 0);
    return uses <= 0;
  });
}

/**
 * Les lignes qui commencent par `export` sans être le début d'un export lu : la
 * comparaison porte sur les **lignes** de `exportsIn`, pas sur une seconde regex —
 * un `export * from` (ou toute syntaxe non lue) reste donc visible.
 */
function unreadExportLines(): string[] {
  return sourceFiles.flatMap(({ file, text }) => {
    const read = new Set(exportsIn(text, file).map((entry) => entry.line));
    return text
      .split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line, number }) => /^export\b/.test(line) && !read.has(number))
      .map(({ line, number }) => `${relative(ROOT, file)}:${number}  ${line}`);
  });
}

/**
 * Exports **légitimes sans appelant**, une raison par entrée. Toute entrée doit encore
 * être morte : dès qu'un appelant apparaît, le test réclame la suppression de la ligne.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  VIVIER_META: 'mort : les libellés de vivier ne sont lus par aucun écran — à câbler ou à supprimer, décision de conception hors du ticket #60',
  CardKind: 'type mort : les deux formes de carte réécrivent leur union de genre en clair — hors du périmètre du ticket #60'
};

const readSource = (file: string): Source => ({ file, text: withoutComments(readFileSync(file, 'utf8')) });

const sourceFiles = filesUnder(SRC, SOURCE_FILE).map(readSource);

const publicExports = sourceFiles.flatMap(({ file, text }) => exportsIn(text, file));

const sources: Source[] = [
  ...sourceFiles,
  ...filesUnder(join(ROOT, 'scripts'), CALLER_FILE).map(readSource),
  readSource(join(ROOT, 'vite.config.ts'))
].filter((source) => source.file !== SELF);

const dead = deadExportsOf(publicExports, sources);

describe('Exports publics — aucun sans appelant (ticket #59)', () => {
  it('tout export de src/ a un appelant, sauf exception motivée', () => {
    const orphans = dead
      .filter((entry) => !(entry.name in EXCEPTIONS))
      .map((entry) => `${relative(ROOT, entry.file)}:${entry.line}  ${entry.name}`);
    expect(orphans, 'export sans appelant — ajouter un appelant, ou une exception motivée').toEqual([]);
  });

  it('chaque exception nomme un export qui existe encore', () => {
    const names = new Set(publicExports.map((entry) => entry.name));
    expect(Object.keys(EXCEPTIONS).filter((name) => !names.has(name))).toEqual([]);
  });

  it('chaque exception est encore morte : une exception périmée se retire', () => {
    const alive = Object.entries(EXCEPTIONS)
      .filter(([name]) => !dead.some((entry) => entry.name === name))
      .map(([name, reason]) => `${name} — ${reason}`);
    expect(alive, 'ces exports ont retrouvé un appelant : retirer leur exception').toEqual([]);
  });

  it('lit chaque ligne `export` de src/ : aucune syntaxe ne peut échapper au garde-fou', () => {
    expect(publicExports.length, 'aucun export lu : le scan ne voit pas src/').toBeGreaterThan(0);
    expect(unreadExportLines()).toEqual([]);
  });

  it('reconnaît un export mort fabriqué, et pas un export appelé', () => {
    const fixture: PublicExport[] = [
      { name: 'USED', file: 'fixture.ts', line: 1 },
      { name: 'DEAD', file: 'fixture.ts', line: 2 }
    ];
    const fixtureSources: Source[] = [
      { file: 'fixture.ts', text: 'export const USED = 1;\nexport const DEAD = 2;' },
      { file: 'caller.ts', text: "import { USED } from './fixture';" }
    ];
    expect(deadExportsOf(fixture, fixtureSources).map((entry) => entry.name)).toEqual(['DEAD']);
  });
});
