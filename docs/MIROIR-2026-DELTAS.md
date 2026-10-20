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

## 2. Observé par capture — 20/10/2026

> **Mise à jour du 20/10/2026.** Les « Astuces de jeu » ont été capturées : 9 écrans,
> rangés dans `docs/preuves/astuces-2026-10-20/` (README transcrit **mot pour mot**).
> Une grande partie de ce §2 passe donc de « non confirmé » à **observé**. Ce qui suit
> est le relevé ; la transcription fait foi, pas ce résumé.

**Passent à « observé »** (capture entre parenthèses) : main maximale **10** (`03`) ·
Rack **3 places** (`05`) · évolution impossible au **premier tour de chaque joueur** (`05`) ·
1 Pression par tour et café **non consommé** (`05`) · Vulnérabilité **+20**, **jamais au
Banc** (`05`) · Rotation payée en cafés, **n'importe quel type** (`05`) · Objet illimité /
Collègue **1 par tour** (`05`) · **ordre des statuts** Empoisonné → Brûlé → Endormi →
Paralysé (`07`) · effets des 5 statuts (`07`) · défaite par **plateau vide** (`06`) · **qui
choisit la relève** : le joueur K.O. (`06`) · **pas de défaite par pioche vide** (`06`) ·
COMEX = 2 points, dits « **Pokémon avec un encadré Règle** » (`06`).

**Non capturés, mais établis par la recherche** (qui fait foi, D-034) : le **plafond de 3 types
de café** et son ordre aléatoire ; la **main de départ à 5** ; la règle « pas de nouveau café si le
slot du haut est occupé » ; la **reprise de poste** (absente). Citations :
`docs/preuves/regles-2026-10-20/README.md` §2.

### ⚠️ Trois écarts entre `AGENTS.md` §4 et les captures

Une capture qui **contredit** `§4` vaut plus qu'une qui la confirme : elle évite
d'implémenter une règle inventée. Trois points appellent une **décision datée**.

| Ligne de `§4` | Ce que dit le jeu | Capture |
|---|---|---|
| Premier joueur : « **Ne pioche pas** » | Seule l'**Énergie** est exceptée au premier tour du premier joueur ; la pioche est la règle générale du début de tour | `05` |
| Statuts : « **cumulables** » | Empoisonné et Brûlé se cumulent ; **Endormi, Paralysé et Confus s'excluent** et se remplacent | `07` |
| Machine à café : « **1 attachement par tour** » | « Tant que vous disposez d'Énergie dans votre zone Énergie, vous pouvez en **attacher autant que vous le souhaitez** » | `05` |

Le troisième est le plus délicat : il **oppose une capture** à une source déjà citée en
§1 (« Pokémon.com, guide de deck : 1 attachement par tour »). À trancher avant de toucher
au moteur.

**État** : les deux premiers sont **tranchés par D-030** et le moteur les applique depuis la
fusion du 20/10/2026 ; le troisième est **tranché par D-034** sans changer le moteur : la capture
dit « tant que vous disposez d'Énergie dans votre zone », et la recherche établit que la zone n'en
contient jamais plus d'une — donc 1 attachement par tour. La revue de sources du même jour
a ajouté les règles de **D-031** (Vulnérabilité hors Rack, ordre du calcul des dégâts, double
craquage, nombre de tours).

### Niveaux de preuve

Toute affirmation d'audit sur ces lignes porte son **niveau de preuve** exact, jamais
seulement « non vérifié » (terminologie de `docs/preuves/regles-2026-10-20/README.md` §0) :

| Niveau | Ce que c'est | Exemple |
|---|---|---|
| **Primaire** | le texte du jeu lui-même | les captures des Astuces (`docs/preuves/astuces-2026-10-20/`) ; le masterdata du jeu |
| **Transcription** | quelqu'un a recopié le texte du jeu et **le cite** | `deckgym-core` : « per the in-app Tips panel, transcribed 2026-09-08 » — chaque test cite la phrase qu'il applique |
| **Secondaire** | un tiers décrit le jeu | wikis (Game8, GameWith, Bulbapedia), simulateurs, articles de presse |

Depuis **D-034**, une règle établie par la recherche **fait foi** au même titre qu'une capture ;
le niveau de preuve reste à citer, et **la capture l'emporte** si les deux se contredisent.

### Pourquoi ces lignes n'étaient pas sourçables par URL

Le jeu **ne publie pas de livre de règles web**. Le support officiel renvoie aux
**« Astuces » internes à l'app** :

> « Please find more information about Pokémon TCG Pocket's game rules in **Tips**
> or by tapping the question mark button […] » — support officiel

Vérifié le 20/10/2026 : la « FAQ détaillée sur les combats » du support ne traite que des
**cas particuliers** (calcul des dégâts, points sur défausse par effet…), et la page
« Articles et stratégies » de Pokémon.com n'est qu'un **index de 40 articles de deck** —
aucune règle de base. C'est bien la capture qui fait la preuve : `docs/PROTOCOLE-ASTUCES.md`.

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
| Mulligan : « l'adversaire pioche 1 » | **Démenti** : deux sources JP récentes (Game8, MAJ 30/09/2026 ; GameWith, MAJ 19/10/2026) disent que Pocket **n'a pas de reprise de poste** — « マリガン（引き直し）はありません ». Décidé (D-022) et implémenté (`ensureBasicInHand()`, plus de `mulligan`). **Non observé** : la capture de la préparation (`04`) décrit « des cartes sont piochées » sans nombre et sans remélange — argument **par absence** |
| Fin de partie quand **plus aucun Planqué** n'est en jeu | ✅ **Observé le 20/10/2026** (`docs/preuves/astuces-2026-10-20/06`) : « Si un joueur n'a plus de Pokémon en jeu, il perd le combat **indépendamment du nombre de points** que chaque joueur possède. » Décidé (D-022), écrit dans §4 |
| K.O. : **qui choisit la relève** | ✅ **Observé le 20/10/2026** (même capture) : « Si le Pokémon sur le Poste Actif est mis K.O., **le joueur le remplace** avec un de ses Pokémon de Banc. » Décidé (D-022) ; le moteur suit (`pendingPromotion` + `promoteActive()`) |
| Plafond « 3 types de café » | Deux wikis de fans JP seulement. **Hypothèse assumée** (D-022) : le principe est officiel, le chiffre ne l'est pas. **Établi par la recherche (D-034)** : `deckgym-core` (`roll_energy`, 1 à 3 types), TVTropes, Game8 — la capture de l'éditeur de deck n'est plus nécessaire |

Les quatre points sont réglés : **deux par capture** (fin de partie, relève), **deux par la
recherche** (pas de reprise de poste, plafond des types de café), qui fait foi (D-034).

## 5. Sources

**Primaire, capturée le 20/10/2026** — les « Astuces de jeu » de l'app, 9 écrans :
`docs/preuves/astuces-2026-10-20/` (transcription mot pour mot dans son `README.md`).

**Lot de recherche complet** — `docs/preuves/regles-2026-10-20/` (ouvert le 20/10/2026 sur la branche `preuves/regles-2026-10-20`) : le verdict ligne par ligne, la transcription `deckgym-core`, et toutes les URL citées ci-dessous.

Primaires (éditeur, consultées les 19 et 20/10/2026) :

- FAQ gameplay officielle — <https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ> (version FR : `…/hc/fr/articles/30330309361172-…`)
- FAQ combat officielle — <https://support.pokemon.com/hc/en-us/articles/38906248102292-Pok%C3%A9mon-TCG-Pocket-Battle-Rules-FAQ>
- Guide de deck officiel — <https://www.pokemon.com/us/features/learn-how-to-build-a-deck-in-pokemon-tcg-pocket>
- Méga Absol ex — <https://www.pokemon.com/us/features/pokemon-tcg-pocket-mega-absol-ex-deck-list-strategy>
- Calcul des dégâts (Faiblesse) — <https://app-ptcgpt.pokemon-support.com/hc/en-us/articles/57286049312665>
- Lettre aux producteurs, 15/10/2026 — <https://www.pokemon.com/us/news/read-the-pokemon-tcg-pocket-october-2026-producer-letter>
- Comment jouer (site officiel JP) — <https://www.pokemontcgpocket.com/ja/howtoplay/battle/>
- **Miroir web officiel de la FAQ détaillée** — <https://app-ptcgpt.pokemon-support.com/hc/fr/sections/53604902813209>
- **Où trouver les règles (chemin in-app)** — <https://app-ptcgp.pokemon-support.com/hc/en-us/articles/61745874022553> → « Menu (bouton tout à droite en bas) > Astuces > À propos des règles de combat » et « > FAQ détaillée sur les combats »

Fournies le 20/10/2026, **sans règle de base** (vérifié) :

- FAQ détaillée sur les combats — <https://app-ptcgpt.pokemon-support.com/hc/fr/sections/53604902813209>
  → miroir web de l'entrée « FAQ détaillée sur les combats » de l'app ; **cas particuliers
  seulement** (7 articles).
- Articles et stratégies Pokémon.com — <https://www.pokemon.com/fr/articles/tous/content-products_vg-and-apps-product-names.pokemon-tcg-pocket>
  → index de 40 articles de **stratégie de deck** ; aucune règle.

Secondaires (wikis de fans, fiabilité décroissante, dont une page datée du
26/09/2024 qui ignore les Méga ex) : Game8, GameWith, Pokémon-Zone, Bulbapedia.

Transcription (niveau 2, datée 2026-09-08) — `bcollazo/deckgym-core`, `tests/rules/*` :
<https://github.com/bcollazo/deckgym-core/tree/main/tests/rules>

Code du même moteur (niveau 3, mais vérifiable) — `src/state/mod.rs`, `src/deck.rs`,
`src/hooks/core.rs`, `src/hooks/retreat.rs`, `src/move_generation/` :
<https://github.com/bcollazo/deckgym-core/tree/main/src>

## 6. Prochaine action vérifiable

1. ~~Trancher O-014~~ : **fait** (D-034) — 1 attachement par tour, le moteur était déjà juste.
2. **Intégrer ou exclure** explicitement les écarts du §3 dans `AGENTS.md` §4 et
   `src/data/types.ts` (une décision datée par écart).
3. **Coder le plafond des 3 types de café** (établi par la recherche, D-034) : chaîne du café typé
   #61 → #33 → #35. Plus aucune capture n'est requise pour §4.
