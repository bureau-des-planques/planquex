// @vitest-environment node
/**
 * Aucun nouveau PNG de plus de 1 Mo dans `docs/preuves/` — D-189.
 *
 * Mesuré le 07/11/2026 : `.git` pèse 168 Mo, et `docs/preuves/` 33 Mo, presque tout en PNG. Une
 * capture ou une planche entre dans l'historique et y reste, même supprimée plus tard : le dépôt
 * ne maigrit qu'en réécrivant l'historique, ce que D-189 écarte. La garde agit donc **à
 * l'entrée** : un PNG de preuve tient sous 1 Mo (une capture à 420 × 900 en fait ~300 Ko ; une
 * planche plus grosse se recompresse ou se découpe).
 *
 * Les cinq PNG déjà au-dessus de la limite le 07/11/2026 sont listés tels quels : ils ne bougent
 * pas, mais ils ne grossissent pas, et la liste ne s'allonge pas sans une décision.
 *
 * **Le contrôle mord** : le dernier test confronte le contrôle à un inventaire **fabriqué** —
 * un PNG neuf trop lourd, un PNG connu qui a grossi — qui doivent tous deux être signalés
 * (`AGENTS.md` §6).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const PREUVES = join(RACINE, 'docs/preuves');

/** 1 Mo, au sens de `du` et de GitHub : 1 048 576 octets. */
const LIMITE = 1024 * 1024;

/** Les PNG au-dessus de la limite le 07/11/2026, avec leur taille exacte d'alors en octets (D-189). */
const EXISTANTS: Readonly<Record<string, number>> = {
  'docs/preuves/scene-fin-2026-10-30/planche-ralenti-x5.png': 2_832_938,
  'docs/preuves/ecrans-2026-10-20/parc.png': 2_506_796,
  'docs/preuves/ouverture-arrivage-2026-10-28/planche-retournement-2026-10-28.png': 2_423_280,
  'docs/preuves/ouverture-arrivage-2026-10-28/planche-frames.png': 1_447_449,
  'docs/preuves/astuces-2026-10-20/05-deroulement-dun-tour.png': 1_346_016
};

type Fichier = { chemin: string; octets: number };

function pngs(dossier: string): Fichier[] {
  return readdirSync(dossier, { recursive: true, encoding: 'utf8' })
    .filter((nom) => nom.toLowerCase().endsWith('.png'))
    .map((nom) => {
      const absolu = join(dossier, nom);
      return { chemin: relative(RACINE, absolu).split('\\').join('/'), octets: statSync(absolu).size };
    });
}

/** Ce qui dépasse : un PNG absent de la liste au-dessus de la limite, ou un PNG listé qui a grossi. */
export function tropLourds(fichiers: readonly Fichier[], existants = EXISTANTS): string[] {
  return fichiers
    .filter(({ chemin, octets }) => octets > (existants[chemin] ?? LIMITE))
    .map(({ chemin, octets }) => `${chemin} (${(octets / LIMITE).toFixed(2)} Mo)`);
}

describe('Les PNG de docs/preuves/ tiennent sous 1 Mo (07/11/2026, D-189)', () => {
  it('aucun PNG neuf au-dessus de 1 Mo, aucun PNG listé qui grossit', () => {
    expect(tropLourds(pngs(PREUVES))).toEqual([]);
  });

  it('la liste des existants ne garde que des fichiers présents et encore au-dessus de la limite', () => {
    const presents = new Map(pngs(PREUVES).map(({ chemin, octets }) => [chemin, octets]));
    for (const chemin of Object.keys(EXISTANTS)) {
      expect(presents.has(chemin), `${chemin} n'existe plus : le retirer de EXISTANTS`).toBe(true);
      expect(presents.get(chemin)! > LIMITE, `${chemin} tient sous 1 Mo : le retirer de EXISTANTS`).toBe(true);
    }
  });

  it('le contrôle mord : un PNG neuf trop lourd et un PNG connu qui a grossi sont signalés', () => {
    const fabriques: Fichier[] = [
      { chemin: 'docs/preuves/neuf/capture.png', octets: LIMITE + 1 },
      { chemin: 'docs/preuves/neuf/petite.png', octets: LIMITE },
      { chemin: 'docs/preuves/connu.png', octets: 2_000_001 },
      { chemin: 'docs/preuves/connu-stable.png', octets: 1_900_000 }
    ];
    const connus = { 'docs/preuves/connu.png': 2_000_000, 'docs/preuves/connu-stable.png': 2_000_000 };
    expect(tropLourds(fabriques, connus)).toEqual([
      'docs/preuves/neuf/capture.png (1.00 Mo)',
      'docs/preuves/connu.png (1.91 Mo)'
    ]);
  });
});
