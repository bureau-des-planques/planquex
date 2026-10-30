-- Un Deck en base reste légal — #490, D-153.
--
-- La 0020 a posé `public.deck` (une ligne par carte, avec sa quantité et son rang) en
-- laissant les règles de jeu au moteur : `src/game/deck.ts` (`DECK_SIZE`,
-- `MAX_COPIES_PER_NAME`, `deckLegal`) et `docs/JEU.md` §4. Le client peut être contourné,
-- et une règle de jeu se garde là où la donnée se stocke : cette migration fait refuser
-- par la base un Deck **illégal**.
--
-- Ce qu'elle pose, et rien de plus :
--
--   1. Deux colonnes sur `public.deck`, que le client remplit avec ce qu'il sait déjà de
--      la carte — la base, elle, ne connaît pas le catalogue (0020) :
--        - `nom`   : le nom de la carte (`getCard(id).name`). « Deux exemplaires du même
--                    nom » se compte par nom, pas par identifiant : une variante
--                    (`-star`, `-crown`…) partage le nom de sa base.
--        - `stade` : `ENTRANT`, `N+1` ou `N+2` (`Stage` de `src/data/types.ts`). C'est le
--                    seul moyen, pour la base, de reconnaître un Planqué Entrant.
--   2. Une **contrainte par déclencheur** (`deck_gardes`, différée au commit) : la règle
--      porte sur l'**ensemble** des lignes d'un Deck, pas sur une ligne, donc une
--      contrainte de table ne suffit pas. Elle refuse :
--        - plus de 20 cartes (`deck_taille`) ;
--        - plus de 2 exemplaires d'un même nom (`deck_exemplaires`) ;
--        - un Deck **complet** sans Planqué Entrant (`deck_entrant`).
--
-- **Pourquoi « complet » pour l'Entrant** : le Deck s'écrit carte par carte (une ligne à
-- la fois). Refuser toute ligne d'un Deck en cours de construction parce qu'il n'a pas
-- encore d'Entrant rendrait le Deck impossible à écrire. Tant qu'il n'a pas ses 20 cartes,
-- il n'est pas encore un Deck ; c'est à 20 qu'on juge l'Entrant. La taille, elle, est un
-- **plafond** : plus de 20 cartes est toujours refusé, et un Deck partiel est accepté.
--
-- **Une seule source pour les nombres** : la base ne peut pas importer du TypeScript. Les
-- trois constantes du déclencheur (`taille_max`, `max_par_nom`, `stade_entrant`) sont donc
-- écrites ici **et** comparées à `src/game/deck.ts` et `src/data/types.ts` par
-- `supabase/deck-legal.test.ts` : changer l'un sans l'autre fait échouer le test.
--
-- **Ce que la base ne peut pas vérifier** : que le `carte_id`, le `nom` et le `stade` sont
-- ceux du catalogue — elle ne le connaît pas (0020), et c'est le client qui les fournit.
-- La garde arrête un Deck illégal par accident ou par un client ancien, pas un client
-- hostile qui mentirait sur l'identité de ses cartes. C'est la même limite que celle de
-- 0020 sur `carte_id`.
--
-- **Le contrôle mord** : `supabase/deck-legal.test.ts` (PGlite) — 21 cartes, trois
-- exemplaires et un Deck complet sans Entrant sont refusés **pour la bonne raison** (le
-- message nommé est vérifié, pas seulement l'échec), un Deck légal passe, et la même
-- 0021 **neutralisée** laisse passer les cas fautifs.
--
-- **Idempotente** : rejouable sans erreur (`if not exists`, `create or replace`, `drop
-- trigger if exists`, `drop constraint if exists` puis `add constraint`).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Ce que la base a besoin de savoir de la carte, et que le client lui donne
-- ---------------------------------------------------------------------------------------------

alter table public.deck add column if not exists nom text;
alter table public.deck add column if not exists stade text;

-- Le nom est celui du catalogue (`getCard(id).name`), borné comme les autres textes du
-- dépôt. Nul tant que le client ne le fournit pas : un Deck complet sans nom ne peut pas
-- être compté par nom, et le déclencheur retombe alors sur `carte_id` (voir plus bas).
alter table public.deck drop constraint if exists deck_nom_check;
alter table public.deck add constraint deck_nom_check
  check (nom is null or char_length(btrim(nom)) between 1 and 80);

-- Le stade est le vocabulaire du moteur (`Stage` de `src/data/types.ts`). Nul tant que le
-- client ne le fournit pas : un Deck complet sans stade n'a pas d'Entrant, et sera refusé.
alter table public.deck drop constraint if exists deck_stade_check;
alter table public.deck add constraint deck_stade_check
  check (stade is null or stade in ('ENTRANT', 'N+1', 'N+2'));

comment on column public.deck.nom is
  'Le nom de la carte (getCard(id).name) : « 2 exemplaires du même nom » se compte par nom (#490).';
comment on column public.deck.stade is
  'Le stade de la carte (Stage) : ENTRANT, N+1 ou N+2. Sert à reconnaître un Planqué Entrant (#490).';

-- Le client fournit les deux colonnes ; `updated_at` reste hors de ses droits (0020).
grant insert (compte_id, carte_id, quantite, rang, nom, stade) on public.deck to authenticated;
grant update (quantite, rang, nom, stade) on public.deck to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Le déclencheur : ce que la base refuse, quel que soit le client
-- ---------------------------------------------------------------------------------------------

-- Une modification qui viole une règle lève une erreur **nommée** : le test la reconnaît, et
-- un écran pourra la lire. Une contrainte de table ne convient pas : la règle porte sur
-- l'ensemble des lignes du Deck, pas sur une ligne.
--
-- **Différée au commit** (`deferrable initially deferred`) : un Deck écrit d'un seul
-- `insert` de 20 lignes est jugé une fois, à la fin, quand toutes ses lignes sont là.
create or replace function public.deck_gardes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Les trois constantes de la règle (`docs/JEU.md` §4), lues par
  -- `supabase/deck-legal.test.ts` : elles doivent dire la même chose que `src/game/deck.ts`
  -- et `src/data/types.ts`. Ne pas en changer une sans l'autre.
  taille_max    constant integer := 20;   -- DECK_SIZE (src/game/deck.ts)
  max_par_nom   constant integer := 2;    -- MAX_COPIES_PER_NAME (src/game/deck.ts)
  stade_entrant constant text    := 'ENTRANT';  -- Stage, le Planqué Entrant
  compte        uuid;
  total         integer;
  pire          integer;
  entrant       boolean;
begin
  -- Le compte touché : celui de la ligne insérée, modifiée ou retirée.
  compte := case when tg_op = 'DELETE' then old.compte_id else new.compte_id end;

  select coalesce(sum(quantite), 0)
    into total
    from public.deck
   where compte_id = compte;

  if total > taille_max then
    raise exception 'deck_taille : un Deck compte au plus % cartes (ici %).', taille_max, total
      using errcode = 'check_violation', constraint = 'deck_taille';
  end if;

  -- « Maximum 2 exemplaires du même nom » : le nom vient du client, la base ne connaît pas
  -- le catalogue. À défaut de nom, l'identifiant sert de clé — une variante sans nom serait
  -- alors comptée à part, ce que le client (#491) ne fait pas.
  select coalesce(max(exemplaires), 0)
    into pire
    from (
      select sum(quantite) as exemplaires
        from public.deck
       where compte_id = compte
       group by coalesce(nom, carte_id)
    ) as par_nom;

  if pire > max_par_nom then
    raise exception 'deck_exemplaires : % exemplaires au plus du même nom (ici %).', max_par_nom, pire
      using errcode = 'check_violation', constraint = 'deck_exemplaires';
  end if;

  -- Un Deck complet doit porter au moins un Planqué Entrant ; un Deck en construction n'est
  -- pas encore jugé (voir l'en-tête).
  if total = taille_max then
    select exists (
      select 1 from public.deck where compte_id = compte and stade = stade_entrant
    ) into entrant;

    if not entrant then
      raise exception 'deck_entrant : il faut au moins un Planqué Entrant.'
        using errcode = 'check_violation', constraint = 'deck_entrant';
    end if;
  end if;

  return null;
end;
$$;

comment on function public.deck_gardes() is
  'Refuse un Deck illégal : plus de 20 cartes, plus de 2 exemplaires du même nom, un Deck complet sans Planqué Entrant (#490).';

-- Une fonction de déclencheur n'a pas à être appelable : PostgreSQL l'accorde à PUBLIC par
-- défaut, et `fonctions.test.ts` (#341, D-133) dénoncerait `anon` ou `authenticated` qui
-- l'exécute. Le déclencheur, lui, ne vérifie pas l'EXECUTE de son appelant : la garde tient
-- sans ce droit.
revoke execute on function public.deck_gardes() from public, anon, authenticated;

drop trigger if exists deck_gardes on public.deck;
create constraint trigger deck_gardes
  after insert or update or delete on public.deck
  deferrable initially deferred
  for each row execute function public.deck_gardes();

commit;
