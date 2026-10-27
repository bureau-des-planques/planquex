-- La « Médaille de la période d'essai » — #346, D-130 (3).
--
-- Le reset de la beta (D-130) efface les traces de combat et le mur, garde chaque compte, et
-- **récompense l'alpha** : tout compte approuvé pendant l'alpha reçoit cette médaille, à la
-- date du reset, et ne la perd plus ensuite. Elle s'affiche sur le profil et **nulle part
-- ailleurs** (pas dans la Collection, pas au comité) : c'est un écart assumé de D-130 (3), pas
-- un oubli d'intégration.
--
-- **Un marqueur, pas un calcul.** La médaille est une **colonne** posée par le mode de reset du
-- poste de pilotage, au moment où il tourne — jamais une comparaison de dates. Une date de
-- création ne dit pas qui était **approuvé** ce jour-là, et un compte approuvé **après** le
-- reset ne doit pas la recevoir. Le registre `admin.migrations` reste le reflet du schéma : le
-- reset n'est pas une migration (D-130 (4)).
--
-- **Le client ne peut pas se l'attribuer.** Les droits d'écriture de `authenticated` sont
-- **colonne par colonne** depuis la 0005 (`etat`, `raison`) : les deux colonnes ci-dessous
-- n'entrent dans aucun `grant`, et la révocation explicite plus bas les referme pour de bon.
-- Seul le rôle d'administration (celui des migrations et du poste de pilotage) les écrit.
--
-- **Le booléen et sa date ne se séparent pas** : la contrainte `comptes_medaille_a_sa_date` exige
-- l'accord des deux. Une médaille sans date ne dit pas quand, une date sans médaille ment sur le
-- drapeau qu'on lit.
--
-- **Le contrôle mord** : `supabase/comptes.test.ts` (PGlite) — la médaille est fausse par défaut,
-- deux comptes approuvés au même instant ne la reçoivent pas ensemble (elle ne se déduit pas de
-- `created_at`), le serveur l'attribue et le compte la lit, un client la tente en vain
-- (`permission denied`), et la migration **mutée** (colonnes ajoutées au `grant`) laisse le
-- client se l'attribuer.
--
-- **Idempotente** : rejouable sans erreur (`add column if not exists`, `drop constraint if
-- exists` puis `add constraint`, `comment`, `revoke`).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Le marqueur : un booléen, et sa date
-- ---------------------------------------------------------------------------------------------

alter table public.comptes
  -- Faux par défaut : la très grande majorité des comptes n'est pas de l'alpha, et une colonne
  -- nulle par défaut obligerait chaque lecture à distinguer « pas encore » de « jamais ».
  add column if not exists medaille_periode_essai    boolean     not null default false,
  -- Posée **avec** le booléen, par le même `update` du reset : la date est celle du geste, pas
  -- celle de l'inscription (voir l'en-tête).
  add column if not exists medaille_periode_essai_le timestamptz;

comment on column public.comptes.medaille_periode_essai is
  'La « Médaille de la période d''essai » (D-130 (3)) : vraie pour un compte approuvé pendant l''alpha. Le client ne peut pas y toucher.';
comment on column public.comptes.medaille_periode_essai_le is
  'La date d''attribution de la médaille, posée par le reset de la beta en même temps que le drapeau (D-130).';

-- Les deux colonnes disent **une** chose : l'une sans l'autre est une ligne qu'on ne sait plus
-- lire. `drop` puis `add` : la migration se rejoue, et la contrainte se retrouve à l'identique.
alter table public.comptes
  drop constraint if exists comptes_medaille_a_sa_date;
alter table public.comptes
  add constraint comptes_medaille_a_sa_date
  check (medaille_periode_essai = (medaille_periode_essai_le is not null));

-- ---------------------------------------------------------------------------------------------
-- 2. Aucun droit d'écriture client — la fermeture, dite explicitement
-- ---------------------------------------------------------------------------------------------

-- La **vraie** garde est le `grant update (etat, raison)` de la 0005 : une colonne qui n'y est
-- pas n'est pas modifiable, et ces deux-là n'y sont pas. Cette révocation ne remplace pas cette
-- règle, elle la **redit** là où les colonnes naissent : un `grant update on public.comptes`
-- (sans liste de colonnes) glissé un jour dans une migration serait alors la seule façon de
-- rouvrir l'écriture, et ce fichier dit que c'est interdit.
--
-- `select`, lui, n'est pas touché : la 0005 donne la table entière, donc les deux colonnes
-- **nouvelles** sont lisibles par leur propriétaire — c'est ainsi que Réglages affiche la
-- médaille.
revoke all (medaille_periode_essai, medaille_periode_essai_le) on public.comptes from public;
revoke all (medaille_periode_essai, medaille_periode_essai_le) on public.comptes from anon;
revoke all (medaille_periode_essai, medaille_periode_essai_le) on public.comptes from authenticated;

-- Les politiques de la 0005 ne bougent pas : celle de lecture (`id = auth.uid()` ou
-- administrateur) porte la médaille avec le reste de la ligne, et celle d'écriture ne vise que
-- `etat` et `raison` par le grant — aucune politique n'ouvre ces colonnes.

commit;
