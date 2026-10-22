# Recherche — Amélioration du niveau 2 (IA « Direction »)

*Projet : Bureau des Planqués — Date : 22/10/2026*

---

## Contexte

Le niveau 2 actuel est un **glouton à 1 coup** : il évalue chaque action légale avec `evaluatePosition` (écart Seuil/Stress, Interventions, Poste, Rack, cafés) et choisit la meilleure. Mesure headless (graines d'entraînement et de contrôle disjointes, seuil de décision 55 % des parties décidées + ratio ≥ 1,15) : **44 % de victoires** contre le niveau 1, IC 95 % [40,7 ; 47,4] %, taux de nulles ≈ 18 % (limite 200 tours). Il **ne bat pas** le niveau 1.

Objectif : faire passer le niveau 2 au-dessus de 55 % (sur graines de contrôle, protocole inchangé) **avant d'envisager un niveau 3**.

---

## Facteur de branchement — estimation et mesure

Un tour = séquence d'actions (piocher, poser, attacher, Talent, Objets, Collègue, Pression, Rotation, fin de tour). L'ordre importe peu car le moteur applique des transitions atomiques.

**Estimation** : 15–40 actions légales par décision (pose Planqué, évolution, attaché café, Talent, 0–3 Objets, 0–1 Collègue, Pression si possible, Rotation si possible, passer). Le branchement effectif pour « choisir la prochaine action atomique » est donc **~20–30**.

**Mesure honnête** : instrumenter `ia.ts` pour logger `legalActions(state).length` sur 1 000 tours réels (graines fixes) et publier min/médiane/max/P95 dans le rapport.

---

## Pistes classées par bénéfice/effort estimé

### 1. Fonction d'évaluation plus fine (coût ~0 ms, effort faible)

**Principe** : enrichir `evaluatePosition` avec des termes connus en théorie TCG : **avantage en cartes** (main + Rack − main adverse estimée), **tempo** (cafés attachés prêts à presser), **menace de KO** (Stress adverse ≥ Seuil − 30), **valeur des Interventions** (COMEX = 2), **contrôle de statut** (Sieste/Immobilisation/Dérive sur l'adversaire), **potentiel d'évolution** (Entrant → N+1 dispo en main).

**Coût** : O(1) par évaluation, **< 1 ms** par coup.

**Risque** : sur-ajustement aux graines d'entraînement ; pas de triche (n'utilise que l'état visible).

**Mesure** : A/B sur graines de contrôle (1 000 parties) vs niveau 1. Critère : ≥ 52 % de victoires (marge de progression réaliste sans recherche).

**Source** : concepts *tempo/card advantage* (Magic/Hearthstone) — Dignitas *Card Game Concepts: Tempo* (2024), Eternal Central *Resource Advantage Part 2* (2018) ; appliqués à l'évaluation heuristique dans *Evolving Evaluation Functions for Collectible Card Game AI* (SCITEPRESS 2022).

---

### 2. Recherche à 2 coups (minimax/alpha-beta sur actions légales) — **piste recommandée en premier**

**Principe** : au lieu de choisir `argmax_a evaluate(succ(s,a))`, faire `argmax_a min_b evaluate(succ(succ(s,a),b))` où `b` parcourt les réponses légales de l'adversaire. Alpha-beta élague. Le hasard (café, tampon) est traité comme un nœud *chance* (expectiminimax) : on moyenne sur les issues (1 café tiré parmi les types restants ; pile/face = 0,5).

**Coût** : avec B ≈ 25, profondeur 2 → ~600 nœuds ; évaluation ~0,5 µs/nœud → **~0,3 ms** (JS, V8). Même à B = 40 → ~1 600 nœuds → **< 1 ms**. Large marge sous le budget « quelques dizaines de ms ».

**Risque** : **non-déterminisme** si l'échantillonnage du hasard n'est pas seedé. **Solution** : utiliser le RNG de la partie (`BattleState.rng`, mulberry32) pour *tous* les tirages simulés (café, tampon). La recherche devient pure et déterministe à graine fixée. Pas de triche : l'adversaire simulé ne voit que l'état public + sa propre main (connue du simulateur car on clone l'état complet).

**Mesure** : même protocole (graines de contrôle disjointes, 1 000 parties). Critère de succès : **≥ 55 %** de victoires contre niveau 1. Si < 52 % après tuning de l'évaluation → abandonner la piste « recherche peu profonde » et passer au niveau 3.

**Sources** : Expectiminimax (Michie 1966, Wikipedia, Stanford CS221 *Games: expectiminimax*, Berkeley CS188 *Expectimax*) ; Alpha-beta (CS188 Note 5, *Alpha-Beta Pruning* UpGrad 2024) ; implémentation navigateur : *Watch a Game AI Think: Minimax and Alpha-Beta in a Browser Tab* (dev.to 2023).

---

### 3. Perfect Information Monte Carlo (PIMC) — déterminisations

**Principe** : échantillonner N mondes complets compatibles avec l'information publique (main adverse tirée selon la distribution conditionnelle, Deck adverse ordonné aléatoirement). Sur chaque monde, résoudre par minimax/alpha-beta profondeur 2 (ou jouer glouton). Agréger par vote majoritaire ou moyenne des valeurs.

**Coût** : N × coût(recherche). Pour N = 50, profondeur 2 → 50 × 600 nœuds = 30 000 nœuds → **~15 ms**. Acceptable.

**Risque** : **strategy fusion** (l'IA adapte son coup à la main échantillonnée, pas à la distribution) — documenté par *Understanding the Success of PIMC* (Long et al., AAAI 2020) et *Reducing the burden of knowledge* (AI Factory 2013). **Triche potentielle** si l'échantillonnage utilise la vraie main adverse. **Solution** : échantillonner *uniquement* depuis les cartes inconnues (Deck + main adverse traités comme un sac commun), sans regarder la main réelle.

**Mesure** : même protocole. Critère : ≥ 55 % avec N ≤ 50 et < 30 ms/coup. Si gain < +5 pts vs recherche 2 coups → trop complexe pour le bénéfice.

**Sources** : PIMC originel (Levy, Ginsberg/GIB Bridge 2001) ; *Perfect Information Monte Carlo Sampling* (IJCAI 2015) ; *Understanding the Success of PIMC* (Long, Sturtevant, Buro, Furtak, AAAI 2020) ; AI Factory newsletter 2013.

---

### 4. Information Set MCTS (ISMCTS)

**Principe** : un seul arbre dont les nœuds sont des **ensembles d'information** (pas des états). Chaque itération : tirer une déterminisation, descendre/sélectionner dans l'arbre en ignorant les coups illégaux pour ce tirage, simuler, rétropropager. Évite le strategy fusion en moyenne *pendant* la recherche.

**Coût** : 200–500 itérations pour converger → **20–50 ms**. Proche de la limite budget.

**Risque** : implémentation complexe (arbre d'ensembles, légalité conditionnelle) ; non-déterminisme si budget en temps (pas en itérations fixes). **Solution** : budget en *itérations fixes* (ex. 300) + RNG seedé.

**Mesure** : même protocole. Critère : ≥ 58 % pour justifier la complexité. Sinon, PIMC + recherche 2 coups est préférable.

**Sources** : Cowling, Powley, Whitehouse *Information Set MCTS* (IEEE T-CIAIG 2012) ; *Ensemble Determinization in MCTS for MtG* (Cowling, Ward, Powley 2012) ; implémentation Python de référence `mittmcts` (GitHub dbravender).

---

### 5. MCTS standard sur déterminisations (determinized UCT)

**Principe** : pour chaque déterminisation, lancer UCT indépendant, puis agréger. Plus simple qu'ISMCTS mais souffre du strategy fusion et du coût multiplicatif.

**Coût** : N × itérations × simulation. Pour N=20, 100 itérations → **~10–20 ms**.

**Risque** : strategy fusion + variance entre déterminisations. Moins robuste qu'ISMCTS.

**Mesure** : même protocole. Critère : ≥ 55 %. Attendu inférieur à ISMCTS pour même budget.

**Sources** : *Determinization with MCTS for Hearts* (Bax, UU thesis 2023) ; *Monte Carlo Tree Search in Imperfect-Information Games* (thesis, cf. AI StackExchange 2023).

---

### 6. Politique à base de règles mieux pensée (rule-based expert)

**Principe** : remplacer le glouton par un système de règles priorisées (ex. : « si KO possible → Pression ; si Sieste adverse → ne pas attaquer ; si café incolore dispo → attacher ; si Entrant en main et Poste vide → poser »).

**Coût** : **~0 ms**.

**Risque** : fragilité, ne généralise pas ; difficile à tuner sans sur-ajustement.

**Mesure** : même protocole. Critère : ≥ 50 % (rattraper le niveau 1). Utile comme *baseline* pour l'évaluation de la piste 1.

**Source** : AI Factory *Spades AI* (newsletter 2013) — heuristiques expertes développées sur années.

---

### 7. Fonction d'évaluation apprise (réseau léger / régression / TD-learning)

**Principe** : générer 100k–1M parties self-play (niveau 2 vs niveau 2, ou niveau 2 vs niveau 1) via le simulateur headless (`npm run simulate`). Entraîner un petit MLP (2–3 couches, < 5k paramètres) ou une régression linéaire régularisée sur les features de `evaluatePosition` pour prédire la valeur finale (victoire/défaite/nulle) ou l'avantage en Interventions.

**Coût** : entraînement **quelques heures** sur CPU (simulateur ~1 000 parties/s → 1M parties en ~15 min ; entraînement < 1 h). Inférence : **< 0,1 ms**.

**Risque** : **sur-ajustement** à la politique actuelle (niveau 2) → ne généralise pas à d'autres decks/stratégies. **Triche** si les features encodent l'information cachée. **Solution** : features = état public uniquement (Poste, Rack visible, Interventions, cafés zone, défausses, compteurs) ; main adverse *exclue*.

**Mesure** : même protocole. Critère : ≥ 55 % *et* robustesse cross-deck (tester sur 10 decks différents non vus à l'entraînement).

**Sources** : *Evolving Evaluation Functions for CCG AI* (SCITEPRESS 2022) — évolution d'heuristiques via N-Tuple Bandit ; *AlphaZero-like at small scale* (blog posts divers, ex. *How We Trained an AI Model to Play Browser Games Live* IronBee 2026 — modèle 322M, 25 ms/coup) ; *On-line Evolution Planning* (Justesen et al. 2016).

---

## Recommandation nette

**Tester en premier : Recherche à 2 coups (expectiminimax + alpha-beta) avec évaluation enrichie (piste 1 + 2 combinées).**

**Pourquoi** :
- Coût prévisible et tiny (< 2 ms/coup, bien dans le budget navigateur).
- Déterministe à graine fixée (RNG de la partie).
- Pas de triche (l'adversaire simulé joue avec sa main réelle, connue du simulateur car on clone l'état complet — c'est *légitime* : l'IA « sait » ce qu'elle a en main, comme le joueur humain).
- Gain attendu : +8 à +12 pts vs niveau 1 (passage de 44 % → 52–56 %) d'après la littérature sur l'apport de la recherche peu profonde dans les jeux à branchement modéré (CS188, *Minimax and Alpha-Beta* démos).
- Si échec (< 52 % après tuning), **abandonner la piste « recherche peu profonde »** et passer directement au **niveau 3 (expectiminimax avec déterminisations / PIMC)** comme prévu par le ticket existant.

**Critère d'abandon du niveau 2** : après implémentation des pistes 1+2+6 (évaluation enrichie + recherche 2 coups + règles expertes en fallback), si le niveau 2 ne dépasse pas **52 % de victoires sur graines de contrôle (1 000 parties, IC 95 % excluant 55 %)**, on considère que l'approche glouton+recherche peu profonde est plafonnée et on bascule sur le niveau 3.

---

## Sources

1. **Expectiminimax** — Wikipedia (consulté 2026) ; Stanford CS221 *Games: expectiminimax* (autumn 2022) ; Berkeley CS188 *Expectimax* (textbook, 2023).
2. **Alpha-beta pruning** — Berkeley CS188 *Note 5: Alpha-Beta Pruning* (Summer 2023) ; UpGrad *Alpha Beta Pruning: Algorithm, Examples* (2024).
3. **PIMC** — Cowling, Powley, Whitehouse *Information Set MCTS* (IEEE T-CIAIG, 2012) ; Long, Sturtevant, Buro, Furtak *Understanding the Success of PIMC* (AAAI, 2020) ; AI Factory *Reducing the burden of knowledge* (newsletter, 2013).
4. **ISMCTS** — Cowling, Powley, Whitehouse (2012) ; Cowling, Ward, Powley *Ensemble Determinization in MCTS for MtG* (IEEE T-CIAIG, 2012) ; `mittmcts` Python lib (GitHub dbravender).
5. **Card game evaluation theory** — Dignitas *Card Game Concepts: Tempo* (2024) ; Eternal Central *Resource Advantage Part 2: Tempo* (2018) ; MtG *Tempo & Card Advantage* (Wizards 2014).
6. **Learned evaluation for CCG** — García-Sánchez et al. *Evolving Evaluation Functions for Collectible Card Game AI* (SCITEPRESS, 2022) ; Justesen et al. *On-line Evolution Planning* (IEEE CIG, 2016).
7. **Browser AI performance** — IronBee *How We Trained an AI Model to Play Browser Games Live* (2026, 322M params, 25 ms/move) ; dev.to *Watch a Game AI Think: Minimax and Alpha-Beta in a Browser Tab* (2023).
8. **Recursive Monte Carlo** — Furtak & Buro *Recursive Monte Carlo Search for Imperfect Information Games* (IEEE CIG, 2013).
