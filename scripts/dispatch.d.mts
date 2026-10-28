/** Types de `scripts/dispatch.mjs` (rétro du 28/10/2026), pour ses tests. */

export interface Options {
  ticket: string | null;
  agent: string;
  branche: string;
  worktree: string;
  decision: boolean;
  json: boolean;
  erreurs: string[];
}

export interface Ticket {
  number: number;
  title: string;
  body: string;
  labels: Array<string | { name: string }>;
}

export function prochainNumero(journal: string): string;

export function analyserArguments(argv: string[], options?: { racine?: string }): Options;

export function composer(entree: {
  ticket: Ticket;
  agent: string;
  branche: string;
  worktree: string;
  decision: string | null;
  depot?: string;
}): string;

export function lireTicket(numero: number | string, options?: { lancer?: (argv: string[]) => string }): Ticket;
