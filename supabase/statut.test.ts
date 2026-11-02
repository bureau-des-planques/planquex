// @vitest-environment node
// Lent : un cas par scénario, chacun avec son SQL ; `base()` reprend une instance PGlite vidée au lieu de la remonter (D-143 (4), #422) — il reste le travail SQL, pas la règle testée.
/**
 * Le statut d'un post-it naît « en attente », quoi qu'écrive le client (#552).
 *
 * Le constat : la 0001 donne `insert` sur **toute** la table `postits` au rôle
 * `authenticated`, et la politique d'insertion ne vérifie **que** l'auteur
 * (`0001_mur.sql`, `with check (auteur = auth.uid())`). La colonne a bien son
 * `default 'en attente'` et sa contrainte de valeurs, mais **rien ne force** le
 * statut : un client modifié peut coller un post-it déjà `retenu`, `fait` ou
 * `écarté`. Le tri est un geste du comité (D-059) ; le statut ne se choisit pas à
 * l'insertion.
 *
 * Ce que la base doit tenir, et que ce fichier éprouve :
 *
 *   (a) un post-it inséré par un compte **approuvé** avec `statut: 'fait'` (ou
 *       `retenu`, ou `écarté` avec sa raison) arrive en base **en attente** ;
 *   (b) un post-it inséré sans `statut` reste `en attente` — le geste normal du
 *       client ne change pas ;
 *   (c) le déclencheur ne vise que l'insertion : un administrateur **trie**
 *       toujours par `update`, et le statut demandé reste ;
 *   (d) la migration est **idempotente** : rejouée, elle ne lève rien et la garde
 *       tient.
 *
 * **Le contrôle mord** (#112) : la migration est relue, la ligne qui pose le
 * statut est neutralisée, puis rejouée — le `fait` du client doit alors **rester**,
 * prouvant que la garde pouvait échouer.
 */
import { describe, expect, it } from 'vitest';
import {
  ADMIN,
  APPAREIL_A,
  avecAppareil,
  base,
  creerCompte,
  fichiersMigrations,
  migrations,
  type Base
} from './pglite';

/** La migration du statut, lue paresseusement : sans elle, les scénarios doivent échouer **par le fond**. */
function migrationStatut(): string {
  const trouvee = fichiersMigrations().find((sql) => sql.includes('postits_statut_a_l_insertion'));
  if (!trouvee) {
    throw new Error('la migration du statut d’insertion (#552) est introuvable');
  }
  return trouvee;
}

type Issue = { accepte: true; lignes: Array<Record<string, unknown>> } | { accepte: false; message: string };

async function tenter(db: Base, appareil: string, sql: string, params: unknown[] = []): Promise<Issue> {
  try {
    const res = await avecAppareil(db, appareil, () => db.query<Record<string, unknown>>(sql, params));
    return { accepte: true, lignes: res.rows };
  } catch (erreur) {
    return { accepte: false, message: erreur instanceof Error ? erreur.message : String(erreur) };
  }
}

const accepte = (issue: Issue) => {
  expect(issue.accepte, issue.accepte ? '' : (issue as { message: string }).message).toBe(true);
};

/** A colle un post-it en choisissant son statut — le geste d'un client modifié. */
const collerAvecStatut = (db: Base, id: string, statut: string, raison = '') =>
  tenter(
    db,
    APPAREIL_A,
    `insert into public.postits (id, kind, titre, texte, version, statut, raison)
     values ($1, 'IP', 'Titre', 'Texte.', 'Alpha · 0.1.12', $2, $3) returning statut, raison`,
    [id, statut, raison]
  );

/** Un compte approuvé, et un administrateur pour les scénarios de tri. */
async function monde(db: Base) {
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, ADMIN, { etat: 'approuve', administrateur: true });
}

describe('le statut d’un post-it est posé par la base (#552)', () => {
  it('(a) un client approuvé qui colle un post-it « fait » obtient « en attente »', async () => {
    const db = await base();
    try {
      await monde(db);
      const issue = await collerAvecStatut(db, 'p-fait', 'fait');
      accepte(issue);
      if (issue.accepte) expect(issue.lignes[0].statut).toBe('en attente');
    } finally {
      await db.close();
    }
  });

  it('(a) « retenu » ne passe pas non plus', async () => {
    const db = await base();
    try {
      await monde(db);
      const issue = await collerAvecStatut(db, 'p-retenu', 'retenu');
      accepte(issue);
      if (issue.accepte) expect(issue.lignes[0].statut).toBe('en attente');
    } finally {
      await db.close();
    }
  });

  it('(a) « écarté » avec sa raison est ramené à « en attente » : la raison ne fait pas le tri', async () => {
    const db = await base();
    try {
      await monde(db);
      const issue = await collerAvecStatut(db, 'p-ecarte', 'écarté', 'Hors périmètre.');
      accepte(issue);
      if (issue.accepte) {
        expect(issue.lignes[0].statut).toBe('en attente');
        // La contrainte de la 0001 reste tenue : un « écarté » sans raison est refusé,
        // et un « en attente » n'a pas à en porter une.
        const relu = await db.query<{ statut: string }>(`select statut from public.postits where id = 'p-ecarte'`);
        expect(relu.rows[0].statut).toBe('en attente');
      }
    } finally {
      await db.close();
    }
  });

  it('(b) le geste normal — sans statut — donne toujours « en attente »', async () => {
    const db = await base();
    try {
      await monde(db);
      const issue = await tenter(
        db,
        APPAREIL_A,
        `insert into public.postits (id, kind, titre, texte, version)
         values ('p-normal', 'IP', 'Titre', 'Texte.', 'Alpha · 0.1.12') returning statut`
      );
      accepte(issue);
      if (issue.accepte) expect(issue.lignes[0].statut).toBe('en attente');
    } finally {
      await db.close();
    }
  });

  it('(c) l’administrateur trie toujours par un update : le déclencheur ne vise que l’insertion', async () => {
    const db = await base();
    try {
      await monde(db);
      await collerAvecStatut(db, 'p-a-trier', 'en attente');
      const issue = await tenter(
        db,
        ADMIN,
        `update public.postits set statut = 'fait' where id = 'p-a-trier' returning statut`
      );
      accepte(issue);
      if (issue.accepte) expect(issue.lignes[0].statut).toBe('fait');
    } finally {
      await db.close();
    }
  });

  it('(d) la migration est idempotente : rejouée, elle ne lève rien et la garde tient', async () => {
    const db = await base();
    try {
      await monde(db);
      await db.exec(migrationStatut());
      const issue = await collerAvecStatut(db, 'p-fait', 'fait');
      accepte(issue);
      if (issue.accepte) expect(issue.lignes[0].statut).toBe('en attente');
    } finally {
      await db.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Le contrôle mord : le déclencheur neutralisé laisse passer le statut du client
// ---------------------------------------------------------------------------------------------

/** Remplace le geste de la migration ; le motif absent fait échouer. */
function migrerSansGarde(): string {
  const migration = migrationStatut();
  const motif = `  new.statut := 'en attente';`;
  expect(migration.split(motif).length - 1, `motif introuvable ou ambigu : ${motif}`).toBe(1);
  return migrations().replace(migration, () => migration.replace(motif, '  -- neutralisé par le test'));
}

describe('le contrôle mord — déclencheur neutralisé, le statut du client passe', () => {
  it('un « fait » inséré par le client reste « fait »', async () => {
    const db = await base(migrerSansGarde());
    try {
      await monde(db);
      const issue = await collerAvecStatut(db, 'p-fait', 'fait');
      accepte(issue);
      if (issue.accepte) expect(issue.lignes[0].statut).toBe('fait');
    } finally {
      await db.close();
    }
  }, 90_000);
});
