#!/usr/bin/env node
/**
 * Captures d'écran — ticket #53.
 *
 * `AGENTS.md` §6 et §8.4 disent qu'un écran ne se déclare **rendu** que par
 * **capture** ou inspection du navigateur : ce script rend ce geste reproductible.
 * Chromium est piloté par `playwright-core`, une image par page, et la commande
 * **échoue** si une page lève une erreur de console ou une `pageerror` — une capture
 * ne vaut donc que pour une page qui n'a rien cassé.
 *
 * Depuis le ticket #150, un contexte **neuf** est une **première visite** : la
 * Journée d'intégration s'y montre, et recouvrait donc chaque page photographiée.
 * Les pages sont désormais **amorcées** — `tutorielVu: true` écrit dans le store
 * **avant** la navigation —, et la première visite garde **une** capture à part
 * (`premiere-visite.png`), nue. C'est l'exigence (4) de D-060 qui tient à ce prix :
 * une capture doit montrer l'écran qu'elle nomme.
 *
 * Depuis le ticket #153, la capture tient enfin dans une image qu'on **regarde** : elle
 * est prise à la taille que D-060 nomme (**420 × 900**) et sur la **fenêtre**, jamais
 * sur la page entière — la Collection sortait en 141 460 px de haut, le Deck en 80 064.
 * Ce qu'on perd, et pourquoi c'est le bon compromis, est écrit sur `PLEINE_PAGE`.
 *
 * Usage :
 *   npm run build && npm run capturer
 *   BASE_URL=http://localhost:5178 npm run capturer
 *   CHROME_PATH=/chemin/vers/chrome npm run capturer
 *   npm run e2e   (la preuve E2E du projet de test, #668 — alias de `--e2e` ; sans
 *     E2E_TEST_EMAIL/E2E_TEST_PASSWORD, la partie réseau est sautée et la commande sort 0)
 *   node scripts/preuves/capturer.mjs --plan   (imprime l'état amorcé et le plan, sans navigateur)
 *   node scripts/preuves/capturer.mjs --controle-hauteur '<géométrie JSON>'  (joue le contrôle de
 *     hauteur sur une géométrie fournie, sans navigateur : c'est ce que teste #194)
 *
 * Variables d'environnement :
 *   CHROME_PATH      binaire Chromium (défaut : cache de `ms-playwright`)
 *   BASE_URL         serveur déjà lancé ; le script n'en démarre alors aucun
 *   PORT             port du `vite preview` qu'il démarre lui-même (défaut : 4180)
 *   CAPTURER_VOIES   scènes indépendantes jouées en parallèle (défaut : 1 ; 2 dans la CI,
 *                    #707). Chaque voie a son port et son dossier de sortie, et le parent
 *                    fusionne les fichiers : même inventaire, pas une capture de moins.
 *
 * Le dossier de sortie `captures/` est ignoré par git : ces images sont une preuve
 * de travail, pas un livrable. Les preuves citées vivent dans `docs/preuves/`, datées.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import {
  STORAGE_KEY,
  VIEWPORT,
  INSTANTS_COMBAT,
  GABARITS,
  amorcageStore,
  defilementVertical,
  controlesAccueil,
  contraste,
  problemesPochette,
  erreurConsoleAttendue,
  REFUS_ARRIVAGE
} from './capturer-socle.mjs';
import { voieDe } from './capturer-voies.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
/** Une voie du pool écrit dans son propre dossier puis le parent le fusionne (#707). */
const outDir = process.env.CAPTURER_SORTIE ?? join(root, 'captures');
const distIndex = join(root, 'dist/index.html');

/** Le binaire du cache `ms-playwright`, surchargeable pour une autre machine (comme le legacy). */
const executablePath =
  process.env.CHROME_PATH ?? join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');

/** Une page par route de `src/App.tsx`, dans l'ordre de la barre de navigation. */
const PAGES = [
  ['accueil', '/'],
  ['collection', '/collection'],
  ['deck', '/deck'],
  ['combat', '/battle'],
  ['reglages', '/settings'],
  // Revoir une partie (#366) : hors du combat, depuis Réglages ; une route de l'application
  // sans capture est une page que personne ne regarde (le contrat de capturer.test.ts).
  ['rejeu', '/rejeu'],
  // Les trois écrans de compte (D-088) : sans configuration, ils montrent leur état
  // inerte — c'est aussi un état d'écran que D-060 demande de voir.
  // La confidentialité est publique et hors garde : elle doit se lire sans compte.
  ['confidentialite', '/confidentialite'],
  // Les nouveautés aussi (elles se lisent avant de s'inscrire) : une version qu'on ne
  // peut pas lire depuis le jeu ne sert à rien, donc la capture le prouve.
  ['feuille-de-route', '/feuille-de-route'],
  // Le guide d'installation (#300) : public, et la note de release y renvoie — une page
  // qu'un testeur ne peut pas lire avant son compte ne sert à rien, donc une capture le
  // prouve, comme pour la feuille de route.
  ['installation', '/installation'],
  ['connexion', '/connexion'],
  ['attente', '/attente'],
  ['administration', '/administration'],
  // La pause café (D-192) : l'espace social annoncé, cinquième onglet de la barre.
  ['pause-cafe', '/pause-cafe'],
  // Le mur du comité (#129, D-097) : une page du jeu, cinquième onglet depuis #213 ;
  // capturée après les écrans de compte.
  ['comite', '/comite'],
  // Le suivi (#211, D-097 (2)) : la seconde page du comité, sous les mêmes sous-onglets —
  // une page de l'application sans capture est une page que personne ne regarde.
  ['comite-suivi', '/comite/suivi']
];

/** Pages dont le document ne défile pas sur les gabarits portrait de téléphone (D-171). */
const PAGES_SANS_DEFILEMENT_VERTICAL = ['accueil'];

/**
 * La **première visite** (#150) : le seul écran photographié **sans** amorçage.
 * Elle partage la route de l'accueil, mais la barre de navigation n'a pas à la
 * connaître : `PAGES` reste « une page par route », et la visite s'ajoute à part.
 */
const PREMIERE_VISITE = ['premiere-visite', '/'];

/** La route du combat : la seule photographiée à son arrivée, pas remise à zéro (#170). */
const ROUTE_COMBAT = '/battle';

/**
 * **Les états dédiés** (#128) — des captures qu'aucune page ne montre à l'arrivée.
 *
 * Le code d'une partie à deux vit dans la vue « Partie à deux » du menu `⋯`, **fermé** tant
 * qu'aucun code n'est prêt (#125, #191) : une capture d'arrivée ne le montrait donc jamais,
 * et le critère (4) de D-060 (« on regarde les captures ») n'avait rien à regarder pour
 * #128. Cette capture-ci **prépare** l'état dans le navigateur — même geste qu'un invité —
 * et la garde plus bas **échoue** si le code n'est pas à l'écran, ou si la page déborde.
 *
 * Liste à part, et non dans `PAGES` : « une page par route » reste vrai (le contrat de
 * `scripts/preuves/capturer.test.ts`), et `/battle` est déjà photographiée à son arrivée.
 */
const PREPARATIONS = [
  { slug: 'code-pvp', route: ROUTE_COMBAT, amorce: true, preparation: 'code-pvp' },
  // **La fin d'une partie** (critique du 01/11/2026) : aucune capture ne montrait l'état terminé,
  // et la garde de hauteur ne mesurait que des états en cours — « Nouveau combat » pouvait donc
  // sortir de l'écran, au moment exact où on le cherche, sans que rien ne rougisse.
  { slug: 'fin', route: ROUTE_COMBAT, amorce: true, preparation: 'fin' },
  // L'ouverture d'un Arrivage (#283) n'existe à aucune arrivée de page : elle s'ouvre au clic
  // sur l'accueil. C'est l'écran où trois défauts de rendu se sont succédé sans qu'aucune
  // capture ne les voie (texte en miroir, pivot, 3D imbriquée, 28/10/2026).
  { slug: 'arrivage', route: '/', amorce: true, preparation: 'arrivage' },
  // **Le cache de la Collection se dit hors ligne** (#493, D-179 (3), D-060 (3)) : la page
  // affiche le dernier état lu, et l'écrit. C'est l'état que le testeur rencontre dans le
  // métro — on charge en ligne, puis on coupe le réseau.
  { slug: 'collection-hors-ligne', route: '/collection', amorce: true, preparation: 'collection-hors-ligne' }
];

/** Attend le tour du joueur (« à toi ») — l'IA joue seule — puis le défilement d'arrivée (smooth). */
async function arriveeAuTourDuJoueur(page) {
  await page.waitForFunction(() => document.querySelector('.battle__head')?.textContent.includes('à toi'), null, {
    timeout: 60000
  });
  await page.waitForTimeout(1200);
}

/**
 * **Le balisage d'un badge de Condition**, tel que `StatusBadge` le rend — la **seule** copie
 * hors du composant (#324).
 *
 * Le pire cas posé dans le DOM doit être celui que le composant produit : une puce
 * `status-chip`, l'icône à sa taille, puis le nom (visible en `détaillé`, `sr-only` en `sobre`).
 * Recopier ce balisage à la main laissait la mesure mesurer autre chose le jour où le
 * composant changeait — et rester verte. Ce modèle-ci est donc **confronté** au composant :
 * `src/components/StatusBadge.test.tsx` le compare au rendu réel et tombe dès que le
 * balisage, une classe, la taille de l'icône ou un libellé divergent.
 *
 * Il est publié dans `--plan` (la garde le lit sans navigateur) et passé en argument à
 * `poserLePireCas` : `page.evaluate` sérialise la fonction, qui ne lit aucune constante du
 * module.
 */
const MODELE_BADGE = {
  racine: 'status-chip',
  modificateur: 'status-chip--',
  icone: { largeur: 12, hauteur: 12 },
  nom: 'status-chip__nom',
  masque: 'sr-only',
  // Les **trois** Conditions qu'un même Poste peut porter ensemble (docs/JEU.md §4) : Surcharge
  // et Épuisement se cumulent avec une Condition d'état — Immobilisation ici, la plus longue.
  statuts: [
    { code: 'SURCHARGE', nom: 'Surcharge' },
    { code: 'EPUISEMENT', nom: 'Épuisement' },
    { code: 'IMMOBILISATION', nom: 'Immobilisation' }
  ]
};

/** Va sur le combat à un **instant figé** (la graine de `createBattle`) et attend le tour du joueur. */
async function arriverAuCombat(page, instant) {
  await page.clock.setFixedTime(instant);
  await page.goto(`${base}${ROUTE_COMBAT}`, { waitUntil: 'networkidle' });
  await arriveeAuTourDuJoueur(page);
}

/**
 * Un contexte de combat **neuf et arrivé au tour du joueur** : le bloc que cinq passages
 * recopiaient (contexte, `pageerror`, horloge figée, navigation, attente). Une copie qui prend
 * du retard, c'est un état du plan qui n'écoute plus les erreurs de page (#324).
 */
async function ouvrirCombat(browser, instant, supplement = {}, gabarit = { viewport: VIEWPORT, mobile: true }) {
  const context = await browser.newContext({
    viewport: gabarit.viewport,
    isMobile: gabarit.mobile,
    hasTouch: gabarit.mobile,
    storageState: amorcageStore(origine, supplement)
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`${ROUTE_COMBAT} · pageerror : ${error.message}`));
  await arriverAuCombat(page, instant);
  return { context, page };
}

/**
 * Les **surfaces du combat** qui doivent tenir dans la fenêtre, au-dessus de la barre de
 * navigation fixe (qui masque le bas de l'écran) : la main (#170), puis la **pile d'actions du
 * tour**, le **bandeau du tour** et la **piste d'Interventions** (#194).
 *
 * **D-193 remplace la barre d'action** (la barre d'action de #191) : il n'y a plus de barre en bas
 * de l'écran. Le bas ne porte que la main ; « Fin du tour », les gestes et les Pressions sont la
 * pile flottante `.actions-flottantes` au milieu à droite de la table ; les textes du tour sont le
 * bandeau `.combat-toast` en haut de la table. La piste d'Interventions est suivie par sa
 * **classe**, pas par `data-pas-a-pas="interventions"` : cet attribut n'est posé que **lorsque le
 * pas-à-pas désigne la piste** (#202). Un **élément absent** ne fait rien échouer ; un élément
 * présent qui sort de la fenêtre, si — la garde **mord**.
 */
const CIBLES_HAUTEUR = [
  { nom: 'la main', selecteur: '.hand' },
  { nom: "la pile d'actions du tour", selecteur: '.actions-flottantes' },
  { nom: 'le bandeau du tour', selecteur: '.combat-toast' },
  { nom: "la piste d'Interventions", selecteur: '.piste' },
  // L'action principale, mesurée **seule** (#320, D-193) : « Fin du tour » n'apparaît que quand
  // finir le tour est possible. Un bouton absent ne fait rien échouer.
  { nom: '« Fin du tour »', selecteur: '.actions-flottantes .button--fin.is-a-toi' },
  // Le plateau (#741, #743) : mesuré pour que son rapport dise sa hauteur, et pour que la pile
  // d'actions soit jugée contre ses bords (D-193) — jamais jugé lui-même (`SELECTEUR_PLATEAU`).
  { nom: 'le plateau', selecteur: '.board' }
];

/** La cible mesurée et imprimée mais non jugée par `controlesHauteur` (#741, #743). */
const SELECTEUR_PLATEAU = '.board';

/** La pile flottante des actions du tour (D-193) : « Fin du tour », gestes, Pressions. */
const SELECTEUR_ACTIONS = '.actions-flottantes';

/**
 * #741 — la **main rognée** (`.hand`, D-094 (2)). Sa hauteur **visible** (la partie qui reste dans la
 * fenêtre et hors des ancêtres qui la rognent) doit valoir au moins 44 px (le plancher de #741) ; le
 * plancher de la composition cible est l'intervalle 52–60 px de #743 (cible 56).
 *
 * D-193 rend la main rognée **en permanence** (~56 px visibles, le bas de l'écran ne porte plus
 * qu'elle) : ces deux bornes se jugent donc à chaque passage où la main est mesurée, et ne sont plus
 * une branche dormante qui attendait une main rognée.
 */
const PLANCHER_MAIN_VISIBLE = 44;
const MAIN_VISIBLE_MIN = 52;
const MAIN_VISIBLE_MAX = 60;

/**
 * Les règles **de téléphone portrait** (D-193 : la main rognée au bas de l'écran, la pile flottante
 * au-dessus de la table) ne se jugent que sous cette largeur **et** en portrait. Sur PC et grand
 * écran la main n'est pas rognée : seules les règles génériques s'y appliquent.
 */
const LARGEUR_TELEPHONE_MAX = 639;
const estTelephonePortrait = (viewport) => viewport.width <= LARGEUR_TELEPHONE_MAX && viewport.height > viewport.width;

/**
 * **Le bureau (≥ 900 px) suit la composition du téléphone** (D-200, #790) : la main y est rognée au bas de
 * la fenêtre, comme sur téléphone. Deux règles de téléphone s'y étendent, et deux seulement :
 * - **la hauteur visible de la main** — mais pas en 52–60 px fixes : sur bureau la bande suit la fenêtre,
 *   `clamp(56 px, 7 % de la hauteur, 72 px)` (`--main-bande`, `src/styles.css`), soit 56 px à 800 de haut et
 *   72 px à 1080. L'intervalle jugé est cette bande attendue ± 4 px (la même tolérance que 52–60 autour de 56) :
 *   52–60 px à 1280 × 800, 68–76 px à 1920 × 1080 ;
 * - **rien ne se pose sous la main**.
 * Les bords du plateau restent **une règle de téléphone** : sur bureau la table est un rond plus étroit que la
 * fenêtre, et la pile d'actions flotte à droite, hors du plateau, par construction (D-200 (1)).
 * La bande 640–899 px, que D-200 ne tranche pas, ne juge que les règles génériques.
 */
const LARGEUR_BUREAU_MIN = 900;
const BANDE_MAIN_BUREAU_MIN = 56;
const BANDE_MAIN_BUREAU_MAX = 72;
const BANDE_MAIN_BUREAU_TOLERANCE = 4;
const estBureau = (viewport) => viewport.width >= LARGEUR_BUREAU_MIN;
/** La bande de la main attendue sur bureau pour cette hauteur de fenêtre : le `clamp` de `--main-bande`. */
const bandeMainBureau = (hauteur) =>
  Math.min(BANDE_MAIN_BUREAU_MAX, Math.max(BANDE_MAIN_BUREAU_MIN, Math.round(hauteur * 0.07)));

/**
 * Mesure, **dans le navigateur**, le haut et le bas de chaque cible, et la limite à ne pas
 * franchir : le haut de la barre de navigation fixe (ou le bas de la fenêtre sans elle).
 *
 * Passée à `page.evaluate` avec ses cibles en argument : Playwright sérialise la fonction,
 * qui ne peut donc lire **aucune** constante du module.
 */
function mesureHauteur(cibles) {
  const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
  const limite = Math.round(nav ? nav.top : window.innerHeight);
  // La cible de doigt (#320, `docs/SPEC-COMBAT-UI.md` §5.1) : les boutons de la pile des actions du
  // tour (D-193) et de la ligne du pas-à-pas, mesurés tels que rendus — pas lus dans la feuille de
  // style. Un bouton masqué (`display: none`, hauteur nulle) n'en est pas un. 43,5 : l'arrondi du
  // navigateur.
  const boutons = [...document.querySelectorAll('.actions-flottantes .button, .pas-a-pas__ligne button')];
  const nomDe = (bouton) => (bouton.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const boutonsPetits = boutons
    .map((bouton) => ({
      nom: nomDe(bouton),
      hauteur: Math.round(bouton.getBoundingClientRect().height * 10) / 10
    }))
    .filter(({ hauteur }) => hauteur > 0 && hauteur < 43.5);
  // Un bouton de la pile rogné par le défilement **interne** de la pile (`overflow-y: auto`) n'est
  // pas atteignable sans défiler la pile : la cible est là, mais elle n'est pas visible.
  const boutonsCaches = boutons
    .filter((bouton) => {
      const pile = bouton.closest('.actions-flottantes');
      if (!pile) return false;
      const r = bouton.getBoundingClientRect();
      const p = pile.getBoundingClientRect();
      return r.height > 0 && (r.top < p.top - 0.5 || r.bottom > p.bottom + 0.5);
    })
    .map(nomDe);
  // **Rien ne se pose sous la main** (D-193 (3)) : le bas de l'écran ne porte que la main. Sont relevés
  // les éléments du combat, hors de la main et de la navigation, qui **commencent** sous le haut de la
  // main. Le jugement (« sous le **bas** visible de la main ») se fait dans `controlesHauteur`, qui a
  // le bas de la main et la limite. Ne sont pas relevés : le contenant de la main (`.hand-panel`, dont
  // la pastille « N / 10 » est un calque posé **dans** le rectangle de la main, par D-193 (3)), les
  // éléments sr-only ou clipés à 1 px, et les ancêtres de la main.
  const main = document.querySelector('.hand');
  const sousLaMain = [];
  if (main) {
    const hautMain = main.getBoundingClientRect().top;
    for (const el of document.querySelectorAll('.battle *')) {
      if (el.contains(main) || main.contains(el) || el.closest('.bottom-nav, .sr-only, .hand-panel')) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      if (r.top >= hautMain + 1) {
        const classe = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
        sousLaMain.push({
          nom: `${el.tagName.toLowerCase()}${classe ? `.${classe}` : ''}`,
          haut: Math.round(r.top),
          bas: Math.round(r.bottom)
        });
      }
    }
  }
  return {
    boutonsPetits,
    boutonsCaches,
    sousLaMain,
    fenetre: window.innerHeight,
    largeur: window.innerWidth,
    // Le pas-à-pas du premier combat (#143) ajoute une centaine de pixels collés en haut : tant qu'il est
    // ouvert, la page défile, et c'est D-103 qui le juge (voir `controlesHauteur`).
    pasAPasOuvert: !!document.querySelector('.pas-a-pas'),
    limite,
    // De combien le document dépasse la fenêtre : l'écran de combat ne défile plus (D-103, #243).
    defilement: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    mesures: cibles.map(({ nom, selecteur }) => {
      const el = document.querySelector(selecteur);
      const rect = el?.getBoundingClientRect();
      // Un élément `display: none` (la pile vide, par exemple) a un rectangle nul : il est absent.
      const present = !!rect && rect.width > 0 && rect.height > 0;
      const haut = present ? Math.round(rect.top) : null;
      const bas = present ? Math.round(rect.bottom) : null;
      const gauche = present ? Math.round(rect.left) : null;
      const droite = present ? Math.round(rect.right) : null;
      // #741 — la hauteur **visible** : `min(bas, limite, ancêtres clipsants) - max(haut, 0)`. Un
      // ancêtre clipse quand son `overflow` calculé n'est pas `visible` ; les ancêtres clipsants
      // forment une intersection (haut et bas). Un rectangle brut ne dit pas ce qui se voit.
      // `coupe` (D-193) : l'élément dépasse un ancêtre clipsant, sur un axe ou l'autre — la pile
      // d'actions doit tenir **entière** dans la table, pas être rognée par elle.
      let visible = null;
      let coupe = false;
      if (present) {
        let clipHaut = -Infinity;
        let clipBas = Infinity;
        for (let anc = el.parentElement; anc; anc = anc.parentElement) {
          if (getComputedStyle(anc).overflow === 'visible') continue;
          const r = anc.getBoundingClientRect();
          clipHaut = Math.max(clipHaut, Math.round(r.top));
          clipBas = Math.min(clipBas, Math.round(r.bottom));
          if (
            r.left > rect.left + 0.5 ||
            r.right < rect.right - 0.5 ||
            r.top > rect.top + 0.5 ||
            r.bottom < rect.bottom - 0.5
          ) {
            coupe = true;
          }
        }
        visible = Math.min(bas, limite, clipBas) - Math.max(haut, 0, clipHaut);
      }
      return { nom, selecteur, present, haut, bas, gauche, droite, visible, coupe };
    })
  };
}

/**
 * **La marge exigée** sous la barre de navigation : `20` px à 420 × 900 (D-094 (3)).
 *
 * Le seuil de 830 px (D-094 (2)) dit seulement que l'écran tient ; la marge dit qu'il tient
 * **avec de la place** — « pour qu'une ligne de plus ne rougisse pas la capture ». Elle
 * s'applique à **tous** les états mesurés, pas-à-pas ouvert compris : D-094 (3) ne prévoit
 * aucune exception, et une exception se décide, elle ne se glisse pas dans le code (#237).
 *
 * **D-193 (3) amende ce qui en est tiré** : la marge **entre la barre et la main** n'existe plus,
 * parce que la barre a disparu. Il reste la marge de chaque surface **sous soi, jusqu'à la
 * fenêtre** — la main, en bas — ; la pile d'actions, au milieu de la table, n'a rien sous elle à
 * garder et n'est pas soumise à cette marge (`controlesHauteur`).
 */
const MARGE_MIN = 20;

/**
 * Le **contrôle** de la géométrie, sans DOM ni navigateur (#194) : la sonde
 * `--controle-hauteur` et son test le lisent directement, donc il mord même quand aucun
 * Chromium ne tourne.
 *
 * Un élément **absent** ne produit **rien** — c'est ce qui laisse la garde dormante quand une
 * surface n'est pas rendue ; un élément présent qui sort de la fenêtre produit un message qui
 * **le nomme**, et pas seulement « la main ».
 *
 * Les défauts mesurés, et **chacun mord** :
 * - l'élément qui **sort** de la fenêtre (bas au-delà de la barre de navigation, ou côtés) ;
 * - celui qui n'a **pas la marge** de D-094 (3), sous soi, jusqu'à la fenêtre ;
 * - la main rognée sous son plancher de 44 px (#741) ; sur téléphone portrait, sa hauteur visible hors de
 *   52–60 px (#743) ; sur bureau (≥ 900 px, D-200), hors de la bande attendue ± 4 px (`bandeMainBureau`) ;
 * - sur téléphone portrait (`estTelephonePortrait`) et sur bureau (`estBureau`) : **rien ne se pose sous la main** (D-193 (3))
 *   — sous le bas visible de la main, pas sous son haut ;
 * - la **pile d'actions du tour** (D-193) : dans la fenêtre, pas sur la main, pas rognée par la
 *   table, ses boutons atteignables, les cibles de 44 px ; sur téléphone, dans les bords du plateau ;
 * - le **bandeau du tour** ne recouvre pas la pile.
 *
 * Un élément déjà hors de la fenêtre n'est nommé qu'une fois (le second message serait du bruit),
 * et `etat` — le libellé du passage mesuré, par exemple « pas-à-pas terminé » — entre dans le
 * message pour qu'on sache **lequel** des états mesurés fauter.
 *
 * Retiré par D-193 : la marge **entre la barre et la main** (D-094 (3)) et le vide maximal sous la
 * barre (D-171) ; la barre d'action n'existe plus, et la pile flottante n'est pas collée au bas.
 */
function controlesHauteur({
  limite,
  mesures,
  viewport,
  defilement = 0,
  etat = '',
  boutonsPetits = [],
  boutonsCaches = [],
  sousLaMain = []
}) {
  const problemes = [];
  const lieu = `${viewport.width} × ${viewport.height}${etat ? `, ${etat}` : ''}`;

  // **La cible de doigt de 44 px** (#320) : un bouton de la pile des actions ou du pas-à-pas plus bas
  // est nommé, avec sa hauteur. Gagner de la marge en rognant la cible est exactement ce que ce
  // ticket refuse : la hauteur se gagne ailleurs.
  for (const { nom, hauteur } of boutonsPetits) {
    problemes.push(
      `le bouton « ${nom} » ne fait que ${hauteur} px de haut (${lieu}) : ` +
        `la cible de doigt est de 44 px (SPEC-COMBAT-UI §5.1)`
    );
  }

  // Un bouton de la pile rogné par son défilement interne n'est pas atteignable sans la faire défiler.
  for (const nom of boutonsCaches) {
    problemes.push(
      `le bouton « ${nom} » est caché dans la pile d'actions du tour (${lieu}) : ` +
        `la pile doit le montrer sans défilement interne (D-193)`
    );
  }

  // **L'écran ne défile pas** (D-103, #243), pas-à-pas ouvert compris. Un document plus haut que
  // la fenêtre amène la cible du pas-à-pas en haut et rogne l'en-tête sur la capture ; surtout,
  // la marge mesurée y vaut alors l'air qu'on a réservé, pas la place réelle (#237). La marge
  // ci-dessous ne vaut donc que sur un écran qui tient.
  if (defilement > 0) {
    problemes.push(
      `l'écran de combat défile de ${defilement} px (${lieu}) : ` + `il doit tenir dans la fenêtre (D-103)`
    );
  }

  // Le plateau est mesuré, jamais jugé (`SELECTEUR_PLATEAU`) ; il sert de bord à la pile d'actions.
  const plateau = mesures.find(({ selecteur }) => selecteur === SELECTEUR_PLATEAU);
  const jugees = mesures.filter(({ selecteur }) => selecteur !== SELECTEUR_PLATEAU);
  const main = jugees.find(({ selecteur }) => selecteur === '.hand');
  const actions = jugees.find(({ selecteur }) => selecteur === SELECTEUR_ACTIONS);
  const bandeau = jugees.find(({ selecteur }) => selecteur === '.combat-toast');
  // #741 — la main **rognée par le bas** : son bas passe sous la limite, son haut tient dans la
  // fenêtre, et sa hauteur visible est mesurée. Elle n'est pas « hors » : seule la partie visible
  // se juge (plus bas). Sans hauteur visible mesurée, elle reste « hors » comme avant. Depuis D-193
  // la main est rognée en permanence : `rognee` est vrai dès qu'elle est mesurée avec sa hauteur.
  const rognee = !!main?.present && main.haut >= 0 && typeof main.visible === 'number';
  const hors = jugees.filter(
    ({ selecteur, present, haut, bas }) => present && (haut < 0 || (bas > limite && !(rognee && selecteur === '.hand')))
  );
  for (const { nom, bas } of hors) {
    problemes.push(
      `${nom} n'est pas visible sans défiler (${lieu}) : ` +
        `bas de ${nom} à ${bas} px, barre de navigation à ${limite} px`
    );
  }

  // **La marge** (#237, D-094 (3)) : tenir dans la fenêtre ne suffit pas, il faut y tenir avec 20 px de
  // place sous soi. Seuls les éléments **dans** la fenêtre sont jugés ici — un élément qui en sort est
  // déjà nommé au-dessus. La pile d'actions est exclue : elle est au milieu de la table, elle n'a rien
  // sous elle à garder (D-193 (3)).
  const justes = jugees.filter(
    ({ present, haut, bas, selecteur }) =>
      present && haut >= 0 && bas <= limite && limite - bas < MARGE_MIN && selecteur !== SELECTEUR_ACTIONS
  );
  for (const { nom, bas } of justes) {
    const marge = limite - bas;
    problemes.push(
      `${nom} n'a que ${marge} px de marge (${lieu}) : ` +
        `bas de ${nom} à ${bas} px, barre de navigation à ${limite} px, ${MARGE_MIN} px exigés (D-094 (3))`
    );
  }

  // Une surface qui sort de la **largeur** de l'écran n'est pas visible non plus (D-193 : la pile est
  // à droite de la table, la table est plus large que l'écran).
  for (const { nom, present, gauche, droite } of jugees) {
    if (!present || typeof gauche !== 'number' || typeof droite !== 'number') continue;
    if (gauche < 0 || droite > viewport.width) {
      problemes.push(
        `${nom} sort de la largeur de l'écran (${lieu}) : gauche à ${gauche} px, droite à ${droite} px, ` +
          `écran de ${viewport.width} px`
      );
    }
  }

  // Deux rectangles se recouvrent-ils ? Sans largeur mesurée, on ne sait que la verticale : elle suffit.
  const chevauche = (a, b) =>
    a.haut < b.bas &&
    b.haut < a.bas &&
    (typeof a.gauche !== 'number' || typeof b.gauche !== 'number' || (a.gauche < b.droite && b.gauche < a.droite));

  // #741/#743 — la hauteur visible de la main. Elle se juge à chaque passage, D-193 la rendant rognée
  // en permanence.
  // Les règles de téléphone portrait (D-193) : la hauteur visible de 52–60 px, « rien sous la main »,
  // et les bords du plateau. Sur bureau (D-200), la hauteur visible (suivant la fenêtre) et « rien sous la
  // main » s'y jugent aussi ; les bords du plateau, non.
  const telephone = estTelephonePortrait(viewport);
  const bureau = estBureau(viewport);
  // Les bornes visibles de la main : 52–60 px sur téléphone, la bande attendue ± 4 px sur bureau (D-200).
  const [mainMin, mainMax] = bureau
    ? [
        bandeMainBureau(viewport.height) - BANDE_MAIN_BUREAU_TOLERANCE,
        bandeMainBureau(viewport.height) + BANDE_MAIN_BUREAU_TOLERANCE
      ]
    : [MAIN_VISIBLE_MIN, MAIN_VISIBLE_MAX];

  if (rognee) {
    const visible = main.visible;
    // #741 — le plancher : une main rognée qui ne montre pas 44 px de ses cartes n'est pas lisible.
    if (visible < PLANCHER_MAIN_VISIBLE) {
      problemes.push(
        `${main.nom} rognée n'a que ${visible} px de hauteur visible (${lieu}) : ` +
          `${PLANCHER_MAIN_VISIBLE} px au moins (#741)`
      );
    } else if ((telephone || bureau) && (visible < mainMin || visible > mainMax)) {
      // #743 — la composition cible montre la tête des cartes sur 52–60 px (cible 56), sur téléphone ;
      // D-200 — sur bureau, la bande attendue pour la hauteur de la fenêtre ± 4 px.
      problemes.push(
        `${main.nom} rognée a une hauteur visible de ${visible} px (${lieu}) : ` +
          `${mainMin}–${mainMax} px attendus (${bureau ? 'D-200' : '#743'})`
      );
    }
  }

  // **Rien ne se pose sous la main** (D-193 (3)), sur téléphone : le bas de l'écran ne porte que la main.
  // « Sous la main » = commence au-dessus du **bas visible** de la main (le bas, borné par la limite),
  // pas au haut : le haut de la main est occupé par ses propres contenus (pastille, titre sr-only).
  // Un élément rendu sous ce bas est nommé, avec sa position ; c'est ce qui aurait rétabli la barre d'action.
  if ((telephone || bureau) && main?.present && typeof main.bas === 'number') {
    const basVisibleMain = Math.min(main.bas, limite);
    for (const { nom, haut } of sousLaMain) {
      if (haut < basVisibleMain - 0.5) continue;
      problemes.push(
        `élément « ${nom} » rendu sous la main (${lieu}) : haut à ${haut} px, bas visible de la main à ${basVisibleMain} px : ` +
          `le bas de l'écran ne porte que la main (D-193 (3))`
      );
    }
  }

  // **La pile d'actions du tour** (D-193) : elle ne recouvre pas la main, elle n'est pas rognée par la
  // table, et, sur téléphone, elle tient dans les bords du plateau. Dans la fenêtre seulement : un élément
  // hors de la fenêtre est déjà nommé au-dessus.
  if (actions?.present && !hors.includes(actions)) {
    if (main?.present && !hors.includes(main) && chevauche(actions, main)) {
      problemes.push(
        `${actions.nom} recouvre ${main.nom} (${lieu}) : haut de la pile à ${actions.haut} px, bas de la main à ${main.bas} px`
      );
    }
    if (actions.coupe) {
      problemes.push(`${actions.nom} est rognée par le plateau (${lieu}) : la pile doit tenir dans la table (D-193)`);
    }
    if (
      telephone &&
      plateau?.present &&
      typeof plateau.gauche === 'number' &&
      typeof actions.gauche === 'number' &&
      (actions.gauche < plateau.gauche || actions.droite > plateau.droite)
    ) {
      problemes.push(
        `${actions.nom} déborde le bord du plateau (${lieu}) : gauche à ${actions.gauche} px, droite à ${actions.droite} px, ` +
          `plateau de ${plateau.gauche} à ${plateau.droite} px (D-193)`
      );
    }
  }

  // Le bandeau du tour (en haut de la table) ne recouvre pas la pile.
  if (bandeau?.present && actions?.present && !hors.includes(bandeau) && !hors.includes(actions)) {
    if (chevauche(bandeau, actions)) {
      problemes.push(
        `${bandeau.nom} recouvre ${actions.nom} (${lieu}) : bas du bandeau à ${bandeau.bas} px, haut des actions à ${actions.haut} px`
      );
    }
  }

  return problemes;
}

/**
 * Mesure les trois surfaces, journalise, et range les manquements dans `problems`.
 * `contexte` est le **libellé de l'état** mesuré (graine, ou « pas-à-pas terminé ») : il part
 * dans le message de la garde, pour qu'un échec nomme l'état et pas seulement la surface (#237).
 */
async function controlerHauteur(page, contexte, route, viewport = VIEWPORT) {
  const hauteur = await page.evaluate(mesureHauteur, CIBLES_HAUTEUR);
  console.log(`combat · ${contexte} · ${JSON.stringify(hauteur)}`);
  // #741, #743 — la hauteur visible de la main et celle du plateau, lisibles sans lire le JSON.
  const visibleMain = hauteur.mesures.find(({ selecteur }) => selecteur === '.hand')?.visible;
  const plateau = hauteur.mesures.find(({ selecteur }) => selecteur === SELECTEUR_PLATEAU);
  console.log(
    `combat · ${contexte} · hauteur visible de la main : ${visibleMain ?? 'absente'} px, ` +
      `plateau : ${plateau?.present ? plateau.bas - plateau.haut : 'absent'} px`
  );
  for (const probleme of controlesHauteur({ ...hauteur, viewport, etat: contexte })) {
    problems.push(`${route} · ${probleme}`);
  }
}

/**
 * **Le pire cas de l'accueil** (#553) : une partie rangée ajoute « Une partie t'attend au tour N »
 * sous les deux gestes. L'amorçage des captures ne porte que `tutorielVu`, donc la ligne n'est
 * jamais rendue — et une hauteur mesurée sans elle ne dit rien du cas réel. On la **pose** le
 * temps de la mesure, avec sa classe et son texte, puis on la retire : la capture ne montre pas
 * un état que la partie n'a pas.
 */
async function poserAttentePireCas(page) {
  await page.evaluate(() => {
    const actions = document.querySelector('.hero__actions');
    if (!actions || document.querySelector('.hero__attente')) return;
    const ligne = document.createElement('p');
    ligne.className = 'muted hero__attente pire-cas';
    ligne.textContent = 'Une partie t’attend au tour 7.';
    actions.after(ligne);
  });
}

/** Retire la ligne du pire cas : la capture reprend l'état réel de l'amorçage. */
async function retirerAttentePireCas(page) {
  await page.evaluate(() => document.querySelector('.hero__attente.pire-cas')?.remove());
}

/** Refuse un document d'accueil plus haut que sa fenêtre portrait, sans masquer son contenu. */
async function controlerAccueilSansDefilement(page, slug, viewport) {
  await poserAttentePireCas(page);
  const hauteur = await page.evaluate(() => ({
    document: document.documentElement.scrollHeight,
    fenetre: window.innerHeight,
    limite: Math.round(document.querySelector('.bottom-nav')?.getBoundingClientRect().top ?? window.innerHeight),
    sections: ['.hero', '.stats-grid', '.home__version'].map((selecteur) => {
      const rect = document.querySelector(selecteur)?.getBoundingClientRect();
      return {
        nom: selecteur,
        present: !!rect,
        haut: rect ? Math.round(rect.top) : null,
        bas: rect ? Math.round(rect.bottom) : null
      };
    })
  }));
  for (const probleme of controlesAccueil({
    documentHeight: hauteur.document,
    viewportHeight: hauteur.fenetre,
    limite: hauteur.limite,
    sections: hauteur.sections
  })) {
    problems.push(
      `${slug} · ${probleme} (${viewport.width} × ${viewport.height}) : l'accueil portrait doit tenir sans contenu coupé (D-171)`
    );
  }
  await retirerAttentePireCas(page);
}

/**
 * Les tours qu'on joue au plus pour obtenir une Pression jouable (#320). Le Poste peut n'offrir
 * que des Pressions à deux cafés : un café par tour, la patience a une borne, et un état qu'on
 * n'atteint pas se **dit** (voir `jusquAUnePression`), il ne passe pas pour mesuré.
 */
const TOURS_MAX_POUR_UNE_PRESSION = 8;

/**
 * **Jouer jusqu'à une Pression jouable** (#320) — l'état que l'arrivée ne montre jamais.
 *
 * L'arrivée n'affiche que « Fin du tour » : la barre d'action y est à sa hauteur **minimale**, et
 * la mesure y disait `defilement = 0` pendant que, au tour 3, avec un café attaché, la barre
 * passait sur deux rangées et « Fin du tour » sortait sous la navigation. Cette fonction joue les
 * gestes d'un testeur — toucher le Planqué qui reçoit le café (#454, D-145), puis « Fin du tour », tant qu'aucune Pression n'est
 * proposée — et rend le **tour** atteint, ou `null` quand le Poste n'en offre aucune dans la borne.
 *
 * Une Pression jouable est un bouton `button--primary` de la pile des actions (`ActionButton`, `attack`).
 */
async function jusquAUnePression(page) {
  const actions = page.locator(SELECTEUR_ACTIONS);
  const pression = actions.locator('.button--primary');
  for (let essai = 0; essai < TOURS_MAX_POUR_UNE_PRESSION; essai += 1) {
    const attacher = page.getByRole('button', { name: /Attacher le café à/ });
    if ((await attacher.count()) > 0) {
      await attacher.first().click();
      await page.waitForTimeout(500);
    }
    if ((await pression.count()) > 0) {
      const tete = await page.locator('.battle__head').textContent();
      return Number(tete?.match(/Tour (\d+)/)?.[1] ?? 0);
    }
    const avant = await page.locator('.battle__head').textContent();
    await actions.getByRole('button', { name: 'Fin du tour', exact: true }).click();
    // Le tour de l'IA se joue seul : on attend que la main revienne **et** que le tour ait changé.
    await page.waitForFunction(
      (ancien) => {
        const texte = document.querySelector('.battle__head')?.textContent ?? '';
        return texte.includes('à toi') && texte !== ancien;
      },
      avant,
      { timeout: 60000 }
    );
    await page.waitForTimeout(1200);
  }
  return null;
}

/**
 * **L'instant « Rebut ouvert »** (#740, critère 7) : le panneau de Rebut est non modal et ne doit pas faire
 * défiler la page. On ouvre le Rebut de **chaque** camp (l'adversaire puis le joueur, un à la fois) au
 * premier tour, puis une seconde fois après quelques tours (jusqu'à une Pression jouable) où le Rebut a plus
 * de chances de porter des cartes ; à chaque ouverture, `scrollY` est écrit dans la sortie et le contrôle de hauteur
 * habituel juge le reste (défilement, cibles de 44 px). Le nombre de cartes du panneau est écrit dans la sortie :
 * un Rebut vide ne prouve la hauteur que d'un panneau vide, et c'est dit, pas masqué.
 */
async function mesurerRebutOuvert(browser) {
  const instant = INSTANTS_COMBAT[0];
  const { context, page } = await ouvrirCombat(browser, instant, { pasAPasCombatVu: true });
  const ouvrirLesDeux = async (etape) => {
    const boutons = page.getByRole('button', { name: /^Consulter le Rebut/ });
    const n = await boutons.count();
    if (n < 2) problems.push(`${ROUTE_COMBAT} · « Rebut ouvert » : ${n} bouton(s) de Rebut au lieu de 2 (#740)`);
    for (let i = 0; i < n; i += 1) {
      const bouton = boutons.nth(i);
      // Un tap, pas un `click()` de Playwright : celui-ci fait défiler vers l'élément, et la pile du joueur est à
      // moitié sortie de l'écran à dessein (D-193) — le défilement programmatique décalait la page de 7 px.
      await bouton.evaluate((el) => el.click());
      await page.waitForTimeout(250);
      const cartes = await page.locator('.panneau-rebut__liste li').count();
      const [scrollX, scrollY] = await page.evaluate(() => [window.scrollX, window.scrollY]);
      const nom = `${new Date(instant).toISOString()} (Rebut ouvert, ${etape}, pile ${i + 1}/${n}, ${cartes} carte(s))`;
      console.log(`combat · ${nom} · scrollX ${scrollX}, scrollY ${scrollY}`);
      await controlerHauteur(page, nom, ROUTE_COMBAT);
      if (i === 0)
        await page.screenshot({ path: join(outDir, `combat-rebut-ouvert-${etape}.png`), fullPage: PLEINE_PAGE });
      await bouton.evaluate((el) => el.click());
      await page.waitForTimeout(150);
    }
  };
  await ouvrirLesDeux('tour-1');
  const tour = await jusquAUnePression(page);
  if (tour !== null) await ouvrirLesDeux(`tour-${tour}`);
  await context.close();
}

/**
 * Le combat dans **une densité** (`sobre` ou `détaillé`), à l'arrivée, **avec le pire cas** (#292, #321).
 *
 * `détaillé` (#292, `docs/SPEC-COMBAT-UI.md` T9) remet des annotations sur le plateau : c'est la
 * densité qui peut le faire **grossir** — donc sortir la barre d'action de la fenêtre. Le store
 * est amorcé avec `combatDetaille: true` (la bascule est mémorisée, SPEC §4.5), et on mesure
 * avec les **mêmes** gardes que `sobre` : hauteur, marge, défilement, cibles de 44 px, pas-à-pas
 * ouvert comme terminé. `sobre` (#321) n'a, à l'arrivée, rien à mesurer de plus que les passages
 * ordinaires : seul son **pire cas** est joué ici.
 */
async function mesurerDensite(browser, detaille) {
  const densite = detaille ? 'détaillé' : 'sobre';
  for (const pasAPasVu of [false, true]) {
    for (const [index, instant] of INSTANTS_COMBAT.entries()) {
      const { context, page } = await ouvrirCombat(browser, instant, {
        ...(detaille ? { combatDetaille: true } : {}),
        ...(pasAPasVu ? { pasAPasCombatVu: true } : {})
      });
      // La bascule est bien posée : sans elle la mesure ne regarderait pas la densité qu'elle nomme
      // (une garde qui ne regarde pas le bon état ne garde rien).
      if ((await page.locator(`.battle--${detaille ? 'detaille' : 'sobre'}`).count()) === 0) {
        problems.push(`${ROUTE_COMBAT} · le mode « ${densite} » n'est pas actif : la mesure ne le voit pas`);
      }
      const etat = `${new Date(instant).toISOString()} (${densite}${pasAPasVu ? ', pas-à-pas terminé' : ''})`;
      if (detaille) {
        await controlerHauteur(page, etat, ROUTE_COMBAT);
        // La capture de la preuve : l'arrivée, pas-à-pas terminé, à la première graine.
        if (pasAPasVu && index === 0) {
          await page.screenshot({ path: join(outDir, 'combat-detail.png'), fullPage: PLEINE_PAGE });
        }
      }
      // **Le pire cas** : ce que l'arrivée ne montre pas, c'est les Conditions.
      await page.evaluate(poserLePireCas, [detaille, MODELE_BADGE]);
      await page.waitForTimeout(300);
      await controlerHauteur(page, `${etat}, pire cas`, ROUTE_COMBAT);
      if (pasAPasVu && index === 0) {
        await page.screenshot({
          path: join(outDir, detaille ? 'combat-detail-pire-cas.png' : 'combat-sobre-pire-cas.png'),
          fullPage: PLEINE_PAGE
        });
      }
      await context.close();
    }
  }
}

/**
 * Pose, dans la fiche de chaque camp, **les trois Conditions** qu'un Planqué peut porter ensemble
 * (Surcharge et Épuisement se cumulent avec une Condition d'état, SPEC-COMBAT-UI §4) et, en
 * `détaillé`, **trois types de café** au Deck : le plus haut que la fiche puisse grossir.
 *
 * C'est le **DOM** qui reçoit ces éléments — le moteur n'est pas touché : atteindre ces
 * Conditions en jouant dépend de la graine et du hasard, et la mesure doit les voir à chaque fois.
 * Le balisage **n'est pas recopié ici** : il vient de `MODELE_BADGE`, que
 * `StatusBadge.test.tsx` confronte au composant (#324). Passée à `page.evaluate` avec son
 * modèle en argument : aucune constante du module n'y est lisible.
 */
function poserLePireCas([detaille, modele]) {
  for (const info of document.querySelectorAll('.poste__info')) {
    for (const { code, nom } of modele.statuts) {
      const puce = document.createElement('span');
      puce.className = `${modele.racine} ${modele.modificateur}${code.toLowerCase()}`;
      const icone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icone.setAttribute('width', String(modele.icone.largeur));
      icone.setAttribute('height', String(modele.icone.hauteur));
      const texte = document.createElement('span');
      texte.className = detaille ? modele.nom : modele.masque;
      texte.textContent = nom;
      puce.append(icone, texte);
      info.append(puce);
    }
    const types = info.querySelector('.poste__machine-types');
    if (types) types.textContent = 'Plante · Eau · Psychique';
  }
}

/**
 * Le combat **avec une Pression jouable** (#320), à chaque instant figé et dans les deux états du
 * pas-à-pas : c'est là que la barre est la plus haute. Un instant dont le Poste n'offre aucune
 * Pression dans la borne n'est pas une panne — mais **aucun** instant n'en offrant, la mesure ne
 * verrait plus rien, et ça échoue : une garde qui ne regarde rien ne garde rien.
 */
async function mesurerAvecUnePression(browser, detaille = false) {
  let atteints = 0;
  const densite = detaille ? 'détaillé, ' : '';
  for (const pasAPasVu of [false, true]) {
    for (const instant of INSTANTS_COMBAT) {
      const { context, page } = await ouvrirCombat(browser, instant, {
        ...(pasAPasVu ? { pasAPasCombatVu: true } : {}),
        ...(detaille ? { combatDetaille: true } : {})
      });
      const tour = await jusquAUnePression(page);
      const etat = `${new Date(instant).toISOString()} (${densite}Pression jouable${pasAPasVu ? ', pas-à-pas terminé' : ''})`;
      if (tour === null) {
        console.log(`combat · ${etat} · aucune Pression en ${TOURS_MAX_POUR_UNE_PRESSION} tours : non mesuré`);
      } else {
        atteints += 1;
        await controlerHauteur(page, `${etat}, tour ${tour}`, ROUTE_COMBAT);
        // **Le pire cas** (#321) : la barre y est à deux rangées, et les trois Conditions des deux
        // camps y ont fait défiler l'écran de 23 px en `sobre`.
        await page.evaluate(poserLePireCas, [detaille, MODELE_BADGE]);
        await page.waitForTimeout(300);
        await controlerHauteur(page, `${etat}, tour ${tour}, pire cas`, ROUTE_COMBAT);
        // Premier état atteint : c'est aussi la capture du tour (`combat-pression.png`).
        if (atteints === 1) {
          await page.screenshot({
            path: join(outDir, detaille ? 'combat-detail-pression.png' : 'combat-pression.png'),
            fullPage: PLEINE_PAGE
          });
        }
      }
      await context.close();
    }
  }
  if (atteints === 0) {
    problems.push(
      `${ROUTE_COMBAT} · aucun état « ${densite}Pression jouable » atteint : les actions du tour ne sont mesurées que sans Pression`
    );
  }
  return atteints;
}

/**
 * **Un gabarit de D-171** : chaque page sous la garde de largeur, puis le combat sous les gardes de
 * hauteur — à l'arrivée, puis avec une Pression jouable et le pire cas. Une capture par page et par
 * état, préfixée du nom du gabarit (`telephone-petit-combat.png`).
 */
async function mesurerGabarit(browser, gabarit) {
  const { nom, viewport, mobile } = gabarit;
  const taille = `${viewport.width} × ${viewport.height}`;
  for (const [slug, route] of PAGES.filter(([, route]) => route !== ROUTE_COMBAT)) {
    const context = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
      storageState: amorcageStore(origine)
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`${route} (${taille}) · pageerror : ${error.message}`));
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    if (PAGES_SANS_DEFILEMENT_VERTICAL.includes(slug) && mobile && viewport.height > viewport.width) {
      await controlerAccueilSansDefilement(page, slug, viewport);
    }
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (debordement > 0) {
      problems.push(`${route} · la page déborde de ${debordement} px en largeur à ${taille} (D-171)`);
    }
    await page.screenshot({ path: join(outDir, `${nom}-${slug}.png`), fullPage: PLEINE_PAGE });
    await context.close();
  }

  const instant = INSTANTS_COMBAT[0];
  // Le **pas-à-pas ouvert** de la première partie : une centaine de pixels collés en haut, à
  // l'arrivée — l'état le plus haut qu'un nouveau testeur voit sur son téléphone.
  {
    const { context, page } = await ouvrirCombat(browser, instant, {}, gabarit);
    await controlerHauteur(
      page,
      `${new Date(instant).toISOString()} (${nom}, pas-à-pas ouvert)`,
      ROUTE_COMBAT,
      viewport
    );
    await page.screenshot({ path: join(outDir, `${nom}-combat-pas-a-pas.png`), fullPage: PLEINE_PAGE });
    await context.close();
  }
  const etat = `${new Date(instant).toISOString()} (${nom}, pas-à-pas terminé)`;
  {
    const { context, page } = await ouvrirCombat(browser, instant, { pasAPasCombatVu: true }, gabarit);
    await controlerHauteur(page, etat, ROUTE_COMBAT, viewport);
    await page.screenshot({ path: join(outDir, `${nom}-combat.png`), fullPage: PLEINE_PAGE });
    await context.close();
  }
  const { context, page } = await ouvrirCombat(browser, instant, { pasAPasCombatVu: true }, gabarit);
  const tour = await jusquAUnePression(page);
  if (tour === null) {
    problems.push(
      `${ROUTE_COMBAT} · ${nom} : aucune Pression jouable atteinte, les actions du tour ne sont mesurées que sans Pression`
    );
  } else {
    await controlerHauteur(page, `${etat}, Pression jouable, tour ${tour}`, ROUTE_COMBAT, viewport);
    await page.evaluate(poserLePireCas, [false, MODELE_BADGE]);
    await page.waitForTimeout(300);
    await controlerHauteur(page, `${etat}, Pression jouable, tour ${tour}, pire cas`, ROUTE_COMBAT, viewport);
    await page.screenshot({ path: join(outDir, `${nom}-combat-pression.png`), fullPage: PLEINE_PAGE });
  }
  await context.close();
}

/**
 * **Préparer le code d'une partie à deux** (#128) et le mesurer.
 *
 * Les gestes sont ceux des deux invités : ouvrir la section (repliée tant qu'aucune
 * partie n'existe), créer la partie, passer la main — le code n'apparaît qu'à la fin du
 * tour (`handover`, `src/store/pvp.ts`) —, puis le coller dans le champ d'en face, qui
 * reçoit donc un code **long**. Enfin la section est amenée à l'écran : la capture
 * photographie la **fenêtre**, donc ce qui n'est pas défilé n'existe pas.
 *
 * La mesure est la **garde** : un code absent, un bouton hors de l'écran ou une page qui
 * déborde en largeur font échouer `npm run capturer` — la capture ne peut donc pas
 * « prouver » #128 sans rien montrer.
 */
/**
 * **La fin d'une partie** (critique du 01/11/2026) : le forfait est le chemin le plus court vers
 * l'état terminé, et il ne dépend d'aucune graine. Ce que la garde mesure : le verdict est là,
 * la page ne défile pas, ne déborde pas en largeur, et « Nouveau combat » est **entier dans la
 * fenêtre** — c'est le geste que le produit vend (« envie de refaire une partie », `PRODUCT.md`).
 */
async function preparerFin(page) {
  await page.getByRole('button', { name: 'Menu du combat' }).click();
  await page.getByRole('button', { name: /^Abandonner$/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Abandonner/ })
    .click();
  await page.getByRole('button', { name: 'Nouveau combat' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const doc = document.documentElement;
    const bouton = [...document.querySelectorAll('button')].find((candidat) =>
      /Nouveau combat/.test(candidat.textContent ?? '')
    );
    const rect = bouton ? bouton.getBoundingClientRect() : null;
    const verdict = document.querySelector('[role="alert"]');
    return {
      defilement: doc.scrollHeight - doc.clientHeight,
      debordement: doc.scrollWidth - doc.clientWidth,
      verdict: verdict ? (verdict.textContent ?? '').trim().slice(0, 60) : '',
      bouton: rect
        ? { haut: Math.round(rect.top), bas: Math.round(rect.bottom), hauteur: Math.round(rect.height) }
        : null,
      fenetre: window.innerHeight
    };
  });
}

async function preparerCodePvp(page) {
  // Depuis #191 la Partie à deux vit derrière le menu `⋯` : on l'ouvre comme l'invité.
  await page.getByRole('button', { name: 'Menu du combat' }).click();
  await page.getByRole('button', { name: /Partie à deux/ }).click();
  await page.getByRole('button', { name: 'Créer une partie à deux' }).click();
  const finDuTour = page.getByRole('button', { name: 'Fin du tour', exact: true });
  if ((await finDuTour.count()) > 0) await finDuTour.click();
  await page.waitForSelector('textarea[aria-label="Code de la partie, à transmettre"]', { timeout: 15000 });
  // Le **champ de collage** reçoit le même code long (#128, « sans casser la mise en
  // page ») : c'est le geste du second joueur, et la mesure ci-dessous le vérifie.
  const code = await page.inputValue('textarea[aria-label="Code de la partie, à transmettre"]');
  await page.fill('textarea[aria-label="Code reçu, à coller"]', code);
  // Après le collage, le curseur est à la fin : la zone regarde la queue du code. On la
  // remet sur son début, sinon les deux zones ne se lisent pas comme le même code.
  await page.evaluate(() => {
    const champ = document.querySelector('textarea[aria-label="Code reçu, à coller"]');
    champ?.blur();
    if (champ) champ.scrollTop = 0;
  });
  // Le menu s'est ouvert seul (le code est prêt) : son panneau s'accroche à la barre d'état,
  // en haut de la page. On remonte donc la page, pour que la capture le montre en entier.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(450);
  return page.evaluate(() => {
    const zone = document.querySelector('textarea[aria-label="Code de la partie, à transmettre"]');
    const cadre = zone ? zone.getBoundingClientRect() : null;
    const copier = [...document.querySelectorAll('button')].find((bouton) =>
      /Copier le code/.test(bouton.textContent ?? '')
    );
    const bouton = copier ? copier.getBoundingClientRect() : null;
    return {
      // Le code réellement affiché : c'est lui que la capture doit montrer.
      caracteres: zone ? zone.value.length : 0,
      zoneDansEcran:
        !!cadre && cadre.top >= 0 && cadre.bottom <= window.innerHeight && cadre.right <= window.innerWidth,
      boutonDansEcran: !!bouton && bouton.top >= 0 && bouton.bottom <= window.innerHeight,
      // Une page qui déborde en largeur « casse la mise en page » : c'est le critère de #128.
      debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
}

/**
 * Capture de la **fenêtre**, jamais de la page entière (#153).
 *
 * `fullPage: true` photographiait tout le document : la Collection mesurait ainsi
 * **141 460 px de haut** et le Deck **80 064** (mesuré le 22/10/2026, à 360 de
 * large). Une capture de 141 000 px ne se regarde pas, et D-060 dit justement qu'on
 * **regarde** les captures : une capture sert à juger **l'écran qu'un invité voit**,
 * et cet écran est la fenêtre, pas un rouleau.
 *
 * Ce qu'on **gagne** : une image par page, toujours à 420 × 900, qu'on ouvre et qu'on
 * juge ; c'est la taille que nomme D-060, donc l'écart doc/code ferme des deux côtés.
 * Ce qu'on **perd** : ce qui vit sous la ligne de flottaison — le bas de la Collection, les
 * rangées du Deck, le pied de page. Ce contenu se regarde en faisant défiler dans
 * le navigateur ; il ne se jugeait pas dans un rouleau de 141 000 px. Si une planche
 * de contrôle des grilles devient nécessaire, ce sera **un autre artefact**, avec sa
 * commande : la capture d'écran reste « ce que voit un invité ».
 */
const PLEINE_PAGE = false;
/**
 * **Le pool de voies** (#707) : `CAPTURER_VOIES` dit combien de scènes indépendantes sont
 * jouées en parallèle. 1 par défaut (le poste, un test), 2 dans la CI — jamais plus par
 * défaut. `--voie N` marque un enfant du pool ; le parent ne le passe pas.
 */
const VOIES = Math.max(1, Number.parseInt(process.env.CAPTURER_VOIES ?? '1', 10) || 1);
const argVoie = process.argv.indexOf('--voie');
const VOIE = argVoie === -1 ? 0 : Number.parseInt(process.argv[argVoie + 1] ?? '0', 10);
const PORT = Number(process.env.PORT ?? (VOIES > 1 ? 4180 + VOIE : 4180));
const base = process.env.BASE_URL ?? `http://localhost:${PORT}`;
/** L'origine où `storageState` dépose le store : Playwright range le `localStorage` par origine. */
let origine = '';
try {
  origine = new URL(base).origin;
} catch {
  // `BASE_URL=/` arrive sans qu'on le veuille (Vite l'exporte, vitest aussi) : le dire
  // vaut mieux que laisser remonter `ERR_INVALID_URL`.
  stop(`BASE_URL n'est pas une URL absolue : « ${base} ».`);
}

/** Les pages amorcées, puis la première visite — nue, et capturée à part. */
const shots = [
  ...PAGES.map(([slug, route]) => ({ slug, route, amorce: true })),
  { slug: PREMIERE_VISITE[0], route: PREMIERE_VISITE[1], amorce: false }
];

const problems = [];
/** Les captures qu'on n'a pas pu faire, et pourquoi — un silence serait un mensonge. */
const ignores = [];

function stop(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!Number.isInteger(VOIE) || VOIE < 0 || VOIE >= VOIES) {
  stop(`--voie invalide : ${process.argv[argVoie + 1] ?? '(absent)'} pour ${VOIES} voie(s)`);
}

// **La preuve E2E du projet de test** (#668). Elle vit dans son propre module — elle parle
// au réseau, ce que le reste de ce fichier ne fait pas —, et cette entrée ne charge ses
// dépendances que sur `--e2e` : `npm run capturer` sans ce drapeau garde ses captures
// locales. Sans secrets, `lancerPreuveE2E` saute la partie réseau, vérifie le contrat de
// l'état préparé et rend la main : on sort **0**, pas en erreur.
if (process.argv.includes('--e2e')) {
  const { lancerPreuveE2E } = await import('./e2e-supabase.mjs');
  try {
    await lancerPreuveE2E({
      env: process.env,
      root,
      outDir,
      executablePath,
      base,
      origine,
      port: PORT
    });
  } catch (erreur) {
    stop(erreur instanceof Error ? erreur.message : String(erreur));
  }
  process.exit(0);
}

// Deux captures qui porteraient le même nom d'image s'écraseraient en silence : les
// pages et les états dédiés partagent donc un seul espace de noms.
const slugs = [...shots, ...PREPARATIONS].map((shot) => shot.slug);
if (new Set(slugs).size !== slugs.length) {
  stop(`deux captures portent le même nom d’image : ${slugs.sort().join(', ')}`);
}

// Sonde de `scripts/preuves/capturer.test.ts` : imprime le **plan** réel des captures —
// l'état amorcé et la liste des couples (slug, route, amorce) — puis sort, sans
// navigateur ni serveur. La garde lit donc le vrai plan, elle ne cherche pas une
// chaîne dans ce fichier.
if (process.argv.includes('--plan')) {
  // La **taille** et le **cadrage** sont dans le plan (#153) : la garde les lit ici,
  // au lieu de chercher des nombres dans le source, et une régression les fait tomber.
  // Les **surfaces mesurées** y sont aussi (#194) : une garde qui ne surveille plus le
  // bon élément doit faire échouer son test, pas changer de sujet en silence.
  // Le **balisage du pire cas** y est aussi (#324) : c'est ce que `StatusBadge.test.tsx` compare
  // au composant réel. Un modèle qui change sans le composant fait tomber ce test-là.
  console.log(
    JSON.stringify({
      amorcage: amorcageStore(origine),
      capture: { viewport: VIEWPORT, pleinePage: PLEINE_PAGE },
      gabarits: GABARITS,
      captures: shots,
      preparations: PREPARATIONS,
      hauteur: CIBLES_HAUTEUR,
      pagesSansDefilementVertical: PAGES_SANS_DEFILEMENT_VERTICAL,
      badge: MODELE_BADGE
    })
  );
  process.exit(0);
}

// Sonde de la garde verticale de l'accueil : la même formule est exercée sur un cas fautif
// sans ouvrir de navigateur, pour que le contrôle morde sur un document trop haut.
if (process.argv.includes('--controle-defilement-vertical')) {
  const arg = process.argv[process.argv.indexOf('--controle-defilement-vertical') + 1];
  let geometrie;
  try {
    geometrie = JSON.parse(arg);
  } catch {
    stop(`--controle-defilement-vertical attend une géométrie JSON, reçu : « ${arg} »`);
  }
  console.log(JSON.stringify(defilementVertical(geometrie.documentHeight, geometrie.viewportHeight)));
  process.exit(0);
}

// Sonde de la garde de l'accueil : défilement du document et contenu essentiel sous la navigation.
if (process.argv.includes('--controle-accueil')) {
  const arg = process.argv[process.argv.indexOf('--controle-accueil') + 1];
  let geometrie;
  try {
    geometrie = JSON.parse(arg);
  } catch {
    stop(`--controle-accueil attend une géométrie JSON, reçu : « ${arg} »`);
  }
  console.log(JSON.stringify(controlesAccueil(geometrie)));
  process.exit(0);
}

// Sonde de `scripts/preuves/capturer.test.ts` (#194) : joue le **contrôle de géométrie** sur une
// géométrie fournie en JSON — `{ limite, mesures: [{ nom, selecteur, present, haut, bas }] }` —
// et imprime les problèmes trouvés, sans navigateur ni serveur. C'est ce qui permet au
// contrôle de **mordre** dans un test : une assertion qui ne peut pas échouer ne garde rien.
if (process.argv.includes('--controle-hauteur')) {
  const arg = process.argv[process.argv.indexOf('--controle-hauteur') + 1];
  let geometrie;
  try {
    geometrie = JSON.parse(arg);
  } catch {
    stop(`--controle-hauteur attend une géométrie JSON, reçu : « ${arg} »`);
  }
  console.log(JSON.stringify(controlesHauteur({ ...geometrie, viewport: geometrie.viewport ?? VIEWPORT })));
  process.exit(0);
}

// **Le pool de voies** (#707) : le parent ne capture rien lui-même. Il lance `VOIES` enfants
// (chacun avec son port et son dossier de sortie), attend **les deux** codes de sortie, ferme
// l'autre dès qu'un échec est connu, puis fusionne les sorties dans `captures/`. Un échec
// d'une voie est un échec de la capture : aucun `continue-on-error` ici.
if (VOIES > 1 && !process.argv.includes('--voie')) {
  const { preparerSorties, lancerVoies, fusionnerSorties, nettoyerSorties } = await import('./capturer-voies.mjs');
  const captures = join(root, 'captures');
  preparerSorties(captures, VOIES);
  const { code, codes } = await lancerVoies({
    total: VOIES,
    captures,
    baseUrl: process.env.BASE_URL,
    commande: process.execPath,
    args: [fileURLToPath(import.meta.url)],
    env: process.env
  });
  if (code !== 0) {
    nettoyerSorties(captures, VOIES);
    stop(`au moins une voie de capture a échoué (codes de sortie : ${codes.join(', ')})`);
  }
  fusionnerSorties(captures, VOIES);
  console.log(`✔ ${VOIES} voies terminées — captures dans ${captures}`);
  process.exit(0);
}

if (!existsSync(executablePath)) {
  stop(`Chromium introuvable : ${executablePath}\n  Renseigne CHROME_PATH.`);
}

let server = null;
if (!process.env.BASE_URL) {
  if (!existsSync(distIndex)) {
    stop('dist/index.html absent : lance `npm run build` avant `npm run capturer`.');
  }
  server = await preview({
    root,
    preview: { port: PORT, strictPort: true },
    logLevel: 'error'
  });
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

/**
 * Le compteur de scènes : **la même suite dans chaque voie**, découpée par `voieDe`. Il est
 * incrémenté même pour les scènes qu'une voie ne joue pas, pour que deux voies ne prennent
 * jamais la même scène ni n'en oublient une. `VOIES = 1` les joue toutes dans l'ordre.
 */
let unite = 0;
const maVoie = () => voieDe(unite++, VOIES) === VOIE;

try {
  for (const { slug, route, amorce, preparation } of [...shots, ...PREPARATIONS]) {
    if (!maVoie()) continue;
    const context = await browser.newContext({
      viewport: VIEWPORT,
      isMobile: true,
      // Écrit avant la navigation : le store relit `tutorielVu: true` à l'hydratation,
      // donc les pages sont photographiées telles qu'un invité les voit après la visite.
      storageState: amorce ? amorcageStore(origine) : undefined
    });

    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error' && !erreurConsoleAttendue(preparation, message.text())) {
        problems.push(`${route} · console : ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => problems.push(`${route} · pageerror : ${error.message}`));

    if (preparation === 'code-pvp') {
      // L'état dédié (#128) : la partie à deux préparée dans le navigateur, à la même
      // graine que le combat — donc reproductible, et sans IA qui joue à la place de
      // l'autre camp (une partie à deux n'en a pas).
      await arriverAuCombat(page, INSTANTS_COMBAT[0]);
      const code = await preparerCodePvp(page);
      console.log(`code-pvp · ${slug} · ${JSON.stringify(code)}`);
      if (code.caracteres < 100) {
        problems.push(
          `${slug} · aucun code de partie à l’écran (${code.caracteres} caractères) : la capture ne prouve pas #128`
        );
      }
      if (!code.zoneDansEcran || !code.boutonDansEcran) {
        problems.push(
          `${slug} · le code ou son bouton Copier sort de la fenêtre (${VIEWPORT.width} × ${VIEWPORT.height})`
        );
      }
      if (code.debordement > 0) {
        problems.push(`${slug} · la page déborde de ${code.debordement} px en largeur : la mise en page casse`);
      }
    } else if (preparation === 'fin') {
      await arriverAuCombat(page, INSTANTS_COMBAT[0]);
      const fin = await preparerFin(page);
      console.log(`fin · ${slug} · ${JSON.stringify(fin)}`);
      if (!fin.verdict) problems.push(`${slug} · la fin de partie n’affiche aucun verdict`);
      if (fin.defilement > 0) {
        problems.push(
          `${slug} · la fin de partie défile de ${fin.defilement} px (${VIEWPORT.width} × ${VIEWPORT.height}) : ` +
            `« Nouveau combat » sort du cadre quand on le cherche (D-103)`
        );
      }
      if (fin.debordement > 0) {
        problems.push(`${slug} · la fin de partie déborde de ${fin.debordement} px en largeur`);
      }
      if (!fin.bouton) {
        problems.push(`${slug} · « Nouveau combat » est absent de la fin de partie`);
      } else {
        if (fin.bouton.haut < 0 || fin.bouton.bas > fin.fenetre) {
          problems.push(
            `${slug} · « Nouveau combat » sort de la fenêtre (${fin.bouton.haut} → ${fin.bouton.bas} px, ` +
              `fenêtre de ${fin.fenetre} px) : le geste qui relance une partie n’est pas atteignable`
          );
        }
        if (fin.bouton.hauteur < 44) {
          problems.push(`${slug} · « Nouveau combat » ne fait que ${fin.bouton.hauteur} px de haut (44 exigés)`);
        }
      }
    } else if (preparation === 'arrivage') {
      // L'arrivage se prépare au geste du testeur : l'accueil, le bouton, puis la scène.
      // On photographie les deux états qui comptent — cartes **face cachée**, puis
      // **retournées** — et la garde échoue si l'un des deux n'est pas atteint : une
      // capture d'un écran qui n'a pas fini de s'ouvrir ne prouve rien.
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      await page.click('.hero__ouvrir');
      // **La scène OU le refus explicite, au premier des deux** (#707) : le serveur répond
      // parfois « pas configuré » en quelques centaines de millisecondes, et attendre 15 s la
      // scène coûtait ce délai à chaque passage. La sémantique ne change pas : un refus connu
      // est un état prévu (D-179 (6)), une scène configurée est toujours attendue, et un
      // silence reste une erreur.
      await page.waitForFunction(
        ([motif]) => {
          // La scène ne compte qu'**une fois visible** : `waitForSelector` attendait l'état
          // `visible`, et un `.ouverture` encore en `display: none` ne prouve pas l'ouverture.
          const scene = document.querySelector('.ouverture');
          if (scene) {
            const style = getComputedStyle(scene);
            const boite = scene.getBoundingClientRect();
            if (style.display !== 'none' && style.visibility !== 'hidden' && boite.width > 0 && boite.height > 0) {
              return true;
            }
          }
          const attente = document.querySelector('.hero__attente');
          return new RegExp(motif).test(attente?.textContent ?? '');
        },
        [REFUS_ARRIVAGE.source],
        { timeout: 15000 }
      );
      const sceneVisible = await page
        .locator('.ouverture')
        .first()
        .isVisible()
        .catch(() => false);
      if (!sceneVisible) {
        // **Sans backend, l'ouverture est refusée** (D-179 (6)) : c'est l'état prévu, pas une
        // panne. Pour une BASE_URL explicitement locale, le harnais monte le composant réel sur
        // un tirage fixe — sans appeler l'API ni créditer la Collection — afin de mesurer et
        // capturer l'écran indépendamment de ses prérequis réseau. La CI (qui sert `dist/`, sans
        // BASE_URL) conserve son état « non capturé » et ne prétend pas que l'Arrivage s'est ouvert.
        const attente = (
          await page
            .locator('.hero__attente')
            .allInnerTexts()
            .catch(() => [])
        ).join(' ');
        if (!REFUS_ARRIVAGE.test(attente)) {
          throw new Error(
            `${slug} · ni scène ni refus lisible après l’ouverture : « ${attente.trim() || '(silence)'} »`
          );
        }
        const hote = new URL(base).hostname;
        const baseLocale = process.env.BASE_URL && ['localhost', '127.0.0.1'].includes(hote);
        let fixture = false;
        if (baseLocale) {
          try {
            fixture = await page.evaluate(async () => {
              const module = await import('/scripts/preuves/capturer-arrivage-fixture.tsx');
              module.afficherArrivagePourPreuve();
              return true;
            });
          } catch (erreurFixture) {
            console.log(`  ${slug} · scène locale non montée : ${erreurFixture.message}`);
          }
        }
        if (!fixture) {
          ignores.push(`${slug} (${attente.trim()})`);
          console.log(`  ${slug} · non capturé : ${attente.trim()}`);
          await context.close();
          continue;
        }
        console.log(`  ${slug} · scène UI isolée (aucune requête serveur) : ${attente.trim()}`);
        await page.waitForSelector('.ouverture', { timeout: 15000 });
      }
      // **La croix du dialogue fait 44 px** (#569, D-116) : la même cible de doigt que le combat,
      // lue ici sur le dialogue de l'Arrivage — `size="icon-sm"` la laissait à 26,9 × 26,9 px.
      const croix = await page.evaluate(() => {
        const el = document.querySelector('.pack-reveal [data-slot="dialog-close"]');
        if (!el) return null;
        // `offsetWidth`/`offsetHeight` : la taille de mise en page, insensible au `zoom-in`
        // transitoire du dialogue (mesuré à 42 px pendant la première animation).
        return { largeur: el.offsetWidth, hauteur: el.offsetHeight };
      });
      if (!croix) {
        problems.push(
          `${slug} · la croix de fermeture de l’Arrivage est absente : sa cible de doigt n’est pas mesurable`
        );
      } else if (croix.largeur < 43.5 || croix.hauteur < 43.5) {
        problems.push(
          `${slug} · la croix de l’Arrivage fait ${croix.largeur} × ${croix.hauteur} px (${VIEWPORT.width} × ${VIEWPORT.height}) : ` +
            `la cible de doigt est de 44 px (D-116)`
        );
      }
      // La pochette est mesurée avant le geste, à la fenêtre de référence : le facteur réel du
      // `viewBox` entre dans la taille (`font-size` calculée × `getScreenCTM().a`). Le fond vient
      // de la surface SVG réellement dessinée derrière chaque texte, jamais d'une couleur recopiée.
      const mesuresBrutes = await page.evaluate(() => {
        const svg = document.querySelector('.ouverture__zone .ouverture__face-avant .pochette--avant');
        if (!svg) return [];
        const textes = [...svg.querySelectorAll('text[data-pochette-texte]')];
        return textes
          .filter((el) => {
            for (let parent = el; parent && parent !== svg.parentElement; parent = parent.parentElement) {
              const style = getComputedStyle(parent);
              if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)
                return false;
            }
            return true;
          })
          .map((el) => {
            const style = getComputedStyle(el);
            const matrice = el.getScreenCTM();
            const fondId = el.getAttribute('data-fond');
            const surface = fondId ? svg.querySelector(`[data-pochette-surface="${fondId}"]`) : null;
            const boiteTexte = el.getBBox();
            const boiteFond = surface?.getBBox();
            const x = boiteTexte.x + boiteTexte.width / 2;
            const y = boiteTexte.y + boiteTexte.height / 2;
            const precede = surface
              ? Boolean(surface.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
              : false;
            const couvreLeTexte =
              boiteFond !== undefined &&
              x >= boiteFond.x &&
              x <= boiteFond.x + boiteFond.width &&
              y >= boiteFond.y &&
              y <= boiteFond.y + boiteFond.height;
            return {
              texte: el.textContent.trim().replace(/\s+/g, ' '),
              taille: Number.parseFloat(style.fontSize) * (matrice?.a ?? Number.NaN),
              echelle: matrice?.a ?? Number.NaN,
              encre: style.fill === 'none' ? style.color : style.fill,
              fond: surface ? getComputedStyle(surface).fill : null,
              surfaceValide: Boolean(surface && precede && couvreLeTexte)
            };
          });
      });
      if (mesuresBrutes.length === 0) problems.push(`${slug} · aucun texte SVG visible à mesurer sur la pochette`);
      const mesures = mesuresBrutes.map((mesure) => {
        let ratio = Number.NaN;
        try {
          if (mesure.fond) ratio = contraste(mesure.encre, mesure.fond);
        } catch {
          // Un fond non résolu est rapporté comme un ratio manquant par la garde ci-dessous.
        }
        return { ...mesure, ratio };
      });
      for (const mesure of mesures) {
        if (!mesure.surfaceValide)
          problems.push(`${slug} · fond réel absent ou non placé derrière « ${mesure.texte} »`);
      }
      for (const probleme of problemesPochette(mesures)) problems.push(`${slug} · ${probleme}`);
      console.log(
        `${slug} · textes SVG (420 × 900) · ${JSON.stringify(
          mesures.map(({ texte, taille, echelle, ratio, surfaceValide }) => ({
            texte,
            tailleRendue: Number(taille.toFixed(2)),
            echelle: Number(echelle.toFixed(4)),
            contraste: Number(ratio.toFixed(2)),
            surfaceValide
          }))
        )}`
      );
      await page.screenshot({ path: join(outDir, `${slug}-pochette.png`), fullPage: PLEINE_PAGE });
      // Le sachet s'ouvre au geste : « Ouvrir » joue la déchirure sans glissement (le chemin
      // accessible de la spec §5), puis l'envol porte les cartes à la révélation.
      await page.click('[data-ouvrir]');
      await page.waitForSelector('.ouverture[data-etape="revelation"]', { timeout: 30000 });
      const cachees = await page.evaluate(() => ({
        cartes: document.querySelectorAll('.ouverture__carte').length,
        verso: document.querySelectorAll('.ouverture__carte[data-face="verso"]').length,
        etape: document.querySelector('.ouverture')?.getAttribute('data-etape')
      }));
      if (cachees.cartes < 5 || cachees.verso < 5) {
        problems.push(
          `${slug} · la révélation ne montre pas cinq cartes face cachée (${cachees.cartes} cartes, ${cachees.verso} en verso)`
        );
      }
      await page.screenshot({ path: join(outDir, `${slug}-face-cachee.png`), fullPage: PLEINE_PAGE });

      await page.click('[data-tout-afficher]');
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.ouverture__carte').length > 0 &&
          document.querySelectorAll('.ouverture__carte[data-face="verso"]').length === 0,
        null,
        { timeout: 15000 }
      );
      await page.waitForTimeout(1200);

      // **La pastille « Nouvelle » ne recouvre pas le nom de la carte** (D-169, D-170). Elle se
      // mesure à **390 × 664**, le gabarit où la carte est la plus petite : la pastille est
      // contre-échelonnée, donc elle ne rétrécit pas avec elle, et c'est là qu'elle pèse le plus.
      // La ligne Vulnérabilité / Rotation n'est plus mesurée ici : depuis D-170 la carte de
      // l'Arrivage est **toujours** la vignette compacte (« Vuln. / Rot. »), qui ne déborde pas ;
      // la règle `@container` du gabarit complet est gardée par `styles-ouverture.test.ts`, et
      // son sujet réel est la fiche d'une carte à 1280.
      await page.setViewportSize({ width: 390, height: 664 });
      await page.waitForTimeout(500);
      const pastilles = await page.evaluate(() => {
        const R = (el) => el.getBoundingClientRect();
        const aire = (a, b) =>
          Math.max(0, Math.min(R(a).right, R(b).right) - Math.max(R(a).left, R(b).left)) *
          Math.max(0, Math.min(R(a).bottom, R(b).bottom) - Math.max(R(a).top, R(b).top));
        return [...document.querySelectorAll('.ouverture__carte')].map((carte, i) => {
          const nom = carte.querySelector('.card__name');
          const pastille = carte.querySelector('.ouverture__neuve');
          return { i, recouvrement: nom && pastille ? Math.round(aire(nom, pastille)) : 0 };
        });
      });
      await page.setViewportSize(VIEWPORT);

      for (const carte of pastilles) {
        if (carte.recouvrement > 0) {
          problems.push(
            `${slug} · à 390 × 664, la pastille « Nouvelle » recouvre le nom de la carte ${carte.i + 1} ` +
              `(${carte.recouvrement} px²) : le mot qui dit ce qu’on vient de gagner est masqué ` +
              'par l’étiquette qui le félicite'
          );
        }
      }
    } else if (preparation === 'collection-hors-ligne') {
      // La page est chargée **en ligne**, puis le réseau tombe : c'est le geste du testeur
      // (le service worker n'est pas actif sous `vite preview`, donc une navigation
      // hors ligne ne prouverait rien). L'avis doit apparaître, et la grille rester là.
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      await context.setOffline(true);
      await page.getByText('elle peut être en retard').waitFor({ timeout: 10000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(450);
    } else if (route === ROUTE_COMBAT) {
      // Le combat se photographie **à l'arrivée**, au tour du joueur (#170) : la graine de
      // la partie vient de l'horloge, donc on la fige (`page.clock`) pour une capture
      // reproductible. On ne remet pas la page à zéro : ce qu'on juge, c'est ce que voit
      // l'invité sans toucher.
      await arriverAuCombat(page, INSTANTS_COMBAT[0]);
      await controlerHauteur(page, slug, route);
    } else {
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(450);
      if (PAGES_SANS_DEFILEMENT_VERTICAL.includes(slug)) {
        await controlerAccueilSansDefilement(page, slug, VIEWPORT);
      }
    }
    await page.screenshot({ path: join(outDir, `${slug}.png`), fullPage: PLEINE_PAGE });
    await context.close();
  }

  // La garde de rendu (#170) ne se fie pas à **une** donne : la graine change avec
  // l'heure, donc la main change de hauteur. On mesure sur chaque instant figé.
  for (const instant of INSTANTS_COMBAT.slice(1)) {
    if (!maVoie()) continue;
    const { context, page } = await ouvrirCombat(browser, instant);
    await controlerHauteur(page, new Date(instant).toISOString(), ROUTE_COMBAT);
    await context.close();
  }

  // Le combat **tel qu'on le joue** (#191) : pas-à-pas terminé, donc la page n'est plus rallongée
  // par son panneau. C'est ici que la pile des actions et le bandeau sont jugés contre la main et
  // le plateau (D-193) : le pas-à-pas rallonge la page, et D-103 le juge par ailleurs.
  for (const instant of INSTANTS_COMBAT) {
    if (!maVoie()) continue;
    const { context, page } = await ouvrirCombat(browser, instant, { pasAPasCombatVu: true });
    await controlerHauteur(page, `${new Date(instant).toISOString()} (pas-à-pas terminé)`, ROUTE_COMBAT);
    await context.close();
  }

  // Le combat **avec une Pression jouable** (#320) : la barre y est à sa hauteur maximale, et
  // c'est là que « Fin du tour » passait sous la navigation.
  if (maVoie()) await mesurerAvecUnePression(browser);

  // Le panneau de Rebut ouvert ne fait pas défiler la page (#740, critère 7).
  if (maVoie()) await mesurerRebutOuvert(browser);

  // Le combat en mode `détaillé` (#292) : à l'arrivée, puis avec une Pression jouable ; et le pire
  // cas de `sobre` (#321), qui n'est joué nulle part ailleurs.
  if (maVoie()) await mesurerDensite(browser, true);
  if (maVoie()) await mesurerDensite(browser, false);
  if (maVoie()) await mesurerAvecUnePression(browser, true);

  // Les gabarits de D-171 : téléphones portrait et PC, sans gabarit de paysage mobile.
  for (const gabarit of GABARITS) {
    if (!maVoie()) continue;
    await mesurerGabarit(browser, gabarit);
  }
} finally {
  await browser.close();
  await server?.close();
}

if (problems.length) {
  console.error('✖ Pages en erreur :');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

if (VOIES > 1) {
  // Le parent fusionne les dossiers : chaque enfant ne compte que **sa** part.
  console.log(`✔ voie ${VOIE + 1}/${VOIES} terminée — ${outDir}`);
} else {
  console.log(
    `✔ ${shots.length + PREPARATIONS.length - ignores.length} captures dans captures/ (${base}) — dont la première visite ` +
      `et ${PREPARATIONS.length - ignores.length} état(s) dédié(s), plus ${GABARITS.length} gabarits de D-171 et D-173` +
      (ignores.length > 0 ? ` — ${ignores.length} ignoré(s) : ${ignores.join(', ')}` : '')
  );
}
