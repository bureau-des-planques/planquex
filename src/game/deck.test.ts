import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard } from '@/data';
import {
  autoDeck,
  DECK_SIZE,
  MAX_COPIES_PER_NAME,
  deckCanAdd,
  deckCards,
  deckCounts,
  deckCountsByName,
  deckLegal
} from '@/game/deck';

const BASICS = ALL_CARDS.filter((card) => !card.variantOf && card.stage === 'N+1').map((card) => card.id);

/** Classeur légal : 10 noms N+1 en double. */
const LEGAL_DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

describe('deckLegal — Classeur', () => {
  it('accepte 20 cartes, 2 exemplaires max, au moins un N+1', () => {
    const result = deckLegal(LEGAL_DECK);
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('refuse un classeur de 19 cartes', () => {
    const result = deckLegal(LEGAL_DECK.slice(0, DECK_SIZE - 1));
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([
      `Le classeur doit contenir ${DECK_SIZE} cartes (${DECK_SIZE - 1}/${DECK_SIZE}).`
    ]);
  });

  it('refuse un classeur de 21 cartes', () => {
    // 10 noms en double + un onzième nom : 21 cartes, aucun autre motif de refus.
    const deck = [...BASICS.slice(0, 10), ...BASICS.slice(0, 11)];
    expect(deck).toHaveLength(DECK_SIZE + 1);

    const result = deckLegal(deck);
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([
      `Le classeur doit contenir ${DECK_SIZE} cartes (${DECK_SIZE + 1}/${DECK_SIZE}).`
    ]);
  });

  it('refuse un classeur vide', () => {
    const result = deckLegal([]);
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain(`Le classeur doit contenir ${DECK_SIZE} cartes (0/${DECK_SIZE}).`);
    expect(result.reasons).toContain('Il faut au moins un Planqué N+1.');
  });

  it('refuse plus de 2 exemplaires du même nom', () => {
    const deck = [BASICS[0], BASICS[0], BASICS[0], ...LEGAL_DECK].slice(0, DECK_SIZE);
    expect(deckLegal(deck).reasons).toContain(`Maximum ${MAX_COPIES_PER_NAME} exemplaires du même nom.`);
  });

  it('refuse 3 exemplaires du même nom répartis sur la base et une variante', () => {
    const base = 'sse-psychologue';
    const variant = 'sse-psychologue-star2';
    const filler = BASICS.filter((id) => getCard(id)?.name !== getCard(base)?.name);
    const deck = [base, base, variant, ...filler.slice(0, 9), ...filler.slice(0, 8)];
    expect(deck).toHaveLength(DECK_SIZE);

    const result = deckLegal(deck);
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([`Maximum ${MAX_COPIES_PER_NAME} exemplaires du même nom.`]);
  });

  it('accepte 2 exemplaires du même nom répartis sur la base et une variante', () => {
    const base = 'sse-psychologue';
    const variant = 'sse-psychologue-star2';
    const filler = BASICS.filter((id) => getCard(id)?.name !== getCard(base)?.name);
    const deck = [base, variant, ...filler.slice(0, 9), ...filler.slice(0, 9)];
    expect(deck).toHaveLength(DECK_SIZE);

    expect(deckLegal(deck)).toEqual({ ok: true, reasons: [] });
  });

  it('refuse un classeur sans Planqué N+1', () => {
    const evolutions = ALL_CARDS.filter((card) => !card.variantOf && card.stage !== 'N+1').map((card) => card.id);
    const deck = [...evolutions, ...evolutions].slice(0, DECK_SIZE);
    expect(deck).toHaveLength(DECK_SIZE);

    const result = deckLegal(deck);
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual(['Il faut au moins un Planqué N+1.']);
  });

  it('compte les exemplaires par nom et résout les cartes', () => {
    expect(deckCounts([BASICS[0], BASICS[0], BASICS[1]])).toEqual({ [BASICS[0]]: 2, [BASICS[1]]: 1 });
    expect(deckCards([BASICS[0], 'identifiant-inconnu'])).toHaveLength(1);
  });

  it('compte par nom : une variante compte comme sa carte de base', () => {
    const base = 'sse-psychologue';
    const variant = 'sse-psychologue-star2';
    const name = getCard(base)?.name ?? '';
    expect(deckCountsByName([base, variant])[name]).toBe(2);
    expect(deckCanAdd([base, variant], variant)).toBe(false);
  });

  it('refuse un classeur où 2 exemplaires + 2 variantes dépassent le plafond par nom', () => {
    const base = 'sse-psychologue';
    const variant = 'sse-psychologue-star2';
    const deck = [base, base, variant, variant, ...LEGAL_DECK].slice(0, DECK_SIZE);
    expect(deckLegal(deck).reasons).toContain(
      `Maximum ${MAX_COPIES_PER_NAME} exemplaires du même nom.`
    );
  });
});

describe('autoDeck — remplissage rapide', () => {
  it('produit un classeur légal de 20 cartes avec ce qu’on possède', () => {
    const owned: Record<string, number> = {};
    for (const card of ALL_CARDS) owned[card.id] = 1;

    const { deck, missing } = autoDeck(owned);

    expect(missing).toBe(0);
    expect(deck).toHaveLength(DECK_SIZE);
    expect(deckLegal(deck).ok, deckLegal(deck).reasons.join(' ')).toBe(true);
  });

  it('privilégie les bases et les évolutions de bases déjà présentes', () => {
    const owned: Record<string, number> = {};
    for (const card of ALL_CARDS) owned[card.id] = 1;

    const { deck } = autoDeck(owned);
    const stages = deck.map((id) => getCard(id)?.stage);
    expect(stages.filter((stage) => stage === 'N+1').length).toBeGreaterThan(0);
    // Chaque évolution présente a sa base dans le même classeur.
    for (const id of deck) {
      const card = getCard(id);
      if (card?.evolvesFrom) expect(deck).toContain(card.evolvesFrom);
    }
  });

  it('annonce ce qui manque quand la collection est trop pauvre', () => {
    const owned = { [BASICS[0]]: 1 };
    const { deck, missing } = autoDeck(owned);
    expect(deck).toEqual([BASICS[0]]);
    expect(missing).toBe(DECK_SIZE - 1);
  });
});
