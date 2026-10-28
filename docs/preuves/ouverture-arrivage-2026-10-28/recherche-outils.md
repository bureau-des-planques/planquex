# Outils pour l'animation d'ouverture d'un paquet de 5 cartes — comparatif

Date de la recherche : **28/10/2026**. Statut : complet (une passe), voir « Ce qui reste incertain ».

> **Écart de chemin.** Le chemin demandé (`docs/preuves/ouverture-arrivage-2026-10-28/recherche-outils.md`) a été **refusé** par la
> configuration (`Permission denied: external_directory`), alors que la règle de l'agent n'autorise que le bac à sable.
> Pas de contournement : ce fichier vit dans
> ``docs/preuves/ouverture-arrivage-2026-10-28/recherche-outils.md``.

## 0. Méthode, et ce que je n'ai PAS pu faire

- **Aucun shell** : toute commande `bash`/`npm`/`esbuild` m'a été refusée (`Permission denied: shell`). Je n'ai donc
  **pas** pu lancer `npm view`, ni construire un bundle local, ni mesurer sur téléphone, ni capturer de frames.
- Versions, dates, licences, pairs : lus **dans le registre npm** (`https://registry.npmjs.org/<paquet>`, document complet
  du paquet, champs `dist-tags.latest`, `time`, `license`, `peerDependencies`, `dist.unpackedSize`), le 28/10/2026.
- **Poids** — trois sources, à ne pas confondre :
  1. **Mesuré par moi, tree-shaké** : service `bundlejs` (esbuild côté serveur, `minify`, compression `gzip`), requête
     `https://deno.bundlejs.com/?q=<paquet>@<version>&treeshake=[{<exports>}]`. Chaque ligne donne les exports demandés.
     C'est une approximation d'un `vite build` (Rollup/esbuild), pas la mesure du projet.
  2. **Entrée entière, non tree-shakée** : `https://bundlephobia.com/api/size?package=<paquet>@<version>`.
     Utile comme plafond, **trompeur** comme coût réel (la doc de Motion le dit elle-même, cf. §2).
  3. **Sourcé** : chiffres publiés par le projet (docs officielles), cités avec leur URL.
- **Pour reproduire une mesure** (à lancer par quelqu'un qui a un shell) :
  ```bash
  mkdir /tmp/mesure && cd /tmp/mesure && npm init -y >/dev/null && npm i esbuild <paquet>@<version>
  echo "export { <exports> } from '<paquet>'" > e.js
  npx esbuild e.js --bundle --minify --format=esm --outfile=o.js
  wc -c o.js; gzip -9 -c o.js | wc -c
  ```
- Le projet n'a pas de `dist/` dans le dépôt (Glob `dist/assets/*.js` : aucun résultat), donc je ne connais **pas** le poids
  réel de `framer-motion` dans le bundle actuel : tout « coût marginal » ci-dessous est un raisonnement, pas une mesure.
- « Non vérifié » = je ne l'ai pas contrôlé à la source. « Non documenté » = la doc consultée n'en dit rien.

## 1. État du projet (lu, pas supposé)

| Fait | Source |
|---|---|
| `package.json` : `framer-motion ^14.3.0`, `react ^19.3.1`, `jsdom ^30.1.3`, `vitest ^5.0.5`, `vite ^8.3.4` | `/home/chapax/Documents/opencode/gamedev/planquex/package.json` |
| **Installé** (lockfile) : `framer-motion 14.3.0`, `motion-dom 14.3.0`, `motion-utils 14.1.1`, `react 19.3.1`, `jsdom 30.1.3` | `package-lock.json` l. 6422-6431, 7605-7607, 9142-9143 |
| Le caret `^14.3.0` **résoudrait aujourd'hui en 14.7.1** (dernier du registre) sur une installation sans lockfile | registre npm, `dist-tags.latest = 14.7.1` publié le 27/10/2026 |
| Usages actuels : `motion` (Battle, Home, CardView), `AnimatePresence`, `useReducedMotion` ; **aucun** `MotionConfig`, `LazyMotion`, `useMotionValue`, `animate` | Grep `src/` |
| **Point de bascule** déjà en place : `useMouvementReduit()` = réglage du store **OU** `useReducedMotion()` ; pose `data-mouvement-reduit` sur `<html>` | `src/components/use-mouvement-reduit.ts` |
| Moteur de combat : `canvas` 2D + `el.animate(...)` (WAAPI) + `requestAnimationFrame`, sans dépendance | `src/animation/moteur.ts` l. 179-224, 300, 399 |
| Les tests **mockent** `framer-motion` parce que `whileHover` ne produit jamais de `transform` dans jsdom | `src/components/CardView.test.tsx` l. 8-20 |
| `setPointerCapture` est déjà **stubbé à la main** dans un test d'écran | `src/pages/Comite.placement.test.tsx` l. 184 |
| jsdom installé : `PointerEvent` **présent** (`lib/jsdom/living/events/PointerEvent-impl.js`, avec `getCoalescedEvents`) ; **aucune** occurrence de `"animate"`, `getAnimations`, `setPointerCapture` dans `lib/` ; `<canvas>` se comporte comme une `<div>` sans le paquet `canvas` | Grep/Glob `node_modules/jsdom/lib`, `README.md` l. 474 |

**Un seul projet derrière deux noms.** `framer-motion` et `motion` sont le même dépôt
(`git+https://github.com/motiondivision/motion.git` dans les deux fiches du registre). Le paquet `motion` dépend de
`framer-motion` en version **épinglée** (`motion@14.7.1` → `framer-motion: 14.7.1`, registre) ; le changelog dit
« Adding `motion` package … Replaced Motion One » à la 11.11.12 (12/11/2024). `motion/react` = l'API React de
`framer-motion`. Donc « framer-motion 14.3 » = Motion 14.3.0 du **15/10/2026** (changelog, ci-dessous) :
<https://raw.githubusercontent.com/motiondivision/motion/main/CHANGELOG.md>.

## 2. Primitives de la plateforme (aucune dépendance)

Sources : caniuse (`https://raw.githubusercontent.com/Fyrd/caniuse/main/data.json`, lu le 28/10/2026) et
browser-compat-data MDN (`https://raw.githubusercontent.com/mdn/browser-compat-data/main/<chemin>.json`).

| Primitive | Support (version d'entrée) | Pourquoi ça compte ici |
|---|---|---|
| Pointer Events | usage mondial 97,4 % ; iOS Safari 26.6→27.2 et Chrome Android 156 : oui (caniuse `pointer`) | geste unifié doigt/souris |
| `Element.setPointerCapture` | Safari 13, Chrome 55 (BCD `api/Element`) | garder le doigt « accroché » pendant la déchirure |
| `PointerEvent.getCoalescedEvents()` / `getPredictedEvents()` | Chrome 58 / 77 ; Firefox 59 / 89 ; **Safari 18.2** (BCD `api/PointerEvent`) | trace plus fine de la déchirure sur iOS récent seulement |
| Web Animations (`Element.animate`) | Safari 13.1, Chrome 36, Firefox 48 ; iOS : « partiel » = **pas de modes de composition** (caniuse `web-animation`, note 5) | animations compositeur |
| `Animation.currentTime` (pilotage « scrub ») | Safari 13.1, Chrome 75 (BCD `api/Animation`) | déchirure = animation en pause dont on règle `currentTime = progression × durée` : **annulable** et réversible gratuitement |
| `@property` (variable CSS typée, donc animable) | Chrome 85, Safari **16.4**, Firefox **128** (BCD `css/at-rules/property`) | animer `--tear`, `--depth` sans JS par image |
| Easing `linear()` | Chrome 113, Safari 17.2, Firefox 112 (BCD `css/types/easing-function`) | ressorts « cuits » en WAAPI |
| `animation-timeline` (scroll/view timelines) | Chrome 115, **Safari 26**, Firefox 159 (BCD) | **non pertinent** : pilotage par défilement, pas par pointeur |
| Transforms 3D | 97,28 % (caniuse `transforms3d`) | retournement des cartes, sans bibliothèque |
| `clip-path` sur HTML | Safari iOS : « partiel » = formes (`polygon()`) et `url(#svg)` en SVG inline OK, pas les formes en SVG externes (caniuse `css-clip-path`, note 2) | arrachement de la bande haute |
| Filtres SVG / CSS `filter` / `backdrop-filter` | 97,1-97,5 % (caniuse) | existent ; **leur coût par image sur téléphone milieu de gamme est non mesuré** |
| `mix-blend-mode` | iOS Safari « partiel » : **pas** `hue`, `saturation`, `color`, `luminosity` (caniuse `css-mixblendmode`, note 2) | éviter ces quatre modes pour le reflet du film |
| CSS Paint API (Houdini) | **non supporté sur iOS Safari** (caniuse `css-paint-api`) | exclu |
| WebGL / WebGL2 / OffscreenCanvas | 97,5 % / 97,1 % / 96,3 % (caniuse) | WebGL est disponible, **mais jamais dans jsdom** |

`prefers-reduced-motion` : la page MDN est <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
(le projet la lit déjà via `useReducedMotion`).

## 3. Récapitulatif (une ligne par candidat)

Poids = min+gzip, **tree-shaké** quand c'est écrit « mesuré » ; « entrée » = non tree-shaké (plafond).
Dernière release = champ `time[latest]` du registre. Âge calculé au 28/10/2026.

| Candidat | Paquet@version (registre) | Dernière release | Licence | Poids (min+gzip) | React 19 |
|---|---|---|---|---|---|
| (a) CSS + WAAPI + Pointer Events | — | — | — | **0 octet** | sans objet |
| (b) Motion / framer-motion | `framer-motion@14.7.1`, `motion@14.7.1` | **27/10/2026** (11 versions du 02 au 27/10) | MIT | `motion` ≈43 ko, `m`+`LazyMotion` ≈5 ko +24 (domAnimation) ou +38 (domMax), `animate` mini 3,2 ko / hybride 22 ko (docs) ; entrée 73 ko (bundlephobia) | oui (`react ^18 \|\| ^19`) |
| (c) Canvas 2D à la main | — | — | — | 0 octet (+ ton code) | sans objet |
| (d) OGL | `ogl@1.0.11` | 27/01/2025 (≈21 mois) | Unlicense | **14,4 ko** mesuré (`Renderer, Program, Mesh, Plane, Texture`) | sans objet (pas de React) |
| (d) twgl | `twgl.js@7.0.0` | 16/07/2025 | MIT | **10,7 ko** mesuré (4 fonctions) | sans objet |
| (d) regl | `regl@2.1.1` | 12/11/2024 (≈23 mois) | MIT | **41,5 ko** mesuré | sans objet |
| (d) WebGL brut | — | — | — | 0 octet (+ ~100-200 lignes de shader/boîte à outils : estimation) | sans objet |
| (e) PixiJS v8 | `pixi.js@8.22.0` | 01/10/2026 (+ builds `dev` quasi quotidiens) | MIT | entrée **264 ko** (bundlephobia) ; tree-shaké minimal : **non vérifié** (le service a expiré) | `@pixi/react@8.0.5` : `react >=19` |
| (f) Three.js | `three@0.186.1` | 24/09/2026 | MIT | **133 ko** mesuré (`WebGLRenderer, Scene, PerspectiveCamera, Mesh, PlaneGeometry, ShaderMaterial`) ; entrée 185 ko | `@react-three/fiber@9.8.2` : `react >=19 <19.4` (projet : 19.3.1) |
| (g) GSAP | `gsap@3.15.0` | 13/04/2026 (3.14.0 → 3.15.0 : ~4 mois) | « Standard no charge » (propriétaire, gratuite, usage commercial inclus) | cœur **27,7 ko** + Draggable **13,5 ko** mesurés | `@gsap/react@2.1.2` : `react >=17` |
| (h) dotLottie | `@lottiefiles/dotlottie-web@0.81.0` | 06/10/2026 | MIT | JS **13,9 ko** mesuré (`DotLottie`) **+ WASM ≈500 ko compressé** (docs) | `dotlottie-react@0.20.0` : `^17 \|\| ^18 \|\| ^19` |
| (h) lottie-web | `lottie-web@5.13.0` | 21/05/2025 (≈17 mois) | MIT | `lottie_light` **48,1 ko** mesuré | sans objet (pas de React) |
| (h) Rive | `@rive-app/canvas-lite@2.48.0` | 27/10/2026 | MIT | JS entrée 56 ko (bundlephobia) **+ WASM 707 ko brut / 222 ko brotli** (docs Rive) | `@rive-app/react-canvas@4.38.0` : `react ^16.8…^19.0` |
| (i) @use-gesture | `@use-gesture/react@10.3.1` | 21/03/2024 (≈19 mois) | MIT | `useDrag` **10,0 ko** mesuré ; vanilla `DragGesture` 7,0 ko | `react >= 16.8` |
| (j) Theatre.js | `@theatre/core@0.7.2` | 19/05/2024 (≈17 mois) | core Apache-2.0 ; **studio AGPL-3.0-only** | entrée 31 ko (bundlephobia) | `@theatre/r3f@0.7.2` : fiber `^8.13.6` → **incompatible avec R3F 9** |
| (+) canvas-confetti | `canvas-confetti@1.9.4` | 25/10/2025 | ISC | **4,3 ko** mesuré | sans objet |
| (+) tsParticles confetti | `@tsparticles/confetti@4.5.0` | 25/10/2026 | MIT | entrée 25 ko, 16 dépendances internes | sans objet |

URL de chaque ligne : registre `https://registry.npmjs.org/<paquet>` ; mesures `https://deno.bundlejs.com/?q=…` (exports ci-dessus) ;
entrée `https://bundlephobia.com/api/size?package=<paquet>@<version>`.

## 4. Fiches par candidat

### (a) CSS + API Web Animations + Pointer Events — sans dépendance

| Critère | Constat |
|---|---|
| Poids / licence / maintenance | 0 octet, norme du web (cf. §2). Déjà utilisé par `src/animation/moteur.ts` (`el.animate`, `canvas`). |
| GESTES | Pointer Events + `setPointerCapture` + `touch-action: none` : tout est à écrire (~50-100 lignes : capture, seuil, annulation `pointercancel`). `getCoalescedEvents` seulement Safari ≥ 18.2. Le projet l'a déjà fait (`Comite.tsx` l. 258). |
| DÉFORMATION + REFLET | Pas de vraie déformation de surface. On **simule** le creux : variables CSS (`--px`, `--py`, `--creux`) écrites par un gestionnaire limité à une fois par image, lues par `radial-gradient` / `repeating-radial-gradient` (plis concentriques, reflet spéculaire) + légère `transform: perspective() rotateX/Y scale`. Rendu **plausible mais plat** : hypothèse à valider par planche de frames. Les filtres SVG (`feSpecularLighting`/`feDisplacementMap`) donneraient une vraie normale mais leur coût mobile n'est **pas mesuré**. |
| DÉCHIRURE progressive | Bon ajustement : progression `p∈[0,1]` projetée sur la ligne de pointillés ; rendu par `clip-path: polygon(...)` (bord déchiré généré avec le RNG **seedé**) sur deux couches, ou animation WAAPI en pause avec `currentTime = p × durée` (annulable, réversible). `clip-path` repeint mais ne recalcule pas la mise en page : acceptable sur un élément unique. |
| ÉCLAT + particules | Éclat = couche `conic-gradient`/`radial-gradient` animée en `opacity`+`transform` (compositeur). Poussière = le `canvas` du moteur existant (≤ 600 particules). |
| RETOURNEMENT 3D | `transform-style: preserve-3d` + `backface-visibility: hidden` + `rotateY` : 97 % de support (§2). Les cartes restent de **vrais composants React**. |
| jsdom | Machine d'états **100 % testable** (pas de DOM). Côté DOM : `PointerEvent` existe ; `setPointerCapture` et `Element.animate` **n'existent pas** (observé) → doubles de test à écrire (déjà fait pour le premier dans `Comite.placement.test.tsx`). |
| Mouvement réduit | Totalement sous contrôle : `useMouvementReduit()` existe déjà ; l'état final se pose en `duration: 0`. |

### (b) Motion (`framer-motion` 14.x, installé : 14.3.0)

Sources : `https://motion.dev/docs/react-reduce-bundle-size`, `…/docs/react-lazy-motion`, `…/docs/animate`,
`…/docs/react-gestures`, `…/docs/react-accessibility`, changelog (URL §1).

| Critère | Constat |
|---|---|
| Poids | Doc : `motion` composant **43 ko** (« impossible à tree-shaker plus petit »), `m`+`LazyMotion` « un peu plus de **5 ko** » pour le premier rendu, `domAnimation` **+24 ko** (animations, variants, exit, tap/hover/focus), `domMax` **+38 ko** (+ pan/drag + layout). `animate()` : mini **3,2 ko** (WAAPI seule), hybride **22 ko**. `useAnimate` : 3,3 / 23 ko. Chiffres Rollup, donnés par la doc, **pas remesurés par moi** (mon essai `bundlejs` a expiré à chaque tentative (3 requêtes distinctes, plusieurs essais), `esm.sh` ne tree-shake pas). **Coût marginal ici ≈ nul à faible** puisque le composant `motion` (≈43 ko) est déjà dans le bundle (non mesuré dans le projet). |
| Licence / maintenance | MIT. Cadence **très élevée** : 14.0.0 le 02/10 → 14.7.1 le 27/10/2026 (11 versions). Les correctifs récents touchent justement ce qu'on utiliserait : « Hardware accelerated independent transforms » (14.2.0), « Fix accelerated independent transform animations vanishing… » (14.3.1), « Demote transforms to CPU when interrupted by layout animations » (14.7.1), « Fix drag inertia stopping dead after a fast flick » (14.7.0). |
| React 19 | Oui (`peerDependencies: react ^18 \|\| ^19`) ; suite de tests React 19 en CI depuis 12.29.0. |
| GESTES | `drag` (axes, contraintes, `dragSnapToOrigin`, inertie), `onPan` (seuil 3 px, exige `touch-action`), `whileTap`, `useDragControls` ; **drag également en JS pur depuis 14.4.0**. Avec `LazyMotion`, `drag`/`pan` demandent `domMax` (+38 ko) ; avec le `motion` complet, c'est inclus. Piège doc : les gestes ne se posent pas sur les éléments `<filter>` SVG (variants depuis un parent). |
| DÉFORMATION + REFLET | Aucune déformation propre. Apporte `useMotionValue` / `useTransform` / `useSpring` (ressort sur la profondeur du creux, retour élastique au relâchement). `animate()` hybride anime **les variables CSS** (`animate(el, {"--rotate": "360deg"})`), et **des attributs de primitives de filtre SVG** (`animate("feTurbulence", { baseFrequency: 0.5 })` et `<motion.feGaussianBlur stdDeviation>` dans la doc). Le mini ne peut animer une variable CSS que si elle est **enregistrée** (`@property`). Les attributs SVG passent par le fil principal (déduction : WAAPI n'anime pas les attributs ; non vérifié). |
| DÉCHIRURE progressive | Pas de primitive. On pilote `useMotionValue(p)` depuis le pointeur et on dérive `clip-path`/variable CSS avec `useTransform` ; `animate(p, 0)` pour annuler en douceur. Équivalent fonctionnel du WAAPI en pause, avec ressorts en plus. |
| ÉCLAT + particules | Pas de particules. `stagger()` (options `grid`, `from: "edges" \| "random"` depuis 14.3.0) et séquences `animate([...])` (« timelines mutables » en 14.7.0) servent bien l'éventail et le décalage des 5 cartes. |
| RETOURNEMENT 3D | `rotateX/Y/Z`, `transformPerspective`, `scaleZ` (14.3.0) animables indépendamment ; transformations indépendantes **accélérées** depuis 14.2.0 (voir cadence ci-dessus : zone encore remuée). |
| jsdom | **Mauvais.** Le dépôt Motion écrit lui-même : « JSDOM does not support WAAPI (`Element.animate()`), so Jest tests only cover the JS animation fallback path » et renvoie le visuel vers Cypress/Playwright (<https://github.com/motiondivision/motion/blob/main/CLAUDE.md>). Le projet constate la même chose (`CardView.test.tsx`) et mocke la bibliothèque. Nouveauté utile : `stepFrames` (« pour les tests, avance la boucle de frames de `duration` ») et `processFrame` (14.6.0) — **non essayés** ici. |
| Mouvement réduit | `MotionConfig reducedMotion="user" \| "always" \| "never"` : coupe **seulement** transformations et layout, **garde** `opacity`/couleur (doc accessibilité). Insuffisant pour « tout couper » → il faut une branche manuelle sur `useMouvementReduit()` ; `MotionConfig skipAnimations` existe (12.30.0) mais sa sémantique n'est **pas documentée** dans ce que j'ai lu. Nuance : le projet utilise déjà `useReducedMotion`. |

### (c) Canvas 2D écrit à la main

| Critère | Constat |
|---|---|
| Poids / licence | 0 octet ; déjà maîtrisé (`moteur.ts`, 2 canvas, ≤ 600 particules, `getContext('2d')`). |
| GESTES | Aucun : à écrire (identique à (a)). |
| DÉFORMATION + REFLET | Shading par pixel de tout le sachet en CPU : **hypothèse** défavorable à 60 im/s sur téléphone milieu de gamme (un sachet ≈ 340×500 px × dpr 2 ≈ 0,7 Mpx), non mesurée. Voie réaliste : dégradés radiaux + traits concentriques dessinés (équivalent du CSS), ou normale calculée sur une grille basse résolution. |
| DÉCHIRURE | Aisée : `clip`/`Path2D` dentelé suivant `p`. |
| ÉCLAT + particules | **Le bon outil**, déjà là. |
| RETOURNEMENT 3D | Mauvais : les cartes sont des composants React (DOM) ; la 3D reste en CSS. |
| jsdom | `<canvas>` = `<div>` sans le paquet `canvas` (README jsdom) : on ne teste que la logique, pas les pixels. |
| Mouvement réduit | Total (le moteur lit déjà le même point de bascule). |

### (d) WebGL brut ou micro-bibliothèque (OGL, twgl, regl)

| Critère | Constat |
|---|---|
| Poids | OGL 14,4 ko, twgl 10,7 ko, regl 41,5 ko (mesurés, cf. §3). WebGL brut : 0 dépendance. |
| Maintenance | **Faible** : OGL dernière release 27/01/2025, regl 12/11/2024 ; twgl 16/07/2025. Les trois sont stables mais quasi à l'arrêt ; OGL est « Unlicense » (domaine public). |
| React 19 | Sans objet (aucun pair React). |
| GESTES | Aucun (mêmes Pointer Events). |
| DÉFORMATION + REFLET | **Le seul vrai bon rendu** : un plan maillé dont le vertex shader creuse sous le point touché, un fragment shader qui calcule la normale et un spéculaire froid sur film procédural (aucune texture nécessaire). Coût : GLSL à écrire/tester, gestion de perte de contexte, un 3ᵉ contexte graphique à côté des deux `canvas` 2D. |
| DÉCHIRURE | Possible en shader (`discard` le long d'une courbe de bruit), plus de travail que `clip-path`. |
| ÉCLAT + particules | Faisable (points) mais redondant avec `moteur.ts`. |
| RETOURNEMENT 3D | Inutile et nuisible : les cartes sont du DOM, pas des textures. Le canvas WebGL ne porterait que le **film** (superposé sous/sur le DOM). |
| jsdom | **Aucun WebGL dans jsdom** : le rendu n'est testable que par navigateur réel. Les formes (machine d'états, tracé du maillage) se testent en pur TS. |
| Mouvement réduit | Au choix : ne pas monter le canvas, poser l'état final. |

### (e) PixiJS v8

| Critère | Constat |
|---|---|
| Poids | Entrée **924 ko / 264 ko gzip** (bundlephobia). Le guide de migration v8 admet que les extensions sont importées par défaut ; `skipExtensionImports` + imports manuels réduisent, mais l'issue #10392 de Pixi relève que le code des « renderables » reste lié au pipeline (≈ 20 % pour le vectoriel). **Tree-shaké minimal non vérifié.** |
| Licence / maintenance | MIT ; 8.22.0 le 01/10/2026, builds `dev` presque quotidiens : très actif. |
| React 19 | `@pixi/react@8.0.5` (01/12/2025) : `react >= 19`. Réconciliateur propre (`react-reconciler 0.31.0`). |
| GESTES | Système d'événements de scène (`pixi.js/events`) : utile **dans** la scène seulement. |
| DÉFORMATION + REFLET | `DisplacementFilter` livré (« distord un objet à l'aide d'une autre texture ») + filtres `ColorMatrix`, `Noise` ; `Mesh` pour déformer un plan. <https://pixijs.com/8.x/guides/components/filters>. |
| DÉCHIRURE | Masque/mesh : faisable, pas d'aide spécifique. |
| ÉCLAT + particules | `ParticleContainer` (forte densité) — point fort, mais inutile pour ≤ 600 particules déjà tenues en 2D. |
| RETOURNEMENT 3D | Non : scène 2D. |
| jsdom | Pas de WebGL : mock lourd ou navigateur réel. |
| Mouvement réduit | Manuel. |
| Verdict | **Disproportionné** : ≥ 100 ko gzip de plus pour ce que (a)+(c) ou un shader de 150 lignes font. |

### (f) Three.js / react-three-fiber

| Critère | Constat |
|---|---|
| Poids | Minimum mesuré **133 ko gzip** (renderer + plan + `ShaderMaterial`) ; entrée 185 ko. `@react-three/fiber` : entrée 58 ko gzip, 10 dépendances ; `@react-three/drei` 10.7.9 : 21 dépendances (dont `@use-gesture/react`). Ordre de grandeur total ≈ **190 ko gzip**. |
| Licence / maintenance | MIT ; three 0.186.1 (24/09/2026), R3F 9.8.2 (14/10/2026) et **R3F 10 en alpha/canary** (17-21/10/2026) : migration probable. |
| React 19 | R3F 9 : `react >=19 <19.4` — **plafond de pair** à surveiller (projet : 19.3.1). |
| GESTES | R3F relaie des événements de pointeur sur les meshes (raycasting) ; sinon rien. |
| DÉFORMATION + REFLET | Excellent (plan subdivisé, normal map, matériau physique) — mais 133 ko pour 1 plan. |
| DÉCHIRURE / ÉCLAT | Shaders/`Points` ; redondants. |
| RETOURNEMENT 3D | Natif **pour des objets WebGL** ; les cartes seraient des textures → on perdrait « vrais composants React ». `Html` de drei réintroduit du DOM projeté (coût, dépendances). |
| jsdom | `@react-three/test-renderer` existe (**non vérifié**) ; pas de pixels. |
| Mouvement réduit | Manuel. |
| Verdict | **Non** : poids et plafond de pair disproportionnés. |

### (g) GSAP

Sources : <https://gsap.com/standard-license>, <https://webflow.com/updates/gsap-becomes-free>, <https://gsap.com/blog/3-13/>,
<https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/>.

| Critère | Constat |
|---|---|
| Licence 2026 | **Gratuite pour tous, usage commercial compris, plugins « Club » inclus** (Draggable, Inertia, Observer, Flip, SplitText, MorphSVG, DrawSVG…) depuis le **30/04/2025** (Webflow). Ce n'est **pas** une licence open source : « Standard "No Charge" License », propriété de Webflow, révocable en cas de non-respect, **modifiable unilatéralement** (« Amendments » : les versions antérieures restent utilisables aux conditions d'avant). Usage interdit : outils de création d'animation visuelle sans code qui concurrencent Webflow — ne concerne pas un jeu. Le champ `license` du registre est une URL, pas un identifiant SPDX. |
| Poids | Cœur **27,7 ko gzip** (70,6 ko min) ; `Draggable` **13,5 ko** (35,3 ko min, mesuré hors cœur) → ≈ 41 ko gzip pour cœur+Draggable. Le paquet npm fait 6,26 Mo décompressé (tous plugins) mais le tree-shaking par import nommé ne ramène que ce qu'on importe. |
| Maintenance | 3.14.0 (≈ 08/12/2025) → 3.15.0 (13/04/2026) ; équipe d'origine conservée selon l'annonce 3.13. Cadence plus lente que Motion. |
| React 19 | Cœur sans React ; `@gsap/react@2.1.2` (`useGSAP`) : `react >=17` (dernière release 15/01/2025). |
| GESTES | `Draggable` (limites, accrochage, inertie via `InertiaPlugin`), `Observer`. Plus riche que `drag` de Motion, mais ajoute un second moteur d'animation à côté de Motion déjà installé. |
| DÉFORMATION + REFLET | Aucun : anime des valeurs (variables CSS, attributs SVG, `MorphSVG`). |
| DÉCHIRURE | Excellente primitive de **scrub** : une timeline dont on règle `progress(p)` depuis le pointeur (API connue ; **non relue** cette session). |
| ÉCLAT + particules | Aucune. |
| RETOURNEMENT 3D | Anime `rotationY`/`transformPerspective` ; équivalent à Motion. |
| jsdom | Moteur 100 % JS (rAF) : **plausible** mais non vérifié ici. |
| Mouvement réduit | `gsap.matchMedia()` avec `(prefers-reduced-motion: reduce)` : annule et **rétablit** automatiquement les animations créées dans la fonction (doc) — mais pilote le média, pas le **réglage du store** : à brancher à la main. |
| Verdict | Aucun gain décisif sur Motion déjà installé ; la licence est un risque de gouvernance (clause modifiable). **Non.** |

### (h) Lottie / dotLottie et Rive

Sources : <https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/state-machines>,
<https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/advanced/performance>,
<https://rive.app/docs/runtimes/runtime-sizes>, <https://rive.app/docs/runtimes/web/faq>.

| Critère | dotLottie (`dotlottie-web`) | Rive (`@rive-app/canvas-lite`) |
|---|---|---|
| Poids | JS 13,9 ko gzip mesuré + **WASM ≈ 500 ko compressé** (doc) / 1,17-1,37 Mo brut selon version et variante (listes jsDelivr/unpkg des 0.79-0.80) | WASM **707 ko brut / 222 ko brotli** (`canvas-lite`), 1728 / 567 ko (`canvas`), 2179 / 648 ko (`webgl2`) — doc mise à jour janvier 2026 ; plus le JS (56 ko gzip en entrée, bundlephobia) |
| Licence | MIT | MIT |
| Maintenance | 0.81.0 le 06/10/2026 (0.80.0 le 28/08) | 2.48.0 le 27/10/2026 (4 versions en 5 jours) |
| React 19 | `dotlottie-react@0.20.0` : `^17 \|\| ^18 \|\| ^19` | `react-canvas@4.38.0` : `…^19.0` |
| GESTES | **Machine d'états au pointeur : oui.** Interactions `PointerDown/Up/Move/Enter/Exit` et `Click`, restreignables à un calque (`layerName`) ; la bibliothèque pose elle-même les écouteurs ; `stateMachinePost*Event(x, y)` pour injecter ; entrées booléennes/numériques/chaîne (`stateMachineSetNumericInput`). | Écouteurs de pointeur dans le fichier `.riv` (machine d'états), `isTouchScrollEnabled`, multitouch ; les entrées de machine d'états sont **dépréciées** au profit du *data binding* (déclaration du `.d.ts` 2.44.1). |
| DÉFORMATION + REFLET | Rejoue une animation **pré-authored** ; réagir à la **position** exacte du doigt (creux sous le point touché) : **non documenté** pour une entrée numérique continue. | Idem ; plus apte (valeurs liées par *data binding*) mais **non vérifié** pour un creux continu. |
| DÉCHIRURE progressive | Une progression `0..1` annulable via entrée numérique : **non documenté**. `lottie-web` offre `goToAndStop(frame)` (**non relu**). | Entrée numérique de progression : plausible, **non vérifié**. |
| ÉCLAT + particules | Oui, mais figés dans l'animation. | Oui, idem. |
| RETOURNEMENT 3D | Non (2D vectoriel). | Non (2D). |
| jsdom | WASM + canvas : non testable en jsdom ; seuls les événements/état sont simulables. | Idem. |
| Mouvement réduit | Manuel (arrêt de la machine, `stateMachineStop`) | Manuel. |
| Risques propres | Par défaut, le WASM est **téléchargé depuis un CDN** à la construction du premier lecteur (doc performance : « fetched from a CDN ») — conflit avec une PWA hors ligne et avec la page Confidentialité (« aucun traceur ») ; `setWasmUrl()` permet l'auto-hébergement. Il faut aussi un **outil d'auteur** (LottieFiles/After Effects ou éditeur Rive) absent du dépôt. | Même nécessité d'un éditeur propriétaire (éditeur Rive) ; WASM par défaut : mode de chargement **non vérifié**. |
| Verdict | **Non** : de 0,5 à 1,2 Mo de WASM pour des cartes DOM qu'on ne peut pas mettre dedans, un flux d'auteur à créer, et un pilotage continu au doigt non documenté. À écarter. | Idem. |

### (i) @use-gesture

| Critère | Constat |
|---|---|
| Poids / licence | `useDrag` 10,0 ko gzip (29,2 ko min), vanilla 7,0 ko gzip ; MIT. |
| Maintenance | Dernière release **21/03/2024** (10.3.1). Discussion « Is this lib no longer being maintained? » (#689, avril 2025) : « last commit last year ». Septembre 2026 : l'issue #711 « offering help with reviews, CI and releases » est ouverte ; des PR de correctifs (`setPointerCapture` en try/catch, `transform` qui fige pinch/wheel) existent mais **aucune release** depuis 2024 dans le registre. Bugs iOS ouverts : `preventScroll` (#693, #694), `preventDefault` conditionnel (#685). |
| React 19 | pair `react >= 16.8` (aucune déclaration spécifique à 19). |
| Apport | drag/pinch/wheel/hover/scroll, cinétique (vitesse, direction), seuil (`threshold`), `filterTaps`, `delay`. |
| Contre | Redondant avec `drag`/`onPan` de Motion et avec ~60 lignes de Pointer Events ; la déchirure demande un geste **le long d'une ligne**, qu'aucune de ces bibliothèques ne fournit. Doc : « toujours poser `touchAction` ». |
| jsdom | Basé sur les événements du DOM → testable avec `PointerEvent`, mais **non essayé**. |
| Verdict | **Non** : peu de gain, maintenance douteuse. |

### (j) Theatre.js

| Critère | Constat |
|---|---|
| Poids | `@theatre/core` entrée 31 ko gzip (100 ko min). |
| Licence | core Apache-2.0 ; `@theatre/studio` **AGPL-3.0-only** (éditeur, devrait rester hors du build de production). |
| Maintenance | **Dernière release 19/05/2024** (≈17 mois). `@theatre/r3f` déclare `@react-three/fiber ^8.13.6` : incompatible avec R3F 9 (React 19). |
| Apport | Timelines authored avec éditeur visuel ; position de séquence pilotable par code (non relu). |
| Verdict | **Non** : outil d'auteur sans bénéfice ici (animation pilotée par le doigt, pas par un scénario), maintenance arrêtée, licence AGPL à manipuler avec soin. |

### (+) Particules en bibliothèque

- `canvas-confetti@1.9.4` : 4,3 ko gzip, ISC, option `disableForReducedMotion` (README, désactivée par défaut). Formes de confettis ≠ « poussière dorée » ; le moteur maison fait déjà mieux pour ce besoin.
- `@tsparticles/confetti@4.5.0` : 16 paquets internes, 25 ko gzip en entrée. Non.

## 5. Recommandation : un outil par temps

Principe : **zéro dépendance nouvelle** ; la machine d'états est du TypeScript pur, la couche visuelle est interchangeable.

| Temps | Outil recommandé | Pourquoi / à quel prix |
|---|---|---|
| Machine d'états (fermé → pressé → étiquette retirée → déchirure(p) → ouvert → révélé) | **TypeScript pur** (réducteur), aucune bibliothèque | Testable en jsdom sans mock d'animation. « Tout afficher » = une action `sauter` qui fixe l'état final. C'est ce qui rend le « Mouvement réduit » trivial : même transition, durées nulles. |
| Couche geste (appui, étiquette, déchirure) | **Pointer Events à la main** (`setPointerCapture`, `touch-action: none`, `pointercancel` = annulation) | ~100 lignes, aucun poids, déjà éprouvé dans `Comite.tsx` ; la projection du doigt sur la ligne de pointillés n'est fournie par aucune bibliothèque. `@use-gesture` écarté (maintenance), `drag` de Motion possible pour l'étiquette seulement. |
| 1. TOUCHER — creux + reflet | **CSS** (variables `--px/--py/--creux` + dégradés radiaux/concentriques) ; retour élastique par **`animate()`/`useSpring` de Motion** | Gratuit en poids. Risque : rendu trop plat → voir plan B. |
| 2. ÉTIQUETTE | Suivi du doigt écrit à la main ; retour/éjection par **Motion** (`animate`, ressort) | Seuil de détachement = valeur de la machine, donc testable. |
| 3. DÉCHIRURE(p) | **`clip-path: polygon()` + variable `--tear`** écrits à partir de `p` (bord dentelé seedé) ; annulation par `animate(p, 0)` | `p` est dans la machine → testable (`data-progress`, état). WAAPI en pause à `currentTime = p × durée` est l'alternative sans Motion. |
| 4a. OUVERTURE — éclat + poussière | **`canvas` 2D du moteur existant** (≤ 600 particules) + couche dégradé en `opacity`/`transform` | Zéro dépendance ; `canvas-confetti` apporte moins que ce qu'on a. |
| 4b. ÉVENTAIL + RETOURNEMENT | **Motion** (`animate` + `stagger`, `rotateY`) ou CSS WAAPI, cartes = vrais `CardView` | `motion` déjà installé (coût marginal ≈ nul). Cartes DOM : exclut WebGL/Pixi/Lottie/Rive/Three pour cette étape. |
| 5. TOUT AFFICHER | Action de la machine → états finaux + `duration: 0` | Idem « Mouvement réduit ». |
| Mouvement réduit | `useMouvementReduit()` existant, **plus** `<MotionConfig reducedMotion={reduit ? 'always' : 'never'}>` | `MotionConfig` ne coupe que transform/layout et garde `opacity` : il faut **aussi** une branche explicite (sinon un fondu continue). À couvrir par un test « le contrôle mord » (cas fautif : un fondu qui subsiste). |

**Coût.** Dépendances nouvelles : **0**. Poids ajouté : **≈ 0 à quelques ko** (code maison) ; `animate`/`useMotionValue`/`useTransform` partagent le code de `motion` déjà présent (hypothèse, non mesurée : à confirmer avec `npm run pesage` avant/après).
Passer de `motion` à `m`+`LazyMotion`+`domMax` ne gagnerait rien (5 + 38 ≈ 43 ko, doc) ; `domAnimation` (≈ 29 ko) gagnerait ≈ 14 ko mais perdrait `drag`/`pan` : décision à part, hors de ce chantier.

**Plan B pour le creux (si les planches montrent un rendu plat)** — chargé **à la demande** (`import()`), seulement pour l'écran d'ouverture :
1. **WebGL brut** (0 dépendance, ~150 lignes) ou **OGL** (14,4 ko gzip, Unlicense) pour un plan creusé avec spéculaire froid procédural ;
2. repli CSS si `getContext('webgl')` échoue ou si le Mouvement réduit est actif.
Pas Pixi, pas Three/R3F (133-190 ko gzip, plafond de pair `react <19.4`).

## 6. Ce qui reste risqué

1. **Le « creux » en CSS pur peut paraître plat** : aucune vraie normale. Seule une planche de frames dans Chrome (et un test sur iOS) tranche.
2. **Filtres SVG** (`feDisplacementMap`, `feSpecularLighting`) : prometteurs sur le papier, coût par image sur téléphone milieu de gamme **non mesuré** ; ne pas les mettre dans le chemin chaud sans mesure.
3. **Churn de Motion 14.x** : 11 versions en 25 jours, dont des correctifs sur les transformations accélérées et le drag. Le lockfile fige 14.3.0 ; un `npm install` sans lockfile prendrait 14.7.1. Changer de version = refaire la planche de frames.
4. **Safari** : `mix-blend-mode` sans `hue/saturation/color/luminosity` ; `clip-path` limité aux formes de base ; `getCoalescedEvents` seulement ≥ 18.2 ; Web Animations sans modes de composition.
5. **jsdom** n'a ni `Element.animate`, ni `setPointerCapture`, ni WebGL, ni canvas réel : tout ce qui est visuel passe par la planche de frames, le reste par la machine d'états.
6. **GSAP** : licence non libre, modifiable unilatéralement (clause « Amendments ») — à ne retenir qu'en connaissance de cause.
7. **Lottie/Rive** : WASM 0,5-1,2 Mo + chargement CDN par défaut (dotLottie) contraire à « aucun traceur » et au hors-ligne.

## 7. Ce qui reste incertain

- **Poids réels dans le projet** : aucun `dist/`, aucun shell. Les poids Motion viennent de la doc officielle (Rollup), pas de ma mesure ; mes essais `bundlejs` sur Motion ont expiré (le service n'a répondu que pour GSAP, use-gesture, OGL, twgl, regl, canvas-confetti, three, dotlottie, lottie-light, theatre). Commande de reproduction au §0.
- **PixiJS tree-shaké minimal** : non obtenu.
- **Performance** de chaque rendu (CSS dégradés, filtres SVG, canvas par pixel, WebGL) sur téléphone milieu de gamme : **aucune mesure** ; tous les verdicts sur le 60 im/s sont des hypothèses.
- **Motion dans jsdom** : `stepFrames`/`processFrame` (14.6.0) n'ont pas été essayés ; je n'ai pas vérifié qu'ils rendent `animate(motionValue)` déterministe sous Vitest.
- **`MotionConfig skipAnimations`** : sémantique non lue.
- **dotLottie / Rive** : pilotage continu de la **position** du doigt (creux) et d'une **progression** annulable par entrée numérique : non documenté dans ce que j'ai lu ; mode de chargement du WASM de Rive non vérifié.
- **GSAP `timeline.progress()` en jsdom** et **`@react-three/test-renderer`** : connus de mémoire, non vérifiés.
- **Sémantique de `PointerEvent` dans jsdom** (`clientX`, `pointerId` dans l'init) : le fichier existe, son comportement n'est pas testé ici.
- **Maintenance de `@use-gesture`** : le registre ne montre aucune release depuis 2024-03-21 ; des PR récentes existent mais je n'ai pas pu dater leur fusion.

## 8. Sources (consultées le 28/10/2026)

- Registre npm : `https://registry.npmjs.org/{framer-motion,motion,motion-dom,motion-utils,gsap,@gsap%2Freact,ogl,regl,twgl.js,pixi.js,@pixi%2Freact,three,@react-three%2Ffiber,@react-three%2Fdrei,@use-gesture%2Freact,@use-gesture%2Fvanilla,lottie-web,@lottiefiles%2Fdotlottie-web,@lottiefiles%2Fdotlottie-react,@rive-app%2Fcanvas,@rive-app%2Fcanvas-lite,@rive-app%2Freact-canvas,@theatre%2Fcore,@theatre%2Fstudio,@theatre%2Fr3f,canvas-confetti,@tsparticles%2Fconfetti}`
- Mesures : `https://deno.bundlejs.com/?q=…` ; plafonds : `https://bundlephobia.com/api/size?package=…`
- Motion : <https://motion.dev/docs/react-reduce-bundle-size>, <https://motion.dev/docs/react-lazy-motion>, <https://motion.dev/docs/animate>, <https://motion.dev/docs/react-gestures>, <https://motion.dev/docs/react-accessibility>, <https://raw.githubusercontent.com/motiondivision/motion/main/CHANGELOG.md>, <https://github.com/motiondivision/motion/blob/main/CLAUDE.md>
- GSAP : <https://gsap.com/standard-license>, <https://webflow.com/updates/gsap-becomes-free>, <https://gsap.com/blog/3-13/>, <https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/>
- PixiJS : <https://pixijs.com/8.x/guides/migrations/v8>, <https://pixijs.com/8.x/guides/components/filters>, <https://github.com/pixijs/pixijs/issues/10392>
- dotLottie : <https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/state-machines>, <https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/advanced/performance>, <https://app.unpkg.com/@lottiefiles/dotlottie-web@0.79.2/files/dist/dotlottie-player.wasm>
- Rive : <https://rive.app/docs/runtimes/runtime-sizes>, <https://rive.app/docs/runtimes/web/faq>, <https://rive.app/docs/runtimes/web/web-js>
- use-gesture : <https://github.com/pmndrs/use-gesture>, <https://github.com/pmndrs/use-gesture/discussions/689>, <https://github.com/pmndrs/use-gesture/issues/711>
- canvas-confetti : <https://raw.githubusercontent.com/catdad/canvas-confetti/master/README.md>
- Plateforme : <https://raw.githubusercontent.com/Fyrd/caniuse/main/data.json>, <https://raw.githubusercontent.com/mdn/browser-compat-data/main/>{`api/PointerEvent`,`api/Animation`,`api/Element`,`css/at-rules/property`,`css/properties/animation-timeline`,`css/types/easing-function`}`.json`
- Projet (lecture seule) : `package.json`, `package-lock.json`, `src/components/use-mouvement-reduit.ts`, `src/components/CardView.test.tsx`, `src/animation/moteur.ts`, `src/pages/Comite.tsx`, `src/pages/Comite.placement.test.tsx`, `src/test/setup-jsdom.ts`, `node_modules/jsdom/{README.md,lib}`
