/**
 * La version de l'application, et son étape.
 *
 * **Une seule source** : `package.json` (injecté au build par `vite.config.ts`).
 * On ne recopie jamais un numéro de version dans un composant — `version.test.ts`
 * échoue si quelqu'un le fait.
 *
 * L'étape se **déduit** du numéro, elle ne se saisit pas : `0.2.0-alpha.1` est une
 * alpha, `0.2.0-beta.3` une bêta, `0.2.0` une release. C'est ce qui empêche le mot
 * affiché et le numéro de diverger (décision D-048).
 */

export const APP_VERSION = __APP_VERSION__;

export type AppStage = 'alpha' | 'beta' | 'release';

/** Dérivée du suffixe de préversion semver : `-alpha.1`, `-beta.2`, ou rien. */
export function stageOf(version: string): AppStage {
  const match = /^\d+\.\d+\.\d+-([a-z]+)/.exec(version);
  const stage = match?.[1];
  return stage === 'alpha' || stage === 'beta' ? stage : 'release';
}

export const APP_STAGE: AppStage = stageOf(APP_VERSION);

/** Ce qu'on affiche à l'écran, et ce qu'un testeur doit pouvoir recopier tel quel. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
