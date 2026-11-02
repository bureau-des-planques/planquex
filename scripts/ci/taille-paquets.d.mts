/** Types de `scripts/ci/taille-paquets.mjs` (#480, #581), pour ses tests. */
export const SEUIL_PAQUET: number;
export const PLAFOND_PRINCIPAL: number;
export const DELTA_MAX_SANS_ASSUME: number;

export interface Paquet {
  /** Le nom du fichier, `index-<hash>.js`, `react-<hash>.js`… */
  nom: string;
  /** La taille minifiée, en octets. */
  octets: number;
  /** La taille gzip, en octets. */
  gzip: number;
}

export interface Mesures {
  /** Les paquets, du plus gros au plus petit. */
  paquets: Paquet[];
  total: number;
  plusGros: Paquet | null;
  /** Les paquets « index-*.js » : il doit y en avoir un seul, le morceau d'entrée. */
  principaux: Paquet[];
  principal: Paquet | null;
}

export interface Seuils {
  seuil?: number;
  plafond?: number;
}

export function enKb(octets: number): string;
export function paquetsDe(dossier?: string): Paquet[];
export function mesurer(paquets: Paquet[]): Mesures;
export function verdict(mesures: Mesures, seuils?: Seuils): string[];
export function plusRecent(chemins: string[]): number;
export function estPerime(options?: { dist?: string; racine?: string; sources?: string[] }): boolean;
export function plan(): string;

/** Ce que le relevé du cliquet (#581) doit faire, et son refus s'il y en a un. */
export interface Releve {
  releve: boolean;
  delta: number;
  octets: number;
  raison: string;
  /** Le message de refus : sans raison, ou delta au-delà de 5 000 octets sans `assume`. */
  refus?: string;
}

export function dateCourte(date: Date): string;
export function ligneReleve(options: { delta: number; octets: number; raison: string; date: Date }): string;
export function deciderReleve(options: {
  octets: number;
  plafond?: number;
  raison?: string;
  assume?: boolean;
}): Releve;
export function releveDansSource(
  source: string,
  options: { octets: number; delta: number; raison: string; date: Date }
): string;
