// @vitest-environment node
// Lent : chaque `base()` monte un PGlite neuf et rejoue les migrations réelles (`supabase/pglite.ts`) ; le coût est ce montage, pas la règle testée. Voir D-143 (4) : on le partage, on ne retire aucun cas.
/**
 * Les pouces dans la base — la migration `0004_pouces.sql` (#137).
 *
 * Même banc que `mur.test.ts` : les migrations **réelles**, lues sur disque et jouées dans
 * PGlite, en rôle `authenticated` (RLS comprise). Rien n'est recopié.
 *
 * Ce que la base doit tenir :
 *   (a) un appareil ne vote **qu'une fois** par post-it — la clé primaire `(postit_id, votant)` ;
 *   (b) un auteur ne vote **pas pour son propre post-it** — les politiques de la 0004, à
 *       l'insertion **et** à la modification (déplacer son vote vers le sien) ;
 *   (c) un appareil ne vote qu'**en son nom** (`votant = auth.uid()`) ;
 *   (d) un vote défait **remet le compteur** de la vue `postits_avec_votes`.
 *
 * **Le contrôle mord** (#112) : chaque contrôle est neutralisé tour à tour — la migration est lue,
 * un motif précis est remplacé, puis rejouée — et le même geste doit alors donner l'issue
 * **inverse**. Les motifs sont des ancres : si une migration change de forme, la mutation échoue
 * bruyamment au lieu de se décaler en silence.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APPAREIL_A,
  APPAREIL_B,
  avecAppareil,
  base,
  baseAvecAppareils,
  fichiersMigrations,
  migrations,
  type Base
} from './pglite';

const MIGRATION_POUCES = fichiersMigrations().find(
  (sql) => sql.includes('on public.votes for insert') && sql.includes('drop policy if exists')
);
if (!MIGRATION_POUCES) throw new Error('supabase/migrations/0004_pouces.sql introuvable');

const MIGRATION_MUR = fichiersMigrations().find((sql) => sql.includes('create table public.postits'));
if (!MIGRATION_MUR) throw new Error('supabase/migrations/0001_mur.sql introuvable');

type Issue = { accepte: true; ligne: Record<string, unknown> } | { accepte: false; message: string };

async function tenter(db: Base, appareil: string, sql: string, params: unknown[] = []): Promise<Issue> {
  try {
    const res = await avecAppareil(db, appareil, () => db.query<Record<string, unknown>>(sql, params));
    return { accepte: true, ligne: res.rows[0] ?? {} };
  } catch (erreur) {
    return { accepte: false, message: erreur instanceof Error ? erreur.message : String(erreur) };
  }
}

const refuse = (issue: Issue, motif: RegExp) => {
  expect(issue.accepte).toBe(false);
  if (!issue.accepte) expect(issue.message).toMatch(motif);
};
const accepte = (issue: Issue) => {
  expect(issue.accepte, issue.accepte ? '' : (issue as { message: string }).message).toBe(true);
};

/** Colle un post-it au nom de l'appareil. */
const coller = (db: Base, appareil: string, id: string, statut = 'en attente') =>
  tenter(
    db,
    appareil,
    `insert into public.postits (id, kind, titre, texte, version, statut, raison)
     values ($1, 'IP', 'Titre', 'Texte.', 'Alpha · 0.1.7', $2, case when $2 = 'écarté' then 'Hors périmètre.' else '' end)
     returning *`,
    [id, statut]
  );

const voter = (db: Base, appareil: string, postit: string, sens: 'up' | 'down') =>
  tenter(db, appareil, `insert into public.votes (postit_id, sens) values ($1, $2) returning *`, [postit, sens]);

const compteurs = async (db: Base, postit: string) => {
  const lu = await avecAppareil(db, APPAREIL_B, () =>
    db.query<{ votes: { up: number; down: number } }>(`select votes from public.postits_avec_votes where id = $1`, [
      postit
    ])
  );
  return lu.rows[0]?.votes;
};

/** L'état de départ de chaque geste : A a collé `p-a`, B a collé `p-b`. */
async function monde(db: Base) {
  accepte(await coller(db, APPAREIL_A, 'p-a'));
  accepte(await coller(db, APPAREIL_B, 'p-b'));
}

/** Les gestes qui font le contrat — rejoués à l'identique sur la base mutée. */
const GESTES = {
  /** (a) L'attaque : voter une seconde fois, avec l'autre sens, pour compter double. */
  deuxFoisLeMemePostit: async (db: Base) => {
    await monde(db);
    accepte(await voter(db, APPAREIL_B, 'p-a', 'up'));
    return voter(db, APPAREIL_B, 'p-a', 'down');
  },
  /** (b) L'auteur vote pour lui-même. */
  pourSoi: async (db: Base) => {
    await monde(db);
    return voter(db, APPAREIL_A, 'p-a', 'up');
  },
  /** (b) L'auteur vote pour un autre, puis déplace son vote vers son propre post-it. */
  deplacerVersSoi: async (db: Base) => {
    await monde(db);
    accepte(await voter(db, APPAREIL_A, 'p-b', 'up'));
    return tenter(
      db,
      APPAREIL_A,
      `update public.votes set postit_id = 'p-a' where postit_id = 'p-b' and votant = $1 returning *`,
      [APPAREIL_A]
    );
  },
  /** (c) Voter au nom d'un autre appareil. */
  auNomDUnAutre: async (db: Base) => {
    await monde(db);
    return tenter(
      db,
      APPAREIL_B,
      `insert into public.votes (postit_id, votant, sens) values ('p-a', $1, 'up') returning *`,
      [APPAREIL_A]
    );
  },
  /** (d) Voter, puis défaire : la vue doit revenir à zéro. */
  defaire: async (db: Base) => {
    await monde(db);
    accepte(await voter(db, APPAREIL_B, 'p-a', 'up'));
    expect(await compteurs(db, 'p-a')).toEqual({ up: 1, down: 0 });
    const retire = await tenter(
      db,
      APPAREIL_B,
      `delete from public.votes where postit_id = 'p-a' and votant = $1 returning *`,
      [APPAREIL_B]
    );
    if (!retire.accepte) return retire;
    // Une suppression refusée par RLS rend 0 ligne sans erreur : seul le compteur dit la vérité.
    const apres = await compteurs(db, 'p-a');
    if (apres?.up !== 0 || apres?.down !== 0) {
      return { accepte: false, message: `le compteur n’est pas revenu à zéro : ${JSON.stringify(apres)}` };
    }
    return retire;
  }
} as const;

describe('les pouces dans la base — la 0004 (#137)', () => {
  let db: Base;

  beforeAll(async () => {
    db = await baseAvecAppareils();
    await monde(db);
  });
  afterAll(async () => {
    await db.close();
  });

  it('B vote pour le post-it de A, en son nom, et la vue compte', async () => {
    const issue = await voter(db, APPAREIL_B, 'p-a', 'up');
    accepte(issue);
    if (issue.accepte) expect(issue.ligne.votant).toBe(APPAREIL_B);
    expect(await compteurs(db, 'p-a')).toEqual({ up: 1, down: 0 });
  });

  it('(a) un appareil ne vote pas deux fois pour le même post-it — la base refuse', async () => {
    refuse(await voter(db, APPAREIL_B, 'p-a', 'up'), /duplicate key/);
    refuse(await voter(db, APPAREIL_B, 'p-a', 'down'), /duplicate key/);
    expect(await compteurs(db, 'p-a')).toEqual({ up: 1, down: 0 });
  });

  it('changer d’avis déplace le compte : la modification de sa propre ligne est acceptée', async () => {
    accepte(await tenter(db, APPAREIL_B, `update public.votes set sens = 'down' where postit_id = 'p-a' returning *`));
    expect(await compteurs(db, 'p-a')).toEqual({ up: 0, down: 1 });
  });

  it('(b) un auteur ne vote pas pour son propre post-it — la base refuse', async () => {
    refuse(await voter(db, APPAREIL_A, 'p-a', 'up'), /row-level security/);
    refuse(await voter(db, APPAREIL_A, 'p-a', 'down'), /row-level security/);
    // Aucune ligne n'a été écrite : le compteur n'a pas bougé.
    expect(await compteurs(db, 'p-a')).toEqual({ up: 0, down: 1 });
  });

  it('(b) il ne déplace pas non plus un vote donné à un autre vers son propre post-it', async () => {
    accepte(await voter(db, APPAREIL_A, 'p-b', 'up'));
    refuse(
      await tenter(
        db,
        APPAREIL_A,
        `update public.votes set postit_id = 'p-a' where postit_id = 'p-b' and votant = $1 returning *`,
        [APPAREIL_A]
      ),
      /row-level security/
    );
    expect(await compteurs(db, 'p-a')).toEqual({ up: 0, down: 1 });
    expect(await compteurs(db, 'p-b')).toEqual({ up: 1, down: 0 });
  });

  it('(c) on ne vote pas au nom d’un autre appareil', async () => {
    accepte(await coller(db, APPAREIL_A, 'p-a2'));
    refuse(
      await tenter(
        db,
        APPAREIL_B,
        `insert into public.votes (postit_id, votant, sens) values ('p-a2', $1, 'up') returning *`,
        [APPAREIL_A]
      ),
      /row-level security/
    );
  });

  it('(d) défaire son vote remet le compteur ; on peut revoter ensuite', async () => {
    // Le vote de B sur p-a est « down » (changé plus haut).
    const retire = await tenter(db, APPAREIL_B, `delete from public.votes where postit_id = 'p-a' returning *`);
    accepte(retire);
    if (retire.accepte) expect(retire.ligne.sens).toBe('down');
    expect(await compteurs(db, 'p-a')).toEqual({ up: 0, down: 0 });

    accepte(await voter(db, APPAREIL_B, 'p-a', 'up'));
    expect(await compteurs(db, 'p-a')).toEqual({ up: 1, down: 0 });
  });

  it('un autre appareil ne défait pas le vote de B : 0 ligne, le compteur ne bouge pas', async () => {
    const attaque = await tenter(
      db,
      APPAREIL_A,
      `delete from public.votes where postit_id = 'p-a' and votant = $1 returning *`,
      [APPAREIL_B]
    );
    expect(attaque).toEqual({ accepte: true, ligne: {} });
    expect(await compteurs(db, 'p-a')).toEqual({ up: 1, down: 0 });
  });

  it('un post-it écarté reste votable ; un post-it effacé ne l’est plus (clé étrangère)', async () => {
    accepte(await coller(db, APPAREIL_A, 'p-ecarte', 'écarté'));
    accepte(await voter(db, APPAREIL_B, 'p-ecarte', 'down'));
    refuse(await voter(db, APPAREIL_B, 'p-fantome', 'up'), /foreign key|votes_postit_id_fkey/);

    // Un post-it qui a bougé de statut ne se retire plus par son auteur (#139, 0006) : le tri
    // — une raison, un ticket — partirait avec lui. Le refus est un `0 ligne` de RLS.
    expect(await tenter(db, APPAREIL_A, `delete from public.postits where id = 'p-ecarte' returning *`)).toEqual({
      accepte: true,
      ligne: {}
    });

    // Tant qu'il est « en attente », l'auteur le retire, et les votes qu'il portait partent
    // avec lui (cascade).
    accepte(await coller(db, APPAREIL_A, 'p-jetable'));
    accepte(await voter(db, APPAREIL_B, 'p-jetable', 'up'));
    accepte(await tenter(db, APPAREIL_A, `delete from public.postits where id = 'p-jetable' returning *`));
    const reste = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`select 1 from public.votes where postit_id = 'p-jetable'`)
    );
    expect(reste.rows).toHaveLength(0);
  });

  it('`anon` ne vote pas', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query(`insert into public.votes (postit_id, sens) values ('p-a', 'up')`)).rejects.toThrow(
        /permission denied/
      );
    } finally {
      await db.exec('reset role');
    }
  });
});

describe('la 0004 sur une base qui a déjà des lignes (celle de #135 à #173)', () => {
  it('retire le vote d’un auteur sur son propre post-it, garde les autres, et se rejoue sans erreur', async () => {
    // L'état historique : les migrations écrites **avant** la 0004, elle seule manquante.
    const toutes = fichiersMigrations();
    const avant = toutes.slice(0, toutes.indexOf(MIGRATION_POUCES)).join('\n');
    const db = await base(avant);
    try {
      await monde(db);
      // Avant la 0004, la base laisse A voter pour lui-même : le défaut constaté.
      accepte(await voter(db, APPAREIL_A, 'p-a', 'up'));
      accepte(await voter(db, APPAREIL_B, 'p-a', 'down'));
      accepte(await voter(db, APPAREIL_A, 'p-b', 'up'));
      expect(await compteurs(db, 'p-a')).toEqual({ up: 1, down: 1 });

      await db.exec(MIGRATION_POUCES);

      expect(await compteurs(db, 'p-a')).toEqual({ up: 0, down: 1 });
      expect(await compteurs(db, 'p-b')).toEqual({ up: 1, down: 0 });
      refuse(await voter(db, APPAREIL_A, 'p-a', 'up'), /row-level security/);

      // Idempotente : une seconde application ne lève rien et ne change rien.
      await db.exec(MIGRATION_POUCES);
      expect(await compteurs(db, 'p-a')).toEqual({ up: 0, down: 1 });
      refuse(await voter(db, APPAREIL_A, 'p-a', 'down'), /row-level security/);
    } finally {
      await db.close();
    }
  });
});

describe('le contrôle mord — chaque contrôle, neutralisé, laisse passer le fautif', () => {
  const PREUVE_SOI = 'and p.auteur = auth.uid()';
  const VOTANT_A_L_INSERTION = 'with check (\n    votant = auth.uid()';

  /** Remplace la `n`-ième occurrence (0 = première) d'un motif ; un compte inattendu fait échouer. */
  function muterNieme(sql: string, motif: string, attendues: number, n: number, remplacement: string): string {
    const morceaux = sql.split(motif);
    expect(morceaux.length - 1, `motif attendu ${attendues} fois : ${motif}`).toBe(attendues);
    const mutee = morceaux.reduce(
      (acc, morceau, i) => (i === 0 ? morceau : acc + (i - 1 === n ? remplacement : motif) + morceau),
      ''
    );
    expect(mutee).not.toBe(sql);
    return mutee;
  }

  const avecPouces = (mutee: string) => migrations().replace(MIGRATION_POUCES!, () => mutee);
  const avecMur = (mutee: string) => migrations().replace(MIGRATION_MUR!, () => mutee);

  /**
   * La 0005 (D-088) **remplace** les politiques de vote avec la condition d'approbation :
   * neutraliser la seule 0004 serait annulé par elle. La même neutralisation est donc
   * appliquée à toutes les copies du motif, où qu'elles vivent.
   */
  const aussi0005 = (sql: string, motif: string, remplacement: string) => sql.replaceAll(motif, remplacement);

  const MUTATIONS: Array<{
    nom: string;
    sql: () => string;
    geste: (db: Base) => Promise<Issue>;
    attendu: 'accepte' | 'refuse';
  }> = [
    {
      nom: 'sans la clé primaire (postit_id, votant, sens) → l’appareil vote deux fois (a)',
      sql: () =>
        avecMur(
          muterNieme(MIGRATION_MUR!, 'primary key (postit_id, votant)', 1, 0, 'primary key (postit_id, votant, sens)')
        ),
      geste: GESTES.deuxFoisLeMemePostit,
      attendu: 'accepte'
    },
    {
      nom: 'sans la condition à l’insertion → l’auteur vote pour lui-même (b)',
      sql: () =>
        aussi0005(avecPouces(muterNieme(MIGRATION_POUCES!, PREUVE_SOI, 2, 0, 'and false')), PREUVE_SOI, 'and false'),
      geste: GESTES.pourSoi,
      attendu: 'accepte'
    },
    {
      nom: 'sans la condition à la modification → il déplace son vote vers son propre post-it (b)',
      sql: () =>
        aussi0005(avecPouces(muterNieme(MIGRATION_POUCES!, PREUVE_SOI, 2, 1, 'and false')), PREUVE_SOI, 'and false'),
      geste: GESTES.deplacerVersSoi,
      attendu: 'accepte'
    },
    {
      nom: 'sans `votant = auth.uid()` à l’insertion → on vote au nom d’un autre (c)',
      sql: () =>
        aussi0005(
          avecPouces(muterNieme(MIGRATION_POUCES!, VOTANT_A_L_INSERTION, 2, 0, 'with check (\n    true')),
          VOTANT_A_L_INSERTION,
          'with check (\n    true'
        ),
      geste: GESTES.auNomDUnAutre,
      attendu: 'accepte'
    },
    {
      nom: 'sans la politique de suppression → le vote ne se défait pas, le compteur ne revient pas (d)',
      sql: () =>
        aussi0005(
          avecMur(
            muterNieme(
              MIGRATION_MUR!,
              'on public.votes for delete to authenticated\n  using (votant = auth.uid())',
              1,
              0,
              'on public.votes for delete to authenticated\n  using (false)'
            )
          ),
          'using (votant = auth.uid() and public.compte_approuve())',
          'using (false)'
        ),
      geste: GESTES.defaire,
      attendu: 'refuse'
    }
  ];

  // Le geste, sur la vraie base : l'issue que chaque mutation doit inverser.
  // Cinq bases PGlite de suite : large au-delà du défaut de 20 s quand la suite tourne en
  // parallèle (ajout de la 0005, #181), et le temps n'est pas ce que ce test mesure.
  it('sur la vraie base, chaque geste fautif est refusé et le geste (d) est accepté', async () => {
    const attendus: Array<[keyof typeof GESTES, 'accepte' | 'refuse']> = [
      ['deuxFoisLeMemePostit', 'refuse'],
      ['pourSoi', 'refuse'],
      ['deplacerVersSoi', 'refuse'],
      ['auNomDUnAutre', 'refuse'],
      ['defaire', 'accepte']
    ];
    for (const [nom, attendu] of attendus) {
      const db = await baseAvecAppareils();
      try {
        const issue = await GESTES[nom](db);
        expect(issue.accepte, nom).toBe(attendu === 'accepte');
      } finally {
        await db.close();
      }
    }
  }, 90_000);

  it('(d) sur la vraie base, le compteur revient à zéro après le vote défait', async () => {
    const db = await baseAvecAppareils();
    try {
      accepte(await GESTES.defaire(db));
      expect(await compteurs(db, 'p-a')).toEqual({ up: 0, down: 0 });
    } finally {
      await db.close();
    }
  });

  for (const m of MUTATIONS) {
    it(m.nom, async () => {
      const db = await baseAvecAppareils(m.sql());
      try {
        const issue = await m.geste(db);
        expect(issue.accepte).toBe(m.attendu === 'accepte');
      } finally {
        await db.close();
      }
    });
  }
});

describe('les fichiers de migration', () => {
  it('la 0004 ne crée aucune table et ne touche à aucun droit', () => {
    expect(MIGRATION_POUCES).not.toMatch(/create table|create view/);
    expect(MIGRATION_POUCES).not.toMatch(/grant |revoke /);
  });
});
