# Le serveur des testeurs — la procédure d'exploitation

> **Ce document ne s'adresse pas aux testeurs** : le message qu'ils reçoivent est
> `docs/ALPHA-TESTEURS.md`. Ici, la procédure se rejoue par quelqu'un qui n'a **jamais** créé le
> serveur — c'est le critère : ce qui n'est pas écrit ici n'existe que dans la tête de celui qui
> l'a fait. **Rien ne s'écrit dans le code** pour le serveur et les deux intégrations : ils se
> règlent dans des interfaces, et le jeu ne porte qu'un lien. Le **mur**, lui, envoie ses
> annonces par une migration (§10) — c'est le seul morceau qui vit dans le dépôt. Décision :
> **D-118** ; tickets #316 (le serveur et les annonces), #317 (le serveur et sa porte dans le
> jeu) et #318 (les annonces du mur, qui sont la **§10** de ce document).

## Ce que le jeu attend, et ce qu'il n'attend pas

- **Une variable, une seule** : `VITE_DISCORD_INVITE`, l'invitation **permanente**. Vide, le
  jeu n'affiche rien ; c'est l'état par défaut du build, et la CI construit sans elle.
- Le lien est rendu par **`src/components/InvitationTesteurs.tsx`**, seul module qui lit la
  variable, dans **Réglages** et au **pied du comité**. **Aucun `iframe`, aucun script, aucun
  widget Discord** n'entre dans le jeu : la promesse « aucun traceur » de Confidentialité
  reste vraie, et `src/components/InvitationTesteurs.test.tsx` le vérifie.
- **Aucune dépendance npm** n'est ajoutée, et il n'y a **rien à héberger**.

## 1. Créer le serveur

1. Dans Discord : **Ajouter un serveur → Pour un club ou une communauté**. Nom :
   `Bureau des Planqués — alpha` (ou ce qui reste lisible sous l'icône). Icône : celle de
   l'application (`public/icon-512.png`).
2. **Paramètres du serveur → Rôles** : garder `@everyone` pour les testeurs, et créer
   `@Mainteneur` (gestion des salons, des messages, des webhooks) pour l'équipe. Ne donner
   aucun rôle d'administration aux testeurs.
3. **Paramètres du serveur → Modération** : niveau de vérification « Moyen » suffit à cette
   échelle ; pas de bot de modération (hors périmètre de #316).

## 2. Les salons

| Salon | Rôle | Qui écrit |
|---|---|---|
| `#regles` | Les règles, épinglées, en lecture seule | `@Mainteneur` |
| `#comite` | La conversation des testeurs — parties à deux, questions, ce qui marche — et, dès **#318**, les annonces du mur | tout le monde, et le webhook du mur |
| `#depot` | Les **issues**, les **pull requests** et les **CI** du dépôt, poussées par GitHub | les webhooks seulement |
| `#deploiements` | Les déploiements de production et les aperçus de PR, poussés par Vercel | l'intégration seulement |

**Les deux salons techniques vivent hors de `#comite`**, et c'est une règle, pas un goût : un
testeur n'a pas à lire la CI pour parler du jeu, et un webhook qui tombe dans la conversation
la noie. `#regles` se met en **lecture seule** pour `@everyone` (Permissions du salon → Envoyer
des messages : refusé).

## 3. Les règles (à coller dans `#regles`, puis épingler)

```text
Bureau des Planqués — règles du serveur de l'alpha

1. On parle du jeu, de l'alpha et de ce qu'on y vit. Le reste a sa place ailleurs.
2. On ridiculise les postures, jamais les personnes : pas de nom réel, pas de capture qui en
   porte un, pas d'entreprise nommée.
3. Pas de données personnelles : ni adresse, ni courriel, ni identifiant de compte. Ce que tu
   écris ici reste ici.
4. Un bug ou une idée ne se perd pas sur Discord : il va sur le comité, dans le jeu (/comite),
   qui lui donne un statut et un suivi. Discord en parle, le comité le garde.
5. Pas de spam, pas de publicité, pas de revente de ce qui se dit ici.
6. Ce serveur est facultatif : on peut jouer sans, et personne n'y est obligé.
```

## 4. L'invitation permanente

1. **Paramètres du serveur → Invitations → Créer un lien d'invitation**. Expiration :
   **Jamais**. Nombre d'utilisations : **illimité**. Le lien ressemble à
   `https://discord.gg/<code>`.
2. **La recopier dans `docs/ALPHA-TESTEURS.md`**, section « Le serveur des testeurs » (le
   message aux testeurs), à la place du gabarit `<https://discord.gg/…>` : tant que le gabarit
   est là, le message n'est pas prêt à partir.
3. **La poser dans le jeu**, sans jamais la committer :
   - **en local** : copier `.env.example` en `.env` (ignoré par git) et renseigner
     `VITE_DISCORD_INVITE=<invitation>` ;
   - **en production** : Vercel → projet `planquex` → *Settings* → *Environment Variables* →
     `VITE_DISCORD_INVITE`, pour **Production** (et **Preview** si l'on veut la voir dans les
     aperçus de PR), puis **redéployer** : Vite fige la valeur au build, un simple
     redéploiement sans build ne la change pas.
4. Vérifier : `npm run build` **sans** `.env` doit passer (aucune invitation = aucun lien), et
   avec l'invitation, **Réglages** et le pied du **comité** doivent l'afficher en nouvel
   onglet.

L'invitation n'est **pas un secret** — c'est une adresse publique. Le **webhook** de l'étape
suivante, lui, en est un.

## 5. GitHub → `#depot`

1. Dans `#depot` : **Modifier le salon → Intégrations → Webhooks → Nouveau webhook → Copier
   l'URL du webhook**. L'URL ressemble à
   `https://discord.com/api/webhooks/<id>/<jeton>`.
2. Dans GitHub, dépôt `bureau-des-planques/planquex` (`git remote -v` fait foi ; l'ancienne
   adresse `Chapax/planquex` redirige) : **Settings → Webhooks → Add webhook**.
   - **Payload URL** : l'URL du webhook Discord, **suivie de `/github`** — c'est ce suffixe qui
     fait traduire le format GitHub par Discord. Sans lui, Discord répond `400`.
   - **Content type** : `application/json`.
   - **SSL verification** : activée.
   - **Which events** : *Let me select individual events*, puis cocher **Issues**, **Pull
     requests** et **Check runs** (les CI rouges, qu'une Actions rapporte en *check runs*).
     Ne pas envoyer `push` : chaque push ferait un message de plus dans un salon qui doit
     rester lisible.
   - **Si aucune CI n'apparaît** à l'étape 7 : Discord ne traduit pas tous les événements
     GitHub. Revenir ici, cocher **Workflow runs** en plus (ou à la place de *Check runs*),
     puis rejouer le test. C'est le §7 qui tranche, pas ce document : une liste d'événements
     qu'on n'a pas vue arriver n'est pas une procédure, c'est une intention.
3. Discord traduit ces événements en messages ; **le webhook GitHub d'un dépôt privé ne
   publie rien de plus que ce que le dépôt porte déjà** (titres, numéros, résultats de CI).

## 6. Vercel → `#deploiements`

1. Dans `#deploiements` : créer un webhook comme à l'étape 5, et copier son URL (sans suffixe
   cette fois).
2. Vercel → projet `planquex` → **Integrations → Discord → Add Integration** : autoriser,
   choisir le serveur, le salon `#deploiements`, puis les événements de **déploiement**
   (production et aperçus de PR).
3. Rien à écrire : l'intégration est entretenue par Vercel, et le dépôt n'en garde aucune
   trace — c'est voulu (aucun secret dans git).

## 7. Vérifier que ça arrive vraiment

La procédure n'est pas « faite » parce qu'elle est écrite : elle est faite quand **un
événement réel** arrive dans le bon salon.

| Geste | Ce qui doit apparaître |
|---|---|
| Ouvrir une issue de test (`gh issue create`), puis la fermer | un message dans `#depot` |
| Pousser une pull request dont la CI échoue (ou la faire échouer exprès) | un message de CI rouge dans `#depot` |
| Fusionner sur `main`, attendre le déploiement de production | un message dans `#deploiements` |
| Ouvrir l'invitation dans une fenêtre de navigation privée | le serveur est rejoignable, et l'invitation n'expire pas |

Puis supprimer l'issue de test et ses messages : un salon qui garde la preuve d'un test se lit
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

## 10. Le mur s'annonce dans `#comite` (#318, D-118)

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

Comme les autres : coller **tout** `supabase/migrations/0013_discord_comite.sql` dans *SQL
Editor* → *Run* (ou `supabase db push`), puis `supabase migration repair --status applied 0013`.

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
