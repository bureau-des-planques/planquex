# Essais d'IA — journal pour le niveau 3

*Date : 22/10/2026 · Branche : `ia-niveau2-recherche` (worktree `/tmp/opencode/wt-ia3`) · Base : `dev` 9c49b47*

Ce journal consigne la **recherche à deux coups** (piste 2 de `docs/ia/111-recherche-pistes.md`), essayée après l'échec de la piste 1 (`docs/ia/111-essais-evaluation.md`, branche `ia-niveau2-essais`, contrôle à 43,68 %). Il sert au **niveau 3** (PIMC, déterminisations) : il dit ce qui a marché, ce qui est réutilisable, et les pièges.

> **Base des mesures : `9c49b47`.** `origin/dev` a depuis avancé de 14 commits (`dd04694`, mécaniques du moteur #159–#165 : `pendingChoice` et l'action `choose`, chercher et regarder dans le Deck, révélations). **Les mesures de ce journal valent pour `9c49b47`, pas pour `dev` actuel.** La branche n'a pas été rebasée, pour que le contrôle reste celui qui a été lancé. Vérification sur `dev` + cette branche (fusion temporaire, non committée) : `tsc -b` exit 0, **74 fichiers, 845 tests passent**, dont 24 tests d'IA. **Rien n'a été remesuré sur ce `dev`** : le contrôle est déjà consommé, et les nouvelles règles de caché (révélations, Deck) n'ont pas été prises en compte par `sampleWorld`.

> **Statut.** Expérimental. La recherche **n'est branchée nulle part** dans l'écran ni dans `nextAction` : le niveau 2 (`nextAction(state, 2)`, référence #93/#111) et le niveau 1 (défaut de l'écran) sont **inchangés**. Rien n'est fusionné.

## 1. Verdict

**Passe le protocole, avec une réserve majeure.** Sur le **contrôle** (graines 99, 1234, 2024, 777, 31337), lancé **une seule fois** : **60,74 %** des parties décidées (509 victoires contre 329, 162 nulles), ratio **1,547**, IC 95 % **[57,4 ; 64,0] %**. Les deux seuils (≥ 55 % et ≥ 1,15) sont franchis.

**La réserve** (§7) : l'adversaire que la recherche **modélise** est la politique scriptée du niveau 1, et la mesure n'est faite **que contre le niveau 1**. Le gain est donc un résultat **dans le harnais**, contre une politique connue. Il n'est pas démontré contre un adversaire humain, ni contre le niveau 2.

## 2. Ce qui a été touché

| Fichier | Changement |
|---|---|
| `src/game/ia.ts` | **Ajout seulement** : `nextSearchAction`, `unknownPool`, `sampleWorld` (exporté pour le test), `playOutTurn`, `lineValue`, `scoreMoves`, `SearchOptions`, `DEFAULT_SEARCH_OPTIONS`. `nextAction`, `nextAiAction`, `evaluatePosition` et leurs poids : **inchangés**. |
| `src/game/ia-recherche.test.ts` | **Nouveau** : 8 tests (légalité, déterminisme, non-altération, équité). |
| `scripts/pesage.mjs` | Option `--direction recherche` (+ `--candidats`, `--mondes`, `--reponses`, `--en-processus`). Le **chemin par défaut** (CLI du simulateur) est inchangé ; la sortie JSON gagne 4 champs (`direction`, `coupsRecherche`, `msParCoup`, `msMaxCoup`). |
| `docs/ia/111-essais-recherche-2-coups.md` | Ce journal. |

Non touchés : `src/game/engine.ts`, les règles, `src/game/simulation.ts`, le niveau 1, `AGENTS.md`, `docs/DECISIONS.md`.

**Écart à la consigne, à signaler** : la consigne demandait une « option » de `pesage.mjs`. Il a fallu davantage : le simulateur (`simulate()`) n'accepte que les niveaux 1 et 2, donc la recherche est jouée **en processus** par `executerEnProcessus`, qui **reproduit** le protocole du simulateur (graine maîtresse, `pairFactions`, `drawRandom`) et ne change que la politique. Sa fidélité est vérifiée (§6.1).

## 3. La recherche (`nextSearchAction`)

Pour une décision de `who` (la Direction, ou le joueur au siège B) :

1. **Élagage à un coup** : chaque action légale (hors forfait) est notée comme le niveau 2 (`evaluatePosition` + `endTurnBonus` sur la fin de tour). On garde les `candidates` meilleures.
2. **Mondes** : pour chaque candidat, `worlds` mondes. Un monde = la position réelle, où **la main et le Deck de l'adversaire sont remplacés** par un tirage dans le pool (§4).
3. **Mon tour** : le candidat, puis mon tour terminé par la **politique scriptée** (`nextAction(…, 1)`).
4. **Tour adverse** : parmi ses coups légaux dans le monde, les `replies` plus nocifs à un coup (notés pour moi) sont joués **en entier** (premier coup + politique scriptée jusqu'à sa fin de tour). L'adversaire prend le **pire** pour moi (minimum).
5. **Feuille** : `evaluatePosition` au début de mon prochain tour (pas de bonus de fin de tour : la pioche est faite). Une partie finie vaut ±1 000 000 + l'évaluation.
6. Le coup retenu maximise la **moyenne** des valeurs sur les mondes. À égalité : le premier de l'élagage (déterministe).

**Pourquoi « au niveau du tour »** : une Pression, une fin de tour ou une relève ne rendent pas la main à l'adversaire à chaque action. Un « coup » de la Direction n'est donc pas suivi d'un coup adverse : la réponse est un **tour adverse entier**.

## 4. Protocole d'équité (règle centrale)

**Ce que la décision lit de l'adversaire** : uniquement des **comptes** (`hand.length`, `deck.length`) et ses **champs publics** (Postes, Bancs, défausse, points, Machine).

**Ce qu'elle ne lit jamais** : le **contenu** de sa main et de son Deck, ni son ordre de pioche.

**Le pool des cartes inconnues** (`unknownPool`, vu du camp `who`) : chaque carte du catalogue, à `MAX_COPIES_PER_NAME` = 2 exemplaires, **moins** les cartes que `who` voit : sa main, son Deck, les Postes et Bancs des **deux** camps, les défausses des **deux** camps. Il reste exactement ce que l'adversaire peut tenir. Ordre : celui de `ALL_CARDS` (déterministe).
- Approximation assumée : la règle des exemplaires est **par nom** (`deck.ts`), le pool la compte **par identifiant**.
- Le pool **ne lit pas** la main ni le Deck de l'adversaire (test `le pool des cartes inconnues…`).

**Les tirages** : `sampleWorld` tire la main et le Deck adverses dans le pool, sans remise (Fisher–Yates partiel), avec un générateur **seedé** dérivé de `state.seed` (graine d'origine de la partie) et de `state.turn` — **jamais** de `state.rng`. Les mondes et les suites jouent avec leur propre sous-graine. Raison : comme en #114, la politique ne doit pas consommer le flux réel (elle ne doit pas pouvoir deviner un lancer réel). Aucun `Math.random()`, aucun uid pris dans le compteur global du moteur (uids explicites `w<k>h<i>` / `w<k>d<i>`).

**Vérification** :
- lecture du code : `grep` sur `.hand`, `.deck`, `state.rng` dans `src/game/ia.ts` ne montre que `me.hand`, `me.deck` (mes cartes, pool), `hidden.hand.length` / `hidden.deck.length` (comptes), et des commentaires ;
- test `le monde tiré ne reprend jamais la main ni le Deck réels de l'adversaire` : une main adverse remplacée ne change **pas** le contenu des mondes. **Mutation vérifiée** : si le monde reprend la vraie main (`const hand = hidden.hand`), ce test **échoue** ; le code réel passe (8/8).

## 5. Les essais (entraînement seul, puis un contrôle)

Protocole : **entraînement** graines 1, 7, 42, 11, 23 — **100 parties par graine** (200 par graine avec les deux sièges), miroir apparié. **Contrôle** : 99, 1234, 2024, 777, 31337. Au **plus 3 variantes**. Les réglages ont été choisis sur l'entraînement ; le contrôle n'a servi qu'à juger le candidat retenu.

| Variante | `candidates` | `worlds` | `replies` | Niveau 2 | Niveau 1 | Nulles | Décidées | Ratio | Temps moy. / max (3 runs **en parallèle**) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| **V0** (défaut) | 6 | 3 | 4 | 520 | 329 | 151 | **61,25 %** | **1,581** | 14,3 ms / 185 ms |
| V1 | 6 | 6 | 4 | 520 | 332 | 148 | 61,03 % | 1,566 | 27,6 ms / 318 ms |
| V2 | 10 | 3 | 8 | 519 | 326 | 155 | 61,42 % | 1,592 | 25,4 ms / 206 ms |

Référence (niveau 2 actuel, #111, graines d'entraînement) : 359 / 463 / 178, soit 43,67 %, ratio 0,775 — **non rejouée ici**, chiffre de `docs/ia/111-mesure.md`.

**Lecture des essais** :
- Les trois variantes donnent le **même niveau** (61,0 à 61,4 %) : l'écart (0,4 pt) est dans le bruit (IC 95 % ≈ ±3,3 pt). Le nombre de mondes et de réponses ne change pas le verdict.
- Le **coût** varie du simple au double : V2 (10 candidats, 8 réponses) n'est pas tenable dans le budget (§6.2).
- **Règle de choix**, annoncée avant le contrôle et appliquée sur l'entraînement seul : parmi les variantes qui tiennent le budget (p99 < 100 ms), le meilleur ratio d'entraînement. **V0** (1,581) contre V1 (1,566, plus lente). V2 est écartée pour le budget, non pour son résultat.

**Commandes exactes** (une par variante, lancées en parallèle, donc les temps sont **gonflés**) :

```bash
node scripts/pesage.mjs --seeds 1,7,42,11,23 --games 100 --json --direction recherche --candidats 6 --mondes 3 --reponses 4   # V0
node scripts/pesage.mjs --seeds 1,7,42,11,23 --games 100 --json --direction recherche --candidats 6 --mondes 6 --reponses 4   # V1
node scripts/pesage.mjs --seeds 1,7,42,11,23 --games 100 --json --direction recherche --candidats 10 --mondes 3 --reponses 8  # V2
```

### Contrôle — **un seul lancement**

Le candidat V0 est lancé **une fois** sur le contrôle, avec la commande de la consigne (entraînement et contrôle dans le même appel ; l'entraînement rejoué donne exactement les mêmes victoires, défaites et nulles que l'essai V0 ; seuls les temps diffèrent) :

```bash
npm run pesage -- --games 100 --json --direction recherche --candidats 6 --mondes 3 --reponses 4
```

Sortie : `exit 0`. **Nombre de lancements du contrôle : 1.** Aucun autre lancement sur les graines de contrôle (ni V1, ni V2 sur le contrôle).

| Jeu | Niveau 2 (recherche) | Niveau 1 | Nulles | Décidées | Taux | IC 95 % | Ratio | Tient ? |
|---|---:|---:|---:|---:|---:|---|---:|---|
| Entraînement (rejoué) | 520 | 329 | 151 | 849 | 61,25 % | 57,97 – 64,53 % | 1,581 | oui |
| **Contrôle** | **509** | **329** | 162 | 838 | **60,74 %** | 57,43 – 64,05 % | **1,547** | **oui** |

Par graine, contrôle (recherche / niveau 1 / nulles) : 99 → 98/66/36 · 1234 → 100/68/32 · 2024 → 105/63/32 · 777 → 102/67/31 · 31337 → 104/65/31.

## 6. Temps par coup (budget : quelques dizaines de ms, plafond 100 ms)

### 6.1 Fidélité du harnais en processus

Sur 2 graines × 10 parties, le même protocole joué par le **CLI** du simulateur et **en processus** donne **le même résultat** (niveau 2 de référence) : `13 / 19 / 8` des deux côtés, `parGraine` identique (`cmp` des champs : `True`). Commandes : `node scripts/pesage.mjs --seeds 1,7 --games 10 --json` et la même avec `--en-processus`.

### 6.2 Mesures

| Mesure | Coups | Moyenne | p50 | p95 | p99 | Max |
|---|---:|---:|---:|---:|---:|---:|
| V0, graine 1, 20 parties, **séquentiel** | 623 | 20,1 ms | 19,6 | 55,6 | 74,8 | 94,2 |
| V0, graine 42, 60 parties, **séquentiel** | 1 775 | 14,2 ms | 16,9 | 31,2 | 39,1 | 48,7 |
| V2, graine 42, 60 parties, **séquentiel** | 1 766 | 32,0 ms | 27,0 | 92,0 | 172,6 | 325,5 |
| V0, entraînement, dans le contrôle final (un build tournait en parallèle) | 14 607 | 14,5 ms | — | — | — | 100,1 ms |
| V0, contrôle, dans le même lancement (même build en parallèle) | 15 048 | 13,9 ms | — | — | — | 50,4 ms |

**Lecture** : la **moyenne** tient le budget (14 ms pour V0). La **queue** est plus large que la moyenne : le plafond de 100 ms est **atteint ou dépassé** sur des coups isolés (V0 : maximum de 100,06 ms sur 14 607 coups d'entraînement, dans un run partagé avec un build ; 94 ms et 49 ms dans les mesures séquentielles). Les maxima des runs parallèles (185 à 318 ms) sont **gonflés** par la contention CPU et ne sont **pas** une mesure. **La cause des pics n'est pas identifiée** : le pire coup mesuré (94 ms) n'avait que 10 coups légaux, donc le nombre de coups légaux ne l'explique pas à lui seul. Pistes : le GC (les clones `structuredClone` s'accumulent) ; un `replies` plus large dans certains états. À vérifier avant tout branchement.

Coût unitaire : `applyAction` (clone `structuredClone`) ≈ **60 µs** (mesuré sur une partie scriptée, `apply_us=59.5`). Le nombre d'appels par décision n'a pas été compté.

## 7. Limites — à lire avant toute conclusion

1. **Modèle adverse = politique du niveau 1.** La suite de la réponse adverse est la politique scriptée, la même que l'adversaire de la mesure (siège A : joueur = niveau 1 ; siège B : Direction = niveau 1). La recherche « connaît » donc en partie l'adversaire qu'elle affronte. Le minimum sur les premiers coups adverses corrige en partie (il est **pessimiste** : il n'imite pas le choix du niveau 1), mais la **suite** est la sienne. **Le gain est mesuré contre le niveau 1 seulement.**
2. **Équité : une décision peu sensible à la main.** Sur 77 positions de décision, remplacer la **main** et le **Deck** adverses ne change la décision que **1 fois** (sonde : `decision_changed_by_hand_swap=1`, et `0` sur le code réel). Un test de **décision** serait donc un garde-fou sans pouvoir ; c'est pourquoi l'équité est testée sur **le contenu du monde tiré** (§4), qui mord (mutation vérifiée).
3. **Pool uniforme sur le catalogue.** Le pool ne sait pas quelles factions l'adversaire joue : une main adverse tirée au hasard dans tout le catalogue ne ressemble pas à un Deck réel. C'est honnête (rien d'interdit n'est lu), mais grossier. Un **a priori** sur le Deck adverse (factions déjà vues) serait plus juste ; ce n'est pas fait.
4. **Élagage** : seuls les `candidates` meilleurs coups à un coup et les `replies` plus nocifs sont joués en entier. Le « minimum » n'est **pas** exhaustif.
5. **Un coup = un tour** : la recherche ne voit pas plus d'un tour adverse.
6. **Nulles exclues** : 16 % des parties (`--max-turns 200`). Comme pour #111, le taux est celui des **décidées**.
7. **Mondes corrélés dans un tour** : les mondes ne dépendent que de la graine de la **partie** et du **tour** ; deux décisions d'un même tour tirent donc les mêmes mondes.
8. **Non vérifié** : le gain contre un adversaire qui ne joue pas le niveau 1 ; contre un humain ; l'effet à l'écran (l'écran joue toujours le niveau 1) ; le budget **au pire** cas (p99 mesuré sur 2 000 coups seulement) ; la stabilité des maxima hors contention.

## 8. Pièges rencontrés

- **Compteur d'uids global** (`newUid` dans `engine.ts`) : `createInstance` sans uid explicite **avance le compteur** et modifie les uids de la partie réelle. Les mondes passent donc des uids explicites (`w<k>h<i>`).
- **Journaux** : un `structuredClone` copie `log` et `actionLog`, qui grossissent au fil de la partie. Les sondes et les mondes les remettent à `[]` (le moteur ne lit jamais `log` pour décider — vérifié par `grep`).
- **Sortie `npm run`** : npm écrit son en-tête **avant** le JSON. Le parser doit lire à partir du premier `{`.
- **Timing sous contention** : trois runs en parallèle gonflent les maxima de ×2 à ×4. Mesurer **en séquentiel**, seul.
- **Build pendant un contrôle** : le build tournait pendant le lancement du contrôle final ; ses temps sont donc légèrement gonflés (les **décisions**, elles, ne dépendent pas du temps : le résultat est déterministe).
- **Une décision dépend de la graine, pas du temps** : aucun budget en millisecondes n'entre dans la décision (sinon le résultat ne serait plus rejouable).
- **Ce que le test d'équité ne voit pas** : une fuite sans effet sur la décision (§7.2). Il faut le test sur le monde.
- **Garde-fous** : la fuite de la main adverse n'est **pas** dans `scripts/garde-fous.mjs`. Une entrée exige un **ticket** (la table les cite tous) ; je n'en ai pas, je n'en invente pas. **À faire** quand un ticket existe.

## 9. Pour le niveau 3 (PIMC, déterminisations)

**Réutilisable tel quel** :
- `unknownPool` — le pool des cartes inconnues, testé ;
- `sampleWorld` — la détermination d'un monde (main et Deck adverses tirés sans remise, sous-graine seedée) ;
- `playOutTurn` — la politique scriptée jouée jusqu'à la fin d'un tour (relève comprise) ;
- `scoreMoves` / l'élagage à un coup ;
- le **harnais en processus** de `scripts/pesage.mjs` (`chargerModules`, `executerEnProcessus`) : il reproduit le CLI, et il accepte une politique quelconque (`choisir`) ;
- les tests d'équité (`ia-recherche.test.ts`).

**À reprendre, pas à réutiliser** :
- **La fusion de stratégie** : `lineValue` prend le **minimum** dans **chaque** monde. C'est un minimum **par monde** (l'adversaire connaît sa main dans chaque monde), donc un biais optimiste envers l'information cachée. Le niveau 3 doit moyenner les réponses **avant** le minimum, ou utiliser un ensemble d'information (ISMCTS, piste 4), pour éviter de choisir un coup adapté à une main imaginée.
- **Le pool uniforme** (§7.3) : un niveau 3 devrait partir d'une distribution de Deck (factions vues, marché).
- **Le modèle adverse** (§7.1) : à remplacer par une politique **générique** (ou une moyenne sur plusieurs politiques), sinon la mesure reste un test contre le niveau 1.
- **Les réglages** : `DEFAULT_SEARCH_OPTIONS` (6 / 3 / 4) sont **un** choix, pas un optimum ; ne pas les traiter comme acquis.
- **Le temps** : le coût est proportionnel au nombre de mondes (V1, 6 mondes, coûte environ le double de V0, 3 mondes : mesuré en parallèle, donc approximatif). Un niveau 3 plus large dépassera vite le budget ; il faut d'abord remplacer les clones complets par un état mutable avec retour arrière, et mesurer les pics séquentiellement.

## 10. Commandes et sorties (état committé)

```text
$ npm run check        → exit 0 (tsc -b, aucune erreur)
$ npm test             → exit 0 ; Test Files 66 passed (66) · Tests 781 passed (781)
$ npm run garde-fous   → exit 0 ; 15/15 mutations font échouer la suite
$ npm run build        → exit 0 ; dist/index.html (864 o) et dist/sw.js (2 933 o) produits
$ grep -rn "Galère" src → 1 occurrence, dans src/components/pas-a-pas-combat-etapes.test.ts:36
                          (liste de mots INTERDITS du test, préexistante sur dev — pas une donnée)
$ npm run pesage -- --games 100 --json --direction recherche --candidats 6 --mondes 3 --reponses 4
                       → exit 0 (contrôle : 1 lancement ; voir §5)
```

## 11. Mesures finales

- Lancements du **contrôle** : **1** (V0 uniquement).
- Variantes testées sur l'entraînement : **3** (V0, V1, V2), au plus autorisé.
- Temps par coup retenu (V0) : moyenne **14 ms** (entraînement 14,5 ms, contrôle 13,9 ms) ; maximum **100,06 ms** (entraînement) et **50,35 ms** (contrôle). Le plafond de 100 ms est atteint sur un coup : voir §6.2.
- Tests d'équité : `src/game/ia-recherche.test.ts`, 8 tests, dont celui qui échoue quand le monde reprend la vraie main (mutation vérifiée).
