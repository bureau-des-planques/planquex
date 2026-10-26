/**
 * L'accès à la base du poste de pilotage (#184) — l'**interface étroite** que les tests injectent.
 *
 * Un accès, c'est **deux fonctions**, rien d'autre :
 *
 *   - `lire(sql, params)`  : lecture, exécutée avec le rôle `lecteur` (la base refuse l'écriture) ;
 *   - `ecrire(sql, params)` : écriture, exécutée avec le rôle d'administration (`postgres`).
 *
 * Le poste ne parle **jamais** au client Postgres directement : il ne connaît que cette
 * interface. En production, `creerAccesPg` la réalise avec deux connexions au **pooler**
 * (`sslmode=require`), les chaînes venant des secrets. En test, `adaptateurPglite` (dans
 * `tools/admin/admin.test.ts`) la réalise avec `@electric-sql/pglite`, sans réseau.
 *
 * La forme rendue est la même dans les deux mondes : `{ rows, command, instructions }`.
 */
import { Client } from 'pg';

/**
 * Le gestionnaire de la connexion réelle, par le pooler. C'est le **seul** endroit qui touche
 * au package `pg` (dépendance de développement, jamais dans le bundle Vite). `demarrer` ouvre
 * les deux connexions ; `fermer` les relâche.
 *
 * Ceci n'est **pas** parcouru par les tests (ils injectent `pglite`, hors réseau) : voir le
 * rapport du ticket pour ce qui reste non vérifié.
 */
export function creerAccesPg({ lecteur_url, admin_url }) {
  let lecteurClient = null;
  let adminClient = null;

  /** `pg` rend un tableau pour une requête multi-instructions, un objet sinon. */
  function normaliser(resultat) {
    if (Array.isArray(resultat)) {
      return { rows: [], command: null, instructions: resultat.length };
    }
    return {
      rows: resultat.rows ?? [],
      command: resultat.command ?? null,
      instructions: 1
    };
  }

  return {
    async demarrer() {
      lecteurClient = new Client({ connectionString: lecteur_url });
      adminClient = new Client({ connectionString: admin_url });
      await lecteurClient.connect();
      await adminClient.connect();
    },
    async lire(sql, params) {
      return normaliser(await lecteurClient.query(sql, params));
    },
    async ecrire(sql, params) {
      return normaliser(await adminClient.query(sql, params));
    },
    async fermer() {
      await lecteurClient?.end();
      await adminClient?.end();
    }
  };
}
