# Le socle backend du mur (#135)

Le mur de la Boîte à idées, côté base : **les tables**, **l'identité anonyme par appareil** et
**les règles d'accès** qui vont avec. Rien d'autre — le mur complet (#137) et le PvP viendront
s'appuyer dessus.

| Fichier | Ce qu'il porte |
|---|---|
| `supabase/migrations/0001_mur.sql` | le schéma : `postits`, `votes`, `commentaires`, la vue `postits_avec_votes`, les droits et les politiques RLS |
| `supabase/migrations/0002_combats.sql` | la trace des combats : la table `combats`, les droits et les politiques RLS (#173, D-086) |
| `supabase/pglite.ts` | le banc d'essai partagé : shim, migrations appliquées dans l'ordre, deux appareils (`mur.test.ts`, `combats.test.ts`) |
| `supabase/mur.test.ts` | la garde : joue **la migration réelle** dans PGlite (PostgreSQL en WASM, RLS comprise) et **exige** que les politiques mordent |
| `supabase/combats.test.ts` | la même garde pour les combats : un autre appareil ne lit pas, `anon` n'a rien, un auteur forgé est refusé, et la migration mutée fuit |
| `src/lib/supabase.ts` | la configuration, l'identité anonyme et l'écriture d'une ligne côté jeu (inerte sans `.env`) |
| `src/lib/supabase.test.ts` | la garde de la clé : publique seulement, et l'alpha inerte sans backend |
| `src/store/combats.ts` | ce qui est gardé d'un combat solo terminé, et l'envoi silencieux (#173) |
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

Aucun écran ne l'appelle encore : c'est **le socle**. Le mur complet (#137) branchera
`identiteAppareil()` puis les requêtes.

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

## 4. L'étape humaine — appliquer les migrations

> **Ce n'est pas fait.** La machine de développement n'a **ni Docker ni CLI Supabase**
> (`docker info` → commande absente), et cette session n'a **aucun accès** au projet Supabase
> (pas de MCP : la politique de la maison réserve `supabase` à une session d'infrastructure).
> La migration a donc été **écrite et éprouvée sur PGlite**, jamais appliquée à un vrai projet.
> Les commandes ci-dessous sont celles à jouer, une fois, par une personne.

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

`supabase/mur.test.ts` (11 tests) :

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

## 6. La trace des combats (#173, D-086)

À la fin d'une partie **solo** terminée, le jeu dépose en arrière-plan de quoi la **rejouer** :
la graine, les deux Decks, les types de café et le journal d'actions. **Rien d'autre** — ni le
pseudo de Réglages, ni un texte libre, ni un identifiant d'appareil : `auteur` est `auth.uid()`,
l'identité **anonyme** (D-059). Le PvP n'est **pas** gardé (beta).

`src/store/combats.ts` construit la ligne (`combatTermine`, `ligneDe`) et l'envoie
(`tracerCombat`) ; `Battle.tsx` l'appelle une fois, à la fin. **L'échec réseau ne bloque
jamais le jeu** : sans configuration, rien n'est contacté ; un rejet est avalé, et la partie
n'a jamais dépendu de l'envoi. Une **mention** dans Réglages le dit au joueur, sans case à
cocher (D-086).

### `public.combats`

| Colonne | Contrainte |
|---|---|
| `id` | `bigint identity` — le client ne choisit pas l'identité de sa ligne |
| `auteur` | `uuid`, défaut `auth.uid()` ; pas de FK vers `auth.users` (une trace survit à la purge d'une identité) |
| `mode` | `check (mode = 'solo')` — le PvP attend la beta, une migration élargira la contrainte |
| `graine` | `bigint >= 0` (`BattleState.seed`) |
| `decks` | `jsonb` : `playerDeck` et `aiDeck` sont des tableaux |
| `types_cafe` | `jsonb` : `playerCafeTypes` et `aiCafeTypes` sont des tableaux |
| `journal` | `jsonb` : un tableau d'actions, exactement ce que `replayBattle` rejoue |
| `created_at` | `now()` |

**Règles d'accès** : `authenticated` **insère** ses lignes (`auteur = auth.uid()`) et **lit
les siennes** (`using (auteur = auth.uid())`) ; `anon` n'a **rien** (`revoke all`). Aucune
politique `update` / `delete` : une trace est un **ajout**, elle ne se réécrit pas.

**Taille mesurée** le 23/10/2026, sur 20 combats simulés (le simulateur headless, puis
`combatTermine` + `ligneDe` + une insertion PGlite) : **3 409 octets de JSON en moyenne**
(médiane 3 494 ; 2 337 à
4 554), soit une ligne PostgreSQL de **1 819 octets** en moyenne (médiane 1 872 ; 1 344 à
2 008) — `jsonb` range les clés répétées une fois. Vingt combats tiennent donc en ~68 ko de
JSON, et un millier de combats en ~3,4 Mo.

### Appliquer 0002

Comme 0001 : coller **tout** `supabase/migrations/0002_combats.sql` dans *SQL Editor* → *Run*
(ou `supabase db push`). Puis, pour que le CLI ne la rejoue pas :

```bash
supabase migration repair --status applied 0002
```

Après application, le contrôle qui compte :

```bash
npx vitest run supabase/combats.test.ts
```

## 7. Ce qui reste humain, précisément

- **Créer ou choisir le projet Supabase** et donner son `project-ref` (rien de tout cela
  n'existe dans cette session) ;
- **activer les connexions anonymes** (§4.1) — sinon `signInAnonymously` est refusé ;
- **appliquer les migrations** (§4.2 ou §4.3, puis §6 pour 0002), et vérifier (§4.4) ;
- **poser les deux variables** en local et sur Vercel ;
- **renommer le fichier** en `<horodatage>_mur.sql` **si** le CLI l'exige (non vérifié) ;
- **brancher l'écran** sur `src/lib/supabase.ts` : c'est #137, pas ce ticket.
