#!/usr/bin/env node
/**
 * Le point d'entrée du poste de pilotage (#184) — `npm run admin`.
 *
 * Lit les secrets, tire le jeton, ouvre le serveur sur `127.0.0.1` et affiche l'adresse à
 * ouvrir. Il **refuse de démarrer** sans configuration, avec un message qui dit où mettre le
 * fichier (`~/.secrets/supabase-admin.json`, `chmod 600`).
 *
 * Les secrets ne vivent **jamais** dans un fichier du dépôt ni dans `.env` : ils sont lus ici,
 * et ne passent jamais au navigateur (la page parle au serveur, le serveur parle à la base).
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { demarrerServeur } from './lib/app.mjs';
import { creerAccesPg } from './lib/acces.mjs';
import { cheminJournalParDefaut, creerJournal } from './lib/journal.mjs';

/** Le fichier de secrets du contrat (#184) : les clés `lecteur` et `admin`. */
export function cheminFichierSecrets(env = process.env) {
  if (env.ADMIN_SECRETS_FICHIER) return resolve(env.ADMIN_SECRETS_FICHIER);
  return resolve(homedir(), '.secrets', 'supabase-admin.json');
}

/**
 * Les deux chaînes de connexion, du fichier ou de l'environnement (`ADMIN_LECTEUR_URL`,
 * `ADMIN_ADMIN_URL` — pour que les tests n'aient jamais besoin du vrai fichier ni du réseau).
 * Sans les deux, la levée porte le message qui dit où mettre le fichier.
 */
export function chargerConfiguration(env = process.env) {
  const chemin = cheminFichierSecrets(env);
  let lecteur = String(env.ADMIN_LECTEUR_URL ?? '').trim() || null;
  let admin = String(env.ADMIN_ADMIN_URL ?? '').trim() || null;

  if (!lecteur || !admin) {
    let fichier = null;
    try {
      fichier = JSON.parse(readFileSync(chemin, 'utf8'));
    } catch {
      fichier = null;
    }
    lecteur = lecteur ?? (String((fichier && fichier.lecteur) ?? '').trim() || null);
    admin = admin ?? (String((fichier && fichier.admin) ?? '').trim() || null);
  }

  if (!lecteur || !admin) {
    const erreur = new Error(
      `pas de configuration : créer ${chemin} (chmod 600) avec { "lecteur": "…", "admin": "…" } — deux chaînes de connexion au pooler (sslmode=require)`
    );
    erreur.code = 'SANS_CONFIGURATION';
    throw erreur;
  }
  return { lecteur_url: lecteur, admin_url: admin };
}

/**
 * Le fichier où le jeton est **gardé d'un lancement à l'autre**, à côté du journal.
 *
 * Sans lui, chaque `npm run admin` tirait un jeton neuf : l'onglet resté ouvert répondait
 * `401` à tout, sans rien dire, et un redémarrage au mauvais moment faisait croire que « le
 * bouton ne fait rien » (constaté le 30/10/2026). Le fichier est en `0600`, hors du dépôt.
 */
export function cheminJeton(env = process.env) {
  return resolve(dirname(cheminJournalParDefaut(env)), 'jeton');
}

/**
 * Le jeton du poste : `ADMIN_JETON` s'il est posé (tests, poste partagé), sinon celui du
 * fichier, sinon un neuf — qu'on écrit pour la prochaine fois.
 */
export function resoudreJeton({ env = process.env, chemin = cheminJeton(env) } = {}) {
  const impose = String(env.ADMIN_JETON ?? '').trim();
  if (impose) return impose;
  try {
    const lu = readFileSync(chemin, 'utf8').trim();
    if (lu) return lu;
  } catch {
    // Premier lancement : il n'y a rien à relire.
  }
  const nouveau = randomBytes(24).toString('hex');
  try {
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, nouveau, { mode: 0o600 });
  } catch {
    // Disque en lecture seule : le jeton vivra le temps du processus, comme avant.
  }
  return nouveau;
}

/**
 * Ouvre le navigateur sur l'URL complète (avec le jeton), ou rend `false` sans lever si aucun
 * navigateur n'est disponible. Non bloquant : le processus en est détaché, le serveur continue
 * de vivre. Ne plante jamais l'appelant — l'adresse est affichée dans tous les cas.
 */
export function ouvrirNavigateur(url, lancer = spawn) {
  const [cmd, ...args] =
    process.platform === 'darwin'
      ? ['open', url]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', url]
        : ['xdg-open', url];
  try {
    const fils = lancer(cmd, args, { stdio: 'ignore', detached: true });
    // Un lanceur de test rend un objet nu : on ne suppose ni `on` ni `unref`.
    fils.on?.('error', () => {});
    fils.unref?.();
    return true;
  } catch {
    return false;
  }
}

export async function principal(env = process.env, argv = process.argv.slice(2)) {
  let configuration;
  try {
    configuration = chargerConfiguration(env);
  } catch (erreur) {
    console.error(`admin — ${erreur.message}`);
    return 1;
  }

  const acces = creerAccesPg(configuration);
  const journal = creerJournal(cheminJournalParDefaut(env));

  const portArg = argv.indexOf('--port');
  const port =
    portArg !== -1 && argv[portArg + 1] ? Number(argv[portArg + 1]) : env.ADMIN_PORT ? Number(env.ADMIN_PORT) : 5199;

  try {
    await acces.demarrer();
    const serveur = await demarrerServeur({
      adapter: acces,
      journal,
      port,
      hote: '127.0.0.1',
      jeton: resoudreJeton(env)
    });
    const adresse = `${serveur.baseUrl}/?jeton=${serveur.jeton}`;

    const ouvrirNavigateurAuto = env.ADMIN_OUVRIR_NAVIGATEUR !== 'false';
    const ouvert = ouvrirNavigateurAuto ? ouvrirNavigateur(adresse) : false;

    console.log(`Poste de pilotage : ${adresse}${ouvert ? '' : ' (ouvrir à la main)'}`);
    if (ouvert) console.log("Navigateur ouvert sur l'adresse (le jeton pose un cookie, inutile de le retaper).");
    console.log('Le jeton est exigé sur chaque requête ; il ne quitte pas cette machine.');
    console.log(`Journal : ${journal.chemin}`);
    return 0;
  } catch (erreur) {
    if (erreur && erreur.code === 'EADDRINUSE') {
      console.error(`admin — port ${port} déjà occupé : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    } else {
      console.error(`admin — ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    }
    await acces.fermer().catch(() => {});
    return 1;
  }
}

const estEntree = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (estEntree) {
  process.exitCode = await principal();
}
