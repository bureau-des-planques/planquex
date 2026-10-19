# AGENTS.md — Bureau des Planqués

> Projet actif : **`grevomon-tcg/`**. Dernière vérification des commandes : **19/10/2026 (CEST)**.
> `grevomon-pocket/` est **legacy** : voir `../grevomon-pocket/LEGACY.md`.
> Ne jamais l'utiliser comme source de vérité pour les règles, le vocabulaire, le contenu ou un audit.

## 1. Règles d'or

1. Lire ce fichier et `docs/DECISIONS.md` avant toute modification.
2. Travailler dans `grevomon-tcg/` sauf demande explicite. Ne pas modifier `grevomon-pocket/`.
3. Une affirmation sans commande, test ou fichier cité est une **hypothèse**, pas un fait.
4. Ne pas changer les règles de base, le vocabulaire ou le périmètre sans une décision datée dans `docs/DECISIONS.md`.
5. Ne pas copier le contenu, les règles, les assets ou les pourcentages de `grevomon-pocket/`.
6. Ne pas ajouter de mécanique maison au mode standard. La seule exception actée est le mot-clé **« Changement de priorité »** (D-004).
7. Ne pas ajouter de dépendance sans nécessité démontrée et sans le signaler.
8. Après une modification : lancer au minimum `npm run check` et les tests concernés ; si le build est cassé, le dire explicitement.

## 2. Sources de vérité

En cas de conflit, appliquer cet ordre :

1. **`docs/DECISIONS.md`** — décisions actées, datées. Autorité finale.
2. **`docs/PROPOSITION.md` §3–5** — règles, contenu, périmètre validés par les décisions D-003, D-005, D-006, D-011, D-014.
3. **`docs/CARD-SPEC.md` et `docs/FACTIONS.md`** — structure du set, courbes, factions, nommage.
4. **`docs/MIROIR-2026-DELTAS.md`** — écarts connus entre le tableau §4 et le jeu de référence 2026, avec leurs sources. Décrit ce qui **reste à trancher** (O-008, O-009) : ne pas s'en servir pour modifier une règle sans décision datée.
5. **Le code et les commandes** — ce qui existe réellement. Un écart avec les docs est un bug ou une tâche, pas une nouvelle règle.
6. **`docs/STATUS.md` et `docs/AUDIT-*.md`** — instantanés d'audit datés. Ce ne sont pas des vérités live : relancer les commandes.

`docs/MODES-FUTURS.md` **ne fait jamais autorité** : il ne contient que des modes parkés (D-019).

Si deux documents se contredisent, ne pas choisir silencieusement : le signaler, citer les passages, et proposer une correction de doc ou de code.

## 3. Vocabulaire

Le jeu est en **français**. Le code peut garder des identifiants anglais, mais l'interface, les cartes et les docs emploient les termes du projet.

### 3.1 Termes de base

| Terme TCG / anglais | Terme projet | Code / note |
|---|---|---|
| Pokémon | **Planqué** | `Card`, `CardInstance` |
| Basic / Stage 1 / Stage 2 | **N+1 / N+2 / COMEX** | `Stage` |
| ex | **Cadre** | `ex: true`, vaut **2 Primes** |
| HP | **Moral** | `hp` |
| Energy | **Café** | `energy` |
| Energy Zone | **Machine à café** | `energyZone` |
| Attack | **Pression** | `Attack` |
| Ability | **Talent** | `ability` |
| Item | **Objet** | carte Action |
| Supporter | **Collègue** | carte Action |
| Tool | **Outil** | extension ultérieure |
| Stadium | **Lieu** | extension ultérieure |
| Prize / point | **Prime** | `points`, 3 pour gagner |
| Weakness | **Vulnérabilité** | `weakness`, +20 |
| Resistance | **— (supprimée)** | aucune |
| Retreat | **Relève** | `retreat` |
| Poison | **Surcharge** | `SURCHARGE` |
| Burn | **Burn-out** | `BURNOUT` |
| Sleep | **Bloqué** | `BLOQUE` |
| Paralysis | **Gelé** | `GELE` |
| Confusion | **Dérive** | `DERIVE` |
| Deck | **Classeur** | `deck`, 20 cartes |
| Hand | **Courrier** | `hand`, 5 au départ, 10 max |
| Discard | **Archive** | `discard` |
| Bench | **Open-space** | `bench`, 3 places |
| Active | **Poste** | `active` |
| Coin flip | **Lancer de tampon** | pile = tampon, face = agrafe |
| Mulligan | **Reprise de poste** | aucune carte de base en main |
| Pack | **Bac à courrier** | 5 cartes |
| Wonder Pick | **Pause café** | 5 cartes, 1 rare minimum |
| Collection | **Galérodex** | ne pas dire « Classeur » seul |
| Mission | **Note de service** | |
| Shop | **Économat / Boutique du CSE** | |
| Premium Pass | **Cotisation** | |
| Friend | **Camarade** | |
| Trade | **Échange de postes** | |
| Ranked | **Échelon** | |
| Present Box | **Casier** | |
| Card Skin | **Autocollant** | |
| Tutorial | **Journée d'intégration** | |

**Interdits dans les données, l'UI et les textes du jeu** : `Galère`, `GalèreMon`, `Grèvomon`, `Pokémon`. Les docs peuvent citer « Pokémon TCG Pocket » comme référence externe. Le nom propre **Galérodex** est conservé pour la collection ; « Galère » seul ne doit jamais apparaître dans le code, les cartes ou l'UI.

### 3.2 Factions

| Faction (code) | Type | Vulnérable à | Carte signature |
|---|---|---|---|
| `SSE` | Plante | `MANAGER` | Médecin du travail |
| `MANAGER` | Feu | `HAPPINESS` | Directeur général |
| `HAPPINESS` | Eau | `AMELIORATION` | Chief Happiness Officer |
| `AMELIORATION` | Électricité | `TECHNICIEN` | Directeur qualité |
| `RH` | Psy | `DIRECTION` | DRH |
| `TECHNICIEN` | Combat | `RH` | Chef d'atelier |
| `DIRECTION` | Obscurité | `TECHNICIEN` | PDG |
| `SYNDICAT` | Métal | `MANAGER` | Secrétaire général |
| `INTERIMAIRE` | Dragon | Aucune | Intérimaire légendaire |
| `SUPPORT` | Incolore | `TECHNICIEN` | Responsable support |

Stades : **N+1 → N+2 → COMEX**. Un Planqué porte **une seule** faction : le double type du jeu de 2026 est hors périmètre (D-020). Raretés codées : `1D`, `2D`, `3D`, `4D`, `1S`, `2S`.
La cible `CARD-SPEC.md` contient aussi **3 étoiles** et **Couronne** : à ajouter aux types, aux métadonnées et aux tests avant de les utiliser.

## 4. Règles du jeu

Le mode standard est un **miroir de TCG Pocket**. Aucune valeur mathématique ne change ; seuls les noms et les textes changent.

| Règle | Valeur |
|---|---|
| Classeur | **20 cartes**, max **2** exemplaires du même nom, au moins **1 Planqué N+1** |
| Main de départ | **5 cartes**, avec toujours au moins **1 Planqué N+1** ; **pas de reprise de poste** : ni remélange, ni pioche pour l'adversaire (D-022) |
| Main maximale | **10 cartes** |
| Poste | **1** |
| Open-space | **3** places |
| Primes | **3** pour gagner ; K.O. normal = 1, Cadre = 2 |
| Machine à café | **1 café généré par tour**, **1 attachement par tour** ; si le slot du haut est occupé, pas de nouveau café |
| Types de café | Jusqu'à **3** par classeur, ordre aléatoire ; l'incolore accepte tout — **hypothèse assumée**, non sourcée (D-022) |
| Premier joueur | Ne pioche pas, ne peut pas attacher de café ; peut jouer un Collègue ; peut attaquer si l'attaque coûte 0 |
| Évolution | Impossible au premier tour de chaque joueur |
| Pression | **1 par tour** ; le café n'est **pas consommé** |
| Vulnérabilité | **+20 dégâts** — le ×2 n'existe que via un Lieu, hors périmètre (D-020) |
| Résistance | **Aucune** |
| Relève | Défausse autant de cafés que le coût de relève |
| Pioche vide | **Pas de défaite** |
| Défaite | 3 Primes pour l'adversaire, **ou** plus aucun Planqué en jeu (D-022) |
| K.O. | L'adversaire marque les Primes ; l'Open-space choisit la relève |
| Statuts | Surcharge (10/tour), Burn-out (20 + lancer), Bloqué (lancer), Gelé (1 tour), Dérive (lancer avant attaque) |
| Ordre des statuts | Surcharge → Burn-out → Bloqué → Gelé |
| Cartes Action | **Objet** : illimité ; **Collègue** : **1 par tour** |
| Outils / Lieux | **Hors périmètre du lancement** : le jeu de référence les a déjà, c'est un choix de périmètre (D-020), pas une description du miroir |

**Miroir daté et borné** : le référent est Pocket **dans son état de 2026** (D-018) pour les **règles de base** ; les **ajouts 2025-2026 sont exclus du périmètre** (D-020) — Méga-Évolution ex à 3 Primes, Vulnérabilité ×2 par un Lieu, Pokémon à double type, Outils et Lieux. Le projet reste donc à 3 stades, Cadre = **2 Primes**, un Planqué = **une** faction. « Aucune valeur mathématique ne change » vaut **pour ce périmètre annoncé**, et non comme description du jeu de 2026. Réserve qui subsiste : une partie du tableau n'a **aucune source citable**. Ces règles sont désormais **décidées** (D-022) mais **non observées** — le seul moyen de les faire passer à « observé » est de capturer les Astuces de jeu de l'application : `docs/PROTOCOLE-ASTUCES.md`. Chiffrage des écarts : `docs/ARBITRAGE-O-008.md` ; sources : `docs/MIROIR-2026-DELTAS.md`.

### 4.1 Ce qui n'est pas la règle standard

- Le standard, c'est **le miroir de Pocket (D-018) plus le mot-clé « Changement de priorité » (D-004)**. Rien d'autre.
- Les règles maison **`RULES-4b` sont rangées à part** dans `docs/MODES-FUTURS.md` (mode futur « Café », ni acté ni implémenté) : ce n'est ni une référence, ni un mode par défaut. Ne pas les citer comme règles du jeu (D-019).
- Pas de compteur de stress, pas de ressource maison, pas de règle de deck alternative.
- **« Changement de priorité »** (D-004) : une fois par tour, au Poste, défausser 1 carte puis piocher 1. Mot-clé porté par les cartes, déactivable par un drapeau global, testé en simulation avant validation. C'est la seule exception actée.
- **« Pause café »** désigne le Wonder Pick. Ne pas réutiliser ce terme pour une action de combat.

### 4.2 Bacs et contenu

- Un bac à courrier contient **5 cartes** : 3 communes, 1 peu commune, 1 rare minimum.
- Cible de lancement : **286 cartes** = 226 de base (215 Planqués + 8 Collègues + 3 Objets) + 60 secrètes.
- Trois bacs : **Direction**, **Terrain**, **Bureau**.
- Monétisation v1 : **aucun argent réel** ; la Cotisation se paie en monnaie de jeu.
- Ton : satire de bureau **punch up**. On ridiculise les postures et le système, jamais une personne réelle, une entreprise existante ou un groupe protégé.

## 5. Écriture des cartes

- **Identifiants** : minuscules, kebab-case, préfixe de faction — `sse-infirmier-site`. Variantes : suffixe `-star` ou `-star2`.
- **Évolution** : `evolvesFrom` pointe vers l'`id` de la carte précédente. Une variante hérite des stats, attaques, talent et flavour de sa carte de base.
- **Cadre** : `ex: true`, vaut 2 Primes. L'UI affiche « Cadre », pas « ex ».
- **Effets** : utiliser uniquement les `AttackEffectKind` existants (`healSelf`, `healAll`, `status`, `draw`, `discardEnergy`, `selfDamage`, `switchSelf`, `reduceDamage`). Toute nouvelle primitive = décision + mise à jour des types + tests.
- **Textes** : français, phrase complète, « Ce Planqué… », « le Planqué adverse… », noms de statuts capitalisés. Exemple **interdit** : `Cette Galère subit 10 dégâts.` ; écrire `Ce Planqué subit 10 dégâts.`
- **Flavour** : une scène de bureau, drôle, sans nom réel. La chute vise le système.
- **Stats** : suivre `CARD-SPEC.md` §2.

| Stade / rareté | Moral | Dégâts typiques | Relève |
|---|---:|---:|---:|
| N+1 1◆ | 60–70 | 10–20 | 1 |
| N+1 2◆ | 60–80 | 10–30 | 1 |
| N+2 2◆ | 80–100 | 30–50 | 1–2 |
| N+2 3◆ | 90–110 | 40–60 | 2 |
| COMEX 3◆ | 120–140 | 50–80 | 2 |
| COMEX 4◆ (Cadre) | 140–170 | 70–120 | 2–3 |

- Une attaque à 1 café fait 10–30 ; à 2 cafés, 40–60 ou 30 + effet ; à 3 cafés, 70–100 ou 60 + effet fort.
- Un Talent ne doit pas créer d'avantage de cartes net sans coût.
- Un Cadre doit être plus fort, pas auto-include.
- Vulnérabilité : +20. L'Intérimaire n'a aucune vulnérabilité.

## 6. Architecture et conventions

Le projet est encore une **application Vite plate**. Le monorepo décrit dans `PROPOSITION.md` §6.1 est une cible, pas l'état actuel : ne pas restructurer sans décision.

```text
grevomon-tcg/
├── src/
│   ├── components/   CardDetail.tsx, CardView.tsx, Layout.tsx
│   ├── data/         index.ts, sse.ts, types.ts
│   ├── game/         engine.ts, engine.test.ts, deck.ts, deck.test.ts, rules.ts, pace.test.ts
│   ├── pages/        Home.tsx, Collection.tsx, Deck.tsx, Battle.tsx, Settings.tsx
│   ├── store/        useStore.ts, useStore.test.ts
│   ├── App.tsx       routes (Layout + 5 pages)
│   ├── main.tsx      point d'entrée, monte App sous BrowserRouter
│   ├── styles.css    feuille unique de l'application
│   └── vite-env.d.ts types Vite (imports CSS)
├── public/           favicon.svg, icon-192.svg, icon-512.svg (SVG, dessinés à la main)
├── scripts/          status.mjs, etapes-infra-tcg.sh
└── docs/
```

- **TypeScript strict**. Alias `@/` → `./src`, déclaré dans `tsconfig.json` et `vite.config.ts`.
- **UI en français**, identifiants de code en anglais. Ne pas dupliquer les textes de cartes hors de `src/data`.
- **Moteur** : code pur autant que possible, sans React ni DOM. `applyAction(state, action)` et fonctions de transition ; cloner avec `structuredClone`.
- **Déterminisme** : c'est une cible de `PROPOSITION.md` §6.2. Le moteur utilise encore `Math.random()` ; toute simulation ou tout test doit être seedé avant d'être considéré comme reproductible.
- **Store** : Zustand + `persist`, clé `bureau-des-planques-v1`. Toute modification de forme doit être migrée ou versionnée.
- **Données** : un fichier par faction, puis enregistrement dans `src/data/index.ts`. Ne pas oublier `ALL_CARDS`, `CARD_BY_ID` et les métadonnées.
- **Tests** : Vitest, fichiers `*.test.ts` / `*.spec.ts` à côté du code testé. Pas de test = pas de preuve.
- **PWA** : manifeste et Workbox dans `vite.config.ts`. Les icônes `public/favicon.svg`, `icon-192.svg`, `icon-512.svg` existent depuis le 19/10/2026 (SVG `viewBox="0 0 32 32"`, monogramme « BP » sur fond sombre) : plus d'erreur de manifeste dans la console.
- **Moteur — modules** : `engine.ts` (transitions), `deck.ts` (règles du Classeur, partagées par le moteur et l'UI), `rules.ts` (drapeaux globaux, dont le mot-clé de D-004). Les règles de jeu ne vivent pas dans le store.
- **CSS** : une seule feuille, `src/styles.css`, importée par `main.tsx`. Toute nouvelle page utilise les classes déjà définies plutôt que d'inventer un second système.
- **Preuve de rendu** : un écran ne se déclare rendu que par capture ou inspection du navigateur, pas par la lecture du JSX. Voir §8.4.

## 7. Commandes

Toujours depuis `grevomon-tcg/`. Le chemin contient une espace : le quoting est obligatoire.

```bash
cd "/home/chapax/Documents/grevomon/REA pp/grevomon-tcg"
```

| Commande | Usage | État vérifié le 19/10/2026 |
|---|---|---|
| `npm install` | Installer les dépendances | **OK** (`npm ci` ; `@types/node` ajouté en dev) |
| `npm run dev` | Serveur Vite sur `:5178` | non exécuté dans cette vérification ; `preview` l'a été |
| `npm run check` | `tsc -b` | **OK**, exit 0 |
| `npm test` | `vitest run` | **OK** : 5 fichiers, 47 tests, exit 0 |
| `npm run test:watch` | Vitest en watch | 47 tests à lancer |
| `npm run build` | `tsc -b && vite build` | **OK**, exit 0 ; `dist/index.html` + `dist/sw.js` produits |
| `npm run preview` | Servir `dist/` | **OK** (utilisé sur `:4180` pour la vérification navigateur) |
| `npm run status` | Métriques JSON | **OK**, exit 0 |
| `node scripts/status.mjs` | Même script directement | **OK**, exit 0 |

Les 2 erreurs de `check`/`build` constatées le 18/10 sont **corrigées** :

```text
src/game/engine.ts(464,7): TS2367  → checkup retourne l'état ; la garde lit la valeur retournée (la garde elle-même reste nécessaire).
vite.config.ts(1,36):  TS2591  → dépendance de développement @types/node ajoutée.
```

Autres faits vérifiés le 19/10/2026 :

- `src/main.tsx` et `src/App.tsx` existent ; `index.html` monte l'application sous `BrowserRouter`.
- `public/` **existe** (créé le 19/10/2026) : `favicon.svg`, `icon-192.svg`, `icon-512.svg`. Les trois sont copiés dans `dist/` par le build.
- Une seule feuille, `src/styles.css`, importée par `main.tsx`.
- **47 tests** (5 fichiers) ; **37 cartes** en code (26 bases SSE + 11 variantes), faction SSE uniquement. `src/data/cards.test.ts` vérifie les conventions d'écriture (§3, §5, CARD-SPEC §1), le **Moral par stade** (D-023) et les **bandes de dégâts par café** (D-021) ; `src/game/pace.test.ts` chiffre le rythme (`PACE_REPORT=1`).
- `npm run build` produit `dist/index.html` **et** `dist/sw.js` : c'est la preuve d'un build valide. `preview` + inspection navigateur ont confirmé le rendu des pages Accueil, Classeur et Combat.
- Node `v24.21.0` / npm `11.19.0` : **non revérifiés** dans cette passe. `package.json` déclare Vite `8.3.4`, TypeScript `7.0.2`, Vitest `5.0.5`, React `19.3.1`, `@types/node` `26.6.5`.
- Le dossier **est** un dépôt git : branche `main`, remote `origin` → `https://github.com/Chapax/grevomon-tcg` (privé).

## 8. Audits

Un audit est une **preuve**, pas une opinion. Il se fait toujours sur `grevomon-tcg/`, jamais sur `grevomon-pocket/`.

### 8.1 Protocole

1. Lire `AGENTS.md`, `docs/DECISIONS.md`, puis les docs concernés.
2. Lancer les commandes de référence et noter **commande exacte, exit code, extrait exact**.
3. Distinguer explicitement **observé** (commande/fichier) et **non vérifié** (déduit).
4. Ne jamais conclure « fait » sans test, build, capture ou sortie de commande.
5. Vérifier le code, pas seulement les docs. `docs/STATUS.md` est un instantané daté.
6. Signaler les blocages préexistants au lieu de les masquer ou de les attribuer à la modification en cours.

### 8.2 Batterie de référence

```bash
cd "/home/chapax/Documents/grevomon/REA pp/grevomon-tcg"
npm run status
npm run check
npm test
npm run build
ls -la dist/index.html dist/sw.js
find src -name '*.test.*' -o -name '*.spec.*'
grep -rn "Galère" src || true
grep -rn "from '@/" src | wc -l
find src -type f | sort
```

Pour un audit de contenu, compter aussi les cartes et les variantes :

```bash
grep -c "base({" src/data/sse.ts
grep -c "variant(" src/data/sse.ts
```

### 8.3 Pièges connus

- **`dist/sw.js` seul ne prouve rien** : il peut rester d'un build isolé antérieur. Le build valide produit `dist/index.html` **et** `dist/sw.js`.
- **`docs/STATUS.md` est daté du 18/10/2026, 20:57**, avant la correction de `scripts/status.mjs` et de `tsconfig.json`. Ses constats sur le `%20` et `baseUrl` ne sont plus l'état courant ; relancer les commandes.
- **Les pourcentages de `grevomon-pocket/PLAN.md` ne s'appliquent pas** à ce projet. Ne pas les recopier.
- `npm test` en échec par absence de tests n'est pas un test réussi.
- Le dossier a un historique git depuis le 18/10/2026, avec plusieurs commits sur `main` : lancer `git log` avant de parler d'un commit, `git worktree list` avant de conclure qu'il n'y a qu'un seul répertoire de travail, et `git status` avant d'affirmer qu'un fichier est à jour.
- Les alias `@/` sont déclarés dans `tsconfig.json` **et** `vite.config.ts` ; un seul des deux ne suffit pas.

### 8.4 Definition of done

Pour une modification de code :

- `npm run check` : exit 0.
- `npm test` : exit 0, avec au moins un test couvrant le changement.
- `npm run build` : exit 0, `dist/index.html` et `dist/sw.js` présents.
- Aucune occurrence de `Galère` dans `src/`.
- Docs mises à jour si une règle, un vocabulaire, un contenu ou une décision change.

Pour une modification de documentation seule :

- Liens et chemins valides.
- Commandes citées réellement exécutables.
- Aucune contradiction avec `docs/DECISIONS.md`.
- Date de vérification mise à jour si l'état des commandes change.

### 8.5 Format de rapport

```markdown
## Audit — <date>

Périmètre :
Commandes : <commande> → exit <code> ; extrait :
Observé :
Non vérifié :
Bloquants :
Prochaine action vérifiable :
```

## 9. Legacy

`grevomon-pocket/` est conservé comme **référence historique** : ancien univers Grèvomon, vocabulaire « Galère », règles `RULES-4b` (12/4/3), 38 cartes, application plate. Il peut servir à consulter des idées d'UI ou l'inventaire fonctionnel de l'APK, mais **jamais** de source de vérité pour ce projet.

Voir `../grevomon-pocket/LEGACY.md`.

## 10. Agent skills

### Issue tracker

Les tickets vivent dans GitHub Issues sur `Chapax/grevomon-tcg`, piloté par la CLI `gh`. Voir `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq rôles de triage canoniques utilisent leurs noms par défaut (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Voir `docs/agents/triage-labels.md`.

### Domain docs

Contexte unique. Le vocabulaire est `AGENTS.md` §3, les décisions sont `docs/DECISIONS.md`. Voir `docs/agents/domain.md`.
