// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Battle, libelleDuTour } from './Battle';
import { renderWithStore, setupTestStore } from '@/test/test-utils';
import { menuEstOuvert, menuSurLaListe, menuSurLaVue } from '@/test/menu-combat';
import { ETAPES_COMBAT } from '@/components/pas-a-pas-combat-etapes';
import { ALL_CARDS, isBasic, isPlanque } from '@/data';
import type { BattleAction, BattleState } from '@/data/types';
import type { PartieSauvegardee } from '@/store/partie';
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

/**
 * Une partie où **mon** Poste vient de craquer : la relève est à choisir (D-030).
 *
 * **Mémoïsée** : la recherche est déterministe (graines 1, 2, 3… et aucune horloge), donc
 * la refaire à chaque appel rend le même résultat. Elle coûtait **33 s** pour la page
 * entière, appelée six fois ; le cache la ramène à une seule recherche par scénario.
 */
let cacheReleve: { partie: unknown; etat: unknown } | null = null;
function partieAvecReleve() {
  if (cacheReleve) return cacheReleve as { partie: PartieSauvegardee; etat: BattleState };
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  for (let seed = 1; seed < 300; seed += 1) {
    let s: BattleState = createBattle(deck, deck, seed);
    for (let i = 0; i < 400 && s.phase === 'playing'; i += 1) {
      if (s.pendingPromotion === 'player' && legalActions(s).some((a) => a.type === 'promoteActive')) {
        const partie = partieSauvegardee(s, null, { playerDeck: deck, aiDeck: deck });
        if (partie) {
          cacheReleve = { partie, etat: s };
          return { partie, etat: s };
        }
      }
      const legales = legalActions(s).filter((a) => a.type !== 'forfeit');
      const action =
        s.current === 'ai' && !s.pendingPromotion
          ? nextAiAction(s, 'scripte')
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

/** Un tour du joueur où une Pression est à portée : la barre doit la porter. Mémoïsée, même raison. */
let cachePression: { partie: unknown; etat: unknown } | null = null;
function partieAvecPression() {
  if (cachePression) return cachePression as { partie: PartieSauvegardee; etat: BattleState };
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  for (let seed = 1; seed < 400; seed += 1) {
    let s: BattleState = createBattle(deck, deck, seed);
    for (let i = 0; i < 300 && s.phase === 'playing'; i += 1) {
      const auTourDuJoueur = s.current === 'player' && s.pendingPromotion === null && s.pendingChoice === null;
      if (auTourDuJoueur && legalActions(s).some((a) => a.type === 'attack')) {
        const partie = partieSauvegardee(s, null, { playerDeck: deck, aiDeck: deck });
        if (partie) {
          cachePression = { partie, etat: s };
          return { partie, etat: s };
        }
      }
      // La Direction joue sa politique ; le joueur attache un café, sinon passe son tour.
      const legales = legalActions(s);
      const action =
        s.current === 'ai'
          ? nextAiAction(s, 'scripte')
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

  it("affiche l'indicateur de tour (à toi / à la Direction)", () => {
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

  it('dit les types de café de la Machine en texte, pas seulement au survol (#187)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Le `title` a disparu : le contenu est écrit (lu, pas affiché) à chaque Machine.
    expect(screen.getAllByText(/Machine à café : .*types du Deck/).length).toBeGreaterThanOrEqual(2);
    expect(document.querySelectorAll('.bench__slot[title], [title^="Machine à café"]')).toHaveLength(0);
  });

  it('retrouve une même carte au Poste et au Banc, chacune par son nom accessible (#187)', () => {
    // Un deck légal (deux exemplaires de dix Entrants). On cherche une graine où, à la mise en
    // place, mon Poste et mon Banc portent le **même** Entrant : c'est le cas à tester.
    const entrants = ALL_CARDS.filter((card) => isPlanque(card) && isBasic(card) && !card.variantOf).slice(0, 10);
    const deck = entrants.flatMap((card) => [card.id, card.id]);
    const entrant = entrants[0];
    let etat: BattleState | null = null;
    for (let seed = 1; seed < 500 && etat === null; seed += 1) {
      const s = createBattle(deck, deck, seed);
      const moi = s.players.player;
      if (moi.active?.cardId === entrant.id && moi.bench.some((carte) => carte?.cardId === entrant.id)) etat = s;
    }
    if (etat === null) throw new Error('aucune graine ne met le même Entrant au Poste et au Banc');
    const partie = partieSauvegardee(etat, null, { playerDeck: deck, aiDeck: deck });
    if (!partie) throw new Error('partie terminée : rien à rendre');

    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    // La Direction est le premier camp du plateau, moi le second : je regarde le mien.
    const moi = document.querySelectorAll('.board__side')[1];
    if (!(moi instanceof HTMLElement)) throw new Error('mon camp n’est pas sur le plateau');
    // Une carte du plateau est un **bouton** : elle porte le geste (l'inspecteur s'ouvre au
    // clic) et son nom accessible est celui du Planqué (#286, T3). `group` laissait croire à
    // un groupe inerte tout en la rendant focusable — le rôle ne disait pas qu'on agit dessus.
    const cartes = within(moi).getAllByRole('button', { name: entrant.name });
    expect(cartes.length).toBeGreaterThanOrEqual(2);
    expect(cartes.some((carte) => carte.closest('.board__poste'))).toBe(true);
    expect(cartes.some((carte) => carte.closest('.bench'))).toBe(true);
  });

  it('empile les camps : la Direction lit Banc puis Poste, moi Poste puis Banc, les Postes se font face (#199)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Le plateau range la Direction d'abord, moi ensuite (`Battle.tsx`, `[otherCamp, myCamp]`).
    const [adverse, moi] = Array.from(document.querySelectorAll('.board__side'));
    const suit = (avant: Element | null, apres: Element | null) =>
      Boolean(avant && apres && avant.compareDocumentPosition(apres) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(suit(adverse.querySelector('.board__bench'), adverse.querySelector('.board__poste'))).toBe(true);
    expect(suit(moi.querySelector('.board__poste'), moi.querySelector('.board__bench'))).toBe(true);
  });

  it('affiche la main du joueur', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Ta main/)).toBeInTheDocument();
  });

  it('ne pose plus la rangée des Conditions sur le plateau : un lien de la barre d’état l’ouvre (#199)', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // La rangée des cinq a quitté le flux du plateau : ni ligne, ni noms en dehors d'un dialogue.
    expect(container.querySelector('.board__conditions')).toBeNull();
    expect(container.querySelector('.board')?.textContent).not.toMatch(/Dérive/);

    // Le lien de la barre d'état ouvre la légende, avec les cinq par leur nom et leur règle.
    fireEvent.click(screen.getByRole('button', { name: 'Conditions' }));
    const dialogue = screen.getByRole('dialog', { name: /Conditions/i });
    for (const nom of ['Surcharge', 'Épuisement', 'Sieste', 'Immobilisation', 'Dérive']) {
      expect(within(dialogue).getByText(nom)).toBeInTheDocument();
    }
    expect(dialogue).toHaveTextContent(/ce qu.un Planqué au Poste peut subir/i);
  });

  it('ouvre le dialogue Règles depuis le menu, avec la règle de chaque Condition', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Avant d'ouvrir le menu, « Règles » n'est pas à l'écran.
    expect(screen.queryByRole('button', { name: /Règles/i })).toBeNull();
    fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /Règles/i }));

    // Le menu ouvre **les règles en une minute** (#270) : la légende des Conditions y est,
    // à la suite des étapes — un seul panneau, deux contenus.
    const dialogue = screen.getByRole('dialog', { name: /règles en une minute/i });
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

  it('le panneau du menu se superpose : il s’accroche à la barre d’état, hors du plateau (#289, T6)', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const barreEtat = container.querySelector('.battle__head') as HTMLElement;
    const plateau = container.querySelector('.board') as HTMLElement;

    fireEvent.click(screen.getByRole('button', { name: 'Menu du combat' }));
    const panneau = screen.getByRole('region', { name: 'Menu du combat' });

    // Le panneau est **enfant de la barre d'état**, jamais du plateau : son ouverture n'insère
    // rien dans le flux des cartes, donc le plateau ne saute pas (le défaut du vrac du 27/10).
    expect(barreEtat.contains(panneau)).toBe(true);
    expect(plateau.contains(panneau)).toBe(false);
    expect(plateau.querySelectorAll('.combat-menu__panneau, .combat-menu__liste')).toHaveLength(0);

    // Et la feuille de style le sort du flux : superposition, pas poussée du contenu.
    const regle =
      readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8').match(
        /\n\.combat-menu__panneau \{([^}]*)\}/
      )?.[1] ?? '';
    expect(regle).toMatch(/position:\s*absolute/);
  });

  it('« Abandonner » passe par le menu, et « Annuler » garde le focus du dialogue de forfait (#289, T6)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Le geste destructeur n'est pas dans le menu : il ouvre le dialogue de confirmation.
    fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /^Abandonner$/ }));
    const dialogue = screen.getByRole('dialog', { name: /Déclarer forfait/i });
    expect(within(dialogue).getByRole('button', { name: 'Annuler' })).toHaveFocus();
    expect(within(dialogue).getByRole('button', { name: 'Abandonner' })).not.toHaveFocus();

    // Annuler referme sans rien détruire : la barre d'action garde ses gestes.
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      within(screen.getByRole('region', { name: 'Actions du tour' })).getAllByRole('button').length
    ).toBeGreaterThan(0);
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

  it('signale le deck de test sur la fiche de ton camp, hors du menu et sans ligne dédiée (D-103)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Visible menu fermé : c'est une information qui change la partie, pas un réglage.
    expect(menuEstOuvert()).toBe(false);
    // L'étiquette est lue en entier (#243 : elle a quitté sa ligne de 30 px, pas son texte).
    const phrase = screen.getByText(/Ton deck n’est pas valide : ce combat utilise un deck de test/);
    expect(phrase.closest('.combat-menu__panneau')).toBeNull();
    // Elle vit dans la fiche **du joueur** — jamais celle de la Direction — et pas dans une `.notice`.
    const etiquette = phrase.closest('.board__test');
    expect(etiquette).not.toBeNull();
    expect(etiquette?.closest('.board__fiche')).not.toBeNull();
    expect(etiquette?.closest('.notice')).toBeNull();
    expect(document.querySelectorAll('.board__test')).toHaveLength(1);
    expect(screen.getByText('deck de test')).toBeInTheDocument();
  });

  it("n'affiche aucune étiquette de deck de test quand le deck du joueur est valide", () => {
    renderWithStore(<Battle />, {
      tutorielVu: true,
      pasAPasCombatVu: true,
      deck: autoDeck(Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]))).deck
    });
    expect(document.querySelectorAll('.board__test')).toHaveLength(0);
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
      (container.querySelector('.hand-panel') as Node).compareDocumentPosition(barre) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(container.querySelector('.board')?.contains(barre)).toBe(false);
  });

  it('la dernière ligne du journal vit dans la barre d’action, et seule la barre porte le bandeau (#199)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    // « Lancer de tampon : tu ouvres. » — la graine fixe (42) donne au joueur l'ouverture.
    expect(barre.querySelector('.combat-barre__journal')).toHaveTextContent('Lancer de tampon : tu ouvres.');
    // Aucun bandeau n'est resté au-dessus du plateau.
    for (const bandeau of document.querySelectorAll('.banner')) expect(barre.contains(bandeau)).toBe(true);
  });

  it('« Fin du tour » est sur la ligne de tête, jamais dans la rangée des gestes, Pression jouable ou non (#320)', () => {
    // Une Pression jouable rallongeait la rangée des gestes ; « Fin du tour », dedans, passait sur une
    // seconde rangée sous la barre de navigation (420 × 900). La position se mesure en capture
    // (`npm run capturer`) ; ici, le contrat de structure : l'action principale n'est pas dans la
    // rangée qui grandit, et cette rangée ne porte aucune Pression en double.
    const { partie } = partieAvecPression();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    const tete = barre.querySelector('.combat-barre__tete') as HTMLElement;
    const gestes = barre.querySelector('.combat-barre__gestes') as HTMLElement;
    expect(tete).not.toBeNull();
    expect(gestes).not.toBeNull();
    expect(within(tete).getByRole('button', { name: 'Fin du tour' })).toBeInTheDocument();
    expect(within(gestes).queryByRole('button', { name: 'Fin du tour' })).toBeNull();
    expect(gestes.querySelector('.button--primary'), 'la Pression est dans la rangée des gestes').not.toBeNull();
    // La phrase du journal partage la ligne de « Fin du tour » : elle ne lui prend pas une ligne de plus.
    expect(tete.querySelector('.combat-barre__journal')).not.toBeNull();
    expect(tete.compareDocumentPosition(gestes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ne perd rien : une Pression à portée est un bouton de la barre, pas de la main', () => {
    const { partie, etat } = partieAvecPression();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const attaque = legalActions(etat).find((action) => action.type === 'attack');
    const nom = ALL_CARDS.find((carte) => carte.id === etat.players.player.active?.cardId);
    if (attaque?.type !== 'attack' || !nom || !('attacks' in nom))
      throw new Error('le Poste du joueur n’a pas de Pression');
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

  it('tient sur une ligne : le titre et « Suivant » ; « Plus » déplie Précédent, Passer et le détail (#199)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false });
    const panneau = screen.getByRole('complementary', { name: /Pas-à-pas du combat/i });

    // La ligne : le titre de l'étape et « Suivant », rien d'autre.
    const ligne = panneau.querySelector('.pas-a-pas__ligne') as HTMLElement;
    expect(within(ligne).getByRole('heading', { name: 'Le Poste et le Banc' })).toBeInTheDocument();
    expect(within(ligne).getByRole('button', { name: 'Suivant' })).toBeInTheDocument();

    // Replié : « Plus » dit qu'il ne déplie rien encore ; le reste est là, sous ses doigts.
    const plus = within(panneau).getByRole('button', { name: 'Plus' });
    expect(plus).toHaveAttribute('aria-expanded', 'false');
    const reste = panneau.querySelector('.pas-a-pas__reste') as HTMLElement;
    expect(reste).toContainElement(within(panneau).getByRole('button', { name: 'Précédent' }));
    expect(reste).toContainElement(within(panneau).getByRole('button', { name: 'Passer le pas-à-pas' }));

    fireEvent.click(plus);
    expect(plus).toHaveAttribute('aria-expanded', 'true');

    // « Lire le détail » déplie le texte de l'étape, et seulement lui.
    expect(panneau).not.toHaveClass('pas-a-pas--detail');
    const lire = within(panneau).getByRole('button', { name: 'Lire le détail' });
    expect(lire).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(lire);
    expect(panneau).toHaveClass('pas-a-pas--detail');
    expect(within(panneau).getByRole('button', { name: 'Replier le détail' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('« Passer le pas-à-pas », replié dans « Plus », ferme le pas-à-pas', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false });
    const panneau = screen.getByRole('complementary', { name: /Pas-à-pas du combat/i });
    fireEvent.click(within(panneau).getByRole('button', { name: 'Plus' }));
    fireEvent.click(within(panneau).getByRole('button', { name: 'Passer le pas-à-pas' }));
    expect(screen.queryByRole('complementary', { name: /Pas-à-pas du combat/i })).toBeNull();
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
  const LIBELLES_DE_POSE =
    /^(Poser au Poste|Mettre au Banc \d|Jouer cet Objet|Jouer ce Collègue|Faire évoluer|Changement de priorité)/;

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

    const gestes = within(panneau)
      .getAllByRole('button')
      .filter((b) => !/Reprendre/.test(b.textContent ?? ''));
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
 * (`nextAiAction`, seedé), et l'écran l'affiche comme le ferait un testeur.
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
      actions: state.actionLog.map((entree) => entree.action)
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
      const next: BattleAction = nextAiAction(state, 'scripte') ?? legal[0];
      const applied = applyAction(state, next);
      if (applied === state) break;
      state = applied;
    }
    throw new Error(`aucune fin « ${raison} » à la graine ${seed} : réancrer la graine de ce test`);
  }

  /**
   * **La graine, figée** — parce que la chercher coûtait une minute.
   *
   * Ces deux valeurs sont le résultat d'une recherche **déterministe** (la boucle partait de
   * 1) : les rejouer à chaque exécution rend le même code, et ne prouve rien de plus.
   * Mesuré le 28/10/2026 : `plateauVide` demandait de balayer **506** graines, chacune jusqu'à
   * 400 étapes en essayant **toutes** les actions légales — un seul test frisait les 60 s et
   * expirait sous charge.
   *
   * Si le moteur ou la politique change au point qu'une graine ne finit plus ainsi,
   * `codeDuneFin` **jette** et dit de réancrer : c'est le comportement voulu, un échec nommé
   * plutôt qu'une assertion incompréhensible.
   */
  const GRAINE_INTERVENTIONS = 2;
  // Réancrée le 28/10/2026 (#417) : les Decks MANAGEMENT / ATELIER ont changé, la graine 506
  // ne finit plus en `plateauVide`. Balayage de 1 à 600 : 7, 86, 87, 132, 139.
  const GRAINE_PLATEAU_VIDE = 7;

  /** Coller un code, comme le testeur : le champ, puis le bouton (#128). */
  function coller(code: string) {
    // Le champ de collage vit dans la vue « Partie à deux » du menu.
    menuSurLaVue('Partie à deux');
    fireEvent.change(screen.getByLabelText(/Code reçu/), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: /Prendre le camp adverse/i }));
  }

  it('trois Interventions terminent la partie, et le bandeau nomme le vainqueur', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    coller(codeDuneFin('interventions', GRAINE_INTERVENTIONS));

    // Le vainqueur, la raison, et **le vocabulaire du PvP** : « la Direction » n'apparaît
    // pas dans le bandeau d'une partie à deux.
    const bandeau = screen.getByText('Victoire : 3 Interventions.');
    expect(bandeau).toHaveClass('notice--ok');
    expect(bandeau.textContent).not.toMatch(/Direction/);
  });

  it('une partie sans aucun Planqué se termine aussi, et le bandeau dit pourquoi', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    coller(codeDuneFin('plateauVide', GRAINE_PLATEAU_VIDE));

    expect(screen.getByText('Victoire : l’autre camp n’a plus aucun Planqué.')).toBeInTheDocument();
    // Graine figée : le balayage de 506 graines qui la trouvait est tombé le 28/10/2026
    // (il frisait les 60 s). Le test repasse sous la seconde.
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
 * `undefined` et `.then` **lève**, donc le testeur ne recevait ni code copié ni message —
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

    // Ouvert tout seul, sur la vue qui porte le code : le testeur n'a rien cherché.
    expect(menuEstOuvert()).toBe(true);
    expect(
      within(screen.getByRole('region', { name: 'Menu du combat' })).getByRole('heading', { name: 'Partie à deux' })
    ).toBeInTheDocument();
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
      for (let i = 1; i < ETAPES_COMBAT.length; i += 1)
        fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
      const designes = document.querySelectorAll('[data-pas-a-pas="interventions"]');
      expect(designes).toHaveLength(1);
      expect(designes[0]).toHaveAttribute('role', 'group');
    } finally {
      Element.prototype.scrollIntoView = scrollIntoView;
    }
  });
});

describe('Battle — la bascule d’infos et ses raccourcis (#189, SPEC-COMBAT-UI §4)', () => {
  const boutonInfos = () => screen.getByRole('button', { name: 'Infos détaillées' });

  it('le bouton ⓘ est dans la barre d’état, porte le raccourci, et bascule sobre / détaillé', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const bouton = boutonInfos();
    expect(bouton).toHaveAttribute('aria-keyshortcuts', 'I');
    expect(bouton).toHaveAttribute('aria-pressed', 'false');
    expect(bouton.closest('.battle__head')).not.toBeNull();
    expect(container.querySelector('.battle')).toHaveClass('battle--sobre');

    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute('aria-pressed', 'true');
    expect(useStore.getState().combatDetaille).toBe(true);
    expect(container.querySelector('.battle')).toHaveClass('battle--detaille');

    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute('aria-pressed', 'false');
    expect(useStore.getState().combatDetaille).toBe(false);
  });

  it('`I` et `Ctrl`+`I` font la même chose, annotations comprises', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Le geste ne change pas qu'un attribut : c'est la densité du plateau qui bascule.
    expect(container.querySelector('.poste__carte .card__attacks .attack__name')).toBeNull();
    fireEvent.keyDown(document, { key: 'i' });
    expect(boutonInfos()).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.poste__carte .card__attacks .attack__name')).not.toBeNull();

    fireEvent.keyDown(document, { key: 'i', ctrlKey: true });
    expect(boutonInfos()).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('.poste__carte .card__attacks .attack__name')).toBeNull();

    // L'alias reste permanent : un utilisateur de dictée n'est jamais coincé avec la touche nue.
    fireEvent.keyDown(document, { key: 'I', ctrlKey: true });
    expect(boutonInfos()).toHaveAttribute('aria-pressed', 'true');
  });

  it('décochés dans Réglages, `I` et `Ctrl`+`I` ne font plus rien (SC 2.1.4)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Le réglage se coupe en cours de partie (Réglages, `setRaccourcisCombat`) : c'est la
    // **désactivation** qu'exige le critère, pas seulement un état de départ.
    act(() => useStore.getState().setRaccourcisCombat(false));

    fireEvent.keyDown(document, { key: 'i' });
    fireEvent.keyDown(document, { key: 'i', ctrlKey: true });
    expect(boutonInfos()).toHaveAttribute('aria-pressed', 'false');

    // Le bouton visible, lui, reste le chemin tactile : c'est ce que le critère exige.
    fireEvent.click(boutonInfos());
    expect(boutonInfos()).toHaveAttribute('aria-pressed', 'true');
  });

  it('dans les deux champs du code de partie à deux, taper « i » reste un « i »', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    menuSurLaVue('Partie à deux');
    const recu = screen.getByLabelText(/Code reçu, à coller/i) as HTMLTextAreaElement;
    await userEvent.type(recu, 'i');
    expect(recu.value).toBe('i');
    expect(boutonInfos()).toHaveAttribute('aria-pressed', 'false');

    // La seconde zone : le code à transmettre, quand un tour vient de finir.
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Menu du combat' })).getByRole('button', {
        name: /Créer une partie à deux/i
      })
    );
    const fin = screen.queryByRole('button', { name: /Fin du tour/i });
    if (fin) fireEvent.click(fin);
    const transmis = screen.getByLabelText(/Code de la partie, à transmettre/i) as HTMLTextAreaElement;
    fireEvent.keyDown(transmis, { key: 'i' });
    fireEvent.keyDown(transmis, { key: 'i', ctrlKey: true });
    expect(boutonInfos()).toHaveAttribute('aria-pressed', 'false');
  });

  it('en `sobre`, les annotations partent ; les décisions restent', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Ce qui reste : qui est au Poste, la barre de Stress, les Interventions et le tour.
    expect(container.querySelector('.poste__carte')).not.toBeNull();
    expect(container.querySelector('.poste__carte .card__seuil-bar')).not.toBeNull();
    expect(container.querySelectorAll('[role="img"][aria-label^="Intervention"]')).toHaveLength(6);
    expect(screen.getByText(/Tour 1/)).toBeInTheDocument();

    // Ce qui part : le chiffre du Stress, les Pressions de la carte, les types de café.
    expect(container.querySelector('.card__stress-chiffre')).toBeNull();
    expect(container.querySelector('.poste__carte .card__attacks')).toBeNull();
    expect(container.querySelector('.poste__machine-types')).toBeNull();
    expect(container.querySelector('.status-chip__nom')).toBeNull();
  });

  it('en `détaillé`, les annotations reviennent — et les décisions ne bougent pas', () => {
    const { container } = renderWithStore(<Battle />, {
      tutorielVu: true,
      pasAPasCombatVu: true,
      combatDetaille: true
    });

    expect(container.querySelector('.poste__carte .card__attacks .attack__name')).not.toBeNull();
    expect(container.querySelector('.card__stress-chiffre')?.textContent).toMatch(/^\d+\/\d+$/);
    expect(container.querySelector('.poste__machine-types')).not.toBeNull();
    expect(container.querySelector('.poste__carte .card__seuil-bar')).not.toBeNull();
    expect(container.querySelectorAll('[role="img"][aria-label^="Intervention"]')).toHaveLength(6);
    expect(screen.getByText(/Tour 1/)).toBeInTheDocument();
  });
});

describe('Battle — la main est un éventail de cartes du gabarit (#200, SPEC-COMBAT-UI §6.8 R1)', () => {
  const css = () => readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('chaque carte de la main est le gabarit, et reste un bouton qui porte le geste', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const boutons = Array.from(container.querySelectorAll<HTMLElement>('.hand button.hand__card'));
    expect(boutons.length).toBeGreaterThan(0);
    // Une carte visible par bouton : le gabarit (`CardView`), masqué aux lecteurs d'écran, le bouton lu.
    expect(container.querySelectorAll('.hand__visuel .card')).toHaveLength(boutons.length);
    expect(container.querySelector('.hand__visuel')).toHaveAttribute('aria-hidden', 'true');
    for (const bouton of boutons) {
      expect(bouton).toHaveAttribute('aria-pressed');
      expect(bouton.querySelector('.hand__name')?.textContent ?? '').not.toBe('');
    }
  });

  it('la main est rognée par son conteneur, pas par l’écran : hauteur fixe et overflow caché', () => {
    const regle = css().match(/\n\.hand \{([^}]*)\}/)?.[1] ?? '';
    expect(regle).toMatch(/overflow:\s*hidden/);
    // La **hauteur fixe** est le contrat (les cartes se rognent dedans) ; sa valeur exacte ne
    // l'est pas : #203 l'a fait passer de 4,5 à 4 rem pour rendre de la marge de hauteur.
    expect(regle).toMatch(/height:\s*(calc\([^)]*\)|[\d.]+rem)/);
  });

  it('la carte du Poste reste plus large qu’une carte de la main (hiérarchie, R4)', () => {
    const rem = (nom: string) => {
      const valeur = css().match(new RegExp(`${nom}:\\s*([\\d.]+)rem`))?.[1];
      return valeur ? Number(valeur) : Number.NaN;
    };
    // Le Poste (`--poste-w`) domine : une carte de main plus large que lui inverserait la hiérarchie.
    expect(rem('--poste-w')).toBeGreaterThan(rem('--carte-w'));
  });

  it('le nom d’une carte du plateau ne se coupe plus n’importe où : pas de `overflow-wrap: anywhere`', () => {
    const regle = css().match(/\n\.card--plateau \.card__name \{([^}]*)\}/)?.[1] ?? '';
    expect(regle).not.toMatch(/overflow-wrap:\s*anywhere/);
  });

  /**
   * **La règle de #233 est codifiable, sa mesure ne l'est pas** : jsdom ne met pas en page, donc
   * aucun test ici ne peut constater qu'un mot est coupé. Ce qui **peut** mordre est la règle
   * écrite — césure automatique sur la carte de main, langue de la page qui la rend possible,
   * et le chiffre de D-094 (1) qui ne bouge pas. La mesure vit dans
   * `docs/preuves/main-64px-2026-10-26/` et dans `npm run capturer`.
   */
  it('à 64 px, le nom de la main se coupe à la césure de la langue — et la carte reste à 4 rem (#233)', () => {
    const nom = css().match(/\n\.battle \.hand \.card--plateau \.card__name \{([^}]*)\}/)?.[1] ?? '';
    // Sans `hyphens: auto`, la césure manuelle du plateau revient et « PRÉVENT EUR » avec elle.
    expect(nom).toMatch(/hyphens:\s*auto/);
    // La césure automatique n'existe que si la langue de la page est connue : `<html lang="fr">`.
    expect(readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')).toMatch(/<html lang="fr"/);
    // D-094 (1) : le chiffre ne bouge pas, la marge de hauteur de D-094 (3) non plus.
    const carteDeMain = css().match(/\n\.hand \{([^}]*)\}/)?.[1] ?? '';
    expect(carteDeMain).toMatch(/--carte-w:\s*4rem/);
  });
});

/**
 * Les effets de la référence et leur repli (#192, `SPEC-COMBAT-UI` §6.8). Les durées et
 * le compteur vivent dans `effets-combat.ts` ; ici on vérifie **le branchement** : le
 * réglage du store arrive au CSS, une carte de la main ne se soulève pas sans mouvement,
 * et une Pression laisse bien un chiffre de Stress sur la table.
 */
describe('Battle — les effets de la scène et leur repli (#192)', () => {
  it('« Mouvement réduit » du store porte une classe et un attribut que le CSS lit', () => {
    const { container, unmount } = renderWithStore(<Battle />, {
      tutorielVu: true,
      pasAPasCombatVu: true,
      reducedMotion: true
    });
    const page = container.querySelector('.battle');
    expect(page).toHaveClass('battle--mouvement-reduit');
    expect(page).toHaveAttribute('data-mouvement-reduit', 'true');
    unmount();

    const autre = renderWithStore(<Battle />, {
      tutorielVu: true,
      pasAPasCombatVu: true,
      reducedMotion: false
    });
    expect(autre.container.querySelector('.battle')).not.toHaveClass('battle--mouvement-reduit');
    expect(autre.container.querySelector('.battle')).toHaveAttribute('data-mouvement-reduit', 'false');
  });

  it('sous mouvement réduit, le survol d’une carte de la main ouvre l’inspecteur au lieu de la soulever', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true });

    const carte = document.querySelector<HTMLElement>('.hand > li');
    if (!carte) throw new Error('la main ne porte aucune carte');
    const nom = carte.querySelector('.hand__name')?.textContent ?? '';
    expect(nom).not.toBe('');

    fireEvent.pointerEnter(carte, { pointerType: 'mouse' });

    const panneau = await screen.findByRole('dialog');
    expect(panneau).toHaveAccessibleName(nom);
  });

  it('une Pression affiche le chiffre de Stress près de la carte touchée', () => {
    const { partie, etat } = partieAvecPression();
    const { container } = renderWithStore(<Battle />, {
      tutorielVu: true,
      pasAPasCombatVu: true,
      reducedMotion: true,
      partie
    });
    const attaque = legalActions(etat).find((action) => action.type === 'attack');
    const definition = ALL_CARDS.find((carte) => carte.id === etat.players.player.active?.cardId);
    if (attaque?.type !== 'attack' || !definition || !('attacks' in definition)) {
      throw new Error('le Poste du joueur n’a pas de Pression');
    }
    const nom = definition.attacks[attaque.attackIndex]?.name ?? '';

    fireEvent.click(screen.getByRole('button', { name: new RegExp(nom) }));

    // Sous mouvement réduit, le chiffre est là, immobile : la classe sans animation est la
    // preuve que c'est bien le repli, pas une animation qui aurait fini avant l'assertion.
    const chiffre = container.querySelector<HTMLElement>('.stress-flottant');
    expect(chiffre).not.toBeNull();
    expect(chiffre).toHaveClass('is-fixe');
    expect(chiffre?.textContent).toMatch(/^\+\d+$/);
  });

  it('un changement de tour allume la pile de Deck qui vient de piocher', () => {
    const { partie } = partieCommencee();
    const { container } = renderWithStore(<Battle />, {
      tutorielVu: true,
      pasAPasCombatVu: true,
      reducedMotion: true,
      partie
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fin du tour' }));

    expect(container.querySelector('.pile--deck.is-piochante')).not.toBeNull();
  });

  it('« Fin du tour » change de libellé et de teinte avec la main (T10, #293)', () => {
    const { partie } = partieCommencee();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true, partie });

    // À toi : le libellé court, la teinte « à toi ».
    const aToi = screen.getByRole('button', { name: 'Fin du tour' });
    expect(aToi).toHaveClass('button--fin', 'is-a-toi');
    expect(aToi).not.toHaveClass('is-direction');

    // En attente : le tour passe à la Direction avant que son délai ne l'ait fait jouer.
    fireEvent.click(aToi);
    const enAttente = screen.getByRole('button', { name: /Passer le tour de la Direction/ });
    expect(enAttente).toHaveClass('button--fin', 'is-direction');
    expect(enAttente).not.toHaveClass('is-a-toi');
  });
});

/**
 * **T3 — le plateau en cartes, sans perdre le pas-à-pas** (#286, `SPEC-COMBAT-UI` §8 T3).
 *
 * L'« avant » de la vague 1 montre déjà des cartes au Poste et au Banc (`docs/preuves/
 * combat-ui-2026-10-27/avant/420-combat.png`, D-093) : ce que T3 ajoute, c'est le **mode
 * `calme`** (`CardView`, #285) et le **nom accessible** qui rend une carte trouvable comme
 * un bouton. Les trois assertions du ticket sont ici, et le pas-à-pas n'a pas bougé.
 */
describe('Battle — le plateau en cartes, sans perdre le pas-à-pas (T3, #286)', () => {
  it('ne garde qu’un `title=` dans la page : celui du bandeau de deck de test', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/Battle.tsx'), 'utf8');
    // Le `title` est le pire des trois supports : il ne s'ouvre ni au clavier ni au doigt. Ce qui
    // était dit par un `title` est soit écrit, soit lu par le nom accessible.
    expect(source.match(/title=/g) ?? []).toHaveLength(1);
  });

  it('rend le Poste et le Banc comme des boutons nommés par la carte', () => {
    // Une graine où **mon** Poste et **mon** Banc portent le même Secouriste : c'est la carte
    // du critère du ticket. Deux exemplaires de dix Entrants font un Deck légal.
    const entrants = ALL_CARDS.filter((card) => isPlanque(card) && isBasic(card) && !card.variantOf);
    const secouriste = entrants.find((card) => card.name === 'Secouriste');
    if (!secouriste) throw new Error('le Secouriste a disparu des données');
    const dix = [secouriste, ...entrants.filter((card) => card.id !== secouriste.id).slice(0, 9)];
    const deck = dix.flatMap((card) => [card.id, card.id]);

    let etat: BattleState | null = null;
    for (let seed = 1; seed < 500 && etat === null; seed += 1) {
      const s = createBattle(deck, deck, seed);
      const moi = s.players.player;
      if (moi.active?.cardId === secouriste.id && moi.bench.some((carte) => carte?.cardId === secouriste.id)) etat = s;
    }
    if (etat === null) throw new Error('aucune graine ne met le même Secouriste au Poste et au Banc');
    const partie = partieSauvegardee(etat, null, { playerDeck: deck, aiDeck: deck });
    if (!partie) throw new Error('partie terminée : rien à rendre');

    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const moi = document.querySelectorAll('.board__side')[1];
    if (!(moi instanceof HTMLElement)) throw new Error('mon camp n’est pas sur le plateau');
    const boutons = within(moi).getAllByRole('button', { name: /Secouriste/ });
    expect(boutons.some((bouton) => bouton.closest('.board__poste') !== null)).toBe(true);
    expect(boutons.some((bouton) => bouton.closest('.bench') !== null)).toBe(true);
  });

  it('garde les 7 cibles du pas-à-pas, et les cartes du plateau sont calmes et compactes', () => {
    const cibles = new Set(ETAPES_COMBAT.flatMap((etape) => etape.cibles));
    // Sept cibles distinctes, et pas une de moins : le pas-à-pas est le seul mode d'emploi de
    // l'écran, et la refonte du plateau ne l'a pas raccourci.
    expect([...cibles]).toHaveLength(7);

    // La **graine** vient du test, pas de l'horloge (#392) : un combat neuf lancé sans
    // partie reprise prend `Date.now()` et le plateau change de milliseconde en milliseconde.
    // On range donc une partie **déterministe** (dix Entrants en double : le Poste et le Banc
    // sont garnis pour les deux camps), rejouée par le chemin existant `partie` → `reprendrePartie`.
    const entrants = ALL_CARDS.filter((card) => isPlanque(card) && isBasic(card) && !card.variantOf);
    const deck = entrants.slice(0, 10).flatMap((card) => [card.id, card.id]);
    const partie = partieSauvegardee(createBattle(deck, deck, 392), null, { playerDeck: deck, aiDeck: deck });
    if (!partie) throw new Error('partie terminée : rien à rendre');

    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const cartes = container.querySelectorAll('.poste__carte .card, .bench__carte .card');
    expect(cartes.length).toBeGreaterThanOrEqual(4);
    for (const carte of cartes) {
      // `calme` (#285) : la carte porte le gabarit réduit qu'il impose — et, sur le plateau,
      // le dépouillement de `card--plateau` — sans aucune micro-animation : une carte de
      // plateau ne se soulève pas au passage du pointeur.
      expect(carte).toHaveClass('card--compact');
      expect(carte).toHaveClass('card--plateau');
      expect(carte).toHaveClass('card--figee');
    }
  });
});

/**
 * **La sortie du combat** (D-142, #427) : un geste, qui n'est **jamais** un forfait. La barre du haut
 * et celle du bas sont effacées en combat sur téléphone : la flèche de l'en-tête est le chemin.
 */
describe('Battle — la sortie du combat (D-142, #427)', () => {
  // La graine de `createBattle` vient de l'horloge : figée, le joueur ouvre (comme « la barre d'action »).
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function combatDepuis(origine: string) {
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true });
    return render(
      <MemoryRouter initialEntries={[origine, '/battle']} initialIndex={1}>
        <Routes>
          <Route path="/" element={<p>page Accueil</p>} />
          <Route path="/deck" element={<p>page Deck</p>} />
          <Route path="/battle" element={<Battle />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('revient là d’où l’on vient, et la partie reste rangée — ce n’est pas un forfait', async () => {
    combatDepuis('/deck');
    // Un coup joué : la partie est rangée dans le store (#126). Un forfait la terminerait, et une
    // partie terminée n'y reste pas — c'est ce qui fait mordre l'assertion finale.
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Actions du tour' })).getByRole('button', { name: 'Fin du tour' })
    );
    await waitFor(() => expect(useStore.getState().partie).not.toBeNull());
    const avant = useStore.getState().partie;

    fireEvent.click(screen.getByRole('link', { name: 'Quitter le combat, la partie est gardée' }));

    expect(await screen.findByText('page Deck')).toBeInTheDocument();
    expect(useStore.getState().partie).not.toBeNull();
    expect(useStore.getState().partie?.actions.length).toBeGreaterThanOrEqual(avant?.actions.length ?? 0);
  });

  it('mène à l’accueil quand rien ne précède le combat (lien direct)', async () => {
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true });
    render(
      <MemoryRouter initialEntries={['/battle']}>
        <Routes>
          <Route path="/" element={<p>page Accueil</p>} />
          <Route path="/battle" element={<Battle />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('link', { name: 'Quitter le combat, la partie est gardée' }));
    expect(await screen.findByText('page Accueil')).toBeInTheDocument();
  });
});

/**
 * **Qui joue**, dans l'en-tête (#424) : le harnais de partie jouée a vu « à la Direction » pendant
 * que le testeur devait choisir sa relève. Le libellé suit `campToAct`, comme les boutons.
 */
describe('Battle — le libellé du tour suit le camp qui doit agir (#424)', () => {
  it('une relève du joueur, pendant le tour de la Direction, est « à toi » ; le contrôle mord', () => {
    const deck = autoDeck(Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]))).deck;
    const base = createBattle(deck, deck, 42);
    const releve: BattleState = { ...base, phase: 'playing', current: 'ai', pendingPromotion: 'player' };
    expect(libelleDuTour(releve)).toBe('à toi');
    // Sans relève, c'est bien le tour de la Direction : le libellé n'est pas figé sur « à toi ».
    expect(libelleDuTour({ ...releve, pendingPromotion: null })).toBe('à la Direction');
    expect(libelleDuTour({ ...releve, phase: 'ended' })).toBe('partie terminée');
  });
});
