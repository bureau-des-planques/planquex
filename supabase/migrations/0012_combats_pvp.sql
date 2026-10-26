-- La trace des parties à deux : `mode` admet `'pvp'` — #228, D-105.
--
-- La 0002 n'admettait que `'solo'`, et le disait : « Le PvP est en beta ». La **partie à
-- deux existe** (`@/store/pvp`, D-049 : « Partie à deux » dans le menu `⋯`, sans serveur) —
-- elle est jouable dès l'alpha, et c'est bien là que D-105 s'applique : « quand le PvP
-- existe » ; la parenthèse « beta » de D-105 nommait l'étape prévue, pas une condition de
-- plus. D-105 a tranché le 26/10/2026 : une partie à deux terminée se dépose **dans la même
-- table**, avec la même forme (graine, deux Decks, types de café, journal), et `mode =
-- 'pvp'`. Rien d'autre ne change : ni colonne, ni politique, ni droit.
-- Une trace reste liée à son auteur (`auteur = auth.uid()`, D-088) et lisible par lui seul.
--
-- **Pourquoi une liste et pas un `mode <> 'solo'`** : la contrainte est la même des deux
-- côtés, et un mode futur (« coop ») doit s'ajouter explicitement plutôt que passer par
-- accident. Un `'deux'` inventé reste refusé — la garde `combats.test.ts` le vérifie.
--
-- **Idempotente** : `drop constraint if exists` puis `add constraint`. Elle ne touche
-- aucune ligne : une trace déjà déposée est en `'solo'`, qui reste admis.

begin;

alter table public.combats drop constraint if exists combats_mode_check;

alter table public.combats
  add constraint combats_mode_check check (mode in ('solo', 'pvp'));

comment on column public.combats.mode is
  'Le mode du combat : « solo » ou « pvp » (D-105, 0012). Le PvP se trace comme le solo, dans la même table.';

commit;
