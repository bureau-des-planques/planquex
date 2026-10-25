-- Le tri du mur par l'administration, et les corrections de l'auteur — D-088 (#138, #139).
--
-- Deux manques que D-088 laisse ouverts, et que cette migration ferme.
--
--   1. **Le tri n'a plus personne pour l'écrire.** `postits` n'avait qu'une politique
--      d'écriture, « chacun déplace les siens » (0001, renforcée par l'approbation en
--      0005) : quand la base est la source du mur, le tri de D-059 — statut, raison d'un
--      écarté, ticket — n'appartient à personne. Le SQL Editor n'est pas un tri : il ne dit
--      pas qui a décidé, et il demande un accès que Bastien est seul à avoir. Cette
--      migration donne donc à un **administrateur** (`public.est_administrateur()`, 0005)
--      le droit de modifier **n'importe quel** post-it, sur **trois colonnes** — `statut`,
--      `raison`, `ticket` — et trois seulement.
--
--   2. **#139 : l'auteur d'un post-it `en attente` se relit et se corrige.** Après, non :
--      « sinon le mur ne dit plus la même chose à tout le monde ». Cela suppose deux choses
--      que la 0001 ne distinguait pas : l'auteur et l'administrateur écrivent tous deux
--      `postits`, mais **pas les mêmes colonnes**.
--
-- **Pourquoi une fonction pour la correction du texte.** Un `grant` de colonnes ne sait pas
-- distinguer deux personnes : il porte sur le rôle `authenticated`, qui est aussi bien
-- l'auteur que l'administrateur. Si l'auteur gardait `update (titre, texte)`, un
-- administrateur l'aurait aussi et pourrait réécrire le texte de n'importe qui — ce que
-- #139 refuse. Le grant ne donne donc à `authenticated` que les trois colonnes du tri ; la
-- correction du titre et du texte passe par `public.corriger_postit(...)`, qui vérifie
-- elle-même **qui** appelle, **sur quel post-it** et **dans quel statut**.
--
-- **Ce que la base refuse, dans l'ordre où elle le refuse** :
--   - `permission denied` : une colonne hors du grant (`titre`, `texte`, `auteur`, …) ;
--   - 0 ligne, sans erreur : une ligne qu'aucune politique d'`update` ne laisse passer —
--     c'est le cas d'un auteur qui tenterait d'écrire `statut` (le piège de RLS, documenté
--     dans `mur.test.ts`) ;
--   - une exception nommée : `postit_corrige_refuse` (pas le tien, compte non approuvé),
--     `postit_corrige_trop_tard` (le statut a bougé), `postit_corrige_inconnu`.
--
-- **Le retrait (#139)** est une **suppression**, pas un statut : §3 de
-- `docs/BOITE-A-IDEES.md` le dit déjà — « un post-it retiré par son auteur disparaît du
-- fichier : il n'existe pas de statut retiré ». Il ne se retire donc que par son auteur, et
-- seulement **tant que le post-it est `en attente`** : après, il porte un tri (une raison,
-- un ticket) que le geste emporterait.
--
-- **Ce qui ne change pas** : la lecture (`using (true)`), l'insertion (l'auteur, approuvé),
-- les pouces, les commentaires. Le commentaire d'un autre ne se retire pas — c'était déjà
-- vrai en 0001/0005, et #138 s'en sert tel quel.
--
-- **Le contrôle mord** : `supabase/mur-ecriture.test.ts` — un compte en attente ne
-- commente pas, un compte approuvé commente, on ne retire pas le commentaire d'un autre, un
-- administrateur trie n'importe quel post-it et **ne peut pas** réécrire son texte, un
-- non-administrateur est refusé — et chaque contrôle est neutralisé tour à tour pour exiger
-- que la base laisse alors passer le fautif.
--
-- **Idempotente** : rejouable sans erreur (`create or replace`, `drop policy if exists`,
-- `grant` / `revoke`). Elle suppose la **0005** : elle appelle `est_administrateur()` et
-- `compte_approuve()`.

begin;

-- ---------------------------------------------------------------------------------------------
-- Droits : trois colonnes pour le tri, et rien d'autre
-- ---------------------------------------------------------------------------------------------

-- Le `revoke` d'abord : la 0001 a donné `update` sur **toute** la table, et un grant de
-- colonnes s'ajoute à un grant de table — il ne le réduit pas.
revoke update on public.postits from authenticated;
grant update (statut, raison, ticket) on public.postits to authenticated;

-- `titre` et `texte` ne sont **pas** dans ce grant : c'est ce qui fait qu'un administrateur
-- ne peut pas réécrire le texte d'un autre (essayé dans `mur-ecriture.test.ts`). L'auteur,
-- lui, passe par la fonction plus bas.

-- ---------------------------------------------------------------------------------------------
-- RLS : l'administration trie n'importe quel post-it
-- ---------------------------------------------------------------------------------------------

-- La politique de l'auteur (0001, « chacun déplace les siens ») est **retirée** : il n'a plus
-- de chemin d'`update` direct, et c'est voulu. Sa correction passe par `corriger_postit`.
drop policy if exists "postits : chacun deplace les siens" on public.postits;

drop policy if exists "postits : l'administration trie" on public.postits;
create policy "postits : l'administration trie"
  on public.postits for update to authenticated
  using (public.est_administrateur())
  with check (public.est_administrateur());

-- ---------------------------------------------------------------------------------------------
-- Le retrait par l'auteur : seulement tant que le post-it n'a pas bougé de statut
-- ---------------------------------------------------------------------------------------------

drop policy if exists "postits : chacun retire les siens" on public.postits;
create policy "postits : chacun retire les siens"
  on public.postits for delete to authenticated
  using (auteur = auth.uid() and public.compte_approuve() and statut = 'en attente');

-- ---------------------------------------------------------------------------------------------
-- La correction du titre et du texte, par son auteur, tant que le post-it est `en attente`
-- ---------------------------------------------------------------------------------------------

-- `security definer` : la fonction lit et écrit `postits` sans repasser par la RLS (elle
-- n'a plus de politique d'`update` pour l'auteur), et c'est **elle** qui tient la règle.
-- `search_path` vide : un appelant ne peut pas lui faire résoudre `postits` vers sa propre
-- table (le piège classique d'une fonction `security definer`).
create or replace function public.corriger_postit(p_id text, p_titre text, p_texte text)
returns public.postits
language plpgsql
security definer
set search_path = ''
as $$
declare
  corrige public.postits;
begin
  -- Le compte d'abord : sans approbation, rien ne s'écrit (D-088).
  if not public.compte_approuve() then
    raise exception 'postit_corrige_refuse : ton compte n’est pas encore approuvé (D-088)'
      using errcode = 'insufficient_privilege';
  end if;

  select * into corrige from public.postits where id = p_id;
  if not found then
    raise exception 'postit_corrige_inconnu : ce post-it n’existe plus'
      using errcode = 'no_data_found';
  end if;

  -- « Je ne peux ni modifier ni effacer le post-it d'un autre » (#139).
  if corrige.auteur is distinct from auth.uid() then
    raise exception 'postit_corrige_refuse : ce post-it n’est pas le tien'
      using errcode = 'insufficient_privilege';
  end if;

  -- « Dès qu'un statut a bougé, la modification est refusée » (#139) — et la raison est
  -- nommée, parce qu'un refus muet ne dit pas quoi faire.
  if corrige.statut <> 'en attente' then
    raise exception 'postit_corrige_trop_tard : le post-it a bougé de statut (« % ») — il ne se corrige plus, le mur doit dire la même chose à tout le monde', corrige.statut
      using errcode = 'insufficient_privilege';
  end if;

  if char_length(btrim(coalesce(p_titre, ''))) = 0
     or char_length(btrim(coalesce(p_texte, ''))) = 0 then
    raise exception 'postit_corrige_vide : le titre et le texte ne peuvent pas être vides'
      using errcode = 'check_violation';
  end if;

  update public.postits
     set titre = btrim(p_titre),
         texte = p_texte
   where id = p_id
  returning * into corrige;

  return corrige;
end;
$$;

comment on function public.corriger_postit(text, text, text) is
  'Corrige le titre et le texte d''un post-it, par son auteur, tant qu''il est « en attente » (#139).';

revoke execute on function public.corriger_postit(text, text, text) from public;
grant execute on function public.corriger_postit(text, text, text) to authenticated;

commit;
