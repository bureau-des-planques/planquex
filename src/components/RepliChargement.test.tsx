// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RepliChargement } from '@/components/RepliChargement';

/**
 * Le repli de chargement (#478).
 *
 * Deux propriétés, celles que le ticket exige : il est **annoncé** au lecteur d'écran, et il
 * occupe la boîte d'une page (`.page`, hauteur réservée par `styles.css`) pour ne pas faire
 * sauter la mise en page. La troisième — il ne s'affiche pas sur l'Accueil — se garde dans
 * `src/App.test.tsx` (l'Accueil n'est pas paresseux).
 */
describe('le repli de chargement d’un écran (#478)', () => {
  it('est annoncé au lecteur d’écran, et dit ce qui se passe', () => {
    render(<RepliChargement />);
    const statut = screen.getByRole('status');
    expect(statut).toHaveTextContent('Chargement de l’écran…');
  });

  it('tient dans la boîte d’une page, et ne porte qu’un texte', () => {
    const { container } = render(<RepliChargement />);
    const repli = container.querySelector('.repli-chargement');
    expect(repli, 'le repli porte la classe qui réserve sa hauteur (styles.css)').toHaveClass('page');
    expect(repli?.querySelectorAll('button, a')).toHaveLength(0);
  });
});
