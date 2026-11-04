/** Types de `scripts/ci/detect-ui-pages.mjs` (#551, #670), pour son test sans navigateur. */
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
/** Le plafond d'un écran, **par règle** (#670) : une table vide veut dire « aucune règle tolérée ». */
export type Plafonds = Record<string, number>;
/** Un écart du cliquet : une règle mesurée **au-dessus** de son plafond. */
export interface Ecart {
  ecran: string;
  regle: string;
  compte: number;
  plafond: number;
  nouvelle: boolean;
}
export function signatureEcran(mesures: SignatureEcran): SignatureEcran;
export function sansMouvement(signature: SignatureEcran | null | undefined): boolean;
export function estCalme(precedente: SignatureEcran | null | undefined, courante: SignatureEcran | null | undefined): boolean;
export function compteParRegle(sortie: string): Record<string, number> | null;
export function compteAntiPatterns(sortie: string): number | null;
export function reglesRefusees(sortie: string): string[];
export function verdict(sortie: string, code?: number): number | null;
export function verdictRegles(sortie: string, code?: number): Record<string, number> | null;
export function messageEchec(ecran: string, compte: number | null, raison?: string, regles?: string[]): string;
export function ecransSansPlafond(
  ecrans: string[],
  baseline: Record<string, Plafonds | number | null | undefined>
): string[];
export function ecartCliquet(
  ecran: string,
  mesure: Record<string, number>,
  baseline: Record<string, Plafonds | number | null | undefined>
): Ecart[];
export function reglesEnBaisse(
  ecran: string,
  mesure: Record<string, number>,
  baseline: Record<string, Plafonds | number | null | undefined>
): { regle: string; compte: number; plafond: number }[];
export function messageEcart(ecran: string, ecarts: Ecart[]): string;
export function controlePlan(plan: {
  ecrans: string[];
  baseline: Record<string, Plafonds | number | null | undefined>;
  mesure?: Record<string, Record<string, number>>;
}): { sansPlafond: string[]; ecarts: Ecart[]; echec: boolean };
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
export const BASELINE: Record<string, Plafonds>;
