/**
 * Les types de `scripts/ci/source-protegee.mjs` — la source qu'une mutation doit rendre
 * intacte (#622).
 *
 * Le script est du **JavaScript** (comme les autres du dépôt), et
 * `scripts/ci/source-protegee.test.ts` l'importe pour éprouver la restauration sur un
 * signal. Cette déclaration est le contrat de cet import.
 */

/** Le journal d'une racine de dépôt : la mutation en cours, s'il y en a une. */
export function cheminJournal(racine: string): string;

/**
 * Écrit le journal, puis rend la source d'origine — que l'appelant mute ensuite.
 */
export function proteger(fichier: string, journal: string): string;

/** Oublie la mutation en cours et efface le journal. Rend `true` s'il y avait quelque chose. */
export function terminer(): boolean;

/** Restaure la mutation en cours. Rend `true` s'il y avait quelque chose à restaurer. */
export function restaurer(): boolean;

/**
 * Répare ce qu'une exécution précédente a laissé : restaure depuis le journal et l'efface.
 * Rend le chemin réparé, ou `null` s'il n'y avait rien à réparer.
 */
export function reparerAuDemarrage(journal: string): string | null;

/** Installe les gestionnaires de signal qui restaurent puis sortent en 130. */
export function installerSignaux(options?: {
  signaux?: readonly string[];
  sortie?: (code: number) => void;
  dire?: (message: string) => void;
}): void;
