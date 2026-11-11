// @vitest-environment jsdom
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CIBLE_DE_GESTE, cibleJournee, poserCibleJournee } from './journee-cible';
import { JourneeIntegration } from './JourneeIntegration';
import { ETAPES_JOURNEE, cheminDeCible } from './journee-etapes';
import { marquerGeste, oublierGestes } from './journee-gestes';
import { allerAEtape, remettreJourneeAuDebut } from './journee-etape';
import { setupTestStore } from '@/test/test-utils';

/**
 * **La cible de l'étape courante** (30/10/2026). Avant, toutes les pages s'allumaient dès que
 * la Journée n'était pas finie : à l'étape 1 sur `/deck`, le volet des Decks était cerclé d'or.
 * Une seule cible à la fois, et elle s'éteint quand la Journée se ferme.
 */
describe('la cible de la Journée', () => {
  afterEach(() => poserCibleJournee(null));

  it('n’a qu’une valeur à la fois', () => {
    poserCibleJournee('arrivage');
    expect(cibleJournee()).toBe('arrivage');
    poserCibleJournee('onglet-deck');
    expect(cibleJournee()).toBe('onglet-deck');
  });

  it('s’éteint quand la Journée se ferme', () => {
    poserCibleJournee('onglet-deck');
    poserCibleJournee(null);
    // **Le contrôle mord** : une cible qui resterait posée laisserait un halo orphelin.
    expect(cibleJournee()).toBeNull();
  });
});

/**
 * **Une correspondance par geste** (D-160 (3), D-162 (3)). `combat` n'a volontairement **pas**
 * de cible : sur `/battle` le panneau s'efface et le pas-à-pas désigne. Le test exige donc
 * exactement les deux gestes à halo, et `combat` absent.
 */
describe('CIBLE_DE_GESTE couvre exactement les gestes à halo', () => {
  it('a les deux gestes attendus, avec leur cible, et pas combat', () => {
    // **Le contrôle mord** : `combat: 'arrivage'` ajouté au `Partial` fait tomber cette assertion,
    // et un halo sur `/battle` redésignerait une cible que le pas-à-pas remplace.
    expect(Object.keys(CIBLE_DE_GESTE).sort()).toEqual(['arrivage', 'deck']);
    expect(CIBLE_DE_GESTE).toEqual({
      arrivage: 'arrivage',
      deck: 'onglet-deck'
    });
    expect(CIBLE_DE_GESTE).not.toHaveProperty('combat');
  });

  it('une cible n’est désignée que par un seul geste', () => {
    // **Le contrôle mord** : deux gestes sur la même cible rendraient le halo ambigu.
    const cibles = Object.values(CIBLE_DE_GESTE);
    expect(new Set(cibles).size).toBe(cibles.length);
  });

  it('deux étapes sur une même route ne désignent pas la cible l’une de l’autre', () => {
    // Le test n'impose pas une étape par route : il interdit seulement qu'elles se marchent
    // dessus. Aujourd'hui aucune route n'est partagée, donc la boucle ne compare rien ; la règle
    // attend la première qui le fera.
    const cibleDe = (geste: (typeof ETAPES_JOURNEE)[number]['geste']) =>
      geste ? (CIBLE_DE_GESTE[geste] ?? null) : null;
    for (let i = 0; i < ETAPES_JOURNEE.length; i++) {
      for (let j = i + 1; j < ETAPES_JOURNEE.length; j++) {
        const a = ETAPES_JOURNEE[i];
        const b = ETAPES_JOURNEE[j];
        if (cheminDeCible(a.cible) !== cheminDeCible(b.cible)) continue;
        const ca = cibleDe(a.geste);
        const cb = cibleDe(b.geste);
        if (ca && cb) expect(ca, `« ${a.titre} » et « ${b.titre} »`).not.toBe(cb);
      }
    }
  });
});

/**
 * **La Journée rendue** : la cible suit l'étape, et s'éteint quand la Journée se ferme. Le
 * test ne fait pas un `poserCibleJournee(null)` à la main : il démonte le panneau, et c'est
 * le nettoyage du composant qui doit éteindre la cible.
 */
describe('la cible suit l’étape et s’éteint à la fermeture', () => {
  function monter(index: number) {
    setupTestStore({
      tutorielVu: false,
      pasAPasCombatVu: true,
      packsOpened: 1,
      deck: ['atelier-joueur-de-flute']
    });
    oublierGestes();
    marquerGeste('deck');
    marquerGeste('combat');
    remettreJourneeAuDebut();
    allerAEtape(index);
    return render(
      createElement(MemoryRouter, { initialEntries: [ETAPES_JOURNEE[index].cible] }, createElement(JourneeIntegration))
    );
  }

  it('désigne l’onglet Deck à l’étape Collection et Deck, puis l’efface quand la Journée se ferme', () => {
    const ecran = monter(1);
    expect(cibleJournee()).toBe('onglet-deck');
    // **Le contrôle mord** : sans `poserCibleJournee(null)` dans le nettoyage, la cible
    // survit au démontage et l’onglet Deck reste cerclé hors de la Journée.
    act(() => ecran.unmount());
    expect(cibleJournee()).toBeNull();
  });

  it('s’éteint quand l’étape passe à une étape sans geste à halo (le combat)', () => {
    const ecran = monter(1);
    expect(cibleJournee()).toBe('onglet-deck');
    act(() => allerAEtape(2));
    expect(cibleJournee()).toBeNull();
    act(() => ecran.unmount());
    expect(cibleJournee()).toBeNull();
  });
});
