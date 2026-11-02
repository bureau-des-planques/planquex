# L'état vide de la Collection dit « Tout effacer », et son bouton dit vrai

Written against: `ddcf35b`

## Evidence chain

- **Surface** : `/collection` en portrait (420 × 900 et 390 × 664), **état vide** — « recherche + filtre » et « filtre seul ».
- **Problème** : le bouton de l'état vide s'appelle « Effacer les filtres » et exécute `toutEffacer`, qui remet **aussi** `texte` à vide. Un testeur qui voulait garder sa recherche la perd sans que le libellé l'ait annoncé. La phrase juste au-dessus promet « pour revoir les 308 cartes » — ce que le bouton fait, et que « Effacer les filtres » ne décrit pas.
- **Preuve de design** :
  - `src/pages/Collection.tsx:299` — libellé `'Effacer les filtres'`, et `:297` `onClick={videParRecherche ? … : toutEffacer}` ;
  - `src/pages/Collection.tsx:74` — `toutEffacer` écrit `FILTRES_DEFAUT` ;
  - `src/components/filtres-collection.ts:25-32` — `FILTRES_DEFAUT.texte = ''` : la recherche est effacée ;
  - `src/pages/Collection.tsx:272` — **le même handler**, appelé « Tout effacer », 100 px plus haut dans `.filtres-actifs` ;
  - `DESIGN.md:309` — le contrôle des jetons est nommé « Tout effacer » ;
  - `docs/preuves/finition-alpha-2026-10-23/README.md:26` — la preuve de finition documente déjà l'état vide comme offrant **« Tout effacer »** : le libellé actuel est une régression par rapport à la preuve ;
  - `DESIGN.md:421` (§2.5) — la ligne de la Collection écrit encore « Effacer les filtres » : **c'est le document à corriger**, pas la référence à suivre.
- **Owner** : `src/pages/Collection.tsx` (bloc de l'état vide, `:284-301`).
- **Portée et surfaces touchées** : l'état vide de `/collection` (les deux cas) ; `src/pages/Collection.finition.test.tsx` (une requête devient ambiguë) ; la ligne `DESIGN.md:421`.
- **Incertitude** : aucune sur le mot (deux sources le donnent). Une **redondance** subsiste : dans le cas « recherche + filtre », deux boutons nommés « Tout effacer » sont visibles, à 100 px l'un de l'autre. Ils font la même chose ; ce plan ne la supprime pas (voir Stop conditions).

## Design decision

Renommer le bouton de l'état vide en **« Tout effacer »**, sans toucher à ce qu'il fait. Le libellé cesse de mentir, il reprend le mot déjà employé par le contrôle voisin, par `DESIGN.md` §2.3 et par la preuve de finition — et l'état vide garde son geste, là où l'œil est déjà (D-060, critère 3). L'alternative — n'effacer que les filtres — est écartée : elle ne rendrait pas les 308 cartes que la phrase promet tant qu'une recherche est active.

## Reuse

- Le libellé existant `Tout effacer` : `src/pages/Collection.tsx:272`.
- Le handler existant `toutEffacer` : `src/pages/Collection.tsx:74`.
- `FILTRES_DEFAUT` : `src/components/filtres-collection.ts:25`.
- Exemplaire de la même situation sur un autre écran : `src/pages/Deck.tsx:618` (« Tout effacer » quand un filtre vide la liste).

Aucune primitive nouvelle : c'est une chaîne, pas un composant.

## Changes

1. `src/pages/Collection.tsx`
   - Change : dans l'état vide, `'Effacer les filtres'` devient `'Tout effacer'`. La branche `videParRecherche` (`'Effacer la recherche'`, `modifier({ texte: '' })`) **ne bouge pas**.
   - Preserve : le message de cause (`causeDuVide`, `:286-293`), le `role="status"`, les deux paragraphes, l'ordre message → geste.
   - Verify : recherche « zzzz-aucune » + faction « SSE » → l'état vide affiche « Tout effacer » ; un clic rend la grille, vide le champ de recherche et remet la faction à « ALL ».

2. `src/pages/Collection.finition.test.tsx`
   - Change : le test `recherche et filtre ensemble…` (`:34-44`) fait `screen.getByRole('button', { name: 'Tout effacer' })` et va trouver **deux** boutons. Scoper la requête à la rangée des jetons — `within(document.querySelector('.filtres-actifs') as HTMLElement)` — et **ajouter** deux assertions : le bouton de l'état vide porte le nom « Tout effacer », et il vide la recherche (le comportement que le libellé annonce désormais).
   - Preserve : les assertions existantes (grille rendue, champ vide, faction « ALL »).
   - Verify : le test échoue si le libellé revient à « Effacer les filtres », et si le bouton cesse d'effacer la recherche.

3. `DESIGN.md:421`
   - Change : dans la ligne « Collection » du tableau §2.5, remplacer « (« Effacer la recherche » ou « Effacer les filtres ») » par « (« Effacer la recherche » quand seule la recherche agit, sinon « Tout effacer ») ».
   - Preserve : le reste de la ligne et le tableau.
   - Verify : la ligne ne nomme plus un libellé qui n'existe pas.

## Scope

- **Inherit** : rien d'autre ne rend cet état vide ; `causeDuVide` et `filtresActifs` ne changent pas.
- **Verify** : `Collection.filtres.test.tsx:83-102` (bouton des jetons, grille non vide) — `getByRole` n'y trouve qu'un bouton, le renommage ne doit pas le toucher ; `Collection.distinction.test.tsx` (aucun état vide) ; la preuve `docs/preuves/finition-alpha-2026-10-23/README.md:26` reste vraie et n'est **pas** modifiée.
- **Exclude** : la redondance des deux boutons « Tout effacer » ; le bouton « Effacer la recherche » ; `FILTRES_DEFAUT` ; la disposition de l'état vide.

## Validation

- **Product** : sur `/collection`, taper « zzzz-aucune », choisir une faction, lire l'état vide, cliquer le bouton qu'il propose → les 308 cartes reviennent, la recherche et le filtre sont effacés.
- **Interface** : 420 × 900 et 390 × 664 ; cas « recherche seule » (le bouton reste « Effacer la recherche »), « filtre seul », « les deux » ; avec la Collection vide (`owned: {}`) l'état vide n'apparaît pas (la notice la remplace).
- **System** : un seul libellé pour ce geste dans l'état vide, celui des jetons et celui du Deck ; aucune primitive nouvelle.
- **Repository** :
  - `npx vitest run src/pages/Collection.finition.test.tsx src/pages/Collection.filtres.test.tsx src/pages/Collection.distinction.test.tsx` → 0 échec ;
  - `npm run check` → exit 0 ;
  - `npm run format:check` → exit 0 ;
  - `npm run capturer` → exit 0 (l'état vide n'est pas capturé, aucune régression de hauteur attendue).

## Stop conditions

- **Stop** si le mainteneur juge la redondance des deux « Tout effacer » inacceptable : la sortie serait alors de **retirer** le bouton de l'état vide (le geste restant dans `.filtres-actifs`, toujours rendu quand `filtresActifs(filtres) > 0`, recherche comprise — `filtres-collection.ts:53-62`). C'est un autre plan : ne pas le faire ici.
- **Stop** si `filtresActifs` cesse de compter la recherche : la sortie « retirer le bouton » ne serait plus sûre.

## Design documentation

- Après acceptation et validation : la correction de `DESIGN.md:421` (étape 3) **est** le document à mettre à jour ; rien d'autre. Aucune décision datée n'est requise : le comportement ne change pas, seul un libellé.
