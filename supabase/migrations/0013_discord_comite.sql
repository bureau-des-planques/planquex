-- Le mur s'annonce dans #comite — #318, D-118 (2), (3) et (5).
--
-- Le mur est **mort** quand ses statuts ne bougent pas en silence : celui qui a collé un
-- post-it n'apprend son tri que s'il revient voir. Cette migration fait donc **parler** le
-- mur dans le salon `#comite` du serveur des testeurs (D-118), sans rien héberger : la
-- cadence vient de `pg_cron`, l'envoi de `pg_net`, le secret de **Vault**.
--
-- **Ce qui sort, et ce qui ne sort jamais** (D-118 (2)) :
--   - l'arrivée d'un post-it : sa famille (IP/OUF), son titre, le pseudo de son auteur, et le
--     lien vers `/comite` ;
--   - chaque **changement de statut** (retenu, en cours, fait, écarté avec sa raison) ;
--   - **jamais** le texte d'un gueulage (D-085 : on annonce qu'il est arrivé, pas ce qu'il
--     dit), et **jamais** une donnée de compte : ni `auteur`, ni courriel, ni identifiant.
--     Le pseudo, déjà public sur le mur, est la seule identité admise.
--
-- **« Remis » n'est pas « livré »** (D-118 (3)). `pg_net` ne fait que **déposer** une requête :
-- sa réponse arrive plus tard, dans `net._http_response`. Une ligne d'annonce a donc un
-- **état** :
--
--   en attente → remis → livre
--                    ↘ en attente (nouvel essai) ↘ abandonne
--
-- Un non-2xx **garde la ligne** et incrémente les tentatives ; la **cinquième** l'abandonne ;
-- un envoi **sans réponse au bout d'un quart d'heure** compte comme un échec (un webhook muet
-- n'est pas un webhook qui a marché). **Dix par passe**, dans l'ordre des ids : vingt-cinq
-- annonces en attente se vident en trois passes, et le salon ne reçoit pas une rafale.
--
-- **Une seule couture** : `public.poster_discord(url, corps)` est le **seul** endroit du
-- dépôt qui appelle `net.http_post`. La garde la remplace par un faux et compte les appels —
-- aucun test ne parle à Discord (D-118 (5)).
--
-- **Le passé ne déferle pas** : à l'installation, chaque post-it déjà présent reçoit une
-- ligne `sans_webhook` — il n'a rien à annoncer, et le premier jour ne déverse pas
-- l'historique du mur dans le salon.
--
-- **Aucun privilège client** : `anon` et `authenticated` n'ont ni lecture ni écriture sur la
-- table, et n'exécutent aucune des fonctions d'envoi. La RLS est active **et forcée** : même
-- un `grant` oublié ne rouvrirait pas la porte.
--
-- **Le contrôle mord** : `supabase/discord.test.ts` (PGlite) rejoue **toutes** les
-- migrations réelles, puis les rejoue **mutées** — déclencheur neutralisé, condition à
-- `true`, plafond retiré — et exige d'y constater le doublon, la fuite ou la rafale.
--
-- **Idempotente** : rejouable sans erreur (`if not exists`, `create or replace`,
-- `drop trigger if exists`, `revoke`).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Les deux extensions du tuyau, si la base les propose
-- ---------------------------------------------------------------------------------------------

-- Le banc d'essai (PGlite, D-118 (5)) n'a **ni** `pg_cron` **ni** `pg_net` : mesuré le
-- 27/10/2026, les deux répondent `extension "…" is not available`. La migration ne peut donc
-- pas les exiger — elle les installe quand `pg_available_extensions` les annonce, et se tait
-- sinon. Sur le projet réel, les deux sont **installables** par le rôle `postgres` (mesuré le
-- 27/10/2026 dans une transaction annulée), et `supabase_vault` y est déjà installé.
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
  end if;
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. La table de départ : ce qu'on a à dire, et où l'envoi en est
-- ---------------------------------------------------------------------------------------------

create table if not exists public.annonces_discord (
  id           bigint      generated always as identity primary key,

  -- Le post-it concerné : un texte, sans clé étrangère. Une annonce est un **journal** — elle
  -- survit au retrait du post-it qu'elle a annoncé, sinon l'historique du salon mentirait.
  postit_id    text        not null,

  -- D'où vient l'annonce : l'arrivée du post-it, ou un de ses mouvements de statut.
  type         text        not null check (type in ('postit', 'statut')),

  -- L'état de l'envoi (D-118 (3)) : « remis » n'est pas « livré ».
  etat         text        not null default 'en attente'
                           check (etat in ('en attente', 'remis', 'livre', 'abandonne', 'sans_webhook')),

  -- Le nombre d'envois déjà faits. Il monte **au départ** de la requête, pas au retour :
  -- c'est ce qui fait que la cinquième tentative est la dernière.
  tentatives   integer     not null default 0 check (tentatives between 0 and 5),

  -- L'identifiant rendu par `pg_net`, celui qui relie la requête à sa réponse.
  requete_id   bigint,

  -- Le corps envoyé, composé **par la base** (les déclencheurs plus bas). Nul pour le passé
  -- marqué `sans_webhook`, qui n'a jamais eu de phrase.
  corps        jsonb,

  cree_le      timestamptz not null default now(),
  remis_le     timestamptz,
  livre_le     timestamptz,
  -- Ce que la réconciliation a vu passer : `HTTP 500`, `sans réponse au bout d'un quart
  -- d'heure`. Une ligne qui garde son erreur s'explique sans relire les journaux.
  derniere_erreur text,

  constraint annonces_discord_corps_si_envoi
    check (etat = 'sans_webhook' or corps is not null)
);

comment on table public.annonces_discord is
  'Ce que le mur dit dans #comite (D-118), et où en est chaque envoi. Aucun accès client.';
comment on column public.annonces_discord.etat is
  'en attente → remis → livre ; une réponse non-2xx ramène en attente, la 5ᵉ tentative abandonne (D-118).';
comment on column public.annonces_discord.corps is
  'Le message Discord, composé par la base : contenu et aucune mention interprétable.';

-- La file d'envoi : `etat` puis `id`, c'est l'ordre des dix par passe.
create index if not exists annonces_discord_a_envoyer
  on public.annonces_discord (etat, id);

-- Les lignes déjà remises, à réconcilier : peu nombreuses, mais relues à chaque passe.
create index if not exists annonces_discord_remises
  on public.annonces_discord (remis_le)
  where etat = 'remis';

-- ---------------------------------------------------------------------------------------------
-- 3. Aucun privilège client, RLS active et forcée
-- ---------------------------------------------------------------------------------------------

-- Les privilèges par défaut de Supabase ouvrent toute table neuve à `anon` et à
-- `authenticated` (le banc les reproduit pour que ce `revoke` soit éprouvé) : sans lui, un
-- testeur lirait la file et pourrait écrire une annonce à la main.
revoke all on table public.annonces_discord from public, anon, authenticated;

-- `force` : le propriétaire lui-même n'échappe pas aux politiques. Il n'y en a **aucune**, donc
-- la table est fermée à tout ce qui n'a pas `bypassrls` — c'est-à-dire tout le monde sauf le
-- rôle des migrations, celui des déclencheurs et celui de `pg_cron`.
alter table public.annonces_discord enable row level security;
alter table public.annonces_discord force row level security;

-- ---------------------------------------------------------------------------------------------
-- 4. La phrase, composée par la base — le vocabulaire du mur ne dérive pas en silence
-- ---------------------------------------------------------------------------------------------

/**
 * L'adresse du comité dans le jeu. Ce n'est **pas** un secret (D-118 (1) : l'invitation est
 * publique) : le webhook, lui, ne vit que dans Vault (D-118 (3)).
 */
create or replace function public.lien_comite()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'https://planquex.4k7.org/comite'::text
$$;

comment on function public.lien_comite() is
  'L''adresse publique du comité, jointe à chaque annonce (D-118).';

/**
 * Coupe un texte à `p_max` caractères, points de suspension compris. Deux limites se
 * rencontrent ici : celle du **salon** (2 000 caractères, `docs/INTEGRATIONS-DISCORD.md` §9)
 * et celle du **bon sens** — une raison d'écarté de trois pages n'est pas une annonce.
 */
create or replace function public.tronquer_annonce(p_texte text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when char_length(coalesce(p_texte, '')) <= p_max then coalesce(p_texte, '')
           else left(coalesce(p_texte, ''), p_max - 1) || '…'
         end
$$;

comment on function public.tronquer_annonce(text, integer) is
  'Tronque un champ d''annonce, points de suspension compris (limite du salon, D-118).';

/**
 * L'arrivée d'un post-it.
 *
 * Un **gueulage** (D-085, `kind` nul) s'annonce **sans titre ni texte** : on dit qu'il est
 * arrivé, jamais ce qu'il dit. Un post-it ordinaire porte sa famille, son titre et le pseudo
 * de son auteur — le pseudo est déjà public sur le mur, c'est la seule identité admise.
 */
create or replace function public.phrase_postit_neuf(
  p_kind text,
  p_gueulage boolean,
  p_titre text,
  p_pseudo text
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
         end
$$;

comment on function public.phrase_postit_neuf(text, boolean, text, text) is
  'La phrase d''arrivée d''un post-it ; un gueulage n''y porte ni titre ni texte (D-085, D-118).';

/**
 * Un mouvement de statut. `écarté` porte sa **raison**, tronquée : c'est la seule explication
 * qu'un auteur reçoive sans revenir sur le mur.
 */
create or replace function public.phrase_changement_statut(
  p_titre text,
  p_pseudo text,
  p_statut text,
  p_raison text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select format(
           'Post-it « %s » (%s) : %s%s · %s',
           public.tronquer_annonce(coalesce(p_titre, ''), 120),
           public.tronquer_annonce(coalesce(nullif(btrim(coalesce(p_pseudo, '')), ''), 'anonyme'), 40),
           p_statut,
           case
             when p_statut = 'écarté'
               then ' — ' || public.tronquer_annonce(coalesce(p_raison, ''), 300)
             else ''
           end,
           public.lien_comite()
         )
$$;

comment on function public.phrase_changement_statut(text, text, text, text) is
  'La phrase d''un mouvement de statut, avec la raison tronquée d''un écarté (D-118).';

-- ---------------------------------------------------------------------------------------------
-- 5. Les déclencheurs : ce qui annonce, et rien d'autre
-- ---------------------------------------------------------------------------------------------

/**
 * Un `after insert` sur `postits` : **une** annonce par post-it, et une seule.
 *
 * `security definer` : le déclencheur tourne sous la main de son propriétaire, parce que la
 * table d'annonces est fermée au client qui vient de coller le post-it.
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
      'content', public.phrase_postit_neuf(new.kind, new.gueulage, new.titre, new.pseudo),
      -- Aucune mention interprétable : un titre qui contient « @everyone » reste du texte.
      'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb)
    )
  );
  return null;
end;
$$;

comment on function public.annoncer_postit_neuf() is
  'Met en file l''annonce d''un post-it neuf (D-118).';

drop trigger if exists postits_annonce_neuve on public.postits;
create trigger postits_annonce_neuve
  after insert on public.postits
  for each row execute function public.annoncer_postit_neuf();

/**
 * Un `after update of statut` : **un** mouvement, une annonce.
 *
 * Trois conditions, et chacune a son défaut si elle tombe (la garde les neutralise une à une) :
 *
 *   1. le statut doit **vraiment** changer — un `update` qui nomme la colonne sans la changer
 *      (le tri qui réécrit le même statut) n'annonce rien, sinon le salon répète ;
 *   2. le statut d'arrivée doit être l'un des **quatre** que D-118 nomme. Un retour à
 *      `en attente` (le tri qui se ravise) ne s'annonce pas : c'est un brouillon, pas un
 *      mouvement ;
 *   3. le reste ne déclenche pas du tout — `after update of statut` écarte la correction de
 *      texte (`corriger_postit`, 0006), le déplacement (`deplacer_postit`, 0007), et les
 *      votes et commentaires, qui vivent dans d'autres tables.
 */
create or replace function public.annoncer_statut()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut is not distinct from old.statut then
    return null;
  end if;

  if new.statut not in ('retenu', 'en cours', 'fait', 'écarté') then
    return null;
  end if;

  insert into public.annonces_discord (postit_id, type, corps)
  values (
    new.id,
    'statut',
    jsonb_build_object(
      'content', public.phrase_changement_statut(new.titre, new.pseudo, new.statut, new.raison),
      'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb)
    )
  );
  return null;
end;
$$;

comment on function public.annoncer_statut() is
  'Met en file l''annonce d''un vrai changement de statut (D-118) : une par mouvement, pas deux.';

drop trigger if exists postits_annonce_statut on public.postits;
create trigger postits_annonce_statut
  after update of statut on public.postits
  for each row execute function public.annoncer_statut();

-- ---------------------------------------------------------------------------------------------
-- 6. Le transport : une seule couture, et le secret lu à l'envoi
-- ---------------------------------------------------------------------------------------------

/**
 * L'URL du webhook, lue dans **Vault** au moment de l'envoi (D-118 (3)) : jamais dans le
 * dépôt, jamais dans une migration, jamais dans le client. Sans secret, `null` — et rien ne
 * part, rien n'est marqué livré.
 */
create or replace function public.discord_webhook()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
    from vault.decrypted_secrets s
   where s.name = 'discord_webhook_comite'
     and coalesce(btrim(s.decrypted_secret), '') <> ''
   limit 1
$$;

comment on function public.discord_webhook() is
  'Le webhook de #comite, lu dans Vault à l''envoi (D-118) : null sans secret.';

/**
 * **La** couture (D-118 (5)) : le seul endroit du dépôt qui parle à `pg_net`. La garde la
 * remplace par un faux et compte les appels, donc aucun test ne parle à Discord.
 */
create or replace function public.poster_discord(p_url text, p_corps jsonb)
returns bigint
language sql
set search_path = ''
as $$
  select net.http_post(
    url := p_url,
    body := p_corps,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  )
$$;

comment on function public.poster_discord(text, jsonb) is
  'La couture de l''envoi Discord (D-118) : le seul appel à net.http_post du dépôt.';

-- ---------------------------------------------------------------------------------------------
-- 7. La réconciliation : « remis » n'est pas « livré »
-- ---------------------------------------------------------------------------------------------

/**
 * Relit les réponses de `pg_net` pour les lignes `remis`.
 *
 *   - **2xx** : la ligne passe à `livre`, et garde l'heure de la livraison ;
 *   - **non-2xx** : la ligne **reste** (elle n'est ni perdue ni livrée) et redevient
 *     `en attente` — sauf si c'était la cinquième tentative, qui l'abandonne ;
 *   - **aucune réponse au bout d'un quart d'heure** : un webhook muet est un échec, même
 *     traitement. En deçà, on attend : `pg_net` dépose, Discord répond, et la réponse peut
 *     prendre quelques secondes.
 */
create or replace function public.reconcilier_annonces_discord()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ligne record;
  vues  integer := 0;
begin
  for ligne in
    select a.id,
           a.tentatives,
           a.remis_le,
           r.status_code,
           r.error_msg,
           r.timed_out
      from public.annonces_discord a
      left join lateral (
        select rep.status_code, rep.error_msg, rep.timed_out
          from net._http_response rep
         where rep.id = a.requete_id
         order by rep.created desc
         limit 1
      ) r on true
     where a.etat = 'remis'
     order by a.id
  loop
    vues := vues + 1;

    if ligne.status_code is not null then
      if ligne.status_code between 200 and 299 then
        update public.annonces_discord
           set etat = 'livre',
               livre_le = now(),
               derniere_erreur = null
         where id = ligne.id;
      else
        update public.annonces_discord
           set etat = case when tentatives >= 5 then 'abandonne' else 'en attente' end,
               derniere_erreur = format(
                 'HTTP %s%s',
                 ligne.status_code,
                 case when coalesce(ligne.error_msg, '') = '' then '' else ' — ' || ligne.error_msg end
               )
         where id = ligne.id;
      end if;
    elsif ligne.remis_le < now() - interval '15 minutes' then
      update public.annonces_discord
         set etat = case when tentatives >= 5 then 'abandonne' else 'en attente' end,
             derniere_erreur = 'sans réponse au bout d’un quart d’heure'
       where id = ligne.id;
    end if;
  end loop;

  return vues;
end;
$$;

comment on function public.reconcilier_annonces_discord() is
  'Réconcilie les réponses de pg_net : 2xx livre, non-2xx et silence d''un quart d''heure échouent (D-118).';

-- ---------------------------------------------------------------------------------------------
-- 8. L'envoi : dix par passe, dans l'ordre
-- ---------------------------------------------------------------------------------------------

/**
 * La passe, appelée par `pg_cron` toutes les minutes.
 *
 * 1. **Réconcilier d'abord** : une ligne dont la réponse est arrivée libère sa place.
 * 2. **Sans secret, s'arrêter là** : rien n'est remis, rien n'est marqué livré, rien n'est
 *    perdu — la file attend le webhook.
 * 3. **Dix au plus**, par ordre d'id : vingt-cinq annonces en attente se vident en trois
 *    passes, et le salon ne reçoit jamais une rafale (la cadence d'un webhook Discord tourne
 *    autour de trente messages par minute, `docs/INTEGRATIONS-DISCORD.md` §9).
 */
create or replace function public.envoyer_annonces_discord()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  url     text;
  ligne   record;
  requete bigint;
  partis  integer := 0;
begin
  perform public.reconcilier_annonces_discord();

  url := public.discord_webhook();
  if url is null then
    return 0;
  end if;

  for ligne in
    select a.id, a.corps
      from public.annonces_discord a
     where a.etat = 'en attente'
       and a.tentatives < 5
     order by a.id
     limit 10
  loop
    -- La tentative est **comptée au départ** : une requête déposée est une tentative, même
    -- si sa réponse n'arrive jamais (voir la réconciliation).
    requete := public.poster_discord(url, ligne.corps);

    update public.annonces_discord
       set etat = 'remis',
           requete_id = requete,
           remis_le = now(),
           tentatives = tentatives + 1
     where id = ligne.id;

    partis := partis + 1;
  end loop;

  return partis;
end;
$$;

comment on function public.envoyer_annonces_discord() is
  'La passe d''envoi du mur : réconcilie, puis remet dix annonces au plus, dans l''ordre (D-118).';

-- Les fonctions du tuyau ne sont **pas** des points d'entrée clients : ni `anon`, ni
-- `authenticated`, ni `public`. `pg_cron` les appelle sous la main de leur propriétaire.
revoke execute on function public.lien_comite() from public, anon, authenticated;
revoke execute on function public.tronquer_annonce(text, integer) from public, anon, authenticated;
revoke execute on function public.phrase_postit_neuf(text, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.phrase_changement_statut(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.annoncer_postit_neuf() from public, anon, authenticated;
revoke execute on function public.annoncer_statut() from public, anon, authenticated;
revoke execute on function public.discord_webhook() from public, anon, authenticated;
revoke execute on function public.poster_discord(text, jsonb) from public, anon, authenticated;
revoke execute on function public.reconcilier_annonces_discord() from public, anon, authenticated;
revoke execute on function public.envoyer_annonces_discord() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 9. La cadence
-- ---------------------------------------------------------------------------------------------

-- `cron.schedule` n'existe que si `pg_cron` est installé ; le banc fournit la même fonction
-- dans le shim, donc cette branche est **éprouvée** (la garde lit `cron.job`).
do $$
begin
  -- Deux `if` imbriqués, et non un `and` : la seconde requête nomme `cron.job`, qui n'existe
  -- pas quand `pg_cron` manque — un `and` la ferait planifier de toute façon.
  if exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'cron' and p.proname = 'schedule'
  ) then
    if not exists (select 1 from cron.job where jobname = 'annonces_discord') then
      perform cron.schedule(
        'annonces_discord',
        '* * * * *',
        'select public.envoyer_annonces_discord()'
      );
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 10. Le passé ne déferle pas : l'historique du mur est marqué `sans_webhook`
-- ---------------------------------------------------------------------------------------------

-- Le jour de l'installation, le mur porte déjà des post-its. Les annoncer tous noierait le
-- salon sous l'historique (et l'ordre n'aurait aucun sens). Ils reçoivent donc une ligne
-- `sans_webhook` : la trace existe, l'envoi n'aura pas lieu, et la file ne les reprendra
-- jamais (elle ne prend que `en attente`).
insert into public.annonces_discord (postit_id, type, etat, corps, cree_le)
select p.id, 'postit', 'sans_webhook', null, p.created_at
  from public.postits p
 where not exists (
   select 1 from public.annonces_discord a
    where a.postit_id = p.id and a.type = 'postit'
 );

commit;
