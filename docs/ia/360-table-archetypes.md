# La table des archétypes, mesurée (#360, D-134 (2))

**Date de la mesure : 28/10/2026.** Document de **mesure**, pas une décision : les actes sont
dans `docs/DECISIONS.md` (D-134 (2)), les chiffres vivent ici, et rien n'a été corrigé pour
obtenir cette table — « on mesure, puis on décide ».

> **#412 a corrigé le contenu, sur cette mesure.** La table publiée ci-dessous est celle
> d'**après** la correction ; celle d'avant est conservée section « Avant / après #412 »,
> écart par écart. Les deux corrections et leur justification sont dans la section « Ce que
> #412 a mesuré » — elles ne touchent ni une règle, ni une Vulnérabilité, ni un Deck dérivé,
> ni la politique.

## Le protocole, fixé d'avance

| Point | Valeur |
|---|---|
| Commande | `npm run mesure:archetypes` (markdown) · `-- --json` pour le rapport complet |
| Code | `src/game/mesure-archetypes.ts`, gardé par `src/game/mesure-archetypes.test.ts` |
| Graine maîtresse | **20261029** — disjointes des graines du pesage (#111 : `1, 7, 42, 11, 23`, `99, 1234, 2024, 777, 31337`) et de la mesure de la Direction (#354, graine `20261028`) |
| Parties | **40 par paire**, en **miroir** : chaque affrontement joue les deux sièges à graine et Decks identiques, donc 20 parties par siège et l'avantage du premier joueur s'annule |
| Total | **45 affrontements × 40 = 1 800 parties** |
| Archétypes | les **Decks dérivés** (`factionDeck`, `src/game/simulation.ts` : un Deck de 20 cartes par faction, #352), pas une liste écrite à la main |
| Politique | **scriptée** des deux côtés (`nextAction(state, 1)`, niveau 1) : une table d'archétypes mesure des **Decks**, pas l'asymétrie de deux politiques. C'est aussi la politique du simulateur historique |
| Bande | **40 – 60 %** d'un affrontement (D-134 (2)) |
| Seuil d'alerte | **plus de 15 points** d'écart à 50 % → « à corriger avant la beta ». 15,0 points est encore assumé, le dépassement est strict |
| Intervalle | **Wilson à 95 %** sur les parties **décidées** (les nulles ne comptent ni pour ni contre) |
| Forme du Deck | **publiée avec la table** (#412) : cartes par stade, COMEX, Actions, noms, **Seuil max** et **Pressions payables** avec les types de café du Deck (`pressionPayable`, D-037). Un écart se lit d'abord là — un Deck sans N+2 n'a pas de réponse à un COMEX à 180 de Seuil, et un Deck qui ne peut pas payer ses Pressions n'attaque pas |

**Reproductibilité** : deux lancements à la graine par défaut donnent la table **octet pour
octet** (aucun horodatage, aucun ordre de `Map`). C'est ce que vérifie le test de
`mesure-archetypes.test.ts`.

**Le contrôle mord** : `ecartAlerte(0,66)` est **vrai** (16 points), `ecartAlerte(0,64)` est
**faux** (14 points). Sans lui, un seuil réglé à 60 points passerait les mêmes tests verts.

**#352 a changé le contenu de deux factions** (dix noms de base par faction au lieu de huit en
moyenne) : cette table est mesurée **après** #352, sur `main` au commit de fusion de #398. Une
table antérieure à #352 ne décrit plus les mêmes Decks et ne doit pas être citée.

## Ce que #412 a mesuré : le contenu, la courbe, ou la Vulnérabilité ?

Le ticket #412 partait d'un constat : **SUPPORT à 27,5 %** (hors bande) et **douze écarts de
plus de 15 points**, tous avec SUPPORT ou INTERIM du côté perdant. Trois hypothèses à
départager **par la mesure**, avant d'écrire une carte. Chaque ligne ci-dessous est calculée
sur les cartes réelles, à la table d'avant correction ; le « comment ça se refait » est en fin de section.

### Hypothèse 1 — le contenu manque d'outils

| Mesure | SUPPORT | INTERIM | Les huit autres |
|---|---|---|---|
| **Pressions du Deck payables** avec les types de café du Deck (D-037) | 21 / 21 (100 %) | **12 / 28 (43 %)** | 100 % pour les huit |
| **Forme du Deck dérivé** (Entrants / N+1 / N+2 / COMEX / Actions) | 16 / 4 / **0 / 0 / 0** | 8 / 6 / 4 / 2 / 0 | 7 à 20 Entrants, **0 à 6** N+2 |
| **Seuil max du Deck** (le plafond qu'il peut opposer) | **110** | 180 | 75 à 180 |
| **Part de nulles** sur six affrontements | 20 à 23 / 40 | 20 à 32 / 40 | 0 à 23 / 40 |

- **INTERIM** : la ligne 1 coûtait `MANAGEMENT` + `QVT`, la ligne 2 `RH` + `ATELIER`. Le Deck
  d'archétype prend **toutes** les cartes de la faction : la faction demandait **cinq** types
  pour un plafond de **trois** (D-034), et **57 %** de ses Pressions — dont celles du **COMEX**
  et du N+2 de la ligne 1 — ne pouvaient **pas** être lancées. Ce n'est pas une impression :
  c'est le Deck du harnais qui ne pouvait pas attaquer.
- **SUPPORT** : le Deck dérivé ne porte **aucun** N+2, **aucun** COMEX, **aucune** carte
  Action, pour un Seuil max de 110. Ses six N+2 existent au catalogue mais **n'entrent pas**
  dans le Deck : `factionDeck` ajoute **tous** les Entrants avant les évolutions, et SUPPORT
  en compte 16 (16 + 4 N+1 = 20 cartes). Le symptôme mesuré est exactement celui du ticket :
  **20 à 23 nulles sur 40** — SUPPORT n'arrive pas à conclure.

### Hypothèse 2 — la courbe ne suit pas

| Mesure | SUPPORT | INTERIM | Repère (dix factions) |
|---|---|---|---|
| **Dégâts moyens par café** de ses Pressions | 21,3 | **26,7** (le plus haut) | 19,6 (QVT) à 26,7 |
| **Pressions hors bande** (`curves.ts`, `CARD-SPEC.md` §2) | 0 | 0 | 0 partout |
| **Lecture de bande** (avant #412) | **plancher** : 10 à 1 café (bas de 10–30), 40 à 2 cafés (bas de 40–80) | haut de bande | plancher pour QVT, haut pour AMELIORATION |
| **Tours médians pour craquer un Poste** (contre SSE / contre ATELIER) | 10 / **4** (l'adversaire craque au tour 13,5 / 9,5) | **14** / 9 (l'adversaire au tour 13 / 15) | 4 à 14 : SUPPORT contre ATELIER le plus tôt, INTERIM contre SSE le plus tard |
| **Nulles contre SSE** (sur 40) | 7 | **16** | 0 à 9 |

- Aucune Pression du set n'est **hors** bande : la table de `CARD-SPEC.md` §2 n'est donc pas
  violée. Mais **SUPPORT lisait le plancher de chaque bande**, et c'est une faute de courbe
  au même titre qu'une Pression hors bande : une Pression qui n'utilise pas sa bande rend
  moins de Stress que son coût.
- **INTERIM, lui, a la courbe la plus haute du set** (26,7 dégâts par café) : la courbe
  n'explique pas son 41,6 %. Il craque le plus tard des dix (tour 14 contre SSE) et fait
  **16 nulles sur 40** : il ne craque pas, il **n'avance pas**.

### Hypothèse 3 — la Vulnérabilité

- SUPPORT (Incolore) est vulnérable à **ATELIER** (D-031, +20) : c'est **un** des douze
  écarts, ATELIER / SUPPORT (100 % pour ATELIER, 0–20), et l'affrontement le plus **court** de
  la table (13 tours de moyenne, contre 19 à 24 ailleurs). La Vulnérabilité se lit bien là.
- Mais SUPPORT perdait aussi **100 %** de ses parties décidées contre **MANAGEMENT**,
  **AMELIORATION**, **SYNDICAT** et **QVT** (0–20, 0–20, 0–18, 0–17), qui n'ont **aucune**
  Vulnérabilité sur lui : le Incolore n'a qu'un seul type dans le cycle de D-024.
- Et **INTERIM n'a aucune Vulnérabilité** (Dragon, AGENTS.md §3.2) : il portait pourtant
  **cinq** des douze alertes.

**Comment ces chiffres se refont** : la **forme du Deck** et les **Pressions payables** sont
publiées par `npm run mesure:archetypes` (bloc « forme des Decks ») et ne se lisent plus
autrement ; les **dégâts par café** sont la moyenne des `attacks` des cartes de base de la
faction rapportée au nombre de symboles de leur coût, confrontée à `damageBand()`
(`src/game/curves.ts`), ce que fait `cards.test.ts` pour chaque carte ; les **tours du premier
craquage** et les **nulles** se lisent dans la table, aux lignes d'affrontement. Avant #412, le
`COMEX` d'INTERIM et son N+2 de ligne 1 figuraient parmi les **16** Pressions impayables : la
colonne « Pressions payables » les montre aujourd'hui à **28 / 28**.

### Le verdict de la mesure

**L'hypothèse 1, avec une part d'hypothèse 2 pour SUPPORT.** Le contenu est en cause de deux
façons mesurables — des Pressions **impayables** (INTERIM, 43 %) et un Deck qui **ne monte pas
au N+2** (SUPPORT, 0 N+2, Seuil max 110) — et SUPPORT, en plus, **lisait le plancher** de
chaque bande. **La Vulnérabilité est réfutée comme cause** : elle explique un affrontement sur
douze, et INTERIM, qui n'en a aucune, portait les cinq autres.

### Les deux corrections, et pourquoi ce sont les plus petites possibles

Aucune carte **ajoutée ni retirée**, aucun Seuil de rareté déplacé, **aucune règle changée**,
`CARD-SPEC.md` §2 **inchangé** (les bandes n'ont pas bougé : c'est leur **lecture** qui a
changé) :

1. **INTERIM — les symboles de café, pas les dégâts.** Huit Pressions passent de
   `MANAGEMENT` / `QVT` à la paire **`RH` + `ATELIER`**, celle que la ligne 2 employait déjà ;
   la faction tient donc dans **trois** types (`SSE` pour l'Entrant, puis `RH` + `ATELIER`),
   le plafond de D-034, et **28 Pressions sur 28** sont payables. Aucun dégât n'a changé :
   la bande de D-021 est intacte. La règle de D-037 (3) — deux types produits **distincts** à
   2 cafés et plus — est respectée à chaque Pression.
2. **SUPPORT — la bande, pas de nouvelles cartes.** Une Pression **sans effet** prend le
   **haut** de sa bande (30 à 1 café, 80 à 2 cafés) et une Pression **à effet** un cran en
   dessous (20 à 1 café, 70 à 2 cafés ; l'effet reste **gratuit**, D-021) ; le Seuil prend le
   haut de la bande de son stade et de sa rareté (70 pour un Entrant `1D`, 110 pour un N+1
   `2D`, 160 pour un N+2 `3D`, 190 pour un COMEX `4D`). C'était le plus petit levier
   disponible : le Deck de SUPPORT ne contient **que** des Entrants et des N+1, donc le haut
   du N+2 ne pouvait pas être atteint sans écrire des cartes — et écrire des cartes n'était
   pas nécessaire.

Deux gardes ont été ajoutées pour que le défaut ne revienne pas : `support.test.ts` refuse
**toute** Pression au plancher de sa bande (avec un « le contrôle mord » sur les valeurs
d'avant #412), et `interim.test.ts` refuse que la **faction** demande plus de trois types de
café (le contrôle de #116 ne portait que par ligne).

## Ce que la table dit après #412

- **Les dix archétypes sont dans la bande 40–60 %** : SSE 45,3 %, MANAGEMENT 49,4 %,
  QVT 44,2 %, AMELIORATION 54,5 %, RH 44,9 %, ATELIER 53,2 %, DIRECTION 52,8 %,
  SYNDICAT 54,8 %, **INTERIM 46,9 %**, **SUPPORT 53,5 %**.
- **SUPPORT passe de 27,5 % à 53,5 %** (IC 46,6 – 60,3) et **INTERIM de 41,6 % à 46,9 %**
  (IC 39,9 – 53,9). Le pire taux du set n'est plus SUPPORT mais **QVT (44,2 %)**, et il est
  dans la bande.
- **Les nulles baissent** : **436 → 390** sur 1 800 parties, et les plus gros reculs sont
  ceux des affrontements où les deux corrections agissent — INTERIM / SUPPORT **22 → 9**
  nulles sur 40, ATELIER / INTERIM 14 → 8, QVT / INTERIM 32 → 27, MANAGEMENT / INTERIM
  27 → 22, SYNDICAT / INTERIM 26 → 22, RH / INTERIM 20 → 16. SUPPORT et INTERIM
  **concluent** désormais leurs parties au lieu de les laisser expirer — c'était le symptôme
  du ticket. *(Deux affrontements font l'inverse — SSE / SUPPORT 10 → 12, SSE / INTERIM
  24 → 21 — et c'est cohérent : un Deck plus solide fait durer la partie, il ne l'abrège
  pas.)*
- **Douze écarts dépassent encore 15 points**, mais **aucun n'est plus un 100–0** : les
  quatre affrontements où SUPPORT ne gagnait **aucune** partie décidée en gagnent maintenant
  (13 contre MANAGEMENT, 7 contre AMELIORATION, 3 contre ATELIER, 4 contre SYNDICAT), et
  INTERIM gagne **16** de ses affrontements décidés contre SSE (10 avant). Les écarts
  restants sont ceux d'une **échelle de Decks**, pas d'un Deck cassé — voir juste après.

### Les écarts restants, assumés avec leur raison (#412, D-134 (2))

**La cause commune est mesurée, et elle n'est pas dans les cartes : elle est dans le Deck
dérivé.** La table « forme des Decks » ci-dessous est publiée par la commande : **quatre**
archétypes n'ont **aucun** N+2 dans leur Deck (SSE, 100 de Seuil max ; ATELIER et SUPPORT,
110 ; QVT, **75**) et six en portent de 2 à 6 (Seuil max 150 à 180, avec un ou deux COMEX).
`factionDeck`
(`src/game/simulation.ts`) ajoute **tous les Entrants** avant les évolutions : à 16 Entrants
(SUPPORT) ou 20 (QVT), les N+2 du catalogue **n'entrent jamais** dans un Deck de 20 cartes. Un
ajustement de courbe ne peut pas donner un Seuil de 180 à QVT ; seul un Deck (ou une forme de
contenu) le peut. Ce n'est **pas** corrigé ici : `simulation.ts` est la zone de **#411** (la
politique), et un Deck d'archétype se change sous sa propre mesure, pas en même temps que
douze cartes.

| Affrontement | Écart | Décidées | Raison assumée |
|---|---:|---:|---|
| QVT / INTERIM | 50,0 pts (0–13) | 13 | QVT est le Deck le plus mince du set **mesuré** : 20 Entrants, 0 N+2, Seuil max **75**. Il ne prend aucune Intervention contre un Deck qui monte à 180. Deck dérivé (#411). |
| QVT / SUPPORT | 50,0 pts (0–19) | 19 | Même raison : le Deck de QVT (20 Entrants, Seuil max 75) contre SUPPORT (N+1 à 110 et Pressions à 80). Deck dérivé (#411). |
| DIRECTION / INTERIM | 44,1 pts (1–16) | 17 | Deux Decks à 6 N+2 dont 2 COMEX ; le tempo décide. INTERIM paie **deux types distincts** par Pression (D-037 (3)) là où DIRECTION n'en paie qu'un : à Deck égal, il attache un tour plus tard. Mesuré, pas corrigé — c'est la règle, pas les cartes. |
| SSE / SUPPORT | 39,3 pts (3–25) | 28 | SSE : 15 Entrants, 0 N+2, Seuil max 100 (Deck dérivé, #411). |
| ATELIER / SUPPORT | 35,0 pts (3–17) | 20 | **La seule que la Vulnérabilité explique** : SUPPORT est Incolore, vulnérable à ATELIER (+20, D-031), et c'est l'affrontement le plus court de la table. Assumé : c'est la règle. |
| SSE / INTERIM | 34,2 pts (3–16) | 19 | SSE sans N+2 (Seuil max 100) contre un Deck à 6 N+2 et 2 COMEX. Deck dérivé (#411). |
| AMELIORATION / INTERIM | 30,0 pts (4–16) | 20 | 5 N+2 et 2 Actions chez AMELIORATION (Seuil max 170) ; INTERIM paie deux types par Pression. |
| DIRECTION / SUPPORT | 30,0 pts (4–16) | 20 | DIRECTION : 5 N+2, un COMEX à 180 ; SUPPORT : 0 N+2, Seuil max 110. Deck dérivé (#411). |
| SYNDICAT / SUPPORT | 30,0 pts (4–16) | 20 | Même raison : SYNDICAT 5 N+2 et un COMEX à 180 contre un Deck qui n'en porte aucun. |
| MANAGEMENT / INTERIM | 27,8 pts (4–14) | 18 | MANAGEMENT 4 N+2 (Seuil 150) ; INTERIM paie deux types par Pression. |
| RH / SUPPORT | 25,0 pts (5–15) | 20 | RH porte 2 N+2 dont un COMEX à 180 ; SUPPORT aucun. |
| SYNDICAT / INTERIM | 22,2 pts (5–13) | 18 | Même famille : l'écart de N+2 entre les deux Decks. |

**La réserve d'échantillon, écrite une fois** : 40 parties par paire donnent un intervalle de
confiance de **±12 à ±18 points** sur les parties décidées. Les écarts de 22 à 35 points
tombent donc **à la limite** de ce que cette table distingue, et ceux de 25 points (RH /
SUPPORT, 20 décidées) pourraient être beaucoup plus petits en réalité. Les relever demande
**plus de parties**, pas un nouveau réglage de cartes : c'est un ticket de mesure.

## Avant / après #412, archétype par archétype

Mesuré à la même graine (20261029), 40 parties par paire, même politique. Les deux tables
sortent de la même commande.

| Archétype | Avant | Après | Verdict |
|---|---:|---:|---|
| SSE | 49,2 % | 45,3 % | dans la bande |
| MANAGEMENT | 53,4 % | 49,4 % | dans la bande |
| QVT | 45,7 % | 44,2 % | dans la bande |
| AMELIORATION | 56,5 % | 54,5 % | dans la bande |
| RH | 48,2 % | 44,9 % | dans la bande |
| ATELIER | 54,5 % | 53,2 % | dans la bande |
| DIRECTION | 53,5 % | 52,8 % | dans la bande |
| SYNDICAT | 56,3 % | 54,8 % | dans la bande |
| **INTERIM** | **41,6 %** | **46,9 %** | dans la bande (il y était à la limite basse) |
| **SUPPORT** | **27,5 %** | **53,5 %** | **hors bande → dans la bande** |

**Trois écarts sortent** de l'alerte : **AMELIORATION / SUPPORT** (50,0 → 15,0 pts, 20 nulles
avant comme après), **MANAGEMENT / SUPPORT** (50,0 → 15,0 pts, 20 nulles avant comme après) et
**INTERIM / SUPPORT** (16,7 → 1,6 pt, 22 → 9 nulles). **Trois y entrent**, et il faut le
dire : **SSE / SUPPORT** (13,3 → 39,3 pts), **SSE / INTERIM** (12,5 → 34,2 pts) et **RH /
SUPPORT** (15,0 → 25,0 pts) — SUPPORT et INTERIM montent, et **SSE**, qui n'a pas bougé d'une
carte, passe de 49,2 % à 45,3 % et recule au niveau de QVT (44,2 %) et de RH (44,9 %). Le
nombre d'alertes est donc **le même (douze)**,
mais le défaut décrit n'est plus le même : plus aucune défaite totale, plus aucun 100–0, et
les écarts restants sont ceux de la **forme des Decks** — mesurée, publiée, non corrigée ici.

## Comment relire ces chiffres

- Ce document **mesure** ; il ne tranche pas. Ce qui est acté est dans `docs/DECISIONS.md`
  (D-134 (2)) ; ce qui a été corrigé l'a été sous #412, avec ces chiffres.
- **Toute modification de carte périme cette table** : la régénérer (`npm run mesure:archetypes`)
  et la republier dans ce fichier, sans retaper un chiffre.
- La commande ne rejoue **pas** une partie : elle joue 1 800 parties (≈ 40 s). C'est une
  commande, pas un test.

## La table produite par le simulateur

La table ci-dessous est la **sortie brute** de `npm run mesure:archetypes`, à la graine par
défaut, recopiée telle quelle (aucun chiffre retapé à la main). La régénérer :

```bash
npm run mesure:archetypes                 # markdown
npm run mesure:archetypes -- --json       # le rapport complet (JSON)
```

### Taux de victoire par archétype, tous affrontements

Politique : scripte des deux côtés · 40 parties par paire en miroir · graine 20261029.

| Archétype | Parties | Victoires | Décidées | Taux | IC 95 % | Bande 40.0 % – 60.0 % |
|---|---:|---:|---:|---:|---|---|
| SSE | 360 | 134 | 296 | 45.3 % | 39.7 % – 51.0 % | dans la bande |
| MANAGEMENT | 360 | 157 | 318 | 49.4 % | 43.9 % – 54.8 % | dans la bande |
| QVT | 360 | 126 | 285 | 44.2 % | 38.6 % – 50.0 % | dans la bande |
| AMELIORATION | 360 | 169 | 310 | 54.5 % | 49.0 % – 60.0 % | dans la bande |
| RH | 360 | 136 | 303 | 44.9 % | 39.4 % – 50.5 % | dans la bande |
| ATELIER | 360 | 173 | 325 | 53.2 % | 47.8 % – 58.6 % | dans la bande |
| DIRECTION | 360 | 158 | 299 | 52.8 % | 47.2 % – 58.4 % | dans la bande |
| SYNDICAT | 360 | 161 | 294 | 54.8 % | 49.0 % – 60.4 % | dans la bande |
| INTERIM | 360 | 90 | 192 | 46.9 % | 39.9 % – 53.9 % | dans la bande |
| SUPPORT | 360 | 106 | 198 | 53.5 % | 46.6 % – 60.3 % | dans la bande |

### La forme des Decks mesurés

Un écart se lit d’abord ici : un Deck sans N+2 n’a pas de réponse à un COMEX de 180 de Seuil,
et un Deck dont les Pressions ne sont pas payables par ses trois types de café (D-037) ne peut pas attaquer.

| Archétype | Cartes | Entrants | N+1 | N+2 | COMEX | Actions | Noms | Seuil max | Pressions payables |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SSE | 20 | 15 | 5 | 0 | 0 | 0 | 20 | 100 | 20 / 20 |
| MANAGEMENT | 20 | 11 | 5 | 4 | 0 | 0 | 20 | 150 | 24 / 24 |
| QVT | 20 | 20 | 0 | 0 | 0 | 0 | 20 | 75 | 20 / 20 |
| AMELIORATION | 20 | 7 | 6 | 5 | 1 | 2 | 20 | 170 | 26 / 26 |
| RH | 20 | 13 | 5 | 2 | 1 | 0 | 20 | 180 | 25 / 25 |
| ATELIER | 20 | 12 | 8 | 0 | 0 | 0 | 20 | 110 | 21 / 21 |
| DIRECTION | 20 | 10 | 4 | 5 | 1 | 1 | 17 | 180 | 27 / 27 |
| SYNDICAT | 20 | 8 | 6 | 5 | 1 | 1 | 11 | 180 | 26 / 26 |
| INTERIM | 20 | 8 | 6 | 6 | 2 | 0 | 10 | 180 | 28 / 28 |
| SUPPORT | 20 | 16 | 4 | 0 | 0 | 0 | 20 | 110 | 21 / 21 |

### Les affrontements, deux à deux

| A | B | Parties | A gagne | B gagne | Nulles | Taux de A | IC 95 % | Écart | Verdict |
|---|---|---:|---:|---:|---:|---:|---|---:|---|
| SSE | MANAGEMENT | 40 | 20 | 20 | 0 | 50.0 % | 35.2 % – 64.8 % | 0.0 pts | assumé |
| SSE | QVT | 40 | 17 | 12 | 11 | 58.6 % | 40.7 % – 74.5 % | 8.6 pts | assumé |
| SSE | AMELIORATION | 40 | 19 | 19 | 2 | 50.0 % | 34.8 % – 65.2 % | 0.0 pts | assumé |
| SSE | RH | 40 | 18 | 15 | 7 | 54.5 % | 38.0 % – 70.2 % | 4.5 pts | assumé |
| SSE | ATELIER | 40 | 20 | 19 | 1 | 51.3 % | 36.2 % – 66.1 % | 1.3 pts | assumé |
| SSE | DIRECTION | 40 | 17 | 18 | 5 | 48.6 % | 33.0 % – 64.4 % | 1.4 pts | assumé |
| SSE | SYNDICAT | 40 | 17 | 18 | 5 | 48.6 % | 33.0 % – 64.4 % | 1.4 pts | assumé |
| SSE | INTERIM | 40 | 3 | 16 | 21 | 15.8 % | 5.5 % – 37.6 % | 34.2 pts | **à corriger avant la beta** |
| SSE | SUPPORT | 40 | 3 | 25 | 12 | 10.7 % | 3.7 % – 27.2 % | 39.3 pts | **à corriger avant la beta** |
| MANAGEMENT | QVT | 40 | 17 | 23 | 0 | 42.5 % | 28.5 % – 57.8 % | 7.5 pts | assumé |
| MANAGEMENT | AMELIORATION | 40 | 19 | 21 | 0 | 47.5 % | 32.9 % – 62.5 % | 2.5 pts | assumé |
| MANAGEMENT | RH | 40 | 20 | 20 | 0 | 50.0 % | 35.2 % – 64.8 % | 0.0 pts | assumé |
| MANAGEMENT | ATELIER | 40 | 21 | 19 | 0 | 52.5 % | 37.5 % – 67.1 % | 2.5 pts | assumé |
| MANAGEMENT | DIRECTION | 40 | 21 | 19 | 0 | 52.5 % | 37.5 % – 67.1 % | 2.5 pts | assumé |
| MANAGEMENT | SYNDICAT | 40 | 18 | 22 | 0 | 45.0 % | 30.7 % – 60.2 % | 5.0 pts | assumé |
| MANAGEMENT | INTERIM | 40 | 14 | 4 | 22 | 77.8 % | 54.8 % – 91.0 % | 27.8 pts | **à corriger avant la beta** |
| MANAGEMENT | SUPPORT | 40 | 7 | 13 | 20 | 35.0 % | 18.1 % – 56.7 % | 15.0 pts | assumé (hors bande, sous 15 points) |
| QVT | AMELIORATION | 40 | 20 | 20 | 0 | 50.0 % | 35.2 % – 64.8 % | 0.0 pts | assumé |
| QVT | RH | 40 | 17 | 15 | 8 | 53.1 % | 36.4 % – 69.1 % | 3.1 pts | assumé |
| QVT | ATELIER | 40 | 19 | 20 | 1 | 48.7 % | 33.9 % – 63.8 % | 1.3 pts | assumé |
| QVT | DIRECTION | 40 | 20 | 20 | 0 | 50.0 % | 35.2 % – 64.8 % | 0.0 pts | assumé |
| QVT | SYNDICAT | 40 | 15 | 18 | 7 | 45.5 % | 29.8 % – 62.0 % | 4.5 pts | assumé |
| QVT | INTERIM | 40 | 0 | 13 | 27 | 0.0 % | 0.0 % – 22.8 % | 50.0 pts | **à corriger avant la beta** |
| QVT | SUPPORT | 40 | 0 | 19 | 21 | 0.0 % | 0.0 % – 16.8 % | 50.0 pts | **à corriger avant la beta** |
| AMELIORATION | RH | 40 | 20 | 18 | 2 | 52.6 % | 37.3 % – 67.5 % | 2.6 pts | assumé |
| AMELIORATION | ATELIER | 40 | 19 | 21 | 0 | 47.5 % | 32.9 % – 62.5 % | 2.5 pts | assumé |
| AMELIORATION | DIRECTION | 40 | 18 | 17 | 5 | 51.4 % | 35.6 % – 67.0 % | 1.4 pts | assumé |
| AMELIORATION | SYNDICAT | 40 | 23 | 16 | 1 | 59.0 % | 43.4 % – 72.9 % | 9.0 pts | assumé |
| AMELIORATION | INTERIM | 40 | 16 | 4 | 20 | 80.0 % | 58.4 % – 91.9 % | 30.0 pts | **à corriger avant la beta** |
| AMELIORATION | SUPPORT | 40 | 13 | 7 | 20 | 65.0 % | 43.3 % – 81.9 % | 15.0 pts | assumé (hors bande, sous 15 points) |
| RH | ATELIER | 40 | 19 | 21 | 0 | 47.5 % | 32.9 % – 62.5 % | 2.5 pts | assumé |
| RH | DIRECTION | 40 | 20 | 19 | 1 | 51.3 % | 36.2 % – 66.1 % | 1.3 pts | assumé |
| RH | SYNDICAT | 40 | 13 | 24 | 3 | 35.1 % | 21.8 % – 51.2 % | 14.9 pts | assumé (hors bande, sous 15 points) |
| RH | INTERIM | 40 | 11 | 13 | 16 | 45.8 % | 27.9 % – 64.9 % | 4.2 pts | assumé |
| RH | SUPPORT | 40 | 5 | 15 | 20 | 25.0 % | 11.2 % – 46.9 % | 25.0 pts | **à corriger avant la beta** |
| ATELIER | DIRECTION | 40 | 22 | 16 | 2 | 57.9 % | 42.2 % – 72.1 % | 7.9 pts | assumé |
| ATELIER | SYNDICAT | 40 | 21 | 16 | 3 | 56.8 % | 40.9 % – 71.3 % | 6.8 pts | assumé |
| ATELIER | INTERIM | 40 | 13 | 19 | 8 | 40.6 % | 25.5 % – 57.7 % | 9.4 pts | assumé |
| ATELIER | SUPPORT | 40 | 17 | 3 | 20 | 85.0 % | 64.0 % – 94.8 % | 35.0 pts | **à corriger avant la beta** |
| DIRECTION | SYNDICAT | 40 | 17 | 18 | 5 | 48.6 % | 33.0 % – 64.4 % | 1.4 pts | assumé |
| DIRECTION | INTERIM | 40 | 16 | 1 | 23 | 94.1 % | 73.0 % – 99.0 % | 44.1 pts | **à corriger avant la beta** |
| DIRECTION | SUPPORT | 40 | 16 | 4 | 20 | 80.0 % | 58.4 % – 91.9 % | 30.0 pts | **à corriger avant la beta** |
| SYNDICAT | INTERIM | 40 | 13 | 5 | 22 | 72.2 % | 49.1 % – 87.5 % | 22.2 pts | **à corriger avant la beta** |
| SYNDICAT | SUPPORT | 40 | 16 | 4 | 20 | 80.0 % | 58.4 % – 91.9 % | 30.0 pts | **à corriger avant la beta** |
| INTERIM | SUPPORT | 40 | 15 | 16 | 9 | 48.4 % | 32.0 % – 65.2 % | 1.6 pts | assumé |

### Écarts de plus de 15.0 pts

- **QVT / INTERIM** — 50.0 pts d'écart (0–13, 27 nulle(s)) : à corriger avant la beta.
- **QVT / SUPPORT** — 50.0 pts d'écart (0–19, 21 nulle(s)) : à corriger avant la beta.
- **DIRECTION / INTERIM** — 44.1 pts d'écart (16–1, 23 nulle(s)) : à corriger avant la beta.
- **SSE / SUPPORT** — 39.3 pts d'écart (3–25, 12 nulle(s)) : à corriger avant la beta.
- **ATELIER / SUPPORT** — 35.0 pts d'écart (17–3, 20 nulle(s)) : à corriger avant la beta.
- **SSE / INTERIM** — 34.2 pts d'écart (3–16, 21 nulle(s)) : à corriger avant la beta.
- **AMELIORATION / INTERIM** — 30.0 pts d'écart (16–4, 20 nulle(s)) : à corriger avant la beta.
- **DIRECTION / SUPPORT** — 30.0 pts d'écart (16–4, 20 nulle(s)) : à corriger avant la beta.
- **SYNDICAT / SUPPORT** — 30.0 pts d'écart (16–4, 20 nulle(s)) : à corriger avant la beta.
- **MANAGEMENT / INTERIM** — 27.8 pts d'écart (14–4, 22 nulle(s)) : à corriger avant la beta.
- **RH / SUPPORT** — 25.0 pts d'écart (5–15, 20 nulle(s)) : à corriger avant la beta.
- **SYNDICAT / INTERIM** — 22.2 pts d'écart (13–5, 22 nulle(s)) : à corriger avant la beta.
