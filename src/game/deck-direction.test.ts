import { describe, expect, it } from 'vitest';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import type { DeckPropose } from '@/data/decks-proposes';
import { deckLegal } from '@/game/deck';
import { DIFFICULTE_PAR_DEFAUT, DIFFICULTES, POLITIQUE_DE_DIFFICULTE } from '@/game/ia';
import {
  DECK_DE_LA_DIRECTION,
  deckDeLaDirection,
  reglageDirection,
  REGLAGE_DIRECTION_PAR_DEFAUT
} from '@/game/deck-direction';

describe('Deck de la Direction par difficulté (#251, D-145, D-149)', () => {
  it('les trois crans jouent trois Decks différents, tous proposés', () => {
    expect(new Set(DIFFICULTES.map((cran) => deckDeLaDirection(cran).id)).size).toBe(DIFFICULTES.length);
    for (const cran of DIFFICULTES) {
      expect(DECKS_PROPOSES).toContain(deckDeLaDirection(cran));
    }
  });

  it('un Deck par archétype, du plus faible au plus solide (D-149)', () => {
    expect(deckDeLaDirection('facile').archetype).toBe('milieu');
    expect(deckDeLaDirection('normal').archetype).toBe('controle');
    expect(deckDeLaDirection('difficile').archetype).toBe('agressif');
  });

  it('chaque difficulté joue sa politique (D-145) et son Deck : le réglage les lit ensemble', () => {
    for (const cran of DIFFICULTES) {
      const reglage = reglageDirection(cran);
      expect(reglage.politique).toBe(POLITIQUE_DE_DIFFICULTE[cran]);
      expect(reglage.deck).toBe(deckDeLaDirection(cran));
    }
  });

  it('le défaut est Normal (D-084, D-145) : rien ne change tant qu’on ne règle pas', () => {
    expect(DIFFICULTE_PAR_DEFAUT).toBe('normal');
    expect(REGLAGE_DIRECTION_PAR_DEFAUT.deck.id).toBe(DECK_DE_LA_DIRECTION.normal);
    expect(REGLAGE_DIRECTION_PAR_DEFAUT.politique).toBe('recherche');
  });

  it('les Decks de la Direction sont légaux (20 cartes, deux au plus par nom, un Entrant)', () => {
    for (const cran of DIFFICULTES) {
      const deck: DeckPropose = deckDeLaDirection(cran);
      expect(deckLegal([...deck.cartes]).ok).toBe(true);
    }
  });

  it('le contrôle mord : un Deck qui a une carte de trop est refusé', () => {
    const trop = [...deckDeLaDirection('difficile').cartes, deckDeLaDirection('difficile').cartes[0]];
    expect(deckLegal(trop).ok).toBe(false);
  });

  it('le contrôle mord : une table qui fait jouer le même Deck à deux crans est refusée', () => {
    const memes = new Set(DIFFICULTES.map((cran) => DECK_DE_LA_DIRECTION[cran]));
    expect(memes.size).toBe(DIFFICULTES.length);
  });
});
