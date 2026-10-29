import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * **La palette ne se recopie pas** (#283, revue du 29/10/2026).
 *
 * `src/styles.css` ouvre sur un `:root` de jetons, et se promet lui-même : « une couleur qui
 * change se change ici, une fois ». La revue a trouvé le contraire : `#0b1220` (`--bg`) y
 * apparaissait **neuf fois** et `#070c16` (`--bg-deep`) **trois**, dont sur le dos de carte que
 * chaque Arrivage affiche. Changer le fond du jeu laissait donc des îlots à l'ancienne couleur.
 *
 * Le contrôle est simple, et c'est ce qui le rend tenable : **la valeur littérale d'un jeton
 * n'apparaît qu'une fois dans le fichier, à sa définition**. Confronté à un doublon fabriqué,
 * il doit échouer — c'est le « le contrôle mord » d'`AGENTS.md` §6.
 */

const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(`../${chemin}`, import.meta.url)), 'utf8');

/** Les jetons dont la valeur est un littéral hexadécimal, et leur valeur. */
function jetons(feuille: string): Map<string, string> {
  const trouves = new Map<string, string>();
  for (const ligne of feuille.split('\n')) {
    const m = /^\s*(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/.exec(ligne);
    if (m) trouves.set(m[1], m[2]);
  }
  return trouves;
}

/**
 * Les jetons dont la valeur apparaît **hors d'une définition** : c'est ça, la recopie.
 *
 * « Une seule occurrence » serait faux : plusieurs jetons peuvent partager une valeur, et
 * shadcn en a trois (`--primary-foreground`, `--accent-foreground`,
 * `--sidebar-primary-foreground` valent tous `#06111f`). Un alias n'est pas une recopie.
 */
function recopies(feuille: string): { jeton: string; valeur: string; fois: number }[] {
  // Les **commentaires** citent des valeurs sans les employer (`#ff7f3f` vaut 3,59:1…), et
  // les **définitions** sont l'endroit légitime du littéral. On retire les deux.
  const horsDefinitions = feuille
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((ligne) => !/^\s*--[a-z0-9-]+:\s*#/.test(ligne))
    .join('\n');
  const out: { jeton: string; valeur: string; fois: number }[] = [];
  for (const [jeton, valeur] of jetons(feuille)) {
    const fois = horsDefinitions.split(valeur).length - 1;
    if (fois > 0) out.push({ jeton, valeur, fois });
  }
  return out;
}

describe('la palette de src/styles.css (revue du 29/10/2026)', () => {
  const feuille = lire('src/styles.css');

  it('la feuille déclare au moins les trois fonds', () => {
    const j = jetons(feuille);
    expect(j.has('--bg')).toBe(true);
    expect(j.has('--bg-deep')).toBe(true);
    expect(j.get('--bg')).toBe('#0b1220');
  });

  it('aucune valeur de jeton n’est recopiée dans une règle', () => {
    const doublons = recopies(feuille);
    expect(
      doublons,
      `valeur(s) de jeton utilisée(s) en dur dans une règle : ${doublons
        .map((d) => `${d.jeton} (${d.valeur}) × ${d.fois}`)
        .join(' ; ')} — écrire \`var(${doublons[0]?.jeton ?? '--jeton'})\` à la place.`
    ).toEqual([]);
  });

  it('le contrôle mord : une valeur recopiée est signalée', () => {
    const fabriquee = [
      ':root {',
      '  --bg: #0b1220;',
      '  --bg-deep: #070c16;',
      '}',
      '.dos { background: #0b1220; }'
    ].join('\n');
    expect(recopies(fabriquee)).toEqual([{ jeton: '--bg', valeur: '#0b1220', fois: 1 }]);
  });
});
