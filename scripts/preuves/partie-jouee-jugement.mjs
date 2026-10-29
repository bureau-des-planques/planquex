#!/usr/bin/env node
/**
 * La logique de jugement du harnais de partie au clic (#424), **sans navigateur**.
 *
 * `scripts/preuves/jouer-partie.mjs` pilote Chromium ; ce module dit ce qu'il faut en penser :
 * la partie est-elle finie, chaque action légale a-t-elle un bouton, un clic a-t-il un effet,
 * la cible est-elle vraiment cliquable, et quel geste jouer. Tout est fonction pure sur des
 * données fabriquées : `scripts/preuves/partie-jouee-jugement.test.ts` la fait **mordre** sur des cas
 * fautifs, comme `controlesHauteur` dans `capturer.test.ts`.
 *
 * Les libellés des boutons sont ceux de `describeAction` (`src/pages/Battle.tsx`) : ce fichier
 * les recopie **en un seul endroit**, et un test les confronte à la liste des libellés que le
 * composant rend (voir `partie-jouee-jugement.test.ts`).
 */

/** Les gestes qui se font **en deux temps** : une carte de la main d'abord, puis le bouton de la pose. */
export const GESTES_DE_MAIN = ['playBasic', 'playAction', 'evolve', 'priorityShift'];

/**
 * Le libellé d'un bouton, selon `describeAction` (Battle.tsx). Un préfixe, pas une égalité : le
 * détail (nom de la cible, dégâts) suit le libellé dans le texte du bouton.
 */
const LIBELLES = [
  ['playBasic', /^(Poser au Poste|Mettre au Banc \d+)/],
  ['playAction', /^Jouer (cet Objet|ce Collègue)/],
  ['evolve', /^Faire évoluer/],
  ['priorityShift', /^Changement de priorité/],
  ['attachEnergy', /^Attacher 1 café/],
  ['retreat', /^Rotation/],
  ['ability', /^Talent/],
  ['promoteActive', /^Relève/],
  ['choose', /^Choisir cette carte/],
  ['endTurn', /^(Fin du tour|Passer le tour de la Direction)/],
  ['forfeit', /^Abandonner/]
];

/**
 * Le type d'un bouton, d'après son texte. Une Pression porte le nom de l'attaque (`entry?.name ?? 'Pression'`) :
 * un libellé inconnu est donc une **Pression**, à condition que le bouton porte des dégâts ou un
 * texte qu'aucun libellé connu ne réclame — sinon `null`, et le bouton est signalé.
 */
export function classerBouton(texte) {
  const propre = String(texte ?? '').trim();
  for (const [type, motif] of LIBELLES) if (motif.test(propre)) return type;
  return propre ? 'attack' : null;
}

/** Le nombre d'actions par type, sans le forfait : ce que l'écran doit offrir. */
export function compterParType(actions) {
  const compte = {};
  for (const action of actions) {
    if (action.type === 'forfeit') continue;
    compte[action.type] = (compte[action.type] ?? 0) + 1;
  }
  return compte;
}

/**
 * L'**oracle** : compare ce que le moteur déclare légal à ce que l'écran offre.
 * `legales` : les actions de `legalActions(state)` ; `visibles` : les boutons affichés, déjà
 * classés (`{ type, actif }`). Un bouton désactivé ne compte pas : il n'est pas cliquable.
 * Rend une liste d'anomalies, vide si l'écran offre exactement ce qui est légal.
 */
export function comparerAffordances({ legales, visibles }) {
  const attendu = compterParType(legales);
  const offert = {};
  for (const bouton of visibles) {
    if (!bouton.actif || !bouton.type) continue;
    offert[bouton.type] = (offert[bouton.type] ?? 0) + 1;
  }
  const anomalies = [];
  for (const type of new Set([...Object.keys(attendu), ...Object.keys(offert)])) {
    const a = attendu[type] ?? 0;
    const o = offert[type] ?? 0;
    if (o < a) anomalies.push({ type: 'sans-bouton', geste: type, attendu: a, offert: o });
    if (o > a) anomalies.push({ type: 'bouton-sans-action', geste: type, attendu: a, offert: o });
  }
  return anomalies;
}

/**
 * Ce que la **barre** offre pour les Rotations (#455, D-147) : une seule entrée « Rotation »,
 * quel que soit le nombre de Planqués du Banc. Les cibles sont au panneau du Poste, jugées à part.
 */
export function affordancesDeBarre(actions) {
  let entreeVue = false;
  return actions.filter((action) => {
    if (action.type !== 'retreat') return true;
    if (entreeVue) return false;
    entreeVue = true;
    return true;
  });
}

/**
 * La **cible** d'un clic (#424, « cliquable à son centre ») : visible, active, dans la fenêtre,
 * et l'élément rendu au centre est la cible elle-même ou l'un de ses descendants. Les quatre
 * booléens sont mesurés dans le navigateur ; ici on ne fait que les lire.
 */
export function jugerCible({ visible, actif, dansLaFenetre, dessusEstCible }) {
  const anomalies = [];
  if (!visible) anomalies.push('invisible');
  if (visible && !actif) anomalies.push('desactive');
  if (visible && actif && !dansLaFenetre) anomalies.push('hors-fenetre');
  if (visible && actif && dansLaFenetre && !dessusEstCible) anomalies.push('recouvert');
  return anomalies;
}

/**
 * L'effet d'un clic. `accepte` : le store a enregistré une action de plus (le moteur l'a
 * appliquée). Sans effet : le clic n'a rien déclenché. Silencieux : il a été appliqué, mais le
 * texte de l'écran n'a pas bougé — l'action « parle » si le journal, une valeur ou un bouton change.
 */
export function jugerClic({ accepte, texteAvant, texteApres }) {
  if (!accepte) return 'sans-effet';
  if (normaliser(texteAvant) === normaliser(texteApres)) return 'silencieux';
  return 'ok';
}

const normaliser = (texte) =>
  String(texte ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * La fin de partie, d'après l'écran **et** le moteur. Les deux doivent dire la même chose : un
 * moteur fini sans écran fini est une fin **non affichée** ; un écran fini sans moteur fini, une
 * fin **anticipée**.
 */
export function jugerFinPartie({ tete, notices = [], phaseMoteur }) {
  const termineEcran = /partie terminée/.test(normaliser(tete));
  const termineMoteur = phaseMoteur === 'ended';
  const anomalies = [];
  if (termineMoteur && !termineEcran) anomalies.push('fin-non-affichee');
  if (termineEcran && !termineMoteur) anomalies.push('fin-anticipee');
  const verdict = notices.map(normaliser).find((texte) => /gagn|perd|égalité|l’emporte|remporte/i.test(texte)) ?? null;
  if (termineEcran && termineMoteur && !verdict) anomalies.push('verdict-absent');
  return { terminee: termineEcran && termineMoteur, verdict, anomalies };
}

/**
 * Qui doit jouer : la relève ou le choix en attente d'abord (ils reviennent à leur camp même si le
 * tour du moteur est à l'autre), sinon le camp au trait. Le harnais attend la Direction tant que
 * ce n'est pas le joueur.
 */
export function jouePar(state) {
  if (state.pendingPromotion) return state.pendingPromotion;
  if (state.pendingChoice) return state.pendingChoice.who;
  return state.current;
}

/** Ordre de préférence du joueur de test : la Pression d'abord, le café, puis la fin du tour (#424). */
const ORDRE = [
  'choose',
  'promoteActive',
  'attack',
  'attachEnergy',
  'playBasic',
  'playAction',
  'evolve',
  'ability',
  'retreat',
  'endTurn',
  'priorityShift'
];

/**
 * Le geste à jouer parmi les légaux. Jamais le forfait. Une action déjà **muette** (acceptée sans
 * effet à l'écran) est écartée tant qu'une autre existe : c'est ce qui évite de boucler sur un
 * bouton qui ne dit rien. `null` quand il ne reste que le forfait.
 */
export function choisirAction(legales, muettes = new Set()) {
  const jouables = legales.filter((action) => action.type !== 'forfeit');
  if (jouables.length === 0) return null;
  const libres = jouables.filter((action) => !muettes.has(cle(action)));
  const pool = libres.length > 0 ? libres : jouables;
  let meilleure = pool[0];
  for (const action of pool) {
    if (ORDRE.indexOf(action.type) < ORDRE.indexOf(meilleure.type)) meilleure = action;
  }
  return meilleure;
}

/** L'identité d'une action pour le joueur de test (son type et ses champs). */
export const cle = (action) => JSON.stringify(action);

/**
 * L'index, parmi les actions légales **du même type**, d'une action : le k-ième bouton affiché
 * de ce type correspond à la k-ième action légale. L'ordre d'affichage suit celui du moteur
 * (`legalActions`), et l'oracle le vérifie à chaque tour.
 */
export function rangDansLeType(legales, action) {
  const memes = legales.filter((a) => a.type === action.type);
  return memes.findIndex((a) => cle(a) === cle(action));
}
