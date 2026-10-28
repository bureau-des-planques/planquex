import { describe, expect, it } from 'vitest';
import { getCard, isBasic } from '@/data';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import type { DeckPropose } from '@/data/decks-proposes';
import { deckLegal, normalizeCafeTypes } from '@/game/deck';
import { createBattle } from '@/game/engine';
import { factionCafeTypes, factionDeck, playGameWithStats } from '@/game/simulation';

/** Un Deck proposé « fautif » par construction : les gardes ci-dessous doivent le refuser. */
const FAUTIF: DeckPropose = { ...DECKS_PROPOSES[0], cartes: [...DECKS_PROPOSES[0].cartes.slice(0, 19), DECKS_PROPOSES[0].cartes[0]] };

/** Les problèmes d'un Deck proposé, vide s'il est sain. */
function problemes(deckPropose: DeckPropose): string[] {
  const out: string[] = [];
  const legal = deckLegal([...deckPropose.cartes]);
  if (!legal.ok) out.push(...legal.reasons);
  for (const id of deckPropose.cartes) {
    const card = getCard(id);
    if (!card) out.push(`carte inconnue : ${id}`);
    else if (card.variantOf) out.push(`variante dans un Deck proposé : ${id}`);
  }
  const types = normalizeCafeTypes([...deckPropose.cafeTypes]);
  if (types.length === 0 || types.length !== deckPropose.cafeTypes.length) {
    out.push('types de café non productibles ou hors plafond');
  }
  return out;
}

describe('Decks proposés (#141)', () => {
  it('couvre chaque vivier : Atelier, Étage, Bureaux', () => {
    const viviers = new Set(DECKS_PROPOSES.map((deckPropose) => deckPropose.vivier));
    for (const vivier of ['ATELIER', 'ETAGE', 'BUREAUX']) expect(viviers.has(vivier as never)).toBe(true);
  });

  it('en propose cinq au joueur, aux identifiants uniques (D-069, D-149)', () => {
    expect(DECKS_PROPOSES).toHaveLength(5);
    expect(new Set(DECKS_PROPOSES.map((deckPropose) => deckPropose.id)).size).toBe(5);
  });

  it('trois portent un archétype, un de chaque : agressif, contrôle, milieu (D-125 (3), D-149)', () => {
    const archetypes = DECKS_PROPOSES.flatMap((deckPropose) => (deckPropose.archetype ? [deckPropose.archetype] : []));
    expect(archetypes.sort()).toEqual(['agressif', 'controle', 'milieu']);
  });

  it('le contrôle mord : un Deck proposé à 21 cartes est refusé', () => {
    const trop: DeckPropose = { ...DECKS_PROPOSES[0], cartes: [...DECKS_PROPOSES[0].cartes, DECKS_PROPOSES[0].cartes[0]] };
    expect(problemes(trop).join(' ')).toContain('20 cartes');
  });

  it('le contrôle mord : un Deck proposé à 3 exemplaires du même nom est refusé', () => {
    expect(problemes(FAUTIF).join(' ')).toContain('exemplaires');
  });

  it.each(DECKS_PROPOSES.map((deckPropose) => [deckPropose.id, deckPropose] as const))(
    '%s est légal, composé de cartes de base du catalogue',
    (_id, deckPropose) => {
      expect(problemes(deckPropose)).toEqual([]);
    }
  );

  it.each(DECKS_PROPOSES.map((deckPropose) => [deckPropose.id, deckPropose] as const))(
    '%s porte sa stratégie et sa faiblesse, en une phrase chacune',
    (_id, deckPropose) => {
      for (const phrase of [deckPropose.strategie, deckPropose.faiblesse]) {
        expect(phrase.trim().length).toBeGreaterThan(10);
        expect(phrase.match(/[.!?](\s|$)/g)?.length ?? 0).toBe(1);
      }
    }
  );

  it.each(DECKS_PROPOSES.map((deckPropose) => [deckPropose.id, deckPropose] as const))(
    '%s ouvre sur un Entrant au Poste et ses types de café, sur 30 graines',
    (_id, deckPropose) => {
      const adversaire = factionDeck('SSE');
      for (let seed = 1; seed <= 30; seed += 1) {
        const state = createBattle([...deckPropose.cartes], adversaire, seed, {
          playerCafeTypes: deckPropose.cafeTypes
        });
        // Le moteur pose les Entrants à l'ouverture (`setupPlayer`) : ils sont au Poste, plus en main.
        const poste = state.players.player.active;
        expect(isBasic(poste ? getCard(poste.cardId) : undefined), `graine ${seed}`).toBe(true);
        expect(state.players.player.cafeTypes, `graine ${seed}`).toEqual([...deckPropose.cafeTypes]);
      }
    }
  );

  it.each(DECKS_PROPOSES.map((deckPropose) => [deckPropose.id, deckPropose] as const))(
    '%s fonctionne : il lance des Pressions en simulation seedée',
    (_id, deckPropose) => {
      const adversaire = factionDeck('SSE');
      let pressions = 0;
      for (let seed = 1; seed <= 10; seed += 1) {
        const { attacks } = playGameWithStats(
          [...deckPropose.cartes],
          adversaire,
          seed,
          200,
          {},
          { playerCafeTypes: deckPropose.cafeTypes, aiCafeTypes: factionCafeTypes('SSE') }
        );
        pressions += attacks.player;
      }
      expect(pressions).toBeGreaterThan(0);
    }
  );
});
