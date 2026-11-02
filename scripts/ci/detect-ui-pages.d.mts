/** Types de `scripts/ci/detect-ui-pages.mjs` (#551), pour son test de stabilisation. */
export interface JournalMesure {
  opacite: number;
  y: number;
  hauteur: number;
}
export interface SignatureEcran {
  html: number;
  hauteur: number;
  journaux: JournalMesure[];
}
export function signatureEcran(mesures: SignatureEcran): SignatureEcran;
export function sansMouvement(signature: SignatureEcran | null | undefined): boolean;
export function estCalme(precedente: SignatureEcran | null | undefined, courante: SignatureEcran | null | undefined): boolean;
export function compteAntiPatterns(sortie: string): number | null;
export function reglesRefusees(sortie: string): string[];
export function verdict(sortie: string, code?: number): number | null;
export function messageEchec(ecran: string, compte: number | null, raison?: string, regles?: string[]): string;
export function ecransSansPlafond(
  ecrans: string[],
  baseline: Record<string, number | null>
): string[];
export function recouvreEcran(
  rect: { x: number; y: number; largeur: number; hauteur: number } | undefined,
  viewport: { largeur: number; hauteur: number } | undefined
): boolean;
export function verdictSonde(mesures?: {
  texte?: number;
  calques?: { selecteur?: string; rect?: { x: number; y: number; largeur: number; hauteur: number } }[];
  viewport?: { largeur: number; hauteur: number };
}): { muet: boolean; raison: string | null };
export const ECRANS: string[];
export const BASELINE: Record<string, number>;
