import { describe, expect, it } from 'vitest';
import { ETAPES_COMBAT, secondesDeLecture } from './pas-a-pas-combat-etapes';

/**
 * Le **pas-à-pas du combat** (#143) : le contrat du contenu, mesuré — le même
 * modèle que `journee-etapes.test.ts`. Cinq étapes, trente secondes au plus,
 * le vocabulaire du jeu, aucune étape qui bloque.
 */
describe('les cinq choses du premier combat (#143)', () => {
  it('tient en cinq étapes', () => {
    expect(ETAPES_COMBAT).toHaveLength(5);
  });

  it('chaque étape tient en trente secondes, titre compris', () => {
    for (const etape of ETAPES_COMBAT) {
      expect(secondesDeLecture(etape), etape.titre).toBeLessThanOrEqual(30);
    }
  });

  it('chaque étape désigne au moins un élément du combat', () => {
    for (const etape of ETAPES_COMBAT) {
      expect(etape.cibles.length, etape.titre).toBeGreaterThanOrEqual(1);
    }
  });

  it('couvre le Poste, le café, la Pression, les Conditions, la fin', () => {
    const textes = ETAPES_COMBAT.map((e) => `${e.titre} ${e.texte}`);
    expect(textes.some((t) => /Poste|Rack/i.test(t))).toBe(true);
    expect(textes.some((t) => /café/i.test(t))).toBe(true);
    expect(textes.some((t) => /Pression/i.test(t))).toBe(true);
    expect(textes.some((t) => /Condition/i.test(t))).toBe(true);
    expect(textes.some((t) => /Intervention|relève|craque/i.test(t))).toBe(true);
  });

  it('n’emploie aucun mot interdit', () => {
    const interdits = ['Galère', 'GalèreMon', 'Pokémon', 'Galérodex', 'HP', 'PV', 'onboarding'];
    for (const etape of ETAPES_COMBAT) {
      const texte = `${etape.titre} ${etape.texte}`;
      for (const mot of interdits) {
        expect(texte).not.toContain(mot);
      }
    }
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('le pas-à-pas a un seul écrivain du drapeau (le piège #130)', () => {
  const composant = readFileSync(fileURLToPath(new URL('./use-pas-a-pas-combat.ts', import.meta.url)), 'utf8');
  it('n’écrit le drapeau que dans terminer (le piège #130 corrigé)', () => {
    // Le seul endroit qui écrit `true` est le corps de `terminer`.
    expect(composant).toMatch(/setPasAPasCombatVu\(true\)/);
    // Une seule occurrence — ni sur la fermeture du dialogue, ni sur le bouton « Suivant ».
    const ecritures = composant.match(/setPasAPasCombatVu\(true\)/g) ?? [];
    expect(ecritures).toHaveLength(1);
  });
});
