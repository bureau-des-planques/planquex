// @vitest-environment node
/**
 * La trace des combats et ses règles d'accès — #173, D-086.
 *
 * On joue **toutes** les migrations de `supabase/migrations/` (la garde du mur et celle-ci)
 * dans **PGlite** : PostgreSQL en WASM, RLS comprise. Rien n'est recopié : une copie
 * garderait la copie, pas le schéma qu'on applique pour de vrai (ticket #112).
 *
 * Ce que la garde exige :
 *
 * 1. un appareil **dépose** ses combats et **relit les siens**, et **pas ceux d'un autre** ;
 * 2. il ne peut pas **signer au nom d'un autre** (`auteur = auth.uid()`) ;
 * 3. `anon` (appareil non identifié) n'a **rien** : ni lecture, ni écriture ;
 * 4. une trace ne se **réécrit** pas — ni par un autre appareil, ni par le sien ;
 * 5. les contraintes tiennent : `mode` vaut `solo` ou `pvp` (D-105), et rien d'autre ;
 *    graine positive, Decks et journal en JSON de la bonne forme ;
 * 6. **le contrôle mord** : rejoué contre une migration **mutée** (conditions des politiques
 *    remplacées par `true`), le scénario doit **constater la fuite**. Une garde qui passerait
 *    quoi qu'il arrive ne garderait rien.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APPAREIL_A,
  APPAREIL_B,
  avecAppareil,
  baseAvecAppareils,
  fichiersMigrations,
  migrations,
  type Base,
} from './pglite';

/** La migration des combats, seule : la mutation ne touche pas les politiques du mur. */
const MIGRATION_COMBATS = fichiersMigrations().find((sql) =>
  sql.includes('create table public.combats'),
);
if (!MIGRATION_COMBATS) throw new Error('supabase/migrations/0002_combats.sql introuvable');

const DECKS = {
  playerDeck: ['sse-medecin-travail', 'management-responsable-unite'],
  aiDeck: ['atelier-responsable-process'],
};
const TYPES_CAFE = {
  playerCafeTypes: ['SSE'],
  aiCafeTypes: ['MANAGEMENT'],
};
const JOURNAL = [
  { type: 'attachEnergy', targetUid: 'u1' },
  { type: 'attack', attackIndex: 0 },
  { type: 'endTurn' },
];

/**
 * Dépose un combat au nom de l'appareil. `auteur` n'est passé que pour les tentatives
 * d'usurpation : le cas normal laisse la base remplir `auth.uid()`.
 */
function deposer(
  db: Base,
  appareil: string,
  options: { graine?: number; auteur?: string } = {},
) {
  const { graine = 42, auteur } = options;
  const colonnes = auteur ? ', auteur' : '';
  const valeurAuteur = auteur ? ', $5' : '';
  const parametres: unknown[] = [
    graine,
    JSON.stringify(DECKS),
    JSON.stringify(TYPES_CAFE),
    JSON.stringify(JOURNAL),
  ];
  if (auteur) parametres.push(auteur);

  return avecAppareil(db, appareil, () =>
    db.query(
      `insert into public.combats (mode, graine, decks, types_cafe, journal${colonnes})
       values ('solo', $1, $2::jsonb, $3::jsonb, $4::jsonb${valeurAuteur})
       returning *`,
      parametres,
    ),
  );
}

/** Combien de lignes un geste touche — une erreur de privilège compte pour zéro. */
async function lignesTouchees(db: Base, appareil: string, sql: string): Promise<number> {
  try {
    const resultat = await avecAppareil(db, appareil, () => db.query(sql));
    return resultat.rows.length;
  } catch {
    return 0;
  }
}

describe('les combats — schéma et règles d’accès (#173, D-086)', () => {
  let db: Base;

  beforeAll(async () => {
    db = await baseAvecAppareils();
  });

  afterAll(async () => {
    await db.close();
  });

  it('A dépose un combat : la base le signe de son identité anonyme', async () => {
    const depose = await deposer(db, APPAREIL_A, { graine: 2026 });
    expect(depose.rows).toHaveLength(1);
    expect(depose.rows[0].auteur).toBe(APPAREIL_A);
    expect(Number(depose.rows[0].graine)).toBe(2026);
    expect(depose.rows[0].mode).toBe('solo');
    expect(depose.rows[0].decks).toEqual(DECKS);
    expect(depose.rows[0].types_cafe).toEqual(TYPES_CAFE);
    expect(depose.rows[0].journal).toEqual(JOURNAL);
  });

  it('A relit le sien, B ne lit pas celui de A', async () => {
    const sien = await avecAppareil(db, APPAREIL_A, () =>
      db.query('select id from public.combats where graine = 2026'),
    );
    expect(sien.rows).toHaveLength(1);

    // B dépose le sien pour distinguer « ne lit rien » de « ne lit pas les autres ».
    await deposer(db, APPAREIL_B, { graine: 77 });
    const siensB = await avecAppareil(db, APPAREIL_B, () =>
      db.query('select id, graine from public.combats'),
    );
    expect(siensB.rows).toHaveLength(1);
    expect(Number(siensB.rows[0].graine)).toBe(77);
  });

  it('B ne peut pas déposer un combat au nom de A', async () => {
    await expect(deposer(db, APPAREIL_B, { graine: 99, auteur: APPAREIL_A })).rejects.toThrow(
      /row-level security/,
    );
  });

  it('une trace ne se réécrit pas : ni B ni A ne la modifient ou la suppriment', async () => {
    await deposer(db, APPAREIL_A, { graine: 111 });

    for (const appareil of [APPAREIL_B, APPAREIL_A]) {
      expect(
        await lignesTouchees(
          db,
          appareil,
          `update public.combats set journal = '[]'::jsonb where graine = 111 returning *`,
        ),
      ).toBe(0);
      expect(
        await lignesTouchees(
          db,
          appareil,
          `delete from public.combats where graine = 111 returning *`,
        ),
      ).toBe(0);
    }

    const intacte = await avecAppareil(db, APPAREIL_A, () =>
      db.query('select journal from public.combats where graine = 111'),
    );
    expect(intacte.rows).toHaveLength(1);
    expect(intacte.rows[0].journal).toEqual(JOURNAL);
  });

  it('un appareil non identifié (anon) n’a aucun accès', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select count(*) from public.combats')).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query(
          `insert into public.combats (mode, graine, decks, types_cafe, journal)
           values ('solo', 1, '${JSON.stringify(DECKS)}'::jsonb,
                   '${JSON.stringify(TYPES_CAFE)}'::jsonb, '${JSON.stringify(JOURNAL)}'::jsonb)`,
        ),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });

  it('les contraintes tiennent : solo et pvp seulement, graine positive, Decks et journal de la bonne forme', async () => {
    // Une partie à deux se dépose comme une solo (D-105, #228) : le mode est accepté…
    await avecAppareil(db, APPAREIL_A, () =>
      db.query(
        `insert into public.combats (mode, graine, decks, types_cafe, journal)
         values ('pvp', 1, $1::jsonb, $2::jsonb, $3::jsonb)`,
        [JSON.stringify(DECKS), JSON.stringify(TYPES_CAFE), JSON.stringify(JOURNAL)],
      ),
    );

    // …et un mode inventé reste refusé (la liste des modes est explicite).
    await expect(
      avecAppareil(db, APPAREIL_A, () =>
        db.query(
          `insert into public.combats (mode, graine, decks, types_cafe, journal)
           values ('deux', 1, $1::jsonb, $2::jsonb, $3::jsonb)`,
          [JSON.stringify(DECKS), JSON.stringify(TYPES_CAFE), JSON.stringify(JOURNAL)],
        ),
      ),
    ).rejects.toThrow(/combats_mode_check/);

    await expect(
      avecAppareil(db, APPAREIL_A, () =>
        db.query(
          `insert into public.combats (mode, graine, decks, types_cafe, journal)
           values ('solo', -1, $1::jsonb, $2::jsonb, $3::jsonb)`,
          [JSON.stringify(DECKS), JSON.stringify(TYPES_CAFE), JSON.stringify(JOURNAL)],
        ),
      ),
    ).rejects.toThrow(/combats_graine_check/);

    await expect(
      avecAppareil(db, APPAREIL_A, () =>
        db.query(
          `insert into public.combats (mode, graine, decks, types_cafe, journal)
           values ('solo', 1, '{"playerDeck": {}}'::jsonb, $1::jsonb, $2::jsonb)`,
          [JSON.stringify(TYPES_CAFE), JSON.stringify(JOURNAL)],
        ),
      ),
    ).rejects.toThrow(/combats_decks_check/);

    await expect(
      avecAppareil(db, APPAREIL_A, () =>
        db.query(
          `insert into public.combats (mode, graine, decks, types_cafe, journal)
           values ('solo', 1, $1::jsonb, $2::jsonb, '{}'::jsonb)`,
          [JSON.stringify(DECKS), JSON.stringify(TYPES_CAFE)],
        ),
      ),
    ).rejects.toThrow(/combats_journal_check/);
  });
});

describe('le contrôle mord — la fuite doit apparaître sur la migration mutée', () => {
  /** La mutation remplace **la condition des politiques** par `true` (pas la politique). */
  function muter(sql: string): string {
    const motif = 'auteur = auth.uid()';
    // Deux conditions : la lecture (les siens) et l'insertion (en son nom).
    expect(sql.split(motif).length - 1).toBe(2);
    const mutee = sql.replaceAll(motif, 'true');
    expect(mutee).not.toBe(sql);
    return mutee;
  }

  /** Toutes les migrations, celle des combats remplacée par sa version mutée. */
  function migrationsMutees(): string {
    const combatsMute = muter(MIGRATION_COMBATS);
    // La 0005 (D-088) remplace la politique d'insertion des combats : la neutralisation de
    // la 0002 seule serait annulée par elle. On l'applique donc à toutes les copies.
    return migrations()
      .replace(MIGRATION_COMBATS, () => combatsMute)
      // `p.auteur` d'abord : sans cela, le remplacement global laisserait `p.true`.
      .replaceAll('p.auteur = auth.uid()', 'true')
      .replaceAll('auteur = auth.uid()', 'true');
  }

  let db: Base;

  beforeAll(async () => {
    db = await baseAvecAppareils(migrationsMutees());
  });

  afterAll(async () => {
    await db.close();
  });

  it('sans la condition, B lit la trace de A et signe en son nom', async () => {
    const depose = await deposer(db, APPAREIL_A, { graine: 4242 });
    expect(depose.rows).toHaveLength(1);

    // 1. B lit la ligne de A : la fuite est constatée.
    const lu = await avecAppareil(db, APPAREIL_B, () =>
      db.query('select id, graine from public.combats where graine = 4242'),
    );
    expect(lu.rows).toHaveLength(1);
    expect(Number(lu.rows[0].graine)).toBe(4242);

    // 2. B dépose au nom de A, ce que la politique d'insertion refusait.
    const usurpe = await deposer(db, APPAREIL_B, { graine: 4343, auteur: APPAREIL_A });
    expect(usurpe.rows).toHaveLength(1);
    expect(usurpe.rows[0].auteur).toBe(APPAREIL_A);
  });
});
