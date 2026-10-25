// @vitest-environment node
/**
 * Le mur et ses règles d'accès (#135).
 *
 * On joue la **migration réelle** — les fichiers de `supabase/migrations/`, lus sur disque et
 * appliqués dans l'ordre de leur nom — dans **PGlite** : PostgreSQL en WASM, RLS comprise.
 * Rien n'est recopié ici : une copie garderait la copie, pas le schéma qu'on applique pour de
 * vrai (leçon de #101 / #107 / #103, ticket #112).
 *
 * Le shim ci-dessous est ce que Supabase fournit déjà à côté d'une migration : le schéma
 * `auth`, `auth.uid()` et les rôles `authenticated` / `anon`. Il ne fait **pas** partie de la
 * migration, et c'est aussi le seule endroit où l'on choisit l'appareil :
 *
 * ```sql
 * set role authenticated;
 * set request.jwt.claim.sub = '<uuid de l'appareil>';
 * ```
 *
 * **Piège mesuré (21/10/2026)** : une modification ou une suppression refusée par RLS ne lève
 * **pas** d'erreur — elle porte sur **0 ligne**. Un `UPDATE` sans `RETURNING` renvoie donc
 * 0 ligne qu'il soit accepté ou refusé, et une assertion sur `rows.length` passerait pour la
 * mauvaise raison. D'où les `RETURNING *` partout où l'on veut distinguer « refusé » de
 * « accepté sans ligne ».
 *
 * **Le contrôle mord** : le dernier bloc rejoue le même scénario contre une migration **mutée**
 * (les conditions des politiques remplacées par `true`) et **exige** d'y constater la fuite.
 * Une garde qui passerait quoi qu'il arrive ne garderait rien (#112).
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

/** La migration du mur, seule : une nouvelle migration ne doit pas décaler ses motifs. */
const MIGRATION_MUR = fichiersMigrations().find((sql) => sql.includes('create table public.postits'));
if (!MIGRATION_MUR) throw new Error('supabase/migrations/0001_mur.sql introuvable');

/** Colle un post-it au nom de l'appareil, avec les champs du contrat (`docs/BOITE-A-IDEES.md` §3). */
function coller(db: Base, appareil: string, id: string, titre = 'Le bouton Fin du tour reste grise') {
  return avecAppareil(db, appareil, () =>
    db.query(
      `insert into public.postits (id, kind, titre, texte, ecran, pseudo, version)
       values ($1, 'IP', $2, 'Texte du retour.', 'Combat', 'Employe 404', 'Alpha · 0.1.2')
       returning *`,
      [id, titre],
    ),
  );
}

describe('le mur — schéma et règles d’accès (#135)', () => {
  let db: Base;

  beforeAll(async () => {
    db = await baseAvecAppareils();
  });

  afterAll(async () => {
    await db.close();
  });

  it('A colle un post-it à son nom, et B le lit : chacun lit tout le mur', async () => {
    const colle = await coller(db, APPAREIL_A, 'p-001');
    expect(colle.rows).toHaveLength(1);
    expect(colle.rows[0].auteur).toBe(APPAREIL_A);

    const lu = await avecAppareil(db, APPAREIL_B, () =>
      db.query('select id, titre, auteur from public.postits where id = $1', ['p-001']),
    );
    expect(lu.rows).toHaveLength(1);
    expect(lu.rows[0].titre).toBe('Le bouton Fin du tour reste grise');
  });

  it('B ne peut pas écrire un post-it au nom de A', async () => {
    await expect(
      avecAppareil(db, APPAREIL_B, () =>
        db.query(
          `insert into public.postits (id, kind, titre, texte, version, auteur)
           values ('p-002', 'OUF', 'Pirate', 'Pas de moi.', 'Alpha · 0.1.2', $1)
           returning *`,
          [APPAREIL_A],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('B ne peut pas modifier le post-it de A — RETURNING * rend 0 ligne, sans erreur', async () => {
    // La colonne `statut` est bien dans le grant (0006, le tri), donc le refus vient de la
    // **politique** : c'est celui que ce test garde.
    const attaque = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`update public.postits set statut = 'fait' where id = 'p-001' returning *`),
    );
    expect(attaque.rows).toHaveLength(0);

    // Les colonnes du texte, elles, ne sont plus données à `authenticated` du tout (0006) :
    // le refus tombe avant la RLS, et c'est ce qui empêche un administrateur de réécrire
    // le post-it de quelqu'un d'autre (#139).
    await expect(
      avecAppareil(db, APPAREIL_B, () =>
        db.query(`update public.postits set titre = 'Pirate' where id = 'p-001' returning *`),
      ),
    ).rejects.toThrow(/permission denied for table postits/);

    // La ligne est intacte : le refus n'a rien changé en douce.
    const relu = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`select titre, statut from public.postits where id = 'p-001'`),
    );
    expect(relu.rows[0]).toEqual({ titre: 'Le bouton Fin du tour reste grise', statut: 'en attente' });
  });

  it('B ne peut pas supprimer le post-it de A', async () => {
    const attaque = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`delete from public.postits where id = 'p-001' returning *`),
    );
    expect(attaque.rows).toHaveLength(0);

    const reste = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`select id from public.postits where id = 'p-001'`),
    );
    expect(reste.rows).toHaveLength(1);
  });

  it('A corrige le sien, et B corrige le sien — par `corriger_postit` (#139)', async () => {
    // Depuis la 0006, un auteur ne modifie plus sa ligne directement : le titre et le texte
    // passent par la fonction, qui vérifie l'auteur **et** le statut.
    const sienA = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`select * from public.corriger_postit('p-001', 'Corrigé par A', 'Le texte corrigé.')`),
    );
    expect(sienA.rows).toHaveLength(1);
    expect(sienA.rows[0]).toMatchObject({ titre: 'Corrigé par A', texte: 'Le texte corrigé.' });

    await coller(db, APPAREIL_B, 'p-003');
    const sienB = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`select * from public.corriger_postit('p-003', 'Le mien', 'Texte du mien.')`),
    );
    expect(sienB.rows).toHaveLength(1);
    expect(sienB.rows[0].titre).toBe('Le mien');
  });

  it('B ne touche ni aux votes ni aux commentaires de A', async () => {
    // A vote pour le post-it de B (p-003) : on ne vote pas pour le sien (0004, pouces.test.ts).
    const vote = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`insert into public.votes (postit_id, sens) values ('p-003', 'up') returning *`),
    );
    expect(vote.rows[0].votant).toBe(APPAREIL_A);
    const commentaire = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`insert into public.commentaires (postit_id, texte) values ('p-001', 'Pareil.') returning *`),
    );
    expect(commentaire.rows[0].auteur).toBe(APPAREIL_A);

    // B lit tout (les compteurs de la vue en dépendent)…
    const lus = await avecAppareil(db, APPAREIL_B, () =>
      db.query('select (select count(*) from public.votes) as votes, (select count(*) from public.commentaires) as commentaires'),
    );
    expect(Number(lus.rows[0].votes)).toBe(1);
    expect(Number(lus.rows[0].commentaires)).toBe(1);

    // … mais ne réécrit ni ne supprime les lignes de A.
    const voteVolé = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`update public.votes set sens = 'down' where postit_id = 'p-003' returning *`),
    );
    expect(voteVolé.rows).toHaveLength(0);
    const voteSupprimé = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`delete from public.votes where postit_id = 'p-003' returning *`),
    );
    expect(voteSupprimé.rows).toHaveLength(0);
    const commentaireSupprimé = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`delete from public.commentaires where postit_id = 'p-001' returning *`),
    );
    expect(commentaireSupprimé.rows).toHaveLength(0);
    const commentaireVolé = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`update public.commentaires set texte = 'Pirate' where postit_id = 'p-001' returning *`),
    );
    expect(commentaireVolé.rows).toHaveLength(0);
  });

  it('B vote en son nom, et ne vote qu’une fois par post-it', async () => {
    const vote = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`insert into public.votes (postit_id, sens) values ('p-001', 'down') returning *`),
    );
    expect(vote.rows[0].votant).toBe(APPAREIL_B);

    await expect(
      avecAppareil(db, APPAREIL_B, () =>
        db.query(`insert into public.votes (postit_id, sens) values ('p-001', 'up') returning *`),
      ),
    ).rejects.toThrow(/duplicate key/);

    // Changer d'avis, c'est modifier sa propre ligne.
    const change = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`update public.votes set sens = 'up' where postit_id = 'p-001' returning *`),
    );
    expect(change.rows).toHaveLength(1);
    expect(change.rows[0].sens).toBe('up');
  });

  it('la vue recompose la forme du contrat : position en pourcentage, votes { up, down }', async () => {
    const mur = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`select id, position, votes from public.postits_avec_votes where id = 'p-001'`),
    );
    expect(mur.rows[0].position).toEqual({ x: 50, y: 50, angle: 0 });
    // Le seul vote de p-001 : le « up » de B (après son changement d'avis). A n'a pas le droit
    // de voter pour son propre post-it (0004).
    expect(mur.rows[0].votes).toEqual({ up: 1, down: 0 });
  });

  it('les contraintes du contrat tiennent : statuts, raison d’un écarté, position, famille', async () => {
    // Les contraintes se vérifient **en superutilisateur** : depuis la 0006, seul un
    // administrateur écrit `statut`, et plus personne n'écrit `position_*` depuis le client
    // (le placement n'écrit que le fichier). Ce sont les `check` de la 0001 qu'on éprouve
    // ici, pas un droit — les droits sont dans `mur-ecriture.test.ts`.
    const casse = (sql: string) => db.query(sql);

    await expect(
      casse(`update public.postits set statut = 'ecarte' where id = 'p-001'`),
    ).rejects.toThrow(/postits_statut_check/);

    // « Un post-it écarté sans raison est un mur mort » (§2, D-059).
    await expect(
      casse(`update public.postits set statut = 'écarté' where id = 'p-001'`),
    ).rejects.toThrow(/postits_ecarte_a_sa_raison/);

    const ecarte = await casse(
      `update public.postits set statut = 'écarté', raison = 'Hors perimetre.' where id = 'p-001' returning *`,
    );
    expect(ecarte.rows).toHaveLength(1);

    await expect(
      coller(db, APPAREIL_A, 'p-004').then(() =>
        casse(`update public.postits set position_angle = 9 where id = 'p-004' returning *`),
      ),
    ).rejects.toThrow(/postits_position_angle_check/);

    await expect(
      casse(
        `insert into public.postits (id, kind, titre, texte, version, auteur)
         values ('p-006', 'BUG', 'Famille inconnue', 'Texte.', 'Alpha · 0.1.2', '${APPAREIL_A}') returning *`,
      ),
    ).rejects.toThrow(/postits_kind_check/);

    // Et la règle de la 0006 tient : un auteur qui n'est pas administrateur ne déplace plus
    // son propre statut — 0 ligne, sans erreur (le piège de RLS).
    const sien = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`update public.postits set statut = 'retenu' where id = 'p-004' returning *`),
    );
    expect(sien.rows).toHaveLength(0);
  });

  it('un appareil non identifié (anon) n’a aucun accès aux tables', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select count(*) from public.postits')).rejects.toThrow(/permission denied/);
      // Sans signature, on n'écrit pas non plus : les droits sont donnés à `authenticated`.
      await expect(
        db.query(
          `insert into public.postits (id, kind, titre, texte, version)
           values ('p-anon', 'IP', 'Anonyme', 'Texte.', 'Alpha · 0.1.6') returning *`,
        ),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });

  it('sans identité (`authenticated` sans `auth.uid()`), l’insertion est refusée (#136)', async () => {
    // Le client signe l'appareil *avant* d'écrire (`identiteAppareil`) : cette garde prouve
    // que l'ordre compte. Sans sujet, `auteur` retombe sur `auth.uid()` = null, et la
    // politique d'insertion ne peut pas être satisfaite.
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '';`);
    try {
      // 1. Sans `auteur` explicite, la colonne `not null` retombe sur `auth.uid()` = null.
      await expect(
        db.query(
          `insert into public.postits (id, kind, titre, texte, version)
           values ('p-sans-identite', 'IP', 'Sans identité', 'Texte.', 'Alpha · 0.1.6') returning *`,
        ),
      ).rejects.toThrow(/null value in column "auteur"|row-level security/);

      // 2. Avec un `auteur` choisi, la politique refuse de signer au nom d'un autre.
      await expect(
        db.query(
          `insert into public.postits (id, kind, titre, texte, version, auteur)
           values ('p-usurpe-sans-session', 'IP', 'Sans identité', 'Texte.', 'Alpha · 0.1.6', $1) returning *`,
          [APPAREIL_A],
        ),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await db.exec('reset role; reset request.jwt.claim.sub;');
    }

    const reste = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`select id from public.postits where id = 'p-sans-identite'`),
    );
    expect(reste.rows).toHaveLength(0);
  });
});

describe('le contrôle mord — la fuite doit apparaître sur la migration mutée', () => {
  /**
   * La mutation remplace **la condition des politiques** par `true` — c'est ce qui distingue
   * cette garde d'une suppression de politique : une politique supprimée, en RLS, est
   * *default-deny*, donc le test passerait sans rien prouver.
   */
  const MOTIFS = ['auteur = auth.uid()', 'votant = auth.uid()'];

  function muter(sql: string): string {
    let mutee = sql;
    // Le compte est une ancre : si les conditions changent de forme, la mutation se décale en
    // silence et la garde ne garde plus rien. On préfère un échec explicite. Il se compte sur
    // **la migration du mur seule** : une migration suivante (les combats, #173) porte elle
    // aussi `auteur = auth.uid()` et décalerait le compte sans rien dire du mur.
    expect(sql.split(MOTIFS[0]).length - 1).toBe(8);
    expect(sql.split(MOTIFS[1]).length - 1).toBe(4);
    for (const motif of MOTIFS) {
      mutee = mutee.replaceAll(motif, 'true');
    }
    expect(mutee).not.toBe(sql);
    return mutee;
  }

  /** Toutes les migrations, celle du mur remplacée par sa version mutée. */
  function migrationsMutees(): string {
    const murMute = muter(MIGRATION_MUR);
    // Depuis la 0005 (D-088), les politiques d'écriture du mur sont **remplacées** avec la
    // condition d'approbation. Muter la 0001 seule laisserait la 0005 décider : on applique
    // donc la même neutralisation à toutes les copies du motif, où qu'elles vivent.
    //
    // Depuis la 0006, le **grant de colonnes** refuse `titre` avant même la RLS : une
    // mutation des seules conditions ne prouverait plus rien (B serait refusé par les
    // droits, pas par la politique). On rétablit donc le grant large de la 0001, et c'est
    // bien la politique qu'on mesure.
    return migrations()
      .replace(MIGRATION_MUR, () => murMute)
      // `p.auteur` d'abord : sans cela, le remplacement global laisserait `p.true`.
      .replaceAll('p.auteur = auth.uid()', 'true')
      .replaceAll('auteur = auth.uid()', 'true')
      .replaceAll('votant = auth.uid()', 'true')
      .replaceAll(
        `grant update (statut, raison, ticket) on public.postits to authenticated;`,
        'grant update on public.postits to authenticated;',
      )
      // Et la politique de la 0006, seule rescapée : elle refuse l'`update` à qui n'est pas
      // administrateur, donc une mutation des conditions de la 0001 ne suffirait pas.
      .replace(
        `create policy "postits : l'administration trie"
  on public.postits for update to authenticated
  using (public.est_administrateur())
  with check (public.est_administrateur());`,
        `create policy "postits : l'administration trie"
  on public.postits for update to authenticated
  using (true)
  with check (true);`,
      );
  }

  let db: Base;

  beforeAll(async () => {
    db = await baseAvecAppareils(migrationsMutees());
  });

  afterAll(async () => {
    await db.close();
  });

  it('sans la condition, B modifie, supprime et usurpe les lignes de A', async () => {
    const colle = await coller(db, APPAREIL_A, 'p-fuite');
    expect(colle.rows).toHaveLength(1);

    // 1. B lit déjà tout (inchangé)…
    const lu = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`select id from public.postits where id = 'p-fuite'`),
    );
    expect(lu.rows).toHaveLength(1);

    // 2. …mais ici il **modifie** le post-it de A : 1 ligne, donc la fuite est bien constatée.
    const modifie = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`update public.postits set titre = 'Pirate' where id = 'p-fuite' returning *`),
    );
    expect(modifie.rows).toHaveLength(1);
    expect(modifie.rows[0].titre).toBe('Pirate');

    // 3. Il supprime aussi la ligne d'autrui.
    const supprime = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`delete from public.postits where id = 'p-fuite' returning *`),
    );
    expect(supprime.rows).toHaveLength(1);

    // 4. Et il peut signer au nom de A, ce que la politique d'insertion refusait.
    const usurpe = await avecAppareil(db, APPAREIL_B, () =>
      db.query(
        `insert into public.postits (id, kind, titre, texte, version, auteur)
         values ('p-usurpe', 'IP', 'Au nom de A', 'Signe A.', 'Alpha · 0.1.2', $1) returning *`,
        [APPAREIL_A],
      ),
    );
    expect(usurpe.rows).toHaveLength(1);
    expect(usurpe.rows[0].auteur).toBe(APPAREIL_A);
  });
});
