#!/usr/bin/env node
/**
 * Socle partagé des captures (`scripts/capturer.mjs`) et du harnais de partie au clic
 * (`scripts/jouer-partie.mjs`, #424) : les instants qui fixent la graine, la fenêtre de
 * référence, les gabarits de D-142 et l’amorçage du store. Extrait de `capturer.mjs` tel quel :
 * le comportement des captures ne change pas.
 *
 * `capturer.mjs` exécute sa suite au chargement, donc on ne peut pas l’importer : ce module
 * ne contient que des constantes et une fonction pure.
 */

/**
 * Les instants figés qui fixent la graine d'une partie (`createBattle`, seed = `Date.now()`) :
 * plusieurs donnes, pour que la garde de rendu ne se fie pas à une seule main (#170).
 * Le premier sert à la capture `combat.png`.
 */
export const INSTANTS_COMBAT = [
  Date.UTC(2026, 9, 22, 9, 0),
  Date.UTC(2026, 9, 22, 14, 30),
  Date.UTC(2026, 9, 22, 20, 5),
  Date.UTC(2026, 9, 23, 7, 45)
];

/** La clé du store persisté — `STORAGE_KEY`, `src/store/useStore.ts`. */
export const STORAGE_KEY = 'bureau-des-planques-v1';

/**
 * L'amorçage du store (#150) : le blob que `persist` relit à l'hydratation, avec
 * `tutorielVu: true`. `version` est omise **à dessein** : `persist` ne migre que sur
 * une version **numérique différente** de la sienne (zustand, `middleware.js`), et ce
 * blob ne porte qu'un booléen — aucune forme à migrer, donc aucune version à recopier.
 */
export function amorcageStore(origin, supplement = {}) {
  return {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [{ name: STORAGE_KEY, value: JSON.stringify({ state: { tutorielVu: true, ...supplement } }) }]
      }
    ]
  };
}

/**
 * La **fenêtre d'un téléphone**, telle que le critère (4) de **D-060** la nomme :
 * « on regarde les captures à la taille d'un téléphone (420×900) ». C'est un acte
 * daté, et `AGENTS.md` §2 met les actes au-dessus du code : l'écart
 * `360 × 800` du script était un bug, donc on suit la décision (#153).
 */
export const VIEWPORT = { width: 420, height: 900 };

/**
 * **Les gabarits de D-142** — la fenêtre réelle d'un téléphone, et le PC (28/10/2026).
 *
 * 420 × 900 reste la **référence** (D-060, D-094) : toutes les gardes ci-dessus y tournent. Mais
 * c'est un téléphone sans barre de navigateur ; mesuré le 28/10/2026, le combat défilait de 159 px
 * à 360 × 640 et la barre d'action recouvrait le plateau en paysage. Chaque gabarit joue donc
 * **le combat** (arrivée pas-à-pas ouvert, puis pas-à-pas terminé : arrivée, Pression jouable et
 * pire cas) sous les
 * mêmes gardes — défilement, marge de 20 px, cibles de 44 px — et **chaque page** sous la garde
 * de largeur : une page qui déborde en largeur casse la mise en page (le critère de #128).
 *
 * Les tailles sont relues dans la ligne D-142 de `docs/DECISIONS.md` par `scripts/capturer.test.ts`.
 * `mobile: false` pour le PC : ni `isMobile` ni écran tactile.
 */
export const GABARITS = [
  { nom: 'telephone-petit', viewport: { width: 360, height: 640 }, mobile: true },
  { nom: 'telephone', viewport: { width: 390, height: 664 }, mobile: true },
  { nom: 'paysage-petit', viewport: { width: 740, height: 360 }, mobile: true },
  { nom: 'paysage', viewport: { width: 844, height: 390 }, mobile: true },
  { nom: 'pc', viewport: { width: 1280, height: 800 }, mobile: false }
];
