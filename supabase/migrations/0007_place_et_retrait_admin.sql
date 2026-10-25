-- La place des post-its, et le retrait d'administration — #185, #186, D-088.
--
-- Deux manques que la 0006 laisse derrière elle, et que cette migration ferme.
--
--   1. **Le glisser n'écrit pas en base.** #185 a câblé l'écran sur un
--      `update public.postits set position_x, position_y, position_angle`. Or la 0006 a fait
--      `revoke update on public.postits from authenticated` puis
--      `grant update (statut, raison, ticket)`: les colonnes de place ne sont **pas** dans le
--      grant, et l'auteur n'a plus **aucune** politique d'`update`. Le geste échoue donc en
--      `permission denied`, et le rangement ne marchait qu'en mode fichier.
--
--   2. **L'administration ne range ni ne retire le post-it d'un autre.** La 0006 ne lui donne
--      que `statut`, `raison` et `ticket`, et la politique de retrait est celle de l'auteur.
--      Un mur qu'on ne peut ni désencombrer ni nettoyer n'est pas un mur.
--
-- **Pourquoi une fonction, et pas un `grant` de plus.** Une politique RLS ne sait pas
-- distinguer les **colonnes** : dès qu'on rend `position_*` écrivable au rôle `authenticated`
-- et qu'on rétablit une politique d'`update` pour l'auteur, l'auteur retrouve aussi
-- `statut` — que le grant de la 0006 lui donne au niveau du rôle, pas de la personne. Le
-- refus « le posteur ne trie pas son propre post-it » (D-059, éprouvé par
-- `mur-ecriture.test.ts`) tomberait. La place passe donc par
-- `public.deplacer_postit(...)`, exactement comme la correction du texte passe par
-- `corriger_postit` : `security definer`, `search_path` vide, et c'est **elle** qui dit qui
-- appelle, sur quel post-it, et dans quelles bornes. Le grant de la 0006 ne bouge pas.
--
-- **Qui déplace quoi** : l'**auteur approuvé** déplace son post-it ; l'**administrateur**
-- déplace n'importe lequel. Un compte en attente ne déplace rien (D-088).
--
-- **Qui retire quoi** : l'auteur, seulement tant que le post-it est `en attente` (0006) ;
-- l'administrateur, **n'importe lequel et quel que soit son statut** — c'est le geste de
-- modération, et il emporte votes et commentaires (`on delete cascade`, 0001). La
-- confirmation de l'écran dit ce que le geste efface.
--
-- **Idempotente** : rejouable sans erreur (`create or replace`, `drop policy if exists`).
-- Elle suppose la **0005** (`compte_approuve()`, `est_administrateur()`) et la **0006**.

begin;

-- ---------------------------------------------------------------------------------------------
-- La place d'un post-it : une fonction, parce que la règle porte sur qui, et pas sur la ligne
-- ---------------------------------------------------------------------------------------------

create or replace function public.deplacer_postit(
  p_id text,
  p_x double precision,
  p_y double precision,
  p_angle double precision
)
returns public.postits
language plpgsql
security definer
set search_path = ''
as $$
declare
  deplace public.postits;
begin
  -- Le compte d'abord : sans approbation ni drapeau, rien ne s'écrit (D-088).
  if not public.compte_approuve() then
    raise exception 'postit_deplace_refuse : ton compte n’est pas encore approuvé (D-088)'
      using errcode = 'insufficient_privilege';
  end if;

  select * into deplace from public.postits where id = p_id;
  if not found then
    raise exception 'postit_deplace_inconnu : ce post-it n’existe plus'
      using errcode = 'no_data_found';
  end if;

  -- « On ne range que ses propres post-its » (#185) — sauf l'administration (#186).
  if deplace.auteur is distinct from auth.uid() and not public.est_administrateur() then
    raise exception 'postit_deplace_refuse : ce post-it n’est pas le tien'
      using errcode = 'insufficient_privilege';
  end if;

  -- Les bornes de la 0001, dites ici **avant** la contrainte de la table : le refus porte
  -- alors un nom et une phrase, au lieu d'un `check violation` que l'écran ne sait pas dire.
  -- (`between` refuse aussi une valeur nulle ou non numérique : `not (...)` couvre les deux.)
  if p_x is null or p_y is null or p_angle is null
     or not (p_x between 0 and 100)
     or not (p_y between 0 and 100)
     or not (p_angle between -5 and 5) then
    raise exception 'postit_deplace_hors_bornes : une place se donne en pourcentage (0 à 100) et une inclinaison de -5 à 5 degrés'
      using errcode = 'check_violation';
  end if;

  update public.postits
     set position_x = round(p_x::numeric, 1)::double precision,
         position_y = round(p_y::numeric, 1)::double precision,
         position_angle = round(p_angle::numeric, 1)::double precision
   where id = p_id
  returning * into deplace;

  return deplace;
end;
$$;

comment on function public.deplacer_postit(text, double precision, double precision, double precision) is
  'Déplace un post-it : son auteur approuvé, ou un administrateur (#185, #186).';

revoke execute on function public.deplacer_postit(text, double precision, double precision, double precision) from public;
grant execute on function public.deplacer_postit(text, double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RLS : l'administration retire n'importe quel post-it, à n'importe quel statut
-- ---------------------------------------------------------------------------------------------

-- La politique de l'auteur (0006) reste **telle quelle** : lui seul, un compte approuvé, et
-- seulement tant que le post-it est `en attente`. Celle-ci s'y ajoute — les politiques
-- permissives se cumulent.
drop policy if exists "postits : l'administration retire" on public.postits;
create policy "postits : l'administration retire"
  on public.postits for delete to authenticated
  using (public.est_administrateur());

commit;
