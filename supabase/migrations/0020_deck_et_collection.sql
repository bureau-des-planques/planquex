-- Le Deck et la Collection vivent sur le compte — #489, D-153.
--
-- Le Deck (20 cartes) et la Collection (toutes les cartes possédées, avec leurs quantités)
-- vivaient dans le navigateur seul (`bureau-des-planques-v1`, `owned` et `deck`). D-048
-- critère 5 demande qu'un testeur ne perde rien : un changement d'appareil ou une
-- réinstallation effacerait tout. D-153 (1) les pose donc sur le compte.
--
-- Ce que cette migration pose, et rien de plus :
--
--   1. `public.collection` : **une ligne par carte possédée** et par compte, avec sa
--      quantité (au moins 1 : une carte à zéro n'est pas une ligne).
--   2. `public.deck` : **une ligne par carte du Deck** et par compte, avec sa quantité et son
--      `rang` (l'ordre du Deck). L'ordre compte : les types de café d'un Deck se dérivent de
--      l'ordre de ses Planqués (`deckCafeTypes`, `src/game/deck.ts`), et un Deck rangé
--      autrement ne produit pas les mêmes cafés.
--   3. `updated_at` posé par un déclencheur à chaque `update` — le client ne l'écrit jamais
--      (la colonne n'est pas dans les droits d'écriture), c'est la date du serveur.
--   4. La **lecture et l'écriture** sont réservées au propriétaire de la ligne : un autre
--      testeur ne lit, ne change et ne supprime rien. `anon` n'a aucun droit.
--
-- Comme le profil (0019), le Deck et la Collection **n'exigent pas** un compte approuvé :
-- D-088 laisse un compte en attente jouer, et sa Collection est son jeu, pas le mur. Seule
-- l'écriture du mur reste gardée par `compte_approuve()` (0005) — ce n'est pas le cas ici.
--
-- **Ce que la base ne tient pas** : les **règles de jeu** du Deck (20 cartes, 2 exemplaires
-- par nom, un Planqué Entrant au moins) restent au moteur (`src/game/deck.ts`, `docs/JEU.md`
-- §4). Une table Postgres ne les porte pas sans les recopier, et une règle recopiée dérive
-- de sa source. La base garde la **forme** : une quantité entière et positive, un rang entier
-- positif et unique par compte.
--
-- **Ce que les tickets suivants font** (D-153 (3)) : la Collection se fusionne par `max` et
-- le Deck se rejoue depuis un journal d'intentions, par une fonction (RPC) — pas ici. Cette
-- migration ne pose que les tables, leurs droits et leurs politiques.
--
-- **Le contrôle mord** : `supabase/deck-collection.test.ts` (PGlite) — un autre compte ne lit
-- ni n'écrit ni ne supprime la ligne, la politique mutée (sa condition de propriétaire
-- remplacée par `true`) laisse alors passer la fuite, les droits de colonne refusent un
-- `updated_at` écrit par le client, et `anon` n'a rien.
--
-- **Idempotente** : rejouable sans erreur (`if not exists`, `create or replace`, `drop
-- trigger if exists`, `drop policy if exists` puis `create policy`).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. La Collection : une ligne par carte possédée
-- ---------------------------------------------------------------------------------------------

create table if not exists public.collection (
  -- Le compte : `auth.uid()`. La ligne s'en va avec le compte (`auth.users`), comme `comptes`
  -- et `profils`.
  compte_id  uuid        not null references auth.users (id) on delete cascade,

  -- L'identifiant de la carte (`src/data`). La base ne connaît pas le catalogue : elle ne
  -- peut pas vérifier que l'identifiant existe, et ne le fait pas — le client le tient.
  carte_id   text        not null
                         check (char_length(btrim(carte_id)) between 1 and 80),

  -- Exemplaires possédés. Au moins 1 : posséder zéro carte, c'est ne pas avoir de ligne.
  quantite   integer     not null
                         check (quantite >= 1),

  created_at timestamptz not null default now(),
  -- Date serveur du dernier mouvement, posée par le déclencheur ci-dessous.
  updated_at timestamptz not null default now(),

  primary key (compte_id, carte_id)
);

comment on table public.collection is
  'La Collection d''un compte (#489, D-153) : une ligne par carte possédée, avec sa quantité.';
comment on column public.collection.carte_id is
  'L''identifiant de la carte (src/data). La base garde la forme, pas le catalogue.';
comment on column public.collection.quantite is
  'Exemplaires possédés : toujours au moins 1. La fusion de synchro garde le maximum (D-153 (3)).';
comment on column public.collection.updated_at is
  'Date serveur du dernier mouvement (déclencheur). Jamais écrite par le client.';

-- ---------------------------------------------------------------------------------------------
-- 2. Le Deck : une ligne par carte du Deck, avec son rang
-- ---------------------------------------------------------------------------------------------

create table if not exists public.deck (
  compte_id  uuid        not null references auth.users (id) on delete cascade,

  carte_id   text        not null
                         check (char_length(btrim(carte_id)) between 1 and 80),

  -- Exemplaires de cette carte au Deck (1, 2…). Le plafond de 2 par **nom** est une règle de
  -- jeu : il vit dans `MAX_COPIES_PER_NAME` (`src/game/deck.ts`), pas ici.
  quantite   integer     not null
                         check (quantite >= 1),

  -- L'ordre du Deck. Deux cartes d'un même compte ne peuvent pas occuper le même rang ; le
  -- client en choisit la valeur, la base vérifie qu'elle est entière et positive.
  rang       smallint    not null
                         check (rang >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (compte_id, carte_id),
  constraint deck_rang_unique unique (compte_id, rang)
);

comment on table public.deck is
  'Le Deck d''un compte (#489, D-153) : une ligne par carte, avec sa quantité et son rang. Les règles de jeu restent au moteur (src/game/deck.ts).';
comment on column public.deck.quantite is
  'Exemplaires de cette carte au Deck. Le plafond par nom et la taille du Deck sont des règles de jeu (src/game/deck.ts).';
comment on column public.deck.rang is
  'L''ordre de la carte dans le Deck : les types de café se dérivent de l''ordre (deckCafeTypes, src/game/deck.ts).';
comment on column public.deck.updated_at is
  'Date serveur du dernier mouvement (déclencheur). Jamais écrite par le client.';

-- ---------------------------------------------------------------------------------------------
-- 3. `updated_at` : la date du serveur, à chaque mouvement
-- ---------------------------------------------------------------------------------------------

-- Une fonction partagée par les deux tables : la règle est la même, et deux copies
-- divergeraient. Une fonction de déclencheur n'a pas à être appelable : PostgreSQL l'accorde à
-- PUBLIC par défaut, et `fonctions.test.ts` (#341, D-133) dénoncerait `anon` ou
-- `authenticated` qui l'exécute. Le déclencheur, lui, ne vérifie pas l'EXECUTE de son
-- appelant : la garde tient sans ce droit.
create or replace function public.toucher_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.toucher_updated_at() is
  'Pose updated_at à now() sur un update : la date du mouvement vient du serveur (#489).';

revoke execute on function public.toucher_updated_at() from public, anon, authenticated;

drop trigger if exists collection_updated_at on public.collection;
create trigger collection_updated_at
  before update on public.collection
  for each row execute function public.toucher_updated_at();

drop trigger if exists deck_updated_at on public.deck;
create trigger deck_updated_at
  before update on public.deck
  for each row execute function public.toucher_updated_at();

-- ---------------------------------------------------------------------------------------------
-- 4. Droits : `authenticated` lit, écrit et retire ses lignes, colonne par colonne
-- ---------------------------------------------------------------------------------------------

-- Sans cette révocation, les privilèges par défaut de Supabase ouvriraient les deux tables en
-- entier (même raison que 0005 et 0019).
revoke all on public.collection from anon;
revoke all on public.collection from authenticated;
revoke all on public.deck from anon;
revoke all on public.deck from authenticated;

-- Insertion : l'identifiant du compte est fourni par le client, et la politique ci-dessous
-- exige qu'il soit le sien. `updated_at` n'est jamais accordé : la date vient du serveur.
grant select, delete on public.collection to authenticated;
grant insert (compte_id, carte_id, quantite) on public.collection to authenticated;
grant update (quantite) on public.collection to authenticated;

grant select, delete on public.deck to authenticated;
grant insert (compte_id, carte_id, quantite, rang) on public.deck to authenticated;
grant update (quantite, rang) on public.deck to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. RLS : chacun lit, crée, change et retire **ses** lignes, et rien d'autre
-- ---------------------------------------------------------------------------------------------

alter table public.collection enable row level security;
alter table public.collection force row level security;
alter table public.deck enable row level security;
alter table public.deck force row level security;

drop policy if exists "collection : chacun lit la sienne" on public.collection;
create policy "collection : chacun lit la sienne"
  on public.collection for select to authenticated
  using (compte_id = auth.uid());

drop policy if exists "collection : chacun crée la sienne" on public.collection;
create policy "collection : chacun crée la sienne"
  on public.collection for insert to authenticated
  with check (compte_id = auth.uid());

drop policy if exists "collection : chacun change la sienne" on public.collection;
create policy "collection : chacun change la sienne"
  on public.collection for update to authenticated
  using (compte_id = auth.uid())
  with check (compte_id = auth.uid());

drop policy if exists "collection : chacun retire la sienne" on public.collection;
create policy "collection : chacun retire la sienne"
  on public.collection for delete to authenticated
  using (compte_id = auth.uid());

drop policy if exists "deck : chacun lit le sien" on public.deck;
create policy "deck : chacun lit le sien"
  on public.deck for select to authenticated
  using (compte_id = auth.uid());

drop policy if exists "deck : chacun crée le sien" on public.deck;
create policy "deck : chacun crée le sien"
  on public.deck for insert to authenticated
  with check (compte_id = auth.uid());

drop policy if exists "deck : chacun change le sien" on public.deck;
create policy "deck : chacun change le sien"
  on public.deck for update to authenticated
  using (compte_id = auth.uid())
  with check (compte_id = auth.uid());

drop policy if exists "deck : chacun retire le sien" on public.deck;
create policy "deck : chacun retire le sien"
  on public.deck for delete to authenticated
  using (compte_id = auth.uid());

commit;
