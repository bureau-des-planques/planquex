// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '@/App';
import { setupTestStore } from '@/test/test-utils';

/**
 * La garde des sorties (#426, inventaire `docs/preuves/sorties-2026-10-28/README.md`).
 *
 * Deux propriétés, sur les routes **réelles** de `App` :
 *
 * 1. **Toute route a une voie de retour** : un lien vers `/` (l'Accueil) dans la page
 *    rendue — la barre du bas, le lien `←` du combat, ou un « Retour au bureau ».
 * 2. **Toute route est atteignable depuis `/`** en suivant les liens rendus, sauf les
 *    exceptions **nommées** (`EXCEPTIONS`). Une exception qui redevient atteignable échoue
 *    aussi : la liste ne s'élargit pas en silence (cliquet).
 *
 * La liste des routes est **confrontée à `src/App.tsx`** : une route ajoutée sans être
 * déclarée ici fait échouer le test, au lieu de passer sous le radar.
 *
 * **Le contrôle mord** : les fonctions pures (`cheminsSansRetour`, `cheminsInatteignables`)
 * sont confrontées à un graphe fabriqué où une route n'a pas de retour et une autre n'est
 * liée par personne — elles doivent les signaler.
 */

/** Les routes d'écran, telles que `App.tsx` les déclare (sans `/` ni `*`). */
const ROUTES_ECRAN = [
  '/connexion',
  '/confidentialite',
  '/feuille-de-route',
  '/installation',
  '/collection',
  '/deck',
  '/battle',
  '/comite',
  '/comite/suivi',
  '/settings',
  '/attente',
  '/administration'
];

/**
 * Les routes que rien dans l'application ne relie à l'accueil, **en build sans base**
 * (le build par défaut, sans `VITE_SUPABASE_*`), avec leur raison. Chacune est un
 * cul-de-sac **constaté**, pas corrigé ici : #427 et #428 le traitent.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  '/connexion': 'sans base, GardeComptes ne renvoie vers la connexion que si le compte est configuré',
  '/attente': 'lien seulement depuis la bandeau de compte en attente (compte configuré)',
  '/administration': 'lien seulement depuis Réglages, pour un compte administrateur (compte configuré)',
  '/installation': 'aucun lien interne : la note de release la désigne hors de l’application'
};

/** Un chemin sans la requête ni l'ancre, ou `null` si ce n'est pas une adresse interne. */
function cheminInterne(href: string): string | null {
  if (!href.startsWith('/') || href.startsWith('//')) return null;
  return href.split(/[?#]/)[0] || '/';
}

/**
 * Les routes sans voie de retour : celles dont la page ne lie pas `/`.
 * `graphe` : chemin → chemins liés depuis cette page.
 */
export function cheminsSansRetour(graphe: Readonly<Record<string, readonly string[]>>): string[] {
  return Object.keys(graphe)
    .filter((chemin) => chemin !== '/' && !graphe[chemin].includes('/'))
    .sort();
}

/**
 * Les routes inatteignables depuis `racine` en suivant `graphe`, hors `exceptions`
 * (qui doivent elles-mêmes être inatteignables : sinon elles sont périmées).
 */
export function cheminsInatteignables(
  graphe: Readonly<Record<string, readonly string[]>>,
  racine: string,
  exceptions: Readonly<Record<string, string>>
): { inatteignables: string[]; exceptionsPerimees: string[] } {
  const vus = new Set<string>([racine]);
  const file = [racine];
  while (file.length > 0) {
    const chemin = file.shift() as string;
    for (const lie of graphe[chemin] ?? []) {
      if (!vus.has(lie)) {
        vus.add(lie);
        file.push(lie);
      }
    }
  }
  const inatteignables = Object.keys(graphe)
    .filter((chemin) => !vus.has(chemin) && !(chemin in exceptions))
    .sort();
  const exceptionsPerimees = Object.keys(exceptions)
    .filter((chemin) => vus.has(chemin))
    .sort();
  return { inatteignables, exceptionsPerimees };
}

/** Les adresses internes liées par la page actuellement rendue. */
function liensRendus(conteneur: HTMLElement): string[] {
  const liens = new Set<string>();
  for (const a of Array.from(conteneur.querySelectorAll('a[href]'))) {
    const chemin = cheminInterne(a.getAttribute('href') ?? '');
    if (chemin !== null) liens.add(chemin);
  }
  return [...liens];
}

describe('la garde des sorties (#426) — le contrôle mord', () => {
  it('une route sans lien vers l’accueil est signalée', () => {
    const graphe = { '/': ['/collection'], '/collection': ['/', '/deck'], '/fabriquee': ['/deck'] };
    expect(cheminsSansRetour(graphe)).toEqual(['/fabriquee']);
  });

  it('une route que personne ne lie est signalée comme inatteignable', () => {
    const graphe = { '/': ['/collection'], '/collection': ['/'], '/orpheline': ['/'] };
    expect(cheminsInatteignables(graphe, '/', {}).inatteignables).toEqual(['/orpheline']);
  });

  it('une exception qui devient atteignable est signalée comme périmée', () => {
    const graphe = { '/': ['/collection'], '/collection': ['/', '/connexion'], '/connexion': ['/'] };
    const { exceptionsPerimees } = cheminsInatteignables(graphe, '/', { '/connexion': 'test' });
    expect(exceptionsPerimees).toEqual(['/connexion']);
  });

  it('un graphe sain ne signale rien', () => {
    const graphe = { '/': ['/collection'], '/collection': ['/'] };
    expect(cheminsSansRetour(graphe)).toEqual([]);
    expect(cheminsInatteignables(graphe, '/', {})).toEqual({ inatteignables: [], exceptionsPerimees: [] });
  });
});

describe('App — chaque écran a une voie de retour et une entrée depuis l’accueil', () => {
  afterEach(cleanup);

  it('les routes déclarées ici sont exactement celles de src/App.tsx', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
    const declarees = [...source.matchAll(/<Route path="([^"*]+)"/g)].map((m) => `/${m[1]}`).sort();
    expect(declarees).toEqual([...ROUTES_ECRAN].sort());
  });

  it('le graphe rendu : aucune route sans retour, aucune route inatteignable hors exceptions', () => {
    // Le graphe se construit en **rendant** chaque page réelle, à partir de l'accueil.
    const graphe: Record<string, string[]> = {};
    const file = ['/'];
    const vus = new Set<string>(file);
    while (file.length > 0) {
      const chemin = file.shift() as string;
      setupTestStore({ deck: [], tutorielVu: true, pasAPasCombatVu: true });
      const { container, unmount } = render(
        <MemoryRouter initialEntries={[chemin]}>
          <App />
        </MemoryRouter>
      );
      const liens = liensRendus(container);
      graphe[chemin] = liens;
      unmount();
      cleanup();
      for (const lie of liens) {
        if (!vus.has(lie) && [...ROUTES_ECRAN, '/'].includes(lie)) {
          vus.add(lie);
          file.push(lie);
        }
      }
    }
    // Les routes déclarées qui n'ont pas été rendues (inatteignables) n'ont pas de nœud :
    // on les ajoute au graphe, sans liens, pour que la fonction pure les voie.
    for (const route of ROUTES_ECRAN) {
      if (!(route in graphe)) graphe[route] = [];
    }

    // Les inatteignables : on les rend séparément pour leur voie de retour, pas pour leurs liens.
    expect(cheminsInatteignables(graphe, '/', EXCEPTIONS)).toEqual({
      inatteignables: [],
      exceptionsPerimees: []
    });
    expect(Object.keys(EXCEPTIONS).sort()).toEqual(ROUTES_ECRAN.filter((route) => !vus.has(route)).sort());
  }, 120_000);
});
