import { describe, expect, it } from 'vitest';
import { courbeDeck, coutDuPlanque } from './courbe-deck';
import { ALL_CARDS, getCard, isPlanque } from '@/data';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import { deckCards } from '@/game/deck';
import type { Card, PlanqueCard } from '@/data/types';

const planque = (id: string): PlanqueCard => {
  const card = getCard(id);
  if (!card || !isPlanque(card)) throw new Error(`pas un Planqué : ${id}`);
  return card;
};

describe('courbeDeck — la courbe de coût (#364)', () => {
  it('compte un Deck connu : coup-de-marteau donne 8, 10 et 0 cartes aux coûts 1, 2 et 3', () => {
    const deck = DECKS_PROPOSES.find((d) => d.id === 'coup-de-marteau');
    expect(deck).toBeDefined();
    const courbe = courbeDeck(deckCards([...deck!.cartes]));

    expect(courbe.barres).toEqual([
      { cout: 1, cartes: 8 },
      { cout: 2, cartes: 10 },
      { cout: 3, cartes: 0 }
    ]);
    expect(courbe.plusHaute).toBe(10);
    expect(courbe.zero).toEqual([]);
    // Les cartes Action ne paient pas de café : elles sont comptées à part, pas dans les barres.
    expect(courbe.actions).toBe(2);
    expect(courbe.barres.reduce((n, b) => n + b.cartes, 0) + courbe.actions).toBe(deck!.cartes.length);
  });

  it('prend la Pression la moins chère d’un Planqué (un Planqué à deux Pressions compte une fois)', () => {
    const card = ALL_CARDS.filter(isPlanque).find((c) => c.attacks.length > 1);
    expect(card).toBeDefined();
    const cheapest = Math.min(...card!.attacks.map((a) => a.cost.length));
    expect(coutDuPlanque(card!)).toBe(cheapest);
  });

  it('le contrôle mord : un Planqué à coût 0 est nommé à part et ne gonfle pas la barre du coût 1', () => {
    // Un Planqué de catalogue, à qui on retire son coût : le cas fautif qu'une courbe qui
    // rangerait le coût 0 dans la barre 1 ferait passer pour un coût 1.
    const base = planque('sse-infirmier-site');
    const gratuit: PlanqueCard = { ...base, attacks: [{ name: 'Pression gratuite', cost: [], damage: 10 }] };
    const courbe = courbeDeck([gratuit as Card]);

    expect(courbe.zero).toEqual([base.name]);
    expect(courbe.barres.find((b) => b.cout === 1)?.cartes).toBe(0);
    expect(courbe.plusHaute).toBe(0);
  });

  it('un Deck vide donne une courbe vide, sans barre haute', () => {
    const courbe = courbeDeck([]);
    expect(courbe.plusHaute).toBe(0);
    expect(courbe.zero).toEqual([]);
    expect(courbe.actions).toBe(0);
  });
});
