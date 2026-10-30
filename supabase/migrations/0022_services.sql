-- Les cinq services du parcours changent de noms — D-159 (30/10/2026, amende D-148 (1)).
--
-- « Red Chaussée » était une **coquille** pour « Rez-de-chaussée » : elle disparaît, et
-- l'immeuble monte jusqu'au 4e. La liste devient, dans l'ordre :
--
--   rez-de-chaussee, 1er, 2e, 3e, 4e
--
-- **Les lignes existantes sont réécrites** avant que la contrainte ne change : un testeur qui
-- avait choisi « Red Chaussée » se retrouve au rez-de-chaussée, ce qui est exactement ce qu'il
-- croyait choisir. Aucune autre valeur ne bouge (`1er` à `3e` gardent leur code).
--
-- **Idempotente** : la contrainte est posée par un `do` qui ne la recrée pas si elle existe,
-- et la réécriture ne touche que les lignes qui portent encore l'ancien code.

begin;

alter table public.profils drop constraint if exists profils_service_check;

-- **La garde doit se taire le temps de la correction.** `profils_gardes` refuse tout changement
-- de `service` une fois posé — y compris celui-ci, qui ne corrige pas un choix mais une
-- coquille (`red-chaussee` n'a jamais été un étage). Vu en production le 30/10/2026 : sans
-- cette parenthèse, l'application répondait `profils_service_fige` et n'écrivait rien.
-- L'écriture et le rétablissement sont dans la même transaction : aucun client ne voit la
-- garde désarmée, et rien ne peut s'y glisser entre les deux.
alter table public.profils disable trigger profils_gardes;

update public.profils
set service = 'rez-de-chaussee'
where service = 'red-chaussee';

alter table public.profils enable trigger profils_gardes;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profils_service_check'
      and conrelid = 'public.profils'::regclass
  ) then
    alter table public.profils
      add constraint profils_service_check
      check (service in ('rez-de-chaussee', '1er', '2e', '3e', '4e'));
  end if;
end;
$$;

comment on column public.profils.service is
  'Le groupe du testeur (cinq valeurs, D-159). Figé dès qu''il est posé. Ce n''est pas le service des factions (AGENTS.md §3.2).';

commit;
