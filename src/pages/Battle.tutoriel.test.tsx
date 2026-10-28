// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';
import { ETAPES_COMBAT } from '@/components/pas-a-pas-combat-etapes';
import { useStore } from '@/store/useStore';

/**
 * **Le combat guidé** (#272) : un combat contre la Direction qui commence par le pas-à-pas
 * du premier combat (#143, `PasAPasCombat`), puis **lâche** le testeur — il joue seul.
 *
 * Ce n'est ni un second mécanisme ni une règle : la même partie, le même moteur, le niveau
 * de la Direction par défaut (D-084, #251 n'est pas tranché). Trois choses se vérifient
 * ici : le guidage **démarre** même quand le drapeau dit « déjà vu », il se **termine**
 * librement, et la partie **continue** — le pas-à-pas ne bloque rien.
 */
const panneau = () => screen.queryByRole('complementary', { name: /Pas-à-pas du combat/i });

describe('le combat guidé (#272)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    window.history.pushState({}, '', '/battle?tutoriel=1');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('démarre avec le guidage, même si le pas-à-pas a déjà été vu', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(panneau()).not.toBeNull();
    expect(screen.getByRole('heading', { name: ETAPES_COMBAT[0].titre })).toBeInTheDocument();
    // Le bandeau dit où l'on est : un combat d'entraînement, pas une partie ordinaire.
    expect(screen.getByText(/combat guidé/i)).toBeInTheDocument();
  });

  it('se termine librement : le guidage s’éteint, le drapeau du store ne bouge pas', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    for (let i = 1; i < ETAPES_COMBAT.length; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'C’est compris' }));

    expect(panneau()).toBeNull();
    // Rejouer le tutoriel ne prive pas la première vraie partie de son pas-à-pas.
    expect(useStore.getState().pasAPasCombatVu).toBe(true);
    // Le bandeau annonce la suite : on joue seul, la partie continue.
    expect(screen.getByText(/à toi de jouer/i)).toBeInTheDocument();
  });

  it('rien ne bloque la partie : on peut passer le guidage et jouer un geste', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // « Passer le pas-à-pas » est offert dès la première étape : aucune étape n'exige un geste.
    fireEvent.click(screen.getByRole('button', { name: 'Passer le pas-à-pas' }));
    expect(panneau()).toBeNull();

    // La console répond tout de suite : une carte de la main s'ouvre sur son panneau de pose,
    // et rien ne recouvre la table (le pas-à-pas n'est pas un dialogue modal, #143).
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    const carte = document.querySelector('.hand-panel .hand__card') as HTMLButtonElement | null;
    if (!carte) throw new Error('la main du testeur est vide : le test ne prouverait rien');
    fireEvent.click(carte);
    expect(screen.getByRole('region', { name: 'Poser la carte choisie' })).toBeInTheDocument();
  });

  it('n’écrase pas la partie en cours : un tutoriel ne s’enregistre pas', () => {
    const partie = { graine: 7, journal: [], mode: 'solo' } as never;
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    fireEvent.click(screen.getByRole('button', { name: 'Passer le pas-à-pas' }));
    expect(useStore.getState().partie).toBe(partie);
  });

  it('sans `?tutoriel=1`, un combat ordinaire ne rouvre pas le pas-à-pas déjà vu', () => {
    window.history.pushState({}, '', '/battle');
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    expect(panneau()).toBeNull();
    expect(screen.queryByText(/combat guidé/i)).toBeNull();
  });
});
