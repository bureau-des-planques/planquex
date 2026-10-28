// @vitest-environment node
// Lent : un cas par scénario, chacun avec son SQL ; `base()` reprend une instance PGlite vidée au lieu de la remonter (D-143 (4), #422) — il reste le travail SQL, pas la règle testée.
/**
 * Les comptes et la validation manuelle de l'alpha — la migration `0005_comptes.sql` (#181,
 * D-088).
 *
 * Même banc que les autres gardes : les migrations **réelles**, lues sur disque et jouées
 * dans PGlite (PostgreSQL en WASM, RLS comprise), en rôle `authenticated`. Rien n'est
 * recopié de la migration.
 *
 * Ce que la base doit tenir, et que ce fichier éprouve :
 *
 *   (a) un compte **en attente** ne peut pas écrire — ni post-it, ni vote, ni trace de
 *       combat ;
 *   (b) un compte **approuvé** le peut ;
 *   (c) un **non-administrateur** n'approuve et ne refuse personne (0 ligne, sans erreur —
 *       c'est le piège de RLS : une modification refusée ne lève pas, elle ne touche rien) ;
 *   (d) un compte **ne s'approuve pas lui-même**, et ne change pas son drapeau
 *       `administrateur` ;
 *   (e) la table des comptes **n'est pas modifiable** par un non-administrateur ;
 *   (f) un compte **lit sa propre ligne**, pas celle d'un autre ;
 *   (g) la ligne naît **automatiquement** à la première connexion (`auth.users` →
 *       déclencheur), et les post-its **déjà en base** restent lisibles mais figés ;
 *   (h) la **médaille de la période d'essai** (0016, D-130 (3)) est posée par le serveur, lue
 *       par son compte, et **jamais** écrite par un client — elle ne se déduit pas d'une date ;
 *       et la 0016 ne porte **aucune** ligne de droit qui nomme ses colonnes, car un `revoke` de
 *       colonne ne retire rien (#372).
 *
 * **Le contrôle mord** (#112) : chaque contrôle est neutralisé tour à tour — la 0005 est
 * relue, un motif précis est remplacé, puis rejouée — et le geste fautif doit alors donner
 * l'issue **inverse**. Les motifs sont des ancres : si la migration change de forme, la
 * mutation échoue bruyamment au lieu de se décaler en silence.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ADMIN,
  APPAREIL_A,
  APPAREIL_B,
  APPAREIL_C,
  avecAppareil,
  base,
  baseAvecAppareils,
  creerCompte,
  fichiersMigrations,
  migrations,
  type Base
} from './pglite';

const MIGRATION_COMPTES = fichiersMigrations().find((sql) => sql.includes('create table if not exists public.comptes'));
if (!MIGRATION_COMPTES) throw new Error('supabase/migrations/0005_comptes.sql introuvable');

/** La médaille de la période d'essai (#346, D-130 (3)) — sa colonne, et sa fermeture. */
const MIGRATION_MEDAILLE = fichiersMigrations().find((sql) => sql.includes('medaille_periode_essai'));
if (!MIGRATION_MEDAILLE) throw new Error('supabase/migrations/0016_medaille_periode_essai.sql introuvable');

const DECKS = {
  playerDeck: ['sse-medecin-travail', 'management-responsable-unite'],
  aiDeck: ['atelier-responsable-process']
};
const TYPES_CAFE = { playerCafeTypes: ['SSE'], aiCafeTypes: ['MANAGEMENT'] };
const JOURNAL = [{ type: 'endTurn' }];

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
     values ($1, 'IP', 'Titre', 'Texte.', 'Alpha · 0.1.8') returning *`,
    [id]
  );

const voter = (db: Base, appareil: string, postit: string) =>
  tenter(db, appareil, `insert into public.votes (postit_id, sens) values ($1, 'up') returning *`, [postit]);

const combat = (db: Base, appareil: string) =>
  tenter(
    db,
    appareil,
    `insert into public.combats (mode, graine, decks, types_cafe, journal)
     values ('solo', 42, $1::jsonb, $2::jsonb, $3::jsonb) returning *`,
    [JSON.stringify(DECKS), JSON.stringify(TYPES_CAFE), JSON.stringify(JOURNAL)]
  );

/**
 * Une décision, vue comme une tentative. Une modification refusée par RLS **ne lève pas** :
 * elle porte sur 0 ligne. On la déclare donc refusée ici — sans quoi « rien n'a changé »
 * passerait pour un succès, le piège que `mur.test.ts` documente.
 */
const decider = async (
  db: Base,
  acteur: string,
  cible: string,
  etat: 'en attente' | 'approuve' | 'refuse',
  raison = ''
): Promise<Issue> => {
  const issue = await tenter(db, acteur, `update public.comptes set etat = $2, raison = $3 where id = $1 returning *`, [
    cible,
    etat,
    raison
  ]);
  if (issue.accepte && issue.lignes.length === 0) {
    return { accepte: false, message: '0 ligne touchée (la RLS a filtré la décision)' };
  }
  return issue;
};

const etatDe = async (db: Base, cible: string) => {
  // Lecture en superutilisateur : la ligne d'un autre n'est pas lisible par un compte.
  const lu = await db.query<{ etat: string; administrateur: boolean; raison: string }>(
    'select etat, administrateur, raison from public.comptes where id = $1',
    [cible]
  );
  return lu.rows[0];
};

/**
 * Le monde de départ des scénarios : A et B approuvés, C **en attente**, un administrateur
 * approuvé. B a collé un post-it (`p-b`) pour que A puisse voter sans voter pour lui-même.
 */
async function monde(db: Base) {
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_C, { etat: 'en attente' });
  await creerCompte(db, ADMIN, { etat: 'approuve', administrateur: true });
  accepte(await coller(db, APPAREIL_B, 'p-b'));
}

describe('les comptes — la 0005 (#181, D-088)', () => {
  let db: Base;

  beforeAll(async () => {
    db = await base();
    await monde(db);
  });
  afterAll(async () => {
    await db.close();
  });

  it('(a) un compte en attente ne colle pas de post-it — la base refuse', async () => {
    refuse(await coller(db, APPAREIL_C, 'p-attente'), /row-level security/);
    const reste = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`select id from public.postits where id = 'p-attente'`)
    );
    expect(reste.rows).toHaveLength(0);
  });

  it('(a) un compte en attente ne vote pas, même pour le post-it d’un autre', async () => {
    refuse(await voter(db, APPAREIL_C, 'p-b'), /row-level security/);
    const votes = await avecAppareil(db, APPAREIL_A, () => db.query(`select count(*) as n from public.votes`));
    expect(Number(votes.rows[0].n)).toBe(0);
  });

  it('(a) un compte en attente ne dépose pas de trace de combat', async () => {
    refuse(await combat(db, APPAREIL_C), /row-level security/);
    const traces = await avecAppareil(db, APPAREIL_A, () => db.query(`select count(*) as n from public.combats`));
    expect(Number(traces.rows[0].n)).toBe(0);
  });

  it('(b) un compte approuvé écrit : post-it, vote et trace de combat', async () => {
    accepte(await coller(db, APPAREIL_A, 'p-a'));
    accepte(await voter(db, APPAREIL_A, 'p-b'));
    accepte(await combat(db, APPAREIL_A));

    const traces = await avecAppareil(db, APPAREIL_A, () => db.query(`select auteur from public.combats`));
    expect(traces.rows).toHaveLength(1);
    expect(traces.rows[0].auteur).toBe(APPAREIL_A);
  });

  it('(c) un compte non administrateur n’approuve personne : 0 ligne, sans erreur', async () => {
    refuse(await decider(db, APPAREIL_B, APPAREIL_C, 'approuve'), /0 ligne/);
    expect((await etatDe(db, APPAREIL_C)).etat).toBe('en attente');
  });

  it('(c) il ne refuse pas non plus, même avec une raison', async () => {
    refuse(await decider(db, APPAREIL_B, APPAREIL_C, 'refuse', 'Pas envie.'), /0 ligne/);
    expect((await etatDe(db, APPAREIL_C)).etat).toBe('en attente');
  });

  it('(d) un compte ne s’approuve pas lui-même : la politique d’update le refuse', async () => {
    refuse(await decider(db, APPAREIL_C, APPAREIL_C, 'approuve'), /0 ligne/);
    expect((await etatDe(db, APPAREIL_C)).etat).toBe('en attente');
    // Et il ne peut pas se refuser non plus (ce serait se fermer une porte qu'il n'a pas).
    refuse(await decider(db, APPAREIL_C, APPAREIL_C, 'refuse', 'Moi non.'), /0 ligne/);
    expect((await etatDe(db, APPAREIL_C)).etat).toBe('en attente');
  });

  it('(d) un compte ne change pas son drapeau administrateur — permission refusée', async () => {
    refuse(
      await tenter(db, APPAREIL_C, `update public.comptes set administrateur = true where id = $1 returning *`, [
        APPAREIL_C
      ]),
      /permission denied/
    );
    expect((await etatDe(db, APPAREIL_C)).administrateur).toBe(false);
  });

  it('(e) un non-administrateur ne modifie pas la table : insertion et suppression refusées', async () => {
    refuse(
      await tenter(
        db,
        APPAREIL_B,
        `insert into public.comptes (id, courriel) values (gen_random_uuid(), 'intrus@exemple.test') returning *`
      ),
      /permission denied/
    );
    refuse(
      await tenter(db, APPAREIL_B, `delete from public.comptes where id = $1 returning *`, [APPAREIL_C]),
      /permission denied/
    );
    refuse(
      await tenter(
        db,
        APPAREIL_B,
        `update public.comptes set courriel = 'autre@exemple.test' where id = $1 returning *`,
        [APPAREIL_C]
      ),
      /permission denied/
    );
    expect((await etatDe(db, APPAREIL_C)).etat).toBe('en attente');
  });

  it('(f) chacun lit sa ligne, et pas celle d’un autre', async () => {
    const sien = await avecAppareil(db, APPAREIL_C, () =>
      db.query(`select id, etat from public.comptes where id = $1`, [APPAREIL_C])
    );
    expect(sien.rows).toHaveLength(1);
    expect(sien.rows[0].etat).toBe('en attente');

    const autre = await avecAppareil(db, APPAREIL_C, () =>
      db.query(`select id from public.comptes where id = $1`, [APPAREIL_A])
    );
    expect(autre.rows).toHaveLength(0);

    // La liste entière est aussi vide pour lui : la RLS filtre, elle ne lève pas.
    const tous = await avecAppareil(db, APPAREIL_C, () => db.query(`select id from public.comptes`));
    expect(tous.rows).toHaveLength(1);
  });

  it('l’administrateur approuve : la ligne est datée et signée, puis le compte écrit', async () => {
    const decision = await decider(db, ADMIN, APPAREIL_C, 'approuve');
    accepte(decision);
    if (decision.accepte) {
      expect(decision.lignes).toHaveLength(1);
      expect(decision.lignes[0].etat).toBe('approuve');
      expect(decision.lignes[0].decide_par).toBe(ADMIN);
      expect(decision.lignes[0].decide_le).not.toBeNull();
    }
    expect((await etatDe(db, APPAREIL_C)).etat).toBe('approuve');

    accepte(await coller(db, APPAREIL_C, 'p-c'));
    accepte(await voter(db, APPAREIL_C, 'p-b'));
    accepte(await combat(db, APPAREIL_C));
  });

  it('l’administrateur refuse avec sa raison ; un refus muet est refusé par la base', async () => {
    refuse(await decider(db, ADMIN, APPAREIL_C, 'refuse'), /comptes_refus_a_sa_raison/);
    expect((await etatDe(db, APPAREIL_C)).etat).toBe('approuve');

    const refus = await decider(db, ADMIN, APPAREIL_C, 'refuse', 'Pas un testeur.');
    accepte(refus);
    if (refus.accepte) expect(refus.lignes[0].raison).toBe('Pas un testeur.');

    // Un compte refusé est aussi fermé qu'un compte en attente.
    refuse(await coller(db, APPAREIL_C, 'p-refuse'), /row-level security/);
  });

  it('(g) la première connexion crée une ligne en attente, et le courriel suit', async () => {
    const nouveau = '55555555-5555-4555-8555-555555555555';
    await db.query(`insert into auth.users (id, email) values ($1, 'nouveau@exemple.test')`, [nouveau]);

    const cree = await etatDe(db, nouveau);
    expect(cree).toBeDefined();
    expect(cree.etat).toBe('en attente');
    expect(cree.administrateur).toBe(false);
    // Les comptes d'avant la migration ont été recopiés, eux aussi (email non nul).
    const recopie = await db.query<{ courriel: string }>('select courriel from public.comptes where id = $1', [
      APPAREIL_A
    ]);
    expect(recopie.rows[0].courriel).toBe(`${APPAREIL_A.slice(0, 8)}@exemple.test`);

    // Mettre à jour le courriel côté Auth met la ligne à jour ; l'état ne bouge pas.
    await db.query(`update auth.users set email = 'change@exemple.test' where id = $1`, [nouveau]);
    const lu = await db.query<{ courriel: string; etat: string }>(
      'select courriel, etat from public.comptes where id = $1',
      [nouveau]
    );
    expect(lu.rows[0].courriel).toBe('change@exemple.test');
    expect(lu.rows[0].etat).toBe('en attente');
  });

  it('la migration est idempotente : rejouée, elle ne lève rien et ne change aucun état', async () => {
    const avant = await etatDe(db, APPAREIL_C);
    await db.exec(MIGRATION_COMPTES);
    expect(await etatDe(db, APPAREIL_C)).toEqual(avant);
  });

  it('`anon` n’a aucun accès aux comptes', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select count(*) from public.comptes')).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });
});

// ---------------------------------------------------------------------------------------------
// La médaille de la période d'essai (0016, #346, D-130 (3))
// ---------------------------------------------------------------------------------------------

/** La médaille telle que la base la garde : le drapeau, et la date qui l'accompagne. */
async function medailleDe(db: Base, cible: string) {
  const lu = await db.query<{ medaille: boolean; le: unknown }>(
    `select medaille_periode_essai as medaille, medaille_periode_essai_le as le
       from public.comptes where id = $1`,
    [cible]
  );
  return lu.rows[0];
}

/**
 * Le geste du reset (D-130 (4)) : le serveur d'administration pose le drapeau **et** sa date,
 * d'un seul `update` — la contrainte `comptes_medaille_a_sa_date` exige l'accord des deux.
 */
const attribuer = (db: Base, cible: string) =>
  db.query(
    `update public.comptes
        set medaille_periode_essai = true,
            medaille_periode_essai_le = now()
      where id = $1`,
    [cible]
  );

/** La tentative d'un client : il écrit lui-même les deux colonnes de la médaille. */
const attribuerParClient = (db: Base, acteur: string, cible: string = acteur): Promise<Issue> =>
  tenter(
    db,
    acteur,
    `update public.comptes
        set medaille_periode_essai = true,
            medaille_periode_essai_le = now()
      where id = $1 returning medaille_periode_essai`,
    [cible]
  );

describe('la Médaille de la période d’essai — la 0016 (#346, D-130 (3))', () => {
  it('un compte neuf n’a pas la médaille : fausse, et sans date', async () => {
    const db = await base();
    try {
      await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
      await creerCompte(db, APPAREIL_C, { etat: 'en attente' });
      for (const id of [APPAREIL_A, APPAREIL_C]) {
        expect(await medailleDe(db, id), id).toEqual({ medaille: false, le: null });
      }
    } finally {
      await db.close();
    }
  });

  it('elle ne se déduit pas de la date de création : deux comptes approuvés ensemble, un seul la reçoit', async () => {
    const db = await base();
    try {
      await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
      await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
      // Les deux lignes naissent du même déclencheur, dans la même seconde : si la médaille se
      // calculait sur `created_at`, les deux l'auraient. Elle ne l'ont pas.
      expect((await medailleDe(db, APPAREIL_A)).medaille).toBe(false);
      expect((await medailleDe(db, APPAREIL_B)).medaille).toBe(false);

      await attribuer(db, APPAREIL_B);

      // Le compte de l'alpha est récompensé ; celui qui a été approuvé après coup ne l'est pas.
      const gagnant = await medailleDe(db, APPAREIL_B);
      expect(gagnant.medaille).toBe(true);
      expect(gagnant.le).not.toBeNull();
      expect((await medailleDe(db, APPAREIL_A)).medaille).toBe(false);
    } finally {
      await db.close();
    }
  });

  it('le serveur l’attribue, et le compte la lit lui-même — le `select` couvre les colonnes neuves', async () => {
    const db = await base();
    try {
      await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
      await attribuer(db, APPAREIL_A);

      const lu = await avecAppareil(db, APPAREIL_A, () =>
        db.query<{ medaille: boolean; le: unknown }>(
          `select medaille_periode_essai as medaille, medaille_periode_essai_le as le
             from public.comptes where id = $1`,
          [APPAREIL_A]
        )
      );
      expect(lu.rows).toHaveLength(1);
      expect(lu.rows[0].medaille).toBe(true);
      expect(lu.rows[0].le).not.toBeNull();
    } finally {
      await db.close();
    }
  });

  it('un client ne se l’attribue pas — et un administrateur non plus : la colonne n’est pas dans son grant', async () => {
    const db = await base();
    try {
      await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
      await creerCompte(db, ADMIN, { etat: 'approuve', administrateur: true });

      refuse(await attribuerParClient(db, APPAREIL_A), /permission denied/);
      // L'administrateur passe la RLS (`est_administrateur()`) mais pas le droit de colonne :
      // c'est le `grant`, et non la politique, qui ferme la médaille.
      refuse(await attribuerParClient(db, ADMIN), /permission denied/);

      expect((await medailleDe(db, APPAREIL_A)).medaille).toBe(false);
      expect((await medailleDe(db, ADMIN)).medaille).toBe(false);
    } finally {
      await db.close();
    }
  });

  it('le drapeau et sa date ne se séparent pas : les deux lignes fausses sont refusées', async () => {
    const db = await base();
    try {
      await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
      // La médaille sans sa date : on ne saurait plus quand elle a été remise.
      await expect(
        db.query(`update public.comptes set medaille_periode_essai = true where id = $1`, [APPAREIL_A])
      ).rejects.toThrow(/comptes_medaille_a_sa_date/);
      // La date sans la médaille : le drapeau qu'on lit mentirait.
      await expect(
        db.query(`update public.comptes set medaille_periode_essai_le = now() where id = $1`, [APPAREIL_A])
      ).rejects.toThrow(/comptes_medaille_a_sa_date/);
      expect(await medailleDe(db, APPAREIL_A)).toEqual({ medaille: false, le: null });
    } finally {
      await db.close();
    }
  });

  it('rejouée, la migration ne lève rien et n’efface aucune médaille', async () => {
    const db = await base();
    try {
      await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
      await attribuer(db, APPAREIL_A);
      const avant = await medailleDe(db, APPAREIL_A);

      await db.exec(MIGRATION_MEDAILLE!);

      expect(await medailleDe(db, APPAREIL_A)).toEqual(avant);
    } finally {
      await db.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Aucune ligne de droit morte sur la médaille (#372)
// ---------------------------------------------------------------------------------------------

/**
 * Les lignes de la migration qui donnent ou retirent un droit **en nommant une colonne de la
 * médaille**. Les droits d'écriture de `authenticated` sont **colonne par colonne** depuis la
 * 0005 (`etat`, `raison`) : ces deux colonnes n'entrent dans aucun `grant`.
 *
 * D'où les deux refus, et c'est **mesuré**, pas supposé (PGlite, 27/10/2026) :
 *
 * - un `revoke all (colonne)` sur une colonne jamais accordée **ne retire rien** et ne peut pas
 *   échouer — les trois lignes que la 0016 portait ont été retirées pour ça (#372) ;
 * - un `grant` qui les nomme ouvrirait l'écriture, ce que la 0005 interdit.
 *
 * Une ligne de droit sur une autre colonne, ou une prose qui parle de `revoke`, ne compte pas :
 * les commentaires sont retirés avant la lecture.
 */
function lignesDeDroitSurLaMedaille(sql: string): string[] {
  return sql
    .split('\n')
    .map((ligne) => ligne.replace(/--.*/, '').trim())
    .filter((ligne) => /^(grant|revoke)\b/i.test(ligne) && /medaille_periode_essai/.test(ligne));
}

describe('les lignes de droit de la 0016 (#372)', () => {
  it('aucune ne nomme les colonnes de la médaille : aucune ne pourrait échouer', () => {
    expect(lignesDeDroitSurLaMedaille(MIGRATION_MEDAILLE!)).toEqual([]);
  });

  it('le contrôle mord — une révocation de colonne comme un grant sont vus', () => {
    // Ce que la 0016 portait avant #372 : trois `revoke all (colonne)`, qui ne retiraient rien.
    expect(
      lignesDeDroitSurLaMedaille('revoke all (medaille_periode_essai) on public.comptes from authenticated;')
    ).toHaveLength(1);
    expect(
      lignesDeDroitSurLaMedaille('  grant update (medaille_periode_essai_le) on public.comptes to authenticated;')
    ).toHaveLength(1);
    // Et ce qui n'est pas une ligne de droit sur la médaille reste dehors.
    expect(lignesDeDroitSurLaMedaille('grant update (etat, raison) on public.comptes to authenticated;')).toEqual([]);
    expect(lignesDeDroitSurLaMedaille('-- revoke all (medaille_periode_essai) on public.comptes from public;')).toEqual(
      []
    );
  });
});

describe('les post-its déjà en base (23/10/2026) restent lisibles et deviennent figés', () => {
  it('la 0005 ne les supprime pas, ne les rattache pas, et leur auteur anonyme ne peut plus écrire', async () => {
    // L'état d'avant la 0005 : 0001 à 0004, deux post-its d'un appareil anonyme.
    const toutes = fichiersMigrations();
    const avant = toutes.slice(0, toutes.indexOf(MIGRATION_COMPTES)).join('\n');
    const db = await base(avant);
    try {
      // Aucun compte n'existe encore : l'identité anonyme écrit comme avant D-088.
      accepte(await coller(db, APPAREIL_A, 'p-avant-1'));
      accepte(await coller(db, APPAREIL_B, 'p-avant-2'));

      await db.exec(MIGRATION_COMPTES);

      // Les deux lignes sont toujours là, lisibles, sans qu'on invente un auteur.
      const lus = await avecAppareil(db, APPAREIL_A, () =>
        db.query(`select id, auteur from public.postits order by id`)
      );
      expect(lus.rows.map((l) => l.id)).toEqual(['p-avant-1', 'p-avant-2']);
      expect(lus.rows[0].auteur).toBe(APPAREIL_A);

      // Leur auteur n'a pas de compte (identité anonyme, courriel nul) : il ne peut plus écrire.
      const sansCompte = await db.query(`select count(*) as n from public.comptes`);
      expect(Number(sansCompte.rows[0].n)).toBe(0);

      // Le refus de 0005 : l'auteur n'a pas de compte approuvé. Cette base s'arrête à la
      // 0005 (pas de 0006 : elle n'a donc pas le grant restreint de #139).
      zeroLigne(
        await tenter(db, APPAREIL_A, `update public.postits set titre = 'Réécrit' where id = 'p-avant-1' returning *`)
      );
      zeroLigne(await tenter(db, APPAREIL_A, `delete from public.postits where id = 'p-avant-1' returning *`));
      refuse(await coller(db, APPAREIL_A, 'p-apres'), /row-level security/);
    } finally {
      await db.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Le contrôle mord : chaque contrôle neutralisé laisse passer le fautif
// ---------------------------------------------------------------------------------------------

/** Remplace un motif de la 0005 ; un motif absent fait échouer bruyamment. */
function muter(motif: string, remplacement: string): string {
  const occurrences = MIGRATION_COMPTES!.split(motif).length - 1;
  expect(occurrences, `motif introuvable ou ambigu dans la 0005 : ${motif}`).toBeGreaterThan(0);
  const mutee = MIGRATION_COMPTES!.replaceAll(motif, remplacement);
  expect(mutee).not.toBe(MIGRATION_COMPTES);
  return migrations().replace(MIGRATION_COMPTES!, () => mutee);
}

const MUTATIONS: Array<{
  nom: string;
  sql: () => string;
  geste: (db: Base) => Promise<Issue>;
  attendu: 'accepte' | 'refuse';
}> = [
  {
    nom: '(a) sans la condition d’approbation du post-it → un compte en attente colle',
    sql: () =>
      muter(
        `on public.postits for insert to authenticated
  with check (auteur = auth.uid() and public.compte_approuve())`,
        `on public.postits for insert to authenticated
  with check (auteur = auth.uid())`
      ),
    geste: (db) => coller(db, APPAREIL_C, 'p-fuite'),
    attendu: 'accepte'
  },
  {
    nom: '(a) sans la condition d’approbation du vote → un compte en attente vote',
    sql: () =>
      muter(
        `on public.votes for insert to authenticated
  with check (
    votant = auth.uid()
    and public.compte_approuve()`,
        `on public.votes for insert to authenticated
  with check (
    votant = auth.uid()`
      ),
    geste: (db) => voter(db, APPAREIL_C, 'p-b'),
    attendu: 'accepte'
  },
  {
    nom: '(a) sans la condition d’approbation du combat → un compte en attente dépose',
    sql: () =>
      muter(
        `on public.combats for insert to authenticated
  with check (auteur = auth.uid() and public.compte_approuve())`,
        `on public.combats for insert to authenticated
  with check (auteur = auth.uid())`
      ),
    geste: (db) => combat(db, APPAREIL_C),
    attendu: 'accepte'
  },
  {
    nom: '(a) `compte_approuve()` neutralisée → toutes les écritures passent',
    sql: () => muter(`and (c.etat = 'approuve' or c.administrateur)`, 'and true'),
    geste: (db) => coller(db, APPAREIL_C, 'p-fuite-fonction'),
    attendu: 'accepte'
  },
  {
    nom: '(c) politique d’update des comptes neutralisée → un compte s’approuve lui-même',
    sql: () =>
      muter(
        `  using (public.est_administrateur())
  with check (public.est_administrateur());`,
        `  using (true)
  with check (true);`
      ),
    // B est approuvé mais pas administrateur ; il ne peut pas voir la ligne de C (politique
    // de lecture), donc le geste observable est **sa propre** ligne : il se ré-approuve.
    geste: (db) => decider(db, APPAREIL_B, APPAREIL_B, 'approuve'),
    attendu: 'accepte'
  },
  {
    nom: '(d) `est_administrateur()` neutralisée → n’importe quel compte approuve',
    sql: () => muter(`      and c.administrateur\n`, `      and true\n`),
    geste: (db) => decider(db, APPAREIL_B, APPAREIL_C, 'approuve'),
    attendu: 'accepte'
  },
  {
    nom: '(d) grant élargi au drapeau → l’administration peut le changer depuis le client',
    sql: () =>
      muter(
        'grant update (etat, raison) on public.comptes to authenticated;',
        'grant update (etat, raison, administrateur) on public.comptes to authenticated;'
      ),
    geste: (db) =>
      tenter(db, ADMIN, `update public.comptes set administrateur = true where id = $1 returning *`, [APPAREIL_C]),
    attendu: 'accepte'
  },
  {
    nom: '(f) la lecture des comptes ouverte → chacun lit la ligne d’un autre',
    sql: () => muter(`using (id = auth.uid() or public.est_administrateur());`, 'using (true);'),
    geste: async (db) => {
      // Une lecture filtrée par la RLS ne lève pas : 0 ligne, et c'est le refus.
      const issue = await tenter(db, APPAREIL_C, `select id from public.comptes where id = $1`, [APPAREIL_A]);
      return issue.accepte && issue.lignes.length === 0
        ? { accepte: false, message: '0 ligne lisible (la RLS a filtré la lecture)' }
        : issue;
    },
    attendu: 'accepte'
  },
  {
    nom: '(h) le `grant` de colonnes élargi à la table → un administrateur se l’attribue depuis le client',
    // L'administrateur est le cas qui prouve quelque chose : il passe la RLS
    // (`est_administrateur()`), donc seule la liste de colonnes du `grant update (etat, raison)`
    // de la 0005 le retient. Élargi à la table, ce grant couvre **toutes** les colonnes,
    // médaille comprise — c'est la régression qui rouvre l'écriture, et la 0016 ne peut pas la
    // rattraper : cette garde est donc ici, dans le test, et pas dans une ligne de migration
    // (#372 — un `revoke` de colonne ne retirait rien, il est parti).
    sql: () =>
      muter(
        'grant update (etat, raison) on public.comptes to authenticated;',
        'grant update on public.comptes to authenticated;'
      ),
    geste: async (db) => {
      const issue = await attribuerParClient(db, ADMIN);
      // Une écriture refusée par la RLS ne lève pas : 0 ligne, et c'est le refus. Sans ce
      // contrôle, la mutation passerait sans qu'aucune médaille soit écrite.
      return issue.accepte && issue.lignes.length === 0
        ? { accepte: false, message: '0 ligne écrite (la RLS a filtré)' }
        : issue;
    },
    attendu: 'accepte'
  }
];

describe('sur la vraie base, chaque geste fautif est refusé', () => {
  // Neuf bases PGlite de suite : large au-delà du défaut de 20 s quand la suite tourne en
  // parallèle, et le temps n'est pas ce que ce test mesure.
  it('les neuf gestes', async () => {
    for (const m of MUTATIONS) {
      const db = await base();
      try {
        await monde(db);
        // Le monde de départ doit laisser le geste **fautif** en échec.
        const issue = await m.geste(db);
        // Ici on part de la **vraie** base : le geste fautif doit y échouer.
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
      const db = await baseAvecAppareils(m.sql());
      try {
        // `monde` recrée les comptes (déjà approuvés) : C reste en attente, ADMIN administre.
        await monde(db);
        const issue = await m.geste(db);
        expect(issue.accepte).toBe(m.attendu === 'accepte');
      } finally {
        await db.close();
      }
    });
  }
});
