# Illustrations — première vague (10 cartes signature)

> **Première passe, sans curation fine** (Q16, D-007 : IA + curation). Ces dix images
> valident la chaîne à l'échelle avant les 286. Graine notée par carte pour être
> reproductible (`DESIGN.md` §6.5).

- **Modèle** : Space Hugging Face `mcp-tools/FLUX.1-Krea-dev`, 1024×1024,
  `num_inference_steps` 24, `guidance_scale` 4.5.
- **Socle commun** (collé avant chaque sujet) :
  > Editorial corporate dark-premium trading-card illustration, semi-realistic painterly
  > rendering, late-day office lighting, satirical but never mean mood. Subject waist-up,
  > centered, isolated on a darker background, deep midnight-blue palette, single warm gold
  > rim light, one muted saturated faction accent, subtle film grain, matte surfaces,
  > square 1:1. No text, no logo, no watermark, no real person.
  >
  > ⚠️ **Défaut constaté** : ce socle ne demande qu'un **contre-jour**, d'où des **visages trop
  > sombres**. La version corrigée (`DESIGN.md` §6.1) impose une **lumière principale sur le
  > visage**. Les 8 images ci-dessous sont donc à **regénérer** avec elle.

## Cartes produites (8 sur 10)

| Carte (`id`) | Faction | Sujet | Graine | Fichier |
|---|---|---|---|---|
| `sse-medecin-travail` | SSE | médecin du travail, blouse, porte-bloc | `1704499335` | `sse-medecin-travail.webp` |
| `management-responsable-unite` | Management | responsable d'unité, porte-bloc, sourire en coin | `716107998` | `management-responsable-unite.webp` |
| `qvt-chief-happiness-officer` | QVT | chief happiness officer, ballons et autocollants | `597664813` | `qvt-chief-happiness-officer.webp` |
| `amelioration-directeur-qualite` | Amélioration continue | directeur qualité, classeur de procédures | `484642457` | `amelioration-directeur-qualite.webp` |
| `rh-drh` | RH | DRH devant un organigramme | `600082756` | `rh-drh.webp` |
| `atelier-chef-atelier` | Atelier | chef d'atelier, combinaison tachée, clé | `1777646571` | `atelier-chef-atelier.webp` |
| `syndicat-secretaire-general` | Syndicat | secrétaire général, fanion et insigne | `434211236` | `syndicat-secretaire-general.webp` |
| `interim-interimaire-legendaire-ex` | Intérim | intérimaire légendaire, badges empilés, tasse | `632167755` | `interim-interimaire-legendaire-ex.webp` |

## Non produites (2) — quota

Le **quota gratuit ZeroGPU** du compte Hugging Face a été épuisé en fin de série.

| Carte (`id`) | Faction | Sujet | Accent | État |
|---|---|---|---|---|
| `direction-pdg` | Direction | PDG avachi dans un grand fauteuil, bras croisés | indigo profond | **à générer** |
| `support-responsable-support` | Support | responsable support, casque, patient | blanc argenté | **à générer** |

Pour les produire (et les 276 suivantes), trois voies : **HF PRO** (quota étendu), le modèle
**« nano banana »** de Gemini, ou un modèle d'image **OpenRouter**. Les prompts sont ci-dessus
et dans `DESIGN.md` §6.

## À curer (première passe assumée)

- Quelques rendus portent du **texte parasite** (« HAPPINESS », « HR », « PROCÉDURE ») alors
  que le socle l'interdit : à reprendre au moment de la curation (§8 de `DESIGN.md`).
- Style **illustré** plutôt que « semi-réaliste peint » : à resserrer avec des prompts plus
  contraints et un négatif commun.
- Aucune image n'est encore **branchée** dans l'application : les cartes affichent toujours
  l'aplat de palette et le glyphe.
