// @vitest-environment node
/**
 * La liste fermée des icônes de profil — la migration `0029_profil_icone_liste.sql`
 * (#791, D-197 (2)). Même banc que `profil-icone-journee.test.ts` : les migrations réelles,
 * jouées dans PGlite, en rôle `authenticated`.
 *
 * Ce que la base doit tenir :
 *
 *   (a) les **douze** slugs du lot passent, et l'icône se change de l'un à l'autre ;
 *   (b) un slug **bien formé mais hors liste** est refusé (`profils_icone_check`) ; une forme
 *       fautive aussi ; `null` reste permis (le parcours ne l'a pas encore posée) ;
 *   (c) une ligne d'**avant** (icône de forme libre posée sous 0027) : la liste est **vidée** si
 *       hors liste, **gardée** si dans la liste, et rien d'autre dans la ligne ne bouge ;
 *   (d) la migration **se rejoue** ;
 *   (e) la liste de la base est **la même** que celle du client (`ICONES_PROFIL`).
 *
 * **Le contrôle mord** : la contrainte retirée laisse passer l'icône hors liste ; la migration
 * mutée sans son `check`, ou sans sa réécriture, laisse passer le geste fautif.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICONES_PROFIL } from '../src/lib/profil';
import { APPAREIL_A, avecAppareil, base, creerCompte, type Base } from './pglite';

const MIGRATION = '0029_profil_icone_liste.sql';

const NOMS = readdirSync(new URL('./migrations/', import.meta.url))
  .filter((nom) => nom.endsWith('.sql'))
  .sort();
const lire = (nom: string): string => readFileSync(new URL(`./migrations/${nom}`, import.meta.url), 'utf8');
const jusqua = (derniere: string): string =>
  NOMS.filter((nom) => nom <= derniere)
    .map(lire)
    .join('\n');

/** Toutes les migrations, avec un bout de texte retiré dans **la** migration 0029 (il doit exister). */
function migrationsMutees(...mutations: Array<[avant: string, apres: string]>): string {
  let source = lire(MIGRATION);
  for (const [avant, apres] of mutations) {
    if (!source.includes(avant)) throw new Error(`${MIGRATION} ne contient pas « ${avant} » : la mutation ne mord pas`);
    source = source.replace(avant, apres);
  }
  return NOMS.map((n) => (n === MIGRATION ? source : lire(n))).join('\n');
}

type Issue = { accepte: true } | { accepte: false; message: string };

async function poser(db: Base, icone: string | null): Promise<Issue> {
  try {
    await avecAppareil(db, APPAREIL_A, () =>
      db.query('update public.profils set icone = $1 where id = $2', [icone, APPAREIL_A])
    );
    return { accepte: true };
  } catch (erreur) {
    return { accepte: false, message: erreur instanceof Error ? erreur.message : String(erreur) };
  }
}
const refuse = (issue: Issue) => {
  expect(issue.accepte, 'le geste aurait dû être refusé').toBe(false);
  if (!issue.accepte) expect(issue.message).toMatch(/profils_icone_check|check constraint/i);
};
const accepte = (issue: Issue) =>
  expect(issue.accepte, issue.accepte ? '' : (issue as { message: string }).message).toBe(true);

async function monde(sql?: string): Promise<Base> {
  const db = await base(sql);
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await db.query("insert into public.profils (id, pseudo) values ($1, 'Anaïs')", [APPAREIL_A]);
  return db;
}
const icone = async (db: Base) =>
  (await db.query<{ icone: string | null }>('select icone from public.profils where id = $1', [APPAREIL_A])).rows[0]
    ?.icone;

describe('liste fermée des icônes de profil (#791, D-197 (2))', () => {
  it('(a) les douze slugs passent, et l’icône se change de l’un à l’autre', async () => {
    const db = await monde();
    expect(ICONES_PROFIL).toHaveLength(12);
    for (const { slug } of ICONES_PROFIL) {
      accepte(await poser(db, slug));
      expect(await icone(db)).toBe(slug);
    }
  });

  it('(b) un slug bien formé mais hors liste est refusé, une forme fautive aussi, null passe', async () => {
    const db = await monde();
    for (const fautive of ['chef-de-cabinet', 'tasse-3', 'x'.repeat(40), 'Comptable', 'comptable-', '']) {
      refuse(await poser(db, fautive));
    }
    accepte(await poser(db, 'comptable'));
    accepte(await poser(db, null));
    expect(await icone(db)).toBeNull();
  });

  it('(c) une ligne d’avant : hors liste, l’icône est vidée ; dans la liste, elle est gardée', async () => {
    const db = await base(jusqua('0028_arrivage_compte_approuve.sql'));
    await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
    await creerCompte(db, '00000000-0000-0000-0000-00000000000b', { etat: 'approuve' });
    await db.query("insert into public.profils (id, pseudo, service, icone) values ($1, 'Anaïs', '2e', 'tasse-3')", [
      APPAREIL_A
    ]);
    await db.query("insert into public.profils (id, pseudo, icone) values ($1, 'Bastien', 'juriste')", [
      '00000000-0000-0000-0000-00000000000b'
    ]);
    await db.exec(lire(MIGRATION));
    const { rows } = await db.query<Record<string, unknown>>(
      'select pseudo, service, icone from public.profils order by pseudo'
    );
    expect(rows).toEqual([
      { pseudo: 'Anaïs', service: '2e', icone: null },
      { pseudo: 'Bastien', service: null, icone: 'juriste' }
    ]);
  });

  it('(d) la migration se rejoue sans erreur', async () => {
    const db = await monde();
    accepte(await poser(db, 'archiviste'));
    await db.exec(lire(MIGRATION));
    expect(await icone(db)).toBe('archiviste');
    refuse(await poser(db, 'tasse-3'));
  });

  it('(e) la liste de la base est celle du client', () => {
    const dansLeSql = [
      ...lire(MIGRATION)
        .split('add constraint')[1]!
        .matchAll(/'([a-z0-9-]+)'/g)
    ].map((m) => m[1]);
    expect([...dansLeSql].sort()).toEqual(ICONES_PROFIL.map((i) => i.slug).sort());
  });

  describe('le contrôle mord', () => {
    it('sans profils_icone_check, une icône hors liste passe', async () => {
      const db = await monde();
      await db.exec('alter table public.profils drop constraint profils_icone_check;');
      accepte(await poser(db, 'tasse-3'));
    });

    it('la migration mutée sans son check laisse passer l’icône hors liste', async () => {
      const sans = migrationsMutees(['    icone is null\n    or icone in (', '    true\n    or icone in (']);
      expect(sans).not.toBe(jusqua(MIGRATION));
      const db = await monde(sans);
      accepte(await poser(db, 'tasse-3'));
    });

    it('la migration mutée sans sa réécriture laisse une ligne d’avant hors liste (la contrainte se pose mal)', async () => {
      const sans = migrationsMutees(['set icone = null', 'set icone = icone']);
      const db = await base(jusqua('0028_arrivage_compte_approuve.sql'));
      await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
      await db.query("insert into public.profils (id, pseudo, icone) values ($1, 'Anaïs', 'tasse-3')", [APPAREIL_A]);
      await expect(db.exec(sans.slice(jusqua('0028_arrivage_compte_approuve.sql').length))).rejects.toThrow(
        /profils_icone_check|check constraint/i
      );
    });
  });
});
