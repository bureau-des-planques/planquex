# Le socle backend du mur (#135)

Le mur du comité, côté base : **les tables**, **l'identité anonyme par appareil** et
**les règles d'accès** qui vont avec. Rien d'autre — le mur complet (#137) et le PvP viendront
s'appuyer dessus.

| Fichier | Ce qu'il porte |
|---|---|
| `supabase/migrations/0001_mur.sql` | le schéma : `postits`, `votes`, `commentaires`, la vue `postits_avec_votes`, les droits et les politiques RLS |
| `supabase/migrations/0002_combats.sql` | la trace des combats : la table `combats`, les droits et les politiques RLS (#173, D-086) |
| `supabase/migrations/0003_gueulage.sql` | le gueulage (D-085) : `kind` nullable, `lie`, l'identifiant jusqu'à 80 caractères — ni table, ni politique, ni droit |
| `supabase/migrations/0004_pouces.sql` | les pouces (#137) : les politiques d'insertion et de modification de `votes` refusent un vote pour **son propre** post-it — pas de table, pas de droit |
| `supabase/migrations/0005_comptes.sql` | les comptes (#181, D-088) : la table `comptes`, la ligne créée à la première connexion (`auth.users`), et les politiques d'**écriture** de `postits`, `votes`, `commentaires` et `combats` qui exigent un compte **approuvé** |
| `supabase/migrations/0006_tri_et_corrections.sql` | le tri, la correction et le retrait (#138, #139, D-088) : `statut`/`raison`/`ticket` écrits par un **administrateur** seul, le retrait par l'auteur tant que le post-it est `en attente`, et `public.corriger_postit(id, titre, texte)` pour le titre et le texte — la base n'en donne plus l'écriture directe |
| `supabase/migrations/0007_place_et_retrait_admin.sql` | la place et le retrait (#185, #186, D-092) : `public.deplacer_postit(...)` (l'auteur range **ses** post-its, l'administrateur **tous**), et la politique qui laisse l'administration retirer n'importe quel post-it à n'importe quel statut |
| `supabase/migrations/0008_comite.sql` | le suivi (#209, D-097) : `postits.updated_at` et son déclencheur (monté **au changement de statut** seul), `comptes.vu_le` — le repère par compte — et `public.marquer_comite_vu()`. Le rôle `authenticated` **lit** son repère et ne l'écrit jamais |
| `supabase/migrations/0009_commentaires_dates.sql` | les dates du comité posées par le serveur (#238) : `commentaires.created_at` et `postits.updated_at` sont **réécrits** à `now()` par un déclencheur `before insert` — une date fournie par le client, future ou passée, ne garde plus la pastille allumée ni ne la cache |
| `supabase/migrations/0010_dates_figees.sql` | les dates du comité figées à l'écriture (#244) : un déclencheur `before update` rétablit `created_at` à sa valeur d'origine sur `commentaires` et `postits` — l'auteur qui redate son commentaire n'obtient pas la date ; la correction du texte passe toujours |
| `supabase/migrations/0011_anon_hors_fonctions.sql` | le rôle `anon` n'exécute plus aucune fonction `security definer` de `public` (#247) : les valeurs par défaut de Supabase lui accordent `execute`, et le refus ne reposait que sur `auth.uid()` nul. `authenticated` garde ses droits |
| `supabase/migrations/0012_combats_pvp.sql` | la trace des parties à deux (#228, D-105) : `combats.mode` admet `'pvp'` à côté de `'solo'` — pas de colonne, pas de politique, pas de droit nouveau |
| `supabase/migrations/0013_discord_comite.sql` | les annonces du mur dans `#comite` (#318, D-120) : la table `annonces_discord`, les deux déclencheurs qui **composent la phrase**, la couture `poster_discord(url, corps)`, la réconciliation de `pg_net`, la passe de dix, le secret lu dans **Vault**, le passé marqué `sans_webhook` — et **aucun privilège client** |
| `supabase/migrations/0016_medaille_periode_essai.sql` | la « Médaille de la période d'essai » (#346, D-130 (3)) : `comptes.medaille_periode_essai` et sa date, la contrainte qui les lie — aucune fonction, aucun déclencheur, **aucun droit** : ce qui ferme ces deux colonnes au client est le `grant update (etat, raison)` **colonne par colonne** de la 0005, et c'est tout (une révocation de colonne ne retirerait rien — les trois lignes de la 0016 qui le prétendaient sont parties, #372) |
| `supabase/migrations/0017_annonce_resume.sql` | l'annonce du post-it porte son **résumé** et ses **points** (#339, D-120) : `phrase_postit_neuf` prend le texte, le premier paragraphe est coupé à 200 et les lignes à puces (quatre au plus) à 100 ; un gueulage reste muet, un texte vide n'ajoute aucune ligne — aucune fonction `security definer` nouvelle, aucun droit client |
| `supabase/imports/comite-fichier-2026-10-26.sql` | l'import des deux post-its de `docs/comite.json` en base (#136) — données, pas schéma : auteur sentinelle, date de collecte reprise de l'id, écran vide devenu `null` |
| `supabase/imports.test.ts` | la garde de l'import : le fichier et l'import disent la même chose, les lignes passent `lirePostitsDeLaBase`, rejouer ne duplique rien |
| `supabase/anon.test.ts` | la garde du droit `anon` : aucune fonction `security definer` ne lui est ouverte, `authenticated` garde les fonctions d'écriture, et le `revoke ... from anon` neutralisé laisse `anon` exécuter |
| `supabase/comptes.test.ts` | la garde des comptes : en attente refusé, approuvé accepté, non-administrateur sans pouvoir, pas d'auto-approbation, drapeau protégé — et chaque contrôle neutralisé laisse passer le fautif |
| `supabase/place.test.ts` | la garde de la place et du retrait : l'auteur range le sien, l'administrateur range et retire tout, un compte en attente rien — et chaque contrôle neutralisé laisse passer le fautif |
| `supabase/comite.test.ts` | la garde du suivi (#209) : `updated_at` monte au changement de statut, et **pas** sur une écriture de place ni une correction de texte ; le repère s'écrit par la fonction et pas en direct ; chacun ne marque que le sien — et chaque contrôle neutralisé laisse passer le fautif |
| `supabase/dates.test.ts` | la garde des dates (#238) : une date de 2030 ou de 2000 fournie à l'insertion d'un commentaire ou d'un post-it est réécrite à l'heure du serveur — et chaque déclencheur, neutralisé, laisse passer la date du client |
| `supabase/discord.test.ts` | la garde des annonces (#318, D-120) : la phrase est vérifiée **mot pour mot**, un gueulage n'emporte ni titre ni texte, une écriture qui nomme `statut` sans le changer n'annonce rien, le transport est **une couture** doublée d'un faux, « remis » n'est pas « livré » (non-2xx, cinquième tentative, quart d'heure muet), dix par passe, le secret vient de Vault, le passé est `sans_webhook`, la table est fermée — et la migration **mutée** laisse voir le doublon, la fuite ou la rafale |
| `supabase/pouces.test.ts` | la garde des pouces : un seul vote par appareil, pas pour soi, pas au nom d'un autre, un vote défait remet le compteur — et chaque contrôle, neutralisé, laisse passer le fautif |
| `supabase/pglite.ts` | le banc d'essai partagé : shim, migrations appliquées dans l'ordre, deux appareils (`mur.test.ts`, `combats.test.ts`) |
| `supabase/mur.test.ts` | la garde : joue **la migration réelle** dans PGlite (PostgreSQL en WASM, RLS comprise) et **exige** que les politiques mordent |
| `supabase/mur-ecriture.test.ts` | la garde des écritures du mur (#138, #139) : commenter, corriger, retirer, trier — un compte en attente refusé, un administrateur qui trie sans réécrire, et chaque contrôle neutralisé laisse passer le fautif |
| `supabase/combats.test.ts` | la même garde pour les combats : un autre appareil ne lit pas, `anon` n'a rien, un auteur forgé est refusé, et la migration mutée fuit |
| `src/lib/supabase.ts` | la configuration, l'identité anonyme et l'écriture d'une ligne côté jeu (inerte sans `.env`) |
| `src/lib/supabase.test.ts` | la garde de la clé : publique seulement, et l'alpha inerte sans backend |
| `src/store/combats.ts` | ce qui est gardé d'un combat solo terminé, et l'envoi silencieux (#173) |
| `src/lib/murBase.ts` | la **couture** du mur (#136) : lit `postits_avec_votes`, poste dans `postits`, retombe sur le fichier sans configuration |
| `src/lib/murBase.test.ts` | la garde de la couture : lecture, écriture sans `auteur`, gueulage sans famille, panne qui lève |
| `.env.example` | les deux noms de variables, avec des valeurs **fausses** |

Les décisions : **D-058** (le mur et ses deux familles), **D-059** (statuts, identité), **D-068**
(les apparences, le gueulage, la disposition en pourcentage). Le contrat de données :
`docs/COMITE.md` §3.

---

## 1. Le schéma, champ par champ

Le contrat de `docs/COMITE.md` §3 est repris tel quel, avec **une** différence :
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
| — | `created_at` | `now()` ; ne bouge jamais |
| — | `updated_at` | `now()` ; monté par le déclencheur `postits_updated_at` **au changement de statut** seul (0008) — ni sur une écriture de place, ni sur une correction de texte. C'est la date que lit le compteur de D-097 (5) |

Pas de clé étrangère de `auteur` vers `auth.users` : une identité **anonyme** peut être purgée
côté GoTrue, et un post-it ne doit pas disparaître avec l'appareil qui l'a écrit. Le pseudo est
recopié sur la ligne, c'est lui que le mur affiche.

### `public.votes`

`(postit_id, votant, sens, created_at)`, clé primaire `(postit_id, votant)` : **un appareil, un
vote par post-it**. Changer d'avis est un `UPDATE` de sa ligne, pas une seconde ligne. Depuis
`0004_pouces.sql`, un auteur **ne vote pas pour son propre post-it** (insertion comme modification).

### `public.commentaires`

`(id bigint identity, postit_id, auteur, pseudo, texte, created_at)`. Les deux tables d'enfants
partent en **cascade** quand un post-it est retiré par son auteur (#139).

### Les règles d'accès (RLS)

`enable row level security` **et** `force row level security` sur les trois tables — sans
`force`, le propriétaire des tables échappe à ses propres politiques.

| Table | Lecture | Écriture |
|---|---|---|
| `postits` | **tout le monde** (`using (true)`) | **insertion** : `auteur = auth.uid()` **et** `public.compte_approuve()` (0005) ; **modification** : un **administrateur** seul, et sur `statut`, `raison` et `ticket` seulement (0006) — le titre et le texte passent par `public.corriger_postit(...)`, par leur auteur et tant que le post-it est `en attente` ; **suppression** : par son auteur, tant qu'il est `en attente` (0006) |
| `votes` | **tout le monde** | `votant = auth.uid()`, pas pour son propre post-it (0004), et `public.compte_approuve()` (0005) |
| `commentaires` | **tout le monde** | `auteur = auth.uid()` **et** `public.compte_approuve()` (0005) |
| `combats` | son **auteur** seul | `auteur = auth.uid()` **et** `public.compte_approuve()` (0005) |
| `comptes` | sa ligne, ou tout pour un **administrateur** | `etat` et `raison` par un **administrateur** seul ; `administrateur` jamais par le client ; `vu_le` (le repère du comité, 0008) **jamais** par le client — il s'écrit par `public.marquer_comite_vu()`, `security definer`, qui ne vise que `auth.uid()` et pose l'heure du serveur |

Une politique par commande, et non une politique `for all` : les politiques permissives
s'additionnent en **OU**, donc la lecture reste ouverte pendant que l'écriture reste fermée.
C'est cette condition (`auteur = auth.uid()`, `votant = auth.uid()`) que la garde remplace par
`true` pour prouver qu'elle mord.

Le rôle **`anon`** (appareil non identifié) n'a **aucun** privilège : `revoke all` dans la
migration. Le jeu signe d'abord (identité anonyme, rôle `authenticated`), puis lit.

## 2. L'identité, côté jeu

`src/lib/supabase.ts` :

- lit **deux** variables, `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Vite n'expose que le
  préfixe `VITE_`) ;
- **refuse** une clé de service (`sb_secret_…`, ou un JWT dont la charge dit
  `"role": "service_role"`) : elle contourne la RLS et n'a rien à faire dans un navigateur ;
- **inerte** quand les deux variables manquent : `configurerMur()` rend `null`, rien n'est
  contacté, et `npm run build` / `npm run capturer` marchent sans configuration. C'est la
  contrainte de l'alpha : le mur lit `docs/comite.json` (D-058) ;
- `identiteAppareil()` rend l'identité de la session persistée, ou en **signe une** anonymement à
  la première visite (`signInAnonymously`, session gardée par `@supabase/supabase-js`) ;
- la bibliothèque est chargée **à la demande** : sans configuration, son code ne part même pas
  dans le premier chargement.

Depuis #136, **le mur s'en sert** : `src/lib/murBase.ts` signe l'appareil avec
`identiteAppareil()` puis lit la vue, et le formulaire du mur poste dans `postits`. Le socle
reste inerte sans configuration.

**Depuis D-088 (#181)**, l'identité d'écriture est un **compte** : `src/lib/comptes.ts` porte
la connexion (Google ou courriel + mot de passe), `src/store/comptes.ts` garde la session et
l'état de la demande, et les écrans `Connexion`, `Attente` et `Administration` s'en servent.
L'identité anonyme **n'ouvre plus la lecture** : la garde d'entrée (`GardeComptes`) renvoie
vers `/connexion` tout visiteur sans compte — décidé par Bastien le 26/10/2026, « il faut un
compte pour entrer dans le jeu ». Elle reste l'auteur des deux post-its d'avant la 0005, et
`identiteAppareil` sait toujours signer un appareil sans compte (les connexions anonymes
restent actives, O-016, #252) ; un appareil anonyme ne peut pas écrire, puisque la 0005 exige un compte
approuvé.

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

> **État au 26/10/2026, mesuré par la session d'infrastructure** : les migrations sont
> appliquées sur le projet `jzlcwnozlzhadatksvgh` (0001 à 0012), et les connexions anonymes sont
> **activées** (`external_anonymous_users_enabled = true`). Une session anonyme lit la vue
> (`200`, deux post-its) ; sans session, la requête est refusée (`401`) — c'est voulu, les
> droits sont donnés à `authenticated` seul. Les deux variables sont posées dans le `.env`
> local **et sur Vercel en production** : le mur de production lit la base.
>
> La machine de développement n'a **ni Docker ni CLI Supabase**, et la session de
> développement n'a **aucun accès** au projet Supabase (pas de MCP : la politique de la maison
> réserve `supabase` à une session d'infrastructure). Les commandes ci-dessous restent la
> procédure pour **un autre projet**, ou pour rejouer une migration future.

### 4.1 Créer (ou retrouver) le projet, et activer l'identité anonyme

**Avant D-088**, il fallait activer *Authentication → Sign In / Providers → **Anonymous
sign-ins*** : sans ce réglage, `signInAnonymously()` répond `Anonymous sign-ins are disabled`,
et la garde de `src/lib/supabase.test.ts` le dit.

**Depuis D-088 et la décision de Bastien du 26/10/2026, ce n'est plus un chemin de lecture** :
l'alpha s'ouvre par un **compte**, et `GardeComptes` renvoie un visiteur sans compte vers
`/connexion`. Le réglage reste **actif** (O-016, #252) parce que le code porte encore l'appel et que
les deux post-its d'avant la 0005 ont été écrits sous cette identité — mais un visiteur neuf
ne lit pas le mur : il voit l'écran de connexion. Mesuré le 26/10/2026 : le réglage
`external_anonymous_users_enabled` vaut `true`, une session anonyme s'obtient
(`POST /auth/v1/signup` → `200`), et avec son jeton la vue `postits_avec_votes` se lit
(`200`, deux lignes) ; sans jeton, `401 permission denied`.

Le même écran active les fournisseurs voulus (**Google**, **Email**) : voir §5.

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

## 5. Les comptes (D-088, #181) — la marche à suivre

La 0005 est **à appliquer par Bastien** dans le SQL Editor, comme 0001 à 0004. Avant elle, rien
ne change (l'identité anonyme écrit encore) ; après elle, **seul un compte approuvé écrit**.

### 5.1 Côté Google Cloud

1. *APIs & Services → OAuth consent screen* : type **External**, nom « Planquex » ; l'écran
   restera en mode *Testing* tant que l'alpha dure (ajouter les testeurs comme *test users* si
   Google l'exige).
2. *Credentials → Create credentials → OAuth client ID*, type **Web application**.
   - **Authorized JavaScript origins** : `https://planquex.4k7.org` (et
     `http://localhost:5178` pour le développement).
   - **Authorized redirect URIs** : `https://<project-ref>.supabase.co/auth/v1/callback` —
     c'est Supabase qui reçoit le retour de Google, pas le jeu.
3. Copier **Client ID** et **Client secret**.

### 5.2 Côté Supabase

1. *Authentication → Providers → **Google*** : activer, coller l'ID et le secret.
2. *Authentication → Providers → **Email*** : activé. **« Confirm email »** : au choix —
   la garde d'entrée n'est **pas** la confirmation, c'est l'approbation manuelle. Le couper
   évite d'attendre un SMTP pour tester ; le laisser impose un serveur d'envoi.
3. *Authentication → URL Configuration* :
   - **Site URL** : `https://planquex.4k7.org` ;
   - **Redirect URLs** : `https://planquex.4k7.org/connexion` et
     `http://localhost:5178/connexion` (le retour OAuth revient sur cette page).
4. **SMTP** (facultatif mais nécessaire aux courriels de confirmation / mot de passe oublié) :
   *Authentication → SMTP Settings*, hôte Brevo (`smtp-relay.brevo.com`, port 587), l'identifiant
   et la clé SMTP Brevo. Les accès Brevo existent déjà.
5. *SQL Editor* → coller **tout** `supabase/migrations/0005_comptes.sql` → *Run*. Puis, pour le
   CLI : `supabase migration repair --status applied 0005`.

### 5.3 Marquer le compte administrateur (une fois)

Se connecter **une première fois** au jeu avec son compte (Google ou courriel) : le déclencheur
crée la ligne `public.comptes` en attente. Puis, dans le SQL Editor :

```sql
-- Le compte de Bastien : approuvé et administrateur.
update public.comptes
   set administrateur = true, etat = 'approuve', raison = ''
 where courriel = 'son@courriel';
-- 1 ligne attendue. Si elle est à 0, le compte ne s'est pas encore connecté.
```

L'écran `/administration` apparaît alors dans Réglages. Le SQL Editor reste le repli pour
approuver à la main :

```sql
update public.comptes set etat = 'approuve' where courriel = 'invite@exemple.fr';
update public.comptes set etat = 'refuse', raison = 'Pas un testeur.' where courriel = '…';
```

### 5.4 Les deux post-its du fichier, importés en base (#136)

`docs/comite.json` porte deux post-its d'avant le mur en base. Ils sont **entrés en base le
26/10/2026** par `supabase/imports/comite-fichier-2026-10-26.sql` — ce n'est **pas** une
migration (aucune forme de schéma ne change) mais un import de données, rejouable
(`on conflict (id) do nothing`), rangé au dépôt pour être relu avant d'être exécuté.

Leur auteur est l'**auteur sentinelle** `00000000-0000-0000-0000-000000000000` : les deux
post-its ont été écrits par des identités **anonymes** d'avant D-088, qui n'ont pas de compte,
et les rattacher à quelqu'un serait inventer un auteur. Aucun `auth.uid()` ne peut valoir cette
valeur, donc le mur ne les montre comme « les tiens » à **personne** : aucun testeur ne les
corrige, ne les déplace ni ne les retire. L'**administration** garde ses droits de tri (0006,
`statut`/`raison`/`ticket`) et de retrait (0007) — c'est le tri normal de D-092, et ces deux
post-its sont `en attente`, donc ils doivent pouvoir avancer. Pour les rattacher à un compte,
un geste explicite :

```sql
update public.postits set auteur = '<uid du compte>' where id in ('…', '…');
```

Le fichier, lui, reste au dépôt : c'est le **contrat de données** (§3 de `docs/COMITE.md`) et
la trace de ce qui a été collecté avant. Il n'est plus la source — la page lit la base, et ne
retombe sur le fichier que si la base ne répond pas.

La garde `supabase/imports.test.ts` vérifie les trois choses qui peuvent diverger en silence :
chaque post-it du fichier **existe** en base (un post-it ajouté au JSON sans être ajouté à
l'import fait échouer le test) ; ses **champs** y sont un à un — texte, place, raison, ticket
compris, puisque le JSON et le SQL sont deux copies ; et la **date** de `created_at` dit la
même heure que l'identifiant (`p-DD-MM-AAAA-HH-MM-SS-…`, heure de Paris), `updated_at` suivant
`created_at` pour qu'aucun compteur ne lise un faux mouvement. Les lignes passent enfin le
**même validateur** que la page (`lirePostitsDeLaBase`).

### 5.5 Ce qu'il faut vérifier après

```sql
-- La table et son RLS
select relname, relrowsecurity, relforcerowsecurity from pg_class where relname = 'comptes';
select courriel, etat, administrateur from public.comptes order by created_at;

-- Un compte non approuvé n'a pas le droit d'écrire (attendu : false)
select public.compte_approuve();
```

Puis, côté jeu : se connecter avec un compte neuf, constater « ton compte attend d'être
validé », tenter de poster (le bouton n'est pas proposé, et la base refuserait), approuver
depuis `/administration`, recharger, poster.

### 5.6 Appliquer la 0006 — le tri, la correction et le retrait (#138, #139)

La 0006 est **à appliquer par Bastien**, **après** la 0005 (elle appelle `est_administrateur()`
et `compte_approuve()`). Avant elle, l'écran d'administration n'a pas le droit d'écrire le tri,
et l'auteur ne peut ni corriger ni retirer son post-it.

1. *SQL Editor* → coller **tout** `supabase/migrations/0006_tri_et_corrections.sql` → *Run*.
2. Pour que le CLI ne la rejoue pas : `supabase migration repair --status applied 0006`.

Ce qu'elle change, et ce qui se vérifie tout de suite :

```sql
-- Le client ne réécrit plus le texte : la correction passe par la fonction.
select has_column_privilege('authenticated', 'public.postits', 'texte',  'update');  -- false
select has_column_privilege('authenticated', 'public.postits', 'statut', 'update');  -- true
-- La fonction existe et n'est ouverte qu'aux comptes connectés.
select proname, prosecdef from pg_proc where proname = 'corriger_postit';            -- t
```

Un **administrateur** trie depuis `/administration` ; un autre compte est refusé **par la
base** : sa modification porte sur **0 ligne**, sans erreur, et le geste `trier` du port la refuse au lieu
de la croire passée. `npm run statut`, lui, ne touche que `docs/comite.json` — la source
de secours — et **le dit** dans sa sortie.

## 6. La garde, et ce qu'elle prouve

`supabase/mur.test.ts` (12 tests), puis `combats.test.ts`, `gueulage.test.ts`, `pouces.test.ts`
et `comptes.test.ts` :

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

## 7. La trace des combats (#173, D-086 ; #228, D-105)

À la fin d'une partie **terminée** — solo ou à deux —, le jeu dépose en arrière-plan de quoi la
**rejouer** : la graine, les deux Decks, les types de café et le journal d'actions. **Rien
d'autre** — ni le pseudo de Réglages, ni un texte libre, ni un identifiant d'appareil : `auteur`
est `auth.uid()`, le compte connecté (D-088 ; D-059 pour les traces d'avant). Le mode est la
seule différence entre les deux : `'solo'`, ou `'pvp'` (D-105). Un relecteur qui rejoue une
trace doit passer `{ deuxCamps: true }` à `replayBattle` quand le `mode` vaut `'pvp'` : l'option
vit dans l'état, et l'oublier compare deux parties différentes (`combats.test.ts` le montre en
la retirant).

Une partie à deux est jouée sur **deux appareils** : chacun dépose sa trace à la fin, et les
deux lignes sont distinctes (`auteur` diffère). Le **siège** tenu par chacun n'est pas une
colonne (D-105 ne demande pas de champ de plus) : deux lignes d'une même partie se
reconnaissent à leur graine et à leur journal, pas à qui ouvrait le camp `player`.

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
| `mode` | `check (mode in ('solo', 'pvp'))` — la partie à deux se trace comme la solo dans la même table (0012, D-105, #228) |
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

**Ce chiffre-là et celui de `combats.test.ts` ne mesurent pas la même chose** : les 3 409 o
viennent de 20 parties **simulées** par le simulateur headless, qui jouent jusqu'au bout ; le
test, lui, joue **douze actions** puis termine au forfait, pour rester rapide. Sa mesure —
1 583 o en solo, **1 580 o à deux** (#228) — sert donc de **comparaison**, pas de référence :
elle dit qu'ajouter le `mode` et les camps du journal ne change pas le coût d'une trace.

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

### Appliquer 0003

Le gueulage de D-085 n'a pas de famille et son identifiant dépasse 32 caractères : sans cette
migration, la base refuse son import et son dépôt depuis le jeu. Comme 0001 : coller **tout**
`supabase/migrations/0003_gueulage.sql` dans *SQL Editor* → *Run*. Elle est **idempotente**
(rejouable sans erreur) et remet à `null` le `kind` de tout gueulage déjà posté avec la famille de
substitution `IP` (le jeu l'envoyait avant D-085). Puis :

```bash
supabase migration repair --status applied 0003
```

Le contrôle qui compte : `npx vitest run supabase/gueulage.test.ts`.

### Appliquer 0004

Les pouces (#137) : un auteur ne vote pas pour son propre post-it. Comme 0001 : coller **tout**
`supabase/migrations/0004_pouces.sql` dans *SQL Editor* → *Run*. Elle est **idempotente**
(`drop policy if exists`, puis `create policy`), ne touche ni aux tables, ni aux droits, ni à la
vue, et retire — s'il en existe — les votes qu'un auteur aurait déjà posés sur son propre post-it.
Puis :

```bash
supabase migration repair --status applied 0004
```

Le contrôle qui compte : `npx vitest run supabase/pouces.test.ts`. **Tant qu'elle n'est pas
appliquée**, l'écran propose quand même les pouces et la base accepterait un vote pour soi
(l'écran, lui, ne propose pas le bouton sur ses propres post-its).

## 8. Ce qui reste humain, précisément

- **Créer ou choisir le projet Supabase** et donner son `project-ref` — fait (#135) ;
- **activer les connexions anonymes** (§4.1) — fait le 23/10/2026 ;
- **appliquer la migration** (§4.2 ou §4.3), et vérifier (§4.4) — fait le 23/10/2026 ;
- **poser les deux variables** en local et sur Vercel — local fait, **Vercel pas encore** ;
- **appliquer la migration 0002** (§6, la table des combats, #173) — pas encore appliquée ;
- **appliquer la migration 0003** (§6, le gueulage, D-085) — pas encore appliquée ;
- **appliquer la migration 0004** (§6, les pouces, #137) ;
- **appliquer la migration 0006** (§6, le tri et les corrections, #138/#139) ;
- **appliquer la migration 0007** (§6, la place et le retrait d'administration, D-092) ;
- **appliquer la migration 0008** (§6, le suivi du comité, #209, D-097) — elle est **idempotente**,
  et son backfill ne réveille personne : les post-its existants prennent `created_at` comme
  `updated_at`, et les comptes existants `now()` comme `vu_le` ;
- **appliquer la migration 0009** (§6, les dates du comité posées par le serveur, #238) — **fait
  le 26/10/2026** (session infra, #247) ; elle est **idempotente** et ne touche aucune ligne
  existante : ses deux déclencheurs ne visent que l'insertion ;
- **appliquer la migration 0010** (§6, les dates du comité figées à l'écriture, #244) — **fait
  le 26/10/2026** (session infra, #247) ; elle est **idempotente** et ne touche aucune ligne
  existante : ses deux déclencheurs ne visent que l'`update` ;
- **appliquer la migration 0011** (§6, `anon` retiré des fonctions `security definer`, #247) —
  **faite le 26/10/2026** (session infra) : `has_function_privilege('anon', 'public.marquer_comite_vu()', 'execute')`
  renvoie `false` ;
- **appliquer la migration 0012** (§7, la trace des parties à deux, #228/D-105) — **faite le
  26/10/2026** (session infra) : `combats_mode_check` vaut `mode in ('solo', 'pvp')`, et la
  trace à deux se dépose comme la solo ;
- **renommer le fichier** en `<horodatage>_mur.sql` **si** le CLI l'exige (non vérifié) ;
- **poser les variables Vercel** : sans elles, la production reste sur le fichier, ce qui est
  l'état voulu tant que la base n'est pas branchée. Le branchement de l'écran est fait (#136) ;
  restent les commentaires (#138) et la modification/retrait (#139).
- **appliquer la migration 0013** (§9, les annonces du mur dans `#comite`, #318/D-120) — **à
  faire** : elle installe `pg_cron` et `pg_net` si la base les propose (mesuré installables le
  27/10/2026), marque le passé `sans_webhook`, et **ne part pas** tant que le secret n'est pas
  dans Vault. La procédure complète est `docs/INTEGRATIONS-DISCORD.md` §10.
- **appliquer la migration 0016** (la médaille de la période d'essai, #346/D-130) — à faire
  **avant** le reset de la beta : c'est elle qui donne au reset la colonne à poser. Elle est
  idempotente et ne touche aucune ligne existante. Vérification après application :

  ```sql
  -- Les deux colonnes existent, et personne ne peut les écrire depuis le client (attendu : false)
  select has_column_privilege('authenticated', 'public.comptes', 'medaille_periode_essai', 'update') as client_ecrit;
  -- La contrainte les lie ; aucune médaille n'existe encore
  select count(*) from public.comptes where medaille_periode_essai;
  ```

  Un `client_ecrit` à `true` veut dire qu'un `grant update` **au niveau table** a été glissé
  quelque part : la 0005 a révoqué celui-là et ne rend que deux colonnes, et c'est **cela seul**
  qui ferme la médaille — la 0016 ne porte aucune ligne de droit, une révocation de colonne ne
  retirant rien (#372). La garde `supabase/comptes.test.ts` fabrique ce cas et le refuse.
- **appliquer la migration 0017** (le résumé et les points de l'annonce, #339/D-120) — à faire
  par le poste de pilotage, comme la 0013 (`docs/INTEGRATIONS-DISCORD.md` §10.3). Elle
  **remplace** la phrase d'arrivée posée par 0013 : l'ancienne signature à quatre arguments est
  retirée, le déclencheur `postits_annonce_neuve` n'est pas retouché. Idempotente, aucune ligne
  existante touchée — les annonces déjà en file gardent le corps composé par 0013.

  ```sql
  -- La signature à cinq arguments, et plus qu'elle (attendu : 1 ligne)
  select oid::regprocedure::text from pg_proc where proname = 'phrase_postit_neuf';
  ```

---

## 9. Les annonces du mur dans `#comite` (#318, D-120)

Le mur **parle** dans le salon `#comite` du serveur des testeurs : un post-it neuf, et chaque
**vrai** changement de statut. Tout vit dans la base — rien n'est hébergé.

### Ce qui sort, et ce qui n'en sort jamais

| Sort | Ne sort jamais |
|---|---|
| la **famille** (IP / OUF), le **titre**, le **pseudo**, le **résumé** du texte (premier paragraphe, 200 caractères), ses **points** (lignes à puces, quatre au plus, 100 caractères), le lien vers `/comite` | le **texte** d'un gueulage (D-085) — on annonce qu'il est arrivé, pas ce qu'il dit ; ni son titre, ni son résumé |
| le **statut** atteint (`retenu`, `en cours`, `fait`, `écarté`) et la **raison** d'un écarté, tronquée | `auteur`, le courriel, l'identifiant du compte, les votes, les commentaires |

Un gueulage s'annonce donc en une ligne, sans famille : `Un gueulage vient d'arriver sur le
mur (pseudo) · lien`. Le pseudo est la seule identité admise — il est déjà public sur le mur.

### La table et les états

`public.annonces_discord` est un **journal** (`postit_id` sans clé étrangère : une annonce
survit au retrait du post-it qu'elle a annoncé). Chaque ligne porte un état :

```text
en attente ──envoi──▶ remis ──2xx────────▶ livre
                         ├──non-2xx───────▶ en attente (nouvel essai)  ──5ᵉ──▶ abandonne
                         └──15 min de silence ▶ en attente              ──5ᵉ──▶ abandonne
sans_webhook : le passé, à l'installation — jamais envoyé, jamais repris
```

- **« remis » n'est pas « livré »** : `pg_net` dépose une requête, sa réponse arrive plus tard
  dans `net._http_response`, et `public.reconcilier_annonces_discord()` la relit.
- **Cinq tentatives, puis abandon** : la tentative est comptée **au départ** de la requête.
- **Dix par passe**, dans l'ordre des ids : 25 annonces se vident en trois passes.
- **Sans secret, rien ne part** : `public.discord_webhook()` lit Vault à l'envoi et rend
  `null` ; la file attend, rien n'est marqué livré.

### Une seule couture

`public.poster_discord(url, corps)` est le **seul** appel à `net.http_post` du dépôt. La garde
le remplace par un faux (`supabase/discord.test.ts`) : aucun test ne parle à Discord, et la
preuve est que `net._http_request` reste vide.

### Ce qu'il faut vérifier après application

```sql
-- 1. La table est fermée aux clients (attendu : false, false)
select has_table_privilege('authenticated', 'public.annonces_discord', 'select') as authentifie_lit,
       has_table_privilege('anon',          'public.annonces_discord', 'select') as anon_lit;

-- 2. Le job est programmé une seule fois
select jobname, schedule, command from cron.job where jobname = 'annonces_discord';

-- 3. Le passé est marqué, et la file est vide
select etat, count(*) from public.annonces_discord group by etat order by etat;

-- 4. Le secret est là — jamais dans le dépôt, jamais dans une migration
select name from vault.decrypted_secrets where name = 'discord_webhook_comite';
```

Puis le contrôle qui compte :

```bash
npx vitest run supabase/discord.test.ts
```
