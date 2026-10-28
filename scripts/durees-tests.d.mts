/** Types de `scripts/durees-tests.mjs` (D-143 (5), #422), pour ses tests. */
export const SEUIL_SECONDES: number;
export const TOP: number;
export const MARQUEUR: RegExp;
export const LIGNES_EN_TETE: number;

export interface RapportVitest {
  testResults: { name: string; startTime: number; endTime: number }[];
}
export interface DureeFichier {
  fichier: string;
  duree: number;
}

export function classer(rapport: RapportVitest, base?: string): DureeFichier[];
export function sansJustification(
  lignes: DureeFichier[],
  lireFichier: (fichier: string) => string,
): DureeFichier[];
export function tableau(lignes: DureeFichier[], n?: number): string;
