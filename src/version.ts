/**
 * La version de l'application, et l'étape où elle en est.
 *
 * **Une seule source** : `package.json` — `version` et `stage`, tous deux injectés au
 * build par `vite.config.ts`. On ne recopie jamais ni un numéro ni un mot d'étape dans
 * un composant : `version.test.ts` échoue si quelqu'un le fait.
 *
 * **Pourquoi l'étape n'est pas dans le numéro** (D-050, complétée par D-152) :
 * `0.2.0-alpha.2` se lisait « alpha deux », ce que personne ne veut dire. Le numéro
 * reste une version ordinaire dans `package.json` (`0.2.0`), et l'étape est un mot
 * **en suffixe** du libellé — `v0.2.0-alpha`. Une nouvelle build donnée aux testeurs se
 * distingue par **sa version** (une correction monte `0.2.1`), pas par un compteur
 * d'alphas.
 */

/** L'étape, dérivée de `package.json` et validée : le doute retombe sur la plus prudente. */
export type AppStage = 'alpha' | 'beta' | 'release';

const ETAPES: AppStage[] = ['alpha', 'beta', 'release'];

export function asStage(value: string): AppStage {
  return ETAPES.includes(value as AppStage) ? (value as AppStage) : 'alpha';
}

export const APP_VERSION = __APP_VERSION__;
export const APP_STAGE: AppStage = asStage(__APP_STAGE__);

/**
 * Le libellé complet : **`v0.2.0-alpha`** — le numéro, puis l'étape en suffixe (D-152,
 * 29/10/2026). En `release`, il n'y a **pas** de suffixe : `v1.0.0`.
 *
 * C'est le même mot que le tag et que la release : le testeur recopie **une** chose, et
 * elle se lit partout de la même façon (Réglages, release, tag).
 */
export const APP_LABEL = APP_STAGE === 'release' ? `v${APP_VERSION}` : `v${APP_VERSION}-${APP_STAGE}`;
