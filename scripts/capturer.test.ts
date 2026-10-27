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
 * La refonte #191/#190 ajoute deux surfaces : la **barre d'action** (`.combat-barre`,
 * `docs/SPEC-COMBAT-UI.md` T9 — livrée par #191) et la **piste d'Interventions**
 * (`data-pas-a-pas="interventions"`, le contrat du pas-à-pas — attendue de #190). La garde
 * de #170 ne mesurait que la main : une barre d'action qui déborde passerait donc inaperçue.
 *
 * Un élément **absent** ne fait rien échouer — le test l'exige, sinon la garde casserait un
 * écran qui n'a pas encore la surface —, et le contrôle doit **mordre** dès qu'un élément
 * présent sort de la fenêtre, en **nommant l'élément fautif**. Depuis #191 il mord aussi quand
 * la barre **recouvre** la main sans sortir de la fenêtre. Le contrôle est joué par la
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
  function controle(mesures: Mesure[], limite = 830, pasAPasOuvert = false, etat = ''): string[] {
    const output = execFileSync(
      process.execPath,
      ['scripts/capturer.mjs', '--controle-hauteur', JSON.stringify({ limite, mesures, pasAPasOuvert, etat })],
      { cwd: root, encoding: 'utf8', env: sansEnvDeVitest() }
    );
    return JSON.parse(output) as string[];
  }

  /**
   * Une cible à sa place, sauf celles qu'on fait déborder. Depuis #237 « à sa place » veut
   * dire **avec la marge** de D-094 (3) : 800 laisse 30 px sous la barre de navigation à 830,
   * là où 820 n'en laissait que 10.
   */
  function geometrie({ mainBas = 760, barreActionHaut = 760, barreActionBas = 800, pisteBas = 400 } = {}): Mesure[] {
    return [
      { nom: 'la main', selecteur: '.hand', present: true, haut: 640, bas: mainBas },
      { nom: "la barre d'action du combat", selecteur: '.combat-barre', present: true, haut: barreActionHaut, bas: barreActionBas },
      { nom: "la piste d'Interventions", selecteur: '.piste', present: true, haut: 100, bas: pisteBas }
    ];
  }

  it('suit la main, la barre d’action et la piste d’Interventions', () => {
    // … et « Fin du tour » seul (#320) : l'action principale se mesure à part.
    expect(cibles().map((cible) => cible.selecteur)).toEqual([
      '.hand',
      '.combat-barre',
      '.piste',
      '.combat-barre__fin .button'
    ]);
  });

  it('ne dit rien tant qu’une surface est absente', () => {
    // La main existe, les deux autres non : la garde doit dormir, sans fausse alarme.
    const mesures = geometrie().map((mesure) => ({ ...mesure, present: mesure.selecteur === '.hand' }));
    expect(controle(mesures)).toEqual([]);
  });

  it('suit la piste par sa classe, jamais par l’attribut du pas-à-pas (#202)', () => {
    // `data-pas-a-pas="interventions"` n'existe **que** quand une étape désigne la piste : la
    // garde mesurait donc un élément absent dans l'état de référence, et ne pouvait pas échouer.
    const piste = cibles().find((cible) => cible.nom.includes('piste'));
    expect(piste?.selecteur).toBe('.piste');
    expect(piste?.selecteur).not.toContain('data-pas-a-pas');
  });

  it('nomme la piste quand c’est elle qui déborde', () => {
    const problemes = controle(geometrie({ pisteBas: 900 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la piste d'Interventions");
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

  it('nomme la barre d’action quand elle recouvre la main, alors que les deux sont dans la fenêtre (#191)', () => {
    // La barre collée tient à l'écran (haut 700, bas 820) et la main aussi (640 → 760) : le
    // contrôle de fenêtre seul les laisse passer, et la barre cache pourtant le bas des cartes.
    const problemes = controle(geometrie({ barreActionHaut: 700 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la barre d'action du combat recouvre la main");
    expect(problemes[0]).toContain('haut de la barre à 700 px');
    expect(problemes[0]).toContain('bas de la main à 760 px');
  });

  it('ne reproche pas le recouvrement pendant le pas-à-pas : la page y déborde par construction (#191)', () => {
    // Même géométrie fautive que ci-dessus : ouverte, le pas-à-pas rallonge la page, et la barre
    // collée recouvre la main jusqu'au défilement. Le passage « pas-à-pas terminé » est celui qui mord.
    expect(controle(geometrie({ barreActionHaut: 700 }), 830, true)).toEqual([]);
    expect(controle(geometrie({ barreActionHaut: 700 }), 830, false)).toHaveLength(1);
  });

  it('joue aussi le combat pas-à-pas terminé, là où le recouvrement est jugé (#191)', () => {
    const source = read('scripts/capturer.mjs');
    expect(source).toContain('amorcageStore(origine, { pasAPasCombatVu: true })');
    expect(source).toContain('(pas-à-pas terminé)');
  });

  /**
   * Ticket #320 — « Fin du tour » sous la barre de navigation. La géométrie est **celle qui a été
   * mesurée** le 27/10/2026 sur le code d'avant (tour 3, un café attaché, Pression jouable, pas-à-pas
   * ouvert, 420 × 900) : barre à 836 px, bouton à 834 px, navigation à 830 px, page qui défile de 24.
   * Le contrôle doit la refuser en nommant le bouton, et accepter la géométrie d'après.
   */
  describe('« Fin du tour » doit rester visible avec une Pression jouable (#320)', () => {
    const fin = (bas: number): Mesure => ({
      nom: '« Fin du tour »',
      selecteur: '.combat-barre__fin .button',
      present: true,
      haut: bas - 36,
      bas
    });

    function controleComplet(mesures: Mesure[], defilement: number): string[] {
      const output = execFileSync(
        process.execPath,
        [
          'scripts/capturer.mjs',
          '--controle-hauteur',
          JSON.stringify({ limite: 830, mesures, defilement, pasAPasOuvert: true, etat: 'Pression jouable, tour 3' })
        ],
        { cwd: root, encoding: 'utf8', env: sansEnvDeVitest() }
      );
      return JSON.parse(output) as string[];
    }

    it('le contrôle mord sur la mesure d’avant : bouton à 834 px sous une navigation à 830 px', () => {
      const avant = [
        ...geometrie({ mainBas: 728, barreActionHaut: 731, barreActionBas: 836 }),
        fin(834)
      ];
      const problemes = controleComplet(avant, 24);
      expect(problemes.some((p) => p.includes('« Fin du tour » n\'est pas visible sans défiler'))).toBe(true);
      expect(problemes.some((p) => p.includes('bas de « Fin du tour » à 834 px, barre de navigation à 830 px'))).toBe(
        true
      );
      expect(problemes.some((p) => p.includes('défile de 24 px'))).toBe(true);
      expect(problemes.some((p) => p.includes('Pression jouable, tour 3'))).toBe(true);
    });

    it('laisse passer la mesure d’après : bouton à 770 px, barre à 809 px, aucun défilement', () => {
      const apres = [...geometrie({ mainBas: 728, barreActionHaut: 731, barreActionBas: 809 }), fin(770)];
      expect(controleComplet(apres, 0)).toEqual([]);
    });

    it('mord sur le bouton seul, même quand la barre reste dans la fenêtre', () => {
      // La barre à 800 px tient ; un bouton à 835 px (hors barre, par construction) est nommé seul.
      const problemes = controleComplet([...geometrie({ barreActionBas: 800 }), fin(835)], 0);
      expect(problemes).toHaveLength(1);
      expect(problemes[0]).toContain('« Fin du tour »');
    });

    it('la cible de doigt de 44 px : le contrôle mord sur un bouton de 36 px, et nomme le bouton (#320)', () => {
      // Les hauteurs d'avant : la barre à 36 px (#203) et « Plus » du pas-à-pas à 36 px, « Suivant » à 33.
      const sortie = (boutonsPetits: { nom: string; hauteur: number }[]): string[] => {
        const output = execFileSync(
          process.execPath,
          [
            'scripts/capturer.mjs',
            '--controle-hauteur',
            JSON.stringify({ limite: 830, mesures: geometrie(), etat: 'Pression jouable', boutonsPetits })
          ],
          { cwd: root, encoding: 'utf8', env: sansEnvDeVitest() }
        );
        return JSON.parse(output) as string[];
      };
      expect(sortie([])).toEqual([]);
      const problemes = sortie([
        { nom: 'Fin du tour', hauteur: 36 },
        { nom: 'Plus', hauteur: 36 },
        { nom: 'Suivant', hauteur: 33 }
      ]);
      expect(problemes).toHaveLength(3);
      expect(problemes[0]).toContain('« Fin du tour » ne fait que 36 px de haut');
      expect(problemes[0]).toContain('44 px');
      expect(problemes[2]).toContain('« Suivant » ne fait que 33 px de haut');
    });

    it('mesure les boutons de la barre et du pas-à-pas tels que rendus', () => {
      const source = read('scripts/capturer.mjs');
      expect(source).toContain(".combat-barre .button, .pas-a-pas__ligne button");
      expect(source).toContain('boutonsPetits');
    });

    it('joue réellement un état « Pression jouable », et échoue s’il n’en atteint aucun', () => {
      const source = read('scripts/capturer.mjs');
      // Sans ces liens, la sonde pourrait mordre dans son test et la capture continuer à ne
      // mesurer que l'arrivée, où la barre n'a qu'une rangée.
      expect(source).toContain('await mesurerAvecUnePression(browser)');
      expect(source).toContain("barre.locator('.button--primary')");
      expect(source).toContain('Pression jouable${pasAPasVu');
      expect(source).toContain('aucun état « ${densite}Pression jouable » atteint');
    });
  });

  it('ne double pas le message quand la main sort déjà de la fenêtre (#191)', () => {
    // Main 640 → 906 : hors fenêtre, nommée une fois ; la barre qui la chevauche n'ajoute rien.
    const problemes = controle(geometrie({ mainBas: 906, barreActionHaut: 700 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('bas de la main à 906 px');
  });

  it('relie le contrôle au passage réel sur le combat', () => {
    const source = read('scripts/capturer.mjs');
    // Sans ces liens, la sonde pourrait mordre dans son test et la capture continuer
    // à ne mesurer que la main.
    expect(source).toContain('page.evaluate(mesureHauteur, CIBLES_HAUTEUR)');
    expect(source).toContain('controlesHauteur({ ...hauteur, viewport: VIEWPORT, etat: contexte })');
    expect(source).toContain("problems.push(`${route} · ${probleme}`)");
  });
});

/**
 * Ticket #237 — **la marge de 20 px de D-094 (3) est gardée**, pas recalculée à la main.
 *
 * La garde ne comparait la barre d'action qu'à la **limite** (830 px, D-094 (2)) : mesurée le
 * 26/10/2026, elle disait « exit 0 » sur un état « pas-à-pas ouvert » à **15–18 px** de marge,
 * alors que D-094 (3) en exige **20** à 420 × 900 — « pour qu'une ligne de plus ne rougisse pas
 * la capture ». La marge est donc une exigence **distincte**, et elle doit mordre comme le
 * seuil : ici, sur une géométrie fautive, sans navigateur.
 *
 * La valeur n'est pas recopiée : elle est relue dans la ligne D-094, pour que l'acte et le code
 * ne puissent pas diverger en silence (même patron que la taille de D-060, #153).
 */
describe('`npm run capturer` — la marge de hauteur de D-094 (3) (#237)', () => {
  interface Mesure {
    nom: string;
    selecteur: string;
    present: boolean;
    haut: number | null;
    bas: number | null;
  }

  /** La limite de D-094 (2) — le haut de la barre de navigation à 420 × 900. */
  const LIMITE = 830;

  function sansEnvDeVitest(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    delete env.BASE_URL;
    delete env.PORT;
    return env;
  }

  /**
   * Le contrôle réel du script, joué sur une géométrie construite à la main. `etat` est le
   * libellé du passage mesuré, comme `controlerHauteur` le passe à la capture.
   */
  function controle(mesures: Mesure[], etat = '', limite = LIMITE): string[] {
    const output = execFileSync(
      process.execPath,
      ['scripts/capturer.mjs', '--controle-hauteur', JSON.stringify({ limite, mesures, etat })],
      { cwd: root, encoding: 'utf8', env: sansEnvDeVitest() }
    );
    return JSON.parse(output) as string[];
  }

  /** La marge que D-094 (3) exige — « au moins 20 px » —, lue dans l'acte, pas recopiée. */
  function margeDeD094(): number {
    const lignes = read('docs/DECISIONS.md').split('\n').filter((ligne) => ligne.startsWith('| D-094 |'));
    expect(lignes, 'ligne D-094 introuvable dans docs/DECISIONS.md').toHaveLength(1);
    const marge = lignes[0].match(/au moins (\d+) px/);
    expect(marge, 'D-094 ne nomme plus de marge « au moins N px »').not.toBeNull();
    return Number(marge![1]);
  }

  /** La barre d'action à `bas`, la main et la piste bien au-dessus. */
  function barreA(bas: number): Mesure[] {
    return [
      { nom: 'la main', selecteur: '.hand', present: true, haut: 620, bas: 720 },
      { nom: "la barre d'action du combat", selecteur: '.combat-barre', present: true, haut: 730, bas },
      { nom: "la piste d'Interventions", selecteur: '.piste', present: true, haut: 380, bas: 400 }
    ];
  }

  it('lit la marge dans D-094 (3) : 20 px', () => {
    expect(margeDeD094()).toBe(20);
  });

  it('laisse passer une marge pile à l’exigence, et mord un pixel en dessous', () => {
    const marge = margeDeD094();
    expect(controle(barreA(LIMITE - marge))).toEqual([]);
    const problemes = controle(barreA(LIMITE - marge + 1));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la barre d'action du combat");
    expect(problemes[0]).toContain(`n'a que ${marge - 1} px de marge`);
  });

  it('mord sur la marge mesurée de 15 px, et nomme l’état fautif (#237)', () => {
    // Le chiffre du ticket, tel qu'il a été mesuré : barre à 815 px, limite à 830 → 15 px.
    const problemes = controle(barreA(815), 'pas-à-pas ouvert');
    expect(problemes).toHaveLength(1);
    // La surface, la marge réelle, la limite, l'exigence — et l'état mesuré.
    expect(problemes[0]).toContain("la barre d'action du combat n'a que 15 px de marge");
    expect(problemes[0]).toContain("bas de la barre d'action du combat à 815 px");
    expect(problemes[0]).toContain('barre de navigation à 830 px');
    expect(problemes[0]).toContain(`${margeDeD094()} px exigés (D-094 (3))`);
    expect(problemes[0]).toContain('pas-à-pas ouvert');
  });

  it('applique la marge au pas-à-pas ouvert, sans exception (D-094 (3))', () => {
    // D-094 (3) dit « à 420 × 900 », sans réserve pour le pas-à-pas : la même géométrie fautive
    // doit mordre dans les deux états. Une exception, si elle est voulue, se décide — elle ne se
    // glisse pas dans le code (#237).
    const courte = controle(barreA(815), 'pas-à-pas ouvert');
    const terminee = controle(barreA(815), 'pas-à-pas terminé');
    expect(courte).toHaveLength(1);
    expect(terminee).toHaveLength(1);
    expect(terminee[0]).toContain('pas-à-pas terminé');
  });

  it('ne double pas le message quand l’élément sort déjà de la fenêtre', () => {
    // À 840, la barre est hors fenêtre : nommée une fois pour le débordement, pas deux.
    const problemes = controle(barreA(840), 'pas-à-pas ouvert');
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("n'est pas visible sans défiler");
    expect(problemes[0]).not.toContain('de marge');
  });

  it('ne reproche pas la marge à un élément absent', () => {
    const mesures = barreA(815).map((mesure) => ({ ...mesure, present: false }));
    expect(controle(mesures)).toEqual([]);
  });

  it('garde aussi la marge de la main, pas seulement celle de la barre', () => {
    // La main sous la barre (800 → 820), donc sans recouvrement : seule sa marge est en cause.
    const mesures = barreA(800).map((mesure) => (mesure.selecteur === '.hand' ? { ...mesure, haut: 800, bas: 820 } : mesure));
    const problemes = controle(mesures, 'pas-à-pas terminé');
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la main n'a que 10 px de marge");
  });

  it('passe le libellé de l’état mesuré au contrôle, dans la capture réelle', () => {
    const source = read('scripts/capturer.mjs');
    expect(source).toContain('etat: contexte');
    expect(source).toContain('(pas-à-pas terminé)');
  });
});

/**
 * Ticket #243 — **l'écran de combat ne défile plus** (D-103). La marge de #237 se tenait par de
 * l'air réservé tant que le document dépassait la fenêtre ; la garde exige maintenant que la
 * page **tienne**, et elle le dit aussi pour l'état « pas-à-pas ouvert », celui qui défilait.
 */
describe('`npm run capturer` — l’écran de combat ne défile pas (D-103, #243)', () => {
  const mesures = [
    { nom: 'la main', selecteur: '.hand', present: true, haut: 620, bas: 720 },
    { nom: "la barre d'action du combat", selecteur: '.combat-barre', present: true, haut: 730, bas: 806 }
  ];

  function controle(defilement: number | undefined, etat: string, pasAPasOuvert = false): string[] {
    const env = { ...process.env };
    delete env.BASE_URL;
    delete env.PORT;
    const sortie = execFileSync(
      process.execPath,
      ['scripts/capturer.mjs', '--controle-hauteur', JSON.stringify({ limite: 830, mesures, defilement, etat, pasAPasOuvert })],
      { cwd: root, encoding: 'utf8', env }
    );
    return JSON.parse(sortie) as string[];
  }

  it('laisse passer un document qui tient dans la fenêtre, pas-à-pas ouvert compris', () => {
    expect(controle(0, 'pas-à-pas ouvert', true)).toEqual([]);
  });

  it('mord quand la page défile de 37 px — la mesure d’avant #243, pas-à-pas ouvert — et nomme l’état', () => {
    const problemes = controle(37, 'pas-à-pas ouvert', true);
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("l'écran de combat défile de 37 px");
    expect(problemes[0]).toContain('pas-à-pas ouvert');
    expect(problemes[0]).toContain('D-103');
  });

  it('mord aussi d’un seul pixel', () => {
    expect(controle(1, 'pas-à-pas terminé')).toHaveLength(1);
  });

  it('mesure le défilement dans la capture réelle, sur les huit états', () => {
    const source = read('scripts/capturer.mjs');
    expect(source).toContain('document.documentElement.scrollHeight - window.innerHeight');
    // Les huit passages passent tous par `controlerHauteur`, qui transmet la mesure entière.
    expect(source.match(/await controlerHauteur\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('controlesHauteur({ ...hauteur, viewport: VIEWPORT, etat: contexte })');
  });
});

/**
 * Ticket #292 — **le mode `détaillé` ne casse pas la lecture à 420 px** (SPEC-COMBAT-UI T9).
 *
 * `détaillé` remet des annotations sur le plateau (le nom des Conditions, les types du Deck) :
 * c'est la seule tâche de la refonte qui peut le faire **grossir**. Mesuré le 27/10/2026 à
 * 420 × 900, avec trois Conditions et trois types par camp, les fiches passaient de 138 à
 * 188 px : l'écran défilait de 34 px et la barre d'action finissait à 846 px, sous la navigation
 * (830 px). La capture d'arrivée ne le voyait pas — il n'y a pas de Condition à l'arrivée —, d'où
 * le **pire cas** posé dans le DOM par `poserLePireCas`.
 */
describe('`npm run capturer` — le mode détaillé tient dans la fenêtre (#292)', () => {
  const mesures = (barreBas: number, finBas: number) => [
    { nom: 'la main', selecteur: '.hand', present: true, haut: 612, bas: 714 },
    { nom: "la barre d'action du combat", selecteur: '.combat-barre', present: true, haut: 716, bas: barreBas },
    { nom: '« Fin du tour »', selecteur: '.combat-barre__fin .button', present: true, haut: finBas - 44, bas: finBas }
  ];

  function controle(geometrie: { mesures: unknown[]; defilement: number }): string[] {
    const env = { ...process.env };
    delete env.BASE_URL;
    delete env.PORT;
    const sortie = execFileSync(
      process.execPath,
      [
        'scripts/capturer.mjs',
        '--controle-hauteur',
        JSON.stringify({ limite: 830, pasAPasOuvert: false, etat: '(détaillé, pire cas)', ...geometrie })
      ],
      { cwd: root, encoding: 'utf8', env }
    );
    return JSON.parse(sortie) as string[];
  }

  it('le contrôle mord sur la mesure d’avant : barre à 846 px, bouton à 843 px, écran qui défile de 34 px', () => {
    const problemes = controle({ mesures: mesures(846, 843), defilement: 34 });
    expect(problemes.some((p) => p.includes('défile de 34 px') && p.includes('détaillé, pire cas'))).toBe(true);
    expect(problemes.some((p) => p.includes("bas de la barre d'action du combat à 846 px"))).toBe(true);
    expect(problemes.some((p) => p.includes('bas de « Fin du tour » à 843 px'))).toBe(true);
  });

  it('laisse passer la mesure d’après : barre à 742 px, bouton à 738 px, aucun défilement', () => {
    expect(controle({ mesures: mesures(742, 738), defilement: 0 })).toEqual([]);
  });

  it('joue réellement `détaillé` à chaque graine, pas-à-pas ouvert et terminé, et pose le pire cas', () => {
    const source = readFileSync(new URL('../scripts/capturer.mjs', import.meta.url), 'utf8');
    // Sans ces liens, le contrôle pourrait mordre dans son test et la capture ne mesurer que `sobre`.
    expect(source).toContain('await mesurerDensite(browser, true)');
    expect(source).toContain('await mesurerAvecUnePression(browser, true)');
    expect(source).toContain('combatDetaille: true');
    expect(source).toContain("`.battle--${detaille ? 'detaille' : 'sobre'}`");
    expect(source).toContain('page.evaluate(poserLePireCas, detaille)');
    expect(source).toContain('${etat}, pire cas');
  });

  it('range les Conditions en ligne dans les deux densités, et ne garde à `détaillé` que la largeur (feuille de style)', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\n\.poste__info\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).not.toMatch(/\n\.poste__info\s*\{[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.battle--detaille \.board__fiche\s*\{[^}]*max-width:\s*15rem/);
  });
});

/**
 * Ticket #321 — **`sobre` aussi tient dans la fenêtre avec trois Conditions des deux côtés**.
 *
 * Trouvé par le harnais de #292 : en `sobre`, les Conditions (une icône chacune) étaient empilées
 * en colonne, comme en `détaillé`. Mesuré le 27/10/2026 à 420 × 900 sur la feuille d'avant, trois
 * Conditions par camp : l'arrivée défilait de 56 px (barre d'action à 868 px, « Fin du tour » à
 * 865 px, navigation à 830 px) et le tour d'une Pression jouable, pas-à-pas ouvert, de 95 px.
 * Le plan de `npm run capturer` ne **jouait** pas ce cas en `sobre`.
 */
describe('`npm run capturer` — `sobre` tient dans la fenêtre avec trois Conditions (#321)', () => {
  const mesures = (mainBas: number, barreBas: number, finBas: number) => [
    { nom: 'la main', selecteur: '.hand', present: true, haut: 612, bas: mainBas },
    { nom: "la barre d'action du combat", selecteur: '.combat-barre', present: true, haut: 716, bas: barreBas },
    { nom: '« Fin du tour »', selecteur: '.combat-barre__fin .button', present: true, haut: finBas - 44, bas: finBas }
  ];

  function controle(m: unknown[], defilement: number): string[] {
    const env = { ...process.env };
    delete env.BASE_URL;
    delete env.PORT;
    const sortie = execFileSync(
      process.execPath,
      [
        'scripts/capturer.mjs',
        '--controle-hauteur',
        JSON.stringify({ limite: 830, pasAPasOuvert: true, etat: '(sobre), pire cas', mesures: m, defilement })
      ],
      { cwd: root, encoding: 'utf8', env }
    );
    return JSON.parse(sortie) as string[];
  }

  it('le contrôle mord sur la mesure d’avant : barre à 868 px, bouton à 865 px, défilement de 56 px', () => {
    const problemes = controle(mesures(816, 868, 865), 56);
    expect(problemes.some((p) => p.includes('défile de 56 px') && p.includes('sobre), pire cas'))).toBe(true);
    expect(problemes.some((p) => p.includes('bas de la barre d\'action du combat à 868 px'))).toBe(true);
    expect(problemes.some((p) => p.includes('bas de « Fin du tour » à 865 px'))).toBe(true);
    expect(problemes.some((p) => p.includes('la main n\'a que 14 px de marge'))).toBe(true);
  });

  it('laisse passer la mesure d’après : barre à 806 px (24 px de marge), aucun défilement', () => {
    expect(controle(mesures(714, 806, 761), 0)).toEqual([]);
  });

  it('joue `sobre` avec le pire cas, à l’arrivée et au tour d’une Pression jouable', () => {
    const source = readFileSync(new URL('../scripts/capturer.mjs', import.meta.url), 'utf8');
    expect(source).toContain('await mesurerDensite(browser, false)');
    expect(source).toContain("`.battle--${detaille ? 'detaille' : 'sobre'}`");
    // Le pire cas du tour d'une Pression jouable, dans les deux densités.
    expect(source).toContain('${etat}, tour ${tour}, pire cas');
  });
});
