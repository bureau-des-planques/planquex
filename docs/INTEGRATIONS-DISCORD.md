# Le serveur des testeurs — la procédure d'exploitation

> **Ce document ne s'adresse pas aux testeurs** : le message qu'ils reçoivent est
> `docs/ALPHA-TESTEURS.md`. Ici, la procédure se rejoue par quelqu'un qui n'a **jamais** créé le
> serveur — c'est le critère : ce qui n'est pas écrit ici n'existe que dans la tête de celui qui
> l'a fait. **Rien ne s'écrit dans le code** pour le serveur et les deux intégrations : ils se
> règlent dans des interfaces, et le jeu ne porte qu'un lien. Le **mur**, lui, envoie ses
> annonces par une migration (§10) — c'est le seul morceau qui vit dans le dépôt. Décision :
> **D-120** ; tickets #316 (le serveur et les annonces), #317 (le serveur et sa porte dans le
> jeu) et #318 (les annonces du mur, qui sont la **§10** de ce document).

## Ce que le jeu attend, et ce qu'il n'attend pas

- **Une variable, une seule** : `VITE_DISCORD_INVITE`, l'invitation **permanente**. Vide, le
  jeu n'affiche rien ; c'est l'état par défaut du build, et la CI construit sans elle.
- Le lien est rendu par **`src/components/InvitationTesteurs.tsx`**, seul module qui lit la
  variable, dans **Réglages** et au **pied du comité**. **Aucun `iframe`, aucun script, aucun
  widget Discord** n'entre dans le jeu : la promesse « aucun traceur » de Confidentialité
  reste vraie, et `src/components/InvitationTesteurs.test.tsx` le vérifie.
- **Aucune dépendance npm** n'est ajoutée, et il n'y a **rien à héberger**.

## 1. Le serveur, tel qu'il existe (vérifié le 27/10/2026)

Le serveur a été créé et habillé le **27/10/2026**. Cette section décrit **l'état réel**, pas un
plan : les gestes de création ne se rejouent que si le serveur disparaît.

| Élément | Valeur |
|---|---|
| Nom | `Planquex` (le nom du jeu ; « Bureau des Planqués » reste le titre des messages) |
| Identifiant | `1487523730438492231` |
| Icône | la tasse (`public/icon-512.png`, carré plein de 512 px, sans cadre) |
| Langue | français ; notifications par défaut : **mentions seulement** |
| Salon système | `#général` |
| Vérification | aucune (niveau 0) ; **AutoMod** : 3 règles actives — anti-spam, mentions en rafale, invitations Discord |

**Les rôles**, du plus haut au plus bas : le bot `Planqué` (3), `Équipe` (2), `Testeur` (1),
`@everyone` (0).

| Rôle | Ce qu'il porte | Pour qui |
|---|---|---|
| `Équipe` | Gérer les messages, rendre muet ; voit **tout** | Bastien et ceux qui modèrent |
| `Testeur` | Envoyer, liens, fichiers ; ouvre `ALPHA` et `VOCAL` | les testeurs dont le compte du jeu est validé |
| `@everyone` | 11 droits, ni invitation, ni mention `@everyone`, ni fil, ni épinglage ; ne voit que `ACCUEIL` | les arrivants |
| `Planqué` (bot) | salons, rôles, messages, webhooks, épinglage ; **ni kick, ni ban, ni administrateur** | le MCP `planquex-discord` |

Deux gardes tenues par ce tableau : **aucun droit d'administration aux testeurs**, et le bot
**ne peut pas exclure** — s'il en avait besoin un jour, ce serait une réautorisation OAuth
explicite, pas une permission ajoutée à la main.

Le salon `#regles` est en **lecture seule** pour `@everyone` (Permissions du salon → Envoyer des
messages : refusé) ; `Équipe` et le bot y écrivent.

## 2. Les salons

| Catégorie | Salon | Rôle | Qui écrit |
|---|---|---|---|
| `✦ ACCUEIL` | `#bienvenue` | L'accroche, où jouer, la visite guidée | `Équipe` |
| | `#règles` | Le règlement, épinglé, en lecture seule | `Équipe` |
| | `#annonces` | Versions et déploiements, en lecture seule | `Équipe`, et **Vercel** quand l'intégration est posée (§6) |
| `✦ ALPHA` | `#général` | Le coin café : on parle du jeu | tout le monde |
| | `#comite` | Les annonces du mur, en lecture seule pour `@everyone` | `Équipe` et le webhook du mur (§10) |
| | `#retours` | Ce qui a perdu, ennuyé ou fait sourire | tout le monde |
| | `#parties` | Les codes de partie à deux | tout le monde |
| `✦ ÉQUIPE` | `#game-design` | Règles, cartes, équilibrage | `Équipe` |
| | `#logs-github` | Issues, pull requests et CI du dépôt, poussés par GitHub | le webhook seulement |
| | `#ressources` | Liens, références, outils | `Équipe` |
| `✦ VOCAL` | `🔊 Général` | Le vocal | tout le monde |

**Deux noms ont changé depuis le plan de #317** : `#depot` s'appelle **`#logs-github`** (le
webhook GitHub y était déjà) et `#deploiements` s'appelle **`#annonces`** (versions et
déploiements, en lecture pour les testeurs). La règle de fond ne bouge pas : les **deux salons
techniques vivent hors de `#comite`** — un testeur n'a pas à lire la CI pour parler du jeu, et
un webhook qui tombe dans la conversation la noie. `#logs-github` est en plus dans la catégorie
`ÉQUIPE`, donc **invisible des testeurs**.

Le verrouillage est fait : `@everyone` ne voit que `ACCUEIL`, `Testeur` ouvre `ALPHA` et
`VOCAL`, `Équipe` voit tout, et le bot garde l'accès partout (une autorisation explicite pour
son rôle, sinon il perdrait la vue des salons cachés).

## 3. Les règles

Le règlement épinglé dans `#règles` le 27/10/2026, tel qu'il est écrit sur le serveur. Si le
salon est recréé, coller **ce** texte (les mentions deviennent des liens de salon) et
l'épingler. Ce sont les règles du **serveur** : elles ne remplacent pas celles du jeu, qui vivent
dans `AGENTS.md` §4.

```text
📜 Règlement intérieur

1 · On est entre testeurs.
Ce qui se passe ici reste ici : pas de captures ni d'extraits hors du serveur sans l'accord de
l'équipe.

2 · Un retour utile.
La version, ce que tu faisais, ce qui s'est passé. Le mur du jeu (#comite) est fait pour ça.

3 · Le jeu, jamais la personne.
On critique ce qui ne marche pas, pas celui qui le dit. Ce qui t'a perdu, ennuyé ou fait sourire
compte autant qu'un bug.

4 · Pas de secrets.
Jamais de mot de passe ni de lien de connexion. Un code de partie se donne dans #parties, et
nulle part ailleurs.

5 · Une question ?
Pose-la dans #retours : quelqu'un te répondra.
```

## 4. L'invitation permanente

L'invitation existe depuis le **27/10/2026, 15:12 UTC**, sur `#bienvenue` :

**`https://discord.gg/NvfrzCeJee`** — expiration **jamais**, utilisations **illimitées**.

Elle est donc **publique** (ce n'est pas un secret) et vit à trois endroits, qui doivent dire la
même chose :

1. **`docs/ALPHA-TESTEURS.md`**, section « Le serveur des testeurs » — le message que reçoivent
   les testeurs. C'est fait.
2. **Vercel**, variable `VITE_DISCORD_INVITE`, pour **Production** et **Preview** — posée le
   27/10/2026, puis redéployée. C'est fait ; le lien est visible en production dans **Réglages**
   (« Le serveur des testeurs ») et au pied du **comité**.
3. **En local** seulement si l'on veut voir le lien : copier `.env.example` en `.env` (ignoré par
   git) et y mettre `VITE_DISCORD_INVITE=<invitation>`. Sans `.env`, le build est l'état par
   défaut : **aucun lien**, et c'est ce que la CI construit.

**Recréer l'invitation** (si elle est supprimée, ou pour un serveur neuf) : **clic droit sur
`#bienvenue` → Modifier le lien → Expiration : Jamais → Utilisations : illimitées**. Puis
remplacer la valeur aux trois endroits ci-dessus et **redéployer** : Vite fige la variable au
build, un redéploiement sans build ne la change pas.

Vérifier : `npm run build` **sans** `.env` doit passer (aucune invitation = aucun lien) ; avec
l'invitation, Réglages et le pied du comité l'affichent en nouvel onglet. Les deux emplacements
sont couverts par `src/components/InvitationTesteurs.test.tsx`.

Le **webhook** de l'étape suivante, lui, est un **secret**.

## 5. GitHub → `#logs-github`

Le webhook existe et **fonctionne** (vérifié le 27/10/2026 : dix messages GitHub reçus entre
15:57 et 16:35).

| Réglage | Valeur constatée le 27/10/2026 |
|---|---|
| Dépôt | `bureau-des-planques/planquex` (`git remote -v` fait foi) |
| Payload URL | l'URL du webhook de `#logs-github`, **suivie de `/github`** |
| Content type | `application/json` |
| Événements | `issues`, `pull_request`, `push`, `release`, `workflow_run` |
| Actif | oui |

**Le suffixe `/github` n'est pas décoratif** : c'est lui qui fait traduire le format GitHub par
Discord. Sans lui, Discord répond `400`.

**Rejouer le réglage** : `#logs-github` → **Modifier le salon → Intégrations → Webhooks →
Nouveau webhook → Copier l'URL** ; puis GitHub → dépôt → **Settings → Webhooks → Add webhook**
avec cette URL et ces événements. Si l'URL change, mettre à jour le webhook GitHub, pas le
contraire.

Deux écarts avec le premier jet de cette procédure, mesurés et **assumés** : le salon s'appelle
`#logs-github` (pas `#depot`), et `push` et `release` sont **aussi** envoyés (un message par
push et par tag, en plus des issues, PR et CI). Le salon est dans la catégorie `ÉQUIPE` : ces
messages ne sont **pas** visibles des testeurs. Si le bruit gêne un jour, retirer `push` dans
GitHub — c'est le seul réglage à toucher.

## 6. Vercel → `#annonces`

> **État au 27/10/2026 : pas encore posé.** C'est le seul geste de #317 qui reste à faire, et il
> se fait **dans le tableau de bord de Vercel** : `vercel integration discover discord` répond
> « No marketplace products matching "discord" found », cette intégration native n'est pas
> installable par la CLI. Tant qu'elle n'est pas posée, un déploiement n'annonce rien.

1. Vercel → équipe `chapaxs-projects` → projet `planquex` → **Integrations → Discord → Add
   Integration** : autoriser, choisir le serveur `Planquex`, le salon **`#annonces`**, puis les
   événements de **déploiement** (production et aperçus de PR).
2. Rien à écrire : l'intégration est entretenue par Vercel, et le dépôt n'en garde aucune trace
   — c'est voulu (aucun secret dans git).
3. Vérifier au §7 : le déploiement suivant doit apparaître dans `#annonces`. C'est ce message,
   et pas le réglage, qui dit que l'étape est faite.

## 7. Vérifier que ça arrive vraiment

La procédure n'est pas « faite » parce qu'elle est écrite : elle est faite quand **un événement
réel** arrive dans le bon salon. **État mesuré le 27/10/2026 :**

| Geste | Ce qui doit apparaître | État |
|---|---|---|
| Ouvrir une issue, pousser une PR, faire échouer une CI | un message dans `#logs-github` | ✅ vérifié — dix messages GitHub entre 15:57 et 16:35 |
| Coller un post-it sur le mur | une annonce dans `#comite` (§10) | ✅ vérifié — quatre messages du webhook du mur |
| Fusionner sur `main`, attendre le déploiement | un message dans `#annonces` | ⛔ **non vérifié** — l'intégration Vercel n'est pas posée (§6) |
| Ouvrir l'invitation en navigation privée | le serveur est rejoignable, l'invitation n'expire pas | ✅ vérifié — l'API Discord résout `NvfrzCeJee` sans expiration ; il reste à l'ouvrir une fois dans un navigateur sans compte |

Deux restes de tests sont encore visibles dans `#comite` (messages « Captain Hook » du 27/10) :
les supprimer une fois la vérification terminée — un salon qui garde la preuve d'un test se lit
comme un vrai événement.

## 8. Ce que cette procédure ne fait pas

- **Le bot entrant** (`/ip`, `/ouf` depuis Discord) et **« Se connecter avec Discord »** : hors
  périmètre de #316.
- **Un widget ou un embed** dans le site : contraire à la promesse « aucun traceur » de
  Confidentialité.
- **Les annonces du mur** ne se règlent pas ici : elles demandent une migration et un webhook
  en base, et c'est la **§10** ci-dessous (#318).

## 9. Contraintes Discord à ne pas oublier

- **2 000 caractères** par message : une annonce doit tenir, sinon elle est refusée.
- **Cadence d'un webhook** : de l'ordre de **30 messages par minute** ; au-delà, Discord répond
  `429` et peut abandonner des messages. C'est une des raisons pour lesquelles on n'envoie
  pas `push`.
- **Le webhook est un secret** : quiconque l'a peut écrire dans le salon. S'il fuite, le
  **supprimer**, en créer un autre, et mettre à jour GitHub ou Vercel — jamais le committer.
- **L'invitation permanente** se crée **sans expiration** ; une invitation à durée limitée
  ferait un lien mort dans un message que personne ne pensera à corriger.

## 10. Le mur s'annonce dans `#comite` (#318, D-120)

Depuis #318, le mur **parle** dans `#comite` : un post-it neuf et chaque **vrai** changement
de statut. Ce n'est pas une intégration Discord à brancher à la main — c'est **la base du jeu
qui envoie**, par `pg_cron` puis `pg_net`, et c'est la migration
`supabase/migrations/0013_discord_comite.sql` qui porte tout. Le détail du schéma et des états
est dans `supabase/README.md` §9 ; ici, la procédure.

### 10.1 Créer le webhook de `#comite`

1. Dans `#comite` : **Modifier le salon → Intégrations → Webhooks → Nouveau webhook →
   Copier l'URL**. Elle ressemble à `https://discord.com/api/webhooks/<id>/<jeton>`.
2. Vérifier que ce webhook n'est **pas** celui de `#depot` (celui-là porte le suffixe
   `/github` dans GitHub, pas ici) : le salon ne doit pas recevoir la CI.
3. Ce n'est **pas** une adresse publique comme l'invitation : c'est un **secret**. Il ne va
   ni dans `.env`, ni dans Vercel, ni dans une migration, ni dans `docs/`.

### 10.2 Le poser dans Vault, et nulle part ailleurs

*SQL Editor* → une seule fois :

```sql
select vault.create_secret('https://discord.com/api/webhooks/<id>/<jeton>',
                           'discord_webhook_comite');
```

C'est le nom exact que la migration lit (`public.discord_webhook()`), **à l'envoi** : le secret
n'est jamais recopié dans une ligne d'annonce. Le retirer, c'est arrêter le flux — la file
attend, et **rien n'est marqué livré** :

```sql
delete from vault.secrets where name = 'discord_webhook_comite';
```

### 10.3 Appliquer la migration

Le geste est celui du **poste de pilotage**, pas du SQL Editor : `npm run admin`, puis
l'onglet **Migrations** applique `0013_discord_comite.sql` (route
`POST /api/migrations/<fichier>/appliquer`) — une migration à la fois, dans sa transaction, avec
l'empreinte `sha256` inscrite dans le registre `admin.migrations` (D-091, `tools/admin/`). Une
empreinte qui change est signalée et **non** rejouée.

C'est ce qui a été fait le **27/10/2026** : `0013` est appliquée en production, empreinte
`d3a42bb512fd2ffb…`. `supabase db push` et `supabase migration repair` ne sont **pas** les gestes
de ce projet.

Ce qu'elle fait, dans l'ordre : installe `pg_cron` et `pg_net` **si la base les propose**
(mesuré installables le 27/10/2026), crée la table, ferme la table aux clients, pose les deux
déclencheurs, la couture, la réconciliation, la passe, **programme le job `annonces_discord`
toutes les minutes**, et marque **le passé** `sans_webhook` — le premier jour ne déverse pas
l'historique du mur dans le salon.

### 10.4 Vérifier que ça arrive vraiment

La procédure n'est pas « faite » parce que la migration est appliquée : elle est faite quand
**une annonce réelle** arrive dans le salon.

| Geste | Ce qui doit apparaître |
|---|---|
| Coller un post-it IP sur le mur, attendre une minute | `Nouveau post-it IP — « … » (pseudo) · https://planquex.4k7.org/comite` |
| Coller un **gueulage** | `Un gueulage vient d'arriver sur le mur (pseudo) · …` — **ni titre, ni texte** |
| Trier ce post-it `retenu` depuis `/administration` | `Post-it « … » (pseudo) : retenu · …` |
| L'écarter avec une raison | `… : écarté — <raison> · …` |
| Sonder la file | `select etat, count(*) from public.annonces_discord group by etat;` — les lignes passent à `livre` en une ou deux minutes |

Puis le contrôle qui compte, en local :

```bash
npx vitest run supabase/discord.test.ts
```

Il rejoue **toutes** les migrations dans PGlite, remplace la couture `poster_discord` par un
faux — donc **aucun test ne parle à Discord** — et exige que la migration **mutée** laisse
voir le doublon, la fuite ou la rafale.

### 10.5 Ce que ce flux ne fait pas

- **Il ne répond pas** dans le salon : le webhook n'écrit que des messages, il n'écoute rien.
- **Il ne reprend pas `@everyone`** : le corps porte `allowed_mentions.parse = []`, donc un
  titre qui contient une mention reste du texte.
- **Il ne remplace pas le mur** : un testeur qui n'a pas Discord voit exactement la même chose
  dans `/comite` ; le salon est un **rappel**, la page la source.
