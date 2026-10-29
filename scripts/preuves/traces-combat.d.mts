/**
 * Les types de `scripts/preuves/traces-combat.mjs` — la lecture des traces de combat (#358).
 *
 * Le script est du **JavaScript**, comme les autres outils du dépôt ; cette déclaration est
 * le contrat de l'import que fait `scripts/preuves/traces-combat.test.ts` (même choix que
 * `problemes-connus.d.mts`).
 *
 * Elle ne décrit **pas** la table : `TraceCombat` est ce que la requête **demande** — pas
 * d'`auteur`, donc aucune donnée de compte — et c'est déjà une garde en soi.
 */

/** La requête de lecture : la période et la limite sont des paramètres, jamais concaténées. */
export const REQUETE_TRACES: string;

/** Le nombre de jours par défaut de la période. */
export const JOURS_PAR_DEFAUT: number;

/** Le nombre maximal de traces rejouées par défaut. */
export const LIMITE_PAR_DEFAUT: number;

/** Une ligne de `public.combats`, réduite aux colonnes que la requête demande. */
export interface TraceCombat {
  id?: number | string;
  mode?: string | null;
  graine: number;
  decks?: { playerDeck?: unknown; aiDeck?: unknown } | null;
  types_cafe?: { playerCafeTypes?: unknown; aiCafeTypes?: unknown } | null;
  journal?: unknown;
}

/** Le bilan d'un lot de traces, tel que `src/game/traces.ts` le rend. */
export interface BilanTraces {
  parties: number;
  parMode: { solo: number; pvp: number };
  terminees: number;
  abandons: number;
  illisibles: number;
  issues: { joueur: number; direction: number; nulle: number };
  tauxVictoireSolo: number | null;
  soloDecidees: number;
  tours: { mediane: number; min: number; max: number };
  aLaLimite: number;
  forfaits: number;
  interventionsMoyennes: { joueur: number; direction: number };
  craquagesParPartie: number;
  cartesPlusJouees: Array<{ carte: string; parties: number }>;
  cartesJamaisJouees: string[];
  detail: unknown[];
}

/** Un client de lecture, tel que la commande le tient. */
export interface ClientLecture {
  query(sql: string, params?: unknown[]): Promise<{ rows: TraceCombat[] }>;
  end?: () => Promise<void>;
}

/** La sortie de la commande, injectable pour un test sans console. */
export interface Sortie {
  log(message: string): void;
  error(message: string): void;
}

/** Les options de la commande. */
export function argumentsTraces(ligne: string[]): {
  jours: number;
  limite: number;
  json: boolean;
  aide: boolean;
  erreur: string | null;
};

/** Le fichier de secrets du poste (hors dépôt). */
export function cheminSecrets(env?: Record<string, string | undefined>): string;

/** La chaîne de connexion du rôle `lecteur` : l'environnement, puis le fichier de secrets. */
export function urlLecteur(env?: Record<string, string | undefined>): string | null;

/** Le rôle d'une chaîne `postgresql://…`, sans le suffixe du pooler. */
export function roleDe(url: string): string;

/** La garde de lecture seule : un message quand le rôle n'est pas `lecteur`, `null` sinon. */
export function verifierLectureSeule(url: string | null): string | null;

/** Le compte rendu humain, court. */
export function compteRendu(bilan: BilanTraces, options?: { jours?: number }): string;

/**
 * La commande : rend le code de sortie. `ouvrir` et `agreger` sont injectables pour un test
 * sans base ni réseau.
 */
export function principalTraces(
  argv?: string[],
  env?: Record<string, string | undefined>,
  options?: {
    ouvrir?: (url: string) => Promise<ClientLecture>;
    agreger?: (lignes: TraceCombat[]) => BilanTraces;
    sortie?: Sortie;
  }
): Promise<number>;
