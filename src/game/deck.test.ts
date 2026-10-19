import { describe, expect, it } from 'vitest';
import { ALL_ACTION_CARDS, ALL_CARDS, getCard, isBasic, isPlanque } from '@/data';
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

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map(
  (card) => card.id
);

/** Chariot légal : 10 noms N+1 en double. */
const LEGAL_DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

describe('deckLegal — Chariot', () => {
  it('accepte 20 cartes, 2 exemplaires max, au moins un Entrant', () => {
    const result = deckLegal(LEGAL_DECK);
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('refuse un Chariot de 19 cartes', () => {
    const result = deckLegal(LEGAL_DECK.slice(0, DECK_SIZE - 1));
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([
      `Le Chariot doit contenir ${DECK_SIZE} cartes (${DECK_SIZE - 1}/${DECK_SIZE}).`
    ]);
  });

  it('refuse un Chariot de 21 cartes', () => {
    // 10 noms en double + un onzième nom : 21 cartes, aucun autre motif de refus.
    const deck = [...BASICS.slice(0, 10), ...BASICS.slice(0, 11)];
    expect(deck).toHaveLength(DECK_SIZE + 1);

    const result = deckLegal(deck);
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([
      `Le Chariot doit contenir ${DECK_SIZE} cartes (${DECK_SIZE + 1}/${DECK_SIZE}).`
    ]);
  });

  it('refuse un Chariot vide', () => {
    const result = deckLegal([]);
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain(`Le Chariot doit contenir ${DECK_SIZE} cartes (0/${DECK_SIZE}).`);
    expect(result.reasons).toContain('Il faut au moins un Planqué Entrant.');
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

  it('accepte une carte Action au Chariot, sans compter comme Entrant', () => {
    const [objet] = ALL_ACTION_CARDS;
    if (!objet) throw new Error('aucune carte Action');
    expect(deckCanAdd([], objet.id)).toBe(true);

    const deck = [objet.id, ...LEGAL_DECK].slice(0, DECK_SIZE);
    expect(deck).toHaveLength(DECK_SIZE);
    expect(deckCards(deck).map((card) => card.id)).toContain(objet.id);
    expect(deckLegal(deck).ok, deckLegal(deck).reasons.join(' ')).toBe(true);
  });

  it('refuse un Chariot de cartes Action sans aucun Planqué Entrant', () => {
    const actions = ALL_ACTION_CARDS.map((card) => card.id);
    const deck = [...actions, ...actions].slice(0, DECK_SIZE);
    expect(deck).toHaveLength(DECK_SIZE);

    expect(deckLegal(deck).reasons).toEqual(['Il faut au moins un Planqué Entrant.']);
  });

  it('refuse un Chariot sans Planqué Entrant', () => {
    const evolutions = ALL_CARDS.filter(
      (card) => isPlanque(card) && !card.variantOf && card.stage !== 'ENTRANT'
    ).map((card) => card.id);
    const deck = [...evolutions, ...evolutions].slice(0, DECK_SIZE);
    expect(deck).toHaveLength(DECK_SIZE);

    const result = deckLegal(deck);
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual(['Il faut au moins un Planqué Entrant.']);
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

  it('refuse un Chariot où 2 exemplaires + 2 variantes dépassent le plafond par nom', () => {
    const base = 'sse-psychologue';
    const variant = 'sse-psychologue-star2';
    const deck = [base, base, variant, variant, ...LEGAL_DECK].slice(0, DECK_SIZE);
    expect(deckLegal(deck).reasons).toContain(
      `Maximum ${MAX_COPIES_PER_NAME} exemplaires du même nom.`
    );
  });
});

describe('autoDeck — remplissage rapide', () => {
  it('produit un Chariot légal de 20 cartes avec ce qu’on possède', () => {
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
    const stages = deck.map((id) => {
      const card = getCard(id);
      return isPlanque(card) ? card.stage : undefined;
    });
    expect(stages.filter((stage) => stage === 'ENTRANT').length).toBeGreaterThan(0);
    // Chaque évolution présente a sa base dans le même Chariot.
    for (const id of deck) {
      const card = getCard(id);
      if (card && isPlanque(card) && card.evolvesFrom) expect(deck).toContain(card.evolvesFrom);
    }
  });

  it('annonce ce qui manque quand le Parc est trop pauvre', () => {
    const owned = { [BASICS[0]]: 1 };
    const { deck, missing } = autoDeck(owned);
    expect(deck).toEqual([BASICS[0]]);
    expect(missing).toBe(DECK_SIZE - 1);
  });
});
