# Miroir de référence — cadre 2026 et écarts connus

> Cadre acté par **D-018** : le miroir de référence est *Pokémon TCG Pocket*
> **dans son état de 2026**, et non la version de lancement (A1, octobre 2024).
> Vérification documentaire du **19/10/2026**, par recherche sourcée (aucun fichier
> du dépôt modifié). Les valeurs du standard restent `AGENTS.md` §4.

## 1. Confirmé par une source primaire

| Règle | Vote | Source |
|---|---|---|
| Classeur 20 cartes, max 2 exemplaires, ≥ 1 N+1 | ✅ | Pokémon.com, guide de deck, 30/01/2025 |
| 3 Primes pour gagner, 1 par K.O. | ✅ | Pokémon.com (même page) ; support officiel (FAQ combat) |
| Primes accordées **uniquement** sur K.O. (pas sur une défausse par effet) | ✅ | FAQ combat officielle |
| Machine à café : 1 café généré par tour **et** 1 attachement par tour | ✅ | Pokémon.com, guide de deck |
| Le premier joueur **peut attaquer** si l'attaque coûte 0 | ✅ | FAQ combat officielle, « Battle Rules FAQ » |

## 2. Conforme, mais **insourçable par URL** (~15 lignes sur 20)

Ces valeurs ne sont ni fausses ni confirmées : le jeu **ne publie pas de livre de
règles web**. Le support officiel renvoie aux **« Astuces » internes à l'app** :

> « Please find more information about Pokémon TCG Pocket's game rules in **Tips**
> or by tapping the question mark button […] » — support officiel

Concernées : main de départ 5, main maximale 10, Open-space 3 places, « pas de
nouveau café si le slot du haut est occupé », « jusqu'à 3 types de café », premier
joueur qui ne pioche pas / n'attache pas / peut jouer un Collègue, évolution
impossible au premier tour de **chaque** joueur, 1 Pression par tour, café non
consommé, aucune Résistance, relève payée en cafés, pas de défaite par pioche vide,
les 5 statuts et leur **ordre** (Surcharge → Burn-out → Bloqué → Gelé), Objet
illimité / Collègue 1 par tour.

**Conséquence de méthode** : toute affirmation d'audit sur ces lignes doit rester
marquée « non vérifié ». Le seul moyen de les passer à « observé » est une
**capture horodatée des Astuces de jeu** (§6).

## 3. Écarts à intégrer au standard (conséquence de D-018)

| # | Écart | Détail | Source |
|---|---|---|---|
| 1 | **Méga-Évolution ex = 3 Primes** | « Mega Absol ex gives **three points** upon being Knocked Out—immediately losing you the game » | Pokémon.com, 26/11/2025 |
| 2 | **Vulnérabilité ×2 possible** | Le Lieu **Bounded Field** (série B3) fait passer la Faiblesse de +20 à ×2. Exemple officiel : « 50 × 2 – 20 = 80 » | FAQ officielle (astuces) |
| 3 | **Pokémon à double type** | « Dual-type Pokémon will also be debuting in the new series » → casse l'hypothèse « une faction = un type » de `AGENTS.md` §3.2 | Lettre aux producteurs, 15/10/2026 |
| 4 | **Outils et Lieux existent dans le jeu de référence** | Le libellé « extensions ultérieures » est un **choix de périmètre**, pas une description du miroir | Pokémon.com (Rocky Helmet, Giant Cape) ; FAQ (Stade Bounded Field) |

⚠️ **Piège sur l'écart 2** : la seule mention *officielle* de la Faiblesse sur le web
passe par cet exemple **avec le Lieu en jeu**. Elle ne prouve **pas** que la règle de
base soit ×2. Le « +20 » de base n'est attesté que par des wikis de fans.

⚠️ **Écart 1** : un Cadre à 3 Primes n'existe pas dans `src/data/types.ts`. La phrase
« aucune valeur mathématique ne change » (`AGENTS.md` §4) est donc **fausse en 2026**
tant que l'écart n'est pas traité.

## 4. À vérifier — aucun arbitrage possible aujourd'hui

| Sujet | État des sources |
|---|---|
| Mulligan : « l'adversaire pioche 1 » | **Non documenté pour Pocket.** C'est la règle du TCG physique. Implémenté dans `engine.ts` (`mulligan`) |
| Fin de partie quand **plus aucun Planqué** n'est en jeu | **Aucune source trouvée, même secondaire.** Le moteur l'implémente (`engine.ts`, `knockOut`) alors qu'`AGENTS.md` §4 ne liste **aucune** condition de défaite en dehors des 3 Primes |
| K.O. : **qui choisit la relève** | **Aucune source trouvée.** `AGENTS.md` §4 dit « l'Open-space choisit » ; le moteur **promeut automatiquement** (`engine.ts`, `knockOut`) |
| Plafond « 3 types de café » | Deux wikis de fans JP seulement |

Ces quatre points demandent soit une décision datée, soit la capture du §6.

## 5. Sources

Primaires (éditeur, consultées le 19/10/2026) :

- FAQ gameplay officielle — <https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ> (version FR : `…/hc/fr/articles/30330309361172-…`)
- FAQ combat officielle — <https://support.pokemon.com/hc/en-us/articles/38906248102292-Pok%C3%A9mon-TCG-Pocket-Battle-Rules-FAQ>
- Guide de deck officiel — <https://www.pokemon.com/us/features/learn-how-to-build-a-deck-in-pokemon-tcg-pocket>
- Méga Absol ex — <https://www.pokemon.com/us/features/pokemon-tcg-pocket-mega-absol-ex-deck-list-strategy>
- Calcul des dégâts (Faiblesse) — <https://app-ptcgpt.pokemon-support.com/hc/en-us/articles/57286049312665>
- Lettre aux producteurs, 15/10/2026 — <https://www.pokemon.com/us/news/read-the-pokemon-tcg-pocket-october-2026-producer-letter>
- Comment jouer (site officiel JP) — <https://www.pokemontcgpocket.com/ja/howtoplay/battle/>

Secondaires (wikis de fans, fiabilité décroissante, dont une page datée du
26/09/2024 qui ignore les Méga ex) : Game8, GameWith, Pokémon-Zone, Bulbapedia.
Le rapport complet, avec les verdicts ligne à ligne et les URL de ces sources,
n'est pas dans le dépôt.

## 6. Prochaine action vérifiable

1. **Intégrer ou exclure** explicitement les écarts du §3 dans `AGENTS.md` §4 et
   `src/data/types.ts` (une décision datée par écart).
2. **Trancher** les quatre points du §4 — le plus urgent étant la relève après K.O.,
   où le moteur et la doc se contredisent déjà.
3. **Capturer les Astuces de jeu** de l'app (menu → Game Tips → Battle Rules),
   horodatée, et la ranger dans le dépôt : elle fait passer les ~15 lignes du §2 de
   « non confirmé » à « observé ».
