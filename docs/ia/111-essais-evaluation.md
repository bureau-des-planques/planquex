# Essais d'amélioration du niveau 2 (IA « Direction ») — piste 1

*Date : 22/10/2026 · Branche : `ia-niveau2-essais` (worktree `/tmp/opencode/wt-ia2`) · Base : `main` 9c49b47*

Suite de `docs/ia/111-recherche-pistes.md` (piste 1 : évaluation enrichie) et de la remesure #111 (`docs/ia/111-mesure.md`, branche `111-remesure-ia`).

## Verdict

**Échec.** Le meilleur candidat de l'entraînement (e, combinaison de c et d) fait **43,68 %** des parties décidées sur les graines de contrôle, ratio **0,776**. Seuil : **55 %** et ratio **1,15**. Il ne fait pas mieux que la référence (44,06 % en #111). **Rien n'est gardé** : `src/game/ia.ts` est revenu à l'état de `main`.

## Protocole suivi

- Entraînement : graines **1, 7, 42, 11, 23**, `node scripts/pesage.mjs --games 100 --seeds 1,7,42,11,23 --json` (jamais la forme par défaut pour les essais, qui lance aussi le contrôle).
- Contrôle : graines **99, 1234, 2024, 777, 31337**, lancé **une seule fois**, sur le meilleur candidat d'entraînement (e) : `npm run pesage -- --games 100 --json`.
- Maximum 5 candidats : **5 essais** ont été faits (a à e). Chaque poids a été essayé **une seule fois** (pas de balayage de magnitude) : les essais sont donc un test de direction, pas une optimisation.
- `scripts/pesage.mjs` **n'a pas été modifié** : son option `--seeds` suffisait pour l'entraînement seul.
- Référence (poids par défaut, #93) mesurée sur l'entraînement : elle reproduit **à l'identique** #111 (359 / 463 / 178), ce qui valide le harnais.

## Les essais (entraînement, 100 parties par graine, miroir apparié)

| Essai | Terme ajouté (poids) | Niveau 2 | Niveau 1 | Nulles | Taux (décidées) | Ratio | Tient ? |
|---|---|---:|---:|---:|---:|---:|---|
| Réf. | aucun (défaut #93) | 359 | 463 | 178 | 43,67 % | 0,775 | non |
| a | avantage en cartes publiques (4) | 355 | 466 | 179 | 43,24 % | 0,762 | non |
| b | menace de KO, Poste adverse hp ≤ 30 (100) | 332 | 475 | 193 | 41,14 % | 0,699 | non |
| c | Interventions proches de la victoire, à 2 et plus (150) | 361 | 461 | 178 | 43,92 % | 0,783 | non |
| d | statuts : Poste adverse − mon Poste (30) | 362 | 462 | 176 | 43,93 % | 0,784 | non |
| **e** | **c + d** (meilleur d'entraînement) | **364** | **460** | **176** | **44,17 %** | **0,791** | non |

Aucun essai n'atteint 55 % à l'entraînement. Le meilleur (e) gagne **+0,50 pt** sur la référence : dans le bruit (IC 95 % d'un jeu : environ ±3,3 pt).

## Contrôle — un seul lancement

Commande : `npm run pesage -- --games 100 --json` sur le candidat (e). Sortie : `exit 0`.

| Jeu | Niveau 2 | Niveau 1 | Nulles | Taux | IC 95 % | Ratio | Tient ? |
|---|---:|---:|---:|---:|---|---:|---|
| Entraînement (rejoué) | 364 | 460 | 176 | 44,17 % | 40,78 – 47,57 % | 0,791 | non |
| **Contrôle** (99, 1234, 2024, 777, 31337) | **363** | **468** | 169 | **43,68 %** | 40,31 – 47,05 % | **0,776** | **non** |

Par graine, contrôle (niveau 2 / niveau 1 / nulles) : 99 → 72/88/40 · 1234 → 77/93/30 · 2024 → 77/95/28 · 777 → 71/90/39 · 31337 → 66/102/32.

**Nombre de lancements du contrôle : 1.** Je ne l'ai pas regardé deux fois. Je n'ai pas relancé le contrôle de la référence (la mesure de #111, 367 / 466, fait foi).

## Équité — ce que lit chaque terme

Relu dans le code, pas seulement déclaré :

- (a) : `hand.length` et `bench` (compteurs) — **pas** le contenu de la main.
- (b) : `active.hp`, `active.cardId` du Poste adverse (visibles) et `threatOf` (cafés et attaques du **mien**).
- (c) : `points` (Interventions, publiques).
- (d) : `statuses` des deux Postes (visibles).

Aucun terme ne lit `deck` ni le contenu de `hand` adverse, et aucun ne lit `state.rng`. Chaque fonction est pure. **Ce constat est relu, pas testé** : aucun test n'a été ajouté puisque le code a été retiré (voir « Non vérifié »).

## Limites et choix de lecture

- (a) suit la formule de la consigne, **asymétrique** : `main + Banc` **de moi** − `main adverse`, sans le Banc adverse. Une version symétrique est une autre expérience, non faite.
- (c) n'utilise qu'un seuil (2 Interventions). Un seuil plus fin n'a pas été essayé.
- (d) : « pénaliser les statuts subis par le Poste adverse » a été lu comme un **bonus** pour moi quand l'adversaire a des statuts, moins mes propres statuts. C'est la lecture qui sert la politique ; elle n'est pas la seule possible.
- Les poids (100, 150, 30, 4) ne sont pas réglés : un seul essai par terme.

## Non vérifié / à noter

- **Code retiré** : `src/game/ia.ts` est revenu à `main`. Le diff des essais est sauvé hors dépôt, `/tmp/opencode/ia2-essais.patch` (102 lignes), pour trace. Il n'est pas committé.
- `npm run build` **non lancé** (non demandé ; le code retiré ne change pas le build).
- Pas de test de sensibilité aux graines neuves : hors protocole, et le contrôle a échoué.
- Pas de rejeu sur la référence du contrôle dans cette passe (mesure #111 reprise telle quelle).
- La recherche à deux coups (piste 2), le PIMC et les déterminisations n'ont **pas** été touchés : hors de ce sujet.

## Commandes et sorties clés

```text
$ node scripts/pesage.mjs --games 100 --seeds 1,7,42,11,23 --json   (référence)  → 359 / 463 / 178, 43,67 %, ratio 0,775
$ ... essai a (cardAdvantage: 4)                                     → 355 / 466 / 179, 43,24 %, ratio 0,762
$ ... essai b (koThreat: 100)                                        → 332 / 475 / 193, 41,14 %, ratio 0,699
$ ... essai c (nearWin: 150)                                         → 361 / 461 / 178, 43,92 %, ratio 0,783
$ ... essai d (statusControl: 30)                                    → 362 / 462 / 176, 43,93 %, ratio 0,784
$ ... essai e (nearWin: 150, statusControl: 30)                      → 364 / 460 / 176, 44,17 %, ratio 0,791
$ npm run pesage -- --games 100 --json  (CONTROLE, 1 seul lancement) → exit 0 ; contrôle 363 / 468 / 169, 43,68 %, ratio 0,776, tient : false
$ npm run check            → exit 0
$ npm test                 → 65 fichiers, 773 tests : passed
$ npm run garde-fous       → exit 0 ; 15/15 mutations font échouer la suite
```

## Conclusion

La piste 1 (évaluation enrichie, termes publics) **ne fait pas passer le niveau 2 au-dessus de 55 %**, ni au-dessus de la référence de façon démontrée. Au regard du critère de `docs/ia/111-recherche-pistes.md` (≥ 52 % sur contrôle), elle **échoue aussi**. Le choix entre retirer le niveau 2 et l'assumer reste une décision humaine, et ces essais n'en tranchent pas la suite.
