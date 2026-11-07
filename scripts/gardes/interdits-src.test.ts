import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Deux interdits de `AGENTS.md`, rendus **exécutables** (`AGENTS.md` §6, garde-fous) :
 *
 * 1. **Le hasard est seedé** (`AGENTS.md` §6, Moteur ; #29) : aucun appel à `Math.random()`
 *    dans le code de `src/game/` ni de `src/store/`. Le test dynamique de
 *    `src/game/engine.test.ts` (« Déterminisme ») ne couvre que le chemin qu'il joue ; celui-ci
 *    lit **tous** les fichiers, y compris ceux qu'aucune partie scriptée ne traverse.
 *    Les commentaires sont retirés avant la lecture : `src/store/partie.ts` écrit que
 *    `Math.random()` n'entre jamais en jeu, et c'est une phrase, pas un appel. Les tests aussi
 *    sont exclus : `engine.test.ts` nomme l'appel dans le message d'erreur de son espion.
 *    `src/animation/` n'est pas concerné : des particules décoratives ne touchent pas l'état.
 * 2. **Le vocabulaire legacy** (`AGENTS.md` §8.4, §9) : aucune occurrence du mot interdit dans
 *    `src/`, **tests compris**. Le mot est reconstruit par fragments, comme dans
 *    `src/test/vocabulaire-interdit.ts`, pour que ce fichier ne se dénonce pas lui-même.
 *
 * Chaque contrôle est une fonction pure, confrontée à un **cas fautif** avant d'être lancée sur
 * le dépôt : une garde qui ne peut pas échouer ne garde rien (#112).
 */

const RACINE = fileURLToPath(new URL('../..', import.meta.url));

/** Le mot de l'univers abandonné (§9), en fragments. */
const MOT_LEGACY = 'Gal' + 'ère';

/** Un appel au hasard global : `Math.random(`, espaces tolérés. */
const APPEL_HASARD = /\bMath\s*\.\s*random\s*\(/;

/** Retire les commentaires `//` et `/* … *\/` d'un source, en gardant les numéros de ligne. */
export function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/** Les lignes (1-indexées) d'un source qui appellent `Math.random()`, hors commentaires. */
export function appelsHasard(source: string): number[] {
  return sansCommentaires(source)
    .split('\n')
    .flatMap((ligne, i) => (APPEL_HASARD.test(ligne) ? [i + 1] : []));
}

/** Les lignes (1-indexées) d'un texte qui portent le mot legacy. */
export function occurrencesLegacy(texte: string): number[] {
  return texte.split('\n').flatMap((ligne, i) => (ligne.includes(MOT_LEGACY) ? [i + 1] : []));
}

/** Les fichiers d'un dossier, récursivement. */
function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

const SOURCE = /\.tsx?$/;
const TEST = /\.test\.tsx?$/;

describe('Le contrôle mord — cas fautifs', () => {
  it('trouve un appel à Math.random(), même espacé', () => {
    expect(appelsHasard('const a = 1;\nconst x = Math.random();')).toEqual([2]);
    expect(appelsHasard('const x = Math . random ();')).toEqual([1]);
  });

  it('ignore Math.random() dans un commentaire, pas dans le code qui suit', () => {
    expect(appelsHasard('// Math.random() est interdit\n/* Math.random() */')).toEqual([]);
    expect(appelsHasard('/**\n * Math.random()\n */\nconst x = Math.random();')).toEqual([4]);
    expect(appelsHasard("const url = 'http://x'; const y = Math.random();")).toEqual([1]);
  });

  it('ne confond pas la graine avec le hasard global', () => {
    expect(appelsHasard('const x = rng.random();\nconst y = random();')).toEqual([]);
  });

  it('trouve le mot legacy, et seulement lui', () => {
    expect(occurrencesLegacy(`titre\nla ${MOT_LEGACY} du lundi`)).toEqual([2]);
    expect(occurrencesLegacy('une galerie, un galet')).toEqual([]);
  });
});

describe('Le dépôt respecte les deux interdits', () => {
  it.each(['src/game', 'src/store'])('aucun Math.random() dans le code de %s', (dossier) => {
    const fautifs = fichiers(join(RACINE, dossier))
      .filter((f) => SOURCE.test(f) && !TEST.test(f))
      .flatMap((f) => appelsHasard(readFileSync(f, 'utf8')).map((l) => `${relative(RACINE, f)}:${l}`));
    expect(fautifs, 'le hasard vient de src/game/rng.ts (AGENTS.md §6)').toEqual([]);
  });

  it('aucune occurrence du mot legacy dans src/, tests compris', () => {
    const fautifs = fichiers(join(RACINE, 'src')).flatMap((f) =>
      occurrencesLegacy(readFileSync(f, 'utf8')).map((l) => `${relative(RACINE, f)}:${l}`)
    );
    expect(fautifs, 'AGENTS.md §8.4 : zéro occurrence dans src/').toEqual([]);
  });
});
