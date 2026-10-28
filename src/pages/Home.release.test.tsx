// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Home } from './Home';
import { renderWithStore } from '@/test/test-utils';
import { NOTES_VERSIONS, type NoteVersion } from '@/data/versions';
import { APP_LABEL, APP_VERSION } from '@/version';

/**
 * **La dernière release sur l'accueil** (#274).
 *
 * Décision du grilling du 27/10/2026 : l'accueil montre **la dernière release seule**, avec sa
 * date, et un lien « voir toutes les versions » vers `/feuille-de-route`. Pas de liste : c'est
 * un écran de jeu, pas un journal. Rien n'est recopié — le libellé est `APP_LABEL`, la note
 * vient de `src/data/versions.ts` (`src/version.test.ts` refuse un numéro en dur).
 */
describe('Home — la dernière release (#274)', () => {
  it('affiche le libellé de la version, lu à la source', () => {
    renderWithStore(<Home />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(APP_LABEL)).toBeInTheDocument();
  });

  it('affiche la dernière release publiée, avec sa date, et mène à la feuille de route', () => {
    renderWithStore(<Home />, { tutorielVu: true, pasAPasCombatVu: true });

    const publiee = NOTES_VERSIONS.find((note) => !note.brouillon && note.version === APP_VERSION);
    // La note de la version courante est exigée par `versions.test.ts` : elle est là.
    expect(publiee).toBeTruthy();
    expect(screen.getByText(new RegExp(publiee!.titre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();

    const lien = screen.getByRole('link', { name: /Voir toutes les versions/i });
    expect(lien).toHaveAttribute('href', '/feuille-de-route');
  });

  it('le contrôle mord : une release brouillon ne s’annonce pas comme la dernière', () => {
    const notes: NoteVersion[] = [
      {
        version: '9.9.9',
        date: '2026-12-01',
        titre: 'Brouillon pas encore sorti',
        points: [],
        brouillon: true
      },
      { version: APP_VERSION, date: '2026-10-20', titre: 'La release publiée', points: [] }
    ];
    renderWithStore(<Home notes={notes} />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.queryByText(/Brouillon pas encore sorti/)).toBeNull();
    expect(screen.getByText(/La release publiée/)).toBeInTheDocument();
  });

  it('le contrôle mord : un libellé figé ne peut pas suivre `APP_LABEL`', () => {
    // Le libellé affiché est celui de `package.json`, pas un littéral : le retirer doit vider
    // la page de ce texte. Ce test échouerait si l'accueil écrivait « Alpha · 0.x.y » à la main.
    renderWithStore(<Home notes={[{ version: APP_VERSION, date: '2026-10-20', titre: 'Notes', points: [] }]} />, {
      tutorielVu: true,
      pasAPasCombatVu: true
    });
    expect(screen.getByText(APP_LABEL)).toBeInTheDocument();
    expect(APP_LABEL).toContain(APP_VERSION);
  });
});
