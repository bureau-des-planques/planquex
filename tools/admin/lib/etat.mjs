/**
 * L'état de l'alpha, lu d'une base par le rôle `lecteur` (#184, D-088).
 *
 * Tout est **calculé** ici, jamais recopié : les comptes par état (dont les approbations en
 * attente), la **sortie d'alpha** (D-123 : les testeurs distincts qui ont terminé une partie),
 * les parties terminées et leur poids moyen, les post-its par statut, et le volume de la base.
 * Les courriels y sont **masqués** — seul un geste explicite (`/api/comptes/:id/courriel`)
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
 * Le seuil de **sortie d'alpha** (D-123) : cinq **testeurs distincts** ayant terminé une partie.
 */
export const SEUIL_SORTIE_ALPHA = 5;

/**
 * La preuve du critère (a) de D-123 : les **auteurs distincts** de `public.combats`,
 * croisés aux comptes **`approuve`**.
 *
 * Trois choix, et chacun se voit dans la requête :
 *
 * - **`distinct` sur l'auteur** : on compte des **personnes**, pas des parties — deux
 *   parties du même testeur font un testeur ;
 * - **la jointure est une jointure interne sur `etat = 'approuve'`** : un compte approuvé
 *   sans partie n'entre pas (aucune ligne de combat), et une partie déposée par un compte
 *   refusé ou en attente n'entre pas non plus ;
 * - **l'identifiant est un uuid**, jamais un courriel ni un pseudo : les traces ne portent
 *   que `auteur = auth.uid()` (D-086), et le poste n'invente pas de nom.
 *
 * Elle est publiée avec le chiffre pour qu'on puisse la rejouer ailleurs (SQL Editor), et
 * c'est **elle** que le test exerce.
 */
export const REQUETE_SORTIE_ALPHA = `select distinct c.auteur::text as testeur
  from public.combats c
  join public.comptes a on a.id = c.auteur
 where a.etat = 'approuve'
 order by testeur`;

/**
 * Le bloc « sortie d'alpha » : le compte, le seuil, l'état, et la liste des testeurs.
 *
 * **Pur** : il reçoit les lignes de la requête (des uuid en texte) et ne lit pas la base.
 * C'est ce qui rend le contrôle mordant possible — deux parties du même auteur donnent `1`.
 */
export function sortieAlpha(testeurs) {
  const liste = [
    ...new Set((Array.isArray(testeurs) ? testeurs : []).map((testeur) => String(testeur ?? '').trim()).filter(Boolean))
  ].sort();
  return {
    seuil: SEUIL_SORTIE_ALPHA,
    testeurs: liste.length,
    atteint: liste.length >= SEUIL_SORTIE_ALPHA,
    liste,
    requete: REQUETE_SORTIE_ALPHA
  };
}

/**
 * L'état complet, en une lecture. `adapter.lire` exécute avec le rôle `lecteur` : si une
 * requête tentait d'écrire, c'est la **base** qui la refuserait, pas ce code.
 */
export async function lireEtat(adapter) {
  const [comptes, partiesLu, postits, volume, sortie] = await Promise.all([
    adapter.lire('select etat, count(*)::int as n from public.comptes group by etat'),
    adapter.lire(
      'select count(*)::int as terminees, coalesce(avg(pg_column_size(c.*)), 0)::float8 as poids_moyen from public.combats c'
    ),
    adapter.lire('select statut, count(*)::int as n from public.postits group by statut'),
    adapter.lire('select pg_database_size(current_database())::float8 as octets'),
    adapter.lire(REQUETE_SORTIE_ALPHA)
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
      poidsMoyen: Math.round(Number(parties.poids_moyen))
    },
    // La **sortie d'alpha** (D-123) : le nombre de testeurs distincts, le seuil, et la liste.
    sortieAlpha: sortieAlpha(sortie.rows.map((ligne) => ligne.testeur)),
    postits: parStatut,
    volumeOctets: Number((volume.rows[0] ?? {}).octets ?? 0)
  };
}
