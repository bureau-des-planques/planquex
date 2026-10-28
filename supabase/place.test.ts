// @vitest-environment node
// Lenteur justifiée (D-143 (5)) — PGlite : la Place et le retrait d'administration, un cas muté
/**
 * La place des post-its, et le retrait d'administration (#185, #186, migration
 * `0007_place_et_retrait_admin.sql`).
 *
 * Même banc que `mur-ecriture.test.ts` : les migrations **réelles**, lues sur disque et
 * jouées dans PGlite (PostgreSQL en WASM, RLS comprise), en rôle `authenticated`. Rien n'est
 * recopié de la migration.
 *
 * Ce que la base doit tenir, et que ce fichier éprouve :
 *
 *   (a) l'**auteur** approuvé déplace son post-it, et **seulement** le sien ;
 *   (b) l'**administrateur** déplace **n'importe quel** post-it — c'est ce qui manquait
 *       depuis que la 0006 a retiré la politique d'`update` de l'auteur ;
 *   (c) un compte **en attente** ne déplace rien, même son post-it (D-088) ;
 *   (d) l'**administrateur** retire n'importe quel post-it, **à n'importe quel statut** ;
 *       un non-administrateur n'efface pas celui d'un autre, et l'auteur reste borné à
 *       « en attente » (0006) ;
 *   (e) **rien ne s'est élargi en douce** : `update ... set position_x` en direct reste
 *       refusé (le grant de la 0006 ne bouge pas), et un auteur ne se trie toujours pas
 *       lui-même (D-059). Sans ces deux gardes, rendre la place écrivable au rôle
 *       `authenticated` aurait rouvert le tri aux posteurs.
 *
 * **Le contrôle mord** (#112) : chaque contrôle est neutralisé tour à tour — la 0007 est
 * relue, un motif précis est remplacé, puis rejouée — et le geste fautif doit alors donner
 * l'issue **inverse**. Les motifs sont des ancres : si la migration change de forme, la
 * mutation échoue bruyamment au lieu de se décaler en silence.
 */
import { describe, expect, it } from 'vitest';
import {
  ADMIN,
  APPAREIL_A,
  APPAREIL_B,
  APPAREIL_C,
  avecAppareil,
  base,
  creerCompte,
  fichiersMigrations,
  migrations,
  type Base
} from './pglite';

const MIGRATION_PLACE = fichiersMigrations().find((sql) => sql.includes('deplacer_postit'));
if (!MIGRATION_PLACE) {
  throw new Error('supabase/migrations/0007_place_et_retrait_admin.sql introuvable');
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

const refuse = (issue: Issue, motif: RegExp) => {
  expect(issue.accepte, 'le geste aurait dû être refusé').toBe(false);
  if (!issue.accepte) expect(issue.message).toMatch(motif);
};
const accepte = (issue: Issue) => {
  expect(issue.accepte, issue.accepte ? '' : (issue as { message: string }).message).toBe(true);
};
/** Une modification/suppression refusée par RLS rend 0 ligne **sans** erreur. */
const zeroLigne = (issue: Issue) => {
  accepte(issue);
  if (issue.accepte) expect(issue.lignes).toHaveLength(0);
};

const coller = (db: Base, appareil: string, id: string) =>
  tenter(
    db,
    appareil,
    `insert into public.postits (id, kind, titre, texte, version)
     values ($1, 'IP', 'Titre', 'Texte.', 'Alpha · 0.1.9') returning *`,
    [id]
  );

/** Le déplacement passe par la fonction : c'est elle qui porte la règle de #185/#186. */
const deplacer = (db: Base, appareil: string, postit: string, x = 40, y = 30, angle = 1) =>
  tenter(db, appareil, `select * from public.deplacer_postit($1, $2, $3, $4)`, [postit, x, y, angle]);

const retirer = (db: Base, appareil: string, postit: string) =>
  tenter(db, appareil, `delete from public.postits where id = $1 returning *`, [postit]);

const place = async (db: Base, id: string) =>
  (
    await avecAppareil(db, APPAREIL_A, () =>
      db.query<{ position_x: number; position_y: number; position_angle: number }>(
        `select position_x, position_y, position_angle from public.postits where id = $1`,
        [id]
      )
    )
  ).rows[0];

/**
 * Un post-it à **C**, qui reste `en attente` : on le colle approuvé (la base refuse
 * l'insertion d'un compte en attente, D-088), puis on le remet en attente. C'est le seul
 * chemin réel — l'insertion d'un post-it au nom d'un autre est refusée par la 0005.
 */
async function postitDeC(db: Base) {
  await creerCompte(db, APPAREIL_C, { etat: 'approuve' });
  accepte(await coller(db, APPAREIL_C, 'p-c'));
  await creerCompte(db, APPAREIL_C, { etat: 'en attente' });
}

/** A et B approuvés, C **en attente**, un administrateur ; A et B ont chacun un post-it. */
async function monde(db: Base) {
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_C, { etat: 'en attente' });
  await creerCompte(db, ADMIN, { etat: 'approuve', administrateur: true });
  accepte(await coller(db, APPAREIL_A, 'p-a'));
  accepte(await coller(db, APPAREIL_B, 'p-b'));
}

describe('ranger un post-it (0007)', () => {
  it('(a) l’auteur déplace le sien, et la place est enregistrée, arrondie au dixième', async () => {
    const db = await base();
    try {
      await monde(db);
      const issue = await deplacer(db, APPAREIL_A, 'p-a', 40.26, 30.04, -1.24);
      accepte(issue);

      const relu = await place(db, 'p-a');
      expect(relu).toEqual({ position_x: 40.3, position_y: 30, position_angle: -1.2 });
    } finally {
      await db.close();
    }
  });

  it('(a) on ne range pas le post-it d’un autre — la fonction le dit', async () => {
    const db = await base();
    try {
      await monde(db);
      refuse(await deplacer(db, APPAREIL_B, 'p-a'), /postit_deplace_refuse/);

      // Rien n'a bougé : le refus n'est pas une écriture silencieuse.
      const relu = await place(db, 'p-a');
      expect(relu.position_x).not.toBe(40);
    } finally {
      await db.close();
    }
  });

  it('(b) l’administrateur range le post-it d’un autre', async () => {
    const db = await base();
    try {
      await monde(db);
      accepte(await deplacer(db, ADMIN, 'p-a', 12, 34, 2));

      expect(await place(db, 'p-a')).toEqual({
        position_x: 12,
        position_y: 34,
        position_angle: 2
      });
    } finally {
      await db.close();
    }
  });

  it('(c) un compte en attente ne range rien, même son propre post-it (D-088)', async () => {
    const db = await base();
    try {
      await monde(db);
      await postitDeC(db);
      refuse(await deplacer(db, APPAREIL_C, 'p-c'), /postit_deplace_refuse/);
    } finally {
      await db.close();
    }
  });

  it('(e) une place hors bornes est refusée avant d’atteindre la contrainte de la table', async () => {
    const db = await base();
    try {
      await monde(db);
      refuse(await deplacer(db, APPAREIL_A, 'p-a', -1, 30, 0), /postit_deplace_hors_bornes/);
      refuse(await deplacer(db, APPAREIL_A, 'p-a', 30, 101, 0), /postit_deplace_hors_bornes/);
      refuse(await deplacer(db, APPAREIL_A, 'p-a', 30, 30, 9), /postit_deplace_hors_bornes/);
      refuse(await deplacer(db, APPAREIL_A, 'p-inconnu'), /postit_deplace_inconnu/);
    } finally {
      await db.close();
    }
  });

  it('(e) l’update direct de la place reste refusé : le grant de la 0006 n’a pas bougé', async () => {
    const db = await base();
    try {
      await monde(db);
      // C'est la garde du choix : pas de `grant` élargi, sinon l'auteur retrouverait aussi
      // `statut` (une politique RLS ne distingue pas les colonnes).
      refuse(
        await tenter(db, APPAREIL_A, `update public.postits set position_x = 50 where id = 'p-a'`),
        /permission denied/
      );
      // Et le tri reste hors de portée de l'auteur (D-059).
      zeroLigne(await tenter(db, APPAREIL_A, `update public.postits set statut = 'retenu' where id = 'p-a'`));
    } finally {
      await db.close();
    }
  });
});

describe('retirer un post-it (0007)', () => {
  it('(d) l’administrateur retire le post-it d’un autre, à n’importe quel statut', async () => {
    const db = await base();
    try {
      await monde(db);
      // Un post-it déjà trié : l'auteur ne peut plus le retirer, l'administration si.
      accepte(await tenter(db, ADMIN, `update public.postits set statut = 'retenu' where id = 'p-b'`));

      const issue = await retirer(db, ADMIN, 'p-b');
      accepte(issue);
      if (issue.accepte) expect(issue.lignes).toHaveLength(1);

      const reste = await avecAppareil(db, APPAREIL_A, () =>
        db.query(`select id from public.postits where id = 'p-b'`)
      );
      expect(reste.rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it('(d) un non-administrateur n’efface pas le post-it d’un autre, même en attente', async () => {
    const db = await base();
    try {
      await monde(db);
      zeroLigne(await retirer(db, APPAREIL_B, 'p-a'));
      // Et l'auteur reste borné à « en attente » (0006).
      accepte(await tenter(db, ADMIN, `update public.postits set statut = 'retenu' where id = 'p-a'`));
      zeroLigne(await retirer(db, APPAREIL_A, 'p-a'));
    } finally {
      await db.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Le contrôle mord : chaque contrôle neutralisé laisse passer le fautif
// ---------------------------------------------------------------------------------------------

/** Remplace un motif de la 0007 ; un motif absent fait échouer. */
function muter(motif: string, remplacement: string): string {
  expect(MIGRATION_PLACE!.split(motif).length - 1, `motif introuvable ou ambigu : ${motif}`).toBeGreaterThan(0);
  const mutee = MIGRATION_PLACE!.replaceAll(motif, remplacement);
  expect(mutee).not.toBe(MIGRATION_PLACE);
  return migrations().replace(MIGRATION_PLACE!, () => mutee);
}

const MUTATIONS: Array<{
  nom: string;
  sql: () => string;
  geste: (db: Base) => Promise<Issue>;
  attendu: 'accepte' | 'refuse';
}> = [
  {
    nom: '(a) fonction sans le garde d’auteur → n’importe qui range le post-it d’un autre',
    sql: () =>
      muter('if deplace.auteur is distinct from auth.uid() and not public.est_administrateur() then', 'if false then'),
    geste: (db) => deplacer(db, APPAREIL_B, 'p-a'),
    attendu: 'accepte'
  },
  {
    nom: '(c) fonction sans le contrôle d’approbation → un compte en attente range le sien',
    sql: () => muter('if not public.compte_approuve() then', 'if false then'),
    geste: async (db) => {
      await postitDeC(db);
      return deplacer(db, APPAREIL_C, 'p-c');
    },
    attendu: 'accepte'
  },
  {
    nom: '(d) politique d’administration ouverte à tous → n’importe qui efface le post-it d’un autre',
    sql: () =>
      muter(
        `create policy "postits : l'administration retire"
  on public.postits for delete to authenticated
  using (public.est_administrateur());`,
        `create policy "postits : l'administration retire"
  on public.postits for delete to authenticated
  using (true);`
      ),
    geste: (db) => retirer(db, APPAREIL_B, 'p-a'),
    attendu: 'accepte'
  }
];

/** Un refus rendu tantôt par la fonction, tantôt par la RLS (0 ligne) — les deux comptent. */
async function gesteReel(m: (typeof MUTATIONS)[number], db: Base): Promise<Issue> {
  const issue = await m.geste(db);
  if (issue.accepte && issue.lignes.length === 0) {
    return { accepte: false, message: '0 ligne touchée (la RLS a filtré le geste)' };
  }
  return issue;
}

describe('sur la vraie base, chaque geste fautif est refusé', () => {
  it('les trois gestes', async () => {
    for (const m of MUTATIONS) {
      const db = await base();
      try {
        await monde(db);
        const issue = await gesteReel(m, db);
        expect(issue.accepte, m.nom).toBe(false);
      } finally {
        await db.close();
      }
    }
  }, 90_000);
});

describe('le contrôle mord — neutralisé, chaque geste passe', () => {
  for (const m of MUTATIONS) {
    it(m.nom, async () => {
      const db = await base(m.sql());
      try {
        await monde(db);
        const issue = await gesteReel(m, db);
        expect(issue.accepte).toBe(m.attendu === 'accepte');
      } finally {
        await db.close();
      }
    });
  }
});

describe('la migration 0007 est idempotente', () => {
  it('rejouée, elle ne lève rien et ne change aucun droit', async () => {
    const db = await base();
    try {
      await monde(db);
      accepte(await deplacer(db, ADMIN, 'p-a', 20, 20, 0));
      await db.exec(MIGRATION_PLACE!);

      expect(await place(db, 'p-a')).toEqual({
        position_x: 20,
        position_y: 20,
        position_angle: 0
      });
      // Les droits n'ont pas bougé : la place passe toujours par la fonction, jamais en direct.
      refuse(
        await tenter(db, APPAREIL_A, `update public.postits set position_x = 50 where id = 'p-a'`),
        /permission denied/
      );
      accepte(await deplacer(db, APPAREIL_A, 'p-a', 30, 30, 1));
    } finally {
      await db.close();
    }
  }, 30_000);
});
