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
 * Ce que Supabase fournit **autour** d'une migration et que PGlite n'a pas (mesuré le
 * 27/10/2026, PGlite 0.5.11 : `pg_cron`, `pg_net` et `vault` répondent tous les trois
 * `extension "…" is not available`). Sans ce shim, la migration qui fait parler le mur
 * (D-120) ne pourrait pas être **rejouée** par la garde — et une migration qu'on ne rejoue
 * pas n'est gardée par rien.
 *
 * Trois schémas, réduits à ce que la migration touche :
 *
 * - **`cron`** : `cron.job` et `cron.schedule(nom, cadence, commande)`, comme `pg_cron`. Le job
 *   n'est **pas** exécuté : le banc n'a pas de démon, et c'est la fonction d'envoi que la
 *   garde appelle à la main — c'est plus précis qu'attendre une minute.
 * - **`net`** : `net.http_post(url, body, headers, timeout)` rend un identifiant et **note la
 *   requête** dans `net._http_request` ; et `net._http_response`, où le **test** dépose la
 *   réponse, exactement comme le worker de `pg_net` le ferait plus tard.
 * - **`vault`** : `vault.secrets` et `vault.decrypted_secrets` — le secret du webhook est lu
 *   là, jamais dans une migration (D-120 (3)). `vault.create_secret(secret, nom)` est le
 *   geste que la procédure fait à la main dans le tableau de bord.
 */
export const SHIM_TUYAU_DISCORD = `
  create schema if not exists cron;
  create table if not exists cron.job (
    jobid    bigserial primary key,
    jobname  text,
    schedule text,
    command  text,
    active   boolean not null default true
  );
  create or replace function cron.schedule(p_nom text, p_cadence text, p_commande text)
    returns bigint language plpgsql as $cron$
  declare
    nouvel_id bigint;
  begin
    insert into cron.job (jobname, schedule, command) values (p_nom, p_cadence, p_commande)
    returning jobid into nouvel_id;
    return nouvel_id;
  end;
  $cron$;

  create schema if not exists net;
  create table if not exists net._http_request (
    id      bigserial primary key,
    url     text,
    corps   jsonb,
    cree_le timestamptz not null default now()
  );
  -- Ce que le vrai pg_net attend d'une réponse : un code, un corps, une erreur, un délai.
  create table if not exists net._http_response (
    id          bigint,
    status_code integer,
    content     text,
    error_msg   text,
    timed_out   boolean not null default false,
    created     timestamptz not null default now()
  );
  -- Les noms des paramètres sont ceux du vrai pg_net : la couture les passe en **notation
  -- nommée** (\`url := …\`), donc un shim aux noms différents ne compilerait pas la couture.
  create or replace function net.http_post(
    url                  text,
    body                 jsonb default '{}'::jsonb,
    params               jsonb default '{}'::jsonb,
    headers              jsonb default '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds integer default 5000
  )
    returns bigint language plpgsql as $net$
  declare
    v_url    text := url;
    v_corps  jsonb := body;
    v_id     bigint;
  begin
    insert into net._http_request (url, corps) values (v_url, v_corps)
    returning id into v_id;
    return v_id;
  end;
  $net$;

  create schema if not exists vault;
  create table if not exists vault.secrets (
    id          uuid primary key default gen_random_uuid(),
    name        text unique,
    description text,
    secret      text not null
  );
  -- \`decrypted_secret\` est le nom de colonne que la migration lit, et celui du vrai coffre.
  create or replace view vault.decrypted_secrets as
    select id, name, description, secret, secret as decrypted_secret from vault.secrets;
  create or replace function vault.create_secret(p_secret text, p_nom text, p_description text default null)
    returns uuid language sql as $vault$
  insert into vault.secrets (secret, name, description) values (p_secret, p_nom, p_description)
  returning id
  $vault$;
`;

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
${SHIM_TUYAU_DISCORD}`;

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
export async function creerCompte(db: Base, appareil: string, options: EtatCompteBanc = {}): Promise<void> {
  await db.query(
    `insert into auth.users (id, email) values ($1, $2)
     on conflict (id) do update set email = excluded.email`,
    [appareil, options.courriel ?? `${appareil.slice(0, 8)}@exemple.test`]
  );

  const existe = await db.query<{ id: string }>('select id from public.comptes where id = $1', [appareil]);
  if (existe.rows.length === 0) {
    throw new Error(`le déclencheur n’a pas créé de compte pour ${appareil}`);
  }

  await db.query(
    `update public.comptes
        set etat = $2,
            administrateur = $3,
            raison = case when $2 = 'refuse' then coalesce(nullif($4, ''), 'Refusé par le test.') else '' end
      where id = $1`,
    [appareil, options.etat ?? 'approuve', options.administrateur ?? false, '']
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
export async function avecAppareil<T>(db: Base, appareil: string, geste: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${appareil}';`);
  try {
    return await geste();
  } finally {
    await db.exec('reset role; reset request.jwt.claim.sub;');
  }
}
