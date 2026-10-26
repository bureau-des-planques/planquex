// @vitest-environment node
/**
 * Le repère du comité — `updated_at`, `vu_le` et `marquer_comite_vu()` (#209, D-097 (5),
 * migration `0008_comite.sql`).
 *
 * Même banc que les autres gardes de la base : les migrations **réelles**, lues sur disque et
 * jouées dans PGlite (PostgreSQL en WASM, RLS comprise), en rôle `authenticated`. Rien n'est
 * recopié de la migration.
 *
 * Ce que la base doit tenir, et que ce fichier éprouve :
 *
 *   (a) `updated_at` naît à la création et ne bouge que sur un **vrai** changement de statut ;
 *       une correction de texte ou un `update` qui renomme la colonne sans la changer ne
 *       datent rien ;
 *   (b) le client **ne peut pas** écrire `updated_at` ni `vu_le` : le repère passe par
 *       `marquer_comite_vu()`, et par elle seule ;
 *   (c) la fonction ne marque que **l'appelant** — les autres comptes gardent leur repère ;
 *   (d) un compte **en attente** peut marquer le sien (lire le comité est ouvert, D-088) ;
 *       sans compte, le refus est nommé ;
 *   (e) la vue `postits_avec_votes` porte `updated_at` — le compteur ne se dédouble pas.
 *
 * **Le contrôle mord** (#112) : chaque garde est neutralisée tour à tour — la 0008 est relue,
 * un motif précis est remplacé, puis rejouée — et le geste fautif doit alors produire
 * l'issue **inverse**.
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

const MIGRATION_COMITE = fichiersMigrations().find((sql) => sql.includes('marquer_comite_vu'));
if (!MIGRATION_COMITE) {
  throw new Error('supabase/migrations/0008_comite.sql introuvable');
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

const coller = (db: Base, appareil: string, id: string) =>
  tenter(
    db,
    appareil,
    `insert into public.postits (id, kind, titre, texte, version)
     values ($1, 'IP', 'Titre', 'Texte.', 'Alpha · 0.1.12') returning *`,
    [id]
  );

/** Le tri passe par l'administration (0006 : `grant update (statut, raison, ticket)`). */
const trier = (db: Base, appareil: string, postit: string, statut: string) =>
  tenter(db, appareil, `update public.postits set statut = $2 where id = $1 returning statut`, [postit, statut]);

/** La correction du texte passe par sa fonction (0006) : elle ne touche pas au statut. */
const corriger = (db: Base, appareil: string, postit: string, texte: string) =>
  tenter(db, appareil, `select * from public.corriger_postit($1, 'Titre', $2)`, [postit, texte]);

const marquer = (db: Base, appareil: string) => tenter(db, appareil, `select public.marquer_comite_vu() as vu_le`);

/** A et B approuvés, C en attente, un administrateur ; A et B ont chacun un post-it. */
async function monde(db: Base) {
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_C, { etat: 'en attente' });
  await creerCompte(db, ADMIN, { etat: 'approuve', administrateur: true });
  accepte(await coller(db, APPAREIL_A, 'p-a'));
  accepte(await coller(db, APPAREIL_B, 'p-b'));
}

const mouvement = async (db: Base, id: string) =>
  (
    await db.query<{ updated_at: Date; created_at: Date }>(
      `select updated_at, created_at from public.postits where id = $1`,
      [id]
    )
  ).rows[0];

const repere = async (db: Base, compte: string) =>
  (await db.query<{ vu_le: Date }>(`select vu_le from public.comptes where id = $1`, [compte])).rows[0].vu_le;

/** Recule un horodatage, pour que le mouvement attendu soit **visiblement** plus récent. */
const reculer = async (db: Base, id: string) =>
  db.query(`update public.postits set updated_at = now() - interval '1 hour' where id = $1`, [id]);

describe('quand un post-it a bougé (0008)', () => {
  it('(a) à la création, updated_at vaut created_at : le passé n’est pas un mouvement', async () => {
    const db = await base();
    try {
      await monde(db);
      const { updated_at, created_at } = await mouvement(db, 'p-a');
      expect(new Date(updated_at).getTime()).toBe(new Date(created_at).getTime());
    } finally {
      await db.close();
    }
  });

  it('(a) un vrai changement de statut date le post-it', async () => {
    const db = await base();
    try {
      await monde(db);
      await reculer(db, 'p-a');
      const avant = await mouvement(db, 'p-a');

      accepte(await trier(db, ADMIN, 'p-a', 'retenu'));

      const apres = await mouvement(db, 'p-a');
      expect(new Date(apres.updated_at).getTime()).toBeGreaterThan(new Date(avant.updated_at).getTime());
    } finally {
      await db.close();
    }
  });

  it('(a) une correction de texte ne date rien : le compteur ne parle que du tri', async () => {
    const db = await base();
    try {
      await monde(db);
      await reculer(db, 'p-a');
      const avant = await mouvement(db, 'p-a');

      accepte(await corriger(db, APPAREIL_A, 'p-a', 'Texte corrigé.'));

      const apres = await mouvement(db, 'p-a');
      expect(new Date(apres.updated_at).getTime()).toBe(new Date(avant.updated_at).getTime());
    } finally {
      await db.close();
    }
  });

  it('(a) ranger un post-it ne date rien : le compteur ne s’agite pas à chaque glisser', async () => {
    const db = await base();
    try {
      await monde(db);
      await reculer(db, 'p-a');
      const avant = await mouvement(db, 'p-a');

      accepte(
        await tenter(db, APPAREIL_A, `select * from public.deplacer_postit($1, $2, $3, $4)`, ['p-a', 12.5, 80, 0])
      );

      const apres = await mouvement(db, 'p-a');
      expect(new Date(apres.updated_at).getTime()).toBe(new Date(avant.updated_at).getTime());
    } finally {
      await db.close();
    }
  });

  it('(a) un update qui nomme le statut sans le changer ne date rien', async () => {
    const db = await base();
    try {
      await monde(db);
      await reculer(db, 'p-a');
      const avant = await mouvement(db, 'p-a');

      accepte(await trier(db, ADMIN, 'p-a', 'en attente'));

      const apres = await mouvement(db, 'p-a');
      expect(new Date(apres.updated_at).getTime()).toBe(new Date(avant.updated_at).getTime());
    } finally {
      await db.close();
    }
  });

  it('(b) le client ne peut pas antidater updated_at : ce n’est pas dans le grant', async () => {
    const db = await base();
    try {
      await monde(db);
      refuse(
        await tenter(db, ADMIN, `update public.postits set updated_at = '2000-01-01' where id = 'p-a'`),
        /permission denied/
      );
    } finally {
      await db.close();
    }
  });

  it('(e) la vue postits_avec_votes porte updated_at', async () => {
    const db = await base();
    try {
      await monde(db);
      const vue = await avecAppareil(db, APPAREIL_A, () =>
        db.query<{ updated_at: Date }>(`select updated_at from public.postits_avec_votes where id = 'p-a'`)
      );
      expect(vue.rows).toHaveLength(1);
      expect(vue.rows[0].updated_at).toBeTruthy();
    } finally {
      await db.close();
    }
  });
});

describe('quand tu l’as vu (0008)', () => {
  it('(b) marquer passe par la fonction, et la fonction rend le repère posé', async () => {
    const db = await base();
    try {
      await monde(db);
      await db.query(`update public.comptes set vu_le = now() - interval '1 hour'`);
      const avant = await repere(db, APPAREIL_A);

      const issue = await marquer(db, APPAREIL_A);
      accepte(issue);

      const apres = await repere(db, APPAREIL_A);
      expect(new Date(apres).getTime()).toBeGreaterThan(new Date(avant).getTime());
      if (issue.accepte) {
        expect(new Date(issue.lignes[0].vu_le as Date).getTime()).toBe(new Date(apres).getTime());
      }
    } finally {
      await db.close();
    }
  });

  it('(b) le client n’écrit pas vu_le en direct : la colonne n’est pas dans le grant', async () => {
    const db = await base();
    try {
      await monde(db);
      refuse(
        await tenter(db, APPAREIL_A, `update public.comptes set vu_le = now() where id = $1`, [APPAREIL_A]),
        /permission denied/
      );
    } finally {
      await db.close();
    }
  });

  it('(c) un compte ne marque que son repère, pas celui d’un autre', async () => {
    const db = await base();
    try {
      await monde(db);
      await db.query(`update public.comptes set vu_le = now() - interval '1 hour'`);
      const autreAvant = await repere(db, APPAREIL_B);

      accepte(await marquer(db, APPAREIL_A));

      const autreApres = await repere(db, APPAREIL_B);
      expect(new Date(autreApres).getTime()).toBe(new Date(autreAvant).getTime());
    } finally {
      await db.close();
    }
  });

  it('(d) un compte en attente marque le sien : lire le comité est ouvert (D-088)', async () => {
    const db = await base();
    try {
      await monde(db);
      accepte(await marquer(db, APPAREIL_C));
    } finally {
      await db.close();
    }
  });

  it('(d) sans compte, le refus est nommé', async () => {
    const db = await base();
    try {
      await monde(db);
      refuse(
        await tenter(db, '99999999-9999-4999-8999-999999999999', `select public.marquer_comite_vu()`),
        /comite_vu_sans_compte/
      );
    } finally {
      await db.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Le contrôle mord : chaque contrôle neutralisé laisse passer le fautif
// ---------------------------------------------------------------------------------------------

/** Remplace un motif de la 0008 ; un motif absent fait échouer. */
function muter(motif: string, remplacement: string): string {
  expect(MIGRATION_COMITE!.split(motif).length - 1, `motif introuvable ou ambigu : ${motif}`).toBeGreaterThan(0);
  const mutee = MIGRATION_COMITE!.replaceAll(motif, remplacement);
  expect(mutee).not.toBe(MIGRATION_COMITE);
  return migrations().replace(MIGRATION_COMITE!, () => mutee);
}

const MUTATIONS: Array<{
  nom: string;
  sql: () => string;
  geste: (db: Base) => Promise<{ date: number; avant: number }>;
}> = [
  {
    // L'ancre est le **contrôle de la fonction** : un `update` qui nomme `statut` sans le
    // changer doit rester muet. (La portée `of statut` du déclencheur, elle, est une
    // économie — le comportement tient déjà au `if` ; son effet est éprouvé plus haut par
    // « une correction de texte ne date rien ».)
    nom: '(a) fonction sans le contrôle de statut → un update qui ne change rien date le post-it',
    sql: () => muter(`  if new.statut is distinct from old.statut then`, `  if true then`),
    geste: async (db) => {
      await reculer(db, 'p-a');
      const avant = new Date((await mouvement(db, 'p-a')).updated_at).getTime();
      accepte(await trier(db, ADMIN, 'p-a', 'en attente'));
      const apres = new Date((await mouvement(db, 'p-a')).updated_at).getTime();
      return { date: apres, avant };
    }
  },
  {
    // Un `where true` ferait échouer la fonction (`returning into` sur plusieurs lignes) :
    // la mutation vise donc **un autre compte**, ce qui est exactement la faute — écrire le
    // repère de quelqu'un d'autre que l'appelant.
    nom: '(c) fonction qui ne vise pas l’appelant → marquer écrase le repère d’un autre',
    sql: () => muter(`   where id = auth.uid()`, `   where id = '${APPAREIL_B}'::uuid`),
    geste: async (db) => {
      await db.query(`update public.comptes set vu_le = now() - interval '1 hour'`);
      const avant = new Date(await repere(db, APPAREIL_B)).getTime();
      accepte(await marquer(db, APPAREIL_A));
      const apres = new Date(await repere(db, APPAREIL_B)).getTime();
      return { date: apres, avant };
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
          const { date, avant } = await m.geste(db);
          expect(date, m.nom).toBeGreaterThan(avant);
        } finally {
          await db.close();
        }
      },
      90_000
    );
  }
});

describe('sur la vraie base, le comportement attendu tient', () => {
  it('les deux gestes ne produisent rien de fautif', async () => {
    for (const m of MUTATIONS) {
      const db = await base();
      try {
        await monde(db);
        const { date, avant } = await m.geste(db);
        expect(date, m.nom).toBe(avant);
      } finally {
        await db.close();
      }
    }
  }, 90_000);
});
