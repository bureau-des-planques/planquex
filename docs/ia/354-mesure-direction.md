# La Direction contre un joueur de référence (#354, D-134)

**Mesure du 28/10/2026, refaite le même jour par #411.** Document de **mesure**, pas une
décision : D-134 fixe le protocole et la bande, les actes vivent dans `docs/DECISIONS.md`,
les chiffres vivent ici. #354 a mesuré ; #411 a changé **un** réglage, remesuré avec la
**même commande**, la **même graine** et la **même référence scriptée**, et corrige deux
lectures que le premier rapport permettait de faire.

## La question

La Direction n'a **jamais** été mesurée contre autre chose que la politique de niveau 1 :
D-084 donne **60,4 % contre le glouton**, et D-109 précise que l'écran joue `nextAiAction`,
c'est-à-dire la **recherche à deux coups**. Contre un **joueur**, on ne savait rien. Or la
question de l'alpha est « est-ce que ça donne envie de refaire une partie » (D-048) : si la
Direction écrase, le testeur arrête ; si elle s'effondre, la partie n'a pas d'enjeu.

## Ce que #411 a changé : un nombre

| | #354 | #411 |
|---|---|---|
| `DEFAULT_SEARCH_OPTIONS.candidates` (`src/game/ia.ts`) | **6** | **2** |
| Taux contre la référence scriptée | **62,57 %** (hors bande) | **52,95 %** (dans la bande) |

**Rien d'autre.** La référence scriptée, les graines, les Decks, la fonction d'évaluation,
`worlds` (3), `replies` (4), `maxNodes` (800) et `maxMs` (60 à l'écran, neutralisée en
mesure) ne bougent pas. `candidates` est le nombre de **mes** coups explorés en entier :
c'est lui qui porte la force, et la mesure du §« Les variantes testées » le montre — les
autres réglages, essayés seuls, ne déplacent pas le chiffre.

Le réglage touche **l'écran** autant que la mesure : `nextAiAction` lit
`DEFAULT_SEARCH_OPTIONS` (D-109). C'était l'objet du ticket — c'est la Direction que le
testeur affronte qui était trop forte, pas seulement le chiffre du rapport.

**Une réparation qui rend la preuve possible.** La mesure recopiait les réglages de la
recherche (`candidates 6 / worlds 3 / replies 4 / maxNodes 800`) dans une constante à elle
(`RECHERCHE_REJOUABLE`). Elle aurait donc continué à mesurer **6 candidats** après le
changement, c'est-à-dire une politique que plus personne ne joue : le chiffre aurait été
juste et la mesure morte. La constante **dérive** maintenant des défauts
(`{ ...DEFAULT_SEARCH_OPTIONS, maxMs: Infinity }`), un test le tient et une entrée de
`scripts/garde-fous.mjs` (ticket 411) vérifie que la mutation « recopier `candidates: 6` »
fait bien tomber ce test.

## Le protocole, écrit avant la mesure

| Point | Valeur |
|---|---|
| Commande | `npm run mesure:direction` · `-- --json` pour le rapport complet · `--bande 0.50:0.51` pour le contrôle mord · `--politique glouton` pour mesurer une autre politique de Direction |
| Code | `src/game/mesure-direction.ts`, gardé par `src/game/mesure-direction.test.ts` |
| **La Direction mesurée** | la **recherche à deux coups** de l'écran (`politique('recherche')`, D-084/D-109), avec `RECHERCHE_REJOUABLE` = `DEFAULT_SEARCH_OPTIONS` et `maxMs: Infinity`. Depuis #411 : `candidates 2 / worlds 3 / replies 4 / maxNodes 800` |
| **Le joueur de référence** | **scripté**, déterministe et public : `politique('scripte')`, la politique historique de niveau 1 (`nextAction(state, 1)`). Ce n'est **pas** une IA de production, c'est un **plancher stable**. Il n'a pas changé entre #354 et #411 : c'est le mètre, pas la cible |
| Parties | **1 000**, en **miroir apparié** : 500 paires, chaque paire jouant la **même graine** et les mêmes Decks deux fois, la Direction changeant de camp |
| Graine maîtresse | **20261028**, la même qu'en #354. Les graines de partie en dérivent (`drawRandom`) |
| Graines **disjointes** | aucune des graines qui ont choisi la politique (#111 : `1, 7, 42, 11, 23` et `99, 1234, 2024, 777, 31337`). `grainesDisjointes()` le vérifie dans les deux sens, et c'est un test |
| Bande de décision | **40 – 60 %** des parties **décidées**, IC 95 % **avant** la mesure (D-134) |
| Intervalle | **Wilson** à 95 %, borné à `[0, 1]` |
| Agrégats (#411) | **par archétype** (faction du Deck de la Direction), **par type de fin** (`endReason` du moteur) et **par tranche de tours** — une moyenne ne dit pas quoi corriger |

**Une réserve, écrite** : la recherche de l'écran porte une **échéance murale** de 60 ms
(`DEFAULT_SEARCH_OPTIONS.maxMs`, #172), seul terme **non déterministe** de la décision. La
mesure la **neutralise** (`maxMs: Infinity`) pour que deux lancements rendent le **même
chiffre** ; le plafond de **nœuds** (800) reste, et `replis` dit combien de décisions sont
retombées sur le glouton. Ce que la mesure ajoute donc par rapport à l'écran : du travail de
recherche que l'échéance aurait coupé — donc une Direction **au plus aussi forte** que celle
de l'écran, jamais plus faible.

## Les chiffres

| Chiffre | #354 (6 candidats) | #411 (2 candidats) |
|---|---|---|
| Parties jouées | **1 000** (500 paires en miroir) | **1 000** (500 paires) |
| Parties **décidées** | 732 — gagnées 458, perdues 274 | 729 — gagnées 386, perdues 343 |
| **Taux de victoire de la Direction** | **62,57 %** des décidées | **52,95 %** des décidées |
| **IC 95 %** (Wilson) | 59,01 % – 66,00 % | **49,32 % – 56,55 %** |
| Bande de D-134 | 40,00 % – 60,00 % | 40,00 % – 60,00 % |
| **Verdict** | **HORS de la bande — trop forte** | **DANS la bande** |
| Parties nulles | 268 (268 à la limite **du moteur**) | 271 (271 à la limite du moteur) |
| Tours médians | 21 toutes · 18 décidées | 22 toutes · 19 décidées |
| Décisions de la Direction | 29 965 coups · 15,64 ms de moyenne (relevé le 28/10, machine partagée ; #354 publiait 29,01 ms) | 30 139 coups · **7,38 ms** de moyenne, p50 5,9 ms, p95 16,7 ms, max 112,5 ms |
| **Travail par décision** | **215,27 nœuds** (6 450 634 au total) | **86,35 nœuds** (2 602 594 au total) |
| Replis de budget | 2 | **0** |

**Les deux lectures de l'intervalle tombent d'accord.** Le taux (52,95 %) est à 7 points du
haut de la bande, et l'intervalle entier (49,32 – 56,55 %) tient **dedans** : on peut dire, à
95 %, que la vraie valeur est entre 40 et 60 %. En #354 c'était le contraire : le taux
dépassait 60 % et le bas de l'IC (59,01 %) mordait sur la bande, donc les données ne
permettaient pas d'affirmer à 95 % que la Direction dépassait 60 % — deux lectures se
tenaient, et il fallait les écrire toutes les deux.

**Les durées ne se comparent pas d'un poste à l'autre** ; le **travail** (nœuds), si : c'est
un compte d'`applyAction`, identique sur toutes les machines (voir `CoutDecisions.noeuds`,
`src/game/simulation.ts`, ajouté par #411 pour cette comparaison). Le passage de 6 à 2
candidats divise le travail par décision par **2,5** (215,27 → 86,35 nœuds) et **supprime
les replis** (2 → 0) : `candidates` est un multiplicateur direct du nombre de lignes
évaluées, donc la Direction coûte **aussi** moins cher — le changement ne dégrade aucune des
deux qualités que le ticket demande de préserver (coût par décision, replis).

**Contrôle de robustesse, hors mètre** : rejouée sur une **autre graine** (`20261029`, même
protocole, 1 000 parties), la variante retenue rend **52,62 %** des décidées (IC 95 %
48,98 – 56,24 %, 724 décidées, 276 nulles, 0 repli). Ce chiffre ne compte pas — D-134 juge
sur `20261028`, et un résultat qui ne tient que sur une graine choisie après coup ne prouve
rien — mais il dit que le résultat **n'est pas un accident de la graine du mètre**.

## Où elle gagnait — les trois agrégats (#354, 6 candidats)

**Par archétype** (faction du Deck de la Direction, 100 parties chacune) :

| Faction | Décidées | Gagnées | Taux |
|---|---:|---:|---:|
| MANAGEMENT | 85 | 61 | 71,76 % |
| RH | 82 | 58 | 70,73 % |
| DIRECTION | 81 | 57 | 70,37 % |
| SYNDICAT | 75 | 50 | 66,67 % |
| AMELIORATION | 87 | 56 | 64,37 % |
| QVT | 69 | 42 | 60,87 % |
| INTERIM | 47 | 28 | 59,57 % |
| ATELIER | 85 | 50 | 58,82 % |
| SSE | 71 | 39 | 54,93 % |
| SUPPORT | 50 | 17 | **34,00 %** |

**Par tranche de tours** :

| Tours | Décidées | Gagnées | Taux |
|---|---:|---:|---:|
| 1–10 | 69 | 30 | 43,48 % |
| 11–20 | 408 | 251 | 61,52 % |
| **21–30** | 255 | 177 | **69,41 %** |

**Par type de fin** : `interventions` 720 parties (63,06 %), `plateauVide` 12 (33,33 %),
`limiteDeTours` 268 (aucune décidée).

**Ce que le diagnostic disait, avant de changer quoi que ce soit** : la Direction ne gagnait
pas « partout ». Elle gagnait **les parties longues** (69,4 % au-delà de 20 tours, contre
43,5 % avant 10) et **les Decks profonds** (MANAGEMENT, RH, DIRECTION au-dessus de 70 %) ;
elle **perdait** avec `SUPPORT` (34 %) — un Deck qui ne conclut pas (50 nulles sur 100). Le
chiffre global de 62,57 % était donc la somme d'une politique qui prend l'avantage **en
fin de partie** et d'archétypes inégaux, pas d'une supériorité uniforme.

**Après le changement** (2 candidats), la même lecture :

| Tranche | #354 | #411 |
|---|---|---|
| 1–10 tours | 43,48 % (30/69) | **15,52 % (9/58)** |
| 11–20 tours | 61,52 % (251/408) | 52,80 % (198/375) |
| 21–30 tours | 69,41 % (177/255) | 60,47 % (179/296) |

La recherche étroite est **nettement plus faible tôt** (elle paie l'exploration réduite là où
l'information manque) et **reste à son avantage tard** (60,5 %). Par archétype, `SUPPORT`
tombe à 27,66 % (13/47) et `RH` reste en tête à 60,26 % (47/78) : l'inégalité entre Decks
**ne vient pas** de la politique, elle est du contenu (#360, #412).

## Les variantes testées, une chose à la fois

**Le mètre ne bouge pas** : même commande, graine `20261028`, 1 000 parties en miroir,
référence scriptée inchangée. Chaque ligne ne change **qu'un** réglage (ou la politique),
et dit **l'hypothèse** qu'elle teste. V1 est la commande elle-même (`--politique glouton`).
V2 à V6 passent par les options `recherche` de `mesurerDirection()` (le module, le protocole
et la graine sont les mêmes ; un lanceur jetable hors du dépôt fournit l'option, aucun code
du dépôt n'est dupliqué). Puis **V6 a été rejouée par le changement de code lui-même et la
commande réelle** : mêmes 386 / 343 / 271 et même 52,95 % — c'est ce qui prouve que la
mesure suit bien l'écran.

| # | Variante (une chose) | Hypothèse testée | Taux | IC 95 % | Décidées | Nulles | Replis |
|---|---|---|---:|---|---:|---:|---:|
| V0 | aucune — les réglages de #354 (6 / 3 / 4 / 800) | le chiffre de #354 se reproduit | **62,57 %** | 59,01 – 66,00 | 732 | 268 | 2 |
| V1 | politique `glouton` (aucune recherche) | la recherche est-elle la source de la force ? | **42,74 %** | 39,12 – 46,42 | 702 | 298 | 0 |
| V2 | `worlds` 3 → 1 | moins d'échantillons de la main adverse suffisent | **60,52 %** | 56,93 – 64,00 | 732 | 268 | 0 |
| V3 | `replies` 4 → 2 | la profondeur du modèle adverse porte la force | **62,40 %** | 58,84 – 65,83 | 734 | 266 | 0 |
| V4 | `replies` 4 → 1 | idem, un cran plus loin | **61,60 %** | 58,04 – 65,04 | 737 | 263 | 0 |
| V5 | `candidates` 6 → 3 | moins de **mes** coups explorés = moins de force | **57,26 %** | 53,64 – 60,80 | 730 | 270 | 0 |
| **V6** | **`candidates` 6 → 2** | **idem, un cran plus loin** | **52,95 %** | **49,32 – 56,55** | 729 | 271 | **0** |

**Ce que les échecs apprennent** (c'est la valeur du ticket) :

- **V1 dit le plancher** : sans recherche, la Direction **perd** contre la référence scriptée
  (42,74 %). Le niveau 2 glouton est donc *sous* la bande, la recherche *au-dessus* : la
  bande se situe entre les deux, et le réglage doit se trouver entre 6 candidats et zéro.
- **V3 et V4 écartent le modèle adverse** : passer de 4 à 2 puis à 1 tour adverse joué en
  entier ne bouge pas le chiffre (62,40 %, 61,60 %, dans le bruit de V0). La profondeur du
  *modèle* n'est pas la force — ce que le journal #111 avait déjà vu en l'augmentant
  (6 puis 8 réponses : même niveau).
- **V2 montre que les mondes coûtent sans décider** : à 1 monde le taux perd 2 points, et
  les lignes évaluées sont **divisées par trois** (c'est le nombre de mondes qui les
  multiplie) ; le résultat sort de la bande de **0,5 point**, donc il est **rejeté par le
  chiffre**, pas par la qualité. C'est la même leçon que §7.2 du journal #111 : la décision
  est peu sensible au contenu de la main adverse.
- **V5 et V6 trouvent le levier** : `candidates` est le seul réglage qui déplace le taux de
  façon monotone (−5,3 points de 6 à 3, −9,6 points de 6 à 2).

**Règle de choix, écrite avant de trancher** : garder une variante dont l'**IC 95 % entier**
tient dans 40–60 % (la lecture exigeante de D-134 : « entre 40 et 60 % … avec son intervalle
de confiance à 95 % »), et, parmi celles-là, celle qui **cherche le plus** (le plus de
candidats), pour ne pas raboter la qualité au-delà du nécessaire. **V5 ne qualifie pas**
(son IC monte à 60,80 %) ; **V6 qualifie seul**. D'où `candidates: 2`.

**Ce que la règle protège** : V6 n'est pas choisie parce qu'elle est la plus faible, mais
parce qu'elle est la seule dont l'intervalle **tient** la bande. Une variante à 59,9 %
aurait fait un joli chiffre et n'aurait rien prouvé.

## Les 268 (puis 271) nulles : la limite est celle du moteur, pas celle du harnais

**Correction de #354.** Le premier rapport écrivait « 268 nulles, toutes à la limite de
**200** tours ». C'est faux, et la mesure le disait mal : les 268 égalités sont à la limite
du **moteur**, `TURN_LIMIT = 30` (`src/game/rules.ts:22`, appliqué par
`src/game/engine.ts:1470-1478`, D-031) ; `maxTurns = 200` n'est qu'un **arrêt d'urgence du
harnais** (`DEFAULT_MAX_TURNS`), et il est **inatteignable** : le moteur rend la main au
31<sup>e</sup> tour. Le rapport le prouve maintenant par deux champs : `limiteMoteur` (30),
`maxTurns` (200), et `nullesAuHarnais` (**0**, une sentinelle — si un jour une partie
s'arrêtait au harnais, ce serait un bug du moteur, pas une égalité).

**Ce que ces nulles disent** : une partie sur quatre (26,8 % en #354, 27,1 % en #411) **ne se
conclut pas** en 30 tours — personne n'atteint 3 Interventions (D-030 : égalité). Ce n'est pas un défaut de la
politique seule : dans la mesure de #411, elles se **concentrent sur deux Decks** —
`SUPPORT` 53/100, `INTERIM` 54/100, contre 10 à 26 pour les huit autres. Un Deck qui ne
conclut pas fait des égalités **quelle que soit** la politique en face, et c'est le symptôme
déjà relevé par la table des archétypes
(`docs/ia/360-table-archetypes.md`) : un problème de **rythme et d'armement** (#113), pas de
force. La mesure ne le corrige pas ; elle le compte, et le chiffre publié — le taux des
**décidées** — ne le cache pas.

## Les 2 replis sur 29 965 décisions

Un **repli** n'est pas une erreur : c'est la **sortie de secours** prévue par #172. Quand le
plafond de **nœuds** d'une décision est atteint (`maxNodes: 800`), `searchDecision` abandonne
la ligne en cours et rend le coup du **niveau 2 glouton** (`fallbackAction`, première action
légale du meilleur score), et `replis` le compte. Le compte est **déterministe** (nœuds, pas
millisecondes) : les 2 replis se rejouent à l'identique.

**Pourquoi seulement 2** : le plafond ne mord que sur la **queue** des états pathologiques
(mains et Decks pleins, ~15 actions légales) — le maximum observé hors plafond est de
777 nœuds pour 800 (`docs/ia/111-essais-recherche-2-coups.md` §6.3). Ces 2 décisions sur
29 965 (0,007 %) ont donc joué le glouton au lieu du coup de la recherche : un effet
**négligeable** sur un taux à ±3,6 points, et **aucun** effet sur la légalité (le repli rend
une action de `legalActions`). Avec `candidates: 2`, le travail moyen tombe à **86 nœuds** :
**zéro repli** sur 30 139 décisions — le réglage retenu supprime jusqu'au cas de bord.

## Ce que la mesure ne dit pas

- **Rien sur un humain** : la référence est scriptée. Un testeur ne joue pas comme
  `nextAction(state, 1)`, et c'est la seule mesure possible avant l'alpha (D-134, « hors
  périmètre : mesurer contre un humain »). Une Direction à 52,95 % contre ce plancher peut
  être bien plus forte — ou plus faible — contre quelqu'un qui développe et se replace.
- **Rien sur le plaisir** : la bande est un chiffre de justice, pas une preuve d'envie de
  rejouer. La question de D-048 se tranche avec les testeurs, pas ici.
- **Rien sur les autres qualités de la recherche** : `candidates: 2` divise le travail et
  supprime les replis, mais la mesure ne dit pas si la Direction **joue mieux** ou moins
  bien à 2 qu'à 6 candidats contre un adversaire qui n'est pas scripté. Le seul critère
  disponible est celui de D-134, et il est respecté.
- **Les durées** dépendent du poste : elles se lisent comme un ordre de grandeur (budget de
  100 ms de D-084), pas comme une constante reproductible. Le **taux** et le **nombre de
  nœuds**, eux, se rejouent à l'identique.

## Reproductibilité et contrôle mord

```bash
npm run --silent mesure:direction -- --json > a.json   # `--silent` : sans lui, l'en-tête de
npm run --silent mesure:direction -- --json > b.json   # npm passe sur stdout et le fichier
                                                       # n'est plus du JSON (constaté en #411)
npm run mesure:direction -- --bande 0.50:0.51   # le verdict doit sortir HORS de la bande
npm run mesure:direction -- --politique glouton # la variante V1 : 42,74 %
```

**Les deux rapports portent le même taux, les mêmes issues, les mêmes agrégats et le même
nombre de nœuds ; seules les durées (`ia.ms*`) changent d'un lancement à l'autre.** Un `cmp`
brut entre `a.json` et `b.json` échoue donc sur les durées — la preuve « même graine, même
rapport » est le test, qui exclut explicitement les durées du contrat. Vérifié en #411 : le
rapport de `npm run mesure:direction` et celui de la même mesure passée par l'option
`recherche` rendent les mêmes 386/343/271 et le même 52,95 %.

Les gardes sont dans `src/game/mesure-direction.test.ts` et **chacune peut échouer** :

- **même graine, même rapport** (les durées exclues du contrat) ;
- la **même donnée** jugée contre une bande fausse sort de la bande — sans quoi le verdict
  serait une constante, pas une lecture ;
- **les réglages de la mesure sont ceux de l'écran** : `RECHERCHE_REJOUABLE` égale
  `{ ...DEFAULT_SEARCH_OPTIONS, maxMs: Infinity }` — la garde qui aurait attrapé la
  constante recopiée (#411), et la mutation correspondante est dans
  `scripts/garde-fous.mjs` ;
- **les agrégats se recoupent** : la somme des lignes (archétype, type de fin, tranche)
  égale les parties, et chaque ligne porte son propre taux ;
- **la limite lue est celle du moteur** : `limiteMoteur < maxTurns`, `nullesAuHarnais` à 0 ;
- **un agrégat vide ne vaut jamais 0 %** : aucune partie décidée rend `NaN`, pas « 0 % ».

Le budget de candidats a ses propres gardes dans `src/game/ia-recherche.test.ts` : la
**valeur mesurée** (`candidates: 2`, cliquet), et le fait que le réglage **morde** sur le
travail (1 candidat → 0 nœud et le coup du glouton, 2 puis 4 → strictement plus de nœuds).

## Ce que #411 ne fait pas

- **L'acte daté.** Changer un réglage de la politique est une **décision** (D-134 : « on
  mesure, puis on décide »), et D-084 a acté la recherche comme politique de l'écran. Le
  chiffre, l'hypothèse et la règle de choix sont écrits ici ; la décision datée qui entérine
  `candidates: 2` reste à poser dans `docs/DECISIONS.md` — ce ticket n'ouvre pas ce fichier.
- **`scripts/pesage.mjs`** porte encore `{ candidates: 6, worlds: 3, replies: 4, maxNodes:
  800, maxMs: 60 }` comme défaut de `--direction recherche`. Il est **laissé tel quel** :
  c'est le harnais du protocole D-084/#111, il rejoue *ce* protocole-là, et le changer
  demanderait sa propre mesure. Mais il ne décrit plus la recherche de l'écran : **à
  traiter** (même classe de défaut que la constante recopiée corrigée ci-dessus).
- **Les Decks**, donc l'écart entre archétypes : c'est #360 et #412. `SUPPORT` à 27,66 % et
  ses 53 égalités sur 100 ne se règlent pas par la politique.
