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

/**
 * Ce qu'un refus **explicite** d'Arrivage dit à l'écran (D-179 (6)) : sans backend, l'ouverture
 * est refusée, et c'est un état prévu, pas une panne. `capturer.mjs` attend donc **la scène ou
 * ce refus**, et lui seul décide qu'une absence de scène est un échec (#707).
 */
export const REFUS_ARRIVAGE = /serveur du jeu n’est pas configuré|Connecte-toi pour ouvrir/;

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

/** Plancher du texte porteur d'information de la pochette (`DESIGN.md` §1.5). */
const PLANCHER_POUCHETTE = 11.2;
/** Seuil AA pour du texte courant (`DESIGN.md` §1.5). */
const SEUIL_AA = 4.5;

/**
 * Lit une couleur déjà résolue par le navigateur (`getComputedStyle`). Les surfaces mesurées
 * sont des aplats opaques ; le texte, lui, peut être composé sur son aplat de fond.
 */
function composantesCouleur(valeur) {
  const hex = valeur.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const brut = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return { rgb: [0, 2, 4].map((i) => Number.parseInt(brut.slice(i, i + 2), 16)), alpha: 1 };
  }

  const rgb = valeur.trim().match(/^rgba?\((.*)\)$/i);
  if (!rgb) throw new TypeError(`Couleur non prise en charge : ${valeur}`);
  const [canaux, transparence] = rgb[1].split('/').map((part) => part.trim());
  const morceaux = canaux.split(/[\s,]+/).filter(Boolean);
  const alphaBrut = transparence ?? morceaux[3] ?? '1';
  if (morceaux.length < 3) throw new TypeError(`Couleur RGB incomplète : ${valeur}`);
  const canal = (part) => {
    const n = Number.parseFloat(part);
    return part.endsWith('%') ? (n / 100) * 255 : n;
  };
  const alpha = alphaBrut.endsWith('%') ? Number.parseFloat(alphaBrut) / 100 : Number.parseFloat(alphaBrut);
  const resultat = { rgb: morceaux.slice(0, 3).map(canal), alpha };
  if (!resultat.rgb.every(Number.isFinite) || !Number.isFinite(alpha)) {
    throw new TypeError(`Couleur RGB invalide : ${valeur}`);
  }
  return resultat;
}

/** Luminance relative WCAG 2.1, sur un canal sRGB 0–255. */
function luminanceCanal(canal) {
  const sRGB = canal / 255;
  return sRGB <= 0.04045 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
}

/** Luminance WCAG relative d'une couleur RGB. */
function luminance(rgb) {
  const poids = [0.2126, 0.7152, 0.0722];
  return rgb.reduce((sum, canal, index) => sum + luminanceCanal(canal) * poids[index], 0);
}

/** Rapport de contraste WCAG 2.1 entre deux couleurs calculées par le navigateur. */
export function contraste(texte, fond) {
  const premierPlan = composantesCouleur(texte);
  const arrierePlan = composantesCouleur(fond);
  if (arrierePlan.alpha !== 1) throw new TypeError(`Fond non opaque : ${fond}`);
  const compose = premierPlan.rgb.map(
    (canal, index) => canal * premierPlan.alpha + arrierePlan.rgb[index] * (1 - premierPlan.alpha)
  );
  const lTexte = luminance(compose);
  const lFond = luminance(arrierePlan.rgb);
  return (Math.max(lTexte, lFond) + 0.05) / (Math.min(lTexte, lFond) + 0.05);
}

/** Les constats qu'une capture ajoute au rapport quand une mesure de pochette échoue. */
export function problemesPochette(mesures) {
  const problemes = [];
  for (const { texte, taille, ratio } of mesures) {
    if (!Number.isFinite(taille) || taille < PLANCHER_POUCHETTE) {
      problemes.push(
        `texte « ${texte} » rendu à ${Number.isFinite(taille) ? taille.toFixed(2) : 'une taille inconnue'} px, ` +
          `${PLANCHER_POUCHETTE} px exigés`
      );
    }
    if (!Number.isFinite(ratio) || ratio < SEUIL_AA) {
      problemes.push(
        `contraste de « ${texte} » à ${Number.isFinite(ratio) ? ratio.toFixed(2) : 'un ratio inconnu'}:1, ` +
          `${SEUIL_AA}:1 exigés`
      );
    }
  }
  return problemes;
}

/** Un refus réseau est attendu seulement dans la capture qui coupe volontairement la connexion. */
export function erreurConsoleAttendue(preparation, message) {
  return preparation === 'collection-hors-ligne' && message.includes('net::ERR_INTERNET_DISCONNECTED');
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
