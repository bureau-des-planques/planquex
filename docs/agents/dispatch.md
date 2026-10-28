# Dispatch — le prompt d'un sous-agent

Le prompt d'un dispatch se **rend**, il ne se recopie pas. Commande :

```bash
npm run dispatch -- --ticket 427 --decision
```

Elle lit le ticket par `gh issue view 427 --json number,title,body,labels` et imprime,
dans l'ordre : le ticket et ses étiquettes, le **worktree absolu** et la branche, le corps
du ticket, les zones à ne pas toucher, la **définition de fini** (§8.4 de `AGENTS.md`) et
la consigne de livraison.

| Option | Défaut | Effet |
|---|---|---|
| `--ticket N` | — | obligatoire |
| `--agent` | `codeur` | `codeur`, `auditeur`, `chercheur`, `orienteur`, `redacteur`, `explore` |
| `--branche` | `agent/N` | la branche du worktree |
| `--worktree` | `~/.local/share/opencode/worktree/<dépôt>/N` | chemin absolu ; un chemin relatif est résolu depuis le dépôt |
| `--decision` | absent | **réserve le prochain numéro** de `docs/DECISIONS.md` et l'inscrit dans le prompt |
| `--json` | absent | rend `{ ticket, titre, worktree, branche, decision, prompt }` |

## Pourquoi ce gabarit

Rétro du 28/10/2026, mesurée dans la base des sessions : **74 dispatchs**, 226 000
caractères de prompts écrits à la main, médiane 2 915 caractères. Les mêmes paragraphes
étaient réécrits chaque fois, et les oublis se payaient en messages de rattrapage :

- « ton worktree est en retard sur `integration/alpha-beta` » ;
- « Arrêt de numérotation : les numéros de décision en vigueur sont… » ;
- « Reprends exactement où tu en étais » après une coupure de quota.

Le gabarit ne supprime pas les coupures, mais il rend le **point de reprise** évident :
worktree, branche, ticket, définition de fini.

## Ce qu'il ne fait pas

- Il **n'invente pas les zones**. Un ticket qui traverse plusieurs zones se voit dans
  `git status` et dans `docs/agents/parallelisme.md` §1 ; l'orchestrateur les nomme à la
  main quand elles ne sont pas évidentes.
- Il **ne lance pas le sous-agent**. L'outil `subagent` reste le geste de l'orchestrateur,
  avec `model` explicite quand il choisit à la main (`docs/agents/parallelisme.md` §2).
- Il **ne pousse pas**. Un sous-agent commite dans son worktree ; la PR est le geste de
  l'orchestrateur.
