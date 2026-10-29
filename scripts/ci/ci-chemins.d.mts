/** Types de `scripts/ci/ci-chemins.mjs` (D-143, #422), pour ses tests. */
export function estCheminDoc(chemin: string): boolean;
export function docSeulement(chemins: string[]): boolean;
export function litUnDocument(source: string): boolean;
export function testsQuiLisentLesDocs(): { node: string[]; ui: string[] };
