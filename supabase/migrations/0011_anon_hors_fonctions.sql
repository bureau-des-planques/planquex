-- Le rôle `anon` ne peut plus exécuter les fonctions `security definer` de `public` — #247 (droit anon).
--
-- Le constat (#247) : les fonctions d'écriture du mur (`corriger_postit`, `deplacer_postit`,
-- `marquer_comite_vu`) refusent déjà un appareil non identifié, mais **par leur contrôle
-- interne** : `auth.uid()` est nul pour `anon`, donc `compte_approuve()` est faux et la
-- fonction lève une exception. Le refus ne reposait que sur ce test. Or les valeurs par
-- défaut de Supabase accordent `execute` sur les fonctions du schéma `public` aux rôles
-- `anon` et `authenticated` (privilèges par défaut) : `revoke ... from public` seul ne suffit
-- pas, `anon` garde son droit directement. Une fonction `security definer` qui oublie son
-- test d'identité s'ouvrirait donc aux appareils anonymes sans rien signaler.
--
-- **Ce que la migration fait** : elle retire `execute` à `anon` **et** à `public` sur toute
-- fonction `security definer` de `public` — les trois d'écriture, les deux d'aide aux
-- politiques (`compte_approuve`, `est_administrateur`) et les deux déclencheurs de `comptes`
-- (`comptes_creation`, `comptes_decision`). Les déclencheurs ne s'appellent pas par RPC, mais
-- un droit ouvert sur une fonction qu'on ne veut pas ouverte reste une porte à fermer.
--
-- **Ce qui ne change pas** : `authenticated` garde ses droits (`grant execute ... to
-- authenticated` de 0005 à 0008). Toutes les politiques RLS visent `to authenticated`, donc
-- aucune n'évalue `compte_approuve()` ni `est_administrateur()` pour `anon`. Les déclencheurs
-- ne demandent pas `execute` à leur déclenchement, seulement à leur création.
--
-- **Le contrôle mord** : `supabase/anon.test.ts` (PGlite) — `anon` n'a `execute` sur aucune
-- fonction `security definer` de `public`, il est refusé à l'appel de `corriger_postit`, et
-- la migration neutralisée (le `revoke ... from anon` retiré) laisse `anon` exécuter.
--
-- **Idempotente** : `revoke` est rejouable sans erreur. Elle ne touche ni aux tables, ni aux
-- politiques, ni aux données.

begin;

revoke execute on function public.corriger_postit(text, text, text) from public, anon;
revoke execute on function public.deplacer_postit(text, double precision, double precision, double precision) from public, anon;
revoke execute on function public.marquer_comite_vu() from public, anon;
revoke execute on function public.compte_approuve() from public, anon;
revoke execute on function public.est_administrateur() from public, anon;
revoke execute on function public.comptes_creation() from public, anon;
revoke execute on function public.comptes_decision() from public, anon;

commit;
