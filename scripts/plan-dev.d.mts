/**
 * Les types de `scripts/plan-dev.mjs` — le générateur des fonctionnalités prévues
 * (D-097 (3), #214).
 *
 * Le script est du **JavaScript** (comme `notes-versions.mjs`, `capturer.mjs`…), et
 * `scripts/plan-dev.test.ts` l'importe pour éprouver sa mise en forme. Cette déclaration
 * est le contrat de cet import : ce que le test a le droit d'appeler, et avec quoi.
 *
 * Elle ne décrit **pas** le fichier engendré (`src/data/plan-dev.ts` a ses propres types,
 * dans le fichier lui-même) : ici, c'est le **générateur**.
 */

/** Une issue, telle que `gh issue list --json number,title` la rend. */
export interface Issue {
  number?: number | string;
  title?: string;
}

/** Une entrée de `src/data/plan-dev.ts`, en mémoire. */
export interface FeaturePrevue {
  numero: number;
  titre: string;
}

/** Le libellé des issues qui entrent (`alpha`). */
export const LABEL: string;

/** Une issue GitHub → une entrée de `plan-dev.ts`. Lève sur une entrée sans titre ou sans numéro. */
export function entreeDe(issue: Issue): FeaturePrevue;

/** Les issues `alpha` ouvertes, de la plus récente à la plus ancienne. */
export function lireIssues(gh?: (args: string[]) => any): FeaturePrevue[];

/** Le fichier entier : l'en-tête, le type, la liste. Aucune URL. */
export function rendreFichier(features: FeaturePrevue[]): string;
