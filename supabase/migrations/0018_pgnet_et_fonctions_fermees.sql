-- `pg_net` sort de `public`, et les fonctions de déclencheur se ferment — #341 (D-133, D-138).
--
-- Deux constats mesurés par la session d'infra le 27/10/2026, après l'application de `0013` :
--
--   1. **`pg_net` est installée dans `public`** (lint Supabase, WARN) : la `0013` faisait
--      `create extension if not exists pg_net` **sans schéma**, et le schéma par défaut de la
--      base est `public`. Une extension dans `public` expose ses objets au même endroit que
--      les nôtres, et le lint le refuse. D-133 (1) tranche : elle retourne dans `extensions`.
--   2. **Deux fonctions de déclencheur restaient exécutables par `authenticated`** —
--      `comptes_creation` et `comptes_decision`. D-133 (2) les ferme : un déclencheur **ne
--      vérifie pas l'`EXECUTE` de l'appelant**, donc ce droit ne servait à rien — il ne
--      laissait qu'une porte ouverte sur une fonction qu'on ne veut pas appeler par RPC.
--
-- **`pg_net` : supprimer puis réinstaller, parce que `SET SCHEMA` ne marche pas.** L'extension
-- n'est pas `relocatable` (mesuré par la session d'infra : `alter extension pg_net set schema
-- extensions` répond `extension "pg_net" does not support SET SCHEMA`). La seule voie est
-- `drop extension` puis `create extension … with schema extensions`, ce que D-133 (1) acte
-- dans une fenêtre **sans risque** : personne n'est encore dans le salon Discord, donc aucune
-- annonce ne peut se perdre. Ce que le `drop` emporte est la **file** (`net._http_request` et
-- `net._http_response`), pas nos objets : `public.poster_discord` et
-- `public.reconcilier_annonces_discord` nomment `net.http_post` et `net._http_response` en
-- **SQL dynamique de plpgsql** (et en SQL **qualifié**) — PostgreSQL n'enregistre aucune
-- dépendance pour un corps plpgsql, donc le `drop` ne les casse pas et le `create` les retrouve.
-- Le seul état perdu est une requête **en vol**, et il n'y en a pas dans la fenêtre. Si un
-- jour autre chose dépend de `pg_net`, le `drop` **échouera** au lieu de l'emporter en
-- silence : c'est voulu, on lira l'erreur avant de décider d'un `cascade`.
--
-- **Les sept fonctions `SECURITY DEFINER` de `public`, triées une par une** (D-133 (3)) :
--
-- | fonction | état | raison |
-- |---|---|---|
-- | `corriger_postit(text, text, text)` | **ouverte** à `authenticated` | **appelée par le client** (la correction du titre et du texte, #139) |
-- | `deplacer_postit(text, double precision, double precision, double precision)` | **ouverte** | **appelée par le client** (la place d'un post-it, #185) |
-- | `marquer_comite_vu()` | **ouverte** | **appelée par le client** (le repère de suivi, #209) |
-- | `compte_approuve()` | **ouverte** | **citée par les politiques RLS** de `postits`, `votes`, `commentaires` et `combats` ; une politique s'exécute **avec les droits de l'appelant**, donc `authenticated` doit garder `EXECUTE` |
-- | `est_administrateur()` | **ouverte** | **citée par les politiques RLS** (tri, retrait d'administration) — même raison |
-- | `comptes_creation()` | **fermée** | **déclencheur** sur `auth.users` : jamais appelée par RPC, et un déclencheur ne vérifie pas l'`EXECUTE` |
-- | `comptes_decision()` | **fermée** | **déclencheur** sur `public.comptes` — même raison |
--
-- S'y ajoutent six fonctions de déclencheur **sans `security definer`** (`postits_lie_hors_gueulage`,
-- `postits_updated_at`, `commentaires_date_serveur`, `postits_date_serveur`,
-- `commentaires_figer_date`, `postits_figer_date`) : la `0011` ne les avait pas vues (elle ne
-- visait que les `security definer`), et PostgreSQL accorde `EXECUTE` **à `PUBLIC`** par défaut
-- sur toute fonction neuve — donc `anon` les exécutait aussi. Elles ne sont pas appelables
-- (elles rendent `trigger`), mais un droit ouvert sur une porte qu'on ne veut pas ouvrir reste
-- un droit ouvert : la migration les ferme avec les autres. Un déclencheur ne vérifie pas
-- l'`EXECUTE`, donc les fermer ne casse rien.
--
-- **Résultat tenu par la garde** (`supabase/fonctions.test.ts`, PGlite, privilèges par défaut
-- de Supabase reproduits) : `anon` n'exécute **aucune** fonction de `public`, et `authenticated`
-- exécute **exactement** les cinq ci-dessus. La garde confronte ce contrôle à une fonction
-- fabriquée laissée ouverte de plus, et la dénonce.
--
-- **Idempotente** : `create schema if not exists`, la réinstallation ne se fait que si
-- l'extension n'est pas déjà dans `extensions`, et `revoke` est rejouable. La migration
-- rejouée sur une base à jour ne lève rien.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. `pg_net` dans `extensions` (D-133 (1))
-- ---------------------------------------------------------------------------------------------

create schema if not exists extensions;

-- Le banc d'essai (PGlite, D-120 (5)) n'a pas `pg_net` : mesuré le 27/10/2026, elle répond
-- `extension "pg_net" is not available`, comme la `0013` l'a déjà constaté. La migration ne
-- peut donc pas la déplacer partout — elle le fait quand la base la propose, et se tait sinon.
do $$
declare
  -- Le schéma où `pg_net` vit aujourd'hui ; `null` quand elle n'est pas installée.
  v_schema text;
begin
  if not exists (
    select 1 from pg_catalog.pg_available_extensions where name = 'pg_net'
  ) then
    raise notice '0018 : pg_net n''est pas proposée par cette base, rien à déplacer';
    return;
  end if;

  select n.nspname
    into v_schema
    from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_net';

  if v_schema is null then
    -- Absente : on l'installe directement au bon endroit (premier passage sur une base neuve
    -- où la 0013 ne l'a pas eue, ou projet refait).
    execute 'create extension pg_net with schema extensions';
  elsif v_schema <> 'extensions' then
    -- Installée ailleurs (`public`, l'état constaté) : on la supprime puis on la réinstalle.
    -- Le `drop` est volontairement **sans `cascade`** (voir l'en-tête).
    execute 'drop extension pg_net';
    execute 'create extension pg_net with schema extensions';
  end if;
  -- Déjà dans `extensions` : rien à faire, la migration se rejoue sans bruit.
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Les cinq fonctions que le client ou la RLS appellent : réaffirmées ouvertes
-- ---------------------------------------------------------------------------------------------

-- Elles ont déjà leur `grant` depuis les 0005 à 0008 ; on le **réaffirme** ici pour que la
-- migration dise l'état complet en un seul endroit, et pour qu'un futur `revoke` mal placé se
-- voie. Ce n'est **aucun droit nouveau** : `grant execute` à `authenticated` sur ces cinq-là
-- est exactement ce que le client avait avant #341.

grant execute on function public.corriger_postit(text, text, text) to authenticated;
grant execute on function public.deplacer_postit(text, double precision, double precision, double precision) to authenticated;
grant execute on function public.marquer_comite_vu() to authenticated;
grant execute on function public.compte_approuve() to authenticated;
grant execute on function public.est_administrateur() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Les deux déclencheurs de `comptes`, fermés à tout le monde (D-133 (2))
-- ---------------------------------------------------------------------------------------------

-- `authenticated` perd le droit que la 0011 lui avait laissé. Un déclencheur ne le demande
-- pas : le geste qui écrit `comptes` (une inscription dans `auth.users`, un tri par
-- l'administration) continue de marcher, et un appel RPC direct est refusé par le droit.
revoke execute on function public.comptes_creation() from public, anon, authenticated;
revoke execute on function public.comptes_decision() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Les six déclencheurs sans `security definer` que la 0011 avait laissés ouverts
-- ---------------------------------------------------------------------------------------------

-- Tombés sous le `EXECUTE` par défaut de PostgreSQL vers `PUBLIC`, donc exécutables par `anon`
-- comme par `authenticated`. Ils ne rendent pas de valeur appelable (ils rendent `trigger`),
-- et un déclencheur ne vérifie pas l'`EXECUTE` : les fermer ne change aucun comportement.
revoke execute on function public.postits_lie_hors_gueulage() from public, anon, authenticated;
revoke execute on function public.postits_updated_at() from public, anon, authenticated;
revoke execute on function public.commentaires_date_serveur() from public, anon, authenticated;
revoke execute on function public.postits_date_serveur() from public, anon, authenticated;
revoke execute on function public.commentaires_figer_date() from public, anon, authenticated;
revoke execute on function public.postits_figer_date() from public, anon, authenticated;

commit;
