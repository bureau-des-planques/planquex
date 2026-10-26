-- Le repère du comité : quand un post-it a bougé, et quand tu l'as vu — #209, D-097 (5).
--
-- Le compteur « choses à voir » du comité (D-097) répond à une question que la base ne savait
-- pas encore poser : **qu'est-ce qui a changé depuis ma dernière visite ?** Il compte deux
-- choses, et deux seulement :
--
--   1. **mes** post-its dont le **statut** a bougé (le tri de l'administration, D-088/D-089) ;
--   2. les **commentaires des autres** arrivés sur **mes** post-its.
--
-- La première demande un horodatage du mouvement ; la seconde, un repère par compte. Les deux
-- vivent ici, et nulle part ailleurs : le client les **lit**, il ne les écrit pas.
--
--   1. `public.postits.updated_at` — posé par un déclencheur **sur le statut**, jamais par un
--      client. Un `update` du texte ou de la place ne compte pas : il ne concerne que son
--      auteur, et le compteur ne parle qu'à lui.
--
--   2. `public.comptes.vu_le` — le repère **par compte** (pas par appareil : le compteur suit
--      d'un appareil à l'autre, D-097). Écrit par `public.marquer_comite_vu()`, qui ne prend
--      aucun argument et ne vise que `auth.uid()` : c'est la fonction qui dit qui marque, pas
--      le client. Sans elle, il faudrait donner au rôle `authenticated` un `update` sur
--      `comptes.vu_le` — donc, une politique RLS ne distinguant pas les colonnes, rouvrir
--      `etat` et `raison` à leur propriétaire, que la 0005 réserve à l'administration.
--
-- **La vue de lecture suit** : `postits_avec_votes` gagne `updated_at`, sinon le client
-- devrait interroger la table `postits` en plus de la vue, et la forme du contrat se
-- dédoublerait (`src/lib/murBase.ts`).
--
-- **À l'application** : les post-its existants reçoivent `created_at` comme `updated_at`
-- (aucun statut n'a bougé depuis leur création, et le compteur ne doit pas crier pour du
-- passé), et les comptes existants reçoivent `now()` comme `vu_le` (le compteur part de
-- zéro, il ne réveille personne avec l'historique).
--
-- **Le contrôle mord** : `supabase/comite.test.ts` (PGlite) — un changement de statut bump
-- `updated_at`, une correction de texte non ; `marquer_comite_vu()` n'écrit que le repère de
-- l'appelant, et un client ne peut pas l'écrire en direct. Chaque garde est neutralisée tour
-- à tour par mutation de ce fichier.
--
-- **Idempotente** : rejouable sans erreur (`if not exists`, `create or replace`,
-- `drop trigger if exists`).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Quand un post-it a bougé : `updated_at`, posé sur le statut
-- ---------------------------------------------------------------------------------------------

alter table public.postits add column if not exists updated_at timestamptz;

-- Le passé ne compte pas : un post-it existant est daté de sa création, pas de la migration.
update public.postits set updated_at = created_at where updated_at is null;

alter table public.postits alter column updated_at set default now();
alter table public.postits alter column updated_at set not null;

comment on column public.postits.updated_at is
  'Dernier mouvement de statut (D-097) : le compteur du comité compare cette date au repère vu_le du compte.';

create or replace function public.postits_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Le déclencheur ne se déclenche que sur `statut` (voir le `create trigger`), mais un
  -- `update` peut nommer la colonne sans la changer : on ne date que le vrai mouvement.
  if new.statut is distinct from old.statut then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

comment on function public.postits_updated_at() is
  'Date un post-it au changement de statut, et seulement là (D-097).';

drop trigger if exists postits_updated_at on public.postits;
create trigger postits_updated_at
  before update of statut on public.postits
  for each row execute function public.postits_updated_at();

-- Le compteur interroge les commentaires d'un post-it dans l'ordre du temps : sans cet
-- index, chaque affichage du comité relit la table entière.
create index if not exists commentaires_postit_created_at
  on public.commentaires (postit_id, created_at);

-- ---------------------------------------------------------------------------------------------
-- 2. Quand tu l'as vu : `comptes.vu_le`, et la fonction qui le pose
-- ---------------------------------------------------------------------------------------------

alter table public.comptes add column if not exists vu_le timestamptz;

-- Les comptes existants ne réveillent personne : leur repère part de maintenant.
update public.comptes set vu_le = now() where vu_le is null;

alter table public.comptes alter column vu_le set default now();
alter table public.comptes alter column vu_le set not null;

comment on column public.comptes.vu_le is
  'Dernière ouverture du suivi par ce compte (D-097) ; écrit par marquer_comite_vu(), jamais en direct.';

-- `security definer` : la fonction écrit `comptes` sans repasser par la RLS de la 0005, qui
-- réserve la colonne à l'administration. Elle ne vise que `auth.uid()`, donc elle ne peut
-- pas marquer le repère d'un autre — c'est la fonction qui porte la règle, comme
-- `deplacer_postit` (D-092).
--
-- **Aucune condition d'approbation** : lire le comité est ouvert à un compte en attente
-- (D-088), et le repère ne fait que suivre une lecture. Un compte sans ligne (supprimé côté
-- GoTrue) reçoit un refus nommé plutôt qu'un silence.
create or replace function public.marquer_comite_vu()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  vu timestamptz;
begin
  if auth.uid() is null then
    raise exception 'comite_vu_sans_compte : il faut un compte pour marquer le suivi'
      using errcode = 'insufficient_privilege';
  end if;

  update public.comptes
     set vu_le = now()
   where id = auth.uid()
  returning vu_le into vu;

  if vu is null then
    raise exception 'comite_vu_sans_compte : ce compte n’existe plus'
      using errcode = 'no_data_found';
  end if;

  return vu;
end;
$$;

comment on function public.marquer_comite_vu() is
  'Pose le repère du comité au compte appelant (D-097) : appelée quand le suivi s''ouvre.';

revoke execute on function public.marquer_comite_vu() from public;
grant execute on function public.marquer_comite_vu() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. La vue de lecture gagne `updated_at` (la forme du contrat ne se dédouble pas)
-- ---------------------------------------------------------------------------------------------

-- `create or replace view` ne peut qu'**ajouter** des colonnes, à la fin : `updated_at`
-- vient donc après `created_at`. Les droits posés par la 0001 (`grant select` sur la vue)
-- restent valables, et `security_invoker` est réaffirmé — une vue remplacée sans son option
-- redeviendrait `security definer`, c'est-à-dire une porte dérobée (0001).
create or replace view public.postits_avec_votes
with (security_invoker = true) as
select
  p.id,
  p.kind,
  p.titre,
  p.texte,
  p.ecran,
  p.pseudo,
  p.version,
  p.statut,
  p.raison,
  p.ticket,
  p.gueulage,
  jsonb_build_object('x', p.position_x, 'y', p.position_y, 'angle', p.position_angle) as position,
  jsonb_build_object(
    'up', count(*) filter (where v.sens = 'up'),
    'down', count(*) filter (where v.sens = 'down')
  ) as votes,
  p.auteur,
  p.created_at,
  p.updated_at
from public.postits p
left join public.votes v on v.postit_id = p.id
group by p.id;

commit;
