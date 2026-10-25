-- La trace des combats — #173, D-086.
--
-- Une partie **solo terminée** laisse de quoi la **rejouer** : sa graine, ses deux Decks,
-- ses types de café et son journal d'actions. `replayBattle(deck, deck, graine, journal,
-- types)` redonne l'état final à l'identique (#83) ; la ligne ne porte donc **rien d'autre**.
-- Jamais le pseudo, jamais de texte libre : `auteur` est l'identité **anonyme** de l'appareil
-- (D-059, `auth.uid()`), et `created_at` dit quand la ligne est entrée.
--
-- **Règles d'accès** : le joueur **dépose** ses combats et **relit les siens** ; il ne lit
-- pas ceux d'un autre appareil, et n'écrit jamais au nom d'un autre. `anon` (appareil non
-- identifié) n'a rien. Même modèle que le mur (`0001_mur.sql`) : révocation de `anon`, droits
-- pour `authenticated`, RLS forcée.
--
-- **Pas de mise à jour ni de suppression** : une trace est un **ajout**, pas un brouillon.
-- Aucune politique `update`/`delete`, donc la RLS les refuse par défaut (default-deny).
--
-- **Solo seulement** pour l'alpha : `mode` n'admet que `'solo'`. Le PvP est en beta ; il
-- faudra une migration neuve pour élargir la contrainte, pas une retouche de celle-ci.
--
-- La garde qui prouve que ces règles mordent : `supabase/combats.test.ts` (PGlite,
-- PostgreSQL réel en WASM) — il joue **toutes** les migrations du dossier, puis une version
-- dont les conditions des politiques valent `true`, et exige d'y constater la fuite.

begin;

-- ---------------------------------------------------------------------------------------------
-- Les combats
-- ---------------------------------------------------------------------------------------------

create table public.combats (
  -- Un numéro suffit : le client ne choisit pas l'identité de sa ligne.
  id         bigint      generated always as identity primary key,

  -- L'appareil qui a joué : une identité anonyme, jamais un nom (D-059).
  -- Pas de clé étrangère vers `auth.users` : une identité anonyme peut être purgée côté
  -- GoTrue, et la trace d'un combat ne doit pas disparaître avec l'appareil.
  auteur     uuid        not null default auth.uid(),

  -- L'alpha ne garde que le solo (#173) ; le PvP viendra avec la beta.
  mode       text        not null default 'solo' check (mode = 'solo'),

  -- La graine d'origine de la partie (`BattleState.seed`) : un entier positif ou nul.
  graine     bigint      not null check (graine >= 0),

  -- Les deux Decks, tels qu'ils ont été joués — des listes d'ids de cartes.
  decks      jsonb       not null check (
                           jsonb_typeof(decks) = 'object'
                           and jsonb_typeof(decks -> 'playerDeck') = 'array'
                           and jsonb_typeof(decks -> 'aiDeck') = 'array'
                         ),

  -- Les types de café **effectifs** de chaque camp (`BattleState.players[who].cafeTypes`).
  types_cafe jsonb       not null check (
                           jsonb_typeof(types_cafe) = 'object'
                           and jsonb_typeof(types_cafe -> 'playerCafeTypes') = 'array'
                           and jsonb_typeof(types_cafe -> 'aiCafeTypes') = 'array'
                         ),

  -- Le journal des actions **appliquées** : ce que `replayBattle` rejoue.
  journal    jsonb       not null check (jsonb_typeof(journal) = 'array'),

  created_at timestamptz not null default now()
);

comment on table public.combats is
  'Les parties solo terminées (#173, D-086) : graine, Decks, types de café et journal — rien d''autre.';
comment on column public.combats.auteur is
  'Identité anonyme de l''appareil (auth.uid()). Pas de FK vers auth.users : une trace survit à la purge d''une identité.';
comment on column public.combats.types_cafe is
  'Les types de café effectifs, ceux que replayBattle doit recevoir pour rejouer la partie.';
comment on column public.combats.journal is
  'Le journal des actions appliquées : la partie se rejoue depuis la graine et ce journal.';

-- Relire ses propres traces est le seul usage de lecture : l'index suit `auteur` puis le temps.
create index combats_auteur_created_at on public.combats (auteur, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Droits : le rôle `authenticated` (l'identité anonyme), et lui seul
-- ---------------------------------------------------------------------------------------------

-- Un appareil non identifié (`anon`) n'a rien à faire ici : on signe d'abord, on dépose ensuite.
revoke all on public.combats from anon;

-- Insertion et lecture seulement : une trace ne se réécrit pas.
grant select, insert on public.combats to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RLS : chacun dépose et relit les siens
-- ---------------------------------------------------------------------------------------------

-- `force` est indispensable : sans lui, le propriétaire de la table (le rôle qui a joué la
-- migration) échappe à ses propres politiques.
alter table public.combats enable row level security;
alter table public.combats force  row level security;

-- La lecture de **toutes** les traces est un acte d'administration : la clé de service
-- (jamais dans le navigateur, `src/lib/supabase.ts` la refuse) contourne la RLS. Aucune
-- politique n'ouvre la lecture d'autrui au client.
create policy "combats : chacun relit les siens"
  on public.combats for select to authenticated
  using (auteur = auth.uid());

create policy "combats : chacun dépose les siens"
  on public.combats for insert to authenticated
  with check (auteur = auth.uid());

commit;
