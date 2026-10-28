#!/usr/bin/env node
/**
 * **Jouer une partie entière au clic** — PROTOTYPE JETABLE (branche `prototype/partie-jouee`).
 *
 * ## La question
 *
 * Peut-on jouer une partie entière au clic, dans un vrai navigateur, **de façon
 * reproductible** — et **en combien de temps** ? La durée par partie est le livrable :
 * sans elle, on ne sait pas combien de combinaisons (les 10 × 10 archétypes) on peut se
 * permettre de mesurer pour de vrai.
 *
 * ## La méthode
 *
 * Le patron est `scripts/capturer.mjs` (même binaire Chromium, même `vite preview`, même
 * amorçage du store avant navigation). Ce qui s'ajoute :
 *
 * 1. **Amorce déterministe** — l'horloge est figée (`page.clock.setFixedTime`) avant la
 *    navigation, donc `createBattle(deck, deck, Date.now())` reçoit **toujours la même
 *    graine**. Même graine + mêmes Decks = même partie.
 * 2. **Le harnais clique, le moteur juge.** L'écran n'expose pas son `BattleState`
 *    (aucun crochet dans `src/`, et on n'en ajoute pas). L'oracle passe donc par le seul
 *    état que l'écran **écrit** : `partie` dans le store persisté (`enveloppeDe`, #249).
 *    On la relit à chaque action et on la **rejoue** en Node (`rejouer`) : on obtient
 *    l'état exact, donc `legalActions(state)` — ce que le moteur déclare légal.
 * 3. **Trois mesures** :
 *    - (a) la partie **finit-elle** ? Un clic sans effet en 3 s, ou un tour bloqué, est un
 *      **échec nommé** avec sa capture ;
 *    - (b) toute action légale a-t-elle **un bouton** visible, activé et cliquable à son
 *      centre (`elementFromPoint`) ?
 *    - (c) l'action **parle-t-elle** ? après un clic accepté (journal qui grandit), le
 *      journal, la piste d'Interventions, la main ou les boutons doivent avoir bougé.
 *
 * ## Ce que le prototype ne fait pas
 *
 * Il ne touche pas `src/`, n'ajoute aucune dépendance, ne s'exécute pas en CI, et n'entre
 * pas dans `package.json` : `node scripts/jouer.mjs`, c'est tout.
 *
 * Usage :
 *   npm run build && node scripts/jouer.mjs
 *   BASE_URL=http://localhost:5178 node scripts/jouer.mjs   (serveur déjà lancé)
 *   CHROME_PATH=/chemin/vers/chrome node scripts/jouer.mjs
 *   PARTIES=3 node scripts/jouer.mjs                        (nombre de combinaisons)
 *   MENUS=0 node scripts/jouer.mjs                          (sauter la mesure des menus)
 *   SEULE=atelier node scripts/jouer.mjs                    (une combinaison, pour vérifier le déterminisme)
 *
 * Sortie : `captures/jouer/rapport.json` + `captures/jouer/rapport.md` + les captures.
 * `captures/` est ignoré par git : ce sont des preuves de travail.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer as createViteServer, preview } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'captures/jouer');
const distIndex = join(root, 'dist/index.html');

/** Le binaire du cache `ms-playwright`, surchargeable (`CHROME_PATH`), comme `capturer.mjs`. */
const executablePath =
  process.env.CHROME_PATH ?? join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');

/** La fenêtre d'un téléphone, la taille que D-060 nomme (420 × 900). */
const VIEWPORT = { width: 420, height: 900 };

const PORT = Number(process.env.PORT ?? 4190);
const base = process.env.BASE_URL ?? `http://localhost:${PORT}`;
let origine = '';
try {
  origine = new URL(base).origin;
} catch {
  stop(`BASE_URL n'est pas une URL absolue : « ${base} ».`);
}

/* ------------------------------------------------------------------ */
/* Les trois combinaisons (prototype : 3, pas 45)                      */
/* ------------------------------------------------------------------ */

/**
 * Une **combinaison** = un Deck d'archétype au siège `player`, et une graine fixe.
 *
 * Le siège adverse n'est **pas** paramétrable : `Battle.tsx` joue toujours `testDeck()`
 * contre la Direction (`src/pages/Battle.tsx`, `createBattle(playerDeck, testDeck(), …)`),
 * et on ne modifie pas `src/`. « Archétype contre Direction » est donc, ici, « archétype
 * contre le Deck de démonstration » — c'est une limite du prototype, dite dans le rapport.
 */
const COMBINAISONS = [
  { nom: 'management', faction: 'MANAGEMENT', instant: Date.UTC(2026, 9, 28, 9, 0) },
  { nom: 'qvt', faction: 'QVT', instant: Date.UTC(2026, 9, 28, 12, 30) },
  { nom: 'atelier', faction: 'ATELIER', instant: Date.UTC(2026, 9, 28, 16, 45) }
];
const nbParties = Math.max(1, Math.min(COMBINAISONS.length, Number(process.env.PARTIES ?? 3)));
/** `SEULE=<nom>` : ne jouer qu'une combinaison (mise au point d'une divergence). */
const seule = process.env.SEULE ?? null;

/** Les bornes de temps, en millisecondes. Elles nomment un échec, elles ne le masquent pas. */
const DEAD_CLICK_MS = 3000;
/** Le temps laissé à l'IA pour jouer son tour (600 ms par action, plus les animations). */
const AI_TURN_MS = 45000;
/** La durée au-delà de laquelle une partie est dite **bloquée** (échec (a)). */
const GAME_MS = 300000;

/* ------------------------------------------------------------------ */
/* Les outils                                                          */
/* ------------------------------------------------------------------ */

const problems = [];

function stop(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function ms(iso) {
  return new Date(iso).toISOString();
}

function mediane(valeurs) {
  if (valeurs.length === 0) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 === 1 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
}

function arrondi(valeur, chiffres = 1) {
  const facteur = 10 ** chiffres;
  return Math.round(valeur * facteur) / facteur;
}

/* ------------------------------------------------------------------ */
/* Les modules du jeu, chargés par Vite (SSR) : l'oracle               */
/* ------------------------------------------------------------------ */

/**
 * Node ne sait pas lire le TypeScript ni l'alias `@/` du projet. Vite, si : `ssrLoadModule`
 * transforme les modules exactement comme le build. On obtient le **vrai** moteur, pas une
 * copie — c'est ce qui fait de l'oracle un oracle.
 */
let moteur;
let donnees;
let rejeu;
let simulation;
let STORAGE_KEY;

async function chargerModules(vite) {
  moteur = await vite.ssrLoadModule('/src/game/engine.ts');
  donnees = await vite.ssrLoadModule('/src/data/index.ts');
  rejeu = await vite.ssrLoadModule('/src/game/rejeu.ts');
  simulation = await vite.ssrLoadModule('/src/game/simulation.ts');
  // La clé du store : lue à sa source (`STORAGE_KEY`), jamais recopiée.
  const store = await vite.ssrLoadModule('/src/store/useStore.ts');
  STORAGE_KEY = store.STORAGE_KEY;
}

/* ------------------------------------------------------------------ */
/* L'oracle : relire l'enveloppe persistée et la rejouer               */
/* ------------------------------------------------------------------ */

/**
 * Lit `partie` dans le store persisté de la page. `null` = aucune partie rangée : soit
 * rien n'est encore écrit, soit la partie est **terminée** (`partieSauvegardee` rend
 * `null` quand `phase === 'ended'`, `src/store/partie.ts`).
 */
async function lirePartie(page) {
  const brut = await page.evaluate((cle) => window.localStorage.getItem(cle), STORAGE_KEY);
  if (!brut) return { lisible: false, partie: null };
  const blob = JSON.parse(brut);
  return { lisible: true, partie: blob?.state?.partie ?? null };
}

/** Le cache du rejeu : rejouer à chaque lecture est O(n²) sur la partie, pour rien. */
function creerOracle() {
  const cache = new Map();
  return {
    /**
     * Rend `{ state, verdict }`. `state` est `null` quand il n'y a rien à rejouer (partie
     * terminée) ou quand le rejeu est refusé — le verdict dit lequel.
     */
    resoudre(partie) {
      if (!partie) return { state: null, verdict: 'aucune-partie' };
      const cle = `${partie.seed}:${partie.actions.length}`;
      if (cache.has(cle)) return cache.get(cle);
      const verdict = rejeu.rejouer(partie);
      const resolu = verdict.ok
        ? { state: verdict.state, verdict: 'ok' }
        : { state: null, verdict: `rejeu-refuse:${verdict.raison}` };
      cache.set(cle, resolu);
      return resolu;
    }
  };
}

/* ------------------------------------------------------------------ */
/* Ce que l'écran propose — lu dans le DOM                             */
/* ------------------------------------------------------------------ */

/**
 * Les zones où l'écran rend des actions (`Battle.tsx`) :
 * - `.combat-barre` : la barre du tour (fin de tour, gestes du Poste, Pressions, attache, relève, choix) ;
 * - `.pose` : le panneau de pose, qui n'existe **qu'après** avoir choisi une carte de la main ;
 * - `.hand` : les cartes de la main, qui portent le premier temps d'un geste à deux temps.
 */
const ZONES = [
  ['barre', '.combat-barre'],
  ['pose', '.pose'],
  ['main', '.hand']
];

/**
 * Collecte, **dans le navigateur**, chaque bouton de ces zones avec les faits que les trois
 * mesures demandent : taille, visibilité, activation, et si le **centre** de la cible
 * appartient bien au bouton (`elementFromPoint`) — un bouton sous un calque n'est pas cliquable.
 *
 * Passée à `page.evaluate` : aucune constante du module ne lui est lisible.
 */
function collecteBoutons(zones) {
  const out = [];
  const decrire = (element) => {
    if (!element) return null;
    const classe = String(element.className).split(/\s+/)[0];
    return `${element.tagName.toLowerCase()}${classe ? `.${classe}` : ''}`;
  };
  for (const [zone, selecteur] of zones) {
    const liste = document.querySelectorAll(`${selecteur} button`);
    [...liste].forEach((bouton, i) => {
      const r = bouton.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Le centre **sort-il de la fenêtre** ? Un bouton rogné par un conteneur qui défile a un
      // centre hors écran : `elementFromPoint` ne peut rien y trouver, et ce n'est pas la même
      // chose qu'un bouton sous un calque. Les deux se mesurent, mais ne se disent pas pareil.
      const centreDehors = cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight;
      const dessous = centreDehors ? null : document.elementFromPoint(cx, cy);
      const centre = !centreDehors && !!dessous && (bouton === dessous || bouton.contains(dessous));
      const texte = (bouton.textContent ?? '').replace(/\s+/g, ' ').trim();
      out.push({
        zone,
        i,
        texte,
        libelle: (bouton.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim(),
        largeur: Math.round(r.width * 10) / 10,
        hauteur: Math.round(r.height * 10) / 10,
        centreX: Math.round(cx),
        centreY: Math.round(cy),
        dessus: decrire(dessous),
        centreDehors,
        // « Visible » : une taille, et au moins un pixel dans la fenêtre.
        visible: r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < window.innerHeight,
        desactive: bouton.disabled === true || bouton.getAttribute('aria-disabled') === 'true',
        centre
      });
    });
  }
  return out;
}

/** L'état « lisible » de l'écran, pour la mesure (c) : ce qui doit bouger quand une action parle. */
function instantaneEcran() {
  const texte = (selecteur) => {
    const el = document.querySelector(selecteur);
    return el ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
  };
  return {
    journal: texte('.combat-barre__journal'),
    piste: document.querySelector('.piste')?.getAttribute('aria-label') ?? null,
    piles: texte('.piles'),
    main: texte('.hand-panel'),
    boutons: [...document.querySelectorAll('.combat-barre button')]
      .map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim())
      .join('|'),
    statuts: document.querySelectorAll('.status-chip').length
  };
}

/* ------------------------------------------------------------------ */
/* Lire une action comme l'écran la nomme (`describeAction`)            */
/* ------------------------------------------------------------------ */

/**
 * Le libellé et le détail que `Battle.tsx` (`describeAction`) écrit sur le bouton. C'est une
 * **copie** de la règle d'affichage — le prototype la refait côté Node parce que `src/`
 * n'expose rien —, et c'est une fragilité à dire : si `describeAction` change, le harnais
 * ne trouve plus ses boutons et le compte (b) explose. Le vrai ticket devrait exposer
 * l'action sur le DOM (`data-action`), pas la deviner par son libellé.
 */
function libelleDe(action, state) {
  const cote = state.players.player;
  const enMain = (uid) => cote.hand.find((carte) => carte.uid === uid);
  const auPlateau = (uid) => [cote.active, ...cote.bench].find((carte) => carte && carte.uid === uid);
  const nomDe = (instance) => {
    const definition = instance ? donnees.getCard(instance.cardId) : undefined;
    return definition?.name;
  };
  const definitionMain = (uid) => {
    const instance = enMain(uid);
    return instance ? donnees.getCard(instance.cardId) : undefined;
  };
  switch (action.type) {
    case 'playBasic':
      return { label: action.slot === 'active' ? 'Poser au Poste' : `Mettre au Banc ${Number(action.slot) + 1}` };
    case 'playAction':
      return { label: definitionMain(action.uid)?.kind === 'OBJET' ? 'Jouer cet Objet' : 'Jouer ce Collègue' };
    case 'evolve':
      return {
        label: 'Faire évoluer',
        detail: `${nomDe(auPlateau(action.targetUid))} → ${nomDe(enMain(action.uid))}`
      };
    case 'priorityShift':
      return { label: 'Changement de priorité', detail: `archiver ${nomDe(enMain(action.uid))}` };
    case 'attachEnergy':
      return { label: 'Attacher 1 café', detail: nomDe(auPlateau(action.targetUid)) };
    case 'retreat':
      return { label: 'Rotation', detail: `vers ${nomDe(cote.bench[action.benchIndex])}` };
    case 'ability':
      return { label: 'Talent' };
    case 'attack': {
      const definition = cote.active ? donnees.getCard(cote.active.cardId) : undefined;
      const attaque = definition && donnees.isPlanque(definition) ? definition.attacks[action.attackIndex] : undefined;
      return { label: attaque?.name ?? 'Pression' };
    }
    case 'promoteActive':
      return { label: 'Relève' };
    case 'forfeit':
      return { label: 'Abandonner' };
    case 'choose':
      return { label: 'Choisir cette carte' };
    case 'endTurn':
      return { label: 'Fin du tour' };
    default:
      return { label: action.type };
  }
}

/** Cette signature (`ActionButton`) se lit-elle dans le texte d'un bouton ? */
function correspond(bouton, signature) {
  if (!bouton.texte.includes(signature.label)) return false;
  if (signature.detail && !bouton.texte.includes(signature.detail)) return false;
  return true;
}

/**
 * Cherche le bouton qui rend une action, dans l'ordre des zones : la barre d'abord, puis le
 * panneau de pose. Les boutons déjà pris (deux attachements ont le même libellé) sont consommés.
 */
function trouverBouton(boutons, signature, pris = new Set()) {
  for (const bouton of boutons) {
    if (bouton.zone === 'main') continue;
    if (pris.has(`${bouton.zone}:${bouton.i}`)) continue;
    if (correspond(bouton, signature)) return bouton;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Le joueur simulé : pressé, mais correct                             */
/* ------------------------------------------------------------------ */

/**
 * « Pression → café → fin de tour », comme la tâche le demande. Trois exceptions, toutes
 * **forcées** par le moteur : une relève (`promoteActive`) et un choix en attente (`choose`)
 * bloquent la partie tant qu'ils ne sont pas faits, et un Poste vide (aucun Planqué en jeu)
 * est une défaite — donc on pose.
 */
function choisirAction(state) {
  const legal = moteur.legalActions(state);
  return choisirParmi(state, legal);
}

function choisirParmi(state, legal) {
  const jouables = legal.filter((action) => action.type !== 'forfeit');
  const deType = (...types) => jouables.filter((action) => types.includes(action.type));

  const forces = deType('promoteActive', 'choose');
  if (forces.length > 0) return forces[0];

  const pressions = deType('attack');
  if (pressions.length > 0) return pressions[0];

  const attachements = deType('attachEnergy');
  if (attachements.length > 0) {
    const poste = state.players.player.active?.uid;
    return attachements.find((action) => action.targetUid === poste) ?? attachements[0];
  }

  if (state.players.player.active === null) {
    const poses = jouables.filter((action) => action.type === 'playBasic' && action.slot === 'active');
    if (poses.length > 0) return poses[0];
  }

  const fin = deType('endTurn');
  if (fin.length > 0) return fin[0];
  return null;
}

/* ------------------------------------------------------------------ */
/* Le déroulé d'une partie                                             */
/* ------------------------------------------------------------------ */

/**
 * Jouer une partie. Rend le compte rendu de la combinaison : tours, clics, durée murale,
 * état final, et les anomalies (a), (b), (c) avec leurs captures.
 */
async function jouerPartie(browser, combinaison, contexte) {
  const { oracle } = contexte;
  const rapport = {
    combinaison: combinaison.nom,
    faction: combinaison.faction,
    instant: ms(combinaison.instant),
    graine: null,
    adversaire: 'testDeck() (imposé par Battle.tsx)',
    deckJoueur: null,
    tours: 0,
    clics: 0,
    dureeS: null,
    issue: 'inconnue',
    banniere: null,
    etatFinal: null,
    anomalies: {
      a_partieBloquee: [],
      a_clicHorsCible: [],
      b_actionSansBouton: [],
      c_actionMuette: []
    },
    compteurs: { actionsCliquees: 0, actionsMuettes: 0, boutonsIgnores: 0, clicsDeSecours: 0, clicsHorsCible: 0 },
    gestes: [],
    journal: [],
    ecran: []
  };

  // Le Deck de l'archétype, calculé par le module qui le définit (`simulation.ts`).
  const deck = simulation.factionDeck(combinaison.faction);
  const cafeTypes = simulation.factionCafeTypes(combinaison.faction) ?? [];
  rapport.deckJoueur = { cartes: deck.length, cafeTypes };

  const context = await browser.newContext({
    viewport: VIEWPORT,
    isMobile: true,
    // Le store est amorcé **avant** la navigation, comme `capturer.mjs` : tutoriel et
    // pas-à-pas vus, Deck de l'archétype, types de café du Deck, aucune partie rangée.
    storageState: amorcageStore(origine, {
      tutorielVu: true,
      pasAPasCombatVu: true,
      deck,
      cafeTypes,
      partie: null,
      // Un générateur fixe : les Arrivages ne sont pas joués ici, mais un état constant
      // rend deux exécutions comparables.
      rng: 1
    })
  });
  const page = await context.newPage();
  const erreurs = [];
  page.on('pageerror', (erreur) => erreurs.push(`pageerror : ${erreur.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') erreurs.push(`console : ${message.text()}`);
  });

  // **La graine** : `createBattle` la prend de `Date.now()`, donc on fige l'horloge avant la
  // navigation. Même instant = même graine = même partie (exigence n° 1 du prototype).
  await page.clock.setFixedTime(combinaison.instant);
  await page.goto(`${base}/battle`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.combat-barre', { timeout: 20000 });
  // La partie est rangée dès le montage (`enregistrerPartie`) : on attend son enveloppe.
  await page.waitForFunction((cle) => (window.localStorage.getItem(cle) ?? '').includes('"partie":{'), STORAGE_KEY, {
    timeout: 20000
  });

  const premiere = oracle.resoudre((await lirePartie(page)).partie);
  if (!premiere.state) {
    rapport.anomalies.a_partieBloquee.push({
      raison: `le store ne range pas de partie rejouable (${premiere.verdict}) : la partie n'a pas commencé`,
      capture: null
    });
    rapport.issue = 'non-demarree';
    await context.close();
    return rapport;
  }
  rapport.graine = premiere.state.seed;

  /**
   * **Le journal des actions jouées, les deux camps** (relevé au fil des lectures). C'est lui
   * qui dit *où* deux exécutions de même graine divergent — et donc *qui* a divergé.
   */
  const journal = [];
  const synchroniser = (partie) => {
    if (!partie || !Array.isArray(partie.actions)) return;
    for (const action of partie.actions.slice(journal.length)) journal.push(action);
  };
  synchroniser((await lirePartie(page)).partie);

  const debut = Date.now();
  let tours = 0;
  let actions = premiere.state.actionLog.length;
  let fin = false;
  let pas = 0;

  const capture = async (suffixe) => {
    const nom = `${combinaison.nom}-${suffixe}.png`;
    await page.screenshot({ path: join(outDir, nom) });
    return nom;
  };

  /**
   * Range une anomalie, **groupée par signature** : le même défaut qui revient à chaque tour
   * (un bouton rogné par son conteneur) est une anomalie avec un compte, pas vingt lignes qui
   * noient les autres. La capture est celle du **premier** état où on l'a vu.
   */
  const signatures = new Map();
  const noter = async (categorie, anomalie, suffixe) => {
    const cle = `${categorie}|${anomalie.action ?? ''}|${anomalie.libelle ?? ''}|${anomalie.raison}`;
    if (signatures.has(cle)) {
      const existante = signatures.get(cle);
      existante.occurrences += 1;
      existante.tours.push(anomalie.tour);
      return existante;
    }
    const entree = { ...anomalie, occurrences: 1, tours: anomalie.tour === undefined ? [] : [anomalie.tour] };
    entree.capture = await capture(suffixe);
    signatures.set(cle, entree);
    rapport.anomalies[categorie].push(entree);
    return entree;
  };

  while (!fin) {
    pas += 1;
    if (Date.now() - debut > GAME_MS) {
      rapport.anomalies.a_partieBloquee.push({
        raison: `la partie dure plus de ${GAME_MS / 1000} s (tour ${tours}) : clic mort ou boucle`,
        capture: await capture(`bloquee-${pas}`)
      });
      break;
    }
    if (pas > 400) {
      rapport.anomalies.a_partieBloquee.push({
        raison: `400 itérations sans fin (tour ${tours}) : la boucle ne progresse plus`,
        capture: await capture(`boucle-${pas}`)
      });
      break;
    }

    const lu = await lirePartie(page);
    // `partie: null` veut dire « finie » **seulement** si une partie a déjà été rangée :
    // au tout début, l'effet d'enregistrement peut ne pas avoir eu lieu.
    if (lu.lisible && lu.partie === null) {
      fin = true;
      rapport.banniere = await page
        .evaluate(() => {
          const notice = document.querySelector('.battle .notice');
          return notice ? (notice.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
        })
        .catch(() => null);
      break;
    }
    synchroniser(lu.partie);
    const etat = oracle.resoudre(lu.partie);
    if (!etat.state) {
      rapport.anomalies.a_partieBloquee.push({
        raison: `l'enveloppe rangée ne se rejoue pas (${etat.verdict}) au tour ${tours}`,
        capture: await capture(`rejeu-${pas}`)
      });
      break;
    }
    const state = etat.state;
    tours = state.turn;

    // Le camp qui doit agir : `campToAct` = relève en attente, sinon le camp au trait.
    const acteur = state.pendingPromotion ?? state.current;
    if (acteur !== 'player') {
      // La Direction joue seule : on attend qu'elle rende la main, ou que la partie finisse.
      const attente = Date.now();
      let rendu = false;
      while (Date.now() - attente < AI_TURN_MS) {
        await page.waitForTimeout(150);
        const relu = await lirePartie(page);
        if (relu.lisible && relu.partie === null) {
          fin = true;
          rendu = true;
          rapport.banniere = await page
            .evaluate(() => {
              const notice = document.querySelector('.battle .notice');
              return notice ? (notice.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
            })
            .catch(() => null);
          break;
        }
        synchroniser(relu.partie);
        const suivant = oracle.resoudre(relu.partie);
        if (suivant.state && (suivant.state.pendingPromotion ?? suivant.state.current) === 'player') {
          rendu = true;
          break;
        }
      }
      if (fin) break;
      if (!rendu) {
        rapport.anomalies.a_partieBloquee.push({
          raison: `la Direction n'a pas rendu la main en ${AI_TURN_MS / 1000} s (tour ${tours})`,
          capture: await capture(`direction-${pas}`)
        });
        break;
      }
      continue;
    }

    // --- La mesure (b) : toute action légale a-t-elle un bouton ? ---
    const jouables = moteur.legalActions(state).filter((action) => action.type !== 'forfeit');
    const boutons = await page.evaluate(collecteBoutons, ZONES);
    const pris = new Set();
    for (const action of jouables) {
      const signature = libelleDe(action, state);
      const bouton = trouverBouton(boutons, signature, pris);
      if (bouton) {
        pris.add(`${bouton.zone}:${bouton.i}`);
        if (bouton.desactive || !bouton.visible || !bouton.centre) {
          const raison = bouton.desactive
            ? 'bouton désactivé'
            : !bouton.visible
              ? `bouton hors de la fenêtre (${bouton.largeur} × ${bouton.hauteur})`
              : bouton.centreDehors
                ? `le centre du bouton sort de la fenêtre (${bouton.centreX}, ${bouton.centreY} — bouton ${bouton.largeur} × ${bouton.hauteur}, zone « ${bouton.zone} »)`
                : `le centre du bouton est recouvert par ${bouton.dessus ?? 'rien'} (elementFromPoint)`;
          await noter(
            'b_actionSansBouton',
            {
              tour: tours,
              action: action.type,
              libelle: signature.label,
              detail: signature.detail ?? null,
              // Deux défauts différents, deux mots : un bouton **inatteignable** (présent, mais
              // on ne peut pas l'atteindre) n'est pas un bouton **absent**.
              nature: 'inatteignable',
              raison
            },
            `sans-bouton-${pas}`
          );
        }
      } else if (
        action.type === 'playBasic' ||
        action.type === 'playAction' ||
        action.type === 'evolve' ||
        action.type === 'priorityShift'
      ) {
        // Un geste de la main se fait en **deux temps** : la carte d'abord (`data-uid`), le
        // geste ensuite dans le panneau de pose. On vérifie le premier temps ici.
        const carte = boutons.find(
          (b) =>
            b.zone === 'main' && b.centre && (action.uid ? b.texte.includes(instanceName(state, action.uid)) : false)
        );
        if (!carte) {
          await noter(
            'b_actionSansBouton',
            {
              tour: tours,
              action: action.type,
              libelle: signature.label,
              detail: signature.detail ?? null,
              nature: 'absent',
              raison: 'geste de la main : aucune carte correspondante dans la main'
            },
            `sans-bouton-main-${pas}`
          );
        }
      } else {
        await noter(
          'b_actionSansBouton',
          {
            tour: tours,
            action: action.type,
            libelle: signature.label,
            detail: signature.detail ?? null,
            nature: 'absent',
            raison: 'aucun bouton ne porte le libellé attendu'
          },
          `sans-bouton-${pas}`
        );
      }
    }

    // --- Le geste : une action légale, un bouton ---
    const choisie = choisirParmi(state, moteur.legalActions(state));
    if (!choisie) {
      rapport.anomalies.a_partieBloquee.push({
        raison: `le moteur ne déclare aucune action pour moi au tour ${tours}`,
        capture: await capture(`aucune-action-${pas}`)
      });
      break;
    }

    const avant = await page.evaluate(instantaneEcran);
    const signature = libelleDe(choisie, state);
    const gesteMain =
      choisie.type === 'playBasic' ||
      choisie.type === 'playAction' ||
      choisie.type === 'evolve' ||
      choisie.type === 'priorityShift';

    let clicsIci = 0;
    let bouton = null;

    if (gesteMain) {
      // Premier temps : choisir la carte dans la main.
      const nom = instanceName(state, choisie.uid);
      const carte = (await page.evaluate(collecteBoutons, ZONES)).find(
        (b) => b.zone === 'main' && b.texte.includes(nom)
      );
      if (!carte) {
        rapport.anomalies.a_partieBloquee.push({
          raison: `la carte « ${nom} » (${choisie.type}) n'a aucun bouton dans la main`,
          capture: await capture(`main-absente-${pas}`)
        });
        break;
      }
      if (!carte.centre) rapport.compteurs.clicsDeSecours += 1;
      await cliquer(page, carte);
      rapport.clics += 1;
      clicsIci += 1;
      await page.waitForTimeout(250);
      bouton = trouverBouton(await page.evaluate(collecteBoutons, ZONES), signature);
      if (!bouton) {
        rapport.anomalies.a_partieBloquee.push({
          raison: `la carte choisie (${choisie.type}) n'offre pas le bouton « ${signature.label} »`,
          capture: await capture(`pose-absente-${pas}`)
        });
        break;
      }
    } else {
      // **Les coordonnées sont relues juste avant le clic.** La mesure (b) a pu prendre une
      // capture, et la barre du tour se réarrange quand une ligne de journal arrive : cliquer
      // aux coordonnées d'une lecture vieille de 150 ms tombe sur un autre bouton. La première
      // version de ce harnais a ainsi joué une **autre** partie (14 tours au lieu de 20) sans
      // le dire — c'est pourquoi cette relecture existe, et pourquoi `a_clicHorsCible` compte.
      bouton = trouverBouton(await page.evaluate(collecteBoutons, ZONES), signature);
      if (!bouton) {
        rapport.anomalies.a_partieBloquee.push({
          raison: `l'action choisie (${choisie.type}, « ${signature.label} ») n'a aucun bouton`,
          capture: await capture(`clic-mort-${pas}`)
        });
        break;
      }
    }

    if (!bouton.centre) rapport.compteurs.clicsDeSecours += 1;
    await cliquer(page, bouton);
    rapport.clics += 1;
    clicsIci += 1;
    rapport.compteurs.actionsCliquees += 1;

    // --- Le clic a-t-il été accepté ? (a) ---
    const accepte = await attendreJournal(page, actions, DEAD_CLICK_MS);
    if (!accepte) {
      rapport.anomalies.a_partieBloquee.push({
        raison: `clic mort : « ${signature.label} » (${choisie.type}) n'a rien changé en ${DEAD_CLICK_MS / 1000} s, tour ${tours}`,
        capture: await capture(`clic-mort-${pas}`)
      });
      break;
    }
    if (accepte.finie) {
      fin = true;
      rapport.banniere = await page
        .evaluate(() => {
          const notice = document.querySelector('.battle .notice');
          return notice ? (notice.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
        })
        .catch(() => null);
      rapport.tours = tours;
      break;
    }
    actions = accepte.actions;

    // --- Le clic a-t-il fait ce qu'on croyait ? (la cible a-t-elle bougé sous le doigt ?) ---
    // On clique aux **coordonnées** du centre : c'est ce qu'un doigt fait. Si la barre s'est
    // réarrangée entre la lecture et le clic (une ligne de journal qui arrive, une animation),
    // le clic tombe sur un **autre** bouton, et la partie change de cours. Le journal du moteur
    // le dit : l'action appliquée n'est pas celle qu'on visait.
    const appliquee = accepte.derniere;
    rapport.gestes.push({ tour: tours, visait: choisie, applique: appliquee ?? null });
    if (appliquee && JSON.stringify(appliquee) !== JSON.stringify(choisie)) {
      rapport.compteurs.clicsHorsCible += 1;
      await noter(
        'a_clicHorsCible',
        {
          tour: tours,
          action: choisie.type,
          libelle: signature.label,
          raison: `le clic a appliqué « ${appliquee.type} » au lieu de « ${choisie.type} » : la cible a bougé entre la lecture et le clic`,
          attendu: choisie,
          applique: appliquee
        },
        `hors-cible-${pas}`
      );
    }

    // --- La mesure (c) : l'action parle-t-elle ? ---
    // Le journal est lu **tout de suite**, avant que la Direction n'ajoute sa ligne (600 ms).
    await page.waitForTimeout(120);
    const apres = await page.evaluate(instantaneEcran);
    const muette = JSON.stringify(avant) === JSON.stringify(apres);
    if (muette) {
      rapport.compteurs.actionsMuettes += 1;
      await noter(
        'c_actionMuette',
        {
          tour: tours,
          action: choisie.type,
          libelle: signature.label,
          raison:
            'état accepté (journal du moteur grandi) sans changement visible : journal, piste, piles, main et boutons identiques',
          avant,
          apres
        },
        `muette-${pas}`
      );
    }
    if (rapport.ecran.length < 5) rapport.ecran.push({ tour: tours, apres });
    void clicsIci;
  }

  rapport.tours = tours;
  rapport.dureeS = arrondi((Date.now() - debut) / 1000, 1);
  rapport.issue = devinerIssue(rapport.banniere);
  rapport.piste = await page
    .evaluate(() => document.querySelector('.piste')?.getAttribute('aria-label') ?? null)
    .catch(() => null);
  rapport.journal = journal;
  // Les actions de la **Direction** : le journal moins les miennes. C'est lui qui explique la
  // durée — l'IA joue seule, à 600 ms par action (`Battle.tsx`, `sansMouvement ? 0 : 600`).
  rapport.actions = { joueur: rapport.gestes.length, direction: Math.max(0, journal.length - rapport.gestes.length) };
  rapport.etatFinal = {
    tour: tours,
    phase: fin ? 'ended' : 'inachevee',
    banniere: rapport.banniere,
    piste: rapport.piste
  };
  if (erreurs.length > 0) {
    rapport.erreursPage = erreurs;
    problems.push(`[${combinaison.nom}] ${erreurs.length} erreur(s) de page : ${erreurs[0]}`);
  }
  await page.screenshot({ path: join(outDir, `${combinaison.nom}-fin.png`) });
  await context.close();
  return rapport;
}

/** Le nom d'une instance de l'état, comme `instanceName` l'écrit dans la main. */
function instanceName(state, uid) {
  const cote = state.players.player;
  const instance = [...cote.hand, ...cote.bench, cote.active].find((carte) => carte && carte.uid === uid);
  const definition = instance ? donnees.getCard(instance.cardId) : undefined;
  return definition?.name ?? 'Carte inconnue';
}

/** Clique au **centre** du bouton ; si le centre est recouvert, clique le bouton par le DOM. */
async function cliquer(page, bouton) {
  const cible = page.locator(`${ZONES.find(([nom]) => nom === bouton.zone)[1]} button`).nth(bouton.i);
  if (bouton.centre) {
    const boite = await cible.boundingBox();
    if (boite) {
      await page.mouse.click(boite.x + boite.width / 2, boite.y + boite.height / 2);
      return;
    }
  }
  await cible.evaluate((element) => element.click());
}

/**
 * Attend l'effet d'un clic : le journal du moteur grandit, ou la partie se termine (`partie`
 * devient `null`). Rend `{ actions }`, `{ finie: true }`, ou `null` = **clic mort**.
 */
async function attendreJournal(page, avant, limiteMs) {
  const debut = Date.now();
  while (Date.now() - debut < limiteMs) {
    const lu = await lirePartie(page);
    if (lu.lisible && lu.partie === null) return { finie: true };
    if (lu.partie && Array.isArray(lu.partie.actions) && lu.partie.actions.length > avant) {
      return { actions: lu.partie.actions.length, derniere: lu.partie.actions.at(-1) };
    }
    await page.waitForTimeout(60);
  }
  return null;
}

/** L'issue lue dans la bannière de fin (`endBanner`, `Battle.tsx`). */
function devinerIssue(banniere) {
  if (!banniere) return 'inconnue';
  if (/^Égalité/.test(banniere)) return 'égalité';
  if (/^Victoire/.test(banniere)) return 'victoire';
  if (/^Défaite/.test(banniere)) return 'défaite';
  return `inconnue (${banniere.slice(0, 40)})`;
}

/* ------------------------------------------------------------------ */
/* Les menus : ce qui se mesure, et rien de plus                       */
/* ------------------------------------------------------------------ */

/**
 * Ce qu'un prototype **peut** dire des menus : le nombre de clics pour ouvrir un Arrivage,
 * les titres présents, la taille des cibles. « Est-ce intuitif » ne se mesure pas ici : les
 * états sont capturés, et c'est un humain qui tranche.
 */
async function mesurerMenus(browser) {
  const menus = { clicsArrivage: null, titres: {}, ciblesSous44: [], captures: [], ecrans: {} };
  const context = await browser.newContext({
    viewport: VIEWPORT,
    isMobile: true,
    // Un Deck **rempli** (et non vide) : l'écran Deck se juge sur ce qu'un testeur y voit, pas
    // sur le « 0/20 cartes » d'une première visite.
    storageState: amorcageStore(origine, {
      tutorielVu: true,
      pasAPasCombatVu: true,
      partie: null,
      rng: 1,
      deck: simulation.factionDeck('MANAGEMENT'),
      cafeTypes: simulation.factionCafeTypes('MANAGEMENT') ?? []
    })
  });
  const page = await context.newPage();
  const erreurs = [];
  page.on('pageerror', (erreur) => erreurs.push(`${erreur.message}`));

  const titresDe = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('h1, h2, h3, [role="dialog"] [id$="-title"], .dialog__titre')].map((titre) =>
        (titre.textContent ?? '').replace(/\s+/g, ' ').trim()
      )
    );
  const cibles = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('button, a.button, [role="button"]')]
        .map((bouton) => {
          const r = bouton.getBoundingClientRect();
          return {
            nom: (bouton.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
            hauteur: Math.round(r.height * 10) / 10,
            largeur: Math.round(r.width * 10) / 10
          };
        })
        .filter((cible) => cible.hauteur > 0 && (cible.hauteur < 44 || cible.largeur < 44))
    );

  for (const [slug, route] of [
    ['accueil', '/'],
    ['deck', '/deck'],
    ['reglages', '/settings'],
    ['comite', '/comite']
  ]) {
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    menus.titres[slug] = await titresDe();
    const petites = await cibles();
    menus.ciblesSous44.push(...petites.map((cible) => ({ ecran: slug, ...cible })));
    menus.captures.push(`menu-${slug}.png`);
    await page.screenshot({ path: join(outDir, `menu-${slug}.png`) });
  }

  // Le nombre de clics pour ouvrir un Arrivage, depuis l'accueil : chaque geste compte.
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  const clics = 1;
  await page.getByRole('button', { name: /Ouvrir un Arrivage/ }).click();
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  menus.clicsArrivage = clics;
  menus.titres.dialogueArrivage = await titresDe();
  menus.ecrans.arrivage = await page.evaluate(() => {
    const dialogue = document.querySelector('[role="dialog"]');
    return dialogue ? (dialogue.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) : null;
  });
  menus.captures.push('menu-arrivage.png');
  await page.screenshot({ path: join(outDir, 'menu-arrivage.png') });
  if (erreurs.length > 0) problems.push(`[menus] ${erreurs.length} erreur(s) de page : ${erreurs[0]}`);
  await context.close();
  return menus;
}

/* ------------------------------------------------------------------ */
/* L'amorçage du store (patron `capturer.mjs`)                         */
/* ------------------------------------------------------------------ */

function amorcageStore(origin, supplement = {}) {
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

/* ------------------------------------------------------------------ */
/* Le rapport                                                          */
/* ------------------------------------------------------------------ */

function rapportMarkdown({ parties, menus, dureeGlobaleS }) {
  const durees = parties.map((partie) => partie.dureeS).filter((duree) => typeof duree === 'number');
  const med = mediane(durees);
  const lignes = [];
  lignes.push('# Prototype — jouer une partie au clic');
  lignes.push('');
  lignes.push(
    `Généré le ${new Date().toISOString()} · ${parties.length} combinaison(s) · durée totale ${dureeGlobaleS} s.`
  );
  lignes.push('');
  lignes.push('## 1. La durée, qui décide du volume');
  lignes.push('');
  lignes.push(`**Durée médiane par partie : ${med === null ? 'non mesurée' : `${med} s`}.**`);
  lignes.push('');
  if (med !== null) {
    const dix = Math.max(1, Math.floor(600 / med));
    const heure = Math.max(1, Math.floor(3600 / med));
    lignes.push(`| Fenêtre | Parties tenant dans la fenêtre |`);
    lignes.push(`|---|---|`);
    lignes.push(`| 10 minutes | ${dix} |`);
    lignes.push(`| 1 heure | ${heure} |`);
    lignes.push(`| 45 paires (une partie par paire) | ${arrondi((45 * med) / 60, 1)} min |`);
    lignes.push(`| 45 paires, en miroir (90 parties) | ${arrondi((90 * med) / 60, 1)} min |`);
    lignes.push('');
  }
  lignes.push('## 2. Les trois mesures');
  lignes.push('');
  for (const partie of parties) {
    lignes.push(`### ${partie.combinaison} (${partie.faction}) — ${partie.issue}`);
    lignes.push('');
    lignes.push(
      `- graine \`${partie.graine}\` · décision figée ${partie.instant} · Deck ${partie.deckJoueur?.cartes} cartes · cafés ${JSON.stringify(partie.deckJoueur?.cafeTypes)}`
    );
    lignes.push(`- **${partie.tours} tours**, **${partie.clics} clics**, **${partie.dureeS} s** de durée murale`);
    lignes.push(`- bannière de fin : « ${partie.banniere ?? 'aucune'} »`);
    lignes.push(`- clics de secours (centre injoignable, clic DOM) : ${partie.compteurs.clicsDeSecours}`);
    if (partie.actions) {
      lignes.push(
        `- actions au journal : ${partie.actions.joueur} de moi, ${partie.actions.direction} de la Direction` +
          ` (à 600 ms l'action, la Direction pèse ~${arrondi((partie.actions.direction * 0.6) / 1, 1)} s de la durée)`
      );
    }
    for (const [cle, liste] of Object.entries(partie.anomalies)) {
      const total = liste.reduce((somme, anomalie) => somme + (anomalie.occurrences ?? 1), 0);
      if (liste.length === 0) {
        lignes.push(`- \`${cle}\` : **aucune**`);
        continue;
      }
      if (cle === 'b_actionSansBouton') {
        const absents = liste.filter((a) => a.nature === 'absent');
        const inatteignables = liste.filter((a) => a.nature === 'inatteignable');
        lignes.push(
          `- \`${cle}\` : **${absents.reduce((n, a) => n + a.occurrences, 0)}** action(s) sans bouton, ` +
            `**${inatteignables.reduce((n, a) => n + a.occurrences, 0)}** bouton(s) inatteignable(s), ` +
            `${liste.length} signature(s)`
        );
      } else {
        lignes.push(`- \`${cle}\` : **${total}** occurrence(s), ${liste.length} signature(s)`);
      }
      for (const anomalie of liste.slice(0, 15)) {
        const tours = anomalie.tours?.length ? ` (tours ${anomalie.tours.join(', ')})` : '';
        lignes.push(
          `  - ${anomalie.raison}${anomalie.libelle ? ` — « ${anomalie.libelle} »` : ''}${tours}` +
            `${anomalie.capture ? ` — \`${anomalie.capture}\`` : ''}`
        );
      }
      if (liste.length > 15) lignes.push(`  - … ${liste.length - 15} de plus dans le JSON`);
    }
    lignes.push('');
  }
  lignes.push('## 3. Les menus (ce qui se compte, pas ce qui se juge)');
  lignes.push('');
  if (!menus) {
    lignes.push('Non mesurés à cette exécution (`MENUS=0`).');
  } else {
    lignes.push(`- Arrivage depuis l'accueil : **${menus.clicsArrivage} clic(s)** jusqu'au dialogue`);
    lignes.push(`- cibles sous 44 px : **${menus.ciblesSous44.length}**`);
    const parHauteur = new Map();
    for (const cible of menus.ciblesSous44) {
      parHauteur.set(cible.hauteur, (parHauteur.get(cible.hauteur) ?? 0) + 1);
    }
    for (const [hauteur, compte] of [...parHauteur].sort((a, b) => b[1] - a[1])) {
      lignes.push(`  - ${hauteur} px de haut × ${compte}`);
    }
    for (const cible of menus.ciblesSous44.filter((c) => c.nom).slice(0, 10)) {
      lignes.push(`  - ${cible.ecran} · « ${cible.nom} » ${cible.largeur} × ${cible.hauteur}`);
    }
    lignes.push(`- captures : ${menus.captures.map((nom) => `\`${nom}\``).join(', ')}`);
    lignes.push('');
    lignes.push('Titres des écrans :');
    for (const [ecran, titres] of Object.entries(menus.titres)) {
      if (!Array.isArray(titres)) continue;
      lignes.push(`- **${ecran}** : ${titres.length === 0 ? '(aucun titre)' : titres.join(' · ')}`);
    }
  }
  lignes.push('');
  lignes.push('## 4. Reproductibilité — ce qui est vrai, et ce qui ne l’est pas');
  lignes.push('');
  lignes.push(
    '- **La graine est fixe** : l’horloge est figée avant la navigation (`page.clock.setFixedTime`), donc' +
      ' `createBattle` reçoit toujours le même instant. La graine de chaque partie est dans le JSON.'
  );
  lignes.push(
    '- **À vide, le déroulé est identique** : `SEULE=management node scripts/jouer.mjs` lancé deux fois de' +
      ' suite donne le **même journal** (58 actions, même ordre), mesuré le 28/10/2026. Idem pour `SEULE=qvt`' +
      ' (78 actions, deux lancements).'
  );
  lignes.push(
    '- **Mais l’adversaire n’est pas reproductible** : la Direction de l’écran joue la politique' +
      ' `recherche` (`nextAiAction`, `src/game/ia.ts`), dont le budget a une **échéance murale de' +
      ' 60 ms** (`budgetExhausted` → `performance.now()`). Dépassée, la décision **retombe sur le coup' +
      ' glouton** — un autre coup. Mesuré : la même graine, l’horloge figée, la même séquence de clics,' +
      " sous **charge CPU** (`for j in $(seq 1 $(nproc)); do timeout 50 bash -c 'while :; do :; done' &" +
      ' done`), diverge dès l’action **1** du journal (`attachEnergy a15` au calme, `attachEnergy a9` sous' +
      ' charge). `src/game/ia-niveau-2.test.ts` le dit déjà : « la même graine peut se replier sur le' +
      ' glouton dans une exécution et pas dans l’autre ».'
  );
  lignes.push(
    '- **Conséquence pour une campagne** : une machine au repos, et une seule campagne à la fois.' +
      ' Pour une reproductibilité de droit, il faut un crochet `src/` (politique de l’IA imposée, ou' +
      ' budget sans échéance murale) : il n’existe pas.'
  );
  lignes.push('');
  lignes.push('## 5. Ce que ce prototype ne mesure pas, et pourquoi');
  lignes.push('');
  lignes.push(
    '- **L’adversaire.** `Battle.tsx` joue toujours `testDeck()` contre la Direction : le siège adverse' +
      ' n’est pas paramétrable sans toucher `src/`. Les 45 paires d’archétypes ne se jouent donc pas' +
      ' dans l’interface — ce chiffre-ci ne vaut que pour « un archétype contre le Deck de démonstration ».'
  );
  lignes.push(
    '- **L’état du moteur.** L’écran ne l’expose pas (`window`, attribut `data-` sur l’état, journal) :' +
      ' l’oracle relit le store persisté et **rejoue** la partie. Une action acceptée est vérifiée après' +
      ' coup, jamais avant.'
  );
  lignes.push(
    '- **Le libellé des boutons.** Le harnais refait `describeAction` pour reconnaître les boutons. Si' +
      ' l’affichage change, il ne les trouve plus : le compte (b) deviendrait faux. Un attribut' +
      ' `data-action` sur chaque bouton réglerait les deux points d’un coup.'
  );
  lignes.push(
    '- **« Est-ce intuitif ».** Non mesurable ici : les captures d’écran de menus sont là pour qu’un' +
      ' humain tranche.'
  );
  lignes.push(
    '- **Un vrai joueur.** La stratégie est « pressé » (Pression → café → fin de tour) : une partie' +
      ' humaine dure **plus** que ce chiffre. La durée mesurée est la **borne basse** du coût d’une partie.'
  );
  lignes.push('');
  return lignes.join('\n');
}

/* ------------------------------------------------------------------ */
/* Le déroulé                                                          */
/* ------------------------------------------------------------------ */

// Sonde : `--rapport` réécrit le markdown depuis `rapport.json`, sans navigateur ni partie.
// Le rapport se relit et se corrige sans rejouer cent secondes de parties.
if (process.argv.includes('--rapport')) {
  const json = join(outDir, 'rapport.json');
  if (!existsSync(json)) stop(`aucun rapport à relire : ${json}`);
  const { readFileSync } = await import('node:fs');
  const lu = JSON.parse(readFileSync(json, 'utf8'));
  writeFileSync(
    join(outDir, 'rapport.md'),
    rapportMarkdown({ parties: lu.parties, menus: lu.menus, dureeGlobaleS: lu.dureeGlobaleS })
  );
  console.log(`✔ ${join(outDir, 'rapport.md')} réécrit depuis ${json}`);
  process.exit(0);
}

if (!existsSync(executablePath)) {
  stop(`Chromium introuvable : ${executablePath}\n  Renseigne CHROME_PATH.`);
}

const debutGlobal = Date.now();
let server = null;
if (!process.env.BASE_URL) {
  if (!existsSync(distIndex)) {
    stop('dist/index.html absent : lance `npm run build` avant `node scripts/jouer.mjs`.');
  }
  server = await preview({ root, preview: { port: PORT, strictPort: true }, logLevel: 'error' });
}

mkdirSync(outDir, { recursive: true });

// Vite en mode « middleware » : aucun port ouvert, il ne fait que charger les modules du
// projet en Node (TypeScript + alias `@/`) pour que l'oracle soit le vrai moteur.
const vite = await createViteServer({
  root,
  // Pas de HMR : sans lui, Vite n'ouvre pas son WebSocket (le port 24678 peut déjà être pris
  // par une autre session). On ne charge que des modules, on ne sert aucune page.
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error'
});
await chargerModules(vite);

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const rapport = { parties: [], menus: null };

try {
  const oracle = creerOracle();
  const aJouer = (seule ? COMBINAISONS.filter((c) => c.nom === seule) : COMBINAISONS).slice(0, nbParties);
  for (const combinaison of aJouer) {
    process.stdout.write(`· ${combinaison.nom} … `);
    const partie = await jouerPartie(browser, combinaison, { oracle });
    rapport.parties.push(partie);
    console.log(
      `${partie.issue} · ${partie.tours} tours · ${partie.clics} clics · ${partie.dureeS} s · ` +
        `(a) ${partie.anomalies.a_partieBloquee.length} (b) ${partie.anomalies.b_actionSansBouton.length} ` +
        `(c) ${partie.anomalies.c_actionMuette.length}`
    );
  }
  if (process.env.MENUS !== '0') {
    process.stdout.write('· menus … ');
    rapport.menus = await mesurerMenus(browser);
    console.log(`${rapport.menus.clicsArrivage} clic(s) pour un Arrivage`);
  }
} finally {
  await browser.close();
  await vite.close();
  await server?.close();
}

const durees = rapport.parties.map((partie) => partie.dureeS).filter((duree) => typeof duree === 'number');
rapport.dureeMedianeS = mediane(durees);
rapport.dureeGlobaleS = arrondi((Date.now() - debutGlobal) / 1000, 1);
rapport.problems = problems;

writeFileSync(join(outDir, 'rapport.json'), JSON.stringify(rapport, null, 2));
writeFileSync(
  join(outDir, 'rapport.md'),
  rapportMarkdown({
    parties: rapport.parties,
    menus: rapport.menus,
    dureeGlobaleS: rapport.dureeGlobaleS
  })
);

console.log(
  `✔ ${rapport.parties.length} partie(s) dans captures/jouer/ · médiane ${rapport.dureeMedianeS ?? '?'} s ` +
    `· total ${rapport.dureeGlobaleS} s`
);
if (problems.length) {
  console.error('✖ Erreurs de page :');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
