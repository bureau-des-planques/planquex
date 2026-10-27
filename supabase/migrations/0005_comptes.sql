-- Les comptes, et la validation manuelle de l'alpha — D-088.
--
-- Le site est public : sans cette migration, n'importe quel appareil identifié (même
-- anonymement) peut écrire un post-it, un pouce ou une trace de combat. D-088 remplace
-- D-087 (les codes d'invitation, refusés) : l'alpha s'ouvre par une **authentification**
-- (Google ou courriel), puis une **validation manuelle** par Bastien.
--
-- Ce que cette migration pose, et rien de plus :
--
--   1. `public.comptes` : une ligne par compte (`auth.uid()`), son courriel recopié, son
--      état (`en attente` | `approuve` | `refuse`), la raison d'un refus, les dates de la
--      décision, et le drapeau `administrateur` (faux par défaut). **Seul le SQL Editor**
--      écrit `administrateur` : les droits accordés au rôle `authenticated` ne portent que
--      sur `etat` et `raison`, colonne par colonne.
--   2. La ligne de compte est créée **automatiquement à la première connexion** par un
--      déclencheur sur `auth.users`. Pourquoi un déclencheur et pas une fonction appelée
--      par le client : le compte doit exister **même si le client est vieux, bricolé ou
--      hors ligne**, sinon un testeur s'inscrit et n'apparaît dans aucune liste — Bastien ne
--      peut pas l'approuver. Le déclencheur est la seule porte qui ne dépend pas du client.
--      Les comptes **déjà** présents dans `auth.users` avec un courriel sont recopiés au
--      bas de ce fichier (un compte créé avant la migration ne resterait sinon invisible).
--   3. Les politiques d'**écriture** de `postits`, `votes`, `commentaires` et `combats`
--      sont **remplacées** : elles exigent en plus `public.compte_approuve()`. La lecture
--      ne change pas — lire et jouer restent ouverts à un compte **en attente**, comme le
--      demande D-088.
--
-- **Les deux post-its déjà en base (23/10/2026).** Leurs auteurs sont des identités
-- **anonymes** : elles n'ont pas de courriel, donc pas de ligne de compte, et ne seront
-- jamais approuvées. Choix, écrit ici pour ne pas le supposer : on **ne les supprime pas et
-- on ne les rattache pas** à un compte (ce serait inventer un auteur). La politique de
-- lecture ne bouge pas, donc ils restent lisibles, avec leurs pouces ; leur politique
-- d'écriture exige désormais un compte approuvé, donc ils sont **figés** — leur auteur
-- anonyme ne peut plus les modifier. Si Bastien veut les rendre modifiables, c'est un
-- `update public.postits set auteur = '<son uid>' where id in (…)` dans le SQL Editor,
-- geste explicite et daté, jamais une réécriture silencieuse de l'histoire.
--
-- **Le contrôle mord** : `supabase/comptes.test.ts` (PGlite) — un compte en attente est
-- refusé à l'écriture, un compte approuvé passe, un non-administrateur n'approuve rien,
-- un compte ne s'approuve pas lui-même, et chaque contrôle est neutralisé tour à tour pour
-- exiger que la base laisse alors passer le fautif.
--
-- **Idempotente** : rejouable sans erreur (`if exists` / `if not exists`, `create or
-- replace`, `drop policy if exists` puis `create policy`).

begin;

-- ---------------------------------------------------------------------------------------------
-- Les comptes
-- ---------------------------------------------------------------------------------------------

create table if not exists public.comptes (
  -- L'identifiant du compte est celui de Supabase Auth : `auth.uid()` dans les politiques.
  -- Une FK vers `auth.users` : un compte supprimé côté GoTrue n'a plus de session, et sa
  -- ligne n'a plus de raison d'être. Les post-its, eux, ne pointent pas vers `auth.users`
  -- (0001) : un retour déjà écrit survit à la suppression d'un compte.
  id              uuid        primary key references auth.users (id) on delete cascade,

  -- Recopié à la première connexion (le déclencheur plus bas), jamais lu par le client
  -- pour décider quoi que ce soit : c'est un affichage d'administration.
  courriel        text        not null default '',

  -- L'état de la demande. `approuve` est la seule valeur qui ouvre l'écriture.
  etat            text        not null default 'en attente'
                              check (etat in ('en attente', 'approuve', 'refuse')),

  -- « Refuser, avec sa raison » (D-088) : un refus muet ne dit rien au testeur.
  raison          text        not null default '',

  -- Le drapeau qui ouvre l'écran d'administration. Faux par défaut, et **jamais** modifiable
  -- par un client : les droits d'écriture du rôle `authenticated` ne portent pas sur cette
  -- colonne (voir les grants plus bas).
  administrateur  boolean     not null default false,

  created_at      timestamptz not null default now(),
  -- Renseignées par le déclencheur de décision : qui a approuvé ou refusé, et quand.
  decide_le       timestamptz,
  decide_par      uuid,

  constraint comptes_refus_a_sa_raison
    check (etat <> 'refuse' or char_length(btrim(raison)) > 0)
);

comment on table public.comptes is
  'Les comptes de l''alpha (D-088) : état de la demande, raison d''un refus, drapeau administrateur.';
comment on column public.comptes.administrateur is
  'Faux par défaut ; marqué une fois par Bastien dans le SQL Editor. Le client ne peut pas y toucher.';
comment on column public.comptes.etat is
  'en attente | approuve | refuse. Seul approuve (ou un administrateur) ouvre l''écriture (D-088).';

create index if not exists comptes_etat_created_at on public.comptes (etat, created_at);

-- ---------------------------------------------------------------------------------------------
-- La ligne de compte, créée à la première connexion
-- ---------------------------------------------------------------------------------------------

-- Déclencheur sur `auth.users` (et non fonction appelée par le client, voir l'en-tête) : la
-- ligne existe dès que Supabase Auth connaît le compte, quel que soit le client qui s'inscrit.
-- `security definer` : GoTrue écrit avec `supabase_auth_admin`, qui n'a aucun droit sur
-- `public.comptes` — sans cela le déclencheur ferait échouer l'inscription elle-même.
create or replace function public.comptes_creation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.comptes (id, courriel)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
    set courriel = excluded.courriel
    where excluded.courriel <> ''
      and public.comptes.courriel is distinct from excluded.courriel;
  return new;
end;
$$;

drop trigger if exists comptes_creation on auth.users;
create trigger comptes_creation
  after insert or update of email on auth.users
  for each row
  when (new.email is not null)
  execute function public.comptes_creation();

-- ---------------------------------------------------------------------------------------------
-- La décision : dates et auteur, sans que le client les écrive
-- ---------------------------------------------------------------------------------------------

-- Le client ne reçoit le droit d'écrire que `etat` et `raison` ; ce déclencheur complète la
-- ligne avec qui a décidé et quand, et refuse un refus sans raison (la contrainte le dit
-- aussi, mais le message nommé est plus lisible dans l'écran d'administration).
create or replace function public.comptes_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.etat is distinct from old.etat then
    if new.etat = 'refuse' and char_length(btrim(new.raison)) = 0 then
      raise exception 'comptes_refus_a_sa_raison : un refus doit dire pourquoi (D-088)'
        using errcode = 'check_violation', constraint = 'comptes_refus_a_sa_raison';
    end if;
    new.decide_le := now();
    new.decide_par := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists comptes_decision on public.comptes;
create trigger comptes_decision
  before update on public.comptes
  for each row execute function public.comptes_decision();

-- ---------------------------------------------------------------------------------------------
-- Les deux questions que posent les politiques d'écriture
-- ---------------------------------------------------------------------------------------------

-- `security definer` : la fonction lit `comptes` sans repasser par sa RLS (une politique de
-- `postits` qui interrogerait `comptes` directement dépendrait de la politique de `comptes`,
-- et la moindre erreur de lecture deviendrait une erreur d'écriture). Elle ne rend qu'un
-- booléen sur **l'appelant** (`auth.uid()`), donc elle ne fuite rien.
--
-- Un administrateur est **toujours** approuvé : le marquage dans le SQL Editor ne doit pas
-- pouvoir enfermer Bastien dehors. `coalesce` : sans session, `auth.uid()` est nul et la
-- sous-requête ne rend aucune ligne — faux, et l'écriture est refusée.
create or replace function public.compte_approuve()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.comptes c
    where c.id = auth.uid()
      and (c.etat = 'approuve' or c.administrateur)
  );
$$;

comment on function public.compte_approuve() is
  'L''appelant (auth.uid()) est-il approuvé ? Seule condition d''écriture de l''alpha (D-088).';

create or replace function public.est_administrateur()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.comptes c
    where c.id = auth.uid()
      and c.administrateur
  );
$$;

comment on function public.est_administrateur() is
  'L''appelant peut-il approuver ou refuser un compte ? Drapeau posé une fois dans le SQL Editor (D-088).';

revoke execute on function public.compte_approuve() from public;
revoke execute on function public.est_administrateur() from public;
grant execute on function public.compte_approuve() to authenticated;
grant execute on function public.est_administrateur() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Droits : `authenticated` lit son compte, écrit deux colonnes ; le reste est au SQL Editor
-- ---------------------------------------------------------------------------------------------

-- Sans cette révocation, les privilèges par défaut de Supabase ouvriraient la table en
-- entier (0001 s'en sert, et le shim de `pglite.ts` le reproduit).
revoke all on public.comptes from anon;
revoke all on public.comptes from authenticated;

-- Tout compte lit sa propre ligne (la politique ci-dessous le borne) — c'est ainsi que
-- l'écran d'attente connaît son état.
grant select on public.comptes to authenticated;

-- Colonne par colonne : `etat` et `raison`, rien d'autre. `administrateur`, `id`, `courriel`,
-- les dates et l'auteur de la décision ne sont **pas** dans ce grant : un `update` qui les
-- vise échoue en `permission denied`, avant même la RLS.
grant update (etat, raison) on public.comptes to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RLS de `comptes`
-- ---------------------------------------------------------------------------------------------

alter table public.comptes enable row level security;
alter table public.comptes force  row level security;

-- Chacun lit sa ligne ; l'administration lit tout. Aucune autre ligne n'est visible.
drop policy if exists "comptes : chacun lit le sien, l'administration lit tout" on public.comptes;
create policy "comptes : chacun lit le sien, l'administration lit tout"
  on public.comptes for select to authenticated
  using (id = auth.uid() or public.est_administrateur());

-- Seul un administrateur change une décision. Sans cette politique, un compte pourrait
-- s'approuver lui-même (le grant de colonne l'y autoriserait) : c'est **ici** que la règle
-- « seul un administrateur approuve » tient.
drop policy if exists "comptes : l'administration decide" on public.comptes;
create policy "comptes : l'administration decide"
  on public.comptes for update to authenticated
  using (public.est_administrateur())
  with check (public.est_administrateur());

-- Aucune politique d'insertion et aucune de suppression, et aucun droit de ce type :
-- la ligne naît du déclencheur `auth.users`, elle ne se supprime pas depuis le jeu.

-- ---------------------------------------------------------------------------------------------
-- Les écritures du mur et des combats exigent un compte approuvé (D-088)
-- ---------------------------------------------------------------------------------------------
--
-- La **lecture** ne change pas : `postits` et `votes` restent lisibles par tout compte
-- (`using (true)`), et `combats` reste lisible par son auteur seul. Ce qui change est
-- chaque politique d'écriture : `and public.compte_approuve()`. Un client bricolé qui
-- saute l'écran est donc refusé par la base, pas seulement par l'interface.
--
-- `commentaires` suit le même chemin alors que le client ne l'écrit pas encore : laisser
-- une porte d'écriture ouverte à un compte en attente contredirait D-088.

-- Post-its -------------------------------------------------------------------------------------

drop policy if exists "postits : chacun colle les siens" on public.postits;
create policy "postits : chacun colle les siens"
  on public.postits for insert to authenticated
  with check (auteur = auth.uid() and public.compte_approuve());

drop policy if exists "postits : chacun deplace les siens" on public.postits;
create policy "postits : chacun deplace les siens"
  on public.postits for update to authenticated
  using (auteur = auth.uid() and public.compte_approuve())
  with check (auteur = auth.uid() and public.compte_approuve());

drop policy if exists "postits : chacun retire les siens" on public.postits;
create policy "postits : chacun retire les siens"
  on public.postits for delete to authenticated
  using (auteur = auth.uid() and public.compte_approuve());

-- Votes ----------------------------------------------------------------------------------------

-- La condition « pas pour son propre post-it » (0004) est reprise telle quelle : cette
-- migration ajoute l'approbation, elle ne réécrit pas la règle des pouces.
drop policy if exists "votes : chacun vote en son nom" on public.votes;
create policy "votes : chacun vote en son nom"
  on public.votes for insert to authenticated
  with check (
    votant = auth.uid()
    and public.compte_approuve()
    and not exists (
      select 1 from public.postits p
      where p.id = postit_id and p.auteur = auth.uid()
    )
  );

drop policy if exists "votes : chacun change d'avis en son nom" on public.votes;
create policy "votes : chacun change d'avis en son nom"
  on public.votes for update to authenticated
  using (votant = auth.uid() and public.compte_approuve())
  with check (
    votant = auth.uid()
    and public.compte_approuve()
    and not exists (
      select 1 from public.postits p
      where p.id = postit_id and p.auteur = auth.uid()
    )
  );

drop policy if exists "votes : chacun retire son vote" on public.votes;
create policy "votes : chacun retire son vote"
  on public.votes for delete to authenticated
  using (votant = auth.uid() and public.compte_approuve());

-- Commentaires ---------------------------------------------------------------------------------

drop policy if exists "commentaires : chacun commente en son nom" on public.commentaires;
create policy "commentaires : chacun commente en son nom"
  on public.commentaires for insert to authenticated
  with check (auteur = auth.uid() and public.compte_approuve());

drop policy if exists "commentaires : chacun modifie les siens" on public.commentaires;
create policy "commentaires : chacun modifie les siens"
  on public.commentaires for update to authenticated
  using (auteur = auth.uid() and public.compte_approuve())
  with check (auteur = auth.uid() and public.compte_approuve());

drop policy if exists "commentaires : chacun retire les siens" on public.commentaires;
create policy "commentaires : chacun retire les siens"
  on public.commentaires for delete to authenticated
  using (auteur = auth.uid() and public.compte_approuve());

-- Combats --------------------------------------------------------------------------------------

drop policy if exists "combats : chacun dépose les siens" on public.combats;
create policy "combats : chacun dépose les siens"
  on public.combats for insert to authenticated
  with check (auteur = auth.uid() and public.compte_approuve());

-- ---------------------------------------------------------------------------------------------
-- Les comptes déjà connus de Supabase Auth (avant cette migration)
-- ---------------------------------------------------------------------------------------------

-- Un compte créé **avant** la 0005 n'a pas déclenché `comptes_creation` : il resterait
-- invisible dans l'écran d'administration. On recopie donc les comptes qui ont un courriel.
-- Les identités **anonymes** (courriel nul) sont exclues volontairement : ce sont les
-- appareils d'avant D-088, dont les deux post-its existants — ils ne s'approuvent pas, et
-- n'ont rien à faire dans la liste des testeurs. Aucune autre donnée n'est touchée.
insert into public.comptes (id, courriel)
select u.id, u.email
from auth.users u
where u.email is not null
on conflict (id) do nothing;

commit;
