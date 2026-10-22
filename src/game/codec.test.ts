import { describe, expect, it } from 'vitest';
import type { BattleState } from '@/data/types';
import { applyAction, createBattle, replayBattle } from '@/game/engine';
import {
  CODEC_PREFIX,
  CODEC_VERSION,
  codeFingerprint,
  decodeMatch,
  encodeMatch,
  sealCode
} from '@/game/codec';
import type { MatchCode } from '@/game/codec';
import { FACTION_ORDER, factionDeck, playGame } from '@/game/simulation';

/**
 * **Codec de partie** — ticket #124 (PvP par code, D-049).
 *
 * Ce que la suite prouve, dans l'ordre des critères du ticket :
 *
 * 1. encoder puis décoder redonne **le même match** ;
 * 2. `replayBattle` sur le match décodé rend un état **strictement égal** à la partie
 *    jouée action par action ;
 * 3. chaque refus a **sa** raison, en français, et ne lève ni ne mute rien ;
 * 4. **détruire un caractère du code produit un refus** — à **chaque** position, un par
 *    un, puis les 64 caractères de l'alphabet base64url sur un code court. C'est le
 *    contrôle qui mord : sans l'empreinte, un base64 altéré peut redevenir un JSON
 *    valide dont un champ a changé, et on rejouerait **une autre partie en silence** ;
 * 5. le code se lit au début (`PLQ1.`) et n'emploie que des caractères de canal texte.
 *
 * Lancer `CODEC_REPORT=1 npx vitest run src/game/codec.test.ts` pour afficher la taille
 * des codes produits ; `npm test` ne vérifie que les critères.
 */

const SEEDS = [1, 7, 42, 2026] as const;

/** Affiche la taille des codes produits (comme `PACE_REPORT` pour le rythme). */
const REPORT = process.env.CODEC_REPORT === '1';

/** Deux Decks légaux, distincts, dérivés de la graine. */
function decksFor(seed: number): [string[], string[]] {
  const player = FACTION_ORDER[seed % FACTION_ORDER.length] ?? FACTION_ORDER[0];
  const ai = FACTION_ORDER[(seed + 3) % FACTION_ORDER.length] ?? FACTION_ORDER[1];
  return [factionDeck(player), factionDeck(ai)];
}

/** Le match tel qu'un écran de combat le remettrait au codec (graine, Decks, journal). */
function matchOf(state: BattleState, playerDeck: string[], aiDeck: string[]): MatchCode {
  return {
    seed: state.seed,
    playerDeck,
    aiDeck,
    playerCafeTypes: state.players.player.cafeTypes,
    aiCafeTypes: state.players.ai.cafeTypes,
    actions: state.actionLog
  };
}

function playedMatch(seed: number): { match: MatchCode; state: BattleState } {
  const [playerDeck, aiDeck] = decksFor(seed);
  const state = playGame(playerDeck, aiDeck, seed);
  return { match: matchOf(state, playerDeck, aiDeck), state };
}

/** Les 64 caractères de l'alphabet base64url : ceux qu'un code peut porter. */
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Une altération du code qui change **vraiment** le caractère visé. */
function mutate(code: string, position: number, replacement: string): string {
  return code.slice(0, position) + replacement + code.slice(position + 1);
}

/** Un caractère de même famille mais différent — pour éprouver une vraie substitution. */
function differentChar(original: string): string {
  const index = BASE64URL.indexOf(original);
  return index < 0 ? 'A' : (BASE64URL[(index + 1) % BASE64URL.length] as string);
}

function fromBase64Url(payload: string): Uint8Array {
  const standard = payload.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(standard.padEnd(Math.ceil(standard.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** La charge utile d'un code, en clair — pour forger un code abîmé en connaissance de cause. */
function wireOf(code: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(code.split('.')[2] as string))) as Record<
    string,
    unknown
  >;
}

/** Longueur de la charge utile seule (ce qui reste une fois préfixe et empreinte ôtés). */
function payloadSize(code: string): number {
  return (code.split('.')[2] as string).length;
}

/** Un code scellé d'une charge utile arbitraire : l'empreinte est **valide**, le reste forgé. */
function forged(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return sealCode(toBase64Url(new TextEncoder().encode(text)));
}

describe('Codec — encoder puis décoder redonne le même match (#124)', () => {
  it.each(SEEDS)('aller-retour sur une partie complète (graine %i)', (seed) => {
    const { match } = playedMatch(seed);
    // Une partie qui a réellement agi : sans journal non vide, le test ne prouverait rien.
    expect(match.actions.length).toBeGreaterThan(0);

    const decoded = decodeMatch(encodeMatch(match));

    expect(decoded.ok, decoded.ok ? '' : decoded.raison).toBe(true);
    if (!decoded.ok) return;
    // Égalité **stricte** : graine, ordre des deux Decks, types de café, journal.
    expect(decoded.match).toEqual(match);
  });

  it('n’altère pas le match qu’on lui donne à encoder', () => {
    const { match } = playedMatch(42);
    const avant = structuredClone(match);
    encodeMatch(match);
    expect(match).toEqual(avant);
  });

  it('rejoue le match décodé à l’identique de la partie jouée', () => {
    const { match, state } = playedMatch(42);
    const decoded = decodeMatch(encodeMatch(match));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    // La partie « jouée une à une » : même graine, puis `applyAction` action par action.
    let joue = createBattle(match.playerDeck, match.aiDeck, match.seed, {
      playerCafeTypes: match.playerCafeTypes,
      aiCafeTypes: match.aiCafeTypes
    });
    for (const action of match.actions) joue = applyAction(joue, action);
    expect(joue).toEqual(state);

    const rejoue = replayBattle(
      decoded.match.playerDeck,
      decoded.match.aiDeck,
      decoded.match.seed,
      decoded.match.actions,
      {
        playerCafeTypes: decoded.match.playerCafeTypes,
        aiCafeTypes: decoded.match.aiCafeTypes
      }
    );

    // Égalité **stricte** : rng, plateau, journal texte, actionLog, vainqueur.
    expect(rejoue).toEqual(joue);
  });

  it('lit le format au début, et ne sort que des caractères de canal texte', () => {
    const { match } = playedMatch(7);
    const code = encodeMatch(match);

    expect(code.startsWith(`${CODEC_PREFIX}${CODEC_VERSION}.`)).toBe(true);
    expect(code).toMatch(/^PLQ1\.[0-9a-z]{7}\.[A-Za-z0-9_-]+$/);
    // Aucun espace, aucun saut de ligne : le code passe par un message tel quel.
    expect(code).not.toMatch(/\s/);
    if (REPORT) {
      console.log(
        `codec: ${match.actions.length} actions → ${code.length} caractères ` +
          `(charge utile ${payloadSize(code)}, empreinte 7) ; début ${code.slice(0, 72)}…`
      );
    }
  });

  it('tolère les espaces et retours à la ligne autour du code (transport par message)', () => {
    const { match } = playedMatch(1);
    const code = encodeMatch(match);
    const decoded = decodeMatch(`\n  ${code}\n\n`);
    expect(decoded.ok, decoded.ok ? '' : decoded.raison).toBe(true);
    if (decoded.ok) expect(decoded.match).toEqual(match);
  });
});

describe('Codec — chaque refus a sa raison, en français (#124)', () => {
  const { match } = playedMatch(42);
  const valide = encodeMatch(match);
  const payload = valide.split('.')[2] as string;

  it('refuse une chaîne vide', () => {
    const vide = decodeMatch('');
    expect(vide.ok).toBe(false);
    if (vide.ok) return;
    expect(vide.kind).toBe('vide');
    expect(vide.raison).toContain('vide');
  });

  it('refuse un texte qui n’est pas un code', () => {
    const texte = decodeMatch('bonjour, voici ma partie !');
    expect(texte.ok).toBe(false);
    if (texte.ok) return;
    expect(texte.kind).toBe('pas-un-code');
    expect(texte.raison).toContain('PLQ');
  });

  it('refuse un code tronqué (base64 illisible, empreinte pourtant recalculée)', () => {
    // On scelle une charge utile **tronquée** à une longueur impossible (`longueur % 4 === 1`)
    // pour que le refus vienne bien de l'étage base64, et pas de l'empreinte.
    const tronque = payload.slice(0, payload.length - ((payload.length - 1) % 4));
    expect(tronque.length % 4).toBe(1);
    const resultat = decodeMatch(sealCode(tronque));
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('base64');
    expect(resultat.raison).toContain('base64');
  });

  it('refuse un code dont la charge utile n’est pas du JSON', () => {
    const resultat = decodeMatch(forged('ceci n’est pas du JSON'));
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('json');
    expect(resultat.raison).toContain('JSON');
  });

  it('refuse un JSON valide d’un autre jeu', () => {
    const resultat = decodeMatch(forged({ jeu: 'un autre', version: 3, plateau: [] }));
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('charge');
    expect(resultat.raison).toContain('pas une partie de ce jeu');
  });

  it('refuse une version inconnue au lieu de la mal interpréter', () => {
    const futur = `PLQ2.${valide.split('.').slice(1).join('.')}`;
    const resultat = decodeMatch(futur);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('version-inconnue');
    expect(resultat.raison).toContain('version inconnue');
  });

  it('refuse un Deck illégal avant de rejouer', () => {
    const forge = encodeMatch({ ...match, playerDeck: match.playerDeck.slice(0, 19) });
    const resultat = decodeMatch(forge);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('deck');
    expect(resultat.raison).toContain('Deck illégal (Toi)');
    expect(resultat.raison).toContain('20 cartes');
  });

  it('refuse une carte inconnue dans un Deck (le moteur ne lève pas)', () => {
    const forge = encodeMatch({
      ...match,
      aiDeck: [...match.aiDeck.slice(1), 'carte-qui-nexiste-pas']
    });
    const resultat = decodeMatch(forge);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('deck');
    expect(resultat.raison).toContain('carte-qui-nexiste-pas');
  });

  it('refuse des types de café qu’un Deck ne peut pas produire', () => {
    // `SUPPORT` et `INTERIM` ne sont jamais des types de café (D-034) : les normaliser en
    // silence changerait la partie rejouée, donc on refuse.
    const forge = encodeMatch({ ...match, playerCafeTypes: ['SUPPORT'] });
    const resultat = decodeMatch(forge);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('cafe');
    expect(resultat.raison).toContain('café');
  });

  it('refuse un journal qu’une action refusée par le moteur rend incohérent', () => {
    // Une Pression à l’ouverture est illégale : `applyAction` la refuse, ne la journalise
    // pas, et le rejeu ne rend donc pas le journal annoncé.
    const forge = encodeMatch({ ...match, actions: [{ type: 'attack', attackIndex: 0 }] });
    const resultat = decodeMatch(forge);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('rejeu');
    expect(resultat.raison).toContain('ne rejoue pas');
  });

  it('refuse une action de forme inconnue dans le journal', () => {
    const wire = wireOf(valide);
    wire.a = [[99, 1]];
    const resultat = decodeMatch(forged(wire));
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('charge');
    expect(resultat.raison).toContain('action illisible');
  });

  it('refuse une empreinte qui ne correspond pas', () => {
    const mutant = mutate(valide, valide.length - 1, differentChar(valide.at(-1) as string));
    const resultat = decodeMatch(mutant);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.kind).toBe('integrite');
    expect(resultat.raison).toContain('abîmé');
  });

  it('n’expose aucun match quand il refuse, et ne lève sur aucune entrée', () => {
    const refus = [
      '',
      'pas un code',
      `${CODEC_PREFIX}${CODEC_VERSION}.`,
      `${CODEC_PREFIX}${CODEC_VERSION}.0000000.`,
      `${CODEC_PREFIX}${CODEC_VERSION}.0000000.%%%`,
      sealCode(''),
      forged({}),
      forged({ s: 1, d: [[], []], c: [[], []], a: [] })
    ];
    for (const code of refus) {
      const resultat = decodeMatch(code);
      expect(resultat.ok, `code refusé attendu : ${code}`).toBe(false);
      if (resultat.ok) continue;
      expect(resultat).not.toHaveProperty('match');
      expect(resultat.raison.length).toBeGreaterThan(0);
      // La raison est une phrase française, pas un code d’erreur : elle est affichable.
      expect(resultat.raison).toMatch(/[a-zà-ÿ]/);
    }
    // Et un code valide se décode encore après tous ces refus : le codec ne garde rien.
    const apres = decodeMatch(valide);
    expect(apres.ok).toBe(true);
    if (apres.ok) expect(apres.match).toEqual(match);
  });
});

describe('Codec — détruire un caractère produit un refus, à chaque position (#124)', () => {
  /**
   * Le contrôle qui mord, version littérale : **une** substitution base64url par position
   * du code, sur une partie réelle. Toutes les positions y passent — préfixe, version,
   * point, empreinte, charge utile — et **chacune** doit être refusée.
   */
  it('refuse chaque position altérée d’une partie réelle', () => {
    const { match } = playedMatch(42);
    const code = encodeMatch(match);
    const traversantes: string[] = [];

    for (let position = 0; position < code.length; position += 1) {
      const original = code[position] as string;
      const remplacant = differentChar(original);
      expect(remplacant, `position ${position}`).not.toBe(original);
      if (decodeMatch(mutate(code, position, remplacant)).ok) {
        traversantes.push(`${position}:${original}→${remplacant}`);
      }
    }

    expect(traversantes, `positions passées au travers : ${traversantes.join(', ')}`).toEqual([]);
    expect(code.length).toBeGreaterThan(100);
  });

  /**
   * Le même contrôle, exhaustif : sur un code **court** (journal vide), les **64**
   * caractères de l’alphabet base64url remplacent chacun chaque caractère du code. C’est
   * là que se cache le piège du ticket — un base64 altéré qui redevient un JSON valide.
   */
  it('refuse les 64 substitutions base64url, à chaque position d’un code court', () => {
    const [playerDeck, aiDeck] = decksFor(7);
    const court = encodeMatch({
      seed: 7,
      playerDeck,
      aiDeck,
      playerCafeTypes: [],
      aiCafeTypes: [],
      actions: []
    });
    expect(decodeMatch(court).ok, 'le code de référence doit être valide').toBe(true);
    if (REPORT) {
      console.log(`codec: code court (journal vide, 2 × 20 cartes) → ${court.length} caractères`);
    }

    const traversantes: string[] = [];
    let mutants = 0;
    for (let position = 0; position < court.length; position += 1) {
      for (const remplacant of BASE64URL) {
        if (court[position] === remplacant) continue;
        mutants += 1;
        if (decodeMatch(mutate(court, position, remplacant)).ok) {
          traversantes.push(`${position}:${court[position]}→${remplacant}`);
        }
      }
    }

    expect(traversantes, `substitutions passées au travers : ${traversantes.join(', ')}`).toEqual(
      []
    );
    // Toutes les substitutions ont été tentées : 63 par caractère base64url, 64 pour les
    // deux points séparateurs (aucun caractère de l'alphabet ne leur est égal).
    const attendus = [...court].reduce(
      (total, char) => total + BASE64URL.length - (BASE64URL.includes(char) ? 1 : 0),
      0
    );
    expect(mutants).toBe(attendus);
  });

  /**
   * Et sur la **charge utile seule**, une substitution à plusieurs endroits (début, tiers,
   * milieu, fin) : ceux où une graine, un `uid` ou un index changent de valeur. Le refus
   * doit tomber pour **chacun**, pas seulement pour le dernier caractère.
   */
  it('refuse une charge utile modifiée dont l’empreinte n’a pas suivi', () => {
    const { match } = playedMatch(42);
    const code = encodeMatch(match);
    const entete = code.slice(0, code.lastIndexOf('.') + 1);
    const charge = code.slice(entete.length);
    const positions = [
      0,
      1,
      Math.floor(charge.length / 3),
      Math.floor(charge.length / 2),
      charge.length - 1
    ];

    for (const position of positions) {
      const original = charge[position] as string;
      const remplacant = differentChar(original);
      const resultat = decodeMatch(entete + mutate(charge, position, remplacant));
      expect(resultat.ok, `position ${position} non refusée`).toBe(false);
      if (!resultat.ok) expect(resultat.raison.length).toBeGreaterThan(0);
    }
  });

  /**
   * L'empreinte n'est pas décorative : elle fait 7 caractères base36, vaut celle de la
   * charge utile, et une autre valeur fait refuser un code par ailleurs intact.
   */
  it('l’empreinte du code est celle de sa charge utile, et vaut 7 caractères base36', () => {
    const { match } = playedMatch(1);
    const code = encodeMatch(match);
    const [prefixe, checksum, charge] = code.split('.') as [string, string, string];
    expect(prefixe).toBe(`${CODEC_PREFIX}${CODEC_VERSION}`);
    expect(checksum).toHaveLength(7);
    expect(checksum).toBe(codeFingerprint(charge));
    // Une empreinte changée, tout le reste valide : refus.
    const autre = checksum === '0000000' ? '1111111' : '0000000';
    expect(decodeMatch(`PLQ1.${autre}.${charge}`).ok).toBe(false);
  });
});
