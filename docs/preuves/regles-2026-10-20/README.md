# Preuves de règles — revue de sources, 2026-10-20

> **Lot de recherche**, pas de captures. Il rassemble ce que des sources publiques
> disent des règles de *Pokémon TCG Pocket*, ligne par ligne contre `AGENTS.md` §4.
> Complète le lot de captures `docs/preuves/astuces-2026-10-20/`.
> Ouvert le 20/10/2026 sur la branche `preuves/regles-2026-10-20`.

## 0. Méthode — et sa limite

Une affirmation sans citation est une hypothèse (`AGENTS.md` §1.3). Ici, chaque ligne
porte **une citation exacte** et **l'URL ou le chemin** qui la porte.

Trois niveaux, à ne jamais confondre :

| Niveau | Ce que c'est | Exemple |
|---|---|---|
| **Primaire** | le texte du jeu lui-même | une capture des Astuces ; le masterdata du jeu |
| **Transcription** | quelqu'un a recopié le texte du jeu et **le cite** | `deckgym-core` : « per the in-app Tips panel, transcribed 2026-09-08 » |
| **Secondaire** | un tiers décrit le jeu | un wiki, un simulateur, un article de presse |

**Ce lot ne contient aucune preuve primaire.** Sa meilleure pièce est une
**transcription datée** du texte in-app (niveau 2), recoupée par des sources
secondaires. C'est plus faible qu'une capture — et c'est dit à chaque fois.

**Critère d'arrêt retenu** : une passe de requêtes qui n'apporte plus aucune
affirmation nouvelle. Atteint le 20/10/2026 après 4 passes (moteur, données,
simulateurs, datamining).

## 1. La pièce maîtresse : `bcollazo/deckgym-core`

Moteur Rust du jeu (★76, mis à jour le 19/10/2026), qui alimente `deckgym.com`.
Ses tests de règles portent cet en-tête (`tests/rules/mod.rs`) :

> « Rules-accuracy tests derived from the game's own text: the in-app "Tips" (Battle
> Guide) panel and the app-linked official "Detailed battle FAQ", **both transcribed
> 2026-09-08**. Each test cites the sentence it enforces. »

Autrement dit : **les Astuces in-app et la FAQ détaillée ont été transcrites** et
chaque test cite la phrase qu'il applique. C'est la source la plus dense trouvée.

## 2. Verdict, ligne par ligne

Légende : ✅ conforme · ⚠️ **contredit** · ➕ **manque à §4** · ❔ non observé.

| Ligne de `§4` | Verdict | Citation de la transcription | Autres sources |
|---|---|---|---|
| Chariot 20 cartes, max 2, ≥ 1 Entrant | ✅ | code : `Deck::is_valid()` — « 20 cards and basic ≥ 1 », « no card name appears more than twice » | 7/7 simulateurs ; guide de deck officiel |
| main de départ 5, toujours ≥ 1 Entrant | ✅ | code : « draw 5 cards each to start », « Ensure there is at least 1 basic pokemon in the initial 5 cards » | 6/7 simulateurs |
| **pas de reprise de poste** | ✅ | aucune logique de remélange ; l'init garantit l'Entrant | Bulbapedia : « mulligans will never be taken » |
| main maximale 10 | ✅ | code : « cannot draw a card, hand is full (10 cards) » | Bulbapedia, TVTropes, 4 simulateurs |
| Poste 1 / Rack 3 places | ✅ | code : « 0 index is the active pokemon, 1..4 are the bench » | 7/7 simulateurs ; **capture** : « Le Banc a trois emplacements » |
| 3 Interventions ; 1 par craquage, 2 pour un COMEX | ✅ | « If one player gets the set number of points… that player wins » | FAQ officielle (article `57282177269273`) |
| Interventions **uniquement** sur craquage | ✅ | idem | FAQ officielle FR : « vous n'obtenez pas de points si un Pokémon adverse en jeu est défaussé à cause de l'effet d'une carte » |
| Machine à café : 1 généré, 1 attaché par tour | ✅ | code : `EnergyZone { current, next }`, « `current` (the energy attachable this turn, None… after the player has already attached this turn) » | Serebii, Game8, TheGamer |
| …**pas de nouveau café si le slot est occupé** | ✅ | idem (la rotation remplace `current` par `next`) | **Serebii** : « If an Energy is not used and is in the Energy Zone during Pokémon Checkup, a new Energy won't be generated » |
| Types de café : jusqu'à **3**, ordre aléatoire | ✅ | code : `roll_energy` tire uniformément parmi les types déclarés (1 à 3) | TVTropes : « a maximum of 3 » ; Game8 : « up to three different energy types » |
| …l'incolore accepte tout | ✅ | code : `EnergyType::is_selectable` — la zone ne génère **jamais** Incolore ni Dragon | cohérent (le type Incolore n'est pas un type de zone) |
| Premier joueur : **ne pioche pas** | ⚠️ **faux** | code : les deux joueurs piochent 5 à l'init ; **aucune** restriction de pioche au tour 1 | Bulbapedia et TVTropes ne listent qu'**une** exception : l'énergie |
| Premier joueur : ne peut pas attacher de café | ✅ | code : `current = None` au tour 1 du premier joueur | Bulbapedia : « cannot manually attach Energy » |
| Premier joueur : peut jouer un Collègue | ✅ | code : `has_played_support` part à `false` | Bulbapedia : « but can use Supporter cards » |
| Premier joueur : peut attaquer si l'attaque coûte 0 | ✅ | code : aucun garde-fou de tour dans `generate_attack_actions` | FAQ officielle : « the attack can be used on the first turn of the player that goes first » |
| Évolution impossible au premier tour de **chaque** joueur | ✅ | **« Neither player can evolve Pokémon on the first turn, whether they go first or second. »** | **capture** : « qu'on joue en premier ou en deuxième » |
| Pression 1 par tour ; le café n'est pas consommé | ✅ | code : l'énergie n'est jamais retirée par `apply_attack_action` | **capture** : « Le Pokémon garde les Énergies qui lui sont attachées après avoir utilisé l'attaque » |
| Vulnérabilité **+20** | ✅ | code : `WeaknessApplication::Flat(20)` | 6/7 simulateurs ; **capture** : « Faiblesse ⚡ +20 » |
| ➕ **Vulnérabilité non appliquée au Rack** | ➕ manque | **« Don't apply Weakness for Benched Pokémon. »** | **capture** : « N'appliquez pas la Faiblesse aux Pokémon de Banc » |
| Aucune Résistance | ✅ | aucun type `Resistance` dans le code | 6/7 simulateurs |
| Rotation : défausse autant de cafés que le coût | ✅ | code : `get_retreat_cost()`, une énergie par symbole Incolore, **n'importe quel type** | 6/7 simulateurs ; **capture** : « Les Énergies défaussées peuvent être de n'importe quel type » |
| Pioche vide : pas de défaite | ✅ | **« A player will not lose even if they run out of cards in their deck. »** | Bulbapedia, TVTropes |
| Défaite : 3 Interventions **ou** plus aucun Planqué en jeu | ✅ | **« If a player doesn't have any Pokémon remaining in play, that player loses the battle regardless of the number of points each player has. »** | Bulbapedia |
| …et le cas simultané | ➕ manque | test : atteindre 3 points sur l'action qui vide le plateau = **défaite**, pas égalité | — |
| **Statuts « cumulables »** | ⚠️ **faux** | **« Asleep, Paralyzed, and Confused cannot stack with each other. If one of these Special Conditions is applied, it replaces any of the others. »** — seuls Poisoned et Burned « can stack » | **capture** : la sous-entrée « Contrôle Pokémon et États Spéciaux » existe (contenu non capturé) |
| …Surcharge 10 de Stress/tour | ✅ | code : Poison = 10 par Checkup | — |
| …Épuisement | ✅ | code : Burn = 20 par Checkup, **puis** lancer (face = guérison) | — |
| …Sieste | ✅ | **« cannot attack or retreat… flips a coin during each Pokémon Checkup. If heads, the Pokémon recovers. »** | — |
| …Immobilisation | ✅ | **« After its owner's next turn, it recovers during Pokémon Checkup. »** | — |
| …Dérive | ✅ | **« If heads, the attack works normally, but if tails, the attack doesn't happen and the player's turn ends. »** — **pas d'auto-dégâts** | TVTropes : « Confused Pokémon do not take damage » |
| ➕ **Seul le Planqué au Poste porte un statut** | ➕ manque | **« Only Active Pokémon can have Special Conditions applied to them. If an Active Pokémon returns to the Bench… it recovers from all Special Conditions. »** (l'évolution purge aussi) | — |
| Ordre des statuts | ✅ | **« Order for one Pokémon with several: 1. Poisoned 2. Burned 3. Asleep 4. Paralyzed. »** | **capture** : l'ordre de §4 est le bon |
| …et l'ordre entre joueurs | ➕ manque | **« If both players' Pokémon are affected by Special Conditions, the player whose turn just ended checks their Special Conditions first. »** | — |
| Objet illimité / Collègue 1 par tour | ✅ | code : `can_play_item()` sans limite ; `can_play_support()` gardé par `has_played_support` | 7/7 simulateurs ; **capture** : « une seule carte Supporter par tour » |
| ➕ **Qui fournit la relève** | ➕ manque | code : `trigger_promotion_or_declare_winner` met en file l'`Activate` **du joueur dont le Poste est vide** | — |
| ➕ **Ordre après un double craquage** | ➕ manque | « when an attack leaves both Active Spots empty, the player whose turn it is (the attacker) chooses their new Active Pokémon first » | — |
| ➕ **Limite de tours** | ➕ manque | code : 30 tours puis égalité (`turn_count > 30 → Tie`) | TVTropes : « 30 turns (PvP) or 50 (AI) » ; Bulbapedia idem |
| ➕ **Ordre du calcul des dégâts** | ➕ manque | FAQ officielle : 1. dégâts de l'attaque · 2. effets sur l'attaquant · 3. **Faiblesse** · 4. effets sur le défenseur | article `57286049312665` |

## 3. Ce qui doit changer dans `§4`

Trois corrections et cinq ajouts. **Aucun n'est appliqué ici** : `AGENTS.md` §1.4 exige
une décision datée, et celle-ci se prend dans `docs/DECISIONS.md`, pas dans un dossier
de preuves.

| # | Nature | Ligne | Devient |
|---|---|---|---|
| 1 | ⚠️ correction | Premier joueur « **Ne pioche pas** » | Le premier joueur **pioche**. La seule exception est l'énergie. |
| 2 | ⚠️ correction | Statuts « **cumulables** » | Surcharge et Épuisement se cumulent **entre eux et avec tout** ; Sieste, Immobilisation et Dérive **s'excluent** mutuellement. |
| 3 | ⚠️ correction | « le **Rack** fournit la relève » | Le **joueur dont le Planqué a craqué choisit** sa relève ; après un double craquage, **l'attaquant choisit en premier**. |
| 4 | ➕ ajout | — | La Vulnérabilité **ne s'applique pas au Rack**. |
| 5 | ➕ ajout | — | **Seul le Planqué au Poste** peut porter un statut ; rotation et évolution les purgent. |
| 6 | ➕ ajout | — | **Ordre des dégâts** : attaque → effets sur l'attaquant → Vulnérabilité → effets sur le défenseur. |
| 7 | ➕ ajout | — | **Limite de 30 tours** en PvP (50 en solo) → égalité. |
| 8 | ➕ ajout | — | Cas simultané : atteindre 3 Interventions sur l'action qui vide le plateau **ne sauve pas** d'une défaite par plateau vide. |

## 4. Ce qui reste **non observé**

| Sujet | Pourquoi |
|---|---|
| Le **texte exact** des Astuces | Le masterdata du jeu (`gamedata_master_tips.aladin`) est **chiffré** ; les clés ne sont pas publiques. Voir `d-datamining`. |
| Le **plafond de 3 types de café** | Confirmé par TVTropes + Game8 + le code de deckgym, mais **aucune source primaire** — l'écran **d'édition du deck** de l'app (choix des **types d'Énergie**) reste à capturer. Débloque le ticket #30. |
| **Statuts : cumul ou non** | La transcription dit l'inverse de §4 ; la capture de « Contrôle Pokémon et États Spéciaux » trancherait. |
| **Pioche du premier joueur** | La transcription dit l'inverse de §4 ; la capture de « Déroulement d'un tour » trancherait. |

## 5. Sources

**Transcription du texte in-app (niveau 2)** — `bcollazo/deckgym-core`, `tests/rules/*`,
transcription datée **2026-09-08** :
<https://github.com/bcollazo/deckgym-core/tree/main/tests/rules>

**Code du même moteur (niveau 3, mais vérifiable)** — `src/state/mod.rs`, `src/deck.rs`,
`src/hooks/core.rs`, `src/hooks/retreat.rs`, `src/move_generation/` :
<https://github.com/bcollazo/deckgym-core/tree/main/src>

**Officiel (éditeur), consulté le 20/10/2026** :
- FAQ détaillée sur les combats — <https://app-ptcgpt.pokemon-support.com/hc/fr/sections/53604902813209>
- Comment calculer les dégâts (Faiblesse) — <https://app-ptcgpt.pokemon-support.com/hc/fr/articles/57286049312665>
- Points et défausse — <https://app-ptcgpt.pokemon-support.com/hc/fr/articles/57282177269273>
- Où trouver les règles — <https://app-ptcgp.pokemon-support.com/hc/en-us/articles/61745874022553>
  → **chemin in-app** : « Menu (bouton tout à droite en bas) > Astuces > À propos des règles de combat »

**Secondaires** (fiabilité décroissante, jamais seules) : Serebii, Bulbapedia, Game8,
TVTropes, TheGamer ; bases de cartes `tcgdex/cards-database` (textes **FR officiels**),
`PocketDecks/pokemon-tcg-pocket-cards`, `flibustier/pokemon-tcg-pocket-database`,
`hugoburguete/pokemon-tcg-pocket-card-database` ; simulateurs `AngelFireLA`,
`apmnt/poke-pocket-sim`, `bigmike0009/Pokemon-Pocket-TCG-Simulator`, `cklapperich/LobsterTCG`.

**Simulateurs écartés pour erreur manifeste** : `apmnt` (Vulnérabilité ×2),
`LobsterTCG` (« pas de Dérive dans Pocket »), `AngelFireLA` (reprise de poste),
`xfran1998/Pocketo` (limite de 30 tours présentée comme une règle du jeu),
`type-null` (vocabulaire « cartes Prise » du TCG physique).

**Rapports bruts** (bac à sable, hors dépôt) : `a-deckgym.md`, `b-donnees-fr.md`,
`c-divergences.md`, `d-datamining.md`.

## 6. Vocabulaire — ce que le jeu appelle vraiment les choses

Relevé dans `tcgdex/cards-database` et `hugoburguete` (textes **français officiels**) :

| Notre terme (`§3.1`) | Terme officiel du jeu |
|---|---|
| Machine à café | **zone Énergie** |
| Poste | **Poste Actif** / **Pokémon Actif** |
| Rack | **Banc** |
| Vulnérabilité | **Faiblesse** |
| Rotation | **Retraite** / **Coût de Retraite** |
| Surcharge | **Empoisonné** |
| Épuisement | **Brûlé** |
| Sieste | **Endormi** |
| Immobilisation | **Paralysé** |
| Dérive | **Confus** |
| Collègue | **Supporter** |
| Objet | **Objet** |
| Outil | **Outil** |
| Lancer de tampon | **Lancez une pièce** (face / pile) |

Ce ne sont **pas** des corrections : `§3.1` est un renommage assumé (D-024, D-026).
C'est la table de correspondance qui manquait, pour relire une source en français.
