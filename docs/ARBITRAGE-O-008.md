# O-008 — Intégrer ou exclure les écarts du miroir 2026

> **But** : trancher les 4 écarts entre `AGENTS.md` §4 et le jeu de référence 2026,
> avant l'écriture des 286 textes (voir `docs/MIROIR-2026-DELTAS.md` §3).
> **Rien ici n'est décidé.** Chaque ligne propose deux issues ; D-018 (miroir daté
> 2026) reste la référence tant qu'aucune décision n'est ajoutée à `DECISIONS.md`.
> Sources revérifiées le 19/10/2026.

## 1. Méga-Évolution ex = **3 Primes**

**Fait (source primaire, revérifiée par lecture directe)** : Pokémon.com, 26/11/2025 —
« Mega Evolution Pokémon ex are making their mark […] despite their hefty **three-point**
drawback » ; « Mega Absol ex **gives three points upon being Knocked Out—immediately losing
you the game** » ; la stratégie décrite est « a "five-point game"—one point each for Cleffa
and Hydreigon, and then a lofty **three points** for taking down Mega Absol ex ».

Conséquence arithmétique : avec 3 Primes pour gagner, un Méga-ex est une carte qui **perd la
partie d'un seul K.O.**. Ce n'est pas un palier cosmétique, c'est un pari de design.

| Si on intègre | Si on exclut |
|---|---|
| Nouveau stade (4ᵉ) → **un terme de vocabulaire à inventer** pour §3.1 (la hiérarchie s'arrête à COMEX) | Aucun code touché |
| `Stage` +1 membre (`types.ts`), `knockOut` passe d'un ternaire à un palier à 3 niveaux (`engine.ts`) | §4 doit écrire noir sur blanc : « le projet s'arrête aux Cadres à 2 Primes ; les Méga-Évolution (2025-2026) sont **hors périmètre** » |
| **Courbe de stats à inventer** : aucune source publique ne donne Moral/dégâts/Relève des Méga-ex de Pocket → contredit `CARD-SPEC.md` §2 comme source de vérité | La phrase « aucune valeur mathématique ne change » redevient vraie **pour le périmètre annoncé** |
| Reste à vérifier : depuis quel stade un Méga évolue dans Pocket | Réversible : peut devenir une **extension** post-lancement |
| Structure du set à refaire : 267 Planqués / 116 lignes sont bâtis sur 3 stades | |

**Recommandation** : exclure du lancement, garder comme extension. Le vrai coût n'est pas le
code (3 lignes) mais la courbe de stats, qui n'a pas de source — et inventer des stats est
exactement ce que `CARD-SPEC.md` §2 interdit sans validation.

## 2. Vulnérabilité **×2** via un Lieu

**Fait (source officielle)** : l'exemple de calcul des dégâts est `50 × 2 − 20 = 80`, le ×2
venant du Lieu **Bounded Field** (série B3). Le « +20 » de base n'est attesté que par des wikis.

| Si on intègre | Si on exclut |
|---|---|
| Exige que les **Lieux** existent — déjà reportés « extensions ultérieures » (§4), donc le ×2 serait un code mort | Aucun code touché : le ×2 **ne peut pas se produire** sans Lieu |
| `attackDamage` (`engine.ts`) doit lire un modificateur global de terrain | §4 précise : « +20 ; le ×2 n'existe que via un Lieu, hors périmètre » |
| Un concept « terrain » à modéliser (aucun aujourd'hui) | À réactiver avec les Lieux, pas avant |

**Recommandation** : exclure sans état d'âme — c'est une conséquence mécanique des Lieux, et
les Lieux sont hors périmètre. Coût d'intégration le plus défavorable des quatre.

## 3. Pokémon à **double type**

**Fait (source primaire)** : lettre aux producteurs du 15/10/2026 — « Dual-type Pokémon will
also be debuting in the new series ». Déploiement annoncé **fin octobre 2026**.

| Si on intègre | Si on exclut |
|---|---|
| `Card.faction: Faction` → `factions: Faction[]` : touche le type, `attackDamage`, l'UI (`FACTION_META`), l'héritage des variantes | Aucun code touché |
| **Casse le socle du set** : `AGENTS.md` §3.2 fait de « 1 faction = 1 type » la colonne vertébrale (10 factions, 10 types, table de Vulnérabilité) — et `FACTIONS.md` en dépend | Écrire la règle : « un Planqué = une faction », les doubles types sont hors périmètre |
| 226 cartes à re-vérifier : une carte à deux types déclenche la Faiblesse de deux façons | |

**Recommandation** : exclure explicitement. C'est la mécanique la plus invasive pour le
squelette du projet, et elle vient de sortir : ses règles précises ne sont pas encore
vérifiables (ni sourcées) le jour de l'arbitrage.

## 4. « Outils / Lieux : extensions ultérieures »

**Fait** : le jeu de référence possède déjà Outils (Rocky Helmet, Giant Cape) et Lieux.

Ce n'est **pas** un écart de règle mais de **formulation** : la ligne de §4 décrit un périmètre,
pas le miroir. `D-011` assume d'ailleurs « toutes les features de l'APK, livrées par phases ».

| Si on intègre | Si on exclut |
|---|---|
| Ajoute deux types de cartes au set (donc à `CARD-SPEC.md` §1 : 226 = 215 + 8 + 3) | Corriger la formulation seule : « choix de périmètre du lancement », pas une description du miroir |
| Outils/Lieux demandent des cibles et des états persistants (hors du moteur actuel) | Aucun code touché |

**Recommandation** : exclure du lancement + **reformuler** la ligne. C'est un correctif de doc,
pas un chantier.

## Synthèse

| Écart | Coût code | Vrai coût | Recommandation |
|---|---|---|---|
| 1. Méga-ex = 3 Primes | ~3 lignes | Terme de vocabulaire + courbe de stats **sans source** + structure du set | Exclure, réserver comme extension |
| 2. Faiblesse ×2 (Lieu) | Modéré (concept terrain) | Dépend d'une mécanique hors périmètre | Exclure |
| 3. Double type | Élevé (type + UI + cartes) | Casse « 1 faction = 1 type », socle de §3.2 | Exclure explicitement |
| 4. Outils / Lieux | Nul | Formulation de §4 seulement | Exclure + reformuler |

**Effet de bord à assumer** : exclure les 4 rend le set, en pratique, bâti sur les règles de
lancement. D-018 (miroir 2026) garde sa valeur pour les **règles de base** — celles-là ont bien
été vérifiées à jour — mais la doc doit dire clairement que les **ajouts** 2025-2026 sont hors
périmètre. C'est exactement ce qu'O-008 demande : « ou exclure **explicitement** ».

**Prochaine étape vérifiable** : une entrée datée dans `docs/DECISIONS.md` (intégrer tel écart,
ou exclure tel écart) + la mise à jour d'`AGENTS.md` §4 correspondante. Tant que rien n'est
écrit, la phrase « aucune valeur mathématique ne change » reste une cible non tenue.
