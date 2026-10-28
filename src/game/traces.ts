import type { BattleAction, CafeType, EndReason } from '@/data/types';
import { rejouer } from '@/game/rejeu';
import type { EnveloppeRejeu } from '@/game/rejeu';

/**
 * **Lire les traces de combat** (#358) — la boucle de jeu tient-elle, et où ?
 *
 * Le jeu dépose une trace à la fin de chaque partie terminée (#173, D-086, D-105) : graine,
 * deux Decks, types de café, journal. Le poste de pilotage n'en faisait qu'un `count(*)`.
 * Ce module **rejoue** chaque trace et en tire ce qui répond à la question de D-048 :
 *
 * - combien de parties, et dans quel **mode** (solo contre la Direction, PvP) ;
 * - combien sont **terminées**, combien s'arrêtent avant la fin (journal tronqué), combien
 *   ne se rejouent pas (trace illisible) ;
 * - qui gagne, **tours médians**, parties arrêtées à la **limite**, **forfaits** ;
 * - les **Interventions** et les **craquages** par partie ;
 * - les cartes **les plus jouées** et celles **qui ne sortent jamais**.
 *
 * **Rien d'un compte n'y entre** : la trace ne porte ni pseudo ni courriel (D-086), et ce
 * module ne lit même pas `auteur`. Une trace reste anonyme ici — c'est une partie, pas une
 * personne.
 *
 * **Pur et sans réseau** : il reçoit des lignes (`decks`, `types_cafe`, `journal`, `mode`
 * tels que `public.combats` les stocke) et rend un bilan. Le rejeu est celui du jeu
 * (`rejouer`, `@/game/rejeu`) : une trace qui ne se rejoue pas **est dite** au lieu d'être
 * comptée comme une partie finie.
 */

/** Une ligne de `public.combats`, telle que la lit le script (aucun champ de compte). */
export interface TraceCombat {
  id?: number | string;
  mode?: string | null;
  graine: number;
  decks?: { playerDeck?: unknown; aiDeck?: unknown } | null;
  types_cafe?: { playerCafeTypes?: unknown; aiCafeTypes?: unknown } | null;
  journal?: unknown;
}

/** Ce qu'une trace dit, une fois rejouée. */
export interface PartieLue {
  id: number | string | null;
  mode: 'solo' | 'pvp';
  /** Issue du point de vue du **joueur** (`player`) : c'est lui qui compte dans l'alpha. */
  issue: 'joueur' | 'direction' | 'nulle' | 'abandon' | 'illisible';
  tours: number;
  /** Raison de fin : celle du moteur, ou « journal-tronque » / « rejeu-refuse ». */
  raison: EndReason | 'journal-tronque' | 'rejeu-refuse' | 'inconnue-du-moteur';
  /** Interventions marquées par chaque camp. */
  interventions: { joueur: number; direction: number };
  /** Craquages observés dans le journal (tous camps confondus). */
  craquages: number;
  /** Identifiants de cartes **jouées** dans la partie (posées, évoluées, Actions, cafés). */
  cartesJouees: string[];
}

export interface BilanTraces {
  /** Traces lues. */
  parties: number;
  parMode: { solo: number; pvp: number };
  /** Parties arrivées à une fin (`phase === 'ended'`) et rejouables. */
  terminees: number;
  /** Parties dont le journal s'arrête avant la fin : la trace est là, la partie non. */
  abandons: number;
  /** Traces qui ne se rejouent pas (journal incohérent, Deck illégal) : elles ne comptent pas. */
  illisibles: number;
  /** Issues côté joueur, sur les parties terminées. */
  issues: { joueur: number; direction: number; nulle: number };
  /** Taux de victoire du joueur **contre la Direction**, sur les parties solo terminées et décidées. */
  tauxVictoireSolo: number | null;
  /** Parties solo terminées dont l'issue est décidée (ni nulle, ni abandon). */
  soloDecidees: number;
  tours: { mediane: number; min: number; max: number };
  /** Parties arrêtées à la limite de tours (une égalité, D-030). */
  aLaLimite: number;
  /** Forfaits déclarés dans le journal (une défaite, D-030). */
  forfaits: number;
  /** Moyennes par partie terminée, arrondies au centième. */
  interventionsMoyennes: { joueur: number; direction: number };
  craquagesParPartie: number;
  /** Les cartes les plus jouées : nombre de **parties** où elles sortent. */
  cartesPlusJouees: Array<{ carte: string; parties: number }>;
  /**
   * Les cartes présentes dans un Deck de trace mais **jamais jouées** dans aucune partie —
   * c'est la question « quelles cartes ne sortent jamais » du ticket.
   */
  cartesJamaisJouees: string[];
  /** Les parties, dans l'ordre reçu : la commande peut les détailler sans relire la base. */
  detail: PartieLue[];
}

/** Une liste de chaînes, ou une liste vide : une trace abîmée ne doit pas lever. */
function listeDe(valeur: unknown): string[] {
  return Array.isArray(valeur) ? valeur.filter((item): item is string => typeof item === 'string') : [];
}

/** Les actions du journal, tolérantes à une trace abîmée. */
function actionsDe(journal: unknown): BattleAction[] {
  return Array.isArray(journal) ? (journal.filter((item) => item && typeof item === 'object') as BattleAction[]) : [];
}

/**
 * La carte derrière un `uid` d'instance : les instances d'un Deck neuf portent leur place
 * (`p12` → `playerDeck[12]`, `a3` → `aiDeck[3]`, `engine.ts`). Un `uid` inconnu rend `null`
 * plutôt que d'inventer une carte.
 */
function carteDeUid(uid: unknown, decks: { playerDeck: string[]; aiDeck: string[] }): string | null {
  if (typeof uid !== 'string') return null;
  const prefixe = uid.slice(0, 1);
  const index = Number(uid.slice(1));
  if (!Number.isInteger(index) || index < 0) return null;
  const deck = prefixe === 'p' ? decks.playerDeck : prefixe === 'a' ? decks.aiDeck : null;
  return deck ? (deck[index] ?? null) : null;
}

/** Les types d'action qui font **sortir** une carte du Deck ou de la main. */
const ACTIONS_DE_CARTE = new Set(['playBasic', 'evolve', 'playAction', 'attachEnergy']);

/**
 * Rejoue **une** trace et rend ce qu'elle dit. Une trace illisible (journal incohérent,
 * Deck illégal) rend `issue: 'illisible'` avec `raison: 'rejeu-refuse'` : elle est comptée
 * comme telle, jamais comme une partie gagnée ou perdue.
 */
export function lireTrace(trace: TraceCombat): PartieLue {
  const mode: 'solo' | 'pvp' = trace.mode === 'pvp' ? 'pvp' : 'solo';
  const decks = {
    playerDeck: listeDe(trace.decks?.playerDeck),
    aiDeck: listeDe(trace.decks?.aiDeck)
  };
  const actions = actionsDe(trace.journal);
  const enveloppe: EnveloppeRejeu = {
    seed: Number(trace.graine),
    playerDeck: decks.playerDeck,
    aiDeck: decks.aiDeck,
    playerCafeTypes: listeDe(trace.types_cafe?.playerCafeTypes) as CafeType[],
    aiCafeTypes: listeDe(trace.types_cafe?.aiCafeTypes) as CafeType[],
    actions
  };

  const vide: PartieLue = {
    id: trace.id ?? null,
    mode,
    issue: 'illisible',
    tours: 0,
    raison: 'rejeu-refuse',
    interventions: { joueur: 0, direction: 0 },
    craquages: 0,
    cartesJouees: []
  };

  let rejeu;
  try {
    rejeu = rejouer(enveloppe, { deuxCamps: mode === 'pvp' });
  } catch {
    return vide;
  }
  const state = rejeu.state;
  if (!rejeu.ok || state === null) return vide;

  // Les cartes sorties : chaque action de carte nomme l'instance, l'instance nomme la carte.
  const cartesJouees: string[] = [];
  for (const action of actions) {
    if (!ACTIONS_DE_CARTE.has(action.type)) continue;
    const uid = 'uid' in action ? action.uid : null;
    const carte = carteDeUid(uid, decks);
    if (carte && !cartesJouees.includes(carte)) cartesJouees.push(carte);
  }

  if (state.phase !== 'ended') {
    // Le journal s'arrête avant la fin : la trace est là, la partie non (abandon côté client,
    // ou trace d'une version antérieure). C'est un **compte**, pas une partie jouée.
    return {
      ...vide,
      issue: 'abandon',
      raison: 'journal-tronque',
      tours: state.turn,
      interventions: {
        joueur: state.players.player.points,
        direction: state.players.ai.points
      },
      craquages: craquagesDe(state.actionLog),
      cartesJouees
    };
  }

  return {
    id: vide.id,
    mode,
    issue: state.winner === 'player' ? 'joueur' : state.winner === 'ai' ? 'direction' : 'nulle',
    tours: state.turn,
    raison: state.endReason ?? 'inconnue-du-moteur',
    interventions: {
      joueur: state.players.player.points,
      direction: state.players.ai.points
    },
    craquages: craquagesDe(state.actionLog),
    cartesJouees
  };
}

/** Les craquages observés : un `fait` par craquage, jamais une lecture de phrase (D-086). */
function craquagesDe(journal: ReadonlyArray<{ faits?: readonly { type?: string }[] }>): number {
  let total = 0;
  for (const entree of journal) {
    for (const fait of entree.faits ?? []) if (fait.type === 'craquage') total += 1;
  }
  return total;
}

/** La médiane d'une liste d'entiers (moyenne des deux du milieu quand la taille est paire). */
function mediane(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return 0;
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 0 ? (triees[milieu - 1]! + triees[milieu]!) / 2 : triees[milieu]!;
}

/**
 * **Le bilan d'un lot de traces** : le compte rendu court attendu par #358. Aucune ligne de
 * compte n'est lue, aucune n'est rendue.
 *
 * Les cartes « jamais jouées » sont celles qui **entrent dans un Deck tracé** sans sortir
 * dans aucune partie du lot : c'est la question utile (une carte qui ne sort jamais ne pèse
 * sur aucune partie), et elle se dit avec sa définition pour ne pas se lire de travers.
 */
export function bilanTraces(traces: readonly TraceCombat[]): BilanTraces {
  const detail = traces.map((trace) => lireTrace(trace));
  const terminees = detail.filter(
    (partie) => partie.issue === 'joueur' || partie.issue === 'direction' || partie.issue === 'nulle'
  );
  const abandons = detail.filter((partie) => partie.issue === 'abandon').length;
  const illisibles = detail.filter((partie) => partie.issue === 'illisible').length;

  const issues = {
    joueur: terminees.filter((p) => p.issue === 'joueur').length,
    direction: terminees.filter((p) => p.issue === 'direction').length,
    nulle: terminees.filter((p) => p.issue === 'nulle').length
  };
  const soloTerminees = terminees.filter((p) => p.mode === 'solo');
  const soloDecidees = soloTerminees.filter((p) => p.issue === 'joueur' || p.issue === 'direction').length;
  const tauxVictoireSolo =
    soloDecidees === 0 ? null : soloTerminees.filter((p) => p.issue === 'joueur').length / soloDecidees;

  const tours = terminees.map((p) => p.tours);
  const somme = (valeur: (p: PartieLue) => number) => terminees.reduce((total, p) => total + valeur(p), 0);
  const arrondi = (valeur: number) => Math.round(valeur * 100) / 100;

  // Les cartes : celles qui **entrent dans un Deck tracé**, et celles qui en sortent.
  const dansLesDecks = new Set<string>();
  for (const trace of traces) {
    for (const carte of listeDe(trace.decks?.playerDeck)) dansLesDecks.add(carte);
    for (const carte of listeDe(trace.decks?.aiDeck)) dansLesDecks.add(carte);
  }
  const partiesParCarte = new Map<string, number>();
  for (const partie of detail) {
    for (const carte of partie.cartesJouees) partiesParCarte.set(carte, (partiesParCarte.get(carte) ?? 0) + 1);
  }
  const cartesPlusJouees = [...partiesParCarte.entries()]
    .map(([carte, parties]) => ({ carte, parties }))
    // Ordre stable : le nombre de parties, puis l'identifiant (jamais l'ordre d'un `Map`).
    .sort((x, y) => y.parties - x.parties || (x.carte < y.carte ? -1 : x.carte > y.carte ? 1 : 0))
    .slice(0, 20);
  const cartesJamaisJouees = [...dansLesDecks].filter((carte) => !partiesParCarte.has(carte)).sort();

  return {
    parties: traces.length,
    parMode: {
      solo: detail.filter((p) => p.mode === 'solo').length,
      pvp: detail.filter((p) => p.mode === 'pvp').length
    },
    terminees: terminees.length,
    abandons,
    illisibles,
    issues,
    tauxVictoireSolo,
    soloDecidees,
    tours: {
      mediane: mediane(tours),
      min: tours.length === 0 ? 0 : Math.min(...tours),
      max: tours.length === 0 ? 0 : Math.max(...tours)
    },
    aLaLimite: terminees.filter((p) => p.raison === 'limiteDeTours').length,
    forfaits: terminees.filter((p) => p.raison === 'forfait').length,
    interventionsMoyennes: {
      joueur: terminees.length === 0 ? 0 : arrondi(somme((p) => p.interventions.joueur) / terminees.length),
      direction: terminees.length === 0 ? 0 : arrondi(somme((p) => p.interventions.direction) / terminees.length)
    },
    craquagesParPartie: terminees.length === 0 ? 0 : arrondi(somme((p) => p.craquages) / terminees.length),
    cartesPlusJouees,
    cartesJamaisJouees,
    detail
  };
}
