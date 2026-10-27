# Contribuer au Bureau des Planqués

**Une issue d'abord, une branche ensuite, une pull request pour finir — et une preuve à chaque
étape.** Ce guide dit comment, pour une personne comme pour un agent. Il ne crée aucune règle :
les règles sont dans [`AGENTS.md`](AGENTS.md), les décisions dans
[`docs/DECISIONS.md`](docs/DECISIONS.md), et ce fichier y renvoie.

| Je veux… | Section |
|---|---|
| installer le projet sur ma machine | [Cloner et installer](#cloner-et-installer) |
| signaler un défaut ou proposer une idée | [Poser une issue](#poser-une-issue) |
| prendre un ticket et le faire | [Résoudre une issue](#résoudre-une-issue) |
| proposer mon travail | [Proposer une pull request](#proposer-une-pull-request) |
| brancher Claude Code, Codex, OpenCode ou VS Code | [Outiller son agent](#outiller-son-agent) |
| savoir quel skill lancer à quel moment | [Quel skill pour quel geste](#quel-skill-pour-quel-geste) |
| trouver la bonne commande | [Les scripts](#les-scripts) |

## Avant de commencer

**Lire `AGENTS.md`, puis seulement les décisions qui touchent sa zone.** `docs/DECISIONS.md` est
long ; son [index](docs/DECISIONS-INDEX.md) tient une ligne par décision, et c'est par lui qu'on
entre.

Ce qui ne se négocie pas dans une PR, parce que c'est tranché ailleurs :

- **Les règles du jeu** sont un miroir de TCG Pocket (`AGENTS.md` §4). Changer une règle, un mot du
  vocabulaire ou le périmètre demande une **décision datée**, pas un commit.
- **Le jeu est en français** : interface, cartes, docs. Les identifiants de code restent en anglais.
- **Le moteur est pur** : ni React ni DOM dans `src/game/`, et aucun `Math.random()` — le hasard
  vient du générateur à graine (`src/game/rng.ts`).
- **Aucune dépendance nouvelle** sans nécessité démontrée et signalée (`AGENTS.md` §1.7).
- **Une affirmation sans commande, test ou fichier cité est une hypothèse.** Ça vaut pour un
  commentaire de PR comme pour un rapport d'agent.

## Cloner et installer

**Node 24, npm, git ; `gh` pour les tickets ; Chrome pour les captures.**

```bash
git clone https://github.com/bureau-des-planques/planquex.git
cd planquex
nvm use                              # .nvmrc → Node 24, celui de la CI
npm run installer -- --principal     # npm ci dans le clone
npm run dev                          # http://localhost:5178
```

Sans droit d'écriture sur le dépôt, on **forke** d'abord, et la PR part du fork vers `main`.

**Un ticket = un worktree.** Le clone reste sur `main` et ne sert qu'à en créer :

```bash
git fetch origin
git worktree add -b docs/mon-sujet ../planquex-mon-sujet origin/main
cd ../planquex-mon-sujet
npm run installer                    # npm ci, dans le worktree
```

⚠️ **`npm ci` vide `node_modules/` avant de le reconstruire.** Lancé dans le clone principal, il
casse les sessions qui y tournent : `npm run installer` le refuse, sauf `-- --principal`, qui est
le geste d'une personne qui sait que rien d'autre n'y tourne.

`.env` est **facultatif** : sans lui, le jeu tourne et le mur du comité lit `docs/comite.json`.
Pour brancher Supabase, copier `.env.example` en `.env`.

🔒 La seule clé du client est la **clé publique** (`VITE_SUPABASE_ANON_KEY`). Une clé de service
contourne les règles d'accès : le module la refuse, et aucun secret ne se commite. Les secrets de
poste vivent hors du dépôt (`~/.secrets/`), lus par `{file:~/.secrets/<nom>}`.

## Poser une issue

**Un testeur de l'alpha passe par le comité, dans le jeu ; un développeur passe par GitHub.** Les
deux sont suivis : un post-it **IP** (idée) ou **OUF** (défaut) sur le
[mur](https://planquex.4k7.org/comite) avance par le tri comme une issue.

Sur GitHub, deux formulaires : [**Signaler un défaut**](https://github.com/bureau-des-planques/planquex/issues/new?template=bug.yml)
et [**Proposer une idée**](https://github.com/bureau-des-planques/planquex/issues/new?template=idee.yml).
Ils posent déjà les étiquettes de départ.

Un ticket trié porte **trois dimensions**, et exactement une de chaque
([`docs/agents/triage-labels.md`](docs/agents/triage-labels.md)) :

| Dimension | Étiquettes | Qui la pose |
|---|---|---|
| **Catégorie** | `bug` · `enhancement` (· `documentation`) | le formulaire, à la création |
| **État** | `needs-triage` → `needs-info` · `ready-for-agent` · `ready-for-human` · `wontfix` | `needs-triage` à la création, puis le tri |
| **Étape** | `alpha` · `beta` · `release` | le tri, quand le ticket bloque une étape |

Le **domaine** n'est pas une étiquette : il ouvre le titre — `Combat — …`, `Collection — …`,
`Infra — …`, `Docs — …`. On filtre par `gh issue list --search "Combat in:title"`.

En ligne de commande :

```bash
gh issue create --title "Combat — …" --body-file corps.md --label bug --label needs-triage
gh issue view 328 --json number,title,body,labels,comments   # --json est obligatoire, voir plus bas
```

## Résoudre une issue

**Lire le ticket, poser un test qui échoue, corriger le minimum, prouver.**

1. **Prendre le ticket** : `gh issue edit <n> --add-assignee @me`. Un ticket `ready-for-human`
   attend une personne (une décision, un prototype) ; un `ready-for-agent` est spécifié pour un agent.
2. **Une branche par ticket**, depuis `main`, nommée `<type>/<sujet>` — `feat/`, `fix/`, `docs/`,
   `chore/`, `refactor/` — dans son worktree.
3. **Rester dans sa zone** : moteur (`src/game/`), données (`src/data/`), store/UI, scripts/CI,
   docs, art. Deux agents ne touchent pas la même zone dans la même vague
   ([`docs/agents/parallelisme.md`](docs/agents/parallelisme.md)).
4. **Le test d'abord.** Un défaut se reproduit par un test rouge avant d'être corrigé. Une garde
   nouvelle doit **pouvoir échouer** : un test « le contrôle mord », ou une entrée de
   `scripts/garde-fous.mjs`.
5. **Commiter petit, au format du dépôt** : `type(zone): ce que ça change (#n)`, en français.
   Exemple réel : `fix(env): le serveur des testeurs renvoie à D-120, pas à D-119 (#323)`.
6. **Tenir le ticket à jour** : un commentaire à la fin, avec ce qui est fait, la preuve et les
   hashes. On ne ferme que ce qui est fait **et** vérifié
   ([`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)).

Avant de proposer, la définition de « fini » (`AGENTS.md` §8.4) :

- [ ] `npm run check` — exit 0
- [ ] `npm run format:check` — exit 0 (ou `npm run format` l'a fait)
- [ ] `npm test` — exit 0, avec au moins un test qui couvre le changement
- [ ] `npm run garde-fous` — exit 0
- [ ] `npm run build` — exit 0, `dist/index.html` et `dist/sw.js` présents
- [ ] un écran touché : une capture (`npm run capturer`), jamais la seule lecture du JSX
- [ ] une règle, un mot, un contenu ou une décision touchés : la doc suit dans la même branche

## Proposer une pull request

**Vers `main`, avec son ticket, sa preuve et son risque.** Le
[modèle de PR](.github/pull_request_template.md) pose les trois questions.

- **Une PR sans ticket peut être fermée** : ici, une PR n'est pas une demande de fonctionnalité.
  L'idée passe d'abord par une issue, qui se discute avant de se coder.
- **La CI lance trois jobs en parallèle** — contrôles, tests du noyau, tests des écrans — et les
  trois sont exigés par la protection de `main`. Un job rouge se reproduit en local par la même
  commande (`npm test -- --project=node`, `-- --project=ui`).
- **Fusion par merge commit uniquement.** Ni squash ni rebase : le dépôt ne les propose même pas.
  Sujet : `merge: <ce que ça change> (#n)`. Un ticket entier se défait par `git revert -m 1 <merge>`.
- **Avant de fusionner** : `npm run ci:etat` — si `main` est rouge, on ne fusionne pas sans savoir
  pourquoi.
- **Après** : la branche est supprimée par GitHub ; le worktree se retire à la main
  (`git worktree remove`, puis `git branch -d`).

Le skill `pr` donne la forme du corps : le plus petit visuel qui rend le changement clair, la
preuve avant/après, et le risque de fusion (porte à sens unique ou à double sens).

## Outiller son agent

**`AGENTS.md` porte toutes les règles ; chaque outil la lit à sa façon.** Rien n'est à recopier
d'un outil à l'autre.

| Outil | Ce qu'il lit dans le dépôt | Ce qu'il faut installer |
|---|---|---|
| **OpenCode** | `AGENTS.md` · `opencode.jsonc` · `.agents/skills/` · `.opencode/skills/` · `.opencode/commands/` | les skills de Matt Pocock (voir plus bas) |
| **Claude Code** | `CLAUDE.md`, qui importe `AGENTS.md` | le plugin des skills de Matt Pocock, et Impeccable |
| **Codex** | `AGENTS.md` | le plugin des skills de Matt Pocock, et Impeccable |
| **VS Code** | `.vscode/settings.json` · `.vscode/extensions.json` | les extensions recommandées (Prettier, Vitest, Tailwind CSS) |

### Les skills : trois sources

| Source | Où elle vit | Qui la voit |
|---|---|---|
| **Les skills du dépôt** — `cloture` et les skills d'interface (`baseline-ui`, `improve-ui`, `fixing-accessibility`, `fixing-motion-performance`, `create-design-md`) | `.agents/skills/` (ceux de `a-revoir/` sont rangés à part, en attente de tri) | OpenCode, qui lit `.agents/skills/`. Claude Code ne lit que `.claude/skills/` |
| **Impeccable** — le skill de design et son détecteur | `.opencode/skills/impeccable/` et la devDependency `impeccable` | OpenCode tel quel ; les autres outils par `npx impeccable install` |
| **Les skills de Matt Pocock** — tickets, TDD, revue, PR | **hors du dépôt**, chez chacun | l'outil où on les installe |

**Installer les skills de Matt Pocock** ([source](https://github.com/mattpocock/skills)) — un seul
canal par outil, sinon chaque skill apparaît deux fois :

```bash
# Claude Code
claude plugin install mattpocock-skills@claude-plugins-official

# Codex
codex plugin marketplace add mattpocock/skills
codex plugin add mattpocock-skills@mattpocock

# OpenCode (ou tout autre agent) : copie des fichiers, mise à jour à la main
npx skills@latest add mattpocock/skills -a opencode
```

Dans VS Code avec Copilot : **Chat: Install Plugin From Source**, puis
`https://github.com/mattpocock/skills`. Quand l'installeur demande lesquels prendre, inclure
`setup-matt-pocock-skills`.

**Installer Impeccable** pour Claude Code et Codex (OpenCode l'a déjà) :

```bash
npx impeccable install -y --providers=claude,codex --scope=project
```

Le scope `project` écrit le skill dans le dossier de travail : ces fichiers sont à soi, ils ne
partent pas dans une PR.

Le détecteur, lui, n'a besoin de rien : `npm run detect:ui` lance la version épinglée de
`package.json`, sans réseau.

### Le setup des skills : déjà fait, et quoi répondre

**`/setup-matt-pocock-skills` a déjà tourné sur ce dépôt** : son résultat est `AGENTS.md` §10 et
les trois fichiers de [`docs/agents/`](docs/agents/). On ne le relance que pour changer de tracker
ou repartir de zéro — sur un fork, par exemple. Les réponses qui correspondent à ce dépôt :

| Section du setup | Question | Réponse |
|---|---|---|
| **A** — Issue tracker | où vivent les tickets ? | **GitHub** — `bureau-des-planques/planquex`, par `gh` |
| **B** — Triage labels | garder les étiquettes par défaut ? | **oui** — les cinq états gardent leur nom ; catégories et étapes sont décrites dans `docs/agents/triage-labels.md` |
| **C** — Domain docs | un contexte ou plusieurs ? | **un seul** (*single-context*) — le vocabulaire est `AGENTS.md` §3 |

⚠️ **Le setup écrit dans `CLAUDE.md` dès que ce fichier existe** — et il existe ici, pour Claude
Code. Après une relance, remettre le bloc `## Agent skills` dans `AGENTS.md` §10 et laisser
`CLAUDE.md` réduit à son import : une règle écrite dans `CLAUDE.md` ne serait vue que par un outil.

### Quel skill pour quel geste

| Geste | Skill | Ce qu'il produit |
|---|---|---|
| ne pas savoir par où commencer | `ask-matt` | le skill et l'enchaînement qui conviennent |
| trier ce qui est arrivé | `triage` | une issue qui avance d'un état, avec ses étiquettes |
| clarifier une idée avant d'écrire | `grill-with-docs` | une idée tranchée, le vocabulaire de `AGENTS.md` §3 tenu |
| écrire le ticket | `to-spec`, puis `to-tickets` | une spec sur le tracker, puis des tickets avec leurs blocages |
| un chantier qui dépasse une session | `wayfinder` | une carte de tickets de décision, résolus un par un |
| faire le ticket | `implement` — qui enchaîne `tdd` et finit par `code-review` | du code testé sur sa branche |
| faire toute une spec | `implement-spec` | les tickets en parallèle sur une branche d'intégration |
| un défaut coriace | `diagnosing-bugs` | une boucle rouge sur le défaut, puis le correctif et son test |
| tester une idée d'écran | `prototype` | une maquette jetable, hors du bundle |
| relire | `code-review` | deux revues en parallèle : les standards du dépôt et la spec |
| relire un écran | `impeccable`, `improve-ui` | les défauts d'interface vérifiés, et leur plan de correction |
| écrire la PR | `pr` | le corps : visuel, preuve, risque |
| finir la session | `cloture`, puis `retro` ou `handoff` | worktrees retirés, reste à faire noté, suite transmissible |

Un skill ne remplace pas la lecture de `AGENTS.md` : il l'applique.

### Les serveurs MCP

**Aucun n'est nécessaire pour développer.** Un MCP se déclare au niveau qui s'en sert, jamais plus
haut, et chacun coûte du contexte à chaque session.

| Serveur | Où il est déclaré | À quoi il sert |
|---|---|---|
| `gflow` | `opencode.jsonc` du dépôt | les illustrations des cartes : binaire `gflow` et compte Flow requis. Seuls les outils **image** sont permis — les trois outils vidéo dépensent des crédits |
| `context7` | au-dessus du dépôt, chez le mainteneur | la documentation à jour des bibliothèques |
| `vercel`, `supabase` | uniquement dans la session d'infrastructure, hors du dépôt public | déploiement, base, domaine |

Sans `gflow` installé, le serveur échoue au démarrage et le reste fonctionne : il n'y a rien à
faire. **Ne pas le désactiver dans `opencode.jsonc`** pour son confort — le fichier est partagé, et
en OpenCode V2 la configuration du projet l'emporte sur la configuration globale, donc une
surcharge dans `~/.config/opencode/` ne le couperait pas.

Un serveur utile partout s'ajoute en global, une ligne :
`opencode mcp add context7 --global --url https://mcp.context7.com/mcp`.

## Les scripts

**Chaque commande se lance depuis la racine ; son mode d'emploi complet est dans
[`docs/COMMANDES.md`](docs/COMMANDES.md).** Deux conventions reviennent partout : `-- --verifie`
n'écrit rien et sort 1 si un fichier a divergé, `-- --json` rend une sortie pour la machine.

**Tous les jours**

| Commande | Usage |
|---|---|
| `npm run dev` | le serveur Vite, port 5178 |
| `npm run check` | les types |
| `npm test` | toute la suite ; `-- --project=node` (moteur, données, scripts) ou `-- --project=ui` (écrans) |
| `npm run test:watch` | Vitest en continu |
| `npm run format` / `format:check` | formater / vérifier ; `src/data/` et les docs ne sont jamais reformatés |

**Avant une PR**

| Commande | Usage |
|---|---|
| `npm run garde-fous` | mute les invariants critiques et exige que la suite échoue ; `--verifie` contrôle la table sans muter |
| `npm run build` | le build de production, `dist/index.html` et `dist/sw.js` |
| `npm run build && npm run capturer` | les écrans à 420 × 900 dans `captures/` ; échoue sur une erreur de console, un bouton sous 44 px, une marge sous 20 px |
| `npm run detect:ui` | le détecteur d'UI sur les sources |
| `npm run detect:ui:page` | le détecteur sur les écrans servis, avec un cliquet : un anti-pattern de plus fait tomber la commande |
| `npm run ci:etat` | le dernier run de CI sur `main` ; sort 1 s'il n'est pas vert |

**Lire l'état du projet**

| Commande | Usage |
|---|---|
| `npm run status` | les métriques en JSON, dont les cartes par rareté et par faction |
| `npm run simulate -- --games 100 --seed 42` | des parties sans écran, reproductibles |
| `npm run pesage -- --games 100 --json` | le niveau 2 de l'adversaire bat-il le niveau 1 ? Seuil fixé d'avance |
| `npm run index:decisions` | réécrit `docs/DECISIONS-INDEX.md` depuis le journal |

**Préparer une release** (procédure : [`docs/VERSIONS.md`](docs/VERSIONS.md) §4)

| Commande | Usage |
|---|---|
| `npm run notes:versions` | relit les releases GitHub et réécrit `src/data/versions.ts`, lu par `/feuille-de-route` |
| `npm run plan:dev` | relit les issues `alpha` ouvertes et réécrit `src/data/plan-dev.ts` |
| `npm run problemes` | les problèmes connus, lus dans la base du comité ; demande une configuration hors dépôt |

**Le poste de pilotage**

| Commande | Usage |
|---|---|
| `npm run installer` | `npm ci` sans risque pour les autres sessions |
| `npm run isolation` | vérifie qu'un agent n'a écrit que dans son worktree ; à lancer après chaque agent |
| `npm run serveurs` | le tableau de bord des serveurs Vite et des worktrees, port 5180 |
| `npm run admin` | le poste d'administration local, port 5199 |
| `node scripts/filmer-animation.mjs` | une planche de frames : la seule preuve valable d'une animation |

Les ports déjà pris : 5178 (dev), 5180 (serveurs), 5199 (admin), 4180 (preview), 4179
(détecteur). Un prototype prend un autre port : `npm run dev -- --port 5201 --strictPort`.

## Pièges connus

| Piège | Ce qui se passe | Le geste |
|---|---|---|
| `gh issue view 42` sans `--json` | sort 1 : l'avertissement « Projects (classic) » compte comme une erreur | toujours `--json number,title,body,labels,comments` |
| `gh pr edit --body-file` | échoue pour la même raison | `gh api --method PATCH repos/bureau-des-planques/planquex/pulls/<n>` avec un JSON `{"body": …}` |
| écran blanc en dev | un service worker de build répond sur `localhost:5178` | DevTools → Application → *Unregister*, puis *Clear site data* ([détail](docs/COMMANDES.md#71-piège-connu--le-service-worker-casse-le-dev-sur-la-même-origine)) |
| un décompte écrit dans une doc | `scripts/compteurs.test.ts` le refuse | renvoyer à `npm run status` ou `npm test` |
| un numéro de version écrit dans `src/` | `src/version.test.ts` le refuse | lire `src/version.ts`, seule porte vers `package.json` |
| un fichier de `src/data/` reformaté | un texte de carte change à l'écran | `.prettierignore` l'exclut ; `.vscode/settings.json` le respecte à l'enregistrement |

Merci de contribuer. Le ton du jeu vise les postures et le système, jamais une personne : les
échanges sur le dépôt suivent la même règle.
