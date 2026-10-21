# Profil « infra » — déployer, configurer, pas coder

Ouvrir une session **dans ce dossier** quand le travail n'est pas du code :

- Vercel : domaine `grevomon.vercel.app` à détacher, projet à surveiller, journaux de déploiement ;
- Supabase : schéma, migrations, extensions du projet `jzlcwnozlzhadatksvgh` (**lecture seule**) ;
- Brevo : expéditeur des courriels.

C'est le ticket **#100** (`docs/RENOMMAGE.md` §8, étapes 5 et 6) et le wizard
`scripts/finir-renommage-planquex.sh`, qui reste **interactif** : il ouvre des navigateurs et
attend une personne.

## Ce que cette session a en plus

`supabase` et `vercel` (voir `opencode.jsonc` à côté), hérités de la maison, de `gamedev/` et de
`planquex/`. Ensemble, ils exposent **plus de 240 outils** — c'est précisément pourquoi ils ne
sont pas déclarés à la racine du projet.

## Comment travailler ici

Le dossier courant est ce dossier : les commandes qui visent le dépôt doivent nommer leur
répertoire, par exemple `npm run check --prefix ../..` ou, plus lisible, poser `workdir` sur
`/home/chapax/Documents/opencode/gamedev/planquex` dans l'outil `shell`.

Les règles du projet restent celles de `planquex/AGENTS.md` : il est découvert automatiquement
depuis ici, comme `../../AGENTS.md` et `../../../AGENTS.md`.
