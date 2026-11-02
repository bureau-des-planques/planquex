-- Le statut d'un post-it naît « en attente », quoi qu'écrive le client — #552.
--
-- Le constat (relecture du port, non traité par #263) : la 0001 donne `insert` sur
-- **toute** la table `postits` au rôle `authenticated`, et sa politique d'insertion
-- ne vérifie **que** l'auteur — `with check (auteur = auth.uid())`. La colonne a
-- bien son `default 'en attente'` et sa contrainte de valeurs (`postits_statut_check`),
-- mais **rien ne force** le statut : un client modifié peut coller un post-it déjà
-- `retenu`, `fait` ou `écarté`. Le tri est un geste du comité (D-059) — le statut ne
-- se choisit pas à l'insertion, il s'avance par un `update` d'administrateur (0006).
--
-- **Écraser, pas refuser** — le même choix que la 0009 : `insert` est accordé sur toute
-- la table, et un client ancien (ou un outillage qui rejoue une ligne complète) envoie
-- `statut: 'en attente'` parce que c'est ce que `composerLignePostit` écrit
-- (`src/lib/mur.ts`). Refuser un statut différent casserait ces écritures-là sans rien
-- garder de plus ; le déclencheur **réécrit** le statut, et l'écriture réussit. Le client
-- n'a donc plus voix au chapitre, et le geste normal est inchangé.
--
-- **Ce que le déclencheur ne fait pas** : il ne vise que l'`insert`, et il ne
-- distingue pas les rôles — **aucun** post-it ne naît trié, même inséré par le
-- propriétaire de la table. Un import qui porte un statut déjà trié se pose donc en
-- deux gestes, comme le tri : l'insertion (`en attente`), puis un `update` de
-- `statut`/`raison` en propriétaire. L'`update` du tri (0006) et le retrait (0007)
-- gardent leur politique, et un administrateur qui avance un post-it le fait toujours.
-- Il ne touche ni `raison`, ni `ticket` — un `en attente` qui porte une raison ne change
-- rien à ce que le mur affiche, et la contrainte `postits_ecarte_a_sa_raison` (0001)
-- n'est jamais violée par un statut réécrit.
--
-- **Le contrôle mord** : `supabase/statut.test.ts` (PGlite) — un compte approuvé qui
-- colle un post-it `fait` (ou `retenu`, ou `écarté`) obtient `en attente` en base, et
-- le déclencheur neutralisé laisse passer le statut du client.
--
-- **Idempotente** : rejouable sans erreur (`create or replace`, `drop trigger if exists`).
-- La fonction de déclencheur se **ferme** comme les six de la 0018 : PostgreSQL accorde
-- `EXECUTE` à `PUBLIC` sur toute fonction neuve, un déclencheur ne vérifie pas ce droit,
-- et `supabase/fonctions.test.ts` exige qu'`authenticated` n'exécute que les cinq
-- fonctions justifiées.

begin;

create or replace function public.postits_statut_a_l_insertion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Le statut est à la base : `en attente` à la naissance, puis le tri seul l'avance.
  new.statut := 'en attente';
  return new;
end;
$$;

comment on function public.postits_statut_a_l_insertion() is
  'Force statut à « en attente » à l''insertion d''un post-it (#552) : le tri seul (0006) fait avancer un statut.';

drop trigger if exists postits_statut_a_l_insertion on public.postits;
create trigger postits_statut_a_l_insertion
  before insert on public.postits
  for each row execute function public.postits_statut_a_l_insertion();

-- Fermée à tout le monde : un déclencheur ne vérifie pas l'`EXECUTE` (0018, D-133 (2)).
revoke execute on function public.postits_statut_a_l_insertion() from public, anon, authenticated;

commit;
