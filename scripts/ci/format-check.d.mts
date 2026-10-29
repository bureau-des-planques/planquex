/** Types de `scripts/ci/format-check.mjs` (#422, D-143), pour ses tests. */
export const RACINE: string;
export const MOTIFS: string[];
export function binairePrettier(racine?: string): string | null;
export function versionDemandee(racine?: string): string | null;
export function messageAbsent(racine?: string, version?: string | null): string;
