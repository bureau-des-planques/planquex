/** Types de `scripts/preuves/e2e-supabase.mjs` (#668), pour ses tests sans réseau. */
export const VARIABLES: {
  readonly email: string;
  readonly motDePasse: string;
  readonly url: string;
  readonly cle: string;
};
export const HOTES_PRODUCTION: readonly string[];
export const STORAGE_KEY: string;

export interface EtatPrepare {
  cookies: unknown[];
  origins: {
    origin: string;
    localStorage: { name: string; value: string }[];
  }[];
}

export interface DiagnosticE2E {
  etat: 'saute' | 'cassee' | 'pret';
  raison?: string;
  email?: string;
  motDePasse?: string;
  url?: string;
  cle?: string;
  hote?: string;
}

export interface Identifiants {
  email: string;
  motDePasse: string;
}

export interface ClientE2E {
  auth: {
    signInWithPassword(options: {
      email: string;
      password: string;
    }): Promise<{
      data: { session: { access_token?: string; refresh_token?: string; user?: { id?: string } } | null };
      error: { message: string } | null;
    }>;
  };
  from(table: string): {
    select(colonnes?: string): {
      eq(colonne: string, valeur: string): Promise<{
        data: { id: string; etat: string; administrateur: boolean }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
}

export function cleSession(url: string): string;
export function etatPrepare(options: {
  origine: string;
  url: string;
  session: unknown;
  supplement?: Record<string, unknown>;
}): EtatPrepare;
export function refuserProduction(url: string): string;
export function diagnosticE2E(env?: Record<string, string | undefined>): DiagnosticE2E;
export function authentifier(
  client: ClientE2E,
  identifiants: Identifiants
): Promise<{ access_token?: string; refresh_token?: string; user?: { id?: string } }>;
export function lireCompteTest(
  client: ClientE2E,
  uid: string
): Promise<{ id: string; etat: string; administrateur: boolean }>;
export function verifierEtatPrepare(etat: unknown): string[];
export function identifiantsVisibles(
  texte: string,
  identifiants: { email?: string; uid?: string; jeton?: string }
): string[];
export function verifierCapturesSansIdentifiant(dossier: string, valeurs: string[]): string[];
export function lancerPreuveE2E(options: {
  env?: Record<string, string | undefined>;
  root?: string;
  outDir?: string;
  executablePath?: string;
  base?: string;
  origine?: string;
  port?: number;
}): Promise<{ saute: boolean; captures?: number }>;
