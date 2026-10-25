import { describe, expect, it } from 'vitest';
import { getCard, isBasic } from '@/data';
import { CHARIOTS } from '@/data/chariots';
import type { Chariot } from '@/data/chariots';
import { deckLegal, normalizeCafeTypes } from '@/game/deck';
import { createBattle } from '@/game/engine';
import { factionCafeTypes, factionDeck, playGameWithStats } from '@/game/simulation';

/** Un Chariot « fautif » par construction : les gardes ci-dessous doivent le refuser. */
const FAUTIF: Chariot = { ...CHARIOTS[0], cartes: [...CHARIOTS[0].cartes.slice(0, 19), CHARIOTS[0].cartes[0]] };

/** Les problèmes d'un Chariot, vide s'il est sain. */
function problemes(chariot: Chariot): string[] {
  const out: string[] = [];
  const legal = deckLegal([...chariot.cartes]);
  if (!legal.ok) out.push(...legal.reasons);
  for (const id of chariot.cartes) {
    const card = getCard(id);
    if (!card) out.push(`carte inconnue : ${id}`);
    else if (card.variantOf) out.push(`variante dans un Chariot : ${id}`);
  }
  const types = normalizeCafeTypes([...chariot.cafeTypes]);
  if (types.length === 0 || types.length !== chariot.cafeTypes.length) {
    out.push('types de café non productibles ou hors plafond');
  }
  return out;
}

describe('Chariots proposés (#141)', () => {
  it('couvre chaque vivier : Atelier, Étage, Bureaux', () => {
    const viviers = new Set(CHARIOTS.map((chariot) => chariot.vivier));
    for (const vivier of ['ATELIER', 'ETAGE', 'BUREAUX']) expect(viviers.has(vivier as never)).toBe(true);
  });

  it('en propose cinq, aux identifiants uniques (D-069)', () => {
    expect(CHARIOTS).toHaveLength(5);
    expect(new Set(CHARIOTS.map((chariot) => chariot.id)).size).toBe(5);
  });

  it('le contrôle mord : un Chariot à 3 exemplaires du même nom est refusé', () => {
    expect(problemes(FAUTIF).join(' ')).toContain('exemplaires');
  });

  it.each(CHARIOTS.map((chariot) => [chariot.id, chariot] as const))(
    '%s est légal, composé de cartes de base du catalogue',
    (_id, chariot) => {
      expect(problemes(chariot)).toEqual([]);
    }
  );

  it.each(CHARIOTS.map((chariot) => [chariot.id, chariot] as const))(
    '%s porte sa stratégie et sa faiblesse, en une phrase chacune',
    (_id, chariot) => {
      for (const phrase of [chariot.strategie, chariot.faiblesse]) {
        expect(phrase.trim().length).toBeGreaterThan(10);
        expect(phrase.match(/[.!?](\s|$)/g)?.length ?? 0).toBe(1);
      }
    }
  );

  it.each(CHARIOTS.map((chariot) => [chariot.id, chariot] as const))(
    '%s ouvre sur un Entrant au Poste et ses types de café, sur 30 graines',
    (_id, chariot) => {
      const adversaire = factionDeck('SSE');
      for (let seed = 1; seed <= 30; seed += 1) {
        const state = createBattle([...chariot.cartes], adversaire, seed, {
          playerCafeTypes: chariot.cafeTypes
        });
        // Le moteur pose les Entrants à l'ouverture (`setupPlayer`) : ils sont au Poste, plus en main.
        const poste = state.players.player.active;
        expect(isBasic(poste ? getCard(poste.cardId) : undefined), `graine ${seed}`).toBe(true);
        expect(state.players.player.cafeTypes, `graine ${seed}`).toEqual([...chariot.cafeTypes]);
      }
    }
  );

  it.each(CHARIOTS.map((chariot) => [chariot.id, chariot] as const))(
    '%s fonctionne : il lance des Pressions en simulation seedée',
    (_id, chariot) => {
      const adversaire = factionDeck('SSE');
      let pressions = 0;
      for (let seed = 1; seed <= 10; seed += 1) {
        const { attacks } = playGameWithStats(
          [...chariot.cartes],
          adversaire,
          seed,
          200,
          {},
          { playerCafeTypes: chariot.cafeTypes, aiCafeTypes: factionCafeTypes('SSE') }
        );
        pressions += attacks.player;
      }
      expect(pressions).toBeGreaterThan(0);
    }
  );
});
