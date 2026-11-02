# Prompts à coller — Google Flow (ou nano banana)

> Feuille prête à l'emploi pour générer les illustrations **hors** de l'agent (Google Flow,
> nano banana…). Les prompts sont en **anglais** (les modèles répondent mieux), avec la
> **correction des visages sombres** (`DESIGN.md` §6.1) : une **lumière principale éclaire le
> visage**, l'or n'est qu'un liseré.
>
> **Réglage** : carré **1:1**, 1024 ou 2048. **Négatif** (si le champ existe) :
> `text, letters, logo, watermark, signature, real person, brand, dark face, silhouette`.
>
> **Nommage des fichiers exportés** — un fichier par carte, l'`id` de la carte comme nom :
> `sse-medecin-travail.png`, `direction-pdg.png`, etc. Dépose-les dans `design/illustrations/`.
> Je m'occupe de les ranger, les nommer et les consigner (graine, modèle).

---

## Socle Portrait — à coller devant CHAQUE prompt d'un Planqué

```
Editorial trading-card illustration for a corporate-satire deck, semi-realistic painterly
rendering, end-of-day office mood, satirical but never mean. Deep midnight-blue palette
(#0b1220, #131c2e) with one muted saturated faction accent. A soft warm KEY light fully
illuminates the FACE — well-exposed skin, clearly visible features, no shadow over the eyes;
only a subtle gold (#e6b64c) rim light on the shoulders and hair. Matte surfaces, subtle
film grain, subject centered and isolated on a darker background, occupying ~70% of the
frame, waist-up, square 1:1. Sheets of paper blank or turned away, no legible writing, no
signage. No text, no logo, no watermark, no brand, no real person.
```

Le portrait se compose avec le **casting** de la carte (`CASTING-flow.md`, D-174) : le prompt
devient `<socle> <casting>, <sujet>, muted <accent> accent.` Un seul socle ne suffit plus —
voir le socle **Objet** ci-dessous (#583).

---

## Socle Objet — à coller devant CHAQUE prompt d'une carte Action

```
Still life editorial illustration for a corporate-satire deck, semi-realistic painterly
rendering, end-of-day office mood, satirical but never mean. Deep midnight-blue palette
(#0b1220, #131c2e) with one muted saturated faction accent. A soft warm KEY light clearly
models the object; only a subtle gold (#e6b64c) rim light on its edges. Matte surfaces,
subtle film grain, the object centered and isolated on a darker background, occupying ~70%
of the frame, still life, single object, no person, no hands, macro, square 1:1. Sheets of
paper blank or turned away, no legible writing, no signage. No text, no logo, no watermark,
no brand, no real person.
```

Les 11 cartes Action portaient le socle **portrait** (« waist-up, subject centered ») et
**8 sur 11** montraient un bonhomme : c'est le défaut que #583 corrige. `socle_de(id)`
(`scripts/ressources/illustration-vague.sh`) choisit d'après la planche : une carte qui a une
ligne de casting est un Planqué (socle Portrait), sinon c'est une Action (socle Objet).

---

## Planche Portrait — les cartes de base

Les sujets **ne vivent plus ici** : ils sont dans **`SUJETS-flow.md`**, une ligne par carte
de base — les Planqués en cinq créneaux (`<rôle>, <tenue>, holding <objet>, <geste>,
<expression>`), les cartes Action en objet unique. L'accent n'est pas sur la ligne : il est
**par faction**, dans **`ACCENTS-flow.md`** (D-046).

Le prompt se compose donc : `<socle Portrait aplati> <casting>, <sujet>, muted <accent>
accent.` — le **casting** vient de `CASTING-flow.md` (D-174), et c'est exactement ce que
`scripts/ressources/illustration-vague.sh` envoie.

**Une variante emprunte le sujet de sa base** (D-139) : elle rejoue la même scène, dans
un cadre de rareté haute (`3S`, `COU`), et le wizard résout l'id de base depuis le suffixe
(`sse-medecin-travail-star3` → `sse-medecin-travail`). Il n'y a donc **pas** de ligne de
sujet pour une variante : une seule scène par personnage, deux planches possibles.

> Ce fichier ne gardait qu'une table de dix signature ; elle est retirée (#121) parce que
> `SUJETS-flow.md` la couvre, et une seconde source de sujets dériverait.

---

## Planche Objet — les cartes Action (Collègues et Objets)

Le socle est celui de la **planche Objet** (ci-dessus, #583) : `still life, single object, no
person, no hands, macro`. Sujets : dans **`SUJETS-flow.md`** aussi, à la forme d'un objet
unique (une **tasse de café** ébrichée, un **dossier à sangle** badgé, une **baie de test**…).
Un seul objet par image, **aucun texte imprimé lisible**, aucune personne. Le prompt est
`<socle Objet aplati> <sujet>, muted <accent> accent.` — sans casting : un objet n'a ni
origine ni genre.

## Planche Lieu — les trois viviers (illustrations de zone), pour plus tard

```text
Wide shot of an empty workplace, strong one-point perspective, shoulder height, mixed
end-of-day lighting (cold neon + warm lamps), midnight-blue dominant, small gold accents,
no people, no faces, no readable signage. Square 1:1.
```
- **Atelier** : outils, établis, machines.
- **Étage** : couloir de bureaux, baies vitrées, plantes.
- **Bureaux** : plateau partagé, cloisons, imprimante.

---

## Le tuyau de l'agent (rappel)

Quand les crédits seront là, le même prompt part directement depuis l'agent :
`opencode run --agent image --model openrouter/google/gemini-3.1-flash-image "<socle + sujet>"`
(Hugging Face et OpenRouter exigent du quota ; Google Flow évite le problème.)
