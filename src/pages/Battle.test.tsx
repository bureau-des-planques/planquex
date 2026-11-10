// @vitest-environment jsdom
// Lent : chaque cas rejoue un combat dans jsdom, avec ses attentes (`waitFor`) et ses étapes de pas-à-pas ; le coût est le rendu.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, screen, fireEvent, waitFor, within, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { libelleDuTour } from '@/combat/presentation';
import { Battle } from './Battle';
import { renderWithStore, setupTestStore } from '@/test/test-utils';
import { menuEstOuvert, menuSurLaListe, menuSurLaVue } from '@/test/menu-combat';
import { ETAPES_COMBAT, premierePhrase } from '@/components/pas-a-pas-combat-etapes';
import { delaiDeRetournement, DUREE_OUVERTURE_MS, useEffetsDeCombat } from '@/components/effets-combat';
import { ALL_CARDS, isBasic, isPlanque } from '@/data';
import type { BattleAction, BattleState, PlayerId, PlayerState } from '@/data/types';
import { HAND_LIMIT } from '@/game/rules';
import { cardName } from '@/combat/cartes';
import type { PartieSauvegardee } from '@/store/partie';
import { encodeMatch } from '@/game/codec';
import { autoDeck } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { DEFAULT_SEARCH_OPTIONS, nextAiAction, nextSearchAction } from '@/game/ia';
import { factionDeck } from '@/game/simulation';
import { partieSauvegardee } from '@/store/partie';
import { Camp } from '@/combat/plateau';
import type { PasAPasCombatEtat } from '@/components/use-pas-a-pas-combat';
import { useStore } from '@/store/useStore';
import { deckLegal } from '@/game/deck';
import { choisirReplique } from '@/game/repliques-direction';

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

/**
 * Un tour du joueur où une carte de la main se pose **au Banc** (critique du 01/11/2026) : la
 * place libre du plateau doit être la cible du `playBasic`, sans passer par le panneau.
 * Mémoïsée, même raison que les deux autres : la recherche est déterministe et lente à refaire.
 */
let cacheBanc: { partie: unknown; etat: unknown } | null = null;
function partieAvecPlaceAuBanc() {
  if (cacheBanc) return cacheBanc as { partie: PartieSauvegardee; etat: BattleState };
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  for (let seed = 1; seed < 240; seed += 1) {
    let s: BattleState = createBattle(deck, deck, seed);
    for (let i = 0; i < 400 && s.phase === 'playing'; i += 1) {
      const auTourDuJoueur = s.current === 'player' && s.pendingPromotion === null && s.pendingChoice === null;
      const placeLibre = s.players.player.bench.some((place) => !place);
      if (
        auTourDuJoueur &&
        placeLibre &&
        legalActions(s).some((a) => a.type === 'playBasic' && typeof a.slot === 'number')
      ) {
        const partie = partieSauvegardee(s, null, { playerDeck: deck, aiDeck: deck });
        if (partie) {
          cacheBanc = { partie, etat: s };
          return { partie, etat: s };
        }
      }
      const action =
        s.pendingPromotion === 'player'
          ? legalActions(s).find((a) => a.type === 'promoteActive')
          : s.pendingChoice?.who === 'player'
            ? legalActions(s).find((a) => a.type === 'choose')
            : (nextAiAction(s, 'scripte') ?? legalActions(s).find((a) => a.type === 'endTurn'));
      if (!action) break;
      s = applyAction(s, action);
    }
  }
  throw new Error('aucune partie ne laisse une carte à poser au Banc');
}

/**
 * Une partie rangée où la main de `camp` porte exactement `n` cartes (#747). Une seule passe
 * remplit **tous** les cas (deux camps × 1, HAND_LIMIT) : chaque état vu est noté, la première
 * fois qu'il porte la taille voulue. Coups déterministes (graine + rang), Direction scriptée.
 * Mémoïsée, même raison que les autres scénarios.
 */
// Pas de main vide par le jeu : 300 graines, deux politiques de coups, aucun état à 0 carte n'est atteint
// (la pioche se refait à chaque tour). Le cas 0 se pose donc **à la main** sur un état valide (voir
// `rendreCamp`) : on vide `hand` d'un état réel, sans rien changer au moteur.
const TAILLES_DE_MAIN = [1, HAND_LIMIT];
const cacheMains = new Map<string, { partie: PartieSauvegardee; etat: BattleState }>();
function partieAvecMain(camp: PlayerId, n: number): { partie: PartieSauvegardee; etat: BattleState } {
  const cle = `${camp}:${n}`;
  const dejaVu = cacheMains.get(cle);
  if (dejaVu) return dejaVu;
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  for (let seed = 1; seed < 300; seed += 1) {
    let s: BattleState = createBattle(deck, deck, seed);
    for (let i = 0; i < 300 && s.phase === 'playing'; i += 1) {
      if (s.pendingPromotion === null && s.pendingChoice === null) {
        for (const id of ['player', 'ai'] as const) {
          for (const taille of TAILLES_DE_MAIN) {
            const cleNoter = `${id}:${taille}`;
            if (cacheMains.has(cleNoter) || s.players[id].hand.length !== taille) continue;
            const partie = partieSauvegardee(s, null, { playerDeck: deck, aiDeck: deck });
            if (partie) cacheMains.set(cleNoter, { partie, etat: s });
          }
        }
        const trouve = cacheMains.get(cle);
        if (trouve) return trouve;
      }
      const legales = legalActions(s).filter((a) => a.type !== 'forfeit');
      // Une graine sur deux joue tout ce qui se pose (la main peut se vider) ; l'autre passe souvent.
      const jouables = seed % 2 === 0 ? legales.filter((a) => a.type !== 'endTurn') : legales;
      const choix = jouables.length > 0 ? jouables : legales;
      const action =
        (s.current === 'ai' && !s.pendingPromotion && !s.pendingChoice ? nextAiAction(s, 'scripte') : null) ??
        choix[(i + seed) % Math.max(choix.length, 1)];
      if (!action) break;
      s = applyAction(s, action);
    }
  }
  throw new Error(`aucune partie ne porte une main de ${n} carte(s) pour ${camp}`);
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

  it('range Partie à deux, Règles, Abandonner et Nouveau combat derrière un seul bouton', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Fermé : aucune des quatre entrées n'est sur la table.
    for (const nom of [/Partie à deux/, /Règles/, /^Abandonner$/, /Nouveau combat/]) {
      expect(screen.queryByRole('button', { name: nom }), String(nom)).toBeNull();
    }
    // Ouvert : les quatre, dans le même panneau.
    const menu = menuSurLaListe();
    for (const nom of [/Partie à deux/, /Règles/, /^Abandonner$/, /Nouveau combat/]) {
      expect(within(menu).getByRole('button', { name: nom }), String(nom)).toBeInTheDocument();
    }
  });

  it('le menu est une seule surface : la liste, ou la Partie à deux', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    menuSurLaVue('Partie à deux');
    let menu = screen.getByRole('region', { name: 'Menu du combat' });
    expect(within(menu).getByRole('heading', { name: 'Partie à deux' })).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: /Nouveau combat/ })).toBeNull();
    expect(within(menu).getByRole('button', { name: /Créer une partie à deux/i })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Menu du combat' })).toHaveLength(1);

    menu = menuSurLaListe();
    expect(within(menu).queryByRole('heading', { name: 'Partie à deux' })).toBeNull();
    expect(within(menu).queryByLabelText(/Code reçu/)).toBeNull();
    expect(within(menu).getByRole('button', { name: /Nouveau combat/ })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Menu du combat' })).toHaveLength(1);
  });

  it('Échap ferme le menu et rend le focus au bouton `⋯`', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const bouton = screen.getByRole('button', { name: 'Menu du combat' });

    menuSurLaVue('Partie à deux');
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

  it('dit POURQUOI le deck est refusé, et pas seulement qu’il l’est (#251, revue du 29/10)', () => {
    // Le bandeau disait « ton deck n'est pas valide » sans jamais nommer la règle violée, alors
    // que `deckLegal` la connaît. Un refus qui n'explique pas ne s'apprend pas : le testeur ne
    // sait pas s'il manque des cartes, s'il en a trop, ou s'il a trop d'exemplaires du même nom.
    const store = useStore.getState();
    store.setDeck(['sse-infirmier-site']);

    renderWithStore(<Battle />, {
      tutorielVu: true,
      pasAPasCombatVu: true,
      deck: ['sse-infirmier-site']
    });

    const raisons = deckLegal(['sse-infirmier-site']).reasons;
    expect(raisons.length).toBeGreaterThan(0);
    const etiquette = screen.getByText(/Ton deck n’est pas valide/);
    for (const raison of raisons) expect(etiquette.textContent).toContain(raison);
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
 * **Les actions du tour** (D-093, #191 ; refonte du combat, retour du propriétaire) : les Pressions,
 * les gestes et « Fin du tour » vivent dans une pile **posée sur la table**, à droite et au milieu —
 * jamais sous la main. Le message du tour (portée, café, réplique, attente) est une bulle sous le haut
 * de la table ; une décision qui attend (relève, carte à désigner) reste dans son panneau borné.
 * C'est la cible « poste-actions » du pas-à-pas. La géométrie (la main seule en bas à 420 × 900) ne
 * se teste qu'en capture : jsdom ne calcule aucune mise en page.
 */
describe('Battle — la barre d’action (#191)', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('porte « Fin du tour » au tour du joueur, posé sur la table, hors de la main et du plateau', async () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const actions = screen.getByRole('region', { name: 'Actions du tour' });
    expect(actions).toHaveClass('actions-flottantes');
    expect(within(actions).getByRole('button', { name: 'Fin du tour' })).toBeInTheDocument();
    // Les actions sont des enfants de la table, pas de la console : jamais sous la main (téléphone).
    const table = container.querySelector('.battle__table') as HTMLElement;
    expect(table.contains(actions)).toBe(true);
    expect(container.querySelector('.battle__console')?.contains(actions)).toBe(false);
    expect(container.querySelector('.hand-panel')?.contains(actions)).toBe(false);
    expect(container.querySelector('.board')?.contains(actions)).toBe(false);
    // Aucune barre du bas ne subsiste : la classe d'avant (`combat-barre`) n'est plus rendue.
    expect(container.querySelector('.combat-barre')).toBeNull();
  });

  it('le message du tour n’est jamais dans la pile d’actions', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const actions = screen.getByRole('region', { name: 'Actions du tour' });
    // Le message du tour vit dans sa bulle, jamais dans la pile d'actions.
    expect(actions.querySelector('.combat-toast')).toBeNull();
    expect(actions.querySelector('.combat-barre__portee')).toBeNull();
    expect(actions.querySelector('.combat-barre__repos')).toBeNull();
  });

  it('la dernière ligne du journal est lue par l’annonce, et seule la barre porte le bandeau (#199)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    // « Lancer de tampon : tu ouvres. » — la graine fixe (42) donne au joueur l'ouverture.
    expect(screen.getByTestId('annonce-du-coup')).toHaveTextContent('Lancer de tampon : tu ouvres.');
    // Aucun bandeau n'est resté au-dessus du plateau.
    for (const bandeau of document.querySelectorAll('.banner')) expect(barre.contains(bandeau)).toBe(true);
  });

  it('« Fin du tour » est la première entrée de la pile, la Pression jouable est dessous et seule pleine (#320)', () => {
    // La pile remplace la barre du bas : « Fin du tour » surgit en tête, les Pressions et les gestes
    // suivent en colonne. Une Pression jouable est le seul bouton plein ; « Fin du tour » passe en ardoise
    // (feuille de styles). Le contrôle mord : une Pression qui passe devant « Fin du tour » est refusée.
    const { partie } = partieAvecPression();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const pile = screen.getByRole('region', { name: 'Actions du tour' });
    const boutons = within(pile).getAllByRole('button');
    expect(boutons[0]).toHaveTextContent('Fin du tour');
    expect(pile).toHaveAttribute('data-pression-jouable', 'true');
    const pression = pile.querySelector('.button--primary');
    expect(pression, 'la Pression est dans la pile').not.toBeNull();
    expect(pression?.textContent).not.toMatch(/Fin du tour/);
    expect(pile.querySelectorAll('.button--primary')).toHaveLength(1);
    expect(boutons[0].compareDocumentPosition(pression as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    // Une Pression : l'icône d'épées, un nom, des dégâts — et « Fin du tour » dans la même pile.
    expect(
      boutons.some((b) => b.className.includes('button--primary') && b.textContent?.includes(nomDeLaPression)),
      `« ${nomDeLaPression} » est un bouton de la barre`
    ).toBe(true);
    expect(within(barre).getByRole('button', { name: 'Fin du tour' })).toBeInTheDocument();
    for (const bouton of boutons) expect(bouton.className).not.toMatch(/hand__card/);
    // Et l'ancienne section « Au Poste » n'existe plus sur la table.
    expect(screen.queryByRole('heading', { name: 'Au Poste' })).toBeNull();
  });

  it('une relève à choisir : le panneau borné au-dessus de la table porte les relèves, nommées', () => {
    const { partie, etat } = partieAvecReleve();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    // La décision vit dans la superposition du haut de la table, jamais sous la main.
    const annonce = screen.getByText('Ton Poste a craqué. À toi de choisir ta relève.');
    const panneau = annonce.closest('.combat-superpose') as HTMLElement;
    expect(panneau).not.toBeNull();
    expect(document.querySelector('.battle__console')?.contains(panneau)).toBe(false);
    const boutons = within(panneau).getAllByRole('button');
    expect(boutons.length).toBe(legalActions(etat).filter((a) => a.type === 'promoteActive').length);
    for (const bouton of boutons) expect(bouton.textContent).toMatch(/^Relève/);
    // Ni Pression ni « Fin du tour » tant que la relève n'est pas choisie.
    const pile = screen.getByRole('region', { name: 'Actions du tour' });
    expect(within(pile).queryByRole('button', { name: /Fin du tour/ })).toBeNull();

    fireEvent.click(boutons[0] as HTMLElement);
    expect(screen.queryByText(/Ton Poste a craqué/)).toBeNull();
  });

  it('partie terminée : la barre le dit et n’offre aucun geste, le bandeau de fin reste en haut', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /^Abandonner$/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Abandonner/ }));

    await waitFor(() => expect(screen.getByText('Défaite : tu as déclaré forfait.')).toBeInTheDocument());
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    // **Le verdict est dit une fois** (critique du 01/11/2026) : la barre le répétait sous le
    // bandeau du haut (« Rien à faire : la partie est terminée. »), et à 390 × 664 cette ligne
    // de plus poussait « Nouveau combat » sous le pli. Le bandeau reste seul porteur.
    expect(barre).not.toHaveTextContent('Rien à faire : la partie est terminée.');
    // Aucun geste de jeu : seulement « Nouveau combat », là où l'œil cherche l'action.
    expect(
      within(barre)
        .getAllByRole('button')
        .map((b) => b.textContent?.trim())
    ).toEqual(['Nouveau combat']);
    fireEvent.click(within(barre).getByRole('button', { name: 'Nouveau combat' }));
    // Une partie finie n'a rien à perdre : pas de confirmation, une partie neuve démarre.
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.queryByText('Défaite : tu as déclaré forfait.')).toBeNull());
  });

  it('partie terminée : la bulle du tour ne redit pas « Rien à faire », le verdict reste seul porteur (#561)', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /^Abandonner$/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Abandonner/ }));
    await waitFor(() => expect(screen.getByText('Défaite : tu as déclaré forfait.')).toBeInTheDocument());

    // Cas fautif (#561) : en fin de partie, la phrase d'attente (`idleLine`) rendue dans la bulle
    // `.combat-toast` — c'est ce que fait la mutation de `Battle.tsx` qui retire
    // `state.phase !== 'ended'` du garde. La bulle s'affiche en solo grâce à la réplique de la
    // Direction ; sans ce garde, « Rien à faire : la partie est terminée. » s'y glisse et répète le
    // bandeau du haut. Le test doit donc échouer sous cette mutation.
    const bulle = document.querySelector('.combat-toast') as HTMLElement | null;
    expect(bulle).not.toBeNull();
    expect(bulle).not.toHaveTextContent('Rien à faire');
  });

  it('un lecteur d’écran entend le coup, le tour et le verdict (4.1.3)', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    // La zone d'annonce est **persistante** et porte la dernière ligne du journal.
    const annonce = screen.getByTestId('annonce-du-coup');
    expect(annonce).toHaveAttribute('aria-live', 'polite');
    expect(annonce).toHaveTextContent('Lancer de tampon : tu ouvres.');
    // La ligne du tour s'annonce aussi : le moteur ne journalise pas les tours.
    expect(screen.getByText(/^Tour \d+ ·/)).toHaveAttribute('aria-live', 'polite');

    fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /^Abandonner$/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Abandonner/ }));
    // Le verdict est une alerte (il n'était porté que par un son), et la zone du journal se tait
    // pour ne pas le doubler.
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Défaite : tu as déclaré forfait.'));
    expect(screen.getByTestId('annonce-du-coup')).toBe(annonce);
    expect(annonce.textContent).toBe('');
  });

  it('après un coup, l’annonce porte la ligne que le journal vient d’écrire, sans changer de nœud (4.1.3)', async () => {
    const { partie, etat } = partieAvecPression();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true, partie });
    const annonce = screen.getByTestId('annonce-du-coup');
    expect(annonce).toHaveAttribute('aria-live', 'polite');

    const action = legalActions(etat).find((a) => a.type === 'attack');
    if (action?.type !== 'attack') throw new Error('le scénario doit proposer une Pression');
    const attendue = applyAction(etat, action).log.at(-1);
    expect(attendue, 'le coup écrit une ligne au journal').toBeTruthy();

    // Attendre le tour jouable (même course que les répliques, #617), puis jouer la Pression.
    const bouton = await screen.findByRole('button', { name: new RegExp(nomDeLaPression(etat, action)) });
    fireEvent.click(bouton);

    // Le nœud est le même : un lecteur d'écran entend son contenu changer.
    expect(screen.getByTestId('annonce-du-coup')).toBe(annonce);
    expect(annonce).toHaveTextContent(attendue!);
  });

  it('au tour de l’autre, en partie à deux : une ligne, « Coller un code », aucun bouton d’action', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(within(menuSurLaVue('Partie à deux')).getByRole('button', { name: /Créer une partie à deux/i }));
    // Je finis mon tour : c'est au camp adverse, tenu par quelqu'un d'autre.
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    fireEvent.click(within(barre).getByRole('button', { name: 'Fin du tour' }));

    // Le message du tour (la bulle du haut de la table) dit l'attente ; la pile d'actions se vide.
    const bulle = screen.getByRole('region', { name: 'Le tour' });
    expect(bulle).toHaveTextContent(/C’est au .* de jouer\./);
    // Aucun bouton de jeu : seulement le lien qui rouvre le code.
    const boutons = within(bulle).getAllByRole('button');
    expect(boutons.map((b) => b.textContent)).toEqual(['Coller un code']);
    const pile = screen.getByRole('region', { name: 'Actions du tour' });
    expect(within(pile).queryByRole('button', { name: /Fin du tour|Passer le tour/ })).toBeNull();
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

    // À l'ouverture : la première cible de l'étape 1 — la **main**, puisque la phrase d'entrée
    // dit « touche une carte de ta main, puis choisis où la poser » (critique du 31/10/2026 :
    // l'étape commençait par la géométrie du plateau, et le geste attendu n'était écrit nulle part).
    expect(elementsDefiles().at(-1)).toBe(cibleDe('main'));

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
    const suivant = within(ligne).getByRole('button', { name: 'Suivant' });
    expect(suivant).toBeInTheDocument();
    // **Il ne concurrence pas le jeu** (critique du 31/10/2026) : à l'arrivée, le seul aplat de
    // l'écran doit être celui qui joue — « Fin du tour » —, pas le bouton du tutoriel. Le contrôle
    // mord : remettre `button--primary` sur « Suivant » le fait échouer.
    expect(suivant).not.toHaveClass('button--primary');

    // **La phrase d'entrée est un ordre** (critique du 31/10/2026) : replié, le panneau montre
    // `premierePhrase`, donc la première phrase doit dire *quoi faire*, pas *à quoi ça ressemble*.
    // Le contrôle mord : remettre « Le plateau a deux rangées… » en tête le fait échouer.
    expect(premierePhrase(ETAPES_COMBAT[0].texte)).toMatch(/^Touche une carte de ta main/);

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

  it('montre la phrase de l’étape, même replié ; « Lire le détail » la remplace par le texte entier (30/10/2026)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: false });
    const panneau = screen.getByRole('complementary', { name: /Pas-à-pas du combat/i });
    const etape = ETAPES_COMBAT[0];

    // Replié, le panneau ne montrait que le titre : il montre désormais sa phrase d'entrée.
    const resume = within(panneau).getByText(premierePhrase(etape.texte));
    expect(resume).toHaveClass('pas-a-pas__resume');
    // Le texte entier reste rendu (#199) mais replié : la feuille de style le cache.
    expect(panneau).not.toHaveClass('pas-a-pas--detail');

    fireEvent.click(within(panneau).getByRole('button', { name: 'Plus' }));
    fireEvent.click(within(panneau).getByRole('button', { name: 'Lire le détail' }));
    expect(within(panneau).getByText(etape.texte)).toHaveClass('pas-a-pas__texte');
    // Déplié, la phrase d'entrée laisserait la première ligne du texte en double.
    expect(panneau.querySelector('.pas-a-pas__resume')).toBeNull();
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

  it('la place libre du Banc pose la carte d’un seul geste (critique du 01/11/2026)', async () => {
    const { partie } = partieAvecPlaceAuBanc();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    // La place est **déjà dessinée** : on cherche la carte de la main dont la pose l'ouvre, puis on
    // touche la place elle-même — pas le bouton « Mettre au Banc 2 » du panneau, qui vit plus bas.
    let place: HTMLElement | null = null;
    for (const carte of Array.from(document.querySelectorAll<HTMLElement>('button.hand__card'))) {
      fireEvent.click(carte);
      place = document.querySelector<HTMLElement>('button.bench__place');
      if (place) break;
      fireEvent.click(carte);
    }
    if (!place) throw new Error('aucune place du Banc n’est devenue une cible : le geste a disparu');
    expect(place.getAttribute('aria-label')).toMatch(/^Poser .+ au Banc \d$/);

    const avant = document.querySelectorAll('.bench__carte').length;
    fireEvent.click(place);
    await waitFor(() => expect(document.querySelectorAll('.bench__carte').length).toBe(avant + 1));
  });

  it('choisir une carte la désigne, la nomme et offre des gestes explicites', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const carte = await premiereCarteJouable();
    expect(carte).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('dialog', { name: /Poser la carte choisie/i })).toBeNull();

    fireEvent.click(carte);

    expect(carte).toHaveAttribute('aria-pressed', 'true');
    const panneau = screen.getByRole('dialog', { name: /Poser la carte choisie/i });
    const nom = carte.querySelector('.hand__name')?.textContent ?? '';
    // Le nom est écrit deux fois dans la feuille : dans son titre, et sur la carte en grand (`aria-hidden`).
    expect(within(panneau).getAllByText(nom).length).toBeGreaterThan(0);

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
    expect(screen.queryByRole('dialog', { name: /Poser la carte choisie/i })).toBeNull();
  });

  it('un geste de pose consomme la sélection', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const carte = await premiereCarteJouable();
    fireEvent.click(carte);
    const panneau = screen.getByRole('dialog', { name: /Poser la carte choisie/i });
    const geste = within(panneau)
      .getAllByRole('button')
      .find((b) => LIBELLES_DE_POSE.test(b.textContent ?? ''));
    expect(geste).toBeDefined();
    fireEvent.click(geste as HTMLElement);

    expect(screen.queryByRole('dialog', { name: /Poser la carte choisie/i })).toBeNull();
  });

  it('la feuille de la carte choisie est fixe : choisir une carte ne fait jamais défiler la page (#745)', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const carte = await premiereCarteJouable();
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();

    fireEvent.click(carte);

    screen.getByRole('dialog', { name: /Poser la carte choisie/i });
    // Aucun cadrage de la page : la feuille est `position: fixed` (la garde CSS ci-dessous le lit).
    expect((Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css.match(/\.battle \.carte-grand \{([^}]*)\}/)?.[1] ?? '').toMatch(/position:\s*fixed/);
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
    expect(within(plateau).getByRole('img', { name: 'Intervention 1 sur 3, Toi, à venir' })).toBeInTheDocument();
    expect(
      within(plateau).getByRole('img', { name: 'Intervention 3 sur 3, La Direction, à venir' })
    ).toBeInTheDocument();
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
  const boutonInfos = () => screen.getByRole('button', { name: 'Plus de détail sur les cartes' });

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

  it('un dialogue modal ouvert : `I` ne bascule pas le plateau derrière lui (le contrôle mord : fermé, il rebascule)', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /^Abandonner$/ }));
    const dialogue = screen.getByRole('dialog');
    expect(
      dialogue.closest('[data-slot="dialog-content"]') ??
        dialogue.querySelector('[data-slot="dialog-content"]') ??
        dialogue
    ).toHaveAttribute('data-slot', 'dialog-content');

    fireEvent.keyDown(document, { key: 'i' });
    // Derrière un modal, la page est cachée aux technologies d'assistance : le bouton se lit au DOM.
    expect(document.querySelector('button[aria-keyshortcuts]')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(within(dialogue).getByRole('button', { name: /Annuler/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.keyDown(document, { key: 'i' });
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

  it('en `sobre`, les annotations partent ; les décisions restent — dont le Stress chiffré', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    // Ce qui reste : qui est au Poste, la barre de Stress, les Interventions et le tour.
    expect(container.querySelector('.poste__carte')).not.toBeNull();
    expect(container.querySelector('.poste__carte .card__seuil-bar')).not.toBeNull();
    expect(container.querySelectorAll('[role="img"][aria-label^="Intervention"]')).toHaveLength(6);
    expect(screen.getByText(/Tour 1/)).toBeInTheDocument();

    // **Le Stress chiffré reste, même en `sobre`** (critique du 31/10/2026, P1) : c'est la mesure
    // qui dit à combien du craquage on est, pour une Pression qui termine le tour. Le contrôle
    // mord : le remettre derrière `annotations` le fait disparaître ici.
    expect(container.querySelector('.card__stress-chiffre')?.textContent).toMatch(/^\d+\/\d+$/);

    // Ce qui part : les Pressions de la carte, les types de café, le nom des Conditions.
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
  it('le nom de la main se coupe à la césure de la langue — et la carte garde le chiffre de D-157 (#233)', () => {
    const nom = css().match(/\n\.battle \.hand \.card--plateau \.card__name \{([^}]*)\}/)?.[1] ?? '';
    // Sans `hyphens: auto`, la césure manuelle du plateau revient et « PRÉVENT EUR » avec elle.
    expect(nom).toMatch(/hyphens:\s*auto/);
    // La césure automatique n'existe que si la langue de la page est connue : `<html lang="fr">`.
    expect(readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')).toMatch(/<html lang="fr"/);
    // D-157 amende D-094 (1) : 72 px (4,5 rem) à la référence ; la marge de D-094 (3), elle, ne bouge pas.
    const carteDeMain = css().match(/\n\.hand \{([^}]*)\}/)?.[1] ?? '';
    expect(carteDeMain).toMatch(/--carte-w:\s*4\.5rem/);
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

  it('sous mouvement réduit, le survol d’une carte de la main n’ouvre pas l’inspecteur (D-193 (1), #750)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true });

    const carte = document.querySelector<HTMLElement>('.hand > li');
    if (!carte) throw new Error('la main ne porte aucune carte');
    expect(carte.querySelector('.hand__name')?.textContent ?? '').not.toBe('');

    fireEvent.pointerEnter(carte, { pointerType: 'mouse' });

    expect(document.querySelector('.inspecteur')).toBeNull();
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
    // Le bandeau vit maintenant dans `Camp` (`src/combat/plateau.tsx`) ; la garde suit le composant.
    const source = readFileSync(resolve(process.cwd(), 'src/combat/plateau.tsx'), 'utf8');
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

describe('Battle — le focus après un coup (2.4.3)', () => {
  it('un focus jamais entré dans le combat n’est pas pris d’office', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true });
    // Le camp qui ouvre dépend de la graine : on attend que la main revienne au joueur.
    fireEvent.click(await screen.findByRole('button', { name: 'Fin du tour' }));
    expect(document.activeElement).toBe(document.body);
  });
});

describe('Battle — la carte du plateau se décrit au focus (#525)', () => {
  it('le Poste dit son Stress sur son Seuil, sans ouvrir le panneau', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const postes = [...container.querySelectorAll<HTMLElement>('[role="button"][data-uid]')];
    expect(postes.length).toBeGreaterThan(0);
    for (const poste of postes) expect(poste).toHaveAccessibleDescription(/^\d+ sur \d+ de Stress\./);
  });
});

describe('Battle — la feuille de la carte choisie prend le focus au clavier (#525, #745)', () => {
  it('choisir une carte de la main amène le focus sur « Poser la carte choisie »', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    // Le camp qui ouvre dépend de la graine : on attend le tour du joueur, avec sa main.
    await screen.findByRole('button', { name: 'Fin du tour' });
    const carte = document.querySelector<HTMLButtonElement>('.hand .hand__card');
    expect(carte).not.toBeNull();
    carte!.focus();
    fireEvent.click(carte!);
    await waitFor(() => {
      const feuille = screen.getByRole('dialog', { name: 'Poser la carte choisie' });
      expect(feuille.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toHaveClass('carte-grand__titre');
    });
  });
});

/**
 * **La carte choisie, en grand, et son vol** (#745, retour du propriétaire). Toucher une carte de la
 * main l'agrandit en feuille non modale ; le geste part au toucher, la carte vole vers sa place.
 */
describe('Battle — la carte choisie, en grand, et son vol (#745)', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (Element.prototype as { animate?: unknown }).animate;
  });

  async function premiereCarteJouable(): Promise<HTMLElement> {
    return waitFor(() => {
      const carte = document.querySelector<HTMLElement>('button.hand__card.is-playable');
      if (!carte) throw new Error('aucune carte jouable : la graine fixée ne fait plus ouvrir le joueur');
      return carte;
    });
  }

  it('le panneau `.pose` n’existe plus, et la pastille de la main ne dit que « N / 10 » (#745)', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const carte = await premiereCarteJouable();
    fireEvent.click(carte);

    expect(document.querySelector('.pose')).toBeNull();
    screen.getByRole('dialog', { name: /Poser la carte choisie/i });
    const n = document.querySelectorAll('.hand .hand__carte').length;
    const pastille = document.querySelector('.hand-panel .section__head .muted');
    // **Le contrôle mord** : l'ancienne aide « touche une carte pour la jouer » ferait échouer cette égalité.
    expect(pastille?.textContent?.replace(/\s+/g, ' ').trim()).toBe(`${n} / ${HAND_LIMIT}`);
  });

  it('Échap ferme la feuille et rend le focus à la carte de la main (#745)', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const carte = await premiereCarteJouable();
    fireEvent.click(carte);
    const feuille = screen.getByRole('dialog', { name: /Poser la carte choisie/i });

    fireEvent.keyDown(feuille, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Poser la carte choisie/i })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(carte));
    expect(carte).toHaveAttribute('aria-pressed', 'false');
  });

  it('la feuille est non modale : aucun voile, aucun `aria-modal` (le Banc reste touchable, #745)', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const carte = await premiereCarteJouable();
    fireEvent.click(carte);

    screen.getByRole('dialog', { name: /Poser la carte choisie/i });
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  });

  it('le geste part une seule fois, et la carte vole en moins de 800 ms par transform et opacité seuls', async () => {
    const animer = vi.fn(() => ({ onfinish: null as null | (() => void), cancel: vi.fn() }));
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animer });
    const { partie } = partieAvecPlaceAuBanc();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: false, partie });

    // La place est déjà dessinée : on cherche la carte dont la pose l'ouvre, puis on touche la place.
    let place: HTMLElement | null = null;
    for (const carte of Array.from(document.querySelectorAll<HTMLElement>('button.hand__card'))) {
      fireEvent.click(carte);
      place = document.querySelector<HTMLElement>('button.bench__place');
      if (place) break;
      fireEvent.click(carte);
    }
    if (!place) throw new Error('aucune place du Banc n’est devenue une cible : le geste a disparu');

    const avant = document.querySelectorAll('.bench__carte').length;
    fireEvent.click(place);
    await waitFor(() => expect(document.querySelectorAll('.bench__carte').length).toBe(avant + 1));

    // Le vol part **une fois**, et sa durée tient sous les 800 ms de D-141.
    expect(animer).toHaveBeenCalledTimes(1);
    const [images, options] = animer.mock.calls[0] as unknown as [Record<string, unknown>[], { duration: number }];
    expect(options.duration).toBeLessThanOrEqual(800);
    for (const image of images) {
      for (const propriete of Object.keys(image)) {
        expect(['transform', 'opacity', 'offset', 'easing']).toContain(propriete);
      }
    }
  });

  it('sous « Mouvement réduit », aucun vol : la carte change de place d’un coup, le geste part une fois', async () => {
    const animer = vi.fn(() => ({ onfinish: null as null | (() => void), cancel: vi.fn() }));
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animer });
    const { partie } = partieAvecPlaceAuBanc();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true, partie });

    let place: HTMLElement | null = null;
    for (const carte of Array.from(document.querySelectorAll<HTMLElement>('button.hand__card'))) {
      fireEvent.click(carte);
      place = document.querySelector<HTMLElement>('button.bench__place');
      if (place) break;
      fireEvent.click(carte);
    }
    if (!place) throw new Error('aucune place du Banc n’est devenue une cible : le geste a disparu');

    const avant = document.querySelectorAll('.bench__carte').length;
    fireEvent.click(place);
    await waitFor(() => expect(document.querySelectorAll('.bench__carte').length).toBe(avant + 1));
    expect(animer).not.toHaveBeenCalled();
    expect(document.querySelector('.carte-vol')).toBeNull();
  });
});

describe('Battle — le bouton Infos montre sa touche (#525)', () => {
  it('la pastille affiche « I » sans changer le nom accessible du bouton', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    const bouton = await screen.findByRole('button', { name: 'Plus de détail sur les cartes' });
    const touche = bouton.querySelector<HTMLElement>('.battle__infos-touche');
    expect(touche).not.toBeNull();
    expect(touche!.textContent).toBe('I');
    expect(touche).toHaveAttribute('aria-hidden', 'true');
    expect(bouton).toHaveAccessibleName('Plus de détail sur les cartes');
    expect(within(bouton).queryByText('I')).toBe(touche);
  });
});

/**
 * **Les trois moments, saisis dans une vraie partie solo** (#544) : une victoire, une défaite,
 * et le craquage d'un Planqué de la Direction. Pas d'état forgé : la partie est **rejouée
 * depuis sa graine**, comme le fait l'écran (#126) — ce que le test lit est donc ce que le
 * testeur voit, et le calcul de `evenementQuiParle` est exercé pour de bon.
 *
 * Les graines sont **figées** : la recherche qui les a trouvées coûte une quarantaine de
 * secondes, et elle est déterministe (aucune horloge, aucun `Math.random`). Si le moteur change
 * au point qu'une graine ne produit plus son scénario, le harnais **jette** et dit de la
 * réancrer — un échec nommé, pas une assertion muette.
 */
const GRAINE_VICTOIRE_SOLO = 133;
const GRAINE_DEFAITE_SOLO = 2;
const GRAINE_CRAQUAGE_SOLO = 4;

/** Le Deck des trois scénarios : chaque carte en double, légal des deux côtés. */
function deckDesRepliques(): string[] {
  return autoDeck(Object.fromEntries(ALL_CARDS.map((carte) => [carte.id, 2]))).deck;
}

/**
 * La recherche de l'écran, **sans échéance murale** : rejouer une graine doit être rejouable.
 * `maxMs` est le seul terme non déterministe de la recherche (D-084, #172) — sous charge, le
 * budget de 60 ms coupait la recherche plus tôt, la trajectoire divergeait, et le scénario
 * « victoire depuis la graine 133 » n'existait plus. C'est ce qui faisait échouer ce test au
 * hasard, sur des branches qui ne touchaient pas au combat (#617).
 */
const RECHERCHE_SANS_ECHEANCE = { ...DEFAULT_SEARCH_OPTIONS, maxMs: Number.POSITIVE_INFINITY };

/** Le coup de la Direction pour un rejeu : la recherche de l'écran, privée de son horloge. */
function coupDeLaDirection(s: BattleState): BattleAction | null {
  if (s.pendingPromotion) return nextAiAction(s, 'scripte');
  if (s.current !== 'ai') return null;
  return nextSearchAction(s, RECHERCHE_SANS_ECHEANCE);
}

/** Le coup qui fait avancer une partie : la politique de l'écran pour la Direction, jamais le forfait. */
function coupDeJeu(s: BattleState): BattleAction | null {
  const legales = legalActions(s).filter((action) => action.type !== 'forfeit');
  if (s.pendingPromotion) return legales.find((action) => action.type === 'promoteActive') ?? null;
  if (s.pendingChoice) return legales.find((action) => action.type === 'choose') ?? null;
  if (s.current === 'ai') {
    return coupDeLaDirection(s) ?? legales.find((action) => action.type === 'endTurn') ?? null;
  }
  return (
    legales.find((action) => action.type === 'attack') ??
    legales.find((action) => action.type === 'attachEnergy') ??
    legales.find((action) => action.type === 'playBasic') ??
    legales.find((action) => action.type === 'evolve') ??
    legales.find((action) => action.type === 'endTurn') ??
    null
  );
}

/** Une Pression du joueur dont le résultat satisfait `accepte`, ou `null`. */
function pressionQui(avant: BattleState, accepte: (apres: BattleState) => boolean): BattleAction | null {
  if (avant.current !== 'player' || avant.pendingPromotion || avant.pendingChoice) return null;
  for (const action of legalActions(avant)) {
    if (action.type !== 'attack') continue;
    if (accepte(applyAction(avant, action))) return action;
  }
  return null;
}

interface ScenarioReplique {
  /** La partie rangée **avant** le geste : ce que l'écran reprend au montage. */
  partie: PartieSauvegardee;
  avant: BattleState;
  /** L'état après le geste : c'est lui qui décide de la réplique. */
  apres: BattleState;
  action: BattleAction;
}

const cacheRepliques: Partial<Record<'victoire' | 'defaite' | 'craquage', ScenarioReplique>> = {};

/** Rejoue une graine et s'arrête au premier état où `declencheur` désigne le geste à jouer. */
function rejouerLeScenario(graine: number, declencheur: (avant: BattleState) => BattleAction | null): ScenarioReplique {
  const deck = deckDesRepliques();
  let avant: BattleState = createBattle(deck, deck, graine);
  for (let i = 0; i < 400 && avant.phase === 'playing'; i += 1) {
    const declenche = declencheur(avant);
    const action = declenche ?? coupDeJeu(avant);
    if (!action) break;
    const apres = applyAction(avant, action);
    if (apres === avant) break;
    if (declenche) {
      const partie = partieSauvegardee(avant, null, { playerDeck: deck, aiDeck: deck });
      if (partie) return { partie, avant, apres, action };
      break;
    }
    avant = apres;
  }
  throw new Error(`la graine ${graine} ne produit plus ce scénario : réancrer la graine de ce test`);
}

/** Un solo que **je** gagne sur ma Pression : la troisième Intervention. */
function victoireEnSolo(): ScenarioReplique {
  cacheRepliques.victoire ??= rejouerLeScenario(GRAINE_VICTOIRE_SOLO, (avant) =>
    pressionQui(avant, (apres) => apres.phase === 'ended' && apres.winner === 'player')
  );
  return cacheRepliques.victoire;
}

/** Un solo que la Direction gagne **sur son coup** : elle marque la troisième Intervention. */
function defaiteEnSolo(): ScenarioReplique {
  cacheRepliques.defaite ??= rejouerLeScenario(GRAINE_DEFAITE_SOLO, (avant) => {
    const sienne = coupDeLaDirection(avant);
    if (!sienne) return null;
    const apres = applyAction(avant, sienne);
    return apres.phase === 'ended' && apres.winner === 'ai' ? sienne : null;
  });
  return cacheRepliques.defaite;
}

/** Un solo où ma Pression fait craquer le Poste de la Direction, la partie continuant. */
function craquageEnSolo(): ScenarioReplique {
  cacheRepliques.craquage ??= rejouerLeScenario(GRAINE_CRAQUAGE_SOLO, (avant) =>
    pressionQui(
      avant,
      (apres) =>
        apres.phase === 'playing' &&
        (apres.actionLog.at(-1)?.faits ?? []).some((fait) => fait.type === 'craquage' && fait.camp === 'ai')
    )
  );
  return cacheRepliques.craquage;
}

/** Le nom accessible de la Pression à cliquer, lu sur la carte au Poste (jamais recopié). */
function nomDeLaPression(etat: BattleState, action: BattleAction): string {
  if (action.type !== 'attack') throw new Error('le scénario doit se jouer sur une Pression');
  const definition = ALL_CARDS.find((carte) => carte.id === etat.players.player.active?.cardId);
  if (!definition || !('attacks' in definition)) throw new Error('le Poste du joueur n’a pas de Pression');
  const nom = definition.attacks[action.attackIndex]?.name ?? '';
  expect(nom, 'la Pression du scénario porte un nom').not.toBe('');
  return nom;
}

/**
 * **Les répliques de la Direction hors du tutoriel** (#544) : aux trois moments —
 * craquage encaissé, fin gagnée, fin perdue. Une seule à l'écran, dans la bulle du tour,
 * annoncée par aria-live polie. En partie à deux, jamais pour un joueur humain.
 */
describe('Battle — les répliques de la Direction (#544)', () => {
  it('une victoire en solo fait parler la Direction, et l’annonce n’est pas vide', async () => {
    const { partie, avant, apres, action } = victoireEnSolo();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true, partie });

    // **Attendre le tour jouable, pas le premier rendu** : la reprise monte l'écran, puis livre
    // l'état `playing`. Un `getByRole` synchrone peut cliquer pendant cette transition et rater
    // la Pression ; `findByRole` attend qu'elle soit réellement dans la barre (#617).
    const bouton = await screen.findByRole('button', { name: new RegExp(nomDeLaPression(avant, action)) });
    fireEvent.click(bouton);

    // La ligne vit dans la bulle du tour, et dit la phrase du tour de la fin gagnée.
    const ligne = await screen.findByTestId('replique-direction');
    const attendue = choisirReplique('victoire', apres.turn);
    expect(ligne).toHaveClass('combat-replique');
    expect(ligne).toHaveTextContent(/^La Direction · /);
    expect(ligne).toHaveTextContent(attendue);
    // Et la zone d'annonce la porte, pour le lecteur d'écran.
    const annonce = screen.getByTestId('annonce-replique-direction');
    expect(annonce.textContent).not.toBe('');
    expect(annonce).toHaveTextContent(attendue);
  });

  it('une défaite en solo fait parler la Direction, et l’annonce n’est pas vide', async () => {
    const { partie, apres } = defaiteEnSolo();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true, partie });

    // La Direction joue seule son coup décisif (délai 0 sous mouvement réduit) : rien à cliquer.
    const ligne = await screen.findByTestId('replique-direction');
    const attendue = choisirReplique('defaite', apres.turn);
    expect(ligne).toHaveClass('combat-replique');
    expect(ligne).toHaveTextContent(/^La Direction · /);
    expect(ligne).toHaveTextContent(attendue);
    const annonce = screen.getByTestId('annonce-replique-direction');
    expect(annonce.textContent).not.toBe('');
    expect(annonce).toHaveTextContent(attendue);
  });

  it('le craquage du Poste de la Direction produit une réplique, même si la ligne de relève suit', async () => {
    const { partie, avant, apres, action } = craquageEnSolo();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true, partie });

    // La ligne du journal, elle, est déjà celle de la relève : le craquage se lit dans les faits.
    expect(apres.log.at(-1)).toMatch(/relève/);

    // **Attendre le tour jouable, pas le premier rendu** : même course que le test de victoire
    // ci-dessus ; `findByRole` attend que la Pression soit réellement dans la barre (#617).
    const bouton = await screen.findByRole('button', { name: new RegExp(nomDeLaPression(avant, action)) });
    fireEvent.click(bouton);

    // **Lu juste après le geste** : la Direction relève dans la foulée (délai 0 sous mouvement
    // réduit) et sa relève remplace la réplique — c'est la règle du ticket, une seule à l'écran.
    const ligne = screen.getByTestId('replique-direction');
    const attendue = choisirReplique('craquage', apres.turn);
    expect(ligne).toHaveClass('combat-replique');
    expect(ligne).toHaveTextContent(/^La Direction · /);
    expect(ligne).toHaveTextContent(attendue);
    const annonce = screen.getByTestId('annonce-replique-direction');
    expect(annonce.textContent).not.toBe('');
    expect(annonce).toHaveTextContent(attendue);
  });

  it("en partie à deux, un joueur humain n'hérite jamais des répliques de la Direction", () => {
    const mienne = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(within(menuSurLaVue('Partie à deux')).getByRole('button', { name: /Créer une partie à deux/i }));
    fireEvent.click(within(menuSurLaListe()).getByRole('button', { name: /^Abandonner$/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Abandonner/ }));

    // En partie à deux, pas de réplique de la Direction — et la garde **mord** : la même
    // requête trouve la ligne dans un solo (trois tests ci-dessus).
    expect(screen.queryByTestId('replique-direction')).not.toBeInTheDocument();
    // L'annonce aria-live est vide
    const annonce = screen.getByTestId('annonce-replique-direction');
    expect(annonce.textContent).toBe('');
    mienne.unmount();
  });

  it("la zone d'annonce aria-live pour la réplique existe dans le DOM", () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true });

    const annonce = screen.getByTestId('annonce-replique-direction');
    expect(annonce).toHaveAttribute('aria-live', 'polite');
    expect(annonce).toHaveClass('sr-only');
  });
});

/**
 * Une partie où **mon** Rebut a au moins deux cartes **de noms distincts**, et où c'est mon tour
 * (#739). Le dernier nom et le premier servent à prouver que le Rebut montre **la dernière**.
 * Mémoïsée comme `partieAvecMain` : la recherche est déterministe.
 */
let cacheDefausse: { partie: PartieSauvegardee; etat: BattleState } | null = null;
function partieAvecDefausse(): { partie: PartieSauvegardee; etat: BattleState } {
  if (cacheDefausse) return cacheDefausse;
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  for (let seed = 1; seed < 300; seed += 1) {
    let s: BattleState = createBattle(deck, deck, seed);
    for (let i = 0; i < 1200 && s.phase === 'playing'; i += 1) {
      const defausse = s.players.player.discard;
      const pret =
        s.current === 'player' &&
        s.pendingPromotion === null &&
        s.pendingChoice === null &&
        defausse.length >= 2 &&
        cardName(defausse[0]!.cardId) !== cardName(defausse.at(-1)!.cardId);
      if (pret) {
        const partie = partieSauvegardee(s, null, { playerDeck: deck, aiDeck: deck });
        if (partie) {
          cacheDefausse = { partie, etat: s };
          return cacheDefausse;
        }
      }
      // Les attaques et les Actions d'abord : ce sont elles qui envoient une carte au rebut.
      const rang = (a: BattleAction) =>
        a.type === 'attack' ? 0 : a.type === 'playAction' ? 1 : a.type === 'endTurn' ? 3 : 2;
      const legales = legalActions(s)
        .filter((a) => a.type !== 'forfeit')
        .sort((a, b) => rang(a) - rang(b));
      const action = legales[0];
      if (!action) break;
      s = applyAction(s, action);
    }
  }
  throw new Error('aucune partie avec deux défausses de noms distincts dans les 300 graines');
}

describe('Battle — les piles et l’éventail de dos (#749, #747)', () => {
  /** Le libellé affiché de chaque camp en solo (`campLabel` de Battle.tsx). */
  const LIBELLE: Record<PlayerId, string> = { player: 'Toi', ai: 'La Direction' };
  const cote = (container: HTMLElement, camp: PlayerId) =>
    Array.from(container.querySelectorAll<HTMLElement>('.board__side')).find(
      (side) => side.querySelector('h2')?.textContent === LIBELLE[camp]
    );
  const CROISEMENTS = (['player', 'ai'] as const).flatMap((camp) => TAILLES_DE_MAIN.map((n) => [camp, n] as const));

  it('les piles sortent de la fiche : aucune dans `.board__fiche`, un Deck et un Rebut par camp dans `.piles`', () => {
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(container.querySelectorAll('.board__fiche .pile')).toHaveLength(0);
    expect(container.querySelectorAll('.board__zone > .piles')).toHaveLength(2);
    expect(container.querySelectorAll('.piles .pile--deck')).toHaveLength(2);
    expect(container.querySelectorAll('.piles .pile--rebut')).toHaveLength(2);

    // Le Deck reste un affichage (`role="group"`) ; le Rebut est un bouton qui se consulte (#740).
    const libelles = [
      ...Array.from(container.querySelectorAll('.piles .pile[role="group"]'), (pile) =>
        pile.getAttribute('aria-label')
      ),
      ...Array.from(container.querySelectorAll('.piles button.pile--rebut'), (pile) => pile.getAttribute('aria-label'))
    ];
    expect(libelles.sort()).toEqual(
      [
        `Deck : ${LIBELLE.player}`,
        `Deck : ${LIBELLE.ai}`,
        `Consulter le Rebut : ${LIBELLE.player}`,
        `Consulter le Rebut : ${LIBELLE.ai}`
      ].sort()
    );
  });

  it('l’éventail porte autant de dos que la main de chaque camp, à l’état initial', () => {
    const { partie, etat } = partieCommencee();
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    for (const camp of ['player', 'ai'] as const) {
      const main = etat.players[camp].hand.length;
      expect(main, `main de ${camp}`).toBeGreaterThan(0);
      expect(cote(container, camp)?.querySelectorAll('.eventail__dos')).toHaveLength(main);
    }
  });

  it.each(CROISEMENTS)('camp %s, main de %i : autant de dos, et le compte lu reste juste', (camp, n) => {
    const { partie, etat } = partieAvecMain(camp, n);
    expect(etat.players[camp].hand).toHaveLength(n);
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    expect(cote(container, camp)?.querySelectorAll('.eventail__dos')).toHaveLength(n);
    expect(cote(container, camp)?.querySelector('.board__counts .sr-only')?.textContent).toBe(`main ${n}`);
  });

  /**
   * Le cas **0 carte** (#747) : le jeu n'atteint jamais une main vide (la pioche se refait à chaque tour, 300
   * graines essayées), et une partie rangée se **rejoue** : on ne peut pas l'y poser. On rend donc `Camp`
   * directement sur un état valide dont on vide `hand`, sans rien changer au moteur.
   */
  function rendreCamp(main: PlayerState['hand']) {
    const { etat } = partieCommencee();
    const side: PlayerState = { ...etat.players.ai, hand: main };
    const pasAPas = {
      ouvert: false,
      etape: 0,
      courante: ETAPES_COMBAT[0],
      derniere: false,
      cibles: ''
    } as unknown as PasAPasCombatEtat;
    return {
      etat,
      ...render(
        <Camp
          label="Direction"
          side={side}
          current={false}
          mine={false}
          pendingPromotion={false}
          pasAPas={pasAPas}
          inspecte={null}
          detaille={false}
          onInspecter={() => {}}
        />
      )
    };
  }

  it('main vide (0 carte) : aucun dos, et le compte lu dit « main 0 » (#747)', () => {
    const { container } = rendreCamp([]);
    expect(container.querySelectorAll('.eventail__dos')).toHaveLength(0);
    expect(container.querySelector('.board__counts .sr-only')?.textContent).toBe('main 0');
  });

  it('le contrôle mord : une main de 3 cartes donne 3 dos, jamais le nom d’une carte (#747)', () => {
    const { etat } = partieCommencee();
    const main = etat.players.ai.hand.slice(0, 3);
    const { container } = rendreCamp(main);
    expect(container.querySelectorAll('.eventail__dos')).toHaveLength(3);
    for (const carte of main) expect(container.innerHTML).not.toContain(cardName(carte.cardId));
  });

  it('la main adverse ne montre aucun nom : le dos seul, `.eventail` sans texte', () => {
    const { partie, etat } = partieCommencee();
    const nomsMoi = etat.players.player.hand.map((c) => cardName(c.cardId));
    // Une carte adverse dont le nom ne figure pas dans ma main : le contrôle ci-dessous ne peut pas être confondu.
    const carte = etat.players.ai.hand.find((c) => !nomsMoi.includes(cardName(c.cardId)));
    if (!carte) throw new Error('aucune carte adverse au nom distinct de ma main');
    const nom = cardName(carte.cardId);
    const monNom = nomsMoi[0];
    if (!monNom) throw new Error('ma main est vide : le contrôle n’a pas de nom à lire');

    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    // Contrôle : la recherche de nom trouve bien une carte **rendue** (celle de ma main). Sans ce
    // contrôle, un `innerHTML` sans nom pourrait être un faux négatif.
    expect(container.innerHTML).toContain(monNom);
    // Ce test échouerait si le plateau rendait `CardView` (la carte entière) au lieu d'un dos : le
    // nom de la carte adverse se lirait dans `innerHTML`. Le dos ne porte ni nom ni identifiant.
    expect(container.innerHTML).not.toContain(nom);
    expect(container.querySelector('.eventail')?.textContent).toBe('');
  });

  it('quatre emplacements, et chaque compte égale le Deck ou le Rebut de son camp (#739, critère 1)', () => {
    const { partie, etat } = partieAvecDefausse();
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    expect(container.querySelectorAll('.pile--deck')).toHaveLength(2);
    expect(container.querySelectorAll('.pile--rebut')).toHaveLength(2);
    for (const camp of ['player', 'ai'] as const) {
      expect(cote(container, camp)?.querySelector('.pile--deck strong')?.textContent, `Deck ${camp}`).toBe(
        String(etat.players[camp].deck.length)
      );
      expect(cote(container, camp)?.querySelector('.pile--rebut strong')?.textContent, `Rebut ${camp}`).toBe(
        String(etat.players[camp].discard.length)
      );
    }
  });

  it('le Rebut montre la **dernière** carte défaussée, nom lisible ; le Deck n’affiche aucun nom (#739, critère 2)', () => {
    const { partie, etat } = partieAvecDefausse();
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const defausse = etat.players.player.discard;
    const derniere = cardName(defausse.at(-1)!.cardId);
    const premiere = cardName(defausse[0]!.cardId);
    const rebut = cote(container, 'player')?.querySelector<HTMLElement>('.pile--rebut');
    const deck = cote(container, 'player')?.querySelector<HTMLElement>('.pile--deck');
    if (!rebut || !deck) throw new Error('piles de Toi introuvables');

    // Contrôle positif : le nom de la dernière défausse est **rendu** dans le Rebut.
    expect(rebut.textContent).toContain(derniere);
    // La première défausse, de nom distinct, n'y figure pas : le Rebut montre bien la dernière.
    expect(rebut.textContent).not.toContain(premiere);
    expect(rebut.querySelector('.card')).not.toBeNull();

    // Le Deck : aucun nom de carte, ni dans le texte ni dans le HTML (dos seul, sans `CardView`).
    // Contrôle : le Deck est bien rendu (son compte est lu), et il contient des cartes.
    expect(deck.querySelector('strong')?.textContent).toBe(String(etat.players.player.deck.length));
    expect(etat.players.player.deck.length).toBeGreaterThan(0);
    for (const nom of new Set(etat.players.player.deck.map((carte) => cardName(carte.cardId)))) {
      expect(deck.textContent, `texte du Deck, nom « ${nom} »`).not.toContain(nom);
      expect(deck.innerHTML, `HTML du Deck, nom « ${nom} »`).not.toContain(nom);
    }
    expect(deck.querySelector('.card')).toBeNull();
  });

  it('Rebut vide : aucune carte dans l’emplacement, et le compte dit 0', () => {
    // La partie d'avant le premier coup : rien n'a encore été défaussé.
    const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
    const deck = autoDeck(owned).deck;
    const initiale = createBattle(deck, deck, 31337);
    expect(initiale.players.player.discard).toHaveLength(0);
    const partie = partieSauvegardee(initiale, null, { playerDeck: deck, aiDeck: deck });
    if (!partie) throw new Error('partie initiale refusée');
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const rebut = cote(container, 'player')?.querySelector('.pile--rebut');
    expect(rebut?.querySelector('.card')).toBeNull();
    expect(rebut?.querySelector('strong')?.textContent).toBe('0');
  });
});

/**
 * Une partie où **les deux** camps ont au moins une défausse, et où c'est le tour de Toi (#740).
 * Le moteur rejoue le journal : on ne peut pas poser un Rebut à la main, on joue jusqu'à lui.
 */
let cacheDeuxDefausses: { partie: PartieSauvegardee; etat: BattleState } | null = null;
function partieAvecDefausseDesDeuxCamps(): { partie: PartieSauvegardee; etat: BattleState } {
  if (cacheDeuxDefausses) return cacheDeuxDefausses;
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  for (let seed = 1; seed < 300; seed += 1) {
    let s: BattleState = createBattle(deck, deck, seed);
    for (let i = 0; i < 1200 && s.phase === 'playing'; i += 1) {
      const pret =
        s.current === 'player' &&
        s.pendingPromotion === null &&
        s.pendingChoice === null &&
        s.players.player.discard.length >= 1 &&
        s.players.ai.discard.length >= 1;
      if (pret) {
        const partie = partieSauvegardee(s, null, { playerDeck: deck, aiDeck: deck });
        if (partie) {
          cacheDeuxDefausses = { partie, etat: s };
          return cacheDeuxDefausses;
        }
      }
      const rang = (a: BattleAction) =>
        a.type === 'attack' ? 0 : a.type === 'playAction' ? 1 : a.type === 'endTurn' ? 3 : 2;
      const legales = legalActions(s)
        .filter((a) => a.type !== 'forfeit')
        .sort((a, b) => rang(a) - rang(b));
      const action = legales[0];
      if (!action) break;
      s = applyAction(s, action);
    }
  }
  throw new Error('aucune partie avec une défausse de chaque camp dans les 300 graines');
}

describe('Battle — le Rebut se consulte en panneau non modal, pour les deux camps (#740)', () => {
  const LIBELLE: Record<PlayerId, string> = { player: 'Toi', ai: 'La Direction' };
  const bouton = (camp: PlayerId) => screen.getByRole('button', { name: `Consulter le Rebut : ${LIBELLE[camp]}` });
  const panneau = (camp: PlayerId) => screen.queryByRole('region', { name: `Rebut : ${LIBELLE[camp]}` });

  it('critère 1 : chaque Rebut ouvre un panneau qui liste toutes ses cartes, face visible, camp par camp', async () => {
    const { partie, etat } = partieAvecDefausseDesDeuxCamps();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    for (const camp of ['player', 'ai'] as const) {
      const defausse = etat.players[camp].discard;
      // Contrôle : le camp a bien des défausses à lister.
      expect(defausse.length, `défausse de ${camp}`).toBeGreaterThan(0);
      expect(panneau(camp), `panneau de ${camp} fermé au départ`).toBeNull();

      await userEvent.click(bouton(camp));

      const region = panneau(camp);
      if (!region) throw new Error(`panneau du Rebut de ${camp} introuvable après ouverture`);
      expect(within(region).getAllByRole('listitem'), `cartes de ${camp}`).toHaveLength(defausse.length);
      for (const carte of defausse) {
        expect(region.textContent, `nom d’une défausse de ${camp}`).toContain(cardName(carte.cardId));
      }
      // Le panneau d'un camp ne liste pas l'autre : un seul panneau ouvert à la fois ici.
      expect(screen.getAllByRole('region', { name: /^Rebut : / })).toHaveLength(1);

      await userEvent.click(bouton(camp));
      expect(panneau(camp)).toBeNull();
    }
  });

  it('critère 5 : le Deck n’a aucun bouton ni élément focusable, et ne s’ouvre pas', () => {
    const { partie } = partieAvecDefausseDesDeuxCamps();
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    expect(screen.queryByRole('button', { name: /Deck/i })).toBeNull();
    // Contrôle : les deux Rebut, eux, sont bien des boutons.
    expect(screen.getAllByRole('button', { name: /^Consulter le Rebut : / })).toHaveLength(2);
    expect(container.querySelectorAll('.pile--deck button, .pile--deck [tabindex], .pile--deck a')).toHaveLength(0);
  });

  it('critère 3 : Entrée ouvre, Tab parcourt les cartes, Échap ferme et rend le focus au bouton', async () => {
    const { partie, etat } = partieAvecDefausseDesDeuxCamps();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const ouvrant = bouton('player');
    const nombre = etat.players.player.discard.length;

    ouvrant.focus();
    await userEvent.keyboard('{Enter}');
    expect(ouvrant.getAttribute('aria-expanded')).toBe('true');
    expect(panneau('player')).not.toBeNull();

    // Tab : le premier élément suivant le bouton est la première carte du panneau.
    await userEvent.tab();
    expect(document.activeElement?.tagName).toBe('LI');
    expect(within(panneau('player')!).getAllByRole('listitem')[0]).toBe(document.activeElement);
    if (nombre >= 2) {
      await userEvent.tab();
      expect(within(panneau('player')!).getAllByRole('listitem')[1]).toBe(document.activeElement);
    }

    await userEvent.keyboard('{Escape}');
    expect(panneau('player')).toBeNull();
    // Le focus revient au bouton d'ouverture, et non au corps de la page.
    expect(document.activeElement).toBe(ouvrant);
    expect(ouvrant.getAttribute('aria-expanded')).toBe('false');
  });

  it('critère 3 bis : Espace ouvre aussi, et Échap depuis une carte du panneau rend le focus au bouton', async () => {
    const { partie } = partieAvecDefausseDesDeuxCamps();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const ouvrant = bouton('ai');

    ouvrant.focus();
    await userEvent.keyboard(' ');
    expect(panneau('ai')).not.toBeNull();

    await userEvent.tab();
    expect(document.activeElement?.tagName).toBe('LI');
    await userEvent.keyboard('{Escape}');
    expect(panneau('ai')).toBeNull();
    expect(document.activeElement).toBe(ouvrant);
  });

  it('critère 4 : aucun role=grid ni aucune cellule ARIA, panneau ouvert ; le panneau est une liste', async () => {
    const { partie } = partieAvecDefausseDesDeuxCamps();
    const { container } = renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    await userEvent.click(bouton('player'));
    // Contrôle : le panneau est bien ouvert et c'est une liste.
    expect(within(panneau('player')!).getByRole('list')).toBeInTheDocument();
    expect(container.querySelector('[role="grid"], [role="treegrid"], [role="row"], [role="gridcell"]')).toBeNull();
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('critère 6 : le panneau lit le Rebut, jamais le Deck (une carte du Deck seule n’y figure pas)', async () => {
    const { partie, etat } = partieAvecDefausseDesDeuxCamps();
    const defausse = new Set(etat.players.player.discard.map((c) => cardName(c.cardId)));
    const nomDuDeck = etat.players.player.deck.map((c) => cardName(c.cardId)).find((nom) => !defausse.has(nom));
    if (!nomDuDeck) throw new Error('aucune carte du Deck au nom absent du Rebut : le contrôle n’a pas de nom à lire');

    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    await userEvent.click(bouton('player'));

    const region = panneau('player');
    if (!region) throw new Error('panneau du Rebut de Toi introuvable');
    // Contrôle positif : une défausse est bien listée.
    expect(region.textContent).toContain(cardName(etat.players.player.discard.at(-1)!.cardId));
    // Le contrôle mord : un panneau qui lirait `side.deck` afficherait ce nom ; il échoue alors ici.
    expect(region.textContent, `nom du Deck « ${nomDuDeck} »`).not.toContain(nomDuDeck);
  });

  it('Rebut vide : le bouton reste actif, et le panneau dit qu’il est vide', async () => {
    const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
    const deck = autoDeck(owned).deck;
    const initiale = createBattle(deck, deck, 31337);
    const partie = partieSauvegardee(initiale, null, { playerDeck: deck, aiDeck: deck });
    if (!partie) throw new Error('partie initiale refusée');
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const ouvrant = bouton('player');
    expect(ouvrant).toBeEnabled();
    await userEvent.click(ouvrant);
    expect(within(panneau('player')!).getByText('Rebut vide.')).toBeInTheDocument();
    expect(within(panneau('player')!).queryAllByRole('listitem')).toHaveLength(0);
  });
});

/**
 * **L'ouverture d'un combat neuf** (#746) à l'écran : le zoom et la cascade ne jouent qu'à un
 * combat neuf, sans « Mouvement réduit », et une partie reprise n'en rejoue aucun. Tap et `Espace`
 * passent la séquence ; la fin la retire d'elle-même.
 */
describe('Battle — l’ouverture d’un combat neuf (#746)', () => {
  const neuf = { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: false };

  it('un combat neuf zoome la table, et ses Planqués se retournent, joueur d’abord', () => {
    const { container } = renderWithStore(<Battle />, neuf);

    expect(container.querySelector('.board--ouverture')).not.toBeNull();
    const retournes = [...container.querySelectorAll<HTMLElement>('.entrant--ouverture')];
    expect(retournes.length).toBeGreaterThanOrEqual(2);
    // Chaque carte retournée porte son dos ; le délai de la première est le rang 0, le Poste du joueur.
    expect(container.querySelectorAll('.entrant__verso')).toHaveLength(retournes.length);
    const delais = retournes.map((carte) => Number.parseInt(carte.style.getPropertyValue('--delai'), 10));
    expect(Math.min(...delais)).toBe(delaiDeRetournement(0));
    expect(Math.max(...delais)).toBeLessThanOrEqual(DUREE_OUVERTURE_MS);
  });

  it('le contrôle mord : sous « Mouvement réduit », aucune classe d’ouverture ne se pose', () => {
    const { container } = renderWithStore(<Battle />, { ...neuf, reducedMotion: true });

    expect(container.querySelector('.board--ouverture')).toBeNull();
    expect(container.querySelector('.entrant--ouverture')).toBeNull();
    expect(container.querySelector('.entrant')).toBeNull();
  });

  it('une partie reprise au montage n’a ni zoom ni retournement', () => {
    const { partie } = partieCommencee();
    const { container } = renderWithStore(<Battle />, { ...neuf, partie });

    expect(container.querySelector('.board--ouverture')).toBeNull();
    expect(container.querySelector('.entrant--ouverture')).toBeNull();
  });

  it('la touche Espace passe la séquence : le zoom et les dos s’arrêtent', () => {
    const { container } = renderWithStore(<Battle />, neuf);
    expect(container.querySelector('.board--ouverture')).not.toBeNull();

    fireEvent.keyDown(document.body, { key: ' ' });

    expect(container.querySelector('.board--ouverture')).toBeNull();
    expect(container.querySelector('.entrant--ouverture')).toBeNull();
  });

  it('un tap sur la table passe la séquence', () => {
    const { container } = renderWithStore(<Battle />, neuf);
    const table = container.querySelector('.battle__table');
    if (!table) throw new Error('la table du combat est introuvable');

    fireEvent.pointerDown(table);

    expect(container.querySelector('.board--ouverture')).toBeNull();
  });

  it('la séquence finit d’elle-même, sans geste, dans la borne de deux secondes', async () => {
    const { container } = renderWithStore(<Battle />, neuf);

    await waitFor(() => expect(container.querySelector('.board--ouverture')).toBeNull(), { timeout: 2500 });
  });
});

/**
 * **Le hook des effets sous « Mouvement réduit » (#748)** : le tirage naît dans l'état, mais sans
 * animation ; hors réglage, il vole. Ce fichier tourne sous jsdom, `effets-combat.test.ts` non.
 */
describe('useEffetsDeCombat — le tirage sous « Mouvement réduit » (#748)', () => {
  const partieDeTest = () => {
    const entrants = ALL_CARDS.filter((card) => isPlanque(card) && isBasic(card) && !card.variantOf).slice(0, 10);
    const deck = entrants.flatMap((card) => [card.id, card.id]);
    return createBattle(deck, deck, 42);
  };

  it('« Mouvement réduit » : la pioche du joueur naît sans animation', () => {
    const avant = partieDeTest();
    const apres = structuredClone(avant);
    apres.players.player.hand.push(apres.players.player.deck.shift()!);

    const { result, rerender } = renderHook(({ state, sans }) => useEffetsDeCombat(state, sans), {
      initialProps: { state: avant, sans: true }
    });
    act(() => rerender({ state: apres, sans: true }));

    const tirage = result.current.find((effet) => effet.nature === 'tirage');
    expect(tirage).toBeDefined();
    expect(tirage?.anime).toBe(false);
  });

  it('hors réglage, la pioche de la Direction vole (anime à vrai)', () => {
    const avant = partieDeTest();
    const apres = structuredClone(avant);
    apres.players.ai.hand.push(apres.players.ai.deck.shift()!);

    const { result, rerender } = renderHook(({ state, sans }) => useEffetsDeCombat(state, sans), {
      initialProps: { state: avant, sans: false }
    });
    act(() => rerender({ state: apres, sans: false }));

    expect(result.current.find((effet) => effet.nature === 'tirage')?.anime).toBe(true);
  });
});

/**
 * **L'inspecteur ne s'ouvre que sur une carte du plateau** (D-193 (1), #750). Une carte de la main se
 * choisit (la carte en grand) et ne l'ouvre pas, même sous « Mouvement réduit » ; une partie qui agit
 * (un coup part) referme le panneau qu'on avait ouvert sur le plateau.
 *
 * Les cas fautifs : le survol ou le focus d'une carte de la main ouvrait l'inspecteur ; sans la
 * fermeture sur coup, il restait ouvert sur le Banc après qu'une carte de la main était posée.
 */
describe('Battle — l’inspecteur ne s’ouvre que sur une carte du plateau (D-193 (1), #750)', () => {
  /** La graine est fixée (comme « poser une carte est un geste nommé ») : le joueur ouvre, ses cartes sont jouables. */
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const LIBELLES_DE_POSE =
    /^(Poser au Poste|Mettre au Banc \d|Jouer cet Objet|Jouer ce Collègue|Faire évoluer|Changement de priorité)/;

  async function carteJouableDeLaMain(): Promise<HTMLElement> {
    return waitFor(() => {
      const carte = document.querySelector<HTMLElement>('button.hand__card.is-playable');
      if (!carte) throw new Error('aucune carte jouable : la graine fixée ne fait plus ouvrir le joueur');
      return carte;
    });
  }

  /** Une carte du plateau à moi, qui s'ouvre au toucher (`CarteSurvolable`, `role="button"`). */
  function carteDuPlateau(): HTMLElement {
    const carte = document.querySelector<HTMLElement>('.board [role="button"][data-uid]');
    if (!carte) throw new Error('aucune carte du plateau ne porte un uid : rien à désigner');
    return carte;
  }

  const inspecteurOuvert = () => document.querySelector('.inspecteur') !== null;

  it('sous « Mouvement réduit », le survol d’une carte de la main n’ouvre pas l’inspecteur', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true });
    const carte = document.querySelector<HTMLElement>('.hand > li');
    if (!carte) throw new Error('la main ne porte aucune carte');

    fireEvent.pointerEnter(carte, { pointerType: 'mouse' });

    expect(inspecteurOuvert()).toBe(false);
  });

  it('sous « Mouvement réduit », jouer une carte de la main n’ouvre pas l’inspecteur (le focus rendu à la main ne l’ouvre pas)', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true });

    fireEvent.click(await carteJouableDeLaMain());
    const geste = within(document.querySelector<HTMLElement>('.carte-grand') as HTMLElement)
      .getAllByRole('button')
      .find((b) => LIBELLES_DE_POSE.test(b.textContent ?? ''));
    if (!geste) throw new Error('la carte en grand n’offre aucun geste de pose');
    fireEvent.click(geste);

    await waitFor(() => expect(document.querySelector('.carte-grand')).toBeNull());
    expect(inspecteurOuvert()).toBe(false);
  });

  it('touchée sur le plateau, la carte ouvre l’inspecteur ; une carte de la main jouée le referme', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.click(carteDuPlateau());
    expect(inspecteurOuvert()).toBe(true);

    fireEvent.click(await carteJouableDeLaMain());
    const geste = within(document.querySelector<HTMLElement>('.carte-grand') as HTMLElement)
      .getAllByRole('button')
      .find((b) => LIBELLES_DE_POSE.test(b.textContent ?? ''));
    if (!geste) throw new Error('la carte en grand n’offre aucun geste de pose');
    fireEvent.click(geste);

    // Le coup est parti : l'inspecteur ne reste pas ouvert sur le Banc (contre-cas : il s'était ouvert).
    await waitFor(() => expect(inspecteurOuvert()).toBe(false));
  });

  it('une partie qui agit referme l’inspecteur ouvert sur le plateau : « Fin du tour » le ferme (le tour passe)', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.click(carteDuPlateau());
    expect(inspecteurOuvert()).toBe(true);

    // Rien ne bouge le focus ici : c'est la fermeture par la partie qui est mise à l'épreuve.
    fireEvent.click(
      within(document.querySelector<HTMLElement>('.actions-flottantes') as HTMLElement).getByRole('button', {
        name: /^Fin du tour/
      })
    );

    await waitFor(() => expect(inspecteurOuvert()).toBe(false));
  });

  it('choisir une carte de la main ne l’ouvre pas non plus (contre-cas : la carte en grand s’affiche)', async () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.click(await carteJouableDeLaMain());

    expect(document.querySelector('.carte-grand')).not.toBeNull();
    expect(inspecteurOuvert()).toBe(false);
  });
});

/**
 * **La bulle du tour s'efface** (D-193 (2), #750). Une information (ici la phrase d'attente, ou la réplique)
 * ne reste pas sur le Banc de la Direction : après 4 s, la bulle reçoit `combat-toast--sorti`. Les
 * décisions qui attendent (relève, carte à désigner) restent — elles ne sont pas dans la bulle.
 */
describe('Battle — la bulle du tour s’efface après 4 s (D-193 (2), #750)', () => {
  /** La graine est fixée : sans elle, la bulle (portée, café) dépend de la main tirée à l'horloge. */
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('la bulle reste 4 s, puis reçoit la classe de fondu ; elle ne sort pas du DOM (aucun décalage)', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: false });
    const bulle = document.querySelector<HTMLElement>('.combat-toast');
    if (!bulle) throw new Error('la bulle du tour n’est pas rendue : le cas ne prouve rien');
    expect(bulle).not.toHaveClass('combat-toast--sorti');

    act(() => {
      vi.advanceTimersByTime(3900);
    });
    expect(bulle).not.toHaveClass('combat-toast--sorti');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(bulle).toHaveClass('combat-toast--sorti');
    expect(bulle.isConnected).toBe(true);
  });

  it('sous « Mouvement réduit », la bulle se cache à la même échéance (le CSS coupe seulement le fondu)', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true });
    const bulle = document.querySelector<HTMLElement>('.combat-toast');
    if (!bulle) throw new Error('la bulle du tour n’est pas rendue : le cas ne prouve rien');

    act(() => {
      vi.advanceTimersByTime(3900);
    });
    expect(bulle).not.toHaveClass('combat-toast--sorti');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(bulle).toHaveClass('combat-toast--sorti');
  });
});
