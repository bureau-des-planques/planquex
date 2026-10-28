// @vitest-environment node
// Lent : un cas par scénario, chacun avec son SQL ; `base()` reprend une instance PGlite vidée au lieu de la remonter (D-143 (4), #422) — il reste le travail SQL, pas la règle testée.
/**
 * `anon` n'exécute aucune fonction `security definer` de `public` — #247, migration
 * `0011_anon_hors_fonctions.sql`.
 *
 * Même banc que les autres gardes : les migrations **réelles** lues sur disque et jouées dans
 * PGlite (PostgreSQL en WASM), en rôle `anon` pour les gestes.
 *
 * Le piège que ce fichier éprouve : les valeurs par défaut de Supabase accordent `execute` sur
 * les fonctions de `public` à `anon` et à `authenticated`. `revoke ... from public` ne retire
 * donc rien à `anon`. Le shim de `pglite.ts` ne reproduit pas ce privilège (il ne déclare que
 * celui des tables) : sans lui, `anon` n'aurait jamais `execute` et la garde ne prouverait rien.
 * Le préfixe ci-dessous le reproduit, pour cette base seulement.
 *
 * Ce que la base doit tenir, et que ce fichier éprouve :
 *
 *   (a) aucune fonction `security definer` de `public` n'est exécutable par `anon` ;
 *   (b) les fonctions d'écriture restent exécutables par `authenticated` (on n'a rien cassé) ;
 *   (c) un appel de `anon` à `corriger_postit` est refusé **par le droit**, avant le contrôle
 *       de compte ;
 *   (d) **le contrôle mord** : la migration dont le `revoke ... from anon` est retiré laisse
 *       `anon` exécuter les fonctions d'écriture.
 */
import { describe, expect, it } from 'vitest';
import { base, fichiersMigrations, migrations, type Base } from './pglite';

/** Les privilèges par défaut de Supabase sur les fonctions de `public` (absents du shim). */
const DROITS_PAR_DEFAUT_SUPABASE =
  'alter default privileges in schema public grant execute on functions to anon, authenticated;';

/** Les fonctions `security definer` que la 0011 doit fermer à `anon`. */
const SECURITY_DEFINER_ATTENDUES = [
  'corriger_postit(text,text,text)',
  'deplacer_postit(text,double precision,double precision,double precision)',
  'marquer_comite_vu()',
  'compte_approuve()',
  'est_administrateur()',
  'comptes_creation()',
  'comptes_decision()'
];

/** Les fonctions d'écriture, que `authenticated` doit toujours pouvoir appeler. */
const ECRITURE = [
  'corriger_postit(text,text,text)',
  'deplacer_postit(text,double precision,double precision,double precision)',
  'marquer_comite_vu()'
];

/** La 0011, lue paresseusement : sans elle, les scénarios échouent **par le fond**. */
function migrationAnon(): string {
  const trouvee = fichiersMigrations().find((sql) => sql.includes('from public, anon'));
  if (!trouvee) throw new Error('supabase/migrations/0011_anon_hors_fonctions.sql introuvable');
  return trouvee;
}

/** Une base neuve avec les privilèges par défaut de Supabase, puis les migrations réelles. */
async function baseSupabase(sql: string = migrations()): Promise<Base> {
  return base(`${DROITS_PAR_DEFAUT_SUPABASE}\n${sql}`);
}

/** Les fonctions `security definer` de `public`, telles que la base les voit. */
async function fonctionsSecurityDefiner(db: Base): Promise<string[]> {
  const res = await db.query<{ signature: string }>(
    `select p.oid::regprocedure::text as signature
       from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.prosecdef
      order by 1`
  );
  return res.rows.map((ligne) => ligne.signature);
}

/** Vrai si le rôle `role` peut exécuter la fonction `signature`. */
async function peutExecuter(db: Base, role: string, signature: string): Promise<boolean> {
  const res = await db.query<{ ok: boolean }>(`select has_function_privilege($1, $2::regprocedure, 'execute') as ok`, [
    role,
    signature
  ]);
  return res.rows[0].ok;
}

describe('anon n’exécute aucune fonction security definer de public (0011, #247)', () => {
  it('la base expose bien les sept fonctions attendues (la garde ne porte pas sur le vide)', async () => {
    const db = await baseSupabase();
    try {
      const trouvees = await fonctionsSecurityDefiner(db);
      for (const attendue of SECURITY_DEFINER_ATTENDUES) {
        expect(trouvees, `${attendue} absente de public`).toContain(attendue);
      }
    } finally {
      await db.close();
    }
  });

  it('anon n’a `execute` sur aucune d’elles', async () => {
    const db = await baseSupabase();
    try {
      const trouvees = await fonctionsSecurityDefiner(db);
      for (const signature of trouvees) {
        expect(await peutExecuter(db, 'anon', signature), `anon exécute ${signature}`).toBe(false);
      }
    } finally {
      await db.close();
    }
  });

  it('authenticated garde `execute` sur les fonctions d’écriture', async () => {
    const db = await baseSupabase();
    try {
      for (const signature of ECRITURE) {
        expect(await peutExecuter(db, 'authenticated', signature), `authenticated n'exécute plus ${signature}`).toBe(
          true
        );
      }
    } finally {
      await db.close();
    }
  });

  it('anon appelle corriger_postit : refusé par le droit, avant le contrôle de compte', async () => {
    const db = await baseSupabase();
    try {
      await db.exec('set role anon');
      let message = '';
      try {
        await db.query(`select public.corriger_postit('p-a', 'Titre', 'Texte.')`);
      } catch (erreur) {
        message = erreur instanceof Error ? erreur.message : String(erreur);
      } finally {
        await db.exec('reset role');
      }
      expect(message).toMatch(/permission denied/);
    } finally {
      await db.close();
    }
  });
});

describe('le contrôle mord — 0011 neutralisée, anon exécute', () => {
  /** Le `revoke ... from public, anon` retiré pour `anon` : seul `public` reste révoqué. */
  const mutee = () => {
    const migration = migrationAnon();
    const motif = 'from public, anon;';
    expect(migration.split(motif).length - 1, `motif introuvable : ${motif}`).toBe(7);
    const neutralisee = migration.replaceAll(motif, 'from public;');
    expect(neutralisee).not.toBe(migration);
    return migrations().replace(migration, () => neutralisee);
  };

  it('sans le revoke pour anon, anon exécute corriger_postit, deplacer_postit et marquer_comite_vu', async () => {
    const db = await baseSupabase(mutee());
    try {
      for (const signature of ECRITURE) {
        expect(await peutExecuter(db, 'anon', signature), `la garde ne mord pas sur ${signature}`).toBe(true);
      }
    } finally {
      await db.close();
    }
  }, 90_000);

  it('et l’appel de anon à corriger_postit passe le droit (il n’échoue plus sur « permission denied »)', async () => {
    const db = await baseSupabase(mutee());
    try {
      await db.exec('set role anon');
      let message = '';
      try {
        await db.query(`select public.corriger_postit('p-a', 'Titre', 'Texte.')`);
      } catch (erreur) {
        message = erreur instanceof Error ? erreur.message : String(erreur);
      } finally {
        await db.exec('reset role');
      }
      expect(message).not.toMatch(/permission denied for function/);
    } finally {
      await db.close();
    }
  }, 90_000);
});
