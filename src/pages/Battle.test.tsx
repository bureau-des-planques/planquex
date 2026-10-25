// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';
import { menuEstOuvert, menuSurLaListe, menuSurLaVue } from '@/test/menu-combat';
import { ETAPES_COMBAT } from '@/components/pas-a-pas-combat-etapes';
import { ALL_CARDS } from '@/data';
import type { BattleAction, BattleState } from '@/data/types';
import { encodeMatch } from '@/game/codec';
import { autoDeck } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { nextAiAction } from '@/game/ia';
import { factionDeck } from '@/game/simulation';
import { partieSauvegardee } from '@/store/partie';
import { useStore } from '@/store/useStore';

/** Une partie **commencée** (vingt coups joués), rendue au tour du joueur : rien ne joue seul. */
function partieCommencee() {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  let jouee: BattleState = createBattle(deck, deck, 31337);
  for (let i = 0; i < 200; i += 1) {
    const auTourDuJoueur = jouee.current === 'player' && jouee.pendingPromotion === null;
    if (i >= 20 && auTourDuJoueur) break;
    const action = legalActions(jouee).find((a) => a.type !== 'forfeit');
    if (!action) break;
    jouee = applyAction(jouee, action);
  }
  expect(jouee.actionLog.length).toBeGreaterThan(5);
  const partie = partieSauvegardee(jouee, null, { playerDeck: deck, aiDeck: deck });
  if (!partie) throw new Error('partie terminée : rien à rendre');
  return { partie, tour: jouee.turn, etat: jouee, deck };
}

/** Une partie où **mon** Poste vient de craquer : la relève est à choisir (D-030). */
function partieAvecReleve() {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  for (let seed = 1; seed < 300; seed += 1) {
    let s: BattleState = createBattle(deck, deck, seed);
    for (let i = 0; i < 400 && s.phase === 'playing'; i += 1) {
      if (s.pendingPromotion === 'player' && legalActions(s).some((a) => a.type === 'promoteActive')) {
        const partie = partieSauvegardee(s, null, { playerDeck: deck, aiDeck: deck });
        if (partie) return { partie, etat: s };
      }
      const legales = legalActions(s).filter((a) => a.type !== 'forfeit');
      const action =
        s.current === 'ai' && !s.pendingPromotion
          ? nextAiAction(s, 1)
          : (legales.find((a) => a.type === 'promoteActive') ??
            legales.find((a) => a.type === 'attack') ??
            legales.find((a) => a.type === 'attachEnergy') ??
            legales.find((a) => a.type === 'endTurn'));
      if (!action) break;
      s = applyAction(s, action);
    }
  }
  throw new Error('aucune partie ne donne une relève au joueur');
}

/** Un tour du joueur où une Pression est à portée : la barre doit la porter. */
function partieAvecPression() {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  for (let seed = 1; seed < 400; seed += 1) {
    let s: BattleState = createBattle(deck, deck, seed);
    for (let i = 0; i < 300 && s.phase === 'playing'; i += 1) {
      const auTourDuJoueur = s.current === 'player' && s.pendingPromotion === null && s.pendingChoice === null;
      if (auTourDuJoueur && legalActions(s).some((a) => a.type === 'attack')) {
        const partie = partieSauvegardee(s, null, { playerDeck: deck, aiDeck: deck });
        if (partie) return { partie, etat: s };
      }
      // La Direction joue sa politique ; le joueur attache un café, sinon passe son tour.
      const legales = legalActions(s);
      const action =
        s.current === 'ai'
          ? nextAiAction(s, 1)
          : (legales.find((a) => a.type === 'attachEnergy') ?? legales.find((a) => a.type === 'endTurn'));
      if (!action) break;
      s = applyAction(s, action);
    }
  }
  throw new Error('aucune partie ne propose de Pression au joueur');
}

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

  it('affiche le Poste et le Banc (labels)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const posteLabels = screen.getAllByText(/Poste/);
    const bancLabels = screen.getAllByText(/Banc/);
    expect(posteLabels.length).toBeGreaterThanOrEqual(2);
    expect(bancLabels.length).toBeGreaterThanOrEqual(2);
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

  it('affiche la ligne des Conditions, sous le plateau : les cinq, par leur nom', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // La légende complète est derrière « Règles » (menu `⋯`) ; la table n'en garde que les noms.
    const ligne = screen.getByText('Conditions').closest('p') as HTMLElement;
    for (const nom of ['Surcharge', 'Épuisement', 'Sieste', 'Immobilisation', 'Dérive']) {
      expect(within(ligne).getByText(nom)).toBeInTheDocument();
    }
    expect(screen.queryByText(/ce qu.un Planqué au Poste peut subir/i)).toBeNull();
  });

  it('ouvre le dialogue Règles depuis le menu, avec la règle de chaque Condition', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Avant d'ouvrir le menu, « Règles » n'est pas à l'écran.
    expect(screen.queryByRole('button', { name: /Règles/i })).toBeNull();
    fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /Règles/i }));

    const dialogue = screen.getByRole('dialog', { name: /Conditions/i });
    expect(dialogue).toHaveTextContent(/10 de Stress par Contrôle/);
    expect(dialogue).toHaveTextContent(/ce qu.un Planqué au Poste peut subir/i);
  });

  it('range Journal, Partie à deux, Règles, Abandonner et Nouveau combat derrière un seul bouton', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Fermé : aucune des cinq entrées n'est sur la table.
    for (const nom of [/Journal/, /Partie à deux/, /Règles/, /^Abandonner$/, /Nouveau combat/]) {
      expect(screen.queryByRole('button', { name: nom }), String(nom)).toBeNull();
    }
    // Ouvert : les cinq, dans le même panneau.
    const menu = menuSurLaListe();
    for (const nom of [/Journal/, /Partie à deux/, /Règles/, /^Abandonner$/, /Nouveau combat/]) {
      expect(within(menu).getByRole('button', { name: nom }), String(nom)).toBeInTheDocument();
    }
  });

  it('le menu est une seule surface : la liste, ou le Journal, ou la Partie à deux', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    menuSurLaVue('Journal');
    let menu = screen.getByRole('region', { name: 'Menu du combat' });
    expect(within(menu).getByRole('heading', { name: 'Journal' })).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: /Nouveau combat/ })).toBeNull();
    expect(within(menu).queryByLabelText(/Code reçu/)).toBeNull();

    menuSurLaVue('Partie à deux');
    menu = screen.getByRole('region', { name: 'Menu du combat' });
    expect(within(menu).queryByRole('heading', { name: 'Journal' })).toBeNull();
    expect(within(menu).getByRole('button', { name: /Créer une partie à deux/i })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Menu du combat' })).toHaveLength(1);
  });

  it('Échap ferme le menu et rend le focus au bouton `⋯`', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const bouton = screen.getByRole('button', { name: 'Menu du combat' });

    menuSurLaVue('Journal');
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
    // Le focus est dans le panneau (le titre de la vue), pas sur le bouton.
    expect(bouton).not.toHaveFocus();

    await userEvent.keyboard('{Escape}');

    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Menu du combat' })).toBeNull();
    expect(bouton).toHaveFocus();
  });

  it('le bouton `⋯` ouvre et ferme le menu', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const bouton = screen.getByRole('button', { name: 'Menu du combat' });

    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
  });

  it('affiche le bouton Nouveau combat dans le menu', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(within(menuSurLaListe()).getByRole('button', { name: /Nouveau combat/i })).toBeInTheDocument();
  });

  it('affiche le bouton Abandonner dans le menu', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(within(menuSurLaListe()).getByRole('button', { name: /Abandonner/i })).toBeInTheDocument();
  });

  it('affiche le Journal dans le menu', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const menu = menuSurLaVue('Journal');
    expect(within(menu).getByRole('heading', { name: 'Journal' })).toBeInTheDocument();
    // Le journal n'est pas une coquille vide : la mise en place y a écrit sa première ligne.
    expect(menu.querySelectorAll('.log li').length).toBeGreaterThan(0);
  });

  it('affiche la Partie à deux dans le menu, avec le bouton Créer', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const menu = menuSurLaVue('Partie à deux');
    expect(within(menu).getByRole('heading', { name: 'Partie à deux' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /Créer une partie à deux/i })).toBeInTheDocument();
  });

  describe('Nouveau combat', () => {
    beforeEach(() => {
      // Une graine fixe : le joueur ouvre, personne n'a joué, la partie est neuve.
      vi.spyOn(Date, 'now').mockReturnValue(42);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('redémarre tout de suite une partie neuve : elle n’a rien à perdre', () => {
      renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

      fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /Nouveau combat/i }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText(/Tour 1/)).toBeInTheDocument();
      expect(menuEstOuvert()).toBe(false);
    });

    it('sur une partie commencée, il demande confirmation — Annuler la garde, confirmer la jette', () => {
      const { partie, tour } = partieCommencee();
      renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
      expect(screen.getByText(new RegExp(`Tour ${tour}\\b`))).toBeInTheDocument();

      fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /Nouveau combat/i }));
      const dialogue = screen.getByRole('dialog', { name: /Recommencer un combat/ });
      // « Annuler » prend le focus : Entrée ne détruit rien par réflexe (DESIGN.md §2.5).
      expect(within(dialogue).getByRole('button', { name: 'Annuler' })).toHaveFocus();

      fireEvent.click(within(dialogue).getByRole('button', { name: 'Annuler' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText(new RegExp(`Tour ${tour}\\b`))).toBeInTheDocument();

      fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /Nouveau combat/i }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nouveau combat' }));
      expect(screen.getByText(/Tour 1\b/)).toBeInTheDocument();
      expect(useStore.getState().partie?.actions.length ?? 0).toBe(0);
    });
  });

  it('affiche le message d\'avertissement si le deck n\'est pas valide — hors du menu', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Visible menu fermé : c'est une information qui change la partie, pas un réglage.
    expect(menuEstOuvert()).toBe(false);
    expect(screen.getByText(/Ton deck n’est pas valide : ce combat utilise un deck de test/)).toBeVisible();
    expect(screen.getByText(/deck de test/i).closest('.combat-menu__panneau')).toBeNull();
  });
});

/**
 * **La barre d'action** (D-093, #191) : les Pressions et « Fin du tour » vivent dans une barre
 * collée au-dessus de la navigation, **toujours présente** — c'est la cible « poste-actions » du
 * pas-à-pas et ce que `npm run capturer` mesure. La géométrie (la main dans la fenêtre à
 * 420 × 900) ne se teste qu'en capture : jsdom ne calcule aucune mise en page.
 */
describe('Battle — la barre d’action (#191)', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('porte « Fin du tour » au tour du joueur, à côté de la main et hors du plateau', async () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    expect(barre).toHaveClass('combat-barre');
    expect(within(barre).getByRole('button', { name: 'Fin du tour' })).toBeInTheDocument();
    // La barre suit la main dans le document : elle est « en bas », après la table.
    expect(
      (container.querySelector('.hand-panel') as Node).compareDocumentPosition(barre) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(container.querySelector('.board')?.contains(barre)).toBe(false);
  });

  it('ne perd rien : une Pression à portée est un bouton de la barre, pas de la main', () => {
    const { partie, etat } = partieAvecPression();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const attaque = legalActions(etat).find((action) => action.type === 'attack');
    const nom = ALL_CARDS.find((carte) => carte.id === etat.players.player.active?.cardId);
    if (attaque?.type !== 'attack' || !nom || !('attacks' in nom)) throw new Error('le Poste du joueur n’a pas de Pression');
    const nomDeLaPression = nom.attacks[attaque.attackIndex]?.name ?? '';
    expect(nomDeLaPression).not.toBe('');
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    const boutons = within(barre).getAllByRole('button');
    // Une Pression : l'icône d'épées, un nom, des dégâts — et « Fin du tour » à côté.
    expect(
      boutons.some((b) => b.className.includes('button--primary') && b.textContent?.includes(nomDeLaPression)),
      `« ${nomDeLaPression} » est un bouton de la barre`
    ).toBe(true);
    expect(within(barre).getByRole('button', { name: 'Fin du tour' })).toBeInTheDocument();
    for (const bouton of boutons) expect(bouton.className).not.toMatch(/hand__card/);
    // Et l'ancienne section « Au Poste » n'existe plus sur la table.
    expect(screen.queryByRole('heading', { name: 'Au Poste' })).toBeNull();
  });

  it('une relève à choisir : la barre ne porte que les relèves, nommées', () => {
    const { partie, etat } = partieAvecReleve();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    expect(barre).toHaveTextContent('Ton Poste a craqué. À toi de choisir ta relève.');
    const boutons = within(barre).getAllByRole('button');
    expect(boutons.length).toBe(legalActions(etat).filter((a) => a.type === 'promoteActive').length);
    for (const bouton of boutons) expect(bouton.textContent).toMatch(/^Relève/);
    // Ni Pression ni « Fin du tour » tant que la relève n'est pas choisie.
    expect(within(barre).queryByRole('button', { name: /Fin du tour/ })).toBeNull();

    fireEvent.click(boutons[0] as HTMLElement);
    expect(screen.getByRole('region', { name: 'Actions du tour' })).not.toHaveTextContent(/Ton Poste a craqué/);
  });

  it('partie terminée : la barre le dit et n’offre aucun geste, le bandeau de fin reste en haut', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /^Abandonner$/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Abandonner/ }));

    await waitFor(() => expect(screen.getByText('Défaite : tu as déclaré forfait.')).toBeInTheDocument());
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    expect(barre).toHaveTextContent('Rien à faire : la partie est terminée.');
    expect(within(barre).queryAllByRole('button')).toHaveLength(0);
  });

  it('au tour de l’autre, en partie à deux : une ligne, « Coller un code », aucun bouton d’action', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(within(menuSurLaVue('Partie à deux')).getByRole('button', { name: /Créer une partie à deux/i }));
    // Je finis mon tour : c'est au camp adverse, tenu par quelqu'un d'autre.
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    fireEvent.click(within(barre).getByRole('button', { name: 'Fin du tour' }));

    const apres = screen.getByRole('region', { name: 'Actions du tour' });
    expect(apres).toHaveTextContent(/C’est au .* de jouer\./);
    // Aucun bouton de jeu : seulement le lien qui rouvre le code.
    const boutons = within(apres).getAllByRole('button');
    expect(boutons.map((b) => b.textContent)).toEqual(['Coller un code']);
    expect(within(apres).queryByRole('button', { name: /Fin du tour|Passer le tour/ })).toBeNull();
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

  it('le défilement suit chaque étape : Suivant et Précédent amènent la première cible sous le pas-à-pas', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false });

    // À l'ouverture : la première cible de l'étape 1.
    expect(elementsDefiles().at(-1)).toBe(cibleDe('plateau'));

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(elementsDefiles().at(-1)).toBe(cibleDe('machine'));
    // **En haut, pas au centre** (#170) : le pas-à-pas occupe le haut de l'écran ; un
    // centrage plaçait la main sous la ligne de flottaison sur téléphone.
    expect(scroll.mock.calls.at(-1)?.[0]).toMatchObject({ block: 'start' });

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(elementsDefiles().at(-1)).toBe(cibleDe('poste-actions'));

    fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(elementsDefiles().at(-1)).toBe(cibleDe('machine'));
  });

  it('la cible se place sous le pas-à-pas : la marge de défilement suit sa hauteur (#170)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    // Une cible défilée en haut est cachée par le pas-à-pas collé : `scroll-margin-top`
    // réserve sa hauteur, mesurée à l'exécution dans `--pas-a-pas-hauteur`.
    expect(css).toMatch(/\[data-pas-a-pas\]\s*\{[^}]*scroll-margin-top:[^;]*--pas-a-pas-hauteur/);

    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false });
    // jsdom n'a pas de mise en page : la hauteur vaut 0, mais la propriété est posée.
    expect(document.documentElement.style.getPropertyValue('--pas-a-pas-hauteur')).toMatch(/px$/);
  });

  it('sur téléphone, le détail du pas-à-pas se replie : le titre reste, « Lire le détail » le déplie (#170)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false });
    const panneau = screen.getByRole('complementary', { name: /Pas-à-pas du combat/i });
    // Le repli ne vaut que sur téléphone : sur un écran large, le détail reste lu d'office.
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toMatch(
      /@media \(max-width: 899px\)\s*\{[\s\S]*?\.pas-a-pas--replie \.pas-a-pas__texte\s*\{\s*display:\s*none/
    );

    expect(panneau).toHaveClass('pas-a-pas--replie');
    const lire = within(panneau).getByRole('button', { name: 'Lire le détail' });
    expect(lire).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(lire);
    expect(panneau).not.toHaveClass('pas-a-pas--replie');
    expect(within(panneau).getByRole('button', { name: 'Replier' })).toHaveAttribute('aria-expanded', 'true');
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
  const LIBELLES_DE_POSE = /^(Poser au Poste|Mettre au Banc \d|Jouer cet Objet|Jouer ce Collègue|Faire évoluer|Changement de priorité)/;

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
    fireEvent.click(screen.getByRole('region', { name: 'Plateau' }));
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

/**
 * **La fin d'une partie à deux, des deux côtés** (#127).
 *
 * Une partie à deux se termine comme une partie solo, et le bandeau doit le dire **sans
 * ambiguïté** : « tu » et « l'autre camp », jamais « la Direction », qui est le mot du
 * solo (D-049 impose un PvP sans serveur : le camp de celui qui lit vient du code, pas
 * d'une session).
 *
 * Comment l'écran est mis dans l'état voulu : une partie **terminée** ne se range pas
 * (`partieSauvegardee` rend `null`), donc elle ne se reprend pas. Le chemin réel est
 * celui du #128 — un **code de partie** collé, que `joinMatch` rejoue (D-049). On
 * construit donc un code par le moteur, en jouant la Direction avec sa politique
 * (`nextAiAction`, seedé), et l'écran l'affiche comme le ferait un invité.
 */
describe('Battle — la fin d’une partie à deux (#127)', () => {
  /** Deux Decks légaux, ceux du simulateur : le codec les valide avant de rejouer. */
  const MINE = factionDeck('MANAGEMENT');
  const THEIRS = factionDeck('ATELIER');

  /** Le code d'une partie à deux, dans l'état qu'elle décrit (vivant ou terminé). */
  function codeDe(state: BattleState): string {
    return encodeMatch({
      seed: state.seed,
      playerDeck: MINE,
      aiDeck: THEIRS,
      playerCafeTypes: state.players.player.cafeTypes,
      aiCafeTypes: state.players.ai.cafeTypes,
      actions: state.actionLog
    });
  }

  /**
   * Le code d'une partie **terminée pour `raison` par le camp qui gagne** : la graine
   * est figée, donc la partie est la même à chaque exécution. Si le moteur ou la
   * politique change et que plus aucune partie ne finit ainsi, le test dit de
   * réancrer la graine au lieu d'échouer sur une assertion incompréhensible.
   */
  function codeDuneFin(raison: 'interventions' | 'plateauVide', seed: number): string {
    let state: BattleState = createBattle(MINE, THEIRS, seed, {}, { deuxCamps: true });
    for (let etape = 0; etape < 400; etape += 1) {
      const legal = legalActions(state).filter((action) => action.type !== 'forfeit');
      for (const action of legal) {
        const apres = applyAction(state, action);
        // `winner === current` : c'est le coup du camp qui gagne, donc le code collé
        // me donne son camp — le point de vue du vainqueur.
        if (apres.phase === 'ended' && apres.endReason === raison && apres.winner === state.current) {
          return codeDe(apres);
        }
      }
      if (state.phase === 'ended') break;
      const next: BattleAction = nextAiAction(state, 1) ?? legal[0];
      const applied = applyAction(state, next);
      if (applied === state) break;
      state = applied;
    }
    throw new Error(`aucune fin « ${raison} » à la graine ${seed} : réancrer la graine de ce test`);
  }

  /** Coller un code, comme l'invité : le champ, puis le bouton (#128). */
  function coller(code: string) {
    // Le champ de collage vit dans la vue « Partie à deux » du menu.
    menuSurLaVue('Partie à deux');
    fireEvent.change(screen.getByLabelText(/Code reçu/), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: /Prendre le camp adverse/i }));
  }

  it('trois Interventions terminent la partie, et le bandeau nomme le vainqueur', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    coller(codeDuneFin('interventions', 1));

    // Le vainqueur, la raison, et **le vocabulaire du PvP** : « la Direction » n'apparaît
    // pas dans le bandeau d'une partie à deux.
    const bandeau = screen.getByText('Victoire : 3 Interventions.');
    expect(bandeau).toHaveClass('notice--ok');
    expect(bandeau.textContent).not.toMatch(/Direction/);
  });

  it('une partie sans aucun Planqué se termine aussi, et le bandeau dit pourquoi', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    coller(codeDuneFin('plateauVide', 153));

    expect(screen.getByText('Victoire : l’autre camp n’a plus aucun Planqué.')).toBeInTheDocument();
  });

  it('l’abandon tombe sur le camp qui le déclare, et l’écran le dit des deux côtés', () => {
    // Une graine figée : la partie à deux se crée depuis l'horloge.
    vi.spyOn(Date, 'now').mockReturnValue(42);
    try {
      // **Le camp Toi se couche.** « la Direction » n'est pas mentionnée : en partie à
      // deux, l'adversaire est quelqu'un, et c'est *lui* qui gagne.
      const mienne = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
      fireEvent.click(within(menuSurLaVue('Partie à deux')).getByRole('button', { name: /Créer une partie à deux/i }));
      fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /^Abandonner$/ }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Abandonner/ }));

      const defaite = screen.getByText('Défaite : tu as déclaré forfait.');
      expect(defaite).toHaveClass('notice--warn');
      expect(defaite.textContent).not.toMatch(/Direction/);
      mienne.unmount();

      // **L'autre camp se couche**, et je tiens `player` : la partie terminée arrive par
      // le code, la défaite est celle du camp adverse, la victoire est la mienne.
      renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
      let vivante: BattleState | null = null;
      for (let seed = 1; seed < 500 && vivante === null; seed += 1) {
        const essai = createBattle(MINE, THEIRS, seed, {}, { deuxCamps: true });
        if (essai.current === 'player') vivante = essai;
      }
      // La garde n'est pas décorative : sans partie au tour du joueur, `forfeit` qui
      // nomme `ai` n'est plus la défaite de l'autre camp.
      expect(vivante, 'aucune graine ne laisse la main au joueur').not.toBeNull();
      const finie = applyAction(vivante as BattleState, { type: 'forfeit', who: 'ai' });
      expect(finie.winner).toBe('player');
      expect(finie.endReason).toBe('forfait');

      coller(codeDe(finie));

      expect(screen.getByText('Victoire : l’autre camp déclare forfait.')).toBeInTheDocument();
    } finally {
      vi.restoreAllMocks();
    }
  });
});

/**
 * **Le code d'une partie à deux sur un téléphone** (#128) : un geste pour copier, et un
 * message qui ne mente pas quand le presse-papier refuse.
 *
 * Le presse-papier n'est pas un détail d'ergonomie : `navigator.clipboard` **manque**
 * sur une page servie en clair et sur des navigateurs de téléphone anciens, et un
 * `writeText` peut être **refusé** (permission, geste non reconnu). L'ancien code faisait
 * `navigator.clipboard?.writeText(code).then(…)` : sans l'API, l'expression vaut
 * `undefined` et `.then` **lève**, donc l'invité ne recevait ni code copié ni message —
 * juste une erreur. Ces deux tests tiennent les deux branches.
 */
describe('Battle — le code sur téléphone : copier, coller (#128)', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
  });
  /** Le presse-papier du navigateur : `setup-jsdom.ts` en pose un, on le remplace. */
  function pressePapier(valeur: unknown) {
    (navigator as unknown as Record<string, unknown>).clipboard = valeur;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    // On rend le presse-papier que `src/test/setup-jsdom.ts` installe.
    pressePapier({ writeText: vi.fn().mockResolvedValue(undefined) });
  });

  /** Crée une partie à deux et va jusqu'au code à transmettre (fin de mon tour). */
  function codeATransmettre(): HTMLTextAreaElement {
    fireEvent.click(within(menuSurLaVue('Partie à deux')).getByRole('button', { name: /Créer une partie à deux/i }));
    // Créer rend la table au joueur : le menu se ferme, et se rouvre seul quand le code est prêt.
    expect(menuEstOuvert()).toBe(false);
    const finDuTour = screen.queryByRole('button', { name: /Fin du tour/i });
    if (finDuTour) fireEvent.click(finDuTour);
    return screen.getByLabelText(/Code de la partie, à transmettre/i) as HTMLTextAreaElement;
  }

  it('la Partie à deux s’ouvre seule quand un code est prêt — une fois par code', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const zone = codeATransmettre();

    // Ouvert tout seul, sur la vue qui porte le code : l'invité n'a rien cherché.
    expect(menuEstOuvert()).toBe(true);
    expect(within(screen.getByRole('region', { name: 'Menu du combat' })).getByRole('heading', { name: 'Partie à deux' }))
      .toBeInTheDocument();
    expect(zone.value).toMatch(/^PLQ1\./);

    // Il le referme : un rendu qui ne change pas le code ne le rouvre pas.
    fireEvent.click(screen.getByRole('button', { name: 'Menu du combat' }));
    expect(menuEstOuvert()).toBe(false);
    const carte = document.querySelector<HTMLElement>('button.hand__card');
    if (carte) fireEvent.click(carte);
    expect(menuEstOuvert()).toBe(false);
  });

  it('copie le code en un geste quand le presse-papier accepte', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    pressePapier({ writeText });

    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const zone = codeATransmettre();
    expect(zone.value).toMatch(/^PLQ1\./);

    fireEvent.click(screen.getByRole('button', { name: /Copier le code/i }));

    await waitFor(() => expect(screen.getByText(/Code copié/)).toBeInTheDocument());
    // C'est **le code affiché** qui part, pas une copie recomposée ailleurs.
    expect(writeText).toHaveBeenCalledWith(zone.value);
  });

  it('sans presse-papier, ne prétend pas avoir copié et sélectionne le code', () => {
    // Le cas d'une page servie en clair : l'API n'existe pas.
    pressePapier(undefined);

    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const zone = codeATransmettre();

    fireEvent.click(screen.getByRole('button', { name: /Copier le code/i }));

    const message = screen.getByText(/presse-papier a refusé/i);
    expect(message.textContent).not.toMatch(/Code copié/);
    expect(message.textContent).toMatch(/recopie-le à la main/i);
    // Le repli est le code lui-même : il est sélectionné, prêt à être copié à la main.
    expect(zone.selectionStart).toBe(0);
    expect(zone.selectionEnd).toBe(zone.value.length);
  });

  it('un code long se colle entier, et le clavier du téléphone ne le corrige pas', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    menuSurLaVue('Partie à deux');
    const champ = screen.getByLabelText(/Code reçu, à coller/i) as HTMLTextAreaElement;
    // Les attributs qui empêchent un clavier de téléphone de « corriger » le code.
    expect(champ).toHaveAttribute('autocapitalize', 'off');
    expect(champ).toHaveAttribute('autocorrect', 'off');
    expect(champ).toHaveAttribute('spellcheck', 'false');

    // Un code d'une partie entière fait plus de 2 000 caractères : il doit tenir entier
    // dans le champ (la mise en page, elle, se juge sur la capture, #128).
    const long = `PLQ1.${'a'.repeat(2100)}`;
    fireEvent.change(champ, { target: { value: long } });
    expect(champ.value).toHaveLength(long.length);
  });
});

describe('Battle — la scène : la piste d’Interventions (#190)', () => {
  it('remplace le score ★★☆ par six hexagones, trois par camp, dans le plateau', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const plateau = container.querySelector('.board') as HTMLElement;
    // Le score ne se lit plus en étoiles : une étoile est une rareté (`1S`, `2S`, `3S`).
    expect(plateau.textContent ?? '').not.toMatch(/[★☆]/);
    expect(within(plateau).getAllByRole('img', { name: /^Intervention \d sur 3, / })).toHaveLength(6);
    expect(within(plateau).getByRole('img', { name: 'Intervention 1 sur 3, Toi' })).toBeInTheDocument();
    expect(within(plateau).getByRole('img', { name: 'Intervention 3 sur 3, La Direction' })).toBeInTheDocument();
  });

  it('désigne la piste par le pas-à-pas une seule fois, sur son conteneur', () => {
    const scrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
    try {
      renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false });
      // L'étape « La fin » désigne les Interventions : on y va par le bouton « Suivant ».
      for (let i = 1; i < ETAPES_COMBAT.length; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
      const designes = document.querySelectorAll('[data-pas-a-pas="interventions"]');
      expect(designes).toHaveLength(1);
      expect(designes[0]).toHaveAttribute('role', 'group');
    } finally {
      Element.prototype.scrollIntoView = scrollIntoView;
    }
  });
});
