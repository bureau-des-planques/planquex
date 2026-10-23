// @vitest-environment node
/**
 * Les écritures du mur : commenter, corriger, retirer, et le tri de l'administration
 * (#138, #139, migration `0006_tri_et_corrections.sql`, D-088).
 *
 * Même banc que `mur.test.ts` et `comptes.test.ts` : les migrations **réelles**, lues sur
 * disque et jouées dans PGlite (PostgreSQL en WASM, RLS comprise), en rôle `authenticated`.
 * Rien n'est recopié de la migration.
 *
 * Ce que la base doit tenir, et que ce fichier éprouve :
 *
 *   (a) **un compte en attente ne commente pas**, un compte approuvé commente — et la
 *       **lecture** reste ouverte au compte en attente (D-088) ;
 *   (b) on ne retire pas le commentaire d'un autre ;
 *   (c) on ne corrige pas le post-it d'un autre, et pas non plus le sien **après** un
 *       changement de statut — le refus porte sa raison (`postit_corrige_trop_tard`) ;
 *   (d) l'auteur retire le sien tant qu'il est `en attente`, et plus après ;
 *   (e) un **administrateur** écrit `statut`, `raison` et `ticket` sur **n'importe quel**
 *       post-it — et **ne peut pas** réécrire son texte (le grant de colonnes le refuse) ;
 *   (f) un **non-administrateur** est refusé : `0 ligne` pour `statut` (RLS), `permission
 *       denied` pour `titre` (grant).
 *
 * **Le contrôle mord** (#112) : chaque contrôle est neutralisé tour à tour — la 0006 est
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
  creerCompte,
  fichiersMigrations,
  migrations,
  type Base,
} from './pglite';

const MIGRATION_TRI = fichiersMigrations().find((sql) => sql.includes('corriger_postit'));
if (!MIGRATION_TRI) throw new Error('supabase/migrations/0006_tri_et_corrections.sql introuvable');

type Issue =
  | { accepte: true; lignes: Array<Record<string, unknown>> }
  | { accepte: false; message: string };

async function tenter(
  db: Base,
  appareil: string,
  sql: string,
  params: unknown[] = [],
): Promise<Issue> {
  try {
    const res = await avecAppareil(db, appareil, () =>
      db.query<Record<string, unknown>>(sql, params),
    );
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
    [id],
  );

const commenter = (db: Base, appareil: string, postit: string, texte = 'Pareil chez moi.') =>
  tenter(
    db,
    appareil,
    `insert into public.commentaires (postit_id, texte, pseudo) values ($1, $2, 'Employé 404') returning *`,
    [postit, texte],
  );

/** La correction passe par la fonction : c'est elle qui porte la règle de #139. */
const corriger = (db: Base, appareil: string, postit: string, titre = 'Corrigé', texte = 'Texte corrigé.') =>
  tenter(db, appareil, `select * from public.corriger_postit($1, $2, $3)`, [postit, titre, texte]);

const trierEn = (db: Base, appareil: string, postit: string, colonnes: string) =>
  tenter(db, appareil, `update public.postits set ${colonnes} where id = $1 returning *`, [postit]);

/**
 * Un tri **vu comme une tentative** : une modification refusée par RLS ne lève pas, elle
 * porte sur 0 ligne. On la déclare donc refusée — sans quoi « rien n'a changé » passerait
 * pour un succès, le piège que `mur.test.ts` documente.
 */
const trier = async (db: Base, appareil: string, postit: string, colonnes: string): Promise<Issue> => {
  const issue = await trierEn(db, appareil, postit, colonnes);
  if (issue.accepte && issue.lignes.length === 0) {
    return { accepte: false, message: '0 ligne touchée (la RLS a filtré le tri)' };
  }
  return issue;
};

/** A et B approuvés, C **en attente**, un administrateur ; A et B ont chacun un post-it. */
async function monde(db: Base) {
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_C, { etat: 'en attente' });
  await creerCompte(db, ADMIN, { etat: 'approuve', administrateur: true });
  accepte(await coller(db, APPAREIL_A, 'p-a'));
  accepte(await coller(db, APPAREIL_B, 'p-b'));
}

describe('commenter un post-it (#138)', () => {
  let db: Base;

  beforeAll(async () => {
    db = await base();
    await monde(db);
  });
  afterAll(async () => {
    await db.close();
  });

  it('(a) un compte en attente ne commente pas — la base refuse', async () => {
    refuse(await commenter(db, APPAREIL_C, 'p-b'), /row-level security/);
    const lus = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`select count(*) as n from public.commentaires`),
    );
    expect(Number(lus.rows[0].n)).toBe(0);
  });

  it('(a) la lecture reste ouverte à un compte en attente (D-088)', async () => {
    accepte(await commenter(db, APPAREIL_A, 'p-b'));
    const lus = await avecAppareil(db, APPAREIL_C, () =>
      db.query(`select postit_id, texte, pseudo, auteur from public.commentaires`),
    );
    expect(lus.rows).toHaveLength(1);
    expect(lus.rows[0]).toMatchObject({
      postit_id: 'p-b',
      texte: 'Pareil chez moi.',
      pseudo: 'Employé 404',
      auteur: APPAREIL_A,
    });
  });

  it('(a) le client ne signe pas à la place d’un autre', async () => {
    refuse(
      await tenter(
        db,
        APPAREIL_B,
        `insert into public.commentaires (postit_id, texte, auteur) values ('p-a', 'Pirate.', $1) returning *`,
        [APPAREIL_A],
      ),
      /row-level security/,
    );
  });

  it('(b) on ne retire pas le commentaire d’un autre — 0 ligne, sans erreur', async () => {
    zeroLigne(
      await tenter(
        db,
        APPAREIL_B,
        `delete from public.commentaires where postit_id = 'p-b' and auteur = $1 returning *`,
        [APPAREIL_A],
      ),
    );
    // … et l'auteur, lui, retire le sien.
    const sien = await tenter(
      db,
      APPAREIL_A,
      `delete from public.commentaires where postit_id = 'p-b' returning *`,
    );
    accepte(sien);
    if (sien.accepte) expect(sien.lignes).toHaveLength(1);
  });
});

describe('corriger ou retirer son post-it (#139)', () => {
  let db: Base;

  beforeAll(async () => {
    db = await base();
    await monde(db);
  });
  afterAll(async () => {
    await db.close();
  });

  it('(c) l’auteur corrige le sien tant qu’il est « en attente »', async () => {
    const corrige = await corriger(db, APPAREIL_A, 'p-a', 'Le bouton reste grisé', 'Le vrai texte.');
    accepte(corrige);
    if (corrige.accepte) {
      expect(corrige.lignes[0]).toMatchObject({ titre: 'Le bouton reste grisé', texte: 'Le vrai texte.' });
    }
  });

  it('(c) on ne corrige pas le post-it d’un autre', async () => {
    refuse(await corriger(db, APPAREIL_B, 'p-a', 'Pirate', 'Pirate.'), /postit_corrige_refuse/);
    const intact = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`select titre from public.postits where id = 'p-a'`),
    );
    expect(intact.rows[0].titre).toBe('Le bouton reste grisé');
  });

  it('(c) un compte en attente ne corrige pas, même le post-it d’un autre', async () => {
    refuse(await corriger(db, APPAREIL_C, 'p-b', 'Pirate', 'Pirate.'), /postit_corrige_refuse/);
  });

  it('(c) dès qu’un statut a bougé, la correction est refusée — avec sa raison', async () => {
    // L'administration trie d'abord (0006, la politique du tri).
    accepte(await trierEn(db, ADMIN, 'p-b', `statut = 'retenu'`));
    const tard = await corriger(db, APPAREIL_B, 'p-b', 'Trop tard', 'Trop tard.');
    refuse(tard, /postit_corrige_trop_tard/);
    // Le message dit **pourquoi**, sinon l'écran n'a rien à montrer.
    if (!tard.accepte) expect(tard.message).toMatch(/retenu/);
  });

  it('(d) l’auteur retire le sien tant qu’il est « en attente », et plus après le tri', async () => {
    accepte(await coller(db, APPAREIL_A, 'p-jetable'));
    const retire = await tenter(db, APPAREIL_A, `delete from public.postits where id = 'p-jetable' returning *`);
    accepte(retire);

    // p-b a été « retenu » : son auteur ne l'efface plus, le tri partirait avec lui.
    zeroLigne(
      await tenter(db, APPAREIL_B, `delete from public.postits where id = 'p-b' returning *`),
    );
  });

  it('(d) on n’efface pas le post-it d’un autre', async () => {
    zeroLigne(
      await tenter(db, APPAREIL_B, `delete from public.postits where id = 'p-a' returning *`),
    );
  });
});

describe('le tri par l’administration (0006)', () => {
  let db: Base;

  beforeAll(async () => {
    db = await base();
    await monde(db);
  });
  afterAll(async () => {
    await db.close();
  });

  it('(e) un administrateur écrit statut, raison et ticket sur n’importe quel post-it', async () => {
    const ecarte = await trierEn(
      db,
      ADMIN,
      'p-a',
      `statut = 'écarté', raison = 'Hors périmètre.', ticket = 139`,
    );
    accepte(ecarte);
    if (ecarte.accepte) {
      expect(ecarte.lignes[0]).toMatchObject({
        statut: 'écarté',
        raison: 'Hors périmètre.',
        ticket: 139,
      });
    }
    // Le tri marche aussi sur le post-it de quelqu'un d'autre, sans le réécrire.
    accepte(await trierEn(db, ADMIN, 'p-b', `statut = 'en cours', ticket = 138`));
  });

  it('(e) un administrateur ne peut pas réécrire le texte d’un post-it d’autrui — le grant le refuse', async () => {
    refuse(
      await trierEn(db, ADMIN, 'p-b', `texte = 'Réécrit par l’administration.'`),
      /permission denied for table postits/,
    );
    refuse(
      await trierEn(db, ADMIN, 'p-b', `titre = 'Réécrit par l’administration.'`),
      /permission denied for table postits/,
    );
    const intact = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`select titre, texte from public.postits where id = 'p-b'`),
    );
    expect(intact.rows[0]).toEqual({ titre: 'Titre', texte: 'Texte.' });
  });

  it('(f) un non-administrateur est refusé : 0 ligne pour statut, permission refusée pour titre', async () => {
    zeroLigne(await trierEn(db, APPAREIL_B, 'p-a', `statut = 'fait'`));
    zeroLigne(await trierEn(db, APPAREIL_B, 'p-b', `statut = 'fait'`));
    refuse(
      await trierEn(db, APPAREIL_B, 'p-a', `titre = 'Pirate'`),
      /permission denied for table postits/,
    );
    const intact = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`select statut from public.postits where id = 'p-a'`),
    );
    expect(intact.rows[0].statut).toBe('écarté');
  });

  it('(f) un auteur ne déplace pas son propre statut : le tri n’est pas au posteur (D-059)', async () => {
    accepte(await coller(db, APPAREIL_A, 'p-sien'));
    zeroLigne(await trierEn(db, APPAREIL_A, 'p-sien', `statut = 'retenu'`));
    const relu = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`select statut from public.postits where id = 'p-sien'`),
    );
    expect(relu.rows[0].statut).toBe('en attente');
  });
});

// ---------------------------------------------------------------------------------------------
// Le contrôle mord : chaque contrôle neutralisé laisse passer le fautif
// ---------------------------------------------------------------------------------------------

/** Remplace un motif de la 0006 (ou d'une autre migration) ; un motif absent fait échouer. */
function muter(motif: string, remplacement: string, sql: string = MIGRATION_TRI!): string {
  expect(sql.split(motif).length - 1, `motif introuvable ou ambigu : ${motif}`).toBeGreaterThan(0);
  const mutee = sql.replaceAll(motif, remplacement);
  expect(mutee).not.toBe(sql);
  return mutee;
}

const MUTATIONS: Array<{
  nom: string;
  sql: () => string;
  geste: (db: Base) => Promise<Issue>;
  attendu: 'accepte' | 'refuse';
}> = [
  {
    nom: '(f) politique du tri neutralisée → un non-administrateur trie le mur',
    sql: () =>
      migrations().replace(
        MIGRATION_TRI!,
        () =>
          muter(
            `  on public.postits for update to authenticated
  using (public.est_administrateur())
  with check (public.est_administrateur());`,
            `  on public.postits for update to authenticated
  using (true)
  with check (true);`,
          ),
      ),
    geste: (db) => trier(db, APPAREIL_B, 'p-a', `statut = 'fait'`),
    attendu: 'accepte',
  },
  {
    nom: '(e) grant élargi au texte → l’administration réécrit le post-it d’autrui',
    sql: () =>
      migrations().replace(
        MIGRATION_TRI!,
        () =>
          muter(
            'grant update (statut, raison, ticket) on public.postits to authenticated;',
            'grant update on public.postits to authenticated;',
          ),
      ),
    geste: (db) => trier(db, ADMIN, 'p-b', `texte = 'Réécrit par l’administration.'`),
    attendu: 'accepte',
  },
  {
    nom: '(c) fonction sans le garde d’auteur → n’importe qui corrige le post-it d’un autre',
    sql: () =>
      migrations().replace(
        MIGRATION_TRI!,
        () => muter('if corrige.auteur is distinct from auth.uid() then', 'if false then'),
      ),
    geste: (db) => corriger(db, APPAREIL_B, 'p-a'),
    attendu: 'accepte',
  },
  {
    nom: '(c) fonction sans le garde de statut → une correction tardive passe',
    sql: () =>
      migrations().replace(
        MIGRATION_TRI!,
        () => muter(`if corrige.statut <> 'en attente' then`, 'if false then'),
      ),
    geste: async (db) => {
      expect((await trier(db, ADMIN, 'p-b', `statut = 'retenu'`)).accepte).toBe(true);
      return corriger(db, APPAREIL_B, 'p-b');
    },
    attendu: 'accepte',
  },
  {
    nom: '(d) retrait sans « en attente » → l’auteur efface un post-it déjà trié',
    sql: () =>
      migrations().replace(
        MIGRATION_TRI!,
        () =>
          muter(
            `using (auteur = auth.uid() and public.compte_approuve() and statut = 'en attente');`,
            'using (auteur = auth.uid() and public.compte_approuve());',
          ),
      ),
    geste: async (db) => {
      expect((await trier(db, ADMIN, 'p-b', `statut = 'retenu'`)).accepte).toBe(true);
      // Un retrait refusé par RLS rend 0 ligne : c'est un refus, pas un succès.
      const issue = await tenter(db, APPAREIL_B, `delete from public.postits where id = 'p-b' returning *`);
      return issue.accepte && issue.lignes.length === 0
        ? { accepte: false, message: '0 ligne supprimée (la RLS a filtré le retrait)' }
        : issue;
    },
    attendu: 'accepte',
  },
  {
    nom: '(a) approbation retirée de l’insertion d’un commentaire → un compte en attente commente',
    sql: () =>
      migrations().replace(
        `on public.commentaires for insert to authenticated
  with check (auteur = auth.uid() and public.compte_approuve());`,
        `on public.commentaires for insert to authenticated
  with check (auteur = auth.uid());`,
      ),
    geste: (db) => commenter(db, APPAREIL_C, 'p-b'),
    attendu: 'accepte',
  },
];

describe('sur la vraie base, chaque geste fautif est refusé', () => {
  it('les six gestes', async () => {
    for (const m of MUTATIONS) {
      const db = await base();
      try {
        await monde(db);
        const issue = await m.geste(db);
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
        const issue = await m.geste(db);
        expect(issue.accepte).toBe(m.attendu === 'accepte');
      } finally {
        await db.close();
      }
    });
  }
});

describe('la migration 0006 est idempotente', () => {
  it('rejouée, elle ne lève rien et ne change aucun droit', async () => {
    const db = await base();
    try {
      await monde(db);
      await trierEn(db, ADMIN, 'p-a', `statut = 'retenu'`);
      await db.exec(MIGRATION_TRI!);

      const relu = await avecAppareil(db, APPAREIL_A, () =>
        db.query(`select statut from public.postits where id = 'p-a'`),
      );
      expect(relu.rows[0].statut).toBe('retenu');
      // Les droits n'ont pas bougé : l'auteur ne réécrit toujours pas son texte en direct.
      refuse(
        await trierEn(db, APPAREIL_A, 'p-a', `texte = 'Réécrit'`),
        /permission denied for table postits/,
      );
      // … et le tri fonctionne encore.
      accepte(await trierEn(db, ADMIN, 'p-a', `statut = 'fait'`));
    } finally {
      await db.close();
    }
  });
});
