// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '@/App';
import { REDIRECTIONS, REDIRECTIONS_PUBLIQUES } from '@/redirections';
import { setupTestStore } from '@/test/test-utils';

/**
 * Les anciennes adresses (`/parc`, `/chariot`, `/idees`, `/nouveautes`) redirigent vers les
 * nouvelles (D-075, #168 ; D-097, #210).
 *
 * Deux endroits les portent, et chacun a son garde :
 * - **`vercel.json`** — une visite directe sur l'ancienne adresse reçoit un `308`. Le
 *   fichier est lu comme du texte JSON (aucune dépendance) ;
 * - **le routeur** — la visite dans l'application, ou l'application installée dont le
 *   service worker répond sans passer par l'hébergeur. On rend `App` à l'ancienne adresse.
 *
 * Chaque test confronte la règle à un cas fautif : sans la redirection, il échoue
 * (`AGENTS.md` §6, #112). Les tests « le contrôle mord » le montrent sur une config
 * fabriquée, pas sur le seul fichier — qui est sain aujourd'hui.
 */
const VERCEL_PATH = join(process.cwd(), 'vercel.json');

type Redirect = { source: string; destination: string; permanent?: boolean; statusCode?: number };

/** Les redirections d'une config Vercel, ramenées à `source → destination` permanentes. */
function redirectionsPermanentes(config: { redirects?: Redirect[] }): Record<string, string> {
  const trouvees: Record<string, string> = {};
  for (const redirect of config.redirects ?? []) {
    // `permanent` vaut `true` par défaut (308) ; `statusCode` 308/301 le sont aussi.
    const permanente = redirect.statusCode === undefined ? redirect.permanent !== false : [301, 308].includes(redirect.statusCode);
    if (permanente) trouvees[redirect.source] = redirect.destination;
  }
  return trouvees;
}

describe('vercel.json — les anciennes adresses redirigent', () => {
  const config = JSON.parse(readFileSync(VERCEL_PATH, 'utf8')) as { redirects?: Redirect[]; rewrites?: unknown[] };

  it('porte exactement les redirections de src/redirections.ts, en permanent', () => {
    expect(redirectionsPermanentes(config)).toEqual(REDIRECTIONS);
  });

  it('garde le repli SPA, que les redirections ne remplacent pas', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });

  it('couvre /parc → /collection et /chariot → /deck', () => {
    expect(redirectionsPermanentes(config)).toMatchObject({ '/parc': '/collection', '/chariot': '/deck' });
  });

  it('couvre /idees → /comite et /nouveautes → /feuille-de-route (D-097)', () => {
    expect(redirectionsPermanentes(config)).toMatchObject({
      '/idees': '/comite',
      '/nouveautes': '/feuille-de-route'
    });
  });

  it('le contrôle mord : une config sans la redirection est refusée', () => {
    const sansChariot = { redirects: [{ source: '/parc', destination: '/collection', permanent: true }] };
    expect(redirectionsPermanentes(sansChariot)).not.toEqual(REDIRECTIONS);
    // Une redirection temporaire (307) ne compte pas : un lien partagé doit être corrigé pour de bon.
    const temporaire = { redirects: [{ source: '/parc', destination: '/collection', permanent: false }] };
    expect(redirectionsPermanentes(temporaire)).toEqual({});
  });
});

/** Rend l'adresse courante pour que le test la lise (un `MemoryRouter` n'a pas de barre d'adresse). */
function Adresse() {
  return <output data-testid="adresse">{useLocation().pathname}</output>;
}

function visite(adresse: string) {
  setupTestStore({ deck: [], tutorielVu: true, pasAPasCombatVu: true });
  render(
    <MemoryRouter initialEntries={[adresse]}>
      <App />
      <Adresse />
    </MemoryRouter>
  );
}

describe('App — les anciennes adresses mènent aux nouvelles', () => {
  afterEach(cleanup);

  it('/parc arrive sur /collection', () => {
    visite('/parc');
    expect(screen.getByTestId('adresse')).toHaveTextContent('/collection');
  });

  it('/chariot arrive sur /deck, et l’écran du Deck s’affiche', () => {
    visite('/chariot');
    expect(screen.getByTestId('adresse')).toHaveTextContent('/deck');
    expect(screen.getByRole('button', { name: /Remplir/i })).toBeInTheDocument();
  });

  it('/idees arrive sur /comite, et le mur du comité s’affiche (D-097)', () => {
    visite('/idees');
    expect(screen.getByTestId('adresse')).toHaveTextContent('/comite');
    expect(screen.getByRole('heading', { level: 1, name: /comité/i })).toBeInTheDocument();
  });

  it('/nouveautes arrive sur /feuille-de-route (D-097)', () => {
    visite('/nouveautes');
    expect(screen.getByTestId('adresse')).toHaveTextContent('/feuille-de-route');
    expect(screen.getByRole('heading', { level: 1, name: /feuille de route/i })).toBeInTheDocument();
  });

  it('les nouvelles adresses ne bougent pas', () => {
    visite('/deck');
    expect(screen.getByTestId('adresse')).toHaveTextContent('/deck');
  });

  /**
   * `/feuille-de-route` se lit **sans compte** (D-090, D-097 (3)) : sa redirection doit donc
   * vivre **hors de la garde**, sinon un visiteur suivant un ancien lien atterrit sur
   * `/connexion` au lieu de la page qu'il demandait. Le contrôle mord : déplacer
   * `routesDeRedirection(true)` dans le `Layout` fait tomber l'ordre ci-dessous.
   */
  it('redirige /nouveautes hors de la garde des comptes', () => {
    expect(REDIRECTIONS_PUBLIQUES).toContain('/nouveautes');
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    const publiques = app.indexOf('{routesDeRedirection(true)}');
    const garde = app.indexOf('<Route element={<Layout />}>');
    expect(publiques, 'aucune redirection publique dans src/App.tsx').toBeGreaterThanOrEqual(0);
    expect(garde, 'la garde `<Route element={<Layout />}>` a disparu').toBeGreaterThanOrEqual(0);
    // Avant la garde = hors de `Layout`, donc hors de `GardeComptes`.
    expect(publiques).toBeLessThan(garde);
  });
});
