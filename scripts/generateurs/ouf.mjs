#!/usr/bin/env node
/**
 * **Un post-it du mur devient une issue GitHub, sans être recopié** (#400).
 *
 * La deuxième étape du comité est le tri (`statut`, `raison`, `ticket`, à la main) ; la
 * troisième — créer le ticket — était un **copier-coller**. Ce script lit le post-it par le
 * rôle **`lecteur`** (jamais d'écriture), compose le **corps** de l'issue, et l'écrit sur la
 * sortie standard. `-- --creer` appelle `gh issue create` et rend le numéro.
 *
 * **Ce que le corps porte** : la famille, l'**écran**, la **version**, le pseudo, le **texte
 * verbatim**, et l'identifiant `p-…` du post-it. C'est ce dernier qui fait le lien dans les
 * deux sens : le post-it porte `ticket`, le ticket cite `p-…`. Un testeur qui relit la note
 * peut alors dire de quand date le signalement, et sur quel écran il a été vu.
 *
 * **Ce qui n'entre pas** :
 *
 * - un **gueulage** (D-085) : il n'a pas de famille, et son texte est une colère, pas un
 *   signalement. C'est l'OUF que la même réponse a produit qui porte le signalement ;
 * - une **IP** : ce n'est pas un problème. La commande s'appelle `ouf`, elle ne crée que des
 *   tickets de signalement.
 *
 * **Aucune clé dans le bundle, aucun réseau dans les tests** : c'est un script de poste,
 * comme `npm run problemes` (D-091, D-119), et le lanceur `gh` est **injecté** — le patron
 * d'`ouvrirNavigateur(url, lancer)`. Sans `--creer`, le lanceur n'est **jamais** appelé :
 * le tri reste humain.
 *
 * Usage :
 *   npm run ouf -- <post-it>            imprime le corps du ticket (rien n'est créé)
 *   npm run ouf -- <post-it> --creer    crée l'issue et rend son numéro
 *   npm run ouf -- --aide               affiche ce texte
 *
 * Configuration : comme `npm run problemes` — `~/.secrets/supabase-admin.json` (clé
 * `lecteur`, `chmod 600`), ou `PROBLEMES_LECTEUR_URL` / `ADMIN_LECTEUR_URL`. Sans elle, la
 * commande **refuse** : aucun repli sur `docs/comite.json`, qui ne voit pas l'état du mur.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { cheminSecrets, urlLecteur, verifierLectureSeule } from './problemes-connus.mjs';

/** L'adresse du dépôt : les tickets s'y créent, et le mur s'y lit. */
export const DEPOT = 'bureau-des-planques/planquex';

/** L'adresse du mur, en bas du ticket : un lecteur revient au post-it d'origine. */
export const URL_MUR = `https://github.com/${DEPOT}/blob/main/docs/comite.json`;

/**
 * La lecture : **un** post-it, par son identifiant, en paramètre. La ligne porte tout ce que
 * le corps demande — `texte` et `pseudo` compris, puisque c'est le contenu du ticket.
 */
export const REQUETE_POSTIT = `select id, kind, titre, texte, ecran, version, pseudo, statut, ticket, gueulage, lie
  from public.postits
 where id = $1`;

/** Le titre d'une issue : le titre du post-it, sur une ligne, jamais vide. */
export function titreDeTicket(postit) {
  const titre = String(postit?.titre ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return titre || `Post-it ${postit?.id ?? ''}`.trim();
}

/** Un champ du corps : l'étiquette et sa valeur, ou rien du tout quand il n'y a pas de valeur. */
function champ(etiquette, valeur) {
  const texte = String(valeur ?? '').trim();
  return texte ? `- **${etiquette}** : ${texte}` : null;
}

/**
 * Le corps de l'issue, **composé sans réseau** : c'est ce que les tests éprouvent mot pour
 * mot, et ce que `--creer` passe à `gh --body`.
 *
 * Le texte du post-it est **verbatim**, en citation : on ne le reformule pas, on ne le
 * tronque pas. C'est lui que le testeur a écrit.
 */
export function corpsDeTicket(postit) {
  const lignes = [
    champ('Post-it', `\`${postit.id}\``),
    champ('Famille', postit.kind),
    champ('Écran', postit.ecran),
    champ('Version', postit.version),
    champ('Pseudo', postit.pseudo),
    champ('Statut du post-it', postit.statut),
    champ('Ticket déjà lié', postit.ticket ? `#${postit.ticket}` : '')
  ].filter(Boolean);

  const texte = String(postit.texte ?? '').trim();
  const citation = texte
    ? texte
        .split('\n')
        .map((ligne) => `> ${ligne}`)
        .join('\n')
    : '> (le post-it est vide)';

  return [
    '## Signalement venu du mur du comité',
    '',
    ...lignes,
    '',
    '### Ce que le testeur a écrit, verbatim',
    '',
    citation,
    '',
    `Mur : ${URL_MUR} — le post-it se trie par \`npm run statut ${postit.id} <statut>\`.`
  ].join('\n');
}

/**
 * Le contrôle **pur** d'un post-it : ce qui peut devenir un ticket, ou le refus en français.
 * Un gueulage est refusé (D-085), une IP aussi, et une ligne illisible ne compose rien.
 */
export function verifierPostit(ligne) {
  if (!ligne || typeof ligne !== 'object' || Array.isArray(ligne)) {
    return 'la base n’a pas rendu ce post-it — vérifier l’identifiant.';
  }
  if (ligne.gueulage === true) {
    return 'Un gueulage n’entre jamais dans un ticket (D-085) : c’est l’OUF qu’il désigne qui porte le signalement.';
  }
  if (String(ligne.kind ?? '').trim() !== 'OUF') {
    return `Ce post-it n’est pas un OUF (« ${String(ligne.kind ?? 'sans famille')} ») : seul un signalement devient un ticket.`;
  }
  if (!String(ligne.id ?? '').trim()) return 'ce post-it n’a pas d’identifiant : le ticket ne pourrait pas le citer.';
  return null;
}

/**
 * Lit un post-it par l'interface étroite `lire(sql, params)` — `pg` en production, PGlite
 * dans les tests. Aucune règle métier ici : le contrôle est dans `verifierPostit`.
 */
export async function lirePostit(lire, id) {
  if (typeof lire !== 'function') throw new TypeError('lirePostit attend une fonction de lecture');
  const resultat = await lire(REQUETE_POSTIT, [String(id)]);
  const ligne = resultat?.rows?.[0];
  return ligne && typeof ligne === 'object' ? ligne : null;
}

export function argumentsOuf(ligne) {
  const options = { id: null, creer: false, aide: false, erreur: null };
  for (const arg of ligne) {
    if (arg === '--creer') options.creer = true;
    else if (arg === '--aide' || arg === '--help' || arg === '-h') options.aide = true;
    else if (arg.startsWith('-')) options.erreur = `argument inconnu : ${arg}`;
    else if (options.id) options.erreur = `un seul post-it à la fois : « ${options.id} » et « ${arg} »`;
    else options.id = arg;
  }
  return options;
}

const AIDE = `Usage : npm run ouf -- <post-it> [--creer]

Le post-it du mur devient une issue GitHub, sans être recopié à la main (#400).

  <post-it>     l'identifiant du post-it (p-…)
  --creer       crée l'issue par « gh issue create » et rend son numéro ; sans ce
                drapeau, le corps est imprimé et RIEN n'est créé (le tri reste humain)
  --aide        affiche ce texte

Le corps porte la famille, l'écran, la version, le pseudo, le texte verbatim et
l'identifiant du post-it. Un gueulage est refusé (D-085) ; une IP aussi.

Configuration : ~/.secrets/supabase-admin.json (clé « lecteur », chmod 600), ou
PROBLEMES_LECTEUR_URL. La lecture se fait par le rôle « lecteur » : le script n'écrit
jamais sur le mur.`;

/** Le client Postgres, chargé **seulement** quand la commande a une configuration. */
async function ouvrirLecteur(url) {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/**
 * Le lanceur `gh` de production. **C'est la seule couture réseau** de la commande : les
 * tests injectent leur propre lanceur, donc aucun `gh` n'est lancé et rien n'est créé.
 */
export function lancerGh(args) {
  const resultat = spawnSync('gh', args, { encoding: 'utf8' });
  return {
    code: typeof resultat.status === 'number' ? resultat.status : 1,
    sortie: `${resultat.stdout ?? ''}${resultat.stderr ?? ''}`
  };
}

/** Le numéro d'une issue, lu dans l'adresse que `gh issue create` imprime. */
export function numeroDeIssue(sortie) {
  const trouve = /\/issues\/(\d+)/.exec(String(sortie ?? ''));
  return trouve ? Number(trouve[1]) : null;
}

/**
 * La commande. `ouvrir` **et** `lancer` sont injectables : sans le second, aucun réseau.
 */
export async function principalOuf(
  argv = process.argv.slice(2),
  env = process.env,
  { ouvrir = ouvrirLecteur, lancer = lancerGh, sortie = console } = {}
) {
  const options = argumentsOuf(argv);
  if (options.erreur) {
    sortie.error(`ouf — ${options.erreur}`);
    sortie.error(AIDE);
    return 1;
  }
  if (options.aide) {
    sortie.log(AIDE);
    return 0;
  }
  if (!options.id) {
    sortie.error('ouf — il faut l’identifiant d’un post-it : npm run ouf -- p-…');
    sortie.error(AIDE);
    return 1;
  }

  const url = urlLecteur(env);
  const refus = url
    ? verifierLectureSeule(url)
    : `pas de connexion de lecture : créer ${cheminSecrets(env)} (clé « lecteur », chmod 600), ou poser PROBLEMES_LECTEUR_URL`;
  if (refus) {
    sortie.error(`ouf — ${refus}`);
    sortie.error('Aucun repli sur docs/comite.json : ce fichier ne voit pas l’état réel du mur.');
    return 1;
  }

  let client = null;
  try {
    client = await ouvrir(url);
    const postit = await lirePostit((sql, params) => client.query(sql, params), options.id);
    if (!postit) {
      sortie.error(`ouf — aucun post-it « ${options.id} » dans le mur.`);
      return 1;
    }
    const mauvais = verifierPostit(postit);
    if (mauvais) {
      sortie.error(`ouf — ${mauvais}`);
      return 1;
    }

    const corps = corpsDeTicket(postit);
    if (!options.creer) {
      // **Rien n'est créé** : le corps s'imprime, le tri reste humain.
      sortie.log(corps);
      return 0;
    }

    const resultat = await lancer(['issue', 'create', '--title', titreDeTicket(postit), '--body', corps]);
    if (resultat?.code !== 0) {
      const detail = String(resultat?.sortie ?? '').trim();
      sortie.error(`ouf — gh issue create a échoué${detail ? ` : ${detail}` : '.'}`);
      return 1;
    }
    const numero = numeroDeIssue(resultat.sortie);
    if (!numero) {
      sortie.error(`ouf — l’issue a peut-être été créée, mais son numéro est illisible : ${resultat.sortie}`);
      return 1;
    }
    sortie.log(`Ticket #${numero} — https://github.com/${DEPOT}/issues/${numero}`);
    return 0;
  } catch (erreur) {
    sortie.error(`ouf — la base n’a pas répondu : ${erreur instanceof Error ? erreur.message : erreur}`);
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
  process.exitCode = await principalOuf();
}
