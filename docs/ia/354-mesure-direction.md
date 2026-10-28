# La Direction contre un joueur de référence (#354, D-134)

**Date de la mesure : 28/10/2026.** Document de **mesure**, pas une décision : D-134 fixe le
protocole et la bande, les actes sont dans `docs/DECISIONS.md`, les chiffres vivent ici. Aucun
changement de comportement n'accompagne cette mesure — « on mesure, puis on décide ».

## La question

La Direction n'a **jamais** été mesurée contre autre chose que la politique de niveau 1 : D-084
donne **60,4 % contre le glouton**, et D-109 précise que l'écran joue `nextAiAction`, c'est-à-dire
la **recherche à deux coups**. Contre un **joueur**, on ne savait rien. Or la question de l'alpha
est « est-ce que ça donne envie de refaire une partie » (D-048) : si la Direction écrase, le testeur
arrête ; si elle s'effondre, la partie n'a pas d'enjeu.

## Le protocole, écrit avant la mesure

| Point | Valeur |
|---|---|
| Commande | `npm run mesure:direction` · `-- --json` pour le rapport complet · `--bande 0.50:0.51` pour le contrôle mord |
| Code | `src/game/mesure-direction.ts`, gardé par `src/game/mesure-direction.test.ts` |
| **La Direction mesurée** | la **recherche à deux coups** de l'écran (`politique('recherche')`, D-084/D-109), `candidates 6 / worlds 3 / replies 4 / maxNodes 800` |
| **Le joueur de référence** | **scripté**, déterministe et public : `politique('scripte')`, la politique historique de niveau 1 (`nextAction(state, 1)`). Ce n'est **pas** une IA de production, c'est un **plancher stable** |
| Parties | **1 000**, en **miroir apparié** : 500 paires, chaque paire jouant la **même graine** et les mêmes Decks deux fois, la Direction changeant de camp. L'avantage du premier joueur s'annule |
| Graine maîtresse | **20261028**. Les graines de partie en dérivent (`drawRandom`) |
| Graines **disjointes** | aucune des graines qui ont choisi la politique (#111 : `1, 7, 42, 11, 23` et `99, 1234, 2024, 777, 31337`). `grainesDisjointes()` le vérifie dans les deux sens, et c'est un test |
| Bande de décision | **40 – 60 %** des parties **décidées**, IC 95 % **avant** la mesure (D-134) |
| Intervalle | **Wilson** à 95 %, borné à `[0, 1]` — Wald déborde et sous-estime sur les petits échantillons |

**Une réserve, écrite** : la recherche de l'écran porte une **échéance murale** de 60 ms
(`DEFAULT_SEARCH_OPTIONS.maxMs`, #172), seul terme **non déterministe** de la décision. La mesure
la **neutralise** (`maxMs: Infinity`) pour que deux lancements rendent le **même chiffre** ; le
plafond de **nœuds** (800) reste, et `replis` dit combien de décisions sont retombées sur le
glouton. Ce que la mesure ajoute donc par rapport à l'écran : du travail de recherche que
l'échéance aurait coupé — donc une Direction **au plus aussi forte** que celle de l'écran, jamais
plus faible.

## Les chiffres

| Chiffre | Valeur |
|---|---|
| Parties jouées | **1 000** (500 paires en miroir) |
| Parties **décidées** | 732 — gagnées 458, perdues 274 |
| **Taux de victoire de la Direction** | **62,57 %** des décidées |
| **Intervalle de confiance à 95 %** (Wilson) | **59,01 % – 66,00 %** |
| Bande de D-134 | 40,00 % – 60,00 % |
| **Verdict** | **HORS de la bande** |
| Parties nulles | 268 (dont 268 arrêtées à la limite de 200 tours) |
| **Tours médians** | **21** sur toutes les parties · 18 sur les décidées |
| Décisions de la Direction | 29 965 coups · moyenne **29,01 ms** · p50 17,55 ms · p95 77,43 ms · max 471,61 ms |
| Replis de budget (plafond de nœuds) | 2 |

**Recommandation** (elle découle du chiffre, elle ne le remplace pas) : La Direction gagne
trop — 62,6 % des décidées, au-dessus de 60,0 %. **Baisser son niveau** (le glouton, ou la
recherche sans sa profondeur) est la piste que le chiffre désigne ; le changement lui-même est
un acte daté à part (D-134 : « on mesure, puis on décide »), et il touche D-084.

### Comment lire ce 62,6 %

Le verdict est **hors bande** au sens du protocole (le taux ponctuel dépasse 60 %), mais
l'intervalle descend à **59,01 %** : la borne basse **mord sur la bande**, donc les données ne
permettent pas d'affirmer à 95 % que la vraie valeur dépasse 60 %. Deux lectures se tiennent, et
il faut les écrire toutes les deux :

- **le protocole a tranché** : à 1 000 parties, 62,57 % est au-dessus de la bande, donc la
  Direction est **trop forte pour une référence scriptée** — c'est le signal, et D-134 demande
  de dire quoi changer plutôt que de discuter le seuil ;
- **la marge est mince** : le bas de l'IC (59,0 %) est dans la bande. Une décision qui
  abaisserait la Direction sur ce seul chiffre se jouerait sur ~2,6 points. La mesure à refaire
  après le changement de niveau (ou avec plus de parties) est ce qui dira si le changement était
  nécessaire — pas cette ligne seule.

Comparaison avec les chiffres connus : D-084 donnait **60,4 %** de la recherche contre le
**glouton** — un adversaire qui cherche un coup. Contre la politique **scriptée**, le même
module rend le chiffre ci-dessus. Ce n'est pas une contradiction : ce sont deux adversaires
différents, et c'est précisément ce que #354 demandait de mesurer.


### Deux chiffres de plus, qui comptent

- **268 parties sur 1 000 (26,8 %) atteignent la limite de 200 tours** : ce sont des égalités
  (D-030), et elles ne disent rien de qui gagne — elles disent que **la partie ne se conclut
  pas** contre un joueur scripté. C'est le même symptôme que les nulles de la table des
  archétypes (`docs/ia/360-table-archetypes.md`) : la boucle de combat s'éteint parfois sans
  vainqueur, et c'est une question de rythme, pas de force.
- **Le budget de 100 ms (D-084) est tenu en médiane et en p95, pas au maximum** : moyenne
  **29 ms**, p50 17,6 ms, p95 **77,4 ms**, mais un pic à **472 ms** — et seulement **2 replis**
  sur 29 965 décisions. Ce pic est mesuré **échéance neutralisée** : à l'écran, la garde de
  60 ms coupe cette décision-là et rejoue le glouton (#172). Le chiffre utile pour le testeur
  est donc « p95 sous 100 ms, un pic rattrapé par la garde », pas « 472 ms à l'écran ».

## Ce que la mesure ne dit pas

- **Rien sur un humain** : la référence est scriptée. Un testeur ne joue pas comme
  `nextAction(state, 1)`, et c'est la seule mesure possible avant l'alpha (D-134, « hors
  périmètre : mesurer contre un humain »).
- **Rien sur le plaisir** : 60 % est un chiffre de justice, pas une preuve d'envie de rejouer.
  La question de D-048 se tranche avec les testeurs, pas ici.
- **Les durées** de décision dépendent du poste : elles se lisent comme un ordre de grandeur
  (budget de 100 ms de D-084), pas comme une constante reproductible. Le **taux**, lui, se rejoue
  à l'identique.

## Reproductibilité et contrôle mord

```bash
npm run mesure:direction -- --json > a.json
npm run mesure:direction -- --json > b.json
cmp a.json b.json            # mêmes chiffres (les durées, elles, varient d'un poste à l'autre)
npm run mesure:direction -- --bande 0.50:0.51   # le verdict doit sortir HORS de la bande
```

Les deux gardes sont dans `src/game/mesure-direction.test.ts` : **même graine, même rapport**
(les durées exclues du contrat), et la **même donnée** jugée contre une bande fausse sort de la
bande — sans quoi le verdict serait une constante, pas une lecture.
