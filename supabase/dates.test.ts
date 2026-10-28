// @vitest-environment node
// Lenteur justifiée (D-143 (5)) — PGlite : les dates figées, et deux cas à migrations mutées
/**
 * Les dates du comité sont posées par le serveur, jamais par un client (#238,
 * migration `0009_commentaires_dates.sql`).
 *
 * Même banc que les autres gardes de la base : les migrations **réelles**, lues sur
 * disque et jouées dans PGlite (PostgreSQL en WASM, RLS comprise), en rôle
 * `authenticated`. Rien n'est recopié de la migration.
 *
 * Le constat de #238 : la 0001 donne `insert` sur **toute** la table `commentaires`
 * (et `postits`), et aucune migration depuis ne retire une colonne de ce droit. Un
 * compte approuvé peut donc fournir `created_at` (commentaire) ou `updated_at`
 * (post-it) **dans le futur**. Or le compteur de D-097 (5) compare ces dates au
 * repère `vu_le` (`compterChosesAVoir`, `src/lib/murBase.ts`) : `marquer_comite_vu()`
 * pose `now()`, une date de 2030 reste après pour toujours, et **la pastille du
 * propriétaire ne retombe plus**.
 *
 * Ce que la base doit tenir, et que ce fichier éprouve :
 *
 *   (a) un commentaire inséré avec `created_at` fourni — dans le futur **ou dans le
 *       passé** (antidater cacherait le commentaire à la pastille, c'est le même
 *       invariant) — est **réécrit** à l'heure du serveur. Écraser, pas refuser :
 *       un client ne peut pas deviner le `now()` de la transaction, donc « refuser
 *       une date différente » reviendrait à refuser toute date fournie — et un
 *       outillage qui réimporte une ligne complète échouerait pour un champ que la
 *       base possède ;
 *   (b) un post-it inséré avec `updated_at` fourni est réécrit de même : à la
 *       création, `updated_at` vaut l'heure du serveur (0008), pas une date client ;
 *   (c) la migration est **idempotente** : rejouée, elle ne lève rien, et la garde
 *       tient encore.
 *
 * **Le contrôle mord** (#112) : chaque déclencheur est neutralisé tour à tour — la
 * 0009 est relue, la ligne qui pose la date est remplacée, puis rejouée — et la
 * date fournie doit alors **rester**, prouvant que la garde pouvait échouer.
 */
import { describe, expect, it } from 'vitest';
import {
  APPAREIL_A,
  APPAREIL_B,
  avecAppareil,
  base,
  creerCompte,
  fichiersMigrations,
  migrations,
  type Base
} from './pglite';

/** La 0009, lue paresseusement : sans elle, les scénarios de comportement doivent échouer **par le fond**. */
function migrationDates(): string {
  const trouvee = fichiersMigrations().find((sql) => sql.includes('commentaires_date_serveur'));
  if (!trouvee) {
    throw new Error('supabase/migrations/0009_commentaires_dates.sql introuvable');
  }
  return trouvee;
}

const FUTUR = '2030-01-01T00:00:00Z';
const PASSE = '2000-01-01T00:00:00Z';

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

/** La date lue est celle du serveur : dans la minute de l'horloge du test, jamais celle fournie. */
function estHeureDuServeur(date: unknown) {
  const t = new Date(date as string).getTime();
  expect(Number.isFinite(t), `date illisible : ${String(date)}`).toBe(true);
  expect(Math.abs(t - Date.now())).toBeLessThan(60_000);
}

/** La date fournie est **restée** : le geste fautif a passé (attendu seulement sur base mutée). */
function estHeureDuClient(date: unknown, fournie: string) {
  expect(new Date(date as string).getTime()).toBe(new Date(fournie).getTime());
}

/** B commente le post-it de A, avec une date de son choix — le geste de #238. */
const commenterDate = (db: Base, appareil: string, postit: string, date: string) =>
  tenter(
    db,
    appareil,
    `insert into public.commentaires (postit_id, texte, created_at)
     values ($1, 'Pareil chez moi.', $2) returning created_at`,
    [postit, date]
  );

/** A colle un post-it en datant son `updated_at` — la même porte, côté compteur des mouvements. */
const collerDate = (db: Base, appareil: string, id: string, date: string) =>
  tenter(
    db,
    appareil,
    `insert into public.postits (id, kind, titre, texte, version, updated_at)
     values ($1, 'IP', 'Titre', 'Texte.', 'Alpha · 0.1.12', $2) returning updated_at`,
    [id, date]
  );

/** A et B approuvés ; A a un post-it, c'est lui que B menace d'une date fausse. */
async function monde(db: Base) {
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
  accepte(
    await tenter(
      db,
      APPAREIL_A,
      `insert into public.postits (id, kind, titre, texte, version)
       values ('p-a', 'IP', 'Titre', 'Texte.', 'Alpha · 0.1.12') returning id`
    )
  );
}

describe('les dates sont posées par le serveur (0009)', () => {
  it('(a) un commentaire daté de 2030 est réécrit à l’heure du serveur', async () => {
    const db = await base();
    try {
      await monde(db);
      const issue = await commenterDate(db, APPAREIL_B, 'p-a', FUTUR);
      accepte(issue);
      if (issue.accepte) estHeureDuServeur(issue.lignes[0].created_at);
    } finally {
      await db.close();
    }
  });

  it('(a) un commentaire antidaté est réécrit de même : cacher à la pastille est le même invariant', async () => {
    const db = await base();
    try {
      await monde(db);
      const issue = await commenterDate(db, APPAREIL_B, 'p-a', PASSE);
      accepte(issue);
      if (issue.accepte) estHeureDuServeur(issue.lignes[0].created_at);
    } finally {
      await db.close();
    }
  });

  it('(a) un commentaire sans date fournie est daté par le serveur, comme avant', async () => {
    const db = await base();
    try {
      await monde(db);
      const issue = await tenter(
        db,
        APPAREIL_B,
        `insert into public.commentaires (postit_id, texte) values ('p-a', 'Pareil.') returning created_at`
      );
      accepte(issue);
      if (issue.accepte) estHeureDuServeur(issue.lignes[0].created_at);
    } finally {
      await db.close();
    }
  });

  it('(b) un post-it collé avec un updated_at de 2030 est réécrit à l’heure du serveur', async () => {
    const db = await base();
    try {
      await monde(db);
      const issue = await collerDate(db, APPAREIL_A, 'p-futur', FUTUR);
      accepte(issue);
      if (issue.accepte) estHeureDuServeur(issue.lignes[0].updated_at);
    } finally {
      await db.close();
    }
  });

  it('(c) la migration est idempotente : rejouée, elle ne lève rien et la garde tient', async () => {
    const db = await base();
    try {
      await monde(db);
      await db.exec(migrationDates());
      const issue = await commenterDate(db, APPAREIL_B, 'p-a', FUTUR);
      accepte(issue);
      if (issue.accepte) estHeureDuServeur(issue.lignes[0].created_at);
    } finally {
      await db.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Le contrôle mord : chaque déclencheur neutralisé laisse passer la date du client
// ---------------------------------------------------------------------------------------------

/** Remplace un motif de la 0009 ; un motif absent fait échouer. */
function muter(motif: string, remplacement: string): string {
  const migration = migrationDates();
  expect(migration.split(motif).length - 1, `motif introuvable ou ambigu : ${motif}`).toBeGreaterThan(0);
  const mutee = migration.replaceAll(motif, remplacement);
  expect(mutee).not.toBe(migration);
  return migrations().replace(migration, () => mutee);
}

const MUTATIONS: Array<{
  nom: string;
  sql: () => string;
  geste: (db: Base) => Promise<unknown>;
}> = [
  {
    nom: '(a) déclencheur des commentaires neutralisé → la date de 2030 reste',
    sql: () => muter(`  new.created_at := now();`, `  new.created_at := new.created_at;`),
    geste: async (db) => {
      const issue = await commenterDate(db, APPAREIL_B, 'p-a', FUTUR);
      accepte(issue);
      return issue.accepte ? issue.lignes[0].created_at : null;
    }
  },
  {
    nom: '(b) déclencheur des post-its neutralisé → l’updated_at de 2030 reste',
    sql: () => muter(`  new.updated_at := now();`, `  new.updated_at := new.updated_at;`),
    geste: async (db) => {
      const issue = await collerDate(db, APPAREIL_A, 'p-futur', FUTUR);
      accepte(issue);
      return issue.accepte ? issue.lignes[0].updated_at : null;
    }
  }
];

describe('le contrôle mord — neutralisé, le fautif passe', () => {
  for (const m of MUTATIONS) {
    it(
      m.nom,
      async () => {
        const db = await base(m.sql());
        try {
          await monde(db);
          estHeureDuClient(await m.geste(db), FUTUR);
        } finally {
          await db.close();
        }
      },
      90_000
    );
  }
});

describe('sur la vraie base, le comportement attendu tient', () => {
  it('les deux gestes repartent à l’heure du serveur', async () => {
    for (const m of MUTATIONS) {
      const db = await base();
      try {
        await monde(db);
        estHeureDuServeur(await m.geste(db));
      } finally {
        await db.close();
      }
    }
  }, 90_000);
});

// ---------------------------------------------------------------------------------------------
// #244 — le chemin par `update` : `created_at` ne se redate pas (migration 0010)
// ---------------------------------------------------------------------------------------------

/** La 0010, lue paresseusement. */
function migrationFigee(): string {
  const trouvee = fichiersMigrations().find((sql) => sql.includes('dates_figees'));
  if (!trouvee) throw new Error('supabase/migrations/0010_dates_figees.sql introuvable');
  return trouvee;
}

/** B commente le post-it de A (date du serveur), puis l'on lit la date posée. */
async function commentaireDeB(db: Base): Promise<{ id: string; cree: string }> {
  const issue = await tenter(
    db,
    APPAREIL_B,
    `insert into public.commentaires (postit_id, texte) values ('p-a', 'Pareil chez moi.')
     returning id, created_at::text as created_at`
  );
  accepte(issue);
  if (!issue.accepte) throw new Error('commentaire non créé');
  return { id: String(issue.lignes[0].id), cree: String(issue.lignes[0].created_at) };
}

/** L'auteur redate son propre commentaire — le geste de #244. */
const redaterCommentaire = (db: Base, id: string, date: string) =>
  tenter(
    db,
    APPAREIL_B,
    `update public.commentaires set created_at = $2 where id = $1 returning created_at::text as created_at`,
    [id, date]
  );

describe('created_at ne se redate pas par un update (0010, #244)', () => {
  it('l’auteur d’un commentaire qui écrit created_at = 2030 ne l’obtient pas', async () => {
    const db = await base();
    try {
      await monde(db);
      const { id, cree } = await commentaireDeB(db);
      const issue = await redaterCommentaire(db, id, FUTUR);
      accepte(issue);
      if (issue.accepte) {
        expect(issue.lignes[0].created_at).toBe(cree);
        estHeureDuServeur(issue.lignes[0].created_at);
      }
    } finally {
      await db.close();
    }
  });

  it('antidater par un update est rétabli de même', async () => {
    const db = await base();
    try {
      await monde(db);
      const { id, cree } = await commentaireDeB(db);
      const issue = await redaterCommentaire(db, id, PASSE);
      accepte(issue);
      if (issue.accepte) {
        expect(issue.lignes[0].created_at).toBe(cree);
      }
    } finally {
      await db.close();
    }
  });

  it('corriger le texte de son commentaire fonctionne toujours, et la date reste', async () => {
    const db = await base();
    try {
      await monde(db);
      const { id, cree } = await commentaireDeB(db);
      const issue = await tenter(
        db,
        APPAREIL_B,
        `update public.commentaires set texte = 'Corrigé.', created_at = $2
          where id = $1 returning texte, created_at::text as created_at`,
        [id, FUTUR]
      );
      accepte(issue);
      if (issue.accepte) {
        expect(issue.lignes).toHaveLength(1);
        expect(issue.lignes[0].texte).toBe('Corrigé.');
        expect(issue.lignes[0].created_at).toBe(cree);
      }
    } finally {
      await db.close();
    }
  });

  it('un post-it : created_at est rétabli par la base, même hors du grant de colonnes', async () => {
    // Le client n'a plus l'`update` de `created_at` sur `postits` (0006) : le déclencheur est
    // une ceinture. On le joue donc en propriétaire de la table, qui, lui, le peut.
    const db = await base();
    try {
      await monde(db);
      const avant = await db.query<{ created_at: string }>(
        `select created_at::text as created_at from public.postits where id = 'p-a'`
      );
      const res = await db.query<{ created_at: string }>(
        `update public.postits set created_at = $1 where id = 'p-a' returning created_at::text as created_at`,
        [FUTUR]
      );
      expect(res.rows[0].created_at).toBe(avant.rows[0].created_at);
    } finally {
      await db.close();
    }
  });

  it('la migration est idempotente : rejouée, elle ne lève rien et la garde tient', async () => {
    const db = await base();
    try {
      await monde(db);
      await db.exec(migrationFigee());
      const { id, cree } = await commentaireDeB(db);
      const issue = await redaterCommentaire(db, id, FUTUR);
      accepte(issue);
      if (issue.accepte) {
        expect(issue.lignes[0].created_at).toBe(cree);
      }
    } finally {
      await db.close();
    }
  });
});

describe('le contrôle mord — 0010 neutralisée, la redatation passe', () => {
  /** Chaque déclencheur est neutralisé seul : la ligne qui rétablit la date est remplacée. */
  const mutee = (fonction: string) => {
    const migration = migrationFigee();
    const motif = `  new.created_at := old.created_at; -- ${fonction}`;
    expect(migration.split(motif).length - 1, `motif introuvable : ${motif}`).toBe(1);
    return migrations().replace(migration, () => migration.replace(motif, '  new.created_at := new.created_at;'));
  };

  it('commentaires : déclencheur neutralisé → created_at = 2030 passe', async () => {
    const db = await base(mutee('commentaires'));
    try {
      await monde(db);
      const { id } = await commentaireDeB(db);
      const issue = await redaterCommentaire(db, id, FUTUR);
      accepte(issue);
      if (issue.accepte) estHeureDuClient(issue.lignes[0].created_at, FUTUR);
    } finally {
      await db.close();
    }
  }, 90_000);

  it('postits : déclencheur neutralisé → created_at = 2030 passe', async () => {
    const db = await base(mutee('postits'));
    try {
      await monde(db);
      const res = await db.query<{ created_at: string }>(
        `update public.postits set created_at = $1 where id = 'p-a' returning created_at`,
        [FUTUR]
      );
      estHeureDuClient(res.rows[0].created_at, FUTUR);
    } finally {
      await db.close();
    }
  }, 90_000);
});
