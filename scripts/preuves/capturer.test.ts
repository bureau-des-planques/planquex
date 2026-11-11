// Lent : chaque cas lance `scripts/preuves/capturer.mjs --plan` en sous-processus Node (environ 1 s chacun) ; c'est le contrat de la commande, vérifié en la lançant.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — le socle de capture est un module `.mjs` sans déclaration TypeScript.
import { contraste, erreurConsoleAttendue, problemesPochette, REFUS_ARRIVAGE } from './capturer-socle.mjs';

/**
 * Ticket #53 — le **contrat** de `npm run capturer`, sans lancer de navigateur.
 *
 * L'exécution réelle (Chromium, `dist/`) se vérifie à la main : `npm run build &&
 * npm run capturer`, et la commande échoue si une page lève une erreur de console.
 * Ce test garde ce qui se casse silencieusement : une page de l'application ajoutée
 * sans capture, un dossier de sortie qui n'est plus ignoré par git, une commande
 * déclarée nulle part.
 */
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

/** Les routes de l'application, lues dans `src/App.tsx` (la joker `*` exclue). */
function appRoutes(): string[] {
  const source = read('src/App.tsx');
  const routes = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map(([, path]) => `/${path}`);
  if (/<Route\s+index\b/.test(source)) routes.push('/');
  return [...new Set(routes)].filter((route) => route !== '/*').sort();
}

/** Les captures du script : `PAGES = [['slug', '/route'], …]`. */
function capturedRoutes(): { slugs: string[]; routes: string[] } {
  const source = read('scripts/preuves/capturer.mjs');
  const block = source.match(/const PAGES = \[([\s\S]*?)\n\];/);
  expect(block, 'tableau PAGES introuvable dans scripts/preuves/capturer.mjs').not.toBeNull();
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
    const ignored = read('.gitignore')
      .split('\n')
      .map((line) => line.trim());
    expect(ignored).toContain('captures/');
    expect(read('scripts/preuves/capturer.mjs')).toContain("'captures'");
  });

  it('est déclarée dans package.json, avec playwright-core en devDependency', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts.capturer).toBe('node scripts/preuves/capturer.mjs');
    expect(pkg.devDependencies['playwright-core']).toBeDefined();
    expect(pkg.dependencies?.['playwright-core']).toBeUndefined();
  });

  it('laisse le binaire et le serveur surchargeables, et documente les deux', () => {
    const source = read('scripts/preuves/capturer.mjs');
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
 * La garde lit le **plan réel** (`node scripts/preuves/capturer.mjs --plan`), pas une chaîne
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
    const output = execFileSync(process.execPath, ['scripts/preuves/capturer.mjs', '--plan'], {
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
    const source = read('scripts/preuves/capturer.mjs');
    // Les pages : l'amorçage est donné au contexte, la navigation vient après.
    expect(source).toContain('storageState: amorce ? amorcageStore(origine) : undefined');
    // Le combat : il n'y a plus qu'**un** endroit qui monte son contexte (`ouvrirCombat`, #324).
    // L'ordre se vérifie donc **dans ce corps-là** : contexte d'abord, navigation ensuite, et
    // c'est bien le contexte qui reçoit l'amorçage.
    const debut = source.indexOf('async function ouvrirCombat(');
    expect(debut, '`ouvrirCombat` introuvable').toBeGreaterThanOrEqual(0);
    const corps = source.slice(debut, source.indexOf('\n}\n', debut));
    expect(corps).toContain('storageState: amorcageStore(origine, supplement)');
    const contexte = corps.indexOf('browser.newContext({');
    const navigation = corps.indexOf('arriverAuCombat(page, instant)');
    expect(contexte, '`browser.newContext` introuvable dans `ouvrirCombat`').toBeGreaterThanOrEqual(0);
    expect(navigation, 'la navigation de `ouvrirCombat` est introuvable').toBeGreaterThan(contexte);
    // Et la navigation elle-même attend le tour du joueur, sinon la mesure tombe sur l'IA.
    const debutArrivee = source.indexOf('async function arriverAuCombat(');
    const corpsArrivee = source.slice(debutArrivee, source.indexOf('\n}\n', debutArrivee));
    expect(corpsArrivee.indexOf('page.goto(')).toBeGreaterThanOrEqual(0);
    expect(corpsArrivee.indexOf('arriveeAuTourDuJoueur(page)')).toBeGreaterThan(corpsArrivee.indexOf('page.goto('));
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

describe('`npm run capturer` — lisibilité de la pochette (#671)', () => {
  it('le texte rendu à 10 px déclenche un problème sous le plancher de 11,2 px', () => {
    const problemes = problemesPochette([{ texte: 'DESTINATAIRE', taille: 10, ratio: 7 }]);
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('10');
  });

  it('la paire documentée à 3,79:1 échoue au seuil AA de 4,5:1', () => {
    const ratio = contraste('#9aa9c2', '#214d69');
    expect(ratio).toBeCloseTo(3.79, 2);

    const problemes = problemesPochette([{ texte: 'LIBELLÉ', taille: 12, ratio }]);
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('3.79');
  });

  it('accepte une taille et un contraste au-dessus de leurs seuils', () => {
    expect(problemesPochette([{ texte: 'ARRIVAGE', taille: 11.2, ratio: 4.5 }])).toEqual([]);
  });
});

describe('`npm run capturer` — l’état hors ligne (#493)', () => {
  it('ne traite pas un refus réseau attendu comme une erreur de console de l’application', () => {
    expect(
      erreurConsoleAttendue('collection-hors-ligne', 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED')
    ).toBe(true);
    expect(erreurConsoleAttendue('collection-hors-ligne', 'TypeError: Cannot read properties of null')).toBe(false);
    expect(erreurConsoleAttendue('arrivage', 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED')).toBe(false);
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
    const output = execFileSync(process.execPath, ['scripts/preuves/capturer.mjs', '--plan'], {
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

  /**
   * **Les gabarits de D-171** : téléphones portrait seulement et PC. Les tailles ne sont pas
   * recopiées : elles sont relues dans la décision, comme D-060 plus haut.
   */
  function gabaritsDeD171(): { width: number; height: number }[] {
    // D-158 (#520) garde le grand écran ; 420 × 900 reste dans la capture principale (D-060).
    // D-171 (portrait) nomme les tailles de téléphone, D-173 (#580) ajoute le Pixel 7 en
    // navigation : on relit les trois lignes, dans l'ordre du journal (c'est l'ordre de GABARITS).
    const journal = read('docs/DECISIONS.md').split('\n');
    const tetes = ['| D-171 |', '| D-158 |', '| D-173 |'];
    const lignes = tetes.map((tete) => journal.filter((ligne) => ligne.startsWith(tete)));
    for (const [index, trouvees] of lignes.entries()) {
      expect(trouvees, `ligne ${tetes[index]} introuvable dans docs/DECISIONS.md`).toHaveLength(1);
    }
    const reference = tailleDeD060();
    const uniques = new Map<string, { width: number; height: number }>();
    for (const ligne of lignes.flat()) {
      for (const taille of ligne.matchAll(/(\d+)\s*×\s*(\d+)/g)) {
        const gabarit = { width: Number(taille[1]), height: Number(taille[2]) };
        if (gabarit.width === reference.width && gabarit.height === reference.height) continue;
        uniques.set(`${gabarit.width}×${gabarit.height}`, gabarit);
      }
    }
    return [...uniques.values()];
  }

  it('mesure les gabarits portrait et PC de D-171, et aucun paysage mobile', () => {
    const env = { ...process.env };
    delete env.BASE_URL;
    delete env.PORT;
    const plan = JSON.parse(
      execFileSync(process.execPath, ['scripts/preuves/capturer.mjs', '--plan'], { cwd: root, encoding: 'utf8', env })
    ) as { gabarits: { viewport: { width: number; height: number } }[] };
    const attendus = gabaritsDeD171();
    // La garde mord : une décision qui ne nommerait plus aucun gabarit ne passerait pas pour vide.
    expect(attendus.length).toBeGreaterThanOrEqual(4);
    expect(plan.gabarits.map(({ viewport }) => viewport)).toEqual(attendus);
  });

  it('le calcul de défilement de l’accueil ne masque pas un document trop haut', () => {
    const defilement = (documentHeight: number, viewportHeight: number) => {
      const env = { ...process.env };
      delete env.BASE_URL;
      delete env.PORT;
      const sortie = execFileSync(
        process.execPath,
        [
          'scripts/preuves/capturer.mjs',
          '--controle-defilement-vertical',
          JSON.stringify({ documentHeight, viewportHeight })
        ],
        { cwd: root, encoding: 'utf8', env }
      );
      return JSON.parse(sortie) as number;
    };
    expect(defilement(640, 640)).toBe(0);
    expect(defilement(639, 640)).toBe(0);
    // Le contrôle mord sur une page qui dépasse d’un pixel.
    expect(defilement(641, 640)).toBe(1);
  });

  it('refuse aussi une section de l’accueil cachée sous la barre, même sans défilement du document', () => {
    const controle = (sections: { nom: string; present: boolean; haut: number; bas: number }[]) => {
      const env = { ...process.env };
      delete env.BASE_URL;
      delete env.PORT;
      const sortie = execFileSync(
        process.execPath,
        [
          'scripts/preuves/capturer.mjs',
          '--controle-accueil',
          JSON.stringify({ documentHeight: 640, viewportHeight: 640, limite: 600, sections })
        ],
        { cwd: root, encoding: 'utf8', env }
      );
      return JSON.parse(sortie) as string[];
    };
    expect(controle([{ nom: '.hero', present: true, haut: 20, bas: 200 }])).toEqual([]);
    // Le contrôle mord si la dernière section est recouverte, même quand scrollHeight ne dépasse pas.
    expect(controle([{ nom: '.home__version', present: true, haut: 500, bas: 601 }])).toEqual([
      '.home__version sort de la fenêtre utilisable (500 → 601, limite 600)'
    ]);
  });

  it('le plan capture l’accueil avec une garde verticale dédiée', () => {
    const env = { ...process.env };
    delete env.BASE_URL;
    delete env.PORT;
    const plan = JSON.parse(
      execFileSync(process.execPath, ['scripts/preuves/capturer.mjs', '--plan'], { cwd: root, encoding: 'utf8', env })
    ) as { pagesSansDefilementVertical: string[] };
    expect(plan.pagesSansDefilementVertical).toEqual(['accueil']);
    // D-193 : il n'y a plus de barre d'action sous laquelle borner le vide (D-171 amendée). Le plan ne
    // publie donc plus de borne haute, et la garde ne la juge plus : ce retrait est voulu, il se lit ici.
    expect(plan).not.toHaveProperty('margeMaxCombatPortrait');
    const source = read('scripts/preuves/capturer.mjs');
    expect(source).toContain('controlerAccueilSansDefilement(page, slug, viewport)');
    expect(source).toContain('controlerAccueilSansDefilement(page, slug, VIEWPORT)');
  });

  it('l’accueil est mesuré avec la partie qui attend (#553), puis rendu à son état', () => {
    const source = read('scripts/preuves/capturer.mjs');
    // La ligne de #553 n'est pas dans l'amorçage : sans elle, la hauteur mesurée est celle d'un
    // accueil qui n'existe que la première fois. Le pire cas se pose donc avant la mesure…
    expect(source).toContain('await poserAttentePireCas(page);');
    expect(source).toContain("ligne.className = 'muted hero__attente pire-cas'");
    // …et se retire après, sinon la capture montrerait une partie qui n'attend pas.
    expect(source).toContain('await retirerAttentePireCas(page);');
    expect(source).toContain("document.querySelector('.hero__attente.pire-cas')?.remove()");
    const appel = source.indexOf('await poserAttentePireCas(page);');
    const mesure = source.indexOf('const hauteur = await page.evaluate', appel);
    const retrait = source.indexOf('await retirerAttentePireCas(page);', mesure);
    expect(appel).toBeGreaterThan(-1);
    expect(mesure).toBeGreaterThan(appel);
    expect(retrait).toBeGreaterThan(mesure);
  });

  it("capture l'ouverture d'un Arrivage, et refuse une scène qui ne se révèle pas", () => {
    const env = { ...process.env };
    delete env.BASE_URL;
    delete env.PORT;
    const plan = JSON.parse(
      execFileSync(process.execPath, ['scripts/preuves/capturer.mjs', '--plan'], { cwd: root, encoding: 'utf8', env })
    ) as { preparations: { slug: string; route: string }[] };
    // Une scène qu'aucune capture ne regarde est une scène que personne ne juge : c'est là que
    // trois défauts de rendu se sont succédé sans témoin (#283, rétro du 28/10/2026).
    expect(plan.preparations.map(({ slug }) => slug)).toContain('arrivage');
    const source = read('scripts/preuves/capturer.mjs');
    expect(source).toContain('.ouverture[data-etape="revelation"]');
    expect(source).toContain('[data-tout-afficher]');
  });

  it('attend la scène ou le refus explicite d’Arrivage, sans les 15 s du timeout (#707)', () => {
    const source = read('scripts/preuves/capturer.mjs');
    // La scène **ou** le refus : une attente qui ne regarderait que `.ouverture` rendrait les
    // 15 s de timeout au premier refus de configuration (D-179 (6)), à chaque passage.
    expect(source).toContain('await page.waitForFunction(');
    expect(source).toContain('REFUS_ARRIVAGE.source');
    expect(source).toContain("document.querySelector('.ouverture')");
    // Le contrôle mord : les deux refus connus sont reconnus, et un autre texte ne l'est pas —
    // sinon une absence de scène passerait pour un refus, ou l'inverse.
    expect(REFUS_ARRIVAGE.test('Le serveur du jeu n’est pas configuré : l’Arrivage ne peut pas s’ouvrir.')).toBe(true);
    expect(REFUS_ARRIVAGE.test('Connecte-toi pour ouvrir un Arrivage.')).toBe(true);
    expect(REFUS_ARRIVAGE.test('Une partie t’attend au tour 3.')).toBe(false);
  });

  it('joue les gardes de hauteur sur chaque gabarit, à sa taille', () => {
    const source = read('scripts/preuves/capturer.mjs');
    // Sans ce lien, un gabarit serait photographié mais jugé à 420 × 900 — ou pas jugé du tout.
    expect(source).toContain('for (const gabarit of GABARITS) {');
    expect(source).toContain('await mesurerGabarit(browser, gabarit);');
    expect(source).toContain('await controlerHauteur(page, etat, ROUTE_COMBAT, viewport);');
  });

  it('capture la fenêtre, pas la page entière', () => {
    expect(capture().pleinePage).toBe(false);
  });

  it('relie le plan au contexte et à la capture', () => {
    const source = read('scripts/preuves/capturer.mjs');
    // Sans ces liens, le plan pourrait annoncer une belle taille et un cadrage
    // fenêtré, et la capture réelle continuerait en `fullPage: true`.
    expect(source).toContain('viewport: VIEWPORT');
    expect(source).toContain('fullPage: PLEINE_PAGE');
  });
});

/** L'environnement des sondes, sans les variables que `vitest` exporte pour lui. */
function sansEnvDeVitest(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.BASE_URL;
  delete env.PORT;
  return env;
}

/** Une surface mesurée dans le navigateur, telle que `mesureHauteur` la rend (D-193 pour les champs larges). */
interface Mesure {
  nom: string;
  selecteur: string;
  present: boolean;
  haut: number | null;
  bas: number | null;
  gauche?: number | null;
  droite?: number | null;
  visible?: number | null;
  coupe?: boolean;
}

/** Joue le **contrôle de géométrie** du script sur une géométrie fournie, sans navigateur (#194). */
function sonde(geometrie: object): string[] {
  const sortie = execFileSync(
    process.execPath,
    ['scripts/preuves/capturer.mjs', '--controle-hauteur', JSON.stringify(geometrie)],
    { cwd: root, encoding: 'utf8', env: sansEnvDeVitest() }
  );
  return JSON.parse(sortie) as string[];
}

/**
 * Ticket #194 — **la garde de hauteur s'étend au combat qu'on refait** (D-093), mise à jour par **D-193**.
 *
 * D-193 supprime la barre d'action (`.combat-barre`, #191) : le bas de l'écran ne porte plus que la main,
 * « Fin du tour », les gestes et les Pressions sont la **pile d'actions du tour** (`.actions-flottantes`)
 * au milieu à droite de la table, et les textes du tour sont le **bandeau** (`.combat-toast`) en haut.
 * La piste d'Interventions (#190) reste suivie par sa **classe**, pas par `data-pas-a-pas`, qui n'est posé
 * que lorsque le pas-à-pas la désigne (#202).
 *
 * Un élément **absent** ne fait rien échouer ; un élément présent qui sort de la fenêtre, si : la garde
 * **mord**. Le contrôle est joué par la sonde `--controle-hauteur`, sans navigateur : le test confronte le
 * vrai code à une géométrie fautive, il ne relit pas une chaîne du source.
 */
describe('`npm run capturer` — la garde de hauteur du combat (#194, D-193)', () => {
  interface HauteurCible {
    nom: string;
    selecteur: string;
  }

  /** Les cibles que le script surveille vraiment (publiées dans `--plan`). */
  function cibles(): HauteurCible[] {
    const output = execFileSync(process.execPath, ['scripts/preuves/capturer.mjs', '--plan'], {
      cwd: root,
      encoding: 'utf8',
      env: sansEnvDeVitest()
    });
    return (JSON.parse(output) as { hauteur: HauteurCible[] }).hauteur;
  }

  /** Le contrôle à la limite de D-094 (2), 830 px, sur une géométrie construite à la main. */
  function controle(mesures: Mesure[], extra: object = {}): string[] {
    return sonde({ limite: 830, mesures, ...extra });
  }

  /**
   * Une géométrie **saine** : la main en bas (640 → `mainBas`), la pile d'actions au milieu à droite
   * (`actionsHaut` → `actionsBas`, 44 px par défaut), la piste au-dessus. La pile ne touche pas la main.
   */
  function geometrie({
    mainBas = 760,
    actionsHaut = 430,
    actionsBas = actionsHaut + 44,
    pisteBas = 400
  }: { mainBas?: number; actionsHaut?: number; actionsBas?: number; pisteBas?: number } = {}): Mesure[] {
    return [
      { nom: 'la main', selecteur: '.hand', present: true, haut: 640, bas: mainBas },
      {
        nom: "la pile d'actions du tour",
        selecteur: '.actions-flottantes',
        present: true,
        haut: actionsHaut,
        bas: actionsBas,
        gauche: 284,
        droite: 396
      },
      { nom: "la piste d'Interventions", selecteur: '.piste', present: true, haut: 100, bas: pisteBas }
    ];
  }

  it('suit la main, la pile d’actions, le bandeau, la piste, « Fin du tour » et le plateau', () => {
    expect(cibles().map((cible) => cible.selecteur)).toEqual([
      '.hand',
      '.actions-flottantes',
      '.combat-toast',
      '.piste',
      '.actions-flottantes .button--fin.is-a-toi',
      '.board'
    ]);
  });

  it('ne dit rien tant qu’une surface est absente', () => {
    // La main existe, les autres non : la garde doit dormir, sans fausse alarme.
    const mesures = geometrie().map((mesure) => ({ ...mesure, present: mesure.selecteur === '.hand' }));
    expect(controle(mesures)).toEqual([]);
  });

  it('suit la piste par sa classe, jamais par l’attribut du pas-à-pas (#202)', () => {
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

  it('nomme la pile d’actions quand c’est elle qui sort de la fenêtre, pas « la main »', () => {
    const problemes = controle(geometrie({ actionsHaut: 896, actionsBas: 940 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la pile d'actions du tour n'est pas visible sans défiler");
    expect(problemes[0]).not.toContain('la main');
  });

  it('nomme la piste d’Interventions quand c’est elle qui déborde, pas « la main »', () => {
    const problemes = controle(geometrie({ pisteBas: 880 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la piste d'Interventions");
    expect(problemes[0]).not.toContain('la main');
  });

  it('nomme la pile quand elle recouvre la main, alors que les deux sont dans la fenêtre (#191, D-193)', () => {
    // La pile tient à l'écran (700 → 744) et la main aussi (640 → 760) : le contrôle de fenêtre seul les
    // laisse passer, et la pile cache pourtant le haut des cartes.
    const problemes = controle(geometrie({ actionsHaut: 700 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la pile d'actions du tour recouvre la main");
    expect(problemes[0]).toContain('haut de la pile à 700 px');
    expect(problemes[0]).toContain('bas de la main à 760 px');
  });

  it('laisse une pile collée au-dessus de la main : aucune marge n’est exigée entre elles (D-193)', () => {
    // La pile finit à 640, là où la main commence : pas de recouvrement, pas de marge à tenir.
    expect(controle(geometrie({ actionsHaut: 596, actionsBas: 640 }))).toEqual([]);
  });

  it('joue aussi le combat pas-à-pas terminé, là où la pile est jugée contre la main (#191)', () => {
    const source = read('scripts/preuves/capturer.mjs');
    expect(source).toContain('ouvrirCombat(browser, instant, { pasAPasCombatVu: true })');
    expect(source).toContain('(pas-à-pas terminé)');
  });

  /**
   * Ticket #320 — « Fin du tour » sous la navigation. D-193 le déplace dans la pile flottante, mais la règle
   * ne change pas : l'action principale doit rester entière dans la fenêtre avec une Pression jouable.
   */
  describe('« Fin du tour » doit rester visible avec une Pression jouable (#320, D-193)', () => {
    const fin = (bas: number): Mesure => ({
      nom: '« Fin du tour »',
      selecteur: '.actions-flottantes .button--fin.is-a-toi',
      present: true,
      haut: bas - 44,
      bas
    });

    function controleComplet(mesures: Mesure[], defilement: number): string[] {
      return sonde({
        limite: 830,
        mesures,
        defilement,
        etat: 'Pression jouable, tour 3'
      });
    }

    it('mord quand « Fin du tour » sort de la fenêtre : bouton à 834 px sous une navigation à 830 px', () => {
      const problemes = controleComplet([...geometrie(), fin(834)], 24);
      expect(problemes.some((p) => p.includes("« Fin du tour » n'est pas visible sans défiler"))).toBe(true);
      expect(problemes.some((p) => p.includes('bas de « Fin du tour » à 834 px, barre de navigation à 830 px'))).toBe(
        true
      );
      expect(problemes.some((p) => p.includes('défile de 24 px'))).toBe(true);
      expect(problemes.some((p) => p.includes('Pression jouable, tour 3'))).toBe(true);
    });

    it('laisse passer la mesure d’après : bouton à 770 px, aucun défilement', () => {
      expect(controleComplet([...geometrie({ mainBas: 728 }), fin(770)], 0)).toEqual([]);
    });

    it('mord sur le bouton seul, même quand la pile reste dans la fenêtre', () => {
      const problemes = controleComplet([...geometrie(), fin(835)], 0);
      expect(problemes).toHaveLength(1);
      expect(problemes[0]).toContain('« Fin du tour »');
    });

    it('la cible de doigt de 44 px : le contrôle mord sur un bouton de 36 px, et nomme le bouton (#320)', () => {
      // Les hauteurs d'avant : « Fin du tour » et « Plus » à 36 px, « Suivant » à 33.
      const sortie = (boutonsPetits: { nom: string; hauteur: number }[]): string[] =>
        sonde({ limite: 830, mesures: geometrie(), etat: 'Pression jouable', boutonsPetits });
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

    it('mord sur un bouton de la pile rogné par son défilement interne, et le nomme (D-193)', () => {
      const problemes = sonde({ limite: 830, mesures: geometrie(), etat: 'Pression jouable', boutonsCaches: ['Plus'] });
      expect(problemes).toHaveLength(1);
      expect(problemes[0]).toContain("le bouton « Plus » est caché dans la pile d'actions du tour");
    });

    it('mesure les boutons de la pile et du pas-à-pas tels que rendus, et ceux que la pile rogne', () => {
      const source = read('scripts/preuves/capturer.mjs');
      expect(source).toContain('.actions-flottantes .button, .pas-a-pas__ligne button');
      expect(source).toContain('boutonsPetits');
      expect(source).toContain('boutonsCaches');
    });

    it('joue réellement un état « Pression jouable », et échoue s’il n’en atteint aucun', () => {
      const source = read('scripts/preuves/capturer.mjs');
      // Sans ces liens, la sonde pourrait mordre dans son test et la capture continuer à ne
      // mesurer que l'arrivée, où la pile n'a que « Fin du tour ».
      expect(source).toContain('await mesurerAvecUnePression(browser)');
      expect(source).toContain("actions.locator('.button--primary')");
      expect(source).toContain('Pression jouable${pasAPasVu');
      expect(source).toContain('aucun état « ${densite}Pression jouable » atteint');
    });
  });

  it('ne double pas le message quand la main sort déjà de la fenêtre (#191)', () => {
    // Main 640 → 906 : hors fenêtre, nommée une fois ; la pile qu'elle recouvre n'ajoute rien.
    const problemes = controle(geometrie({ mainBas: 906, actionsHaut: 700 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('bas de la main à 906 px');
  });

  it('relie le contrôle au passage réel sur le combat', () => {
    const source = read('scripts/preuves/capturer.mjs');
    // Sans ces liens, la sonde pourrait mordre dans son test et la capture continuer
    // à ne mesurer que la main.
    expect(source).toContain('page.evaluate(mesureHauteur, CIBLES_HAUTEUR)');
    // La taille par défaut est la référence (420 × 900) ; un gabarit de D-171 passe la sienne.
    expect(source).toContain('async function controlerHauteur(page, contexte, route, viewport = VIEWPORT) {');
    expect(source).toContain('controlesHauteur({ ...hauteur, viewport, etat: contexte })');
    expect(source).toContain('problems.push(`${route} · ${probleme}`)');
  });
});

/**
 * Ticket #237 — **la marge de 20 px de D-094 (3) est gardée**, pas recalculée à la main.
 *
 * D-193 retire la marge **entre la barre et la main** (la barre n'existe plus). Elle reste **sous soi,
 * jusqu'à la fenêtre** pour chaque surface jugée, la main compris ; la pile d'actions, au milieu de la
 * table, n'en a pas besoin. La valeur n'est pas recopiée : elle est relue dans la ligne D-094, pour que
 * l'acte et le code ne puissent pas diverger en silence (même patron que la taille de D-060, #153).
 */
describe('`npm run capturer` — la marge de hauteur de D-094 (3) (#237, D-193)', () => {
  /** La limite de D-094 (2) — le haut de la barre de navigation à 420 × 900. */
  const LIMITE = 830;

  /** La marge que D-094 (3) exige — « au moins 20 px » —, lue dans l'acte, pas recopiée. */
  function margeDeD094(): number {
    const lignes = read('docs/DECISIONS.md')
      .split('\n')
      .filter((ligne) => ligne.startsWith('| D-094 |'));
    expect(lignes, 'ligne D-094 introuvable dans docs/DECISIONS.md').toHaveLength(1);
    const marge = lignes[0].match(/au moins (\d+) px/);
    expect(marge, 'D-094 ne nomme plus de marge « au moins N px »').not.toBeNull();
    return Number(marge![1]);
  }

  /** Le contrôle réel du script, joué sur une géométrie construite à la main. */
  function controle(mesures: Mesure[], etat = '', limite = LIMITE): string[] {
    return sonde({ limite, mesures, etat });
  }

  /** La main jusqu'à `bas` (la seule surface jugée dans le bas), la piste bien au-dessus. */
  function mainA(bas: number): Mesure[] {
    return [
      { nom: 'la main', selecteur: '.hand', present: true, haut: bas - 100, bas },
      { nom: "la piste d'Interventions", selecteur: '.piste', present: true, haut: 380, bas: 400 }
    ];
  }

  it('lit la marge dans D-094 (3) : 20 px', () => {
    expect(margeDeD094()).toBe(20);
  });

  it('laisse passer une marge pile à l’exigence, et mord un pixel en dessous', () => {
    const marge = margeDeD094();
    expect(controle(mainA(LIMITE - marge))).toEqual([]);
    const problemes = controle(mainA(LIMITE - marge + 1));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la main n'a que");
    expect(problemes[0]).toContain(`n'a que ${marge - 1} px de marge`);
  });

  it('mord sur la marge mesurée de 15 px, et nomme l’état fautif (#237)', () => {
    // Le chiffre du ticket, tel qu'il a été mesuré : la main à 815 px, limite à 830 → 15 px.
    const problemes = controle(mainA(815), 'pas-à-pas ouvert');
    expect(problemes).toHaveLength(1);
    // La surface, la marge réelle, la limite, l'exigence — et l'état mesuré.
    expect(problemes[0]).toContain("la main n'a que 15 px de marge");
    expect(problemes[0]).toContain('bas de la main à 815 px');
    expect(problemes[0]).toContain('barre de navigation à 830 px');
    expect(problemes[0]).toContain(`${margeDeD094()} px exigés (D-094 (3))`);
    expect(problemes[0]).toContain('pas-à-pas ouvert');
  });

  it('applique la marge au pas-à-pas ouvert, sans exception (D-094 (3))', () => {
    // D-094 (3) dit « à 420 × 900 », sans réserve pour le pas-à-pas : la même géométrie fautive
    // doit mordre dans les deux états. Une exception, si elle est voulue, se décide (#237).
    const courte = controle(mainA(815), 'pas-à-pas ouvert');
    const terminee = controle(mainA(815), 'pas-à-pas terminé');
    expect(courte).toHaveLength(1);
    expect(terminee).toHaveLength(1);
    expect(terminee[0]).toContain('pas-à-pas terminé');
  });

  it('ne double pas le message quand l’élément sort déjà de la fenêtre', () => {
    // À 840, la main est hors fenêtre : nommée une fois pour le débordement, pas deux.
    const problemes = controle(mainA(840), 'pas-à-pas ouvert');
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("n'est pas visible sans défiler");
    expect(problemes[0]).not.toContain('de marge');
  });

  it('ne reproche pas la marge à un élément absent', () => {
    const mesures = mainA(815).map((mesure) => ({ ...mesure, present: false }));
    expect(controle(mesures)).toEqual([]);
  });

  it('n’exige pas de marge sous la pile d’actions, au milieu de la table (D-193 (3))', () => {
    // La pile finit à 815 px, à 15 px de la limite : elle n'est pas jugée sur sa marge, la main l'est.
    const mesures: Mesure[] = [
      { nom: 'la main', selecteur: '.hand', present: true, haut: 600, bas: 700 },
      {
        nom: "la pile d'actions du tour",
        selecteur: '.actions-flottantes',
        present: true,
        haut: 780,
        bas: 815,
        gauche: 284,
        droite: 396
      }
    ];
    expect(controle(mesures, 'pas-à-pas terminé')).toEqual([]);
  });

  it('passe le libellé de l’état mesuré au contrôle, dans la capture réelle', () => {
    const source = read('scripts/preuves/capturer.mjs');
    expect(source).toContain('etat: contexte');
    expect(source).toContain('(pas-à-pas terminé)');
  });
});

/**
 * Ticket #243 — **l'écran de combat ne défile plus** (D-103). La garde exige que la page **tienne**, à
 * chaque gabarit, et le dit aussi pour l'état « pas-à-pas ouvert », celui qui défilait.
 */
describe('`npm run capturer` — l’écran de combat ne défile pas (D-103, #243)', () => {
  const mesures: Mesure[] = [
    { nom: 'la main', selecteur: '.hand', present: true, haut: 620, bas: 720 },
    { nom: "la pile d'actions du tour", selecteur: '.actions-flottantes', present: true, haut: 730, bas: 806 }
  ];

  function controle(defilement: number | undefined, etat: string, pasAPasOuvert = false): string[] {
    return sonde({ limite: 830, mesures, defilement, etat, pasAPasOuvert });
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
    const source = read('scripts/preuves/capturer.mjs');
    expect(source).toContain('document.documentElement.scrollHeight - window.innerHeight');
    // Les passages passent tous par `controlerHauteur`, qui transmet la mesure entière.
    expect(source.match(/await controlerHauteur\(/g)?.length).toBeGreaterThanOrEqual(3);
    // La taille par défaut est la référence (420 × 900) ; un gabarit de D-171 passe la sienne.
    expect(source).toContain('async function controlerHauteur(page, contexte, route, viewport = VIEWPORT) {');
    expect(source).toContain('controlesHauteur({ ...hauteur, viewport, etat: contexte })');
  });
});

/**
 * Ticket #292 — **le mode `détaillé` ne casse pas la lecture à 420 px** (SPEC-COMBAT-UI T9).
 *
 * `détaillé` grossit les fiches du plateau ; mesuré le 27/10/2026 avec trois Conditions par camp, l'écran
 * défilait de 34 px. Le **pire cas** est posé dans le DOM par `poserLePireCas`. D-193 déplace « Fin du
 * tour » et les gestes dans la pile flottante : le contrôle les juge là.
 */
describe('`npm run capturer` — le mode détaillé tient dans la fenêtre (#292)', () => {
  const mesures = (actionsBas: number, finBas: number): Mesure[] => [
    { nom: 'la main', selecteur: '.hand', present: true, haut: 612, bas: 714 },
    { nom: "la pile d'actions du tour", selecteur: '.actions-flottantes', present: true, haut: 716, bas: actionsBas },
    {
      nom: '« Fin du tour »',
      selecteur: '.actions-flottantes .button--fin.is-a-toi',
      present: true,
      haut: finBas - 44,
      bas: finBas
    }
  ];

  function controle(geometrie: { mesures: Mesure[]; defilement: number }): string[] {
    return sonde({ limite: 830, pasAPasOuvert: false, etat: '(détaillé, pire cas)', ...geometrie });
  }

  it('le contrôle mord sur la mesure d’avant : pile à 846 px, bouton à 843 px, écran qui défile de 34 px', () => {
    const problemes = controle({ mesures: mesures(846, 843), defilement: 34 });
    expect(problemes.some((p) => p.includes('défile de 34 px') && p.includes('détaillé, pire cas'))).toBe(true);
    expect(problemes.some((p) => p.includes("bas de la pile d'actions du tour à 846 px"))).toBe(true);
    expect(problemes.some((p) => p.includes('bas de « Fin du tour » à 843 px'))).toBe(true);
  });

  it('laisse passer la mesure d’après : pile à 742 px, bouton à 738 px, aucun défilement', () => {
    expect(controle({ mesures: mesures(742, 738), defilement: 0 })).toEqual([]);
  });

  it('joue réellement `détaillé` à chaque graine, pas-à-pas ouvert et terminé, et pose le pire cas', () => {
    const source = readFileSync(new URL('./capturer.mjs', import.meta.url), 'utf8');
    // Sans ces liens, le contrôle pourrait mordre dans son test et la capture ne mesurer que `sobre`.
    expect(source).toContain('await mesurerDensite(browser, true)');
    expect(source).toContain('await mesurerAvecUnePression(browser, true)');
    expect(source).toContain('combatDetaille: true');
    expect(source).toContain("`.battle--${detaille ? 'detaille' : 'sobre'}`");
    expect(source).toContain('page.evaluate(poserLePireCas, [detaille, MODELE_BADGE])');
    expect(source).toContain('${etat}, pire cas');
  });

  it('range les Conditions en ligne dans les deux densités, et ne garde à `détaillé` que la largeur (feuille de style)', () => {
    const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\n\.poste__info\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).not.toMatch(/\n\.poste__info\s*\{[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.battle--detaille \.board__fiche\s*\{[^}]*max-width:\s*15rem/);
  });
});

/**
 * Ticket #321 — **`sobre` aussi tient dans la fenêtre avec trois Conditions des deux côtés**. Le pire cas
 * de `sobre` est joué ici à l'arrivée et au tour d'une Pression jouable. D-193 : la pile d'actions remplace
 * la barre, et son bas ne doit pas passer sous la fenêtre.
 */
describe('`npm run capturer` — `sobre` tient dans la fenêtre avec trois Conditions (#321)', () => {
  const mesures = (mainBas: number, actionsBas: number, finBas: number): Mesure[] => [
    { nom: 'la main', selecteur: '.hand', present: true, haut: 612, bas: mainBas },
    { nom: "la pile d'actions du tour", selecteur: '.actions-flottantes', present: true, haut: 716, bas: actionsBas },
    {
      nom: '« Fin du tour »',
      selecteur: '.actions-flottantes .button--fin.is-a-toi',
      present: true,
      haut: finBas - 44,
      bas: finBas
    }
  ];

  function controle(m: Mesure[], defilement: number): string[] {
    return sonde({ limite: 830, pasAPasOuvert: true, etat: '(sobre), pire cas', mesures: m, defilement });
  }

  it('le contrôle mord sur la mesure d’avant : pile à 868 px, bouton à 865 px, défilement de 56 px', () => {
    const problemes = controle(mesures(816, 868, 865), 56);
    expect(problemes.some((p) => p.includes('défile de 56 px') && p.includes('sobre), pire cas'))).toBe(true);
    expect(problemes.some((p) => p.includes("bas de la pile d'actions du tour à 868 px"))).toBe(true);
    expect(problemes.some((p) => p.includes('bas de « Fin du tour » à 865 px'))).toBe(true);
    expect(problemes.some((p) => p.includes("la main n'a que 14 px de marge"))).toBe(true);
  });

  it('laisse passer la mesure d’après : pile à 806 px, aucun défilement', () => {
    expect(controle(mesures(714, 806, 761), 0)).toEqual([]);
  });

  it('joue `sobre` avec le pire cas, à l’arrivée et au tour d’une Pression jouable', () => {
    const source = readFileSync(new URL('./capturer.mjs', import.meta.url), 'utf8');
    expect(source).toContain('await mesurerDensite(browser, false)');
    expect(source).toContain("`.battle--${detaille ? 'detaille' : 'sobre'}`");
    // Le pire cas du tour d'une Pression jouable, dans les deux densités.
    expect(source).toContain('${etat}, tour ${tour}, pire cas');
  });
});

/**
 * Ticket #741 — **la garde comprend une main rognée par le bas** (#743 en dépend). D-193 la rend rognée
 * **en permanence** : ses bornes (44 px, puis 52–60 px) se jugent à chaque passage où elle est mesurée.
 * Le plateau (`.board`) est mesuré, jamais jugé lui-même. D-193 retire la marge et la borne de vide sous la
 * barre : ces cas-là ne sont plus gardés, et les tests qui les gardaient sont retirés.
 */
describe('`npm run capturer` — la main rognée par le bas (#741, D-193)', () => {
  const LIMITE = 900;

  function controle(mesures: Mesure[]): string[] {
    return sonde({ limite: LIMITE, mesures, etat: 'cas' });
  }

  /**
   * Une main rognée : `haut` (le haut visible des cartes) et `visible` mesurés, la main descend sous la
   * limite (`bas` 980 > 900). La pile d'actions est à `actionsHaut`–`actionsBas`, et le plateau, mesuré mais
   * non jugé, descend sous la limite : il ne doit rien produire.
   */
  function rognee({
    haut = 844,
    visible = 56,
    actionsHaut = 800,
    actionsBas = 824,
    plateauBas = 1100
  }: {
    haut?: number;
    visible?: number;
    actionsHaut?: number;
    actionsBas?: number;
    plateauBas?: number;
  } = {}): Mesure[] {
    return [
      { nom: 'la main', selecteur: '.hand', present: true, haut, bas: 980, visible },
      {
        nom: "la pile d'actions du tour",
        selecteur: '.actions-flottantes',
        present: true,
        haut: actionsHaut,
        bas: actionsBas
      },
      { nom: "la piste d'Interventions", selecteur: '.piste', present: true, haut: 100, bas: 400 },
      { nom: 'le plateau', selecteur: '.board', present: true, haut: 100, bas: plateauBas }
    ];
  }

  it('laisse passer une main rognée à 56 px visibles, pile au-dessus, plateau mesuré seulement', () => {
    expect(controle(rognee())).toEqual([]);
  });

  it('mord sur une main visible de 72 px (composition d’aujourd’hui) et la nomme', () => {
    const problemes = controle(rognee({ haut: 828, visible: 72, actionsHaut: 760, actionsBas: 800 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('la main rognée a une hauteur visible de 72 px');
    expect(problemes[0]).toContain('52–60 px attendus (#743)');
  });

  it('mord sur une main visible de 44 px : le plancher passe, l’intervalle 52–60 non', () => {
    const problemes = controle(rognee({ haut: 856, visible: 44, actionsHaut: 790, actionsBas: 834 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('hauteur visible de 44 px');
    expect(problemes[0]).not.toContain('44 px au moins');
  });

  it('mord sur une main visible de 30 px sous le plancher de 44 px, et nomme la hauteur visible', () => {
    const problemes = controle(rognee({ haut: 870, visible: 30, actionsHaut: 800, actionsBas: 840 }));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la main rognée n'a que 30 px de hauteur visible");
    expect(problemes[0]).toContain('44 px au moins (#741)');
  });

  it('ne demande aucune marge entre la pile et la main rognée (D-193 : la barre a disparu)', () => {
    // Trois fois la marge d'avant, puis dix px : rien ne se pose sous la main, la pile n'est pas collée.
    expect(controle(rognee({ haut: 844, actionsHaut: 790, actionsBas: 834 }))).toEqual([]);
  });

  it('mord quand la pile recouvre la main rognée, et nomme la pile et la main', () => {
    const problemes = controle(rognee({ haut: 700, visible: 56, actionsHaut: 620, actionsBas: 760 }));
    expect(problemes.some((p) => p.includes("la pile d'actions du tour recouvre la main"))).toBe(true);
    expect(problemes.some((p) => p.includes('haut de la pile à 620 px'))).toBe(true);
  });

  it('ne borne plus le vide au-dessus de la main rognée : 70 px de vide, sans message (D-193)', () => {
    expect(controle(rognee({ haut: 870, visible: 56, actionsHaut: 700, actionsBas: 800 }))).toEqual([]);
  });

  it('ne juge pas le plateau : même dessous la navigation, il ne produit aucun problème', () => {
    expect(controle(rognee({ plateauBas: 1200 }))).toEqual([]);
  });

  it('la main absente d’une mesure de visibilité reste « hors » comme avant (pas de rognage supposé)', () => {
    const mesures = rognee().map((m) => (m.selecteur === '.hand' ? { ...m, visible: undefined } : m));
    const problemes = controle(mesures);
    expect(problemes.some((p) => p.includes("la main n'est pas visible sans défiler"))).toBe(true);
  });

  it('relie la mesure réelle au contrôle et imprime la hauteur visible de la main et du plateau', () => {
    const source = read('scripts/preuves/capturer.mjs');
    // `visible` est calculé après clipping : min(bas, limite, ancêtres clipsants) - max(haut, 0).
    expect(source).toContain("getComputedStyle(anc).overflow === 'visible'");
    expect(source).toContain('visible = Math.min(bas, limite, clipBas) - Math.max(haut, 0, clipHaut);');
    expect(source).toContain("{ nom: 'le plateau', selecteur: '.board' }");
    // Imprimée par `controlerHauteur`, donc sur chaque gabarit.
    expect(source).toContain('hauteur visible de la main : ');
  });
});

/**
 * Ticket D-193 — **la pile d'actions, le bandeau et « rien sous la main »**. Ce que la barre d'action
 * garantissait, la garde le garde désormais sur les nouvelles surfaces, et chaque règle a son cas fautif.
 */
describe('`npm run capturer` — la pile d’actions du tour et le bas de l’écran (D-193)', () => {
  const plateau = (gauche: number, droite: number): Mesure => ({
    nom: 'le plateau',
    selecteur: '.board',
    present: true,
    haut: 70,
    bas: 816,
    gauche,
    droite
  });

  function controle(mesures: Mesure[], extra: object = {}): string[] {
    return sonde({ limite: 830, mesures, ...extra });
  }

  it('rien ne se pose sous la main : un élément rendu sous son haut est nommé (D-193 (3))', () => {
    const mesures = [
      { nom: 'la main', selecteur: '.hand', present: true, haut: 640, bas: 760 },
      { nom: "la pile d'actions du tour", selecteur: '.actions-flottantes', present: true, haut: 430, bas: 474 }
    ] as Mesure[];
    expect(controle(mesures, { sousLaMain: [] })).toEqual([]);
    const problemes = controle(mesures, { sousLaMain: [{ nom: 'div.pas-de-barre', haut: 800 }] });
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('élément « div.pas-de-barre » rendu sous la main');
    expect(problemes[0]).toContain('bas visible de la main à 760 px');
  });

  it('juge la main en permanence : une main de 72 px visibles, non coupée par la fenêtre, est nommée (#743)', () => {
    // Avant D-193, `rognee` attendait une main qui dépasse la limite : une main qui tient restait dormante.
    const main = (visible: number): Mesure[] => [
      { nom: 'la main', selecteur: '.hand', present: true, haut: 790, bas: 810, visible },
      { nom: "la pile d'actions du tour", selecteur: '.actions-flottantes', present: true, haut: 430, bas: 474 }
    ];
    expect(controle(main(56))).toEqual([]);
    const problemes = controle(main(72));
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('la main rognée a une hauteur visible de 72 px');
  });

  it('la pile ne sort pas de la largeur de l’écran', () => {
    const mesures: Mesure[] = [
      {
        nom: "la pile d'actions du tour",
        selecteur: '.actions-flottantes',
        present: true,
        haut: 430,
        bas: 474,
        gauche: -4,
        droite: 400
      }
    ];
    const problemes = controle(mesures);
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la pile d'actions du tour sort de la largeur de l'écran");
  });

  it('la pile rognée par la table est nommée, pas laissée passer', () => {
    const mesures: Mesure[] = [
      {
        nom: "la pile d'actions du tour",
        selecteur: '.actions-flottantes',
        present: true,
        haut: 430,
        bas: 474,
        gauche: 284,
        droite: 396,
        coupe: true
      }
    ];
    const problemes = controle(mesures);
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la pile d'actions du tour est rognée par le plateau");
  });

  it('la pile ne déborde pas le bord du plateau', () => {
    const pile = (gauche: number, droite: number): Mesure => ({
      nom: "la pile d'actions du tour",
      selecteur: '.actions-flottantes',
      present: true,
      haut: 430,
      bas: 474,
      gauche,
      droite
    });
    expect(controle([plateau(19, 401), pile(284, 396)])).toEqual([]);
    const problemes = controle([plateau(19, 401), pile(10, 396)]);
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la pile d'actions du tour déborde le bord du plateau");
  });

  it('le bandeau du tour ne recouvre pas la pile', () => {
    const bandeau = (haut: number, bas: number): Mesure => ({
      nom: 'le bandeau du tour',
      selecteur: '.combat-toast',
      present: true,
      haut,
      bas,
      gauche: 24,
      droite: 396
    });
    const pile = (haut: number): Mesure => ({
      nom: "la pile d'actions du tour",
      selecteur: '.actions-flottantes',
      present: true,
      haut,
      bas: haut + 44,
      gauche: 284,
      droite: 396
    });
    expect(controle([bandeau(58, 104), pile(430)])).toEqual([]);
    const problemes = controle([bandeau(58, 104), pile(90)]);
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("le bandeau du tour recouvre la pile d'actions du tour");
  });

  it('la garde ne cite plus la barre d’action : ni la capture ni le pas-à-pas ne la cherchent (D-193)', () => {
    const capturer = read('scripts/preuves/capturer.mjs');
    const jouer = read('scripts/preuves/jouer-partie.mjs');
    expect(capturer).not.toContain('.combat-barre');
    expect(jouer).not.toContain('.combat-barre');
    expect(capturer).toContain('D-193');
    expect(capturer).toContain('sousLaMain');
  });
});

/**
 * Ticket D-193 — **la portée des règles de téléphone** : « rien ne se pose sous la main », la hauteur visible
 * de 52–60 px et les bords du plateau se jugent sur un téléphone en portrait (largeur ≤ 639, hauteur >
 * largeur). **D-200 (#790)** étend à bureau (≥ 900 px) « rien sous la main » et la hauteur visible — selon la
 * fenêtre : 52–60 px à 1280 × 800, 68–76 px à 1920 × 1080 — mais **pas** les bords du plateau. La bande
 * 640–899 px n'est pas tranchée : seules les règles génériques s'y appliquent.
 * Chaque portée a son cas fautif.
 */
describe('`npm run capturer` — la portée des règles de téléphone et de bureau (D-193, D-200)', () => {
  const PC: Record<string, number> = { width: 1280, height: 800 };
  const TELEPHONE: Record<string, number> = { width: 420, height: 900 };
  const PAYSAGE: Record<string, number> = { width: 740, height: 360 };

  /** Une géométrie de combat sur `viewport`, la limite à la hauteur de la fenêtre (pas de navigation). */
  function controle(viewport: Record<string, number>, mesures: Mesure[], extra: object = {}): string[] {
    return sonde({ limite: viewport.height, viewport, mesures, ...extra });
  }

  /** Une main de `visible` px, de `haut` à la limite (rognée par la fenêtre) ou entière (`bas`). */
  function main(haut: number, bas: number, visible: number): Mesure {
    return { nom: 'la main', selecteur: '.hand', present: true, haut, bas, visible };
  }

  /** Un élément rendu sous la main, tel que `mesureHauteur` le relève (`haut` et `bas` visibles). */
  const sous = (nom: string, haut: number, bas: number) => ({ nom, haut, bas });

  const GRAND: Record<string, number> = { width: 1920, height: 1080 };
  const TABLETTE: Record<string, number> = { width: 800, height: 1000 };

  it('bureau (D-200) : une main rognée à 56 px visibles à 1280 × 800 passe, une main de 150 px est nommée', () => {
    expect(controle(PC, [main(724, 780, 56)], { limite: 800 })).toEqual([]);
    const problemes = controle(PC, [main(630, 780, 150)]);
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('la main rognée a une hauteur visible de 150 px');
    expect(problemes[0]).toContain('52–60 px attendus (D-200)');
  });

  it('bureau (D-200) : la bande suit la hauteur de la fenêtre — 72 px à 1920 × 1080, mais 72 px est refusé à 1280 × 800', () => {
    expect(controle(GRAND, [main(988, 1060, 72)])).toEqual([]);
    // La bande du téléphone (56 px) est trop mince pour une fenêtre de 1080 px : 68–76 px attendus.
    const mince = controle(GRAND, [main(1004, 1060, 56)]);
    expect(mince).toHaveLength(1);
    expect(mince[0]).toContain('68–76 px attendus (D-200)');
    // Et la bande de 1080 est trop épaisse pour 800 px de haut : 52–60 px attendus.
    expect(controle(PC, [main(708, 780, 72)])).toHaveLength(1);
  });

  it('bureau (D-200) : le plancher de 44 px et les bornes sont mordus aux deux bords de l’intervalle', () => {
    expect(controle(PC, [main(728, 780, 52)])).toEqual([]);
    expect(controle(PC, [main(720, 780, 60)])).toEqual([]);
    expect(controle(PC, [main(729, 780, 51)])).toHaveLength(1);
    expect(controle(PC, [main(719, 780, 61)])).toHaveLength(1);
  });

  it('la bande 640–899 px, que D-200 ne tranche pas, ne juge que les règles génériques', () => {
    expect(controle(TABLETTE, [main(830, 980, 150)], { limite: 1000 })).toEqual([]);
  });

  it('la même main de 150 px visibles à 420 × 900 est nommée (#743)', () => {
    const problemes = controle(TELEPHONE, [main(730, 880, 150)], { limite: 900 });
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('la main rognée a une hauteur visible de 150 px');
    expect(problemes[0]).toContain('420 × 900');
  });

  it('en paysage téléphone (740 × 360), la main de 150 px visibles n’est pas une règle de téléphone', () => {
    expect(controle(PAYSAGE, [main(190, 340, 150)])).toEqual([]);
  });

  it('le plancher de 44 px reste générique : une main de 30 px est nommée à 1280 × 800', () => {
    const problemes = controle(PC, [main(750, 780, 30)]);
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("la main rognée n'a que 30 px de hauteur visible");
  });

  it('rien sous la main : un texte à 890 px, la main finissant à 880 px, est nommé à 420 × 900', () => {
    const problemes = controle(TELEPHONE, [main(824, 880, 56)], {
      limite: 900,
      sousLaMain: [sous('span.muted', 890, 905)]
    });
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('élément « span.muted » rendu sous la main');
    expect(problemes[0]).toContain('bas visible de la main à 880 px');
  });

  it('rien sous la main : l’ancienne barre d’action à 905 px, sous le bas de la main, est nommée à 420 × 900', () => {
    const problemes = controle(TELEPHONE, [main(824, 880, 56)], {
      limite: 900,
      sousLaMain: [sous('div.combat-barre', 905, 950)]
    });
    expect(problemes.some((p) => p.includes('élément « div.combat-barre » rendu sous la main'))).toBe(true);
  });

  it('rien sous la main : un calque dans le rectangle de la main (haut à 825, la main à 824–880) n’est pas nommé', () => {
    // La pastille « N / 10 » et le titre de `.hand-panel` sont relevés hors de `.hand-panel` seulement par la
    // mesure du navigateur ; côté contrôle, un élément qui commence avant le bas visible de la main ne se pose pas dessous.
    expect(controle(TELEPHONE, [main(824, 880, 56)], { limite: 900, sousLaMain: [sous('h2', 825, 845)] })).toEqual([]);
  });

  it('rien sous la main : la règle s’applique aussi à 1280 × 800 (D-200), et ne nomme pas un calque dans la main', () => {
    const mesures = [main(704, 760, 56)];
    const problemes = controle(PC, mesures, { sousLaMain: [sous('path', 800, 820)] });
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('élément « path » rendu sous la main (1280 × 800)');
    expect(controle(TELEPHONE, mesures, { sousLaMain: [sous('path', 800, 820)] })).toHaveLength(1);
    expect(controle(PC, mesures, { sousLaMain: [sous('h2', 706, 726)] })).toEqual([]);
  });

  it('rien sous la main : la bande 640–899 px n’est pas jugée', () => {
    expect(controle(TABLETTE, [main(830, 980, 150)], { limite: 1000, sousLaMain: [sous('path', 985, 995)] })).toEqual(
      []
    );
  });

  it('les bords du plateau ne se jugent que sur téléphone : une pile hors du plateau est nommée à 420 × 900 seulement', () => {
    const plateau: Mesure = {
      nom: 'le plateau',
      selecteur: '.board',
      present: true,
      haut: 70,
      bas: 816,
      gauche: 19,
      droite: 401
    };
    const pile: Mesure = {
      nom: "la pile d'actions du tour",
      selecteur: '.actions-flottantes',
      present: true,
      haut: 430,
      bas: 474,
      gauche: 10,
      droite: 396
    };
    expect(controle(TELEPHONE, [plateau, pile], { limite: 900 })).toHaveLength(1);
    expect(
      controle(PC, [
        { ...plateau, bas: 700, droite: 900 },
        { ...pile, gauche: 10, droite: 396 }
      ])
    ).toEqual([]);
  });

  it('les cibles de 44 px restent génériques : un bouton de 30 px est nommé à 1280 × 800', () => {
    const problemes = sonde({
      limite: 800,
      viewport: PC,
      mesures: [],
      boutonsPetits: [{ nom: 'Ramasser', hauteur: 30 }]
    });
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('la cible de doigt est de 44 px');
  });

  it('le défilement reste générique : un écran qui défile de 120 px est nommé à 1280 × 800', () => {
    const problemes = sonde({ limite: 800, viewport: PC, mesures: [], defilement: 120 });
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain('défile de 120 px');
  });

  it('la règle de téléphone est bornée par la largeur 639 : 639 × 900 est téléphone, 640 × 900 ne l’est pas', () => {
    const mesures = [main(730, 880, 150)];
    expect(controle({ width: 639, height: 900 }, mesures)).toHaveLength(1);
    expect(controle({ width: 640, height: 900 }, mesures)).toEqual([]);
  });

  it('la mesure du navigateur écarte le contenant de la main et les éléments sr-only ou clipés à 1 px', () => {
    const source = read('scripts/preuves/capturer.mjs');
    expect(source).toContain("el.closest('.bottom-nav, .sr-only, .hand-panel')");
    expect(source).toContain('if (r.width <= 1 || r.height <= 1) continue;');
    expect(source).toContain('const telephone = estTelephonePortrait(viewport);');
    expect(source).toContain('const bureau = estBureau(viewport);');
  });
});
