// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '@/App';
import { REDIRECTIONS } from '@/redirections';
import { setupTestStore } from '@/test/test-utils';

/**
 * Les anciennes adresses (`/parc`, `/chariot`) redirigent vers les nouvelles (D-075, #168).
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

  it('les nouvelles adresses ne bougent pas', () => {
    visite('/deck');
    expect(screen.getByTestId('adresse')).toHaveTextContent('/deck');
  });
});
