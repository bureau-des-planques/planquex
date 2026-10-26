# La main du combat à 64 px — avant / après (#233)

Lot de captures de **notre** écran de combat, ouvert par le ticket **#233** (« la main à 64 px
replie des noms en plein mot »). Ce ne sont pas des preuves de règle : ce sont les images qui
montrent le défaut et sa correction, à la taille que **D-060** nomme (420 × 900) et à **360 px**
pour vérifier qu'une largeur plus étroite ne le rallume pas.

La version n'est pas recopiée ici : elle se lit dans `package.json` (`version`, `stage`) et
s'affiche dans Réglages (`docs/VERSIONS.md`).

## Le défaut, mesuré

À 4 rem (64 px) de large — le chiffre de **D-094 (1)**, qui n'a **pas** bougé — le nom d'une
carte de main disposait de **49 à 51 px** de colonne. À `0,7 rem` (11,2 px) en capitales,
`TROUSSE`, `MÉDICALE` et `PRÉVENTEUR` n'y tenaient pas, et la césure **manuelle** du plateau
(`hyphens: manual`) laissait faire une coupure d'urgence :

| Carte | Avant (`avant-420.png`) | Après (`apres-420.png`) |
|---|---|---|
| Visite médicale | `VISITE MÉDICA` / `LE` | `VISITE` / `MÉDI-` / `CALE` |
| Préventeur | `PRÉVEN` / `TEUR` | `PRÉVEN-` / `TEUR` |
| Trousse de secours | `TROUSS` / `E DE` / `SECOU…` | `TROUSSE` / `DE` / `SECOURS` |
| Baie de test | `BAIE DE` / `TEST` | inchangé |

La mesure de la colonne du nom (Chromium, `getBoundingClientRect`) : **50 px** avant,
**53 à 55 px** après — les marges latérales de la barre de nom du **plateau de la main**
passent de `0,22` à `0,1 rem`.

## Ce qui change

`src/styles.css` seul (aucune donnée de carte, `CardView` inchangé) :

- `.battle .hand .card--plateau .card__name { hyphens: auto; }` — la césure **de la langue**
  (`<html lang="fr">`), marquée d'un trait d'union ; `overflow-wrap: break-word` reste en
  dernier recours pour un mot sans point de césure ;
- `.battle .hand .card--plateau .card__top` — marges latérales `0,22` → `0,1 rem`, ce qui rend
  à `TROUSSE` (7 caractères) la place de tenir entier.

Ce sont des pixels **horizontaux** : la carte garde son ratio 63 × 88 et `.hand` sa hauteur
fixe, donc la garde de hauteur de D-094 (2) est **identique avant et après**.

## Les images

| Fichier | Commande | Taille |
|---|---|---|
| `avant-420.png` / `apres-420.png` | `npm run build`, puis un script Playwright ponctuel (même amorçage que `npm run capturer` : `tutorielVu`, graine figée `page.clock` → `2026-10-22T09:00Z`) ; la fenêtre seule | 420 × 900 |
| `avant-360.png` / `apres-360.png` | même script, fenêtre de 360 px | 360 × 900 |

L'« avant » est le même arbre avec `src/styles.css` remis à `HEAD` (`git checkout -- src/styles.css`),
puis `npm run build` ; l'« après » est le build de la correction.

## La garde de hauteur, avant et après

`npm run capturer` sort **exit 0** dans les deux états et rend les **mêmes** géométries, au
pixel près (`limite` = haut de la barre de navigation, 830 px) :

| État | bas de `.combat-barre` | marge |
|---|---|---|
| pas-à-pas terminé, 4 graines | 797 / 799 | **31 à 33 px** |
| pas-à-pas **ouvert**, 4 graines | 812 / 815 | 15 à 18 px |

La marge que D-094 (3) exige (≥ 20 px) se lit sur l'état **pas-à-pas terminé** — celui que
#218 a mesuré (33 px, `bas = 797`), et elle est **conservée**. L'état « pas-à-pas ouvert » est
plus court que 20 px **avant comme après** ce lot : la correction ne le touche pas, et le
défaut est signalé plutôt que masqué.

## Ce que ce lot ne prouve pas

- **Un test jsdom ne mesure pas la mise en page** : la règle est gardée par un test qui lit
  `src/styles.css` (`Battle.test.tsx`, « à 64 px, le nom de la main se coupe à la césure de la
  langue »), pas par une mesure de pixels. Le test **mord** : la règle retirée, il tombe.
- **`Psychologue du travail`** (une autre donne, `INSTANTS_COMBAT[1]`) reste **ellipsé** à la
  troisième ligne (`PSYCHO-` / `LOGUE` / `DU…`) : le nom ne se coupe plus au milieu d'un mot,
  mais il ne tient pas en trois lignes. Le nom complet reste dans le nom accessible et dans la
  fiche « Carte choisie » ; l'ouvrir demande une décision (quatrième ligne, ou nom court), pas
  un ajustement de passage.
- Les captures sont prises sur `dist/`, donc après `npm run build`. `captures/` reste ignoré par
  git : ces quatre images-ci sont la preuve datée.
