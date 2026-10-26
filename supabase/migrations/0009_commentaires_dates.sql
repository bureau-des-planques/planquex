-- Les dates du comité sont posées par le serveur, jamais par un client — #238.
--
-- Le constat (#238, relecture de l'intégration du 26/10/2026) : la 0001 donne
-- `insert` sur **toute** la table au rôle `authenticated`, et aucune migration
-- depuis n'en retire une colonne — la 0006 ne retire que l'`update` de `postits`,
-- la 0008 ajoute `updated_at` sans toucher aux droits d'insertion. Un compte
-- approuvé peut donc **fournir** `created_at` à un commentaire, ou `updated_at` à
-- un post-it, y compris **dans le futur**.
--
-- Pourquoi c'est une nuisance : le compteur de D-097 (5) (`compterChosesAVoir`,
-- `src/lib/murBase.ts`) compte les commentaires d'autrui et les mouvements de
-- statut **postérieurs** au repère `vu_le`. Or `marquer_comite_vu()` pose `now()` :
-- une date de 2030 reste après pour toujours, et **la pastille du propriétaire ne
-- retombe plus**, même après ouverture du suivi. Antidater est le geste symétrique :
-- un commentaire daté de 2000 n'allume jamais la pastille.
--
-- **Écraser, pas refuser** — un choix écrit : « refuser une date qui n'est pas
-- égale à `now()` » est impossible en pratique, un client ne pouvant pas deviner
-- l'horodatage de la transaction ; refuser reviendrait donc à refuser **toute**
-- date fournie, et un outillage qui réimporte une ligne complète (depuis le fichier
-- du mur, ou un export) échouerait pour un champ que la base possède. Le
-- déclencheur réécrit donc la date à `now()`, fournie ou non : l'écriture réussit,
-- et le serveur reste la seule source de l'heure. Les lignes déjà en base ne
-- bougent pas — le déclencheur ne vise que l'insertion.
--
-- **Périmètre** : `commentaires.created_at` et `postits.updated_at` — les deux
-- dates que le compteur lit. `postits.created_at` (l'ordre d'affichage du mur),
-- `votes.created_at` et `combats.created_at` n'alimentent aucun compteur : ils
-- restent au défaut de la 0001/0002, et une date fausse n'y dérègle que
-- l'affichage, pas la pastille.
--
-- **Le contrôle mord** : `supabase/dates.test.ts` (PGlite) — une date de 2030 ou
-- de 2000 fournie à l'insertion est réécrite à l'heure du serveur, et chaque
-- déclencheur neutralisé laisse passer la date du client.
--
-- **Idempotente** : rejouable sans erreur (`create or replace`, `drop trigger if
-- exists`). Elle suppose la **0008** (`postits.updated_at`).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. commentaires.created_at : l'heure du serveur, quoi qu'envoie le client
-- ---------------------------------------------------------------------------------------------

create or replace function public.commentaires_date_serveur()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Réécrite qu'elle soit fournie ou non : le même `now()` de transaction que le défaut.
  new.created_at := now();
  return new;
end;
$$;

comment on function public.commentaires_date_serveur() is
  'Pose created_at à l''heure du serveur à l''insertion d''un commentaire (#238) : la date n''est jamais celle du client.';

drop trigger if exists commentaires_date_serveur on public.commentaires;
create trigger commentaires_date_serveur
  before insert on public.commentaires
  for each row execute function public.commentaires_date_serveur();

-- ---------------------------------------------------------------------------------------------
-- 2. postits.updated_at : à la création aussi, l'heure du serveur
-- ---------------------------------------------------------------------------------------------

-- La 0008 date le **changement de statut** ; cette garde date la **création**. Sans
-- elle, un post-it collé avec un `updated_at` de 2030 garderait la pastille de son
-- auteur allumée sans qu'aucun statut ait bougé.
create or replace function public.postits_date_serveur()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.postits_date_serveur() is
  'Pose updated_at à l''heure du serveur à la création d''un post-it (#238) : le compteur des mouvements ne lit jamais une date client.';

drop trigger if exists postits_date_serveur on public.postits;
create trigger postits_date_serveur
  before insert on public.postits
  for each row execute function public.postits_date_serveur();

commit;
