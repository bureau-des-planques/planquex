## Le ticket

Closes #

<!-- Une PR sans ticket peut être fermée : une PR n'est pas une demande de fonctionnalité
     (docs/agents/issue-tracker.md). Ouvre d'abord l'issue, puis cite-la ici. -->

## Ce qui change

<!-- Le plus petit visuel qui rend le changement clair : un tableau avant/après, une capture
     à 420 × 900, un extrait de sortie. Pas la liste des fichiers : le diff la donne. -->

## La preuve

<!-- Commande exacte, code de sortie, extrait. « Ça marche chez moi » n'est pas une preuve. -->

- [ ] `npm run check`
- [ ] `npm run format:check`
- [ ] `npm test` — avec au moins un test qui couvre le changement
- [ ] `npm run garde-fous` — une garde nouvelle est ancrée (test « le contrôle mord » ou entrée de `scripts/ci/garde-fous.mjs`)
- [ ] `npm run build` — `dist/index.html` et `dist/sw.js` présents
- [ ] Un écran touché : une capture (`npm run capturer`), pas la lecture du JSX
- [ ] Une règle, un mot ou un périmètre touché : la décision datée dans `docs/DECISIONS.md` et la doc à jour

## Le risque à la fusion

<!-- Porte à sens unique (migration du store, schéma Supabase, renommage d'id) ou à double
     sens (se défait par `git revert -m 1 <merge>`) ? Ce qui casse si c'est faux. -->

<!-- La CI de la PR ne dit pas l'état de `main` : cette case est le seul rappel qui arrive à
     l'endroit où la fusion se décide (#258, D-115). -->

- [ ] Avant de fusionner : `npm run ci:etat` sort 0 — `main` est green (si elle est rouge, on ne fusionne pas sans savoir pourquoi)

<!-- Fusion : merge commit uniquement, sujet « merge: <ce que ça change> (#N) » (AGENTS.md §11). -->
