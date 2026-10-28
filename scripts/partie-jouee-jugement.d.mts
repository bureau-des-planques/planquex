/**
 * Les types de `scripts/partie-jouee-jugement.mjs` — le jugement du harnais de partie au clic (#424).
 *
 * Comme `ouf.d.mts` : le script est du **JavaScript**, et cette déclaration est le contrat de
 * l'import que fait `scripts/partie-jouee-jugement.test.ts`.
 */

/** Les gestes qui se font en deux temps : une carte de la main, puis le bouton de la pose. */
export const GESTES_DE_MAIN: readonly string[];

/** Un bouton d'action, tel que l'écran l'affiche, réduit à son type et à son état. */
export interface BoutonVu {
  type: string;
  actif: boolean;
}

/** Une action du moteur, réduite à ce que le jugement lit. */
export interface ActionMoteur {
  type: string;
  uid?: string;
  slot?: string | number;
  targetUid?: string;
  benchIndex?: number;
  cafe?: string;
}

/** Le type d'un bouton d'après son texte, ou `null` si le texte est vide. */
export function classerBouton(texte: string): string | null;

/** Le nombre d'actions par type, sans le forfait. */
export function compterParType(actions: readonly ActionMoteur[]): Record<string, number>;

/** L'oracle : ce que le moteur déclare légal, contre ce que l'écran offre. */
export function comparerAffordances(entree: {
  legales: readonly ActionMoteur[];
  visibles: readonly BoutonVu[];
}): { type: string; geste: string; attendu: number; offert: number }[];

/** Une cible cliquable à son centre : les anomalies relevées. */
export function jugerCible(mesure: {
  visible: boolean;
  actif: boolean;
  dansLaFenetre: boolean;
  dessusEstCible: boolean;
}): string[];

/** L'effet d'un clic. */
export function jugerClic(entree: {
  accepte: boolean;
  texteAvant: string;
  texteApres: string;
}): 'ok' | 'silencieux' | 'sans-effet';

/** La fin de partie, d'après l'écran et le moteur. */
export function jugerFinPartie(entree: { tete: string; notices?: string[]; phaseMoteur: string }): {
  terminee: boolean;
  verdict: string | null;
  anomalies: string[];
};

/** Le geste à jouer parmi les légaux, sans le forfait. */
export function choisirAction<A extends ActionMoteur>(legales: readonly A[], muettes?: Set<string>): A | null;

/** L'identité d'une action pour le joueur de test. */
export const cle: (action: ActionMoteur) => string;

/** Le rang d'une action parmi les légales de son type. */
export function rangDansLeType(legales: readonly ActionMoteur[], action: ActionMoteur): number;

/** Qui doit jouer : la relève ou le choix en attente, sinon le camp au trait. */
export function jouePar(state: {
  current: string;
  pendingPromotion?: string | null;
  pendingChoice?: { who: string } | null;
}): string;
