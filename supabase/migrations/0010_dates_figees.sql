-- `created_at` ne se redate pas par un `update` — #244, reprise de #238.
--
-- Le constat (#244, revue finale du 26/10/2026) : la 0009 pose les dates **à
-- l'insertion**. Reste le chemin par `update` : la politique « chacun modifie les
-- siens » (0005) et le grant `update` de la 0001 laissent l'auteur d'un commentaire
-- écrire `created_at`. Un compte approuvé commente le post-it d'un autre, puis
-- `update public.commentaires set created_at = '2030-01-01'` : le compteur du
-- propriétaire (`estApres(created_at, vu_le)`, `src/lib/murBase.ts`) reste vrai pour
-- toujours, et sa pastille ne retombe plus. Antidater est le geste symétrique.
--
-- **Rétablir, pas refuser** — le même choix que la 0009, pour la même raison : un
-- `update` légitime d'un autre champ (corriger le texte de son commentaire) qui
-- renvoie la ligne entière, `created_at` compris, ne doit pas échouer pour une date
-- que la base possède. Le déclencheur `before update` remet donc
-- `new.created_at := old.created_at` : l'écriture réussit, la date d'origine reste.
--
-- **Périmètre** : `commentaires.created_at` et `postits.created_at`. Pour les
-- post-its, le client n'a plus d'`update` sur cette colonne depuis la 0006 (grant de
-- colonnes `statut, raison, ticket`) : le déclencheur est une **ceinture** contre un
-- grant qui s'élargirait un jour, ou un autre chemin d'écriture. `postits.updated_at`
-- n'est **pas** touché ici : la 0008 le monte au changement de statut, et le grant de
-- la 0006 ne laisse pas le client l'écrire.
--
-- **Une phrase de la 0009 était fausse** (ce commentaire la corrige, la 0009 déjà
-- appliquée n'est pas réécrite) : son en-tête dit que `postits.created_at`
-- « n'alimente aucun compteur ». Depuis #239, `murBase.ts` compare `updated_at` à
-- `created_at` : un auteur qui antidaterait son propre `created_at` allumerait sa
-- propre pastille. L'effet reste limité à lui-même, mais `created_at` est bien lu
-- par un compteur — d'où la garde sur les post-its aussi.
--
-- **Le contrôle mord** : `supabase/dates.test.ts` (PGlite) — une redatation par
-- `update` retrouve la date d'origine, la correction de texte passe, et chaque
-- déclencheur neutralisé laisse passer la date du client.
--
-- **Idempotente** : rejouable sans erreur (`create or replace`, `drop trigger if
-- exists`). Elle ne touche aucune ligne existante : les déclencheurs ne visent que
-- l'`update` à venir.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. commentaires.created_at : figé à l'écriture
-- ---------------------------------------------------------------------------------------------

create or replace function public.commentaires_figer_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at; -- commentaires
  return new;
end;
$$;

comment on function public.commentaires_figer_date() is
  'Rétablit created_at à sa valeur d''origine à chaque update d''un commentaire (#244) : une date ne se redate pas.';

drop trigger if exists commentaires_dates_figees on public.commentaires;
create trigger commentaires_dates_figees
  before update on public.commentaires
  for each row execute function public.commentaires_figer_date();

-- ---------------------------------------------------------------------------------------------
-- 2. postits.created_at : figé à l'écriture
-- ---------------------------------------------------------------------------------------------

create or replace function public.postits_figer_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at; -- postits
  return new;
end;
$$;

comment on function public.postits_figer_date() is
  'Rétablit created_at à sa valeur d''origine à chaque update d''un post-it (#244) : le compteur des mouvements lit created_at.';

drop trigger if exists postits_dates_figees on public.postits;
create trigger postits_dates_figees
  before update on public.postits
  for each row execute function public.postits_figer_date();

commit;
