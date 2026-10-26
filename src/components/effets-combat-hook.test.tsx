// @vitest-environment jsdom
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_CARDS, isBasic, isPlanque } from '@/data';
import type { BattleState } from '@/data/types';
import { createBattle } from '@/game/engine';
import { useEffetsDeCombat } from './effets-combat';

/**
 * Le **compteur tenu par le composant** (#192) : un effet naît, vit sa durée, puis quitte le
 * DOM. Sous « Mouvement réduit », le même nœud reste — avec `is-fixe`, donc sans animation —
 * parce que l'information n'a jamais vécu dans le mouvement.
 */

function deckDeTest(): string[] {
  const entrants = ALL_CARDS.filter((card) => isPlanque(card) && isBasic(card) && !card.variantOf).slice(0, 10);
  return entrants.flatMap((card) => [card.id, card.id]);
}

const avant = (): BattleState => createBattle(deckDeTest(), deckDeTest(), 42);

function apresUnCoup(avantEtat: BattleState): BattleState {
  const apres = structuredClone(avantEtat);
  apres.players.ai.active!.hp -= 30;
  return apres;
}

function Harnais({ depart, suivant, sansMouvement }: { depart: BattleState; suivant: BattleState; sansMouvement: boolean }) {
  const [etat, setEtat] = useState(depart);
  const effets = useEffetsDeCombat(etat, sansMouvement);
  return (
    <>
      <button type="button" onClick={() => setEtat(suivant)}>
        jouer
      </button>
      <ul>
        {effets.map((effet) => (
          <li
            key={effet.id}
            data-nature={effet.nature}
            data-anime={String(effet.anime)}
            data-uid={effet.uid}
            data-uid-cible={effet.uidCible}
            className={`stress-flottant${effet.anime ? '' : ' is-fixe'}`}
          >
            +{effet.valeur}
          </li>
        ))}
      </ul>
    </>
  );
}

describe('useEffetsDeCombat — le chiffre vit moins de 800 ms puis quitte le DOM (#192)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('apparaît une fois, reste 700 ms, puis est retiré — donc pas d’empilement au troisième coup', () => {
    const depart = avant();
    render(<Harnais depart={depart} suivant={apresUnCoup(depart)} sansMouvement={false} />);

    fireEvent.click(screen.getByText('jouer'));

    const chiffre = document.querySelector<HTMLElement>('[data-nature="stress"]');
    expect(chiffre).not.toBeNull();
    expect(chiffre).toHaveTextContent('+30');
    expect(chiffre).toHaveAttribute('data-anime', 'true');

    act(() => vi.advanceTimersByTime(699));
    expect(document.querySelectorAll('[data-nature="stress"]')).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1));
    expect(document.querySelectorAll('[data-nature="stress"]')).toHaveLength(0);
  });

  it('sous « Mouvement réduit », le chiffre reste lisible mais porte la classe sans animation', () => {
    const depart = avant();
    render(<Harnais depart={depart} suivant={apresUnCoup(depart)} sansMouvement />);

    fireEvent.click(screen.getByText('jouer'));

    const chiffre = document.querySelector<HTMLElement>('[data-nature="stress"]');
    expect(chiffre).not.toBeNull();
    expect(chiffre).toHaveAttribute('data-anime', 'false');
    expect(chiffre).toHaveClass('is-fixe');
    expect(chiffre).toHaveTextContent('+30');
  });
});

describe('useEffetsDeCombat — la Pression en quatre temps (#207)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('une action attack émet une nature « attaque » avec l’attaquant et la cible', () => {
    const depart = avant();
    const suivant = apresUnCoup(depart);
    // Une entrée de journal porte son action **et** ses faits (#250) : c'est le fait qui
    // dit que la Pression est partie, plus la phrase du journal.
    suivant.actionLog = [
      ...depart.actionLog,
      { action: { type: 'attack', attackIndex: 0 }, faits: [{ type: 'stress', uid: 'x', montant: 20, auPoste: true }] }
    ];
    render(<Harnais depart={depart} suivant={suivant} sansMouvement={false} />);

    fireEvent.click(screen.getByText('jouer'));

    const attaque = document.querySelector<HTMLElement>('[data-nature="attaque"]');
    expect(attaque).not.toBeNull();
    expect(attaque).toHaveAttribute('data-uid', depart.players.player.active!.uid);
    expect(attaque).toHaveAttribute('data-uid-cible', depart.players.ai.active!.uid);
  });

  it('une Condition qui apparaît émet une nature « condition »', () => {
    const depart = avant();
    const suivant = structuredClone(depart);
    suivant.players.ai.active!.statuses = ['SURCHARGE'] as never;
    render(<Harnais depart={depart} suivant={suivant} sansMouvement={false} />);

    fireEvent.click(screen.getByText('jouer'));

    const condition = document.querySelector<HTMLElement>('[data-nature="condition"]');
    expect(condition).not.toBeNull();
    expect(condition).toHaveAttribute('data-uid', depart.players.ai.active!.uid);
  });
});
