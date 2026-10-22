# Illustrations — la planche **Portrait** (les cartes de base)

> **Première passe, sans curation fine** (Q16, D-007 : IA + curation). Les dix images
> ci-dessous valident la chaîne à l'échelle avant le reste du set. Graine notée par carte
> pour être reproductible (`DESIGN.md` §6.5).
>
> Les trois planches s'appellent désormais **Portrait / Objet / Lieu** (#121) : ce dossier
> tient le **registre** des images produites, `SUJETS-flow.md` les **sujets** (une ligne par
> carte de base) et `ACCENTS-flow.md` l'**accent par faction** (D-046).

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

## Reste à produire — les cartes de base sans illustration

Les **dix cartes signature sont produites** (voir le journal, en bas). Les autres cartes de
base restent à faire : `npm run status` en donne le compte (`cards`), et la liste des lignes
de sujets est celle de **`SUJETS-flow.md`**. Les **variantes** n'en demandent **aucune** —
`secretVariant` recopie `art` de sa base, et `src/data/art.test.ts` l'impose.

Pour ces cartes, **le sujet et l'accent sont désormais écrits**, et l'obstacle ouvert de #97
est levé par #121 :

- **le sujet**, une ligne par carte de base, dans **`SUJETS-flow.md`** (Q10, planche
  Portrait ; les cartes Action en objet unique, planche Objet) ;
- **l'accent**, une ligne par faction, dans **`ACCENTS-flow.md`** : `FACTION_META.color`
  reste la seule source, l'accent en est **ré-dérivé** et la dérivation est **testée**, donc
  une couleur qui bouge sans son mot fait échouer la garde (D-046) ;
- **la garde** qui vérifie les deux tables, dans `scripts/illustration-vague.test.ts`. Elle
  remplace le second rôle de #120 (comparer deux copies) : la source unique a supprimé la
  seconde copie, il restait à vérifier que **chaque** carte de base a un sujet utilisable.

## À curer

Ce qui reste **assumé** après le passage du 21/10/2026, où le set des 10 signature a été refait
avec le socle corrigé (`DESIGN.md` §6.1) :

- **Texte parasite** : les 8 rendus du 20/10 en portaient du **lisible** (« HAPPINESS », « HR »,
  « PROCÉDURE »). Les 10 rendus du 21/10 n'en montrent **aucun lisible** — mais c'est un jugement
  **sur vignettes**, pas un audit au plein format : à revérifier à la taille réelle avant de le
  déclarer réglé.
- **Le négatif du socle n'est pas transmis** : `gflow image t2i` n'a **aucune** option de prompt
  négatif (vérifié, `--help` n'en liste pas). Le « no text, no logo » ne tient donc que par le
  socle **positif** — et il devra tenir sur **toutes** les cartes restantes.
- **Style** : le rendu reste **illustré-peint**, pas « semi-réaliste » au sens strict ; à
  resserrer avec des prompts plus contraints.
- Les **10** images sont **branchées** : les cartes portent `art: '<id>.webp'` (`src/data/*.ts`)
  et `CardView` les sert **depuis ce registre**, par `src/art.ts` (Vite, D-045).

## Une seule source — ce dossier, et Vite s'occupe du reste (D-045, exécutée le 21/10/2026)

**Ce dossier est la seule copie.** `src/art.ts` les embarque dans le graphe de modules
(`import.meta.glob('../design/illustrations/*.webp', { eager: true, query: '?url' })`) : Vite
calcule une empreinte, l'écrit dans `dist/assets/` et le service worker les **précache**
(`vite.config.ts`). Une regénération faite ici **change l'écran au build suivant**, sans étape
de copie.

Ce qui a disparu avec cette exécution : la copie `public/design/illustrations/`, et
`scripts/illustrations-servies.test.ts` (#120) qui comparait les deux. Son rôle est repris par
`src/data/art.test.ts` : fichier présent, nom = id de la carte de base, aucune orpheline, et
**résolution par le glob de `src/art.ts`** — une image que Vite ne voit pas fait échouer le test
au lieu d'afficher un aplat en silence. Le champ `art` reste le **nom de fichier**
(`art: 'x.webp'`) : c'est une donnée, la résolution en URL vit dans `src/art.ts`.

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
