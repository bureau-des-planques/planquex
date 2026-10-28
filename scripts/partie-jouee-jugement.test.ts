import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  choisirAction,
  classerBouton,
  comparerAffordances,
  jugerClic,
  jugerCible,
  jouePar,
  jugerFinPartie,
  rangDansLeType
} from './partie-jouee-jugement.mjs';

const lire = (fichier: string) => readFileSync(new URL(`../${fichier}`, import.meta.url), 'utf8');

/** Une action de moteur, réduite à ce qui compte pour le jugement. */
type Action = {
  type: string;
  uid?: string;
  slot?: string | number;
  targetUid?: string;
  benchIndex?: number;
  cafe?: string;
};

describe('classerBouton', () => {
  it('reconnaît chaque libellé que `describeAction` rend', () => {
    expect(classerBouton('Poser au Poste')).toBe('playBasic');
    expect(classerBouton('Mettre au Banc 2')).toBe('playBasic');
    expect(classerBouton('Jouer cet Objet')).toBe('playAction');
    expect(classerBouton('Jouer ce Collègue')).toBe('playAction');
    expect(classerBouton('Faire évoluer')).toBe('evolve');
    expect(classerBouton('Changement de priorité archiver Carte')).toBe('priorityShift');
    expect(classerBouton('Attacher 1 café Planqué')).toBe('attachEnergy');
    expect(classerBouton('Rotation vers Planqué')).toBe('retreat');
    expect(classerBouton('Talent Surcharge')).toBe('ability');
    expect(classerBouton('Relève Planqué')).toBe('promoteActive');
    expect(classerBouton('Choisir cette carte')).toBe('choose');
    expect(classerBouton('Fin du tour')).toBe('endTurn');
    expect(classerBouton('Passer le tour de la Direction')).toBe('endTurn');
    expect(classerBouton('Abandonner')).toBe('forfeit');
  });

  it('range un nom d’attaque inconnu en Pression, et un texte vide en rien', () => {
    expect(classerBouton('Pression 30 coups de tampon')).toBe('attack');
    expect(classerBouton('   ')).toBeNull();
  });

  it('confronte les libellés à `Battle.tsx` : chaque préfixe existe dans le composant', () => {
    // Le jugement recopie les libellés de `describeAction` : si le composant change un libellé,
    // ce test tombe, au lieu de laisser le harnais compter « sans bouton » à tort.
    const source = lire('src/pages/Battle.tsx');
    for (const libelle of [
      'Poser au Poste',
      'Mettre au Banc ',
      'Jouer cet Objet',
      'Jouer ce Collègue',
      'Faire évoluer',
      'Changement de priorité',
      'Attacher 1 café',
      'Rotation',
      'Talent',
      'Relève',
      'Choisir cette carte',
      'Fin du tour',
      'Passer le tour de la Direction',
      'Abandonner'
    ]) {
      expect(source, `libellé « ${libelle} » absent de Battle.tsx`).toContain(libelle);
    }
  });
});

describe('comparerAffordances (l’oracle)', () => {
  const legales: Action[] = [{ type: 'attack' }, { type: 'endTurn' }, { type: 'attachEnergy', targetUid: 'a' }];

  it('rend nul quand l’écran offre exactement ce qui est légal', () => {
    const visibles = [
      { type: 'attack', actif: true },
      { type: 'endTurn', actif: true },
      { type: 'attachEnergy', actif: true }
    ];
    expect(comparerAffordances({ legales, visibles })).toEqual([]);
  });

  it('mord : une action légale sans bouton est signalée', () => {
    // Le cas fautif : « Attacher 1 café » est légal, le bouton est absent de l'écran.
    const visibles = [
      { type: 'attack', actif: true },
      { type: 'endTurn', actif: true }
    ];
    expect(comparerAffordances({ legales, visibles })).toEqual([
      { type: 'sans-bouton', geste: 'attachEnergy', attendu: 1, offert: 0 }
    ]);
  });

  it('mord : un bouton grisé ne compte pas comme offert', () => {
    // Un bouton désactivé n'est pas cliquable : l'action légale reste sans bouton utilisable.
    const visibles = [
      { type: 'attack', actif: false },
      { type: 'endTurn', actif: true },
      { type: 'attachEnergy', actif: true }
    ];
    expect(comparerAffordances({ legales, visibles })).toEqual([
      { type: 'sans-bouton', geste: 'attack', attendu: 1, offert: 0 }
    ]);
  });

  it('signale aussi un bouton qui n’a aucune action légale derrière', () => {
    const visibles = [
      { type: 'attack', actif: true },
      { type: 'endTurn', actif: true },
      { type: 'attachEnergy', actif: true },
      { type: 'attachEnergy', actif: true }
    ];
    expect(comparerAffordances({ legales, visibles })).toEqual([
      { type: 'bouton-sans-action', geste: 'attachEnergy', attendu: 1, offert: 2 }
    ]);
  });
});

describe('jugerCible (cliquable à son centre)', () => {
  const bonne = { visible: true, actif: true, dansLaFenetre: true, dessusEstCible: true };

  it('accepte une cible visible, active, dans la fenêtre et non recouverte', () => {
    expect(jugerCible(bonne)).toEqual([]);
  });

  it('mord : un bouton recouvert par un calque est signalé', () => {
    expect(jugerCible({ ...bonne, dessusEstCible: false })).toEqual(['recouvert']);
  });

  it('signale un bouton invisible, désactivé, ou hors de la fenêtre', () => {
    expect(jugerCible({ ...bonne, visible: false })).toEqual(['invisible']);
    expect(jugerCible({ ...bonne, actif: false })).toEqual(['desactive']);
    expect(jugerCible({ ...bonne, dansLaFenetre: false })).toEqual(['hors-fenetre']);
  });
});

describe('jugerClic (une action parle)', () => {
  it('rend ok quand le clic est accepté et que l’écran change', () => {
    expect(jugerClic({ accepte: true, texteAvant: 'Tour 1 · à toi', texteApres: 'Tour 1 · à la Direction' })).toBe(
      'ok'
    );
  });

  it('mord : un clic sans effet sur le moteur est signalé', () => {
    expect(jugerClic({ accepte: false, texteAvant: 'x', texteApres: 'x' })).toBe('sans-effet');
  });

  it('mord : une action appliquée sans rien changer à l’écran est silencieuse', () => {
    // Le cas fautif : le moteur a accepté le coup, l'écran n'a pas bougé d'un caractère.
    expect(
      jugerClic({ accepte: true, texteAvant: 'Tour 1 · à toi  Fin du tour', texteApres: 'Tour 1 · à toi Fin du tour' })
    ).toBe('silencieux');
  });
});

describe('jugerFinPartie', () => {
  it('reconnaît une partie finie des deux côtés, avec son verdict', () => {
    const r = jugerFinPartie({
      tete: 'Combat Tour 14 · partie terminée',
      notices: ['Tu remportes la partie.'],
      phaseMoteur: 'ended'
    });
    expect(r).toEqual({ terminee: true, verdict: 'Tu remportes la partie.', anomalies: [] });
  });

  it('mord : un moteur fini sans écran fini est une fin non affichée', () => {
    const r = jugerFinPartie({ tete: 'Combat · à toi', notices: [], phaseMoteur: 'ended' });
    expect(r.terminee).toBe(false);
    expect(r.anomalies).toEqual(['fin-non-affichee']);
  });

  it('mord : un écran fini sans moteur fini est une fin anticipée', () => {
    const r = jugerFinPartie({ tete: 'partie terminée', notices: ['égalité'], phaseMoteur: 'playing' });
    expect(r.terminee).toBe(false);
    expect(r.anomalies).toEqual(['fin-anticipee']);
  });

  it('mord : une partie finie sans verdict affiché est signalée', () => {
    const r = jugerFinPartie({ tete: 'partie terminée', notices: [], phaseMoteur: 'ended' });
    expect(r.anomalies).toEqual(['verdict-absent']);
  });
});

describe('choisirAction (le joueur de test)', () => {
  it('ne joue jamais le forfait, et ne rend rien s’il ne reste que lui', () => {
    expect(choisirAction([{ type: 'forfeit' }])).toBeNull();
    expect(choisirAction([{ type: 'forfeit' }, { type: 'endTurn' }])).toEqual({ type: 'endTurn' });
  });

  it('préfère la Pression, puis le café, puis la fin du tour', () => {
    const legales: Action[] = [{ type: 'endTurn' }, { type: 'attachEnergy', targetUid: 'a' }, { type: 'attack' }];
    expect(choisirAction(legales)?.type).toBe('attack');
    expect(choisirAction(legales.slice(0, 2))?.type).toBe('attachEnergy');
  });

  it('mord : écarte une action déjà muette tant qu’une autre existe', () => {
    const muette: Action = { type: 'attack' };
    const legales: Action[] = [muette, { type: 'endTurn' }];
    const muettes = new Set([JSON.stringify(muette)]);
    expect(choisirAction(legales, muettes)?.type).toBe('endTurn');
  });

  it('retombe sur une action muette quand il n’y a plus que celle-là', () => {
    const muette: Action = { type: 'endTurn' };
    expect(choisirAction([muette], new Set([JSON.stringify(muette)]))).toEqual(muette);
  });
});

describe('rangDansLeType', () => {
  it('donne le rang d’une action parmi celles de son type', () => {
    const legales: Action[] = [
      { type: 'playBasic', uid: 'u1', slot: 'active' },
      { type: 'playBasic', uid: 'u1', slot: 0 },
      { type: 'endTurn' }
    ];
    expect(rangDansLeType(legales, legales[1])).toBe(1);
    expect(rangDansLeType(legales, legales[2])).toBe(0);
  });
});

describe('jouePar (qui doit jouer)', () => {
  it('rend le camp au trait quand rien n’est en attente', () => {
    expect(jouePar({ current: 'player', pendingPromotion: null, pendingChoice: null })).toBe('player');
  });

  it('mord : une relève du joueur passe avant le tour de la Direction', () => {
    // Le cas fautif de l'écran : le moteur est à la Direction, mais c'est le joueur qui doit choisir.
    expect(jouePar({ current: 'ai', pendingPromotion: 'player', pendingChoice: null })).toBe('player');
    expect(jouePar({ current: 'ai', pendingPromotion: null, pendingChoice: { who: 'player' } })).toBe('player');
  });

  it('mord : une relève de la Direction ne rend pas la main au joueur', () => {
    expect(jouePar({ current: 'player', pendingPromotion: 'ai', pendingChoice: null })).toBe('ai');
  });
});
