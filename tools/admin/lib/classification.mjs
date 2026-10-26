/**
 * La classification du SQL libre du poste de pilotage (#184).
 *
 * Une requête est soit **une lecture** — `select`, `explain`, ou `with` sans mot d'écriture —,
 * exécutée avec le rôle `lecteur` (c'est la **base** qui refuse l'écriture, pas le code), soit
 * **une écriture**, exécutée avec le rôle d'administration et refusée sans accusé de réception.
 * Une écriture **destructrice** (`drop`, `truncate`, ou `delete`/`update` sans `where`) exige en
 * plus de taper un mot que le serveur a annoncé.
 *
 * Ces fonctions sont **pures** : pas d'accès à la base, pas de réseau, pas d'état. Elles vivent
 * hors de `src/` (le poste n'importe rien de l'application, D-088 / #183).
 */

/**
 * Les statuts d'un post-it. C'est la même liste que `src/store/mur.ts` (`STATUTS`) et que la
 * contrainte `postits_statut_check` de la migration 0001 : on ne l'importe pas (le poste
 * n'importe rien de l'application), mais la garde `tools/admin/admin.test.ts` **compare** les
 * deux listes pour qu'elles ne divergent jamais en silence.
 */
export const STATUTS = ['en attente', 'retenu', 'en cours', 'fait', 'écarté'];

/** Tout mot qui, présent dans une requête, la fait basculer du côté écriture. */
const MOTS_ECRITURE =
  /\b(insert|update|delete|create|drop|alter|truncate|grant|revoke|merge|copy|vacuum|reindex|refresh|set|reset|begin|commit|rollback|savepoint|release|call|do|analyze|cluster)\b/i;

const MOT_DROP = /\bdrop\b/i;
const MOT_TRUNCATE = /\btruncate\b/i;
const MOT_DELETE = /\bdelete\b/i;
const MOT_UPDATE = /\bupdate\b/i;
const MOT_WHERE = /\bwhere\b/i;

const PREMIER_MOT = /^\s*([a-z_]+)/i;

/**
 * Une écriture non bornée par un `where` (ou un `drop` / `truncate`) part sans prévenir : elle
 * exige un mot de confirmation. `delete from t` et `update t set x = 1` en font partie ;
 * `delete from t where id = …` non.
 */
export function estDestructif(sql) {
  const texte = String(sql ?? '');
  if (MOT_DROP.test(texte) || MOT_TRUNCATE.test(texte)) return true;
  if ((MOT_DELETE.test(texte) || MOT_UPDATE.test(texte)) && !MOT_WHERE.test(texte)) return true;
  return false;
}

/**
 * La nature d'une requête, et seulement sa nature. `select`/`explain` sont des lectures ;
 * `with` est une lecture **si** le corps ne porte aucun mot d'écriture (un `insert` caché dans
 * un CTE est une écriture) ; tout le reste est une écriture.
 */
export function classerSql(sql) {
  const texte = String(sql ?? '').trim();
  if (!texte) {
    const erreur = new Error('la requête est vide');
    erreur.statut = 400;
    erreur.publicMessage = 'la requête est vide';
    throw erreur;
  }
  const premier = (PREMIER_MOT.exec(texte)?.[1] ?? '').toLowerCase();

  let nature;
  if (premier === 'select' || premier === 'explain') {
    nature = 'lecture';
  } else if (premier === 'with') {
    const corps = texte.replace(/^\s*with\b/i, '');
    nature = MOTS_ECRITURE.test(corps) ? 'ecriture' : 'lecture';
  } else {
    nature = 'ecriture';
  }

  return { nature, destructif: nature === 'ecriture' && estDestructif(texte) };
}
