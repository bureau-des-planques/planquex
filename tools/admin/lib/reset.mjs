/**
 * Le reset de la beta (#342, D-130, D-150) — un geste du poste de pilotage, jamais une migration.
 *
 * Ce qui part : les **traces de combat** (`combats`), **le mur** (`postits`, avec leurs `votes`
 * et `commentaires`), et le **Deck** et la **Collection** du compte (`deck`, `collection`) que
 * D-153 (2) a posés côté base. Ce qui reste : **chaque compte** (`comptes` : courriel, mot de passe,
 * approbation). Et, une seule fois, la **Médaille de la période d'essai** est posée sur les comptes
 * approuvés (`medaille_periode_essai`, 0016). `admin.migrations` n'est pas touché : un reset ne
 * décrit pas le schéma (D-130 (4)).
 *
 * Le geste tient en **une seule instruction** SQL : les effacements et la médaille réussissent
 * ensemble ou pas du tout, et chaque compte rendu vient de la même instruction que l'effacement
 * (pas d'écart entre « compté » et « effacé »). Les cascades (`votes`, `commentaires` par
 * `on delete cascade`, 0001) sont donc **comptées explicitement** : on les vide d'abord.
 *
 * Ces fonctions ne parlent à la base que par l'interface `{ lire, ecrire }` du poste (`acces.mjs`).
 * La confirmation est **tapée à la main** et comparée à l'identique : refusée, rien ne part.
 */

/** Le texte à taper, à l'identique. La page (`page.html`) le porte aussi : un test les compare. */
export const CONFIRMATION = 'remettre à zéro la beta';

/** Ce qui est vidé, ce qui est gardé, et ce que le geste ne touche jamais (le compte rendu le dit). */
export const PERIMETRE = Object.freeze({
  vides: [
    'public.votes',
    'public.commentaires',
    'public.postits',
    'public.combats',
    'public.collection',
    'public.deck'
  ],
  gardes: ['public.comptes'],
  intactes: ['admin.migrations', 'public.annonces_discord', 'auth.users', 'public.profils (si elle existe, #325)']
});

/**
 * Le reset, en une instruction. Les enfants (`votes`, `commentaires`) avant leur parent (`postits`) :
 * chaque `delete` compte **ses** lignes. Le Deck et la Collection du compte partent dans le même
 * geste (D-153 (2)). La médaille ne va qu'aux comptes `approuve`, et **une seule fois** : tant
 * qu'une médaille existe déjà, un reset rejoué n'en pose pas de nouvelle (sinon un compte approuvé
 * après la beta la recevrait).
 */
export const SQL_RESET = `with
  votes_vides as (delete from public.votes returning 1),
  commentaires_vides as (delete from public.commentaires returning 1),
  postits_vides as (delete from public.postits returning 1),
  combats_vides as (delete from public.combats returning 1),
  collection_vides as (delete from public.collection returning 1),
  deck_vides as (delete from public.deck returning 1),
  medailles as (
    update public.comptes
       set medaille_periode_essai = true,
           medaille_periode_essai_le = now()
     where etat = 'approuve'
       and not medaille_periode_essai
       and not exists (select 1 from public.comptes where medaille_periode_essai)
    returning 1
  )
select
  (select count(*) from votes_vides)::int as votes,
  (select count(*) from commentaires_vides)::int as commentaires,
  (select count(*) from postits_vides)::int as postits,
  (select count(*) from combats_vides)::int as combats,
  (select count(*) from collection_vides)::int as collection,
  (select count(*) from deck_vides)::int as deck,
  (select count(*) from medailles)::int as medailles`;

/** L'état avant le geste : ce qui partirait, ce qui reste. Lecture seule (rôle `lecteur`). */
export const SQL_APERCU = `select
  (select count(*) from public.combats)::int as combats,
  (select count(*) from public.postits)::int as postits,
  (select count(*) from public.votes)::int as votes,
  (select count(*) from public.commentaires)::int as commentaires,
  (select count(*) from public.collection)::int as collection,
  (select count(*) from public.deck)::int as deck,
  (select count(*) from public.comptes)::int as comptes,
  (select count(*) from public.comptes where etat = 'approuve')::int as approuves,
  (select count(*) from public.comptes where medaille_periode_essai)::int as medailles_posees`;

const SQL_IDS_COMPTES = 'select id from public.comptes';

function refusReset(message, code) {
  const erreur = new Error(message);
  erreur.statut = 400;
  erreur.publicMessage = message;
  erreur.code = code;
  return erreur;
}

/** Refuse toute confirmation qui n'est pas le texte exact. Rien n'est lu ni écrit avant. */
export function verifierConfirmation(saisie) {
  if (saisie !== CONFIRMATION) {
    throw refusReset('confirmation non tapée à l’identique : rien n’a été effacé', 'confirmation-refusee');
  }
}

/** La ligne d'aperçu, en nombres. */
function lireApercu(lu) {
  const ligne = lu.rows[0] ?? {};
  const n = (valeur) => Number(valeur ?? 0);
  return {
    combats: n(ligne.combats),
    postits: n(ligne.postits),
    votes: n(ligne.votes),
    commentaires: n(ligne.commentaires),
    collection: n(ligne.collection),
    deck: n(ligne.deck),
    comptes: n(ligne.comptes),
    approuves: n(ligne.approuves),
    medaillesPosees: n(ligne.medailles_posees)
  };
}

/** Ce qui partirait et ce qui reste, avant tout geste. */
export async function apercuReset(adapter) {
  return lireApercu(await adapter.lire(SQL_APERCU));
}

/** Le texte de l'aperçu, pour la page. Une seule source : la page ne recompose rien. */
export function texteApercu(apercu) {
  // La médaille ne se pose que si aucune n'existe : on le dit comme le fait la requête.
  const aPoser = apercu.medaillesPosees === 0 ? apercu.approuves : 0;
  const lignes = [
    'Ce qui partirait :',
    `  traces de combat : ${apercu.combats}`,
    `  post-its : ${apercu.postits} (votes : ${apercu.votes}, commentaires : ${apercu.commentaires})`,
    `  Collection : ${apercu.collection} ligne(s)`,
    `  Deck : ${apercu.deck} ligne(s)`,
    'Ce qui reste :',
    `  comptes : ${apercu.comptes} (approuvés : ${apercu.approuves})`,
    `  médailles déjà posées : ${apercu.medaillesPosees}`,
    `  médailles à poser : ${aPoser}`
  ];
  return lignes.join('\n');
}

/**
 * Le compte rendu du geste, par table. `supprimees` et `lignes` viennent de l'instruction elle-même ;
 * les anomalies comparent les identifiants des comptes avant et après (un compte disparu se voit).
 */
export function composerRapport({ avant, apres, compte, idsAvant, idsApres }) {
  const absents = [...idsAvant].filter((id) => !idsApres.has(id));
  // Une trace qui survit au geste est une anomalie, même si le compte rendu a annoncé un effacement.
  const restes = [
    ['combats', apres.combats],
    ['postits', apres.postits],
    ['votes', apres.votes],
    ['commentaires', apres.commentaires],
    ['collection', apres.collection],
    ['deck', apres.deck]
  ].filter(([, n]) => n > 0);
  return {
    confirme: true,
    medaillesDejaPosees: avant.medaillesPosees,
    tables: [
      { table: 'public.combats', sort: 'vidée', lignes: compte.combats },
      { table: 'public.postits', sort: 'vidée', lignes: compte.postits },
      { table: 'public.votes', sort: 'vidée', lignes: compte.votes },
      { table: 'public.commentaires', sort: 'vidée', lignes: compte.commentaires },
      { table: 'public.collection', sort: 'vidée', lignes: compte.collection },
      { table: 'public.deck', sort: 'vidée', lignes: compte.deck },
      { table: 'public.comptes', sort: 'gardée', lignes: idsApres.size, supprimees: absents.length },
      { table: 'public.comptes (médaille)', sort: 'attribuée', lignes: compte.medailles }
    ],
    anomalies: [
      ...absents.map((id) => `compte disparu après le reset : ${id}`),
      ...restes.map(([table, n]) => `${table} : ${n} ligne(s) restée(s) après le reset`)
    ]
  };
}

/** Le compte rendu en texte brut, copiable. */
export function texteRapport(rapport) {
  const lignes = ['Reset de la beta — compte rendu'];
  for (const t of rapport.tables) {
    if (t.sort === 'vidée') {
      lignes.push(`  ${t.table.padEnd(26)} : ${t.lignes} ligne(s) supprimée(s)`);
    } else if (t.sort === 'gardée') {
      lignes.push(`  ${t.table.padEnd(26)} : ${t.lignes} ligne(s) conservée(s), ${t.supprimees} supprimée(s)`);
    } else {
      lignes.push(`  ${t.table.padEnd(26)} : ${t.lignes} médaille(s) attribuée(s)`);
    }
  }
  lignes.push(`  (médailles déjà posées avant ce reset : ${rapport.medaillesDejaPosees})`);
  lignes.push(`Non touchés : ${PERIMETRE.intactes.join(', ')}.`);
  for (const anomalie of rapport.anomalies) lignes.push(`ANOMALIE : ${anomalie}`);
  return lignes.join('\n');
}

async function idsDesComptes(adapter) {
  const lu = await adapter.lire(SQL_IDS_COMPTES);
  return new Set(lu.rows.map((ligne) => String(ligne.id)));
}

/**
 * Exécute le reset. `sql` est `SQL_RESET` en production ; un test le remplace par une version
 * mutée pour prouver que le contrôle mord. Rend le compte rendu (objet et texte).
 */
export async function executerReset(adapter, saisie, { sql = SQL_RESET } = {}) {
  verifierConfirmation(saisie);
  const avant = await apercuReset(adapter);
  const idsAvant = await idsDesComptes(adapter);

  const lu = await adapter.ecrire(sql, []);
  const ligne = lu.rows[0] ?? {};
  const compte = {
    combats: Number(ligne.combats ?? 0),
    postits: Number(ligne.postits ?? 0),
    votes: Number(ligne.votes ?? 0),
    commentaires: Number(ligne.commentaires ?? 0),
    collection: Number(ligne.collection ?? 0),
    deck: Number(ligne.deck ?? 0),
    medailles: Number(ligne.medailles ?? 0)
  };

  const apres = await apercuReset(adapter);
  const idsApres = await idsDesComptes(adapter);
  const rapport = composerRapport({ avant, apres, compte, idsAvant, idsApres });
  return { rapport, texte: texteRapport(rapport) };
}
