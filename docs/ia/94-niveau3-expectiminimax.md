# Niveau 3 — expectiminimax + déterminisations (ticket #94)

*Date : 26/10/2026 · Branche : `94-ia-niveau3` · Base : `integration/alpha-2026-10-26`
`d3dc392` · Code : `src/game/ia.ts` (`expectiminimaxDecision`,
`nextExpectiminimaxAction`, `DEFAULT_EXPECTIMINIMAX_OPTIONS`) · Tests :
`src/game/ia-expectiminimax.test.ts`*

Ce journal consigne **la mesure** du niveau 3, pas une décision : `docs/JEU.md` §4 et
`docs/DECISIONS.md` restent seuls juges. Le niveau 3 n'est **pas** branché : ni l'écran ni
le simulateur ne le jouent, et le défaut reste le niveau 2 (D-084).

## 1. Verdict

**Le niveau 3 bat le niveau 2 sur les graines de contrôle, une seule fois lancées.** Sur
les 5 graines de contrôle (99, 1234, 2024, 777, 31337), 100 parties par graine et par
siège (1 000 parties, miroir apparié) : **466 victoires contre 367**, 167 nulles, soit
**55,94 %** des parties décidées (833), ratio **1,270**, intervalle de confiance à 95 %
**[52,57 ; 59,31] %**. Les deux seuils décidés d'avance (≥ 55 % et ≥ 1,15 ×) sont franchis.

La marge n'est **pas** confortable : l'entraînement donnait 55,10 %, et l'intervalle du
contrôle descend à 52,6 %. C'est une supériorité **mesurée dans le harnais**, pas une
promesse.

## 2. Ce qui a été construit

`src/game/ia.ts`, **ajout seulement** — `nextAction`, `nextAiAction`,
`searchDecision`, `evaluatePosition` et leurs poids sont inchangés :

- **`expectiminimaxDecision(state, options)`** — la décision, avec son compte de nœuds et
  son drapeau de repli ; `nextExpectiminimaxAction` en est l'entrée « politique ».
- **Nœuds** : `max` sur mes coups, `min` sur ceux de l'adversaire, **espérance** sur les
  **K déterminisations** (`expectiminimaxWorlds` → `sampleWorld`) et sur
  `chanceSamples` tirages **seedés** au dernier pli (`chanceTurnValue`).
- **Un pli = un tour** : le coup élu, puis le reste du tour par la politique scriptée
  (`playOutTurn`) — la structure du niveau 2, avec un pli de plus.
- **Profondeur et K réglables** (`depth`, `candidates`, `replies`, `followups`, `worlds`,
  `chanceSamples`), budget de **nœuds** et **échéance murale**, repli sur la **recherche à
  deux coups** (`nextSearchAction`) — pas sur le glouton : un niveau 3 à court de budget ne
  doit pas jouer moins bien que le niveau 2 qu'il remplace.
- **Information cachée** : la recherche ne lit que les **comptes** de la main et du Deck
  adverses ; les cartes sont tirées dans `unknownPool`. Aucun `Math.random()`, aucun
  `state.rng` (tirages par `searchSeed` / `chanceSeed`).

Idées sourcées, **aucun code copié** : expectiminimax / PIMC
(`docs/ia/111-recherche-pistes.md` §2–3, Long et al. 2020), `deckgym-core`
(**AGPL-3.0 — idées seules**) et le projet Kaggle *Pokémon TCG AI Battle* (**MIT — idées
seules**). Réécriture TypeScript contre les types du dépôt.

## 3. Protocole (décidé avant le contrôle)

- **Entraînement** : graines 1, 7, 42, 11, 23 — 60 parties par graine et par siège.
- **Contrôle** : graines 99, 1234, 2024, 777, 31337 — 100 parties par graine et par
  siège, **un seul lancement**.
- **Seuil** (celui de #111, inchangé) : ≥ **55 %** des décidées **et** ≥ **1,15 ×**.
- **Règle de choix** : parmi les variantes qui tiennent le budget du niveau 2 (800 nœuds,
  60 ms), le meilleur taux d'entraînement.
- **Mesure déterministe** : les deux gardes de **temps** sont neutralisées
  (`--ms Infinity --n3-ms Infinity`) pour que la charge machine ne change pas les coups ;
  seul le plafond de **nœuds** reste actif.

## 4. Les variantes (entraînement seul)

| Variante | Prof. | cand. | rép. | suites | mondes | hasard | Nœuds moy. | Niveau 3 | Niveau 2 | Nulles | Décidées | Taux | Ratio | Tient |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| **A** (défauts) | 3 | 3 | 2 | 2 | 2 | 2 | ~390 | **281** | 229 | 90 | 510 | **55,10 %** | **1,227** | **oui** |
| B | 3 | 3 | 2 | 2 | 3 | 2 | ~580 | 276 | 234 | 90 | 510 | 54,12 % | 1,179 | non |
| C (écartée **avant** mesure) | 3 | 4 | 3 | 2 | 3 | 2 | ~1 100 | — | — | — | — | — | — | budget |

- A et B : mêmes graines, mêmes parties ; seul `worlds` change.
- **C** a été écartée sur le **budget**, pas sur un résultat : ~1 100 nœuds par décision
  (mesurés sur 18 positions réelles), soit au-delà des 800 nœuds du niveau 2 ; elle se
  replierait sur le niveau 2 un coup sur deux. Aucun contrôle n'a été consommé pour elle.
- Un **pilote** (3 graines × 30 parties) avait donné 65,1 % avant que je neutralise la
  garde de temps de l'**adversaire** : sous charge, le niveau 2 se repliait sur le glouton,
  donc le pilote mesurait un adversaire plus faible. **Il n'est pas un résultat** et n'a
  servi qu'à vérifier le harnais.

## 5. Contrôle — un seul lancement

```bash
node scripts/pesage.mjs --seeds 99,1234,2024,777,31337 --games 100 --json \
  --direction niveau3 --adversaire recherche --ms Infinity --n3-ms Infinity
```

`exit 0`. Un seul lancement sur les graines de contrôle.

| Jeu | Niveau 3 | Niveau 2 | Nulles | Décidées | Taux | IC 95 % | Ratio | Tient |
|---|---:|---:|---:|---:|---|---:|---|---|
| Entraînement (A) | 281 | 229 | 90 | 510 | 55,10 % | 50,78 – 59,41 % | 1,227 | oui |
| **Contrôle** | **466** | **367** | 167 | 833 | **55,94 %** | **52,57 – 59,31 %** | **1,270** | **oui** |

Par graine, contrôle (niveau 3 / niveau 2 / nulles) : 99 → 90/69/41 · 1234 → 92/69/39 ·
2024 → 92/74/34 · 777 → 98/75/27 · 31337 → 94/80/26.

## 6. Coût

| Mesure (contrôle, 31 905 décisions) | Moyenne | p50 | p95 | p99 | Max | Replis budget |
|---|---:|---:|---:|---:|---:|---:|
| Niveau 3 (A) | 34,55 ms | 23,03 | 125,7 | 222,0 | 517,3 | **0** |

**Lecture prudente.** Ces temps sont mesurés **sous forte contention** (charge machine
11–16 sur 12 cœurs pendant la campagne : d'autres processus tournaient). Le travail réel
est **~390 nœuds** par décision, et la corrélation nœuds/durée du niveau 2 (~0,058 ms/nœud
sur machine calme, journal #172) donnerait ~23 ms — cohérent avec le p50. Le **p99** est
donc **gonflé par la charge**, pas par le travail. Le plafond de nœuds n'a **jamais** mordu
(`replisBudget: 0`) ; la garde de 60 ms, elle, mordrait sous cette charge et replierait sur
le niveau 2 — un niveau 3 branché un jour devra être remesuré **seul et au calme**, comme
le niveau 2 l'a été.

## 7. Limites — à lire avant toute conclusion

1. **Adversaire modélisé = politique scriptée.** Comme le niveau 2 : la suite d'un tour
   adverse est `nextAction(…, 1)`, et seules ses `replies` premières actions sont prises en
   minimum. La mesure oppose deux politiques qui **partagent** ce modèle.
2. **Pool uniforme** sur le catalogue (`unknownPool`) : les déterminisations ne savent pas
   quelles factions l'adversaire joue. C'est honnête (rien d'interdit n'est lu), mais
   grossier — c'est aussi ce que le journal du niveau 2 signalait.
3. **Hasard au dernier pli seulement.** Un nœud de hasard à chaque frontière de tour
   multipliait le coût par `chanceSamples` à chaque profondeur (~2 700 nœuds mesurés pour
   `chanceSamples: 2` en profondeur 3) : l'espérance est donc portée par les K
   déterminisations plus haut, et par `chanceSamples` au dernier pli.
4. **Un pli = un tour.** La recherche voit 3 tours, pas la partie entière.
5. **Nulles exclues** : 16,7 % des parties du contrôle (`--max-turns 200`), comme dans les
   mesures du niveau 2.
6. **Non vérifié** : contre un humain, contre un adversaire qui n'est pas le niveau 2, à
   l'écran (le niveau 3 n'y est pas branché), et le budget au calme.
7. **`AGENTS.md` §6 n'a pas été modifié** : c'est un document d'autorité, la consigne du
   poste de travail interdit d'y toucher. Il dit encore « deux niveaux » ; le niveau 3 est
   **expérimental et hors défaut**, et devra y être consigné par une session habilitée.

## 8. Commandes et sorties (état committé)

```text
$ npm run check        → exit 0
$ npm test             → exit 0 (voir le rapport de la session)
$ npm run garde-fous   → exit 0
$ npm run build        → exit 0 (dist/index.html et dist/sw.js produits)
$ node scripts/pesage.mjs --seeds 99,1234,2024,777,31337 --games 100 --json --direction niveau3 --adversaire recherche --ms Infinity --n3-ms Infinity
                       → exit 0 (contrôle : 1 lancement ; voir §5)
```
