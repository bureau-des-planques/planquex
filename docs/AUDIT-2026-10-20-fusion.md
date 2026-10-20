# AUDIT — 20/10/2026, après-midi — fusion et application des règles observées

> Instantané daté, **pas** une vérité live (`AGENTS.md` §2.6) : relancer les commandes.
> Travail mené par l'agent principal pendant l'absence de Bastien (≈ 14 h – 16 h), avec des
> sous-agents DeepSeek (codeurs, rédacteur, auditeurs). Chaque livraison d'agent a été
> **relue et revérifiée** par l'agent principal avant d'être versée.

## Périmètre

Branche **`fusion/2026-10-20`**, partie de `main` (`45cc899`). **`main` n'est pas modifiée** :
la fusion attend la validation de Bastien.

## Commandes (sur `fusion/2026-10-20`, tête `8e7659e`)

| Commande | Exit | Extrait |
|---|---:|---|
| `npm run check` | 0 | `tsc -b`, aucune erreur |
| `npm test` | 0 | **36 fichiers, 363 tests** (contre 27 / 247 sur `main`) |
| `npm run build` | 0 | `dist/index.html` + `dist/sw.js` |
| `npm run simulate -- --games 100 --seed 42` | 0 | toutes les parties terminent ; écarts de ±1 victoire par faction après D-033 |
| `npm run capturer` (`PORT=4191`) | 0 | 5 captures ; `combat.png` relue : « Lancer de tampon : tu ouvres. », Machine à 0 au tour 1, bouton « Abandonner » |
| `grep -rn "Galère" src` | 1 | aucune occurrence |

## Observé — ce qui a été fait

1. **Fusion `integration/2026-10-20` → `main`**, avec **renumérotation** : les deux branches
   avaient écrit chacune une D-030 et une O-013. `main` fait autorité (preuve primaire). Les
   D-030/D-031 de l'intégration sont absorbées par la D-030 de main ; D-032 → **D-031** ;
   D-033 → **D-032** ; O-013 → **O-015**. Étiquettes du code renumérotées. Note de fusion dans
   `docs/DECISIONS.md`. Défaut préexistant corrigé : une ligne vide coupait le tableau des
   décisions avant D-030.
2. **D-033** — six règles **observées sur capture** entrent dans §4. ⚠️ **Décision prise par
   l'agent, à valider** (voir plus bas).
3. Tickets livrés (un worktree et une branche `agent/<n>-…` chacun) :

| Ticket | Objet | Auteur |
|---|---|---|
| #76 | une Pression termine le tour ; Sieste sans lancer à l'attaque ; Dérive sans Stress | codeur DeepSeek |
| #77 | Rotation interdite sous Sieste/Immobilisation ; purge des effets d'attaque | codeur DeepSeek |
| #78 | le Contrôle porte sur les deux Postes après chaque tour | codeur DeepSeek |
| #79 | déclarer forfait (D-030) | codeur DeepSeek |
| #80 | six dérives de doc (AGENTS §2/§6/§7, README, PROPOSITION, renvois) | rédacteur DeepSeek + agent principal (tests, commit) |
| #81 | premier joueur tiré au sort ; aucun café au premier tour | codeur DeepSeek |
| #82 | un seul lancer de tampon, face = succès | codeur DeepSeek |
| #83 | journal d'actions et rejeu (`PROPOSITION.md` §6.2) | codeur DeepSeek |
| #84 | le bandeau de fin dit pourquoi la partie s'arrête | agent principal |

4. Corrections faites par l'agent principal **à l'intégration** (les agents travaillaient en
   parallèle) : le forfait masqué après une Pression (#76 × #79) ; `endTurn` qui renvoyait un
   clone sur une partie finie, donc journalisé à tort (#83) ; le tirage du premier joueur écrit à
   la main, attrapé par le garde-fou de #82 (#81 × #82) ; deux tests d'évolution qui pouvaient
   passer sans rien vérifier (`return` silencieux) dans `premier-joueur.test.ts`.

## À valider par Bastien

- **D-033** (`docs/DECISIONS.md`) : chaque point cite sa capture mot pour mot, mais la décision
  a été écrite par l'agent. Si un point est refusé, les commits sont séparés par ticket et se
  retirent un à un.
- **Verser `fusion/2026-10-20` dans `main`** : `git merge --ff-only fusion/2026-10-20` depuis
  `main` (avance rapide possible tant que `main` n'a pas bougé), puis `git push`, puis fermer
  #59 #60 #65 #68–#74 #76–#84.

## Non vérifié / limites

- **`playwright-core` manque dans le `node_modules` de `main`** (déclaré dans `package.json`,
  présent dans `package-lock.json`) : `npm run capturer` y échoue en `ERR_MODULE_NOT_FOUND`. Un
  `npm ci` dans le dossier principal le rétablit ; la fusion a son propre `node_modules`.
- La limite de **50 tours en solo** reste non codée, volontairement (`src/game/rules.ts`).
- La Direction **n'a toujours pas d'IA** dans l'écran : son tour se passe à la main.
- Le build signale un paquet JS > 500 kB (avertissement, pas une erreur).

## Bloquants restants (humains)

| Sujet | Où |
|---|---|
| O-014 : 1 attachement de café par tour, ou autant qu'on veut ? — **essai en jeu** | `docs/DECISIONS.md` |
| Capture de l'**éditeur de deck** (plafond des types de café) → débloque #61 → #33 → #35 | #31 |
| Renommage de la plomberie `grevomon`, licence — **D-034** | #75 |
| Infrastructure de la bêta | #10 |

## Prochaine action vérifiable

Valider D-033, puis `git merge --ff-only fusion/2026-10-20` sur `main` et relancer la batterie
de `AGENTS.md` §8.2.
