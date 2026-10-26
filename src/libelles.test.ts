import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **Un fait, un fichier** (#248) — les étiquettes et les constantes de règle n'ont
 * qu'une source, et ce test refuse la deuxième.
 *
 * La duplication n'est pas théorique : avant #248, `kindLabel` existait deux fois, et les
 * deux copies ne disaient pas la même chose — celle du plateau perdait la catégorie
 * NEUF/MRO (D-027) et fondait le COMEX dans le texte, celle des données l'inverse. Sur le
 * même écran, un Objet MRO s'affichait « Objet · MRO » et s'annonçait « Objet ».
 *
 * Le contrôle **lit le dépôt**, comme `src/renommages.test.ts` : pas de linter de plus.
 * Et il **mord** : le dernier test le confronte à une source fautive fabriquée.
 */
const RACINE = process.cwd();

interface Source {
  relatif: string;
  source: string;
}

/** Les sources de `src/`, hors fichiers de test : eux ont le droit de nommer ce qu'ils éprouvent. */
function sources(): Source[] {
  const trouves: Source[] = [];
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) {
        parcourir(chemin);
        continue;
      }
      if (!/\.tsx?$/.test(entree.name) || /\.test\.tsx?$/.test(entree.name)) continue;
      trouves.push({
        relatif: relative(RACINE, chemin).split(sep).join('/'),
        source: readFileSync(chemin, 'utf8')
      });
    }
  };
  parcourir(join(RACINE, 'src'));
  return trouves;
}

const SOURCES = sources();

/** Les fichiers qui portent `motif`, en relatif et triés. */
function declarants(liste: readonly Source[], motif: string): string[] {
  return liste
    .filter((fichier) => fichier.source.includes(motif))
    .map((fichier) => fichier.relatif)
    .sort();
}

describe('libellés et constantes — une seule source (#248)', () => {
  it('le stade et la nature d’une carte n’ont qu’un `kindLabel`', () => {
    expect(declarants(SOURCES, 'function kindLabel(')).toEqual(['src/data/index.ts']);
  });

  it('le libellé d’un café n’a qu’un corps, dans le module feuille', () => {
    expect(declarants(SOURCES, 'function cafeLabel(')).toEqual(['src/data/vocabulaire.ts']);
  });

  it('la limite de main n’est écrite qu’une fois', () => {
    expect(declarants(SOURCES, 'const HAND_LIMIT')).toEqual(['src/game/rules.ts']);
  });

  it('le nom d’un camp ne s’écrit que dans le vocabulaire', () => {
    expect(declarants(SOURCES, "'camp Direction'")).toEqual(['src/data/vocabulaire.ts']);
  });

  it('la copie de « 3 Interventions » a disparu', () => {
    // `INTERVENTIONS_POUR_GAGNER` était la copie locale de `POINTS_TO_WIN`.
    expect(declarants(SOURCES, 'INTERVENTIONS_POUR_GAGNER')).toEqual([]);
  });

  it('le moteur et les écrans ne disent plus « L’IA » (D-108)', () => {
    // Le camp adverse s'appelle « La Direction » partout. L'apostrophe **courbe** est
    // celle des phrases du journal et de l'écran ; la droite ne subsiste que dans la
    // doc du module `ia.ts` (« l'IA du Bureau des Planqués »), qui parle du code et non
    // du camp — le mot y est un nom commun, pas un nom propre de siège.
    const ecrans = SOURCES.filter((fichier) => /^src\/(game|pages)\//.test(fichier.relatif));
    expect(declarants(ecrans, 'L’IA')).toEqual([]);
  });
});

describe('le contrôle mord', () => {
  it('deux déclarations dans deux fichiers sont vues, et la garde échouerait', () => {
    // Le cas fautif : c'est exactement la forme d'avant #248. Si `declarants` ne le
    // voyait pas, toutes les assertions ci-dessus passeraient quoi qu'il arrive.
    const fautives: Source[] = [
      { relatif: 'src/data/index.ts', source: 'export function kindLabel(card: Card): string { return ""; }' },
      {
        relatif: 'src/pages/Battle.tsx',
        source: 'function kindLabel(definition: Card | undefined): string { return ""; }'
      }
    ];
    expect(declarants(fautives, 'function kindLabel(')).toEqual(['src/data/index.ts', 'src/pages/Battle.tsx']);
  });
});
