---
name: cloture
description: Clôturer proprement une session de travail. À utiliser quand Bastien dit « clôture », « on ferme », « nettoie ton travail » ou « termine proprement ». Ne retire que ce que cette session a créé, et note le reste à faire.
---

# Clôture d'une session

Une clôture **retire ce que la session a créé, rien d'autre**. Plusieurs sessions partagent le dépôt, `/tmp/opencode/` et les ports : un nettoyage large détruit le travail d'une autre session (le 26/10/2026, une clôture a balayé `/tmp/opencode/*.md` en entier).

## Étapes

1. **Inventorier ce qui est à soi.** Relire la session : worktrees et branches créés, serveurs lancés (port, PID), fichiers écrits hors du dépôt, issues et PR touchées. Ce qui n'est pas dans cette liste n'est pas à toi : `git worktree list` ne prouve pas l'appartenance.
2. **Contrôler l'état.** Dans chaque worktree de la liste : `git status --porcelain`, puis commits non poussés (`git log @{u}..`). Du travail non commité ou non poussé **ne se supprime pas** : on le commite et le pousse si le périmètre est clair, sinon on le signale.
3. **Retirer, un par un, avec une vérification avant chaque suppression.**
   - worktree fusionné : `git worktree remove <chemin>`, puis `git branch -d <branche>` (le `-d`, jamais `-D`) ;
   - serveur lancé par la session : tuer l'**arbre** de processus (`npm` → `sh` → `node`), vérifier le port libre ensuite ;
   - fichiers temporaires : seulement sous un dossier à soi, `/tmp/opencode/<nom-de-session>/`. Aucun joker sur `/tmp/opencode/`, aucun `rm -rf` de `captures/` ni de `dist/` dans le dépôt principal.
4. **Noter le reste à faire** là où l'humain le retrouve : un todo `openchamber_knowledge` (`kind: todo`) par travail laissé, ou un commentaire sur l'issue. Si des issues `alpha` ont été ouvertes ou fermées, `npm run plan:dev` (§11 de `AGENTS.md`).
5. **Vérifier.** `npm run isolation` sort 0, ou n'accuse que des éléments listés « laissés » à l'étape 6. Et `npm run ci:etat` sort 0 : si `main` est rouge, le dire dans le compte rendu au lieu de fermer en silence (D-115, #258).
6. **Rendre un compte** en trois listes : *retiré* (avec la commande), *laissé* (avec la raison : autre session, non fusionné, non poussé), *reste à faire* (avec où c'est noté).
7. **Passer la main.** Si la session a été longue, dire à Bastien de taper `/compact` : c'est une commande de l'interface, que l'agent ne peut pas lancer lui-même. Le dire en dernière ligne du compte rendu, sans l'exécuter.

## Fini quand

La liste « à soi » de l'étape 1 est vide ou chaque ligne restante est expliquée dans « laissé », et le compte rendu cite la sortie de `npm run isolation`.
