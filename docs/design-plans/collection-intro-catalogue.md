# L'intro de la Collection nomme le catalogue, pas les possessions

Written against: `ddcf35b`

## Evidence chain

- **Surface** : `/collection` en portrait (420 × 900 et 390 × 664), en-tête de page — la phrase de rôle sous la jauge.
- **Problème** : la page annonce « Tout ce que tu possèdes » alors qu'elle affiche **le catalogue entier**. Trois textes se contredisent à 30 px d'intervalle : le titre `176/301 cartes tirables` (ce qu'on possède), `308 affichés` (ce que la grille rend), puis « Tout ce que tu possèdes ». La grille contient bien des cartes non possédées (`CardSlot` `is-missing`, « ×0 », « Non possédée »).
- **Preuve de design** :
  - `src/pages/Collection.tsx:153` — « Tout ce que tu possèdes : cherche, filtre, ouvre une fiche. » ;
  - `src/pages/Collection.tsx:132` — `{possedees}/{plafond} cartes tirables` (176/301 à la capture versionnée) ;
  - `src/pages/Collection.tsx:146` — `{visible.length} affichés` (308) ;
  - `src/pages/Collection.tsx:302` — la grille rend `visible`, dérivé de `ALL_CARDS`, pas de `owned` ;
  - `DESIGN.md:285` — le document nomme les deux nombres : « `PLAFOND_TIRABLE` (301) et non sur le **catalogue** (308) » ;
  - `DESIGN.md:287` — « la grille de la **Collection** est une **vitrine** » (30/10/2026) ;
  - `src/pages/Collection.tsx:149-151` — le commentaire de rôle dit encore « ici on regarde ce qu'on possède » : même idée périmée que la phrase, depuis la bascule en vitrine.
- **Owner** : `src/pages/Collection.tsx` (phrase de rôle, `:152-156`).
- **Portée et surfaces touchées** : l'en-tête de `/collection` ; `src/pages/Collection.distinction.test.tsx:38` qui affirme la phrase actuelle.
- **Incertitude** : **la formulation**. « Tout ce que tu possèdes » est faux ; le mot juste est **catalogue**, déjà employé par `DESIGN.md:285` et visible à l'écran dans « 308 affichés ». Le plan retient « Tout le catalogue » pour garder le rythme de la phrase ; une variante (« Le catalogue ») satisferait le même constat — à trancher par le mainteneur avant d'écrire, pas par l'exécutant.

## Design decision

La phrase de rôle décrit **le catalogue** — ce que la page montre réellement — au lieu des seules possessions. Avec ce mot, les trois textes de l'en-tête disent la même chose : la jauge mesure les possessions (301 tirables), la grille montre le catalogue (308), la phrase annonce le catalogue. Rien d'autre ne change : la phrase garde sa longueur, sa place et ses deux liens, et le Deck reste hors de la Collection (vitrine, `DESIGN.md:287`).

## Reuse

- Le vocabulaire du document : `DESIGN.md:285` (« le catalogue (308) »).
- Le compte déjà rendu à l'écran : `src/pages/Collection.tsx:146` (`308 affichés`).
- Aucun composant, aucun jeton : c'est une phrase.

## Changes

1. `src/pages/Collection.tsx`
   - Change : `Tout ce que tu possèdes : cherche, filtre, ouvre une fiche.` devient `Tout le catalogue : cherche, filtre, ouvre une fiche.` Le reste de la phrase (`Le Deck se compose sur la page Deck ; une fiche peut y ajouter sa carte.`) ne bouge pas.
   - Preserve : le lien vers `/deck` et son libellé, la classe `collection__role`, la position sous la jauge.
   - Verify : l'en-tête se lit « 176/301 cartes tirables » → « 308 affichés » → « Tout le catalogue : … ».

2. `src/pages/Collection.tsx` (commentaire, même geste)
   - Change : dans le commentaire `:149-151`, remplacer « ici on regarde ce qu'on possède » par « ici on parcourt le catalogue, possédé ou non ».
   - Preserve : la référence `#276` et le mot « vitrine ».
   - Verify : le commentaire ne décrit plus l'inverse du code qu'il coiffe.

3. `src/pages/Collection.distinction.test.tsx:38`
   - Change : l'assertion `/Tout ce que tu possèdes/` devient `/Tout le catalogue/`.
   - Preserve : le reste du cas (« déroule tout le catalogue possédé ou non, et dit son rôle »), y compris la longueur `ALL_CARDS.length` et le lien `/deck`.
   - Verify : le test échoue si la phrase revient aux possessions, et si la grille cesse de rendre tout le catalogue.

## Scope

- **Inherit** : aucun. La phrase n'est employée nulle part ailleurs (vérifié : `grep -rn "Tout ce que tu possèdes" src/ docs/ DESIGN.md` ne rend que `Collection.tsx` et son test).
- **Verify** : la notice « Ta Collection est vide : … Les cartes ci-dessous sont celles qu'il te reste à trouver. » (`Collection.tsx:277-282`) reste cohérente avec la nouvelle phrase ; `docs/preuves/finition-alpha-2026-10-23/` ne cite pas la phrase (vérifié).
- **Exclude** : le titre `X/301` et la jauge (D-166 / §2.2, corrects) ; le compte « 308 affichés » ; la ligne « 7 cartes ne sortent d'aucun Arrivage » ; toute modification de ce que la grille rend.

## Validation

- **Product** : ouvrir `/collection` avec quelques cartes possédées, lire l'en-tête, constater que la phrase décrit ce que la grille montre, y compris les cartes grisées « Non possédée ».
- **Interface** : 420 × 900 et 390 × 664 ; la phrase tient sur le même nombre de lignes (trois à 420, mesuré sur `captures/collection.png`) ; état « Collection vide » ; anglais/français : non concerné (UI en français).
- **System** : un seul mot pour la même chose à l'écran (« catalogue ») ; aucun composant nouveau.
- **Repository** :
  - `npx vitest run src/pages/Collection.distinction.test.tsx src/pages/Collection.finition.test.tsx` → 0 échec ;
  - `npm run check` → exit 0 ;
  - `npm run format:check` → exit 0.

## Stop conditions

- **Stop** si le mainteneur veut au contraire que la grille ne montre **que** le possédé : ce serait un changement de produit (la vitrine, `DESIGN.md:287`), pas une phrase — ouvrir un ticket, ne pas exécuter ce plan.
- **Stop** si la formulation retenue dépasse la largeur d'une ligne de plus que l'actuelle : la capture de référence perdrait de la hauteur au-dessus de la première carte.

## Design documentation

- Après acceptation et validation : aucune décision datée. La ligne `DESIGN.md:287` décrit déjà la grille comme une vitrine ; aucune phrase de rôle n'y est documentée. Si le mainteneur veut figer la formulation, l'ajouter à cette ligne en une proposition.
