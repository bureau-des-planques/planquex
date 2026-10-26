#!/usr/bin/env node
/**
 * `npm run serveurs` — le tableau de bord des serveurs et des chantiers (#227, D-102).
 *
 * Il ne fait pas partie du jeu : aucun de ses fichiers n'entre dans le bundle Vite, il n'est
 * jamais déployé, et il n'est joignable que depuis la machine (`127.0.0.1`).
 *
 * La commande rend l'adresse **avec son jeton** (comme `npm run admin`) et ouvre le navigateur,
 * sauf `--no-open`. `--port` choisit le port du tableau de bord lui-même, pas celui des
 * serveurs qu'il lance.
 */
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { demarrerServeur } from './lib/app.mjs';
import { creerSysteme } from './lib/systeme.mjs';

/** Les arguments, séparés de l'action : `--port 5180`, `--no-open`. */
export function lireArguments(argv = process.argv.slice(2)) {
  const options = { port: 5180, ouvrir: true };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--no-open' || argument === '--sans-navigateur') options.ouvrir = false;
    else if (argument === '--port') {
      const valeur = Number(argv[index + 1]);
      if (!Number.isInteger(valeur) || valeur < 1 || valeur > 65535) {
        throw new Error(`port invalide : ${argv[index + 1]}`);
      }
      options.port = valeur;
      index += 1;
    } else if (argument === '--aide' || argument === '--help' || argument === '-h') {
      options.aide = true;
    } else {
      throw new Error(`argument inconnu : ${argument} (attendu : --port N, --no-open)`);
    }
  }
  return options;
}

/** Ouvre le navigateur sur l'URL, ou rend `false` sans lever si la machine n'en a pas. */
export function ouvrirNavigateur(url, plateforme = process.platform, lancer = spawn) {
  const commande = plateforme === 'darwin' ? 'open' : plateforme === 'win32' ? 'cmd' : 'xdg-open';
  const args = plateforme === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const enfant = lancer(commande, args, { stdio: 'ignore', detached: true });
    enfant.on('error', () => {});
    enfant.unref?.();
    return true;
  } catch {
    return false;
  }
}

export async function principal({
  argv = process.argv.slice(2),
  systeme = creerSysteme(),
  ouvrir = ouvrirNavigateur
} = {}) {
  const options = lireArguments(argv);
  if (options.aide) {
    return {
      texte: [
        'npm run serveurs [-- --port 5180] [-- --no-open]',
        '',
        '  --port N     port du tableau de bord (défaut 5180 ; celui des serveurs lancés est proposé libre)',
        '  --no-open    ne pas ouvrir le navigateur'
      ].join('\n')
    };
  }
  const serveur = await demarrerServeur({ port: options.port, systeme });
  const url = `${serveur.baseUrl}/?jeton=${serveur.jeton}`;
  if (options.ouvrir) ouvrir(url);
  return {
    url,
    baseUrl: serveur.baseUrl,
    arreter: serveur.arreter,
    texte: [
      `Tableau de bord des serveurs : ${url}`,
      '',
      'Il lit les processus en écoute, les worktrees du dépôt et leur état git.',
      'Lancer ou tuer un serveur ne quitte pas cette page ; Ctrl+C arrête le tableau de bord.'
    ].join('\n')
  };
}

const estPointDEntree = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (estPointDEntree) {
  principal()
    .then((resultat) => {
      if (resultat.texte) console.log(resultat.texte);
    })
    .catch((erreur) => {
      console.error(`tableau de bord : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
      process.exitCode = 1;
    });
}
