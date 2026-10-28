import type { Faction, PlayerId } from '@/data/types';
import { DEFAULT_SEARCH_OPTIONS } from '@/game/ia';
import type { Politique, SearchOptions } from '@/game/ia';
import {
  DEFAULT_MAX_TURNS,
  FACTION_ORDER,
  factionCafeTypes,
  factionDecks,
  jouerPartiePolitiques,
  pairFactions
} from '@/game/simulation';
import { TURN_LIMIT } from '@/game/rules';
import { drawRandom, seedRng } from '@/game/rng';

/**
 * **La Direction contre un joueur de référence** (#354, D-134 ; remesurée par #411).
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
 * - **La politique de la Direction est un paramètre** (`politique`, défaut `'recherche'`),
 *   et ses réglages **dérivent** de `DEFAULT_SEARCH_OPTIONS` (`RECHERCHE_REJOUABLE`) au
 *   lieu d'être recopiés : recopiés, ils auraient continué à mesurer une recherche que plus
 *   personne ne joue dès qu'un réglage bougeait (défaut corrigé par #411). La **référence**,
 *   elle, ne se paramètre pas : c'est le mètre.
 *
 * ## Ce que le module rend
 *
 * Le taux, l'intervalle, le **nombre de tours médian**, le taux de parties nulles (dont
 * celles arrêtées à la limite **du moteur**, 30 tours — `maxTurns`, 200, n'est qu'un arrêt
 * d'urgence inatteignable), le **coût** et le **travail** (nœuds) d'une décision de la
 * Direction, et **où** elle gagne : par archétype, par type de fin, par tranche de tours
 * (#411). Et un **verdict** : dans la bande, ou hors. Hors bande, la `recommandation` dit
 * quoi changer (D-134) — le changement lui-même est un acte, pas une conséquence de la
 * mesure.
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

/**
 * Un taux **par clé** — le « où » du chiffre global (#411) : la moyenne ne dit pas
 * quoi corriger, la ligne qui la porte, si.
 */
export interface TauxDirection {
  parties: number;
  decidees: number;
  gagnees: number;
  perdues: number;
  nulles: number;
  /** Victoires / décidées ; `NaN` quand aucune partie n'est décidée (jamais 0 par défaut). */
  taux: number;
}

/** Le taux **par faction de la Direction** : l'archétype qui la porte gagne-t-il plus ? */
export interface LigneFaction extends TauxDirection {
  faction: Faction;
}

/** Le taux **par type de fin** (`endReason` du moteur) : où la partie se conclut, et comment. */
export interface LigneFin extends TauxDirection {
  raison: string;
}

/** Le taux **par tranche de tours** : un taux qui ne tient que sur les parties longues se voit ici. */
export interface LigneTour extends TauxDirection {
  tranche: string;
}

/**
 * Les tranches de tours du rapport. La dernière s'arrête à `TURN_LIMIT` (30, D-031) :
 * le moteur rend la main en égalité au-delà, donc une partie ne peut pas durer plus.
 */
export const TRANCHES_DE_TOURS: readonly { debut: number; fin: number }[] = [
  { debut: 1, fin: 10 },
  { debut: 11, fin: 20 },
  { debut: 21, fin: TURN_LIMIT }
];

/** La tranche d'une partie de `tours` tours, ou `null` hors bornes (ne devrait pas arriver). */
export function trancheDeTours(tours: number): string | null {
  const tranche = TRANCHES_DE_TOURS.find((t) => tours >= t.debut && tours <= t.fin);
  return tranche ? `${tranche.debut}–${tranche.fin}` : null;
}

export interface RapportDirection {
  graine: number;
  parties: number;
  paires: number;
  maxTurns: number;
  /** La limite **du moteur** (`TURN_LIMIT`, D-031) : c'est elle qui arrête les égalités, pas `maxTurns`. */
  limiteMoteur: number;
  /** La politique jouée par la Direction dans cette mesure (`recherche` par défaut). */
  politique: Politique;
  /** Les réglages de recherche réellement appliqués à la Direction. */
  recherche: SearchOptions;
  bande: { bas: number; haut: number };
  /** Parties **décidées** : les nulles ne comptent ni pour ni contre (D-134). */
  decidees: number;
  gagnees: number;
  perdues: number;
  nulles: number;
  /**
   * Nulles arrêtées à la **limite de tours du moteur** (`TURN_LIMIT`, 30 tours, D-031) :
   * un compte, pas un jugement. Ce n'est **pas** `maxTurns`, qui n'est qu'un arrêt
   * d'urgence du harnais : le moteur rend la main avant, donc `maxTurns` ne mord jamais
   * une partie réelle (#411).
   */
  nullesALaLimite: number;
  /** Nulles coupées **par le harnais** (`maxTurns`) : attendu à 0, c'est une sentinelle. */
  nullesAuHarnais: number;
  /** Le **où** du chiffre : par archétype, par type de fin, par tranche de tours (#411). */
  parFaction: LigneFaction[];
  parFin: LigneFin[];
  parTour: LigneTour[];
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
    /** Nœuds consommés au total, et par décision — la **densité de travail**, hors charge machine. */
    noeuds: number;
    noeudsParDecision: number;
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
  /**
   * Politique de la Direction. Défaut : `'recherche'` (celle de l'écran, D-084) — c'est
   * la variante qu'on fait varier quand on cherche à rentrer dans la bande (#411), la
   * référence scriptée, elle, ne change jamais.
   */
  politique?: Politique;
  /** Réglages de la recherche de la Direction. Défaut : `RECHERCHE_REJOUABLE`. */
  recherche?: SearchOptions;
  bande?: { bas: number; haut: number };
}

/**
 * Les réglages **de la mesure** : ceux de l'écran (`DEFAULT_SEARCH_OPTIONS`), à une
 * exception près — `maxMs: Infinity`, qui neutralise la seule borne **non déterministe**
 * de la décision (#172).
 *
 * ⚠️ Cette constante **dérive** des défauts, elle ne les recopie pas (correction #411) :
 * recopiée, elle aurait mesuré une recherche (6 candidats / 3 mondes / 4 réponses /
 * 800 nœuds) que plus personne ne jouait dès qu'un réglage changeait à l'écran — la
 * mesure aurait alors prouvé la force d'une politique **morte**. C'est un test qui le
 * garde (`mesure-direction.test.ts`).
 */
export const RECHERCHE_REJOUABLE: SearchOptions = { ...DEFAULT_SEARCH_OPTIONS, maxMs: Infinity };

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
 * Le taux d'un **sous-ensemble** de parties — la brique des agrégats par archétype, par
 * type de fin et par tranche de tours (#411). Une liste vide rend un taux `NaN`, jamais
 * `0` : « aucune partie décidée » n'est pas « 0 % de victoires ».
 */
export function tauxDe(resultats: readonly PartieDirection[]): TauxDirection {
  const compte = (issue: IssueDirection) => resultats.filter((r) => r.issue === issue).length;
  const gagnees = compte('gagnee');
  const perdues = compte('perdue');
  const decidees = gagnees + perdues;
  return {
    parties: resultats.length,
    decidees,
    gagnees,
    perdues,
    nulles: compte('nulle'),
    taux: decidees === 0 ? Number.NaN : gagnees / decidees
  };
}

/**
 * L'ordre des types de fin dans le rapport : les trois façons de conclure une partie
 * (`interventions` à 3 points, `plateauVide`, `limiteDeTours` — D-031), puis le forfait
 * (jamais produit par une politique, D-030) et les deux cas d'anomalie (`arretee` par le
 * harnais, `inconnue`). Les raisons non prévues suivent, dans l'ordre alphabétique, pour
 * qu'une fin nouvelle apparaisse au lieu d'être noyée.
 */
const ORDRE_DES_FINS = ['interventions', 'plateauVide', 'limiteDeTours', 'forfait', 'arretee', 'inconnue'] as const;

function ordreDesFins(resultats: readonly PartieDirection[]): string[] {
  const vues = new Set(resultats.map((r) => r.raison));
  const connues = ORDRE_DES_FINS.filter((raison) => vues.has(raison));
  const autres = [...vues].filter((r) => !(ORDRE_DES_FINS as readonly string[]).includes(r)).sort();
  return [...connues, ...autres];
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
  const nom: Politique = options.politique ?? 'recherche';

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
  let noeuds = 0;

  for (let paire = 0; paire < paires; paire += 1) {
    const [premier, second] = pairFactions(factions, paire);
    const gameSeed = Math.floor(drawRandom(master) * 0x100000000) >>> 0;
    for (const siege of ['ai', 'player'] as const) {
      const direction = siege === 'ai' ? premier : second;
      const reference = siege === 'ai' ? second : premier;
      const politiques = {
        player: siege === 'player' ? nom : ('scripte' as const),
        ai: siege === 'ai' ? nom : ('scripte' as const)
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
      noeuds += cout.noeuds;
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

  const global = tauxDe(resultats);
  const { decidees, gagnees, perdues, nulles, taux } = global;
  const nullesALaLimite = resultats.filter((r) => r.issue === 'nulle' && r.raison === 'limiteDeTours').length;
  const nullesAuHarnais = resultats.filter((r) => r.issue === 'nulle' && r.raison === 'arretee').length;
  const intervalle = decidees === 0 ? ([0, 0] as [number, number]) : intervalleWilson(gagnees, decidees);

  return {
    graine,
    parties,
    paires,
    maxTurns,
    limiteMoteur: TURN_LIMIT,
    politique: nom,
    recherche: { ...recherche },
    bande: { ...bande },
    decidees,
    gagnees,
    perdues,
    nulles,
    nullesALaLimite,
    nullesAuHarnais,
    parFaction: factions.map((faction) => ({
      faction,
      ...tauxDe(resultats.filter((r) => r.direction === faction))
    })),
    parFin: ordreDesFins(resultats).map((raison) => ({
      raison,
      ...tauxDe(resultats.filter((r) => r.raison === raison))
    })),
    parTour: TRANCHES_DE_TOURS.map(({ debut, fin }) => ({
      tranche: `${debut}–${fin}`,
      ...tauxDe(resultats.filter((r) => trancheDeTours(r.tours) === `${debut}–${fin}`))
    })),
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
      replis,
      noeuds,
      noeudsParDecision: coups === 0 ? 0 : Number((noeuds / coups).toFixed(2))
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
  const pourcent = (v: number) => (Number.isFinite(v) ? `${(100 * v).toFixed(2)} %` : '—');
  const tours = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const reglages = rapport.recherche;
  const ligne = (cle: string, t: TauxDirection) =>
    `${cle.padEnd(16)}${String(t.parties).padStart(7)}${String(t.decidees).padStart(10)}${String(t.gagnees).padStart(9)}` +
    `${String(t.nulles).padStart(8)}${pourcent(t.taux).padStart(10)}`;
  const entete = `${''.padEnd(16)}${'Parties'.padStart(7)}${'Décidées'.padStart(10)}${'Gagnées'.padStart(9)}${'Nulles'.padStart(8)}${'Taux'.padStart(10)}`;

  return [
    `Mesure de la Direction — ${rapport.parties} parties en miroir (${rapport.paires} paires), graine ${rapport.graine}`,
    `Direction : ${rapport.politique} (candidats ${reglages.candidates} / mondes ${reglages.worlds} / réponses ${reglages.replies}` +
      ` / nœuds ${reglages.maxNodes}) · référence : joueur scripté (niveau 1)`,
    `Limites : ${rapport.limiteMoteur} tours (moteur, D-031) · ${rapport.maxTurns} tours (harnais, arrêt d'urgence)`,
    '',
    `Parties décidées : ${rapport.decidees} · gagnées ${rapport.gagnees} · perdues ${rapport.perdues} · nulles ${rapport.nulles}` +
      ` (dont ${rapport.nullesALaLimite} à la limite du moteur, ${rapport.nullesAuHarnais} au harnais)`,
    `Taux de la Direction : ${pourcent(rapport.taux)} des décidées · IC 95 % ${pourcent(rapport.intervalle[0])} – ${pourcent(rapport.intervalle[1])}`,
    `Tours médians : ${tours(rapport.toursMedians)} (toutes parties) · ${tours(rapport.toursMediansDecidees)} (décidées)`,
    `Décision de la Direction : ${rapport.ia.coups} coups · moyenne ${rapport.ia.msMoyenne} ms · p50 ${rapport.ia.msP50} ms` +
      ` · p95 ${rapport.ia.msP95} ms · max ${rapport.ia.msMax} ms · ${rapport.ia.replis} repli(s) de budget`,
    `Travail par décision : ${rapport.ia.noeudsParDecision} nœud(s) en moyenne (${rapport.ia.noeuds} au total)` +
      ' — un compte, comparable d’un poste à l’autre',
    '',
    'Où elle gagne — par archétype (faction du Deck de la Direction)',
    entete,
    ...rapport.parFaction.map((f) => ligne(f.faction, f)),
    '',
    'Par type de fin (raison du moteur)',
    entete,
    ...rapport.parFin.map((f) => ligne(f.raison, f)),
    '',
    'Par tranche de tours',
    entete,
    ...rapport.parTour.map((t) => ligne(t.tranche, t)),
    '',
    `Bande ${pourcent(rapport.bande.bas)} – ${pourcent(rapport.bande.haut)} : ${rapport.dansLaBande ? 'DANS la bande' : 'HORS de la bande'}`,
    `Recommandation : ${rapport.recommandation}`
  ].join('\n');
}
