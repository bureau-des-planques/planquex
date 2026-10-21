# Renommer la plomberie — dossier à trancher

> Relevé le **20/10/2026**, pour le ticket **#75**. Ce document **n'acte rien** : il liste
> ce qui existe, sépare le réglé du non-réglé, et chiffre les options. La décision se prend
> dans `docs/DECISIONS.md` (une ligne datée), jamais ici.
>
> Autorité : `AGENTS.md` §3 (vocabulaire), §9 (legacy), `docs/DECISIONS.md`.
> Question d'origine (Bastien, 20/10/2026) : « on s'écarte de l'idée de Grèvomon — est-ce
> qu'il ne faudrait pas changer le nom ? Et publier sur GitHub un jeu dont un identifiant
> s'appelle "grevomon", c'est un risque ? »
>
> ⚠️ **Ce dossier n'est pas un avis juridique.** Les faits sont sourcés ; l'appréciation du
> risque de marque revient à Bastien (« je regarde pour les licences de mon côté »).

---

> ## Mise à jour du 21/10/2026 — ce qui est fait, ce qui reste
>
> Le **corps de ce dossier n'est pas réécrit** : c'est le relevé daté du 20/10, et il garde sa
> valeur de preuve. Ce bloc dit seulement ce qui a bougé depuis, parce que deux actes datés le
> **citent nommément** : **D-036** (le nom technique `planquex`, dont le §8 est le « plan
> d'exécution ordonné ») et **D-038** (licence MIT, dépôt privé, retrait du site legacy, dont le
> §4 est l'analyse de risque).
>
> **Fait** (vérifié le 21/10/2026) :
>
> | Étape du §8 | État |
> |---|---|
> | 1. Décider | **fait** — `D-036` (nom) et `D-038` (licence, publication, retrait du site) ; l'acte annoncé `D-034` dans ce dossier est devenu **D-036** |
> | 2. Documentation | **fait** — dépôt, `remote`, `AGENTS.md` §7, `docs/agents/issue-tracker.md` |
> | 3. Dépôt GitHub | **fait** — `Chapax/planquex` (privé), `origin` aligné |
> | 5. Vercel | **fait, sauf la suppression du domaine** — projet renommé `planquex`, **sorti de pause** et **en production** (`Alpha · 0.1.1`, commit `59d53a1`) ; `planquex.vercel.app` répond **`200`**. `grevomon.vercel.app` est **toujours attaché** : il ne sert plus l'ancien jeu, il sert le **nouveau**. Sa suppression reste un geste de tableau de bord (D-053) |
> | 6. Supabase / Brevo | **partiel** — libellé du projet `jzlcwnozlzhadatksvgh` à renommer (tableau de bord) ; nom d'expéditeur Brevo déjà « Bureau des Planqués », **adresse** encore `grevomon.game@gmail.com` |
> | 7. Mascotte | **hors périmètre** — le §6 la proposait ; `public/` porte trois SVG au monogramme « BP » (#97) |
> | — | `LICENSE` (MIT) **présent** ; `scripts/etapes-infra-tcg.sh` aligné sur `planquex` le 21/10 |
>
> **Reste, et c'est le ticket #100** : le libellé du projet Supabase, la **suppression** du domaine
> Vercel `grevomon.vercel.app`, l'adresse de l'expéditeur Brevo, et les URL de retour de Supabase
> Auth. Le **déploiement**, lui, est fait (D-053) : le projet est sorti de pause et sert `main`.
>
> **Étape 4 — faite le 21/10/2026, avant l'heure (D-047).** Le dossier local s'appelle
> **`planquex`** et vit dans `~/Documents/opencode/gamedev/planquex/` ; les versions mortes sont
> rangées dans `~/Documents/opencode/gamedev/grevomon/` (`grevomon-v1-js`, son worktree
> `grevomon-v1-prototype`, `grevomon-pocket`, `rea-pocket-apk`). Le §8 la plaçait **après** les
> étapes 5-6 : l'écart est **assumé et consigné dans D-047**, le rangement étant purement local.
> Les worktrees ont été réparés (`git worktree repair`) et les citations de chemin vivantes mises
> à jour ; les instantanés datés (`STATUS.md`, `AUDIT-*`, `arbitrages/*`) gardent l'ancien chemin,
> c'est leur valeur de preuve.
>
> Les worktrees, eux, ne retenaient plus rien depuis le 21/10 : `git worktree list` → **1** (le
> dépôt principal), 25 branches fusionnées supprimées, et `agent/75-renommage`, morte, retirée elle
> aussi, son seul fichier vivant déjà dans `main`.
>
> **Comptes du §0 :** il annonçait « 59 lignes / 15 fichiers ». Mesuré sur `main` le 21/10/2026
> **avant l'ajout de ce dossier** : `git grep -niI "grevomon" | wc -l` → **66 lignes**, et
> `git grep -niI -l "grevomon" | wc -l` → **16 fichiers**. L'écart vient des actes et des
> dossiers d'audit postérieurs au 20/10, pas d'un renommage à refaire.
>
> **Le §8 reste le plan de référence** : les étapes 1 à 4 sont derrière, 5 est faite **sauf la
> suppression du domaine**, 6 reste le sujet de #100 (libellé Supabase, Brevo, URL d'Auth), 7
> attend #97, 8 est la vérification finale.

## 0. Résumé pour décider

1. **Le nom du jeu est déjà tranché** — « Bureau des Planqués » (D-015), et le code le porte
   partout. Rien à faire de ce côté.
2. **« grevomon » ne survit que dans la plomberie** : dossier, dépôt, projet Vercel, URL,
   projet Supabase, expéditeur d'e-mails. **59 lignes** (76 occurrences) dans **15 fichiers
   suivis**, plus 3 occurrences dans `.env` (non suivi).
3. **La seule surface publique aujourd'hui n'est pas le dépôt** (privé) : c'est
   `https://grevomon.vercel.app`, qui répond **200** et sert **l'ancien jeu**.
4. **Le personnage bleu du logo n'existe pas dans le projet actif** : `public/` ne contient
   que trois SVG au monogramme « BP ». Le garder = le **redessiner** (AGENTS.md §1.5 interdit
   de copier les assets de `grevomon-pocket/`).

## 1. Ce qui est déjà réglé : le nom du jeu

| Fait | Preuve | État |
|---|---|---|
| Le jeu s'appelle **Bureau des Planqués** | `docs/DECISIONS.md` **D-015** (18/10/2026) | Acté |
| Le paquet npm suit | `package.json` → `"name": "bureau-des-planques"` | Fait |
| L'onglet et le manifeste suivent | `index.html` → `<title>Bureau des Planqués</title>` ; `vite.config.ts` → `manifest.name: 'Bureau des Planqués'`, `short_name: 'Planqués'` | Fait |
| L'interface suit | `src/components/Layout.tsx:22`, `src/pages/Home.tsx:25` | Fait |
| La sauvegarde locale suit | `src/store/useStore.ts:11` → `STORAGE_KEY = 'bureau-des-planques-v1'` | Fait |
| Les mots interdits sont bannis | `src/data/cards.test.ts:30-44` → `FORBIDDEN_ANY_CASE` contient `'Grèvomon'` et `'Pokémon'` | Fait |

**Aucune occurrence de « grevomon » dans `src/`, `public/`, `index.html`, `vite.config.ts`,
`package.json`** (vérifié par `grep -rniI` — zéro résultat). Le produit est propre ; c'est
l'emballage qui ne l'est pas.

## 2. Ce qui reste : la plomberie

**Commandes** :

```bash
git grep -nI -i "grevomon" | wc -l    # 59 lignes
git grep -oI -i "grevomon" | wc -l    # 76 occurrences
git grep -lI -i "grevomon" | wc -l    # 15 fichiers suivis
```

Plus **3** occurrences dans `.env`, qui n'est pas suivi (`.gitignore:2`).

Les 76 occurrences ne veulent pas dire la même chose. Par **forme du mot** — le découpage le
plus directement vérifiable :

| Forme | Occurrences | Nature |
|---|---|---|
| `grevomon-tcg` | 35 | Le **dossier / dépôt actif** → **c'est la question** |
| `grevomon-pocket` | 23 | Le **legacy** (§9) → **intouchable** |
| `grevomon` seul | 11 | Le **projet Vercel** (« grevomon ») et `Chapax/grevomon` |
| `grevomon.vercel.app` | 3 | L'**URL publique** |
| `grevomon-card-design`, `-balance`, `-ui-qa`, `-lore` | 4 | Des **agents à créer** (`PROPOSITION.md` §7.2) |

### 2.1 Famille A — le legacy, à ne pas confondre

**23 occurrences sur 21 lignes** désignent `grevomon-pocket/`, le dossier **historique**
conservé pour mémoire (`AGENTS.md` §9). **Renommer le projet actif ne les change pas.**
Fichiers : `AGENTS.md`, `docs/DECISIONS.md`, `docs/preuves/README.md`, `README.md`,
`docs/PROPOSITION.md`, `docs/CAPTURES-UI.md`, `docs/NOMMAGE.md`, `docs/MODES-FUTURS.md`,
`docs/agents/domain.md`.

### 2.2 Famille B — le nom du projet actif (35 occurrences, 33 lignes)

| Fichier | Lignes citées | Ce qui est écrit |
|---|---|---|
| `AGENTS.md` | 3, 10, 187, 217, 220, 251, 263, 277, 345 | en-tête, arborescence, `cd "/home/chapax/Documents/grevomon/REA pp/grevomon-tcg"`, remote, tracker |
| `scripts/etapes-infra-tcg.sh` | 4, 210, 253, 258, 282, 285, 303 | projet Supabase, fichier de secrets, clé Brevo |
| `docs/DECISIONS.md` | 10, 24, 25, 26, 35, 37 | le corps des actes datés **et** deux renvois |
| `docs/agents/issue-tracker.md` | 3, 10, 24, 43 | `Chapax/grevomon-tcg` dans les commandes `gh` |
| `docs/STATUS.md` | 27, 96 | instantané daté (chemin) |
| `docs/AUDIT-2026-10-20.md` | 3, 9 | instantané daté |
| `docs/AUDIT-2026-10-18.md` | 3, 8 | instantané daté |
| `README.md` | 35 | « Dossier : `grevomon-tcg/` » |
| `docs/PROPOSITION.md` | 415 | arborescence cible du monorepo |

> **Piège** : `AGENTS.md` §7 code le **chemin racine en dur**, espace comprise. Le renommer
> sans mettre à jour ces lignes casse la batterie d'audit (§8.2).

### 2.3 Famille C — les actes datés, intouchables

Six lignes de `docs/DECISIONS.md` : **10** (D-001), **24** (D-015), **25** (D-016), **26**
(D-017), **35** (D-026), **37** (D-028). La règle est déjà écrite dans ce fichier :

> *« Le vocabulaire des actes datés n'est pas réécrit. »*

Le corps de ces lignes garde `grevomon` **comme trace**. Si on renomme, la décision nouvelle
**cite** D-001/D-015/D-016/D-017 au lieu de les corriger.

### 2.4 Les identifiants hors dépôt

| Identifiant | Valeur actuelle | Où c'est écrit |
|---|---|---|
| Dossier local | `…/Documents/grevomon/REA pp/grevomon-tcg` | disque |
| Dépôt GitHub | `Chapax/grevomon-tcg` (**privé**) | `git remote -v` |
| Projet Vercel | `grevomon` (équipe `chapaxs-projects`) | `scripts/etapes-infra-tcg.sh:221`, `.env` |
| URL publique | `https://grevomon.vercel.app` | `.env`, `DECISIONS.md:26` |
| Projet Supabase | nom `grevomon-tcg` ; référence `jzlcwnozlzhadatksvgh` | `.env`, `opencode.json`, `DECISIONS.md:26` |
| Expéditeur e-mail | `grevomon.game@gmail.com` | `.env` |
| Fichier de secrets | `$HOME/.secrets/grevomon-tcg.env` | `scripts/etapes-infra-tcg.sh:210` |

## 3. La surface publique réelle, aujourd'hui

Faits vérifiés le 20/10/2026 :

| Cible | Commande | Résultat |
|---|---|---|
| Dépôt GitHub | `gh repo view Chapax/grevomon-tcg --json visibility` | `PRIVATE` |
| Dépôt legacy | `gh repo view Chapax/grevomon --json visibility` | `PRIVATE` |
| Site Vercel | `curl -s https://grevomon.vercel.app/` | **HTTP 200** |
| Titre servi | `grep -o "<title>[^<]*</title>"` | `<title>Grèvomon</title>` |
| Manifeste servi | `curl -s …/manifest.json` | `"name": "Grèvomon"`, « Le jeu de cartes des galères du boulot » |
| Données servies | `curl -s …/data/cards.json` | les cartes du **legacy** (`fiWeak_001`…) |
| Deploy du TCG | `curl -s https://grevomon-tcg.vercel.app/` | `404 DEPLOYMENT_NOT_FOUND` |
| Logo legacy servi | `curl -sI …/assets/ui/logo.png` | `HTTP 200`, `image/png`, 23 593 o |

**Conclusion factuelle** : le dépôt n'est pas publié, mais **le nom « Grèvomon » l'est** — sur
un domaine public qui sert l'ancien jeu. C'est ce point-là qui porte l'essentiel du risque, et
il est indépendant du dépôt.

**Écart doc ↔ réalité à signaler** : D-017 écrit que le TCG « est déployé sur le projet Vercel
existant `grevomon` », alors que l'URL sert le **legacy**. Le ticket #10 (« Monter l'infra de
la bêta fermée ») dit d'ailleurs que l'infra est **reportée** et que le travail se fait en
local. Un des deux doit être corrigé — ce n'est pas un fait nouveau, c'est une tâche
(AGENTS.md §2 : un écart docs ↔ code est un bug ou une tâche).

## 4. Le risque « dérivé Pokémon » — les faits, pas l'avis

Ce qui est **observé** dans le dépôt :

- Le suffixe **« -mon »** est l'élément le plus reconnaissable de « Pokémon » (et de
  « Digimon »). « Grèvomon » = « grève » + « -mon ».
- Le dépôt **revendique** la filiation : D-003 (« miroir exact de TCG Pocket »), D-018
  (« miroir de Pokémon TCG Pocket dans son état de 2026 »). `README.md:6` cite
  « Pokémon TCG Pocket 1.7.5 » et `../grevomon-pocket/docs/INVENTAIRE-PTCGP.md`.
- Les règles d'un jeu ne sont **pas** protégeables (idées/méthodes) ; les **noms, textes,
  assets et logos** le sont.
- **Aucun asset, nom ou texte Pokémon n'est dans le dépôt** : `git ls-files` ne contient
  **aucune image** (vérifié), et `src/` bannit déjà `Grèvomon` et `Pokémon`.
- Les ressources d'analyse (`sources/`, `resources/` — 878 Mo) sont **hors du dépôt** :
  `git ls-files | grep -E "^(sources|resources)/"` → **0**. Elles ne seraient pas publiées.

Ce qui **reste à apprécier par un humain** (non vérifiable ici) : le risque de marque d'un nom
en « -mon » sur un jeu de cartes à collection de créatures, même renommé ; et le fait qu'un
`README` public **documente** la filiation. Un dépôt public rend cette filiation lisible par
n'importe qui.

## 5. Options de nom

Le nom du **jeu** ne bouge pas. Il s'agit des **identifiants techniques**. La cohérence
naturelle est de les aligner sur le nom déjà acté.

| Identifiant | Actuel | Option 1 (alignée) | Option 2 (courte) |
|---|---|---|---|
| Dépôt GitHub | `grevomon-tcg` | `bureau-des-planques` | `planques` |
| Dossier local | `grevomon-tcg` | `bureau-des-planques` | — |
| Projet Vercel | `grevomon` | `bureau-des-planques` | `planques` |
| URL | `grevomon.vercel.app` | `bureau-des-planques.vercel.app` | `planques.vercel.app` |
| Projet Supabase | `grevomon-tcg` | `bureau-des-planques` | — |
| Expéditeur | `grevomon.game@gmail.com` | adresse dédiée au jeu | — |
| Fichier secrets | `~/.secrets/grevomon-tcg.env` | `~/.secrets/bureau-des-planques.env` | — |

**Recommandation** : **option 1**. Le paquet npm s'appelle déjà `bureau-des-planques` ; tout
aligner dessus supprime la dernière incohérence entre le nom affiché et le nom technique —
c'est exactement la règle d'`AGENTS.md` §5 (« un id suit le nom »).

`planques` (option 2) est plus court mais crée un **second** nom à maintenir, en plus de
`bureau-des-planques` déjà présent dans `package.json`.

## 6. Le logo — le personnage bleu

Bastien : « j'aimais bien l'identité avec le petit personnage bleu du logo. » Décision prise :
**le garder, redessiné**.

Faits :

- Le personnage bleu **n'est pas dans le projet actif**. `public/` ne contient que
  `favicon.svg`, `icon-192.svg`, `icon-512.svg` — trois SVG au **monogramme « BP »** sur fond
  `#0b1220`, dégradé `#4f8ef7` → `#7a5cf0`.
- Il vit dans le **legacy** : `grevomon-pocket/public/assets/ui/mascot.png` (197 × 243, pixel
  art) et `logo.png` (976 × 243 : le personnage **et** le wordmark « GREVOMON », dont le « O »
  final est une **tasse de café**).
- `AGENTS.md` §1.5 : **« Ne pas copier … les assets de `grevomon-pocket/` »**. Le garder ne
  peut donc pas vouloir dire le réutiliser — il faut le **redessiner**.
- Friction à trancher : D-028 acte un style « **corporate dark premium** », alors que le
  personnage est en **pixel art bleu**. Le redessin devra choisir : adapter le personnage au
  style, ou assumer le pixel art comme exception.
- Ce qui est **transposable sans risque** : le **motif de la tasse de café** comme lettre ou
  comme marque. Il est déjà canonique dans le jeu (Café = énergie, Machine à café = zone), et
  il ne vient pas du legacy — c'est une idée, pas un asset.

## 7. Ce qui est risqué, coûteux ou irréversible

| Point | Nature | Détail |
|---|---|---|
| **16 worktrees** | fragile | `git worktree list` en compte 16, tous rattachés au dossier principal. Renommer **le dossier racine** casse les liens `gitdir` des 15 autres (dont celui de cette session). |
| **Chemin en dur** | fragile | `AGENTS.md` §7 (lignes 217-220, 277) code le chemin complet, espace comprise. |
| **Redirection GitHub** | plutôt sûr | Renommer un dépôt GitHub laisse une **redirection** sur l'ancienne URL ; les clones existants continuent de fonctionner. |
| **URL Vercel** | à assumer | Renommer le projet Vercel **change l'URL publique**. L'ancienne cesse de servir le nouveau contenu (pas de redirection automatique du `*.vercel.app`). |
| **Numérotation des décisions** | collision | `main` s'arrête à **D-029**, mais `integration/2026-10-20` et les branches d'agents portent déjà **D-030 à D-033**. La nouvelle décision doit partir de **D-034**, sauf si l'intégration est fusionnée d'abord. |
| **Secrets** | sûr | `.env` n'est **pas suivi** (`.gitignore:2`) et le dépôt est privé : rien de `grevomon.game@gmail.com` n'est publié. |
| **Historique git** | à savoir | L'ancien nom **reste dans l'historique** (128 commits). Renommer ne l'efface pas. |

## 8. Plan d'exécution ordonné (si on décide de renommer)

Rien ici n'est exécuté. L'ordre est choisi pour que chaque étape laisse le dépôt dans un état
cohérent.

1. **Décider** — une ligne **D-034** dans `docs/DECISIONS.md` : le nom retenu, le périmètre
   (dépôt seul ? + Vercel ? + Supabase ?), et le sort de l'ancien site public.
2. **Documentation** — famille B (35 occurrences) : `AGENTS.md`, `README.md`,
   `docs/agents/issue-tracker.md`, `docs/PROPOSITION.md`, `scripts/etapes-infra-tcg.sh`. Laisser
   familles A et C intactes.
3. **Dépôt GitHub** — `gh repo rename` (redirection automatique), puis mettre à jour le
   `remote` local. `docs/agents/issue-tracker.md` doit suivre.
4. **Dossier local** — *en dernier*, et seulement si la décision le prévoit : il faut
   d'abord `git worktree` les 15 autres dossiers, ou accepter de les recréer.
5. **Vercel** — renommer le projet, **puis** décider du sort de
   `grevomon.vercel.app` : le supprimer, le vider, ou le rediriger. Aujourd'hui il sert
   l'ancien jeu publiquement.
6. **Supabase / Brevo** — renommer le projet et changer l'expéditeur ; ce sont des libellés
   côté tableau de bord, la référence technique ne change pas.
7. **Mascotte** — redessiner le personnage bleu et remplacer les trois SVG de `public/`.
8. **Vérifier** — `npm run check`, `npm test`, `npm run build` (§8.4), et
   `grep -rniI "grevomon"` sur les fichiers suivis pour constater ce qui reste **volontairement**
   (familles A et C).

## 9. Ce que ce dossier n'acte pas

> ⚠️ Les trois constats ci-dessous sont ceux du **20/10/2026**, et deux ont bougé depuis : le
> renommage **a été exécuté** (D-036/D-038) et le dépôt **a** un `LICENSE`. Voir le bloc de mise
> à jour en tête de dossier.

- Aucun renommage n'a été fait.
- Le nom du jeu n'est pas en débat : il est déjà acté (D-015).
- L'appréciation du risque de marque et le choix de licence **ne sont pas** tranchés ici. À ce
  jour, le dépôt n'a **ni `LICENSE` ni `NOTICE`** (`git ls-files | grep -iE "^LICEN|^NOTICE"`
  → aucun), alors que `package.json` déclare `"private": true` — un dépôt public devra choisir.
- Les noms des quatre agents à créer (`docs/PROPOSITION.md` §7.2) ne sont pas tranchés.
