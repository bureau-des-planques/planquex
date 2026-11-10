# AGENTS.md — Bureau des Planqués

> Projet actif : **`planquex/`** (D-047). Les **versions abandonnées** vivent dans un dossier frère,
> hors du dépôt (§9) : lecture seule, jamais source de vérité. Les numéros de section de ce fichier
> sont cités partout dans le dépôt : ne pas les renuméroter.

## 1. Règles d'or

1. Lire ce fichier. Pour `docs/DECISIONS.md` (202 décisions, ~324 000 caractères), ouvrir son **index** (`docs/DECISIONS-INDEX.md`) et lire les seules décisions qui touchent ta zone. Un point de règle non tranché se signale, il ne s'invente pas.
2. Travailler dans `planquex/` sauf demande explicite. Ne pas modifier les versions abandonnées (§9).
3. Une affirmation sans commande, test ou fichier cité est une **hypothèse**, pas un fait.
4. Ne pas changer les règles de base, le vocabulaire ou le périmètre sans une décision datée dans `docs/DECISIONS.md`.
5. Ne pas copier le contenu, les règles, les assets ou les pourcentages des versions abandonnées (§9).
6. Aucune mécanique maison au mode standard. Seule exception actée : « Changement de priorité » (D-004).
7. Aucune dépendance sans nécessité démontrée, et toujours signalée. La liste des dépendances signalées est dans `docs/ARCHITECTURE.md` (section « Déplacé d'`AGENTS.md` »).
8. Après une modification : au minimum `npm run check` et les tests concernés ; un build cassé se dit explicitement.

## 2. Sources de vérité

En cas de conflit, cet ordre tranche :

1. **`docs/DECISIONS.md`** — décisions datées, autorité finale. Porte d'entrée : `docs/DECISIONS-INDEX.md` (dérivé par `npm run index:decisions`).
2. **`docs/JEU.md`** — §3 vocabulaire, §4 règles de jeu, §5 écriture des cartes. Une ligne de §4 s'appuie sur une capture (`docs/preuves/astuces-*`) ou une recherche citée (`docs/preuves/regles-*`) (D-034) ; si elles se contredisent, **la capture l'emporte** et l'écart se signale.
3. **`docs/CARD-SPEC.md` et `docs/FACTIONS.md`** — structure du set, courbes, factions, nommage.
4. **`docs/MIROIR-2026-DELTAS.md`** — écarts connus avec le jeu de référence et leurs verdicts. Aucun écart ouvert : il ne sert pas à changer une règle sans décision.
5. **Le code et les commandes** — un écart avec les docs est un bug ou une tâche, pas une règle.
6. **`docs/STATUS.md` et `docs/archives/AUDIT-*.md`** — instantanés datés : relancer les commandes.

Hors de l'ordre : `PRODUCT.md` (contexte de `impeccable`, D-176), `docs/MODES-FUTURS.md` (modes parkés, D-019), et les documents **gelés** `docs/PROPOSITION.md` §3–5, `docs/CORRESPONDANCES.md`, `docs/NOMMAGE.md` (D-112) : ils ne tranchent rien et ne se remettent pas à jour. Deux documents qui se contredisent : citer les passages et proposer une correction, ne pas choisir en silence.

## 3. Vocabulaire

→ **`docs/JEU.md` §3** : termes, factions, mots interdits. À lire dès qu'on touche un texte affiché ou un identifiant.

## 4. Règles du jeu

→ **`docs/JEU.md` §4** : le tableau du mode standard. C'est lui qui fait foi.

## 5. Écriture des cartes

→ **`docs/JEU.md` §5** : raretés, identifiants, évolution, COMEX, effets, textes, stats.

## 6. Architecture et conventions

Application **Vite plate** : ne pas restructurer sans décision. **`docs/ARCHITECTURE.md`** porte le détail de chaque zone (moteur, store, CI, PWA, CSS, comité, Discord, gflow) : le lire avant d'y toucher.

- **UI en français**, identifiants de code en anglais. Aucun texte de carte hors de `src/data`.
- **Moteur** : code pur, sans React ni DOM ; `applyAction(state, action)` est le seul point qui journalise (`actionLog`), `replayBattle` rejoue une partie. Le hasard vient de `src/game/rng.ts` : aucun `Math.random()` dans `src/game/` ni `src/store/` (gardé par `scripts/gardes/interdits-src.test.ts`).
- **Store** : Zustand + `persist`, clé `bureau-des-planques-v1`. Toute modification de forme se migre dans `migratePersisted` (`src/store/useStore.ts`, seule source du numéro).
- **Données** : un fichier par faction, agrégé par `src/data/index.ts`. `FACTION_META` est la seule source de la Vulnérabilité et de la couleur ; le vocabulaire partagé vit dans `src/data/vocabulaire.ts`.
- **Version** : lire `docs/VERSIONS.md` avant d'écrire un numéro.
- **Tests** : Vitest, `*.test.ts` à côté du code. Pas de test = pas de preuve. Un test n'ouvre rien sur le poste (`src/test/setup-poste.ts`).
- **Garde-fous** : une assertion qui garde une **règle** doit **pouvoir échouer** — soit un test « le contrôle mord » face à un **cas fautif**, soit une entrée commentée dans `scripts/ci/garde-fous.mjs` (`npm run garde-fous`).
- **Style** : une seule feuille, `src/styles.css` (Tailwind v4) ; le système visuel est `DESIGN.md`.
- **Preuve de rendu** : un écran se déclare rendu par capture ou inspection du navigateur, jamais par lecture du JSX ; une animation, par une planche de frames (`scripts/preuves/filmer-animation.mjs`). Voir §8.4.
- **MCP `gflow`** : `gflow_generate_video`, `gflow_upscale_video` et `gflow_download_media` **dépensent des crédits Veo** : interdits, seuls les outils image sont autorisés. `gflow_auth_status` avant toute génération ; le modèle se passe par son **alias** (`nano2`, `nano2-lite`, `nano-pro`, `image4`).

## 7. Commandes

Le tableau des commandes et leurs pièges : **`docs/COMMANDES.md`**, depuis `planquex/`.

- **Installer** : `npm run installer`. Jamais `npm ci` dans le dépôt principal (le script le refuse).
- **Lire un ticket** : `gh issue view N --json number,title,body,labels,comments`. Sans `--json`, `gh` échoue ; pour réécrire le corps d'une PR, `gh api --method PATCH repos/<org>/<dépôt>/pulls/<n>`.

## 8. Audits

Un audit est une **preuve**, pas une opinion, et se fait sur `planquex/`.

### 8.1 Protocole

1. Lire `AGENTS.md`, l'index des décisions, puis les docs concernés.
2. Noter pour chaque commande : **commande exacte, exit code, extrait exact**.
3. Séparer **observé** (commande, fichier) et **non vérifié** (déduit).
4. Ne jamais conclure « fait » sans test, build, capture ou sortie de commande.
5. Vérifier le code, pas seulement les docs.
6. Signaler les blocages préexistants, sans les masquer ni les attribuer au changement en cours.

### 8.2 à 8.3 et 8.5 — batterie, pièges, format de rapport

Dans `docs/agents/audit.md`.

### 8.4 Definition of done

Pour une modification de code :

- `npm run check`, `npm run format:check`, `npm test` (avec au moins un test du changement), `npm run garde-fous` et `npm run build` : exit 0, `dist/index.html` et `dist/sw.js` présents.
- Toute garde **nouvelle** est ancrée (cas fautif ou entrée dans `scripts/ci/garde-fous.mjs`). Une assertion qui ne peut pas échouer ne compte pas.
- `npm run ci:etat` : exit 0 avant de **fusionner** vers `main` — si `main` est rouge, on ne fusionne pas sans savoir pourquoi (D-115, #258).
- Docs mises à jour si une règle, un vocabulaire, un contenu ou une décision change.

Pour une modification de documentation seule : liens, chemins et commandes valides, aucune contradiction avec `docs/DECISIONS.md`.

## 9. Legacy

Les versions abandonnées (première version JavaScript, version « pocket », APK décompilé) sont dans un **dossier frère, hors du dépôt**, en **lecture seule**. On y consulte une idée d'UI ou l'inventaire de l'APK ; leur vocabulaire, leurs règles (`RULES-4b`), leurs cartes et leurs pourcentages n'ont **aucune valeur** ici (§1.2, §1.5). Leur ancien vocabulaire est refusé dans `src/` par `scripts/gardes/interdits-src.test.ts`.

## 10. Agent skills

- **Issue tracker** : GitHub Issues sur `bureau-des-planques/planquex`, via `gh`. Voir `docs/agents/issue-tracker.md`.
- **Triage labels** : les cinq rôles canoniques gardent leurs noms (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Voir `docs/agents/triage-labels.md`.
- **Domain docs** : contexte unique — `docs/JEU.md` §3 à §5 et `docs/DECISIONS.md`. Voir `docs/agents/domain.md`.
- **Parallélisme** : zones, modèles, vagues, fusion. Lire `docs/agents/parallelisme.md` avant de lancer plus d'un agent.

## 11. Branches et fusion

GitHub flow (D-113) : une seule branche longue, `main`, protégée par un ruleset (D-118). Pas de branche `dev`.

- Un ticket = une **branche dédiée dans son worktree**, depuis `main`, proposée par **pull request** vers `main`, supprimée après fusion.
- **Fusion : merge commit uniquement**, jamais de squash ni de rebase. Sujet : `merge: <ce que ça change> (#N)`. Les agents citent leurs hashes ; `git branch -d` (skill `cloture`) ne vaut qu'après un merge commit ; un ticket se défait par `git revert -m 1 <merge>`.
- Fermer, ouvrir ou re-étiqueter une issue **`alpha` ou `beta`** périme `src/data/plan-dev.ts` : `npm run plan:dev` avant une release. Le générateur lit **les deux** étiquettes (#336, D-133) : le label dit le **jalon**.
- Protection, dépôt d'infrastructure et historique : `docs/ARCHITECTURE.md` (section « Déplacé d'`AGENTS.md` »).
