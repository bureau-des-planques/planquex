# AGENTS.md — Bureau des Planqués

> Projet actif : **`planquex/`** — le dossier local porte le nom du dépôt depuis le 21/10/2026 (D-047).
> Les **versions abandonnées** vivent dans un **dossier frère, hors du dépôt** (§9) : **lecture seule**.
> Ne jamais les utiliser comme source de vérité pour les règles, le vocabulaire, le contenu ou un audit.

## 1. Règles d'or

1. Lire ce fichier. Pour `docs/DECISIONS.md` (155 décisions, 37 000 jetons), ouvrir son **index** (`docs/DECISIONS-INDEX.md`, une ligne par décision) et lire la ou les décisions qui touchent ta zone — pas le journal entier. Un point de règle non tranché par une décision se signale, il ne s'invente pas.
2. Travailler dans `planquex/` sauf demande explicite. Ne pas modifier le **dossier frère des versions abandonnées** (§9).
3. Une affirmation sans commande, test ou fichier cité est une **hypothèse**, pas un fait.
4. Ne pas changer les règles de base, le vocabulaire ou le périmètre sans une décision datée dans `docs/DECISIONS.md`.
5. Ne pas copier le contenu, les règles, les assets ou les pourcentages des **versions abandonnées** (§9).
6. Ne pas ajouter de mécanique maison au mode standard. La seule exception actée est le mot-clé **« Changement de priorité »** (D-004).
7. Ne pas ajouter de dépendance sans nécessité démontrée et sans le signaler. **Dépendances signalées** : `@supabase/supabase-js` (runtime — le client du mur, chargé à la demande) et `@electric-sql/pglite` (**devDependency** — les tests du mur jouent un PostgreSQL réel en WASM, RLS comprise, parce que la machine n'a ni Docker ni CLI Supabase ; #135) et `impeccable` (**devDependency**, version **exacte** — le détecteur d'UI, qui doit tourner sur le binaire installé et **sans réseau**, #146) et les **outils de test d'écran** (**devDependencies** — `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@types/jsdom` : les cinq écrans se **rendent** dans un test, #145) et `pg` (**devDependency** — le client Postgres du **poste de pilotage local** (`tools/admin/`, #184) : il parle au pooler et **ne part jamais** dans le bundle Vite) et `prettier` (**devDependency**, version **exacte** — le formateur, qui remplace un `npx prettier` téléchargé à la volée 6 fois en trois jours ; la CI le vérifie par `npm run format:check`, et `.prettierignore` dit ce qu'il ne touche pas).
8. Après une modification : lancer au minimum `npm run check` et les tests concernés ; si le build est cassé, le dire explicitement.

## 2. Sources de vérité

En cas de conflit, appliquer cet ordre :

1. **`docs/DECISIONS.md`** — décisions actées, datées. Autorité finale. Son **index** (`docs/DECISIONS-INDEX.md`, une ligne par décision, dérivé par `npm run index:decisions`) est la porte d'entrée : on y trouve le `D-NNN`, puis on ouvre sa ligne.
2. **`docs/JEU.md`** — §3 le vocabulaire, §4 la table des règles de jeu, §5 l'écriture des cartes. Chaque ligne de §4 est **sourcée** par D-034 : les captures de l'application (`docs/preuves/astuces-*`) et la recherche documentée (`docs/preuves/regles-*`). Si les deux se contredisent, **la capture l'emporte** et l'écart se signale.
3. **`docs/CARD-SPEC.md` et `docs/FACTIONS.md`** — structure du set, courbes, factions, nommage.
4. **`docs/MIROIR-2026-DELTAS.md`** — écarts connus entre le tableau §4 de `docs/JEU.md` et le jeu de référence 2026, avec leurs sources. Décrit les écarts **et leurs verdicts** (O-008 → D-020, O-009 → D-022) ; il ne reste plus d'écart ouvert sur §4 (O-014 tranché par D-034) : ne pas s'en servir pour modifier une règle sans décision datée.
5. **Le code et les commandes** — ce qui existe réellement. Un écart avec les docs est un bug ou une tâche, pas une nouvelle règle.
6. **`docs/STATUS.md` et `docs/AUDIT-*.md`** — instantanés d'audit datés. Ce ne sont pas des vérités live : relancer les commandes.

**Gelés, hors de l'ordre d'autorité** (D-112) : `docs/PROPOSITION.md` §3–5, `docs/CORRESPONDANCES.md` et `docs/NOMMAGE.md` gardent le vocabulaire d'avant D-026 et D-075 (« Chariot », « Parc », « Rack ») et documentent le **périmètre d'origine**, pas les règles vivantes. Le gel est un acte (D-075, D-083) : on ne s'en sert pas pour trancher un conflit, et on ne les « remet à jour » pas non plus — les règles vivantes sont dans `docs/JEU.md` §4, le périmètre dans `docs/DECISIONS.md`.

**Pour les règles de jeu (`docs/JEU.md` §4), ce qui fait foi** (D-034) : les **captures** de l'application (`docs/preuves/astuces-*`) **et** les **règles établies par la recherche** documentée (`docs/preuves/regles-*`, chaque ligne avec sa citation). Si les deux se contredisent, **la capture l'emporte** et l'écart est signalé. Une règle de §4 qui ne s'appuie sur aucune des deux est une hypothèse.

`docs/MODES-FUTURS.md` **ne fait jamais autorité** : il ne contient que des modes parkés (D-019).

Si deux documents se contredisent, ne pas choisir silencieusement : le signaler, citer les passages, et proposer une correction de doc ou de code.

## 3. Vocabulaire

→ **`docs/JEU.md` §3** — les termes du jeu (Planqué, Stress, Arrivage, Rebut…), la table des
factions et les mots interdits. À lire dès qu'on touche une carte, un texte affiché, un
identifiant ou un libellé.

## 4. Règles du jeu

→ **`docs/JEU.md` §4** — le tableau des règles du mode standard, et ce qui n'en est pas. C'est
lui qui fait foi.

## 5. Écriture des cartes

→ **`docs/JEU.md` §5** — raretés, identifiants, évolution, COMEX, effets, textes, flavour, stats.

## 6. Architecture et conventions

Application **Vite plate** ; le monorepo de `PROPOSITION.md` §6.1 est une cible : ne pas restructurer sans décision. **`docs/ARCHITECTURE.md`** porte l'arborescence et le détail de chaque ligne ci-dessous (outils `tools/`, modules du moteur, store, versions, CI, PWA, CSS/Tailwind, comité/Supabase, illustrations/gflow, configuration OpenCode) : le lire avant de toucher la zone concernée.

- **TypeScript strict**. Alias `@/` → `./src`, déclaré dans `tsconfig.json` **et** `vite.config.ts`.
- **UI en français**, identifiants de code en anglais. Aucun texte de carte hors de `src/data`.
- **Moteur** : code pur, sans React ni DOM. `applyAction(state, action)` et fonctions de transition, `structuredClone` pour cloner. Le hasard vient d'un générateur **seedé** (`src/game/rng.ts`) : aucun `Math.random()` dans `src/game/` ni `src/store/`. `applyAction` est le seul point qui journalise (`actionLog`), `replayBattle` rejoue une partie.
- **Store** : Zustand + `persist`, clé `bureau-des-planques-v1`, forme versionnée par `migratePersisted` (`src/store/useStore.ts`, seule source du numéro). Toute modification de forme se migre.
- **Données** : un fichier par faction, puis `src/data/index.ts` (`ALL_CARDS`, `CARD_BY_ID`, métadonnées). Cartes Action dans `actions.ts`, socle dans `planque.ts`, `FACTION_META` (`factions.ts`) seule source de la Vulnérabilité et de la couleur. Le vocabulaire partagé (`CAMP_NAME`, `cafeLabel`) vit dans `src/data/vocabulaire.ts` : un fait, un fichier (#248).
- **Version** : lire `docs/VERSIONS.md` avant d'écrire un numéro.
- **Tests** : Vitest, `*.test.ts` à côté du code. Pas de test = pas de preuve.
- **Garde-fous** : une assertion qui garde une **règle** doit **pouvoir échouer**. Deux moyens : (1) un test « **le contrôle mord** » qui confronte le contrôle à un **cas fautif** ; (2) une entrée dans **`scripts/ci/garde-fous.mjs`** (table courte, commentée : **ticket**, **règle** gardée, **tests ciblés**), mutée par `npm run garde-fous`. La table elle-même est surveillée par `scripts/ci/garde-fous.test.ts`.
- **Effets de bord d'un test** : un test n'ouvre ni navigateur ni fenêtre sur le poste de l'utilisateur ; `src/test/setup-poste.ts` fait échouer tout `spawn` d'ouverture (`xdg-open`, `open`) — injecter le lanceur, comme `ouvrirNavigateur(url, lancer)`.
- **CI** : `.github/workflows/ci.yml`, sur `push` et `pull_request` vers **`main`** — **trois jobs en parallèle** (D-115) : `controles` (`check`, `format:check`, `garde-fous`, détecteur d'UI, `build`, artefacts), `tests-noyau` (`npm test -- --project=node`) et `tests-ecrans` (`--project=ui`, puis `build`, `npm run capturer` et contrôle des écrans). Le temps mural est un **maximum**, pas une somme. **Chemin rapide** (D-143, #422) : une PR qui ne touche que de la documentation (`docs/**`, `*.md` hors `design/` et `src/`) ne rejoue que les tests qui **lisent un document** (`scripts/ci/ci-chemins.mjs` les calcule) ; les trois jobs tournent toujours, sans `paths-ignore`. Les **fichiers générés** (`plan-dev.ts`, `versions.ts`) n'y sont **pas** vérifiés (D-113) : `fichiers-generes.yml` s'en charge sur un tag `v*`, et `docs/VERSIONS.md` §4 le fait faire en local avant de taguer.
- **CSS** : une seule feuille, `src/styles.css`. Tailwind v4 (CSS-first) est le moteur de style, shadcn/ui ne sert qu'aux composants génériques ; le système visuel vit dans `DESIGN.md`.
- **Preuve de rendu** : un écran ne se déclare rendu que par capture ou inspection du navigateur, pas par la lecture du JSX ; une animation, par une **planche de frames** (`scripts/preuves/filmer-animation.mjs`), pas par un style calculé. Voir §8.4.
- **Le serveur des testeurs (D-120, #317)** : un serveur Discord **facultatif** pour les testeurs de l'alpha. Le client ne porte **qu'un lien** : l'invitation vit dans `VITE_DISCORD_INVITE`, lue par **un seul module** (`src/components/InvitationTesteurs.tsx`) ; vide = rien de rendu, et le build sans configuration reste l'état par défaut. Le lien s'affiche dans **Réglages** et au **pied du comité**, en nouvel onglet, `rel="noreferrer noopener"`. **Aucun `iframe`, script ou widget** Discord n'entre dans le jeu : la page Confidentialité promet « aucun traceur ». La **procédure d'exploitation** — salons `#comite` / `#depot` / `#deploiements`, règles, webhook GitHub, intégration Vercel, invitation permanente — est dans **`docs/INTEGRATIONS-DISCORD.md`**, rejouable par quelqu'un qui n'a jamais créé le serveur ; le message aux testeurs, lui, est **`docs/ALPHA-TESTEURS.md`**.
- **Garde-fou visuel** : `npm run detect:ui` (sources) et `npm run detect:ui:page` (écrans servis, avec cliquet), lancés par la CI. Un refus se corrige ou se désactive avec sa raison (`<!-- impeccable-disable <règle> -->`).
- **MCP `gflow`** : `gflow_generate_video`, `gflow_upscale_video` et `gflow_download_media` **dépensent des crédits Veo** ; seuls les outils image sont autorisés. Passer `gflow_auth_status` avant toute génération. Le modèle se passe par son **alias** (`nano2`, `nano2-lite`, `nano-pro`, `image4`), jamais par le nom humain : `bash scripts/ressources/illustration-vague.sh --modele "<nom>"`.

## 7. Commandes

Tableau des commandes, wizards et gotchas : **`docs/COMMANDES.md`**, depuis `planquex/`. Après une modification : `npm run check`, `npm test`, `npm run garde-fous`, `npm run build` (§8.4).

- **Où vit un script** : `scripts/` a **cinq dossiers par métier** — `preuves/` (mesurer), `generateurs/` (écrire), `ci/` (la chaîne), `ressources/` (ce que le jeu sert, et le poste), `gardes/` (les tests de cohérence). Un script se pose **dans un dossier**, jamais à la racine de `scripts/` : `scripts/gardes/rangement.test.ts` le garde (#485, D-154), et `docs/ARCHITECTURE.md` dit ce qui va où.

- **Installer les dépendances** : `npm run installer` dans le worktree. `npm ci` vide `node_modules/` et ne se lance jamais dans le dépôt principal (`scripts/ressources/installer.mjs` le refuse).
- **Formater** : `npm run format` (écrit), `npm run format:check` (vérifie, ce que la CI lance). Un fichier de données de carte (`src/data/`) n'est **pas** reformaté : un texte par ligne, un repli changerait le texte affiché.
- **Lire un ticket** : `gh issue view N --json number,title,body,labels,comments`. Sans `--json`, `gh` échoue (Projects classic), à chaque fois. Même cause, autre commande : **`gh pr edit --body-file` échoue aussi** — pour réécrire le corps d'une PR, passer par `gh api --method PATCH repos/<org>/<dépôt>/pulls/<n>` avec un JSON `{"body": …}`.
- **Écran blanc en dev** (asset répondu en `200 text/html`) : service worker du build resté sur cette origine — `docs/COMMANDES.md` §7.1.

## 8. Audits

Un audit est une **preuve**, pas une opinion. Il se fait toujours sur `planquex/`, jamais sur les **versions abandonnées** (§9).

### 8.1 Protocole

1. Lire `AGENTS.md`, `docs/DECISIONS.md`, puis les docs concernés.
2. Lancer les commandes de référence et noter **commande exacte, exit code, extrait exact**.
3. Distinguer explicitement **observé** (commande/fichier) et **non vérifié** (déduit).
4. Ne jamais conclure « fait » sans test, build, capture ou sortie de commande.
5. Vérifier le code, pas seulement les docs. `docs/STATUS.md` est un instantané daté.
6. Signaler les blocages préexistants au lieu de les masquer ou de les attribuer à la modification en cours.

### 8.2 à 8.3 et 8.5 — batterie, pièges, format de rapport

La batterie de référence, les pièges connus et le gabarit de rapport sont dans `docs/agents/audit.md`.

### 8.4 Definition of done

Pour une modification de code :

- `npm run check` : exit 0.
- `npm run format:check` : exit 0 (ou `npm run format` l'a fait).
- `npm test` : exit 0, avec au moins un test couvrant le changement.
- `npm run garde-fous` : exit 0 — et toute garde **nouvelle** est ancrée (un test « le contrôle mord » qui la confronte à un cas fautif, ou une entrée commentée dans `scripts/ci/garde-fous.mjs`). Une assertion qui **ne peut pas** échouer ne compte pas comme un test.
- `npm run build` : exit 0, `dist/index.html` et `dist/sw.js` présents.
- `npm run ci:etat` : exit 0 avant de **fusionner** vers `main` — si `main` est rouge, on ne fusionne pas sans savoir pourquoi (D-115, #258).
- Aucune occurrence de `Galère` dans `src/`.
- Docs mises à jour si une règle, un vocabulaire, un contenu ou une décision change.

Pour une modification de documentation seule :

- Liens et chemins valides.
- Commandes citées réellement exécutables.
- Aucune contradiction avec `docs/DECISIONS.md`.
- Date de vérification mise à jour si l'état des commandes change.

## 9. Legacy

Les **versions abandonnées** du projet sont conservées comme **référence historique**, dans un **dossier frère, hors du dépôt** (dans `gamedev/`) : la première version en JavaScript avec son prototype, la version « pocket », et l'APK de référence décompilé. Ce qu'elles portent — le vocabulaire « Galère », les règles maison `RULES-4b` (12/4/3), 38 cartes, une application plate — n'a **aucune valeur de règle** ici.

Elles sont en **lecture seule** : on peut y consulter une idée d'UI ou l'inventaire fonctionnel de l'APK, jamais y travailler, et **jamais** les prendre pour source de vérité du vocabulaire, des règles, du contenu ou des pourcentages (§1.2, §1.5). Chaque dossier d'archive porte son `LEGACY.md`, qui dit ce qu'il est.

## 10. Agent skills

### Issue tracker

Les tickets vivent dans GitHub Issues sur `bureau-des-planques/planquex`, piloté par la CLI `gh`. Voir `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq rôles de triage canoniques utilisent leurs noms par défaut (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Voir `docs/agents/triage-labels.md`.

### Domain docs

Contexte unique. Le vocabulaire est `docs/JEU.md` §3, les règles §4, l'écriture des cartes §5 ; les décisions sont `docs/DECISIONS.md`. Voir `docs/agents/domain.md`.

### Parallélisme

Quand plusieurs agents travaillent en même temps : **zones** de fichiers, **modèle adapté à la
tâche**, vagues disjointes, protocole de fusion et ses pièges. Voir
**`docs/agents/parallelisme.md`** — lire avant de lancer plus d'un agent.

## 11. Branches et fusion

D-113 (26/10/2026). Le modèle est **GitHub flow** : une seule branche longue, `main`, toujours déployable.

- Un ticket se travaille sur une **branche dédiée dans son propre worktree**, créée depuis **`main`**, et se propose par **pull request** vers **`main`**. La branche se supprime après la fusion.
- **Fusion : merge commit uniquement**, jamais de squash ni de rebase. Les agents **citent leurs hashes** dans leurs rapports, `git branch -d` (skill `cloture`) ne vaut qu'après un merge commit, et un ticket entier se défait par `git revert -m 1 <merge>`. Sujet : `merge: <ce que ça change> (#N)`. `git log --first-parent main` donne la vue « un ticket, une ligne ».
- **Les réglages du dépôt font foi** : sur `bureau-des-planques/planquex`, seules la fusion par **merge commit** et la **suppression de la branche après fusion** sont activées (26/10/2026) — le squash et le rebase n'y sont même pas proposés. Depuis le 27/10/2026, un **ruleset** les y tient et le dépôt est public (D-118).
- **La protection existe depuis le 27/10/2026** (D-118, #267). Le dépôt public débloque les **rulesets**, gratuits ; celui de `main` — `main protégée (#267)` — exige une **pull request**, les **trois jobs** de `ci.yml` (`contrôles…`, `tests du noyau…`, `tests des écrans…`), et **zéro approbation** tant que Bastien est seul membre : GitHub interdit d'approuver sa propre PR, une approbation exigée le bloquerait. La **liste de contournement est vide** : un push direct est refusé, checks ou pas, propriétaire compris. Avant cette date, sur un dépôt privé, l'API répondait `403` (« Upgrade to GitHub Pro… ») et les gardes étaient seulement en amont : CI de la PR, aperçu Vercel, `npm run isolation`, les quatre commandes de §8.4.
- **Le dépôt du jeu est public, l'exploitation est privée** (D-118) : `bureau-des-planques/planquex-infra` porte le lieu de session, la skill `infra-planquex` et les runbooks. `supabase/migrations/` **reste ici** : `supabase/pglite.ts` la lit par un chemin relatif et la CI la rejoue en PostgreSQL WASM ; un dépôt public dont la CI dépend d'un dépôt privé demanderait un jeton.
- **Pas de branche `dev`.** Elle a été retirée le 26/10/2026 (son contenu était déjà sur `main` ; le dernier état reste au tag `archive/dev-2026-10-26`). Une session qui n'a pas de ticket prend une branche jetable issue de `main`.
- La CI des PR est celle de `main` (§6). Les fichiers générés se vérifient **à la release**, pas à chaque PR (§6, `docs/VERSIONS.md` §4).
- Fermer, ouvrir ou re-étiqueter une issue **`alpha` ou `beta`** périme `src/data/plan-dev.ts` : `npm run plan:dev` quand on prépare une release. Le générateur lit **les deux** étiquettes (#336, D-133) : le label dit le **jalon**, pas la fenêtre de travail.
- Les règles de parallélisme (zones, worktrees, `npm run isolation`, modèles) sont dans `docs/agents/parallelisme.md`.
