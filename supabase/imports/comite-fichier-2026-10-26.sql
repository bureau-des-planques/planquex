-- Les deux post-its du fichier du mur entrent en base — #136, D-058, D-097 (6).
--
-- `docs/comite.json` est la **trace de ce qui a été collecté avant** le mur en base. Le
-- critère de #136 le dit : les post-its déjà présents dans le fichier du mur sont dans la
-- base, avec leurs statuts et leurs pseudos. Le fichier reste au dépôt comme
-- contrat de données, mais il cesse d'être la source : la page lit `postits_avec_votes`
-- (`src/lib/murBase.ts`) et ne retombe sur le fichier que si la base ne répond pas.
--
-- **Ce n'est pas une migration** : aucune forme de schéma ne change, et le registre
-- `admin.migrations` n'a rien à en dire. C'est un **import de données**, rejouable, rangé
-- ici pour être relu avant d'être exécuté (règle de `planquex-infra/AGENTS.md` §4).
--
-- **L'auteur** : ces deux post-its ont été écrits par des identités **anonymes** d'avant
-- D-088, qui n'ont pas de compte — il n'existe donc personne à qui les attribuer, et
-- inventer un compte serait mentir sur qui a écrit. Ils portent l'**auteur sentinelle**
-- `00000000-0000-0000-0000-000000000000`, qu'aucun `auth.uid()` ne peut valoir : le mur ne
-- les montre comme « les tiens » à personne, donc **aucun testeur** ne les corrige, ne les
-- déplace ni ne les retire. L'**administration**, elle, garde ses droits de tri (0006) et de
-- retrait (0007) — c'est le tri normal de D-092, et ces deux post-its sont `en attente` :
-- ils doivent pouvoir avancer. Le geste pour les rattacher à un compte est explicite et
-- documenté (`supabase/README.md` §5.4).
--
-- **La date** : l'identifiant porte l'heure de collecte (`p-23-10-2026-01-36-03-…`), et
-- c'est elle qu'on garde dans `created_at` — heure locale de Paris (UTC+2 en octobre), qui
-- était le fuseau de la machine. Sans elle, les deux post-its arriveraient datés de
-- l'import et passeraient **après** tout ce qui sera écrit ensuite.
--
-- **`updated_at` suit `created_at`** : le déclencheur `postits_date_serveur` (0009) l'a posé
-- à l'heure de l'import, puisqu'un `insert` ne peut pas le fournir — c'est voulu, l'heure
-- du serveur reste la seule source. Mais le compteur du comité (#239) compare `updated_at`
-- à `created_at` : laissé à l'heure de l'import, il compterait **un faux mouvement de
-- statut** pour ces deux lignes, et le jour où on les rattache à un compte (§5.4 du README),
-- c'est son propriétaire qui verrait crier une pastille pour du passé. On les réaligne donc
-- après coup — un `update` qui ne touche ni `statut` ni `created_at`.
--
-- **L'écran vide du fichier devient `null`** : la colonne n'admet que les six écrans de
-- D-068, et `''` n'en est pas un. Le fichier dit « pas d'écran », pas « l'écran vide ».
--
-- **Idempotent** : `on conflict (id) do nothing`. Rejouer l'import ne crée rien et
-- **ne réécrit rien** — si un post-it a été trié depuis, le tri reste.

begin;

insert into public.postits (
  id, kind, titre, texte, ecran, pseudo, version, statut, raison, ticket,
  gueulage, lie, position_x, position_y, position_angle, auteur, created_at
) values
  (
    'p-23-10-2026-01-36-03-c-est-de-la-merde-ton-jeux',
    null, -- un gueulage n'a pas de famille (`postits_gueulage_sans_famille`, 0003)
    'c''est de la merde ton jeux',
    'Titre fabriqué avec les premiers mots du message : le formulaire n’en demandait pas.

c''est de la merde ton jeux
Bastien',
    null,
    'Moi',
    'je sais pas',
    'en attente',
    '',
    null,
    true,
    null,
    8, 6, 1,
    '00000000-0000-0000-0000-000000000000',
    timestamptz '2026-10-23 01:36:03+02'
  ),
  (
    'p-23-10-2026-01-37-45-papi',
    'OUF',
    'papi',
    'Ce que tu faisais : rien

Ce qui s’est passé : rien

Ce que tu attendais : du fun',
    null,
    'L''autre',
    '0.1.4',
    'en attente',
    '',
    null,
    false,
    null,
    50, 6, -2,
    '00000000-0000-0000-0000-000000000000',
    timestamptz '2026-10-23 01:37:45+02'
  )
on conflict (id) do nothing;

-- Le passé ne s'allume pas : la ligne date de sa collecte, pas de son import (voir plus haut).
-- `postits_dates_figees` (0010) laisse `created_at` intact, et `postits_updated_at` (0008) ne
-- vise que `statut` — qu'on ne touche pas ici.
update public.postits
   set updated_at = created_at
 where id in (
   'p-23-10-2026-01-36-03-c-est-de-la-merde-ton-jeux',
   'p-23-10-2026-01-37-45-papi'
 )
   and updated_at is distinct from created_at;

commit;
