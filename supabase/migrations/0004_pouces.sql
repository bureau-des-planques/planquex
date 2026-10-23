-- Les pouces : on ne vote pas pour son propre post-it (#137).
--
-- `0001_mur.sql` donne à chaque appareil le droit de voter en son nom (`votant = auth.uid()`) et
-- la clé primaire `(postit_id, votant)` borne déjà le vote à **un par appareil et par post-it**.
-- Ce qui manquait : rien n'empêchait un auteur de voter pour **lui-même**. L'écran ne propose
-- pas le bouton sur son propre post-it, mais une garde qui ne vit que dans l'écran est une garde
-- qu'un autre client contourne : la règle est ici, dans la base.
--
--   1. la politique d'insertion et la politique de modification des votes gagnent la condition
--      « le post-it voté n'est pas à moi » (`postits.auteur <> auth.uid()`). La modification est
--      couverte aussi : sans cela, un appareil voterait pour un post-it d'autrui, puis
--      déplacerait son vote (`update … set postit_id`) vers le sien ;
--   2. un post-it qui n'existe pas (ou plus) reste refusé par la clé étrangère de 0001, et un
--      post-it **écarté** reste votable : le statut ne ferme pas le vote ;
--   3. les droits, les autres politiques et la vue ne changent pas.
--
-- Pas d'effacement de données : les pouces n'étaient pas encore proposés par le jeu, et une
-- ligne `votes` n'a pas de raison d'exister sur son propre post-it. Si une telle ligne avait été
-- écrite à la main, la requête de nettoyage ci-dessous la retire, sans quoi la vue la compterait
-- encore — elle ne touche aucune autre ligne.
--
-- **Idempotente** : rejouable sans erreur (`drop policy if exists`, puis `create policy`).
--
-- La garde : `supabase/pouces.test.ts` (PGlite) — chaque contrôle y est neutralisé tour à tour
-- et le test exige que la base accepte alors ce qu'elle refusait.

begin;

-- Nettoyage : un vote d'un auteur sur son propre post-it n'a pas lieu d'être.
delete from public.votes v
  using public.postits p
  where p.id = v.postit_id
    and p.auteur = v.votant;

-- Dans une politique, `postit_id` sans préfixe désigne la colonne de la ligne `votes` écrite :
-- la table `postits` interrogée plus bas n'a pas de colonne de ce nom.
drop policy if exists "votes : chacun vote en son nom" on public.votes;
create policy "votes : chacun vote en son nom"
  on public.votes for insert to authenticated
  with check (
    votant = auth.uid()
    and not exists (
      select 1 from public.postits p
      where p.id = postit_id and p.auteur = auth.uid()
    )
  );

drop policy if exists "votes : chacun change d'avis en son nom" on public.votes;
create policy "votes : chacun change d'avis en son nom"
  on public.votes for update to authenticated
  using (votant = auth.uid())
  with check (
    votant = auth.uid()
    and not exists (
      select 1 from public.postits p
      where p.id = postit_id and p.auteur = auth.uid()
    )
  );

commit;
