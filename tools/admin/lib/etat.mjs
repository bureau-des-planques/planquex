/**
 * L'état de l'alpha, lu d'une base par le rôle `lecteur` (#184, D-088).
 *
 * Tout est **calculé** ici, jamais recopié : les comptes par état (dont les approbations en
 * attente), les parties terminées et leur poids moyen, les post-its par statut, et le volume de
 * la base. Les courriels y sont **masqués** — seul un geste explicite (`/api/comptes/:id/courriel`)
 * les révèle, et ce geste entre au journal.
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
 * L'état complet, en une lecture. `adapter.lire` exécute avec le rôle `lecteur` : si une
 * requête tentait d'écrire, c'est la **base** qui la refuserait, pas ce code.
 */
export async function lireEtat(adapter) {
  const [comptes, partiesLu, postits, volume] = await Promise.all([
    adapter.lire('select etat, count(*)::int as n from public.comptes group by etat'),
    adapter.lire(
      'select count(*)::int as terminees, coalesce(avg(pg_column_size(c.*)), 0)::float8 as poids_moyen from public.combats c',
    ),
    adapter.lire('select statut, count(*)::int as n from public.postits group by statut'),
    adapter.lire('select pg_database_size(current_database())::float8 as octets'),
  ]);

  const parEtat = {};
  for (const ligne of comptes.rows) parEtat[String(ligne.etat)] = Number(ligne.n);

  const parStatut = {};
  for (const ligne of postits.rows) parStatut[String(ligne.statut)] = Number(ligne.n);

  const parties = partiesLu.rows[0] ?? { terminees: 0, poids_moyen: 0 };

  return {
    comptes: parEtat,
    approbationsEnAttente: Number(parEtat['en attente'] ?? 0),
    parties: {
      terminees: Number(parties.terminees),
      poidsMoyen: Math.round(Number(parties.poids_moyen)),
    },
    postits: parStatut,
    volumeOctets: Number((volume.rows[0] ?? {}).octets ?? 0),
  };
}