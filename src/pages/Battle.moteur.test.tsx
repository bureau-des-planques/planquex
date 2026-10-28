// @vitest-environment jsdom
// Lenteur justifiée (D-143 (5)) — les mécaniques du moteur vues à l'écran, rendues sous jsdom
import { describe, it, expect, afterAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';
import { menuSurLaVue } from '@/test/menu-combat';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import type { ActionCard, Ability, AttackEffect, BattleAction, BattleState, Card, PlanqueCard } from '@/data/types';
import { applyAction, createBattle, dessusDuDeck, legalActions } from '@/game/engine';
import { nextAiAction } from '@/game/ia';
import { partieSauvegardee } from '@/store/partie';

/**
 * Les mécaniques du moteur, **vues à l'écran** (#159 à #165, D-076 à D-082).
 *
 * Chaque scène est amenée par de **vraies actions** du moteur (`createBattle` puis
 * `applyAction`), puis rendue par la voie de la reprise (`partieSauvegardee` → `reprendrePartie`,
 * qui rejoue le journal) : l'écran voit exactement l'état que le moteur produit. Les cartes
 * sont des **fixtures** (aucune du catalogue ne porte ces mécaniques), enregistrées dans
 * `CARD_BY_ID` comme `talent-en-jouant.test.ts`, et retirées à la fin du fichier.
 *
 * Les quatre points qui manquaient à l'écran — le nom sur les boutons de choix, le dessus
 * du Deck regardé — étaient des `it.fails` documentés ; #171 les a câblés, donc ce sont
 * des `it` ordinaires. Un manque à l'écran qui reviendrait rougirait ici.
 */

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
/** Le Deck de la Direction : de vraies cartes, sans mécanique nouvelle. */
const DECK_DIRECTION = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

const socleCarte = getCard(BASICS[0]);
if (!socleCarte || !isPlanque(socleCarte)) throw new Error('Entrant de base introuvable');
/** Le socle des Planqués fixtures : un Entrant réel, dont on copie le gabarit. */
const socle: PlanqueCard = socleCarte;

const enregistrees: string[] = [];

function enregistrer(carte: Card): string {
  CARD_BY_ID.set(carte.id, carte);
  enregistrees.push(carte.id);
  return carte.id;
}

// Les fixtures sont enregistrées à l'import, avant tout test : on les retire à la fin du fichier.
afterAll(() => {
  for (const id of enregistrees.splice(0)) CARD_BY_ID.delete(id);
});

/** Un Planqué fixture, Entrant comme les autres, avec son Talent éventuel. */
function planque(slug: string, nom: string, ability?: Ability): string {
  const { art: _art, ...reste } = socle;
  const carte: PlanqueCard = {
    ...reste,
    id: `fixture-moteur-${slug}`,
    name: nom,
    ...(ability ? { ability } : {})
  };
  return enregistrer(carte);
}

/** Une carte Action fixture (Collègue) : un effet, sans autre mécanique. */
function collegue(slug: string, nom: string, effects: AttackEffect[]): string {
  const carte: ActionCard = {
    id: `fixture-moteur-${slug}`,
    name: nom,
    kind: 'COLLEAGUE',
    faction: socle.faction,
    rarity: '1D',
    flavor: 'Fixture de test.',
    glyph: socle.glyph,
    palette: socle.palette,
    text: 'Fixture de test.',
    effects
  };
  return enregistrer(carte);
}

const NOM_COLLEGUE_DEFAUSSE = 'Fixture Circulaire';
const NOM_TALENT_DEGATS = 'Fixture Pression Manager';
const NOM_EN_JOUANT = 'Fixture Sourcing';
const NOM_BANC = 'Fixture Polyvalence';

const COLLEGUE_DEFAUSSE = collegue('defausse', NOM_COLLEGUE_DEFAUSSE, [
  { kind: 'discardHand', target: 'self', amount: 1 }
]);
const COLLEGUE_REVELE = collegue('revele', 'Fixture Audit', [{ kind: 'reveal' }]);
const COLLEGUE_REGARD = collegue('regard', 'Fixture Regard', [{ kind: 'peek' }]);
const COLLEGUE_RECHERCHE = collegue('recherche', 'Fixture Recherche', [{ kind: 'search', filter: 'PLANQUE' }]);
const RECRUTEUR = planque('recruteur', 'Fixture Recruteur');
const TALENT_DEGATS = planque('talent-degats', NOM_TALENT_DEGATS, {
  name: 'Fixture Pression',
  text: 'Fixture : inflige 10 de stress.',
  kind: 'effects',
  effects: [{ kind: 'damage', amount: 10 }]
});
const ENTREE_EVO = planque('entree-evo', 'Fixture Entrée');
/** Un N+1 qui évolue depuis `ENTREE_EVO` et porte un Talent « en jouant » (D-081). */
const EVOLUTION = (() => {
  const { art: _art, ...reste } = socle;
  const carte: PlanqueCard = {
    ...reste,
    id: 'fixture-moteur-evolution',
    name: 'Fixture Évolution',
    stage: 'N+1',
    evolvesFrom: ENTREE_EVO,
    hp: 90,
    ability: { name: NOM_EN_JOUANT, text: 'En jouant : pioche 1 carte.', kind: 'draw', amount: 1, trigger: 'onPlay' }
  };
  return enregistrer(carte);
})();
const BANC = planque('banc', NOM_BANC, {
  name: 'Fixture Polyvalence',
  text: 'Fixture : un café vers un Planqué du Banc.',
  kind: 'attachEnergy',
  target: 'rack'
});

/**
 * Un Deck **légal** (D-020 : au plus 2 exemplaires par nom, un Entrant au moins) : deux copies
 * de la fixture, et le reste en Entrants réels distincts. `createBattle` refuse le reste.
 */
const deckAvec = (id: string) => [id, id, ...BASICS.slice(0, 18)];
/**
 * Des cartes réelles non Entrantes, pour compléter un Deck sans poser de Planqué à la mise en place.
 */
const NON_ENTRANTS_REELS = [...new Map(ALL_CARDS.filter((c) => !isBasic(c)).map((c) => [c.name, c.id])).values()].slice(
  0,
  17
);
if (NON_ENTRANTS_REELS.length < 17) throw new Error('pas assez de cartes réelles non Entrantes pour compléter un Deck');

// ── Pilotage par le moteur ───────────────────────────────────────────────────

/**
 * La première graine qui fait **ouvrir le joueur** et met la scène voulue en main. Le lancer
 * de tampon et le mélange sont seedés : la graine est fixe, donc le test est reproductible.
 */
function nouvellePartie(deck: string[], scene: (s: BattleState) => boolean = () => true): BattleState {
  for (let seed = 1; seed < 2000; seed += 1) {
    const s = createBattle(deck, DECK_DIRECTION, seed);
    if (s.firstPlayer === 'player' && scene(s)) return s;
  }
  throw new Error('aucune graine ne rend la scène voulue');
}

/** La main du joueur contient une carte de cet id. */
const enMain = (id: string) => (s: BattleState) => s.players.player.hand.some((carte) => carte.cardId === id);

/** Applique la première action légale qui répond au prédicat. */
function jouer(state: BattleState, predicat: (action: BattleAction) => boolean, decrit: string): BattleState {
  const action = legalActions(state).find(predicat);
  if (!action) throw new Error(`action absente : ${decrit}`);
  return applyAction(state, action);
}

/** Joue, depuis la main, le Collègue `id`. */
function jouerCollegue(s: BattleState, id: string): BattleState {
  const carte = s.players.player.hand.find((c) => c.cardId === id);
  if (!carte) throw new Error('Collègue absent de la main');
  return jouer(s, (a) => a.type === 'playAction' && a.uid === carte.uid, 'jouer le Collègue');
}
const finirLeTour = (s: BattleState) => jouer(s, (a) => a.type === 'endTurn', 'fin du tour');

/** Laisse jouer la Direction (IA niveau 1, comme l'écran) jusqu'au tour du joueur. */
function laisserJouerLaDirection(state: BattleState): BattleState {
  let next = state;
  for (let i = 0; i < 60; i += 1) {
    if (next.phase === 'ended') throw new Error('partie finie avant le tour du joueur');
    if (next.current === 'player' && !next.pendingChoice && !next.pendingPromotion) return next;
    const action = nextAiAction(next, 'scripte');
    if (!action) throw new Error('la Direction ne joue pas');
    next = applyAction(next, action);
  }
  throw new Error('la Direction ne rend pas la main');
}

/** Rend le combat **tel que le moteur l'a laissé**, par la voie de la reprise (#126). */
function ouvrir(state: BattleState, deck: string[]) {
  const partie = partieSauvegardee(state, null, { playerDeck: deck, aiDeck: DECK_DIRECTION });
  if (!partie) throw new Error('partie terminée : rien à rendre');
  renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
  expect(screen.getByText(new RegExp(`Tour ${state.turn}\\b`))).toBeInTheDocument();
}

// ── Lectures de l'écran ──────────────────────────────────────────────────────

/** L'encart de choix (`section.choix`), ou `null`. */
const encartDeChoix = (): HTMLElement | null => document.querySelector<HTMLElement>('section.choix');

/**
 * Les lignes du journal, comme l'écran les affiche (`.log li`) — **derrière le menu `⋯`** depuis
 * la refonte du combat (#191) : l'helper l'ouvre sur sa vue Journal, comme le testeur. Une liste
 * vide ferait passer à vide les tests qui affirment qu'une ligne **n'est pas** là, donc elle
 * échoue ici : le journal d'une partie commencée n'est jamais vide.
 */
const journal = (): string[] => {
  menuSurLaVue('Journal');
  const lignes = Array.from(document.querySelectorAll<HTMLElement>('.log li')).map((li) => li.textContent ?? '');
  if (lignes.length === 0) throw new Error('le Journal du menu est vide : le helper ne lit plus le bon endroit');
  return lignes;
};

/** Les boutons « Talent » proposés. */
const boutonsTalent = () => screen.queryAllByRole('button', { name: /^Talent/ });

/**
 * Les boutons « Choisir cette carte » de l'encart de choix. Le nom accessible porte
 * désormais **la carte désignée** (#171) — « Choisir cette carte Contrôleur de
 * sécurité » —, donc la requête s'ancre sur le début du libellé.
 */
const boutonsDeChoix = (): HTMLElement[] =>
  within(encartDeChoix() as HTMLElement).getAllByRole('button', { name: /^Choisir cette carte/ });

describe('Battle — mécaniques du moteur à l’écran (#159 à #165)', () => {
  // ── 1 · Défausse choisie (#159, D-076) ─────────────────────────────────────
  describe('1 · défausse choisie par le joueur (#159)', () => {
    const deck = deckAvec(COLLEGUE_DEFAUSSE);
    const scene = (s: BattleState) => enMain(COLLEGUE_DEFAUSSE)(s);

    it('l’encart apparaît, propose la main, et « Choisir cette carte » envoie choose', () => {
      const s = jouerCollegue(nouvellePartie(deck, scene), COLLEGUE_DEFAUSSE);
      expect(s.pendingChoice?.kind).toBe('defausse');
      ouvrir(s, deck);

      expect(encartDeChoix(), 'l’encart de choix est affiché').not.toBeNull();
      expect(boutonsDeChoix()).toHaveLength(s.players.player.hand.length);

      fireEvent.click(boutonsDeChoix()[0] as HTMLElement);
      // L'action `choose` est appliquée : le choix est clos, et la carte part au rebut.
      expect(encartDeChoix()).toBeNull();
      expect(journal().some((l) => /au rebut/.test(l))).toBe(true);
    });

    it('… et chaque bouton nomme la carte de la main qu’il désigne (#171)', () => {
      const s = jouerCollegue(nouvellePartie(deck, scene), COLLEGUE_DEFAUSSE);
      ouvrir(s, deck);
      expect(encartDeChoix()).not.toBeNull();
      // Les cartes restées en main : chacune doit être nommée par *son* bouton. Le
      // Collègue joué, lui, n'est plus dans la main — c'est un Planqué de base qui reste.
      const nomsDeLaMain = s.players.player.hand.map((carte) => getCard(carte.cardId)?.name ?? '');
      expect(nomsDeLaMain).not.toContain(NOM_COLLEGUE_DEFAUSSE);
      expect(boutonsDeChoix()).toHaveLength(nomsDeLaMain.length);
      for (const bouton of boutonsDeChoix()) {
        expect(nomsDeLaMain.some((nom) => nom !== '' && bouton.textContent?.includes(nom))).toBe(true);
      }
    });
  });

  // ── 2 · Pression du Talent `effects` (#164, D-077) ─────────────────────────
  describe('2 · Talent qui inflige des dégâts (#164)', () => {
    it('le Talent est proposé et ne termine pas le tour', () => {
      const deck = deckAvec(TALENT_DEGATS);
      // L'ouverture pose le Planqué au Poste : la graine retient celle où c'est le Talent.
      const s = nouvellePartie(deck, (e) => e.players.player.active?.cardId === TALENT_DEGATS);
      // Précondition : la Direction a un Planqué au Poste, cible du Talent.
      expect(s.players.ai.active).not.toBeNull();
      ouvrir(s, deck);

      const talent = boutonsTalent();
      expect(talent, 'un bouton Talent est proposé').toHaveLength(1);
      expect(talent[0]).toHaveTextContent(/Fixture Pression/);

      fireEvent.click(talent[0] as HTMLElement);
      // Le Talent a frappé, et le tour n'est pas fini : c'est toujours à toi, « Fin du tour » reste.
      expect(journal().some((l) => new RegExp(`${NOM_TALENT_DEGATS} : \\d+ de stress\\.`).test(l))).toBe(true);
      expect(screen.getByText(/à toi/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Fin du tour/ })).toBeInTheDocument();
    });
  });

  // ── 3 · Révélation (#160, D-078) ───────────────────────────────────────────
  describe('3 · révélation de la main adverse (#160)', () => {
    it('l’entrée du journal est visible, et la main adverse n’est pas affichée en cartes', () => {
      const deck = deckAvec(COLLEGUE_REVELE);
      const s = jouerCollegue(nouvellePartie(deck, enMain(COLLEGUE_REVELE)), COLLEGUE_REVELE);
      ouvrir(s, deck);

      expect(journal().some((l) => /^Révélé dans la main de la Direction :/.test(l))).toBe(true);
      // Seule ma main est dessinée en cartes : la main révélée n'existe qu'en ligne de journal.
      expect(document.querySelectorAll('.hand-panel button.hand__card')).toHaveLength(s.players.player.hand.length);
    });
  });

  // ── 4 · Regard du dessus (#162, D-079) ─────────────────────────────────────
  describe('4 · regarder le dessus du Deck (#162)', () => {
    const deck = [COLLEGUE_REGARD, COLLEGUE_REGARD, RECRUTEUR, RECRUTEUR, ...BASICS.slice(0, 16)];
    const scene = enMain(COLLEGUE_REGARD);

    it('le journal ne dit rien du dessus : c’est une information privée (D-079)', () => {
      const s = jouerCollegue(nouvellePartie(deck, scene), COLLEGUE_REGARD);
      ouvrir(s, deck);
      expect(journal().join(' ')).not.toMatch(/dessus/i);
    });

    it('… et le joueur voit la carte du dessus, hors de la main et du journal (#171)', () => {
      const s = jouerCollegue(nouvellePartie(deck, scene), COLLEGUE_REGARD);
      const dessus = dessusDuDeck(s, 'player');
      expect(dessus, 'un dessus existe').toBeDefined();
      ouvrir(s, deck);

      // Hors de la main et du journal, un élément doit porter le nom du dessus.
      const affiche = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
        (el) =>
          el.childElementCount === 0 && el.textContent?.trim() === dessus?.name && !el.closest('.hand-panel, .log')
      );
      expect(affiche.length, 'le dessus est affiché au joueur').toBeGreaterThan(0);
    });

    it('… et l’adversaire n’en voit rien : la section privée ne se rend pas à son siège (D-079)', () => {
      const s = jouerCollegue(nouvellePartie(deck, scene), COLLEGUE_REGARD);
      const dessus = dessusDuDeck(s, 'player');
      expect(dessus, 'un dessus existe').toBeDefined();
      // Le même état, tenu depuis le siège adverse (#125) : le journal rejoue pareil.
      const partie = partieSauvegardee(
        s,
        { camp: 'ai', playerDeck: deck, aiDeck: DECK_DIRECTION },
        { playerDeck: deck, aiDeck: DECK_DIRECTION }
      );
      if (!partie) throw new Error('partie terminée : rien à rendre');
      renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
      expect(screen.getByText(new RegExp(`Tour ${s.turn}\\b`))).toBeInTheDocument();

      expect(document.querySelector('section.regard'), 'aucune section privée chez l’adversaire').toBeNull();
      const fuite = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
        (el) =>
          el.childElementCount === 0 && el.textContent?.trim() === dessus?.name && !el.closest('.hand-panel, .log')
      );
      expect(fuite, 'le dessus regardé ne fuit pas chez l’adversaire').toHaveLength(0);
    });
  });

  // ── 5 · Recherche dans le Deck (#161, D-080) ───────────────────────────────
  describe('5 · recherche dans le Deck (#161)', () => {
    const deck = [COLLEGUE_RECHERCHE, COLLEGUE_RECHERCHE, RECRUTEUR, RECRUTEUR, ...BASICS.slice(0, 16)];
    const scene = enMain(COLLEGUE_RECHERCHE);

    it('le choix dans le Deck est proposé, avec autant de boutons que de Planqués du filtre', () => {
      const s = jouerCollegue(nouvellePartie(deck, scene), COLLEGUE_RECHERCHE);
      expect(s.pendingChoice?.kind).toBe('chercher');
      const attendus = s.players.player.deck.filter((carte) => isPlanque(getCard(carte.cardId))).length;
      ouvrir(s, deck);

      expect(boutonsDeChoix()).toHaveLength(attendus);
    });

    it('… et chaque bouton nomme le Planqué proposé (#171)', () => {
      const s = jouerCollegue(nouvellePartie(deck, scene), COLLEGUE_RECHERCHE);
      ouvrir(s, deck);
      const noms = s.players.player.deck
        .map((carte) => getCard(carte.cardId))
        .filter((carte) => carte && isPlanque(carte))
        .map((carte) => carte?.name ?? '');
      for (const bouton of boutonsDeChoix()) {
        expect(noms.some((nom) => bouton.textContent?.includes(nom))).toBe(true);
      }
    });
  });

  // ── 6 · Talent « en jouant » (#163, D-081) ─────────────────────────────────
  describe('6 · Talent « en jouant » (#163)', () => {
    /**
     * Par **évolution** : la pose d'un Entrant depuis la main d'ouverture n'est pas atteignable
     * (la mise en place remplit le Poste et le Banc), et D-081 range l'évolution parmi les mises
     * en jeu. Le N+1 porte le Talent, l'Entrant est déjà au Poste (mise en place).
     */
    it('le journal indique le déclenchement une seule fois, et aucun bouton Talent n’est proposé', () => {
      const deck = [ENTREE_EVO, ENTREE_EVO, EVOLUTION, EVOLUTION, ...BASICS.slice(0, 16)];
      let s = nouvellePartie(deck, (e) => e.players.player.active?.cardId === ENTREE_EVO && enMain(EVOLUTION)(e));
      // Le joueur ouvre : il ne peut pas faire évoluer au premier tour (D-030). Il passe, la Direction joue, puis son tour 3.
      s = laisserJouerLaDirection(finirLeTour(s));
      s = jouer(s, (a) => a.type === 'evolve', 'faire évoluer');
      ouvrir(s, deck);

      const lignes = journal().filter((l) => l.includes(NOM_EN_JOUANT));
      expect(lignes).toHaveLength(1);
      expect(lignes[0]).toMatch(/utilise/);
      expect(boutonsTalent()).toHaveLength(0);
    });
  });

  // ── 7 · Café vers le Banc (#165, D-082) ────────────────────────────────────
  describe('7 · café vers un Planqué du Banc (#165)', () => {
    const deck = [BANC, BANC, BASICS[0], ...NON_ENTRANTS_REELS];
    const auPoste = (e: BattleState) => e.players.player.active?.cardId === BANC;
    const bancVide = (e: BattleState) => e.players.player.bench.every((c) => c === null);
    const bancPlein = (e: BattleState) => e.players.player.bench.some((c) => c !== null);

    it('sans Planqué au Banc, le Talent n’est pas proposé', () => {
      const s = nouvellePartie(deck, (e) => auPoste(e) && bancVide(e));
      ouvrir(s, deck);
      expect(boutonsTalent()).toHaveLength(0);
    });

    it('avec un Planqué au Banc, le Talent est proposé, puis le choix du Planqué est affiché', () => {
      const s = nouvellePartie(deck, (e) => auPoste(e) && bancPlein(e));
      const attendus = s.players.player.bench.filter(Boolean).length;
      ouvrir(s, deck);

      const talent = boutonsTalent();
      expect(talent, 'le Talent vers le Banc est proposé').toHaveLength(1);
      fireEvent.click(talent[0] as HTMLElement);

      expect(encartDeChoix(), 'le choix du Planqué du Banc est affiché').not.toBeNull();
      expect(boutonsDeChoix()).toHaveLength(attendus);
    });

    it('… et le bouton nomme le Planqué du Banc (#171)', () => {
      const s = nouvellePartie(deck, (e) => auPoste(e) && bancPlein(e));
      ouvrir(s, deck);
      fireEvent.click(boutonsTalent()[0] as HTMLElement);

      const nomsDuBanc = s.players.player.bench.flatMap((c) => (c ? [getCard(c.cardId)?.name ?? ''] : []));
      for (const bouton of boutonsDeChoix()) {
        expect(nomsDuBanc.some((nom) => bouton.textContent?.includes(nom))).toBe(true);
      }
    });
  });
});
