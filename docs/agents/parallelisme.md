# Parallélisme — lancer plusieurs agents sans qu'ils se marchent dessus

Écrit le 21/10/2026, après une session où **trois conflits de merge**, **deux worktrees laissés
non commités** et **deux fois la même scorie d'indentation** ont été causés par un manque de
règles, pas par les modèles. Ce document est la règle.

## 1. Zones — un agent par zone et par vague

Une **zone** est un ensemble de fichiers qu'un seul agent peut toucher pendant une vague.
La règle est : **un agent par zone, jamais deux** ; un ticket qui couvre plusieurs zones
**réserve toutes ses zones** pour la vague.

| Zone | Fichiers | Ce qui s'y casse |
|---|---|---|
| **MOTEUR** | `src/game/**` | règles, transitions, reproductibilité — la zone la plus chère |
| **DONNÉES** | `src/data/**` | cartes, factions, socle, invariants de contenu |
| **STORE/UI** | `src/store/**`, `src/components/**`, `src/pages/**` | forme persistée, écrans |
| **SCRIPTS/CI** | `scripts/**`, `.github/**` | harnais, simulateur, garde-fous |
| **DOCS** | `docs/**`, `AGENTS.md`, `DESIGN.md`, `CARD-SPEC.md`, `README.md`, `package.json` | l'autorité (`AGENTS.md` §2) |
| **ART** | `design/**`, `public/design/**` | illustrations, registre |

**Zones partagées, à attribuer explicitement** (source des trois conflits de la session) :

- `scripts/garde-fous.mjs` et `scripts/garde-fous.test.ts` — **un seul auteur par vague**, et
  **vérification par commande avant tout commit** (voir §5) ;
- `src/data/cards.test.ts` — touché par tous les tickets de contenu ; le rattacher à la **zone
  DONNÉES** ;
- `AGENTS.md` — rattaché à la **zone DOCS**, mais **tout agent qui change une règle, une forme
  persistée ou une commande doit le mettre à jour dans SA branche** (c'est ce qu'a fait #91, et
  c'est ce qui évite la dérive relevée trois fois : #98, #87, #113).

## 2. Modèles — chacun à sa tâche

Jamais le modèle qui a implémenté ne relit. La chaîne vient du **benchmark** (`modeles.md`).

| Rôle | Modèle | Pourquoi |
|---|---|---|
| **implémenteur** — code, moteur, tests | `opencode/deepseek-v4.1-flash-free#high` | maillon 1 du benchmark : 3/3, 27–47 s, variante `high` la moins consommatrice |
| **implémenteur** — contenu, rédaction FR | `openrouter/thinkingmachines/inkling:free` | 3/3 au benchmark ; la prose française ne dépend pas du code |
| **relecteur courant** — un lot de tests, une doc, du contenu | `openrouter/thinkingmachines/inkling:free` | 3/3, et **différent** de l'implémenteur |
| **relecteur lourd** — migration de store, moteur, spec | `anthropic/claude-sonnet-5-5#high` | abonnement Claude Pro déjà authentifié ; la voie à restrictions faibles |
| **revue de session** — toute une série de fusions | `anthropic/claude-opus-5-5#high` | c'est elle qui a trouvé ce que les relecteurs par branche ne pouvaient pas voir (le harnais biaisé) |
| **contrôle ponctuel** | `google/gemma-4-26b-a4b-it` | **un seul appel, aucun outil** : `AGENTS.md` est injecté à chaque requête, le palier gratuit plafonne à 16 k jetons d'entrée/minute |

**Budget** : seuls Sonnet et Opus sont payants (abonnement existant). Les réserver aux
migrations de store, au moteur et aux revues de session. Le reste reste gratuit.

## 3. Vagues — ce qui peut tourner ensemble

Une vague = un ensemble de tickets **de zones disjointes**, lancés ensemble ; puis **une seule
fusion à la fois**.

```text
VAGUE : [ MOTEUR ] [ DONNÉES ] [ STORE/UI ] [ SCRIPTS ]   ← 4 agents, 4 zones
        ↓ implémenteurs commitent (hash dans leur message final)
REVUE : [ relecteur par branche ] — jamais sur une branche en mouvement
        ↓ verdicts
FUSIONS: séquentielles (main est mono-flux) : merge-tree → résoudre → vérifier → pousser
        ↓
NOUVELLE VAGUE : worktrees recréés depuis le nouveau main
```

**Ce qui ne peut pas tourner ensemble** (constaté, pas supposé) :

- **deux tickets de la même zone** — `ia.ts` (#114/#109/#94), `useStore.ts` (#117/#106),
  `cards.test.ts` (tous les tickets de contenu) ;
- **`scripts/garde-fous.mjs`** — un seul auteur par vague ;
- **une fusion pendant qu'un agent travaille sur une branche qui touche les mêmes fichiers** ;
- **un relecteur sur une branche non commitée** : il lirait un état mouvant.

**Ce qui peut tourner ensemble** : un relecteur (aucune écriture) **et** des implémenteurs de
zones différentes ; plusieurs relecteurs sur des branches différentes (leur `npm test` est le
seul coût, voir §6).

## 4. Brief d'implémenteur — le squelette qui a fonctionné

1. **Isolation, vérifiée en premier ET en dernier** : répertoire unique, chemin **absolu**,
   `git -C <ce chemin>`, `workdir` pour tout shell. Première et dernière commande :
   `git status --porcelain` sur **son** worktree (ses fichiers) **et** sur le dépôt principal
   (**doit rester vide**). Un agent du 20/10 a écrit dans le dépôt principal faute de cette
   consigne.
2. **Commiter, et citer le hash** dans le message final. Trois agents ont rendu un worktree
   **modifié mais non commité** : ce n'est pas un livrable.
3. **Définition de fini complète** : `check`, `test`, `build` (`dist/index.html` **et**
   `dist/sw.js`), plus `garde-fous`/`pesage`/`simulate` selon la zone.
4. **Périmètre borné et bornes explicites** : ce qu'il ne doit **pas** faire, et quoi faire
   s'il croit nécessaire de sortir du périmètre (**s'arrêter et le dire**).
5. **Une garde nouvelle s'ancre** : un test « le contrôle mord », ou une entrée dans
   `scripts/garde-fous.mjs` (`AGENTS.md` §6).
6. **La doc de la zone se met à jour dans la même branche** si une règle, une forme ou une
   commande change.

## 5. Fusion — le protocole, et ses deux pièges

1. **`git merge-tree --write-tree --name-only main <branche>`** : connaître les conflits
   **avant** de toucher l'arbre. Il ne voit **pas** les conflits **sémantiques** — deux tests
   qui divergent, un `energy` devenu tableau — donc il complète la lecture, il ne la remplace pas.
2. Résoudre : **conserver les deux apports** quand deux branches ont ajouté une entrée à une
   même table (c'est le cas des garde-fous, trois fois).
3. **Un conflit sémantique se MESURE, il ne se choisit pas** : quand #111 et #113 avaient
   chacun « son » chiffre de mesure, la valeur retenue a été **mesurée après les deux
   correctifs**, pas choisie entre deux nombres périmés.
4. **Vérifier PAR COMMANDE avant de commiter** (piège nº 1) : deux fois, un edit de résolution
   a avalé l'indentation d'une ligne, et c'est le test de la table qui l'a attrapé — **après**
   le commit. Vérifier avant : `node -e` sur la table, ou un `grep` de contrôle.
5. **Ne jamais lancer `npm run status` en parallèle de `npm run build`** (piège nº 2) : `vite`
   vide `dist/`, donc `status` lit un `dist/` en cours d'écriture et annonce
   `distIndex: false`. Constaté par un agent de la session.
6. Après fusion : `check`, `test`, `build` (`+ garde-fous`, `+ pesage` si la mesure est en jeu),
   puis **pousser**. La CI refait `garde-fous` de son côté.

## 6. Concurrence machine — ne pas saturer

- `npm test` lance un **worker par fichier de test** : ~46 aujourd'hui. Trois suites en
  parallèle sur 12 cœurs saturent déjà. **Maximum 3 agents simultanés** en pratique (et
  `maxParFournisseur` 2 côté lanceur historique).
- Les modèles gratuits **dégradent sous charge** : la passe « 3 sessions simultanées » du
  benchmark a fait décrocher `nemotron-ultra` (TTFT 2,6 s → 8,8 s, coupé).
- Un `429` se lit **« réessaie plus tard »**, jamais « le modèle ne sait pas faire » — et on
  **espace** les tentatives d'au moins une minute sur une même clé.

## 7. Ce qui ne se délègue pas à un agent

- **une décision** : un acte daté (`docs/DECISIONS.md`) est humain. Un agent peut **préparer**
  l'arbitrage (options, chiffres, conséquences) ; il ne le tranche pas ;
- **une mesure** : l'agent produit le chiffre, la personne qui orchestre **le reproduit**
  (`npm run pesage`) avant de clore ;
- **une production d'art** (#97) : la curation est humaine, l'agent branche et consigne ;
- **un tableau de bord** (#10, #75, #100) : aucune API ici pour renommer un projet Supabase ou
  retirer un domaine Vercel.

## 8. File d'attente — l'état au 21/10/2026

| Ticket | Zone | Modèle d'implémentation | Relecteur |
|---|---|---|---|
| #114 IA lit l'avenir | MOTEUR | maillon 1 | inkling (courant) |
| #117 Choix de types vs Chariot | STORE/UI | maillon 1 | inkling (courant) |
| #106 Migration v2→v4 verrouillée | STORE/UI (+ `cards.test.ts`) | maillon 1 | inkling (courant) |
| #109 Durcir la mesure | MOTEUR (+ `scripts/`) | maillon 1 | **Sonnet 5.5** (mesure) |
| #94 IA niveau 3 | MOTEUR | **à repenser** : bloqué par #111, dont le résultat retire son préalable | — |
| #97 Les 10 signature | ART | production **humaine** | — |

**Attendent un acte humain** : #100, #102, #104, #105, #110, #115, #119, #10, #75 — une
décision ou un tableau de bord. Un agent peut **préparer** chacun (options + conséquences
chiffrées) ; il ne les tranche pas.

**Le débit est donc limité par deux choses** : la **disponibilité des décisions** et le
**nombre de zones disjointes**. Pour « lancer beaucoup d'agents », il faut d'abord **découper
le travail en zones** — pas empiler des agents sur la même.