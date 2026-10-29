#!/usr/bin/env node
/**
 * Les **problèmes connus d'une release**, pris au mur du comité (#299, D-119).
 *
 * Une release ne porte pas une liste de problèmes écrite à la main : elle porte **ce que le
 * mur dit encore cassé**. La base est la source du mur depuis D-104 ; ce script la lit en
 * **lecture seule** et rend un bloc de markdown à coller dans le corps de la release, sous
 * `## Pour un testeur` (la seule section que le parseur de notes écarte, `docs/VERSIONS.md`
 * §4.2).
 *
 * **Ce qui entre, et ce qui sort** (D-119) :
 *
 * - un post-it **OUF** au statut **`retenu`** ou **`en cours`** entre : c'est un signalement
 *   validé par le tri, et il n'est pas corrigé ;
 * - `en attente` n'entre pas : personne ne l'a encore trié, et publier une affirmation non
 *   vérifiée dans une note de version est exactement ce que D-059 évite ;
 * - `fait` **sort** : le correctif part dans la même release, la ligne n'a plus à y être ;
 * - `écarté` sort : la raison reste sur le mur, la note n'a pas à la reprendre ;
 * - une **IP** n'est pas un problème (D-058) ;
 * - un **gueulage** ne sort **jamais** : il n'a pas de famille (D-085), et son texte est une
 *   colère, pas un signalement. Le signalement, c'est l'OUF que la même réponse du formulaire
 *   a produit — le gueulage le désigne par `lie`, et c'est cet OUF qui suit le filtre.
 *
 * **Aucune clé dans le bundle, aucun secret committé.** La connexion est celle du rôle
 * **`lecteur`** (D-091), créé par `supabase/admin/roles.sql` : `select` seul, RLS comprise.
 * Elle se lit dans `~/.secrets/supabase-admin.json` (clé `lecteur`, fichier hors dépôt,
 * `chmod 600`) ou dans `PROBLEMES_LECTEUR_URL` / `ADMIN_LECTEUR_URL` pour un poste. Un rôle
 * qui n'est pas `lecteur` est **refusé avant de se connecter** : le script ne peut pas écrire
 * sur le mur par accident.
 *
 * **Pas de repli sur `docs/comite.json`** : c'est le défaut que #299 corrige. Sans base, la
 * commande refuse (exit 1) et dit où mettre la configuration — elle n'imprime pas une liste
 * qui aurait vieilli.
 *
 * **La requête ne lit ni `texte` ni `pseudo`.** Un gueulage ne peut donc pas exposer son
 * texte, même si le filtre se trompait : la colonne n'est pas demandée. La garde le vérifie
 * sur la requête elle-même (`scripts/generateurs/problemes-connus.test.ts`).
 *
 * Usage :
 *   npm run problemes             imprime le bloc à coller sous « ## Pour un testeur »
 *   npm run problemes -- --json   imprime les lignes, pour un script ou un contrôle
 *   npm run statut -- --problemes même chose, par la commande de tri (D-097 (7))
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Les statuts qui entrent dans la note. `retenu` = validé, pas commencé ; `en cours` = en
 * travaux. Les trois autres sont dehors, pour les raisons du commentaire d'en-tête.
 */
export const STATUTS_PUBLIES = ['retenu', 'en cours'];

/**
 * La lecture. Elle ne demande **ni `texte` ni `pseudo`** : le titre suffit à dire le
 * problème, et un gueulage ne peut pas laisser fuir son texte par cette porte.
 *
 * `order by created_at, id` rend l'ordre stable d'une release à l'autre ; aucune donnée
 * n'est écrite, et le rôle `lecteur` n'en aurait pas le droit.
 */
export const REQUETE_PROBLEMES = `select id, kind, titre, statut, ticket, gueulage, lie, version, ecran
  from public.postits
 order by created_at, id`;

/** Le titre d'un post-it, sur une ligne : un retour à la ligne casserait la puce. */
export function nettoyerTitre(titre) {
  return String(titre ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Le filtre, **pur** : c'est lui que les tests éprouvent et que `npm run garde-fous` mute.
 * Une ligne illisible est écartée, pas affichée à moitié.
 */
export function filtrerProblemes(lignes) {
  return (Array.isArray(lignes) ? lignes : [])
    .filter((ligne) => ligne && typeof ligne === 'object')
    .filter((ligne) => ligne.gueulage !== true && ligne.kind === 'OUF')
    .filter((ligne) => STATUTS_PUBLIES.includes(String(ligne.statut ?? '').trim()))
    .map((ligne) => ({
      id: String(ligne.id ?? '').trim(),
      titre: nettoyerTitre(ligne.titre),
      // L'écran et la version disent **où** et **quand** le problème a été vu (#401) : un
      // testeur qui re-signale sait alors si son signalement est d'avant ou d'après.
      ecran: nettoyerTitre(ligne.ecran),
      version: nettoyerTitre(ligne.version),
      // Un ticket est un entier > 0, comme dans le mur (`numeroDeTicket`, 0001).
      ticket: Number.isInteger(ligne.ticket) && ligne.ticket > 0 ? ligne.ticket : null
    }))
    .filter((probleme) => probleme.id && probleme.titre);
}

/**
 * La puce d'un problème : son titre, puis — quand le mur le porte — l'**écran** et la
 * **version** du signalement (#401), et enfin son ticket. Un post-it sans écran ni version
 * (import ancien, champ vide) ne laisse **ni tiret orphelin ni « undefined »** : la partie
 * manquante n'est simplement pas écrite.
 *
 * Rien d'autre n'entre : ni `texte`, ni `pseudo`, ni `raison` (D-085, D-059).
 */
export function etiquetteProbleme(probleme) {
  const ou = [nettoyerTitre(probleme?.ecran), nettoyerTitre(probleme?.version)].filter(Boolean).join(', ');
  const ticket = Number.isInteger(probleme?.ticket) && probleme.ticket > 0 ? ` (#${probleme.ticket})` : '';
  return `${nettoyerTitre(probleme?.titre)}${ou ? ` — ${ou}` : ''}${ticket}`;
}

/**
 * Le bloc de release. **Aucun titre markdown** : `SECTIONS_ECARTEES`
 * (`scripts/generateurs/notes-versions.mjs`) écarte une section **par son titre**, et un `###` sous
 * `## Pour un testeur` rouvrirait le groupe — les problèmes connus entreraient alors dans
 * `/feuille-de-route`, ce qui n'est pas leur place. La ligne en gras n'est pas un titre
 * pour `titreDeLigne` : elle porte une phrase après le gras.
 */
export function blocProblemes(problemes) {
  const liste = Array.isArray(problemes) ? problemes : [];
  if (liste.length === 0) {
    return '**Problèmes connus** — aucun problème ouvert à ce jour.';
  }
  const puces = liste.map((probleme) => `- ${etiquetteProbleme(probleme)}`);
  return ['**Problèmes connus** — ce qui est déjà signalé, et pas encore corrigé :', '', ...puces].join('\n');
}

/**
 * Lit le mur par l'interface étroite `lire(sql)` — `pg` en production, PGlite dans les
 * tests. Le filtre reste **hors** de la requête : une seule règle, un seul endroit, et les
 * tests peuvent la confronter à un cas fautif.
 */
export async function lireProblemesConnus(lire) {
  if (typeof lire !== 'function') {
    throw new TypeError('lireProblemesConnus attend une fonction de lecture');
  }
  const resultat = await lire(REQUETE_PROBLEMES);
  return filtrerProblemes(resultat?.rows ?? []);
}

/** Le fichier de secrets du poste (#184, D-091) : hors dépôt, jamais committé. */
export function cheminSecrets(env = process.env) {
  if (env.PROBLEMES_SECRETS_FICHIER) return resolve(env.PROBLEMES_SECRETS_FICHIER);
  return resolve(homedir(), '.secrets', 'supabase-admin.json');
}

/**
 * La chaîne de connexion du rôle `lecteur` : les deux variables d'environnement d'abord
 * (tests, poste sans fichier), puis la clé `lecteur` du fichier de secrets. Jamais `.env`,
 * jamais une clé `VITE_*` : ce script n'est pas le jeu.
 */
export function urlLecteur(env = process.env) {
  const direct = String(env.PROBLEMES_LECTEUR_URL ?? env.ADMIN_LECTEUR_URL ?? '').trim();
  if (direct) return direct;
  let secrets;
  try {
    secrets = JSON.parse(readFileSync(cheminSecrets(env), 'utf8'));
  } catch {
    return null;
  }
  return String(secrets?.lecteur ?? '').trim() || null;
}

/**
 * Le rôle d'une chaîne `postgresql://…` : le pooler de Supabase l'écrit
 * `lecteur.<project-ref>`. Une chaîne illisible rend `''`.
 */
export function roleDe(url) {
  try {
    return decodeURIComponent(new URL(url).username).split('.')[0].toLowerCase();
  } catch {
    return '';
  }
}

/**
 * La garde de lecture seule : un rôle autre que `lecteur` est refusé **avant** la connexion.
 * Le rôle `postgres` du poste de pilotage écrirait ; ce script ne doit pas l'employer.
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

export function argumentsProblemes(ligne) {
  const options = { json: false, aide: false, erreur: null };
  for (const arg of ligne) {
    if (arg === '--json') options.json = true;
    else if (arg === '--aide' || arg === '--help' || arg === '-h') options.aide = true;
    else options.erreur = `argument inconnu : ${arg}`;
  }
  return options;
}

const AIDE = `Usage : npm run problemes [--json]

Les problèmes connus d'une release, lus dans la base du comité, en lecture seule.

  --json       imprime les lignes en JSON, sans mise en forme
  --aide       affiche ce texte

Ce qui entre : les post-its OUF « retenu » ou « en cours ». Un « fait » sort, un « écarté »
sort, un « en attente » attend le tri, et un gueulage ne sort jamais — c'est l'OUF qu'il
désigne qui porte le signalement.

Le bloc s'imprime sans titre markdown : il se colle sous « ## Pour un testeur » dans le
corps de la release, et le parseur de notes écarte cette section (docs/VERSIONS.md §4.2).

Configuration : ~/.secrets/supabase-admin.json (clé « lecteur », chmod 600), ou
PROBLEMES_LECTEUR_URL. Sans configuration, la commande refuse : aucun repli sur
docs/comite.json, qui ne voit pas l'état réel du mur.`;

/**
 * La commande. `lire` et `ouvrir` sont injectables pour un test sans réseau ; l'appelant
 * normal ne les passe pas.
 */
export async function principalProblemes(
  argv = process.argv.slice(2),
  env = process.env,
  { ouvrir = ouvrirLecteur, sortie = console } = {}
) {
  const options = argumentsProblemes(argv);
  if (options.erreur) {
    sortie.error(`problemes — ${options.erreur}`);
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
    : `pas de connexion de lecture : créer ${cheminSecrets(env)} (clé « lecteur », chmod 600), ou poser PROBLEMES_LECTEUR_URL`;
  if (refus) {
    sortie.error(`problemes — ${refus}`);
    sortie.error('Aucun repli sur docs/comite.json : ce fichier ne voit pas l’état réel du mur.');
    return 1;
  }

  let client = null;
  try {
    client = await ouvrir(url);
    const problemes = await lireProblemesConnus((sql) => client.query(sql));
    if (options.json) sortie.log(JSON.stringify({ problemes }, null, 2));
    else sortie.log(blocProblemes(problemes));
    return 0;
  } catch (erreur) {
    sortie.error(`problemes — la base n’a pas répondu : ${erreur instanceof Error ? erreur.message : erreur}`);
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
  process.exitCode = await principalProblemes();
}
