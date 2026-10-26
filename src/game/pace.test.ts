import { describe, expect, it } from 'vitest';
import type { Rarity, Stage } from '@/data/types';
import { type Band, damageBand, hpBand } from '@/game/curves';

/**
 * Modèle de **rythme** : combien de tours pour prendre 3 Interventions.
 *
 * Ce n'est pas une simulation de parties — le moteur n'a pas d'IA et l'objectif
 * d'O-011 est de chiffrer l'effet du **Seuil** sur la durée d'une partie, pas de
 * jouer. Hypothèses, toutes explicites :
 *
 * - 1 café généré par tour, **non consommé** par la Pression (§4) : l'attaquant
 *   attaque donc à chaque tour dès qu'il a atteint le coût de son attaque ;
 * - les bandes de Seuil et de dégâts ne sont **pas** recopiées : elles sont lues
 *   dans `@/game/curves` (ticket #55), le chiffré de `CARD-SPEC.md` §2 ;
 * - le défenseur ne fait rien : pas de soin, pas de statut, pas de relève ;
 * - 1 Intervention par craquage (cas le plus défavorable au rythme) ;
 * - l'adversaire aligne le même profil à chaque craquage.
 *
 * Lancer `PACE_REPORT=1 npx vitest run src/game/pace.test.ts` pour afficher le
 * tableau complet ; `npm test` ne vérifie que la conclusion.
 */

interface Profile {
  label: string;
  /** Seuil du défenseur, bande basse et haute. */
  hp: Band;
  /** Dégâts de l'attaquant, bande basse et haute. */
  damage: Band;
  /** Coût de son attaque, en cafés. */
  cost: number;
}

/** Bande de Seuil d'un stade : l'union des raretés qui y vivent (`CARD-SPEC.md` §2). */
const stageSeuil = (stage: Stage, rarities: readonly Rarity[]): Band => {
  const bands = rarities.map((rarity) => {
    const band = hpBand(stage, rarity);
    if (!band) throw new Error(`${stage}/${rarity} : bande de Seuil absente de curves.ts`);
    return band;
  });
  return [Math.min(...bands.map((band) => band[0])), Math.max(...bands.map((band) => band[1]))];
};

/** Bande de dégâts d'un coût en cafés (`CARD-SPEC.md` §2, D-021). */
const degats = (cost: number): Band => {
  const band = damageBand(cost);
  if (!band) throw new Error(`coût ${cost} café(s) : bande de dégâts absente de curves.ts`);
  return band;
};

const profile = (label: string, stage: Stage, rarities: readonly Rarity[], cost: number): Profile => ({
  label,
  hp: stageSeuil(stage, rarities),
  damage: degats(cost),
  cost
});

/**
 * **Notre** courbe : celle du module, sans une seule borne recopiée. Le coût retenu
 * par profil est celui de l'attaque de référence de `CARD-SPEC.md` §2 (1 café pour un
 * Entrant, 2 pour N+1 et N+2, 3 pour un COMEX).
 */
const OUR_CURVE: Profile[] = [
  profile('Entrant → Entrant', 'ENTRANT', ['1D', '2D'], 1),
  profile('N+1 → N+1', 'N+1', ['2D', '3D'], 2),
  profile('N+2 → N+2', 'N+2', ['3D'], 2),
  profile('COMEX → COMEX', 'N+2', ['4D'], 3)
];

/**
 * Mesure du **jeu de référence**, relevée le 19/10/2026 (D-023). Elle reste ici, et
 * **pas** dans `curves.ts` : c'est une preuve datée du miroir, pas une règle du jeu ;
 * déplacée dans un module de règles, sa provenance disparaîtrait (ticket #55).
 */
const REAL_CURVE: Profile[] = [
  { label: 'Entrant → Entrant', hp: [50, 80], damage: [10, 20], cost: 1 },
  { label: 'N+1 → N+1', hp: [90, 120], damage: [30, 50], cost: 2 },
  { label: 'N+2 → N+2', hp: [140, 160], damage: [50, 80], cost: 2 },
  { label: 'COMEX → COMEX', hp: [170, 190], damage: [70, 120], cost: 3 }
];

const PRIZES = 3;

/** Frappes nécessaires pour un craquage — hypothèse optimiste (peu de Seuil, gros dégâts). */
const hitsOptimistic = (p: Profile) => Math.ceil(p.hp[0] / p.damage[1]);
/** Frappes nécessaires pour un craquage — hypothèse pessimiste (beaucoup de Seuil, petits dégâts). */
const hitsPessimistic = (p: Profile) => Math.ceil(p.hp[1] / p.damage[0]);

/** Tours pour prendre les 3 Interventions : la montée en café, puis une frappe par tour. */
const turns = (p: Profile, hits: (profile: Profile) => number) => p.cost - 1 + PRIZES * hits(p);

const table = (curve: Profile[], hits: (profile: Profile) => number) =>
  curve.map((profile) => ({
    profil: profile.label,
    frappesParKO: hits(profile),
    tours: turns(profile, hits)
  }));

const asReport = (name: string, rows: ReturnType<typeof table>) =>
  rows.map(
    (row) => `${name.padEnd(7)} ${row.profil.padEnd(14)} ${row.frappesParKO} frappe(s)/craquage  ${row.tours} tours`
  );

describe('O-011 — effet du Seuil sur le rythme', () => {
  it('lit les bandes du jeu et les confronte à la mesure datée du miroir', () => {
    const oursOptimistic = table(OUR_CURVE, hitsOptimistic);
    const realOptimistic = table(REAL_CURVE, hitsOptimistic);
    const oursPessimistic = table(OUR_CURVE, hitsPessimistic);
    const realPessimistic = table(REAL_CURVE, hitsPessimistic);

    if (process.env.PACE_REPORT) {
      process.stdout.write(
        [
          '',
          'Optimiste (peu de Seuil, gros dégâts) :',
          ...asReport('nôtre', oursOptimistic),
          ...asReport('réelle', realOptimistic),
          '',
          'Pessimiste (beaucoup de Seuil, petits dégâts) :',
          ...asReport('nôtre', oursPessimistic),
          ...asReport('réelle', realPessimistic),
          ''
        ].join('\n')
      );
    }

    // D-023, tenu par le code : le Seuil du module **est** la bande du miroir, stade par
    // stade. L'écart de rythme qui suit ne vient donc pas du Seuil, mais des dégâts par café.
    expect(OUR_CURVE.map((profile) => profile.hp)).toEqual(REAL_CURVE.map((profile) => profile.hp));

    const deltas = realOptimistic.map((row, index) => ({
      profil: row.profil,
      optimiste: row.tours - (oursOptimistic[index]?.tours ?? 0),
      pessimiste: (realPessimistic[index]?.tours ?? 0) - (oursPessimistic[index]?.tours ?? 0)
    }));

    // La bande de dégâts du module est plus large que celle, indicative, du miroir : nos
    // profils ne sont donc jamais **plus lents**. Un écart positif = nous jouons plus vite.
    for (const delta of deltas) {
      expect(delta.optimiste, `${delta.profil} (optimiste)`).toBeGreaterThanOrEqual(0);
      expect(delta.pessimiste, `${delta.profil} (pessimiste)`).toBeGreaterThanOrEqual(0);
    }

    // L'écart reste borné à 3 tours, et ne touche qu'un profil par lecture : Entrant en
    // optimiste (2 frappes contre 3), N+1 en pessimiste (3 contre 4). Rien sur N+2 ni COMEX.
    expect(deltas.filter((delta) => delta.optimiste > 0).map((delta) => delta.profil)).toEqual(['Entrant → Entrant']);
    expect(deltas.filter((delta) => delta.pessimiste > 0).map((delta) => delta.profil)).toEqual(['N+1 → N+1']);
    expect(Math.max(...deltas.map((delta) => delta.optimiste)), 'écart optimiste').toBe(3);
    expect(Math.max(...deltas.map((delta) => delta.pessimiste)), 'écart pessimiste').toBe(3);
  });
});
