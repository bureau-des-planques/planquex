// @vitest-environment jsdom
// Lenteur justifiée (D-143 (5)) — l'arc de Condition et son repli, sous jsdom, avec minuteries
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';
import { deckDeConditions, faitCraquer, partieOuLaPressionFait, poseUneCondition } from '@/test/parties-effets';
import { DUREE_CONDITION_APRES_COUP_MS } from '@/components/effets-combat';

/**
 * **T11 — les effets de la référence, et le repli de chacun** (#294, `SPEC-COMBAT-UI` §6.8.3).
 *
 * Quatre effets : l'arc de Condition, la traînée de craquage, la carte de main soulevée au
 * survol, l'Intervention qui se remplit. Pour chacun, deux rendus du **même** coup :
 *
 * - avec le mouvement : le nœud animé existe ;
 * - sous « Mouvement réduit » : le nœud animé n'est **pas créé** (ou porte une classe sans
 *   `animation`), et **l'information reste lisible** — le badge nommé, la carte désaturée et le
 *   bandeau « a craqué », l'hexagone déjà rempli, l'inspecteur qui s'ouvre.
 *
 * La carte de main soulevée est du CSS pur : ses bornes sont gardées dans `effets-combat.test.ts`
 * (la cible de clic ne bouge pas), et son branchement ici.
 */

function jouer(reducedMotion: boolean, voulu: Parameters<typeof partieOuLaPressionFait>[0], deck?: string[]) {
  const { partie, nom } = partieOuLaPressionFait(voulu, deck);
  const rendu = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion, partie });
  fireEvent.click(screen.getByRole('button', { name: new RegExp(nom) }));
  return rendu;
}

// jsdom n'a pas de `canvas` : la scène de la Pression (D-098) s'en passe quand `getContext` rend `null`.
// On le dit ici plutôt que de laisser jsdom écrire « Not implemented » à chaque rendu animé.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('Battle — l’arc de Condition et son repli (T11, #294)', () => {
  afterEach(cleanup);

  it('avec le mouvement : un liseré naît sur le Poste touché, puis quitte le DOM', async () => {
    const { container } = jouer(false, poseUneCondition, deckDeConditions());

    const arc = container.querySelector<HTMLElement>('.condition__arc');
    expect(arc).not.toBeNull();
    expect(arc).toHaveAttribute('aria-hidden', 'true');
    // Posé par une Pression : l'arc attend l'impact.
    expect(arc).toHaveClass('condition__arc--apres-coup');
    // Il est dans le Poste de la Direction, la cible, et nulle part ailleurs.
    expect(container.querySelectorAll('.condition__arc')).toHaveLength(1);
    expect(arc?.closest('.is-direction')).not.toBeNull();

    await waitFor(() => expect(container.querySelector('.condition__arc')).toBeNull(), {
      timeout: DUREE_CONDITION_APRES_COUP_MS + 600
    });
  });

  it('sous « Mouvement réduit » : aucun arc, et le badge nommé dit la Condition', () => {
    const { container } = jouer(true, poseUneCondition, deckDeConditions());

    expect(container.querySelector('.condition__arc')).toBeNull();
    const badge = container.querySelector('.is-direction .status-chip');
    expect(badge).not.toBeNull();
    // En `sobre`, le nom reste lu par le lecteur d'écran ; l'information est donc bien là.
    expect(badge?.textContent).toMatch(/Surcharge|Épuisement|Sieste|Immobilisation|Dérive/);
  });
});

describe('Battle — la traînée de craquage et son repli (T11, #294)', () => {
  afterEach(cleanup);

  it('avec le mouvement : une seule traînée, et la carte tombée reste désaturée', () => {
    const { container } = jouer(false, faitCraquer);

    expect(container.querySelectorAll('.craquage__train')).toHaveLength(1);
    expect(container.querySelector('.craquage__train')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.is-direction .craquage__carte')).not.toBeNull();
  });

  it('sous « Mouvement réduit » : pas de traînée, mais la carte désaturée et le bandeau « a craqué »', () => {
    const { container } = jouer(true, faitCraquer);

    expect(container.querySelector('.craquage__train')).toBeNull();
    // L'information : la carte reste là, désaturée (la règle est dans la feuille), et le bandeau le dit.
    expect(container.querySelector('.is-direction .craquage__carte')).not.toBeNull();
    expect(screen.getByText(/Le Poste de la Direction a craqué/)).toBeInTheDocument();
  });
});

describe('Battle — l’Intervention qui se remplit et son repli (T11, #294)', () => {
  afterEach(cleanup);

  const hexagonesDeToi = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLElement>('.piste__camp')]
      .find((camp) => camp.getAttribute('aria-label') === 'Toi')
      ?.querySelectorAll<HTMLElement>('.piste__hex') ?? [];

  it('avec le mouvement : l’hexagone gagné est rempli et rebondit une fois', () => {
    const { container } = jouer(false, faitCraquer);

    const [premier] = hexagonesDeToi(container);
    expect(premier).toHaveClass('is-acquise', 'is-fraiche');
    expect(container.querySelectorAll('.piste__hex.is-fraiche')).toHaveLength(1);
  });

  it('sous « Mouvement réduit » : l’hexagone est rempli d’emblée, sans classe animée', () => {
    const { container } = jouer(true, faitCraquer);

    const [premier] = hexagonesDeToi(container);
    expect(premier).toHaveClass('is-acquise');
    expect(container.querySelector('.piste__hex.is-fraiche')).toBeNull();
    // Le compte reste lu : « Toi 1 sur 3 ».
    expect(screen.getByRole('group', { name: /Interventions : .*Toi 1 sur 3/ })).toBeInTheDocument();
  });
});

describe('Battle — la carte de main soulevée et son repli (T11, #294)', () => {
  afterEach(cleanup);

  it('avec le mouvement : le survol soulève (CSS) sans ouvrir l’inspecteur', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: false });

    const carte = document.querySelector<HTMLElement>('.hand > li');
    if (!carte) throw new Error('la main ne porte aucune carte');
    fireEvent.pointerEnter(carte, { pointerType: 'mouse' });

    // Le visuel est un enfant direct de la case : c'est lui que le CSS soulève, pas le bouton.
    expect(carte.querySelector(':scope > .hand__visuel')).not.toBeNull();
    expect(carte.querySelector(':scope > .hand__card')).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sous « Mouvement réduit » : la carte reste, et l’inspecteur s’ouvre', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true });

    const carte = document.querySelector<HTMLElement>('.hand > li');
    if (!carte) throw new Error('la main ne porte aucune carte');
    const nom = carte.querySelector('.hand__name')?.textContent ?? '';
    fireEvent.pointerEnter(carte, { pointerType: 'mouse' });

    expect(await screen.findByRole('dialog')).toHaveAccessibleName(nom);
  });
});

describe('Battle — le bouton de Pression se lit en entier (4.1.2)', () => {
  afterEach(cleanup);

  it('son nom dit le dégât « de Stress », pas un nombre nu (le contrôle mord : le chiffre visible est caché aux lecteurs)', () => {
    const { partie, nom } = partieOuLaPressionFait(faitCraquer);
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const bouton = screen.getByRole('button', { name: new RegExp(nom) });
    expect(bouton).toHaveAccessibleName(new RegExp(`${nom}.*\\d+ de Stress`));
    expect(bouton.querySelector('.attack__dmg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Battle — le focus après une Pression (2.4.3)', () => {
  afterEach(cleanup);

  it('le bouton de la Pression disparaît : le focus revient sur la barre, pas sur `body`', async () => {
    const { partie, nom } = partieOuLaPressionFait(faitCraquer);
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true, partie });

    const bouton = screen.getByRole('button', { name: new RegExp(nom) });
    bouton.focus();
    fireEvent.click(bouton);

    await waitFor(() => expect(bouton.isConnected).toBe(false));
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    expect(screen.getByRole('region', { name: 'Actions du tour' }).contains(document.activeElement)).toBe(true);
  });
});
