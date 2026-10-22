# AGENTS.md — Bureau des Planqués

> Projet actif : **`planquex/`** — le dossier local porte le nom du dépôt depuis le 21/10/2026 (D-047). Dernière vérification des commandes : **19/10/2026 (CEST)**.
> `grevomon-pocket/` est **legacy** : voir `../grevomon/grevomon-pocket/LEGACY.md`.
> Ne jamais l'utiliser comme source de vérité pour les règles, le vocabulaire, le contenu ou un audit.

## 1. Règles d'or

1. Lire ce fichier et `docs/DECISIONS.md` avant toute modification.
2. Travailler dans `planquex/` sauf demande explicite. Ne pas modifier `grevomon-pocket/` (`../grevomon/grevomon-pocket/`).
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
4. **`docs/MIROIR-2026-DELTAS.md`** — écarts connus entre le tableau §4 et le jeu de référence 2026, avec leurs sources. Décrit les écarts **et leurs verdicts** (O-008 → D-020, O-009 → D-022) ; il ne reste plus d'écart ouvert sur §4 (O-014 tranché par D-034) : ne pas s'en servir pour modifier une règle sans décision datée.
5. **Le code et les commandes** — ce qui existe réellement. Un écart avec les docs est un bug ou une tâche, pas une nouvelle règle.
6. **`docs/STATUS.md` et `docs/AUDIT-*.md`** — instantanés d'audit datés. Ce ne sont pas des vérités live : relancer les commandes.

**Pour les règles de jeu (§4), ce qui fait foi** (D-034) : les **captures** de l'application (`docs/preuves/astuces-*`) **et** les **règles établies par la recherche** documentée (`docs/preuves/regles-*`, chaque ligne avec sa citation). Si les deux se contredisent, **la capture l'emporte** et l'écart est signalé. Une règle de §4 qui ne s'appuie sur aucune des deux est une hypothèse.

`docs/MODES-FUTURS.md` **ne fait jamais autorité** : il ne contient que des modes parkés (D-019).

Si deux documents se contredisent, ne pas choisir silencieusement : le signaler, citer les passages, et proposer une correction de doc ou de code.

## 3. Vocabulaire

Le jeu est en **français**. Le code peut garder des identifiants anglais, mais l'interface, les cartes et les docs emploient les termes du projet.

### 3.1 Termes de base

| Terme TCG / anglais | Terme projet | Code / note |
|---|---|---|
| Pokémon | **Planqué** | `Card`, `CardInstance` |
| Basic | **Entrant** | `Stage` — l’échelle est **Entrant → N+1 → N+2** |
| Stage 1 / Stage 2 | **N+1 / N+2** | `Stage` |
| ex | **COMEX** | `ex: true`, vaut **2 Interventions** — c'est un **statut**, affiché *avec* le stade (D-026) |
| HP | **Seuil** | `hp` — la limite avant la casse |
| dégâts | **Stress** | le Stress **monte** : `Stress = Seuil − hp`. La barre s'inverse (D-026) |
| K.O. | **craquer** | le Planqué craque, la carte part au **Rebut** |
| Energy | **Café** | `energy` |
| Energy Zone | **Machine à café** | `energyZone` |
| Attack | **Pression** | `Attack` — 1 par tour, et elle fait monter le Stress |
| Ability | **Talent** | `ability` |
| Item | **Objet** | carte Action, **NEUF** (matériel à installer) ou **MRO** (pièces, outillage) |
| Supporter | **Collègue** | carte Action, **1 par tour** |
| Tool | **Outil** | extension ultérieure |
| Stadium | **Lieu** *(à venir : le Site)* | extension ultérieure |
| Prize / point | **Intervention** | `points`, 3 pour gagner ; un COMEX en vaut 2 |
| Weakness | **Vulnérabilité** | `weakness`, +20 |
| Resistance | — (supprimée) | aucune |
| Retreat | **Rotation** | `retreat` — le remplacement *après un craquage* reste la **relève** |
| Poison | **Surcharge** | `SURCHARGE` |
| Burn | **Épuisement** | `EPUISEMENT` — « Burn-out » est le mot des gens : réservé aux noms de cartes |
| Sleep | **Sieste** | `SIESTE` |
| Paralysis | **Immobilisation** | `IMMOBILISATION` |
| Confusion | **Dérive** | `DERIVE` |
| Deck | **Chariot** | `deck`, 20 cartes |
| Hand | **main** | `hand`, 5 au départ, 10 max |
| Discard | **Rebut** | `discard` — le verbe est « **mettre au rebut** » |
| Bench | **Rack** | `bench`, 3 places |
| Active | **Poste** | `active` |
| Coin flip | **Lancer de tampon** | pile = tampon, face = agrafe |
| Mulligan | — | le jeu de base n'en a pas, et nous non plus (D-022) |
| Pack | **Arrivage** | 5 cartes |
| Extension / set | **Marché** | il contient ses **Viviers** |
| Zones de cartes | **Viviers** : Atelier, Étage, Bureaux | un futur vivier sera un lieu (D-026) |
| Wonder Pick | **Pause café** | 5 cartes, 1 rare minimum |
| Collection | **Parc** | |
| Mission | **Note de service** | |
| Shop | **Économat / Boutique du CSE** | |
| Premium Pass | **Cotisation** | |
| Friend | **Camarade** | |
| Trade | **Échange de postes** | |
| Ranked | **Échelon** | |
| Present Box | **Casier** | |
| Card Skin | **Autocollant** | |
| Tutorial | **Journée d'intégration** | |
| Monnaie / minuteurs | **Tickets** / **Chrono** | la monnaie payante (« Cagnotte ») viendra plus tard (O-005) |
| Suggestion box (retours) | **la Boîte à idées** | l'entrée : la **bulle** présente partout ; l'écran s'appelle **le mur** (D-058) |
| Amélioration / idée | **post-it IP** | une idée, une fonctionnalité, un avis — « IP » = *Idée de Progrès*, comme au kaizen (D-058) |
| Signalement (bug) | **post-it OUF** | le jargon Safran, **gardé tel quel** : on ne l'explique pas, on l'emploie (D-058) |
| Testeur de l'alpha | **un invité** | jamais « un joueur » tout court : le public, c'est le lancement |

**Interdits dans les données, l'UI et les textes du jeu** : `Galère`, `GalèreMon`, `Grèvomon`, `Pokémon`. Les docs peuvent citer « Pokémon TCG Pocket » comme référence externe. L'ancien nom **Galérodex** est **abandonné** (il venait de l'univers legacy) : la collection s'appelle **le Parc**.

### 3.2 Factions

Un nom de faction désigne **un service ou un collectif, jamais une personne** (D-024). Chaque
faction est rangée dans **un vivier** — les trois zones du site (D-026).

| Faction (code) | Étiquette | Type | Vulnérable à | Vivier | Carte signature |
|---|---|---|---|---|---|
| `SSE` | `SSE` | Plante | `MANAGEMENT` | Bureaux | Médecin du travail |
| `MANAGEMENT` | `MGT` | Feu | `QVT` | Atelier | Responsable d'unité |
| `QVT` | `QVT` | Eau | `AMELIORATION` | Bureaux | Chief Happiness Officer |
| `AMELIORATION` | `AC` | Électricité | `ATELIER` | Étage | Directeur qualité |
| `RH` | `RH` | Psychique | `DIRECTION` | Bureaux | DRH |
| `ATELIER` | `ATL` | Combat | `RH` | Atelier | Chef d'atelier |
| `DIRECTION` | `DIR` | Obscurité | `ATELIER` | Étage | PDG |
| `SYNDICAT` | `SYN` | Métal | `MANAGEMENT` | Atelier | Secrétaire général |
| `INTERIM` | `INT` | Dragon | Aucune | Bureaux | Intérimaire légendaire |
| `SUPPORT` | `SUP` | Incolore | `ATELIER` | Étage | Responsable support |

**Deux règles de nommage** (D-024) : l'abréviation est **le sigle réel s'il existe** (`SSE`, `RH`,
`AC`, `QVT`), **sinon trois lettres** tirées du nom ; et les **anglicismes entrés dans le français
courant** (`management`, `audit`, `rack`) sont admis — les **titres à la mode** (« Happiness
Manager », « Chief Happiness Officer ») restent **sur les cartes**, jamais sur une faction.

Stades : **Entrant → N+1 → N+2**, et **COMEX** pour le statut des ex. Un Planqué porte **une seule**
faction : le double type du jeu de 2026 est hors périmètre (D-020). Raretés codées : `1D`, `2D`,
`3D`, `4D`, `1S`, `2S`, `3S`, `COU`.
Les deux dernières — **3 étoiles** et **Couronne** — sont **codées** depuis le 20/10/2026 (#87) :
présentes dans le type `Rarity`, dans `RARITY_META` (`src/data/index.ts`) et couvertes par les
tests. Aucune carte de **base** ne les porte : elles vivent sur des **variantes**.

## 4. Règles du jeu

Le mode standard est un **miroir de TCG Pocket**. Aucune valeur mathématique ne change ; seuls les noms et les textes changent.

| Règle | Valeur |
|---|---|
| Chariot | **20 cartes**, max **2** exemplaires du même nom, au moins **1 Planqué Entrant** |
| main de départ | **5 cartes**, avec toujours au moins **1 Planqué Entrant** ; **pas de reprise de poste** : ni remélange, ni pioche pour l'adversaire (D-022) |
| main maximale | **10 cartes** |
| Poste | **1** |
| Rack | **3** places |
| Interventions | **3** pour gagner ; un craquage normal = 1, un COMEX = 2 |
| Machine à café | **1 café généré par tour**, **1 attachement par tour** ; si le slot du haut est occupé, pas de nouveau café — la zone ne contient donc jamais plus d'un café (D-034) |
| Types de café | Le coût d'une Pression est une **liste de symboles** (un type de faction, ou **`INCOLORE`** — distinct de `SUPPORT`) ; un symbole typé exige un café de ce type, un symbole incolore accepte tout, et un café incolore (jamais produit) paie un coût typé (D-037). Jusqu'à **3** types par Chariot, **choisis par le joueur (1 à 3, proposition automatique d'après les factions présentes)**, `SUPPORT`/`INTERIM` jamais proposés ni retenus (D-034, D-037 ; #91) |
| Premier joueur | **Tiré au sort** par un lancer de tampon (D-033) ; **pioche** ; ne peut pas attacher de café ; peut jouer un Collègue ; peut attaquer si l'attaque coûte 0 (D-030, D-039 — écart assumé : le coût `0` existe dans le code `DAMAGE_BY_COST`, aucune carte ne le porte) |
| Évolution | Impossible au premier tour de chaque joueur |
| Seuil / Stress | le **Seuil** remplace le Moral ; les dégâts deviennent du **Stress** qui monte ; à `Stress ≥ Seuil`, le Planqué **craque** (D-026) |
| Pression | **1 par tour** ; le café n'est **pas consommé** ; elle fait monter le **Stress** ; elle **termine le tour** (D-033) |
| Ordre des dégâts | dégâts de la Pression → effets sur l'attaquant → **Vulnérabilité** → effets sur le défenseur (D-031) |
| Vulnérabilité | **+20** — le ×2 n'existe que via un Lieu, hors périmètre (D-020) ; **ne s'applique pas au Rack** (D-031) |
| Résistance | **Aucune** |
| Rotation | Défausse autant de cafés que le coût de rotation (**les premiers de la liste d'attachement**, `slice(amount)` dans `engine.ts:519-521`, pas de choix du joueur) ; **une fois par tour** ; **impossible** sous Sieste ou Immobilisation (D-033, D-041) |
| Pioche vide | **Pas de défaite** |
| Défaite | 3 Interventions pour l'adversaire, **ou** plus aucun Planqué en jeu (D-022) ; le **forfait** est une défaite quel que soit le score (D-030) ; à 3 Interventions sur l'action qui vide le plateau, la défaite l'emporte (D-031) |
| Limite de partie | Atteinte, le combat se solde par une **égalité** (D-030, observé) ; **30 tours** en Échelon (PvP), **50** en solo (D-031, établi par la recherche, D-034) |
| craquage | L'adversaire marque les Interventions ; la **relève est choisie** par le joueur dont le Planqué a craqué (D-030) — l'attaquant choisit en premier après un double craquage (D-031) |
| Statuts | Surcharge (10 de Stress par Contrôle), Épuisement (20 + lancer), Sieste (ni Pression ni Rotation ; lancer au Contrôle), Immobilisation (ni Pression ni Rotation ; guérit au Contrôle qui suit le tour de son propriétaire), Dérive (lancer avant la Pression : sur un échec, la Pression n'est pas lancée et le tour prend fin, **sans Stress**) — **Surcharge et Épuisement se cumulent** avec tout ; **Sieste, Immobilisation et Dérive s'excluent** et se remplacent (D-030, D-033) |
| Statuts — portée | Seul le Planqué **au Poste** en porte ; la **Rotation** et l'**évolution** les purgent (D-030), **ainsi que les effets d'attaque** qui le visent (D-033) |
| Contrôle | Après **chaque** tour, les **deux** Postes sont contrôlés ; le joueur dont le tour vient de finir passe **d'abord** (D-033) |
| Ordre des statuts | Surcharge → Épuisement → Sieste → Immobilisation |
| Cartes Action | **Objet** (NEUF ou MRO) : illimité ; **Collègue** : **1 par tour** |
| Talent `attachEnergy` | Attache **un café tiré au hasard dans le Chariot du joueur** (même générateur seedé que la Machine, `drawCafeType`, `engine.ts:458-463`, `state.players[who].cafeTypes`) — D-040, #110 (a) |
| Outils / Lieux | **Hors périmètre du lancement** : le jeu de référence les a déjà, c'est un choix de périmètre (D-020), pas une description du miroir |

**Miroir daté et borné** : le référent est Pocket **dans son état de 2026** (D-018) pour les **règles de base** ; les **ajouts 2025-2026 sont exclus du périmètre** (D-020) — Méga-Évolution ex à 3 Interventions, Vulnérabilité ×2 par un Lieu, Pokémon à double type, Outils et Lieux. Le projet reste donc à 3 stades, COMEX = **2 Interventions**, un Planqué = **une** faction. « Aucune valeur mathématique ne change » vaut **pour ce périmètre annoncé**, et non comme description du jeu de 2026. **État des preuves (20/10/2026)** : les « Astuces de jeu » ont été capturées — 9 écrans, `docs/preuves/astuces-2026-10-20/` — et **douze lignes de ce tableau passent à « observé »** (D-030). Les quatre lignes non capturées — le **plafond de 3 types de café**, la **main de départ à 5**, la règle du « slot occupé » et la **reprise de poste** — sont **établies par la recherche**, qui fait foi au même titre que les captures (D-034) : §4 n'a plus de ligne non sourcée. Chiffrage des écarts : `docs/ARBITRAGE-O-008.md` ; sources et verdicts : `docs/MIROIR-2026-DELTAS.md`. La revue de sources du même jour (`docs/preuves/regles-2026-10-20/`, D-032) recoupe ces lignes par une transcription datée et apporte les ajouts de **D-031** (ordre des dégâts, Vulnérabilité hors Rack, double craquage, nombre de tours).

### 4.1 Ce qui n'est pas la règle standard

- Le standard, c'est **le miroir de Pocket (D-018) plus le mot-clé « Changement de priorité » (D-004)**. Rien d'autre.
- Les règles maison **`RULES-4b` sont rangées à part** dans `docs/MODES-FUTURS.md` (mode futur « Café », ni acté ni implémenté) : ce n'est ni une référence, ni un mode par défaut. Ne pas les citer comme règles du jeu (D-019).
- Pas de compteur de stress, pas de ressource maison, pas de règle de deck alternative.
- **« Changement de priorité »** (D-004) : une fois par tour, au Poste, défausser 1 carte puis piocher 1. Mot-clé porté par les cartes, déactivable par un drapeau global, testé en simulation avant validation. C'est la seule exception actée.
- **« Pause café »** désigne le Wonder Pick. Ne pas réutiliser ce terme pour une action de combat.

### 4.2 Viviers et contenu

- Un **Arrivage** contient **5 cartes** : 3 communes, 1 peu commune, 1 rare minimum.
- **Cible de contenu : autour de 300 cartes** — le set compte **225 bases + 75 variantes**, et le
  chiffre **n'est pas un objectif** (D-063) : une bonne idée entre, une carte faite pour remplir un compte
  n'entre pas. Ce qui compte est ce que le contenu permet de **jouer** : des Chariots et des stratégies.
- Trois **viviers** (D-026) : **l'Atelier** (Atelier, Management, Syndicat), **l'Étage** (Amélioration continue, Support, Direction), **les Bureaux** (RH, SSE, QVT, Intérim).
- Monétisation v1 : **aucun argent réel** ; la Cotisation se paie en monnaie de jeu.
- Ton : satire de bureau **punch up**. On ridiculise les postures et le système, jamais une personne réelle, une entreprise existante ou un groupe protégé.

## 5. Écriture des cartes

- **Raretés hautes (`3S`, `COU`)** : portées **uniquement par des variantes de Planqués** (les variantes d'Action restent `1S`/`2S`) — D-044 (#105 (a)). Les 7 variantes hautes (`3S` × 4, `COU` × 3) **ne sortent d'aucun Arrivage** (`PACK_COMPOSITION`, `src/game/pack.ts`) : elles sont au catalogue (`CARD_BY_ID`, `src/data/index.ts`), pas dans le tirage.
- **Identifiants** : minuscules, kebab-case, préfixe de faction — `sse-infirmier-site`. Variantes : le suffixe **porte la rareté** — `-star` (`1S`), `-star2` (`2S`), `-star3` (`3S`), `-crown` (`COU`) ; la table est unique (`SECRET_RARITY`, `src/data/planque.ts`) et un test la lit dans les deux sens. **COMEX : suffixe `-ex`** — le nom porte « COMEX », l'id porte `ex`, et les 15 cartes COMEX s'y conforment ; c'est la seule entorse au point suivant, et elle vient du **statut** (D-026), pas du nom. **Un id suit le nom** : renommer une carte renomme son id, et un renommage d'id s'accompagne d'une **migration du store** (`version`, cf. §6). L'écart id/nom est un *Mysterious Name* : dans un dépôt lu par des agents, une carte introuvable par son nom ne se trouve plus du tout.
- **Évolution** : `evolvesFrom` pointe vers l'`id` de la carte précédente. Une variante hérite des stats, attaques, talent et flavour de sa carte de base.
- **COMEX** : `ex: true`, vaut 2 Interventions. L'UI affiche « COMEX », pas « ex ».
- **Effets** : utiliser uniquement les `AttackEffectKind` existants (`healSelf`, `healAll`, `status`, `draw`, `discardEnergy`, `selfDamage`, `switchSelf`, `reduceDamage`). Toute nouvelle primitive = décision + mise à jour des types + tests.
- **Textes** : français, phrase complète, « Ce Planqué… », « le Planqué adverse… », noms de statuts capitalisés. Exemple **interdit** : `Cette Galère subit 10 dégâts.` ; écrire `Ce Planqué subit 10 dégâts.`
- **Flavour** : une scène de bureau, drôle, sans nom réel. La chute vise le système.
- **Stats** : suivre `CARD-SPEC.md` §2.

| Stats | suivre **`CARD-SPEC.md` §2** | la table n'est **pas recopiée ici** : elle y bouge à chaque ajustement, et une copie prend du retard (leçon de la propagation de D-026) |

- Une attaque à 1 café fait 10–30 ; à 2 cafés, 40–60 ou 30 + effet ; à 3 cafés, 70–100 ou 60 + effet fort.
- Un Talent ne doit pas créer d'avantage de cartes net sans coût.
- Un COMEX doit être plus fort, pas auto-include.
- Vulnérabilité : +20. L'Intérimaire n'a aucune vulnérabilité.

## 6. Architecture et conventions

Le projet est encore une **application Vite plate**. Le monorepo décrit dans `PROPOSITION.md` §6.1 est une cible, pas l'état actuel : ne pas restructurer sans décision.

```text
planquex/
├── src/
│   ├── components/   CardDetail.tsx, CardView.tsx, Layout.tsx, StatusBadge.tsx, CafePips.tsx
│   ├── components/ui/  shadcn/ui (D-035) : button.tsx, dialog.tsx — composants génériques seuls
│   ├── data/         index.ts, types.ts, actions.ts, planque.ts, factions.ts, un fichier par faction (sse.ts, management.ts, …) (+ leurs tests)
│   ├── game/         engine.ts, deck.ts, rules.ts, curves.ts, rng.ts, pack.ts, simulation.ts, ia.ts (+ leurs tests, pace.test.ts)
│   ├── pages/        Home.tsx, Collection.tsx, Deck.tsx, Battle.tsx, Settings.tsx
│   ├── lib/          utils.ts — `cn()` de shadcn/ui (D-035)
│   ├── store/        useStore.ts, useStore.test.ts
│   ├── App.tsx       routes (Layout + 5 pages)
│   ├── main.tsx      point d'entrée, monte App sous BrowserRouter
│   ├── styles.css    feuille unique de l'application (importe Tailwind, mode CSS-first)
│   └── vite-env.d.ts types Vite (imports CSS)
├── public/           favicon.svg, icon-192/512.svg (SVG), icon-192/512.png + icon-maskable-512.png (générés par `npm run icones`)
├── components.json   config shadcn/ui (alias `@/`, CSS `src/styles.css` ; D-035)
├── vercel.json       réécriture SPA de l'hébergement (D-053) : sans elle, une visite directe sur `/parc` répond `404`
├── scripts/          status.mjs, simulate.mjs, capturer.mjs, etapes-infra-tcg.sh, finir-renommage-planquex.sh, illustration-vague.sh (+ leurs tests)
└── docs/
```

- **TypeScript strict**. Alias `@/` → `./src`, déclaré dans `tsconfig.json` et `vite.config.ts`.
- **UI en français**, identifiants de code en anglais. Ne pas dupliquer les textes de cartes hors de `src/data`.
- **Moteur** : code pur autant que possible, sans React ni DOM. `applyAction(state, action)` et fonctions de transition ; cloner avec `structuredClone`.
- **Déterminisme** : **fait** (ticket #29, 19/10/2026). Le hasard vient d'un générateur **seedé** — `src/game/rng.ts` (mulberry32) — et son état vit dans la partie (`BattleState.rng`), donc il se clone et se compare comme le reste. `createBattle(decks, seed)` utilise sa graine, le store est persisté en `version: 5` avec migration (`tutorielVu` de D-048, types de café choisis du Chariot de #91 — `cafeTypes`, `[]` valant proposition automatique —, renommages d'id de D-029, puis re-suffixages de rareté de #87), et il ne reste **aucun appel à `Math.random()`** dans `src/game/` ni `src/store/`. **Journal d'actions et rejeu** : **fait** (ticket #83, 20/10/2026). `BattleState` porte sa **graine d'origine** (`seed`) et le journal des actions **appliquées** (`actionLog`) ; `applyAction` est le seul point qui journalise (une action refusée ne l'est pas), et `replayBattle(deck, deck, seed, actions, types de café)` reconstruit la partie — la cible de `PROPOSITION.md` §6.2 est donc atteinte : seedé **et journalisé**. Le **cinquième argument** (les types de café choisis, #91) est **facultatif** : omis, le rejeu retombe sur la dérivation d'avant. `BattleState` n'est pas persisté par le store (`partialize`, `src/store/useStore.ts`), donc aucune migration n'était requise.
- **Store** : Zustand + `persist`, clé `bureau-des-planques-v1`. La forme persistée est en **`version: 5`** (ajout de `tutorielVu`), plus l'**export/import de sauvegarde** dans Réglages. Toute modification de forme doit être migrée ou versionnée.
- **Version (D-048, D-050, D-051)** : la règle complète vit dans **`docs/VERSIONS.md`** — à lire avant d'écrire un numéro quelque part. En bref : `package.json` porte `version` **et** `stage` (`alpha` | `beta` | `release`), injectés par `vite.config.ts`, lus par `src/version.ts` seul, affichés par `APP_LABEL` (`Alpha · 0.1.1`) ; **l'étape porte la mineure** (alpha `0.1.x`, beta `0.2.x`, release `1.0.0`) et le **correctif** monte à chaque build donnée à quelqu'un ; jamais de suffixe `-alpha.N` ; le tag suit la version (`v0.1.1`) et la release porte le drapeau *pre-release*. Garde : `src/version.test.ts`.
- **Données** : un fichier par faction, puis enregistrement dans `src/data/index.ts`. Ne pas oublier `ALL_CARDS`, `CARD_BY_ID` et les métadonnées. Les **cartes Action** (Collègues, Objets) vivent dans `src/data/actions.ts`. Le **socle de faction** vit dans `src/data/planque.ts` (`planqueBase`, `secretVariant`, `planquePalette`) et l'identité des factions dans `src/data/factions.ts` (`FACTION_META` : seule source de la Vulnérabilité et de la couleur unique dont le dégradé est dérivé) ; un fichier de faction ne déclare que ses cartes.
- **Tests** : Vitest, fichiers `*.test.ts` / `*.spec.ts` à côté du code testé. Pas de test = pas de preuve.
- **Garde-fous** : une assertion qui garde une **règle** doit **pouvoir échouer** — une assertion qui passe quoi qu'il arrive ne garde rien, et trois cas ont été trouvés en une session (#101 le coût typé, #107 la rareté des variantes d'Action, #103 la table des écarts connus ; ticket #112). Deux moyens, et le second est celui qui manque le plus souvent : (1) un test « **le contrôle mord** » qui confronte le contrôle à un **cas fautif** ; (2) une entrée dans **`scripts/garde-fous.mjs`** (table **courte, choisie, commentée** : chaque entrée cite son **ticket**, la **règle** qu'elle garde et les **tests ciblés**), mutée par `npm run garde-fous`, lancé par la CI. Ce qui peut être **désarmé** — la table elle-même — est surveillé par `scripts/garde-fous.test.ts`, qui la compare à une liste attendue.
- **PWA** : manifeste et Workbox dans `vite.config.ts`. `favicon.svg` est le monogramme « BP » de l'onglet ; l'icône d'application est l'illustration `public/icon-512.svg`, **rastérisée en PNG** (192, 512, 512 *maskable*) par `npm run icones` (`scripts/icones.mjs`, Chromium de `ms-playwright`). Sans PNG, Chromium/Brave n'installe qu'un raccourci avec son badge (D-054) ; garde : `scripts/icones.test.ts`. Le libellé sous l'icône (`short_name`) est **« Planquex »**, le nom du jeu (`name`) reste « Bureau des Planqués » (D-054).
- **Moteur — modules** : `engine.ts` (transitions), `deck.ts` (règles du Chariot, partagées par le moteur et l'UI), `rules.ts` (drapeaux globaux, dont le mot-clé de D-004, **et `STATUS_ORDER`**, l'ordre de résolution des conditions de §4), `curves.ts` (le chiffré de `CARD-SPEC.md` §2 — dégâts par café et Seuil par stade/rareté — dont `cards.test.ts` et `pace.test.ts` sont les appelants), `rng.ts` (le hasard seedé, état porté par la partie), `pack.ts` (la composition d'un Arrivage, générateur en paramètre), `simulation.ts` (le simulateur headless), `ia.ts` (la politique de la Direction — **deux niveaux** : niveau 1 scripté, niveau 2 glouton 1 coup sur `evaluatePosition`, qui vit **hors** du moteur ; le niveau est un **paramètre** dont le défaut est **1**, donc l'écran joue encore le niveau 1 ; employée par `nextAiAction` à l'écran **et** par `nextAction` dans le simulateur). Les règles de jeu ne vivent pas dans le store.
- **CSS** : une seule feuille, `src/styles.css`, importée par `main.tsx`. Toute nouvelle page utilise les classes déjà définies plutôt que d'inventer un second système. Le **système visuel** — palette et jetons, gabarit de carte, cadre de rareté, badges de statut, mascotte, planches de style — vit dans **`DESIGN.md`** à la racine : c'est la source du visuel, comme `src/styles.css` l'est du style. **Style (D-035)** : **Tailwind v4** (mode CSS-first) est le **moteur de style**. `src/styles.css` **reste la feuille unique** : elle ouvre sur `@import "tailwindcss"` et un bloc `@theme inline` dont les valeurs **référencent les jetons de `:root`** (une seule source : `--color-bg` → `var(--bg)`, `--font-sans` → `var(--font-body)`, etc.), donc les utilitaires lisent `DESIGN.md` sans recopier un hex. Le `preflight` de Tailwind s'applique : nos règles maison le suivent et le corrigent ponctuellement (`h1,h2,h3` rétablit `font-weight: 700`). L'identité du jeu (carte, plateau, Parc) reste **maison**. **shadcn/ui** ne s'emploie que pour les **composants génériques** (dialogue, tiroir, onglet, formulaire, tableau), jamais pour l'identité ; ses **variables CSS sont mappées sur nos jetons** dans `:root` (`--background` → `var(--bg)`, `--primary` → `var(--accent)`, …) au lieu de ses valeurs « SaaS ». Config : `components.json`, `cn()` dans `src/lib/utils.ts`, composants dans `src/components/ui/`. Premier composant posé : `dialog` (règles des Conditions dans `Battle.tsx`). Le plugin `@tailwindcss/vite` est branché dans `vite.config.ts`.
- **Preuve de rendu** : un écran ne se déclare rendu que par capture ou inspection du navigateur, pas par la lecture du JSX. Voir §8.4.
- **La Boîte à idées (D-058, D-059)** : les retours des invités entrent **dans le jeu** — une **bulle** partout (sauf en combat) ouvre **le mur** en panneau superposé. Dans l'alpha le mur est **en lecture seule** : il lit **`docs/boite-a-idees.json`** (importé par Vite, donc bundlé ; le jeu n'écrit jamais dedans) et la seule porte d'écriture est un formulaire externe. Les deux familles de post-its (**IP** / **OUF**), les statuts, les champs du formulaire et le tri de fin de journée sont écrits dans **`docs/BOITE-A-IDEES.md`**. Le mur complet (poster, voter, commenter) est la **première fonctionnalité Supabase**, et il vient **après le PvP**.
- **Illustrations** : le tuyau vit dans `design/illustrations/` (registre versionné + `README.md` + `PROMPTS-flow.md`), et **c'est la seule source** : depuis **D-045**, exécutée le 21/10/2026, Vite embarque les images dans le graphe de modules (`src/art.ts`, `import.meta.glob`, URL hachée dans `dist/assets/`) au lieu de les copier dans `public/`. Il n'y a donc plus de copie à maintenir, ni d'écart possible entre le registre et ce que l'écran sert ; la copie servie et son test #120 ont disparu, et `src/data/art.test.ts` reprend le rôle : fichier présent, nom = id de la carte de base, aucune orpheline, et **résolution par le glob de `src/art.ts`**. Le vocabulaire « les deux copies » a vécu — on dit **le registre**. La production passe par **`scripts/illustration-vague.sh`**, qui pilote **`gflow-cli`** (`uv tool install gflow-cli` ; `gflow auth login --browser chrome` une fois) : il génère, lit la **graine** dans le `--json` du CLI, range l'image **au registre** (une seule copie, D-045), consigne le registre et câble `art:` dans `src/data`. **Trois règles de ce wizard** : (1) il **sort en erreur** si `npm run check` ou les tests échouent — il n'invite jamais à commiter un état cassé, et dit comment revenir en arrière ; (2) il ne dit au registre que **ce qu'il a réellement fait** — les deux tableaux du README ne couvrent que la Planche 1, le **journal** est le registre vivant ; (3) la graine d'une image **déjà produite** (par le MCP gflow, qui ne rend pas de graine) se retrouve dans la base SQLite locale de gflow (`~/.gflow/gflow.db` ou `~/.local/share/gflow-cli/gflow.db`) ; à défaut, elle est consignée « inconnue », **jamais inventée**. Ses chemins sont **surchargeables par l'environnement** (`GFLOW_ILLUSTRATION_*` : `_SCRATCH`, `_REGISTRE`, `_SERVI`, `_README`, `_DONNEES`, `_PROMPTS`, `_DB`, `_CHECK_CMD`, `_TEST_CMD`) : c'est ce qui rend le wizard **testable de bout en bout**, dans un bac temporaire (`scripts/illustration-vague.test.ts`). **Dépendance signalée** (§1, règle 7) : un outil Python hors `node_modules`, alpha et reverse-engineered, qui pilote Google Flow sur un compte réel — l'automatisation relève des ToS de Google. **Et Pillow** (`python3 -c "import PIL"`) : le wizard convertit en webp les rendus de gflow, et son test fabrique de vraies images. Sans lui, **8 tests tombent** en `ModuleNotFoundError: No module named 'PIL'` — constaté le 21/10/2026, CI rouge pendant deux commits parce que la batterie locale passait, Pillow étant installé sur la machine de développement. La CI l'installe (`python3-pil`, `.github/workflows/ci.yml`) et le wizard le **vérifie avant de commencer**. **Le plan de la vague suivante — les 214 cartes qui n'ont ni sujet ni accent — est écrit dans `docs/SPEC-ILLUSTRATIONS.md`** (ticket **#121**) : douze décisions datées du 21/10/2026, dont deux engagent et sont actées (**D-045** la source unique, **D-046** les accents ré-dérivés de `FACTION_META.color`).
- **Configuration OpenCode (D-047, D-052)** : la session hérite de niveaux de `opencode.jsonc`, du plus large au plus proche — `~/Documents/opencode/` (la maison : politiques, **aucun** MCP), `gamedev/`, `planquex/` (gflow) ; et une session **d'infrastructure** s'ouvre dans `gamedev/planquex-infra/`, un **dossier frère** qui ajoute **vercel** et **supabase** (~240 outils). Chaque niveau porte aussi son `AGENTS.md`. **Un MCP se déclare au niveau qui s'en sert, jamais plus haut** : c'est ce qui garde une session de développement légère. Le serveur `rea` (reverse engineering, 207 outils) vit avec l'archive, dans `grevomon/`. Les profils vivent **hors** du dépôt, dans des dossiers frères : un lieu de session caché dans un `.opencode/` n'est pas ouvrable par les clients (D-052).
- **MCP `gflow`** (`opencode.jsonc`) : il expose 18 outils, dont trois qui **dépensent des crédits Veo** — `gflow_generate_video`, `gflow_upscale_video`, `gflow_download_media`. **Seuls les outils image sont autorisés** (`gflow_generate_image`, `gflow_upscale_image`, `gflow_auth_status`, `gflow_get_credits`…) : les images sont gratuites, la vidéo ne l'est pas. `gflow_auth_status` est le contrôle à passer **avant** toute génération. Le drapeau `--no-spend` de `gflow mcp run` **n'est pas** la réponse : il masque aussi les images.
- **Modèles d'image — deux vocabulaires** : gflow n'accepte que ses **alias internes**, et refuse tout le reste (`Invalid value for '--model'`). Personne ne connaît ces alias : on connaît les **noms humains**. Le mapping vit dans **`modele_alias()`** (`scripts/illustration-vague.sh`), seule source, et se lit hors interaction par `bash scripts/illustration-vague.sh --modele "<nom>"` :

  | Nom humain | Alias gflow | Note |
  |---|---|---|
  | Nano Banana 2.1 | `nano2` | **défaut** ; sur `flow.google.com`, Flow a remplacé NB2 par **2.1** sous le même alias (gflow `docs/INDEX.md:174`, #958). Sur `labs.google`, `nano2` reste NB2 |
  | Nano Banana 2 Lite | `nano2-lite` | |
  | Nano Banana Pro | `nano-pro` | |
  | Imagen 4 | `image4` | |

  Un agent à qui on demande « Nano Banana 2.1 » doit donc passer `model: "nano2"` — jamais le nom humain, que gflow rejetterait.
- **Garde-fou visuel** : **Impeccable** (`.opencode/skills/impeccable/`, Apache-2.0) — un détecteur **déterministe** de 61 tells d'UI générée par IA, sans IA ni clé. `npm run detect:ui` (`npx impeccable detect src/`) ; la **CI** le lance après les tests. Un refus se corrige ou se **désactive explicitement** avec la raison (`<!-- impeccable-disable <règle> -->`), jamais en silence.

## 7. Commandes

Toujours depuis `planquex/`. Le chemin ne contient plus d'espace depuis le déménagement du 21/10/2026 (D-047) ; le quoting reste une bonne habitude.

```bash
cd /home/chapax/Documents/opencode/gamedev/planquex
```

| Commande | Usage | État vérifié le 19/10/2026 |
|---|---|---|
| `npm install` | Installer les dépendances | **OK** (`npm ci` ; `@types/node` ajouté en dev) |
| `npm run dev` | Serveur Vite sur `:5178` | non exécuté dans cette vérification ; `preview` l'a été |
| `npm run check` | `tsc -b` | **OK**, exit 0 |
| `npm test` | `vitest run` | **OK**, exit 0 ; le nombre de fichiers et de tests est celui que la commande affiche |
| `npm run test:watch` | Vitest en watch | lance la suite complète |
| `npm run build` | `tsc -b && vite build` | **OK**, exit 0 ; `dist/index.html` + `dist/sw.js` produits |
| `npm run preview` | Servir `dist/` | **OK** (utilisé sur `:4180` pour la vérification navigateur) |
| `npm run status` | Métriques JSON, dont les cartes dérivées d'`ALL_CARDS` | **OK**, exit 0 |
| `node scripts/status.mjs` | Même script directement | **OK**, exit 0 |
| `npm run capturer` | Photographie les pages et échoue sur une erreur de console | **OK**, exit 0, 5 images dans `captures/` (sur `dist/`, donc après `npm run build`) |
| `npm run simulate` | Simulateur headless seedé ; usage `npm run simulate -- --games 100 --seed 42` | **OK**, exit 0 (20/10/2026, `--games 100 --seed 42`) ; rapport par faction, voir `scripts/simulate.mjs` |
| `npm run garde-fous` | **Mute** un invariant critique et **exige que la suite échoue** — un test qui ne peut pas échouer ne garde rien (#112). Sort 1 si une mutation passe inaperçue, ou si un motif a disparu du code (entrée à réancrer). `--verifie` fait le contrôle statique de la table, sans rien muter | **OK**, exit 0 (21/10/2026) ; `scripts/garde-fous.mjs` et sa table commentée |
| `npm run pesage` | **Le niveau 2 bat-il le niveau 1 ?** Graines d'entraînement et de **contrôle** (disjointes, #111), **seuil décidé d'avance** (≥ 55 % des décidées *et* ≥ 1,15×), miroir apparié, intervalle de confiance à 95 %. Usage : `npm run pesage -- --games 100 --json` | **OK**, exit 0 (21/10/2026) ; reproduit les chiffres de #111 à l'identique — `scripts/pesage.mjs` |
| `npm run isolation` | **L'agent a-t-il écrit dans SON worktree ?** Contrôle exécutable : le dépôt principal doit être **propre**, aucun worktree en **HEAD détaché** (un commit y serait perdu pour toute branche), et `--attendu <nom>` exige que **seul** ce worktree porte du travail. À lancer **après chaque agent** | **OK**, exit 1 **détecte la fuite** (21/10/2026 : démonstration sur une fuite réelle) — `scripts/isolation.mjs` |
| `bash scripts/finir-renommage-planquex.sh` | **Wizard #100** — les actions de tableau de bord que l'agent ne peut pas faire : renommer le projet Supabase, retirer le domaine `grevomon.vercel.app`, l'expéditeur Brevo. Il **mesure** les deux domaines au `curl` avant et après, donc il dit lui-même s'il a réussi. Complète `etapes-infra-tcg.sh` (#10), ne le répète pas | `bash -n` **OK** (21/10/2026) ; **non exécuté** : interactif, il ouvre des navigateurs et attend la personne |
| `bash scripts/illustration-vague.sh [id]` | **Wizard #97** — produit une illustration par `gflow-cli`, la range **au registre** (`design/illustrations/`, seule source depuis D-045), lit la **graine** dans le `--json` du CLI, tient le registre et câble `art:`. Il refuse de démarrer si aucun profil Flow n'est authentifié, et **sort en erreur** si `npm run check` ou les tests échouent. `--modele "<nom humain>"` **résout hors interaction**, `--lit-json` et `--lit-base` relisent une trace ou la base locale de gflow (seams testés). Chemins surchargeables par l'environnement : `GFLOW_ILLUSTRATION_*` | `bash -n` **OK**, `--modele` **OK**, `--lit-base` **OK** (21/10/2026) ; **bout en bout** dans un bac temporaire par `scripts/illustration-vague.test.ts` ; **non exécuté** contre le vrai Flow : il génère (30-90 s) et ouvre un navigateur |
| `gflow auth login --browser chrome` | **Une fois** — ouvre un vrai Chrome et connecte le compte Flow. C'est le prérequis de tout le tuyau d'illustration, et la seule étape que personne ne peut automatiser. Sans Chrome : `--browser internal` marche parfois, mais le profil n'a pas le marqueur `chrome` | **Fait le 21/10/2026** : `gflow 0.86.0` (`uv` 0.13.4), Chrome installé, profil créé avec la stratégie **`chrome`** (`.gflow_browser_strategy`), `gflow doctor` → **Overall: ok** |

Les 2 erreurs de `check`/`build` constatées le 18/10 sont **corrigées** :

```text
src/game/engine.ts(464,7): TS2367  → checkup retourne l'état ; la garde lit la valeur retournée (la garde elle-même reste nécessaire).
vite.config.ts(1,36):  TS2591  → dépendance de développement @types/node ajoutée.
```

Autres faits vérifiés le 19/10/2026 :

- `src/main.tsx` et `src/App.tsx` existent ; `index.html` monte l'application sous `BrowserRouter`.
- `public/` **existe** (créé le 19/10/2026) : `favicon.svg`, `icon-192.svg`, `icon-512.svg`. Les trois sont copiés dans `dist/` par le build.
- Une seule feuille, `src/styles.css`, importée par `main.tsx`.
- **Les décomptes ne sont pas recopiés ici** : le nombre de fichiers de test et de tests est celui qu'affiche `npm test` ; le nombre de cartes, de bases, de variantes et de factions est celui qu'affiche `npm run status` (`cards`), **dérivé d'`ALL_CARDS`** (`src/data/index.ts`), seule source de ce nombre. `scripts/compteurs.test.ts` échoue si un décompte en dur revient dans ce §7 ou dans `README.md`. `src/data/cards.test.ts` vérifie les conventions d'écriture (§3, §5, CARD-SPEC §1), le **Seuil par stade** (D-023) et les **bandes de dégâts par café** (D-021) ; `src/game/pace.test.ts` chiffre le rythme (`PACE_REPORT=1`).
- `npm run build` produit `dist/index.html` **et** `dist/sw.js` : c'est la preuve d'un build valide. `preview` + inspection navigateur ont confirmé le rendu des pages Accueil, Chariot et Combat.
- Node `v24.21.0` / npm `11.19.0` : **non revérifiés** dans cette passe. `package.json` déclare Vite `8.3.4`, TypeScript `7.0.2`, Vitest `5.0.5`, React `19.3.1`, `@types/node` `26.6.5`.
- Le dossier **est** un dépôt git : branche `main`, remote `origin` → `https://github.com/Chapax/planquex` (privé). Le dossier local porte lui aussi `planquex` depuis le 21/10/2026 (D-047, qui clôt l'étape 4 de `RENOMMAGE.md` §8) : le nom du dossier, celui du dépôt et celui de l'URL se lisent enfin pareil.
- **Déploiement (21/10/2026, D-053)** : la **production** du projet Vercel `planquex` sert `main` sur `https://planquex.vercel.app` — c'est le banc d'essai externe annoncé par D-048. La **version servie** ne se recopie pas ici : elle monte à chaque build donnée à quelqu'un, et elle se lit dans Réglages ou dans `package.json` (`docs/VERSIONS.md` §5). `vercel.json` porte la **réécriture SPA** : sans elle, une visite **directe** sur `/parc` (comme `/chariot`, `/combat`, `/reglages`) répond `404` — Vercel ne fait pas de repli pour un site statique, et le service worker ne masque le défaut qu'après la première visite. Le projet est **lié à `Chapax/planquex`** et **la chaîne push → production fonctionne** depuis le 21/10/2026 (D-054, D-055) : le commit vide `4f8e2d3` a été déployé **24 secondes** après son push (`source: "git"`, `target: "production"`). La cause du blocage n'était pas Vercel mais l'**application GitHub de Vercel, qui n'avait pas accès au dépôt** — quatre push de mesure n'avaient rien déclenché. `grevomon.vercel.app` est retiré (`404`) ; la cible est **`planquex.4k7.org`** (zone Cloudflare `4k7.org`), bascule **bloquée** par les droits OAuth de la zone (D-055).

### 7.1 Piège connu — le service worker casse le dev sur la même origine

Vite répond **`200` en `Content-Type: text/html`** à **tout** chemin inconnu (son *fallback* SPA) : il ne renvoie jamais `404`.

Conséquence : si le navigateur charge encore la page du **build** — service worker `VitePWA` enregistré sur `localhost:5178`, ou onglet resté ouvert depuis un `preview` — il demande `/assets/index-<hash>.js`, reçoit du HTML, et refuse de l'exécuter comme module. L'écran reste **blanc**, la console dit à peu près *« Expected a JavaScript module script but the server responded with a MIME type of text/html »*, et **le terminal du serveur n'affiche aucune erreur** : il a répondu `200`.

Le réflexe : **DevTools → Application → Service Workers → Unregister**, puis **Storage → Clear site data**, et recharger (une fenêtre privée suffit aussi). Chaque fusion change les *hash* des assets, donc le piège se rejoue à chaque merge tant qu'on ne purge pas. Pour changer d'origine sans purger : `npm run dev -- --port 5199` — un service worker est enregistré **par origine**, et un autre port en est une autre.

## 8. Audits

Un audit est une **preuve**, pas une opinion. Il se fait toujours sur `planquex/`, jamais sur `grevomon-pocket/`.

### 8.1 Protocole

1. Lire `AGENTS.md`, `docs/DECISIONS.md`, puis les docs concernés.
2. Lancer les commandes de référence et noter **commande exacte, exit code, extrait exact**.
3. Distinguer explicitement **observé** (commande/fichier) et **non vérifié** (déduit).
4. Ne jamais conclure « fait » sans test, build, capture ou sortie de commande.
5. Vérifier le code, pas seulement les docs. `docs/STATUS.md` est un instantané daté.
6. Signaler les blocages préexistants au lieu de les masquer ou de les attribuer à la modification en cours.

### 8.2 Batterie de référence

```bash
cd /home/chapax/Documents/opencode/gamedev/planquex
npm run status
npm run check
npm test
npm run build
ls -la dist/index.html dist/sw.js
find src scripts -name '*.test.*' -o -name '*.spec.*'
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
- `npm run garde-fous` : exit 0 — et toute garde **nouvelle** est ancrée (un test « le contrôle mord » qui la confronte à un cas fautif, ou une entrée commentée dans `scripts/garde-fous.mjs`). Une assertion qui **ne peut pas** échouer ne compte pas comme un test.
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

Voir `../grevomon/grevomon-pocket/LEGACY.md`.

## 10. Agent skills

### Issue tracker

Les tickets vivent dans GitHub Issues sur `Chapax/planquex`, piloté par la CLI `gh`. Voir `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq rôles de triage canoniques utilisent leurs noms par défaut (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Voir `docs/agents/triage-labels.md`.

### Domain docs

Contexte unique. Le vocabulaire est `AGENTS.md` §3, les décisions sont `docs/DECISIONS.md`. Voir `docs/agents/domain.md`.

### Parallélisme

Quand plusieurs agents travaillent en même temps : **zones** de fichiers, **modèle adapté à la
tâche**, vagues disjointes, protocole de fusion et ses pièges. Voir
**`docs/agents/parallelisme.md`** — lire avant de lancer plus d'un agent.
