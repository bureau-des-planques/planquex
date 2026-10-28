# Preuve — le café attaché et la Machine (#399, 28/10/2026)

**Ce que ce lot prouve** : le défaut d'écran du post-it OUF `p-mvrome4s-f93mg6` — un café
attaché qui semblait changer de place et un café qui semblait disparaître — tel qu'il se
lisait, et ce qui a changé. Ce ne sont **pas** des preuves de règle du jeu, ni des captures
de l'application de référence.

**Ce qu'il ne prouve pas** : la mise en page à d'autres largeurs que 420 px, ni le rendu sur
un vrai téléphone. La hauteur de la barre d'action se mesure par `npm run capturer`
(`docs/preuves/combat-ui-2026-10-27/`), pas ici.

## Comment les images ont été prises

Le **build** de la branche `vague/f-combat` (`npm run build`), servi par `npx vite preview`
(port 4177), piloté par `playwright-core` avec le Chromium du cache `ms-playwright`,
fenêtre **420 × 900**. Aucun état n'est fabriqué : la partie est jouée par les boutons de
l'écran, jusqu'à un tour où la Machine tient un café.

| Image | État |
|---|---|
| `barre-avant-attache.png` | Mon tour, un café en Machine : le panneau dit **quel café** attend (pastille colorée + « SSE ») avant les cibles « Attacher 1 café ». |
| `barre-apres-attache.png` | Après l'attachement, dans le même tour : la raison remplace le panneau — « Café déjà attaché — un seul par tour. » — sur la ligne du journal, sans ajouter de rangée. |
| `rangs-avant.png` | Les deux rangs de la fiche du camp, rien d'attaché : pastille **ronde** en pointillé (aucun café attaché), puis **tasse + pastille carrée** verte (le café de la Machine). |
| `rangs-apres.png` | Après l'attachement : la pastille **ronde** est verte (le café attaché), la Machine est un **carré** en pointillé. |

## Ce que ça démontre

Avant la correction, les deux rangs étaient deux pastilles rondes voisines, chacune avec sa
place vide : un café en Machine (à droite) se lisait comme « le second café attaché », et
l'attachement le faisait passer à gauche en laissant un vide à droite — « il a changé de
place, et le second a été retiré ». Le moteur, lui, n'a jamais réordonné : `energy` ne fait
que s'allonger (`src/game/cafe-ordre.test.ts`, partie seedée, deux cafés sur une même
instance).

Après la correction, les deux rangs n'ont plus la même forme ni le même signe (rond / carré
+ tasse), et ils portent chacun leur nom (`data-cafes`, `aria-label`, lus par les tests
`src/pages/Battle.cafe.test.tsx`).
