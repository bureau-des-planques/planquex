// @vitest-environment node
// Lent : un cas par scénario, chacun avec son SQL ; `base()` reprend une instance PGlite vidée au lieu de la remonter (D-143 (4), #422) — il reste le travail SQL, pas la règle testée.
/**
 * Qui exécute quoi, dans `public` — #341 (migration `0018_pgnet_et_fonctions_fermees.sql`).
 *
 * Le constat (#341, D-133) : sept fonctions `SECURITY DEFINER` étaient exécutables par
 * `authenticated`, dont deux **déclencheurs** qui n'ont jamais eu besoin de l'être — un
 * déclencheur ne vérifie pas l'`EXECUTE` de son appelant. La base doit maintenant tenir un
 * invariant lisible d'un coup d'œil :
 *
 *   (a) **`anon` n'exécute aucune fonction de `public`** ;
 *   (b) **`authenticated` exécute exactement les cinq** que le client appelle ou que la RLS
 *       cite : `corriger_postit`, `deplacer_postit`, `marquer_comite_vu`, `compte_approuve`,
 *       `est_administrateur` (D-133 (3)) ;
 *   (c) la migration **se rejoue** sur une base déjà à jour ;
 *   (d) **le contrôle mord** : une fonction fabriquée laissée ouverte de plus est dénoncée.
 *
 * Même piège que `anon.test.ts`, et même parade : les privilèges par défaut de Supabase
 * accordent `EXECUTE` sur les fonctions de `public` à `anon` et à `authenticated` (le shim de
 * `pglite.ts` ne reproduit que celui des tables). Sans eux, `anon` n'aurait rien et la garde
 * ne prouverait rien — on les pose donc **avant** les migrations.
 */
import { describe, expect, it } from 'vitest';
import { base, fichiersMigrations, migrations, type Base } from './pglite';

/** Les privilèges par défaut de Supabase sur les fonctions de `public` (absents du shim). */
const DROITS_PAR_DEFAUT_SUPABASE =
  'alter default privileges in schema public grant execute on functions to anon, authenticated;';

/** Les seules fonctions de `public` que `authenticated` a le droit d'exécuter (D-133 (3)). */
export const OUVERTS_ATTENDUS = [
  'compte_approuve',
  'corriger_postit',
  'deplacer_postit',
  'est_administrateur',
  'marquer_comite_vu'
] as const;

/**
 * Les défauts de l'invariant : vide = la base est saine. Fonction pure, pour que le contrôle
 * puisse être confronté à des listes fabriquées — sans quoi il ne prouverait rien.
 */
export function defautsExecute(
  ouverts: { anon: readonly string[]; authenticated: readonly string[] },
  attendus: readonly string[] = OUVERTS_ATTENDUS
): string[] {
  const defauts: string[] = [];
  if (ouverts.anon.length > 0) {
    defauts.push(`anon exécute ${ouverts.anon.join(', ')}`);
  }
  const deTrop = ouverts.authenticated.filter((nom) => !attendus.includes(nom));
  const manquants = attendus.filter((nom) => !ouverts.authenticated.includes(nom));
  if (deTrop.length > 0) defauts.push(`authenticated exécute de trop : ${deTrop.join(', ')}`);
  if (manquants.length > 0) defauts.push(`authenticated n'exécute plus : ${manquants.join(', ')}`);
  return defauts;
}

/** Les fonctions de `public` que `role` peut exécuter, triées. */
async function fonctionsOuvertes(db: Base, role: 'anon' | 'authenticated'): Promise<string[]> {
  const resultat = await db.query<{ proname: string }>(
    `select p.proname
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind = 'f'
        and has_function_privilege($1::text, p.oid, 'execute')
      order by p.proname`,
    [role]
  );
  return resultat.rows.map((ligne) => ligne.proname);
}

/** Une base neuve avec les privilèges par défaut de Supabase, puis les migrations réelles. */
async function baseSupabase(sql: string = migrations()): Promise<Base> {
  return base(`${DROITS_PAR_DEFAUT_SUPABASE}\n${sql}`);
}

/** La 0018, lue paresseusement : sans elle, le test parlerait d'un fichier absent. */
export function migrationFonctions(): string {
  const trouvee = fichiersMigrations().find((sql) => sql.includes('from public, anon, authenticated'));
  if (!trouvee) throw new Error('supabase/migrations/0018_pgnet_et_fonctions_fermees.sql introuvable');
  return trouvee;
}

describe('les fonctions de `public` (#341, D-133)', () => {
  it('(a) `anon` n’exécute aucune fonction de `public`', async () => {
    const db = await baseSupabase();
    expect(await fonctionsOuvertes(db, 'anon')).toEqual([]);
    await db.close();
  });

  it('(b) `authenticated` exécute exactement les cinq fonctions justifiées', async () => {
    const db = await baseSupabase();
    const ouverts = await fonctionsOuvertes(db, 'authenticated');
    expect(ouverts).toEqual([...OUVERTS_ATTENDUS].sort());
    expect(defautsExecute({ anon: [], authenticated: ouverts })).toEqual([]);
    await db.close();
  });

  it('(b bis) les deux déclencheurs de `comptes` sont fermés à `authenticated`', async () => {
    const db = await baseSupabase();
    const ouverts = await fonctionsOuvertes(db, 'authenticated');
    expect(ouverts).not.toContain('comptes_creation');
    expect(ouverts).not.toContain('comptes_decision');
    await db.close();
  });

  it('(c) la migration se rejoue sur une base déjà à jour', async () => {
    const db = await base(`${DROITS_PAR_DEFAUT_SUPABASE}\n${migrations()}\n${migrationFonctions()}`);
    expect(await fonctionsOuvertes(db, 'anon')).toEqual([]);
    expect(await fonctionsOuvertes(db, 'authenticated')).toEqual([...OUVERTS_ATTENDUS].sort());
    await db.close();
  });

  describe('le contrôle mord', () => {
    it('une fonction laissée ouverte de plus est dénoncée', async () => {
      const db = await baseSupabase();
      // Le cas fautif fabriqué : une fonction de `public` que la migration n'a pas fermée,
      // et que le client peut exécuter. C'est exactement le défaut que #341 corrige.
      await db.exec(
        `create function public.fuite_execute() returns integer language sql as $$ select 1 $$;
         revoke execute on function public.fuite_execute() from public, anon;
         grant execute on function public.fuite_execute() to authenticated;`
      );
      const ouverts = await fonctionsOuvertes(db, 'authenticated');
      expect(defautsExecute({ anon: await fonctionsOuvertes(db, 'anon'), authenticated: ouverts })).toEqual([
        'authenticated exécute de trop : fuite_execute'
      ]);
      await db.close();
    });

    it('une fonction créée mais fermée n’est pas dénoncée — c’est bien le droit qui est lu', async () => {
      const db = await baseSupabase();
      await db.exec(`create function public.fuite_sans_droit() returns integer language sql as $$ select 1 $$;
                     revoke execute on function public.fuite_sans_droit() from public, anon, authenticated;`);
      const ouverts = await fonctionsOuvertes(db, 'authenticated');
      expect(defautsExecute({ anon: await fonctionsOuvertes(db, 'anon'), authenticated: ouverts })).toEqual([]);
      await db.close();
    });

    it('une fonction retirée de la liste justifiée est dénoncée', () => {
      expect(defautsExecute({ anon: [], authenticated: ['corriger_postit'] })).toEqual([
        "authenticated n'exécute plus : compte_approuve, deplacer_postit, est_administrateur, marquer_comite_vu"
      ]);
    });

    it('une fonction rendue à `anon` est dénoncée', () => {
      expect(defautsExecute({ anon: ['marquer_comite_vu'], authenticated: [...OUVERTS_ATTENDUS] })).toEqual([
        'anon exécute marquer_comite_vu'
      ]);
    });
  });
});
