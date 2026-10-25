// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ALL_CARDS } from '@/data';
import { CardSlot } from './CardSlot';

const carte = ALL_CARDS[0];
const quick = { icon: <i />, label: 'Ajouter', title: 'Ajouter', onClick: () => undefined };

/** Le corps de la **première** règle CSS dont le sélecteur est exactement `selecteur`. */
function regle(css: string, selecteur: string): string {
  const debut = css.indexOf(`${selecteur} {`);
  expect(debut, `la règle « ${selecteur} » existe dans styles.css`).toBeGreaterThanOrEqual(0);
  return css.slice(css.indexOf('{', debut) + 1, css.indexOf('}', debut));
}

describe('CardSlot — la possession se lit (#179)', () => {
  it('à zéro : classe d’atténuation, « ×0 » et « Non possédée »', () => {
    const { container } = render(<CardSlot card={carte} owned={0} quick={quick} onClick={() => undefined} />);
    expect(container.firstElementChild).toHaveClass('is-missing');
    expect(screen.getByText('×0')).toHaveClass('is-missing');
    expect(screen.getByText('Non possédée')).toBeInTheDocument();
  });

  it('à un ou plus : pas d’atténuation, le nombre d’exemplaires', () => {
    const { container } = render(<CardSlot card={carte} owned={3} quick={quick} onClick={() => undefined} />);
    expect(container.firstElementChild).not.toHaveClass('is-missing');
    expect(screen.getByText('×3')).toBeInTheDocument();
    expect(screen.queryByText('Non possédée')).not.toBeInTheDocument();
  });

  it('sans possession à montrer (« Dedans ») : ni atténuation ni pastille de possession', () => {
    const { container } = render(<CardSlot card={carte} inDeck={2} quick={quick} onClick={() => undefined} />);
    expect(container.firstElementChild).not.toHaveClass('is-missing');
    expect(container.querySelector('.card-slot__count')).toBeNull();
    expect(screen.getByText('Deck ×2')).toBeInTheDocument();
  });

  it('la pastille « Deck » n’existe qu’au-dessus de zéro', () => {
    const { container } = render(<CardSlot card={carte} owned={1} inDeck={0} quick={quick} onClick={() => undefined} />);
    expect(container.querySelector('.card-slot__deck')).toBeNull();
  });

  it('le clic sur la carte et le bouton du coin sont deux gestes distincts', () => {
    const surCarte = vi.fn();
    const surBouton = vi.fn();
    const { container } = render(
      <CardSlot card={carte} owned={1} quick={{ ...quick, onClick: surBouton }} onClick={surCarte} />
    );
    fireEvent.click(within(container).getByRole('button', { name: 'Ajouter' }));
    expect(surBouton).toHaveBeenCalledTimes(1);
    expect(surCarte).not.toHaveBeenCalled();
  });
});

describe('styles.css — l’atténuation est réelle', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

  it('une carte non possédée est nettement plus pâle qu’une carte seulement « complète »', () => {
    const absente = Number(/opacity:\s*([\d.]+)/.exec(regle(css, '.card-slot.is-missing .card'))?.[1]);
    const pleine = Number(/opacity:\s*([\d.]+)/.exec(regle(css, '.card-slot.is-full .card'))?.[1]);
    expect(absente).toBeLessThanOrEqual(0.5);
    expect(absente).toBeLessThan(pleine);
    expect(regle(css, '.card-slot.is-missing .card')).toMatch(/grayscale\(/);
  });

  it('la pastille de possession reste hors de la carte : elle ne s’éteint pas avec elle', () => {
    // Si `.card-slot__count` s'atténuait, le « ×0 » serait le premier à disparaître.
    expect(regle(css, '.card-slot__plates')).not.toMatch(/opacity/);
    expect(regle(css, '.card-slot__absent')).not.toMatch(/opacity/);
  });
});
