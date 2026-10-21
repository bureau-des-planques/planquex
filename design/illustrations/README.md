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

## Cartes produites

| Carte (`id`) | Faction | Sujet | Graine | Fichier |
|---|---|---|---|---|
| `sse-medecin-travail` | SSE | médecin du travail, blouse, porte-bloc | `37109154` | `sse-medecin-travail.webp` |
| `management-responsable-unite` | Management | responsable d'unité, porte-bloc, sourire en coin | `1323131255` | `management-responsable-unite.webp` |
| `qvt-chief-happiness-officer` | QVT | chief happiness officer, ballons et autocollants | `1867736723` | `qvt-chief-happiness-officer.webp` |
| `amelioration-directeur-qualite` | Amélioration continue | directeur qualité, classeur de procédures | `1325355317` | `amelioration-directeur-qualite.webp` |
| `rh-drh` | RH | DRH devant un organigramme | `245800676` | `rh-drh.webp` |
| `atelier-chef-atelier` | Atelier | chef d'atelier, combinaison tachée, clé | `1491963894` | `atelier-chef-atelier.webp` |
| `syndicat-secretaire-general` | Syndicat | secrétaire général, fanion et insigne | `1286126774` | `syndicat-secretaire-general.webp` |
| `interim-interimaire-legendaire-ex` | Intérim | intérimaire légendaire, badges empilés, tasse | `64234642` | `interim-interimaire-legendaire-ex.webp` |

## Non produites — quota

Le **quota gratuit ZeroGPU** du compte Hugging Face a été épuisé en fin de série.

| Carte (`id`) | Faction | Sujet | Accent | État |
|---|---|---|---|---|

Pour la produire (et les 276 suivantes) :

```bash
bash scripts/illustration-vague.sh support-responsable-support
```

Le tuyau passe par **`gflow-cli`**, qui pilote Google Flow sur le compte de Bastien et rend la
**graine** dans son `--json` — c'est elle qui rend une image reproductible. Les modèles se
choisissent par **nom humain** (« Nano Banana 2.1 »), que le wizard traduit en alias gflow
(`nano2`). Les prompts restent ci-dessus et dans `DESIGN.md` §6.

## À curer (première passe assumée)

- Quelques rendus portent du **texte parasite** (« HAPPINESS », « HR », « PROCÉDURE ») alors
  que le socle l'interdit : à reprendre au moment de la curation (§8 de `DESIGN.md`).
- Style **illustré** plutôt que « semi-réaliste peint » : à resserrer avec des prompts plus
  contraints et un négatif commun.
- Les 8 images sont **branchées** : les cartes portent `art: '<id>.webp'`
  (`src/data/*.ts`) et `CardView` les sert depuis `public/design/illustrations/`.

## Registre et fichiers servis — deux copies à garder alignées (#120)

`CardView` construit une **chaîne d'URL** (`url('/design/illustrations/…')`), donc Vite ne sert
que `public/` : ce dossier-ci est le **registre**, l'application lit sa **copie** dans
`public/design/illustrations/`. Une regénération faite ici (c'est ici qu'elle doit se faire) ne
change rien à l'écran tant que le fichier n'est pas copié.

`scripts/illustrations-servies.test.ts` compare les deux copies : **même liste** de fichiers dans
les deux sens, et **même contenu** (SHA-256). Il nomme le fichier coupable.

**Alternative consignée, non implémentée — c'est une décision** : servir les images par
`import.meta.glob('../design/illustrations/*.webp', { eager: true, query: '?url' })`. Une seule
source, empreinte calculée par Vite, et **erreur au build** sur un `art` inconnu. Coût : le champ
`art` cesse d'être la chaîne nue `art: 'x.webp'` (il devient une URL de module, donc
`src/data/art.test.ts` et les conventions de #96 changent) ; le registre sort de `public/`.

## Journal des productions

> Tenu par `scripts/illustration-vague.sh` : une ligne par image produite ou
> regénérée, la plus récente en bas. Les deux tableaux ci-dessus sont
> l'instantané du 20/10/2026 ; **ce journal est le registre vivant**.

- 2026-10-21 · `direction-pdg` · modèle `NARWHAL` · graine `147016633` · `direction-pdg.webp`
- 2026-10-21 · `direction-pdg` · modèle `NARWHAL` · graine `1180968490` · `direction-pdg.webp`
- 2026-10-21 · `sse-medecin-travail` · modèle `NARWHAL` · graine `37109154` · `sse-medecin-travail.webp`
- 2026-10-21 · `management-responsable-unite` · modèle `NARWHAL` · graine `1323131255` · `management-responsable-unite.webp`
- 2026-10-21 · `qvt-chief-happiness-officer` · modèle `NARWHAL` · graine `1867736723` · `qvt-chief-happiness-officer.webp`
- 2026-10-21 · `amelioration-directeur-qualite` · modèle `NARWHAL` · graine `1325355317` · `amelioration-directeur-qualite.webp`
- 2026-10-21 · `rh-drh` · modèle `NARWHAL` · graine `245800676` · `rh-drh.webp`
- 2026-10-21 · `atelier-chef-atelier` · modèle `NARWHAL` · graine `1491963894` · `atelier-chef-atelier.webp`
- 2026-10-21 · `syndicat-secretaire-general` · modèle `NARWHAL` · graine `1286126774` · `syndicat-secretaire-general.webp`
- 2026-10-21 · `interim-interimaire-legendaire-ex` · modèle `NARWHAL` · graine `64234642` · `interim-interimaire-legendaire-ex.webp`
- 2026-10-21 · `support-responsable-support` · modèle `NARWHAL` · graine `1602293889` · `support-responsable-support.webp`
