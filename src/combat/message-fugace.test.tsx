// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { DELAI_MESSAGE_MS, useMessageFugace } from './message-fugace';

/**
 * **Le message du tour s'efface après 4 s** (D-193 (2), #750). Les minuteries sont fausses : on
 * avance le temps, on ne l'attend pas.
 */
describe('useMessageFugace', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('reste visible au premier affichage, puis se cache après le délai', () => {
    const { result } = renderHook(() => useMessageFugace('Portée : la Direction pose.'));
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(DELAI_MESSAGE_MS - 1);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('le délai vaut 4 s', () => {
    expect(DELAI_MESSAGE_MS).toBe(4000);
  });

  it('réapparaît quand le texte change, et se cache à nouveau 4 s plus tard', () => {
    const { result, rerender } = renderHook(({ cle }: { cle: string }) => useMessageFugace(cle), {
      initialProps: { cle: 'premier' }
    });
    act(() => {
      vi.advanceTimersByTime(DELAI_MESSAGE_MS);
    });
    expect(result.current).toBe(false);

    rerender({ cle: 'second' });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(DELAI_MESSAGE_MS);
    });
    expect(result.current).toBe(false);
  });

  it('un texte inchangé ne rallume pas la bulle', () => {
    const { result, rerender } = renderHook(({ cle }: { cle: string }) => useMessageFugace(cle), {
      initialProps: { cle: 'identique' }
    });
    act(() => {
      vi.advanceTimersByTime(DELAI_MESSAGE_MS);
    });
    rerender({ cle: 'identique' });
    expect(result.current).toBe(false);
  });
});
