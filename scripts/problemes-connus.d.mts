/**
 * Les types de `scripts/problemes-connus.mjs` — les problèmes connus d'une release (#299, D-119).
 *
 * Le script est du **JavaScript**, comme les autres outils du dépôt ; cette déclaration est le
 * contrat de l'import que fait `scripts/problemes-connus.test.ts` (même choix que
 * `notes-versions.d.mts` et `plan-dev.d.mts`).
 *
 * Elle ne décrit **pas** la base : `LignePostit` est ce que la requête **demande** — ni `texte`
 * ni `pseudo` — et c'est déjà une garde en soi.
 */

/** Les statuts qui entrent dans la note de version : triés, pas encore corrigés. */
export const STATUTS_PUBLIES: string[];

/** La requête de lecture : `select` seul, sans `texte` ni `pseudo`. */
export const REQUETE_PROBLEMES: string;

/** Une ligne du mur, réduite aux colonnes que la requête demande. */
export interface LignePostit {
  id: string;
  kind?: string | null;
  titre: string;
  statut: string;
  ticket?: number | null;
  gueulage?: boolean;
  lie?: string | null;
  version?: string;
}

/** Une ligne publiée : le titre, et le ticket quand il existe. */
export interface Probleme {
  id: string;
  titre: string;
  ticket: number | null;
}

/** L'interface étroite de lecture — `pg` en production, PGlite dans les tests. */
export type Lire = (sql: string) => Promise<{ rows: Record<string, unknown>[] }>;

/** Un client de lecture, tel que `principalProblemes` le tient. */
export interface ClientLecture {
  query(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
  end?: () => Promise<void>;
}

/** La sortie de la commande, injectable pour un test sans console. */
export interface Sortie {
  log(message: string): void;
  error(message: string): void;
}

/** Le titre d'un post-it, ramené sur une ligne. */
export function nettoyerTitre(titre: unknown): string;

/** Le filtre de D-119, pur : gueulage dehors, IP dehors, statuts non publiés dehors. */
export function filtrerProblemes(lignes: unknown): Probleme[];

/** Le bloc de markdown, **sans titre**, à coller sous « Pour un testeur ». */
export function blocProblemes(problemes: Probleme[]): string;

/** Lit le mur par l'interface étroite, et n'en garde que les problèmes publiables. */
export function lireProblemesConnus(lire: Lire): Promise<Probleme[]>;

/** Le fichier de secrets du poste (hors dépôt). */
export function cheminSecrets(env?: Record<string, string | undefined>): string;

/** La chaîne de connexion du rôle `lecteur` : l'environnement, puis le fichier de secrets. */
export function urlLecteur(env?: Record<string, string | undefined>): string | null;

/** Le rôle d'une chaîne `postgresql://…`, sans le suffixe du pooler. */
export function roleDe(url: string): string;

/** La garde de lecture seule : un message quand le rôle n'est pas `lecteur`, `null` sinon. */
export function verifierLectureSeule(url: string | null): string | null;

/** Les options de la commande. */
export function argumentsProblemes(ligne: string[]): { json: boolean; aide: boolean; erreur: string | null };

/** La commande : rend le code de sortie. `ouvrir` est injectable pour un test sans réseau. */
export function principalProblemes(
  argv?: string[],
  env?: Record<string, string | undefined>,
  options?: { ouvrir?: (url: string) => Promise<ClientLecture>; sortie?: Sortie }
): Promise<number>;
