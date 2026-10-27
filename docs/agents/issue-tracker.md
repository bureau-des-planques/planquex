# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues on **`bureau-des-planques/planquex`** (public since 27/10/2026, D-118). Use the `gh` CLI for all operations. Pass `-R bureau-des-planques/planquex` when running outside a clone.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/bureau-des-planques/planquex/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Tenir un ticket à jour, et le fermer

**Un ticket suit son travail.** Un agent qui travaille sur `#n` écrit dans `#n` ce qu'il a fait, à la
fin — et pas seulement dans son rapport de session, qui disparaît. Trois moments d'écriture :

1. **Pendant** : si le ticket change (une décision tranchée, un périmètre corrigé, une dépendance
   levée), `gh issue comment <n>` et, si le corps est faux, `gh issue edit <n> --body-file <fichier>`.
   Un corps périmé fait perdre plus de temps qu'un corps absent.
2. **À la fin** : un commentaire qui dit **ce qui est fait**, avec la **preuve** (commande exacte et
   extrait, ou fichier:ligne), et le **commit** (`git log --oneline --grep="#n"`).
3. **À la fermeture** : `gh issue close <n> --comment "..."` — jamais une fermeture muette.

**On ne ferme que ce qui est fait *et* vérifié.** Si une partie manque, deux cas, et deux seulement :

- **Le reste est un autre travail** → ouvrir le ticket qui le porte, le citer dans le commentaire de
  fermeture, puis fermer. (Exemple : les sept mécaniques du moteur ont été closes en renvoyant à
  #175, qui câble les cartes.)
- **Le reste appartient au même ticket** → **ne pas fermer** ; commenter l'état, et dire ce qui
  manque. Une fermeture partielle est un mensonge qui se paie au ticket suivant.

**Un ticket fermé sans preuve n'est pas fermé.** La preuve est une sortie de commande, un fichier
cité, ou une capture — pas « ça doit marcher ».

**Une dépendance se vérifie, elle ne se suppose pas.** `#140` a porté pendant une journée un
« Blocked by #136 » faux : le script de statut lit un fichier JSON, pas la base. Avant de laisser un
ticket bloqué, lire ce qu'il fait *réellement*.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --json number,title,body,labels,comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/bureau-des-planques/planquex/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42 --json number,title,body` and fall back to `gh issue view 42 --json number,title,body`.

**Toujours `--json`, jamais la sortie par défaut** : `gh issue view 42` et `gh pr view 42` sortent **1** sur ce dépôt (l'avertissement « Projects (classic) is being deprecated » compte comme une erreur). Mesuré le 26/10/2026 : 42 appels en échec en 3 jours. `gh issue list` et `gh pr list` fonctionnent sans `--json`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/bureau-des-planques/planquex/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/bureau-des-planques/planquex/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
