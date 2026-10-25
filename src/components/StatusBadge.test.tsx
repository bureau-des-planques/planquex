// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

/**
 * **La densité du combat** (#189, `SPEC-COMBAT-UI` §4.3) : le nom d'une Condition est une
 * annotation. En `sobre`, le badge garde son **icône** (elle distingue les conditions autrement
 * que par la couleur, SC 1.4.1) et le libellé reste lu par un lecteur d'écran ; en `détaillé`,
 * le nom revient.
 */
describe('StatusBadge — le nom est une annotation (#189)', () => {
  it('affiche le nom par défaut, et le garde lisible sans le montrer en `sobre`', () => {
    const avecNom = render(<StatusBadge status="SURCHARGE" />);
    expect(avecNom.container.querySelector('.status-chip__nom')).toHaveTextContent('Surcharge');
    avecNom.unmount();

    const sobre = render(<StatusBadge status="SURCHARGE" nomAffiche={false} />);
    // Aucun nom **visible** : c'est l'annotation que `sobre` coupe.
    expect(sobre.container.querySelector('.status-chip__nom')).toBeNull();
    // Mais il reste lu : le badge ne devient pas une couleur seule.
    expect(screen.getByText('Surcharge')).toHaveClass('sr-only');
    expect(sobre.container.querySelector('svg')).not.toBeNull();
  });
});
