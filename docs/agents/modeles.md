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