#!/usr/bin/env node
/**
 * Le pool de voies de `capturer.mjs` (#707).
 *
 * `capturer.mjs` enchaînait **138 contextes de navigateur** l'un après l'autre (phase 1 de
 * #707 : 440 s de captures sur un job de 609 s). Deux scènes indépendantes peuvent tourner à
 * la fois : ce module découpe la même suite de scènes (`voieDe`), donne à chaque voie **son
 * port** et **son dossier de sortie**, lance les enfants, attend **les deux** codes de sortie,
 * ferme l'autre dès qu'un échec est connu, puis le parent fusionne les dossiers.
 *
 * Rien n'est retiré : les mêmes pages, les mêmes graines, les mêmes gabarits et les mêmes
 * contrôles sont joués, seulement répartis. `CAPTURER_VOIES` vaut **1 par défaut** (le poste,
 * un test) et **2 dans la CI** ; ce module ne décide pas de la valeur.
 *
 * Les fonctions sont pures ou injectables (`spawn`, dossiers fournis) pour que le test puisse
 * confronter le pool à un cas fautif **sans** ouvrir de navigateur : une voie qui échoue doit
 * faire échouer la capture, et deux voies ne doivent partager ni port ni dossier de sortie.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La voie qui joue la scène `unite`, pour `total` voies. Le découpage est **déterministe** :
 * toutes les voies voient la même suite, chacune ne joue que ses indices. `total = 1` les
 * joue toutes.
 */
export function voieDe(unite, total) {
  return ((unite % total) + total) % total;
}

/**
 * La configuration d'une voie : un port et un dossier de sortie **qui lui appartiennent**.
 * Quand `BASE_URL` est fourni, le script ne démarre aucun serveur : `port` vaut `null`, et le
 * serveur de l'utilisateur est partagé par construction (aucun enfant n'en ouvre un second).
 */
export function configVoie(index, total, { captures, baseUrl } = {}) {
  const sortie = join(captures, `.voie-${index}`);
  const port = baseUrl ? null : 4180 + index;
  return {
    index,
    total,
    port,
    sortie,
    env: {
      CAPTURER_VOIES: String(total),
      CAPTURER_SORTIE: sortie,
      ...(port === null ? {} : { PORT: String(port) })
    }
  };
}

/** Prépare un dossier vide par voie — jamais le dossier `captures/` lui-même. */
export function preparerSorties(captures, total) {
  for (let index = 0; index < total; index += 1) {
    const { sortie } = configVoie(index, total, { captures });
    rmSync(sortie, { recursive: true, force: true });
    mkdirSync(sortie, { recursive: true });
  }
}

/** Fusionne les dossiers des voies dans `captures/` et les retire. */
export function fusionnerSorties(captures, total) {
  for (let index = 0; index < total; index += 1) {
    const { sortie } = configVoie(index, total, { captures });
    for (const nom of readdirSync(sortie)) {
      renameSync(join(sortie, nom), join(captures, nom));
    }
    rmSync(sortie, { recursive: true, force: true });
  }
}

/** Retire les dossiers des voies, sans rien fusionner — le chemin d'un échec. */
export function nettoyerSorties(captures, total) {
  for (let index = 0; index < total; index += 1) {
    const { sortie } = configVoie(index, total, { captures });
    rmSync(sortie, { recursive: true, force: true });
  }
}

/**
 * Ferme une voie et **son groupe de processus** : `npm`/`node` laisse sinon un Chrome
 * orphelin. `detached: true` fait de chaque enfant un chef de groupe ; le `-pid` ferme le
 * groupe entier.
 */
function fermer(enfant) {
  if (!enfant || enfant.exitCode !== null) return;
  try {
    if (enfant.pid && process.platform !== 'win32') process.kill(-enfant.pid, 'SIGTERM');
    else enfant.kill('SIGTERM');
  } catch {
    try {
      enfant.kill('SIGTERM');
    } catch {
      // Déjà mort : rien à fermer.
    }
  }
}

/**
 * Lance `total` enfants (`--voie 0`, `--voie 1`, …) et rend `{ code, codes }` quand **tous**
 * sont fermés. Au premier échec, les autres sont fermés — on n'attend pas une capture de
 * plusieurs minutes après un refus. Un échec d'une voie est un échec de l'ensemble (`code`
 * vaut 1), jamais un succès partiel.
 */
export function lancerVoies({ total, captures, baseUrl, commande, args, env, spawn: lancer = spawn }) {
  return new Promise((resolve) => {
    if (total <= 0) {
      resolve({ code: 0, codes: [] });
      return;
    }
    const enfants = [];
    const codes = new Array(total).fill(null);
    let restants = total;
    let echec = false;

    const finir = (index, code) => {
      if (codes[index] !== null) return;
      codes[index] = code;
      restants -= 1;
      if (code !== 0 && !echec) {
        echec = true;
        for (const enfant of enfants) fermer(enfant);
      }
      if (restants === 0) resolve({ code: echec ? 1 : 0, codes });
    };

    for (let index = 0; index < total; index += 1) {
      const config = configVoie(index, total, { captures, baseUrl });
      let enfant;
      try {
        enfant = lancer(commande, [...args, '--voie', String(index)], {
          env: { ...env, ...config.env },
          stdio: 'inherit',
          detached: process.platform !== 'win32'
        });
      } catch {
        finir(index, 1);
        continue;
      }
      enfants.push(enfant);
      enfant.on('error', () => finir(index, 1));
      enfant.on('close', (code) => finir(index, code ?? 1));
    }
  });
}
