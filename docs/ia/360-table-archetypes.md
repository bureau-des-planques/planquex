# La table des archétypes, mesurée (#360, D-134 (2))

**Date de la mesure : 28/10/2026.** Document de **mesure**, pas une décision : les actes sont
dans `docs/DECISIONS.md` (D-134 (2)), les chiffres vivent ici, et rien n'a été corrigé pour
obtenir cette table — « on mesure, puis on décide ».

## Le protocole, fixé d'avance

| Point | Valeur |
|---|---|
| Commande | `npm run mesure:archetypes` (markdown) · `-- --json` pour le rapport complet |
| Code | `src/game/mesure-archetypes.ts`, gardé par `src/game/mesure-archetypes.test.ts` |
| Graine maîtresse | **20261029** — disjointes des graines du pesage (#111 : `1, 7, 42, 11, 23`, `99, 1234, 2024, 777, 31337`) et de la mesure de la Direction (#354, graine `20261028`) |
| Parties | **40 par paire**, en **miroir** : chaque affrontement joue les deux sièges à graine et Decks identiques, donc 20 parties par siège et l'avantage du premier joueur s'annule |
| Total | **45 affrontements × 40 = 1 800 parties** |
| Archétypes | les **Decks proposés** (`factionDeck`, un Deck de 20 cartes par faction, #352), pas une liste écrite à la main |
| Politique | **scriptée** des deux côtés (`nextAction(state, 1)`, niveau 1) : une table d'archétypes mesure des **Decks**, pas l'asymétrie de deux politiques. C'est aussi la politique du simulateur historique |
| Bande | **40 – 60 %** d'un affrontement (D-134 (2)) |
| Seuil d'alerte | **plus de 15 points** d'écart à 50 % → « à corriger avant la beta ». 15,0 points est encore assumé, le dépassement est strict |
| Intervalle | **Wilson à 95 %** sur les parties **décidées** (les nulles ne comptent ni pour ni contre) |

**Reproductibilité** : deux lancements à la graine par défaut donnent la table **octet pour
octet** (aucun horodatage, aucun ordre de `Map`). C'est ce que vérifie le test de
`mesure-archetypes.test.ts`.

**Le contrôle mord** : `ecartAlerte(0,66)` est **vrai** (16 points), `ecartAlerte(0,64)` est
**faux** (14 points). Sans lui, un seuil réglé à 60 points passerait les mêmes tests verts.

**#352 a changé le contenu de deux factions** (dix noms de base par faction au lieu de huit en
moyenne) : cette table est mesurée **après** #352, sur `main` au commit de fusion de #398. Une
table antérieure à #352 ne décrit plus les mêmes Decks et ne doit pas être citée.

## Ce que la table dit

- **Neuf archétypes sur dix sont dans la bande** sur l'ensemble de leurs affrontements :
  SSE 49,2 %, MANAGEMENT 53,4 %, QVT 45,7 %, AMELIORATION 56,5 %, RH 48,2 %, ATELIER 54,5 %,
  DIRECTION 53,5 %, SYNDICAT 56,3 %, et INTERIM 41,6 % (juste au-dessus du plancher de 40 %,
  IC 34,0 – 49,6 % — donc à la limite basse de la bande).
- **Un archétype est hors bande : SUPPORT (27,5 %**, IC 21,5 – 34,4 %). Il ne gagne **aucune**
  partie décidée contre MANAGEMENT, AMELIORATION, ATELIER et SYNDICAT, et une seule contre
  DIRECTION : ses affrontements se terminent souvent en **nulles à la limite** (20 à 32 sur
  40), ce qui dit la même chose autrement — le Deck ne conclut pas. INTERIM (41,6 %) est dans
  la bande mais son IC descend à 34 % : c'est le second signal, pas une seconde alerte.
- **Douze affrontements dépassent 15 points d'écart**, et **tous** impliquent SUPPORT ou
  INTERIM. Ce sont eux qui portent l'alerte ; les 33 autres affrontements sont à 15 points ou
  moins de l'équilibre.

### Les écarts assumés, avec leur raison

Les écarts **sous** 15 points sont assumés, et leur raison est écrite une fois pour toutes :

- **SSE/INTERIM (12,5 pts), SSE/SUPPORT (13,3), RH/SYNDICAT (14,9), RH/SUPPORT (15,0)** — un
  affrontement à 40 parties a un IC à 95 % de ±12 à ±18 points : ces écarts sont **dans le
  bruit** de l'échantillon, pas dans les cartes. Les relever demanderait plus de parties, pas une
  correction de contenu ; c'est un ticket de mesure, pas d'équilibrage.
- Les affrontements **sans alerte** entre les huit archétypes « pleins » (0,0 à 9,0 points)
  sont l'état normal d'un jeu à trois Interventions : la partie se joue sur la pioche et le
  premier joueur, et 40 parties ne distinguent pas 5 points d'écart d'une variance.

### À corriger avant la beta (12 affrontements)

| Affrontement | Écart | Parties décidées | Nulles |
|---|---:|---:|---:|
| AMELIORATION / SUPPORT | 50,0 pts (20–0) | 20 | 20 |
| ATELIER / SUPPORT | 50,0 pts (20–0) | 20 | 20 |
| MANAGEMENT / SUPPORT | 50,0 pts (20–0) | 20 | 20 |
| QVT / SUPPORT | 50,0 pts (0–17) | 17 | 23 |
| SYNDICAT / SUPPORT | 50,0 pts (18–0) | 18 | 22 |
| DIRECTION / SUPPORT | 44,7 pts (18–1) | 19 | 21 |
| DIRECTION / INTERIM | 43,8 pts (15–1) | 16 | 24 |
| QVT / INTERIM | 37,5 pts (1–7) | 8 | 32 |
| SYNDICAT / INTERIM | 35,7 pts (12–2) | 14 | 26 |
| MANAGEMENT / INTERIM | 34,6 pts (11–2) | 13 | 27 |
| AMELIORATION / INTERIM | 27,8 pts (14–4) | 18 | 22 |
| INTERIM / SUPPORT | 16,7 pts (12–6) | 18 | 22 |

**Ce que ce n'est pas** : une liste de corrections. Le ticket #360 ne touche ni carte ni règle
(D-134). Deux pistes se lisent dans les chiffres et relèvent d'un ticket **décidé**, pas d'un
ajustement opportuniste :

1. **SUPPORT et INTERIM sont les deux archétypes que le simulateur doit armer à la main**
   (`SIMULATION_CAFE_TYPES`, #113) : leurs Pressions ne sont pas payables par la dérivation du
   Deck. Une table qui les compte à 27,5 % et 41,6 % mesure donc aussi **l'armement du
   harnais** : avant de corriger leurs cartes, il faut vérifier que le Deck joué est celui qu'un
   testeur peut réellement construire (mêmes types de café, mêmes cartes).
2. **Le nombre de nulles** (20 à 32 sur 40 sur ces affrontements) est le symptôme principal :
   ce n'est pas « SUPPORT perd », c'est « SUPPORT **n'arrive pas à conclure** ». Une correction
   de dégâts ou de coûts se déciderait sur cette lecture-là.

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
| SSE | 360 | 145 | 295 | 49.2 % | 43.5 % – 54.8 % | dans la bande |
| MANAGEMENT | 360 | 167 | 313 | 53.4 % | 47.8 % – 58.8 % | dans la bande |
| QVT | 360 | 127 | 278 | 45.7 % | 39.9 % – 51.6 % | dans la bande |
| AMELIORATION | 360 | 174 | 308 | 56.5 % | 50.9 % – 61.9 % | dans la bande |
| RH | 360 | 144 | 299 | 48.2 % | 42.6 % – 53.8 % | dans la bande |
| ATELIER | 360 | 174 | 319 | 54.5 % | 49.1 % – 59.9 % | dans la bande |
| DIRECTION | 360 | 159 | 297 | 53.5 % | 47.9 % – 59.1 % | dans la bande |
| SYNDICAT | 360 | 162 | 288 | 56.3 % | 50.5 % – 61.9 % | dans la bande |
| INTERIM | 360 | 62 | 149 | 41.6 % | 34.0 % – 49.6 % | dans la bande |
| SUPPORT | 360 | 50 | 182 | 27.5 % | 21.5 % – 34.4 % | **hors bande** |

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
| SSE | INTERIM | 40 | 6 | 10 | 24 | 37.5 % | 18.5 % – 61.4 % | 12.5 pts | assumé (hors bande, sous 15 points) |
| SSE | SUPPORT | 40 | 11 | 19 | 10 | 36.7 % | 21.9 % – 54.5 % | 13.3 pts | assumé (hors bande, sous 15 points) |
| MANAGEMENT | QVT | 40 | 17 | 23 | 0 | 42.5 % | 28.5 % – 57.8 % | 7.5 pts | assumé |
| MANAGEMENT | AMELIORATION | 40 | 19 | 21 | 0 | 47.5 % | 32.9 % – 62.5 % | 2.5 pts | assumé |
| MANAGEMENT | RH | 40 | 20 | 20 | 0 | 50.0 % | 35.2 % – 64.8 % | 0.0 pts | assumé |
| MANAGEMENT | ATELIER | 40 | 21 | 19 | 0 | 52.5 % | 37.5 % – 67.1 % | 2.5 pts | assumé |
| MANAGEMENT | DIRECTION | 40 | 21 | 19 | 0 | 52.5 % | 37.5 % – 67.1 % | 2.5 pts | assumé |
| MANAGEMENT | SYNDICAT | 40 | 18 | 22 | 0 | 45.0 % | 30.7 % – 60.2 % | 5.0 pts | assumé |
| MANAGEMENT | INTERIM | 40 | 11 | 2 | 27 | 84.6 % | 57.8 % – 95.7 % | 34.6 pts | **à corriger avant la beta** |
| MANAGEMENT | SUPPORT | 40 | 20 | 0 | 20 | 100.0 % | 83.9 % – 100.0 % | 50.0 pts | **à corriger avant la beta** |
| QVT | AMELIORATION | 40 | 20 | 20 | 0 | 50.0 % | 35.2 % – 64.8 % | 0.0 pts | assumé |
| QVT | RH | 40 | 17 | 15 | 8 | 53.1 % | 36.4 % – 69.1 % | 3.1 pts | assumé |
| QVT | ATELIER | 40 | 19 | 20 | 1 | 48.7 % | 33.9 % – 63.8 % | 1.3 pts | assumé |
| QVT | DIRECTION | 40 | 20 | 20 | 0 | 50.0 % | 35.2 % – 64.8 % | 0.0 pts | assumé |
| QVT | SYNDICAT | 40 | 15 | 18 | 7 | 45.5 % | 29.8 % – 62.0 % | 4.5 pts | assumé |
| QVT | INTERIM | 40 | 1 | 7 | 32 | 12.5 % | 2.2 % – 47.1 % | 37.5 pts | **à corriger avant la beta** |
| QVT | SUPPORT | 40 | 0 | 17 | 23 | 0.0 % | 0.0 % – 18.4 % | 50.0 pts | **à corriger avant la beta** |
| AMELIORATION | RH | 40 | 20 | 18 | 2 | 52.6 % | 37.3 % – 67.5 % | 2.6 pts | assumé |
| AMELIORATION | ATELIER | 40 | 19 | 21 | 0 | 47.5 % | 32.9 % – 62.5 % | 2.5 pts | assumé |
| AMELIORATION | DIRECTION | 40 | 18 | 17 | 5 | 51.4 % | 35.6 % – 67.0 % | 1.4 pts | assumé |
| AMELIORATION | SYNDICAT | 40 | 23 | 16 | 1 | 59.0 % | 43.4 % – 72.9 % | 9.0 pts | assumé |
| AMELIORATION | INTERIM | 40 | 14 | 4 | 22 | 77.8 % | 54.8 % – 91.0 % | 27.8 pts | **à corriger avant la beta** |
| AMELIORATION | SUPPORT | 40 | 20 | 0 | 20 | 100.0 % | 83.9 % – 100.0 % | 50.0 pts | **à corriger avant la beta** |
| RH | ATELIER | 40 | 19 | 21 | 0 | 47.5 % | 32.9 % – 62.5 % | 2.5 pts | assumé |
| RH | DIRECTION | 40 | 20 | 19 | 1 | 51.3 % | 36.2 % – 66.1 % | 1.3 pts | assumé |
| RH | SYNDICAT | 40 | 13 | 24 | 3 | 35.1 % | 21.8 % – 51.2 % | 14.9 pts | assumé (hors bande, sous 15 points) |
| RH | INTERIM | 40 | 11 | 9 | 20 | 55.0 % | 34.2 % – 74.2 % | 5.0 pts | assumé |
| RH | SUPPORT | 40 | 13 | 7 | 20 | 65.0 % | 43.3 % – 81.9 % | 15.0 pts | assumé (hors bande, sous 15 points) |
| ATELIER | DIRECTION | 40 | 22 | 16 | 2 | 57.9 % | 42.2 % – 72.1 % | 7.9 pts | assumé |
| ATELIER | SYNDICAT | 40 | 21 | 16 | 3 | 56.8 % | 40.9 % – 71.3 % | 6.8 pts | assumé |
| ATELIER | INTERIM | 40 | 11 | 15 | 14 | 42.3 % | 25.5 % – 61.1 % | 7.7 pts | assumé |
| ATELIER | SUPPORT | 40 | 20 | 0 | 20 | 100.0 % | 83.9 % – 100.0 % | 50.0 pts | **à corriger avant la beta** |
| DIRECTION | SYNDICAT | 40 | 17 | 18 | 5 | 48.6 % | 33.0 % – 64.4 % | 1.4 pts | assumé |
| DIRECTION | INTERIM | 40 | 15 | 1 | 24 | 93.8 % | 71.7 % – 98.9 % | 43.8 pts | **à corriger avant la beta** |
| DIRECTION | SUPPORT | 40 | 18 | 1 | 21 | 94.7 % | 75.4 % – 99.1 % | 44.7 pts | **à corriger avant la beta** |
| SYNDICAT | INTERIM | 40 | 12 | 2 | 26 | 85.7 % | 60.1 % – 96.0 % | 35.7 pts | **à corriger avant la beta** |
| SYNDICAT | SUPPORT | 40 | 18 | 0 | 22 | 100.0 % | 82.4 % – 100.0 % | 50.0 pts | **à corriger avant la beta** |
| INTERIM | SUPPORT | 40 | 12 | 6 | 22 | 66.7 % | 43.7 % – 83.7 % | 16.7 pts | **à corriger avant la beta** |

### Écarts de plus de 15.0 pts

- **AMELIORATION / SUPPORT** — 50.0 pts d'écart (20–0, 20 nulle(s)) : à corriger avant la beta.
- **ATELIER / SUPPORT** — 50.0 pts d'écart (20–0, 20 nulle(s)) : à corriger avant la beta.
- **MANAGEMENT / SUPPORT** — 50.0 pts d'écart (20–0, 20 nulle(s)) : à corriger avant la beta.
- **QVT / SUPPORT** — 50.0 pts d'écart (0–17, 23 nulle(s)) : à corriger avant la beta.
- **SYNDICAT / SUPPORT** — 50.0 pts d'écart (18–0, 22 nulle(s)) : à corriger avant la beta.
- **DIRECTION / SUPPORT** — 44.7 pts d'écart (18–1, 21 nulle(s)) : à corriger avant la beta.
- **DIRECTION / INTERIM** — 43.8 pts d'écart (15–1, 24 nulle(s)) : à corriger avant la beta.
- **QVT / INTERIM** — 37.5 pts d'écart (1–7, 32 nulle(s)) : à corriger avant la beta.
- **SYNDICAT / INTERIM** — 35.7 pts d'écart (12–2, 26 nulle(s)) : à corriger avant la beta.
- **MANAGEMENT / INTERIM** — 34.6 pts d'écart (11–2, 27 nulle(s)) : à corriger avant la beta.
- **AMELIORATION / INTERIM** — 27.8 pts d'écart (14–4, 22 nulle(s)) : à corriger avant la beta.
- **INTERIM / SUPPORT** — 16.7 pts d'écart (12–6, 22 nulle(s)) : à corriger avant la beta.
