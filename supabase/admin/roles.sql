-- Le rôle `lecteur` du poste de pilotage — la lecture seule de la base (#183, #184).
--
-- Le poste de pilotage local (`tools/admin/`, `npm run admin`) parle à la base par **deux
-- rôles** (D-091) :
--
--   - `postgres`, le rôle d'administration du projet — réservé aux gestes nommés (approuver,
--     refuser, trier, appliquer une migration) et à l'écriture du SQL libre ;
--   - `lecteur`, créé ici — **select seul**, employé par la zone de SQL libre en lecture. C'est
--     lui qui rend l'exploration inoffensive : si une requête tentait d'écrire, c'est la base
--     qui la refuse, pas le code du poste.
--
-- **Pourquoi ce fichier n'est pas dans `supabase/migrations/`.** Les tests du jeu rejouent
-- `supabase/migrations/` dans `pglite` (voir `supabase/pglite.ts`), et un rôle de poste n'a rien
-- à y faire : il faut que ce fichier soit appliqué **une fois, à la main**, par Bastien, dans le
-- SQL Editor — comme les migrations elles-mêmes (voir `supabase/README.md` §4-5). Il vit donc à
-- côté, dans `supabase/admin/`.
--
-- **Le mot de passe ne vit jamais ici** : un fichier versionné ne porte pas de secret. Après
-- application, poser le mot de passe hors dépôt :
--
--     alter role lecteur with password '…';
--
-- (c'est lui que la chaîne `postgresql://lecteur.<project-ref>:<mot-de-passe>@…` emploie).
--
-- **Idempotent** : rejouable sans erreur (`if not exists`, `do`, `alter role`, `grant`/`revoke`).

-- Le schéma du registre des migrations : il appartient au poste, pas au jeu.
create schema if not exists admin;

-- Le rôle, créé une seule fois.
do $role_lecteur$ begin
  if not exists (select 1 from pg_roles where rolname = 'lecteur') then
    create role lecteur;
  end if;
end $role_lecteur$;

-- La lecture seule doit **voir tout** (le poste affiche les comptes, les post-its, les combats),
-- donc elle passe au-dessus de la RLS — mais sans aucun droit d'écriture : le `select` est le
-- seul privilège accordé. `login` est nécessaire à la connexion directe par le pooler.
alter role lecteur bypassrls;
alter role lecteur login;

-- `usage` sur les deux schémas, puis `select` sur les tables déjà présentes, et le même `select`
-- sur celles qui viendront (`alter default privileges`).
grant usage on schema public to lecteur;
grant usage on schema admin  to lecteur;

revoke all on all tables in schema public from lecteur;
revoke all on all tables in schema admin  from lecteur;

grant select on all tables in schema public to lecteur;
grant select on all tables in schema admin  to lecteur;

alter default privileges in schema public grant select on tables to lecteur;
alter default privileges in schema admin  grant select on tables to lecteur;