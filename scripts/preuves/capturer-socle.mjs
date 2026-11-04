#!/usr/bin/env node
/**
 * Socle partagé des captures (`scripts/preuves/capturer.mjs`) et du harnais de partie au clic
 * (`scripts/preuves/jouer-partie.mjs`, #424) : les instants qui fixent la graine, la fenêtre de
 * référence, les gabarits de D-171 et l’amorçage du store. Extrait de `capturer.mjs` tel quel :
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
 * La clé de session de Supabase dans `localStorage` (#668) : `sb-<ref>-auth-token`, où
 * `<ref>` est le premier label de l'hôte du projet. C'est la formule de
 * `@supabase/supabase-js` (lue dans `node_modules/@supabase/supabase-js`, pas une
 * convention maison) ; la recopier ici évite d'ouvrir un navigateur pour la retrouver.
 */
export function cleSession(url) {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

/**
 * L'état préparé d'une preuve E2E (#668) : un `storageState` de Playwright qui porte la
 * session du compte de test **et** l'amorçage du store. `version` est omise **à dessein**,
 * comme dans `amorcageStore` : elle vit dans `src/store/useStore.ts`, et un blob qui ne
 * porte qu'un booléen n'a aucune forme à migrer.
 */
export function etatPrepare({ origine, url, session, supplement = {} }) {
  return {
    cookies: [],
    origins: [
      {
        origin: origine,
        localStorage: [
          { name: cleSession(url), value: JSON.stringify(session) },
          { name: STORAGE_KEY, value: JSON.stringify({ state: { tutorielVu: true, ...supplement } }) }
        ]
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

/** Défilement vertical du document, jamais négatif. Partagé avec la garde de l'accueil. */
export function defilementVertical(documentHeight, viewportHeight) {
  return Math.max(0, documentHeight - viewportHeight);
}

/** Les sections principales de l'accueil restent entièrement dans la fenêtre, sous la navigation. */
export function controlesAccueil({ documentHeight, viewportHeight, limite, sections }) {
  const problemes = [];
  const defilement = defilementVertical(documentHeight, viewportHeight);
  if (defilement > 0) problemes.push(`document défile de ${defilement} px`);
  for (const { nom, present, haut, bas } of sections) {
    if (present && (haut < 0 || bas > limite))
      problemes.push(`${nom} sort de la fenêtre utilisable (${haut} → ${bas}, limite ${limite})`);
  }
  return problemes;
}

/**
 * **Les gabarits de D-171** — les téléphones en portrait et le PC (01/11/2026).
 *
 * 420 × 900 reste la **référence** (D-060, D-094) : toutes les gardes ci-dessus y tournent. Mais
 * c'est un téléphone sans barre de navigateur ; D-171 ajoute 360 × 640 et 390 × 664 en portrait.
 * Chaque gabarit joue donc
 * **le combat** (arrivée pas-à-pas ouvert, puis pas-à-pas terminé : arrivée, Pression jouable et
 * pire cas) sous les
 * mêmes gardes — défilement, marge de 20 px, cibles de 44 px — et **chaque page** sous la garde
 * de largeur : une page qui déborde en largeur casse la mise en page (le critère de #128).
 *
 * Les tailles sont relues dans D-171 et D-158 de `docs/DECISIONS.md` par `scripts/preuves/capturer.test.ts`.
 * `mobile: false` pour le PC : ni `isMobile` ni écran tactile.
 */
export const GABARITS = [
  { nom: 'telephone-petit', viewport: { width: 360, height: 640 }, mobile: true },
  { nom: 'telephone', viewport: { width: 390, height: 664 }, mobile: true },
  { nom: 'pc', viewport: { width: 1280, height: 800 }, mobile: false },
  // D-158 (#520) : le grand écran, où le combat grandit avec la hauteur et la console porte le journal.
  { nom: 'grand-ecran', viewport: { width: 1920, height: 1080 }, mobile: false },
  // **D-173 (#580)** : le **Pixel 7** en navigation — 412 × 915 CSS, hauteur utile ≈ 800–820. C'est
  // la bande 700–860 px, qui n'avait aucun gabarit à largeur téléphone (390 × 664 est en dessous,
  // 420 × 900 au-dessus) et donc aucune taille propre. Le navigateur reste couvert par un seul
  // gabarit, le pire cas réel (390 × 664) : « PWA d'abord, navigateur en plancher ».
  { nom: 'telephone-android', viewport: { width: 412, height: 810 }, mobile: true }
];
