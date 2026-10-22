# Spec — les illustrations : la vague des 214

> Écrite le **21/10/2026**, après le set des 10 cartes signature et une séance de décision
> (12 questions, toutes tranchées par Bastien). Ce document **décrit** le tuyau et le plan ; il
> **n'acte rien** : les décisions qui engagent sont des lignes datées de `docs/DECISIONS.md`
> (**D-045**, **D-046**), et le reste est un plan de travail. Le ticket qui l'exécute est **#121**.
>
> Autorité : `AGENTS.md` §2 — `docs/DECISIONS.md` d'abord, puis `PROPOSITION.md` §3-5,
> `CARD-SPEC.md`/`FACTIONS.md`, `MIROIR-2026-DELTAS.md`, le code, les audits datés.

## 1. Où on en est

`node scripts/status.mjs` — **la source unique des décomptes** :

| | |
|---|---|
| Cartes | **300** = **225 bases** + **75 variantes** |
| Illustrations faites | **10** — les 10 cartes signature (`#97`), toutes des bases |
| Restent | **214 bases** + **3 viviers** (Planche 3) |
| Variantes | **0 image** : `secretVariant` (`src/data/planque.ts`) recopie `art` de sa base, et `src/data/art.test.ts` l'impose |

**L'obstacle** (levé le **22/10/2026** par #121) : le sujet et l'accent des cartes restantes
n'existaient nulle part — `design/illustrations/PROMPTS-flow.md` ne décrivait que la
**Planche 1** (devenue **Portrait**), ses 10 cartes signature, et `scripts/illustration-vague.sh`
(`cartes()`, `accent_de()`) ne connaissait qu'elles. Les deux tables sont désormais écrites
(`SUJETS-flow.md`, `ACCENTS-flow.md`), le wizard les lit, et une garde les vérifie.

**Un compte à vérifier, pas à recopier** : « les 214 » vaut pour `225 bases − 10 faites = 215`,
donc le titre de ce document et le tableau ci-dessus sont **d'un cran court**. Les deux tables
couvrent **toutes** les cartes de base, et le nombre qui fait foi est celui de
`npm run status` (`cards`) — pas un chiffre écrit ici. Le chiffre n'est pas corrigé ici pour ne
pas réécrire un plan daté : il est **signalé** (constat du 22/10/2026, #121).

**Une cible qui a changé, et un `AGENTS.md` qui a suivi** : `AGENTS.md` §4.2 n'annonce plus de
compte. Depuis **D-063** (22/10/2026), la cible est **autour de 300** — 225 bases + 75 variantes,
**sans compter** —, et ce qui compte est ce qu'on peut jouer. L'ancienne cible chiffrée (celle de
**D-005**, acte daté qui ne se réécrit pas) n'est plus citée ici : c'est **ce document** qui avait
pris du retard, pas `AGENTS.md` (constat du 22/10/2026, #148). Le décompte réel n'est écrit dans
cette spec que dans le tableau ci-dessus, et il se lit dans `npm run status`.

## 2. Les douze décisions

| # | Décision | Raison |
|---|---|---|
| **Q1** | Le **sujet** vit dans `design/illustrations/` — jamais dans `src/data`, qui reste en français et ne porte que du jeu | `CardView.tsx:77` n'utilise `art` que pour une URL de `background` : le sujet n'est **pas** nécessaire à l'application. Le faire entrer dans `src/data` serait 215 lignes anglaises dans les données de jeu, et une décision datée pour ça |
| **Q2** | **Source unique** : `import.meta.glob('../design/illustrations/*.webp', { eager: true, query: '?url' })`. `public/design/illustrations/` cesse d'être la copie servie → **D-045** | 53 Mo de binaires dupliqués (mesuré) pour un problème que Vite résout nativement, et la classe de dérive entière que garde #120 disparaît avec la duplication |
| **Q3** | **`FACTION_META.color` est canonique** ; les 10 mots d'accent en sont **ré-dérivés** → **D-046** | Trois sources divergeaient sur quatre factions, et `FACTION_META.color` pilote le dégradé de la carte : une carte Support avait un fond turquoise et une illustration argent-blanc |
| **Q4′** | Les 8 Collègues restent en **Planche 2**, avec **un objet symbolique par événement** | Leur point commun est l'événement, pas l'objet — mais chacun se dit par **un seul** objet, ce qui respecte la planche telle qu'écrite (son « à éviter » interdit plusieurs objets concurrents). Une chaise abandonnée dit « une réunion qui aurait pu être un mail » mieux qu'une foule |
| **Q6′** | Les **3 viviers** sont dans le lot, produits **pour plus tard** | 3 images, ~2 minutes |
| **Q9** | Les planches sont **renommées par rôle** — **Portrait / Objet / Lieu** ; **« Collègue » est conservé** | « Planche 1/2/3 » ne dit rien. Et « Collègue » se lit « ce qu'un collègue te fait » (Visite médicale, Yoga du rire) : le mot décrit l'action subie, pas la personne |
| **Q10** | Les **105 sujets** sont écrits par une **passe LLM**, jugés par un critère **testable** (§4) | D-007 : « IA + curation ». ~105 racines d'évolution, pas 214 : le rang est un modificateur |
| **Q11** | **Pilote sur une faction** avant les 214 | ~30 images pour juger le style, contre 214 à refaire |
| **Q12** | Les viviers dorment au registre ; **aucun écran** n'est ajouté | Les brancher est un travail d'UI qui mérite son ticket |
| **Q13** | Un vivier prend la couleur de sa faction **éponyme** | La seule règle qui ne demande aucune table nouvelle, et elle est déjà vraie pour l'Atelier |
| **Q14** | `illustrations-servies.test.ts` (#120) **devient la garde de la table** — **exécuté autrement le 21/10/2026** : le test a disparu avec la copie servie (D-045), et son rôle est tenu par **`src/data/art.test.ts`** (fichier présent, convention de nom, aucune orpheline, résolution par le glob) | On ne supprime pas une garde sans la remplacer : celle-là est déjà écrite et comprise, et la garde de la table des sujets viendra **en plus**, pas à la place |
| **Q15** | Quatre accents changent : DIRECTION *slate blue*, SYNDICAT *brick red*, INTERIM *periwinkle blue*, SUPPORT *teal* | Conséquence de Q3 |

## 3. Les trois tables

Toutes dans `design/illustrations/`, à côté du registre et du socle.

- **`SUJETS-flow.md`** — une ligne par **carte de base** : `` | `id` | sujet | ``. Le sujet est
  **en anglais** (les modèles répondent mieux), avec les **5 créneaux** du §4.
- **`ACCENTS-flow.md`** — une ligne par **faction** : `` | `FACTION` | accent | ``. Dix lignes, et
  elles seules : l'accent n'est **jamais** recopié sur les lignes de sujets.
- **`PROMPTS-flow.md`** — garde le **socle** (`socle()`, `scripts/illustration-vague.sh`) et perd
  sa table des 10 signature, qui part dans `SUJETS-flow.md`.

Le prompt final reste : `<socle aplati> <sujet>, muted <accent> accent.`

Les deux tables sont lues **hors des blocs de code** : un bloc ```text montre le *format*
(`` | `FACTION` | accent | ``), pas une donnée. Lire le format comme une ligne a déjà produit une
faction fantôme (`FACTION`) — le wizard et la garde sautent donc les blocs, tous les deux.

## 4. Le critère opposable des sujets (Q10)

**Testable, pas déclaratif** :

- **5 créneaux obligatoires** : rôle, tenue, **objet tenu**, geste, expression ;
- **aucun doublon** du couple *objet + geste* entre deux sujets ;
- **longueur bornée** — 200 caractères au plus ;
- un test exige **une ligne par carte de base** *et* **aucune ligne orpheline** — la dérive dans
  les deux sens, comme `art.test.ts` le fait déjà pour `art`.

## 5. L'ordre du travail

1. **Le refactor source unique** (D-045) — ~~il doit passer avant la première image~~ **fait le
   21/10/2026** : `src/art.ts`, copie `public/design/illustrations/` supprimée, test #120 remplacé
   par `src/data/art.test.ts`, et les `webp` entrent dans le précache. Il fallait qu'il passe avant
   la première image : changer la forme du champ `art` se paie une fois, pas 225 fois.
2. **Le renommage des planches** — Portrait / Objet / Lieu, dans `DESIGN.md` §6,
   `PROMPTS-flow.md` et le registre. ~~à faire~~ **fait le 22/10/2026** (#121) : `DESIGN.md`
   §6.2–6.4, `PROMPTS-flow.md` et `design/illustrations/README.md` disent ces trois noms.
3. **La table des sujets** — les 10 signature migrés, puis les 105 lignes. Passe LLM, puis
   **relecture humaine d'un échantillon** : c'est le point d'arrêt humain de cette vague.
   ~~à faire~~ **écrit le 22/10/2026** (#121) : `SUJETS-flow.md` couvre **toutes** les cartes
   de base (les Planqués en cinq créneaux, les cartes Action en objet unique). La
   **relecture humaine d'un échantillon reste à faire** — c'est le point d'arrêt.
4. **La table des accents** (10 lignes) et **la garde** qui remplace #120. ~~à faire~~ **fait
   le 22/10/2026** (#121) : `ACCENTS-flow.md`, et la garde dans
   `scripts/illustration-vague.test.ts` (une ligne par base, critère du §4, accent **ré-dérivé**
   de `FACTION_META.color`). Chaque règle y est confrontée à un **cas fautif fabriqué** (#112).
5. **Le pilote sur une faction** — Support (32 bases) ou Atelier (26).
6. **Les 214**, puis les 3 viviers.

## 6. Ce que ça change dans le code

- **`art` change de nature** : d'une chaîne nue (`'sse-medecin-travail.webp'`) à une **URL de
  module**. Donc `src/components/CardView.tsx`, `src/data/art.test.ts` et la convention de #96.
- **`scripts/illustration-vague.sh`** se recâble sur les nouvelles tables — `cartes()` lit
  `SUJETS-flow.md` et `accent_de()` `ACCENTS-flow.md` ~~connaissent~~ **connaissaient** seulement
  la Planche 1. Fait le 22/10/2026 (#121) : l'`id` donne la faction par son préfixe, l'accent suit
  la faction.
- **`support-responsable-support` est à refaire** : installée en argent-blanc, elle devient
  turquoise (conséquence assumée de Q3 + Q15).
- **`scripts/illustrations-servies.test.ts`** a disparu ; son rôle est tenu par
  `src/data/art.test.ts` (Q14) — et la garde de la table des sujets est **écrite** :
  `scripts/illustration-vague.test.ts` (22/10/2026, #121).

## 7. Déjà vérifié — à ne pas refaire

- **`gflow image t2i` n'a aucune option de prompt négatif** (vérifié : `--help` n'en liste pas).
  Le « no text, no logo » du socle ne tient donc que par le **positif** — et devra tenir sur
  toutes les cartes restantes.
- **Le poids est mesuré, pas estimé** : 1,2 Mo pour 10 images en 1024² → 26 Mo par copie, 53 Mo
  les deux. En 1024² (Q8), et non 2048² comme `DESIGN.md` §6.5 l'annonce encore.
- **Workbox ne précache pas les webp** (`vite.config.ts:30`, `globPatterns` = `js,css,html,svg,woff2`) :
  le poids est un coût de **dépôt**, pas de démarrage.
- **Le MCP `gflow` ne rend pas la graine** et son paramètre `seed` est un **no-op silencieux** —
  ticket amont [`ffroliva/gflow-cli#1013`](https://github.com/ffroliva/gflow-cli/issues/1013). Le
  seul chemin qui donne la graine est `gflow image t2i --json`, et la base locale la porte en repli.

## 8. Hors périmètre

- **Un `alt` sur l'illustration** : ce serait le seul motif de faire passer le sujet dans
  `src/data`, et c'est une décision d'accessibilité séparée.
- **Les 75 variantes** : aucune image (héritage de `art`).
- **Un écran pour les viviers** (Q12).
- **La refonte de la DA** : annoncée par Bastien pour plus tard, avec des LUT.
