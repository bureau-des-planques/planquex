-- L'Arrivage serveur n'est ouvert qu'à un compte approuvé — #789, D-199 (4), D-179 (2).
--
-- D-199 : un compte **en attente d'approbation** fait la Journée et le combat solo, mais
-- **n'ouvre pas d'Arrivage serveur**. « Le serveur fait foi (D-088) : `ouvrir-arrivage` doit
-- refuser un compte non approuvé, le bouton ne suffit pas. »
--
-- **Ce que cette migration pose, et rien de plus** : `public.crediter_arrivage` (0024) est
-- redéfinie à l'identique, plus **une garde** — `public.compte_approuve()` (0005), la même
-- condition que l'écriture du mur. Un compte `en attente` ou `refuse` reçoit une erreur
-- `insufficient_privilege` (`arrivage_compte_non_approuve`) ; l'Edge Function la rend en 403, et
-- le client, qui traite déjà 401/403 comme « refus », affiche « disponible après approbation ».
-- La garde est **dans la fonction** et non dans l'Edge Function seule : c'est la fonction que
-- la Collection ne peut pas contourner, et c'est elle que `pack-openings.test.ts` rejoue.
--
-- Les droits ne changent pas : la fonction reste fermée à `PUBLIC`, `anon` et `authenticated`
-- (0024) ; `create or replace` garde les droits existants, le `revoke` est redit par prudence.
-- La migration se rejoue sans effet de bord.

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

  -- **Le serveur fait foi** (D-199 (4), D-088) : un compte `en attente` ou `refuse` n'ouvre pas
  -- d'Arrivage, quoi que dise le bouton. `compte_approuve()` lit `auth.uid()` et laisse passer
  -- un administrateur. Le test vient **avant** l'idempotence : une ouverture déjà créditée ne
  -- se rejoue pas non plus pour un compte qui n'est plus approuvé.
  if not public.compte_approuve() then
    raise exception 'arrivage_compte_non_approuve : l''Arrivage s''ouvre après l''approbation du compte'
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

revoke execute on function public.crediter_arrivage(text, jsonb, bigint) from public, anon, authenticated;
