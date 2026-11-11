/**
 * L'état de l'alpha, lu d'une base par le rôle `lecteur` (#184, D-088).
 *
 * Tout est **calculé** ici, jamais recopié : les comptes par état (dont les approbations en
 * attente), la **sortie d'alpha** (D-123, **non mesurable** depuis D-183), les post-its par
 * statut, et le volume de la base. Les courriels y sont **masqués** — seul un geste explicite
 * (`/api/comptes/:id/courriel`) les révèle, et ce geste entre au journal.
 *
 * **Aucune requête ne lit la table des traces** (#738) : la table est supprimée (0030), et la
 * lecture d'état doit répondre avant comme après.
 */

/**
 * Le masquage d'un courriel : le début de la partie locale, puis `***`, puis le domaine.
 * « bastien.dupont@gmail.com » devient « bastie***@gmail.com » ; un courriel dont la partie
 * locale est courte garde au plus six caractères, jamais davantage.
 */
export function masquerCourriel(courriel) {
  const texte = String(courriel ?? '');
  const arobase = texte.indexOf('@');
  if (arobase <= 0) return '***';
  const locale = texte.slice(0, arobase);
  const domaine = texte.slice(arobase);
  return `${locale.slice(0, 6)}***${domaine}`;
}

/**
 * Le seuil de **sortie d'alpha** (D-123) : cinq **testeurs distincts** ayant terminé une partie.
 */
export const SEUIL_SORTIE_ALPHA = 5;

/**
 * Le bloc « sortie d'alpha » : **non mesurable** (D-183 (4)). Le critère (a) de D-123 — cinq
 * testeurs distincts ayant terminé une partie — se lisait dans la table des traces, supprimée avec
 * la trace des combats. Bastien (04/11/2026) : aucune mesure de remplacement pour l'instant ; une
 * décision datée la remplacera à l'approche de la sortie d'alpha.
 *
 * Un état **explicite**, pas un zéro : `mesurable: false`, et ni `testeurs` ni `atteint` ne
 * portent de chiffre (`null`) — « 0 testeur » dirait que personne n'a joué, ce qu'on ignore.
 */
export function sortieAlpha() {
  return {
    seuil: SEUIL_SORTIE_ALPHA,
    mesurable: false,
    testeurs: null,
    atteint: null,
    liste: [],
    raison: 'non mesurable : la trace des combats a été retirée (D-183), aucune mesure de remplacement'
  };
}

/**
 * L'état complet, en une lecture. `adapter.lire` exécute avec le rôle `lecteur` : si une
 * requête tentait d'écrire, c'est la **base** qui la refuserait, pas ce code.
 */
export async function lireEtat(adapter) {
  const [comptes, postits, volume] = await Promise.all([
    adapter.lire('select etat, count(*)::int as n from public.comptes group by etat'),
    adapter.lire('select statut, count(*)::int as n from public.postits group by statut'),
    adapter.lire('select pg_database_size(current_database())::float8 as octets')
  ]);

  const parEtat = {};
  for (const ligne of comptes.rows) parEtat[String(ligne.etat)] = Number(ligne.n);

  const parStatut = {};
  for (const ligne of postits.rows) parStatut[String(ligne.statut)] = Number(ligne.n);

  return {
    comptes: parEtat,
    approbationsEnAttente: Number(parEtat['en attente'] ?? 0),
    // La **sortie d'alpha** (D-123) n'a plus de mesure (D-183) : l'état le dit.
    sortieAlpha: sortieAlpha(),
    postits: parStatut,
    volumeOctets: Number((volume.rows[0] ?? {}).octets ?? 0)
  };
}
