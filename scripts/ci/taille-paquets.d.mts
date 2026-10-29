/** Types de `scripts/ci/taille-paquets.mjs` (#480), pour ses tests. */
export const SEUIL_PAQUET: number;
export const PLAFOND_PRINCIPAL: number;

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
