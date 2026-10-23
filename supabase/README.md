# Le socle backend du mur (#135)

Le mur de la Boîte à idées, côté base : **les tables**, **l'identité anonyme par appareil** et
**les règles d'accès** qui vont avec. Rien d'autre — le mur complet (#137) et le PvP viendront
s'appuyer dessus.

| Fichier | Ce qu'il porte |
|---|---|
| `supabase/migrations/0001_mur.sql` | le schéma : `postits`, `votes`, `commentaires`, la vue `postits_avec_votes`, les droits et les politiques RLS |
| `supabase/mur.test.ts` | la garde : joue **la migration réelle** dans PGlite (PostgreSQL en WASM, RLS comprise) et **exige** que les politiques mordent |
| `src/lib/supabase.ts` | la configuration et l'identité anonyme côté jeu (inerte sans `.env`) |
| `src/lib/supabase.test.ts` | la garde de la clé : publique seulement, et l'alpha inerte sans backend |
| `src/lib/murBase.ts` | la **couture** du mur (#136) : lit `postits_avec_votes`, poste dans `postits`, retombe sur le fichier sans configuration |
| `src/lib/murBase.test.ts` | la garde de la couture : lecture, écriture sans `auteur`, gueulage sans famille, panne qui lève |
| `.env.example` | les deux noms de variables, avec des valeurs **fausses** |

Les décisions : **D-058** (le mur et ses deux familles), **D-059** (statuts, identité), **D-068**
(les apparences, le gueulage, la disposition en pourcentage). Le contrat de données :
`docs/BOITE-A-IDEES.md` §3.

---

## 1. Le schéma, champ par champ

Le contrat de `docs/BOITE-A-IDEES.md` §3 est repris tel quel, avec **une** différence :
`position` éclate en trois colonnes (`position_x`, `position_y`, `position_angle`) pour que les
bornes 0–100 / −5–+5 soient tenues par la **base**. La vue `postits_avec_votes` recompose la
forme du contrat, `position` et `votes` compris.

### `public.postits`

| Contrat §3 | Colonne | Contrainte |
|---|---|---|
| `id` | `id text` | clé primaire, 1 à 32 caractères — court, stable, jamais réutilisé |
| `kind` | `kind text` | `check (kind in ('IP', 'OUF'))` |
| `titre` / `texte` | `titre` / `texte text` | non vides |
| `ecran` | `ecran text` | `Accueil` \| `Collection` \| `Deck` \| `Combat` \| `Réglages` \| `Autre`, ou nul |
| `pseudo` | `pseudo text` | défaut `'anonyme'` (D-059 : le nom local de Réglages) |
| `version` | `version text` | non vide — un retour sans version ne dit pas s'il est encore vrai |
| `statut` | `statut text` | `en attente` \| `retenu` \| `en cours` \| `fait` \| `écarté` |
| `raison` | `raison text` | défaut `''` ; **obligatoire dès que `statut = 'écarté'`** (`postits_ecarte_a_sa_raison`) |
| `ticket` | `ticket integer` | numéro d'issue GitHub, ou nul |
| `gueulage` | `gueulage boolean` | défaut `false` (D-068 : blanc et plus grand, même s'il reste IP ou OUF) |
| `position` | `position_x`, `position_y`, `position_angle` | **en pourcentage**, 0–100 et −5–+5 ; défaut au centre, droit |
| `votes` | *(pas de colonne)* | **compté** depuis `votes` par la vue — une seule source de vérité |
| — | `auteur uuid` | `auth.uid()` de l'appareil ; c'est **lui** que les politiques comparent |
| — | `created_at` | `now()` |

Pas de clé étrangère de `auteur` vers `auth.users` : une identité **anonyme** peut être purgée
côté GoTrue, et un post-it ne doit pas disparaître avec l'appareil qui l'a écrit. Le pseudo est
recopié sur la ligne, c'est lui que le mur affiche.

### `public.votes`

`(postit_id, votant, sens, created_at)`, clé primaire `(postit_id, votant)` : **un appareil, un
vote par post-it**. Changer d'avis est un `UPDATE` de sa ligne, pas une seconde ligne.

### `public.commentaires`

`(id bigint identity, postit_id, auteur, pseudo, texte, created_at)`. Les deux tables d'enfants
partent en **cascade** quand un post-it est retiré par son auteur (#139).

### Les règles d'accès (RLS)

`enable row level security` **et** `force row level security` sur les trois tables — sans
`force`, le propriétaire des tables échappe à ses propres politiques.

| Table | Lecture | Écriture |
|---|---|---|
| `postits` | **tout le monde** (`using (true)`) | `auteur = auth.uid()` en insertion, modification et suppression |
| `votes` | **tout le monde** | `votant = auth.uid()` |
| `commentaires` | **tout le monde** | `auteur = auth.uid()` |

Une politique par commande, et non une politique `for all` : les politiques permissives
s'additionnent en **OU**, donc la lecture reste ouverte pendant que l'écriture reste fermée.
C'est cette condition (`auteur = auth.uid()`, `votant = auth.uid()`) que la garde remplace par
`true` pour prouver qu'elle mord.

Le rôle **`anon`** (appareil non identifié) n'a **aucun** privilège : `revoke all` dans la
migration. Le jeu signe d'abord (identité anonyme, rôle `authenticated`), puis lit.

## 2. L'identité anonyme, côté jeu

`src/lib/supabase.ts` :

- lit **deux** variables, `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Vite n'expose que le
  préfixe `VITE_`) ;
- **refuse** une clé de service (`sb_secret_…`, ou un JWT dont la charge dit
  `"role": "service_role"`) : elle contourne la RLS et n'a rien à faire dans un navigateur ;
- **inerte** quand les deux variables manquent : `configurerMur()` rend `null`, rien n'est
  contacté, et `npm run build` / `npm run capturer` marchent sans configuration. C'est la
  contrainte de l'alpha : le mur lit `docs/boite-a-idees.json` (D-058) ;
- `identiteAppareil()` rend l'identité de la session persistée, ou en **signe une** anonymement à
  la première visite (`signInAnonymously`, session gardée par `@supabase/supabase-js`) ;
- la bibliothèque est chargée **à la demande** : sans configuration, son code ne part même pas
  dans le premier chargement.

Depuis #136, **le mur s'en sert** : `src/lib/murBase.ts` signe l'appareil avec
`identiteAppareil()` puis lit la vue, et le formulaire du mur poste dans `postits`. Le socle
reste inerte sans configuration.

## 3. Les variables d'environnement

Deux, et jamais une troisième :

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<clé publique : sb_publishable_… ou le JWT anon>
```

- en local : copier `.env.example` en **`.env`** (ignoré par git) et y mettre les vraies valeurs ;
- sur Vercel : *Settings → Environment Variables*, pour **Production** et **Preview** ;
- **la clé de service ne se met nulle part** dans ce dépôt : ni `.env` du jeu, ni Vercel côté
  client. Le module la refuse de toute façon.

Sans ces variables, le jeu fonctionne comme aujourd'hui (mur en lecture seule sur le JSON).

Les **tests** chargent `.env.test` (versionné, variables **vides**) : `npm test` ne contacte
jamais la base, même sur un poste où `.env` porte les vraies valeurs. C'est ce qui garde le
résultat identique entre la machine de développement et la CI.

## 4. L'étape humaine — appliquer les migrations

> **État au 23/10/2026, mesuré par la session d'infrastructure** : la migration **est
> appliquée** sur le projet `jzlcwnozlzhadatksvgh`, et les connexions anonymes sont
> **activées**. Une session anonyme lit les quatre objets (`200`, vide) ; sans session, la
> requête est refusée — c'est voulu, les droits sont donnés à `authenticated` seul. Les
> variables sont posées dans le `.env` local ; **elles ne le sont pas encore sur Vercel**, donc
> la production reste inerte et le mur lit le fichier.
>
> La machine de développement n'a **ni Docker ni CLI Supabase**, et la session de
> développement n'a **aucun accès** au projet Supabase (pas de MCP : la politique de la maison
> réserve `supabase` à une session d'infrastructure). Les commandes ci-dessous restent la
> procédure pour **un autre projet**, ou pour rejouer une migration future.

### 4.1 Créer (ou retrouver) le projet, et activer l'identité anonyme

**Avant tout** : dans le tableau de bord Supabase, *Authentication → Sign In / Providers →
**Anonymous sign-ins** → activé*. Sans ce réglage, `signInAnonymously()` répond
`Anonymous sign-ins are disabled` — et la garde de `src/lib/supabase.test.ts` le dit dans son
message d'erreur. Supabase a annoncé vouloir le désactiver par défaut : vérifier, ne pas
supposer.

Le même écran sert à **désactiver** les fournisseurs dont on ne veut pas (courriel, etc.) : le
jeu promet « pas de compte », un fournisseur ouvert par défaut le contredirait.

### 4.2 Chemin normal : le CLI

```bash
# une fois
npm install -g supabase            # ou : brew install supabase/tap/supabase
supabase login
supabase link --project-ref <project-ref>

# à chaque migration nouvelle
supabase db push                   # demande le mot de passe de la base
```

`db push` enregistre la version dans `supabase_migrations.schema_migrations`, donc la suivante
sait ce qui est déjà passé. Il ne demande **pas** Docker (seul `supabase start`, le Supabase
local, en a besoin).

⚠️ **Nom de fichier** : le CLI nomme ses migrations `AAAAMMJJHHmmss_description.sql` (14
chiffres). Le fichier de ce dépôt s'appelle `0001_mur.sql`, pour rester lisible et se ranger
avant les suivantes. **Non vérifié ici** (pas de CLI sur la machine) : si `supabase db push`
ignore le fichier ou le refuse, le renommer en `<horodatage>_mur.sql` — **le test lit le
dossier `supabase/migrations/`, pas le nom du fichier**, la garde suit donc le renommage sans
retouche.

### 4.3 Chemin de dépannage : le tableau de bord

*SQL Editor* → coller **tout** `supabase/migrations/0001_mur.sql` → *Run*. Puis, pour que le CLI
ne rejoue pas la migration plus tard, l'enregistrer comme appliquée :

```bash
supabase migration repair --status applied 0001
```

(la version est le préfixe du fichier ; **non vérifié** ici pour la même raison).

### 4.4 Ce qu'il faut vérifier après

Dans le *SQL Editor* :

```sql
-- 1. Les quatre objets sont là
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('postits', 'votes', 'commentaires', 'postits_avec_votes');

-- 2. RLS active ET forcée sur les trois tables
select relname, relrowsecurity, relforcerowsecurity
  from pg_class
 where relname in ('postits', 'votes', 'commentaires');
-- attendu : relrowsecurity = true ET relforcerowsecurity = true, trois fois

-- 3. Une politique par commande, sur chaque table
select tablename, policyname, cmd from pg_policies
 where schemaname = 'public' order by tablename, cmd;

-- 4. `anon` n'a rien, `authenticated` a les droits
select has_table_privilege('anon', 'public.postits', 'select')          as anon_lit,       -- false
       has_table_privilege('authenticated', 'public.postits', 'select') as authentifie_lit; -- true

-- 5. La vue ne contourne pas la RLS
select c.relname, c.reloptions from pg_class c where c.relname = 'postits_avec_votes';
-- attendu : reloptions = {security_invoker=true}
```

Puis, dans l'application avec `.env` renseigné : ouvrir le jeu, et vérifier dans
*DevTools → Application → Local Storage* qu'une clé `sb-<project-ref>-auth-token` est apparue —
c'est la session anonyme de l'appareil. Elle survit au rechargement.

Enfin, le contrôle qui compte : **la garde**. Elle rejoue la migration sur PostgreSQL réel
(WASM) et exige que les règles mordent.

```bash
npx vitest run supabase/mur.test.ts
```

## 5. La garde, et ce qu'elle prouve

`supabase/mur.test.ts` (12 tests) :

1. il **lit les fichiers de `supabase/migrations/`** et les joue dans PGlite — PostgreSQL 18,
   RLS comprise. Rien n'est recopié : la garde garde la migration qu'on applique ;
2. il simule deux appareils (`set role authenticated; set request.jwt.claim.sub = '<uuid>'`) et
   vérifie : A colle son post-it ; **B lit** celui de A ; B **ne peut pas** écrire au nom de A
   (erreur `row-level security`) ; B **ne peut pas** modifier ni supprimer la ligne de A —
   `RETURNING *` rend **0 ligne**, sans erreur ; A modifie le sien ; votes et commentaires
   suivent la même règle ; `anon` n'a aucun accès ;
3. **le contrôle mord** : le dernier bloc rejoue le scénario contre une **migration mutée**, où
   les conditions des politiques valent `true`. Il **exige** d'y constater la fuite — B modifie
   la ligne de A, la supprime, et signe au nom de A. Si la mutation ne s'appliquait plus (les
   conditions ont changé de forme), le test **échoue** au lieu de passer en silence.

Pourquoi muter la **condition** et non **supprimer** la politique : une politique supprimée est
*default-deny* en RLS, donc le scénario passerait et ne prouverait rien (mesuré le 21/10/2026).

## 6. Ce qui reste humain, précisément

- **Créer ou choisir le projet Supabase** et donner son `project-ref` — fait (#135) ;
- **activer les connexions anonymes** (§4.1) — fait le 23/10/2026 ;
- **appliquer la migration** (§4.2 ou §4.3), et vérifier (§4.4) — fait le 23/10/2026 ;
- **poser les deux variables** en local et sur Vercel — local fait, **Vercel pas encore** ;
- **renommer le fichier** en `<horodatage>_mur.sql` **si** le CLI l'exige (non vérifié) ;
- **poser les variables Vercel** : sans elles, la production reste sur le fichier, ce qui est
  l'état voulu tant que la base n'est pas branchée. Le branchement de l'écran est fait (#136) ;
  restent les votes (#137), les commentaires (#138) et la modification/retrait (#139).
