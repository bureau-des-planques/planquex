-- L'annonce d'un post-it neuf porte le résumé, et ses points — #339, D-138 (numéro), D-120 (2).
--
-- Une annonce qui ne dit que la famille et le titre ne dit pas de quoi il s'agit : celui qui
-- lit `#comite` doit pouvoir reconnaître son sujet sans ouvrir le mur. La base ne sait pas
-- résumer finement (pas de modèle de langage en Postgres), donc la règle est **mécanique** :
--
--   - le **premier paragraphe** du texte, coupé à **200 caractères** ;
--   - les **lignes à puces** (`-`, `*`, `•`, `→`, ou numérotées `1.` / `1)`), **quatre au plus**,
--     coupées à **100 caractères** chacune ;
--   - **aucune puce** : le résumé seul ;
--   - un **gueulage reste muet** (D-085) : ni titre, ni texte, ni résumé.
--
-- 0013 est **appliquée** et son empreinte est enregistrée (D-091) : elle ne se retouche pas.
-- Cette migration-ci **remplace** `public.phrase_postit_neuf` — nouvelle signature, `p_texte`
-- en cinquième — et le déclencheur `public.annoncer_postit_neuf`, qui lui passe désormais
-- `new.texte`. Rien d'autre ne bouge : l'auteur sentinelle, le lien, `allowed_mentions`,
-- `marquer_comite_vu`, la table, la file, l'envoi, la cadence et le passé `sans_webhook`
-- restent ceux de 0013.
--
-- **Longueur** : une annonce ordinaire tient très au-dessous des **2 000 caractères** du salon
-- (`docs/INTEGRATIONS-DISCORD.md` §9) — en-tête ~60, résumé 200, quatre puces de 100. Le repli
-- d'un texte vide n'ajoute **aucune** ligne : l'en-tête et le lien suffisent.
--
-- **Aucune fonction `security definer` nouvelle** : `resume_postit`, `points_postit` et
-- `phrase_postit_neuf` sont `immutable` et sans privilège client. Le déclencheur remplacé
-- garde son `security definer` de 0013 (il écrit dans une table fermée au client).
--
-- **Idempotente** : `create or replace`, `drop function if exists`, et rien d'autre à créer.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Le résumé : le premier paragraphe, coupé à 200
-- ---------------------------------------------------------------------------------------------

/**
 * Le **premier paragraphe** d'un texte : ses lignes jusqu'à la première ligne vide, réunies
 * par une espace, puis coupées à `p_max` par `public.tronquer_annonce` (points de suspension
 * compris). Un texte vide, ou qui ne porte qu'une ligne vide, rend `''` : l'appelant n'ajoute
 * alors **aucune** ligne, plutôt qu'une ligne vide dans le salon.
 */
create or replace function public.resume_postit(p_texte text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  with lignes as (
    select btrim(t.ligne) as ligne, t.rang
      from regexp_split_to_table(coalesce(p_texte, ''), E'\r?\n') with ordinality as t(ligne, rang)
  ),
  fin as (
    -- La première ligne vide ferme le paragraphe. `rang > 1` : une ligne vide en tête n'est
    -- pas une fin de paragraphe, c'est du blanc de mise en forme.
    select min(rang) as rang from lignes where ligne = '' and rang > 1
  )
  select public.tronquer_annonce(
           btrim(coalesce(string_agg(lignes.ligne, ' ' order by lignes.rang) filter (where lignes.ligne <> ''), '')),
           p_max
         )
    from lignes
   where lignes.rang < coalesce((select rang from fin), 2147483647)
$$;

comment on function public.resume_postit(text, integer) is
  'Le premier paragraphe d''un post-it, coupé à p_max — le résumé d''annonce (#339, D-120).';

-- ---------------------------------------------------------------------------------------------
-- 2. Les points : les lignes à puces, quatre au plus, coupées à 100
-- ---------------------------------------------------------------------------------------------

/**
 * Les **lignes à puces** du texte, dans l'ordre : `-`, `*`, `•`, `→`, ou numérotées `1.` /
 * `1)`. Le marqueur est retiré, **quatre** puces au plus sont gardées, chacune coupée à
 * `p_max`. Rend `''` quand il n'y a aucune puce.
 *
 * Une ligne dont la puce est vide après le marqueur (`-` seul) ne compte pas : elle
 * n'apprendrait rien.
 */
create or replace function public.points_postit(p_texte text, p_max integer, p_max_points integer)
returns text
language sql
immutable
set search_path = ''
as $$
  with lignes as (
    select btrim(t.ligne) as ligne, t.rang
      from regexp_split_to_table(coalesce(p_texte, ''), E'\r?\n') with ordinality as t(ligne, rang)
  ),
  puces as (
    select (regexp_match(ligne, '^(?:[-*•→]|[0-9]{1,3}[.)])[[:space:]]*(.*)$'))[1] as puce, rang
      from lignes
  ),
  gardees as (
    select puce, rang
      from puces
     where puce is not null
       and btrim(puce) <> ''
     order by rang
     limit p_max_points
  )
  select coalesce(string_agg('• ' || public.tronquer_annonce(btrim(puce), p_max), E'\n' order by rang), '')
    from gardees
$$;

comment on function public.points_postit(text, integer, integer) is
  'Les lignes à puces d''un post-it, p_max_points au plus, coupées à p_max (#339, D-120).';

-- ---------------------------------------------------------------------------------------------
-- 3. La phrase : l'en-tête de 0013, puis le résumé, puis les points
-- ---------------------------------------------------------------------------------------------

/**
 * L'arrivée d'un post-it — la phrase de 0013, augmentée.
 *
 * Un **gueulage** (D-085, `kind` nul) s'annonce **sans titre, sans texte et sans résumé** : on
 * dit qu'il est arrivé, jamais ce qu'il dit. Un post-it ordinaire porte sa famille, son titre,
 * le pseudo de son auteur, son **résumé**, ses **points**, puis le lien.
 *
 * La signature gagne `p_texte`. L'ancienne (quatre arguments) est retirée plus bas : deux
 * surcharges laisseraient deux comportements pour un même nom.
 */
create or replace function public.phrase_postit_neuf(
  p_kind text,
  p_gueulage boolean,
  p_titre text,
  p_pseudo text,
  p_texte text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when coalesce(p_gueulage, false) then
             format(
               'Un gueulage vient d’arriver sur le mur (%s) · %s',
               public.tronquer_annonce(coalesce(nullif(btrim(coalesce(p_pseudo, '')), ''), 'anonyme'), 40),
               public.lien_comite()
             )
           else
             format(
               'Nouveau post-it %s — « %s » (%s) · %s',
               coalesce(p_kind, 'IP'),
               public.tronquer_annonce(coalesce(p_titre, ''), 120),
               public.tronquer_annonce(coalesce(nullif(btrim(coalesce(p_pseudo, '')), ''), 'anonyme'), 40),
               public.lien_comite()
             )
             -- Le repli d'un texte vide : ni ligne de résumé, ni ligne de puces.
             || case
                  when public.resume_postit(p_texte, 200) = '' then ''
                  else E'\n' || public.resume_postit(p_texte, 200)
                end
             || case
                  when public.points_postit(p_texte, 100, 4) = '' then ''
                  else E'\n' || public.points_postit(p_texte, 100, 4)
                end
         end
$$;

comment on function public.phrase_postit_neuf(text, boolean, text, text, text) is
  'La phrase d''arrivée d''un post-it : famille, titre, pseudo, résumé, points, lien — un gueulage reste muet (D-085, #339).';

-- L'ancienne signature ne sert plus : le déclencheur ci-dessous passe le texte. La retirer
-- évite qu'un appel à quatre arguments compose une phrase **sans** résumé, sans que rien ne
-- le signale.
drop function if exists public.phrase_postit_neuf(text, boolean, text, text);

-- ---------------------------------------------------------------------------------------------
-- 4. Le déclencheur : le même, avec le texte en plus
-- ---------------------------------------------------------------------------------------------

/**
 * L'`after insert` de 0013, à l'identique — `new.texte` en plus. Le déclencheur lui-même
 * (`postits_annonce_neuve`) n'est pas retouché : c'est **cette** fonction qu'il appelle.
 */
create or replace function public.annoncer_postit_neuf()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.annonces_discord (postit_id, type, corps)
  values (
    new.id,
    'postit',
    jsonb_build_object(
      'content', public.phrase_postit_neuf(new.kind, new.gueulage, new.titre, new.pseudo, new.texte),
      -- Aucune mention interprétable : un titre qui contient « @everyone » reste du texte.
      'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb)
    )
  );
  return null;
end;
$$;

comment on function public.annoncer_postit_neuf() is
  'Met en file l''annonce d''un post-it neuf, résumé et points compris (#339, D-120).';

-- ---------------------------------------------------------------------------------------------
-- 5. Aucun privilège client sur les nouvelles fonctions
-- ---------------------------------------------------------------------------------------------

-- Les valeurs par défaut de Supabase ouvrent toute fonction neuve de `public` à `anon` et à
-- `authenticated` : les trois fonctions ci-dessus n'ont aucune raison d'être joignables
-- depuis le client, et la table qu'elles alimentent ne l'est pas non plus.
revoke execute on function public.resume_postit(text, integer) from public, anon, authenticated;
revoke execute on function public.points_postit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.phrase_postit_neuf(text, boolean, text, text, text)
  from public, anon, authenticated;

commit;
