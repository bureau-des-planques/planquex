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

/**
 * Ticket #153 — **la taille suit D-060, et une capture se regarde**.
 *
 * Deux écarts préexistants, constatés le 22/10/2026 en fermant #150 : le script
 * capturait en `360 × 800` quand le critère (4) de D-060 dit `420 × 900`, et il
 * photographiait la page **entière** — la Collection sortait en `360 × 141 460`, le
 * Deck en `360 × 80 064`, ce qui ne se regarde pas.
 *
 * La garde lit le **plan réel** (`--plan`) : la taille et le cadrage y sont publiés,
 * donc les changer fait tomber les assertions. La taille attendue n'est **pas
 * recopiée** ici : elle est relue dans la ligne D-060 de `docs/DECISIONS.md`, pour que
 * l'acte et le code ne puissent pas diverger en silence.
 */
describe('`npm run capturer` — la taille et le cadrage (#153)', () => {
  interface Capture {
    viewport: { width: number; height: number };
    pleinePage: boolean;
  }

  /** La taille et le cadrage que le script exécute vraiment, sans navigateur. */
  function capture(): Capture {
    const env = { ...process.env };
    delete env.BASE_URL;
    delete env.PORT;
    const output = execFileSync(process.execPath, ['scripts/capturer.mjs', '--plan'], {
      cwd: root,
      encoding: 'utf8',
      env
    });
    return (JSON.parse(output) as { capture: Capture }).capture;
  }

  /** La taille que D-060 nomme — `(420×900)` —, lue dans l'acte, pas recopiée. */
  function tailleDeD060(): { width: number; height: number } {
    const lignes = read('docs/DECISIONS.md')
      .split('\n')
      .filter((ligne) => ligne.startsWith('| D-060 |'));
    expect(lignes, 'ligne D-060 introuvable dans docs/DECISIONS.md').toHaveLength(1);
    const taille = lignes[0].match(/\((\d+)×(\d+)\)/);
    expect(taille, 'D-060 ne nomme plus de taille de téléphone « (L×H) »').not.toBeNull();
    return { width: Number(taille![1]), height: Number(taille![2]) };
  }

  it('capture à la taille que D-060 nomme', () => {
    expect(capture().viewport).toEqual(tailleDeD060());
  });

  it('capture la fenêtre, pas la page entière', () => {
    expect(capture().pleinePage).toBe(false);
  });

  it('relie le plan au contexte et à la capture', () => {
    const source = read('scripts/capturer.mjs');
    // Sans ces liens, le plan pourrait annoncer une belle taille et un cadrage
    // fenêtré, et la capture réelle continuerait en `fullPage: true`.
    expect(source).toContain('viewport: VIEWPORT');
    expect(source).toContain('fullPage: PLEINE_PAGE');
  });
});

/**
 * Ticket #194 — **la garde de hauteur s'étend au combat qu'on refait** (D-093).
 *
 * La refonte #191/#190 ajoute deux surfaces qui n'existent pas encore : la **barre
 * d'action** (`.combat-barre`, `docs/SPEC-COMBAT-UI.md` T9) et la **piste d'Interventions**
 * (`data-pas-a-pas="interventions"`, le contrat du pas-à-pas). La garde de #170 ne
 * mesurait que la main : une barre d'action qui déborde passerait donc inaperçue.
 *
 * Les deux éléments sont **absents** aujourd'hui — le test l'exige, sinon la garde
 * casserait l'écran d'avant la refonte — et le contrôle doit **mordre** dès qu'un élément
 * présent sort de la fenêtre, en **nommant l'élément fautif**. Le contrôle est joué par la
 * sonde `--controle-hauteur`, sans navigateur : le test confronte le vrai code à une
 * géométrie fautive, il ne relit pas une chaîne du source.
 */
describe('`npm run capturer` — la garde de hauteur du combat (#194)', () => {
  interface HauteurCible {
    nom: string;
    selecteur: string;
  }

  interface Mesure {
    nom: string;
    selecteur: string;
    present: boolean;
    haut: number | null;
    bas: number | null;
  }

  /** L'environnement des sondes, sans les variables que `vitest` exporte pour lui. */
  function sansEnvDeVitest(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    delete env.BASE_URL;
    delete env.PORT;
    return env;
  }

  /** Les cibles que le script surveille vraiment (publiées dans `--plan`). */
  function cibles(): HauteurCible[] {
    const output = execFileSync(process.execPath, ['scripts/capturer.mjs', '--plan'], {
      cwd: root,
      encoding: 'utf8',
      env: sansEnvDeVitest()
    });
    return (JSON.parse(output) as { hauteur: HauteurCible[] }).hauteur;
  }

  /** Le contrôle de géométrie que le script applique, sur une géométrie construite à la main. */
  function controle(mesures: Mesure[], limite = 830): string[] {
    const output = execFileSync(
      process.execPath,
      ['scripts/capturer.mjs', '--controle-hauteur', JSON.stringify({ limite, mesures })],
      { cwd: root, encoding: 'utf8', env: sansEnvDeVitest() }
    );
    return JSON.parse(output) as string[];
  }

  /** Une cible à sa place, sauf celles qu'on fait déborder. */
  function geometrie({ mainBas = 760, barreActionBas = 820, pisteBas = 400 } = {}): Mesure[] {
    return [
      { nom: 'la main', selecteur: '.hand', present: true, haut: 640, bas: mainBas },
      { nom: "la barre d'action du combat", selecteur: '.combat-barre', present: true, haut: 760, bas: barreActionBas },
      { nom: "la piste d'Interventions", selecteur: '[data-pas-a-pas="interventions"]', present: true, haut: 100, bas: pisteBas }
    ];
  }

  it('suit la main, la barre d’action et la piste d’Interventions', () => {
    expect(cibles().map((cible) => cible.selecteur)).toEqual([
      '.hand',
      '.combat-barre',
      '[data-pas-a-pas="interventions"]'
    ]);
  });

  it('ne dit rien tant que #190 et #191 n’ont pas livré leurs surfaces', () => {
    // L'écran d'aujourd'hui : la main existe, les deux autres non. La garde doit dormir.
    const mesures = geometrie().map((mesure) => ({ ...mesure, present: mesure.selecteur === '.hand' }));
    expect(controle(mesures)).toEqual([]);
  });

  it('laisse passer une géométrie qui tient dans la fenêtre', () => {
    expect(controle(geometrie())).toEqual([]);
  });

  it('nomme la main quand elle sort de la fenêtre', () => {
    const problemes = controle(geometrie({ mainBas: 906 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('la main');
    expect(problemes[0]).toContain('bas de la main à 906 px');
  });

  it('nomme la barre d’action quand c’est elle qui déborde, pas « la main »', () => {
    const problemes = controle(geometrie({ barreActionBas: 940 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la barre d'action du combat");
    expect(problemes[0]).not.toContain('la main');
  });

  it('nomme la piste d’Interventions quand c’est elle qui déborde, pas « la main »', () => {
    const problemes = controle(geometrie({ pisteBas: 880 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la piste d'Interventions");
    expect(problemes[0]).not.toContain('la main');
  });

  it('relie le contrôle au passage réel sur le combat', () => {
    const source = read('scripts/capturer.mjs');
    // Sans ces liens, la sonde pourrait mordre dans son test et la capture continuer
    // à ne mesurer que la main.
    expect(source).toContain('page.evaluate(mesureHauteur, CIBLES_HAUTEUR)');
    expect(source).toContain('controlesHauteur({ ...hauteur, viewport: VIEWPORT })');
    expect(source).toContain("problems.push(`${route} · ${probleme}`)");
  });
});
