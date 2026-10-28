// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { Rejeu } from './Rejeu';
import { renderWithStore } from '@/test/test-utils';
import { FACTION_ORDER, factionDeck, playGame } from '@/game/simulation';
import { derniereDe } from '@/store/derniere';
import type { DernierePartie } from '@/store/derniere';
import type { BattleState } from '@/data/types';

/**
 * L'écran « Revoir ma dernière partie » (#366) : hors du combat, il rejoue la partie gardée et
 * montre son verdict. Un écart de verdict est une alerte, jamais un silence.
 */

const SEED = 42;

function partieTerminee(): { state: BattleState; partie: DernierePartie } {
  const playerDeck = factionDeck(FACTION_ORDER[SEED % FACTION_ORDER.length] ?? FACTION_ORDER[0]);
  const aiDeck = factionDeck(FACTION_ORDER[(SEED + 3) % FACTION_ORDER.length] ?? FACTION_ORDER[1]);
  const state = playGame(playerDeck, aiDeck, SEED);
  const partie = derniereDe(state, null, { playerDeck, aiDeck });
  if (partie === null) throw new Error('la partie de test devrait être terminée');
  return { state, partie };
}

describe('Rejeu — revoir une partie terminée', () => {
  it('sans partie gardée, dit qu’il n’y a rien à revoir et renvoie aux Réglages', () => {
    renderWithStore(<Rejeu />, { derniere: null, tutorielVu: true, pasAPasCombatVu: true });
    expect(screen.getByText(/Aucune partie terminée à revoir/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Retour aux Réglages' })[0]).toHaveAttribute('href', '/settings');
  });

  it('une partie rejouée annonce un verdict identique', () => {
    const { partie } = partieTerminee();
    renderWithStore(<Rejeu />, { derniere: partie, tutorielVu: true, pasAPasCombatVu: true });
    expect(screen.getByRole('status')).toHaveTextContent('Verdict du rejeu identique');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('le pas-à-pas avance, recule et saute aux deux bouts', () => {
    const { partie } = partieTerminee();
    renderWithStore(<Rejeu />, { derniere: partie, tutorielVu: true, pasAPasCombatVu: true });
    const commandes = screen.getByRole('group', { name: 'Commandes du rejeu' });
    const dernier = partie.actions.length;
    expect(screen.getByText(new RegExp(`Étape 0 sur ${dernier}`))).toBeInTheDocument();

    fireEvent.click(within(commandes).getByRole('button', { name: /Avancer/ }));
    expect(screen.getByText(new RegExp(`Étape 1 sur ${dernier}`))).toBeInTheDocument();

    fireEvent.click(within(commandes).getByRole('button', { name: 'À la fin' }));
    expect(screen.getByText(new RegExp(`Étape ${dernier} sur ${dernier}`))).toBeInTheDocument();
    expect(within(commandes).getByRole('button', { name: /Avancer/ })).toBeDisabled();

    fireEvent.click(within(commandes).getByRole('button', { name: 'Au début' }));
    expect(screen.getByText(new RegExp(`Étape 0 sur ${dernier}`))).toBeInTheDocument();
    expect(within(commandes).getByRole('button', { name: /Reculer/ })).toBeDisabled();
  });

  it('le contrôle mord : un verdict qui ne tient pas est une alerte visible', () => {
    const { partie } = partieTerminee();
    const faux = { ...partie, verdict: { ...partie.verdict, tours: partie.verdict.tours + 1 } };
    renderWithStore(<Rejeu />, { derniere: faux, tutorielVu: true, pasAPasCombatVu: true });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Le rejeu ne rend pas la même partie : le nombre de tours diffère.'
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('un Deck qui n’est plus légal est refusé avec sa raison, sans afficher de plateau', () => {
    const { partie } = partieTerminee();
    renderWithStore(<Rejeu />, {
      derniere: { ...partie, aiDeck: ['sse-psychologue'] },
      tutorielVu: true,
      pasAPasCombatVu: true
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Les Decks de cette partie ne sont plus légaux');
    expect(screen.queryByRole('group', { name: 'Commandes du rejeu' })).toBeNull();
  });
});
