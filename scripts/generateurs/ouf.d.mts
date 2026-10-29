/**
 * Les types de `scripts/generateurs/ouf.mjs` — le post-it du mur qui devient une issue (#400).
 *
 * Comme `problemes-connus.d.mts` : le script est du **JavaScript**, et cette déclaration est
 * le contrat de l'import que fait `scripts/generateurs/ouf.test.ts`. Elle ne décrit pas la base : elle
 * décrit ce que la commande demande, compose et rend.
 */

/** L'adresse du dépôt GitHub où le ticket se crée. */
export const DEPOT: string;

/** L'adresse du mur, citée dans le ticket. */
export const URL_MUR: string;

/** La requête de lecture : un post-it par identifiant, en paramètre. */
export const REQUETE_POSTIT: string;

/** Le post-it tel que la requête le demande — le contenu du ticket, `texte` compris. */
export interface PostitDuTicket {
  id: string;
  kind?: string | null;
  titre: string;
  texte: string;
  ecran?: string | null;
  version?: string | null;
  pseudo?: string | null;
  statut?: string | null;
  ticket?: number | null;
  gueulage?: boolean;
  lie?: string | null;
}

/** L'interface étroite de lecture — `pg` en production, PGlite dans les tests. */
export type Lire = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

/** Un client de lecture, tel que `principalOuf` le tient. */
export interface ClientLecture {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end?: () => Promise<void>;
}

/** Ce que le lanceur injecté rend : un code de sortie et la sortie de `gh`. */
export interface ResultatLanceur {
  code: number;
  sortie: string;
}

/** La sortie de la commande, injectable pour un test sans console. */
export interface Sortie {
  log(message: string): void;
  error(message: string): void;
}

/** Le titre d'une issue, tiré du titre du post-it, sur une ligne. */
export function titreDeTicket(postit: Partial<PostitDuTicket> | null | undefined): string;

/** Le corps de l'issue, composé sans réseau. */
export function corpsDeTicket(postit: PostitDuTicket): string;

/** Le contrôle pur : `null` si le post-it peut devenir un ticket, sinon le refus en français. */
export function verifierPostit(ligne: unknown): string | null;

/** Lit un post-it par l'interface étroite. */
export function lirePostit(lire: Lire, id: string): Promise<PostitDuTicket | null>;

/** Les options de la commande. */
export function argumentsOuf(ligne: string[]): {
  id: string | null;
  creer: boolean;
  aide: boolean;
  erreur: string | null;
};

/** Le lanceur `gh` de production — la couture réseau, remplacée dans les tests. */
export function lancerGh(args: string[]): ResultatLanceur;

/** Le numéro d'issue lu dans la sortie de `gh issue create`. */
export function numeroDeIssue(sortie: string): number | null;

/** La commande : rend le code de sortie. `ouvrir` et `lancer` sont injectables. */
export function principalOuf(
  argv?: string[],
  env?: Record<string, string | undefined>,
  options?: {
    ouvrir?: (url: string) => Promise<ClientLecture>;
    lancer?: (args: string[]) => Promise<ResultatLanceur> | ResultatLanceur;
    sortie?: Sortie;
  }
): Promise<number>;
