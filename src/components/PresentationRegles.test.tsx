// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { PresentationRegles } from './PresentationRegles';
import { ETAPES_REGLES } from './regles-etapes';
import { renderWithStore } from '@/test/test-utils';
import { Settings } from '@/pages/Settings';
import { Battle } from '@/pages/Battle';
import { menuSurLaListe } from '@/test/menu-combat';

/**
 * **La présentation des règles s'ouvre et se ferme** (#270) : un test d'écran qui la
 * cherche là où un testeur la cherche — Réglages d'un côté, menu du combat de l'autre.
 * Chaque étape se lit, et le dernier écran propose le combat guidé (#272).
 */
describe('PresentationRegles — l’ouverture et la fermeture (#270)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('s’ouvre sur la première règle et se ferme par « Fermer »', () => {
    renderWithStore(<PresentationRegles>Les règles en une minute</PresentationRegles>);

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Les règles en une minute' }));

    const dialogue = screen.getByRole('dialog');
    expect(within(dialogue).getByRole('heading', { name: /règles en une minute/i })).toBeInTheDocument();
    expect(within(dialogue).getByRole('heading', { name: ETAPES_REGLES[0].titre })).toBeInTheDocument();

    fireEvent.click(within(dialogue).getByRole('button', { name: /Fermer/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('avance d’étape en étape et finit sur le combat guidé', () => {
    renderWithStore(<PresentationRegles>Les règles en une minute</PresentationRegles>);
    fireEvent.click(screen.getByRole('button', { name: 'Les règles en une minute' }));
    const dialogue = screen.getByRole('dialog');

    for (let i = 1; i < ETAPES_REGLES.length; i += 1) {
      fireEvent.click(within(dialogue).getByRole('button', { name: 'Suivant' }));
      expect(within(dialogue).getByRole('heading', { name: ETAPES_REGLES[i].titre })).toBeInTheDocument();
    }
    expect(within(dialogue).queryByRole('button', { name: 'Suivant' })).toBeNull();
    expect(within(dialogue).getByRole('link', { name: /combat guidé/i })).toHaveAttribute('href', '/battle?tutoriel=1');
  });

  it('s’ouvre depuis Réglages, et de là on rejoue le pas-à-pas dans le combat guidé (#272)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.click(screen.getByRole('button', { name: 'Les règles en une minute' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fermer/i }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // Le pas-à-pas se rejoue aussi depuis Réglages : **un** lien, pas un état de store
    // (30/10/2026 : les deux boutons qui faisaient la même chose n'en font plus qu'un).
    expect(screen.getByRole('link', { name: /Revoir le pas-à-pas du combat/i })).toHaveAttribute(
      'href',
      '/battle?tutoriel=1'
    );
  });

  it('s’ouvre depuis le menu du combat', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    menuSurLaListe();

    fireEvent.click(screen.getByRole('button', { name: /Règles/ }));
    const dialogue = screen.getByRole('dialog');
    expect(within(dialogue).getByRole('heading', { name: ETAPES_REGLES[0].titre })).toBeInTheDocument();
    fireEvent.click(within(dialogue).getByRole('button', { name: /Fermer/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
