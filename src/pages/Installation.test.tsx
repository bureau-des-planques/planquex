import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ADRESSE, Installation, PROCEDURES, VERIFIE_LE } from '@/pages/Installation';

/**
 * **Le guide d'installation et de compatibilité** (#300) — `/installation`.
 *
 * La release y renvoie (#300), et un testeur doit pouvoir le lire **avant** de créer un
 * compte : la page est donc **hors de la garde**, comme `/feuille-de-route`.
 *
 * Ce test garde quatre choses, et chacune peut échouer :
 *
 * 1. **la page se rend sans compte, sans base, sans configuration** — elle ne lit ni le
 *    store ni le mur ;
 * 2. **une procédure numérotée par appareil retenu**, avec ses étapes : une liste à puces
 *    ne dit pas dans quel ordre toucher ;
 * 3. **les deux faits que `docs/ALPHA-TESTEURS.md` porte déjà** — ce qui est gardé sur
 *    l'appareil, et la sauvegarde par Réglages (« Créer ma sauvegarde » / « Restaurer ce
 *    texte ») : une page qui les contredirait serait pire que pas de page ;
 * 4. **la route vit hors de la garde** dans `src/App.tsx`, et **le contrôle mord** : une
 *    route déplacée dans le `Layout` est refusée par la même fonction.
 *
 * L'adresse, elle, est comparée à `docs/ALPHA-TESTEURS.md` : elle a déjà bougé trois fois
 * (D-055, D-064, D-071), et deux adresses divergentes enverraient le testeur ailleurs.
 */
const rendre = () =>
  render(
    <MemoryRouter>
      <Installation />
    </MemoryRouter>
  );

afterEach(cleanup);

describe('Installation — le guide public (#300)', () => {
  it('se rend sans compte, sans base et sans configuration', () => {
    rendre();
    expect(screen.getByRole('heading', { level: 1, name: /installer le jeu/i })).toBeTruthy();
    expect(screen.getByText(ADRESSE)).toBeTruthy();
  });

  it('donne une procédure numérotée pour chaque appareil retenu', () => {
    rendre();

    for (const procedure of PROCEDURES) {
      expect(screen.getByRole('heading', { level: 2, name: procedure.titre })).toBeTruthy();
      for (const etape of procedure.etapes) {
        expect(screen.getByText(etape), `${procedure.titre} : ${etape}`).toBeTruthy();
      }
      // Une **liste ordonnée** nommée par son appareil : l'ordre des gestes compte.
      const liste = screen.getByRole('list', { name: procedure.titre });
      expect(liste.tagName).toBe('OL');
      expect(liste.querySelectorAll('li').length).toBe(procedure.etapes.length);
    }
  });

  it('dit ce qui est gardé sur l’appareil, et que le compte ne suit pas les données locales', () => {
    rendre();
    // Les quatre choses locales nommées par `docs/ALPHA-TESTEURS.md` : Collection, Deck,
    // pseudo, partie en cours.
    for (const quoi of [/collection/i, /\bdeck\b/i, /pseudo/i, /partie en cours/i]) {
      expect(screen.getAllByText(quoi).length, String(quoi)).toBeGreaterThan(0);
    }
    expect(screen.getByText(/ton compte te suit/i)).toBeTruthy();
  });

  it('envoie vers la sauvegarde de Réglages, avec ses deux libellés exacts', () => {
    rendre();
    expect(screen.getByText(/Réglages/)).toBeTruthy();
    expect(screen.getByText(/Créer ma sauvegarde/)).toBeTruthy();
    expect(screen.getByText(/Restaurer ce texte/)).toBeTruthy();
  });

  it('ne promet pas l’installation sur un navigateur non retenu', () => {
    const { container } = rendre();
    // Firefox est nommé, et **seulement** comme « non testé » : on ne lui invente pas une
    // procédure. Le tableau des navigateurs est une liste, pas trois promesses.
    expect(container.textContent ?? '').toMatch(/firefox/i);
    expect(container.textContent ?? '').toMatch(/pas testé|non testé/i);
  });

  it('porte sa date de vérification, et des liens internes seulement', () => {
    const { container } = rendre();
    expect(VERIFIE_LE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(container.textContent ?? '').toMatch(/vérifiée le/i);
    for (const lien of [...container.querySelectorAll('a')]) {
      const href = lien.getAttribute('href') ?? '';
      expect(href.startsWith('/'), `${href} n’est pas interne`).toBe(true);
    }
  });

  it('garde l’adresse en accord avec docs/ALPHA-TESTEURS.md', () => {
    const doc = readFileSync(join(process.cwd(), 'docs/ALPHA-TESTEURS.md'), 'utf8');
    const trouvee = doc.match(/Adresse\*\*?\s*:\s*https?:\/\/([^/\s]+)/i);
    expect(trouvee, 'adresse introuvable dans docs/ALPHA-TESTEURS.md').not.toBeNull();
    expect(ADRESSE).toBe(trouvee![1]);
  });

  it('est déclarée hors de la garde des comptes, dans App.tsx', () => {
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    expect(
      horsGarde(app, 'installation'),
      'la route /installation doit précéder la garde `<Route element={<Layout />}>`'
    ).toBe(true);
  });

  it('le contrôle mord : une route déplacée dans la garde est refusée', () => {
    // La même fonction, sur une source fautive : la route est **après** la garde, donc elle
    // demanderait un compte. Si `horsGarde` répondait toujours vrai, l'assertion ci-dessus
    // ne garderait rien — c'est la classe de faux garde-fou de `AGENTS.md` §6.
    const fautif = `
      <Route element={<Layout />}>
        <Route path="installation" element={<Installation />} />
      </Route>`;
    expect(horsGarde(fautif, 'installation')).toBe(false);
    expect(horsGarde('<Route path="installation" element={<Installation />} />', 'installation')).toBe(false);
  });
});

/**
 * La route `chemin` est-elle déclarée **avant** la garde `<Route element={<Layout />}>` ?
 *
 * Avant, c'est hors de `Layout`, donc hors de `GardeComptes` : la page se lit sans compte.
 * Après, c'est une page du jeu, et un visiteur sans session est renvoyé à `/connexion`.
 */
function horsGarde(source: string, chemin: string): boolean {
  const position = source.indexOf(`<Route path="${chemin}"`);
  const garde = source.indexOf('<Route element={<Layout />}>');
  return position >= 0 && garde >= 0 && position < garde;
}
