// @vitest-environment node
/**
 * Le Deck et la Collection sur le compte — la migration `0020_deck_et_collection.sql`
 * (#489, D-153).
 *
 * Même banc que `profils.test.ts` : les migrations **réelles**, jouées dans PGlite (RLS
 * comprise), en rôle `authenticated`. Le Deck et la Collection suivent le compte, donc ils se
 * lisent et s'écrivent par leur propriétaire, et seulement lui.
 *
 * Ce que la base doit tenir :
 *
 *   (a) un testeur **lit** ses lignes de Deck et de Collection, et **pas** celles d'un autre ;
 *   (b) il **crée** ses lignes, et **pas** au nom d'un autre ;
 *   (c) il **change** ses lignes, et **pas** celles d'un autre (0 ligne touchée, sans erreur) ;
 *   (d) il **retire** ses lignes, et **pas** celles d'un autre ;
 *   (e) la **forme** est tenue : quantité au moins 1, identifiant de carte non vide, rang
 *       positif, pas deux fois la même carte ni le même rang pour un compte ;
 *   (f) `updated_at` vient du **serveur** : le client ne peut pas l'écrire, et un `update`
 *       l'écrase ;
 *   (g) un compte **en attente** écrit les siennes (D-088 : il joue avant l'approbation) ;
 *   (h) `anon` n'a aucune ligne, aucun droit ;
 *   (i) la migration **se rejoue** sans erreur ;
 *   (j) **le contrôle mord** : la politique mutée (`compte_id = auth.uid()` remplacé par
 *       `true`) laisse passer la lecture, l'insertion au nom d'un autre, la modification et la
 *       suppression de ses lignes.
 */
import { describe, expect, it } from 'vitest';
import {
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

const ajouterALaCollection = (db: Base, appareil: string, carte: string, quantite = 1) =>
  tenter(
    db,
    appareil,
    'insert into public.collection (compte_id, carte_id, quantite) values ($1, $2, $3) returning *',
    [appareil, carte, quantite]
  );

const ajouterAuDeck = (db: Base, appareil: string, carte: string, rang: number, quantite = 1) =>
  tenter(
    db,
    appareil,
    'insert into public.deck (compte_id, carte_id, quantite, rang) values ($1, $2, $3, $4) returning *',
    [appareil, carte, quantite, rang]
  );

/** Une base neuve, deux comptes approuvés. */
async function monde(): Promise<Base> {
  const db = await base();
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
  return db;
}

/** La 0020, lue paresseusement : sans elle, les scénarios parleraient d'un fichier absent. */
function migrationDeck(): string {
  const trouvee = fichiersMigrations().find((sql) => sql.includes('create table if not exists public.deck'));
  if (!trouvee) throw new Error('supabase/migrations/0020_deck_et_collection.sql introuvable');
  return trouvee;
}

describe('le Deck et la Collection sur le compte (#489, D-153)', () => {
  it('(a) un testeur lit ses lignes, pas celles d un autre', async () => {
    const db = await monde();
    accepte(await ajouterALaCollection(db, APPAREIL_A, 'planque-entrant-1'));
    accepte(await ajouterALaCollection(db, APPAREIL_A, 'planque-n1-1', 2));
    accepte(await ajouterAuDeck(db, APPAREIL_A, 'planque-entrant-1', 0));
    accepte(await ajouterAuDeck(db, APPAREIL_A, 'planque-n1-1', 1));

    const collection = await tenter(db, APPAREIL_A, 'select * from public.collection');
    accepte(collection);
    if (collection.accepte) expect(collection.lignes).toHaveLength(2);

    const deck = await tenter(db, APPAREIL_A, 'select * from public.deck');
    accepte(deck);
    if (deck.accepte) expect(deck.lignes).toHaveLength(2);

    const collectionAutre = await tenter(db, APPAREIL_B, 'select * from public.collection');
    accepte(collectionAutre);
    if (collectionAutre.accepte) expect(collectionAutre.lignes).toHaveLength(0);

    const deckAutre = await tenter(db, APPAREIL_B, 'select * from public.deck');
    accepte(deckAutre);
    if (deckAutre.accepte) expect(deckAutre.lignes).toHaveLength(0);
  });

  it('(b) un testeur ne crée pas de ligne au nom d un autre', async () => {
    const db = await monde();
    refuse(
      await tenter(
        db,
        APPAREIL_B,
        'insert into public.collection (compte_id, carte_id, quantite) values ($1, $2, 1) returning *',
        [APPAREIL_A, 'planque-entrant-1']
      ),
      /row-level security|policy/i
    );
    refuse(
      await tenter(
        db,
        APPAREIL_B,
        'insert into public.deck (compte_id, carte_id, quantite, rang) values ($1, $2, 1, 0) returning *',
        [APPAREIL_A, 'planque-entrant-1']
      ),
      /row-level security|policy/i
    );
    const reste = await db.query<{ n: number }>('select count(*)::int as n from public.collection');
    expect(reste.rows[0]?.n).toBe(0);
  });

  it('(c) un testeur ne change pas la ligne d un autre : 0 ligne, sans erreur', async () => {
    const db = await monde();
    accepte(await ajouterALaCollection(db, APPAREIL_A, 'planque-entrant-1', 2));
    accepte(await ajouterAuDeck(db, APPAREIL_A, 'planque-entrant-1', 0));

    const changee = await tenter(
      db,
      APPAREIL_B,
      'update public.collection set quantite = 9 where compte_id = $1 returning *',
      [APPAREIL_A]
    );
    accepte(changee);
    if (changee.accepte) expect(changee.lignes).toHaveLength(0);

    const deckChange = await tenter(
      db,
      APPAREIL_B,
      'update public.deck set rang = 7 where compte_id = $1 returning *',
      [APPAREIL_A]
    );
    accepte(deckChange);
    if (deckChange.accepte) expect(deckChange.lignes).toHaveLength(0);

    const relu = await db.query<{ quantite: number }>('select quantite from public.collection where compte_id = $1', [
      APPAREIL_A
    ]);
    expect(relu.rows[0]?.quantite).toBe(2);
    const reluDeck = await db.query<{ rang: number }>('select rang from public.deck where compte_id = $1', [
      APPAREIL_A
    ]);
    expect(reluDeck.rows[0]?.rang).toBe(0);
  });

  it('(d) un testeur ne retire pas la ligne d un autre, mais retire la sienne', async () => {
    const db = await monde();
    accepte(await ajouterALaCollection(db, APPAREIL_A, 'planque-entrant-1'));
    accepte(await ajouterAuDeck(db, APPAREIL_A, 'planque-entrant-1', 0));

    const volee = await tenter(db, APPAREIL_B, 'delete from public.collection where compte_id = $1 returning *', [
      APPAREIL_A
    ]);
    accepte(volee);
    if (volee.accepte) expect(volee.lignes).toHaveLength(0);
    const deckVole = await tenter(db, APPAREIL_B, 'delete from public.deck where compte_id = $1 returning *', [
      APPAREIL_A
    ]);
    accepte(deckVole);
    if (deckVole.accepte) expect(deckVole.lignes).toHaveLength(0);

    const restant = await db.query<{ n: number }>('select count(*)::int as n from public.collection');
    expect(restant.rows[0]?.n).toBe(1);

    const sienne = await tenter(db, APPAREIL_A, 'delete from public.collection where carte_id = $1 returning *', [
      'planque-entrant-1'
    ]);
    accepte(sienne);
    if (sienne.accepte) expect(sienne.lignes).toHaveLength(1);
  });

  it('(e) la forme est tenue : quantité, identifiant, rang, unicité', async () => {
    const db = await monde();
    refuse(await ajouterALaCollection(db, APPAREIL_A, 'planque-entrant-1', 0), /collection_quantite_check/);
    refuse(await ajouterALaCollection(db, APPAREIL_A, '   '), /collection_carte_id_check/);
    refuse(await ajouterAuDeck(db, APPAREIL_A, 'planque-entrant-1', 0, 0), /deck_quantite_check/);
    refuse(await ajouterAuDeck(db, APPAREIL_A, 'planque-entrant-1', -1), /deck_rang_check/);

    accepte(await ajouterALaCollection(db, APPAREIL_A, 'planque-entrant-1', 3));
    // Une carte possédée ne se compte pas deux fois : c'est la clé primaire qui le dit.
    refuse(await ajouterALaCollection(db, APPAREIL_A, 'planque-entrant-1'), /duplicate key|collection_pkey/i);

    accepte(await ajouterAuDeck(db, APPAREIL_A, 'planque-entrant-1', 0));
    // Deux cartes ne peuvent pas occuper le même rang dans un même Deck.
    refuse(await ajouterAuDeck(db, APPAREIL_A, 'planque-n1-1', 0), /deck_rang_unique/);
    // Le rang est propre à chaque compte : celui d'un autre ne le gêne pas.
    accepte(await ajouterAuDeck(db, APPAREIL_B, 'planque-entrant-1', 0));
  });

  it('(f) updated_at vient du serveur : le client ne l écrit pas, un update l écrase', async () => {
    const db = await monde();
    // Le client ne peut pas antidater sa ligne à l'insertion : la colonne n'est pas accordée.
    refuse(
      await tenter(
        db,
        APPAREIL_A,
        `insert into public.collection (compte_id, carte_id, quantite, updated_at)
         values ($1, $2, 1, timestamptz '2000-01-01') returning *`,
        [APPAREIL_A, 'planque-entrant-1']
      ),
      /permission denied/i
    );

    accepte(await ajouterALaCollection(db, APPAREIL_A, 'planque-entrant-1'));
    // Même chose pour un update direct de la colonne.
    refuse(
      await tenter(
        db,
        APPAREIL_A,
        `update public.collection set updated_at = timestamptz '2000-01-01' where carte_id = $1 returning *`,
        ['planque-entrant-1']
      ),
      /permission denied/i
    );

    // La date de départ est antidatée en direct (rôle d'administration, hors du client), puis
    // un vrai mouvement du client doit la remplacer par l'heure du serveur.
    await db.query(`update public.collection set updated_at = timestamptz '2000-01-01' where compte_id = $1`, [
      APPAREIL_A
    ]);
    accepte(
      await tenter(db, APPAREIL_A, 'update public.collection set quantite = 2 where carte_id = $1 returning *', [
        'planque-entrant-1'
      ])
    );
    const relu = await db.query<{ annee: number }>(
      'select extract(year from updated_at)::int as annee from public.collection where compte_id = $1',
      [APPAREIL_A]
    );
    expect(relu.rows[0]?.annee).toBeGreaterThan(2000);
  });

  it('(g) un compte en attente écrit les siennes : il joue avant l approbation (D-088)', async () => {
    const db = await monde();
    await creerCompte(db, APPAREIL_C, { etat: 'en attente' });
    accepte(await ajouterALaCollection(db, APPAREIL_C, 'planque-entrant-1'));
    accepte(await ajouterAuDeck(db, APPAREIL_C, 'planque-entrant-1', 0));
    const lu = await tenter(db, APPAREIL_C, 'select * from public.collection');
    accepte(lu);
    if (lu.accepte) expect(lu.lignes).toHaveLength(1);
  });

  it('(h) anon n a ni droit ni ligne', async () => {
    const db = await monde();
    accepte(await ajouterALaCollection(db, APPAREIL_A, 'planque-entrant-1'));
    for (const table of ['public.collection', 'public.deck']) {
      const droit = await db.query<{ ok: boolean }>(`select has_table_privilege('anon', $1, 'select') as ok`, [table]);
      expect(droit.rows[0]?.ok, `anon lit ${table}`).toBe(false);
    }
    await db.exec('set role anon');
    try {
      await expect(db.query('select * from public.collection')).rejects.toThrow(/permission denied/i);
    } finally {
      await db.exec('reset role');
    }
  });

  it('(i) la migration se rejoue sans erreur', async () => {
    const db = await monde();
    await db.exec(migrationDeck());
    await db.exec(migrationDeck());
    const tables = await db.query<{ nom: string }>(
      `select table_name as nom from information_schema.tables
        where table_schema = 'public' and table_name in ('deck', 'collection')
        order by 1`
    );
    expect(tables.rows.map((ligne) => ligne.nom)).toEqual(['collection', 'deck']);
  });
});

describe('le contrôle mord — la politique mutée laisse passer la fuite', () => {
  /** La mutation remplace **la condition des politiques** par `true` (pas la politique). */
  function muter(sql: string): string {
    const motif = 'compte_id = auth.uid()';
    // Cinq conditions par table : lecture, insertion, changement (deux) et retrait.
    expect(sql.split(motif).length - 1, `motif introuvable ou en nombre inattendu : ${motif}`).toBe(10);
    const mutee = sql.replaceAll(motif, 'true');
    expect(mutee).not.toBe(sql);
    return mutee;
  }

  /** Toutes les migrations, celle du Deck et de la Collection remplacée par sa version mutée. */
  function migrationsMutees(): string {
    const sql = migrationDeck();
    const mutee = muter(sql);
    return migrations().replace(sql, () => mutee);
  }

  it('sans la condition, B lit, crée, change et retire les lignes de A', async () => {
    const db = await base(migrationsMutees());
    await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
    await creerCompte(db, APPAREIL_B, { etat: 'approuve' });

    accepte(await ajouterALaCollection(db, APPAREIL_A, 'planque-entrant-1', 2));

    // 1. B lit la ligne de A : la fuite est constatée.
    const lu = await tenter(db, APPAREIL_B, 'select * from public.collection');
    accepte(lu);
    if (lu.accepte) expect(lu.lignes).toHaveLength(1);

    // 2. B écrit au nom de A, ce que la politique d'insertion refusait.
    const usurpe = await ajouterALaCollection(db, APPAREIL_B, 'planque-n1-1');
    accepte(usurpe);
    if (usurpe.accepte) expect(usurpe.lignes[0]?.compte_id).toBe(APPAREIL_B);

    const auNomDeA = await tenter(
      db,
      APPAREIL_B,
      'insert into public.collection (compte_id, carte_id, quantite) values ($1, $2, 1) returning *',
      [APPAREIL_A, 'planque-n2-1']
    );
    accepte(auNomDeA);
    if (auNomDeA.accepte) expect(auNomDeA.lignes[0]?.compte_id).toBe(APPAREIL_A);

    // 3. B change et retire la ligne de A.
    const changee = await tenter(
      db,
      APPAREIL_B,
      'update public.collection set quantite = 9 where compte_id = $1 returning *',
      [APPAREIL_A]
    );
    accepte(changee);
    if (changee.accepte) expect(changee.lignes).toHaveLength(2);

    const retiree = await tenter(db, APPAREIL_B, 'delete from public.collection where compte_id = $1 returning *', [
      APPAREIL_A
    ]);
    accepte(retiree);
    if (retiree.accepte) expect(retiree.lignes).toHaveLength(2);
  });
});
