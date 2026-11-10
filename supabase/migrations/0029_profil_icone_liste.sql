-- La liste fermée des icônes de profil — #791, D-197 (2).
--
-- 0027 posait `profils.icone` avec une contrainte **de forme** seulement (« slug court en
-- minuscules »), parce que les icônes n'étaient pas dessinées. Le lot de **douze portraits de
-- planqués** existe (`public/design/profils/`, manifeste `design/profils/README.md`, PR #794) :
-- la base ne contraint donc plus la forme mais la **liste fermée** de ses douze slugs.
--
--   agent-accueil, controleuse, technicien, comptable, cheffe-projet, developpeur,
--   gestionnaire-rh, chef-atelier, charge-communication, archiviste, juriste, logisticien
--
-- **Les lignes existantes sont réécrites** avant que la contrainte ne change, comme 0022 l'a fait
-- pour le service : une icône hors liste est **vidée** (`null`), et le parcours la redemande au
-- testeur à sa prochaine connexion (l'étape « icône » du parcours). Aucune valeur n'est
-- « traduite » vers une icône de la liste : il n'y en avait aucune de valide avant ce lot, un
-- choix serait inventé. Les icônes déjà dans la liste ne bougent pas.
--
-- `profils_gardes` ne garde pas l'icône (elle se change librement, 0027) : pas besoin, ici, de
-- désarmer le déclencheur comme 0022 devait le faire pour le service. Seul `updated_at` avance
-- sur les lignes vidées.
--
-- **Même nom de contrainte** (`profils_icone_check`) : le client la reconnaît déjà dans
-- `messageDeProfil`. La liste est **doublée côté client** (`ICONES_PROFIL`, `src/lib/profil.ts`) ;
-- `src/lib/profil-icones.test.ts` garde les deux ensemble.
--
-- **Réversible** : revenir à la contrainte de forme de 0027 (les icônes vidées ne reviennent pas,
-- c'est la seule perte) :
--
--   begin;
--   alter table public.profils drop constraint if exists profils_icone_check;
--   alter table public.profils add constraint profils_icone_check
--     check (icone is null or (char_length(icone) between 1 and 40 and icone ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));
--   commit;
--
-- **Le contrôle mord** : `supabase/profil-icone-liste.test.ts` (PGlite) — une icône de la bonne
-- forme mais hors liste est refusée, les douze passent, une ligne d'avant hors liste est vidée et
-- une ligne dans la liste est gardée ; la contrainte retirée, ou la migration mutée sans son
-- `check` ou sans sa réécriture, laissent chacune passer le geste fautif.
--
-- **Idempotente** : rejouable sans erreur (la réécriture ne touche que les lignes hors liste, la
-- contrainte est reposée par `drop … if exists` puis `add`).
--
-- **À appliquer à Supabase par un geste humain.**

begin;

alter table public.profils drop constraint if exists profils_icone_check;

update public.profils
set icone = null
where icone is not null
  and icone not in (
    'agent-accueil', 'controleuse', 'technicien', 'comptable', 'cheffe-projet', 'developpeur',
    'gestionnaire-rh', 'chef-atelier', 'charge-communication', 'archiviste', 'juriste', 'logisticien'
  );

alter table public.profils
  add constraint profils_icone_check
  check (
    icone is null
    or icone in (
      'agent-accueil', 'controleuse', 'technicien', 'comptable', 'cheffe-projet', 'developpeur',
      'gestionnaire-rh', 'chef-atelier', 'charge-communication', 'archiviste', 'juriste', 'logisticien'
    )
  );

comment on column public.profils.icone is
  'L''icône de profil (D-197 (2)) : un des douze slugs de la liste fermée (0029) ; nulle tant que le parcours ne l''a pas posée.';

commit;
