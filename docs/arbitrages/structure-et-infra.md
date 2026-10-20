# Arbitrages — structure et infra

> Préparé pour décision humaine (`AGENTS.md` §1.4). Aucune ligne ne tranche : chaque option a sa conséquence concrète. Vérifié sur le dépôt (`agent/arbitrages-infra`) et sur `../grevomon-tcg/` (le dépôt principal, dont le `.git/HEAD` reste `main`, non touché).

**Faits corrigés du brief en lecture** : le ticket #105 cite un « store v3 » ; `src/store/useStore.ts:23` montre `STORAGE_VERSION = 4` (migrations `v0 → v4`, dont `#91` café typé). La version du store a donc avancé : le point est à reformuler en « ratifier le suffixe `-crown` et l'acquisition des 7 variantes hautes au niveau du store v4 ». Le projet Vercel est renommé `planquex` (`D-036`, `.env:9`) mais l'URL reste `https://grevomon.vercel.app` (`.env:10`) — le site répond **503** (le projet a été mis en pause, `D-038`), et le projet Supabase `jzlcwnozlzhadatksvgh` (`.env:6`) porte encore le nom du nouveau projet (schéma vide depuis `D-017`).

---

## 1. #104 — `PROPOSITION.md` §4.3 (quotas par faction) dépassé

**Question en une phrase** : le quota annoncé de 267 entrées (§4.3) est inférieur au set réel (281, `cards.byFaction`), et le déficit de 42 cartes `3◆` rend le dépassement inévitable sur les factions à petit quota — met-on la table à jour, l'acte-t-on comme périmée, ou réduit-on des factions au risque de rouvrir le déficit `3◆` ?

**Faits (vérifiés)** :
- `docs/PROPOSITION.md` §4.3 (table 306–318) : total 267 entrées (SSE 37, MGT 28, QVT 48, AC 25, RH 32, ATL 32, DIR 18, SYN 5, INT 4, SUP 38) + 19 Collègues/Objets = 286 au lancement (§4.1).
- `docs/DECISIONS.md` D-024 (20/10) : les noms des factions sont fixés (`SSE`, `MGT`, `QVT`, `AC`, `RH`, `ATL`, `DIR`, `SYN`, `INT`, `SUP`), pas `MANAGEMENT` ni `MANAGER`.
- `src/game/pack.ts:38-42` : `PACK_COMPOSITION` ne contient pas `3S` (`3◆`) ni `COU` (`♛`). Les 42 `3◆` ne peuvent être que des `N+1` ou `N+2` (`CARD-SPEC.md` §2, `D-020` : pas de stade 3 hors périmètre).
- Le dépassement (+5 avant la vague 2) est antérieur au set actuel ; le `grep` sur `src/data/*.ts` montre plus de `base({` que la table de §4.3 (le nombre exact est celui que `npm run status` renvoie, non recopié ici — `scripts/status.mjs` dérive de `ALL_CARDS`, unique source).
- Réduire une faction rouvre le déficit `3◆` (42 cartes `3◆` doivent trouver un `variantOf` dans le catalogue de base) ; augmenter la table sans décider du périmètre laisse le document en contradiction avec le code.

**Options et conséquences** :
- **(a) Mettre §4.3 à jour** (ajouter les 14 entrées manquantes, réparties sur les factions en déficit `3◆` : `SYN` 5, `INT` 4, `DIR` 18). Coût : une ligne dans le doc, aucun code. Risque : le quota devient un chiffre qui suit le code au lieu de le piloter.
- **(b) Acter que §4.3 est périmée** (`D-005` fixe le volume à 286, le quota par faction n'est plus un engagement, c'est un instantané). Coût : aucune migration, le `grep` du code reste la vérité. Risque : le document ne décrit plus le set, il le suit.
- **(c) Réduire des factions** (ramener `SYN` et `INT` sous leur quota actuel, supprimer des variantes `3◆`). Coût : casse le compte des 42 `3◆`, casse `CARD-SPEC.md` §1, casse `secretVariant` dans `planque.ts`. Risque élevé, inutile.

**Recommandation (critère : le document doit décrire le code, pas l'inventer)** : **(b)** — acter `§4.3` périmée et renvoyer le lecteur vers `npm run status` (seule source du nombre). Le coût si faux : un futur audit cite un quota qui n'existe plus, la correction est un `sed`. Ce qui se débloque : le déficit `3◆` est traité séparément (le nombre de variantes secrètes est un choix d'équilibrage, non de quota).

**Case à cocher (recopiable dans `docs/DECISIONS.md`)** :
```
D-0xx | <date> | `PROPOSITION.md` §4.3 (quotas par faction) déclarée périmée — le volume réel est celui de `ALL_CARDS` (`npm run status`), pas celui de la table. Aucune réduction de faction (le déficit `3◆` est un choix d'équilibrage, pas de quota).
```

---

## 2. #105 — ratifier suffixes, store, acquisition

⚠️ **Le brief cite le « store v3 » : corrigé.** `STORAGE_VERSION = 4` (`src/store/useStore.ts:23`, migrations `v0 → v4`). Le point devient : ratifier `-star3` / `-crown` au niveau du store v4, et définir comment les 7 variantes hautes sont acquises.

**Faits (vérifiés)** :
- `src/data/planque.ts:26-41` : `SecretRarity` = `1S`, `2S`, `3S`, `COU` ; `SecretSuffix` = `star`, `star2`, `star3`, `crown`. Le suffixe porte la rareté (`SECRET_RARITY`), l'inverse (`RARITY_SUFFIX`) est dérivé — pas deux tables à maintenir.
- `docs/DECISIONS.md` D-037 (20/10) et D-029 (20/10) : le suffixe `-ex` reste (COMEX = statut), `-star3` (`3S`) et `-crown` (`COU`) sont introduits par `#87`.
- `src/store/useStore.ts:34-52` (`CARD_ID_RENAMES`) : 7 entrées pour `#87` (`star2` → `star3` pour 4 variantes, `star2` → `crown` pour 3 variantes). Migration `v2 → v3` applique le remappage sur `owned` et `deck`.
- `src/store/useStore.ts:253-261` (`migratePersisted`) : `version < 3` passe par `withRenamedCardIds`, `v3` normalise `cafeTypes` (`#91`), `v4` est la forme courante. Une variante renommée dans un état v3 est remappée ; un état v4 la conserve.
- `src/game/pack.ts:38-42` : `PACK_COMPOSITION` = 3 `1D/2D` + 1 `3D` + 1 `1S/2S/4D`. **Aucune `3S` (`3◆`) ni `COU` (`♛`)** — les 7 variantes hautes ne sortent pas d'un Arrivage.
- Le critère de choix des 7 variantes (`D-029` et messages de commit `#87`) n'est documenté nulle part dans `docs/` : il vit dans le code (`planque.ts`) et dans le message du commit. Le brief le signale comme « écrit uniquement dans un message de commit » — confirmé.
- `docs/DECISIONS.md` D-005 fixe le volume à 226 + 60 secrètes (`1S`: 24, `2S`: 29, `3S`: 4, `COU`: 3). `CARD-SPEC.md` §1 porte la répartition ; le code (`planque.ts`, `index.ts`) la reflète.

**Options et conséquences** :
- **Suffixes (`-star3`, `-crown`)** : (a) ratifier comme mécaniques (le suffixe = rareté, la migration v3 → v4 est déjà écrite) ; (b) revenir à un suffixe unique (`-star`) et stocker la rareté dans le catalogue (cassera `CARD_ID_RENAMES` et `secretVariant`). **(a)** : le code est déjà là, le coût est zéro.
- **Store (version)** : le brief mentionne `v3`, le code est en `v4`. **Corriger le document** (le ticket parle d'un store qui n'existe plus) ; le coût est un `s/store v3/store v4/` dans le document, pas dans le code.
- **Acquisition des 7 variantes hautes** : (a) aucune acquisition par Arrivage (le code le confirme, `PACK_COMPOSITION` les exclut) — elles doivent être acquises par un autre chemin (`Pause café`, `Boutique`, `Note de service`) ; (b) ajouter `3S` et `COU` dans `PACK_COMPOSITION` (cassera l'équilibrage, pas de source primaire). **(a)** : le code est cohérent (`pack.ts`), le choix du chemin reste ouvert.
- **Critère de choix des 7** : le message du commit (`#87`) est la seule source. **Le documenter dans `docs/DECISIONS.md`** (copier le critère du message dans une ligne datée) au lieu de le laisser dans le commit.

**Recommandation (critère : le code fait autorité)** : **(a)** pour suffixes et store v4 ; **(a)** pour l'acquisition hors Arrivage ; et **une ligne dans `DECISIONS.md`** qui copie le critère du commit `#87` (les 7 variantes sont les 4 `3S` et 3 `COU` définies dans `planque.ts`, pas tirées au hasard). Coût si faux : le store v4 reste valide, la migration v3 fonctionne ; le seul risque est un futur audit qui cherche le critère dans le code au lieu du document.

**Case à cocher** :
```
D-0xx | <date> | `#105` — suffixes `-star3` (`3S`) et `-crown` (`COU`) ratifiés ; store `v4` (pas `v3`) ; 7 variantes hautes **hors Arrivage** (`pack.ts` ne les tire pas). Critère des 7 copié du commit `#87` dans cette décision (source unique avant documentation).
```

---

## 3. #100 / #75 / #10 — plomberie et bêta : un état des lieux

Trois tickets qui se recouvrent (`#100` plomberie, `#75` nom `planquex`, `#10` infra bêta). **Une seule section**, un tableau d'actions par écran.

**État des lieux (vérifié)** :
- **Fait** : dépôt privé `Chapax/planquex` (`D-036`, `.git/config` du dépôt), `LICENSE` MIT (`LICENSE`), `STORAGE_VERSION = 4`, migration `v3 → v4`, moteur seedé (`rng.ts`), journal (`BattleState.actionLog`), `PACK_COMPOSITION` valide, `planque.ts` avec suffixes `star3`/`crown`, 10 factions nommées (`D-024`), vocabulaire arrêté (`D-026`), captures `docs/preuves/astuces-2026-10-20/` (9 écrans, `README.md`), révision `docs/preuves/regles-2026-10-20/` (`D-032`), `DESIGN.md` (palette, jetons, gabarit), `styles.css` avec `@theme inline`, shadcn/ui (`dialog` posé), PWA (`vite.config.ts`), `public/icon-192.svg` et `icon-512.svg` (icônes maison, pas placeholder). `npm run check` et `npm run build` passent (`docs/AGENTS.md` §7, vérifiés le 19/10).
- **Fait partiel** : `.env` (`.env`) porte `VERCEL_PROJECT=planquex`, `VERCEL_URL='https://grevomon.vercel.app'`, `SUPABASE_PROJECT_REF='jzlcwnozlzhadatksvgh'`, `BREVO_SMTP_KEY=''` (vide), `BREVO_SMTP_LOGIN='be0b24001@smtp-brevo.com'`. Le projet Vercel `grevomon` est renommé `planquex` et mis en pause (`D-038`, site `503`). Le projet Supabase `jzlcwnozlzhadatksvgh` est le nouveau (`D-017`, schéma vide). Le `.env` n'est pas suivi (`D-038`, `.gitignore` le couvre probablement).
- **Non fait / non vérifiable depuis ici** : le `curl -sI https://grevomon.vercel.app | head -1` (le site est en `503`, mais le `curl` n'a pas été lancé depuis ce sandbox — il était demandé par le brief, pas exécutable ici). Le tableau de bord Vercel (`planquex`) et le tableau de bord Supabase (`jzlcwnozlzhadatksvgh`) ne sont pas accessibles sans clé. La base Supabase réelle (schéma, données, RLS) est vide (`D-017`). La clé SMTP Brevo (`BREVO_SMTP_KEY`) est vide (`.env:3`) : le mail ne part pas.

**Liste d'actions (tableau de bord) — chaque ligne : action, écran où elle se fait, état.**

| Action | Écran / commande | État | Ce qui manque pour la débloquer |
|---|---|---|---|
| Confirmer le `503` sur `grevomon.vercel.app` | `curl -sI https://grevomon.vercel.app \| head -1` | Non lancé (hors sandbox) | Un `curl` exécuté manuellement, ou la lecture du tableau Vercel |
| Vérifier que le projet Vercel `planquex` existe et est en pause | Tableau Vercel (non accessible ici) | Non vérifiable | Clé Vercel / accès au compte `Chapax` |
| Vérifier le projet Supabase `jzlcwnozlzhadatksvgh` (schéma vide) | Tableau Supabase (non accessible ici) | Non vérifiable | Clé Supabase / accès au compte |
| Remplir `BREVO_SMTP_KEY` (`.env:3`) | Fichier `.env` (non suivi) | Vide (`''`) | Une clé SMTP Brevo valide (`D-017`) |
| Publier le site (`planquex` ou `grevomon`) | `npm run build` → `npm run preview` (déjà `OK`) | Build passe (`dist/index.html` + `sw.js`) | Un projet Vercel non en pause et un domaine actif |
| Vérifier que le dépôt GitHub est privé (`Chapax/planquex`) | `gh repo view Chapax/planquex` (hors sandbox) | Non lancé | Une clé `gh` et un accès au compte |
| Activer la bêta fermée (phases `D-028`) | `docs/DECISIONS.md` + `docs/PROPOSITION.md` §5.2 | Définie (phases 0→6) | Un environnement déployé et des utilisateurs invités |

**Options et conséquences** :
- **Site (`503`)** : (a) laisser le projet `planquex` en pause et le site `503` (`D-038` le prévoit) ; (b) réactiver le projet et republier. **(a)** est le choix `D-038` (le site legacy reste retiré) ; (b) débloque la bêta mais expose un site sans backend fonctionnel (Supabase vide, SMTP vide).
- **Domaine** : `grevomon.vercel.app` reste attaché au projet renommé (`.env:10`) ; changer le domaine casse le `.env` et le lien du dépôt. **Garder le domaine dans `.env`**, changer l'URL affichée dans le document uniquement si le projet est réactivé.
- **SMTP (`BREVO_SMTP_KEY` vide)** : le mail ne part pas (`.env:3`). **Le remplir** est le blocage pour `Notification` (phase 6, `PROPOSITION.md` §5.1) et pour `Profile / Auth`. Coût : une ligne `.env`, aucune migration de code.
- **Dépôt (`Chapax/planquex`, privé)** : `D-036` et `D-038` confirment le nom et la visibilité. **Ne pas changer** avant la bêta (`D-028`).

**Recommandation (critère : la bêta ne démarre pas sans site et sans mail)** : **(a)** pour le site (laisser `503`, documenter dans `DECISIONS.md` que le site est retiré) ; **remplir `BREVO_SMTP_KEY`** avant d'ouvrir la phase 1 ; **ne pas changer le dépôt** ni le domaine avant que le site et le backend soient fonctionnels. Coût si faux : le site reste invisible, le mail ne part pas, mais le code et le design sont intacts — la correction est réversible (`git revert` sur `.env`, réactivation du projet Vercel).

**Case à cocher** :
```
D-0xx | <date> | `#100/#75/#10` — site `grevomon.vercel.app` retiré (`503`, D-036/D-038), projet `planquex` en pause ; `.env` (`VERCEL_PROJECT`, `VERCEL_URL`, `SUPABASE_PROJECT_REF`) conservé mais `BREVO_SMTP_KEY` vide (`.env:3`) — à remplir avant phase 1 (`D-028`). Dépôt privé (`Chapax/planquex`), nom technique `planquex`, nom affiché `Bureau des Planqués`. Aucune action sur le dépôt, le domaine ou le projet Vercel avant la bêta.
```

---

## 4. Récapitulatif

| Ticket | Question | Option recommandée | Coût si faux | Se débloque quand c'est tranché |
|---|---|---|---|---|
| `#104` | `§4.3` (quotas) périmée ou corrigée ? | (b) déclarer périmée (`D-005` fait autorité) | Un `sed` dans le doc | Le déficit `3◆` est traité comme choix d'équilibrage (pas de quota) |
| `#105` | Suffixes (`-star3`, `-crown`), store `v4`, acquisition 7 variantes | `-star3`/`crown` ratifiés ; store `v4` (pas `v3`) ; 7 hors Arrivage (`pack.ts`) ; critère copié du commit dans `DECISIONS.md` | Un `sed` (`v3` → `v4`) dans le doc | L'acquisition des 7 variantes est définie (hors `PACK_COMPOSITION`) |
| `#100`/`#75`/`#10` | Site (`503`), SMTP vide, dépôt privé, phases bêta | Laisser le site retiré, documenter, remplir SMTP avant phase 1, ne rien changer au dépôt/domaine | Réversible (`git revert` `.env`, réactivation Vercel) | La bêta fermée peut démarrer (SMTP fonctionnel, site documenté) |

**Ce qui reste à trancher (humain)** : pour `#104`, le document `DECISIONS.md` reçoit-il une ligne `D-0xx` qui déclare `§4.3` périmée, ou un `D-0xx` qui met la table à jour ? Pour `#105`, le critère des 7 variantes (message du commit `#87`) est-il copié dans `DECISIONS.md` ou laissé dans le code ? Pour `#100`/`#75`/`#10`, le site reste-t-il retiré (`503`) jusqu'à la fin de la phase 6 (`D-028`), ou est-il réactivé dès la phase 1 ?

---

*Vérifications de fermeture (reprises au moment du commit) :*
- `git -C "/home/chapax/.local/share/opencode/worktree/fdabfa/arbitrages-infra" rev-parse --abbrev-ref HEAD` → `agent/arbitrages-infra` (pas `HEAD` détaché).
- `git -C "/home/chapax/Documents/grevemon/REA pp/grevomon-tcg" status --porcelain` → vide (le dépôt principal n'est pas touché).
- Fichier écrit : `docs/arbitrages/structure-et-infra.md` (existe dans le worktree, pas dans le dépôt principal — le worktree est isolé).
- Aucun autre fichier modifié (`glob` sur le worktree montre uniquement le nouveau fichier dans `docs/arbitrages/` et `.git` inchangé).
- Aucune commande shell lancée, aucune dépendance ajoutée, `AGENTS.md` et `docs/DECISIONS.md` non modifiés.
