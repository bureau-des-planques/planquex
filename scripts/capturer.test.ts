import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Ticket #53 — le **contrat** de `npm run capturer`, sans lancer de navigateur.
 *
 * L'exécution réelle (Chromium, `dist/`) se vérifie à la main : `npm run build &&
 * npm run capturer`, et la commande échoue si une page lève une erreur de console.
 * Ce test garde ce qui se casse silencieusement : une page de l'application ajoutée
 * sans capture, un dossier de sortie qui n'est plus ignoré par git, une commande
 * déclarée nulle part.
 */
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

/** Les routes de l'application, lues dans `src/App.tsx` (la joker `*` exclue). */
function appRoutes(): string[] {
  const source = read('src/App.tsx');
  const routes = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map(([, path]) => `/${path}`);
  if (/<Route\s+index\b/.test(source)) routes.push('/');
  return [...new Set(routes)].filter((route) => route !== '/*').sort();
}

/** Les captures du script : `PAGES = [['slug', '/route'], …]`. */
function capturedRoutes(): { slugs: string[]; routes: string[] } {
  const source = read('scripts/capturer.mjs');
  const block = source.match(/const PAGES = \[([\s\S]*?)\n\];/);
  expect(block, 'tableau PAGES introuvable dans scripts/capturer.mjs').not.toBeNull();
  const pages = [...block![1].matchAll(/\['([a-z-]+)',\s*'([^']*)'\]/g)].map(([, slug, route]) => ({ slug, route }));
  return { slugs: pages.map((page) => page.slug), routes: pages.map((page) => page.route).sort() };
}

describe('`npm run capturer` — ticket #53', () => {
  it('photographie une page par route de l’application', () => {
    expect(capturedRoutes().routes).toEqual(appRoutes());
  });

  it('donne un nom d’image distinct à chaque page', () => {
    const { slugs } = capturedRoutes();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('écrit dans un dossier ignoré par git', () => {
    const ignored = read('.gitignore').split('\n').map((line) => line.trim());
    expect(ignored).toContain('captures/');
    expect(read('scripts/capturer.mjs')).toContain("'captures'");
  });

  it('est déclarée dans package.json, avec playwright-core en devDependency', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts.capturer).toBe('node scripts/capturer.mjs');
    expect(pkg.devDependencies['playwright-core']).toBeDefined();
    expect(pkg.dependencies?.['playwright-core']).toBeUndefined();
  });

  it('laisse le binaire et le serveur surchargeables, et documente les deux', () => {
    const source = read('scripts/capturer.mjs');
    expect(source).toContain('process.env.CHROME_PATH');
    expect(source).toContain('process.env.BASE_URL');
    expect(read('README.md')).toContain('npm run capturer');
  });
});
