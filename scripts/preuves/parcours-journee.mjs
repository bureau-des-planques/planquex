#!/usr/bin/env node
/**
 * Parcours automatisé de la Journée d'intégration (#686) — une preuve de rendu.
 *
 * Le banc joue les cinq étapes de `ETAPES_JOURNEE` dans un vrai Chromium, sur le build
 * (`dist/`), par leurs **routes** et leurs **gestes** réels : il ne lit aucun état de
 * l'application pour agir, il clique. Pour chaque étape il vérifie que l'écran affiché est
 * celui qu'elle décrit (titre du panneau, route, cible présente), joue le geste, prend une
 * capture, puis suit le bouton « Suivant » — qui ouvre l'écran de l'étape suivante (#677).
 *
 * **Ce que le banc ne fait pas, et pourquoi**
 * - **Il ne simule aucun serveur.** L'Arrivage s'ouvre en ligne (D-179) : sans serveur
 *   Supabase configuré, il refuse hors ligne, et le banc ne fabrique pas de réponse.
 *   L'étape Arrivage est alors **capturée sans son geste**, puis sautée avec sa raison.
 * - **Il n'intercepte aucune requête** : la source des réponses réseau attend l'arbitrage
 *   v0-04 (ticket #686). Les 404 sont relevés et font échouer le parcours, nommés.
 * - **Il ne lit aucun secret et n'écrit aucun identifiant.** Les captures vont dans un
 *   dossier hors dépôt (`PARCOURS_JOURNEE_DIR`, défaut : `$TMPDIR/planquex-parcours-journee`).
 * - **Le numéro de version du store** se lit dans `src/store/useStore.ts` (`STORAGE_VERSION`),
 *   jamais dans ce fichier : l'état préparé le porte pour qu'aucune migration ne tourne.
 *
 * Usage :
 *   npm run build && npm run parcours:journee
 *   BASE_URL=http://localhost:5178 npm run parcours:journee
 *   node scripts/preuves/parcours-journee.mjs --plan   (imprime le plan lu dans le code, sans navigateur)
 *
 * Variables : CHROME_PATH (binaire Chromium), BASE_URL (serveur déjà lancé), PORT (défaut 4196),
 * PARCOURS_JOURNEE_DIR (dossier des captures, hors dépôt). Le serveur Supabase est « configuré »
 * si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont posées dans l'environnement du banc.
 *
 * Sortie : 0 si chaque étape jouée est conforme (les étapes sautées sont nommées) ; 1 à la
 * première étape non conforme, avec son nom ; 2 si l'usage est faux.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STORAGE_KEY, VIEWPORT } from './capturer-socle.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const SOURCE_STORE = 'src/store/useStore.ts';
const DOSSIER_PAR_DEFAUT = join(tmpdir(), 'planquex-parcours-journee');

/**
 * Les gestes que le banc sait jouer. Un geste de `ETAPES_JOURNEE` absent d'ici fait échouer
 * le plan (`verifierPlan`), au lieu d'être sauté en silence.
 */
export const GESTES_JOUES = Object.freeze(['arrivage', 'deck', 'combat', 'sauvegarde']);

/**
 * La version du store, lue **à la source** (`STORAGE_VERSION`, `src/store/useStore.ts`).
 * Un fichier sans la constante fait échouer la lecture : on ne devine pas de numéro.
 */
export function lireVersionStore(source) {
  const trouve = /export const STORAGE_VERSION = (\d+);/.exec(source);
  if (!trouve) throw new Error(`STORAGE_VERSION introuvable dans ${SOURCE_STORE}`);
  return Number(trouve[1]);
}

/**
 * L'état de départ : la Journée est **visible** (`tutorielVu: false`), et le blob porte la
 * version lue à la source — une version identique ne déclenche aucune migration.
 */
export function etatInitialJournee({ origine, version }) {
  return {
    cookies: [],
    origins: [
      {
        origin: origine,
        localStorage: [{ name: STORAGE_KEY, value: JSON.stringify({ state: { tutorielVu: false }, version }) }]
      }
    ]
  };
}

/** Le nom d'une capture : son numéro et le titre de l'étape, sans accent ni espace. */
export function nomDeCapture(numero, titre) {
  const slug = titre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `journee-${numero}-${slug}.png`;
}

/** Une erreur qui nomme l'étape : c'est le premier élément que le lecteur doit voir. */
export function erreurEtape(etape, raison) {
  return new Error(`Étape « ${etape.titre} » (${etape.numero}/${etape.total}) : ${raison}`);
}

/**
 * Le plan : une entrée par étape, lue dans `ETAPES_JOURNEE` (la route vient de `cible`, le
 * bouton de la cible du geste vient de `CIBLE_DE_GESTE`). Aucun numéro d'étape n'est écrit ici.
 */
export function planDeLaJournee(etapes, cibleDeGeste, cheminDeCible) {
  return etapes.map((etape, index) => ({
    numero: index + 1,
    total: etapes.length,
    titre: etape.titre,
    geste: etape.geste ?? null,
    chemin: cheminDeCible(etape.cible),
    cible: etape.geste ? (cibleDeGeste[etape.geste] ?? null) : null,
    capture: nomDeCapture(index + 1, etape.titre)
  }));
}

/** Refuse un plan qui contient un geste que le banc ne sait pas jouer. */
export function verifierPlan(plan) {
  for (const etape of plan) {
    if (etape.geste !== null && !GESTES_JOUES.includes(etape.geste)) {
      throw erreurEtape(etape, `geste « ${etape.geste} » sans parcours dans le banc`);
    }
    if (!etape.chemin.startsWith('/')) {
      throw erreurEtape(etape, `route de l'étape invalide « ${etape.chemin} »`);
    }
  }
  return plan;
}

/** La route affichée est celle de l'étape, sinon l'étape échoue en le disant. */
export function verifierRoute(etape, cheminRecu) {
  if (cheminRecu !== etape.chemin) {
    throw erreurEtape(etape, `route inattendue : attendu « ${etape.chemin} », reçu « ${cheminRecu} »`);
  }
}

/** Le panneau affiche le compteur et le titre de l'étape, et non ceux d'une autre. */
export function verifierTitre(etape, texteDuPanneau) {
  const compte = `${etape.numero}/${etape.total}`;
  if (!texteDuPanneau.includes(compte) || !texteDuPanneau.includes(etape.titre)) {
    throw erreurEtape(etape, `le panneau affiche « ${texteDuPanneau.trim()} », pas l'étape décrite`);
  }
}

/** La cible du geste est dans la page ; sinon, l'étape le dit avec son sélecteur. */
export function verifierCible(etape, presente) {
  if (etape.cible && !presente) {
    throw erreurEtape(etape, `cible absente : [data-journee-cible="${etape.cible}"]`);
  }
}

/**
 * Le dossier des captures : configurable, et **jamais dans le dépôt** (les captures ne sont
 * pas une preuve à versionner, et un dossier du dépôt pourrait recevoir un secret).
 */
export function dossierDeCaptures(env, racine = root, defaut = DOSSIER_PAR_DEFAUT) {
  const dossier = resolve(env.PARCOURS_JOURNEE_DIR ?? defaut);
  const rel = relative(racine, dossier);
  const dedans = rel === '' || (rel.split(sep)[0] !== '..' && !isAbsolute(rel));
  if (dedans) throw new Error(`le dossier des captures est dans le dépôt : ${dossier}`);
  return dossier;
}

/** Le serveur Supabase est-il configuré dans l'environnement du banc ? */
export function serveurConfigure(env) {
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
}

/** Le chemin d'une URL, sans requête : `?scene=fin` n'est pas une route. */
function cheminDe(url) {
  return new URL(url).pathname;
}

/**
 * Les références, lues **dans le code** par Vite (le TypeScript n'a pas à être compilé) :
 * les étapes, la cible de chaque geste, le chemin d'une cible, et la version du store.
 */
export async function chargerReferences() {
  const { createServer } = await import('vite');
  const serveur = await createServer({
    root,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false }
  });
  try {
    const etapes = await serveur.ssrLoadModule('/src/components/journee-etapes.ts');
    const cibles = await serveur.ssrLoadModule('/src/components/journee-cible.ts');
    return {
      etapes: etapes.ETAPES_JOURNEE,
      cheminDeCible: etapes.cheminDeCible,
      cibleDeGeste: cibles.CIBLE_DE_GESTE,
      version: lireVersionStore(readFileSync(join(root, SOURCE_STORE), 'utf8'))
    };
  } finally {
    await serveur.close();
  }
}

/**
 * Attend que la route soit celle voulue, puis que le DOM **se taise**. Les pages sont
 * paresseuses (#478) : la route change avant le rendu du morceau, et `networkidle` ne sert
 * à rien ici (il est déjà atteint pour le document, il rend la main tout de suite). Sans
 * cette attente, la capture photographiait l'écran précédent (constaté sur `/comite`, le
 * 04/11/2026 : le compteur disait « 5/5 » sur les Réglages).
 */
async function attendreRoute(page, chemin) {
  try {
    await page.waitForFunction((attendu) => window.location.pathname === attendu, chemin, { timeout: 5000 });
    await attendreDomStable(page);
  } catch {
    // Lu tel quel après : la comparaison dira la route inattendue, et la capture montrera le reste.
  }
  return cheminDe(page.url());
}

/** Le DOM n'a plus bougé depuis `silence` ms : le rendu du morceau est fait. */
async function attendreDomStable(page, silence = 800) {
  await page.evaluate(
    (delai) =>
      new Promise((resoudre) => {
        let minuterie = setTimeout(fin, delai);
        const observateur = new MutationObserver(() => {
          clearTimeout(minuterie);
          minuterie = setTimeout(fin, delai);
        });
        function fin() {
          observateur.disconnect();
          resoudre();
        }
        observateur.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
      }),
    silence
  );
}

/** Le panneau de la Journée, tel qu'il est affiché (vide hors panneau : le combat). */
async function texteDuPanneau(page) {
  const titre = page.locator('#journee-titre');
  await titre.waitFor({ state: 'visible', timeout: 8000 });
  return titre.innerText();
}

/**
 * La cible du geste apparaît après l'effet de la Journée (les écrans sont paresseux, #478) :
 * on l'attend quelques secondes, puis on rend présente ou absente. Une cible absente n'est
 * pas une exception ici : `verifierCible` la nomme.
 */
async function cibleAttendue(page, etape) {
  if (!etape.cible) return true;
  return page
    .locator(`[data-journee-cible="${etape.cible}"]`)
    .first()
    .waitFor({ state: 'attached', timeout: 8000 })
    .then(
      () => true,
      () => false
    );
}

/** Le geste est fait : la région de la Journée l'annonce (« C’est fait »). */
async function attendreGesteFait(page) {
  await page.getByText('C’est fait', { exact: false }).first().waitFor({ state: 'attached', timeout: 15000 });
}

/**
 * Les gestes, un par type. Chacun clique ce que l'étape demande, sur la page, et ne touche
 * jamais au store : c'est le testeur (ici le banc) qui fait le geste.
 */
const GESTES = {
  async arrivage(page) {
    await page.getByRole('button', { name: 'Ouvrir un Arrivage', exact: true }).click();
    await attendreGesteFait(page);
  },
  async deck(page) {
    await page
      .locator('[data-journee-cible="decks-proposes"] button', { hasText: /^Charger$/ })
      .first()
      .click();
    await attendreGesteFait(page);
  },
  async sauvegarde(page) {
    await page.getByRole('button', { name: 'Créer ma sauvegarde', exact: true }).click();
    await attendreGesteFait(page);
  },
  /** La fin scriptée (`?scene=fin`) : une Pression suffit, la Journée se valide à la scène de fin. */
  async combat(page) {
    const barre = page.locator('[data-pression-jouable="true"]');
    await barre.waitFor({ state: 'attached', timeout: 10000 });
    await barre.locator('button.button--primary').first().click();
    await page.getByRole('button', { name: 'Continuer', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  }
};

/** Le geste de l'étape, avec le bouton qui fait suivre l'écran. Sans geste : rien. */
async function avancer(page, etape) {
  if (etape.geste === 'combat') {
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Suivant', exact: true }).click({ timeout: 8000 });
  }
}

/**
 * Le parcours : une étape à la fois. Une erreur de page (`pageerror`, console, 404) ou un
 * écran non conforme fait échouer **l'étape en cours**, pas le parcours entier en silence.
 */
export async function parcourir({ page, plan, base, dossier, serveur }) {
  const journal = [];
  let problemes = [];
  page.on('pageerror', (erreur) => problemes.push(`erreur de page : ${erreur.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problemes.push(`erreur de console : ${message.text()}`);
  });
  page.on('response', (reponse) => {
    if (reponse.status() === 404) {
      problemes.push(`404 : ${reponse.request().method()} ${cheminDe(reponse.url())}`);
    }
  });

  let saute = false;
  for (const etape of plan) {
    problemes = [];
    const entree = { numero: etape.numero, titre: etape.titre, statut: 'joue', capture: null, raison: null };
    try {
      // L'arrivée : l'étape 1 s'ouvre sur `/`, les autres sur la route que « Suivant » ouvre.
      if (etape.numero === 1 || saute) {
        await page.goto(`${base}${etape.chemin}`, { waitUntil: 'domcontentloaded' });
        saute = false;
      }

      // Un geste réseau sans serveur : l'écran est photographié, puis le geste est sauté.
      const sansServeur = etape.geste === 'arrivage' && !serveur.configure;
      const chemin = await attendreRoute(page, etape.chemin);
      verifierRoute(etape, chemin);
      if (etape.geste !== 'combat') {
        verifierTitre(etape, await texteDuPanneau(page));
      }
      verifierCible(etape, await cibleAttendue(page, etape));

      if (sansServeur) {
        entree.statut = 'saute';
        entree.raison =
          'aucun serveur Supabase configuré : l’Arrivage refuse hors ligne (D-179), le banc ne le simule pas';
        saute = true;
      } else if (etape.geste) {
        await GESTES[etape.geste](page, etape);
      }

      if (problemes.length > 0) throw erreurEtape(etape, problemes[0]);

      entree.capture = join(dossier, etape.capture);
      await page.screenshot({ path: entree.capture, animations: 'disabled' });
      journal.push(entree);

      if (entree.statut === 'saute') continue;
      if (etape.numero < plan.length) await avancer(page, etape);
    } catch (erreur) {
      // Toute erreur — y compris celle de Playwright — sort avec le nom de l'étape.
      if (erreur instanceof Error && erreur.message.startsWith('Étape « ')) throw erreur;
      throw erreurEtape(etape, erreur instanceof Error ? erreur.message.split('\n')[0] : String(erreur));
    }
  }
  return journal;
}

async function main() {
  if (process.argv.includes('--plan')) {
    const { etapes, cheminDeCible, cibleDeGeste, version } = await chargerReferences();
    const plan = verifierPlan(planDeLaJournee(etapes, cibleDeGeste, cheminDeCible));
    console.log(JSON.stringify({ version, plan }, null, 2));
    return 0;
  }

  const references = await chargerReferences();
  const plan = verifierPlan(planDeLaJournee(references.etapes, references.cibleDeGeste, references.cheminDeCible));
  const dossier = dossierDeCaptures(process.env);
  mkdirSync(dossier, { recursive: true });

  let serveur = null;
  const base = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 4196}`;
  if (!process.env.BASE_URL) {
    if (!existsSync(join(root, 'dist/index.html'))) {
      console.error('dist/index.html absent : lance `npm run build` avant `npm run parcours:journee`.');
      return 1;
    }
    const { preview } = await import('vite');
    serveur = await preview({
      root,
      preview: { port: Number(process.env.PORT ?? 4196), strictPort: true },
      logLevel: 'error'
    });
  }

  const executablePath =
    process.env.CHROME_PATH ?? join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
  const { chromium } = await import('playwright-core');
  const navigateur = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  try {
    const origine = new URL(base).origin;
    const contexte = await navigateur.newContext({
      viewport: VIEWPORT,
      serviceWorkers: 'block',
      storageState: etatInitialJournee({ origine, version: references.version })
    });
    const page = await contexte.newPage();
    const journal = await parcourir({
      page,
      plan,
      base,
      dossier,
      serveur: { configure: serveurConfigure(process.env) }
    });
    for (const entree of journal) console.log(JSON.stringify(entree));
    console.log(`captures : ${dossier}`);
    return 0;
  } catch (erreur) {
    console.error(`Parcours interrompu — ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    return 1;
  } finally {
    await navigateur.close();
    await serveur?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
