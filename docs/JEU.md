# Le jeu — vocabulaire, règles, écriture des cartes

Extrait d'`AGENTS.md` le 28/10/2026 (**D-144**) : ces trois sections ne servent qu'aux tâches
de contenu et de règle, et pesaient **16 000 caractères** dans le contexte de **toutes** les
sessions — y compris celles de CI, de déploiement ou d'interface.

**Les numéros restent ceux d'`AGENTS.md`** (§3, §4, §5) : les renvois du dépôt restent justes,
et `AGENTS.md` §2 dit dans quel ordre ce document fait autorité.

---

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
