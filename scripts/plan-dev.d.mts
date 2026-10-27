/**
 * Les types de `scripts/plan-dev.mjs` — le générateur de ce qui arrive
 * (D-097 (3), #214, #336).
 *
 * Le script est du **JavaScript** (comme `notes-versions.mjs`, `capturer.mjs`…), et
 * `scripts/plan-dev.test.ts` l'importe pour éprouver sa mise en forme. Cette déclaration
 * est le contrat de cet import : ce que le test a le droit d'appeler, et avec quoi.
 *
 * Elle ne décrit **pas** le fichier engendré (`src/data/plan-dev.ts` a ses propres types,
 * dans le fichier lui-même) : ici, c'est le **générateur**.
 */

/** Une étiquette GitHub : son nom, en chaîne ou en objet (`gh` rend les deux formes). */
export type Etiquette = string | { name?: string };

/** Une issue, telle que `gh issue list --json number,title,labels` la rend. */
export interface Issue {
  number?: number | string;
  title?: string;
  labels?: Etiquette[];
}

/** Une entrée de `src/data/plan-dev.ts`, en mémoire. */
export interface FeaturePrevue {
  numero: number;
  titre: string;
  etape: 'alpha' | 'beta';
}

/** Les étapes qui entrent (`alpha` et `beta`) : le label dit le jalon, pas quand on travaille. */
export const ETAPES: string[];

/**
 * Une issue GitHub → une entrée de `plan-dev.ts`. Lève sur une entrée sans titre, sans
 * numéro ou sans étiquette d'étape.
 */
export function entreeDe(issue: Issue): FeaturePrevue;

/** Les issues `alpha` et `beta` ouvertes, de la plus récente à la plus ancienne. */
export function lireIssues(gh?: (args: string[]) => unknown): FeaturePrevue[];

/** Le fichier entier : l'en-tête, le type, la liste. Aucune URL. */
export function rendreFichier(features: FeaturePrevue[]): string;

/**
 * Le contrôle de fraîcheur du `-- --verifie` (#231) : `null` quand le fichier sur le
 * disque est exactement ce que le générateur écrirait, sinon le message qui dit l'écart
 * et la commande à lancer. Exporté pour que le test le confronte à un fichier périmé.
 */
export function divergence(actuel: string, attendu: string): string | null;
