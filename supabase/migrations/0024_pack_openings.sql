-- L'Arrivage se tire et se crédite côté serveur — #651, D-179.
--
-- D-179 (2) : « Le serveur tire avec la même règle (src/game/pack.ts, pure et seedée),
-- crédite la Collection **une seule fois** (clé d'idempotence, transaction) et rend les
-- cartes ; le client n'avance plus de générateur. »
--
-- Cette migration pose ce que la base doit tenir, et rien de plus :
--
--   1. `public.pack_openings` : **une ligne par Arrivage ouvert** — le compte, la clé
--      d'idempotence, la graine, les cartes tirées et la date du serveur (le modèle de
--      `docs/PROPOSITION.md` §6.3).
--   2. `public.crediter_arrivage(cle, cartes, graine)` : la fonction qui **crédite la
--      Collection et écrit la ligne d'ouverture dans la même transaction**. La même clé
--      deux fois rend les mêmes cartes et ne crédite qu'une fois : la clé est unique par
--      compte, et le `on conflict do nothing` décide si le crédit a lieu.
--   3. RLS : chaque compte **lit** ses ouvertures ; il n'écrit rien. La table n'accorde
--      aucun `insert`, `update` ni `delete` au client : le crédit passe par la fonction,
--      et **elle seule**.
--
-- **Ce que la base ne tient pas** : la composition d'un Arrivage (« 3 communes, 1 peu
-- commune, 1 rare ») et le tirage lui-même restent au moteur (`src/game/pack.ts`), rejoué
-- par l'Edge Function (`supabase/functions/ouvrir-arrivage/`) sur une copie **générée**.
-- Une règle recopiée en SQL dériverait de sa source ; la base garde la **forme** : une clé
-- non vide, des cartes en tableau, une graine entière.
--
-- **Qui exécute la fonction** : personne côté client. `authenticated` ne l'exécute pas —
-- `supabase/fonctions.test.ts` le vérifie (`OUVERTS_ATTENDUS`), et c'est ce qui empêche un
-- navigateur de se créditer des cartes choisies. L'Edge Function parle à la base par
-- `SUPABASE_DB_URL` (le rôle propriétaire), pose `request.jwt.claim.sub` à l'identifiant du
-- JWT vérifié, puis appelle la fonction dans la même transaction : `auth.uid()` désigne
-- donc bien le compte, sans qu'aucun client n'ait le droit d'appeler la fonction.
--
-- **Le contrôle mord** : `supabase/pack-openings.test.ts` (PGlite) — la même clé deux fois
-- crédite une fois, une clé rejouée avec d'autres cartes rend les cartes d'origine, le
-- compte rendu est exact, un autre compte ne lit rien, le client n'écrit ni n'exécute la
-- fonction — et la contrainte d'unicité retirée laisse passer le double crédit.
--
-- **Idempotente** : rejouable sans erreur (`if not exists`, `create or replace`,
-- `drop policy if exists` puis `create policy`).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Les ouvertures : une ligne par Arrivage, pour un compte et une clé
-- ---------------------------------------------------------------------------------------------

create table if not exists public.pack_openings (
  -- L'ouverture elle-même. Un entier qui monte : la table est un journal, pas un annuaire.
  id         bigint      generated always as identity primary key,

  -- Le compte qui a ouvert. La ligne s'en va avec le compte (`auth.users`), comme la
  -- Collection et le Deck (0020).
  user_id    uuid        not null references auth.users (id) on delete cascade,

  -- La clé d'idempotence fournie par l'appelant : la même clé rejouée ne crédite pas deux
  -- fois. C'est elle, et non l'identifiant de ligne, qui porte la promesse de D-179.
  cle        text        not null
                         check (char_length(btrim(cle)) between 1 and 200),

  -- Quel Arrivage (`arrivage` aujourd'hui ; le modèle de PROPOSITION §6.3 garde la place
  -- d'un set ou d'un paquet nommé). La base ne connaît pas les paquets.
  pack_id    text        not null default 'arrivage'
                         check (char_length(btrim(pack_id)) between 1 and 80),

  -- La graine du tirage : ce qui permet de le rejouer à l'identique avec `pack.ts`.
  -- Nulle seulement si l'appelant n'en fournit pas — la fonction du jeu en fournit une.
  seed       bigint,

  -- Les cartes tirées, telles que le serveur les a rendues : `[{ "id": …, "rarity": … }]`.
  -- La base ne connaît pas le catalogue, comme pour `collection.carte_id`.
  cards      jsonb       not null
                         check (jsonb_typeof(cards) = 'array' and jsonb_array_length(cards) > 0),

  created_at timestamptz not null default now(),

  -- **La clé de l'idempotence** : deux ouvertures du même compte ne partagent pas une clé.
  constraint pack_openings_cle_unique unique (user_id, cle)
);

comment on table public.pack_openings is
  'Les Arrivages ouverts (#651, D-179) : une ligne par ouverture, avec sa clé d''idempotence, sa graine et ses cartes.';
comment on column public.pack_openings.cle is
  'Clé d''idempotence fournie par le client : la même clé rejouée rend les mêmes cartes et ne crédite qu''une fois.';
comment on column public.pack_openings.seed is
  'Graine du tirage : rejoue les mêmes cartes avec src/game/pack.ts.';
comment on column public.pack_openings.cards is
  'Les cartes tirées ([{ id, rarity }]). La base garde la forme, pas le catalogue.';

-- ---------------------------------------------------------------------------------------------
-- 2. Le crédit : une transaction, une clé, une seule fois
-- ---------------------------------------------------------------------------------------------

-- `security definer` : la fonction écrit `collection` et `pack_openings` sans repasser par
-- la RLS du client. Elle ne vise que `auth.uid()` — le compte vient du JWT vérifié par
-- l'Edge Function, jamais d'un argument.
--
-- La graine est un **troisième argument facultatif** : D-179 fixe `(cle, cartes)`, et un
-- appel à deux arguments reste valide ; l'Edge Function, elle, transmet la graine qu'elle a
-- tirée, pour que l'ouverture se rejoue (`pack_openings.seed`).
create or replace function public.crediter_arrivage(
  p_cle text,
  p_cartes jsonb,
  p_seed bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_cle      text := btrim(p_cle);
  v_cartes   jsonb;
  v_creditee jsonb;
begin
  if v_uid is null then
    raise exception 'arrivage_sans_compte : il faut un compte pour ouvrir un Arrivage'
      using errcode = 'insufficient_privilege';
  end if;

  if v_cle is null or v_cle = '' then
    raise exception 'arrivage_sans_cle : une ouverture doit porter sa clé d''idempotence'
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_typeof(p_cartes) is distinct from 'array' or jsonb_array_length(p_cartes) = 0 then
    raise exception 'arrivage_sans_cartes : l''ouverture doit rendre au moins une carte'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Chaque carte doit nommer son identifiant : la base n'en sait pas plus, et n'a pas à
  -- l'apprendre (le catalogue vit dans `src/data`).
  if exists (
    select 1
      from jsonb_array_elements(p_cartes) as carte
     where jsonb_typeof(carte) <> 'object'
        or coalesce(btrim(carte ->> 'id'), '') = ''
  ) then
    raise exception 'arrivage_carte_sans_id : chaque carte doit porter son id'
      using errcode = 'invalid_parameter_value';
  end if;

  -- **Le cœur de l'idempotence.** La ligne ne s'écrit qu'une fois par `(user_id, cle)` ;
  -- `returning` ne rend une ligne que si l'insertion a eu lieu. Une clé déjà vue retombe
  -- sur les cartes d'origine, et le crédit ci-dessous est sauté.
  insert into public.pack_openings (user_id, cle, seed, cards)
  values (v_uid, v_cle, p_seed, p_cartes)
  on conflict on constraint pack_openings_cle_unique do nothing
  returning cards into v_cartes;

  if v_cartes is null then
    select cards into v_cartes
      from public.pack_openings
     where user_id = v_uid and cle = v_cle;
    return v_cartes;
  end if;

  -- Le crédit de la Collection, **dans la même transaction** que la ligne d'ouverture : la
  -- même clé ne peut pas laisser une ouverture sans ses cartes. Les doublons éventuels d'un
  -- tirage sont comptés par carte avant d'entrer.
  insert into public.collection (compte_id, carte_id, quantite)
  select v_uid, carte ->> 'id', count(*)::integer
    from jsonb_array_elements(v_cartes) as carte
   group by carte ->> 'id'
  on conflict (compte_id, carte_id)
  do update set quantite = public.collection.quantite + excluded.quantite;

  return v_cartes;
end;
$$;

comment on function public.crediter_arrivage(text, jsonb, bigint) is
  'Crédite une ouverture d''Arrivage une seule fois par clé (#651, D-179) : la ligne et la Collection dans la même transaction.';

-- **Personne côté client.** `PUBLIC` exécute toute fonction nouvelle par défaut : on le
-- retire, et `authenticated` ne l'obtient pas — sans quoi un navigateur pourrait se
-- créditer les cartes qu'il invente. C'est l'Edge Function, par la connexion directe à la
-- base, qui l'appelle. Un client externe qui tenterait `rpc('crediter_arrivage', …)`
-- reçoit un refus de privilège.
revoke execute on function public.crediter_arrivage(text, jsonb, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Droits et RLS : on lit ses ouvertures, on n'écrit rien
-- ---------------------------------------------------------------------------------------------

-- Sans cette révocation, les privilèges par défaut de Supabase ouvriraient la table en
-- entier (même raison que 0005, 0019 et 0020).
revoke all on public.pack_openings from anon;
revoke all on public.pack_openings from authenticated;

-- La lecture seule côté client : l'écran peut rappeler ses ouvertures, jamais les changer.
grant select on public.pack_openings to authenticated;

-- `enable` sans `force` : le propriétaire (la fonction `security definer`) doit pouvoir
-- écrire ; `force` l'obligerait à une politique pour lui-même. `authenticated`, lui, est
-- soumis à la politique de lecture.
alter table public.pack_openings enable row level security;

drop policy if exists "pack_openings : chacun lit les siennes" on public.pack_openings;
create policy "pack_openings : chacun lit les siennes"
  on public.pack_openings for select to authenticated
  using (user_id = auth.uid());

commit;
