-- Le Deck local monte dans le compte, une seule fois — #492, D-153 (1), D-179 (1).
--
-- Le Deck vit sur le compte (0020), et le navigateur en garde sa propre copie. Au **premier
-- login** d'un appareil, cette copie locale monte dans le compte — mais **une seule fois** :
-- un second appareil, ou un rechargement, ne doit jamais réimporter le Deck d'un autre poste
-- ni écraser celui du compte. Cette migration pose le marqueur qui rend ce geste unique, et
-- la RPC qui le fait dans **une transaction**.
--
--   1. `public.deck_imports` : **une ligne par compte**, écrite le jour où l'import a été
--      décidé. C'est le marqueur. Sa clé primaire est ce qui le rend atomique : deux appels
--      concurrents (deux onglets, deux appareils) ne peuvent pas l'écrire tous les deux.
--   2. `public.importer_deck(p_operations, p_cle)` : tente de poser le marqueur, puis
--      importe **seulement** si le compte n'a pas encore de Deck. Si le compte a déjà un
--      Deck, elle **n'écrase rien** : elle marque l'import comme fait et rend le Deck du
--      serveur, qui fait autorité (D-179 (1)). Si le marqueur existe déjà, elle ne fait rien
--      et rend le Deck courant.
--   3. L'import lui-même passe par `public.rejouer_deck` (0025) : mêmes opérations, même
--      ordre, même reçu. Le Deck final est jugé par la garde différée `0021` **au commit** :
--      un Deck illégal annule toute la transaction — le marqueur tombe avec l'import, la clé
--      reste libre, et le client peut réessayer.
--
-- **Ce que devient le Deck local quand le compte en a déjà un** : il est **remplacé par le
-- Deck du serveur**, que la RPC rend au client. C'est le choix de D-179 (1) — le serveur fait
-- autorité sur ce qui se partage, dont la validité du Deck. Le conserver « quelque part »
-- demanderait une seconde source, une politique de fusion et un écran pour trancher : c'est
-- exactement la fusion que D-179 (3) a retirée. L'import n'a lieu qu'au **premier** login de
-- l'appareil ; ensuite, c'est le journal d'intentions (`0025`) qui porte les gestes.
--
-- **Ce que la base ne tient pas** : les règles de jeu du Deck (taille, exemplaires par nom,
-- Entrant) restent au moteur (`src/game/deck.ts`) et à la garde `0021` ; le catalogue reste
-- au client (`0020`). Cette migration ne recopie aucune règle.
--
-- **Le contrôle mord** : `supabase/import-deck.test.ts` (PGlite) — un compte vide reçoit le
-- Deck local une fois, un compte qui a déjà un Deck n'est pas écrasé, un Deck illégal annule
-- le marqueur avec l'import, et **le marqueur retiré laisse passer un second import**.
--
-- **Idempotente** : rejouable sans erreur (`if not exists`, `create or replace`,
-- `revoke`/`grant` répétables).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Le marqueur : un compte, une fois
-- ---------------------------------------------------------------------------------------------

create table if not exists public.deck_imports (
  -- Le compte. La clé primaire **est** le marqueur : une seule ligne par compte, et c'est
  -- elle qui rend deux imports concurrents impossibles. La ligne s'en va avec le compte,
  -- comme le Deck, la Collection et les reçus de rejeu.
  compte_id  uuid        primary key references auth.users (id) on delete cascade,

  -- La date serveur de la décision d'import. Elle ne sert qu'à la trace : le client ne la
  -- lit pas, et la règle ne dépend que de la présence de la ligne.
  imported_at timestamptz not null default now()
);

comment on table public.deck_imports is
  'Le marqueur d''import du Deck local (#492, D-153 (1)) : une ligne par compte, posée une seule fois.';
comment on column public.deck_imports.compte_id is
  'La clé primaire est le marqueur : un compte ne peut pas en avoir deux, donc importer deux fois.';

-- ---------------------------------------------------------------------------------------------
-- 2. La RPC : marquer, puis importer si le compte est vide
-- ---------------------------------------------------------------------------------------------

-- `security definer` : la fonction lit et écrit `deck_imports` et `deck` sans repasser par la
-- RLS du client. Elle ne vise que `auth.uid()` — le compte vient du JWT de la session, jamais
-- d'un argument. Tout se joue dans la transaction de l'appel : si `rejouer_deck` lève (Deck
-- illégal), le marqueur et les écritures partent ensemble.
create or replace function public.importer_deck(p_operations jsonb, p_cle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_cle     text := btrim(p_cle);
  v_marque  uuid;
  v_importe boolean := false;
  v_deck    jsonb;
begin
  if v_uid is null then
    raise exception 'import_deck_sans_compte : il faut un compte pour importer un Deck'
      using errcode = 'insufficient_privilege';
  end if;

  if v_cle is null or v_cle = '' then
    raise exception 'import_deck_sans_cle : l''import d''un Deck doit porter sa clé d''idempotence'
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_typeof(p_operations) is distinct from 'array' then
    raise exception 'import_deck_sans_operations : les opérations doivent être un tableau'
      using errcode = 'invalid_parameter_value';
  end if;

  -- **Le marqueur d'abord.** `returning` ne rend une ligne que si l'insertion a eu lieu :
  -- le premier appel d'un compte repart avec `v_marque`, tous les suivants avec `null`.
  -- C'est ce qui rend l'import unique, même entre deux appareils et deux onglets.
  insert into public.deck_imports (compte_id)
  values (v_uid)
  on conflict (compte_id) do nothing
  returning compte_id into v_marque;

  if v_marque is not null then
    -- **Le compte a-t-il déjà un Deck ?** Alors on **n'écrase pas** : D-179 (1) donne au
    -- serveur l'autorité sur ce qui se partage. L'import est marqué comme fait, et le Deck
    -- du serveur est rendu au client, qui l'adopte.
    if exists (select 1 from public.deck where compte_id = v_uid) then
      v_importe := false;
    else
      -- Le compte est vide : le Deck local monte, par les intentions de `rejouer_deck`.
      -- Mêmes opérations, même ordre, même reçu ; `0021` juge le Deck final au commit.
      perform public.rejouer_deck(p_operations, v_cle);
      v_importe := true;
    end if;
  end if;

  -- Le Deck du compte après l'appel, dans l'ordre des rangs : le client le compare à sa
  -- copie locale, et l'adopte quand le serveur avait déjà un Deck. La fonction ne lève pas
  -- si le Deck est vide — un compte neuf rend `[]`.
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

  return jsonb_build_object('importe', v_importe, 'deck', v_deck);
end;
$$;

comment on function public.importer_deck(jsonb, text) is
  'Importe le Deck local d''un compte une seule fois, sans écraser un Deck existant (#492) ; la garde 0021 juge le Deck au commit.';

-- ---------------------------------------------------------------------------------------------
-- 3. Droits : le client exécute la fonction, personne n'écrit le marqueur
-- ---------------------------------------------------------------------------------------------

-- Sans cette révocation, les privilèges par défaut de Supabase ouvriraient la table en
-- entier (même raison que 0005, 0020, 0024 et 0025).
revoke all on public.deck_imports from anon;
revoke all on public.deck_imports from authenticated;

-- `PUBLIC` exécute toute fonction nouvelle par défaut : on le retire, et `anon` n'a rien.
-- `authenticated`, lui, **exécute** : c'est le client qui appelle `rpc('importer_deck', …)`.
-- La fonction ne vise que `auth.uid()`.
revoke execute on function public.importer_deck(jsonb, text) from public, anon;
grant execute on function public.importer_deck(jsonb, text) to authenticated;

-- `enable` sans `force` : le propriétaire (la fonction `security definer`) doit pouvoir
-- écrire le marqueur ; `authenticated` n'a aucun droit sur la table.
alter table public.deck_imports enable row level security;

commit;
