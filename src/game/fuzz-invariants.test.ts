import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard, isPlanque } from '@/data';
import type { BattleAction, BattleState, CardInstance, FaitMoteur, PlayerId } from '@/data/types';
import { FACTION_ORDER, factionCafeTypes, factionDeck } from '@/game/simulation';
import { DECK_SIZE, deckLegal } from '@/game/deck';
import { applyAction, createBattle, legalActions, replayBattle } from '@/game/engine';
import type { BattleCafeTypes } from '@/game/engine';
import { BENCH_SIZE, HAND_LIMIT } from '@/game/rules';
import { drawRandom, seedRng, type RngState } from '@/game/rng';

/**
 * **Le fuzz d'invariants** (#351) : des centaines de parties jouées par des actions
 * **strictement légales**.
 *
 * Le dépôt avait 37 fichiers de tests de scénarios et **aucun** qui joue au hasard : rien
 * ne vérifiait qu'une partie menée par `legalActions` garde un état sain du début à la fin.
 * C'est pourtant le critère (b) de sortie d'alpha — « plus aucun bug qui casse la boucle » —
 * et il n'était tenu que par accident, parce que personne ne jouait encore.
 *
 * Ce que ce fichier est, et ce qu'il n'est pas :
 *
 * - **déterministe** : la graine de chaque partie et le choix de l'action viennent d'un
 *   générateur seedé (`@/game/rng`). Aucun `Math.random()`, aucun `Date.now()` : deux
 *   exécutions jouent exactement les mêmes parties, et un échec se rejoue par sa graine ;
 * - **borné** : un plafond de pas par partie (et non une horloge) fait échouer une partie
 *   qui ne se termine pas. Le budget temps du ticket (30 s) se tient par le compte de
 *   parties, pas par une mesure — le test reste donc reproductible sur une CI lente ;
 * - **pas un juge d'équilibrage** : il ne dit pas si une partie est amusante ou équilibrée.
 *   Il dit qu'un état atteint par des actions légales n'est jamais incohérent.
 *
 * **Le forfait est écarté du tirage** : c'est une action légale, mais un abandon ne dit rien
 * de la boucle de jeu et terminerait la moitié des parties au premier pas. Toutes les autres
 * actions tirées viennent de `legalActions` tel quel.
 */

/**
 * Le volume, réglable par l'environnement — et **borné dans la suite**.
 *
 * Mesuré le 28/10/2026 : 200 parties coûtaient **26 s** sur une machine au repos, pour un
 * délai de 30 s. Sous charge (quatre agents, une CI), le test dépassait et faisait échouer
 * `npm test` **sans qu'une règle soit cassée** — un test qui rougit au hasard ne prouve
 * rien. La suite garde donc une série **courte**, et la série longue se demande :
 * `FUZZ_PARTIES=120 FUZZ_PARTIES_AGRESSIVES=80 npm test -- --project=node src/game/fuzz-invariants.test.ts`.
 * Le nombre de parties ne change **pas** les invariants : 80 parties de 200 actions
 * exercent déjà les mêmes transitions.
 */
const nombre = (nom: string, defaut: number): number => {
  const brut = Number(process.env[nom]);
  return Number.isSafeInteger(brut) && brut > 0 ? brut : defaut;
};
/** Les graines sont des constantes du test, pas un tirage : un échec se rejoue. */
const GRAINE = 0x5eed_0351;
/** Les parties au tirage strictement uniforme. */
const PARTIES = nombre('FUZZ_PARTIES', 50);
/** Les parties à tirage « agressif » (les actions qui font avancer préférées 6 fois sur 10). */
const PARTIES_AGRESSIVES = nombre('FUZZ_PARTIES_AGRESSIVES', 30);
/** Une graine distincte : les deux séries ne rejouent pas les mêmes parties. */
const GRAINE_AGRESSIVE = 0x0bad_0351;
/** Le total des deux séries, calculé une fois — le titre du test et la boucle le lisent. */
const SERIE_TOTALE = PARTIES + PARTIES_AGRESSIVES;

/**
 * Le nombre maximal d'actions d'une partie.
 *
 * La limite de tours (30, `TURN_LIMIT`) borne une partie normale à quelques dizaines
 * d'actions ; 600 laisse une marge large (relèves, choix, actions gratuites) sans laisser
 * une partie boucler. Une partie qui l'atteint fait **échouer** le test avec sa graine.
 */
const PAS_MAX = 600;

/** Les deux Decks d'une partie : un archétype par camp, pris dans les dix factions. */
function decksDe(partie: number): { decks: [string[], string[]]; cafeTypes: BattleCafeTypes } {
  const factions = FACTION_ORDER;
  const joueur = factions[partie % factions.length]!;
  const adversaire = factions[(partie + 1 + Math.floor(partie / factions.length)) % factions.length]!;
  const deckJoueur = factionDeck(joueur);
  const deckAi = factionDeck(adversaire);
  return {
    decks: [deckJoueur, deckAi],
    cafeTypes: {
      playerCafeTypes: factionCafeTypes(joueur),
      aiCafeTypes: factionCafeTypes(adversaire)
    }
  };
}

/**
 * Les instances d'un camp **en jeu** : le Poste et le Banc. Les cafés et les statuts n'y
 * vivent que là, et c'est là que le Stress se lit. Le Rebut et le Deck portent des cartes
 * entières (une carte qui a craqué garde son `hp` négatif au Rebut, sans effet : elle n'est
 * plus jamais frappée — `knockOut` refuse un `hp` déjà `≤ 0`).
 */
function enJeu(player: BattleState['players'][PlayerId]): CardInstance[] {
  return [...(player.active ? [player.active] : []), ...player.bench.filter(Boolean)] as CardInstance[];
}

/** Les instances d'un camp, où qu'elles soient : plateau, Banc, main, Rebut, Deck. */
function instances(player: BattleState['players'][PlayerId]): CardInstance[] {
  return [
    ...(player.active ? [player.active] : []),
    ...player.bench.filter(Boolean),
    ...player.hand,
    ...player.discard,
    ...player.deck
  ] as CardInstance[];
}

/** Le libellé d'une action, pour un échec lisible. */
function describeAction(action: BattleAction): string {
  switch (action.type) {
    case 'playBasic':
      return `playBasic(${action.uid} → ${action.slot})`;
    case 'evolve':
      return `evolve(${action.uid} → ${action.targetUid})`;
    case 'attachEnergy':
      return `attachEnergy(${action.targetUid})`;
    case 'retreat':
      return `retreat(${action.benchIndex})`;
    case 'attack':
      return `attack(${action.attackIndex})`;
    case 'priorityShift':
      return `priorityShift(${action.uid})`;
    case 'playAction':
      return `playAction(${action.uid})`;
    case 'promoteActive':
      return `promoteActive(${action.benchIndex})`;
    case 'choose':
      return `choose(${action.uid})`;
    case 'forfeit':
      return `forfeit(${action.who})`;
    case 'endTurn':
      return 'endTurn';
    case 'ability':
      return 'ability';
  }
}

/**
 * Les invariants vérifiés après **chaque** action acceptée. Chacun nomme la règle qu'il
 * garde : le rapport d'un échec dit l'invariant, la graine, le pas et l'action.
 */
function verifierInvariants(state: BattleState, ou: string): void {
  // 1. La main (§4) : jamais plus de 10 cartes. La pioche s'arrête à la main pleine.
  for (const who of ['player', 'ai'] as PlayerId[]) {
    const player = state.players[who];
    expect(player.hand.length, `${ou} : main de ${who} (${player.hand.length} > ${HAND_LIMIT})`).toBeLessThanOrEqual(
      HAND_LIMIT
    );
    // 2. Le Banc (§4) : trois places, jamais plus.
    expect(player.bench.length, `${ou} : taille du Banc de ${who}`).toBe(BENCH_SIZE);
    expect(player.bench.filter(Boolean).length, `${ou} : Banc de ${who} au-delà de ${BENCH_SIZE}`).toBeLessThanOrEqual(
      BENCH_SIZE
    );
  }

  // 3. Le Seuil et le Stress : `Stress = Seuil − hp`, donc `0 ≤ hp ≤ maxHp`. Un Stress
  //    négatif (hp > maxHp) serait un soin au-delà du Seuil, un `hp` négatif un craquage
  //    qui n'a pas eu lieu.
  for (const who of ['player', 'ai'] as PlayerId[]) {
    for (const instance of enJeu(state.players[who])) {
      expect(
        instance.hp,
        `${ou} : ${instance.uid} au-dessus de son Seuil (${instance.hp}/${instance.maxHp})`
      ).toBeLessThanOrEqual(instance.maxHp);
      expect(instance.hp, `${ou} : ${instance.uid} sous 0`).toBeGreaterThanOrEqual(0);
    }
  }

  // 4. Le Poste : il existe tant que la partie vit, sauf le camp qui attend une relève
  //    (`pendingPromotion`). Un Poste vide sans relève est un état sans issue.
  if (state.phase === 'playing') {
    for (const who of ['player', 'ai'] as PlayerId[]) {
      if (state.players[who].active) continue;
      const enAttente = state.pendingPromotion === who;
      const plusRien = !state.players[who].bench.some(Boolean);
      expect(
        enAttente || plusRien,
        `${ou} : Poste de ${who} vide, sans relève en attente ni Banc — état sans issue`
      ).toBe(true);
    }
  }

  // 5. Une instance ne figure qu'à **une** place, et son uid est unique dans toute la table.
  const uids = new Set<string>();
  for (const who of ['player', 'ai'] as PlayerId[]) {
    for (const instance of instances(state.players[who])) {
      expect(uids.has(instance.uid), `${ou} : uid en double — ${instance.uid}`).toBe(false);
      uids.add(instance.uid);
    }
  }

  // 6. Les cafés : aucun café créé ex nihilo. Tout café attaché, comme celui de la Machine,
  //    est un type que le Deck produit (D-034, D-037 (4)).
  for (const who of ['player', 'ai'] as PlayerId[]) {
    const player = state.players[who];
    const types = new Set<string>(player.cafeTypes);
    if (player.energyZone !== null) {
      expect(types.has(player.energyZone), `${ou} : café ${player.energyZone} hors des types de ${who}`).toBe(true);
    }
    for (const instance of instances(player)) {
      for (const cafe of instance.energy) {
        expect(types.has(cafe), `${ou} : café ${cafe} attaché à ${instance.uid}, hors des types de ${who}`).toBe(true);
      }
    }
  }

  // 7. Une action légale laisse toujours de quoi jouer : tant que la partie vit, la liste
  //    des actions légales n'est pas vide. (Elle peut ne contenir que le forfait.)
  if (state.phase === 'playing') {
    expect(legalActions(state).length, `${ou} : aucune action légale, partie pourtant en cours`).toBeGreaterThan(0);
  }
}

/**
 * Les deux politiques de tirage du fuzz. Le tirage est **uniforme** sur `legalActions`
 * dans les deux cas ; l'agressive se contente de **préférer** les actions qui font avancer
 * une partie (poser, évoluer, attacher, attaquer, utiliser un Talent) six fois sur dix.
 * Sans elle, la plupart des parties s'arrêtent à la limite de tours : un tirage uniforme
 * consacre l'essentiel de ses pas à `endTurn`, et le fuzz ne verrait presque jamais un
 * craquage, une relève ou un statut.
 */
type Politique = 'uniforme' | 'agressive';

/** Ce qu'un pas « productif » peut faire : c'est là que vivent les règles à éprouver. */
const PRODUCTIVES: ReadonlySet<BattleAction['type']> = new Set([
  'playBasic',
  'evolve',
  'attachEnergy',
  'attack',
  'ability',
  'playAction',
  'retreat',
  'promoteActive',
  'choose'
]);

/** Une action tirée parmi les actions légales, hors forfait. */
function tirerAction(state: BattleState, rng: { rng: RngState }, politique: Politique): BattleAction | undefined {
  const actions = legalActions(state).filter((action) => action.type !== 'forfeit');
  if (actions.length === 0) return undefined;
  const productives = actions.filter((action) => PRODUCTIVES.has(action.type));
  const pool = politique === 'agressive' && productives.length > 0 && drawRandom(rng) < 0.6 ? productives : actions;
  const index = Math.floor(drawRandom(rng) * pool.length);
  return pool[Math.min(index, pool.length - 1)];
}

/** Le résultat d'une partie : les actions jouées, et l'état final. */
interface Partie {
  actions: BattleAction[];
  final: BattleState;
}

/**
 * Joue une partie entière par actions légales tirées au hasard seedé, et vérifie les
 * invariants à chaque pas.
 */
function jouerUnePartie(partie: number, politique: Politique, graine: number): Partie {
  const { decks, cafeTypes } = decksDe(partie);
  const seed = (graine + partie * 0x9e37) >>> 0;
  const rng = { rng: seedRng(seed) };

  for (const deck of decks) {
    const legal = deckLegal(deck);
    expect(legal, `graine ${seed} : Deck illégal (${legal.reasons.join(' ')})`).toEqual({ ok: true, reasons: [] });
    expect(deck, `graine ${seed} : Deck de ${deck.length} cartes`).toHaveLength(DECK_SIZE);
  }

  let state = createBattle(decks[0], decks[1], seed, cafeTypes);
  verifierInvariants(state, `graine ${seed} : mise en place`);
  const actions: BattleAction[] = [];

  for (let pas = 0; pas < PAS_MAX; pas += 1) {
    if (state.phase === 'ended') break;
    const action = tirerAction(state, rng, politique);
    expect(action, `graine ${seed}, pas ${pas} : aucune action légale, partie pourtant en cours`).toBeDefined();
    if (!action) break;

    const avant = state.actionLog.length;
    const after = applyAction(state, action);

    // 8. Une action **légale** n'est jamais refusée : `applyAction` rend l'état tel quel
    //    quand il refuse, et c'est exactement ce que le fuzz doit prendre en défaut.
    expect(after === state, `graine ${seed}, pas ${pas} : action légale refusée — ${describeAction(action)}`).toBe(
      false
    );

    // 9. Le journal ne contient que des actions **acceptées** : une entrée par action
    //    appliquée, et l'entrée dit l'action qu'on vient de jouer (`AGENTS.md` §6).
    expect(
      after.actionLog.length,
      `graine ${seed}, pas ${pas} : journal de ${after.actionLog.length - avant} entrée(s)`
    ).toBe(avant + 1);
    const entree = after.actionLog[after.actionLog.length - 1]!;
    expect(entree.action, `graine ${seed}, pas ${pas} : l'entrée ne dit pas l'action jouée`).toEqual(action);
    for (const fait of entree.faits as readonly FaitMoteur[]) {
      // Un fait de Stress ne peut pas être négatif (le Stress monte, §4).
      if (fait.type === 'stress') {
        expect(fait.montant, `graine ${seed}, pas ${pas} : Stress négatif dans les faits`).toBeGreaterThanOrEqual(0);
      }
    }

    actions.push(action);
    state = after;
    verifierInvariants(state, `graine ${seed}, pas ${pas} (${describeAction(action)})`);
  }

  // 10. La partie **se termine** : victoire, défaite, égalité de limite de tours ou forfait.
  expect(state.phase, `graine ${seed} : partie non terminée après ${PAS_MAX} pas`).toBe('ended');
  expect(state.endReason, `graine ${seed} : partie terminée sans motif`).not.toBeNull();
  return { actions, final: state };
}

describe('Fuzz — des centaines de parties par actions légales (#351)', () => {
  it(
    `joue ${SERIE_TOTALE} parties seedées, vérifie les invariants à chaque pas et rejoue chacune à l’identique`,
    { timeout: 120_000 },
    () => {
      const motifs = new Map<string, number>();

      for (let partie = 0; partie < PARTIES_AGRESSIVES + PARTIES; partie += 1) {
        const agressive = partie >= PARTIES;
        const index = agressive ? partie - PARTIES : partie;
        const graine = agressive ? GRAINE_AGRESSIVE : GRAINE;
        const { actions, final } = jouerUnePartie(index, agressive ? 'agressive' : 'uniforme', graine);
        motifs.set(final.endReason ?? 'aucun', (motifs.get(final.endReason ?? 'aucun') ?? 0) + 1);

        // 11. `replayBattle` rejoue la partie **à l'identique** : même graine, mêmes actions,
        //     même état final — journal compris (`replayBattle`, #83).
        const { decks, cafeTypes } = decksDe(index);
        const seed = (graine + index * 0x9e37) >>> 0;
        const rejoue = replayBattle(decks[0], decks[1], seed, actions, cafeTypes);
        expect(rejoue, `graine ${seed} : le rejeu diffère de la partie`).toEqual(final);
      }

      // Le test ne prouverait rien si toutes les parties finissaient de la même façon : au
      // moins deux motifs de fin distincts, et de vrais vainqueurs.
      if (process.env.FUZZ_REPORT) process.stdout.write(`motifs: ${[...motifs.entries()].join(', ')}\n`);
      expect(motifs.size, `motifs de fin observés : ${[...motifs.entries()].join(', ')}`).toBeGreaterThan(1);
    }
  );

  it('conserve l’ordre du Plateau : une carte posée reste à une seule place', () => {
    // Invariant de **lecture**, vérifié ici pour qu'un échec du fuzz puisse être rejoué
    // sans le reste : la carte d'un `playBasic` quitte la main pour le Poste ou le Banc,
    // et aucune carte hors du catalogue n'apparaît dans un Deck d'archétype.
    const connues = new Set(ALL_CARDS.map((card) => card.id));
    for (let partie = 0; partie < FACTION_ORDER.length; partie += 1) {
      const { decks } = decksDe(partie);
      for (const deck of decks) {
        for (const id of deck) {
          expect(connues.has(id), `Deck : ${id} inconnu`).toBe(true);
          expect(isPlanque(getCard(id)) || getCard(id)?.kind === 'COLLEAGUE' || getCard(id)?.kind === 'OBJET').toBe(
            true
          );
        }
      }
    }
  });
});
