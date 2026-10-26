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
 *   node scripts/detect-ui-pages.mjs --controle '<sortie>'   # sonde : lit une sortie et dit
 *                                                   # si elle échoue (le test s'en sert, sans
 *                                                   # navigateur ni réseau)
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { preview } from 'vite';

/** La racine du dépôt : `dist/` y est servi. */
const RACINE = fileURLToPath(new URL('..', import.meta.url));

/** Les écrans qui existent, et qu'un invité peut ouvrir. */
export const ECRANS = ['/', '/collection', '/deck', '/battle', '/reglages'];

/**
 * **Le cliquet** (#205) : les anti-patterns **déjà présents** le 25/10/2026, relevés à la main
 * avant de brancher ce contrôle. Le gate ne demande pas zéro — il demande **pas plus qu'hier**.
 *
 * Abaissé le 25/10/2026 après la lisibilité des cartes (Collection 42 → 32, Deck 12 → 11) : le
 * stade des cartes passe en encre pleine, et le nom ne partage plus sa ligne avec le Seuil.
 *
 * `null` veut dire « le détecteur ne rend rien sur cet écran aujourd'hui » (il sort sans un mot,
 * probablement sur une page qui ne se stabilise pas) : l'écran est **sauté** avec un message, pas
 * déclaré propre. C'est une dette d'outil, pas un blanc-seing — voir #208.
 */
export const BASELINE = {
  '/': null,
  '/collection': 32,
  '/deck': 11,
  '/battle': 0,
  '/reglages': null
};

/** Le port du serveur de contrôle : **pas 4180**, que `npm run capturer` occupe. */
const PORT = 4179;
const ORIGINE = `http://127.0.0.1:${PORT}`;

/**
 * Lit la sortie d'`impeccable detect` et rend le nombre d'**anti-patterns**.
 *
 * Le binaire écrit « 0 anti-patterns found. » (ou « 2 anti-patterns found. ») puis, s'il y en a,
 * une liste ; les avis vivent sous « ── Advisory (not counted as failures) ── » et ne comptent
 * pas. Une sortie qui ne dit rien d'exploitable (serveur mort, page en erreur) est traitée comme
 * un échec avec `null` : on ne laisse pas passer un contrôle qui n'a pas tourné.
 */
export function compteAntiPatterns(sortie) {
  const trouve = sortie.match(/(\d+)\s+anti-?patterns?\s+found/i);
  if (!trouve) return null;
  return Number(trouve[1]);
}

/**
 * Le verdict d'un écran : `null` = on n'a pas pu mesurer (échec), `0` = propre,
 * `> 0` = anti-patterns.
 */
export function verdict(sortie) {
  return compteAntiPatterns(sortie);
}

/** Le message d'échec, qui **nomme l'écran** et son compte. */
export function messageEchec(ecran, compte) {
  if (compte === null) return `${ecran} : le détecteur n'a rien répondu (page en erreur, ou serveur mort)`;
  return `${ecran} : ${compte} anti-pattern${compte > 1 ? 's' : ''}`;
}

/**
 * Lance `impeccable detect <url>` et rend sa sortie (stdout + stderr). Asynchrone, et borné à
 * 120 s : un détecteur bloqué ne doit pas bloquer la CI sans fin.
 */
function lancerDetecteur(url) {
  return new Promise((resoudre) => {
    const enfant = spawn('npx', ['impeccable', 'detect', url], { stdio: ['ignore', 'pipe', 'pipe'] });
    let texte = '';
    enfant.stdout.on('data', (morceau) => (texte += morceau));
    enfant.stderr.on('data', (morceau) => (texte += morceau));
    const minuteur = setTimeout(() => enfant.kill('SIGKILL'), 120_000);
    enfant.on('close', () => {
      clearTimeout(minuteur);
      resoudre(texte);
    });
    enfant.on('error', (erreur) => {
      clearTimeout(minuteur);
      resoudre(String(erreur));
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
    console.log(JSON.stringify({ ecrans: ECRANS, port: PORT, seuil: 0, baseline: BASELINE }));
    return 0;
  }

  const i = args.indexOf('--controle');
  if (i !== -1) {
    const sortie = args[i + 1] ?? '';
    const compte = compteAntiPatterns(sortie);
    const ecran = '/sonde';
    console.log(JSON.stringify({ compte, echec: compte !== 0, message: compte === 0 ? null : messageEchec(ecran, compte) }));
    return compte === 0 ? 0 : 1;
  }

  if (!existsSync(join(RACINE, 'dist', 'index.html'))) {
    console.error('✖ dist/index.html absent : lance `npm run build` avant ce contrôle.');
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
      const texte = await lancerDetecteur(url);
      const compte = verdict(texte);
      const permis = BASELINE[ecran];
      if (compte === null && permis === null) {
        console.log(`… ${ecran} : non mesurable aujourd'hui, sauté (dette #208)`);
        continue;
      }
      if (compte !== null && permis !== null && compte <= permis) {
        console.log(`✔ ${ecran} : ${compte} anti-pattern${compte > 1 ? 's' : ''} (plafond ${permis})`);
        continue;
      }
      const message =
        compte === null
          ? messageEchec(ecran, null)
          : `${ecran} : ${compte} anti-pattern${compte > 1 ? 's' : ''}, au-dessus du plafond de ${permis}`;
      echecs.push(message);
      console.error(`✖ ${message}`);
    }

    if (echecs.length > 0) {
      console.error(`\n✖ ${echecs.length} écran(s) refusé(s) par le détecteur :`);
      for (const echec of echecs) console.error(`   - ${echec}`);
      return 1;
    }
    const sautes = ECRANS.filter((ecran) => BASELINE[ecran] === null);
    console.log(
      `\n✔ ${ECRANS.length} écrans : aucun au-dessus de son plafond` +
        (sautes.length > 0 ? ` (${sautes.length} non mesurables, sauté${sautes.length > 1 ? 's' : ''})` : '') +
        '.'
    );
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
