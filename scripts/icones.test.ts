import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * L'icône de l'application installée (D-054).
 *
 * Le 21/10/2026, le manifeste ne déclarait que des SVG : Brave a installé un simple
 * raccourci, avec son propre badge, au lieu de l'icône du jeu. Ce test garde la règle
 * qui manquait — **au moins un PNG de 192 et un de 512, `purpose` « any »** — et vérifie
 * que les fichiers déclarés existent et ont vraiment la taille annoncée.
 */
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url));

type Icone = { src: string; sizes: string; type: string; purpose: string };

/** Les icônes du manifeste, lues comme du texte dans `vite.config.ts`. */
function iconesDuManifeste(config: string): Icone[] {
  return [...config.matchAll(/\{\s*src:\s*'([^']+)',\s*sizes:\s*'([^']+)',\s*type:\s*'([^']+)',\s*purpose:\s*'([^']+)'\s*\}/g)].map(
    ([, src, sizes, type, purpose]) => ({ src, sizes, type, purpose })
  );
}

/** Ce qui manque pour que Chromium installe une vraie application : vide = conforme. */
function manques(icones: Icone[]): string[] {
  const raster = (taille: string) =>
    icones.some((icone) => icone.type === 'image/png' && icone.sizes === taille && icone.purpose.split(' ').includes('any'));
  return ['192x192', '512x512'].filter((taille) => !raster(taille)).map((taille) => `PNG ${taille} « any »`);
}

/** Largeur et hauteur lues dans l'en-tête IHDR d'un PNG. */
function taillePng(octets: Buffer): string {
  expect(octets.subarray(1, 4).toString('latin1')).toBe('PNG');
  return `${octets.readUInt32BE(16)}x${octets.readUInt32BE(20)}`;
}

const config = read('vite.config.ts').toString('utf8');

describe('icône de l’application installée (D-054)', () => {
  it('le manifeste déclare un PNG 192 et un PNG 512 utilisables partout', () => {
    expect(manques(iconesDuManifeste(config))).toEqual([]);
  });

  it('chaque PNG déclaré existe dans public/ et a la taille qu’il annonce', () => {
    const pngs = iconesDuManifeste(config).filter((icone) => icone.type === 'image/png');
    expect(pngs.length).toBeGreaterThanOrEqual(2);
    for (const icone of pngs) {
      expect(taillePng(read(`public${icone.src}`)), icone.src).toBe(icone.sizes);
    }
  });

  it('se régénère par une commande déclarée', () => {
    const pkg = JSON.parse(read('package.json').toString('utf8'));
    expect(pkg.scripts.icones).toBe('node scripts/icones.mjs');
  });

  // Sans ce cas, la première garde ne garderait rien.
  it('le contrôle mord : un manifeste tout en SVG est refusé', () => {
    const fautif = "{ src: '/a.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' }, { src: '/b.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }";
    expect(manques(iconesDuManifeste(fautif))).toEqual(['PNG 192x192 « any »', 'PNG 512x512 « any »']);
  });
});
