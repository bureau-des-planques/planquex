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
  -- Depuis la 0005 (D-088), les comptes vivent dans public.comptes, avec une clé étrangère
  -- vers auth.users et un déclencheur posé sur cette table : le shim doit donc la fournir.
  -- Deux colonnes suffisent — celles que la migration lit (id, email) — et elles sont
  -- celles que GoTrue remplit à l'inscription.
  create table if not exists auth.users (
    id    uuid primary key,
    email text
  );
  create role authenticated noinherit;
  create role anon noinherit;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;

/** Deux appareils distincts, pour les scénarios « le mien / celui d'un autre ». */
export const APPAREIL_A = '11111111-1111-4111-8111-111111111111';
export const APPAREIL_B = '22222222-2222-4222-8222-222222222222';

/** Un compte d'administration, pour les scénarios d'approbation (#181). */
export const ADMIN = '33333333-3333-4333-8333-333333333333';
/** Un troisième compte, en attente, pour les scénarios d'écriture refusée (#181). */
export const APPAREIL_C = '44444444-4444-4444-8444-444444444444';

export interface EtatCompteBanc {
  /**
   * L'état de la demande. `approuve` (le défaut) : c'est ce qu'il faut aux gardes
   * antérieures à la 0005, qui écrivent sans se soucier de l'approbation. `en attente` et
   * `refuse` servent aux scénarios de refus (#181).
   */
  etat?: 'en attente' | 'approuve' | 'refuse';
  administrateur?: boolean;
  courriel?: string;
}

/**
 * Crée un compte dans `auth.users` — donc, par le déclencheur de la 0005, une ligne
 * `public.comptes` **en attente** — puis pose son état. On passe par `auth.users` et non par
 * un `insert` direct dans `comptes` : c'est le chemin réel de la première connexion, et il
 * éprouve le déclencheur au passage.
 */
export async function creerCompte(
  db: Base,
  appareil: string,
  options: EtatCompteBanc = {},
): Promise<void> {
  await db.query(
    `insert into auth.users (id, email) values ($1, $2)
     on conflict (id) do update set email = excluded.email`,
    [appareil, options.courriel ?? `${appareil.slice(0, 8)}@exemple.test`],
  );

  const existe = await db.query<{ id: string }>('select id from public.comptes where id = $1', [
    appareil,
  ]);
  if (existe.rows.length === 0) {
    throw new Error(`le déclencheur n’a pas créé de compte pour ${appareil}`);
  }

  await db.query(
    `update public.comptes
        set etat = $2,
            administrateur = $3,
            raison = case when $2 = 'refuse' then coalesce(nullif($4, ''), 'Refusé par le test.') else '' end
      where id = $1`,
    [appareil, options.etat ?? 'approuve', options.administrateur ?? false, ''],
  );
}

/** Le raccourci des gardes écrites avant la 0005 : leurs deux appareils sont approuvés. */
export async function approuverAppareils(db: Base): Promise<void> {
  for (const appareil of [APPAREIL_A, APPAREIL_B]) {
    await creerCompte(db, appareil, { etat: 'approuve' });
  }
}

export type Base = PGlite;

/** Une base neuve, shim puis migrations : l'état d'un projet Supabase juste après `db push`. */
export async function base(sql: string = migrations()): Promise<Base> {
  const db = new PGlite();
  await db.exec(SHIM);
  await db.exec(sql);
  return db;
}

/**
 * Une base neuve, puis **deux appareils approuvés**. C'est ce que demandent les gardes du
 * mur et des combats, écrites avant D-088 : elles éprouvent « chacun n'écrit que les
 * siennes », pas l'approbation. Les scénarios d'approbation (`comptes.test.ts`) partent de
 * `base()` et créent leurs comptes eux-mêmes, en attente ou refusés.
 */
export async function baseAvecAppareils(sql: string = migrations()): Promise<Base> {
  const db = await base(sql);
  await approuverAppareils(db);
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
