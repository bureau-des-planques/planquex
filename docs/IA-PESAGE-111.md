# IA de niveau 2 — le pesage mesuré (ticket #111)

> Mesure du **21/10/2026**, sur la branche `agent/111-pesage-ia`.
> Ce document ne décide **pas** entre re-peser, retirer ou assumer le niveau 2 : il
> consigne le fait mesuré qui permettra cette décision humaine.
> Il ne change **aucune règle** : `AGENTS.md` §4 et `docs/DECISIONS.md` restent seuls
> juges.

## 1. Les deux défauts de modèle corrigés avant de peser

Re-peser un modèle bancal ne produit que du bruit bien optimisé. Deux défauts ont donc
été corrigés **avant** toute recherche de poids (`src/game/ia.ts`) :

1. **Le bonus de fin de tour réutilisait `weights.hand`** et il était versé même quand la
   main comptait 10 cartes. Régler la valeur d'une carte en main déplaçait donc
   silencieusement l'arbitrage « jouer un coup de plus ou finir son tour », et le bonus
   était faux au moment où le camp ne pioche pas. Désormais : un poids **propre**
   (`endTurn`), et un bonus **nul à main pleine** (`endTurnBonus`).
2. **`safety` et `threat` soustrayaient tous deux la menace adverse** (`hp − menace` avec
   le poids 4, puis `menace × 3`) : l'asymétrie « l'adversaire pèse −4 −3, moi +3 »
   n'était pas un choix, c'était la somme de deux réglages. Désormais : `safety` ne
   mesure que le **Seuil restant au Poste**, et `threat` est la **différence
   symétrique** des menaces. Chaque menace est comptée **une fois**.

Tests : `src/game/ia-evaluation.test.ts` (bonus indépendant de `hand`, nul à main
pleine, menace comptée une fois) ; `src/game/ia-menace-typee.test.ts` mis à jour pour
le poids `endTurn = 0` de son aide `only()`.

## 2. Le protocole

Harnais du ticket, **60 parties par siège et par graine**, deux séries miroir :

```bash
node scripts/simulate.mjs --games 60 --seed <S> --json --player-level 1 --ai-level 2
node scripts/simulate.mjs --games 60 --seed <S> --json --player-level 2 --ai-level 1
```

Le camp de niveau 2 est `ai` dans la première série, `player` dans la seconde ; on
agrège `results[].winner`. Une partie nulle est une partie arrêtée sans vainqueur
(limite de tours ou garde-fou), elle ne compte ni pour ni contre.

- **Entraînement** (recherche des poids) : graines **1, 7, 42, 11, 23**.
- **Contrôle** (hors échantillon, disjoint) : graines **99, 1234, 2024, 777, 31337**.
- **Seuil d'adoption, fixé avant de voir le contrôle** : ≥ **55 %** des parties
  **décidées** *et* ≥ **1,15 ×** les victoires du niveau 1.
- Un gain d'entraînement qui s'évapore au contrôle est du **bruit** : rien n'est adopté.

Le budget de recherche a été de **435 jeux de poids** (169 balayages/tirages, puis 166
voisins locaux, puis 100 voisins fins), tous évalués sur les graines d'entraînement.
Les six meilleurs de l'entraînement ont ensuite été mesurés sur le contrôle.

## 3. La barre actuelle (modèle corrigé, poids par défaut)

Poids : `points 300, board 3, rival -0.8, safety 4, hand 4, threat 3, endTurn 4`.

### Entraînement

| Graine | Niveau 2 | Niveau 1 | Nulles | Ratio |
|---:|---:|---:|---:|---:|
| 1 | 42 | 53 | 25 | 0,792 |
| 7 | 42 | 51 | 27 | 0,824 |
| 42 | 42 | 52 | 26 | 0,808 |
| 11 | 40 | 54 | 26 | 0,741 |
| 23 | 40 | 51 | 29 | 0,784 |
| **Total** | **206** | **261** | **133** | **0,789** |

Taux des décidées : **44,11 %** — verdict : **pas tenu**.

### Contrôle

| Graine | Niveau 2 | Niveau 1 | Nulles | Ratio |
|---:|---:|---:|---:|---:|
| 99 | 42 | 48 | 30 | 0,875 |
| 1234 | 41 | 50 | 29 | 0,820 |
| 2024 | 43 | 50 | 27 | 0,860 |
| 777 | 37 | 50 | 33 | 0,740 |
| 31337 | 37 | 59 | 24 | 0,627 |
| **Total** | **200** | **257** | **143** | **0,778** |

Taux des décidées : **43,76 %** — verdict : **pas tenu**.

À la graine 42 et sur 100 parties par série, ce modèle donne **70 / 87 / 43** (le test
`ia-niveau-2.test.ts` fige ce chiffre ; l'ancien modèle donnait 67 / 89 / 44).

## 4. Le meilleur candidat du re-pesage

Poids : `points 300, board 1, rival -0.3, safety 4, hand 0, threat 1, endTurn 0`.
C'est le meilleur **au contrôle** ; il est deuxième à l'entraînement.

### Entraînement

| Graine | Niveau 2 | Niveau 1 | Nulles | Ratio |
|---:|---:|---:|---:|---:|
| 1 | 54 | 45 | 21 | 1,200 |
| 7 | 53 | 45 | 22 | 1,178 |
| 42 | 53 | 47 | 20 | 1,128 |
| 11 | 55 | 43 | 22 | 1,279 |
| 23 | 52 | 48 | 20 | 1,083 |
| **Total** | **267** | **228** | **105** | **1,171** |

Taux des décidées : **53,94 %** — verdict : **pas tenu** (il manque 1,06 point).

### Contrôle

| Graine | Niveau 2 | Niveau 1 | Nulles | Ratio |
|---:|---:|---:|---:|---:|
| 99 | 47 | 44 | 29 | 1,068 |
| 1234 | 48 | 47 | 25 | 1,021 |
| 2024 | 50 | 37 | 33 | 1,351 |
| 777 | 53 | 41 | 26 | 1,293 |
| 31337 | 54 | 45 | 21 | 1,200 |
| **Total** | **252** | **214** | **134** | **1,178** |

Taux des décidées : **54,08 %** — le **ratio passe** (1,178 ≥ 1,15), le **taux ne passe
pas** (54,08 % < 55 %) — verdict : **pas tenu**.

Les chiffres du contrôle ont été reproduits avec les commandes du §2 et les poids
ci-dessus placés temporairement dans `DEFAULT_EVALUATION_WEIGHTS` (252 / 214 / 134,
identiques au harnais). L'intervalle de confiance à 95 % du taux (n = 466 décidées)
va d'environ **49,6 % à 58,6 %** : la supériorité sur le niveau 1 n'est pas démontrée.

## 5. Les autres finalistes (six meilleurs de l'entraînement)

| Poids | Entraînement | Contrôle | Verdict |
|---|---|---|---|
| `rival -0.8` (threat 1) | 54,31 % · 1,189 | 53,81 % · 1,165 | ratio tenu, taux non |
| `safety 4` (threat 1) | 53,94 % · 1,171 | **54,08 % · 1,178** | ratio tenu, taux non |
| `points 400` (threat 2) | 53,86 % · 1,167 | 52,90 % · 1,123 | non |
| `board 1.5` (threat 1.5) | 53,85 % · 1,167 | 52,79 % · 1,118 | non |
| `rival -0.4` (threat 1) | 53,82 % · 1,165 | 53,21 % · 1,137 | non |
| `safety 5.5` (threat 1) | 53,72 % · 1,161 | 52,98 % · 1,127 | non |

## 6. Conclusion mesurée

**Aucun jeu de poids n'est adopté.** Aucun candidat n'atteint **55 % des parties
décidées**, ni à l'entraînement (meilleur : 54,31 %) ni au contrôle (meilleur : 54,08 %).
Les poids par défaut restent donc ceux du **modèle corrigé**, et le niveau 1 reste le
défaut de l'écran comme du simulateur.

Ce que la mesure dit, et ne dit pas :

- la correction de modèle **améliore** le niveau 2 : de 43,76 % à 54,08 % au contrôle
  (+10,3 points) — le re-pesage n'est donc pas sans effet ;
- elle ne suffit **pas** à le mettre devant le niveau 1 avec la marge exigée : le
  meilleur candidat perd encore 214 à 252 au contrôle ;
- un taux de 54 % sur 466 décidées n'est pas distinguable de 50 % à 95 % près : on ne
  peut pas affirmer « le niveau 2 est meilleur ».

La décision (a) re-peser davantage, (b) retirer le niveau 2, (c) l'assumer en le
documentant reste **humaine**. Ce document ne fournit que le fait.
