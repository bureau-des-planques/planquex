# Remesure du niveau 2 de l'IA — ticket #111 (22/10/2026)

> Mesure **sans changement de code** : `src/game/ia.ts`, le moteur et `scripts/pesage.mjs` sont intacts.
> Ce document **ne tranche pas** entre (a) re-peser, (b) retirer, (c) assumer le niveau 2 : c'est une décision humaine.
> Il ne change **aucune règle** (`docs/JEU.md` §4 et `docs/DECISIONS.md` restent seuls juges).

## 1. Verdict mesuré

**Le niveau 2 ne bat pas le niveau 1.** Sur les graines de contrôle, il gagne **44,06 %** des parties décidées (seuil exigé : **55 %**), et son ratio de victoires vaut **0,788** (seuil : **1,15**). L'intervalle à 95 % **exclut 50 %** : sur ces parties, c'est le niveau 1 qui gagne le plus souvent, pas un simple « non démontré ».

Hors entraînement, sur **3 000 parties** (contrôle + deux jeux de graines neuves) : **43,23 %** des décidées, IC 95 % **41,27 – 45,18 %**, ratio **0,761**. Aucune mesure n'atteint 55 %.

## 2. Ce qui a été vérifié avant de mesurer

- `#113` (types de café explicites dans le simulateur) et `#114` (sous-graine d'évaluation, plus de lecture du `rng` réel) sont dans `main` : `src/game/simulation.ts` porte `cafeTypes`, `src/game/ia.ts` porte `evaluationRng` / sous-graine dérivée.
- Le protocole de `scripts/pesage.mjs` est inchangé : entraînement `{1, 7, 42, 11, 23}`, contrôle `{99, 1234, 2024, 777, 31337}`, disjoints (le script refuse un recouvrement), miroir apparié, seuil ≥ 55 % des décidées **et** ≥ 1,15×, IC de Wald à 95 %.

## 3. Mesures

### 3.1 Commande demandée — `npm run pesage -- --games 100 --json`

Sortie sauvée dans `/tmp/opencode/pesage-100.json` (npm écrit son en-tête avant le JSON). Résumé relu avec `node` :

| jeu | graines | parties | niveau 2 | niveau 1 | nulles | taux (décidées) | ratio | IC 95 % | tient |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| entraînement | 1, 7, 42, 11, 23 | 1 000 | 359 | 463 | 178 | 43,67 % | 0,775 | 40,28 – 47,06 % | non |
| **contrôle** | 99, 1234, 2024, 777, 31337 | 1 000 | **367** | **466** | 167 | **44,06 %** | **0,788** | 40,69 – 47,43 % | **non** |

Par graine, contrôle : 99 → 73/87/40 · 1234 → 76/94/30 · 2024 → 77/95/28 · 777 → 73/89/38 · 31337 → 68/101/31 (niveau 2 / niveau 1 / nulles).

### 3.2 Reproduction — `node scripts/pesage.mjs --games 60 --json` (défaut du script)

Sortie : `/tmp/opencode/pesage-60.json`. Contrôle : **220 / 280 / 100**, taux **44,00 %**, ratio **0,786**, IC 39,65 – 48,35 %. Ce sont exactement les chiffres de la dernière mesure consignée sur #111 (après #114) : **la mesure est reproductible**.

### 3.3 Graines neuves — même seuil, même harnais

Ces deux jeux **n'ont servi ni à régler ni au contrôle** ; le seuil n'a pas été modifié.

| jeu | commande | graines | niveau 2 | niveau 1 | nulles | taux | ratio | IC 95 % |
|---|---|---|---:|---:|---:|---:|---:|---|
| neuves A | `node scripts/pesage.mjs --games 100 --seeds 3,5,8,13,21 --json` | 3, 5, 8, 13, 21 | 345 | 477 | 178 | 41,97 % | 0,723 | 38,60 – 45,34 % |
| neuves B | `node scripts/pesage.mjs --games 100 --seeds 34,55,89,144,233 --json` | 34, 55, 89, 144, 233 | 354 | 457 | 189 | 43,65 % | 0,775 | 40,24 – 47,06 % |

### 3.4 Agrégat hors entraînement (contrôle + neuves A + neuves B)

3 000 parties : niveau 2 **1 066**, niveau 1 **1 400**, nulles **534** (17,8 %). Décidées 2 466 ; taux **43,23 %** ; ratio **0,761** ; IC 95 % (Wald) **41,27 – 45,18 %**.

## 4. Lecture

- Le gain de #93 reste un artefact : rien de positif ne survit, ni au contrôle, ni sur les graines neuves.
- Le niveau 2 est **derrière** le niveau 1 de façon stable (taux entre 42 % et 44 % selon le jeu), et l'écart n'est pas dans le bruit d'un jeu isolé.
- Le seuil de 55 % n'est atteint **par aucun** jeu, ni aucun candidat de #111 (meilleur contrôle : 54,08 %, voir `docs/ia/111-pesage.md` §5).
- **Recommandation de la mesure** (non tranchée ici) : la preuve va dans le sens de (b) retirer le niveau 2 ou (c) l'assumer en l'écrivant. Re-peser (a) n'a plus de signal à exploiter sur ce harnais.

## 5. Non vérifié / limites

- **Nulles exclues** : 17,8 % des parties (`--max-turns 200`) ne comptent ni pour ni contre. Elles ne sont pas réparties au hasard entre les camps ; on ne sait pas la direction de leur biais. Le taux est donc une lecture **sur les parties décidées**, pas un taux global.
- **Pas de re-pesage** dans cette passe : seuls les poids par défaut sont mesurés. Le meilleur candidat de #111 n'a pas été relancé sur les graines neuves.
- **Pas de test de sensibilité** à `--max-turns` (200 par défaut) ni à la taille de l'échantillon au-delà de 1 000 parties par jeu.
- **Pas de test de la lecture à l'écran** : l'écran joue le niveau 1 ; cette mesure ne dit rien de l'effet perçu par un joueur.
- Le simulateur est supposé honnête depuis #113 ; la mesure ne le re-audite pas.
- `npm run build` **non lancé** (consigne). `npm run check` : exit 0.

## 6. Commandes et sorties clés

```text
$ npm run check            → > tsc -b            → exit 0
$ npm run pesage -- --games 100 --json   → exit 0 (≈ 53 s)
$ node scripts/pesage.mjs --games 60 --json   → exit 0 (contrôle 220/280/100)
$ node scripts/pesage.mjs --games 100 --seeds 3,5,8,13,21 --json   → exit 0
$ node scripts/pesage.mjs --games 100 --seeds 34,55,89,144,233 --json   → exit 0
```
