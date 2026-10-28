// Mesure des gestes de navigation (#426) : pilote un build réel servi par `vite preview`.
// Un « geste » = un clic (ou un tap) sur un contrôle, OU un « retour » du navigateur.
// Chaque chemin est exécuté ; l'arrivée est vérifiée sur l'URL. Rien n'est estimé.
//
// Usage : node docs/preuves/sorties-2026-10-28/mesure-gestes.mjs <url-de-base> <largeur> <hauteur>
import { chromium } from 'playwright-core';

const [, , BASE = 'http://localhost:4194', LARG = '420', HAUT = '900'] = process.argv;
const EXEC = '/opt/pw-browsers/chromium';

const NAV = (nom) => ({
  kind: 'click',
  sel: `nav[aria-label="Navigation principale"] a:has-text("${nom}")`,
  label: `barre du bas « ${nom} »`
});
const ACCUEIL = NAV('Accueil');
const GEAR = { kind: 'click', sel: 'a[aria-label="Réglages"]', label: 'engrenage (en-tête)' };
const RETOUR_BUREAU = {
  kind: 'click',
  sel: 'a:has-text("Retour au bureau"), a:has-text("Retour à l’accueil")',
  label: '« Retour au bureau »'
};

// Chemins aller (depuis l'accueil) et retour (depuis l'écran), tels que l'interface les offre.
const CHEMINS = [
  { route: '/collection', aller: [NAV('Collection')], retour: [ACCUEIL] },
  { route: '/deck', aller: [NAV('Deck')], retour: [ACCUEIL] },
  {
    route: '/battle',
    aller: [
      { kind: 'click', sel: 'a:has-text("Affronter la Direction")', label: '« Affronter la Direction » (accueil)' }
    ],
    retour: [{ kind: 'click', sel: 'a.battle__sortie', label: 'lien ← du combat' }]
  },
  { route: '/comite', aller: [NAV('Comité')], retour: [ACCUEIL] },
  {
    route: '/comite/suivi',
    aller: [NAV('Comité'), { kind: 'click', sel: 'a:has-text("Le suivi")', label: 'sous-onglet « Le suivi »' }],
    retour: [ACCUEIL]
  },
  { route: '/settings', aller: [GEAR], retour: [ACCUEIL] },
  {
    route: '/confidentialite',
    aller: [
      GEAR,
      {
        kind: 'click',
        sel: 'a:has-text("la page de confidentialité")',
        label: 'lien « la page de confidentialité » (Réglages)'
      }
    ],
    retour: [RETOUR_BUREAU]
  },
  {
    route: '/feuille-de-route',
    aller: [
      { kind: 'click', sel: 'a:has-text("Voir toutes les versions")', label: '« Voir toutes les versions » (accueil)' }
    ],
    retour: [RETOUR_BUREAU]
  }
];

// Routes sans aucun lien interne : seule une saisie d'adresse les ouvre (mesuré à part).
const SANS_LIEN = ['/installation', '/connexion', '/attente', '/administration'];

async function geste(page, action) {
  const cible = page.locator(action.sel).first();
  await cible.waitFor({ state: 'visible', timeout: 4000 });
  await cible.click();
  await page.waitForTimeout(150);
}

async function fermerAccueil(page) {
  // Première visite : la « Journée d'intégration » peut couvrir l'écran. On la ferme, sans compter.
  for (let i = 0; i < 3; i++) {
    if (
      await page
        .locator('[role="dialog"]')
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  }
}

function chemin(url) {
  return new URL(url).pathname.replace(/\/$/, '') || '/';
}

async function mesurer(browser) {
  const resultats = [];
  for (const { route, aller, retour } of CHEMINS) {
    const context = await browser.newContext({ viewport: { width: Number(LARG), height: Number(HAUT) } });
    const page = await context.newPage();
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(String(e.message)));
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await fermerAccueil(page);
    let ok = true;
    for (const a of aller) await geste(page, a);
    const arrivee = chemin(page.url());
    if (arrivee !== route) ok = false;
    // Retour : les gestes du chemin de retour, puis le bouton du navigateur, pour mesurer les deux.
    let retourOk = false;
    let gestesRetour = 0;
    if (ok) {
      for (const r of retour) {
        await geste(page, r);
        gestesRetour++;
      }
      retourOk = chemin(page.url()) === '/';
    }
    // Retour par le bouton du navigateur : on remonte l'historique jusqu'à l'accueil.
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await fermerAccueil(page);
    for (const a of aller) await geste(page, a);
    let retourNavigateur = 0;
    while (chemin(page.url()) !== '/' && retourNavigateur < 6) {
      await page.goBack();
      await page.waitForTimeout(200);
      retourNavigateur++;
    }
    resultats.push({
      route,
      largeur: LARG,
      hauteur: HAUT,
      gestesAller: aller.length,
      arriveeOk: ok,
      cheminAller: aller.map((a) => a.label),
      gestesRetourControle: gestesRetour,
      retourControleOk: retourOk,
      cheminRetour: retour.map((r) => r.label),
      retourNavigateurPas: retourNavigateur,
      erreursPage: erreurs
    });
    await context.close();
  }
  return resultats;
}

async function sortiesDuCombat(browser) {
  // Ce qui reste utilisable en combat : mesuré sur le plateau, après l'entrée.
  const context = await browser.newContext({ viewport: { width: Number(LARG), height: Number(HAUT) } });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await fermerAccueil(page);
  await geste(page, CHEMINS[2].aller[0]);
  await page.waitForTimeout(300);
  const visibles = await page.evaluate(() => {
    const liens = [...document.querySelectorAll('a, button')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
    return liens
      .map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60))
      .filter(Boolean);
  });
  const navPresente = await page.locator('nav[aria-label="Navigation principale"]').count();
  // Le menu ⋯ du combat : ses entrées, sans en lancer aucune.
  let entreesMenu = [];
  const bouton = page.locator('button[aria-label="Menu du combat"]').first();
  if (await bouton.count()) {
    await bouton.click().catch(() => {});
    await page.waitForTimeout(200);
    entreesMenu = await page.locator('.combat-menu__liste .combat-menu__entree').allInnerTexts();
  }
  await context.close();
  return { largeur: LARG, hauteur: HAUT, navPresente, controlesVisibles: visibles, entreesMenu };
}

async function sansLien(browser) {
  // Adresse saisie : l'écran existe-t-il, et y a-t-il une voie de retour ?
  const out = [];
  for (const route of SANS_LIEN) {
    const context = await browser.newContext({ viewport: { width: Number(LARG), height: Number(HAUT) } });
    const page = await context.newPage();
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const retour = await page.locator('a[href="/"]').count();
    const nav = await page.locator('nav[aria-label="Navigation principale"]').count();
    const titre =
      (await page
        .locator('h1')
        .first()
        .textContent()
        .catch(() => '')) || '';
    out.push({ route, titre: titre.trim(), liensVersAccueil: retour, barreDuBas: nav });
    await context.close();
  }
  return out;
}

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
try {
  const mesures = await mesurer(browser);
  const combat = await sortiesDuCombat(browser);
  const sansLienMesure = await sansLien(browser);
  console.log(
    JSON.stringify({ base: BASE, largeur: LARG, hauteur: HAUT, mesures, combat, sansLien: sansLienMesure }, null, 2)
  );
} finally {
  await browser.close();
}
