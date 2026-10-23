// @vitest-environment jsdom
/**
 * **La fin d'une partie survit à un échec d'envoi** (#173, D-086).
 *
 * L'écran dépose la trace par `tracerCombat`, qui avale le rejet ; le réseau peut tomber,
 * l'écran de fin reste debout. Ici, l'envoi est doublé par un rejet : le vrai `tracerCombat`
 * le reçoit, donc c'est **son** `catch` qui est exercé. Si `Battle.tsx` cessait d'appeler la
 * trace, `envoyerCombat` ne serait jamais appelé ; si l'écran cessait d'afficher la fin,
 * `partie terminée` disparaîtrait.
 *
 * La garde qui fait **mordre** le `catch` de `tracerCombat` elle-même est dans
 * `src/store/combats.test.ts` (un `envoyer` qui rejette doit ressortir en `{ envoye: false }`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';

/** L'envoi est doublé : il rejette comme un réseau coupé, et on lit ce qu'il a reçu. */
const envoyerCombat = vi.hoisted(() => vi.fn());

vi.mock('@/store/combats', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/store/combats')>();
  return {
    ...original,
    envoyerCombat,
    // Le vrai `tracerCombat`, avec l'envoi doublé : son `catch` est donc bien exercé.
    tracerCombat: (combat: Parameters<typeof original.tracerCombat>[0]) =>
      original.tracerCombat(combat, envoyerCombat)
  };
});

describe('Battle — la trace d’un combat ne bloque pas la fin de partie (#173)', () => {
  beforeEach(() => {
    envoyerCombat.mockReset();
    envoyerCombat.mockRejectedValue(new Error('Failed to fetch'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('un rejet réseau laisse l’écran de fin à l’écran, et l’envoi n’a reçu que le combat', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, name: 'Employé 404' });

    fireEvent.click(screen.getByRole('button', { name: /Abandonner/i }));

    await waitFor(() => expect(screen.getByText(/partie terminée/)).toBeInTheDocument());
    await waitFor(() => expect(envoyerCombat).toHaveBeenCalledTimes(1));

    // Ce qui est parti : le contrat de `combatTermine`, pas le nom de l'appareil.
    const combat = envoyerCombat.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(combat).sort()).toEqual(['decks', 'graine', 'journal', 'mode', 'typesCafe']);
    expect(JSON.stringify(combat)).not.toContain('Employé 404');

    // Le rejet est avalé : la fin de partie est toujours là, aucun écran d'erreur.
    expect(screen.getByText(/partie terminée/)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).toBeNull();
  });
});
