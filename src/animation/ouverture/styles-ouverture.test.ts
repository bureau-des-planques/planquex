import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **La feuille de l'ouverture d'un Arrivage** (D-169, critique du 01/11/2026).
 *
 * Trois règles se gardent ici, parce qu'aucune ne se voit dans un test de rendu — jsdom ne
 * calcule ni transformation 3D, ni mise en page, ni `@container` :
 *
 * 1. **le dos d'une carte part de face** (`rotateY(0deg)`) : à `180deg` il était miroir, et le
 *    monogramme « BP » se lisait « ꟼᗺ » sur les cinq cartes ;
 * 2. **« Nouvelle » se pose sur l'illustration**, ancrée à droite de la carte — centrée sur le
 *    bord haut, la pastille recouvrait 59 des 72 px du nom à 390 px ;
 * 3. **Vulnérabilité et Rotation s'empilent sous 240 px de carte** (le gabarit complet ne tenait
 *    pas la ligne : 32 à 54 px hors carte).
 *
 * Chaque assertion du fichier **peut échouer** : les valeurs fautives sont celles d'avant le
 * correctif, et c'est ce que le test refuse (AGENTS.md §6).
 */
const CSS = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
/** La feuille **sans ses commentaires** : une valeur d'avant le correctif a le droit d'être nommée dans la prose. */
const DECLARATIONS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Le corps d'un bloc `sélecteur { … }`, accolades comprises. */
function bloc(selecteur: string): string {
  const debut = CSS.indexOf(`${selecteur} {`);
  if (debut < 0) throw new Error(`règle introuvable : ${selecteur}`);
  const fin = CSS.indexOf('}', debut);
  return CSS.slice(debut, fin + 1);
}

describe('la feuille de l’ouverture d’un Arrivage (D-169)', () => {
  it('le dos d’une carte part de face : aucun `rotateY(180deg)` ne le met en miroir', () => {
    const dos = bloc('.ouverture__retourne > .ouverture__dos');
    expect(dos).toMatch(/rotateY\(0deg\)/);
    expect(dos).not.toMatch(/rotateY\(180deg\)/);
    // Le contrôle mord : la valeur d'avant le correctif est refusée partout dans la feuille —
    // un `rotateY(180deg)` sur un dos, où qu'il soit, rend le monogramme miroir.
    expect(DECLARATIONS).not.toMatch(/rotateY\(180deg\)/);
  });

  it('« Nouvelle » s’ancre à droite, sur l’illustration, jamais dans la zone du nom', () => {
    const badge = bloc('.ouverture__neuve');
    expect(badge).toMatch(/right:\s*3\.5%/);
    expect(badge).toMatch(/top:\s*13\.5%/);
    // La valeur d'avant : centrée sur le bord haut (`left: 50%` + `translate: -50% 0`).
    expect(badge).not.toMatch(/left:\s*50%/);
    expect(badge).not.toMatch(/translate:/);
  });

  it('Vulnérabilité et Rotation s’empilent sous 240 px de carte, sauf en vignette compacte', () => {
    expect(CSS).toMatch(/@container \(max-width: 240px\) \{\s*\.card:not\(\.card--compact\) \.card__bas \{/);
  });

  it('la croix du dialogue fait 44 × 44 px (D-116, #569)', () => {
    // La croix de l'Arrivage tombait à 26,9 × 26,9 px : `size="icon-sm"` fait 1,75 rem, la seule
    // cible fautive du projet. Le contrôle mord : sans les deux déclarations, le bloc n'a que
    // sa couleur et sa position, et la garde tombe.
    const croix = bloc(".pack-reveal [data-slot='dialog-close']");
    expect(croix).toMatch(/height:\s*44px;/);
    expect(croix).toMatch(/width:\s*44px;/);
  });

  it('le titre est centré sur la scène et passe au-dessus de la bande (#569)', () => {
    const titre = bloc('.ouverture__titre');
    // Le défaut mesuré : `padding-right: 2.5rem` seul décalait le texte de 20 px vers la gauche.
    expect(titre).not.toMatch(/padding-right:\s*2\.5rem/);
    expect(titre).toMatch(/padding-inline:\s*3\.5rem;/);
    // La bande arrachée traversait le titre : le titre est au-dessus de la scène.
    expect(titre).toMatch(/position:\s*relative;/);
    expect(titre).toMatch(/z-index:\s*8;/);
  });

  it('« Tout afficher » et le bilan ont leur règle (#569)', () => {
    const tout = bloc('.ouverture__tout-afficher');
    // Le contrôle mord : sans fond ni ombre retirés, il garde le poids de « Ouvrir ».
    expect(tout).toMatch(/background:\s*transparent;/);
    expect(tout).toMatch(/box-shadow:\s*none;/);
    expect(bloc('.ouverture__bilan')).toMatch(/text-align:\s*center;/);
  });

  it('la couche des rayons ne transitionne pas son filtre (#605)', () => {
    // Le défaut mesuré : `data-eclat` pose un `brightness/saturate` sur une couche de 220vmax
    // masquée, et la transition de 600 ms la re-rastérisait à chaque image. Une célébration de
    // carte secrète passait de 33 ms à 50–100 ms par image (390 × 664, CPU ×6).
    const debut = DECLARATIONS.indexOf('.ouverture__rayons {');
    expect(debut).toBeGreaterThanOrEqual(0);
    const rayons = DECLARATIONS.slice(debut, DECLARATIONS.indexOf('}', debut) + 1);
    expect(rayons).toMatch(/transition:\s*opacity 600ms ease;/);
    expect(rayons).not.toMatch(/transition:[^;]*filter/);
    // Le contrôle mord : le filtre lui-même reste — c'est sa transition qui coûtait, pas lui.
    expect(DECLARATIONS).toMatch(
      /\.ouverture\[data-eclat='secrete'\] \.ouverture__rayons \{\s*filter: brightness\(1\.6\) saturate\(1\.3\);/
    );
  });

  it('`--p`/`--sens` se posent sur leurs trois consommateurs, pas sur le sachet (#566)', () => {
    // Le défaut mesuré : les deux variables vivaient sur `.ouverture__sachet`, donc s'héritaient
    // dans tout son sous-arbre (les deux SVG de la Pochette) à chaque `pointermove`.
    const sachet = bloc('.ouverture__sachet');
    expect(sachet).not.toMatch(/--p:/);
    expect(sachet).not.toMatch(/--sens:/);
    for (const selecteur of ['.ouverture__interieur', '.ouverture__fente']) {
      expect(bloc(selecteur)).toMatch(/--p:\s*0;/);
      expect(bloc(selecteur)).toMatch(/--sens:\s*1;/);
    }
    // `.ouverture__bande` a deux blocs (la géométrie, puis la transformation) : c'est celui qui
    // lit `var(--p)` qui porte les valeurs de repos.
    expect(CSS).toMatch(/\.ouverture__bande \{[^}]*--p: 0;[^}]*--sens: 1;[^}]*var\(--p\)/);
    // Et `inherits: false` coupe la descente dans la Pochette de la bande.
    expect(CSS).toMatch(/@property --p \{\s*syntax: '<number>';\s*inherits: false;/);
    expect(CSS).toMatch(/@property --sens \{\s*syntax: '<number>';\s*inherits: false;/);
  });
});
