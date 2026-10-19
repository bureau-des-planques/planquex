# Correspondances — le jeu de base ↔ Bureau des Planqués

> **But** : un comparatif unique, à relire avant d'écrire les 286 cartes. Chaque ligne
> donne le terme du **jeu de base** (*Pokémon TCG Pocket*, cité comme référence externe
> conformément à `AGENTS.md` §3.1) et le terme **détourné**.
> Relevé le 19/10/2026. Sources : `AGENTS.md` §3-§4, `PROPOSITION.md` §3.2-3.3,
> `CARD-SPEC.md`, `FACTIONS.md`, et `docs/MIROIR-2026-DELTAS.md` pour les valeurs
> vérifiées du jeu de base.

**Statuts utilisés** :

- **miroir** — même valeur, seul le nom change (c'est le principe de D-003/D-018).
- **exclu** — le jeu de base le fait, nous non : hors périmètre de lancement (D-020).
- **maison** — n'existe pas dans le jeu de base (D-004 uniquement).
- ⚠️ **proposé** — un changement de nom est en attente de ta validation
  (`docs/NOMMAGE.md` §6). Le tableau montre le nom **actuel**.

**Une précision qui évite un contresens** : il n'y a **pas de correspondance carte à
carte**. Le jeu de base a des **créatures** ; nous avons des **postes de travail**.
La correspondance se fait au niveau des **concepts** (Pokémon → Planqué), des **types**
(Plante → SSE) et des **règles**, pas des individualités.

---

## 1. Le cadre

| Jeu de base | Bureau des Planqués | Statut |
|---|---|---|
| Pokémon TCG Pocket | **Bureau des Planqués** (D-015) | maison |
| The Pokémon Company | *pas d'équivalent : le jeu est un projet indépendant* | maison |
| Créatures : Pokémon | **Planqués** — des salariés | miroir |
| Séries / extensions (ex. *Genetic Apex*) | **Bacs** : Direction, Terrain, Bureau — trois viviers thématiques de factions | miroir |
| Pack / booster | **Bac à courrier** (5 cartes) | miroir |

## 2. Les règles, ligne à ligne

| Règle | Jeu de base | Chez nous | Statut |
|---|---|---|---|
| Deck | 20 cartes, 2 exemplaires max du même nom, ≥ 1 Basic | **Classeur** : 20 cartes, max 2 par **nom**, ≥ 1 N+1 | miroir |
| Main de départ | 5 cartes, toujours un Basic (pas de reprise) | **Courrier** : 5 cartes (D-022) | miroir |
| Main maximale | 10 | 10 | miroir |
| Banc | 3 places | **Open-space** : 3 places | miroir |
| Poste actif | 1 | **Poste** : 1 | miroir |
| Primes | 3 pour gagner, 1 par K.O., 2 pour un ex | **Primes** : 3, 1 par K.O., 2 pour un **Cadre** | miroir |
| Énergie | Zone d'énergie : 1 générée + 1 attachée par tour | **Machine à café** → **Café** | miroir |
| Types d'énergie | jusqu'à 3, aléatoires ; l'incolore accepte tout | idem — **hypothèse** (D-022, non sourcée) | miroir |
| Premier joueur | ne pioche pas, n'attache pas, peut jouer un Supporter, peut attaquer à 0 énergie | idem | miroir |
| Évolution | impossible au premier tour de chaque joueur | idem (D-022) | miroir |
| Attaque | 1 par tour, l'énergie n'est pas consommée | **Pression** | miroir |
| Faiblesse | +20 | **Vulnérabilité** : +20 | miroir |
| Résistance | aucune | **aucune** | miroir |
| Retraite | coût en énergies défaussées | **Relève** | miroir |
| Pioche vide | pas de défaite | idem | miroir |
| Défaite | 3 Primes, ou plus aucun Pokémon en jeu | idem (D-022) | miroir |
| K.O. | l'adversaire marque ; le joueur K.O. choisit sa relève | idem (D-022) | miroir |
| Objet (Item) | illimité par tour | **Objet** — **mécanisme non encore codé** | miroir |
| Collègue (Supporter) | 1 par tour | **Collègue** — **mécanisme non encore codé** | miroir |
| Lieu (Stadium) | +20 → ×2 possible (Bounded Field) | **Lieu** : hors périmètre (D-020) | **exclu** |
| Outil (Tool) | existe (Rocky Helmet, Giant Cape) | **Outil** : hors périmètre (D-020) | **exclu** |
| Méga-Évolution ex | **3 points**, perte immédiate si K.O. | pas de palier à 3 Primes (D-020) | **exclu** |
| Pokémon à double type | arrive fin octobre 2026 | une faction par Planqué (D-020) | **exclu** |
| « Changement de priorité » | *n'existe pas* | **une fois par tour, au Poste : archiver 1, piocher 1** (D-004) | **maison** |

## 3. Le plateau

| Jeu de base | Bureau des Planqués | Statut |
|---|---|---|
| Active Spot | **Poste** | miroir |
| Bench | **Open-space** ⚠️ *(aussi un nom de carte Lieu, hors périmètre)* | miroir |
| Energy Zone | **Machine à café** | miroir |
| Deck | **Classeur** | miroir |
| Hand | **Courrier** ⚠️ *proposé : **Bannette*** | miroir |
| Discard pile | **Archive** | miroir |
| Prize cards | **Primes** | miroir |
| Point de victoire | **Prime** | miroir |

## 4. Stades, Cadre, raretés

| Jeu de base | Bureau des Planqués | Statut |
|---|---|---|
| Basic / Stage 1 / Stage 2 | **N+1 / N+2 / COMEX** | miroir |
| ex (2 Primes) | **Cadre** (2 Primes) | miroir |
| ◇ ◇◇ ◇◇◇ ◇◇◇◇ | identiques, codés `1D` `2D` `3D` `4D` | miroir |
| ★ ★★ | identiques, codés `1S` `2S` | miroir |
| ★★★ et Couronne | prévus par `CARD-SPEC.md` §1, **pas encore dans les types** | miroir |

## 5. Les 10 types → les 10 factions

Nos **types** sont les mêmes que ceux du jeu de base (traduits) ; les **factions** sont
le détournement. Chaque faction a le rôle mécanique de son type.

| Type (base) | Type (nous) | Faction | Vulnérable à | Identité | ⚠️ proposé |
|---|---|---|---|---|---|
| Grass | Plante | **SSE** | Manager | prévention, soin, arrêts | — |
| Fire | Feu | **Manager** | Happiness Manager | pression, objectifs, deadlines | **Encadrement** |
| Water | Eau | **Happiness Manager** | Amélioration continue | QVT, perks, bien-être | **QVT** |
| Lightning | Électricité | **Amélioration continue** | Technicien | Lean, audits, KPI | — |
| Psychic | Psy | **RH** | Direction | recrutement, entretiens | — |
| Fighting | Combat | **Technicien** | RH | terrain, maintenance, outils | — |
| Darkness | Obscurité | **Direction** | Technicien | plans de départ, fusions, COMEX | — |
| Metal | Métal | **Syndicat** | Manager | CSE, tracts, procédures | — |
| Dragon | Dragon | **Intérimaire** | *aucune* | missions courtes, précarité | **Intérim** |
| Colorless | Incolore | **Service Support** | Technicien | helpdesk, tickets, FAQ | **Support** |

## 6. Les conditions spéciales

| Jeu de base | Bureau des Planqués | Effet | Statut |
|---|---|---|---|
| Poison | **Surcharge** | 10 dégâts/tour | miroir |
| Burn | **Burn-out** | 20 dégâts + lancer pour guérir | miroir |
| Sleep | **Bloqué** | lancer pour se réveiller | miroir |
| Paralysis | **Gelé** | saute un tour | miroir |
| Confusion | **Dérive** | lancer avant l'attaque | miroir |
| *ordre de résolution* | Surcharge → Burn-out → Bloqué → Gelé | **cumulables** (§4) | miroir |

## 7. Les cartes Action

| Jeu de base | Bureau des Planqués | Statut |
|---|---|---|
| Item | **Objet** — illimité par tour | miroir |
| Supporter | **Collègue** — 1 par tour | miroir |
| Tool | **Outil** | **exclu** (D-020) |
| Stadium | **Lieu** | **exclu** (D-020) |
| Ability | **Talent** | miroir |

## 8. Les mécaniques de tour

| Jeu de base | Bureau des Planqués | Statut |
|---|---|---|
| Attack | **Pression** (1/tour) | miroir |
| Retreat | **Relève** | miroir |
| Evolve | **évolution** (N+1 → N+2 → COMEX) | miroir |
| Knock Out | **K.O.** | miroir |
| Coin flip | **Lancer de tampon** (pile = tampon, face = agrafe) | miroir |
| Mulligan | ~~Reprise de poste~~ — **supprimé par D-022** (le jeu de base n'en a pas) | **retiré** |
| Répartition des dégâts | par coût en café (D-021) | miroir |

## 9. Les écrans et fonctionnalités de l'application

| Jeu de base | Bureau des Planqués | Statut |
|---|---|---|
| Home | **Accueil** | miroir |
| Collection | **Galérodex** | miroir |
| Deck builder | **Classeur** | miroir |
| Battle | **Combat** | miroir |
| Settings | **Réglages** | miroir |
| Pack opening | **Ouvrir un bac** (bac à courrier) | miroir |
| Wonder Pick | **Pause café** (5 cartes, 1 rare min.) | miroir |
| Mission | **Note de service** | miroir |
| Shop | **Économat / Boutique du CSE** | miroir |
| Premium Pass | **Cotisation** | miroir |
| Friend | **Camarade** | miroir |
| Trade | **Échange de postes** | miroir |
| Ranked | **Échelon** | miroir |
| Present Box | **Casier** | miroir |
| Card Skin | **Autocollant** | miroir |
| Tutorial | **Journée d'intégration** | miroir |

## 10. Ce qui n'est pas encore nommé

**L'économie.** Le jeu de base a une monnaie payante, des tickets de boutique, des
minuteurs qui accélèrent les bacs et la Pause café, et des tickets d'événement. Chez
nous, **rien de tout ça n'a de nom** : `PROPOSITION.md:19` dit seulement « aucun argent
réel en v1 ; la Cotisation payée en monnaie de jeu » (**O-005**). À nommer quand
l'économie sera spécifiée — ça ne bloque pas les cartes.

**Un mot sert à deux choses : « bac ».** `AGENTS.md` §4.2 appelle « bacs » les trois
viviers thématiques (**Direction**, **Terrain**, **Bureau**) *et* « bac à courrier » le
paquet de 5 cartes — alors que l'interface dit « Ouvrir un bac » pour ouvrir un paquet.
Même famille de problème que « Courrier » / « Bac à courrier » (§3) : à trancher avec
les 8 points de nommage, ou juste après.

## 11. Ce qui reste à trancher

Les 8 points de nommage en attente (factions « chefs », Happiness Manager, Service
Support, Intérimaire, abréviations, « Reprise de poste », Courrier/Bac à courrier,
attaques en double) sont chiffrés, avec propositions et coûts, dans
**`docs/NOMMAGE.md` §6**. Ce document-ci décrit l'état **actuel** ; il devra être mis à
jour d'un coup quand tu auras validé.
