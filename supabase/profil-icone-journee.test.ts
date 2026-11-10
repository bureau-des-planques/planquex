// @vitest-environment node
/**
 * L'icône de profil et la Journée faite — la migration `0027_profil_icone_journee.sql`
 * (#781, D-197 (2) et (3)).
 *
 * Même banc que `profils.test.ts` : les migrations **réelles**, jouées dans PGlite (RLS
 * comprise), en rôle `authenticated`.
 *
 * Ce que la base doit tenir :
 *
 *   (a) l'**icône** est un slug court en minuscules : une forme fautive est refusée, une bonne
 *       passe, et elle se change (rien ne la fige, D-197 ne le dit pas) ;
 *   (b) un autre compte **ne pose pas** l'icône d'un autre (0 ligne, sans erreur) ;
 *   (c) la **Journée faite** se pose une fois ; la date vient du **serveur**, pas du client ;
 *   (d) la Journée faite **ne se défait pas** : ni remise à `null`, ni redatée ;
 *   (e) un autre compte **ne pose pas** la Journée d'un autre (0 ligne) ;
 *   (f) un profil **neuf** n'a ni icône ni Journée, et ne peut pas naître « Journée faite » ;
 *   (g) la migration **ne casse aucune ligne existante** et **se rejoue** ;
 *   (h) les gardes de 0019 (service, intitulé, relance) parlent encore après 0027.
 *
 * **Le contrôle mord** : la contrainte retirée laisse passer l'icône fautive ; la garde retirée
 * laisse défaire la Journée ; la migration **mutée** sans le `check` ou sans la politique RLS
 * laisse passer le geste fautif — sans quoi ce test ne prouverait rien.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPAREIL_A, APPAREIL_B, avecAppareil, base, creerCompte, type Base } from './pglite';

const MIGRATION = '0027_profil_icone_journee.sql';

/** Les noms des migrations, dans l'ordre. */
const NOMS = readdirSync(new URL('./migrations/', import.meta.url))
  .filter((nom) => nom.endsWith('.sql'))
  .sort();

const lire = (nom: string): string => readFileSync(new URL(`./migrations/${nom}`, import.meta.url), 'utf8');

/** Les migrations **jusqu'à** un fichier donné, bout à bout. */
const jusqua = (derniere: string): string =>
  NOMS.filter((nom) => nom <= derniere)
    .map(lire)
    .join('\n');

/**
 * Les migrations, avec un bout de texte retiré ou remplacé dans **une** d'elles. Le texte doit
 * exister : une mutation qui ne touche rien ferait passer le contrôle mord pour de bon.
 */
function migrationsMutees(nom: string, ...mutations: Array<[avant: string, apres: string]>): string {
  let source = lire(nom);
  for (const [avant, apres] of mutations) {
    if (!source.includes(avant)) throw new Error(`${nom} ne contient pas « ${avant} » : la mutation ne mord pas`);
    source = source.replace(avant, apres);
  }
  return NOMS.filter((n) => n <= MIGRATION)
    .map((n) => (n === nom ? source : lire(n)))
    .join('\n');
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
/** Un `update` qui ne trouve pas la ligne (RLS) : accepté, 0 ligne. */
const zeroLigne = (issue: Issue) => {
  accepte(issue);
  if (issue.accepte) expect(issue.lignes).toHaveLength(0);
};

const creer = (db: Base, appareil: string, pseudo = 'Anaïs') =>
  tenter(db, appareil, 'insert into public.profils (id, pseudo) values ($1, $2) returning *', [appareil, pseudo]);

const poserIcone = (db: Base, appareil: string, cible: string, icone: string | null) =>
  tenter(db, appareil, 'update public.profils set icone = $2 where id = $1 returning *', [cible, icone]);

/** Pose la Journée comme le client le fait : une valeur non nulle, que le serveur redate. */
const poserJournee = (db: Base, appareil: string, cible: string, valeur: string | null = '2000-01-01T00:00:00Z') =>
  tenter(db, appareil, 'update public.profils set journee_faite_le = $2 where id = $1 returning *', [cible, valeur]);

async function ligneDe(db: Base, appareil: string) {
  const { rows } = await db.query<{ icone: string | null; journee_faite_le: string | null }>(
    'select icone, journee_faite_le from public.profils where id = $1',
    [appareil]
  );
  return rows[0];
}

// Ce test garde 0027 : la base s'arrête à elle. La liste fermée de 0029 a son propre test
// (`profil-icone-liste.test.ts`), et elle refuserait les slugs de forme libre d'ici.
async function monde(sql: string = jusqua(MIGRATION)): Promise<Base> {
  const db = await base(sql);
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
  return db;
}

async function sansGarde(db: Base) {
  await db.exec('drop trigger if exists profils_gardes on public.profils;');
}

describe('icône de profil et Journée faite (#781, D-197)', () => {
  it('(a) l icône est un slug court : forme fautive refusée, bonne forme acceptée, et elle se change', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    for (const fautive of [
      'Chef',
      'chef_de_cabinet',
      'chef de cabinet',
      '-chef',
      'chef-',
      'chef--2',
      '',
      'é',
      'x'.repeat(41)
    ]) {
      refuse(await poserIcone(db, APPAREIL_A, APPAREIL_A, fautive), /profils_icone_check|check constraint/i);
    }
    accepte(await poserIcone(db, APPAREIL_A, APPAREIL_A, 'chef-de-cabinet'));
    accepte(await poserIcone(db, APPAREIL_A, APPAREIL_A, 'tasse-3'));
    accepte(await poserIcone(db, APPAREIL_A, APPAREIL_A, 'x'.repeat(40)));
    expect((await ligneDe(db, APPAREIL_A))?.icone).toBe('x'.repeat(40));
  });

  it('(b) un autre compte ne pose pas l icône d un autre : 0 ligne, et la ligne ne bouge pas', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    zeroLigne(await poserIcone(db, APPAREIL_B, APPAREIL_A, 'tasse-3'));
    expect((await ligneDe(db, APPAREIL_A))?.icone).toBeNull();
  });

  it('(c) la Journée se pose une fois, et la date vient du serveur, pas du client', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    const avant = Date.now();
    accepte(await poserJournee(db, APPAREIL_A, APPAREIL_A, '2000-01-01T00:00:00Z'));
    const date = (await ligneDe(db, APPAREIL_A))?.journee_faite_le;
    expect(date).not.toBeNull();
    // Le client a envoyé l'an 2000 : la base a écrit « maintenant ».
    expect(new Date(date as string).getTime()).toBeGreaterThanOrEqual(avant - 60_000);
  });

  it('(d) la Journée faite ne se défait pas : ni remise à null, ni redatée', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    accepte(await poserJournee(db, APPAREIL_A, APPAREIL_A));
    const posee = (await ligneDe(db, APPAREIL_A))?.journee_faite_le;
    refuse(await poserJournee(db, APPAREIL_A, APPAREIL_A, null), /profils_journee_figee/);
    refuse(await poserJournee(db, APPAREIL_A, APPAREIL_A, '2030-06-01T00:00:00Z'), /profils_journee_figee/);
    // Réécrire la **même** date passe : c'est le rejeu sans changement, pas un défaire.
    accepte(await poserJournee(db, APPAREIL_A, APPAREIL_A, posee));
    expect((await ligneDe(db, APPAREIL_A))?.journee_faite_le).toEqual(posee);
  });

  it('(e) un autre compte ne pose pas la Journée d un autre : 0 ligne, la Journée reste à faire', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    zeroLigne(await poserJournee(db, APPAREIL_B, APPAREIL_A));
    expect((await ligneDe(db, APPAREIL_A))?.journee_faite_le).toBeNull();
  });

  it('(f) un profil neuf n a ni icône ni Journée ; il peut naître avec une icône, jamais « Journée faite »', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    expect(await ligneDe(db, APPAREIL_A)).toEqual({ icone: null, journee_faite_le: null });
    accepte(
      await tenter(db, APPAREIL_B, 'insert into public.profils (id, pseudo, icone) values ($1, $2, $3) returning *', [
        APPAREIL_B,
        'Bastien',
        'tasse-3'
      ])
    );
    expect((await ligneDe(db, APPAREIL_B))?.icone).toBe('tasse-3');
    // La colonne n'est pas accordée à l'insertion : c'est la base qui refuse, pas l'écran.
    const db2 = await monde();
    refuse(
      await tenter(
        db2,
        APPAREIL_A,
        'insert into public.profils (id, pseudo, journee_faite_le) values ($1, $2, now()) returning *',
        [APPAREIL_A, 'Anaïs']
      ),
      /permission denied/i
    );
  });

  it('(g) la migration ne casse aucune ligne existante et se rejoue', async () => {
    // La base jusqu'à 0026, un profil complet comme ceux d'avant, puis 0027.
    const db = await base(jusqua('0026_import_deck.sql'));
    await creerCompte(db, APPAREIL_A);
    await db.query("insert into public.profils (id, pseudo, service) values ($1, 'Anaïs', '2e')", [APPAREIL_A]);
    await db.query("update public.profils set intitule = 'sculpteur de fumée' where id = $1", [APPAREIL_A]);

    await db.exec(lire(MIGRATION));
    // Idempotente : une seconde fois sans erreur.
    await db.exec(lire(MIGRATION));

    const { rows } = await db.query<Record<string, unknown>>('select * from public.profils where id = $1', [
      APPAREIL_A
    ]);
    expect(rows[0]).toMatchObject({
      pseudo: 'Anaïs',
      service: '2e',
      intitule: 'sculpteur de fumée',
      intitule_relances: 0,
      icone: null,
      journee_faite_le: null
    });
    // Et la ligne d'avant accepte les colonnes nouvelles.
    accepte(await poserIcone(db, APPAREIL_A, APPAREIL_A, 'tasse-3'));
    accepte(await poserJournee(db, APPAREIL_A, APPAREIL_A));
  });

  it('(h) les gardes de 0019 parlent encore après 0027 : service et intitulé figés, relance bornée', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    accepte(await tenter(db, APPAREIL_A, "update public.profils set service = '2e' where id = $1", [APPAREIL_A]));
    refuse(
      await tenter(db, APPAREIL_A, "update public.profils set service = '3e' where id = $1", [APPAREIL_A]),
      /profils_service_fige/
    );
    accepte(
      await tenter(db, APPAREIL_A, "update public.profils set intitule = 'sculpteur de fumée' where id = $1", [
        APPAREIL_A
      ])
    );
    refuse(
      await tenter(db, APPAREIL_A, "update public.profils set intitule = 'autre' where id = $1", [APPAREIL_A]),
      /profils_intitule_fige/
    );
    refuse(
      await tenter(db, APPAREIL_A, 'update public.profils set intitule_relances = 1 where id = $1', [APPAREIL_A]),
      /profils_relance_figee/
    );
  });

  describe('le contrôle mord : chaque garde, retirée ou mutée, laisse passer le geste fautif', () => {
    it('sans profils_gardes, la Journée faite se défait et se redate', async () => {
      const db = await monde();
      await sansGarde(db);
      accepte(await creer(db, APPAREIL_A));
      accepte(await poserJournee(db, APPAREIL_A, APPAREIL_A));
      accepte(await poserJournee(db, APPAREIL_A, APPAREIL_A, null));
      expect((await ligneDe(db, APPAREIL_A))?.journee_faite_le).toBeNull();
    });

    it('sans profils_gardes, la date du client est gardée telle quelle', async () => {
      const db = await monde();
      await sansGarde(db);
      accepte(await creer(db, APPAREIL_A));
      accepte(await poserJournee(db, APPAREIL_A, APPAREIL_A, '2000-01-01T00:00:00Z'));
      expect(new Date((await ligneDe(db, APPAREIL_A))?.journee_faite_le as string).getUTCFullYear()).toBe(2000);
    });

    it('sans profils_icone_check, une icône hors forme passe', async () => {
      const db = await monde();
      await db.exec('alter table public.profils drop constraint if exists profils_icone_check;');
      accepte(await creer(db, APPAREIL_A));
      accepte(await poserIcone(db, APPAREIL_A, APPAREIL_A, 'Chef De Cabinet'));
    });

    it('la migration mutée sans son check laisse passer l icône fautive', async () => {
      const sans = migrationsMutees(MIGRATION, ["and icone ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", '']);
      expect(sans).not.toBe(jusqua(MIGRATION));
      const db = await monde(sans);
      accepte(await creer(db, APPAREIL_A));
      accepte(await poserIcone(db, APPAREIL_A, APPAREIL_A, 'Chef De Cabinet'));
    });

    it('la migration mutée sans la garde journée laisse défaire la Journée', async () => {
      const sans = migrationsMutees(MIGRATION, [
        'if old.journee_faite_le is not null and new.journee_faite_le is distinct from old.journee_faite_le then',
        'if false then'
      ]);
      const db = await monde(sans);
      accepte(await creer(db, APPAREIL_A));
      accepte(await poserJournee(db, APPAREIL_A, APPAREIL_A));
      accepte(await poserJournee(db, APPAREIL_A, APPAREIL_A, null));
    });

    it('les politiques RLS de 0019 ouvertes laissent un compte poser la Journée d un autre', async () => {
      // Les deux politiques : `update … returning` passe aussi par celle de lecture.
      const ouverte = migrationsMutees(
        '0019_profils.sql',
        [
          `  on public.profils for select to authenticated
  using (id = auth.uid());`,
          `  on public.profils for select to authenticated
  using (true);`
        ],
        [
          `  on public.profils for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());`,
          `  on public.profils for update to authenticated
  using (true)
  with check (true);`
        ]
      );
      const db = await monde(ouverte);
      accepte(await creer(db, APPAREIL_A));
      const issue = await poserJournee(db, APPAREIL_B, APPAREIL_A);
      accepte(issue);
      if (issue.accepte) expect(issue.lignes).toHaveLength(1);
      expect((await ligneDe(db, APPAREIL_A))?.journee_faite_le).not.toBeNull();
    });
  });
});
