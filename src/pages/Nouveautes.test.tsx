// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { APP_LABEL, APP_VERSION } from '@/version';
import { NOTES_VERSIONS } from '@/data/versions';
import { Nouveautes } from '@/pages/Nouveautes';

/**
 * La page des nouveautés est **publique** : un testeur doit pouvoir lire ce qu'une
 * version apporte **avant** de s'inscrire (`docs/VERSIONS.md`).
 *
 * Ce test garde quatre choses, et chacune peut échouer :
 *
 * 1. la version courante est **celle de `package.json`**, lue par `APP_LABEL` — jamais
 *    un numéro recopié dans la page ;
 * 2. l'**historique** est là, une entrée par version publiée ;
 * 3. une note **écrite d'avance** pour une version à venir ne s'affiche pas ;
 * 4. la route vit **hors de `Layout`** dans `src/App.tsx` — c'est ce qui la rend lisible
 *    sans compte, et une route déplacée dans la garde ferait tomber ce point sans qu'on
 *    le voie à l'écran.
 */
const publiees = NOTES_VERSIONS.filter((note) => !note.brouillon);

const rendre = () =>
  render(
    <MemoryRouter>
      <Nouveautes />
    </MemoryRouter>
  );

describe('Nouveautés — la page publique', () => {
  it('met en avant la version courante, lue par APP_LABEL', () => {
    rendre();
    expect(screen.getByRole('heading', { level: 1, name: /nouveautés/i })).toBeTruthy();
    // Le libellé complet (« Alpha · 0.1.6 ») : c'est celui que Réglages affiche aussi.
    expect(screen.getByText(APP_LABEL)).toBeTruthy();
    // La note de cette version-là, et pas celle d'une autre — publiée ou écrite d'avance,
    // c'est la même chose pour qui a la version sous les yeux.
    const courante = NOTES_VERSIONS.find((note) => note.version === APP_VERSION);
    expect(courante, `aucune note pour ${APP_VERSION}`).toBeDefined();
    expect(screen.getByRole('heading', { name: courante!.titre })).toBeTruthy();
    expect(screen.getByText(courante!.points[0].texte)).toBeTruthy();
  });

  it('donne l’historique, une entrée par version publiée', () => {
    rendre();
    for (const note of publiees) {
      expect(screen.getByText(note.points[0].texte), `points de ${note.version}`).toBeTruthy();
    }
  });

  it('n’affiche pas, dans l’historique, une note écrite d’avance', () => {
    const avance = NOTES_VERSIONS.filter(
      (note) => note.brouillon && note.version !== APP_VERSION
    );
    if (avance.length === 0) return;
    rendre();
    for (const note of avance) {
      expect(screen.queryByText(note.titre), `note à venir ${note.version}`).toBeNull();
    }
  });

  it('est déclarée hors de la garde des comptes, dans App.tsx', () => {
    // `import.meta.url` est une URL `http:` sous jsdom : on lit par le disque, comme les
    // autres tests d'écran qui inspectent une source (`CardSlot.test.tsx`).
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    const route = app.indexOf('<Route path="feuille-de-route"');
    const garde = app.indexOf('<Route element={<Layout />}>');
    expect(route, 'route /feuille-de-route introuvable dans src/App.tsx').toBeGreaterThanOrEqual(0);
    expect(garde, 'la garde `<Route element={<Layout />}>` a disparu').toBeGreaterThanOrEqual(0);
    // Avant la garde = hors de `Layout`, donc hors de `GardeComptes` : lisible sans compte.
    expect(route).toBeLessThan(garde);
  });
});
