import { describe, expect, it } from 'vitest';

/**
 * Modèle de **rythme** : combien de tours pour prendre 3 Interventions.
 *
 * Ce n'est pas une simulation de parties — le moteur n'a pas d'IA et l'objectif
 * d'O-011 est de chiffrer l'effet du **Seuil** sur la durée d'une partie, pas de
 * jouer. Hypothèses, toutes explicites :
 *
 * - 1 café généré par tour, **non consommé** par la Pression (§4) : l'attaquant
 *   attaque donc à chaque tour dès qu'il a atteint le coût de son attaque ;
 * - l'attaquant joue toujours sa meilleure attaque, définie par la bande
 *   « dégâts indicatifs » de `CARD-SPEC.md` §2 ;
 * - le défenseur ne fait rien : pas de soin, pas de statut, pas de relève ;
 * - 1 Prime par K.O. (cas le plus défavorable au rythme) ;
 * - l'adversaire aligne le même profil à chaque K.O.
 *
 * Lancer `PACE_REPORT=1 npx vitest run src/game/pace.test.ts` pour afficher le
 * tableau complet ; `npm test` ne vérifie que la conclusion.
 */

interface Profile {
  label: string;
  /** Seuil du défenseur, bande basse et haute. */
  hp: [number, number];
  /** Dégâts de l'attaquant, bande basse et haute. */
  damage: [number, number];
  /** Coût de son attaque, en cafés. */
  cost: number;
}

/** Notre courbe (`CARD-SPEC.md` §2) et celle du jeu réel (relevée le 19/10/2026). */
const OUR_CURVE: Profile[] = [
  { label: 'Entrant → Entrant', hp: [60, 70], damage: [10, 20], cost: 1 },
  { label: 'N+1 → N+1', hp: [80, 100], damage: [30, 50], cost: 2 },
  { label: 'N+2 → N+2', hp: [120, 140], damage: [50, 80], cost: 2 },
  { label: 'COMEX → COMEX', hp: [140, 170], damage: [70, 120], cost: 3 }
];

const REAL_CURVE: Profile[] = [
  { label: 'Entrant → Entrant', hp: [50, 80], damage: [10, 20], cost: 1 },
  { label: 'N+1 → N+1', hp: [90, 120], damage: [30, 50], cost: 2 },
  { label: 'N+2 → N+2', hp: [140, 160], damage: [50, 80], cost: 2 },
  { label: 'COMEX → COMEX', hp: [170, 190], damage: [70, 120], cost: 3 }
];

const PRIZES = 3;

/** Frappes nécessaires pour un K.O. — hypothèse optimiste (peu de Seuil, gros dégâts). */
const hitsOptimistic = (p: Profile) => Math.ceil(p.hp[0] / p.damage[1]);
/** Frappes nécessaires pour un K.O. — hypothèse pessimiste (beaucoup de Seuil, petits dégâts). */
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
  rows.map((row) => `${name.padEnd(7)} ${row.profil.padEnd(14)} ${row.frappesParKO} frappe(s)/K.O.  ${row.tours} tours`);

describe('O-011 — effet du Seuil sur le rythme', () => {
  it('chiffre le coût en tours de la courbe du jeu réel', () => {
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

    const deltas = realOptimistic.map((row, index) => ({
      profil: row.profil,
      optimiste: row.tours - (oursOptimistic[index]?.tours ?? 0),
      pessimiste: (realPessimistic[index]?.tours ?? 0) - (oursPessimistic[index]?.tours ?? 0)
    }));

    // Dans la lecture optimiste, les deux courbes ont exactement le même rythme :
    // le Seuil réel ne franchit aucun palier de frappes.
    for (const delta of deltas) {
      expect(delta.optimiste, `${delta.profil} (optimiste)`).toBe(0);
    }

    // Dans la lecture pessimiste, la courbe réelle coûte au plus 3 tours, et
        // seulement là où elle franchit un palier : Entrant (7 → 8 frappes) et COMEX
    // (3 → 4 frappes). N+1 et N+2 ne bougent pas.
    const worst = Math.max(...deltas.map((delta) => delta.pessimiste));
    expect(worst, 'pire écart en tours').toBe(3);
    const moved = deltas.filter((delta) => delta.pessimiste > 0).map((delta) => delta.profil);
    expect(moved).toEqual(['Entrant → Entrant', 'N+2 → N+2']);
  });
});
