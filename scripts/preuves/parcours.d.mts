/** Types de `scripts/preuves/parcours.mjs` (#429), pour ses tests et la garde des sorties. */
export const RACINE: string;
export const SEUIL: { readonly aller: number; readonly retour: number };
export const EXCEPTIONS: Readonly<Record<string, string>>;
export const PARCOURS_DEFAUT: ReadonlyArray<{
  libelle: string;
  gestes: ReadonlyArray<{ type: 'clic' | 'attendre'; selecteur: string }>;
}>;
export function routesDeclarees(source: string): string[];
export function cheminInterne(href: string | null): string | null;
export function distancesDepuis(
  graphe: Readonly<Record<string, readonly string[]>>,
  depart: string
): Map<string, number>;
export function evaluerParcours(
  graphe: Readonly<Record<string, readonly string[]>>,
  options?: {
    ecrans: readonly string[];
    exceptions?: Readonly<Record<string, string>>;
    seuil?: { readonly aller: number; readonly retour: number };
    racine?: string;
  }
): { echecs: string[]; aller: number; retour: number };
export function analyserArguments(argv: string[]): { plan: boolean; graphe: string | null; sortie: string };
