> **Archive datée — un rapport, pas une source de vérité.** Écrit le 04/11/2026, copié dans
> `docs/recherches/` le 04/11/2026 depuis le dossier de travail du chantier CI (dossier
> éphémère, non conservé). Les **chemins locaux** ont été retirés à la copie ; les pièces
> qu'ils désignaient ne sont pas archivées. Rien de ce rapport n'est une règle du jeu :
> `docs/DECISIONS.md` et `AGENTS.md` font foi.

# #707 — Phase 1 : pourquoi la CI est longue

Diagnostic du **04/11/2026**, en lecture seule sur le dépôt et GitHub. **Aucune optimisation implémentée.**

## Synthèse

- Le chemin critique est **`tests des écrans + contrôle visuel`**, pas l'installation : **609 s de médiane, 677 s au pire** sur les 14 passages complets de l'échantillon. Le passage le plus récent, run **41852110963**, dure **647 s**. D-115 fonctionne : les trois jobs sont parallèles ; leurs durées ne s'additionnent pas.
- **`capturer` : 440 s**, soit **72,25 % du job médian** ; tests UI : **81 s**, scan navigateur : **58,5 s**, build : **4 s**. Ces quatre étapes expliquent **95,05 à 97,60 % de chaque passage complet**, donc dépassent le critère de 90 % du ticket.
- Le cache npm est déjà chaud. `npm ci` coûte **8 s** dans les écrans, **9 s** dans chacun des autres jobs. **Aucun navigateur n'est installé** par cette CI : Chrome vient de l'image. Cacher son téléchargement ne gagnerait **rien**.
- Les trois pistes au meilleur rapport potentiel/risque sont **deux captures indépendantes à la fois** (scénario **147–220 s** gagnées), **faire chevaucher captures et scan** (plafond **58,5 s**), puis **ne plus attendre 15 s un Arrivage explicitement refusé faute de configuration** (plafond **15 s**). **Ce sont des estimations, pas des gains mesurés.** Elles conservent les preuves, les trois jobs et leurs noms.
- Le chemin rapide marche : **PR #700 / run 41842448681**, jobs **13 / 59 / 27 s** (contrôles / noyau / écrans). **#695 n'est pas une PR documentaire pure** : elle ajoute `archives-recherches.test.ts`. **#689–#692 sont mixtes à cause de `.prettierignore`**, et #689 modifie aussi `coherence-docs.test.ts`. Le routage observé est conforme à D-143.

## 1. Périmètre, commandes et méthode de mesure

### Sources lues

- `AGENTS.md` §6, §7, §8.4, §11 ; `.github/workflows/ci.yml` ; `docs/COMMANDES.md` ; `docs/ARCHITECTURE.md` §conventions ; `docs/DECISIONS-INDEX.md`.
- D-115 et D-143, obtenues par les commandes demandées, puis D-143 sans troncature :

```bash
grep -E '^\| D-(115|143) ' docs/DECISIONS.md | cut -c1-1800
grep -E '^\| D-143 ' docs/DECISIONS.md
gh issue view 707 -R bureau-des-planques/planquex --json number,title,body,labels,comments
```

- `scripts/ci/ci-chemins.mjs`, `vitest.config.ts`, `src/ci.test.ts`, `scripts/ci/garde-fous.mjs`, `scripts/ci/detect-ui-pages.mjs`, `scripts/preuves/capturer{,-socle}.mjs`, les dix fichiers UI les plus lents.
- La lecture initiale trouvait le dépôt principal propre, HEAD **`d86d7991422a4393198bf862b904684b60dfddb2`**, branche `main`. Aucun changement de branche. Le profil local a utilisé **`origin/main` tel que disponible**, **`6ecc451de00b36732da850df2989ff6bcee92d69`**, sans `fetch` du dépôt principal.

### Collecte GitHub (lecture seule)

```bash
gh run list -R bureau-des-planques/planquex --workflow ci.yml --limit 30 \
  --json databaseId,conclusion,createdAt,headBranch,event
gh api repos/bureau-des-planques/planquex/actions/runs/<id>/jobs --paginate
gh run view 41847922241 -R bureau-des-planques/planquex --json databaseId,conclusion,jobs
gh run view <id> -R bureau-des-planques/planquex --log
gh api repos/bureau-des-planques/planquex/actions/jobs/<job-id>/logs
gh pr view <N> -R bureau-des-planques/planquex --json number,title,files,headRefName,headRefOid,mergeCommit,mergedAt
gh run list -R bureau-des-planques/planquex --workflow ci.yml --branch <branche> \
  --limit 10 --json databaseId,conclusion,createdAt,headBranch,event,headSha
gh api repos/bureau-des-planques/planquex/rulesets/25927666
```

**Instantané de la liste : 04/11/2026 à 15:14:37 UTC.** On filtre `conclusion` non vide puis prend les 15 premiers, dans l'ordre fourni. Les quatre runs alors non terminés sont exclus. On conserve **les échecs**, pas seulement les runs verts. Dans les trois runs rouges, seul `Mesurer la taille des paquets` a échoué ; **les 14 jobs écrans complets ont tous réussi**. Le quinzième run est documentaire et analysé séparément pour ne pas diluer les médianes.

Les durées sont **`completed_at - started_at`**, en secondes, aux timestamps GitHub (résolution de la seconde) ; pas `updated_at`, ni `billing`, ni addition des trois jobs. Une étape `skipped` n'est **pas** comptée comme une exécution de 0 s. Les tableaux complets des 15 runs, y compris le chemin rapide, sont dans [tables.md](tables.md). Le tableau de comparaison des onze workflows intégralement verts est dans [tables-full-success.md](tables-full-success.md) : médiane écrans 618 s, `capturer` 445 s ; le diagnostic ne dépend donc pas de l'inclusion des runs rouges.

Les **parts** ci-dessous sont `médiane de l'étape / médiane du job` ; elles ne sont pas une décomposition additive exacte, car **la médiane d'une somme n'est pas la somme des médianes**. Le contrôle du critère ≥90 % est, lui, fait **run par run**. La part cumulée réelle de `capturer`, toutes exécutions complètes pondérées par leur temps, est **6 144 / 8 532 = 72,01 %**.

Scripts reproductibles, tous hors dépôt :

```bash
Les scripts de collecte (`collect.py`, `collect-extra.py`, `analyze.py`, `details.py`,
`ui-summary.py`, `verify-extraction.py`) ont été joués depuis un dossier de travail
éphémère, hors du dépôt ; ils ne sont pas archivés.
```

Les captures JSON brutes sont `runs-30.json`, `runs-selected.json`, `jobs-<id>.json`, `pr-<N>{,-runs,-commits}.json`, `ruleset-25927666.json` ; les logs utiles sont `log-<id>.txt`, `log-pr-<N>-ecrans.txt`, `log-fast-ecrans.txt`. La CLI du poste ne supporte pas `gh api --slurp` ni le champ GraphQL `baseRefOid` de `gh pr view` : les premières tentatives échouent (sorti 1) ; l'extraction corrigée lit les pages JSON concaténées et les champs disponibles. `rg` n'est pas installé (exit 127), remplacé par `grep`. Ce ne sont pas des échecs de CI.

### Les 15 runs retenus

| run id | événement | branche | verdict | contrôles s | noyau s | écrans s |
|---|---|---|---|---:|---:|---:|
| [41852110963](https://github.com/bureau-des-planques/planquex/actions/runs/41852110963) | PR | agent/671 | succès | 172 | 228 | 647 |
| 41851948898 | push | main | succès | 137 | 225 | 586 |
| 41849994036 | PR | agent/677 | succès | 176 | 180 | 649 |
| 41849887266 | push | main | succès | 142 | 223 | 600 |
| [41847922241](https://github.com/bureau-des-planques/planquex/actions/runs/41847922241) | PR | agent/673 | succès | 167 | 153 | 677 |
| 41847823292 | PR | agent/677 | échec taille des paquets | 174 | 231 | 638 |
| 41844921814 | PR | agent/673 | échec taille des paquets | 152 | 224 | 586 |
| 41844808286 | push | main | succès | 157 | 177 | 584 |
| 41842998824 | push | main | succès | 125 | 230 | 635 |
| 41842987874 | PR | agent/668-correctif | succès | 156 | 219 | 646 |
| [41842448681](https://github.com/bureau-des-planques/planquex/actions/runs/41842448681) | PR | agent/697 | succès, documentation | 13 | 59 | 27 |
| 41842442057 | PR | agent/668-correctif | échec taille des paquets | 124 | 227 | 573 |
| 41838872352 | push | main | succès | 155 | 219 | 551 |
| 41838790853 | push | main | succès | 158 | 225 | 618 |
| 41838706447 | push | main | succès | 116 | 212 | 542 |

### Écrans — détail des 14 passages complets

| repère | étape | médiane s | pire s | run du pire | part du job médian |
|---|---|---:|---:|---|---:|
| E0 | Set up job | 1 | 3 | 41851948898 | 0,16 % |
| E1 | Checkout | 3 | 7 | 41842442057 | 0,49 % |
| E2 | Installer Node + restaurer le cache npm | 2,5 | 13 | 41851948898 | 0,41 % |
| E3 | Calculer les chemins D-143 | 0 | 1 | 41847823292 | 0,00 % |
| **E4** | **`npm ci`** | **8** | **10** | 41847922241 | **1,31 %** |
| **E5** | **Tests `ui`** | **81** | **115** | 41847922241 | **13,30 %** |
| **E6** | **Build** | **4** | **6** | 41852110963 | **0,66 %** |
| **E7** | **`npm run capturer`** | **440** | **462** | 41847922241 | **72,25 %** |
| **E8** | **`npm run detect:ui:page`** | **58,5** | **68** | 41847922241 | **9,61 %** |
| E9 | Post setup-node | 0 | 1 | 41847922241 | 0,00 % |
| E10 | Post checkout | 0 | 1 | 41842998824 | 0,00 % |
| E11 | Complete job | 0 | 0 | tous | 0,00 % |
| E12 | Écarts entre étapes / début-fin du job | 3 | 5 | calcul par run | 0,49 % |
| **JOB** | **Durée du job** | **609 (10 min 09)** | **677 (11 min 17)** | **41847922241** | **100 %** |

**Preuve de couverture :** les quatre étapes E5–E8 couvrent **95,05–97,60 %** du temps de chaque job, voir `verify-extraction.py`. Dans le pire run 41847922241 : **115 + 6 + 462 + 68 = 651 / 677 = 96,16 %**. Sur ce run, le job noyau finit après 153 s, les contrôles après 167 s ; attendre ceux-ci ne résout donc pas les 677 s.

### Contrôles — détail des 14 passages complets

| repère | étape | médiane s | pire s | run du pire | part du job médian |
|---|---|---:|---:|---|---:|
| C0 | Set up job | 1 | 2 | 41847922241 | 0,64 % |
| C1 | Checkout | 3 | 4 | 41849887266 | 1,93 % |
| C2 | Node + cache npm | 3 | 7 | 41838790853 | 1,93 % |
| C3 | Chemins D-143 | 0 | 1 | 41847922241 | 0,00 % |
| C4 | `npm ci` | 9 | 10 | 41849994036 | 5,79 % |
| C5 | Types | 2 | 3 | 41847823292 | 1,29 % |
| C6 | Format | 7 | 8 | 41852110963 | 4,50 % |
| **C7** | **Mutations `garde-fous`** | **118,5** | **137** | **41849994036** | **76,21 %** |
| C8 | Vérifier l'épinglage du détecteur | 0 | 0 | tous | 0,00 % |
| C9 | Détecteur sur les sources | 1 | 1 | tous | 0,64 % |
| C10 | Build | 5 | 6 | 41847922241 | 3,22 % |
| C11 | Vérifier `index.html` / `sw.js` | 0 | 0 | tous | 0,00 % |
| C12 | Taille des paquets | 0 | 1 | 41849994036 | 0,00 % |
| C13 | Post setup-node (11 exécutés, 3 sautés après l'échec) | 0 | 1 | 41852110963 | 0,00 % |
| C14 | Post checkout | 0 | 1 | 41842442057 | 0,00 % |
| C15 | Complete job | 0 | 0 | tous | 0,00 % |
| C16 | Écarts entre étapes / début-fin | 4 | 5 | calcul par run | 2,57 % |
| **JOB** | **Durée du job** | **155,5** | **176** | **41849994036** | **100 %** |

### Noyau — détail des 14 passages complets

| repère | étape | médiane s | pire s | run du pire | part du job médian |
|---|---|---:|---:|---|---:|
| N0 | Set up job | 0,5 | 1 | 41849994036 | 0,22 % |
| N1 | Checkout | 3 | 5 | 41849994036 | 1,34 % |
| N2 | Node + cache npm | 2,5 | 7 | 41842987874 | 1,12 % |
| N3 | Chemins D-143 | 0 | 1 | 41852110963 | 0,00 % |
| N4 | `npm ci` | 9 | 10 | 41851948898 | 4,03 % |
| N5 | Pillow : `apt-get update`, installation, vérification | 8,5 | 12 | 41849887266 | 3,80 % |
| **N6** | **Tests `node`** | **194,5** | **202** | **41847823292** | **87,02 %** |
| N7 | Post setup-node | 0 | 0 | tous | 0,00 % |
| N8 | Post checkout | 0 | 1 | 41847922241 | 0,00 % |
| N9 | Complete job | 0 | 0 | tous | 0,00 % |
| N10 | Écarts entre étapes / début-fin | 3 | 5 | calcul par run | 1,34 % |
| **JOB** | **Durée du job** | **223,5** | **231** | **41847823292** | **100 %** |

### Cache et navigateur : ce qui est réellement mesuré

Dans les logs des runs **41847922241** et **41852110963**, les trois `setup-node` disent **`Cache hit`**, **`Cache Size: ~106 MB (111154372 B)`**, **`Cache restored successfully`** et le chemin **le chemin du cache npm du runner**. Ce n'est **pas** un cache de `node_modules`. La restauration est comprise dans E2/C2/N2 : l'API n'expose pas une sous-étape indépendante. Exemple écrans du run 41847922241 : hit à **14:28:46.634**, restauration réussie à **14:28:49.068**, soit **2,43 s hit→restauré**, inclus dans setup-node, pas à ajouter au tableau.

`.github/workflows/ci.yml:272–302` fournit `/usr/bin/google-chrome` aux deux commandes et vérifie sa présence. **Installation de navigateur : 0 s / aucune étape.** Les logs montrent la commande de version de Chrome, puis le scan. Les références locales à le cache `ms-playwright` du poste sont des replis du poste, pas un téléchargement sur le runner. Le coût de lancement/navigation des navigateurs est, lui, **dans E7/E8**, non isolé par l'API.

## 2. Pourquoi le job écrans est séquentiel et ce qui est refait

### Graphe actuel, observé dans le workflow et les timestamps

```text
checkout → Node/cache → chemins → npm ci → tests ui → build → capturer → détecteur pages
```

Les trois premiers gros traitements **E5, E7, E8** n'ont pas de dépendance fonctionnelle entre eux. **E7 et E8 dépendent du même `dist/`**, donc il faut construire avant eux ; les tests UI n'en ont pas besoin. Actuellement le build attend les UI, puis les captures attendent les UI et le build, puis le détecteur attend les captures.

- **UI et build** pourraient se chevaucher ; **UI et captures** aussi une fois le build fini. Plafond du chevauchement UI avec la branche build+navigateur : **81 s** (E5), mais forte contention CPU/mémoire potentielle avec les forks jsdom.
- **Captures et scan** : ports distincts (**4180** et **4179**), navigateurs distincts, pas de sortie partagée, lecture du même build. Plafond du chevauchement : **`min(440 ; 58,5) = 58,5 s`**, source E7/E8. Il faut attendre et contrôler **les deux codes de sortie**, et fermer les processus même si l'autre échoue.
- **Deux builds** existent bien : contrôles C10 et écrans E6, tous deux `npm run build` (`tsc -b && vite build`). Les contrôles ont déjà lancé `check`, et leur build réutilise donc potentiellement l'incrémental TypeScript local à ce job ; on ne doit pas supposer des durées identiques. L'économie brute d'un seul build est **4–5 s**, pas plusieurs minutes. Aucun troisième build n'est déclaré ; `mesure:paquets`, lancée juste après C10, coûte **0 s médian / 1 s pire**, compatible avec sa réutilisation de `dist/`.
- **Trois installations npm** : 8 + 9 + 9 s de travail médian sur trois machines, mais **au plus 8 s sur le chemin critique** actuel, pas 26 s de mur.

### Ce que fait `capturer`

`scripts/preuves/capturer.mjs:947–1170` enchaîne par `await` : pages + états dédiés, autres graines d'arrivée, états pas-à-pas terminé, Pression sobre, densité détaillée, pire cas sobre, Pression détaillée, puis **cinq gabarits**. Les fonctions internes ont elles-mêmes des boucles séquentielles (`:513`, `:586`, `:631`). Il ne s'agit donc pas d'une unique capture lente.

Décompte **statique**, pas profiler de CPU : **138 contextes neufs** par passage actuel = **19** pages/états + **3** autres graines + **4** arrivées sans pas-à-pas + **8** Pressions sobres + **16** densités + **8** Pressions détaillées + **80** contextes des cinq gabarits (**13 pages hors combat + 3 états combat par gabarit**). Les sources sont la liste des 14 pages, des quatre préparations, des quatre graines et des cinq gabarits. Chaque contexte repart d'un store amorcé, et les scènes restent isolées.

Des attentes intentionnelles sont répétées : `networkidle`, **1 200 ms** après arrivée au tour du joueur (`:140–143`), **500 ms** après attachement, **1 200 ms** après changement de tour (`:475–496`), **300 ms** après pire cas. Le navigateur/IA/rendu ajoutent leur temps. **On ne peut pas supposer que tout ce temps est accélérable avec plus de CPU, ni supprimer ces attentes sans les remplacer par une preuve de stabilité.**

Les logs corroborent les phases (repères, pas mesures instrumentées de fonctions) :

| run 41847922241 | dernier message de la phase |
|---|---|
| Début de l'étape | 14:31:00 UTC |
| Arrivées simples terminées | 14:32:29,193 |
| Pression sobre terminée | 14:33:29,942 |
| Densité détaillée terminée | 14:34:00,596 |
| Pire cas sobre terminé | 14:34:31,177 |
| Pression détaillée terminée | 14:35:32,526 |
| Cinq gabarits + fermeture terminés | 14:38:42,062 |

Les gabarits occupent donc **environ 189,5 s entre ces deux derniers repères**, sans que cette différence constitue un profiler exact des fonctions (fermeture et screenshots entre les repères). Les mêmes phases et le refus de l'Arrivage se retrouvent dans le run **41852110963** ; voir `details.txt`.

**Attente évitable identifiée :** `capturer.mjs:1015–1035` clique l'ouverture, attend `.ouverture` **15 000 ms**, puis seulement dans le `catch` relit le message « Le serveur du jeu n’est pas configuré ». Les deux logs le confirment : `arrivage · non capturé`. Une attente portant sur **l'alternative « scène apparue OU refus explicite affiché »** permettrait de garder exactement la même sémantique et d'éviter jusqu'à **15 s** de timeout nominal. Il ne faut ni sauter un Arrivage configuré, ni transformer une absence silencieuse en succès.

### Profil UI par fichier

Commande réellement exécutée dans un worktree jetable **sans branche**, après `npm run installer`, sous le verrou de charge du projet :

```bash
Un worktree détaché, un `npm run installer` puis `vitest run --project=ui --reporter=json`
sous le verrou de charge du poste ; les chemins du dossier de travail éphémère et de la sortie
JSON ne sont pas archivés.
```

**Résultat : exit 0**, `success: true`, **87 fichiers / 732 tests réussis**, temps mural **43,18 s**, CPU utilisateur **330,25 s**, système **27,18 s**, utilisation CPU **827 %**. Le poste a **12 processeurs logiques** (`nproc`) ; runtime local Node 22, CI Node 24. Le worktree a été supprimé sans `--force`. Les avertissements jsdom sur `HTMLCanvasElement.getContext` figurent dans le log local mais n'ont pas fait échouer la suite. **Ce n'est pas un avant/après de runner** : code, concurrence et environnements diffèrent.

Les durées locales sont `(testResults[].endTime - startTime) / 1000` du reporter JSON. Ce ne sont ni des durées CPU ni un total additionnable au temps mural ; la transformation et l'environnement peuvent se trouver hors de cette fenêtre. Les colonnes CI sont les durées par fichier imprimées par Vitest dans les deux logs, extraites par `ui-summary.py` (87 lignes de fichiers trouvées dans chacun).

| fichier | tests locaux | local s | CI 41847922241 s | CI 41852110963 s |
|---|---:|---:|---:|---:|
| `src/pages/Collection.test.tsx` | 23 | 36,621 | 31,051 | 26,023 |
| `src/pages/Collection.filtres.test.tsx` | 12 | 22,720 | 16,854 | 13,755 |
| `src/pages/Battle.test.tsx` | 97 | 17,802 | 14,625 | 12,774 |
| `src/pages/Collection.finition.test.tsx` | 12 | 16,076 | 12,530 | 10,305 |
| `src/pages/Deck.test.tsx` | 17 | 8,399 | 5,520 | 5,497 |
| `src/pages/CollectionDeck.ecran.test.tsx` | 4 | 6,352 | 4,718 | 4,162 |
| `src/parcours.test.tsx` | 1 | 5,730 | 5,452 | 5,234 |
| `src/components/JourneeIntegration.ecran.test.tsx` | 8 | 5,318 | 0,941 | 3,489 |
| `src/sorties.test.tsx` | 6 | 5,157 | 4,549 | 4,418 |
| `src/pages/Deck.courbe.test.tsx` | 7 | 5,150 | 3,525 | 2,818 |

Les dix sont ceux du classement **local**, pas un classement des médianes CI par fichier sur quinze runs : les JSON de fichiers des anciens runs n'existent pas dans les données collectées. Les commentaires `Lent :` de Collection, filtres et finition expliquent les rendus répétés du catalogue complet ; celui de Battle explique les parties réelles et attentes. **La Collection précède Battle dans ce profil.**

Dans le run **41847922241**, Vitest donne **115,04 s** avec **tests 53 %, environnement 24 %, import 14 %, setup 5 %, transform 4 %**. Dans **41852110963** : **106,09 s**, **51 / 25 / 15 / 5 / 4 %**. C'est une piste pour le démarrage des environnements, mais pas une raison de désactiver leur isolation.

## 3. Pistes classées par gain/risque — estimations uniquement

**Lecture obligatoire :** aucune piste n'a été implémentée ni benchmarkée dans ce diagnostic. Les chiffres ci-dessous sont des **plafonds ou scénarios explicitement hypothétiques**, ancrés dans les lignes E/C/N du tableau. Le gain net peut être nul ou négatif sous contention. Ils ne s'additionnent pas : par exemple un cache de dépendances et un préalable commun remplacent le même temps, et la parallélisation des captures change l'intérêt d'un runner plus gros.

### Top 3 sans changement de règle

| rang | piste et source du chiffre | gain mural estimé | risque et preuve à conserver | règles |
|---|---|---|---|---|
| **1** | **Pool de 2 scènes de captures indépendantes**, même job. E7 = **440 s**, boucles et contextes isolés `capturer.mjs:947–1170` | **147–220 s**, scénario de vitesse effective **×1,5 à ×2** : `440 - 440/1,5` à `440 - 440/2`. **Hypothèse**, pas speedup observé ; **220 s est la limite idéale à 2 voies** | Moyen : contention Chrome/CPU, ordre des fichiers, accumulation des erreurs, pression mémoire. Limiter à 2, noms uniques, aucune suppression de graines/gabarits/états, même contrôle des erreurs et fermeture. Ne pas commencer par `Promise.all` de 138 pages. Comparer inventaire des mesures et captures, cas fautifs, compte des graines, refus et verdict global | **D-115 inchangée** (toujours trois jobs parallèles), **D-143 inchangée**, garde #513 inchangée. Les **trois noms obligatoires restent identiques**. Pas de décision datée nécessaire si toutes les preuves et leur sémantique restent identiques |
| **2** | **Chevaucher `capturer` et `detect:ui:page` après le build**, dans le job écrans. E7/E8 | **0 à 58,5 s**, idéal `440 + 58,5 → max(440 ; 58,5)` ; **58,5 s est un plafond**, à diminuer du surcoût de contention | Faible à moyen : deux navigateurs, ports 4180/4179 déjà distincts. Propager l'échec de **chacun**, attendre les deux, pas de processus orphelin ni de `continue-on-error`. Ne jamais lancer les mutations sur ce même arbre pendant ces lectures | Même **D-115 / D-143 / trois noms**, aucune preuve retirée. Garder build avant les deux et condition documentaire inchangée ; pas de décision datée requise pour le seul chevauchement |
| **3** | **Attendre scène OU refus explicite d'Arrivage**, au lieu du timeout avant lecture du refus. E7 + `capturer.mjs:1017` (**15 000 ms**) ; refus dans logs **41847922241 / 41852110963** | **0 à 15 s**, plafond du timeout par passage sans backend ; refus déjà visible ⇒ presque 15 s possibles | Faible si le contrat reste « refus connu dit et non capturé ; scène configurée toujours attendue et vérifiée ; autre absence = erreur ». Tester scène réussie, refus explicite et silence fautif ; pas de nouveau raccourci fondé sur un secret | Ni D-115 ni D-143 modifiée ; état déjà ignoré avec sa raison, donc pas de preuve retirée. Trois noms inchangés ; pas de décision datée nécessaire pour cette attente équivalente |

**Ces trois candidats sont des expériences de phase 2, pas une promesse de “CI gagnée”.** La première mérite le plus de potentiel, la troisième est le plus petit changement. Une alternative de risque plus élevé est de faire chevaucher aussi les UI avec la branche build+captures : plafond supplémentaire **81 s** (E5), mais forks et Chrome se disputeraient les ressources, contrairement au simple chevauchement de deux lecteurs de `dist/`.

### Toutes les pistes demandées par le ticket

Dans chaque ligne, **les trois noms de contrôle restent ceux du §5**, sauf proposition de topologie qui exige explicitement une décision. Une modification des gardes `src/ci.test.ts` doit préserver leur pouvoir de refus, pas les supprimer pour faire passer le YAML.

| piste | gain chiffré et source | risque / recommandation | effet sur D-115, D-143, garde-fous et décision |
|---|---|---|---|
| **Cache direct de `node_modules`**, à restauration exacte et installation de repli | **Au plus 8 s brut** sur le mur (E4), moins restauration/vérification ; **0–8 s, éventuellement négatif**. Les 9 + 9 s des deux autres jobs ne s'ajoutent pas au mur. Empreinte locale principale **557 Mo / 32 779 fichiers**, mesurée par `du -sh node_modules` et `find node_modules -type f \| wc -l`, pas mesure du transfert CI | Faible intérêt actuel. `npm ci` vide les modules : les restaurer puis continuer à faire `npm ci` annule le bénéfice. Exiger clé OS/architecture/runtime/lock, hit exact, intégrité, fallback ; mesurer restauration/sauvegarde. Le commentaire historique du workflow cite **1,9 Go / 36 625 fichiers**, mesure ancienne différente : ne pas la présenter comme mesure actuelle, ni déduire une vitesse réseau du `du` local | D-115/D-143 inchangées si cache **par job**, pas producteur commun. Noms inchangés. Adapter la garde des conditions de CI avec cas fautifs si ajout de conditions de hit ; pas de décision de périmètre, mais jamais supprimer les tests |
| **Cache de navigateur du poste** | **0 s de téléchargement gagnable** : aucune installation, Chrome fourni par l'image (E2 et §1). Pour un éventuel cache de transformation Vitest : le poste `transform` ne représente que **4,24–4,60 s** dans les deux logs (4 % de 106,09 / 115,04 s), pas 81 s | Ne pas ajouter un gros cache navigateur sans consommation réelle. La suppression de 4,6 s de transformation via cache est elle-même une **hypothèse non démontrée**, chemins/invalidation à identifier ; environnement jsdom n'est pas un cache de navigateur | Pas de changement D-115/D-143 ou des noms ; aucun résultat de test mis en cache à la place d'un passage |
| **Réutiliser `dist/` des contrôles via artefact** | Économie brute **4 s** (E6), environ **9 s de build cumulé → 5 s** de calcul total (C10/E6), mais **pas 9 s de mur**. Avec `needs: controles` avant tout le job écrans : ajout approximatif **155,5 - 4 = 151,5 s**, plus transfert, dans un modèle de jobs synchrones ; ce n'est pas un gain. Un producteur build préalable a aussi son bootstrap/installation | **À écarter à ce stade.** La remarque historique « noyau = chemin critique » du workflow n'est plus actuelle ; les mesures présentes changent le chemin critique, mais un build de 4 s ne justifie toujours pas une dépendance de plusieurs minutes. Aucun temps de transfert d'artefact n'a été mesuré ici. Évaluer sur des runs réels avant toute reconsidération | Un préalable sérialisant les trois jobs contredit l'intention de **D-115** ; **décision datée** avant changement de cette topologie. Le test `src/ci.test.ts` exige actuellement le build **dans le même job** avant les captures/scan ; ne pas l'ôter sans nouvelle preuve de provenance du même SHA/configuration. D-143 doit continuer à éviter le build pour la doc |
| **Fragments UI `--shard`, matrice à 2** | **40,5 s idéal** sur les **81 s UI** (E5) si équilibre parfait, avant bootstrap/artefacts/attente. **Ne divise pas les 440 s de captures**. Plus gros fichier local **36,621 s** : le sharding est par fichier, pas par test ; il ne le coupe pas | Gain secondaire, coût de topologie relativement élevé. Risque déséquilibre, double installation et flakiness ; publier/agréger les rapports, union exacte de la suite. Ne pas dupliquer captures et scan dans chaque fragment | Une matrice remplaçant le job change les contextes rapportés (suffixes de matrice) : **interdit de simplement remplacer le check obligatoire**. Préserver un **agrégateur portant exactement le nom existant**, qui échoue si un fragment échoue/est annulé/absent. Ajouter des jobs/agrégateur modifie le modèle à trois jobs de **D-115 : décision datée requise**. D-143 et la garde de couverture des projets doivent être conservées et adaptées avec cas fautifs |
| **`fileParallelism` / nombre de workers** | **0 s** gagnée en écrivant explicitement `true` : déjà le défaut, aucune désactivation dans `vitest.config.ts`. Ajustement de workers : **gain non mesuré, 0 s retenue pour le budget** ; E5 = 81 s est le poste concerné, pas E7 | Mesurer grille de workers en runner identique avant réglage. `false` force un seul worker selon la documentation Vitest : ne pas le présenter comme “activer le parallèle”. Le local à **827 % CPU / 43,18 s** prouve un parallélisme effectif local, pas une vitesse garantie sur runner | D-115/D-143/noms inchangés. Garder chaque test et l'isolation. Aucun besoin de décision datée si seul réglage d'exécution avec preuve de suite identique |
| **Pool `forks` → `threads`** | **Gain mesuré : 0 s (non testé)**. Scénario de travail : réduire d'un quart la fraction hors tests (~49 % dans le log 41852110963) donnerait `81 × 0,49 × 0,25 ≈ 9,9 s` ; **hypothèse**, pas propriété garantie des threads | Moyen : reset modules, mocks, native modules, mémoire. Comparer le compte et les échecs sur plusieurs passages et garder isolation. Le workflow documente deux essais antérieurs de **`isolate:false` refusés : 46 puis 28 échecs UI** ; ne pas le reproposer comme solution | Pool seulement : D-115/D-143/noms inchangés, pas de décision datée de périmètre. Désarmer l'isolation malgré ces fuites ou retirer les assertions ne serait pas la même piste et serait contraire à D-143(4) |
| **Ne lancer `capturer` que si `src/`, `public/`, `scripts/preuves/` changent** | **Jusqu'à 440 s** économisées **sur un passage complet devenu éligible** (E7), **0 sur une PR doc pure déjà rapide**. Fréquence d'éligibilité future non mesurée ; ne pas multiplier par un taux inventé | **Risque élevé** : exclut `design/` (illustrations réellement embarquées), `package*.json`, `vite.config.ts`, configuration et dépendances susceptibles de changer le rendu. La liste proposée n'est pas un graphe de dépendances suffisant. Ne pas implémenter telle quelle | **Décision datée requise** : élargit D-143 au-delà des PR documentaires et change la garde #513 que `src/ci.test.ts` exige sans autre saut. D-115/noms pourraient rester identiques, mais cela ne rend pas la réduction de preuve autorisée |
| **Mutations des garde-fous en concurrence** | **59,25 s idéal** de réduction du job contrôles avec 2 voies équilibrées (`118,5 / 2`, C7). **0 s de mur gagné actuellement**, job contrôles 155,5 s contre écrans 609 s | Haut risque sur un arbre partagé : plusieurs entrées mutent les **mêmes fichiers** (`styles.css`, `Battle.tsx`, `cards.test.ts`…), et une mutation peut contaminer un test transitif même si ses fichiers cibles diffèrent. Le harnais a un journal unique et restaure chaque mutation dans `finally`. Il faut **des copies isolées par voie**, pas juste paralléliser la boucle `:542–570` ; restaurations et mutations mortes toujours refusées | Respecte D-143(4) uniquement si chaque mutation reste réellement exécutée et isolée. D-115 et noms inchangés si parallélisme interne ; une matrice/nouveaux jobs appelle une décision de topologie. **Aucune autorisation de retirer des gardes**. Faible priorité tant que ce job n'est pas critique |
| **Runners plus gros** | **Gain mesuré : 0 s (non testé)**. Exemple **hypothétique** : UI ×2 ⇒ **40,5 s** (E5), navigateur global −20 % ⇒ **99,7 s** (`(440+58,5) × 0,2`, E7/E8), total scénario **140,2 s** ; les deux facteurs sont des hypothèses, pas une extrapolation du nombre de cœurs | Coût/accès à valider humainement, variance, pas d'accélération linéaire des attentes fixes et tours IA. Le contraste local **43,18 s** / CI médiane **81 s** n'est pas un A/B : Node, code et machine diffèrent. Mesurer `capturer` et UI avant tout abonnement ou changement | D-115/D-143/noms restent identiques si même topologie/couverture ; pas de décision de périmètre nécessaire. Budget/exploitation à autoriser ; ajuster la garde `runs-on` sans affaiblir le contrôle de déclenchement/échecs |

**Documentation technique vérifiée via Context7**, sans lui envoyer de code du projet : Vitest, [performance](https://vitest.dev/guide/improving-performance.html), [`fileParallelism`](https://vitest.dev/config/fileparallelism.html), [`maxWorkers`](https://vitest.dev/config/maxworkers.html), reporters/sharding ; GitHub, [dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) et [artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts). Le sharding distribue des **fichiers** et peut agréger des rapports blob ; désactiver le parallélisme force un worker. Les possibilités documentées ne sont pas des résultats de performance du dépôt.

## 4. Le chemin rapide : vérification des PR citées

Le routeur **ne regarde pas le titre ni le label** : `docSeulement()` exige au moins un fichier et **tous** documentaires (`ci-chemins.mjs:35–44`). `docs/**` est accepté, ou `.md` hors `design/`, `src/`, `supabase/`, `public/`. `.prettierignore` et un `.test.ts` sous `scripts/` sont donc non documentaires. Sans base de PR, **tout push `main` reste complet** (`:85–93`), même après fusion de docs : comportement explicite du workflow, pas un raté du chemin rapide des PR.

| PR | run de PR vérifié | fichiers non documentaires affichés par le routeur | UI / captures / scan | job écrans |
|---|---|---|---|---:|
| **#695** | **41818596359** | **`scripts/gardes/archives-recherches.test.ts`**, avec 8 rapports Markdown | **Tous exécutés**, chemin rapide sauté | **576 s** |
| **#689** | **41801489154** | **`.prettierignore`** et **`scripts/gardes/coherence-docs.test.ts`** | Tous exécutés | **654 s** |
| **#690** | **41814721095** | **`.prettierignore`** ; **aucun `.test.ts` dans ce diff** | Tous exécutés | **654 s** |
| **#691** | **41814788885** | **`.prettierignore`** ; aucun `.test.ts` dans ce diff | Tous exécutés | **653 s** |
| **#692** | **41814844053** | **`.prettierignore`** ; aucun `.test.ts` dans ce diff | Tous exécutés | **648 s** |
| **#700** (ticket #697) | **41842448681** | **Aucun** : uniquement `docs/agents/modeles.md`, `docs/agents/parallelisme.md` | Suite complète UI, build, captures et scan **sautés** ; tests lecteurs de docs **joués** | **27 s** |

Preuve plus forte que le simple diff de PR : les logs **des jobs concernés** (`log-pr-<N>-ecrans.txt`) impriment chaque chemin avec `doc` ou `code` et **`chemin rapide : non`**, ou `oui` pour #700. Les anciens runs des branches #689–#692 ont aussi les étapes UI/captures réussies et la voie rapide sautée dans leurs JSON ; ils ne sont pas ajoutés à la statistique principale des quinze derniers runs.

**Attention au sens de “rejouer les écrans” :** sur #700, on ne rejoue **pas la suite UI entière ni les navigateurs**, mais le routeur joue les **tests `.tsx` qui lisent un document**. Le log rapide montre **5 fichiers / 136 tests**, **10,45 s** de Vitest, **11 s** à l'étape GitHub. C'est le comportement documenté dans le workflow : le job reste actif et rapporte le nom attendu. Le noyau joue son sous-ensemble documentaire **33 s**, garde `npm ci` **7 s** et Pillow **8 s**, total job **59 s**. Les contrôles terminent en **13 s** sans installation npm, build ou mutation. Il n'y a donc pas de preuve d'un défaut de sélection sur ces PR.

Une optimisation de processus, **sans modifier D-143**, est de ne pas mêler un changement de formateur aux actes documentaires quand ils sont indépendants. Pour #690–#692, cela aurait rendu les chemins documentaires ; **le gain futur exact n'est pas mesuré**. L'écart observé entre leurs jobs écrans **648–654 s** et le job documentaire #700 **27 s** est **621–627 s**, **comparaison inter-runs et non résultat d'une modification A/B**. #695 doit garder sa garde d'archives : ne pas la retirer pour forcer un label “doc”. Élargir le routeur à des changements de tests sous prétexte qu'ils lisent une doc serait une modification de la règle des PR mixtes, donc une décision datée, pas un correctif silencieux.

## 5. Règles et protection de `main`

### Noms exacts réellement exigés

L'API en lecture seule `gh api repos/bureau-des-planques/planquex/rulesets/25927666` répond avec `enforcement: active`, `strict_required_status_checks_policy: false` et les trois `context` exacts :

1. **`contrôles (types, format, garde-fous, build)`**
2. **`tests du noyau (projet node)`**
3. **`tests des écrans + contrôle visuel`**

Le ruleset exige une PR, fusion `merge` uniquement, et n'a aucun acteur de contournement. Aucune configuration n'a été modifiée.

### Ce qu'on peut et ne peut pas changer en phase 2

- **Sans nouvelle décision de règle :** parallélisme **interne** borné, suppression d'un timeout inutile à sémantique identique, réglage de workers/pool gardant l'isolation et la suite entière, cache fiable par job. **Conserver les trois jobs, leurs trois noms, les deux projets testés, les mutations, les captures et les scans** ; pas de `continue-on-error`. Un changement de code reste à tester et à mesurer, pas automatiquement accepté.
- **Décision datée nécessaire :** nouveaux jobs/matrice/agrégateur modifiant la topologie de D-115 ; dépendance commune sérialisant les trois jobs ; nouvelle sélection par chemins des captures ou élargissement du chemin rapide à des PR mixtes (D-143(1–3), garde #513). Le nom existant doit être conservé par un véritable agrégateur ou les protections migrées explicitement avec la décision ; une matrice ne vaut pas automatiquement l'ancien contexte.
- **Toujours interdit comme simple optimisation :** `paths-ignore` au niveau workflow, suppression d'un contrôle pour gagner du temps, diminution du nombre de graines/gabarits/états en gardant un vert sans le signaler, mutation parallèle du même arbre, ancien `isolate:false` instable. **D-143(4) : gagner sur les répétitions, pas sur les preuves.**
- `src/ci.test.ts` protège aujourd'hui les trois jobs, le build dans le job écrans avant les deux navigateurs, la couverture exacte des deux projets et **n'autorise que la condition documentaire** pour les étapes. Cela a un coût de mise à jour pour un cache conditionnel ou des fragments ; la garde ne doit pas devenir permissive pour n'importe quel saut. Ajouter de nouveaux jobs sans agréger les verdicts pourrait rendre le check vert alors qu'une preuve a échoué.

## 6. Livraison, vérification et limites

**Toutes les écritures de diagnostic** sont restées dans un dossier de travail éphémère, hors du dépôt. Le seul worktree créé était détaché et a été supprimé. Aucun fichier suivi du dépôt, `AGENTS.md` ou `docs/DECISIONS.md` n'a été modifié ; aucune branche, commit, PR ou action distante n'a été créée. Aucun rerun ou dispatch GitHub ; aucun serveur MCP d'exploitation appelé.

Vérifications de livraison :

```bash
le script de vérification de l'extraction (non archivé)
# OK : 15 runs / 45 jobs ; 14 passages complets des écrans réussis ;
# couverture des 4 étapes 95.05–97.60 % ; UI locale 87 fichiers / 732 tests réussis.
git status --short
# sortie vide
git diff --stat
# sortie vide
`git worktree list` (le worktree de diagnostic n'y figure plus)
# aucune ligne : worktree supprimé
```

La validation des gains réels est **reste à faire en phase 2**, candidat par candidat, sur plusieurs runs réels comparables : même SHA/configuration avant-après, compte/inventaire des preuves identique, médiane **et** pire cas, codes d'échec forcés. Pas de CI déclenchée pour ce diagnostic. `npm run check`, build, mutation et suite complète du dépôt principal **n'ont pas été lancés** : tâche exclusivement diagnostique, sans changement de code ; une exécution des mutations serait contraire à la lecture seule demandée. Seule la suite UI du worktree autorisé a tourné.

**Limites explicites :** une mesure locale UI, pas d'A/B de pool, cache, runner, artefact ou parallélisme ; aucun profil CPU interne de `capturer` ; pas de sous-timestamp GitHub séparant lancement Chrome, cache ou navigation. Les deux logs détaillés ne remplacent pas quinze JSON de durées par fichier. Sur l'échantillon complet, l'attente `createdAt → premier job` est **au plus 3 s** (calcul depuis `runs-selected.json` et `jobs-*.json`) : rien n'indique ici une file d'attente de plusieurs minutes, mais ce n'est pas une garantie pour les runs futurs.
