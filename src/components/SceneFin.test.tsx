// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SceneFin } from './SceneFin';

/**
 * **La scène de fin** (30/10/2026) : le verdict se voit avant de se lire, et il ne piège
 * personne — un clic n'importe où la referme.
 */
describe('SceneFin — le verdict posé', () => {
  it('pose le tampon du gagnant, la raison et la phrase de la Direction', () => {
    render(<SceneFin gagne replique="Ce n’était pas un test. C’était un entretien." onFermer={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Tu gagnes' })).toBeInTheDocument();
    expect(screen.getByText('3 INTERVENTIONS')).toBeInTheDocument();
    // « La Direction » apparaît deux fois (la raison, puis la phrase) : on vise la phrase.
    expect(screen.getByText(/C’était un entretien/)).toHaveTextContent('La Direction');
  });

  it('un clic n’importe où la referme', () => {
    const fermer = vi.fn();
    const { unmount } = render(<SceneFin gagne replique={null} onFermer={fermer} />);

    fireEvent.click(screen.getByText('3 INTERVENTIONS'));
    expect(fermer).toHaveBeenCalledTimes(1);
    // **Le contrôle mord** : la scène disparaît du DOM, elle ne reste pas invisible.
    expect(screen.queryByTestId('scene-fin')).toBeNull();
    unmount();
  });

  it('le bouton « Continuer » aussi, et une seule fois', () => {
    const fermer = vi.fn();
    render(<SceneFin gagne replique={null} onFermer={fermer} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(fermer).toHaveBeenCalledTimes(1);
  });

  it('sous mouvement réduit, la scène est déjà posée', () => {
    render(<SceneFin gagne={false} replique={null} calme onFermer={() => {}} />);
    expect(screen.getByTestId('scene-fin')).toHaveClass('scene-fin--calme');
    expect(screen.getByText('DÉFAITE')).toHaveClass('is-perdu');
  });
});
