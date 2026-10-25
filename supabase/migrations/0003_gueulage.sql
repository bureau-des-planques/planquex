-- Le gueulage n'est ni une IP ni un OUF — D-085.
--
-- `0001_mur.sql` imposait `kind not null check (kind in ('IP', 'OUF'))` et un identifiant de 32
-- caractères au plus. Or un gueulage **n'a pas de famille** (D-085), et son identifiant, fabriqué
-- avec la date et les premiers mots du message, dépasse 32 caractères. La base aurait refusé
-- l'import du mur comme le dépôt depuis le jeu. Cette migration met le schéma d'accord avec la
-- décision ; elle ne touche ni aux politiques RLS ni aux droits.
--
--   1. `kind` devient nullable ;
--   2. cohérence : un gueulage n'a **pas** de `kind`, un post-it qui n'en est pas **doit** en avoir
--      un (deux contraintes, une par moitié : chacune a son nom et son message). Le vocabulaire
--      — `IP` ou `OUF`, rien d'autre — reste tenu par `postits_kind_check`, celle de 0001 ;
--   3. `lie` : l'`id` du post-it collé sur un gueulage (D-085, forme 2). Clé étrangère, retombe
--      à `null` si le post-it associé est retiré. **Un `lie` ne désigne jamais un gueulage** :
--      une contrainte `check` ne voit pas les autres lignes, donc c'est un déclencheur — la base
--      le refuse, pas seulement le client. Il refuse aussi l'autre sens (transformer en gueulage
--      un post-it déjà désigné) ;
--   4. l'identifiant passe à 80 caractères au plus (le plus long réel en fait 49).
--
-- **Idempotente** : rejouable sans erreur (`if exists` / `if not exists`, `create or replace`).
-- **Données existantes** : le jeu postait jusqu'ici un gueulage avec `kind = 'IP'` (le schéma de
-- 0001 l'exigeait, `src/lib/murBase.ts`). Ces lignes sont remises à `null` avant la contrainte,
-- sans quoi elle ne passerait pas — c'est le seul geste sur des données, et il ne change que
-- ce que D-085 déclare faux.
--
-- La garde : `supabase/gueulage.test.ts` (PGlite) — chaque contrôle y est neutralisé tour à tour
-- et le test exige que la base accepte alors ce qu'elle refusait.

begin;

-- 1. Un gueulage n'a pas de famille.
alter table public.postits alter column kind drop not null;

-- Remise en ordre des gueulages déjà postés avec la famille de substitution (voir plus haut).
update public.postits set kind = null where gueulage and kind is not null;

-- 2. La cohérence entre la nature et la famille.
alter table public.postits drop constraint if exists postits_gueulage_sans_famille;
alter table public.postits
  add constraint postits_gueulage_sans_famille
  check (not gueulage or kind is null);

alter table public.postits drop constraint if exists postits_famille_hors_gueulage;
alter table public.postits
  add constraint postits_famille_hors_gueulage
  check (gueulage or kind is not null);

-- 3. Le post-it collé sur un gueulage.
alter table public.postits
  add column if not exists lie text null references public.postits (id) on delete set null;

comment on column public.postits.lie is
  'L''id du post-it collé sur ce gueulage (D-085) ; null quand le gueulage est seul. Ne désigne jamais un gueulage.';

create or replace function public.postits_lie_hors_gueulage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lie is not null then
    -- Un post-it ne se colle pas sur lui-même (la clé étrangère l'accepterait).
    if new.lie = new.id then
      raise exception 'postits_lie_hors_gueulage : un post-it ne se lie pas à lui-même'
        using errcode = 'check_violation', constraint = 'postits_lie_hors_gueulage';
    end if;
    if exists (select 1 from public.postits cible where cible.id = new.lie and cible.gueulage) then
      raise exception 'postits_lie_hors_gueulage : un lie ne désigne pas un gueulage (D-085)'
        using errcode = 'check_violation', constraint = 'postits_lie_hors_gueulage';
    end if;
  end if;

  -- L'autre sens : on ne transforme pas en gueulage un post-it que l'on désigne déjà.
  if tg_op = 'UPDATE' then
    if new.gueulage and not old.gueulage
       and exists (select 1 from public.postits lieur where lieur.lie = new.id) then
      raise exception 'postits_lie_hors_gueulage : ce post-it est désigné par un lie, il ne devient pas un gueulage (D-085)'
        using errcode = 'check_violation', constraint = 'postits_lie_hors_gueulage';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists postits_lie_hors_gueulage on public.postits;
create trigger postits_lie_hors_gueulage
  before insert or update of lie, gueulage on public.postits
  for each row execute function public.postits_lie_hors_gueulage();

-- 4. L'identifiant : 80 caractères au plus (au lieu de 32).
alter table public.postits drop constraint if exists postits_id_check;
alter table public.postits
  add constraint postits_id_check
  check (char_length(btrim(id)) between 1 and 80);

commit;
