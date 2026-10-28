# Modèles des agents — la chaîne de repli

Le choix des modèles gratuits n'est pas une intuition : il vient du **benchmark
`bench/`** du projet `Chapax/opencode-config`, sur une **tâche fixe de ce
dépôt** (la règle « 2 exemplaires maximum du même nom », `docs/JEU.md` §4 ;
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

> **27/10/2026 — cette politique n'est plus dans la configuration.** Aucun fichier de
> `~/.config/opencode/agents/` ne porte de clé `model:` (PR `Chapax/opencode-config#26`).
> La raison est mécanique : le routeur de quota ne touche pas un modèle qu'il considère
> **hors chaîne**, donc un agent épinglé traverse la chaîne sans jamais être replié — c'est
> ce qui a laissé une session mourir sur un gratuit épuisé le 26/10 (#221, D-099).
> Ce qui choisit, désormais : le **routeur** pour une session interactive, `chaineDeRepli`
> pour `agents lance`. Ce qui suit est donc une **recommandation de choix manuel** — quel
> modèle prendre quand on choisit soi-même — et non plus ce que la machine imposera.

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

⚠️ **Quota du palier gratuit (mesuré le 20/10/2026, six tentatives)** : sur le fournisseur
`google`, un `429` tombe sur `Quota exceeded … limit: 16000, model: gemma-4-26b`, des jetons
d'entrée **par minute et par clé**.

Cause **structurelle**, pas conjoncturelle : dans ce dépôt, `AGENTS.md` est **injecté dans
chaque requête** (~10–12 k jetons). **Une seule requête** consomme donc presque tout le
plafond de 16 k/minute, et une relecture qui enchaîne plusieurs appels d'outils se fait
couper dès le deuxième. Une analyse antérieure attribuait le `429` à une salve de
tentatives : **c'était faux**, la cause est le contexte injecté.

Conséquence : **Gemma 4 ne peut pas mener une relecture multi-étapes dans ce dépôt**.

**Décision de Bastien (20/10/2026)** — trois paliers, et **jamais le modèle qui a implémenté** :

| Charge | Modèle | Coût |
|---|---|---|
| relecture **courante** | chaîne **gratuite** du benchmark : `openrouter/thinkingmachines/inkling:free` (3/3) ou `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` (3/3, plus lent) | 0 |
| relecture **lourde** (migration de store, moteur, spec) | **abonnement Claude Pro**, déjà authentifié par `opencode-claude-auth` : `anthropic/claude-opus-5-5` ou `anthropic/claude-sonnet-5-5` (moins cher) | abonnement existant |
| contrôle **ponctuel autoportant** | **Gemma 4** (un extrait collé, une question fermée, **aucun outil**) | 0 |

La voie « abonnement Claude Pro » est **la seule à restrictions faibles qui existe déjà** dans
cet environnement : aucune carte ni clé nouvelle n'a été nécessaire pour lancer la revue Opus 5.5
du 20/10/2026.

### La piste « abonnement Google » — vérifiée le 20/10/2026, et elle est fermée

Quatre plugins npm exposent une authentification Google OAuth, le pendant exact de
`opencode-claude-auth` : `opencode-gemini-auth` (2.0.1), `opencode-google-auth` (0.0.9),
`opencode-antigravity-auth` (1.6.0), `opencode-gemini-cli-auth` (0.0.1). Tous promettent
« utiliser votre offre Google existante au lieu de la facturation à l'API ».

Mais le README du plus maintenu (`opencode-gemini-auth` 2.0.1) porte l'avertissement qui
tranche : **Google a déprécié l'accès Gemini Code Assist pour les comptes particuliers le
18 juin 2026**. Le flux OAuth **ne fonctionne plus** pour *Gemini Code Assist for
individuals*, **Google AI Pro** ni **Google AI Ultra** — Google a cessé de servir ces paliers
et retiré « Login with Google ». Le même README qualifie l'usage de l'OAuth Gemini CLI avec
un **logiciel tiers** de **cas d'usage contraire à la politique**, pouvant déclencher une
**détection d'abus** ou une **restriction de compte**. Restent `Gemini Code Assist Standard` /
`Enterprise` (adossés à une organisation) et le flux **clé API**.

Donc, pour un compte Google **personnel**, la voie propre est la **clé API Gemini avec
facturation** — le palier gratuit étant précisément celui qui plafonne à 16 k jetons
d'entrée/minute. Trois routes propres, à choisir côté humain :

| Route | Ce qu'elle change | Coût |
|---|---|---|
| Clé API Gemini + facturation activée | `google/gemma-4-26b-a4b-it` (et `google/gemini-*`) prennent le quota payant | à l'usage, Google |
| **Vercel AI Gateway** (`vercel/google/gemma-4-26b-a4b-it`) | clé `AI_GATEWAY_API_KEY` **déjà configurée** dans `~/.config/opencode/opencode.json` — mais testé le 20/10/2026 : **échec**, « AI Gateway requires a valid credit card on file » (la carte est exigée même pour débloquer les crédits offerts) | à l'usage, Vercel |
| Gemini Code Assist Standard/Enterprise | `opencode-gemini-auth` redevient fonctionnel | abonnement organisation |

Un abonnement **Google AI Pro/Ultra personnel ne débloque donc rien** : ni la route OAuth
(fermée), ni la route API (le quota gratuit reste le quota gratuit).

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