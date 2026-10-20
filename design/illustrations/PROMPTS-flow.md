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

## Socle commun (à coller devant CHAQUE prompt)

```
Editorial trading-card illustration for a corporate-satire deck, semi-realistic painterly
rendering, end-of-day office mood, satirical but never mean. Deep midnight-blue palette
(#0b1220, #131c2e) with one muted saturated faction accent. A soft warm KEY light fully
illuminates the FACE — well-exposed skin, clearly visible features, no shadow over the eyes;
only a subtle gold (#e6b64c) rim light on the shoulders and hair. Matte surfaces, subtle
film grain, subject centered and isolated on a darker background, occupying ~70% of the
frame, waist-up, square 1:1. No text, no logo, no watermark, no brand, no real person.
```

---

## Planche 1 — Les 10 cartes signature (portraits)

Ajoute au socle le sujet, puis l'accent de faction.

| Carte (`id`) | Sujet à ajouter | Accent |
|---|---|---|
| `sse-medecin-travail` | a workplace doctor in a white coat holding a clipboard, calm and weary | emerald green |
| `management-responsable-unite` | a middle manager with a clipboard and a slightly smug smile | burnt orange |
| `qvt-chief-happiness-officer` | an over-enthusiastic happiness officer holding balloons (no text on them) | turquoise blue |
| `amelioration-directeur-qualite` | a quality director clutching a plain thick binder of procedures (blank cover) | electric yellow |
| `rh-drh` | an HR director standing in front of a plain blank org chart on the wall | violet purple |
| `atelier-chef-atelier` | a workshop foreman in an oil-stained jacket holding a wrench | rust bronze |
| `direction-pdg` | a CEO leaning back in a large executive chair, arms crossed, confident | deep indigo |
| `syndicat-secretaire-general` | a union general secretary with a small plain flag and a badge, determined | steel grey |
| `interim-interimaire-legendaire-ex` | a legendary temp worker wearing several stacked blank visitor badges, holding a mug | teal and gold |
| `support-responsable-support` | a support team lead wearing a headset, patient expression | silver white |

---

## Planche 2 — Les objets (Collègues et Objets), pour plus tard

```
Nature morte sur un plan de travail sombre, objet unique au tiers inférieur, macro douce.
```
Sujets : une **tasse de café** ébrichée, un **dossier à sangle** badgé, une **baie de test**,
un **paquet de gâteaux de réunion**. Un seul objet par image, **aucun texte imprimé lisible**.

## Planche 3 — Les trois viviers (illustrations de zone), pour plus tard

```
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
