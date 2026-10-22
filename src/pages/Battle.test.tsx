// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';
import { ETAPES_COMBAT } from '@/components/pas-a-pas-combat-etapes';
import { ALL_CARDS } from '@/data';
import type { BattleState } from '@/data/types';
import { autoDeck } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { partieSauvegardee } from '@/store/partie';
import { useStore } from '@/store/useStore';

describe('Battle — écran de combat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre "Combat" et le tour initial', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Combat/)).toBeInTheDocument();
    expect(screen.getByText(/Tour 1/)).toBeInTheDocument();
  });

  it('affiche l\'indicateur de tour (à toi / à la Direction)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/à (toi|la Direction)/)).toBeInTheDocument();
  });

  it('affiche les sections principales du plateau', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const headings = screen.getAllByRole('heading', { level: 2 });
    const campHeadings = headings.filter((h) => h.textContent?.includes('Toi') || h.textContent?.includes('Direction'));
    expect(campHeadings.length).toBe(2);
  });

  it('affiche le Poste et le Rack (labels)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const posteLabels = screen.getAllByText(/Poste/);
    const rackLabels = screen.getAllByText(/Rack/);
    expect(posteLabels.length).toBeGreaterThanOrEqual(2);
    expect(rackLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('affiche la Machine à café pour chaque camp', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const machines = screen.getAllByText(/Machine/);
    expect(machines.length).toBeGreaterThanOrEqual(2);
  });

  it('affiche la main du joueur', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Ta main/)).toBeInTheDocument();
  });

  it('affiche la section Conditions', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Conditions/)).toBeInTheDocument();
    expect(screen.getByText(/ce qu.un Planqué au Poste peut subir/i)).toBeInTheDocument();
  });

  it('ouvre le dialogue Règles au clic sur le bouton', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const rulesButton = screen.getByRole('button', { name: /Règles/i });
    fireEvent.click(rulesButton);

    expect(screen.getByRole('dialog', { name: /Conditions/i })).toBeInTheDocument();
  });

  it('affiche le bouton Nouveau combat', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByRole('button', { name: /Nouveau combat/i })).toBeInTheDocument();
  });

  it('affiche le bouton Abandonner', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByRole('button', { name: /Abandonner/i })).toBeInTheDocument();
  });

  it('affiche la section Journal', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Journal/)).toBeInTheDocument();
  });

  it('affiche la section Partie à deux avec le bouton Créer', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Partie à deux/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer une partie à deux/i })).toBeInTheDocument();
  });

  it('redémarre le combat au clic sur Nouveau combat', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const restartButton = screen.getByRole('button', { name: /Nouveau combat/i });
    fireEvent.click(restartButton);

    expect(screen.getByText(/Tour 1/)).toBeInTheDocument();
  });

  it('affiche le message d\'avertissement si le deck n\'est pas valide', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/deck de test/i)).toBeInTheDocument();
  });
});

/**
 * **Le combat se lit d'un coup** (#169) : le pas-à-pas est en haut et fait défiler la page
 * vers ce qu'il décrit, et poser une carte est un geste à deux temps, nommé.
 *
 * `scrollIntoView` est une doublure (`src/test/setup-jsdom.ts`) : jsdom ne défile pas, donc
 * on lit **sur quel élément** et **avec quels arguments** elle est appelée. Si l'on retire
 * l'appel du hook, `le défilement suit chaque étape` échoue — c'est ce qui le fait mordre.
 */
describe('Battle — le pas-à-pas est en haut et défile vers sa cible (#169)', () => {
  const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

  /** Les éléments sur lesquels `scrollIntoView` a été appelé, dans l'ordre. */
  function elementsDefiles(): Element[] {
    return scroll.mock.contexts as Element[];
  }

  function cibleDe(nom: string): Element | null {
    return document.querySelector(`[data-pas-a-pas="${nom}"]`);
  }

  beforeEach(() => {
    scroll.mockClear();
  });

  it('rend le panneau avant le plateau et la main, comme premier bloc collé de la page', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false });

    const panneau = screen.getByRole('complementary', { name: /Pas-à-pas du combat/i });
    const page = container.querySelector('.battle');
    expect(panneau.parentElement).toBe(page);

    for (const apres of [container.querySelector('.board'), screen.getByText('Ta main')]) {
      expect(
        panneau.compareDocumentPosition(apres as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
        'le panneau précède le plateau et la main'
      ).toBeTruthy();
    }
  });

  it('colle le panneau en haut, sans fond assombri (la feuille de style le dit)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const regle = css.match(/\n\.pas-a-pas \{([^}]*)\}/)?.[1] ?? '';
    expect(regle).toMatch(/position:\s*sticky/);
    expect(regle).toMatch(/top:/);
    // Un dialogue assombrirait la page : le panneau n'a ni voile ni couche plein écran.
    expect(css).not.toMatch(/\.pas-a-pas[^{]*\{[^}]*(position:\s*fixed|inset:\s*0)/);
  });

  it('le défilement suit chaque étape : Suivant et Précédent cadrent la première cible au centre', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false });

    // À l'ouverture : la première cible de l'étape 1.
    expect(elementsDefiles().at(-1)).toBe(cibleDe('plateau'));

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(elementsDefiles().at(-1)).toBe(cibleDe('machine'));
    expect(scroll.mock.calls.at(-1)?.[0]).toMatchObject({ block: 'center' });

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(elementsDefiles().at(-1)).toBe(cibleDe('poste-actions'));

    fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(elementsDefiles().at(-1)).toBe(cibleDe('machine'));
  });

  it('défile en douceur, sauf mouvement réduit : alors le saut est instantané', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false, reducedMotion: false });
    expect(scroll.mock.calls.at(-1)?.[0]).toMatchObject({ behavior: 'smooth' });
  });

  it('défile sans animation quand le réglage « Mouvement réduit » est actif', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false, reducedMotion: true });
    expect(scroll.mock.calls.at(-1)?.[0]).toMatchObject({ behavior: 'auto' });
  });

  it('défile sans animation quand le système demande prefers-reduced-motion', () => {
    const initial = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn()
    })) as unknown as typeof window.matchMedia;
    try {
      renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false, reducedMotion: false });
      expect(scroll.mock.calls.at(-1)?.[0]).toMatchObject({ behavior: 'auto' });
    } finally {
      window.matchMedia = initial;
    }
  });

  it('chaque cible de chaque étape existe à l’écran, et seules les cibles de l’étape sont désignées', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false });

    ETAPES_COMBAT.forEach((etape, index) => {
      if (index > 0) fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
      const designes = Array.from(document.querySelectorAll('[data-pas-a-pas]')).map((el) =>
        el.getAttribute('data-pas-a-pas')
      );
      // Exacte : `poste` n'est pas désigné par une étape qui ne nomme que `poste-actions`.
      expect([...designes].sort(), etape.titre).toEqual([...etape.cibles].sort());
      for (const cible of etape.cibles) {
        expect(cibleDe(cible), `${etape.titre} : « ${cible} » existe`).not.toBeNull();
      }
    });
  });

  it('chaque cible désignée a son contour dans la feuille de style', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toMatch(/\n\[data-pas-a-pas\]\s*\{[^}]*outline:/);
  });

  it('ne désigne rien et ne défile pas quand le pas-à-pas est terminé', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    expect(document.querySelectorAll('[data-pas-a-pas]')).toHaveLength(0);
    expect(elementsDefiles()).toHaveLength(0);
  });
});

describe('Battle — poser une carte est un geste nommé (#169)', () => {
  /**
   * La graine est **fixée** : le combat tire sa graine de l'horloge (`createBattle`), donc le
   * lancer de tampon change à chaque exécution. Avec 42, le joueur ouvre et ses cinq cartes
   * sont jouables — sans quoi le test attendrait l'IA de la Direction, et serait instable.
   */
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Les libellés de pose : le lieu ou l'effet, jamais un « Poser » nu. */
  const LIBELLES_DE_POSE = /^(Poser au Poste|Mettre au Rack \d|Jouer cet Objet|Jouer ce Collègue|Faire évoluer|Changement de priorité)/;

  async function premiereCarteJouable(): Promise<HTMLElement> {
    return waitFor(() => {
      const carte = document.querySelector<HTMLElement>('button.hand__card.is-playable');
      if (!carte) throw new Error('aucune carte jouable : la graine fixée ne fait plus ouvrir le joueur');
      return carte;
    });
  }

  it('choisir une carte la désigne, la nomme et offre des gestes explicites', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const carte = await premiereCarteJouable();
    expect(carte).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('region', { name: /Poser la carte choisie/i })).toBeNull();

    fireEvent.click(carte);

    expect(carte).toHaveAttribute('aria-pressed', 'true');
    const panneau = screen.getByRole('region', { name: /Poser la carte choisie/i });
    const nom = carte.querySelector('.hand__name')?.textContent ?? '';
    expect(within(panneau).getByText(nom)).toBeInTheDocument();

    const gestes = within(panneau).getAllByRole('button').filter((b) => !/Reprendre/.test(b.textContent ?? ''));
    expect(gestes.length).toBeGreaterThan(0);
    for (const geste of gestes) {
      expect(geste.textContent, 'un geste de pose dit où ou quoi').toMatch(LIBELLES_DE_POSE);
    }
  });

  it('la carte choisie reste choisie jusqu’à ce qu’on la pose, ou qu’on la reprenne', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const carte = await premiereCarteJouable();
    fireEvent.click(carte);
    expect(carte).toHaveAttribute('aria-pressed', 'true');

    // Rien d'autre ne la désélectionne : ni un clic ailleurs, ni un re-rendu.
    fireEvent.click(screen.getByRole('button', { name: /Abandonner/i }).parentElement as Element);
    expect(carte).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Reprendre une autre carte/i }));
    expect(carte).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('region', { name: /Poser la carte choisie/i })).toBeNull();
  });

  it('un geste de pose consomme la sélection', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const carte = await premiereCarteJouable();
    fireEvent.click(carte);
    const panneau = screen.getByRole('region', { name: /Poser la carte choisie/i });
    const geste = within(panneau)
      .getAllByRole('button')
      .find((b) => LIBELLES_DE_POSE.test(b.textContent ?? ''));
    expect(geste).toBeDefined();
    fireEvent.click(geste as HTMLElement);

    expect(screen.queryByRole('region', { name: /Poser la carte choisie/i })).toBeNull();
  });

  it('cadre le panneau de pose quand une carte est choisie', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const carte = await premiereCarteJouable();
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();

    fireEvent.click(carte);

    const panneau = screen.getByRole('region', { name: /Poser la carte choisie/i });
    expect((Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.contexts).toContain(panneau);
  });
  it('reprend la partie rangée au rechargement : même tour, même dernière ligne (#126)', () => {
    // Une partie jouée à la main, rangée dans le store : c'est ce que l'écran écrit.
    const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
    const deck = autoDeck(owned).deck;
    let jouee: BattleState = createBattle(deck, deck, 31337);
    // Au moins 20 coups, puis on s'arrête au tour du joueur (pour que rien ne joue seul).
    for (let i = 0; i < 200; i += 1) {
      const auTourDuJoueur = jouee.current === 'player' && jouee.pendingPromotion === null;
      if (i >= 20 && auTourDuJoueur) break;
      const action = legalActions(jouee).find((a) => a.type !== 'forfeit');
      if (!action) break;
      jouee = applyAction(jouee, action);
    }
    expect(jouee.actionLog.length).toBeGreaterThan(5);
    const decksSolo = { playerDeck: deck, aiDeck: deck };

    renderWithStore(<Battle />, {
      tutorielVu: true,
      pasAPasCombatVu: true,
      partie: partieSauvegardee(jouee, null, decksSolo)
    });

    expect(screen.getByText(new RegExp(`Tour ${jouee.turn}\\b`))).toBeInTheDocument();
    expect(screen.getAllByText(jouee.log.at(-1) ?? '').length).toBeGreaterThan(0);
    // Le store garde la partie reprise : la prochaine ouverture la retrouvera encore.
    expect(useStore.getState().partie?.actions.length).toBe(jouee.actionLog.length);
  });
});
