# STATUS — audit factuel « Bureau des Planqués »

> **Instantané historique.** Audit du **18/10/2026, 20:57 (CEST)**. Certains points ont été corrigés depuis
> (`scripts/status.mjs`, `tsconfig.json`). Pour l'état courant, relancer les commandes de `AGENTS.md` §8.
>
> Ton neutre. On distingue **observé** (vérifié par commande ou fichier) et **non vérifié** (déduit, non exécuté).
> Aucun fichier source n'a été modifié pendant cet audit ; rien n'a été corrigé ni installé à ce moment-là.

## 1. Périmètre audité

Fichiers lus : `README.md`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`,
`scripts/status.mjs`, `docs/DECISIONS.md`, `docs/CARD-SPEC.md`, début de `docs/FACTIONS.md`
et `docs/PROPOSITION.md`, et la totalité de `src/**` (9 fichiers TS/TSX).

Commandes lancées : `npm run status`, `npm run check`, `npm test`, `npm run build`,
puis `npx vite build` (isolé, pour lever l'ambiguïté tsc/vite).

## 2. Résultats des commandes (exacts)

| Commande | Résultat | Extrait |
|---|---|---|
| `npm run status` | **Échec (exit 1)** | `Error: ENOENT: no such file or directory, scandir '/home/chapax/Documents/grevomon/REA%20pp/grevomon-tcg/'` |
| `npm run check` | **Échec (exit 1)** | `tsconfig.json(18,5): error TS5102: Option 'baseUrl' has been removed.` + `(20,15): error TS5090: Non-relative paths are not allowed.` |
| `npm test` | **Échec (exit 1)** | `No test files found, exiting with code 1` |
| `npm run build` | **Échec (exit 1)** | s'arrête sur `tsc -b` (mêmes erreurs TS5102 / TS5090 que `check`), `vite build` non atteint |
| `npx vite build` (hors script) | **Échec (exit 1)** | `Error: Failed to resolve /src/main.tsx from .../index.html` |

Versions réellement installées : node `v24.21.0`, vite `8.3.4`, typescript `7.0.2`,
vitest `5.0.5`, react `19.3.1`, vite-plugin-pwa `2.0.0`.

## 3. `dist/` — observé

- **Avant toute commande d'audit : `dist/` absent** (ni `index.html`, ni `sw.js`, ni dossier).
- Après le `npx vite build` isolé lancé par cet audit, `dist/` contient `sw.js` (871 o) et
  `workbox-9c191d2f.js` (15 112 o) — **pas de `dist/index.html`**. Ces artefacts sont un
  effet de bord de l'audit, pas une sortie du script `npm run build`.

## 4. Tableau des modules

| Module | État | Preuve vérifiable |
|---|---|---|
| Scaffold Vite/TS | **Partiel** | `vite.config.ts`, `tsconfig.json`, deps installées. Mais pas de point d'entrée. |
| Point d'entrée applicatif | **Absent** | `index.html:13` charge `/src/main.tsx` ; `src/main.tsx` inexistant (`ls` → No such file). |
| App / routeur | **Absent** | Aucun `App.tsx`, aucun `BrowserRouter`/`Routes` dans `src` (grep vide). `Layout.tsx` utilise `<Outlet/>`. |
| Pages | **Partiel** | `src/pages/Home.tsx` seul. Les liens `/collection`, `/deck`, `/battle`, `/settings` (`Home.tsx:70,78,86`, `Layout.tsx`) n'ont aucun composant page. |
| Composants | **Partiel** | `CardView.tsx` (60 l.), `CardDetail.tsx` (72 l.), `Layout.tsx` (53 l.) — présents, non rendus faute d'app. |
| Données cartes | **Partiel** | `types.ts` (115 l.), `index.ts` (52 l.), `sse.ts` (331 l.). **37 entrées** (26 `base` + 11 variantes), **faction SSE uniquement**. `CARD-SPEC.md` vise 286 cartes / 10 factions. |
| Moteur de jeu | **Partiel** | `src/game/engine.ts` (502 l.) : tour, mulligan, évolution, café, attaque, statuts, K.O., 3 Primes, `endTurn`. Aucun test, non exécuté. |
| Store | **Partiel** | `src/store/useStore.ts` (111 l.), zustand + persist. `deckLegal` impose un classeur de **20** cartes, conforme aux docs (`PROPOSITION.md` : 20/5/3). Non branché à une page exécutable. |
| Styles / CSS | **Absent** | Aucun fichier `.css` dans `src` (`find` vide), aucun import de CSS. |
| Assets / `public/` | **Absent** | `public/` inexistant ; `favicon.svg`, `icon-192.svg`, `icon-512.svg` référencés (`index.html`, `vite.config.ts`) mais absents. |
| Configuration PWA | **Partiel** | Bloc `VitePWA` présent dans `vite.config.ts` ; manifeste pointe vers des icônes manquantes. Non vérifié en runtime. |
| Tests | **Absent** | 0 fichier `*.test.*` / `*.spec.*` ; `npm test` → `No test files found`. |
| Build production | **Cassé** | `npm run build` échoue (TS5102). Voir §2. |
| Script `status.mjs` | **Cassé** | Échoue par encodage d'URL `%20` (chemin du dossier contient une espace). Code : `new URL('..', import.meta.url).pathname`. |
| Docs | **Fait** | 5 fichiers markdown, 1 208 lignes (`PROPOSITION.md` 585, `FACTIONS.md` 362, `CARD-SPEC.md` 190, `DECISIONS.md` 43, `README.md` 28). |

## 5. Métriques mesurées

| Mesure | Valeur |
|---|---:|
| Fichiers TS/TSX (`src/`) | **9** |
| Lignes TS/TSX (`src/`) | **1 418** |
| Lignes `src` + `scripts/status.mjs` | 1 487 |
| Fichiers de test | **0** |
| Tests exécutés | **0** |
| Entrées de cartes en code | **37** (faction SSE uniquement) |
| Lignes de docs markdown | 1 208 |
| `dist/index.html` | **absent** |
| `dist/sw.js` | absent avant audit ; présent (artefact d'audit) après |

## 6. Blocages actuels (observés)

1. **Build cassé** : `tsconfig.json` utilise `baseUrl` (retiré en TypeScript 7.0.2) → TS5102/TS5090. Casse `check` et `build`.
2. **Application non démarrable** : `index.html` référence `/src/main.tsx`, fichier absent → `vite build` et `vite dev` échouent.
3. **Routage incomplet** : aucun `App.tsx`/routeur ; 4 des 5 destinations de navigation n'ont pas de page.
4. **Aucun test** : `npm test` échoue par absence de fichiers.
5. **`npm run status` inutilisable** dans ce chemin (bug `%20`).
6. **Alias `@/`** utilisé 13 fois dans `src` ; aucun `resolve.alias` dans `vite.config.ts`. Vite ne lit pas `paths` de tsconfig seul → **résolution probablement cassée au build** (non vérifié : le build s'arrête avant sur `main.tsx`).
7. **Aucun CSS ni asset** : l'UI décrite dans le code n'a pas de feuille de style ni d'icônes.

## 7. Prochaine action vérifiable

Créer `src/main.tsx` (montage React + routeur) et corriger `tsconfig.json` (`paths` relatif `./src/*`,
sans `baseUrl`) **puis** relancer `npm run check` et `npm run build`. Tant que `main.tsx` est absent,
aucune vérification de rendu n'est possible.

## 8. Comment relancer cet audit

```bash
cd "/home/chapax/Documents/grevomon/REA pp/grevomon-tcg"
npm run status           # attendu : échec ENOENT %20 (sauf correction)
npm run check            # attendu : TS5102/TS5090 (sauf correction)
npm test                 # attendu : No test files found (sauf ajout de tests)
npm run build            # attendu : échec tsc (sauf correction)
ls -la dist/index.html dist/sw.js   # vérifier la sortie de build
find src -name '*.test.*' -o -name '*.spec.*'   # inventaire des tests
grep -rn "from '@/" src | wc -l                 # usages de l'alias @/
```

## 9. Réserves

- **Non vérifié** : comportement runtime du moteur (`engine.ts`) et du store ; rendu réel de l'UI ;
  validité concurrente de l'alias `@/` sous Vite ; comportement PWA.
- Le moteur et le store ne sont branchés à aucune page, donc leur exécution n'est pas démontrée.
