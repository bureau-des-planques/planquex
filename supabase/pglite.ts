/**
 * Le banc d'essai des migrations Supabase — PGlite (PostgreSQL en WASM, RLS comprise).
 *
 * Partagé par les gardes (`mur.test.ts`, `combats.test.ts`) pour une raison précise : une
 * migration nouvelle s'ajoute au dossier, et **toutes** les gardes doivent la jouer. Deux
 * copies du chargeur prendraient du retard l'une sur l'autre, et une garde qui ne joue pas
 * la migration qu'on applique ne garde rien (leçon de #101 / #107 / #103, ticket #112).
 *
 * Le shim est ce que Supabase fournit déjà à côté d'une migration : le schéma `auth`,
 * `auth.uid()` et les rôles `authenticated` / `anon`. Il ne fait **pas** partie des
 * migrations, et c'est le seul endroit où l'on choisit l'appareil :
 *
 * ```sql
 * set role authenticated;
 * set request.jwt.claim.sub = '<uuid de l'appareil>';
 * ```
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

export const DOSSIER_MIGRATIONS = fileURLToPath(new URL('./migrations/', import.meta.url));

/** Les migrations, **fichier par fichier**, dans l'ordre de leur nom. */
export function fichiersMigrations(): string[] {
  const noms = readdirSync(DOSSIER_MIGRATIONS)
    .filter((nom) => nom.endsWith('.sql'))
    .sort();
  // Une base sans migration passerait tous les scénarios sans rien prouver : on refuse.
  if (noms.length === 0) throw new Error(`Aucune migration dans ${DOSSIER_MIGRATIONS}`);
  return noms.map((nom) => readFileSync(new URL(`./migrations/${nom}`, import.meta.url), 'utf8'));
}

/** Toutes les migrations bout à bout : ce que `supabase db push` applique, dans l'ordre. */
export function migrations(): string {
  return fichiersMigrations().join('\n');
}

/**
 * Ce que Supabase fournit déjà : `auth.uid()` lit le sujet du JWT, les deux rôles existent,
 * et **les privilèges par défaut ouvrent les nouvelles tables à `anon` et `authenticated`**
 * (c'est écrit dans `0001_mur.sql` : sans la révocation, Supabase les ouvrirait). Le shim
 * reproduit ce défaut, sinon `revoke all … from anon` ne serait jamais éprouvé : une table
 * neuve serait fermée d'office et la garde passerait sans rien prouver.
 */
export const SHIM = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated noinherit;
  create role anon noinherit;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;

/** Deux appareils distincts, pour les scénarios « le mien / celui d'un autre ». */
export const APPAREIL_A = '11111111-1111-4111-8111-111111111111';
export const APPAREIL_B = '22222222-2222-4222-8222-222222222222';

export type Base = PGlite;

/** Une base neuve, shim puis migrations : l'état d'un projet Supabase juste après `db push`. */
export async function base(sql: string = migrations()): Promise<Base> {
  const db = new PGlite();
  await db.exec(SHIM);
  await db.exec(sql);
  return db;
}

/** Joue un geste en tant qu'appareil (identité anonyme), puis rend le rôle et le sujet. */
export async function avecAppareil<T>(
  db: Base,
  appareil: string,
  geste: () => Promise<T>,
): Promise<T> {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${appareil}';`);
  try {
    return await geste();
  } finally {
    await db.exec('reset role; reset request.jwt.claim.sub;');
  }
}
