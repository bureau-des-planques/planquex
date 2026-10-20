# Modèles des agents — la chaîne de repli

Le choix des modèles gratuits n'est pas une intuition : il vient du **benchmark
`bench/`** du projet `Chapax/opencode-config`, sur une **tâche fixe de ce
dépôt** (la règle « 2 exemplaires maximum du même nom », `AGENTS.md` §4 ;
défaut réel de `deckLegal()` qui comptait par `id`).

Sources datées, dans `~/.config/opencode` :

| Commit | Ticket | Ce qu'il a mesuré |
|---|---|---|
| `ed6cf27` | #11 | harnais reproductible + 13 premiers runs (commit épinglé `beead4e`, une seule tâche) |
| `835cc76` | #12 | variantes `none` / `high` sur le même modèle |
| `fa9d194` | #13 | gratuits NVIDIA / opencode / groq |
| `bd55859` | #13 | **3 répétitions** sur les gratuits qui marchent + re-tests NVIDIA |
| `8e5974f` | #13 | local 9B à 64k — abandonné (8 Go de VRAM insuffisants) |

Les résultats bruts (`bench/results/SUMMARY.md` et `results/raw/*.jsonl`) ont
été retirés du dépôt après la conclusion ; ils se relisent par
`git -C ~/.config/opencode show <commit>:bench/results/SUMMARY.md`.

## Verdict (3 répétitions par modèle)

Un run est jugé sur **deux champs distincts** (`bench/README.md` §Validité) :
`solved` (la tâche est réussie) et `success` (le run s'est en plus terminé
proprement — pas de timeout, pas d'erreur de fournisseur, reset prouvé).

| Modèle | Rép. réussies | Durée | Verdict |
|---|---|---|---|
| `opencode/deepseek-v4.1-flash-free` | **3/3** | **27–47 s** | maillon 1 |
| `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` | 3/3 | 42–71 s | maillon 2 |
| `openrouter/thinkingmachines/inkling:free` | 3/3 | 26–145 s | maillon 3 |
| `opencode/nemotron-3.5-super-vl-free` | 2/3 | 45–80 s | réserve |
| `openrouter/cohere/north-mini-code:free` | 1/3 | 50 → 180 s (coupé) | écarté |
| `nvidia/*` (routage NVIDIA) | 1/6 | — | **inutilisable** |
| `groq/groq/compound` | 0/— | 0,3 s | n'appelle aucun outil |
| local 9B (ornith, qwen) | 0/— | — | 64k impossible à 100 % GPU |

## Politique

1. **Maillon 1** : `opencode/deepseek-v4.1-flash-free#high`. C'est le seul
   gratuit à faire 3/3 **et** à tenir sous 50 s. La variante `high` est
   **moins chère en tokens et fait moins d'appels d'outils** que `none`
   (`bench(#12)`).
2. **Repli** : `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`, puis
   `openrouter/thinkingmachines/inkling:free` — l'ordre de `chaineDeRepli`
   dans `~/.config/opencode/agents.config.json` (repli appliqué après un 429,
   avec mise en cooldown du fournisseur).
3. **Concurrence** : la passe 3 sessions simultanées montre que **la charge
   dégrade les gratuits** (nemotron-ultra : TTFT 2,6 s → 8,8 s, coupé à 180 s).
   Ne pas dépasser **2 sessions par fournisseur**.
4. **Le verdict vient des commandes** du dépôt (`npm run check` / `npm test` /
   le simulateur), jamais de l'impression du modèle.

## Limites

Le benchmark mesure **un run par modèle et par configuration** : les écarts
d'un run à l'autre (charge du fournisseur, quotas `:free`) ne sont pas séparés
de la qualité du modèle. Un modèle `:free` peut disparaître du catalogue :
`tools.opencode.models` est la source de ce qui existe **aujourd'hui**, le
benchmark est la source de ce qui **tient**.

## Relecteurs — Gemma 4 (décision de Bastien, 20/10/2026)

L'agent `auditeur` (relecture indépendante) emploie **`google/gemma-4-26b-a4b-it#none`**
(fournisseur `google`, gratuit). Les **implémenteurs** restent sur le maillon 1 : un modèle
donné ne se relit pas lui-même.

⚠️ **Variante obligatoire** : passer `#thinking` fait **échouer le lancement** —
`Thinking budget is not supported for this model`. Gemma 4 n'accepte que `#none`
(essai raté le 20/10/2026).

⚠️ **Quota du palier gratuit (mesuré le 20/10/2026)** : sur le fournisseur `google`, un
`429` tombe sur `Quota exceeded … limit: 16000, model: gemma-4-26b` — des jetons d'entrée
**par minute**, **par clé**. La cause n'est **pas** la taille de la tâche : une salve de
**tentatives rapprochées** sature à elle seule le plafond (« Please retry in 58 s »). Donc :
**une tentative par minute au maximum**, et un `429` se lit comme « réessaie plus tard », **pas**
comme « le modèle ne sait pas faire ». Pour une relecture **large**, ne pas compter sur ce
palier : prendre un maillon de la chaîne du benchmark, avec un modèle **différent de celui qui
a implémenté** (jamais le même : un modèle ne se relit pas lui-même).

## Protocole de commande pour un relecteur — à recopier dans le brief

Le profil `auditeur` **refuse le shell par défaut** et n'autorise qu'une **liste blanche**,
appariée sur la **commande entière** (`~/.config/opencode/agents/auditeur.md`). Conséquence
observée le 20/10/2026 : deux relecteurs ont conclu « shell refusé » et rendu une revue
**statique** — donc sans aucune preuve exécutée — parce qu'ils lançaient des commandes
**composées** (`cd <worktree> && git log …`), qui ne correspondent à aucun motif.

À écrire noir sur blanc dans le brief d'un relecteur :

- **une commande = une seule chaîne**, avec le champ `workdir` = le worktree ; **jamais**
  `cd … && …`, jamais `;`, jamais `echo $?` (le code de sortie se lit à l'absence du marqueur
  d'échec du harnais, et ce fait doit être signalé comme tel) ;
- **autorisés** : `npm run status`, `npm run check`, `npm test`, `npm run build`,
  `git -C <abs>|git status|log|diff|show|branch|rev-parse`, `ls`, `cat`, `head`, `tail`,
  `find`, `grep`, `wc` ;
- **non autorisés** — leur exécution revient à la personne qui orchestre, qui doit produire
  la preuve elle-même : `npm run simulate`, `npm run capturer`, `npm run detect:ui`, `npx`,
  `sha256sum`, `file`, `diff`, `sed`, `git merge-tree`.

Un relecteur qui n'a pas pu exécuter doit le **dire** et séparer « vérifié par lecture » de
« non vérifié » : une revue statique est utile, une revue statique qui se présente comme
mesurée ne l'est pas.