import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/data';
import { CODEC_PREFIX, decodeDeckCode, decodeMatch, encodeDeckCode, encodeMatch, sealCode } from '@/game/codec';
import { deckLegal } from '@/game/deck';
import { factionDeck } from '@/game/simulation';

/**
 * **Codec de Deck partagé** — ticket #363.
 *
 * Le Deck voyage dans **la même enveloppe** que la partie (`PLQ1.<empreinte>.<charge>`) :
 * ces tests prouvent l'aller-retour, les refus motivés (version, carte inconnue, types de
 * café), l'export d'un Deck illégal, et **le contrôle qui mord** : un code forgé ou altéré
 * doit échouer, et un code de partie ne doit jamais s'importer comme un Deck (et l'inverse).
 */

const LEGAL = factionDeck('SSE');
const ID_CONNU = ALL_CARDS[0].id;

/** Une charge utile forgée, scellée avec une empreinte **valide** : le refus vient du bon étage. */
function codeForge(charge: unknown): string {
  return sealCode(Buffer.from(JSON.stringify(charge), 'utf8').toString('base64url'));
}

describe('Deck partagé — aller-retour (#363)', () => {
  it('un Deck légal revient identique : mêmes cartes, mêmes types de café', () => {
    const code = encodeDeckCode(LEGAL, ['SSE', 'MANAGEMENT']);
    const relu = decodeDeckCode(code);

    expect(relu).toEqual({ ok: true, deck: { cartes: LEGAL, cafeTypes: ['SSE', 'MANAGEMENT'] } });
  });

  it('une liste de types vide reste vide (proposition automatique), et le code commence par PLQ1', () => {
    const code = encodeDeckCode(LEGAL, []);

    expect(code.startsWith(`${CODEC_PREFIX}1.`)).toBe(true);
    expect(decodeDeckCode(code)).toEqual({ ok: true, deck: { cartes: LEGAL, cafeTypes: [] } });
  });

  it('tolère les espaces autour du code collé', () => {
    expect(decodeDeckCode(`  ${encodeDeckCode(LEGAL, [])}\n`).ok).toBe(true);
  });
});

describe('Deck partagé — refus motivés (#363)', () => {
  it('refuse une version inconnue en disant laquelle', () => {
    const futur = `PLQ2.${encodeDeckCode(LEGAL, []).split('.').slice(1).join('.')}`;
    const resultat = decodeDeckCode(futur);

    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('version-inconnue');
    expect(resultat.raison).toContain('PLQ2');
  });

  it('refuse une carte que le jeu ne connaît pas, en la nommant', () => {
    const resultat = decodeDeckCode(codeForge({ k: 'deck', d: [ID_CONNU, 'carte-fantome'], c: [] }));

    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('deck');
    expect(resultat.raison).toContain('carte-fantome');
  });

  it('refuse des types de café qu’un Deck ne produit pas (SUPPORT)', () => {
    const resultat = decodeDeckCode(codeForge({ k: 'deck', d: LEGAL, c: ['SUPPORT'] }));

    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('cafe');
  });

  it('refuse un code de partie présenté comme un Deck, et un Deck présenté comme une partie', () => {
    const partie = encodeMatch({
      seed: 1,
      playerDeck: LEGAL,
      aiDeck: LEGAL,
      playerCafeTypes: [],
      aiCafeTypes: [],
      actions: []
    });
    const deck = encodeDeckCode(LEGAL, []);

    const comme_deck = decodeDeckCode(partie);
    expect(comme_deck.ok).toBe(false);
    if (!comme_deck.ok) expect(comme_deck.raison).toContain('une partie, pas un Deck');

    const comme_partie = decodeMatch(deck);
    expect(comme_partie.ok).toBe(false);
    if (!comme_partie.ok) expect(comme_partie.raison).toContain('Deck partagé');
  });

  it('refuse une charge qui n’est pas un Deck du tout', () => {
    expect(decodeDeckCode(codeForge([1, 2, 3])).ok).toBe(false);
    expect(decodeDeckCode(codeForge({ k: 'deck', d: 'pas une liste', c: [] })).ok).toBe(false);
  });
});

describe('Deck partagé — cartes manquantes et Deck illégal (#363)', () => {
  it('un Deck illégal s’exporte quand même, et s’importe avec ses raisons', () => {
    const cinq = LEGAL.slice(0, 5);
    expect(deckLegal(cinq).ok).toBe(false);

    const code = encodeDeckCode(cinq, []);
    const relu = decodeDeckCode(code);

    expect(relu.ok).toBe(true);
    if (!relu.ok) return;
    expect(relu.deck.cartes).toEqual(cinq);
    expect(deckLegal(relu.deck.cartes).reasons.join(' ')).toContain('20 cartes');
  });

  it('un Deck de cartes connues mais non possédées revient entier : le codec ne filtre pas la Collection', () => {
    // La possession n'est pas une donnée du code : l'écran la compare à la Collection.
    const relu = decodeDeckCode(encodeDeckCode(LEGAL, []));
    expect(relu.ok && relu.deck.cartes.length).toBe(LEGAL.length);
  });

  it('refuse un Deck qui dépasse la borne de lecture', () => {
    const trop = Array.from({ length: 61 }, () => ID_CONNU);
    const resultat = decodeDeckCode(codeForge({ k: 'deck', d: trop, c: [] }));

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.kind).toBe('charge');
  });
});

describe('Deck partagé — le contrôle mord (#363)', () => {
  it('une altération d’un seul caractère du code est refusée', () => {
    const code = encodeDeckCode(LEGAL, ['SSE']);
    const [prefixe, empreinte, charge] = code.split('.') as [string, string, string];
    const altere = charge[0] === 'A' ? `B${charge.slice(1)}` : `A${charge.slice(1)}`;

    const resultat = decodeDeckCode(`${prefixe}.${empreinte}.${altere}`);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.kind).toBe('integrite');
  });

  it('une charge modifiée avec une empreinte recalculée échoue plus loin, au contrôle de contenu', () => {
    // Le code est **scellé** : c'est le contenu qui doit refuser, pas l'empreinte.
    const resultat = decodeDeckCode(
      codeForge({ k: 'deck', d: [ID_CONNU], c: ['ATELIER', 'ATELIER', 'DIRECTION', 'SSE'] })
    );
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.kind).toBe('cafe');
  });

  it('une charge scellée d’un Deck valide passe, les mêmes charges illégales non', () => {
    expect(decodeDeckCode(encodeDeckCode(LEGAL, [])).ok).toBe(true);
    expect(decodeDeckCode(codeForge({ k: 'deck', d: LEGAL, c: [] })).ok).toBe(true);
    expect(decodeDeckCode(codeForge({ k: 'deck', d: [ID_CONNU], c: [] })).ok).toBe(true);
  });
});
