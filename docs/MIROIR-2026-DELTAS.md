# Miroir de référence — cadre 2026 et écarts connus

> COMEX acté par **D-018** : le miroir de référence est *Pokémon TCG Pocket*
> **dans son état de 2026**, et non la version de lancement (A1, octobre 2024).
> Vérification documentaire du **19/10/2026**, par recherche sourcée. Les valeurs du
> standard restent `AGENTS.md` §4.

## 0. COMEX retenu, et ce qui en a été exclu

**Retenu (D-018)** : les **règles de base** sont celles du jeu **de 2026**, vérifiées à
jour. La phrase « aucune valeur mathématique ne change » de §4 vaut pour ces règles-là.

**Exclu du périmètre (D-020, 19/10/2026)** : les **ajouts 2025-2026** ne sont pas
implémentés au lancement — Méga-Évolution ex à 3 Interventions, Vulnérabilité ×2 par un Lieu,
Pokémon à double type, Outils et Lieux. §3 ci-dessous reste le **chiffrage** de ce qui a
été écarté, pour une réintroduction en extension (voir `docs/ARBITRAGE-O-008.md`).

Conséquence assumée : sur le contenu, le set de lancement ressemble à celui des règles de
lancement. C'est un **choix de périmètre daté**, pas un oubli — et c'est précisément ce
qu'O-008 demandait d'écrire.

## 1. Confirmé par une source primaire

| Règle | Vote | Source |
|---|---|---|
| Chariot 20 cartes, max 2 exemplaires, ≥ 1 Entrant | ✅ | Pokémon.com, guide de deck, 30/01/2025 |
| 3 Interventions pour gagner, 1 par K.O. | ✅ | Pokémon.com (même page) ; support officiel (FAQ combat) |
| Interventions accordées **uniquement** sur K.O. (pas sur une défausse par effet) | ✅ | FAQ combat officielle |
| Machine à café : 1 café généré par tour **et** 1 attachement par tour | ✅ | Pokémon.com, guide de deck |
| Le premier joueur **peut attaquer** si l'attaque coûte 0 | ✅ | FAQ combat officielle, « Battle Rules FAQ » |

## 2. Conforme, mais **insourçable en primaire** — distinguer les niveaux de preuve (~15 lignes sur 20)

Ces valeurs ne sont ni fausses ni confirmées par une **preuve primaire** : le jeu
**ne publie pas de livre de règles web**. Le support officiel renvoie aux **« Astuces » internes à l'app** :

> « Please find more information about Pokémon TCG Pocket's game rules in **Tips**
> or by tapping the question mark button […] » — support officiel

Concernées : main de départ 5, main maximale 10, Rack 3 places, « pas de
nouveau café si le slot du haut est occupé », « jusqu'à 3 types de café », premier
joueur qui pioche / n'attache pas / peut jouer un Collègue, évolution
impossible au premier tour de **chaque** joueur, 1 Pression par tour, café non
consommé, aucune Résistance, relève payée en cafés, pas de défaite par pioche vide,
les 5 statuts et leur **ordre** (Surcharge → Épuisement → Sieste → Immobilisation), Objet
illimité / Collègue 1 par tour.

⚠️ **Trois de ces lignes ont été corrigées** le 20/10/2026 par une décision datée, sans
preuve primaire pour autant : **D-030** (le premier joueur **pioche** — la ligne
« ne pioche pas » venait du TCG **physique**), **D-031** (les statuts ne sont pas tous
cumulables) et **D-032** (Vulnérabilité hors Rack, ordre du calcul des dégâts, fin de
partie, relève choisie). `AGENTS.md` §4 fait foi et porte ces corrections.

**Niveaux de preuve** (terminologie exacte de `docs/preuves/regles-2026-10-20/README.md` §0) :

| Niveau | Ce que c'est | Exemple pour ces lignes |
|---|---|---|
| **Primaire** | le texte du jeu lui-même | capture des Astuces in-app ; masterdata du jeu |
| **Transcription** | quelqu'un a recopié le texte du jeu et **le cite** | `deckgym-core` : « per the in-app Tips panel, transcribed 2026-09-08 » — chaque test cite la phrase qu'il applique |
| **Secondaire** | un tiers décrit le jeu | wikis (Game8, GameWith, Bulbapedia), simulateurs, articles de presse |

**Plusieurs de ces lignes ont maintenant des sources secondaires nommées** (voir §4 et le lot
`docs/preuves/regles-2026-10-20/`) : ne pas laisser croire qu'elles sont sans source. Elles
sont **insourçables en primaire** — pas « insourçables » tout court.

**Conséquence de méthode** : toute affirmation d'audit sur ces lignes doit porter le
niveau de preuve exact (**primaire** / **transcription** / **secondaire**), jamais
seulement « non vérifié ». Elles sont désormais **décidées** (D-022) — donc implémentées
avec une règle assumée — mais le seul moyen de les passer à « observé » (niveau **primaire**)
est une capture horodatée des Astuces de jeu : voir `docs/PROTOCOLE-ASTUCES.md`.

## 3. Écarts **exclus du périmètre** (D-020) — chiffrage conservé

| # | Écart | Détail | Source |
|---|---|---|---|
| 1 | **Méga-Évolution ex = 3 Interventions** | « Mega Absol ex gives **three points** upon being Knocked Out—immediately losing you the game » | Pokémon.com, 26/11/2025 |
| 2 | **Vulnérabilité ×2 possible** | Le Lieu **Bounded Field** (série B3) fait passer la Faiblesse de +20 à ×2. Exemple officiel : « 50 × 2 – 20 = 80 » | FAQ officielle (astuces) |
| 3 | **Pokémon à double type** | « Dual-type Pokémon will also be debuting in the new series » → casse l'hypothèse « une faction = un type » de `AGENTS.md` §3.2 | Lettre aux producteurs, 15/10/2026 |
| 4 | **Outils et Lieux existent dans le jeu de référence** | Le libellé « extensions ultérieures » est un **choix de périmètre**, pas une description du miroir | Pokémon.com (Rocky Helmet, Giant Cape) ; FAQ (Stade Bounded Field) |

⚠️ **Piège sur l'écart 2** : la seule mention *officielle* de la Faiblesse sur le web
passe par cet exemple **avec le Lieu en jeu**. Elle ne prouve **pas** que la règle de
base soit ×2. Le « +20 » de base n'est attesté que par des wikis de fans.

⚠️ **Écart 1** : un COMEX à 3 Interventions n'existe pas dans `src/data/types.ts`. La phrase
« aucune valeur mathématique ne change » (`AGENTS.md` §4) est donc **fausse en 2026**
tant que l'écart n'est pas traité.

## 4. À vérifier — aucun arbitrage possible aujourd'hui

| Sujet | État des sources |
|---|---|
| Mulligan : « l'adversaire pioche 1 » | **Démenti en secondaire** : deux sources JP récentes (Game8, MAJ 30/09/2026 ; GameWith, MAJ 19/10/2026) disent que Pocket **n'a pas de reprise de poste** du tout — « マリガン（引き直し）はありません » — la main de départ contenant toujours un Entrant. Le « l'adversaire pioche 1 » est la règle du TCG **physique**. Décidé (D-022) et implémenté (`ensureBasicInHand()`, plus de `mulligan`) |
| Fin de partie quand **plus aucun Planqué** n'est en jeu | **Confirmé en secondaire** : « 自分の場にポケモンがいなくなると、その時点で敗北 » (Game8) ; « ポイント数に関わらず敗北 » (GameWith). Décidé (D-022) et désormais **écrit dans §4**, qui ne listait aucune condition de défaite hors 3 Interventions |
| K.O. : **qui choisit la relève** | **Confirmé en secondaire** : GameWith décrit un écran de choix côté joueur K.O. (avec limite de temps, puis choix aléatoire à l'expiration). `§4` dit « l'Rack choisit », le moteur suit (`pendingPromotion` + `promoteActive()`). Décidé (D-022) |
| Plafond « 3 types de café » | Deux wikis de fans JP seulement. **Hypothèse assumée** (D-022) : le principe est officiel, le chiffre ne l'est pas |

Tant que les captures du protocole n'existent pas, ces quatre lignes restent à **confiance
secondaire** : une décision datée tranche ce qu'on implémente, elle ne prouve pas ce que fait le jeu.

Ces quatre points demandent soit une décision datée, soit la capture du §6.

## 5. Sources

**Lot de recherche complet** — `docs/preuves/regles-2026-10-20/` (ouvert le 20/10/2026 sur la branche `preuves/regles-2026-10-20`). Ce dossier contient le verdict ligne par ligne, la transcription `deckgym-core`, et toutes les URL citées ci-dessous.

Primaires (éditeur, consultées le 20/10/2026) :

- FAQ gameplay officielle — <https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ> (version FR : `…/hc/fr/articles/30330309361172-…`)
- FAQ combat officielle — <https://support.pokemon.com/hc/en-us/articles/38906248102292-Pok%C3%A9mon-TCG-Pocket-Battle-Rules-FAQ>
- Guide de deck officiel — <https://www.pokemon.com/us/features/learn-how-to-build-a-deck-in-pokemon-tcg-pocket>
- Méga Absol ex — <https://www.pokemon.com/us/features/pokemon-tcg-pocket-mega-absol-ex-deck-list-strategy>
- Calcul des dégâts (Faiblesse) — <https://app-ptcgpt.pokemon-support.com/hc/en-us/articles/57286049312665>
- Lettre aux producteurs, 15/10/2026 — <https://www.pokemon.com/us/news/read-the-pokemon-tcg-pocket-october-2026-producer-letter>
- Comment jouer (site officiel JP) — <https://www.pokemontcgpocket.com/ja/howtoplay/battle/>
- **Miroir web officiel de la FAQ détaillée** — <https://app-ptcgpt.pokemon-support.com/hc/fr/sections/53604902813209>
- **Où trouver les règles (chemin in-app)** — <https://app-ptcgp.pokemon-support.com/hc/en-us/articles/61745874022553> → « Menu (bouton tout à droite en bas) > Astuces > À propos des règles de combat » et « > FAQ détaillée sur les combats »

Secondaires (wikis de fans, fiabilité décroissante, dont une page datée du
26/09/2024 qui ignore les Méga ex) : Game8, GameWith, Pokémon-Zone, Bulbapedia.

Transcription (niveau 2, datée 2026-09-08) — `bcollazo/deckgym-core`, `tests/rules/*` :
<https://github.com/bcollazo/deckgym-core/tree/main/tests/rules>

Code du même moteur (niveau 3, mais vérifiable) — `src/state/mod.rs`, `src/deck.rs`,
`src/hooks/core.rs`, `src/hooks/retreat.rs`, `src/move_generation/` :
<https://github.com/bcollazo/deckgym-core/tree/main/src>

## 6. Prochaine action vérifiable

1. **Intégrer ou exclure** explicitement les écarts du §3 dans `AGENTS.md` §4 et
   `src/data/types.ts` (une décision datée par écart).
2. **Trancher** les quatre points du §4 — le plus urgent étant la relève après K.O.,
   où le moteur et la doc se contredisent déjà.
3. **Capturer les Astuces de jeu** de l'app (**Menu (bouton tout à droite en bas) >
   Astuces > À propos des règles de combat** — chemin sourcé et daté, `docs/PROTOCOLE-ASTUCES.md` §0),
   horodatée, et la ranger dans le dépôt : elle fait passer les ~15 lignes du §2 de
   « non confirmé » à « observé ».
