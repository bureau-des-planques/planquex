// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FACTION_META } from '@/data';
import type { Faction } from '@/data/types';
import { CafePips, contraste, encreSur } from './CafePips';

/**
 * **Un café ne se lit plus par sa seule couleur** (#525) : la pastille porte le glyphe de sa faction,
 * dans l'encre la plus lisible sur sa couleur.
 */
describe('CafePips — le glyphe de la faction', () => {
  const factions = Object.keys(FACTION_META) as Faction[];

  it('l’encre du glyphe tient 3:1 sur chacune des dix couleurs de faction', () => {
    for (const faction of factions) {
      const { color } = FACTION_META[faction];
      expect(contraste(color, encreSur(color)), faction).toBeGreaterThanOrEqual(3);
    }
  });

  it('le contrôle mord : le blanc partout tomberait sous 3:1 (Amélioration continue)', () => {
    expect(contraste(FACTION_META.AMELIORATION.color, '#ffffff')).toBeLessThan(3);
  });

  it('chaque pastille typée porte son glyphe, caché aux lecteurs ; le groupe est une image nommée', () => {
    const { container } = render(<CafePips symbols={['SSE', 'MANAGEMENT', 'INCOLORE']} />);
    const glyphes = [...container.querySelectorAll('.pip__glyphe')];
    expect(glyphes.map((g) => g.textContent?.replace('︎', ''))).toEqual([
      FACTION_META.SSE.glyph,
      FACTION_META.MANAGEMENT.glyph
    ]);
    for (const glyphe of glyphes) expect(glyphe).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('img', { name: /^Coût : / })).toBeInTheDocument();
  });
});
