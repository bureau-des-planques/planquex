import { describe, expect, it } from 'vitest';
import { courbeDeck, coutDuPlanque } from './courbe-deck';
import { ALL_CARDS, isPlanque } from '@/data';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import { deckCards } from '@/game/deck';

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

  it('un Deck vide donne une courbe vide, sans barre haute', () => {
    const courbe = courbeDeck([]);
    expect(courbe.plusHaute).toBe(0);
    expect(courbe.actions).toBe(0);
  });
});
