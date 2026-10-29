#!/usr/bin/env node
/**
 * **Lire les traces de combat** — `npm run traces` (#358).
 *
 * Le jeu dépose une trace de chaque partie terminée (#173, D-086) ; ce script les **relit**
 * et rend un **compte rendu court** : combien de parties, combien terminées, où ça s'arrête,
 * qui gagne contre la Direction, les tours médians, les abandons, et les cartes qui ne
 * sortent jamais. Ce n'est **pas** un tableau de bord interactif : c'est une lecture.
 *
 * **Lecture seule, par le rôle `lecteur`** (D-091), sur le patron de `npm run problemes`
 * (D-119) :
 *
 * - la connexion se lit dans `~/.secrets/supabase-admin.json` (clé `lecteur`) ou dans
 *   `ADMIN_LECTEUR_URL` / `TRACES_LECTEUR_URL` ;
 * - un rôle autre que `lecteur` est **refusé avant la connexion** : le script ne peut pas
 *   écrire dans la base par accident ;
 * - **sans configuration, la commande refuse** (exit 1) — il n'y a pas de repli sur un
 *   fichier local, qui ne verrait pas l'état réel de la base.
 *
 * **Aucune donnée de compte** : la requête ne demande **pas** `auteur` — ni courriel, ni
 * identifiant, ni pseudo (D-086 dit que la trace n'en porte pas). Le bilan parle de parties,
 * jamais de personnes.
 *
 * Le rejeu et les agrégats vivent dans `src/game/traces.ts` (type-checké, testé) : ce script
 * ne fait que lire la base et imprimer.
 *
 * Usage :
 *   npm run traces                 # les 30 derniers jours
 *   npm run traces -- --jours 7    # la dernière semaine
 *   npm run traces -- --json       # le bilan complet, pour un script
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

/**
 * La requête de lecture. **Pas d'`auteur`** : la trace est une partie, pas une personne.
 * `make_interval(days => $1)` borne la période et reste **paramétrée** (jamais concaténée).
 */
export const REQUETE_TRACES = `select id, mode, graine, decks, types_cafe, journal
  from public.combats
 where created_at >= now() - make_interval(days => $1)
 order by created_at, id
 limit $2`;

/** Le nombre de jours par défaut : le dernier mois de l'alpha. */
export const JOURS_PAR_DEFAUT = 30;

/** La borne de sécurité : au-delà, on ne rejoue pas tout l'historique dans une commande. */
export const LIMITE_PAR_DEFAUT = 2000;

/** Le fichier de secrets du poste (#184, D-091) : hors dépôt, jamais committé. */
export function cheminSecrets(env = process.env) {
  if (env.TRACES_SECRETS_FICHIER) return resolve(env.TRACES_SECRETS_FICHIER);
  return resolve(homedir(), '.secrets', 'supabase-admin.json');
}

/**
 * La chaîne de connexion du rôle `lecteur` : les variables d'environnement d'abord (tests,
 * poste sans fichier), puis la clé `lecteur` du fichier de secrets. Jamais `.env`, jamais
 * une clé `VITE_*`.
 */
export function urlLecteur(env = process.env) {
  const direct = String(env.TRACES_LECTEUR_URL ?? env.ADMIN_LECTEUR_URL ?? '').trim();
  if (direct) return direct;
  let secrets;
  try {
    secrets = JSON.parse(readFileSync(cheminSecrets(env), 'utf8'));
  } catch {
    return null;
  }
  return String(secrets?.lecteur ?? '').trim() || null;
}

/** Le rôle d'une chaîne `postgresql://…` : le pooler de Supabase l'écrit `lecteur.<ref>`. */
export function roleDe(url) {
  try {
    return decodeURIComponent(new URL(url).username).split('.')[0].toLowerCase();
  } catch {
    return '';
  }
}

/**
 * La garde de lecture seule : un rôle autre que `lecteur` est refusé **avant** la connexion.
 * Le rôle `postgres` du poste de pilotage écrirait ; cette commande ne doit pas l'employer.
 */
export function verifierLectureSeule(url) {
  if (!url) return 'aucune connexion de lecture configurée';
  const role = roleDe(url);
  if (role !== 'lecteur') {
    return `la connexion n’est pas le rôle « lecteur » (rôle lu : « ${role || 'inconnu'} »)`;
  }
  return null;
}

/** Le client Postgres, chargé **seulement** quand la commande a une configuration. */
async function ouvrirLecteur(url) {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/** Charge le module de rejeu (TypeScript) par Vite, une fois, seulement s'il le faut. */
async function chargerAgregat() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent'
  });
  try {
    const module = await server.ssrLoadModule('/src/game/traces.ts');
    return { agreger: (lignes) => module.bilanTraces(lignes) };
  } finally {
    await server.close();
  }
}

export function argumentsTraces(ligne) {
  const options = { jours: JOURS_PAR_DEFAUT, limite: LIMITE_PAR_DEFAUT, json: false, aide: false, erreur: null };
  for (let index = 0; index < ligne.length; index += 1) {
    const arg = ligne[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--aide' || arg === '--help' || arg === '-h') options.aide = true;
    else if (arg === '--jours' || arg === '--limite') {
      const brut = ligne[(index += 1)];
      if (!/^\d+$/.test(brut ?? '') || Number(brut) < 1) {
        options.erreur = `${arg} attend un entier ≥ 1, reçu « ${brut ?? ''} »`;
      } else if (arg === '--jours') options.jours = Number(brut);
      else options.limite = Number(brut);
    } else options.erreur = `argument inconnu : ${arg}`;
  }
  return options;
}

const AIDE = `Usage : npm run traces [--jours N] [--limite N] [--json]

Les traces de combat de l'alpha, relues en lecture seule (rôle « lecteur ») et rejouées.

  --jours <N>    la période, en jours (défaut : ${JOURS_PAR_DEFAUT})
  --limite <N>   nombre maximal de traces rejouées (défaut : ${LIMITE_PAR_DEFAUT})
  --json         le bilan complet en JSON, sans mise en forme
  --aide         affiche ce texte

Ce que le compte rendu dit : parties solo et PvP, parties terminées, abandons (journal
tronqué), traces illisibles, issues, taux de victoire du joueur contre la Direction, tours
médians, parties à la limite, forfaits, Interventions et craquages, et les cartes les plus
jouées comme celles qui ne sortent jamais.

Aucune donnée de compte n'est lue : la requête ne demande pas « auteur ».

Configuration : ~/.secrets/supabase-admin.json (clé « lecteur », chmod 600), ou
ADMIN_LECTEUR_URL / TRACES_LECTEUR_URL. Sans configuration, la commande refuse.`;

const pourcent = (valeur) => (valeur === null ? '—' : `${(100 * valeur).toFixed(1)} %`);

/** Le compte rendu humain : court, et il dit **où** la boucle s'arrête. */
export function compteRendu(bilan, options = {}) {
  const jours = options.jours ?? JOURS_PAR_DEFAUT;
  const lignes = [
    `Traces de combat — ${bilan.parties} partie(s) sur ${jours} jour(s) · ${bilan.terminees} terminée(s), ` +
      `${bilan.abandons} abandon(s), ${bilan.illisibles} trace(s) illisible(s)`,
    `Modes : ${bilan.parMode.solo} solo · ${bilan.parMode.pvp} à deux`,
    '',
    `Issues (terminées) : joueur ${bilan.issues.joueur} · Direction ${bilan.issues.direction} · nulle ${bilan.issues.nulle}`,
    `Taux de victoire du joueur contre la Direction (solo décidées) : ${pourcent(bilan.tauxVictoireSolo)} ` +
      `sur ${bilan.soloDecidees} partie(s)`,
    `Tours : médiane ${bilan.tours.mediane} (min ${bilan.tours.min}, max ${bilan.tours.max})`,
    `Arrêts : ${bilan.aLaLimite} à la limite de tours · ${bilan.forfaits} forfait(s)`,
    `Par partie : ${bilan.interventionsMoyennes.joueur} Intervention(s) joueur / ${bilan.interventionsMoyennes.direction} Direction` +
      ` · ${bilan.craquagesParPartie} craquage(s)`,
    '',
    `Cartes les plus jouées : ${
      bilan.cartesPlusJouees.length === 0
        ? '—'
        : bilan.cartesPlusJouees
            .slice(0, 5)
            .map((ligne) => `${ligne.carte} (${ligne.parties})`)
            .join(', ')
    }`,
    `Cartes qui ne sortent jamais (dans un Deck tracé, jouées dans aucune partie) : ${
      bilan.cartesJamaisJouees.length === 0 ? 'aucune' : `${bilan.cartesJamaisJouees.length}`
    }`,
    ...(bilan.cartesJamaisJouees.length === 0 ? [] : [`  ${bilan.cartesJamaisJouees.slice(0, 15).join(', ')}`])
  ];
  return lignes.join('\n');
}

/**
 * La commande. `ouvrir` et `agreger` sont **injectables** : un test peut la faire tourner
 * sans base ni réseau, et c'est ainsi que la garde « sans configuration, elle refuse »
 * s'exerce sans dépendre d'un fichier de secrets.
 */
export async function principalTraces(
  argv = process.argv.slice(2),
  env = process.env,
  { ouvrir = ouvrirLecteur, agreger = null, sortie = console } = {}
) {
  const options = argumentsTraces(argv);
  if (options.erreur) {
    sortie.error(`traces — ${options.erreur}`);
    sortie.error(AIDE);
    return 1;
  }
  if (options.aide) {
    sortie.log(AIDE);
    return 0;
  }

  const url = urlLecteur(env);
  const refus = url
    ? verifierLectureSeule(url)
    : `pas de connexion de lecture : créer ${cheminSecrets(env)} (clé « lecteur », chmod 600), ou poser ADMIN_LECTEUR_URL`;
  if (refus) {
    sortie.error(`traces — ${refus}`);
    sortie.error('Aucun repli sur un fichier local : il ne verrait pas l’état réel de la base.');
    return 1;
  }

  let client = null;
  try {
    const agregation = agreger ? { agreger } : await chargerAgregat();
    client = await ouvrir(url);
    const lu = await client.query(REQUETE_TRACES, [options.jours, options.limite]);
    const bilan = await agregation.agreger(lu?.rows ?? []);
    if (options.json) sortie.log(JSON.stringify({ jours: options.jours, bilan }, null, 2));
    else sortie.log(compteRendu(bilan, options));
    return 0;
  } catch (erreur) {
    sortie.error(`traces — la base n’a pas répondu : ${erreur instanceof Error ? erreur.message : erreur}`);
    return 1;
  } finally {
    if (client && typeof client.end === 'function') {
      try {
        await client.end();
      } catch {
        /* la connexion est déjà tombée : rien à ajouter au message */
      }
    }
  }
}

const estEntree = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (estEntree) {
  process.exitCode = await principalTraces();
}
