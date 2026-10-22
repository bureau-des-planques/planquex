import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
const root = fileURLToPath(new URL('..', import.meta.url));
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

/**
 * Ticket #150 — **les captures ne doivent plus être recouvertes par la visite**.
 *
 * Un contexte de navigateur neuf est une première visite : la Journée d'intégration
 * s'y montrait, et recouvrait **cinq captures sur six** (constaté le 22/10/2026), ce
 * qui rendait le critère (4) de D-060 inapplicable. Le script amorce donc le store
 * (`tutorielVu: true`) **avant la navigation**, et garde **une** capture de la visite.
 *
 * La garde lit le **plan réel** (`node scripts/capturer.mjs --plan`), pas une chaîne
 * du source : retirer l'amorçage fait tomber les assertions au lieu de les laisser
 * passer. Le seul contrôle statique est celui qui relie le plan au contexte — sans
 * lui, on pourrait calculer un bel amorçage et ne jamais le donner à `newContext`.
 */
describe('`npm run capturer` — l’amorçage du store (#150)', () => {
  interface Plan {
    amorcage: {
      cookies: unknown[];
      origins: { origin: string; localStorage: { name: string; value: string }[] }[];
    };
    captures: { slug: string; route: string; amorce: boolean }[];
  }

  /** Le plan que le script exécute vraiment, sans navigateur ni serveur. */
  function plan(): Plan {
    // `vitest` exporte `BASE_URL=/` pour son propre usage : on le retire, sinon le
    // script reçoit une base qui n'est pas une URL et refuse de démarrer.
    const env = { ...process.env };
    delete env.BASE_URL;
    delete env.PORT;
    const output = execFileSync(process.execPath, ['scripts/capturer.mjs', '--plan'], {
      cwd: root,
      encoding: 'utf8',
      env
    });
    return JSON.parse(output) as Plan;
  }

  /** La clé du store, lue là où l'application la déclare. */
  function storageKey(): string {
    const key = read('src/store/useStore.ts').match(/STORAGE_KEY = '([^']+)'/)?.[1];
    expect(key, 'STORAGE_KEY introuvable dans src/store/useStore.ts').toBeDefined();
    return key!;
  }

  it('amorce le store avec `tutorielVu: true`, sous la clé de l’application', () => {
    const { amorcage } = plan();
    expect(amorcage.origins).toHaveLength(1);
    expect(amorcage.origins[0].localStorage).toHaveLength(1);

    const { name, value } = amorcage.origins[0].localStorage[0];
    expect(name).toBe(storageKey());
    // La forme que `persist` relit : `{ state, version? }`, ici le seul drapeau de la visite.
    expect(JSON.parse(value)).toEqual({ state: { tutorielVu: true } });
  });

  it('donne cet amorçage au contexte, donc avant `page.goto`', () => {
    const source = read('scripts/capturer.mjs');
    expect(source).toContain('storageState: amorce ? amorcageStore(origine) : undefined');
    const contexte = source.indexOf('browser.newContext({');
    const navigation = source.indexOf('page.goto(');
    expect(contexte, '`browser.newContext` introuvable').toBeGreaterThanOrEqual(0);
    expect(navigation, '`page.goto` introuvable').toBeGreaterThan(contexte);
  });

  it('amorce toutes les pages de l’application', () => {
    const amorcees = plan()
      .captures.filter((capture) => capture.amorce)
      .map((capture) => capture.route)
      .sort();
    expect(amorcees).toEqual(appRoutes());
  });

  it('garde une seule capture de la première visite, et c’est la seule nue', () => {
    const { captures } = plan();
    const nues = captures.filter((capture) => !capture.amorce);
    expect(nues).toHaveLength(1);
    expect(nues[0].slug).toMatch(/visite/);
    expect(nues[0].route).toBe('/');
    // À part : elle ne prend pas le slug d'une page, et son image porte son nom.
    expect(capturedRoutes().slugs).not.toContain(nues[0].slug);
  });
});
