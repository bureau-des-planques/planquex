// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PisteInterventions } from './PisteInterventions';

/**
 * La piste d'Interventions (D-093, #190) : le score n'est plus `★★☆` (qui se confond avec la
 * rareté, `1S`/`2S`/`3S`) mais six hexagones, trois par camp. Un lecteur d'écran lit chacun
 * d'eux (« Intervention 2 sur 3, La Direction »), et la piste n'a qu'un seul point de
 * désignation du pas-à-pas.
 */
const camps = [
  { label: 'Toi', points: 2 },
  { label: 'La Direction', points: 1 }
];

describe('PisteInterventions — six hexagones, trois par camp', () => {
  it('rend six hexagones, trois dans le groupe de chaque camp, chacun nommé', () => {
    render(<PisteInterventions camps={camps} />);

    const hexagones = screen.getAllByRole('img', { name: /^Intervention \d sur 3, / });
    expect(hexagones).toHaveLength(6);

    for (const { label } of camps) {
      const groupe = screen.getByRole('group', { name: label });
      expect(within(groupe).getAllByRole('img')).toHaveLength(3);
    }
    expect(screen.getByRole('img', { name: 'Intervention 2 sur 3, La Direction, à venir' })).toBeInTheDocument();
  });

  it('remplit les hexagones dans l’ordre : les premières Interventions sont acquises', () => {
    render(<PisteInterventions camps={camps} />);

    const toi = within(screen.getByRole('group', { name: 'Toi' })).getAllByRole('img');
    const direction = within(screen.getByRole('group', { name: 'La Direction' })).getAllByRole('img');

    expect(toi.map((hex) => hex.classList.contains('is-acquise'))).toEqual([true, true, false]);
    expect(direction.map((hex) => hex.classList.contains('is-acquise'))).toEqual([true, false, false]);
    // L'état se dit aussi au lecteur d'écran, pas seulement par le remplissage (4.1.2).
    expect(toi.map((hex) => hex.getAttribute('aria-label')?.split(', ').at(-1))).toEqual([
      'acquise',
      'acquise',
      'à venir'
    ]);
  });

  it('porte le point de désignation du pas-à-pas sur son conteneur seul', () => {
    const { container } = render(<PisteInterventions camps={camps} designe="interventions" />);

    const designes = container.querySelectorAll('[data-pas-a-pas="interventions"]');
    expect(designes).toHaveLength(1);
    expect(designes[0]).toHaveAttribute('role', 'group');
  });
});

describe('la fin du combat s’allume (30/10/2026)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('le camp vainqueur porte `is-finale` sur ses trois hexagones, l’autre non', () => {
    render(
      <PisteInterventions
        camps={[
          { label: 'Toi', points: 3, finale: true },
          { label: 'La Direction', points: 1 }
        ]}
      />
    );
    const toi = screen.getByRole('group', { name: 'Toi' });
    const direction = screen.getByRole('group', { name: 'La Direction' });
    // **Le contrôle mord** : sans la classe, la fin ne se voit pas.
    for (const hex of within(toi).getAllByRole('img')) expect(hex).toHaveClass('is-finale');
    for (const hex of within(direction).getAllByRole('img')) expect(hex).not.toHaveClass('is-finale');
  });

  it('s’allume en séquence, et ne bouge pas sous mouvement réduit', () => {
    expect(css).toMatch(/\.piste__hex\.is-finale \{[^}]*animation: piste-finale/);
    // Trois départs décalés : la séquence, pas trois hexagones qui clignotent ensemble.
    expect(css).toMatch(/is-finale:nth-of-type\(3\) \{[^}]*animation-delay: 180ms/);
    expect(css).toMatch(/is-finale:nth-of-type\(4\) \{[^}]*animation-delay: 360ms/);
    // Sous mouvement réduit, c'est le remplissage qui parle.
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]{0,200}\.piste__hex\.is-finale \{\s*animation: none;/);
  });
});
