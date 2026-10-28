-- Le profil du testeur : pseudo, service, intitulé — #325, D-088, D-148.
--
-- Le parcours de première connexion (pseudo, puis service, puis intitulé tiré au sort) se
-- joue **à la connexion** et suit le **compte**, pas l'appareil : un profil qui vivait dans
-- le store local se perdrait à une réinstallation ou à un changement d'appareil (D-088).
-- Tranché par Bastien le 27/10/2026 (ticket #325) : une colonne côté base.
--
-- Ce que cette migration pose, et rien de plus :
--
--   1. `public.profils` : une ligne par compte (`auth.uid()`), son pseudo, son service, son
--      intitulé, et le nombre de relances de l'intitulé (0 ou 1).
--   2. Des **gardes de transition** (déclencheur `before update`) qui tiennent la règle, pas
--      seulement l'écran : le service est figé dès qu'il est posé ; l'intitulé est figé dès
--      qu'il est enregistré ; le nombre de relances ne monte que tant que l'intitulé n'est
--      pas enregistré, et ne descend jamais.
--   3. La **lecture et l'écriture** sont réservées au propriétaire de la ligne. Aucun autre
--      testeur ne lit le profil d'un autre : ce ticket n'ouvre rien d'autre (le profil affiché
--      ailleurs, sur le mur, est un autre ticket). Pas de suppression depuis le jeu.
--
-- Le profil **n'exige pas** un compte approuvé : D-088 laisse un compte en attente jouer et
-- lire, et le parcours se fait avant la validation de Bastien. Seule l'**écriture** du mur
-- reste gardée par `compte_approuve()` (0005) — ce n'est pas le cas ici.
--
-- Les **valeurs** (les cinq services, la liste des intitulés) ne sont pas dans la base : le
-- service est contraint par `check` (il fait partie du contrat de données), l'intitulé est un
-- texte borné. Le catalogue des intitulés reste dans `src/game/intitule.ts`.
--
-- **Le contrôle mord** : `supabase/profils.test.ts` (PGlite) — un autre compte ne lit ni n'écrit
-- la ligne, un second relancement est refusé, un service ou un intitulé enregistré ne bouge
-- plus, et chaque garde est neutralisée tour à tour pour exiger que la base laisse passer le
-- geste fautif.
--
-- **Idempotente** : rejouable sans erreur (`if not exists`, `create or replace`, `drop
-- policy if exists` puis `create policy`).

begin;

-- ---------------------------------------------------------------------------------------------
-- La table
-- ---------------------------------------------------------------------------------------------

create table if not exists public.profils (
  -- Le compte : `auth.uid()`. Supprimé avec son compte (`auth.users`), comme la ligne de
  -- `comptes` (0005).
  id                uuid        primary key references auth.users (id) on delete cascade,

  -- Étape 1. Le pseudo tient en 24 caractères au plus, sans blanc aux bords.
  pseudo            text        not null
                                check (char_length(btrim(pseudo)) between 1 and 24),

  -- Étape 2. Les cinq services du parcours (`src/game/intitule.ts`, `SERVICES`). `null` tant
  -- que le parcours n'est pas allé jusque-là. Figé dès qu'il est posé (garde ci-dessous).
  -- Ce n'est **pas** le service des factions (AGENTS.md §3.2) : c'est le groupe du joueur.
  service           text
                    check (service in ('red-chaussee', 'rez-de-chaussee', '1er', '2e', '3e')),

  -- Étape 3. L'intitulé tiré au sort, borné. `null` tant qu'il n'est pas validé. Figé dès
  -- qu'il est enregistré (garde ci-dessous). Le catalogue est côté client.
  intitule          text
                    check (intitule is null or char_length(btrim(intitule)) between 1 and 80),

  -- Relances de l'intitulé (D-148) : au plus **une**, et seulement avant l'enregistrement.
  intitule_relances smallint    not null default 0
                                check (intitule_relances between 0 and 1),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Un intitulé enregistré suppose un service enregistré : le parcours avance dans l'ordre.
  constraint profils_intitule_apres_service
    check (intitule is null or service is not null)
);

comment on table public.profils is
  'Le profil du testeur, attaché au compte (#325, D-088) : pseudo, service, intitulé tiré au sort.';
comment on column public.profils.service is
  'Le groupe du testeur (cinq valeurs). Figé dès qu''il est posé. Ce n''est pas le service des factions (AGENTS.md §3.2).';
comment on column public.profils.intitule is
  'L''intitulé tiré au sort, figé dès qu''il est enregistré (D-148).';
comment on column public.profils.intitule_relances is
  'Relances de l''intitulé : 0 ou 1, et seulement avant l''enregistrement (D-148).';

-- ---------------------------------------------------------------------------------------------
-- Les gardes de transition : ce que la base refuse, quel que soit le client
-- ---------------------------------------------------------------------------------------------

-- Une modification qui viole une règle lève une erreur **nommée** : l'écran peut la lire, et le
-- test la reconnaît. Une politique RLS, elle, ne lève pas : elle rend 0 ligne. Ici la règle est
-- une règle de **valeur**, donc un déclencheur, qui lève.
create or replace function public.profils_gardes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if old.service is not null and new.service is distinct from old.service then
    raise exception 'profils_service_fige : le service est figé dès la validation (#325)'
      using errcode = 'check_violation', constraint = 'profils_service_fige';
  end if;

  if old.intitule is not null and new.intitule is distinct from old.intitule then
    raise exception 'profils_intitule_fige : l''intitulé est figé une fois enregistré (#325)'
      using errcode = 'check_violation', constraint = 'profils_intitule_fige';
  end if;

  -- Les relances ne bougent que tant que l'intitulé n'est pas enregistré, et ne reculent jamais.
  if new.intitule_relances is distinct from old.intitule_relances
     and (old.intitule is not null or new.intitule_relances < old.intitule_relances) then
    raise exception 'profils_relance_figee : pas de relance après l''enregistrement, ni de recul (#325)'
      using errcode = 'check_violation', constraint = 'profils_relance_figee';
  end if;

  return new;
end;
$$;

-- Une fonction de déclencheur n'a pas à être appelable : PostgreSQL l'accorde à PUBLIC par défaut,
-- et `fonctions.test.ts` (#341, D-133) dénoncerait `anon` qui l'exécute. Le déclencheur, lui,
-- n'est pas vérifié à l'EXECUTE de son appelant : la garde tient sans ce droit.
revoke execute on function public.profils_gardes() from public, anon, authenticated;

drop trigger if exists profils_gardes on public.profils;
create trigger profils_gardes
  before update on public.profils
  for each row execute function public.profils_gardes();

-- ---------------------------------------------------------------------------------------------
-- Droits : le rôle `authenticated` lit et écrit sa ligne, colonne par colonne
-- ---------------------------------------------------------------------------------------------

-- Sans cette révocation, les privilèges par défaut de Supabase ouvriraient la table en entier
-- (même raison que 0005 pour `comptes`).
revoke all on public.profils from anon;
revoke all on public.profils from authenticated;

grant select on public.profils to authenticated;
-- Insertion : le pseudo (étape 1) et l'identifiant du compte. Le reste vient après.
grant insert (id, pseudo) on public.profils to authenticated;
-- Mise à jour : le service (étape 2), l'intitulé et ses relances (étape 3), le pseudo.
grant update (pseudo, service, intitule, intitule_relances) on public.profils to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RLS : chacun lit, crée et change **sa** ligne, et rien d'autre
-- ---------------------------------------------------------------------------------------------

alter table public.profils enable row level security;
alter table public.profils force row level security;

drop policy if exists "profils : chacun lit le sien" on public.profils;
create policy "profils : chacun lit le sien"
  on public.profils for select to authenticated
  using (id = auth.uid());

drop policy if exists "profils : chacun crée le sien" on public.profils;
create policy "profils : chacun crée le sien"
  on public.profils for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profils : chacun change le sien" on public.profils;
create policy "profils : chacun change le sien"
  on public.profils for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Aucune politique de suppression : un profil ne se retire pas depuis le jeu (il part avec le
-- compte, par la clé étrangère).

commit;
