/**
 * Les types de `scripts/notes-versions.mjs` — le générateur des notes de version (D-090).
 *
 * Le script est du **JavaScript** (comme les autres scripts du dépôt : `capturer.mjs`,
 * `status.mjs`…), et `scripts/notes-versions.test.ts` l'importe pour éprouver sa mise en
 * forme. Cette déclaration est le contrat de cet import : ce que le test a le droit
 * d'appeler, et avec quoi.
 *
 * Elle ne décrit **pas** le fichier engendré (`src/data/versions.ts` a ses propres types,
 * dans le fichier lui-même) : ici, c'est le **générateur**.
 */

/** Une puce du corps d'une release, groupée par son titre de section. */
export interface Groupe {
  /** Le titre de la section (`## Jeu`, ou une ligne en gras) ; `null` avant le premier. */
  titre: string | null;
  points: string[];
}

/** Une release, telle que `gh release view --json …` la rend. */
export interface Release {
  tagName: string;
  name?: string;
  body?: string;
  publishedAt?: string;
  createdAt?: string;
  isDraft?: boolean;
}

/** Une entrée de `src/data/versions.ts`, en mémoire. */
export interface NoteVersion {
  version: string;
  date: string;
  titre: string;
  points: { groupe?: string; texte: string }[];
  brouillon?: boolean;
}

/** Un `gh` injectable : le test n'appelle rien. */
export type Gh = (args: string[]) => any;

/** Le bruit markdown d'un corps de release : on garde la phrase, pas la mise en forme. */
export function nettoyer(texte: string): string;

/** Le corps d'une release, mis en groupes de points ; le message aux testeurs est jeté. */
export function analyserCorps(corps?: string | null): Groupe[];

/** Le titre de la note : le nom de la release après un tiret, sinon un libellé du script. */
export function titreDe(release: Release): string;

/** Une release GitHub → une entrée de `versions.ts`. */
export function entreeDe(release: Release): NoteVersion;

/** Les trois nombres, comparés un à un : `0.1.10` vient après `0.1.9`. */
export function comparer(a: string, b: string): number;

/** Les releases du dépôt, de la plus récente à la plus ancienne. */
export function lireReleases(gh?: Gh): Release[];

/** Les notes écrites d'avance déjà présentes dans le fichier. */
export function brouillonsEnPlace(chemin?: string): Promise<NoteVersion[]>;

/** Le fichier entier : l'en-tête, les types, l'historique, et les deux fonctions. */
export function rendreFichier(notes: NoteVersion[]): string;

/** Les notes à écrire, et ce qui a été gardé ou lu. */
export function construire(
  releases: Release[],
  chemin?: string
): Promise<{ notes: NoteVersion[]; brouillons: NoteVersion[]; surGithub: NoteVersion[] }>;
