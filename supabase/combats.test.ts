// @vitest-environment node
/**
 * La table `combats` n'existe plus — #738, D-183 (annule D-086 et D-105).
 *
 * Ce fichier gardait la trace des combats et ses règles d'accès ; il constate désormais
 * **l'absence** de la table, jamais pour la recréer. On joue **toutes** les migrations de
 * `supabase/migrations/` dans PGlite : après 0030, `public.combats` n'existe plus, et avec
 * elle ses politiques RLS et son index. Les anciennes migrations (0002, 0005, 0012) ne
 * changent pas (D-091) : c'est la suite complète qui supprime.
 *
 * **Le contrôle mord** : la même suite **sans** 0030 laisse la table — un test d'absence qui
 * passerait sur une base qui l'a encore ne constaterait rien. Et rejouer 0030 ne casse pas
 * (idempotence).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APPAREIL_A, avecAppareil, base, baseAvecAppareils, fichiersMigrations, type Base } from './pglite';

const MIGRATION_DROP = fichiersMigrations().find((sql) => sql.includes('drop table if exists public.combats'));
if (!MIGRATION_DROP) throw new Error('supabase/migrations/0030_drop_combats.sql introuvable');

describe('la table combats est supprimée (#738, D-183)', () => {
  let db: Base;

  beforeAll(async () => {
    db = await baseAvecAppareils();
  });

  afterAll(async () => {
    await db.close();
  });

  it('`select * from public.combats` échoue : la relation n’existe pas', async () => {
    await expect(db.query('select * from public.combats')).rejects.toThrow(/relation "public.combats" does not exist/);
    await expect(
      avecAppareil(db, APPAREIL_A, () => db.query('select count(*) from public.combats'))
    ).rejects.toThrow(/does not exist/);
  });

  it('ni la table, ni ses politiques RLS, ni son index ne survivent', async () => {
    expect((await db.query(`select to_regclass('public.combats') as t`)).rows[0]).toEqual({ t: null });
    const politiques = await db.query(`select policyname from pg_policies where tablename = 'combats'`);
    expect(politiques.rows).toHaveLength(0);
    const index = await db.query(`select indexname from pg_indexes where indexname = 'combats_auteur_created_at'`);
    expect(index.rows).toHaveLength(0);
  });

  it('la migration est idempotente : la rejouer ne casse rien', async () => {
    await db.exec(MIGRATION_DROP);
    expect((await db.query(`select to_regclass('public.combats') as t`)).rows[0]).toEqual({ t: null });
  });

  it('le contrôle mord : sans la 0030, la table existe encore', async () => {
    const sansSuppression = fichiersMigrations()
      .filter((sql) => sql !== MIGRATION_DROP)
      .join('\n');
    const ancienne = await base(sansSuppression);
    try {
      expect((await ancienne.query(`select to_regclass('public.combats') as t`)).rows[0]).toEqual({ t: 'combats' });
    } finally {
      await ancienne.close();
    }
  });

  it('`compte_approuve()` survit : le mur, le Deck et les profils la citent encore', async () => {
    const fonction = await db.query(`select proname from pg_proc where proname = 'compte_approuve'`);
    expect(fonction.rows).toHaveLength(1);
  });
});
