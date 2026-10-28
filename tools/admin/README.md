# Le poste de pilotage local (`tools/admin/`)

`npm run admin` démarre un petit serveur Node sur `127.0.0.1` et ouvre une page qui montre
l'état de l'alpha et permet d'agir — approuver un compte, trier un post-it, appliquer une
migration, exécuter une requête — **sans copier-coller de SQL dans un navigateur**.

Il ne fait **pas** partie du jeu : aucun de ses fichiers n'entre dans le bundle Vite, il n'est
jamais déployé, et il ne peut pas être atteint depuis le réseau.

## Ce qu'il fait

- **État de l'alpha** : comptes par état (dont les approbations en attente), parties terminées
  et leur poids moyen, post-its par statut, volume de la base. Les courriels sont **masqués**
  (`chapax***@gmail.com`) ; une action explicite les révèle, et ce geste entre au journal.
- **Sortie d'alpha** (D-123, #337) : le nombre de **testeurs distincts** ayant terminé une
  partie, croisé aux comptes `approuve`, le seuil de **5** avec son état (atteint / pas atteint),
  la liste des identifiants, et la requête à rejouer ailleurs. Un compte approuvé sans partie ne
  compte pas, une partie d'un compte refusé non plus, et **deux parties du même testeur font un
  testeur** — c'est une personne, pas une partie. Lecture seule, par le rôle `lecteur`.
- **Gestes nommés**, chacun une route : approuver un compte, le refuser **avec une raison
  obligatoire**, le marquer administrateur, trier un post-it (statut, raison, ticket),
  réattribuer les post-its anonymes à un compte choisi.
- **Migrations** : la page liste celles du dépôt, celles qui sont appliquées et celles qui
  manquent, avec leur empreinte `sha256`. L'application se fait **une seule à la fois**, dans sa
  transaction, avec la sortie du serveur ; réappliquer répond « déjà appliquée », une empreinte
  **changée** est signalée et non rejouée. Les migrations appliquées **avant** que le registre
  existe (0001-0006, inscrites le 26/10/2026) sont dites **antérieures au registre** : leur
  empreinte est celle du fichier au rétablissement, pas une preuve, et elles ne sont jamais
  reproposées ni rejouées.
- **SQL libre** : la lecture passe par le rôle `lecteur` (la base refuse l'écriture, pas le
  code) ; l'écriture exige un accusé de réception ; un `drop`, `truncate`, ou un
  `delete`/`update` sans `where` exige en plus de **taper un mot** annoncé par le serveur.
- **Journal** : un fichier JSONL hors du dépôt (`~/.local/state/planquex-admin/journal.jsonl`),
  une ligne par geste — date, geste, rôle, durée, résultat — sans aucune valeur personnelle.
- **Rafraîchissement** : la page relit l'état et les trois listes **toutes les 10 s**, et
  **seulement quand l'onglet est visible** ; au retour sur l'onglet elle relit aussitôt, et le
  bouton **Rafraîchir** le fait à la main. Une inscription arrivée entre deux relectures est
  signalée par un bandeau discret (« 1 nouvelle inscription en attente ») et par le titre de
  l'onglet (`(2) Poste de pilotage`), jamais au premier chargement ni quand le nombre baisse.
  Le rendu ne réécrit que ce qui a changé et laisse intacte une section dont un champ a le
  focus : ni le défilement ni la saisie en cours ne sont perdus.

## Ce qu'il ne fait pas

- Toucher aux cartes, aux règles ni au code : c'est un poste de pilotage de la **base**, pas de
  l'application.
- Créer, supprimer ni réinitialiser des comptes `auth.users` ; faire des sauvegardes ; déployer.
- Accepter du SQL en paramètre d'un geste nommé : seuls la zone de SQL libre (et elle seule)
  exécute du SQL, derrière ses gardes.

## Le lancer

```bash
npm ci              # une fois — installe `pg` (devDependency)
npm run admin
```

Le serveur **refuse de démarrer** sans configuration : créer à la main, hors dépôt,

```bash
mkdir -p ~/.secrets && chmod 700 ~/.secrets
cat > ~/.secrets/supabase-admin.json <<'JSON'
{
  "lecteur": "postgresql://lecteur.<project-ref>:<mot-de-passe>@aws-0-<région>.pooler.supabase.com:5432/postgres?sslmode=require",
  "admin": "postgresql://postgres.<project-ref>:<mot-de-passe>@aws-0-<région>.pooler.supabase.com:5432/postgres?sslmode=require"
}
JSON
chmod 600 ~/.secrets/supabase-admin.json
```

Puis appliquer **une fois** `supabase/admin/roles.sql` dans le SQL Editor (il crée le rôle
`lecteur`, `select` seul), et poser son mot de passe hors dépôt (`alter role lecteur with
password '…'`).

Au démarrage, le serveur **ouvre le navigateur** tout seul sur
`http://127.0.0.1:5199/?jeton=…` (s'il y en a un) ; sinon il affiche l'adresse à ouvrir à la
main, comme avant. Le jeton est exigé sur chaque requête, et **la première visite le pose en
cookie** (`HttpOnly`, `SameSite=Strict`) : inutile de le retaper aux visites suivantes. Le
paramètre `?jeton=` reste accepté (rétrocompatibilité) ; un jeton invalide efface le cookie et
répond 401. Aucun en-tête CORS n'est émis : le jeton ne sort jamais en cross-site.

## Où vivent les secrets

- `~/.secrets/supabase-admin.json` (`chmod 600`), jamais dans un fichier du dépôt, jamais dans
  `.env`, et **jamais transmis au navigateur** : la page parle au serveur, le serveur parle à la
  base.
- Surcharge par l'environnement (pour les tests, jamais le vrai fichier) : `ADMIN_SECRETS_FICHIER`,
  `ADMIN_LECTEUR_URL`, `ADMIN_ADMIN_URL`, `ADMIN_JOURNAL_FICHIER`, `ADMIN_PORT`.
- Le rôle à deux têtes est acté par **D-091** (`docs/DECISIONS.md`) ; la dépendance `pg` est
  signalée dans `AGENTS.md` §1.7.

## Structure

| Fichier | Rôle |
|---|---|
| `serveur.mjs` | point d'entrée : lire les secrets, tirer le jeton, ouvrir le serveur |
| `lib/app.mjs` | le serveur HTTP et ses routes (la couture que les tests exercent) |
| `lib/acces.mjs` | l'interface étroite `{ lire, ecrire }` et sa réalisation `pg` (le pooler) |
| `lib/classification.mjs` | lecture/écriture/destructif, et les statuts du mur |
| `lib/etat.mjs` | l'état de l'alpha et le masquage des courriels |
| `lib/migrations.mjs` | le registre `admin.migrations` (empreinte, déjà appliquée, changée) |
| `lib/journal.mjs` | le journal JSONL hors dépôt |
| `lib/suivi.mjs` | la logique **pure** du rafraîchissement (nouveau ? bandeau, titre, fraîcheur) |
| `page.html` | la page statique (HTML + fetch, aucun build) |
| `admin.test.ts` | la garde : une seule couture, l'API HTTP, sur `pglite`, sans réseau |
| `suivi.test.ts` | la garde de `lib/suivi.mjs` (le calcul du nouveau, muté par `garde-fous`) |