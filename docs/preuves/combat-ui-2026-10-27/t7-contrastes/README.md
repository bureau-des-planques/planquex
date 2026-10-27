# T7 — contrastes, tailles, tells (#290) — avant / après

Quatre captures **420 × 900** du même combat (graine figée `2026-10-22T09:00Z`, `vite preview`,
Chromium du cache `ms-playwright`), prises par un script ponctuel non commité : même
amorçage du store (`tutorielVu: true`) que `scripts/capturer.mjs`.

| Fichier | État |
|---|---|
| `avant-420-arrivee.png` / `apres-420-arrivee.png` | l'arrivée, tour 1, aucun café attaché : les deux pastilles vides de chaque camp (café attaché, Machine) |
| `avant-420-tour3-cafe.png` / `apres-420-tour3-cafe.png` | après « Fin du tour » puis « Attacher 1 café » : un café SSE attaché au Poste du joueur |

À lire : la pastille du café SSE (vert) est un point de 8 px presque invisible **avant**, un disque de
18 px cerné d'un anneau crème **après** ; le mot « SEUIL » des cartes du plateau passe de 6,7 px à 9,92 px.

Les ratios sont dans `DESIGN.md` §1.5, le plancher est gardé par `src/styles-combat.test.ts`.

**Observé sur ces captures, hors du périmètre de T7, présent avant comme après** : au tour 3, avec une
Pression affichée, la barre d'action passe sur deux rangées et « Fin du tour » est rogné par la barre de
navigation. `npm run capturer` ne mesure que l'arrivée (`defilement: 0`, marge 22 px) et ne le voit pas.
