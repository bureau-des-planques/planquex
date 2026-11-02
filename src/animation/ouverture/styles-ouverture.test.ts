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
