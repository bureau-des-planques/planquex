// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { Deck } from './Deck';
import { renderWithStore } from '@/test/test-utils';
import { FACTION_META } from '@/data';
import { CAFE_FACTIONS, MAX_DECK_CAFE_TYPES } from '@/game/deck';

/**
 * **La machine à café du Deck** (#279) : des **capsules colorées**, pas des pastilles.
 *
 * Tranché par Bastien le 27/10/2026. La couleur vient de `FACTION_META` — la seule source des
 * couleurs de faction (`AGENTS.md` §6) —, et l'état « choisi » ne se lit pas qu'à la couleur :
 * il est annoncé aux lecteurs d'écran (`aria-pressed` et un `aria-label` qui le dit).
 */
describe('Deck — les capsules de café (#279)', () => {
  const capsules = () => {
    const groupe = screen.getByRole('group', { name: /Types de café du Deck/i });
    return within(groupe).getAllByRole('button');
  };

  it('une capsule par type produisible, et jamais Support ni Intérim', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });
    const toutes = capsules();

    expect(toutes).toHaveLength(CAFE_FACTIONS.length);
    for (const capsule of toutes) {
      const nom = capsule.getAttribute('aria-label') ?? '';
      expect(nom).not.toMatch(/Support/i);
      expect(nom).not.toMatch(/Intérim/i);
      expect(capsule.textContent).not.toContain('SUP');
      expect(capsule.textContent).not.toContain('INT');
    }
    // Le groupe porte les sigles des factions produisibles, pas ceux des deux exclues.
    expect(toutes.some((c) => c.textContent?.includes('SSE'))).toBe(true);
    // La couleur est posée depuis `FACTION_META`, pas recopiée dans le composant.
    const sse = toutes.find((c) => c.getAttribute('aria-label')?.startsWith('SSE'))!;
    expect((sse as HTMLElement).style.getPropertyValue('--cafe')).toBe(FACTION_META.SSE.color);
  });

  it('au plus trois capsules choisies, et l’état est annoncé aux lecteurs d’écran', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });
    const toutes = capsules();

    const sse = toutes.find((c) => c.getAttribute('aria-label')?.startsWith('SSE'))!;
    expect(sse).toHaveAttribute('aria-pressed', 'false');
    expect(sse.getAttribute('aria-label')).toMatch(/non choisi$/);

    fireEvent.click(sse);
    expect(sse).toHaveAttribute('aria-pressed', 'true');
    expect(sse.getAttribute('aria-label')).toMatch(/^SSE, choisi/);

    // Trois choix au plus : les capsules restantes se ferment, comme le plafond du moteur.
    for (const capsule of toutes) {
      if ((capsule as HTMLButtonElement).disabled === false && capsule.getAttribute('aria-pressed') === 'false') {
        fireEvent.click(capsule);
      }
    }
    const choisies = toutes.filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(choisies).toHaveLength(MAX_DECK_CAFE_TYPES);
    expect(
      toutes.filter((c) => (c as HTMLButtonElement).disabled === false && c.getAttribute('aria-pressed') === 'false')
    ).toHaveLength(0);
  });
});
