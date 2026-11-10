-- L'icône de profil et le fait « Journée faite », sur le compte — #781, D-197 (2) et (3).
--
-- D-197 ajoute deux choses au profil du testeur (`public.profils`, 0019) :
--
--   1. une **icône de profil** (`icone`), choisie dans un lot d'icônes **à dessiner** ;
--   2. le fait **« Journée faite »** (`journee_faite_le`), porté par le **compte** et non plus
--      seulement par l'appareil (`tutorielVu`) : un testeur qui change d'appareil ne rejoue pas
--      la Journée.
--
-- **Ce que cette migration pose, et rien de plus** :
--
--   - `profils.icone` : `text`, **nullable**, **sans valeur par défaut** — les lignes existantes
--     n'ont pas d'icône (le parcours la leur demandera). La colonne est contrainte **par sa
--     forme** seulement : un slug court en minuscules (`chef-de-cabinet`, `tasse-3`), 40
--     caractères au plus. **La liste fermée n'est pas encore décidée** (D-197 (5) : « le détail
--     des icônes » reste ouvert, les icônes sont à dessiner). Quand le lot existera, une
--     migration ultérieure remplacera `profils_icone_check` par un `check (icone in (…))` et
--     réécrira ou videra les valeurs hors liste — comme 0022 l'a fait pour le service. Jusque-là
--     le catalogue, s'il en faut un, vit côté client, comme celui des intitulés.
--     L'icône **se change** librement, comme le pseudo : rien dans D-197 ne la fige (le service et
--     l'intitulé sont figés par D-148 (2) et D-159 ; l'icône n'y est pas). Une décision pourra la
--     figer plus tard, par une garde de plus dans `profils_gardes`.
--
--   - `profils.journee_faite_le` : `timestamptz`, **nullable**, **sans valeur par défaut** —
--     `null` = la Journée n'est pas faite. Les lignes existantes restent `null` : un testeur qui a
--     déjà vu la Journée sur son appareil (`tutorielVu`) la **refera une fois**, c'est le prix de
--     la bascule et le ticket l'accepte (« Journée non faite sauf décision contraire »). La date
--     est **posée par le serveur** : le client envoie n'importe quelle valeur non nulle, le
--     déclencheur la remplace par `now()` (même principe que 0009 pour les dates du comité). Elle
--     ne sert qu'à la trace ; la règle ne lit que « nulle ou pas ».
--
--   - **Le fait se pose une fois et ne se défait jamais** (garde `profils_journee_figee`) : ni
--     remis à `null`, ni redaté. C'est un fait sur le passé — « ce compte a fait la Journée au
--     moins une fois » — et D-197 (3) dit qu'un testeur qui change d'appareil **ne la rejoue pas** :
--     si le fait pouvait tomber, un appareil neuf la lui réimposerait. **« Rejouable depuis
--     Réglages »** (D-197 (3)) est un geste de **confort, côté client** : l'écran rejoue la Journée
--     sans toucher au fait, exactement comme un testeur relit les règles sans redevenir débutant.
--     Il n'y a donc **aucun chemin** pour défaire le fait depuis le jeu ; s'il en fallait un, ce
--     serait une décision datée et une migration qui l'ouvre explicitement.
--
--   - **Droits** : `authenticated` écrit les deux colonnes **sur sa ligne** (`grant update`,
--     colonne par colonne, comme 0019) ; il peut poser l'icône **à la création** du profil
--     (`grant insert (icone)`) mais **jamais** `journee_faite_le` à l'insertion : un profil neuf n'a
--     pas fait la Journée. Les politiques RLS de 0019 (« chacun change le sien », `id =
--     auth.uid()`) couvrent les colonnes nouvelles sans rien ajouter : un autre compte touche 0
--     ligne, donc ne pose ni l'icône ni la Journée d'un autre.
--
-- **Réversible** : les deux colonnes se retirent et la fonction de garde se remet à sa version
-- de 0019 (aucune donnée d'une autre table n'en dépend) :
--
--   begin;
--   alter table public.profils drop column if exists icone;
--   alter table public.profils drop column if exists journee_faite_le;
--   -- puis : rejouer le `create or replace function public.profils_gardes()` de 0019.
--   commit;
--
-- Le retrait **perd** les icônes et les dates posées entre-temps : c'est la seule perte, et elle
-- est dite. Le `drop column` emporte les `grant` de colonne avec lui.
--
-- **Ne casse aucune ligne existante** : `add column` nullable sans défaut, aucune réécriture, la
-- contrainte accepte `null`. `supabase/profil-icone-journee.test.ts` le prouve en montant la base
-- jusqu'à 0026, en y posant un profil complet, puis en rejouant 0027.
--
-- **Le contrôle mord** : `supabase/profil-icone-journee.test.ts` (PGlite) — une icône hors forme
-- est refusée, un autre compte ne pose ni l'icône ni la Journée d'un autre, la Journée posée ne se
-- défait pas, la date vient du serveur ; et la contrainte retirée, la garde retirée, la politique
-- RLS ouverte laissent chacune passer le geste fautif.
--
-- **Idempotente** : rejouable sans erreur (`add column if not exists`, contrainte posée par un
-- `do` qui ne la recrée pas, `create or replace`, `grant` répétables).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Les deux colonnes
-- ---------------------------------------------------------------------------------------------

alter table public.profils add column if not exists icone text;
alter table public.profils add column if not exists journee_faite_le timestamptz;

-- La **forme** de l'icône : un slug en minuscules, chiffres et tirets simples, de 1 à 40
-- caractères. Pas de liste fermée tant que les icônes ne sont pas dessinées (voir l'en-tête).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profils_icone_check'
      and conrelid = 'public.profils'::regclass
  ) then
    alter table public.profils
      add constraint profils_icone_check
      check (
        icone is null
        or (char_length(icone) between 1 and 40 and icone ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
      );
  end if;
end;
$$;

comment on column public.profils.icone is
  'L''icône de profil (D-197 (2)) : un slug court en minuscules. Liste fermée à venir quand le lot d''icônes existera ; nulle tant que le parcours ne l''a pas posée.';
comment on column public.profils.journee_faite_le is
  'Quand le compte a fait la Journée (D-197 (3)) ; nulle = pas faite. Posée une fois, datée par le serveur, jamais défaite : le rejeu depuis Réglages est côté client.';

-- ---------------------------------------------------------------------------------------------
-- 2. La garde de transition : la Journée faite ne se défait pas, et sa date vient du serveur
-- ---------------------------------------------------------------------------------------------

-- La fonction de 0019, **reprise en entier** (un `create or replace` remplace le corps) : les
-- trois gardes d'origine restent mot pour mot, la quatrième s'ajoute. Les privilèges de la
-- fonction sont conservés par `create or replace` ; la révocation est redite pour la lisibilité.
create or replace function public.profils_gardes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if old.service is not null and new.service is distinct from old.service then
    raise exception 'profils_service_fige : le service est figé dès la validation (#325)'
      using errcode = 'check_violation', constraint = 'profils_service_fige';
  end if;

  if old.intitule is not null and new.intitule is distinct from old.intitule then
    raise exception 'profils_intitule_fige : l''intitulé est figé une fois enregistré (#325)'
      using errcode = 'check_violation', constraint = 'profils_intitule_fige';
  end if;

  -- Les relances ne bougent que tant que l'intitulé n'est pas enregistré, et ne reculent jamais.
  if new.intitule_relances is distinct from old.intitule_relances
     and (old.intitule is not null or new.intitule_relances < old.intitule_relances) then
    raise exception 'profils_relance_figee : pas de relance après l''enregistrement, ni de recul (#325)'
      using errcode = 'check_violation', constraint = 'profils_relance_figee';
  end if;

  -- La Journée faite (D-197 (3)) : posée une fois, jamais défaite ni redatée.
  if old.journee_faite_le is not null and new.journee_faite_le is distinct from old.journee_faite_le then
    raise exception 'profils_journee_figee : la Journée faite ne se défait pas (#781, D-197)'
      using errcode = 'check_violation', constraint = 'profils_journee_figee';
  end if;

  -- Le passage de « pas faite » à « faite » est daté par le serveur, quelle que soit la valeur
  -- envoyée par le client (0009 fait de même pour les dates du comité).
  if old.journee_faite_le is null and new.journee_faite_le is not null then
    new.journee_faite_le := now();
  end if;

  return new;
end;
$$;

revoke execute on function public.profils_gardes() from public, anon, authenticated;

-- Le déclencheur de 0019 appelle déjà cette fonction : rien à recréer. Il est redit `if not
-- exists` par un `drop`/`create` pour qu'une base où il manquerait soit remise d'équerre.
drop trigger if exists profils_gardes on public.profils;
create trigger profils_gardes
  before update on public.profils
  for each row execute function public.profils_gardes();

-- ---------------------------------------------------------------------------------------------
-- 3. Droits : les deux colonnes s'écrivent sur sa ligne, l'une d'elles dès la création
-- ---------------------------------------------------------------------------------------------

-- L'icône peut accompagner le pseudo à la création du profil (l'ordre des étapes du parcours
-- est au client, D-197 (4)). La Journée, jamais à l'insertion : un profil neuf ne l'a pas faite.
grant insert (icone) on public.profils to authenticated;
grant update (icone, journee_faite_le) on public.profils to authenticated;

-- RLS : rien à ajouter. Les politiques de 0019 jugent la **ligne** (`id = auth.uid()`) et
-- couvrent toute colonne, nouvelle ou non. Le test le prouve sur les deux colonnes.

commit;
