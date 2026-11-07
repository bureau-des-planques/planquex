---
version: 1
slug: "src-styles-css"
primary_target: "src/styles.css"
related_targets: ["src/App.tsx"]
---

## Portée

Toute l'application (refonte de l'univers visuel, D-189). Mode **Experience** pour le combat, Operate pour Collection, Deck, Réglages : même univers, ambition dosée par écran. Scène réelle : téléphone 420 × 900, une main, pause au travail, lumière de bureau.

## Cadrage (réponses du 07/11/2026)

- Défauts à corriger : générique, pas assez satirique, lisibilité au pouce.
- Intouchables : illustrations des cartes ; couleurs des factions (`FACTION_META`).
- À éviter : enfantin ou cartoon ; faux SaaS d'entreprise ; pastiche de bureau (faux Windows, Excel, mail) ; tout ce qui gêne le pouce (petits textes, textures, effets).
- Garde-fou propre à cet univers : **aucun emblème de l'État** (Marianne, drapeau, « République française », logo Cerfa). On emprunte la grammaire du formulaire, jamais l'identité d'une administration réelle.

## Direction contract

THESIS: Le jeu est un imprimé administratif rempli en direct : chaque zone est un cadre numéroté, chaque état une case cochée ou un tampon. Il refuse le plateau sombre et doré des TCG.

OWN-WORLD: Papier offset teinté vert-gris ; encre bleue de formulaire pour les cadres et leurs bandeaux pleins ; noir pour le texte ; rouge tampon réservé au Stress, au Seuil et aux tampons ; couleurs de faction en aplats. Coins droits, filets de 2 px, bandeaux « CADRE n — LIBELLÉ », libellés en Archivo condensé, champs remplis (noms, chiffres) en Courier Prime.

STORY: Le testeur comprend qu'il remplit le dossier que la Direction lui oppose ; il joue, voit le Stress monter case par case jusqu'au Seuil, et l'Intervention gagnée tombe en tampon « VU ».

FIRST VIEWPORT: Combat à 420 × 900 : en-tête bleu plein (numéro de formulaire et titre du tour), cadre 1 le Poste adverse, cadre 2 ton Poste et ton Banc, mentions en cases à cocher, deux boutons pleins d'au moins 64 px en bas (Intervenir, Fin du tour).

FORM: Imprimé administratif (Cerfa, liasse carbonée, tampons « Vu »), n° 1 de la liste classée ; seed:b0600dba36c0b9af.

Signature : le tampon qui tombe (Intervention gagnée, fin de partie), une seule fois par événement, sans rebond.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Non résolu

- Pictogrammes : les glyphes Unicode de `FACTION_META` (✚, ☺, ◉, ⚒…) restent tant qu'aucun jeu d'icônes dessiné n'est décidé.
- Ordre des écrans en mode live après les jetons : combat, Arrivage, Collection, Deck, Réglages.
