import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/data';
import { deckCards, deckCounts, deckLegal } from '@/store/useStore';

const BASICS = ALL_CARDS.filter((card) => !card.variantOf && card.stage === 'N+1').map((card) => card.id);

/** 20 cartes légales : 10 noms N+1 en double. */
const LEGAL_DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

describe('deckLegal — Classeur', () => {
  it('accepte 20 cartes, 2 exemplaires max, au moins un N+1', () => {
    const result = deckLegal(LEGAL_DECK);
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('refuse un classeur qui ne fait pas 20 cartes', () => {
    const result = deckLegal(LEGAL_DECK.slice(0, 19));
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain('20 cartes');
  });

  it('refuse plus de 2 exemplaires du même nom', () => {
    const deck = [BASICS[0], BASICS[0], BASICS[0], ...LEGAL_DECK].slice(0, 20);
    expect(deckLegal(deck).reasons).toContain('Maximum 2 exemplaires du même nom.');
  });

  it('refuse un classeur sans Planqué N+1', () => {
    const evolutions = ALL_CARDS.filter((card) => !card.variantOf && card.stage !== 'N+1').map((card) => card.id);
    const deck = [...evolutions, ...evolutions].slice(0, 20);
    expect(deckLegal(deck).reasons).toContain('Il faut au moins un Planqué N+1.');
  });

  it('compte les exemplaires et résout les cartes', () => {
    expect(deckCounts([BASICS[0], BASICS[0], BASICS[1]])).toEqual({ [BASICS[0]]: 2, [BASICS[1]]: 1 });
    expect(deckCards([BASICS[0], 'identifiant-inconnu'])).toHaveLength(1);
  });
});
