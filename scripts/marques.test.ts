import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

/**
 * **Les SVG de la marque sont du XML bien formé** (#328).
 *
 * Un navigateur affiche un SVG **en ligne** même mal formé (le parseur HTML pardonne), mais
 * il **refuse** un SVG chargé comme image (`<img src="….svg">`) : il le lit en XML, et une
 * seule faute suffit à n'afficher que le texte alternatif. C'est arrivé le 27/10/2026 à la
 * tasse du README : un commentaire qui citait `--bg` — or `--` est interdit dans un
 * commentaire XML. Aucun test ne l'a vu ; seule la capture de la page GitHub l'a montré.
 *
 * Portée : la marque du README (`design/logo/`) et les icônes servies par l'application
 * (`public/`), chargées elles aussi comme images (favicon, manifeste).
 */
const RACINE = process.cwd();
const DOSSIERS = ['design/logo', 'public'] as const;

/** Les erreurs du parseur XML pour un texte SVG ; vide si le document est bien formé. */
export function erreursXml(texte: string): string[] {
  const { DOMParser } = new JSDOM('').window;
  const document = new DOMParser().parseFromString(texte, 'image/svg+xml');
  return [...document.getElementsByTagName('parsererror')].map((noeud) => noeud.textContent ?? 'parsererror');
}

function svgDu(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier))
    .filter((nom) => nom.endsWith('.svg'))
    .map((nom) => join(dossier, nom));
}

describe('Les SVG de la marque se chargent comme image (#328)', () => {
  const fichiers = DOSSIERS.flatMap(svgDu);

  it('trouve les SVG de la marque', () => {
    // Un dossier renommé laisserait la garde passer sur rien.
    expect(fichiers).toContain('design/logo/cafe-clair.svg');
    expect(fichiers).toContain('design/logo/cafe-sombre.svg');
    expect(fichiers).toContain('public/favicon.svg');
  });

  it.each(fichiers)('%s est du XML bien formé', (fichier) => {
    expect(erreursXml(readFileSync(join(RACINE, fichier), 'utf8'))).toEqual([]);
  });
});

describe('La garde des SVG mord (#328)', () => {
  it('refuse un commentaire qui contient « -- », le défaut du 27/10/2026', () => {
    const fautif = '<svg xmlns="http://www.w3.org/2000/svg"><!-- encre --bg --><path d="M0 0" /></svg>';
    expect(erreursXml(fautif)).not.toEqual([]);
  });

  it('refuse une balise non fermée', () => {
    expect(erreursXml('<svg xmlns="http://www.w3.org/2000/svg"><g></svg>')).not.toEqual([]);
  });

  it('accepte le même SVG, corrigé', () => {
    const sain = '<svg xmlns="http://www.w3.org/2000/svg"><!-- encre bg --><path d="M0 0" /></svg>';
    expect(erreursXml(sain)).toEqual([]);
  });
});
