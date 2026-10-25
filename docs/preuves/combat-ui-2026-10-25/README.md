# L'écran de combat — le lot de preuve « avant » (#194, D-093)

Lot du **25/10/2026**, ouvert par le ticket **#194** (`docs/SPEC-COMBAT-UI.md` T1) **avant** la
refonte de l'écran de combat (D-093). Un lot **ne se remplace pas** : la refonte ouvrira un
`apres/` ici, ou un lot `combat-ui-<date>/` plus récent si l'écart entre les deux dates mérite
d'être nommé. La version de l'application n'est pas recopiée ici : elle se lit dans
`package.json` (`version`, `stage`) et s'affiche par `APP_LABEL` dans Réglages
(`docs/VERSIONS.md`).

**Ce ticket ne change aucun pixel.** Il fige l'état **avant** et étend la garde de hauteur de
`npm run capturer` pour qu'elle serve aussi à mesurer l'**après**.

## Comment elles ont été prises

| Fichier | Commande | Taille |
|---|---|---|
| `avant/420-combat.png` | `npm run build` puis `npm run capturer` (Chromium du cache `ms-playwright`, `vite preview` sur `:4180`) ; la copie vient de `captures/combat.png` | **420 × 900**, fenêtre seule |
| `avant/420-combat-sans-pas-a-pas.png` | même build, script ponctuel Playwright : même graine figée (`page.clock` → `2026-10-22T09:00Z`) et même amorçage du store (`tutorielVu: true`), puis un clic sur **« Passer le pas-à-pas »** avant la capture | 420 × 900, fenêtre seule |

L'écran de combat est capturé **à l'arrivée**, sans qu'on touche à rien, et à une graine
**figée** (`INSTANTS_COMBAT[0]` dans `scripts/capturer.mjs`) : la donner est donc reproductible.
La première image montre le **pas-à-pas** ouvert, l'état exact d'un invité qui arrive ; la
seconde le referme pour lire le plateau nu — c'est le même geste que « Passer le pas-à-pas ».

`captures/` n'est pas versionné : ces deux images sont la copie de la preuve, choisie ici.
Les autres pages du même passage n'ont pas été recopiées : le lot porte sur le **combat**.

## Ce que les captures montrent (lu à la main, à 420 × 900)

- Le plateau n'affiche **aucune carte** : deux Postes en texte (« Psychologue du travail »,
  « Secouriste ») et trois places de Banc tronquées (« Kiné du tra… », « Agent d'ent… »).
- Le Stress s'écrit quatre fois « 0/60 de Stress » / « 0/70 de Stress », en texte, sans barre
  lisible.
- Les Interventions sont trois étoiles (`★★☆`) dans l'en-tête de chaque camp — la même forme
  que la rareté des cartes.
- La main est une bande de boutons qui **tient** dans la fenêtre (bas à **666 px** pour une
  limite à **830 px**, mesuré ci-dessous) mais **défile** horizontalement : la quatrième carte
  est coupée.
- La « barre d'action » n'existe pas encore : « Fin du tour » est un bouton posé sous le
  plateau, et tout le secondaire (Conditions, Partie à deux, Journal) occupe trois blocs.

## La garde de hauteur, étendue (#194)

`scripts/capturer.mjs` mesurait déjà le bas de `.hand` contre le haut de `.bottom-nav`
(#170). Elle mesure désormais **trois** surfaces, à 420 × 900, à chaque graine de combat :

| Surface | Sélecteur | Pourquoi ce sélecteur |
|---|---|---|
| la main | `.hand` | classe déjà mesurée par #170 ; la refonte la conserve |
| la barre d'action du combat | `.combat-barre` | le nom que `docs/SPEC-COMBAT-UI.md` **T9** donne à la barre collante |
| la piste d'Interventions | `[data-pas-a-pas="interventions"]` | le contrat du pas-à-pas, que `SPEC-COMBAT-UI.md` §6.8.4 **conserve** (une classe aurait été inventée) |

**Les deux dernières n'existent pas encore** — la barre d'action arrive avec **#191**, la piste
avec **#190**. Le contrôle **ignore un élément absent** : il ne casse donc pas l'écran
d'aujourd'hui, et il **mord** dès que l'élément existe et sort de la fenêtre. Le message
d'échec **nomme l'élément fautif** (`… bas de la barre d'action du combat à 940 px, barre de
navigation à 830 px`), pas seulement « la main ».

Sortie du passage qui a produit ces images (extrait, `npm run capturer` → exit 0) :

```text
combat · combat · {"fenetre":900,"limite":830,"mesures":[{"nom":"la main",…,"haut":592,"bas":666},{"nom":"la barre d'action du combat",…,"present":false},{"nom":"la piste d'Interventions",…,"present":false}]}
```

Le contrôle se joue **sans navigateur** par la sonde `--controle-hauteur`, sur une géométrie
fournie en JSON ; `scripts/capturer.test.ts` s'en sert pour confronter le vrai code à une
géométrie **fautive** (le contrôle doit mordre, et nommer le bon élément) :

```bash
node scripts/capturer.mjs --controle-hauteur '{"limite":830,"mesures":[{"nom":"la main","selecteur":".hand","present":true,"haut":700,"bas":906}]}'
# ["la main n'est pas visible sans défiler (420 × 900) : bas de la main à 906 px, barre de navigation à 830 px"]
```

## Ce que les captures ne prouvent pas

- **Rien de l'après** : elles datent l'état d'avant la refonte, rien de plus. Une capture
  « après » ne se compare qu'à **ce lot-ci**, pas à celles du 23/10 (lot clos).
- Le **ressenti** : la fluidité, la lisibilité au pouce sur un vrai téléphone, le rendu d'un
  vrai clavier ou d'un lecteur d'écran. Une capture est un instant fixe.
- La **hauteur future** : la garde est prête, mais elle n'a encore mesuré ni la barre d'action
  ni la piste d'Interventions — aucune des deux n'est à l'écran. Sa première mesure réelle
  viendra avec #191 et #190.
- Le **débordement horizontal** de la main (la quatrième carte coupée) : la garde ne mesure que
  la hauteur.
