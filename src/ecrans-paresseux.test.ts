// Projet `node` : ce fichier lit des sources, il ne rend rien (#478)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **Quels écrans sont dans le paquet principal** (#478).
 *
 * Le ticket tient deux promesses qui se lisent dans `src/App.tsx`, et qui ne se voient ni à
 * l'écran ni dans un test de rendu : un écran qu'on n'a pas ouvert **n'est pas téléchargé**
 * (`lazy`), et l'Accueil **n'attend aucun morceau** (import en dur), pas plus que l'adresse
 * inconnue. Un `import { Collection } from '@/pages/Collection'` remis un jour par distraction
 * les défait en silence : c'est ce que ce contrôle refuse.
 *
 * **Le contrôle mord** : les deux fonctions sont confrontées à une source fabriquée qui porte
 * un import en dur et un import paresseux, et qui doit distinguer les deux.
 *
 * La garde de taille (`npm run mesure:paquets`, #480) tient le même fait par la mesure : un
 * écran réimporté en dur fait grossir le paquet principal au-delà du cliquet.
 */

/** Les écrans importés **en dur** par `src/App.tsx` : ils vivent dans le paquet principal. */
export function ecransEnDur(source: string): string[] {
  return [...source.matchAll(/^import \{ \w+ \} from '@\/pages\/(\w+)';$/gm)].map((m) => m[1]).sort();
}

/** Les écrans chargés **à la demande** par `src/App.tsx` (`lazy(() => import(...))`). */
export function ecransParesseux(source: string): string[] {
  return [...source.matchAll(/lazy\(\(\) => import\('@\/pages\/(\w+)'\)/g)].map((m) => m[1]).sort();
}

/**
 * Les modules de `src/pages/` qui ne sont **pas des écrans** : ils ne se routent pas, donc
 * `src/App.tsx` ne les importe pas. `Installation` est la source des faits du guide
 * (`ADRESSE`, `PROCEDURES`), importée par `InstallationBanc` (#508) ; le test suivant garde
 * ce fait, pour que l'exclusion ne puisse pas avaler un écran par distraction.
 */
const MODULES_DE_FAITS = new Set(['Installation']);

describe('les écrans se chargent à la demande (#478)', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');

  it('le contrôle mord : il distingue un import en dur d’un import paresseux', () => {
    const fabrique =
      "import { Collection } from '@/pages/Collection';\n" +
      "const Deck = lazy(() => import('@/pages/Deck').then((m) => ({ default: m.Deck })));";
    expect(ecransEnDur(fabrique)).toEqual(['Collection']);
    expect(ecransParesseux(fabrique)).toEqual(['Deck']);
  });

  it('l’Accueil et l’adresse inconnue restent en dur : la porte d’entrée n’attend aucun morceau', () => {
    expect(ecransEnDur(source)).toEqual(['Home', 'Introuvable']);
  });

  it('tous les autres écrans de `src/pages/` sont chargés à la demande', () => {
    const pages = readdirSync(join(process.cwd(), 'src', 'pages'))
      .filter((fichier) => fichier.endsWith('.tsx') && !fichier.endsWith('.test.tsx'))
      .filter((fichier) => !MODULES_DE_FAITS.has(fichier.replace(/\.tsx$/, '')))
      .map((fichier) => fichier.replace(/\.tsx$/, ''))
      .sort();
    expect([...ecransEnDur(source), ...ecransParesseux(source)].sort()).toEqual(pages);
  });

  it('un module de faits reste hors du routeur, et garde ses faits', () => {
    const installation = readFileSync(join(process.cwd(), 'src', 'pages', 'Installation.tsx'), 'utf8');
    const banc = readFileSync(join(process.cwd(), 'src', 'pages', 'InstallationBanc.tsx'), 'utf8');
    // `Installation.tsx` n'est plus un écran (#508) : c'est la source de `ADRESSE` et
    // `PROCEDURES`, que le banc importe. Si l'import disparaît, l'exclusion ci-dessus
    // avalerait un vrai écran.
    expect(installation).toContain('export const ADRESSE');
    expect(installation).toContain('export const PROCEDURES');
    expect(banc).toMatch(/import \{ ADRESSE, PROCEDURES \} from '@\/pages\/Installation';/);
  });
});
