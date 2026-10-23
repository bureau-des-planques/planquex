// @vitest-environment node
/**
 * Le gueulage dans la base — la migration `0003_gueulage.sql` (D-085).
 *
 * Même banc que `mur.test.ts` : les migrations **réelles**, lues sur disque et jouées dans
 * PGlite, en rôle `authenticated` (RLS comprise). Rien n'est recopié.
 *
 * Ce que la base doit tenir (D-085) :
 *   - un gueulage n'a **pas** de famille ; un post-it qui n'en est pas **a** une (IP ou OUF) ;
 *   - un `lie` ne désigne **jamais** un gueulage ;
 *   - un identifiant va jusqu'à 80 caractères (le plus long réel en fait 48), pas au-delà.
 *
 * **Le contrôle mord** (#112) : chaque contrôle de la 0003 est neutralisé tour à tour — la
 * migration est lue, un motif précis est remplacé, puis rejouée — et le même geste doit alors
 * donner l'issue **inverse**. Les motifs sont des ancres : si la 0003 change de forme, la
 * mutation échoue bruyamment au lieu de se décaler en silence.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APPAREIL_A, APPAREIL_B, avecAppareil, base, fichiersMigrations, migrations, type Base } from './pglite';

const MIGRATION_GUEULAGE = fichiersMigrations().find((sql) => sql.includes('D-085') && sql.includes('postits_lie_hors_gueulage'));
if (!MIGRATION_GUEULAGE) throw new Error('supabase/migrations/0003_gueulage.sql introuvable');

const MIGRATION_MUR = fichiersMigrations().find((sql) => sql.includes('create table public.postits'));
if (!MIGRATION_MUR) throw new Error('supabase/migrations/0001_mur.sql introuvable');

/** Le résultat d'un geste : accepté (avec la ligne) ou refusé (avec le message de la base). */
type Issue = { accepte: true; ligne: Record<string, unknown> } | { accepte: false; message: string };

async function tenter(db: Base, appareil: string, sql: string, params: unknown[] = []): Promise<Issue> {
  try {
    const res = await avecAppareil(db, appareil, () => db.query<Record<string, unknown>>(sql, params));
    return { accepte: true, ligne: res.rows[0] ?? {} };
  } catch (erreur) {
    return { accepte: false, message: erreur instanceof Error ? erreur.message : String(erreur) };
  }
}

const VERSION = 'Alpha · 0.1.6';

/** Insère un post-it : les colonnes passées, les obligatoires complétées. */
function inserer(
  db: Base,
  champs: { id: string; kind?: 'IP' | 'OUF' | null; gueulage?: boolean; lie?: string | null },
  appareil = APPAREIL_A,
) {
  return tenter(
    db,
    appareil,
    `insert into public.postits (id, kind, titre, texte, version, gueulage, lie)
     values ($1, $2, 'Titre', 'Texte.', $3, $4, $5) returning *`,
    [champs.id, champs.kind ?? null, VERSION, champs.gueulage ?? false, champs.lie ?? null],
  );
}

const refuse = (issue: Issue, motif: RegExp) => {
  expect(issue.accepte).toBe(false);
  if (!issue.accepte) expect(issue.message).toMatch(motif);
};
const accepte = (issue: Issue) => {
  expect(issue.accepte, issue.accepte ? '' : (issue as { message: string }).message).toBe(true);
};

/** Les gestes qui font le contrat de la 0003 — rejoués à l'identique sur la base mutée. */
const GESTES = {
  gueulageSansKind: (db: Base) => inserer(db, { id: 'g-sans-kind', gueulage: true }),
  gueulageAvecKind: (db: Base) => inserer(db, { id: 'g-avec-kind', gueulage: true, kind: 'IP' }),
  ipSansKind: (db: Base) => inserer(db, { id: 'p-ip-sans-kind', kind: null }),
  oufSansKind: (db: Base) => inserer(db, { id: 'p-ouf-sans-kind', kind: null }),
  lieVersGueulage: async (db: Base) => {
    await inserer(db, { id: 'g-cible', gueulage: true });
    return inserer(db, { id: 'g-lieur', gueulage: true, lie: 'g-cible' });
  },
  lieVersIp: async (db: Base) => {
    await inserer(db, { id: 'p-cible', kind: 'IP' });
    return inserer(db, { id: 'g-lie-ip', gueulage: true, lie: 'p-cible' });
  },
  lieSurSoi: (db: Base) => inserer(db, { id: 'g-soi', gueulage: true, lie: 'g-soi' }),
  devenirGueulageDesigne: async (db: Base) => {
    await inserer(db, { id: 'p-designe', kind: 'OUF' });
    await inserer(db, { id: 'g-designeur', gueulage: true, lie: 'p-designe' });
    return tenter(db, APPAREIL_A, `update public.postits set gueulage = true, kind = null where id = 'p-designe' returning *`);
  },
  id48: (db: Base) => inserer(db, { id: `p-${'a'.repeat(46)}`, kind: 'IP' }),
  id80: (db: Base) => inserer(db, { id: `p-${'b'.repeat(78)}`, kind: 'IP' }),
  id81: (db: Base) => inserer(db, { id: `p-${'c'.repeat(79)}`, kind: 'IP' }),
} as const;

describe('le gueulage dans la base — la 0003 (D-085)', () => {
  let db: Base;

  beforeAll(async () => {
    db = await base();
  });
  afterAll(async () => {
    await db.close();
  });

  it('un gueulage sans `kind` s’insère, et la vue rend `kind` à null', async () => {
    const issue = await GESTES.gueulageSansKind(db);
    accepte(issue);
    const lu = await avecAppareil(db, APPAREIL_B, () =>
      db.query(`select kind, gueulage from public.postits_avec_votes where id = 'g-sans-kind'`),
    );
    expect(lu.rows[0]).toEqual({ kind: null, gueulage: true });
  });

  it('un gueulage avec `kind` est refusé', async () => {
    refuse(await GESTES.gueulageAvecKind(db), /postits_gueulage_sans_famille/);
  });

  it('un post-it IP ou OUF sans `kind` est refusé', async () => {
    refuse(await GESTES.ipSansKind(db), /postits_famille_hors_gueulage/);
    refuse(await GESTES.oufSansKind(db), /postits_famille_hors_gueulage/);
  });

  it('une famille inconnue reste refusée (régression de 0001)', async () => {
    const issue = await tenter(
      db,
      APPAREIL_A,
      `insert into public.postits (id, kind, titre, texte, version) values ('p-bug', 'BUG', 'T', 'T.', $1) returning *`,
      [VERSION],
    );
    refuse(issue, /postits_kind_check/);
  });

  it('un `lie` vers un gueulage est refusé ; vers un post-it IP, accepté', async () => {
    refuse(await GESTES.lieVersGueulage(db), /un lie ne désigne pas un gueulage/);
    const ok = await GESTES.lieVersIp(db);
    accepte(ok);
    if (ok.accepte) expect(ok.ligne.lie).toBe('p-cible');
  });

  it('un post-it ne se lie pas à lui-même', async () => {
    refuse(await GESTES.lieSurSoi(db), /ne se lie pas à lui-même/);
  });

  it('on ne transforme pas en gueulage un post-it que l’on désigne déjà', async () => {
    refuse(await GESTES.devenirGueulageDesigne(db), /ne devient pas un gueulage/);
  });

  it('un `lie` vers un post-it absent est refusé (clé étrangère) ; retirer le post-it lié remet `lie` à null', async () => {
    refuse(await inserer(db, { id: 'g-fantome', gueulage: true, lie: 'nexiste-pas' }), /foreign key|postits_lie_fkey/);

    const retire = await tenter(db, APPAREIL_A, `delete from public.postits where id = 'p-cible' returning *`);
    accepte(retire);
    const lu = await avecAppareil(db, APPAREIL_A, () =>
      db.query(`select lie from public.postits where id = 'g-lie-ip'`),
    );
    expect(lu.rows[0].lie).toBeNull();
  });

  it('un identifiant de 48 et de 80 caractères s’insère, un de 81 est refusé', async () => {
    accepte(await GESTES.id48(db));
    accepte(await GESTES.id80(db));
    refuse(await GESTES.id81(db), /postits_id_check/);
  });

  it('les deux post-its réels de docs/boite-a-idees.json s’insèrent tels quels', async () => {
    const fichier = JSON.parse(readFileSync(new URL('../docs/boite-a-idees.json', import.meta.url), 'utf8')) as {
      postits: Array<Record<string, unknown>>;
    };
    expect(fichier.postits.length).toBeGreaterThanOrEqual(2);
    // Le plus long identifiant du fichier dépasse bien 32 : c'est lui que la 0001 refusait.
    expect(Math.max(...fichier.postits.map((p) => String(p.id).length))).toBeGreaterThan(32);

    for (const p of fichier.postits) {
      const pos = p.position as { x: number; y: number; angle: number };
      const issue = await tenter(
        db,
        APPAREIL_A,
        `insert into public.postits
           (id, kind, titre, texte, ecran, pseudo, version, statut, raison, ticket, gueulage, position_x, position_y, position_angle)
         values ($1, $2, $3, $4, nullif($5, ''), $6, $7, $8, $9, $10, $11, $12, $13, $14) returning *`,
        [
          p.id, p.kind ?? null, p.titre, p.texte, p.ecran ?? '', p.pseudo, p.version, p.statut,
          p.raison ?? '', p.ticket ?? null, p.gueulage, pos.x, pos.y, pos.angle,
        ],
      );
      accepte(issue);
    }
  });

  it('un post-it écarté sans raison reste refusé (régression de 0001)', async () => {
    refuse(
      await tenter(db, APPAREIL_A, `update public.postits set statut = 'écarté' where id = 'g-sans-kind' returning *`),
      /postits_ecarte_a_sa_raison/,
    );
    accepte(
      await tenter(
        db,
        APPAREIL_A,
        `update public.postits set statut = 'écarté', raison = 'Hors périmètre.' where id = 'g-sans-kind' returning *`,
      ),
    );
  });

  it('la RLS est intacte : B ne modifie ni ne supprime le gueulage de A, et ne signe pas à son nom', async () => {
    const modif = await tenter(db, APPAREIL_B, `update public.postits set titre = 'Pirate' where id = 'g-sans-kind' returning *`);
    expect(modif).toEqual({ accepte: true, ligne: {} });
    const usurpe = await tenter(
      db,
      APPAREIL_B,
      `insert into public.postits (id, titre, texte, version, gueulage, auteur)
       values ('g-usurpe', 'T', 'T.', $1, true, $2) returning *`,
      [VERSION, APPAREIL_A],
    );
    refuse(usurpe, /row-level security/);
  });

  it('`anon` n’a toujours aucun droit sur les tables', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select count(*) from public.postits')).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });
});

describe('la 0003 sur une base qui a déjà des lignes (celle de #135)', () => {
  it('remet à null la famille de substitution d’un gueulage, et se rejoue sans erreur', async () => {
    // Le projet réel : 0001 (et 0002) appliquées, un gueulage posté depuis le jeu avec `kind = 'IP'`
    // — exactement ce que `src/lib/murBase.ts` envoyait avant D-085.
    const avant = fichiersMigrations().filter((sql) => sql !== MIGRATION_GUEULAGE).join('\n');
    const db = await base(avant);
    try {
      const pose = await tenter(
        db,
        APPAREIL_A,
        `insert into public.postits (id, kind, titre, texte, version, gueulage)
         values ('g-ancien', 'IP', 'Ancien', 'Gueulé avant D-085.', $1, true) returning *`,
        [VERSION],
      );
      accepte(pose);
      accepte(
        await tenter(
          db,
          APPAREIL_A,
          `insert into public.postits (id, kind, titre, texte, version) values ('p-ancien', 'OUF', 'T', 'T.', $1) returning *`,
          [VERSION],
        ),
      );

      // Avant la 0003, la base refuse un gueulage sans famille et un identifiant de 48 : le défaut constaté.
      const sans = (id: string, kind: string | null, gueulage: boolean) =>
        tenter(
          db,
          APPAREIL_A,
          `insert into public.postits (id, kind, titre, texte, version, gueulage) values ($1, $2, 'T', 'T.', $3, $4) returning *`,
          [id, kind, VERSION, gueulage],
        );
      refuse(await sans('g-sans-famille', null, true), /null value in column "kind"/);
      refuse(await sans(`p-${'a'.repeat(46)}`, 'IP', false), /postits_id_check/);

      await db.exec(MIGRATION_GUEULAGE);

      const lu = await avecAppareil(db, APPAREIL_A, () =>
        db.query(`select id, kind from public.postits where id in ('g-ancien', 'p-ancien') order by id`),
      );
      expect(lu.rows).toEqual([
        { id: 'g-ancien', kind: null },
        { id: 'p-ancien', kind: 'OUF' },
      ]);

      // Idempotente : une seconde application ne lève rien et ne change rien.
      await db.exec(MIGRATION_GUEULAGE);
      accepte(await GESTES.gueulageSansKind(db));
      refuse(await GESTES.gueulageAvecKind(db), /postits_gueulage_sans_famille/);
    } finally {
      await db.close();
    }
  });
});

describe('le contrôle mord — chaque contrôle de la 0003, neutralisé, laisse passer le fautif', () => {
  /** Remplace un motif **unique** de la 0003 ; un motif absent ou multiple fait échouer. */
  function muter(motif: string, remplacement: string): string {
    expect(MIGRATION_GUEULAGE!.split(motif).length - 1, `motif attendu une fois : ${motif}`).toBe(1);
    const mutee = MIGRATION_GUEULAGE!.replace(motif, () => remplacement);
    expect(mutee).not.toBe(MIGRATION_GUEULAGE);
    return mutee;
  }

  /** Toutes les migrations, la 0003 remplacée par sa version mutée. */
  const avecMutation = (mutee: string) => migrations().replace(MIGRATION_GUEULAGE!, () => mutee);

  const MUTATIONS: Array<{
    nom: string;
    mutee: () => string;
    /** Le geste, et l'issue qu'il avait sur la vraie 0003 — la mutation doit l'inverser. */
    geste: (db: Base) => Promise<Issue>;
    attendu: 'accepte' | 'refuse';
  }> = [
    {
      nom: '`kind` redevient obligatoire → le gueulage sans famille est refusé',
      mutee: () => muter('alter table public.postits alter column kind drop not null;', ''),
      geste: GESTES.gueulageSansKind,
      attendu: 'refuse',
    },
    {
      nom: 'sans « un gueulage n’a pas de famille » → le gueulage avec `kind` passe',
      mutee: () => muter('check (not gueulage or kind is null)', 'check (true)'),
      geste: GESTES.gueulageAvecKind,
      attendu: 'accepte',
    },
    {
      nom: 'sans « un post-it a une famille » → l’IP sans `kind` passe',
      mutee: () => muter('check (gueulage or kind is not null)', 'check (true)'),
      geste: GESTES.ipSansKind,
      attendu: 'accepte',
    },
    {
      nom: 'sans le garde du déclencheur → un `lie` vers un gueulage passe',
      mutee: () => muter('cible.id = new.lie and cible.gueulage', 'cible.id = new.lie and false'),
      geste: GESTES.lieVersGueulage,
      attendu: 'accepte',
    },
    {
      nom: 'sans le garde d’auto-lien → un post-it se lie à lui-même',
      mutee: () => muter('if new.lie = new.id then', 'if false then'),
      geste: GESTES.lieSurSoi,
      attendu: 'accepte',
    },
    {
      nom: 'sans le garde de l’autre sens → un post-it désigné devient gueulage',
      mutee: () => muter('where lieur.lie = new.id', 'where false'),
      geste: GESTES.devenirGueulageDesigne,
      attendu: 'accepte',
    },
    {
      nom: 'identifiant resté à 32 → celui de 48 caractères est refusé',
      mutee: () => muter('between 1 and 80', 'between 1 and 32'),
      geste: GESTES.id48,
      attendu: 'refuse',
    },
    {
      nom: 'identifiant sans plafond → celui de 81 caractères passe',
      mutee: () => muter('between 1 and 80', 'between 1 and 8000'),
      geste: GESTES.id81,
      attendu: 'accepte',
    },
  ];

  for (const m of MUTATIONS) {
    it(m.nom, async () => {
      const db = await base(avecMutation(m.mutee()));
      try {
        const issue = await m.geste(db);
        expect(issue.accepte).toBe(m.attendu === 'accepte');
      } finally {
        await db.close();
      }
    });
  }
});

// Les filets de lecture : la 0001 reste la seule à créer la table.
describe('les fichiers de migration', () => {
  it('la 0003 vient après la 0001 et ne recrée aucune table', () => {
    expect(MIGRATION_MUR).toBeDefined();
    expect(MIGRATION_GUEULAGE).not.toMatch(/create table/);
    expect(MIGRATION_GUEULAGE).not.toMatch(/create policy|drop policy|grant |revoke /);
  });
});
