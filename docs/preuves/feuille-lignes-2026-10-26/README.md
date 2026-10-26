# Preuves d'écran — 26/10/2026 — les lignes trop longues de `/feuille-de-route` (#236)

Lot **avant/après** de l'écran `/feuille-de-route`, mesuré par `npm run detect:ui:page`. Ce
ne sont **pas** des preuves de règle : ce sont les captures de **notre** application, à
comparer au compte du détecteur.

## Ce qui a été lancé

```bash
npm run build
node scripts/detect-ui-pages.mjs   # sert dist/ sur 4179 et passe impeccable sur les douze écrans
```

Le détecteur compte des **anti-patterns**, pas des avis : les `straggler` de cet écran (six,
sur des `<li>`) ne comptent pas depuis #208.

## Ce qui a changé

Trois `line-length` sur `/feuille-de-route` — des points de note qui couraient sur ~170
caractères, deux fois la limite de 80 :

```json
{"antipattern":"line-length","selector":"section.section.panel:nth-of-type(2) > ul.liste-points > li:nth-of-type(2)"}
{"antipattern":"line-length","selector":"section.section:nth-of-type(7) > article.feuille-de-route__note:nth-of-type(2) > ul.liste-points > li:nth-of-type(1)"}
{"antipattern":"line-length","selector":"article.feuille-de-route__note:nth-of-type(8) > ul.liste-points > li:nth-of-type(12)"}
```

Les trois sont des `<li>` de `.liste-points` : la largeur de lecture se déclare **une fois**,
sur cette classe (`src/styles.css`), pas section par section. `58ch` et non `64ch` comme les
Réglages (#208) : ces listes sont en `text-[0.92rem]` et `ch` suit la taille de la police —
à 64ch la ligne mesurait encore 87 caractères, toujours refusée. 58ch ≈ 538 px, la largeur
des paragraphes voisins (`max-w-[62ch]` à 1rem, 551 px).

Compte : **3 → 0** (mesuré, `BASELINE['/feuille-de-route']` passe de `3` à `0` dans le même
commit).

## Ce que les images montrent

| Fichier | Ce que ça nous apprend |
|---|---|
| `avant-420.png` / `apres-420.png` | **420 × 900**, défilement sur « L'étape en cours ». **Aucun pixel ne change** : à cette largeur le panneau est déjà plus étroit que 58ch. La capture est là pour prouver que la correction ne casse **pas** le téléphone (retours à la ligne, puces, taille du texte). |
| `avant-large.png` / `apres-large.png` | **1280 × 900** (la taille où le détecteur mesure), même section. **Avant** : chaque point tient sur deux lignes de ~166 caractères, la liste déborde du texte des paragraphes. **Après** : trois lignes de ~75 caractères, alignées sur la colonne des paragraphes. |
| `avant-versions-large.png` / `apres-versions-large.png` | **1280 × 900**, défilement sur « Les versions précédentes », où deux des trois constats vivaient (`nth-of-type(2)` et `nth-of-type(8)`). Même effet : les notes de version se lisent à la largeur du texte, pas du panneau. |

## Limites, dites franchement

- Les captures sont prises **sur `dist/`**, donc après `npm run build`, avec Playwright
  (`playwright-core`, Chromium du cache `ms-playwright`) — même outil que
  `npm run capturer`, script de capture ad hoc (non commité), état amorcé `tutorielVu: true`.
- Le compte du détecteur est celui du **26/10/2026** ; un anti-pattern est un avis d'outil,
  pas une vérité : `BASELINE` à zéro veut dire « plus rien à signaler », pas « écran parfait ».
- `/feuille-de-route` reste **sous le plafond de zéro** : une régression future le rouvre,
  c'est le but du cliquet.
- Les six `straggler` (un mot seul sur la dernière ligne) ne sont **pas** traités ici : ce
  sont des **avis**, écartés par `verdict` depuis #208, et hors du périmètre de #236.
