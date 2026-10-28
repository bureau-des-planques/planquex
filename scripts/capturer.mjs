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
 *   node scripts/capturer.mjs --plan   (imprime l'état amorcé et le plan, sans navigateur)
 *   node scripts/capturer.mjs --controle-hauteur '<géométrie JSON>'  (joue le contrôle de
 *     hauteur sur une géométrie fournie, sans navigateur : c'est ce que teste #194)
 *
 * Variables d'environnement :
 *   CHROME_PATH  binaire Chromium (défaut : cache de `ms-playwright`)
 *   BASE_URL     serveur déjà lancé ; le script n'en démarre alors aucun
 *   PORT         port du `vite preview` qu'il démarre lui-même (défaut : 4180)
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
import { STORAGE_KEY, VIEWPORT, INSTANTS_COMBAT, GABARITS, amorcageStore } from './capturer-socle.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'captures');
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
  // Le mur du comité (#129, D-097) : une page du jeu, cinquième onglet depuis #213 ;
  // capturée après les écrans de compte.
  ['comite', '/comite'],
  // Le suivi (#211, D-097 (2)) : la seconde page du comité, sous les mêmes sous-onglets —
  // une page de l'application sans capture est une page que personne ne regarde.
  ['comite-suivi', '/comite/suivi']
];

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
 * `scripts/capturer.test.ts`), et `/battle` est déjà photographiée à son arrivée.
 */
const PREPARATIONS = [
  { slug: 'code-pvp', route: ROUTE_COMBAT, amorce: true, preparation: 'code-pvp' },
  // L'ouverture d'un Arrivage (#283) n'existe à aucune arrivée de page : elle s'ouvre au clic
  // sur l'accueil. C'est l'écran où trois défauts de rendu se sont succédé sans qu'aucune
  // capture ne les voie (texte en miroir, pivot, 3D imbriquée, 28/10/2026).
  { slug: 'arrivage', route: '/', amorce: true, preparation: 'arrivage' }
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
  // Les **trois** Conditions qu'un même Poste peut porter ensemble (AGENTS.md §4) : Surcharge
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
 * navigation fixe (qui masque le bas de l'écran) : la main (#170), puis la **barre
 * d'action du combat** et la **piste d'Interventions** (#194).
 *
 * La barre d'action existe depuis #191 (`.combat-barre`, `docs/SPEC-COMBAT-UI.md` T9) ; la
 * piste d'Interventions depuis #190. Elle est suivie par sa **classe**, pas par
 * `data-pas-a-pas="interventions"` : cet attribut n'est posé que **lorsque le pas-à-pas
 * désigne la piste**, donc dans l'état de référence il est absent et la garde ne mesurait
 * rien (#202). Un **élément absent** ne fait rien échouer ; un élément présent qui sort de
 * la fenêtre, si — la garde **mord**.
 */
const CIBLES_HAUTEUR = [
  { nom: 'la main', selecteur: '.hand' },
  { nom: "la barre d'action du combat", selecteur: '.combat-barre' },
  { nom: "la piste d'Interventions", selecteur: '.piste' },
  // L'action principale, mesurée **seule** (#320) : la barre pouvait déborder de la fenêtre
  // sans qu'on sache si « Fin du tour » en était, et c'est elle qui sortait sous la navigation
  // quand une Pression rallongeait la barre d'une rangée. Un bouton absent ne fait rien échouer.
  { nom: '« Fin du tour »', selecteur: '.combat-barre__fin .button' }
];

/**
 * Mesure, **dans le navigateur**, le haut et le bas de chaque cible, et la limite à ne pas
 * franchir : le haut de la barre de navigation fixe (ou le bas de la fenêtre sans elle).
 *
 * Passée à `page.evaluate` avec ses cibles en argument : Playwright sérialise la fonction,
 * qui ne peut donc lire **aucune** constante du module.
 */
function mesureHauteur(cibles) {
  const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
  // La cible de doigt (#320, `docs/SPEC-COMBAT-UI.md` §5.1) : les boutons de la barre d'action et de
  // la ligne du pas-à-pas, mesurés tels que rendus — pas lus dans la feuille de style. Un bouton
  // masqué (`display: none`, hauteur nulle) n'en est pas un. 43,5 : l'arrondi du navigateur.
  const boutonsPetits = [...document.querySelectorAll('.combat-barre .button, .pas-a-pas__ligne button')]
    .map((bouton) => ({
      nom: (bouton.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
      hauteur: Math.round(bouton.getBoundingClientRect().height * 10) / 10
    }))
    .filter(({ hauteur }) => hauteur > 0 && hauteur < 43.5);
  return {
    boutonsPetits,
    fenetre: window.innerHeight,
    // Le pas-à-pas du premier combat (#143) ajoute une centaine de pixels collés en haut : tant
    // qu'il est ouvert, la page déborde **par construction** et la barre d'action collée peut
    // passer sur le bas de la main jusqu'au défilement (voir `controlesHauteur`).
    pasAPasOuvert: !!document.querySelector('.pas-a-pas'),
    limite: Math.round(nav ? nav.top : window.innerHeight),
    // De combien le document dépasse la fenêtre : l'écran de combat ne défile plus (D-103, #243).
    defilement: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    mesures: cibles.map(({ nom, selecteur }) => {
      const rect = document.querySelector(selecteur)?.getBoundingClientRect();
      return {
        nom,
        selecteur,
        present: !!rect,
        haut: rect ? Math.round(rect.top) : null,
        bas: rect ? Math.round(rect.bottom) : null
      };
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
 */
const MARGE_MIN = 20;

/**
 * Le **contrôle** de la géométrie, sans DOM ni navigateur (#194) : la sonde
 * `--controle-hauteur` et son test le lisent directement, donc il mord même quand aucun
 * Chromium ne tourne.
 *
 * Un élément **absent** ne produit **rien** — c'est ce qui laisse la garde dormante tant
 * que #190 et #191 n'ont pas livré ; un élément présent qui sort de la fenêtre produit un
 * message qui **le nomme**, et pas seulement « la main ».
 *
 * Depuis #237 deux défauts sont mesurés, et **chacun mord** : l'élément qui **sort** de la
 * fenêtre (bas au-delà de la barre de navigation) et celui qui n'a **pas la marge** de
 * D-094 (3). Un élément déjà hors de la fenêtre n'est nommé qu'une fois (le second message
 * serait du bruit), et `etat` — le libellé du passage mesuré, par exemple « pas-à-pas
 * terminé » — entre dans le message pour qu'on sache **lequel** des états mesurés fauter.
 */
function controlesHauteur({
  limite,
  mesures,
  viewport,
  pasAPasOuvert = false,
  defilement = 0,
  etat = '',
  boutonsPetits = []
}) {
  const problemes = [];

  // **La cible de doigt de 44 px** (#320) : un bouton de la barre d'action ou du pas-à-pas plus bas
  // est nommé, avec sa hauteur. Gagner de la marge en rognant la cible est exactement ce que ce
  // ticket refuse : la hauteur se gagne ailleurs.
  for (const { nom, hauteur } of boutonsPetits) {
    problemes.push(
      `le bouton « ${nom} » ne fait que ${hauteur} px de haut (${viewport.width} × ${viewport.height}${etat ? `, ${etat}` : ''}) : ` +
        `la cible de doigt est de 44 px (SPEC-COMBAT-UI §5.1)`
    );
  }

  // **L'écran ne défile pas** (D-103, #243), pas-à-pas ouvert compris. Un document plus haut que
  // la fenêtre amène la cible du pas-à-pas en haut et rogne l'en-tête sur la capture ; surtout,
  // la marge mesurée y vaut alors l'air qu'on a réservé, pas la place réelle (#237). La marge
  // ci-dessous ne vaut donc que sur un écran qui tient.
  if (defilement > 0) {
    problemes.push(
      `l'écran de combat défile de ${defilement} px (${viewport.width} × ${viewport.height}${etat ? `, ${etat}` : ''}) : ` +
        `il doit tenir dans la fenêtre (D-103)`
    );
  }

  const hors = mesures.filter(({ present, haut, bas }) => present && (haut < 0 || bas > limite));
  for (const { nom, bas } of hors) {
    problemes.push(
      `${nom} n'est pas visible sans défiler (${viewport.width} × ${viewport.height}${etat ? `, ${etat}` : ''}) : ` +
        `bas de ${nom} à ${bas} px, barre de navigation à ${limite} px`
    );
  }

  // **La marge** (#237) : tenir dans la fenêtre ne suffit pas, il faut y tenir avec 20 px de
  // place sous soi (D-094 (3)). Seuls les éléments **dans** la fenêtre sont jugés ici — un
  // élément qui en sort est déjà nommé au-dessus.
  const justes = mesures.filter(
    ({ present, haut, bas }) => present && haut >= 0 && bas <= limite && limite - bas < MARGE_MIN
  );
  for (const { nom, bas } of justes) {
    const marge = limite - bas;
    problemes.push(
      `${nom} n'a que ${marge} px de marge (${viewport.width} × ${viewport.height}${etat ? `, ${etat}` : ''}) : ` +
        `bas de ${nom} à ${bas} px, barre de navigation à ${limite} px, ${MARGE_MIN} px exigés (D-094 (3))`
    );
  }

  // **La barre ne recouvre pas la main** (#191). Être dans la fenêtre ne suffit pas : une barre
  // collée en bas peut tenir à l'écran **et** cacher le bas des cartes. On ne le dit que quand
  // les deux sont dans la fenêtre — un élément déjà hors de la fenêtre est nommé plus haut, et
  // un second message sur le même défaut serait du bruit — et **pas pendant le pas-à-pas** :
  // ouvert, il rend la page plus haute que la fenêtre, et une barre collée recouvre alors le bas
  // de la main jusqu'au défilement, ce qui est le comportement d'une barre collée, pas un défaut.
  // Le passage « pas-à-pas terminé » (voir `INSTANTS_COMBAT`) est celui qui mord.
  const main = mesures.find(({ selecteur }) => selecteur === '.hand');
  const barre = mesures.find(({ selecteur }) => selecteur === '.combat-barre');
  if (
    !pasAPasOuvert &&
    main?.present &&
    barre?.present &&
    !hors.includes(main) &&
    !hors.includes(barre) &&
    barre.haut < main.bas &&
    main.haut < barre.bas
  ) {
    problemes.push(
      `${barre.nom} recouvre ${main.nom} (${viewport.width} × ${viewport.height}${etat ? `, ${etat}` : ''}) : ` +
        `haut de la barre à ${barre.haut} px, bas de la main à ${main.bas} px`
    );
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
  for (const probleme of controlesHauteur({ ...hauteur, viewport, etat: contexte })) {
    problems.push(`${route} · ${probleme}`);
  }
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
 * gestes d'un testeur — « Attacher 1 café » puis « Fin du tour », tant qu'aucune Pression n'est
 * proposée — et rend le **tour** atteint, ou `null` quand le Poste n'en offre aucune dans la borne.
 *
 * Une Pression jouable est un bouton `button--primary` de la barre (`ActionButton`, `attack`).
 */
async function jusquAUnePression(page) {
  const barre = page.locator('.combat-barre');
  const pression = barre.locator('.button--primary');
  for (let essai = 0; essai < TOURS_MAX_POUR_UNE_PRESSION; essai += 1) {
    const attacher = barre.getByRole('button', { name: /Attacher 1 café/ });
    if ((await attacher.count()) > 0) {
      await attacher.first().click();
      await page.waitForTimeout(500);
    }
    if ((await pression.count()) > 0) {
      const tete = await page.locator('.battle__head').textContent();
      return Number(tete?.match(/Tour (\d+)/)?.[1] ?? 0);
    }
    const avant = await page.locator('.battle__head').textContent();
    await barre.getByRole('button', { name: 'Fin du tour', exact: true }).click();
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
      `${ROUTE_COMBAT} · aucun état « ${densite}Pression jouable » atteint : la barre n'est mesurée que sans Pression`
    );
  }
  return atteints;
}

/**
 * **Un gabarit de D-142** : chaque page sous la garde de largeur, puis le combat sous les gardes de
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
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (debordement > 0) {
      problems.push(`${route} · la page déborde de ${debordement} px en largeur à ${taille} (D-142)`);
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
      `${ROUTE_COMBAT} · ${nom} : aucune Pression jouable atteinte, la barre n'est mesurée que sans Pression`
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
const PORT = Number(process.env.PORT ?? 4180);
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

function stop(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

// Deux captures qui porteraient le même nom d'image s'écraseraient en silence : les
// pages et les états dédiés partagent donc un seul espace de noms.
const slugs = [...shots, ...PREPARATIONS].map((shot) => shot.slug);
if (new Set(slugs).size !== slugs.length) {
  stop(`deux captures portent le même nom d’image : ${slugs.sort().join(', ')}`);
}

// Sonde de `scripts/capturer.test.ts` : imprime le **plan** réel des captures —
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
      badge: MODELE_BADGE
    })
  );
  process.exit(0);
}

// Sonde de `scripts/capturer.test.ts` (#194) : joue le **contrôle de géométrie** sur une
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
  console.log(JSON.stringify(controlesHauteur({ ...geometrie, viewport: VIEWPORT })));
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

try {
  for (const { slug, route, amorce, preparation } of [...shots, ...PREPARATIONS]) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      isMobile: true,
      // Écrit avant la navigation : le store relit `tutorielVu: true` à l'hydratation,
      // donc les pages sont photographiées telles qu'un invité les voit après la visite.
      storageState: amorce ? amorcageStore(origine) : undefined
    });

    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`${route} · console : ${message.text()}`);
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
    } else if (preparation === 'arrivage') {
      // L'arrivage se prépare au geste du testeur : l'accueil, le bouton, puis la scène.
      // On photographie les deux états qui comptent — cartes **face cachée**, puis
      // **retournées** — et la garde échoue si l'un des deux n'est pas atteint : une
      // capture d'un écran qui n'a pas fini de s'ouvrir ne prouve rien.
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      await page.click('.hero__ouvrir');
      await page.waitForSelector('.ouverture', { timeout: 15000 });
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
    }
    await page.screenshot({ path: join(outDir, `${slug}.png`), fullPage: PLEINE_PAGE });
    await context.close();
  }

  // La garde de rendu (#170) ne se fie pas à **une** donne : la graine change avec
  // l'heure, donc la main change de hauteur. On mesure sur chaque instant figé.
  for (const instant of INSTANTS_COMBAT.slice(1)) {
    const { context, page } = await ouvrirCombat(browser, instant);
    await controlerHauteur(page, new Date(instant).toISOString(), ROUTE_COMBAT);
    await context.close();
  }

  // Le combat **tel qu'on le joue** (#191) : pas-à-pas terminé, donc la page n'est plus rallongée
  // par son panneau. C'est ici que la barre d'action collée est jugée sur le **recouvrement** de
  // la main — pendant le pas-à-pas, elle la recouvre jusqu'au défilement, par construction.
  for (const instant of INSTANTS_COMBAT) {
    const { context, page } = await ouvrirCombat(browser, instant, { pasAPasCombatVu: true });
    await controlerHauteur(page, `${new Date(instant).toISOString()} (pas-à-pas terminé)`, ROUTE_COMBAT);
    await context.close();
  }

  // Le combat **avec une Pression jouable** (#320) : la barre y est à sa hauteur maximale, et
  // c'est là que « Fin du tour » passait sous la navigation.
  await mesurerAvecUnePression(browser);

  // Le combat en mode `détaillé` (#292) : à l'arrivée, puis avec une Pression jouable ; et le pire
  // cas de `sobre` (#321), qui n'est joué nulle part ailleurs.
  await mesurerDensite(browser, true);
  await mesurerDensite(browser, false);
  await mesurerAvecUnePression(browser, true);

  // Les gabarits de D-142 : la fenêtre réelle d'un téléphone, en portrait et en paysage, et le PC.
  for (const gabarit of GABARITS) await mesurerGabarit(browser, gabarit);
} finally {
  await browser.close();
  await server?.close();
}

if (problems.length) {
  console.error('✖ Pages en erreur :');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `✔ ${shots.length + PREPARATIONS.length} captures dans captures/ (${base}) — dont la première visite ` +
    `et ${PREPARATIONS.length} état(s) dédié(s), plus ${GABARITS.length} gabarits de D-142`
);
