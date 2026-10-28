/** Types de `scripts/tests-lents.mjs` (#422, D-143 (5)), pour ses tests. */
export const RACINE: string;
export const SEUIL_SECONDES: number;
export const MARQUE: string;
export const DOCUMENT: string;
export const TAILLE: number;

export interface Ligne {
  fichier: string;
  secondes: number;
  tests: number;
}

export interface RapportVitest {
  testResults?: { name: string; startTime?: number; endTime?: number; assertionResults?: unknown[] }[];
}

export function justifie(source: string): boolean;
export function classement(rapport: RapportVitest): Ligne[];
export function lire(racine: string, fichier: string): string | null;
export function sansJustification(
  racine: string,
  lignes: Ligne[],
  seuil?: number
): { fichier: string; secondes: number; raison: string }[];
export function rendre(lignes: Ligne[], options?: { date?: string; seuil?: number }): string;
export function lignesPubliees(texte: string): Ligne[];
export function mesurer(racine?: string, args?: string[]): Ligne[] | null;
