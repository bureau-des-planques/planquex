# AGENTS.md — Bureau des Planqués

> Projet actif : **`planquex/`** — le dossier local porte le nom du dépôt depuis le 21/10/2026 (D-047).
> Les **versions abandonnées** vivent dans un **dossier frère, hors du dépôt** (§9) : **lecture seule**.
> Ne jamais les utiliser comme source de vérité pour les règles, le vocabulaire, le contenu ou un audit.

## 1. Règles d'or

1. Lire ce fichier. Pour `docs/DECISIONS.md` (142 décisions, 36 000 jetons), ouvrir son **index** (`docs/DECISIONS-INDEX.md`, une ligne par décision) et lire la ou les décisions qui touchent ta zone — pas le journal entier. Un point de règle non tranché par une décision se signale, il ne s'invente pas.
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
2. **`AGENTS.md` §4 et §5** — la table des règles de jeu et les règles d'écriture des cartes. Chaque ligne de §4 est **sourcée** par D-034 : les captures de l'application (`docs/preuves/astuces-*`) et la recherche documentée (`docs/preuves/regles-*`). Si les deux se contredisent, **la capture l'emporte** et l'écart se signale.
3. **`docs/CARD-SPEC.md` et `docs/FACTIONS.md`** — structure du set, courbes, factions, nommage.
4. **`docs/MIROIR-2026-DELTAS.md`** — écarts connus entre le tableau §4 et le jeu de référence 2026, avec leurs sources. Décrit les écarts **et leurs verdicts** (O-008 → D-020, O-009 → D-022) ; il ne reste plus d'écart ouvert sur §4 (O-014 tranché par D-034) : ne pas s'en servir pour modifier une règle sans décision datée.
5. **Le code et les commandes** — ce qui existe réellement. Un écart avec les docs est un bug ou une tâche, pas une nouvelle règle.
6. **`docs/STATUS.md` et `docs/AUDIT-*.md`** — instantanés d'audit datés. Ce ne sont pas des vérités live : relancer les commandes.

**Gelés, hors de l'ordre d'autorité** (D-112) : `docs/PROPOSITION.md` §3–5, `docs/CORRESPONDANCES.md` et `docs/NOMMAGE.md` gardent le vocabulaire d'avant D-026 et D-075 (« Chariot », « Parc », « Rack ») et documentent le **périmètre d'origine**, pas les règles vivantes. Le gel est un acte (D-075, D-083) : on ne s'en sert pas pour trancher un conflit, et on ne les « remet à jour » pas non plus — les règles vivantes sont en §4, le périmètre dans `docs/DECISIONS.md`.

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
| Deck | **Deck** | `deck`, 20 cartes — « Chariot » depuis D-026 jusqu'à D-075 |
| Hand | **main** | `hand`, 5 au départ, 10 max |
| Discard | **Rebut** | `discard` — le verbe est « **mettre au rebut** » |
| Bench | **Banc** | `bench`, 3 places — « Rack » depuis D-026 jusqu'à D-083 |
| Active | **Poste** | `active` |
| Coin flip | **Lancer de tampon** | pile = tampon, face = agrafe |
| Mulligan | — | le jeu de base n'en a pas, et nous non plus (D-022) |
| Pack | **Arrivage** | 5 cartes |
| Extension / set | **Marché** | il contient ses **Viviers** |
| Zones de cartes | **Viviers** : Atelier, Étage, Bureaux | un futur vivier sera un lieu (D-026) |
| Wonder Pick | **Pause café** | 5 cartes, 1 rare minimum |
| Collection | **Collection** | « Parc » depuis D-026 jusqu'à D-075 ; les routes sont `/collection` et `/deck`, `/parc` et `/chariot` redirigent (D-075) |
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
| Suggestion box (retours) | **le comité** (ex-Boîte à idées) | l'entrée : la **bulle** présente partout ; l'écran s'appelle **le mur** (D-058, D-097) — adresse `/comite` |
| Amélioration / idée | **post-it IP** | une idée, une fonctionnalité, un avis — « IP » = *Idée de Progrès*, comme au kaizen (D-058) |
| Signalement (bug) | **post-it OUF** | le jargon Safran, **gardé tel quel** : on ne l'explique pas, on l'emploie (D-058) |
| Testeur de l'alpha | **un testeur** | jamais « un joueur » tout court : le public, c'est le lancement (D-117) |

**Interdits dans les données, l'UI et les textes du jeu** : `Galère`, `GalèreMon`, `Pokémon`, ainsi que **l'ancien nom du projet** et le vocabulaire de son univers — la liste tenue par `src/data/cards.test.ts` (`FORBIDDEN_ANY_CASE`) en est la version exécutable, et c'est elle qui fait foi. Les docs peuvent citer « Pokémon TCG Pocket » comme référence externe. L'ancien nom **Galérodex** est **abandonné** (il venait de l'univers legacy) : la collection s'appelle **la Collection**.

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
courant** (`management`, `audit`) sont admis — les **titres à la mode** (« Happiness
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
| Deck | **20 cartes**, max **2** exemplaires du même nom, au moins **1 Planqué Entrant** |
| main de départ | **5 cartes**, avec toujours au moins **1 Planqué Entrant** ; **pas de reprise de poste** : ni remélange, ni pioche pour l'adversaire (D-022) |
| main maximale | **10 cartes** |
| Poste | **1** |
| Banc | **3** places |
| Interventions | **3** pour gagner ; un craquage normal = 1, un COMEX = 2 |
| Machine à café | **1 café généré par tour**, **1 attachement par tour** ; si le slot du haut est occupé, pas de nouveau café — la zone ne contient donc jamais plus d'un café (D-034) |
| Types de café | Le coût d'une Pression est une **liste de symboles** (un type de faction, ou **`INCOLORE`** — distinct de `SUPPORT`) ; un symbole typé exige un café de ce type, un symbole incolore accepte tout, et un café incolore (jamais produit) paie un coût typé (D-037). Jusqu'à **3** types par Deck, **choisis par le joueur (1 à 3, proposition automatique d'après les factions présentes)**, `SUPPORT`/`INTERIM` jamais proposés ni retenus (D-034, D-037 ; #91) |
| Premier joueur | **Tiré au sort** par un lancer de tampon (D-033) ; **pioche** ; ne peut pas attacher de café ; peut jouer un Collègue ; peut attaquer si l'attaque coûte 0 (D-030, D-039 — écart assumé : le coût `0` existe dans le code `DAMAGE_BY_COST`, aucune carte ne le porte) |
| Évolution | Impossible au premier tour de chaque joueur |
| Seuil / Stress | le **Seuil** remplace le Moral ; les dégâts deviennent du **Stress** qui monte ; à `Stress ≥ Seuil`, le Planqué **craque** (D-026) |
| Pression | **1 par tour** ; le café n'est **pas consommé** ; elle fait monter le **Stress** ; elle **termine le tour** (D-033) |
| Ordre des dégâts | dégâts de la Pression → effets sur l'attaquant → **Vulnérabilité** → effets sur le défenseur (D-031) |
| Vulnérabilité | **+20** — le ×2 n'existe que via un Lieu, hors périmètre (D-020) ; **ne s'applique pas au Banc** (D-031) |
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
| Talent `attachEnergy` | Attache **un café tiré au hasard dans le Deck du joueur** (même générateur seedé que la Machine, `drawCafeType`, `engine.ts:458-463`, `state.players[who].cafeTypes`) — D-040, #110 (a) |
| Outils / Lieux | **Hors périmètre du lancement** : le jeu de référence les a déjà, c'est un choix de périmètre (D-020), pas une description du miroir |

**Miroir daté et borné** : le référent est Pocket **dans son état de 2026** (D-018) pour les **règles de base** ; les **ajouts 2025-2026 sont exclus du périmètre** (D-020) — Méga-Évolution ex à 3 Interventions, Vulnérabilité ×2 par un Lieu, Pokémon à double type, Outils et Lieux. Le projet reste donc à 3 stades, COMEX = **2 Interventions**, un Planqué = **une** faction. « Aucune valeur mathématique ne change » vaut **pour ce périmètre annoncé**, et non comme description du jeu de 2026. **État des preuves (20/10/2026)** : les « Astuces de jeu » ont été capturées — 9 écrans, `docs/preuves/astuces-2026-10-20/` — et **douze lignes de ce tableau passent à « observé »** (D-030). Les quatre lignes non capturées — le **plafond de 3 types de café**, la **main de départ à 5**, la règle du « slot occupé » et la **reprise de poste** — sont **établies par la recherche**, qui fait foi au même titre que les captures (D-034) : §4 n'a plus de ligne non sourcée. Chiffrage des écarts : `docs/ARBITRAGE-O-008.md` ; sources et verdicts : `docs/MIROIR-2026-DELTAS.md`. La revue de sources du même jour (`docs/preuves/regles-2026-10-20/`, D-032) recoupe ces lignes par une transcription datée et apporte les ajouts de **D-031** (ordre des dégâts, Vulnérabilité hors Banc, double craquage, nombre de tours).

### 4.1 Ce qui n'est pas la règle standard

- Le standard, c'est **le miroir de Pocket (D-018) plus le mot-clé « Changement de priorité » (D-004)**. Rien d'autre.
- Les règles maison **`RULES-4b` sont rangées à part** dans `docs/MODES-FUTURS.md` (mode futur « Café », ni acté ni implémenté) : ce n'est ni une référence, ni un mode par défaut. Ne pas les citer comme règles du jeu (D-019).
- Le texte d'une carte décrit la carte vendue, pas l'état du moteur : voir **D-074**.
- Pas de compteur de stress, pas de ressource maison, pas de règle de deck alternative.
- **« Changement de priorité »** (D-004) : une fois par tour, au Poste, défausser 1 carte puis piocher 1. Mot-clé porté par les cartes, déactivable par un drapeau global, testé en simulation avant validation. C'est la seule exception actée.
- **« Pause café »** désigne le Wonder Pick. Ne pas réutiliser ce terme pour une action de combat.

### 4.2 Viviers et contenu

- Un **Arrivage** contient **5 cartes** : 3 communes, 1 peu commune, 1 rare minimum.
- **Cible de contenu : autour de 300 cartes** — le set compte **225 bases + 75 variantes**, et le
  chiffre **n'est pas un objectif** (D-063) : une bonne idée entre, une carte faite pour remplir un compte
  n'entre pas. Ce qui compte est ce que le contenu permet de **jouer** : des Decks et des stratégies.
- Trois **viviers** (D-026) : **l'Atelier** (Atelier, Management, Syndicat), **l'Étage** (Amélioration continue, Support, Direction), **les Bureaux** (RH, SSE, QVT, Intérim).
- Monétisation v1 : **aucun argent réel** ; la Cotisation se paie en monnaie de jeu.
- Ton : satire de bureau **punch up**. On ridiculise les postures et le système, jamais une personne réelle, une entreprise existante ou un groupe protégé.

## 5. Écriture des cartes

- **Raretés hautes (`3S`, `COU`)** : portées **uniquement par des variantes de Planqués** (les variantes d'Action restent `1S`/`2S`) — D-044 (#105 (a)). Les 7 variantes hautes (`3S` × 4, `COU` × 3) **ne sortent d'aucun Arrivage** (`PACK_COMPOSITION`, `src/game/pack.ts`) : elles sont au catalogue (`CARD_BY_ID`, `src/data/index.ts`), pas dans le tirage.
- **Identifiants** : minuscules, kebab-case, préfixe de faction — `sse-infirmier-site`. Variantes : le suffixe **porte la rareté** — `-star` (`1S`), `-star2` (`2S`), `-star3` (`3S`), `-crown` (`COU`) ; la table est unique (`SECRET_RARITY`, `src/data/planque.ts`) et un test la lit dans les deux sens. **COMEX : suffixe `-ex`** — l'id porte `ex`, et le **statut** COMEX (D-026) s'affiche sur la carte. Le nom **n'a pas à porter « COMEX »** (D-095) : celui de l'Atelier porte un jeu de mots (« RPO sans RUI »). C'est la seule entorse au point suivant, et elle vient du **statut**, pas du nom. **Un id suit le nom** : renommer une carte renomme son id, et un renommage d'id s'accompagne d'une **migration du store** (`version`, cf. §6). L'écart id/nom est un *Mysterious Name* : dans un dépôt lu par des agents, une carte introuvable par son nom ne se trouve plus du tout.
- **Évolution** : `evolvesFrom` pointe vers l'`id` de la carte précédente. Une variante hérite des stats, attaques, talent et flavour de sa carte de base.
- **COMEX** : `ex: true`, vaut 2 Interventions. L'UI affiche « COMEX », pas « ex ».
- **Effets** : utiliser uniquement les `AttackEffectKind` existants (`healSelf`, `healAll`, `status`, `draw`, `discardEnergy`, `selfDamage`, `switchSelf`, `reduceDamage`). Toute nouvelle primitive = décision + mise à jour des types + tests.
- **Textes (D-074)** : le texte décrit la carte vendue, pas l'état du moteur ; un écart s'inscrit dans `MENSONGES_CONNUS`. Français, phrase complète, « Ce Planqué… », « le Planqué adverse… », noms de statuts capitalisés. Exemple **interdit** : `Cette Galère subit 10 dégâts.` ; écrire `Ce Planqué subit 10 dégâts.`
- **Flavour** : une scène de bureau, drôle, sans nom réel. La chute vise le système.
- **Stats** : suivre `CARD-SPEC.md` §2.

| Stats | suivre **`CARD-SPEC.md` §2** | la table n'est **pas recopiée ici** : elle y bouge à chaque ajustement, et une copie prend du retard (leçon de la propagation de D-026) |

- Une attaque à 1 café fait 10–30 ; à 2 cafés, **40–80** ; à 3 cafés, **70–120**. Un **effet** ne coûte **pas** de dégâts à 1 et 2 cafés ; à partir de 3 cafés, il en coûte 20 à 40. La table normative est **`CARD-SPEC.md` §2** (D-021), que `src/game/curves.ts` implémente : cette ligne la **résume**, elle ne la remplace pas.
- Un Talent ne doit pas créer d'avantage de cartes net sans coût.
- Un COMEX doit être plus fort, pas auto-include.
- Vulnérabilité : +20. L'Intérimaire n'a aucune vulnérabilité.

## 6. Architecture et conventions

Application **Vite plate** ; le monorepo de `PROPOSITION.md` §6.1 est une cible : ne pas restructurer sans décision. **`docs/ARCHITECTURE.md`** porte l'arborescence et le détail de chaque ligne ci-dessous (outils `tools/`, modules du moteur, store, versions, CI, PWA, CSS/Tailwind, comité/Supabase, illustrations/gflow, configuration OpenCode) : le lire avant de toucher la zone concernée.

- **TypeScript strict**. Alias `@/` → `./src`, déclaré dans `tsconfig.json` **et** `vite.config.ts`.
- **UI en français**, identifiants de code en anglais. Aucun texte de carte hors de `src/data`.
- **Moteur** : code pur, sans React ni DOM. `applyAction(state, action)` et fonctions de transition, `structuredClone` pour cloner. Le hasard vient d'un générateur **seedé** (`src/game/rng.ts`) : aucun `Math.random()` dans `src/game/` ni `src/store/`. `applyAction` est le seul point qui journalise (`actionLog`), `replayBattle` rejoue une partie.
- **Store** : Zustand + `persist`, clé `bureau-des-planques-v1`, forme versionnée par `migratePersisted` (`src/store/useStore.ts`, seule source du numéro). Toute modification de forme se migre.
- **Données** : un fichier par faction, puis `src/data/index.ts` (`ALL_CARDS`, `CARD_BY_ID`, métadonnées). Cartes Action dans `actions.ts`, socle dans `planque.ts`, `FACTION_META` (`factions.ts`) seule source de la Vulnérabilité et de la couleur. Le vocabulaire partagé (`CAMP_NAME`, `cafeLabel`) vit dans `src/data/vocabulaire.ts` : un fait, un fichier (#248).
- **Version** : lire `docs/VERSIONS.md` avant d'écrire un numéro.
- **Tests** : Vitest, `*.test.ts` à côté du code. Pas de test = pas de preuve.
- **Garde-fous** : une assertion qui garde une **règle** doit **pouvoir échouer**. Deux moyens : (1) un test « **le contrôle mord** » qui confronte le contrôle à un **cas fautif** ; (2) une entrée dans **`scripts/garde-fous.mjs`** (table courte, commentée : **ticket**, **règle** gardée, **tests ciblés**), mutée par `npm run garde-fous`. La table elle-même est surveillée par `scripts/garde-fous.test.ts`.
- **Effets de bord d'un test** : un test n'ouvre ni navigateur ni fenêtre sur le poste de l'utilisateur ; `src/test/setup-poste.ts` fait échouer tout `spawn` d'ouverture (`xdg-open`, `open`) — injecter le lanceur, comme `ouvrirNavigateur(url, lancer)`.
- **CI** : `.github/workflows/ci.yml`, sur `push` et `pull_request` vers **`main`** — **trois jobs en parallèle** (D-115) : `controles` (`check`, `format:check`, `garde-fous`, détecteur d'UI, `build`, artefacts), `tests-noyau` (`npm test -- --project=node`) et `tests-ecrans` (`--project=ui`, puis `build` et contrôle des écrans). Le temps mural est un **maximum**, pas une somme. Les **fichiers générés** (`plan-dev.ts`, `versions.ts`) n'y sont **pas** vérifiés (D-113) : `fichiers-generes.yml` s'en charge sur un tag `v*`, et `docs/VERSIONS.md` §4 le fait faire en local avant de taguer.
- **CSS** : une seule feuille, `src/styles.css`. Tailwind v4 (CSS-first) est le moteur de style, shadcn/ui ne sert qu'aux composants génériques ; le système visuel vit dans `DESIGN.md`.
- **Preuve de rendu** : un écran ne se déclare rendu que par capture ou inspection du navigateur, pas par la lecture du JSX ; une animation, par une **planche de frames** (`scripts/filmer-animation.mjs`), pas par un style calculé. Voir §8.4.
- **Le serveur des testeurs (D-120, #317)** : un serveur Discord **facultatif** pour les testeurs de l'alpha. Le client ne porte **qu'un lien** : l'invitation vit dans `VITE_DISCORD_INVITE`, lue par **un seul module** (`src/components/InvitationTesteurs.tsx`) ; vide = rien de rendu, et le build sans configuration reste l'état par défaut. Le lien s'affiche dans **Réglages** et au **pied du comité**, en nouvel onglet, `rel="noreferrer noopener"`. **Aucun `iframe`, script ou widget** Discord n'entre dans le jeu : la page Confidentialité promet « aucun traceur ». La **procédure d'exploitation** — salons `#comite` / `#depot` / `#deploiements`, règles, webhook GitHub, intégration Vercel, invitation permanente — est dans **`docs/INTEGRATIONS-DISCORD.md`**, rejouable par quelqu'un qui n'a jamais créé le serveur ; le message aux testeurs, lui, est **`docs/ALPHA-TESTEURS.md`**.
- **Garde-fou visuel** : `npm run detect:ui` (sources) et `npm run detect:ui:page` (écrans servis, avec cliquet), lancés par la CI. Un refus se corrige ou se désactive avec sa raison (`<!-- impeccable-disable <règle> -->`).
- **MCP `gflow`** : `gflow_generate_video`, `gflow_upscale_video` et `gflow_download_media` **dépensent des crédits Veo** ; seuls les outils image sont autorisés. Passer `gflow_auth_status` avant toute génération. Le modèle se passe par son **alias** (`nano2`, `nano2-lite`, `nano-pro`, `image4`), jamais par le nom humain : `bash scripts/illustration-vague.sh --modele "<nom>"`.

## 7. Commandes

Tableau des commandes, wizards et gotchas : **`docs/COMMANDES.md`**, depuis `planquex/`. Après une modification : `npm run check`, `npm test`, `npm run garde-fous`, `npm run build` (§8.4).

- **Installer les dépendances** : `npm run installer` dans le worktree. `npm ci` vide `node_modules/` et ne se lance jamais dans le dépôt principal (`scripts/installer.mjs` le refuse).
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
- **Les pourcentages du `PLAN.md` des versions abandonnées ne s'appliquent pas** à ce projet. Ne pas les recopier.
- `npm test` en échec par absence de tests n'est pas un test réussi.
- Le dossier a un historique git depuis le 18/10/2026, avec plusieurs commits sur `main` : lancer `git log` avant de parler d'un commit, `git worktree list` avant de conclure qu'il n'y a qu'un seul répertoire de travail, et `git status` avant d'affirmer qu'un fichier est à jour.
- Les alias `@/` sont déclarés dans `tsconfig.json` **et** `vite.config.ts` ; un seul des deux ne suffit pas.

### 8.4 Definition of done

Pour une modification de code :

- `npm run check` : exit 0.
- `npm run format:check` : exit 0 (ou `npm run format` l'a fait).
- `npm test` : exit 0, avec au moins un test couvrant le changement.
- `npm run garde-fous` : exit 0 — et toute garde **nouvelle** est ancrée (un test « le contrôle mord » qui la confronte à un cas fautif, ou une entrée commentée dans `scripts/garde-fous.mjs`). Une assertion qui **ne peut pas** échouer ne compte pas comme un test.
- `npm run build` : exit 0, `dist/index.html` et `dist/sw.js` présents.
- `npm run ci:etat` : exit 0 avant de **fusionner** vers `main` — si `main` est rouge, on ne fusionne pas sans savoir pourquoi (D-115, #258).
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

Les **versions abandonnées** du projet sont conservées comme **référence historique**, dans un **dossier frère, hors du dépôt** (dans `gamedev/`) : la première version en JavaScript avec son prototype, la version « pocket », et l'APK de référence décompilé. Ce qu'elles portent — le vocabulaire « Galère », les règles maison `RULES-4b` (12/4/3), 38 cartes, une application plate — n'a **aucune valeur de règle** ici.

Elles sont en **lecture seule** : on peut y consulter une idée d'UI ou l'inventaire fonctionnel de l'APK, jamais y travailler, et **jamais** les prendre pour source de vérité du vocabulaire, des règles, du contenu ou des pourcentages (§1.2, §1.5). Chaque dossier d'archive porte son `LEGACY.md`, qui dit ce qu'il est.

## 10. Agent skills

### Issue tracker

Les tickets vivent dans GitHub Issues sur `bureau-des-planques/planquex`, piloté par la CLI `gh`. Voir `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq rôles de triage canoniques utilisent leurs noms par défaut (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Voir `docs/agents/triage-labels.md`.

### Domain docs

Contexte unique. Le vocabulaire est `AGENTS.md` §3, les décisions sont `docs/DECISIONS.md`. Voir `docs/agents/domain.md`.

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
