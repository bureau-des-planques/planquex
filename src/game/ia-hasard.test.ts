import { describe, expect, it } from 'vitest';
import type { BattleAction, BattleState } from '@/data/types';
import { applyAction, createBattle, createInstance, legalActions } from '@/game/engine';
import { nextAction } from '@/game/ia';
import { flipStamp } from '@/game/rng';
import { factionDeck } from '@/game/simulation';

/**
 * Ticket #114 — **le niveau 2 ne lit pas l'avenir du hasard**.
 *
 * Défaut d'origine : l'évaluateur du niveau 2 appliquait chaque action sur un
 * `structuredClone` de la partie, **générateur compris**. Le clone reprenait donc le
 * flux de la partie *au même endroit* : le lancer de **Dérive** consommé pendant
 * l'évaluation était **exactement** celui que la Pression réelle allait tirer. Une
 * politique qui sait qu'elle va échouer renonce à frapper et fait autre chose — c'est
 * de la **divination**, pas de la stratégie.
 *
 * Ce que ces tests tiennent :
 *
 * - à **position égale**, le choix ne dépend plus de l'état du générateur de la partie :
 *   deux parties dont le prochain lancer de tampon diffère (agrafe / tampon) donnent la
 *   **même** action ;
 * - la décision de niveau 2 **ne consomme pas** le flux du jeu, ni ne modifie la partie
 *   (la reproductibilité par graine et `replayBattle` restent intactes).
 */

const AI_DECK = factionDeck('MANAGEMENT');
const PLAYER_DECK = factionDeck('SSE');

/**
 * Position contrôlée, **identique** quel que soit l'état du générateur : la Direction a
 * le trait, son Poste est sous **Dérive** et peut payer sa Pression (`Piqûre de rappel`,
 * 40 de stress), son Talent (`Prévention`, +10 de Seuil) reste disponible, un Rack
 * permet la Rotation, et le Poste adverse est à 10 de Seuil — une Pression réussie le
 * craque, donc une Intervention à la clé.
 *
 * C'est l'arbitrage qui rend le défaut visible : sur l'agrafe, la Pression rapporte une
 * Intervention et gagne l'évaluation ; sur le tampon, elle ne fait rien et le Talent
 * passe devant. Seuls `rng`, `seed`, `log` et `actionLog` distinguent deux états bâtis
 * sur deux graines — c'est précisément le flux que la politique ne doit plus lire.
 */
function position(seed: number): BattleState {
  const state = createBattle(AI_DECK, PLAYER_DECK, seed);
  state.turn = 5;
  state.current = 'ai';
  state.firstPlayer = 'player';
  state.pendingPromotion = null;

  const attacker = createInstance('sse-infirmiere-travail', state.turn);
  attacker.hp = 25;
  attacker.energy = ['SSE', 'INCOLORE'];
  attacker.statuses = ['DERIVE'];
  state.players.ai.active = attacker;
  state.players.ai.bench = [createInstance('management-chef-de-projet', state.turn), null, null];
  state.players.ai.energyZone = null;
  state.players.ai.hand = [];

  const target = createInstance('sse-infirmier-site', state.turn);
  target.hp = 10;
  state.players.player.active = target;
  state.players.player.bench = [createInstance('sse-preventeur', state.turn), null, null];
  state.players.player.hand = [];

  return state;
}

/**
 * Deux **graines de partie** dont le prochain lancer de tampon diffère : l'une donnera
 * l'agrafe (`face`, la Pression passe), l'autre le tampon (`pile`, elle échoue).
 */
function seedsWithBothSides(): { face: number; pile: number } {
  let face: number | null = null;
  let pile: number | null = null;
  for (let seed = 1; seed <= 500 && (face === null || pile === null); seed += 1) {
    if (flipStamp({ rng: position(seed).rng }) === 'face') face ??= seed;
    else pile ??= seed;
  }
  if (face === null || pile === null) throw new Error('Aucune graine des deux côtés');
  return { face, pile };
}

const ATTACK: BattleAction = { type: 'attack', attackIndex: 0 };

describe('IA de niveau 2 — le hasard n’est pas lu, il est simulé (#114)', () => {
  it('même position, deux graines, même choix — alors que le lancer RÉEL diffère', () => {
    const { face, pile } = seedsWithBothSides();
    const agrafe = position(face);
    const tampon = position(pile);

    // Même plateau des deux côtés : on ne laisse différer que le générateur (et la
    // graine d'origine, que l'évaluation ne lit pas).
    tampon.players = structuredClone(agrafe.players);
    expect(flipStamp({ rng: agrafe.rng })).toBe('face');
    expect(flipStamp({ rng: tampon.rng })).toBe('pile');

    // Preuve que les deux parties ne joueront pas le même coup : la Pression réelle
    // craque le Poste adverse sur l'une, échoue sous Dérive sur l'autre.
    const apresAgrafe = applyAction(agrafe, ATTACK);
    const apresTampon = applyAction(tampon, ATTACK);
    expect(apresAgrafe.players.player.active, 'agrafe : le Poste adverse craque').toBeNull();
    expect(apresTampon.players.player.active?.hp, 'tampon : la Pression n’est pas lancée').toBe(10);
    expect(apresTampon.log.some((ligne) => ligne.includes('Dérive : tampon'))).toBe(true);

    // Et pourtant la politique tranche **pareil** : elle ne sait pas ce que le lancer
    // donnera, donc son choix ne peut pas en dépendre.
    const choixAgrafe = nextAction(agrafe, 2);
    const choixTampon = nextAction(tampon, 2);
    expect(choixAgrafe).not.toBeNull();
    expect(choixTampon).toEqual(choixAgrafe);
  });

  it('la décision ne consomme pas le flux du jeu et ne modifie pas la partie', () => {
    const { face } = seedsWithBothSides();
    const state = position(face);
    const avant = structuredClone(state);

    nextAction(state, 2);
    legalActions(state);

    expect(state.rng, 'le générateur de la partie ne bouge pas').toBe(avant.rng);
    expect(state).toEqual(avant);
  });
});
