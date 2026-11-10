// @vitest-environment node
/**
 * **L'Arrivage se crédite une seule fois** — #651, D-179, migration
 * `0024_pack_openings.sql`.
 *
 * On joue la **migration réelle** dans PGlite (PostgreSQL en WASM, RLS comprise), comme
 * `mur.test.ts` et `deck-collection.test.ts`. Rien n'est recopié ici : une copie garderait la
 * copie, pas le schéma qu'on applique pour de vrai (#112).
 *
 * Ce que la garde exige, et pourquoi chacun peut échouer :
 *
 * 1. **la même clé crédite une fois** : un double clic ou un retry réseau ne double pas la
 *    Collection, et la clé rejouée avec d'autres cartes rend les **cartes d'origine** — c'est
 *    la promesse de D-179 (2) ;
 * 2. **le compte rendu est exact** : les cartes rendues sont celles demandées, la ligne
 *    d'ouverture porte la graine, le paquet et le compte ;
 * 3. **un autre compte ne lit rien** : RLS de lecture, `user_id = auth.uid()` ;
 * 4. **le client n'écrit ni n'exécute** : aucun `insert` direct dans `pack_openings`, aucun
 *    `rpc('crediter_arrivage', …)` — un navigateur ne se crédite pas ses propres cartes ;
 * 5. **le contrôle mord** : l'unicité retirée, la même clé **crédite deux fois** — sans ce
 *    cas, on ne garderait que l'apparence de l'idempotence (#112).
 */
import { describe, expect, it } from 'vitest';
import {
  ADMIN,
  APPAREIL_A,
  APPAREIL_B,
  avecAppareil,
  baseAvecAppareils,
  creerCompte,
  fichiersMigrations,
  migrations,
  type Base
} from './pglite';

/** Les cinq cartes d'un tirage de référence, avec deux exemplaires d'une même carte. */
const CARTES = [
  { id: 'sse-infirmier-site', rarity: '1D' },
  { id: 'sse-infirmier-site', rarity: '1D' },
  { id: 'sse-infirmiere-travail', rarity: '2D' },
  { id: 'sse-medecin-travail', rarity: '3D' },
  { id: 'atelier-joueur-de-flute-star2', rarity: '2S' }
];

/** D'autres cartes, pour prouver qu'une clé déjà vue ne prend pas la nouvelle liste. */
const AUTRES_CARTES = [
  { id: 'rh-chasseur-tetes', rarity: '2D' },
  { id: 'direction-reunion-qui-aurait-pu-etre-un-mail', rarity: '2D' },
  { id: 'interim-interimaire', rarity: '1D' },
  { id: 'atelier-technicien-banc-essai', rarity: '3D' },
  { id: 'atelier-joueur-de-flute-star2', rarity: '2S' }
];

/**
 * La fonction est **fermée au client** : le test l'appelle comme le fait l'Edge Function —
 * rôle propriétaire, `request.jwt.claim.sub` posé au compte, puis la fonction dans la même
 * transaction. `auth.uid()` rend donc bien l'appareil, sans qu'aucun `grant` client existe.
 */
async function crediter(db: Base, appareil: string, cle: string, cartes: unknown[], seed: number | null = 1) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${appareil}', false);`);
  try {
    const resultat = await db.query<{ cartes: unknown }>(
      'select public.crediter_arrivage($1, $2::jsonb, $3) as cartes',
      [cle, JSON.stringify(cartes), seed]
    );
    return resultat.rows[0].cartes;
  } finally {
    await db.exec("select set_config('request.jwt.claim.sub', '', false);");
  }
}

/** La quantité d'une carte dans la Collection du compte, lue par le compte lui-même. */
async function quantite(db: Base, appareil: string, carteId: string): Promise<number> {
  return avecAppareil(db, appareil, async () => {
    const resultat = await db.query<{ quantite: number }>(
      'select quantite from public.collection where carte_id = $1',
      [carteId]
    );
    return resultat.rows[0]?.quantite ?? 0;
  });
}

/** Le nombre d'ouvertures visibles par un compte, lues par lui-même (RLS). */
async function ouvertures(db: Base, appareil: string): Promise<number> {
  return avecAppareil(db, appareil, async () => {
    const resultat = await db.query<{ n: number }>('select count(*)::int as n from public.pack_openings');
    return resultat.rows[0].n;
  });
}

describe('l’Arrivage se crédite une seule fois (#651, D-179)', () => {
  it('la même clé deux fois crédite une fois, et rend les cartes d’origine', async () => {
    const db = await baseAvecAppareils();

    const premiere = await crediter(db, APPAREIL_A, 'clic-1', CARTES, 20261031);
    expect(premiere).toEqual(CARTES);
    expect(await quantite(db, APPAREIL_A, 'sse-infirmier-site')).toBe(2);
    expect(await quantite(db, APPAREIL_A, 'sse-infirmiere-travail')).toBe(1);

    // Le retry : même clé, mêmes cartes — rien ne double.
    const seconde = await crediter(db, APPAREIL_A, 'clic-1', CARTES, 20261031);
    expect(seconde).toEqual(CARTES);
    expect(await quantite(db, APPAREIL_A, 'sse-infirmier-site')).toBe(2);
    expect(await quantite(db, APPAREIL_A, 'sse-infirmiere-travail')).toBe(1);

    // Une clé rejouée avec d'autres cartes ne les crédite pas non plus : la clé fait foi.
    const forgee = await crediter(db, APPAREIL_A, 'clic-1', AUTRES_CARTES, 7);
    expect(forgee).toEqual(CARTES);
    expect(await quantite(db, APPAREIL_A, 'rh-chasseur-tetes')).toBe(0);

    expect(await ouvertures(db, APPAREIL_A)).toBe(1);
    await db.close();
  });

  it('le compte rendu est exact : la ligne d’ouverture porte le compte, la clé, la graine et le paquet', async () => {
    const db = await baseAvecAppareils();
    expect(await crediter(db, APPAREIL_A, 'ouverture-a', CARTES, 1234)).toEqual(CARTES);

    const ligne = await db.query<{ user_id: string; cle: string; seed: string; pack_id: string; cards: unknown }>(
      'select user_id, cle, seed, pack_id, cards from public.pack_openings where cle = $1',
      ['ouverture-a']
    );
    expect(ligne.rows).toHaveLength(1);
    expect(ligne.rows[0]).toMatchObject({
      user_id: APPAREIL_A,
      cle: 'ouverture-a',
      pack_id: 'arrivage',
      cards: CARTES
    });
    expect(Number(ligne.rows[0].seed)).toBe(1234);
    await db.close();
  });

  it('un autre compte ne lit rien des ouvertures du premier', async () => {
    const db = await baseAvecAppareils();
    await crediter(db, APPAREIL_A, 'ouverture-a', CARTES);

    expect(await ouvertures(db, APPAREIL_A)).toBe(1);
    expect(await ouvertures(db, APPAREIL_B)).toBe(0);

    const fuite = await avecAppareil(db, APPAREIL_B, () =>
      db.query('select id from public.pack_openings where user_id = $1', [APPAREIL_A])
    );
    expect(fuite.rows).toHaveLength(0);
    await db.close();
  });

  it('le client n’écrit pas dans `pack_openings` et n’exécute pas la fonction', async () => {
    const db = await baseAvecAppareils();

    await expect(
      avecAppareil(db, APPAREIL_A, () =>
        db.query(
          `insert into public.pack_openings (user_id, cle, cards)
           values ($1, 'forgee', '[{"id":"x","rarity":"1D"}]'::jsonb)`,
          [APPAREIL_A]
        )
      )
    ).rejects.toThrow(/permission denied/i);

    await expect(
      avecAppareil(db, APPAREIL_A, () =>
        db.query('select public.crediter_arrivage($1, $2::jsonb)', ['forgee', JSON.stringify(CARTES)])
      )
    ).rejects.toThrow(/permission denied/i);

    expect(await ouvertures(db, APPAREIL_A)).toBe(0);
    await db.close();
  });

  it('la migration se rejoue sur une base déjà à jour', async () => {
    const fichier = fichiersMigrations().find((sql) => sql.includes('create table if not exists public.pack_openings'));
    if (!fichier) throw new Error('supabase/migrations/0024_pack_openings.sql introuvable');

    const db = await baseAvecAppareils(`${migrations()}\n${fichier}`);
    expect(await crediter(db, APPAREIL_A, 'rejeu', CARTES)).toEqual(CARTES);
    expect(await ouvertures(db, APPAREIL_A)).toBe(1);
    await db.close();
  });

  describe('le serveur refuse un compte non approuvé (#789, D-199 (4), migration 0028)', () => {
    it('un compte en attente ou refusé n’ouvre rien : ni ligne, ni carte', async () => {
      const db = await baseAvecAppareils();
      await creerCompte(db, APPAREIL_A, { etat: 'en attente' });
      await creerCompte(db, APPAREIL_B, { etat: 'refuse' });

      await expect(crediter(db, APPAREIL_A, 'attente-1', CARTES)).rejects.toThrow(/arrivage_compte_non_approuve/);
      await expect(crediter(db, APPAREIL_B, 'refus-1', CARTES)).rejects.toThrow(/arrivage_compte_non_approuve/);

      expect(await ouvertures(db, APPAREIL_A)).toBe(0);
      expect(await ouvertures(db, APPAREIL_B)).toBe(0);
      expect(await quantite(db, APPAREIL_A, 'sse-infirmier-site')).toBe(0);
      await db.close();
    });

    it('le même compte ouvre dès qu’il est approuvé, et un administrateur passe', async () => {
      const db = await baseAvecAppareils();
      await creerCompte(db, APPAREIL_A, { etat: 'en attente' });
      await expect(crediter(db, APPAREIL_A, 'avant', CARTES)).rejects.toThrow(/arrivage_compte_non_approuve/);

      await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
      expect(await crediter(db, APPAREIL_A, 'apres', CARTES)).toEqual(CARTES);
      expect(await ouvertures(db, APPAREIL_A)).toBe(1);

      await creerCompte(db, ADMIN, { etat: 'en attente', administrateur: true });
      expect(await crediter(db, ADMIN, 'admin', CARTES)).toEqual(CARTES);
      await db.close();
    });

    it('le refus est un défaut de privilège (403 côté Edge Function), pas une erreur de saisie', async () => {
      const db = await baseAvecAppareils();
      await creerCompte(db, APPAREIL_A, { etat: 'en attente' });
      await expect(crediter(db, APPAREIL_A, 'attente-2', CARTES)).rejects.toMatchObject({ code: '42501' });
      await db.close();
    });
  });

  describe('le contrôle mord (#112)', () => {
    it('la garde d’approbation retirée, un compte en attente ouvre un Arrivage', async () => {
      // Le cas fautif : sans `compte_approuve()` dans la fonction, le bouton grisé du client
      // serait la seule barrière — et un client bricolé s'ouvrirait des Arrivages.
      // L'ancre est le **message** de la garde : `if not public.compte_approuve()` existe aussi
      // dans 0006 et 0007, et l'on mordrait la mauvaise fonction.
      const garde = /if not public\.compte_approuve\(\) then(\s+raise exception 'arrivage_compte_non_approuve)/;
      const mutee = migrations().replace(garde, 'if false then$1');
      expect(mutee).not.toBe(migrations());
      const db = await baseAvecAppareils(mutee);
      await creerCompte(db, APPAREIL_A, { etat: 'en attente' });

      expect(await crediter(db, APPAREIL_A, 'fautif', CARTES)).toEqual(CARTES);
      expect(await ouvertures(db, APPAREIL_A)).toBe(1);
      await db.close();
    });

    it('l’unicité de la clé retirée, la même clé crédite deux fois', async () => {
      // Le cas fautif : sans la contrainte, le `on conflict` ne s'applique plus et la même
      // clé repasse par le crédit. C'est exactement ce que la 0024 empêche.
      const mutee = migrations()
        .replace(
          'constraint pack_openings_cle_unique unique (user_id, cle)',
          'constraint pack_openings_cle_unique unique (id)'
        )
        .replace('on conflict on constraint pack_openings_cle_unique do nothing', '');
      const db = await baseAvecAppareils(mutee);

      await crediter(db, APPAREIL_A, 'clic-1', CARTES);
      await crediter(db, APPAREIL_A, 'clic-1', CARTES);

      expect(await quantite(db, APPAREIL_A, 'sse-infirmier-site')).toBe(4);
      expect(await ouvertures(db, APPAREIL_A)).toBe(2);
      await db.close();
    });
  });
});
