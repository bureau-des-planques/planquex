/**
 * La version de l'application, et l'étape où elle en est.
 *
 * **Une seule source** : `package.json` — `version` et `stage`, tous deux injectés au
 * build par `vite.config.ts`. On ne recopie jamais ni un numéro ni un mot d'étape dans
 * un composant : `version.test.ts` échoue si quelqu'un le fait.
 *
 * **Pourquoi l'étape n'est pas dans le numéro** (D-050) : `0.2.0-alpha.2` se lisait
 * « alpha deux », ce que personne ne veut dire. Le numéro est donc une version
 * ordinaire, et l'étape est un mot à côté — `Alpha · 0.2.0`. Une nouvelle build donnée
 * aux testeurs se distingue par **sa version** (une correction monte `0.2.1`), pas par
 * un compteur d'alphas.
 */

/** L'étape, dérivée de `package.json` et validée : le doute retombe sur la plus prudente. */
export type AppStage = 'alpha' | 'beta' | 'release';

const ETAPES: AppStage[] = ['alpha', 'beta', 'release'];

export function asStage(value: string): AppStage {
  return ETAPES.includes(value as AppStage) ? (value as AppStage) : 'alpha';
}

export const APP_VERSION = __APP_VERSION__;
export const APP_STAGE: AppStage = asStage(__APP_STAGE__);

/** Le mot d'étape tel qu'il s'affiche. */
export const APP_STAGE_LABEL: Record<AppStage, string> = {
  alpha: 'Alpha',
  beta: 'Bêta',
  release: 'Version finale'
};

/** Le libellé complet : « Alpha · 0.2.0 ». */
export const APP_LABEL = `${APP_STAGE_LABEL[APP_STAGE]} · ${APP_VERSION}`;
