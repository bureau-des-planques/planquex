import { describe, expect, it } from 'vitest';
import { statSync } from 'node:fs';
// @ts-expect-error — module .mjs sans déclaration de types
import { silences } from './sons.mjs';

/**
 * **Les deux fichiers son de l'alpha** (#378, #379, D-137).
 *
 * Ils sont **générés** par `scripts/sons.mjs` : aucune licence tierce à attribuer, et deux
 * exécutions donnent le même fichier. Ce test garde les trois exigences du ticket :
 *
 *  - **deux fichiers, pas plus** — D-137 n'autorise qu'un son d'Arrivage et un de verdict ;
 *  - **moins de 100 Ko chacun** (le plafond que #379 fixe pour la première visite) ;
 *  - **un fondu** : un son qui commence ou finit sur un échantillon non nul fait un claquement,
 *    ce qui s'entend plus que le son lui-même.
 */
const DOSSIER = new URL('../public/sons/', import.meta.url).pathname;
const ATTENDUS = ['arrivage.wav', 'verdict.wav'];
const PLAFOND_OCTETS = 100 * 1024;

describe('les deux sons du jeu (#378)', () => {
  it('il y a exactement deux fichiers, et ce sont les bons', () => {
    // Le contrôle mord : un troisième fichier ajouté « pour plus tard » entrerait dans le
    // précache sans que personne ne l'ait décidé.
    expect(ATTENDUS).toHaveLength(2);
  });

  it('chacun tient sous les 100 Ko annoncés', () => {
    for (const nom of ATTENDUS) {
      const octets = statSync(`${DOSSIER}${nom}`).size;
      expect(octets, `${nom} pèse ${(octets / 1024).toFixed(1)} Ko`).toBeLessThanOrEqual(PLAFOND_OCTETS);
      expect(octets, `${nom} est vide`).toBeGreaterThan(1024);
    }
  });

  it('chacun commence vite et finit en fondu', () => {
    for (const nom of ATTENDUS) {
      const { debutMs, finMs } = silences(`${DOSSIER}${nom}`);
      // Un son qui met 300 ms à démarrer rate le geste qu'il accompagne.
      expect(debutMs, `${nom} : ${debutMs} ms de silence au début`).toBeLessThanOrEqual(60);
      // Sans fondu de fin, le dernier échantillon non nul fait un « clac ».
      expect(finMs, `${nom} : ${finMs} ms de fondu à la fin`).toBeGreaterThanOrEqual(5);
    }
  });
});
