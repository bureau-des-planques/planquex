#!/usr/bin/env node
/**
 * **Le contrôle visuel qui compte** (#205) : `impeccable detect` lancé sur de **vraies pages**,
 * pas sur les sources.
 *
 * `npm run detect:ui` lit `src/` avec des expressions régulières — son propre message le dit
 * (« findings are an undercount ») et il a laissé passer deux `nested-cards` que le détecteur
 * en navigateur voyait. La CI ne pouvait donc pas voir une régression d'écran. Ce script sert
 * `dist/` et passe le détecteur sur chaque écran, comme le ferait une personne.
 *
 * **Ce qui échoue, et ce qui ne fait que parler** : un **anti-pattern** compte, un **avis**
 * (`Advisory`) non. Le seuil est ici, une fois, et pas dans la tête de celui qui lit la sortie.
 *
 * Usage :
 *   node scripts/detect-ui-pages.mjs                 # sert dist/ et contrôle les écrans
 *   node scripts/detect-ui-pages.mjs --controle '<json>'     # sonde : lit une sortie `--json` et
 *                                                   # dit si elle échoue (le test s'en sert, sans
 *                                                   # navigateur ni réseau)
 *
 * **Pourquoi le JSON et le code de sortie (#208)** : le détecteur ne dit rien d'une page
 * **propre** — il n'imprime ni « 0 anti-patterns found. » ni avis, et sort en `0`. `/` et
 * `/reglages` étaient donc lus comme « non mesurables » alors qu'ils étaient **mesurés et
 * propres** : la phrase cherchée n'existe que s'il y a quelque chose à dire. La mesure vient
 * désormais de `--json` (`[]` = aucun constat), et le code de sortie départage les deux cas
 * qu'une sortie vide confondait : `0`/`2` = le scan a tourné, `1` = cible non scannée.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { preview } from 'vite';

/** La racine du dépôt : `dist/` y est servi. */
const RACINE = fileURLToPath(new URL('..', import.meta.url));

/**
 * Les écrans qui existent, et qu'un invité peut ouvrir.
 *
 * `/settings`, pas `/reglages` (#208) : la route de l'écran est **anglaise** (`src/App.tsx`,
 * `redirections.ts`), et `/reglages` n'en est pas une — le détecteur scannait donc l'écran
 * **404** (`Introuvable`) en croyant lire les Réglages. La capture, elle, visait déjà
 * `/settings` (`scripts/capturer.mjs`) : c'est ce contrôle-ci qui était décalé.
 *
 * **Étendus le 26/10/2026 (#234)** aux pages publiques et de compte : le contrôle ne
 * couvrait que le jeu, alors qu'un invité voit aussi `/connexion`, `/attente`,
 * `/administration`, `/comite`, `/comite/suivi`, `/feuille-de-route` et
 * `/confidentialite`. Ces deux dernières sont **hors de la garde** (elles se lisent sans
 * compte) ; les autres passent par le `Layout`. Sans base configurée, `/attente` et
 * `/administration` montrent leur état inerte « Pas de compte sans base » : c'est bien un
 * écran distinct, et c'est celui-ci qu'un invité voit sur l'alpha sans backend.
 */
export const ECRANS = [
  '/',
  '/collection',
  '/deck',
  '/battle',
  '/settings',
  '/comite',
  '/comite/suivi',
  '/feuille-de-route',
  '/connexion',
  '/attente',
  '/confidentialite',
  '/administration'
];

/**
 * **Le cliquet** (#205) : les anti-patterns **déjà présents** le 25/10/2026, relevés à la main
 * avant de brancher ce contrôle. Le gate ne demande pas zéro — il demande **pas plus qu'hier**.
 *
 * Abaissé le 25/10/2026 après la lisibilité des cartes (Collection 42 → 32, Deck 12 → 11) : le
 * stade des cartes passe en encre pleine, et le nom ne partage plus sa ligne avec le Seuil.
 *
 * **Plus aucun `null` (#208)** : ils ne voulaient pas dire « non mesurable » mais « page propre
 * que le détecteur ne commente pas » — le silence a été mesuré (`/` = `[]`, code 0) et le script
 * le lit désormais. `/` vaut donc **0**, et `/settings` (la vraie route ; `/reglages` n'existait
 * pas) **1**. Le chiffre du ticket (54) datait d'avant l'abaissement de #205.
 *
 * **Abaissé le 26/10/2026 (#208)** : la famille `low-contrast` tombe — le sigle de faction est
 * éclairci (2,7 à 4,1:1 → plus de 5,6), le badge COMEX passe en or plein, et une carte non
 * possédée n'est plus mise à 40 % d'opacité : son texte reste lisible, l'illustration et la barre
 * disent l'absence (Collection 32 → 3, Deck 11 → 6, commit `0bad67d`). Puis les **dégradés de
 * faction** de la fenêtre d'illustration deviennent des **aplats**, et le filet violet de la
 * Couronne cesse d'être un dégradé : Collection **0**, Deck **0**. Enfin la ligne trop longue
 * des Réglages reçoit sa largeur de lecture : `/settings` **0**. **Total du dépôt : 0** le
 * 26/10/2026 — le contrôle ne gèle plus rien, il exige zéro, et un seul anti-pattern le fait
 * tomber. Chaque baisse s'est faite dans son commit, avec son compte.
 *
 * **Étendu le 26/10/2026 (#234)** aux sept écrans publics et de compte, chacun **mesuré**
 * par `npm run build && npm run detect:ui:page` avant d'écrire son compte — aucun `null`,
 * aucun écran sauté sans le dire. **Total plafonné : 5** (2 + 3, ci-dessous).
 *
 * - `/comite/suivi`, `/connexion`, `/attente`, `/confidentialite`, `/administration` : **0**.
 *   Les deux écrans de compte mesurés ici sont ceux d'un alpha **sans base** — leur état
 *   inerte « Pas de compte sans base » — et non l'écran d'un compte connecté, qui demanderait
 *   un backend : ce contour est dit, pas caché.
 * - `/comite` : **2** `nested-cards` (un post-it est une carte dans une carte) — ticket
 *   **#235**.
 * - `/feuille-de-route` : **3** `line-length` (listes trop larges à lire) — ticket **#236**.
 *
 * Les deux ne sont **pas** corrigés ici : #234 étend la mesure, il n'habille pas les écrans.
 * Le plafond est leur compte mesuré, pas un acquittement : le faire baisser est le travail
 * de #235 et #236, et la baisse se fait dans le même commit que la correction (#208).
 */
export const BASELINE = {
  '/': 0,
  '/collection': 0,
  '/deck': 0,
  '/battle': 0,
  '/settings': 0,
  '/comite': 2,
  '/comite/suivi': 0,
  '/feuille-de-route': 3,
  '/connexion': 0,
  '/attente': 0,
  '/confidentialite': 0,
  '/administration': 0
};

/**
 * Les écrans **mesurés sans plafond** (#234). La règle vit ici, une fois : un écran ajouté
 * à `ECRANS` sans son compte dans `BASELINE` est un **échec**, pas un zéro par défaut.
 *
 * Un `null` n'est pas un plafond — il a déjà servi à geler un écran (#208), et une page
 * qu'on ne sait pas compter n'est pas une page propre. Seul un **nombre** compte.
 *
 * Le test la joue sur un plan fourni (`--controle-plan`) : une assertion qui ne peut pas
 * échouer ne garde rien (AGENTS.md §6), donc le cas fautif est confronté à la vraie règle.
 */
export function ecransSansPlafond(ecrans, baseline) {
  return ecrans.filter((ecran) => typeof baseline[ecran] !== 'number');
}

/** Le port du serveur de contrôle : **pas 4180**, que `npm run capturer` occupe. */
const PORT = 4179;
const ORIGINE = `http://127.0.0.1:${PORT}`;

/**
 * Lit la sortie **`--json`** d'`impeccable detect` et rend le nombre d'**anti-patterns**.
 *
 * Le binaire rend un tableau : chaque constat porte `antipattern` et, pour un avis,
 * `advisory: true`. Un avis ne compte pas. Un tableau **vide** est un vrai résultat — la page
 * est propre —, d'où `0` et non `null`. Ce qui n'est pas un tableau JSON (sortie de binaire
 * illisible, texte d'erreur) rend `null` : on ne laisse pas passer un contrôle qui n'a pas tourné.
 */
export function compteAntiPatterns(sortie) {
  let constats;
  try {
    constats = JSON.parse(sortie);
  } catch {
    return null;
  }
  if (!Array.isArray(constats)) return null;
  return constats.filter((constat) => constat?.advisory !== true).length;
}

/**
 * Le verdict d'un écran : `null` = on n'a pas pu mesurer (échec), `0` = propre,
 * `> 0` = anti-patterns.
 *
 * Le **code de sortie** départage ce que la sortie confondait (#208) : `0` et `2` disent que le
 * scan a tourné (rien à signaler, ou des constats) ; tout le reste (`1` = « target could not be
 * scanned ») rend `null`. Une sortie `[]` **avec** le code 1 est un échec, pas une page propre —
 * c'est exactement le piège dans lequel le script est tombé.
 */
export function verdict(sortie, code = 0) {
  if (code !== 0 && code !== 2) return null;
  return compteAntiPatterns(sortie);
}

/** Le message d'échec, qui **nomme l'écran** et son compte. */
export function messageEchec(ecran, compte, raison = '') {
  if (compte === null) {
    const detail = raison.trim().split('\n')[0]?.slice(0, 160);
    return `${ecran} : le détecteur n'a pas pu scanner${detail ? ` (${detail})` : ''}`;
  }
  return `${ecran} : ${compte} anti-pattern${compte > 1 ? 's' : ''}`;
}

/**
 * Lance `impeccable detect --json <url>` et rend son code de sortie et ses deux flux.
 *
 * Asynchrone, et borné à 120 s : un détecteur bloqué ne doit pas bloquer la CI sans fin. Le
 * `--json` sépare proprement la mesure (stdout, un tableau) du diagnostic (stderr).
 */
function lancerDetecteur(url) {
  return new Promise((resoudre) => {
    const enfant = spawn('npx', ['impeccable', 'detect', '--json', url], { stdio: ['ignore', 'pipe', 'pipe'] });
    let sortie = '';
    let erreur = '';
    enfant.stdout.on('data', (morceau) => (sortie += morceau));
    enfant.stderr.on('data', (morceau) => (erreur += morceau));
    const minuteur = setTimeout(() => enfant.kill('SIGKILL'), 120_000);
    enfant.on('close', (code) => {
      clearTimeout(minuteur);
      resoudre({ sortie, erreur, code: code ?? 1 });
    });
    enfant.on('error', (erreur) => {
      clearTimeout(minuteur);
      resoudre({ sortie: '', erreur: String(erreur), code: 1 });
    });
  });
}

/** Attend que le serveur réponde, sans dormir à l'aveugle plus de ~20 s. */
async function attendreServeur(url) {
  for (let essai = 0; essai < 40; essai += 1) {
    try {
      const reponse = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (reponse.ok) return true;
    } catch {
      // Pas encore prêt : on réessaie.
    }
    await new Promise((suite) => setTimeout(suite, 500));
  }
  return false;
}

async function principal(args) {
  // `--plan` : les écrans et le port, sans rien lancer — le test les lit là, comme
  // `scripts/capturer.mjs --plan` pour la garde de hauteur.
  if (args.includes('--plan')) {
    console.log(
      JSON.stringify({
        ecrans: ECRANS,
        port: PORT,
        seuil: 0,
        baseline: BASELINE,
        // La règle est publiée avec le plan : le test la lit ici, et compare `ECRANS` à
        // `BASELINE` une seule fois, au même endroit que le contrôle qui s'en sert.
        sansPlafond: ecransSansPlafond(ECRANS, BASELINE)
      })
    );
    return 0;
  }

  // Sonde de `scripts/detect-ui-pages.test.ts` (#234) : joue la règle des plafonds sur un
  // plan fourni — `{ ecrans, baseline }` — et sort 1 si un écran n'a pas de compte. C'est
  // ce qui permet au test de confronter la règle à un **cas fautif**, sans navigateur.
  const iPlan = args.indexOf('--controle-plan');
  if (iPlan !== -1) {
    let fourni;
    try {
      fourni = JSON.parse(args[iPlan + 1] ?? '');
    } catch {
      console.error('--controle-plan attend un JSON { ecrans, baseline }.');
      return 1;
    }
    const sansPlafond = ecransSansPlafond(fourni?.ecrans ?? [], fourni?.baseline ?? {});
    console.log(JSON.stringify({ sansPlafond, echec: sansPlafond.length > 0 }));
    return sansPlafond.length > 0 ? 1 : 0;
  }

  const i = args.indexOf('--controle');
  if (i !== -1) {
    const sortie = args[i + 1] ?? '';
    const j = args.indexOf('--code');
    const code = j === -1 ? 0 : Number(args[j + 1] ?? 0);
    const compte = verdict(sortie, code);
    const ecran = '/sonde';
    const raison = code !== 0 && code !== 2 ? `code de sortie ${code}` : '';
    console.log(
      JSON.stringify({
        compte,
        echec: compte !== 0,
        message: compte === 0 ? null : messageEchec(ecran, compte, raison)
      })
    );
    return compte === 0 ? 0 : 1;
  }

  if (!existsSync(join(RACINE, 'dist', 'index.html'))) {
    console.error('✖ dist/index.html absent : lance `npm run build` avant ce contrôle.');
    return 1;
  }

  // Avant de scanner, la question du **plafond** (#234) : un écran sans compte ne se mesure
  // pas « à zéro par défaut ». On le dit avant, plutôt que de scanner onze pages pour
  // échouer sur la douzième.
  const manquants = ecransSansPlafond(ECRANS, BASELINE);
  if (manquants.length > 0) {
    console.error(
      `✖ aucun plafond dans BASELINE pour : ${manquants.join(', ')} — mesure l'écran, puis écris son compte.`
    );
    return 1;
  }

  // Le serveur est lancé **dans ce processus** (API `vite`, comme `scripts/capturer.mjs`) :
  // `server.close()` libère le port à coup sûr. Un `npx vite preview` tué par son parent
  // laissait son `vite` orphelin sur le port (constaté le 25/10/2026, pid 393608 sur 4179).
  const serveur = await preview({
    root: RACINE,
    preview: { port: PORT, strictPort: true, host: '127.0.0.1' },
    logLevel: 'error'
  });

  try {
    if (!(await attendreServeur(`${ORIGINE}/`))) {
      console.error(`✖ Le serveur de prévisualisation n'a pas répondu sur ${ORIGINE}.`);
      return 1;
    }

    const echecs = [];
    for (const ecran of ECRANS) {
      const url = `${ORIGINE}${ecran}`;
      // Asynchrone : le serveur tourne dans ce même processus, et un `spawnSync` le figerait
      // (le navigateur du détecteur ne recevrait plus rien → « Navigation timeout »).
      const { sortie, erreur, code } = await lancerDetecteur(url);
      const compte = verdict(sortie, code);
      const permis = BASELINE[ecran];
      if (compte === null) {
        // Un écran **sauté** n'est pas un écran propre (#208) : le scan a échoué, et ça se dit.
        const message = `${messageEchec(ecran, null, erreur)} — plafond ${permis}`;
        echecs.push(message);
        console.error(`✖ ${message}`);
        continue;
      }
      if (compte <= permis) {
        console.log(`✔ ${ecran} : ${compte} anti-pattern${compte > 1 ? 's' : ''} (plafond ${permis})`);
        if (compte < permis) console.log(`  ⚠ ${ecran} est sous son plafond (${permis}) : baisse BASELINE dans ce commit.`);
        continue;
      }
      const message = `${ecran} : ${compte} anti-pattern${compte > 1 ? 's' : ''}, au-dessus du plafond de ${permis}`;
      echecs.push(message);
      console.error(`✖ ${message}`);
    }

    if (echecs.length > 0) {
      console.error(`\n✖ ${echecs.length} écran(s) refusé(s) par le détecteur :`);
      for (const echec of echecs) console.error(`   - ${echec}`);
      return 1;
    }
    const total = ECRANS.reduce((somme, ecran) => somme + (BASELINE[ecran] ?? 0), 0);
    console.log(`\n✔ ${ECRANS.length} écrans mesurés, aucun au-dessus de son plafond (total plafonné : ${total}).`);
    return 0;
  } finally {
    // Le serveur doit mourir **même** en cas d'échec : sinon le port reste pris, et le
    // prochain `npm run capturer` échoue pour une raison qui n'a rien à voir.
    await serveur.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith('detect-ui-pages.mjs')) {
  principal(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((erreur) => {
      console.error(erreur);
      process.exit(1);
    });
}
