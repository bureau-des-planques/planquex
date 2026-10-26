# Le banc d'essai des saynètes d'attaque

Le prototype jetable de **D-098** — la comparaison qui a fait retenir « un motif par
attaque, plus la cinématique » — **réparé par D-101** (#219).

**Ce n'est pas un écran de l'application.** Le banc est du **DEV** : il ne part pas dans
le bundle, il ne s'ouvre pas depuis l'interface, et il ne tourne pas dans le service
worker. Il ne sert qu'à **regarder** les animations à la taille d'un téléphone.

## L'ouvrir

```bash
npm run dev
# puis, dans le navigateur :
#   http://localhost:5178/src/prototype/scene.html
```

Vite sert le fichier comme une entrée à part (le port est celui de `vite.config.ts` ; un
autre port marche aussi — `npm run dev -- --port 5199` — et c'est le réflexe quand un
service worker d'un ancien build s'est enregistré sur la même origine, `AGENTS.md` §7.1).

`dist/` ne le contient pas, et c'est voulu :

```bash
npm run build && find dist -iname '*scene*'   # → rien
```

`vite.config.ts` ne déclare qu'une entrée, `index.html` : le banc n'est lié par aucune
route de `src/App.tsx`, donc le build ne l'atteint pas.

## Ce qu'on y voit

Le plateau reprend **le gabarit réel de `Battle.tsx`** (mêmes classes, mêmes tailles :
`.board` > `.board__side` > `.board__poste`), et la scène qui joue est la vraie —
`SceneAttaque` → `choregraphie` → `Moteur`. Seul le déclencheur est faux.

- **Deux camps** : un Poste, trois places de Banc par camp, les piles Deck et Rebut.
- **La régie**, en bas : trois scénarios d'un clic — *Attaque normale*, *Coup de grâce*,
  *Cinématique COMEX* — puis les sélecteurs d'attaquant, de Pression et de cible, et les
  cases « la cible craque », « relève à 600 ms », « Poste réservé (correctif CSS) », « la
  Direction frappe », la vitesse (×1, ×0,5, ×0,2) et « Jouer ».
- **Les sondes** `window.__scene` (`jouer`, `jouerCarte`, `vitesse`, `inverse`, `reserve`,
  `releve`, `t`, `enCours`, `info`) : c'est par elles qu'une capture règle l'état et relit
  ce qui a joué.

Le coup de grâce rejoue l'état **réel** du combat au moment du coup : la carte visée n'est
déjà plus au Poste, seul son fantôme `craquage__carte` y reste 500 ms (`DUREE_TRAINEE_MS`).

## Les cartes sont choisies par critère, jamais par id

`PrototypeScene.tsx` nommait ses cartes (dont `atelier-chef-atelier`) ; D-095 a renommé
celle-là en `atelier-responsable-process` et le banc levait « Carte introuvable » au
premier rendu. Il lit désormais **`ALL_CARDS`** par critère — faction, stade, rareté,
statut — dans `parCritere` : un renommage ne le casse plus. Le Stress affiché se dérive
des dégâts de la Pression, et la relève vient du Banc du camp visé.

Ajouter une carte ne demande donc rien ; c'est le banc qui suit le catalogue.

## Les preuves

- **Rendu** : `src/prototype/PrototypeScene.test.tsx` (sous `jsdom` : trois scénarios,
  deux `canvas`, deux Bancs de trois places, la cinématique du scénario COMEX, et
  **aucun id de carte nommé** — avec le cas qui montre que le contrôle mord).
- **Capture** : `docs/preuves/prototype-2026-10-26/`, 420 × 900, au serveur de
  développement. La capture montre la plus que le test ne peut pas : le moteur de la scène
  se tait sous `jsdom` (pas de `canvas` 2D), et `SceneAttaque` retombe alors sur son repli.
