import { describe, expect, it } from 'vitest';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import type { DeckPropose } from '@/data/decks-proposes';
import { deckLegal } from '@/game/deck';
import { DIFFICULTE_PAR_DEFAUT, POLITIQUE_DE_DIFFICULTE } from '@/game/ia';
import {
  DECK_DE_LA_DIRECTION,
  deckDeLaDirection,
  reglageDirection,
  REGLAGE_DIRECTION_PAR_DEFAUT
} from '@/game/deck-direction';

describe('Deck de la Direction par difficulté (#251, D-149)', () => {
  it('Simple et Sérieuse jouent deux Decks différents, tous deux proposés', () => {
    expect(deckDeLaDirection('simple').id).not.toBe(deckDeLaDirection('serieuse').id);
    for (const difficulte of ['simple', 'serieuse'] as const) {
      expect(DECKS_PROPOSES).toContain(deckDeLaDirection(difficulte));
    }
  });

  it('Simple joue le Deck le plus faible (milieu), Sérieuse le plus solide (agressif)', () => {
    expect(deckDeLaDirection('simple').archetype).toBe('milieu');
    expect(deckDeLaDirection('serieuse').archetype).toBe('agressif');
  });

  it('chaque difficulté joue sa politique (D-146) et son Deck : le réglage les lit ensemble', () => {
    for (const difficulte of ['simple', 'serieuse'] as const) {
      const reglage = reglageDirection(difficulte);
      expect(reglage.politique).toBe(POLITIQUE_DE_DIFFICULTE[difficulte]);
      expect(reglage.deck).toBe(deckDeLaDirection(difficulte));
    }
  });

  it('le défaut est Sérieuse (D-084, D-146) : rien ne change tant qu’on ne règle pas', () => {
    expect(DIFFICULTE_PAR_DEFAUT).toBe('serieuse');
    expect(REGLAGE_DIRECTION_PAR_DEFAUT.deck.id).toBe(DECK_DE_LA_DIRECTION.serieuse);
  });

  it('les Decks de la Direction sont légaux (20 cartes, deux au plus par nom, un Entrant)', () => {
    for (const difficulte of ['simple', 'serieuse'] as const) {
      const deck: DeckPropose = deckDeLaDirection(difficulte);
      expect(deckLegal([...deck.cartes]).ok).toBe(true);
    }
  });

  it('le contrôle mord : un Deck qui a une carte de trop est refusé', () => {
    const trop = [...deckDeLaDirection('serieuse').cartes, deckDeLaDirection('serieuse').cartes[0]];
    expect(deckLegal(trop).ok).toBe(false);
  });

  it('le contrôle mord : une table qui fait jouer le même Deck aux deux niveaux est refusée', () => {
    const memes = new Set([DECK_DE_LA_DIRECTION.simple, DECK_DE_LA_DIRECTION.serieuse]);
    expect(memes.size).toBe(2);
  });
});
