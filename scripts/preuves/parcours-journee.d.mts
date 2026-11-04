/** Types de `scripts/preuves/parcours-journee.mjs` (#686), pour ses tests. */
export const GESTES_JOUES: ReadonlyArray<'arrivage' | 'deck' | 'combat' | 'sauvegarde'>;

export interface EtapeDuPlan {
  numero: number;
  total: number;
  titre: string;
  geste: 'arrivage' | 'deck' | 'combat' | 'sauvegarde' | null;
  chemin: string;
  cible: string | null;
  capture: string;
}

export function lireVersionStore(source: string): number;
export function etatInitialJournee(options: { origine: string; version: number }): {
  cookies: [];
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
};
export function nomDeCapture(numero: number, titre: string): string;
export function erreurEtape(etape: Pick<EtapeDuPlan, 'titre' | 'numero' | 'total'>, raison: string): Error;
export function planDeLaJournee(
  etapes: ReadonlyArray<{ titre: string; cible: string; geste?: 'arrivage' | 'deck' | 'combat' | 'sauvegarde' }>,
  cibleDeGeste: Readonly<Partial<Record<string, string>>>,
  cheminDeCible: (cible: string) => string
): EtapeDuPlan[];
export function verifierPlan(plan: EtapeDuPlan[]): EtapeDuPlan[];
export function verifierRoute(etape: EtapeDuPlan, cheminRecu: string): void;
export function verifierTitre(etape: EtapeDuPlan, texteDuPanneau: string): void;
export function verifierCible(etape: EtapeDuPlan, presente: boolean): void;
export function dossierDeCaptures(env: Record<string, string | undefined>, racine?: string, defaut?: string): string;
export function serveurConfigure(env: Record<string, string | undefined>): boolean;
export function chargerReferences(): Promise<{
  etapes: ReadonlyArray<{ titre: string; cible: string; geste?: 'arrivage' | 'deck' | 'combat' | 'sauvegarde' }>;
  cheminDeCible: (cible: string) => string;
  cibleDeGeste: Readonly<Partial<Record<string, string>>>;
  version: number;
}>;
export function parcourir(options: unknown): Promise<unknown[]>;
