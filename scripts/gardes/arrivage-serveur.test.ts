/**
 * **Le tirage de l'Arrivage ne diverge pas entre le client et le serveur** — #651, D-179.
 *
 * D-179 (8) laisse un point ouvert : « la divergence du tirage entre client et serveur —
 * **une seule implémentation**, l'Edge Function important `pack.ts`, et une garde sur des
 * graines de référence ». Supabase déployant **le dossier de la fonction** et non le dépôt,
 * l'import direct n'est pas tenable : le tirage serveur est une **copie générée**
 * (`supabase/functions/ouvrir-arrivage/arrivage-genere.ts`, `npm run arrivage:serveur`).
 * Cette garde est ce qui empêche la copie de mentir en silence.
 *
 * Trois contrôles, et chacun peut échouer :
 *
 * 1. **la copie est à jour** : catalogue (ordre compris), composition et taille sont ceux de
 *    `src/data/index.ts` et `src/game/pack.ts` — une composition changée d'un côté seulement
 *    tombe ici ;
 * 2. **les graines de référence** tirent les mêmes cinq cartes des deux côtés — c'est la
 *    garde du point (8), celle qui prouve que la règle est la même, pas seulement les données ;
 * 3. **le contrôle mord** : `divergences` confrontée à une composition ou à un catalogue
 *    fabriqués les dénonce (#112).
 *
 * Et une propriété de déploiement vérifiée par lecture : le dossier de la fonction n'importe
 * **rien hors de lui** — sinon Supabase le déploierait amputé.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/data';
import { PACK_COMPOSITION, PACK_SIZE, openPackCards } from '@/game/pack';
import { seedRng } from '@/game/rng';
import { divergences } from '../../scripts/generateurs/arrivage-serveur.mjs';
import * as copie from '../../supabase/functions/ouvrir-arrivage/arrivage-genere';

/** La source, dans la forme que le générateur lit. */
const SOURCE = {
  taille: PACK_SIZE,
  composition: PACK_COMPOSITION.map((slot) => ({ count: slot.count, rarities: [...slot.rarities] })),
  cartes: ALL_CARDS.map((carte) => ({ id: carte.id, rarity: carte.rarity }))
};

/** Le catalogue tel que la copie le porte. */
const COPIE = {
  taille: copie.PACK_SIZE,
  composition: copie.PACK_COMPOSITION.map((slot) => ({ count: slot.count, rarities: [...slot.rarities] })),
  cartes: copie.CARDS.map((carte) => ({ id: carte.id, rarity: carte.rarity }))
};

/**
 * Les graines de référence. Petites, grandes, aux deux bouts de 32 bits et une graine de
 * date : de quoi faire traverser les vingt tirages de composition sans se contenter d'un cas.
 */
const GRAINES = [0, 1, 42, 1234, 20261031, 4294967295] as const;

/** Les cinq cartes d'une graine, des deux côtés — la comparaison qui garde la règle. */
function tirageSource(graine: number) {
  return openPackCards({ rng: seedRng(graine) }).map((carte) => ({ id: carte.id, rarity: carte.rarity }));
}

function tirageCopie(graine: number) {
  return copie.openPackCards({ rng: copie.seedRng(graine) }).map((carte) => ({ id: carte.id, rarity: carte.rarity }));
}

describe('arrivage serveur — la copie du tirage ne diverge pas (#651, D-179)', () => {
  it('le catalogue, la composition et la taille de la copie sont ceux de la source', () => {
    // Le message dit quoi faire plutôt que de laisser chercher : c'est la sortie de `-- --verifie`.
    expect(divergences(SOURCE, COPIE), 'lance `npm run arrivage:serveur`').toEqual([]);
  });

  it('le catalogue de la copie ne porte que ce que le tirage lit (id, rarity)', () => {
    for (const carte of copie.CARDS) {
      expect(Object.keys(carte).sort()).toEqual(['id', 'rarity']);
    }
  });

  it.each([...GRAINES])('la graine %i tire les mêmes cinq cartes des deux côtés', (graine) => {
    const attendu = tirageSource(graine);
    expect(attendu).toHaveLength(copie.PACK_SIZE);
    expect(tirageCopie(graine)).toEqual(attendu);
  });

  it('les cartes tirées respectent la composition (3 communes, 1 peu commune, 1 rare)', () => {
    // La règle de `docs/JEU.md` §4.2, vérifiée sur les deux côtés : la copie ne peut pas
    // tirer une rareté que la composition ne nomme pas.
    for (const graine of GRAINES) {
      for (const tirage of [tirageSource(graine), tirageCopie(graine)]) {
        const raretes = tirage.map((carte) => carte.rarity);
        const autorisees = new Set<string>(SOURCE.composition.flatMap((slot) => slot.rarities));
        expect(raretes.every((rarete) => autorisees.has(rarete))).toBe(true);
        expect(raretes.filter((rarete) => rarete === '1D' || rarete === '2D').length).toBe(3);
        expect(raretes.filter((rarete) => rarete === '3D').length).toBe(1);
        expect(raretes.filter((rarete) => ['1S', '2S', '4D'].includes(rarete)).length).toBe(1);
      }
    }
  });

  it('le dossier de la fonction n’importe rien hors de lui (Supabase déploie le dossier)', () => {
    const dossier = new URL('../../supabase/functions/ouvrir-arrivage/', import.meta.url);
    const index = readFileSync(fileURLToPath(new URL('index.ts', dossier)), 'utf8');
    const genere = readFileSync(fileURLToPath(new URL('arrivage-genere.ts', dossier)), 'utf8');
    const imports = [...index.matchAll(/from\s+'([^']+)'/g)].map(([, chemin]) => chemin);
    // Les seuls imports relatifs autorisés sont ceux du dossier ; les autres sont des URLs
    // (`jsr:`, `https:`), que Deno résout au déploiement.
    const relatifs = imports.filter((chemin) => chemin.startsWith('.'));
    expect(relatifs).toEqual(['./arrivage-genere.ts']);
    expect(genere).not.toMatch(/^\s*import\s/m);
  });

  describe('le contrôle mord (#112)', () => {
    it('une composition changée dans la source est dénoncée', () => {
      const composition = SOURCE.composition.map((slot, index) =>
        index === 0 ? { ...slot, count: slot.count - 1 } : slot
      );
      const ecarts = divergences({ ...SOURCE, composition }, COPIE);
      expect(ecarts.join('\n')).toContain('PACK_COMPOSITION');
    });

    it('un catalogue réordonné ou changé est dénoncé', () => {
      const cartes = [...SOURCE.cartes];
      cartes[0] = { ...cartes[0], rarity: 'COU' };
      const ecarts = divergences({ ...SOURCE, cartes }, COPIE);
      expect(ecarts.join('\n')).toContain('CARDS[0]');
    });

    it('une taille changée est dénoncée', () => {
      expect(divergences({ ...SOURCE, taille: SOURCE.taille + 1 }, COPIE).join('\n')).toContain('PACK_SIZE');
    });
  });
});
