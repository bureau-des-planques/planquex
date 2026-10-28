/** Types de `scripts/worktree-nouveau.mjs` (rétro du 28/10/2026), pour ses tests. */

export interface Plan {
  nom: string | null;
  branche: string;
  depuis: string;
  cible: string;
  erreurs: string[];
}

export function analyserArguments(
  argv: string[],
  options?: { home?: string; depot?: string },
): Plan;

export function verifier(
  plan: Plan,
  options?: { existe?: (cible: string) => boolean; brancheExiste?: (branche: string) => boolean },
): string[];

export function executer(
  plan: Plan,
  options?: {
    cwd?: string;
    lancer?: (argv: string[], cwd: string) => void;
  },
): { cible: string; branche: string; depuis: string };
