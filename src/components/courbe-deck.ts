import { ALL_CARDS, isPlanque } from '@/data';
import type { Card, PlanqueCard } from '@/data/types';

/**
 * La courbe de coût d'un Deck (#364) — pure : pas de React, pas de store.
 *
 * C'est une **lecture**, jamais une règle : elle ne touche ni la légalité (`@/game/deck`), ni
 * le moteur. Elle répond à une seule question : à quelle vitesse ce Deck peut-il démarrer ?
 *
 * Le coût d'un Planqué est le coût de **sa Pression la moins chère** : c'est ce qu'il peut
 * faire le plus tôt. Une carte Action ne paie pas de café : elle n'entre pas dans la courbe,
 * elle est comptée à part.
 */

export interface BarreCourbe {
  /** Le nombre de cafés (1, 2, 3…). Le coût 0 n'a pas de barre : il est nommé à part. */
  cout: number;
  /** Les Planqués dont la Pression la moins chère coûte `cout` cafés. */
  cartes: number;
}

export interface CourbeDeck {
  /** Une barre par coût de 1 à `coutMax`, même vide : la courbe garde ses marches. */
  barres: BarreCourbe[];
  /** Le plus grand nombre de cartes d'une barre (0 si le Deck est vide) : l'échelle. */
  plusHaute: number;
  /** Les Planqués à coût 0, **nommés** (D-039 : le code l'autorise, aucune carte ne le porte). */
  zero: string[];
  /** Les cartes Action : elles ne paient pas de café, elles ne sont pas dans la courbe. */
  actions: number;
}

/** Le coût le plus élevé du catalogue : la courbe va de 1 à ce nombre de cafés. */
export const COUT_MAX_CATALOGUE: number = Math.max(
  1,
  ...ALL_CARDS.filter(isPlanque).flatMap((card) => card.attacks.map((attaque) => attaque.cost.length))
);

/** Le coût en café d'un Planqué : celui de sa Pression la moins chère. */
export function coutDuPlanque(card: PlanqueCard): number {
  if (card.attacks.length === 0) return 0;
  return Math.min(...card.attacks.map((attaque) => attaque.cost.length));
}

/**
 * Compte les cartes du Deck par coût. `cartes` est le Deck **résolu** (`deckCards`) : chaque
 * exemplaire compte, comme dans la main — deux exemplaires = deux barres de plus.
 */
export function courbeDeck(cartes: readonly Card[]): CourbeDeck {
  const compte = new Map<number, number>();
  const zero: string[] = [];
  let actions = 0;

  for (const card of cartes) {
    if (!isPlanque(card)) {
      actions += 1;
      continue;
    }
    const cout = coutDuPlanque(card);
    if (cout === 0) {
      zero.push(card.name);
      continue;
    }
    compte.set(cout, (compte.get(cout) ?? 0) + 1);
  }

  const barres: BarreCourbe[] = [];
  for (let cout = 1; cout <= COUT_MAX_CATALOGUE; cout += 1) {
    barres.push({ cout, cartes: compte.get(cout) ?? 0 });
  }
  const plusHaute = barres.reduce((max, barre) => Math.max(max, barre.cartes), 0);

  return { barres, plusHaute, zero, actions };
}
