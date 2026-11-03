-- Le Deck se rejoue depuis un journal d'intentions — #491, D-153 (3), D-179 (4).
--
-- D-179 (4) : « Le Deck garde son journal (D-153) : local d'abord, rejeu par RPC, et `0021`
-- refuse un Deck illégal au commit. » Le client écrit chaque geste du Deck dans une file
-- persistée (`deckOutbox`, store v17) et la fait partir quand le réseau est là. Cette
-- migration pose le bout serveur, et rien de plus :
--
--   1. `public.deck_rejeux` : **un lot rejoué par compte et par clé** — la clé d'idempotence
--      du client, les opérations reçues et la date du serveur. C'est le reçu qui empêche un
--      retry (réponse perdue, rechargement) de doubler le Deck.
--   2. `public.rejouer_deck(p_operations jsonb, p_cle text)` : rejoue les opérations **dans
--      l'ordre**, une seule fois par clé, **dans une transaction**. Elle ne juge pas la
--      légalité du Deck : elle laisse la garde différée `0021` (`deck_gardes`) refuser au
--      commit. Sur refus, toute la transaction est annulée — le reçu **et** les écritures —,
--      donc la clé reste libre et la file du client reste rejouable.
--   3. Les droits : `authenticated` **exécute** la fonction (c'est le client qui l'appelle),
--      et **personne côté client** n'écrit dans `deck_rejeux` : le reçu vient de la fonction.
--
-- **Ce que la base ne tient pas** : les règles du Deck (taille, exemplaires par nom,
-- Entrant) restent au moteur (`src/game/deck.ts`) et à la garde `0021` ; le catalogue reste
-- au client (`0020`), la base ne sait pas qu'un `carte_id` existe. Cette migration ne
-- recopie aucune règle de jeu.
--
-- **Les opérations**, dans le vocabulaire du client (`src/lib/deck.ts`) :
--
--   - `{ "type": "ajouter", "carte": …, "nom": …, "stade": … }` : un exemplaire de plus,
--     posé au rang suivant s'il n'y était pas déjà ;
--   - `{ "type": "retirer", "carte": … }` : un exemplaire de moins, la ligne part à zéro ;
--   - `{ "type": "remplacer", "cartes": [{ "carte", "nom", "stade" }, …] }` : le Deck entier,
--     dans l'ordre reçu (les doublons d'une même carte deviennent sa quantité, son premier
--     rang son rang).
--
-- **Ce que le lot ne porte pas : les types de café choisis**. `0020` ne leur donne pas de
-- colonne, et cette tranche (#491) ne synchronise que la composition et l'ordre du Deck. Le
-- choix reste local ; le jour où le serveur le porte, ce sera une table ou une colonne, pas
-- une règle glissée dans ce fichier.
--
-- **Le contrôle mord** : `supabase/deck-rejeu.test.ts` (PGlite) — la même clé deux fois ne
-- double rien, les opérations se rejouent dans l'ordre, un Deck illégal est refusé **et ne
-- laisse ni écriture ni reçu**, le client n'écrit pas le reçu, et la contrainte d'unicité
-- retirée laisse passer le double rejeu.
--
-- **Idempotente** : rejouable sans erreur (`if not exists`, `create or replace`,
-- `drop constraint if exists` puis `add constraint`).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Le reçu d'un lot : un compte, une clé, les opérations reçues
-- ---------------------------------------------------------------------------------------------

create table if not exists public.deck_rejeux (
  -- Le reçu lui-même. Un entier qui monte : la table est un journal, pas un annuaire.
  id         bigint      generated always as identity primary key,

  -- Le compte qui a envoyé le lot. La ligne s'en va avec le compte (`auth.users`), comme le
  -- Deck et la Collection (0020).
  compte_id  uuid        not null references auth.users (id) on delete cascade,

  -- La clé d'idempotence du lot, fournie par le client. La même clé rejouée n'applique
  -- rien : la fonction rend le Deck courant et s'arrête.
  cle        text        not null
                         check (char_length(btrim(cle)) between 1 and 200),

  -- Le lot tel qu'il est arrivé, pour la trace. La base ne l'interprète pas ici.
  operations jsonb       not null
                         check (jsonb_typeof(operations) = 'array'),

  created_at timestamptz not null default now(),

  -- **La clé de l'idempotence** : un compte ne rejoue pas deux fois le même lot.
  constraint deck_rejeux_cle_unique unique (compte_id, cle)
);

comment on table public.deck_rejeux is
  'Les lots de Deck rejoués (#491, D-153 (3)) : un reçu par compte et par clé d''idempotence.';
comment on column public.deck_rejeux.cle is
  'Clé d''idempotence du lot : la même clé rejouée n''applique rien et rend le Deck courant.';
comment on column public.deck_rejeux.operations is
  'Le lot reçu (tableau d''opérations ajouter/retirer/remplacer), gardé pour la trace.';

-- ---------------------------------------------------------------------------------------------
-- 2. Le rejeu : une transaction, une clé, un ordre
-- ---------------------------------------------------------------------------------------------

-- `security definer` : la fonction écrit le Deck et le reçu sans repasser par la RLS du
-- client. Elle ne vise que `auth.uid()` — le compte vient du JWT de la session, jamais d'un
-- argument. Le reçu s'écrit **avant** les opérations, dans la même transaction : si la garde
-- `0021` refuse le Deck final au commit, le reçu part avec les écritures, et la clé reste
-- libre pour une nouvelle tentative.
create or replace function public.rejouer_deck(p_operations jsonb, p_cle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_cle    text := btrim(p_cle);
  v_recu   bigint;
  v_op     jsonb;
  v_genre  text;
  v_carte  text;
  v_nom    text;
  v_stade  text;
  v_cartes jsonb;
  v_deck   jsonb;
begin
  if v_uid is null then
    raise exception 'deck_sans_compte : il faut un compte pour synchroniser un Deck'
      using errcode = 'insufficient_privilege';
  end if;

  if v_cle is null or v_cle = '' then
    raise exception 'deck_sans_cle : un lot de Deck doit porter sa clé d''idempotence'
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_typeof(p_operations) is distinct from 'array' then
    raise exception 'deck_sans_operations : les opérations doivent être un tableau'
      using errcode = 'invalid_parameter_value';
  end if;

  -- **Le cœur de l'idempotence.** Le reçu ne s'écrit qu'une fois par `(compte, clé)` ;
  -- `returning` ne rend une ligne que si l'insertion a eu lieu. Une clé déjà vue rend le
  -- Deck courant, sans rejouer une seule opération.
  insert into public.deck_rejeux (compte_id, cle, operations)
  values (v_uid, v_cle, p_operations)
  on conflict on constraint deck_rejeux_cle_unique do nothing
  returning id into v_recu;

  if v_recu is null then
    select coalesce(
             jsonb_agg(
               jsonb_build_object('carte', carte_id, 'quantite', quantite, 'rang', rang)
               order by rang
             ),
             '[]'::jsonb
           )
      into v_deck
      from public.deck
     where compte_id = v_uid;
    return v_deck;
  end if;

  -- Les opérations, **dans l'ordre du tableau**. Chacune est vérifiée dans sa forme : la
  -- base ne connaît pas le catalogue, mais elle refuse une opération qu'elle ne comprend pas
  -- plutôt que de l'ignorer en silence.
  for v_op in select * from jsonb_array_elements(p_operations) loop
    if jsonb_typeof(v_op) is distinct from 'object' then
      raise exception 'deck_operation_invalide : une opération doit être un objet'
        using errcode = 'invalid_parameter_value';
    end if;
    v_genre := v_op ->> 'type';

    if v_genre = 'ajouter' then
      v_carte := btrim(coalesce(v_op ->> 'carte', ''));
      v_nom   := btrim(coalesce(v_op ->> 'nom', ''));
      v_stade := nullif(btrim(coalesce(v_op ->> 'stade', '')), '');
      if v_carte = '' or v_nom = '' then
        raise exception 'deck_operation_invalide : « ajouter » exige une carte et son nom'
          using errcode = 'invalid_parameter_value';
      end if;

      -- Le rang suivant s'il n'y est pas déjà ; sinon la quantité monte et le rang (donc la
      -- place de la première occurrence) ne bouge pas.
      insert into public.deck (compte_id, carte_id, quantite, rang, nom, stade)
      values (
        v_uid,
        v_carte,
        1,
        coalesce((select max(d.rang) + 1 from public.deck d where d.compte_id = v_uid), 0),
        v_nom,
        v_stade
      )
      on conflict (compte_id, carte_id) do update
        set quantite = public.deck.quantite + 1,
            nom = excluded.nom,
            stade = excluded.stade;

    elsif v_genre = 'retirer' then
      v_carte := btrim(coalesce(v_op ->> 'carte', ''));
      if v_carte = '' then
        raise exception 'deck_operation_invalide : « retirer » exige une carte'
          using errcode = 'invalid_parameter_value';
      end if;

      update public.deck
         set quantite = quantite - 1
       where compte_id = v_uid and carte_id = v_carte and quantite > 1;
      delete from public.deck
       where compte_id = v_uid and carte_id = v_carte and quantite <= 1;

    elsif v_genre = 'remplacer' then
      v_cartes := v_op -> 'cartes';
      if jsonb_typeof(v_cartes) is distinct from 'array' then
        raise exception 'deck_operation_invalide : « remplacer » exige un tableau de cartes'
          using errcode = 'invalid_parameter_value';
      end if;
      if exists (
        select 1
          from jsonb_array_elements(v_cartes) as carte
         where jsonb_typeof(carte) is distinct from 'object'
            or coalesce(btrim(carte ->> 'carte'), '') = ''
      ) then
        raise exception 'deck_operation_invalide : chaque carte doit porter son identifiant'
          using errcode = 'invalid_parameter_value';
      end if;

      -- Le Deck entier : on efface, puis on réinsère dans l'ordre reçu. Les doublons d'une
      -- même carte deviennent sa quantité ; son rang est celui de sa **première** occurrence
      -- (le modèle de `0020` ne sait pas ranger deux exemplaires à deux places différentes).
      delete from public.deck where compte_id = v_uid;
      insert into public.deck (compte_id, carte_id, quantite, rang, nom, stade)
      select v_uid,
             carte ->> 'carte',
             count(*)::integer,
             (min(ordre) - 1)::smallint,
             (array_agg(btrim(coalesce(carte ->> 'nom', '')) order by ordre))[1],
             nullif((array_agg(nullif(btrim(coalesce(carte ->> 'stade', '')), '') order by ordre))[1], '')
        from jsonb_array_elements(v_cartes) with ordinality as c(carte, ordre)
       group by carte ->> 'carte'
       order by min(ordre);

    else
      raise exception 'deck_operation_inconnue : « % » n''est pas une opération connue', coalesce(v_genre, '')
        using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  -- Le Deck tel qu'il est après le lot : le client ne s'en sert pas pour décider, il sert à
  -- rendre le rejeu d'une clé déjà vue identique à la première réponse.
  select coalesce(
           jsonb_agg(
             jsonb_build_object('carte', carte_id, 'quantite', quantite, 'rang', rang)
             order by rang
           ),
           '[]'::jsonb
         )
    into v_deck
    from public.deck
   where compte_id = v_uid;
  return v_deck;
end;
$$;

comment on function public.rejouer_deck(jsonb, text) is
  'Rejoue un lot d''intentions de Deck, une seule fois par clé, dans l''ordre (#491) ; la garde 0021 juge le Deck final au commit.';

-- ---------------------------------------------------------------------------------------------
-- 3. Droits : le client exécute la fonction, personne n'écrit le reçu
-- ---------------------------------------------------------------------------------------------

-- Sans cette révocation, les privilèges par défaut de Supabase ouvriraient la table en
-- entier (même raison que 0005, 0020 et 0024).
revoke all on public.deck_rejeux from anon;
revoke all on public.deck_rejeux from authenticated;

-- `PUBLIC` exécute toute fonction nouvelle par défaut : on le retire, et `anon` n'a rien.
-- `authenticated`, lui, **exécute** : c'est le client qui envoie son lot par `rpc(
-- 'rejouer_deck', …)`. La fonction ne vise que `auth.uid()`, et `0021` juge le Deck final.
revoke execute on function public.rejouer_deck(jsonb, text) from public, anon;
grant execute on function public.rejouer_deck(jsonb, text) to authenticated;

-- `enable` sans `force` : le propriétaire (la fonction `security definer`) doit pouvoir
-- écrire le reçu ; `force` l'obligerait à une politique pour lui-même. `authenticated` n'a
-- aucun droit sur la table.
alter table public.deck_rejeux enable row level security;

commit;
