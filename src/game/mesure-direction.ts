import type { Faction, PlayerId } from '@/data/types';
import type { SearchOptions } from '@/game/ia';
import {
  DEFAULT_MAX_TURNS,
  FACTION_ORDER,
  factionCafeTypes,
  factionDecks,
  jouerPartiePolitiques,
  pairFactions
} from '@/game/simulation';
import { drawRandom, seedRng } from '@/game/rng';

/**
 * **La Direction contre un joueur de référence** (#354, D-134).
 *
 * ## La question
 *
 * La Direction n'a **jamais** été mesurée contre autre chose que le niveau 1 scripté
 * (D-084 : 60,4 % contre le glouton). Or c'est le **joueur** que l'alpha met devant elle
 * (D-048 : « est-ce que ça donne envie de refaire une partie »). Si elle écrase, le testeur
 * arrête ; si elle s'effondre, la partie n'a pas d'enjeu.
 *
 * ## Le protocole, fixé **avant** la mesure (D-134)
 *
 * - **La Direction mesurée** est celle de l'écran : `nextAiAction`, c'est-à-dire la
 *   **recherche à deux coups** (`politique('recherche')`, D-084/D-109). Ses réglages sont
 *   ceux de `DEFAULT_SEARCH_OPTIONS`, avec **`maxMs: Infinity`** : l'échéance murale est la
 *   seule borne **non déterministe** de la décision (#172), et une mesure qu'on ne peut pas
 *   rejouer à l'identique ne vaut pas une mesure. Le plafond de **nœuds** (800) reste : une
 *   décision qui l'atteint rend le repli glouton, et `replis` le dit.
 * - **Le joueur de référence** est **scripté**, pas une IA de production :
 *   `politique('scripte')`, la politique historique de niveau 1 (`nextAction(state, 1)`),
 *   déterministe et publique. Elle ne cherche rien, ne lit aucune carte cachée, et sert de
 *   **repère** : ce n'est pas un modèle de jeu humain, c'est un plancher stable.
 * - **1 000 parties en miroir apparié** : chaque paire joue la **même graine** et le même
 *   appariement de Decks deux fois, la Direction changeant de camp. L'avantage du premier
 *   joueur s'annule, et chaque partie a son jumeau.
 * - **Graines disjointes de celles qui ont choisi la politique** : la graine maîtresse
 *   `20261028` n'est aucune de celles du pesage (#111 : `1, 7, 42, 11, 23` et
 *   `99, 1234, 2024, 777, 31337`). `grainesDisjointes()` le vérifie dans les deux sens, et
 *   c'est un test, pas une intention.
 * - **La bande est fixée d'avance** : **40–60 %** des parties **décidées**, avec
 *   l'**intervalle de confiance à 95 %** (Wilson, qui ne déborde pas de `[0, 1]` et reste
 *   juste sur de petits échantillons, contrairement à Wald).
 *
 * ## Ce que le module rend
 *
 * Le taux, l'intervalle, le **nombre de tours médian**, le taux de parties nulles (dont
 * celles arrêtées à la limite), et le **coût d'une décision de la Direction** — le budget
 * de 100 ms de D-084. Et un **verdict** : dans la bande, ou hors. Hors bande, la
 * `recommandation` dit quoi changer — sans que ce ticket ne change rien (D-134).
 *
 * Ce module **ne joue aucune règle** : il appelle `jouerPartiePolitiques`, qui applique les
 * actions par `applyAction`, comme l'écran.
 */

/** La bande de D-134 : 40 à 60 % des parties décidées. */
export const BANDE_DIRECTION = { bas: 0.4, haut: 0.6 } as const;

/** Le nombre de parties de la mesure complète (D-134). */
export const PARTIES_DIRECTION = 1000;

/**
 * La graine maîtresse de la mesure. Elle produit une graine par paire (`drawRandom`), donc
 * toutes les graines de partie en dérivent : deux lancements donnent le même rapport.
 */
export const GRAINE_MESURE_DIRECTION = 20261028;

/**
 * Les graines qui ont servi à **choisir** la politique (#111, `scripts/pesage.mjs`) :
 * entraînement et contrôle. La mesure de #354 ne doit en réutiliser aucune, sinon elle se
 * juge sur les graines qui ont réglé le candidat.
 */
export const GRAINES_DE_LA_POLITIQUE = [1, 7, 42, 11, 23, 99, 1234, 2024, 777, 31337] as const;

/**
 * Les graines de partie effectivement tirées par la mesure, pour une graine maîtresse et
 * un nombre de paires : c'est ce que `grainesDisjointes()` confronte aux graines de la
 * politique. Exporté pour que la garde lise **le même** tirage que la mesure.
 */
export function grainesDeMesure(graine: number, paires: number): number[] {
  const master = { rng: seedRng(graine) };
  return Array.from({ length: paires }, () => Math.floor(drawRandom(master) * 0x100000000) >>> 0);
}

/**
 * Les graines de la mesure sont-elles **disjointes** de celles de la politique ?
 * Rend la liste des recouvrements (vide = disjoint). La graine maîtresse elle-même est
 * vérifiée : elle ne doit pas être une graine d'entraînement ou de contrôle.
 */
export function grainesDisjointes(
  graine: number = GRAINE_MESURE_DIRECTION,
  paires: number = PARTIES_DIRECTION / 2
): number[] {
  const utilisees = new Set<number>(GRAINES_DE_LA_POLITIQUE);
  const recouvrements = new Set<number>();
  if (utilisees.has(graine)) recouvrements.add(graine);
  for (const seed of grainesDeMesure(graine, paires)) {
    if (utilisees.has(seed)) recouvrements.add(seed);
  }
  return [...recouvrements].sort((a, b) => a - b);
}

/** Une issue de partie, du point de vue de la Direction. */
export type IssueDirection = 'gagnee' | 'perdue' | 'nulle';

export interface PartieDirection {
  /** Index de la paire : les deux sièges d'une paire partagent graine et Decks. */
  paire: number;
  /** Graine réellement passée à `createBattle` (identique aux deux sièges). */
  seed: number;
  /** Siège de la Direction : `ai` au siège A, `player` au siège B. */
  siege: PlayerId;
  /** Faction du Deck de la Direction, et celle du joueur de référence. */
  direction: Faction;
  reference: Faction;
  issue: IssueDirection;
  /** Tours joués (un tour par camp), et la raison de fin. */
  tours: number;
  raison: string;
}

export interface RapportDirection {
  graine: number;
  parties: number;
  paires: number;
  maxTurns: number;
  bande: { bas: number; haut: number };
  /** Parties **décidées** : les nulles ne comptent ni pour ni contre (D-134). */
  decidees: number;
  gagnees: number;
  perdues: number;
  nulles: number;
  /** Nulles arrêtées à la limite de tours : un compte, pas un jugement. */
  nullesALaLimite: number;
  /** Taux de victoire de la Direction **parmi les décidées**. */
  taux: number;
  /** Intervalle de confiance à 95 % (Wilson). */
  intervalle: [number, number];
  /** Tours **médians** des parties jouées (les nulles à la limite comptent : elles ont duré). */
  toursMedians: number;
  /** Tours médians des seules parties **décidées** — l'écart avec la ligne du dessus dit les égalités. */
  toursMediansDecidees: number;
  /** Décisions de la Direction : coups, moyenne, p50, p95, maximum, replis de budget. */
  ia: {
    coups: number;
    msMoyenne: number;
    msP50: number;
    msP95: number;
    msMax: number;
    replis: number;
  };
  /** `true` quand le taux tombe dans la bande (D-134). */
  dansLaBande: boolean;
  /** Ce qu'il faut faire du chiffre — jamais un changement de ce ticket (D-134). */
  recommandation: string;
}

export interface OptionsMesureDirection {
  /** Nombre de parties, **pair** (le miroir joue deux fois chaque paire). Défaut : 1000. */
  parties?: number;
  graine?: number;
  maxTurns?: number;
  factions?: readonly Faction[];
  /** Réglages de la recherche de la Direction. Défaut : `maxMs: Infinity` (rejouable). */
  recherche?: SearchOptions;
  bande?: { bas: number; haut: number };
}

const RECHERCHE_REJOUABLE: SearchOptions = {
  candidates: 6,
  worlds: 3,
  replies: 4,
  maxNodes: 800,
  maxMs: Infinity
};

/** L'intervalle de confiance à 95 % de Wilson, borné à `[0, 1]`. */
export function intervalleWilson(succes: number, total: number, z = 1.96): [number, number] {
  if (!Number.isFinite(total) || total <= 0) return [0, 0];
  const p = succes / total;
  const denominateur = 1 + (z * z) / total;
  const centre = (p + (z * z) / (2 * total)) / denominateur;
  const demi = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominateur;
  return [Math.max(0, centre - demi), Math.min(1, centre + demi)];
}

/** La médiane d'une liste de nombres (moyenne des deux du milieu quand la taille est paire). */
export function mediane(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return 0;
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 0 ? (triees[milieu - 1]! + triees[milieu]!) / 2 : triees[milieu]!;
}

/** Un quantile par la méthode du rang le plus proche (assez pour dire la queue d'un budget). */
export function quantile(valeurs: readonly number[], q: number): number {
  if (valeurs.length === 0) return 0;
  const triees = [...valeurs].sort((a, b) => a - b);
  const index = Math.min(triees.length - 1, Math.max(0, Math.floor(q * triees.length)));
  return triees[index]!;
}

/** Le taux est-il dans la bande ? Une bande inversée ou dégénérée ne fait jamais « oui » par accident. */
export function dansLaBande(taux: number, bande: { bas: number; haut: number }): boolean {
  return Number.isFinite(taux) && taux >= bande.bas && taux <= bande.haut;
}

/**
 * La **recommandation** qui accompagne un taux hors bande (D-134). C'est une phrase, pas
 * une décision : le changement de politique est un ticket à part, avec son acte daté.
 */
export function recommandationDe(
  taux: number,
  bande: { bas: number; haut: number },
  intervalle?: [number, number]
): string {
  if (!Number.isFinite(taux)) return 'Aucune partie décidée : la mesure ne dit rien, la refaire avec plus de parties.';
  const dans = dansLaBande(taux, bande);
  const pourcent = (v: number) => `${(100 * v).toFixed(1)} %`;
  const ic = intervalle ? ` (IC 95 % ${pourcent(intervalle[0])} – ${pourcent(intervalle[1])})` : '';
  if (dans) {
    return `Garder la recherche à deux coups : ${pourcent(taux)} des décidées${ic} tombe dans la bande ${pourcent(bande.bas)} – ${pourcent(bande.haut)}.`;
  }
  if (taux > bande.haut) {
    return `La Direction gagne trop : ${pourcent(taux)} des décidées${ic}, au-dessus de ${pourcent(bande.haut)}. Baisser son niveau — le glouton, ou la recherche sans sa profondeur — avant de mettre des testeurs devant.`;
  }
  return `La Direction perd trop : ${pourcent(taux)} des décidées${ic}, sous ${pourcent(bande.bas)}. Renforcer la politique (évaluation ou profondeur) ou vérifier l'armement des Decks du simulateur (#113) avant de conclure.`;
}

/**
 * **La mesure complète** : `parties` parties en miroir apparié, la Direction jouant la
 * recherche et la référence la politique scriptée.
 *
 * Une paire = une graine tirée de la graine maîtresse = deux parties (Direction au siège
 * `ai`, puis au siège `player`), mêmes Decks des deux côtés. `parties` doit donc être
 * **pair** ; un nombre impair est refusé plutôt qu'arrondi en silence.
 */
export function mesurerDirection(options: OptionsMesureDirection = {}): RapportDirection {
  const parties = options.parties ?? PARTIES_DIRECTION;
  const graine = options.graine ?? GRAINE_MESURE_DIRECTION;
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const bande = options.bande ?? BANDE_DIRECTION;
  const recherche = options.recherche ?? RECHERCHE_REJOUABLE;

  if (!Number.isInteger(parties) || parties <= 0) {
    throw new Error(`Nombre de parties invalide : ${parties}. Il faut un entier ≥ 1.`);
  }
  if (parties % 2 !== 0) {
    throw new Error(`Le miroir apparie les parties : le nombre de parties doit être pair, reçu ${parties}.`);
  }
  if (!Number.isFinite(graine)) throw new Error(`Graine invalide : ${graine}.`);

  const factions = [...(options.factions?.length ? options.factions : FACTION_ORDER)];
  const decks = factionDecks(factions);

  const paires = parties / 2;
  const master = { rng: seedRng(graine) };
  const resultats: PartieDirection[] = [];
  const durees: number[] = [];
  let coups = 0;
  let msTotal = 0;
  let msMax = 0;
  let replis = 0;

  for (let paire = 0; paire < paires; paire += 1) {
    const [premier, second] = pairFactions(factions, paire);
    const gameSeed = Math.floor(drawRandom(master) * 0x100000000) >>> 0;
    for (const siege of ['ai', 'player'] as const) {
      const direction = siege === 'ai' ? premier : second;
      const reference = siege === 'ai' ? second : premier;
      const politiques = {
        player: siege === 'player' ? ('recherche' as const) : ('scripte' as const),
        ai: siege === 'ai' ? ('recherche' as const) : ('scripte' as const)
      };
      const { state, cout } = jouerPartiePolitiques(
        decks.get(direction) ?? [],
        decks.get(reference) ?? [],
        gameSeed,
        politiques,
        {
          maxTurns,
          chrono: siege,
          recherche,
          cafeTypes: {
            playerCafeTypes: factionCafeTypes(siege === 'player' ? direction : reference),
            aiCafeTypes: factionCafeTypes(siege === 'ai' ? direction : reference)
          }
        }
      );
      coups += cout.coups;
      msTotal += cout.msTotal;
      msMax = Math.max(msMax, cout.msMax);
      replis += cout.replis;
      // Une décision = une durée : p50/p95 se lisent sur les décisions, pas sur les parties.
      if (cout.coups > 0) durees.push(cout.msTotal / cout.coups);

      const issue: IssueDirection = state.winner === siege ? 'gagnee' : state.winner === null ? 'nulle' : 'perdue';
      resultats.push({
        paire,
        seed: gameSeed,
        siege,
        direction,
        reference,
        issue,
        tours: Math.min(state.turn, maxTurns),
        raison: String(state.endReason ?? (state.phase === 'ended' ? 'inconnue' : 'arretee'))
      });
    }
  }

  const gagnees = resultats.filter((r) => r.issue === 'gagnee').length;
  const perdues = resultats.filter((r) => r.issue === 'perdue').length;
  const nulles = resultats.filter((r) => r.issue === 'nulle').length;
  const nullesALaLimite = resultats.filter((r) => r.issue === 'nulle' && r.raison === 'limiteDeTours').length;
  const decidees = gagnees + perdues;
  const taux = decidees === 0 ? Number.NaN : gagnees / decidees;
  const intervalle = decidees === 0 ? ([0, 0] as [number, number]) : intervalleWilson(gagnees, decidees);

  return {
    graine,
    parties,
    paires,
    maxTurns,
    bande: { ...bande },
    decidees,
    gagnees,
    perdues,
    nulles,
    nullesALaLimite,
    taux,
    intervalle,
    toursMedians: mediane(resultats.map((r) => r.tours)),
    toursMediansDecidees: mediane(resultats.filter((r) => r.issue !== 'nulle').map((r) => r.tours)),
    ia: {
      coups,
      msMoyenne: coups === 0 ? 0 : Number((msTotal / coups).toFixed(2)),
      msP50: Number(quantile(durees, 0.5).toFixed(2)),
      msP95: Number(quantile(durees, 0.95).toFixed(2)),
      msMax: Number(msMax.toFixed(2)),
      replis
    },
    dansLaBande: dansLaBande(taux, bande),
    recommandation: recommandationDe(taux, bande, intervalle)
  };
}

/**
 * Le rapport lisible en console. **Aucun horodatage** : deux lancements à graine fixe
 * impriment le même texte, octet pour octet.
 */
export function formatRapportDirection(rapport: RapportDirection): string {
  const pourcent = (v: number) => `${(100 * v).toFixed(2)} %`;
  const tours = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return [
    `Mesure de la Direction — ${rapport.parties} parties en miroir (${rapport.paires} paires), graine ${rapport.graine}`,
    `Direction : recherche à deux coups · référence : joueur scripté (niveau 1) · limite ${rapport.maxTurns} tours`,
    '',
    `Parties décidées : ${rapport.decidees} · gagnées ${rapport.gagnees} · perdues ${rapport.perdues} · nulles ${rapport.nulles}` +
      ` (dont ${rapport.nullesALaLimite} à la limite)`,
    `Taux de la Direction : ${pourcent(rapport.taux)} des décidées · IC 95 % ${pourcent(rapport.intervalle[0])} – ${pourcent(rapport.intervalle[1])}`,
    `Tours médians : ${tours(rapport.toursMedians)} (toutes parties) · ${tours(rapport.toursMediansDecidees)} (décidées)`,
    `Décision de la Direction : ${rapport.ia.coups} coups · moyenne ${rapport.ia.msMoyenne} ms · p50 ${rapport.ia.msP50} ms` +
      ` · p95 ${rapport.ia.msP95} ms · max ${rapport.ia.msMax} ms · ${rapport.ia.replis} repli(s) de budget`,
    '',
    `Bande ${pourcent(rapport.bande.bas)} – ${pourcent(rapport.bande.haut)} : ${rapport.dansLaBande ? 'DANS la bande' : 'HORS de la bande'}`,
    `Recommandation : ${rapport.recommandation}`
  ].join('\n');
}
