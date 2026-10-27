import { describe, expect, it } from 'vitest';
import type { ActionCard, Attack, PlanqueCard } from '@/data/types';
import { phraseDePortee } from './portee';

/**
 * **La ligne de portée, testée seule** (#324, extraite de `Battle.tsx`).
 *
 * Elle était un ternaire imbriqué de six conditions dans un fichier déjà très gros, et elle
 * lisait `hasAttacked`, le Poste et les Pressions légales — de la Feature Envy vers le moteur.
 * Extraite, elle se dit cas par cas ici, sans monter React ni créer une partie : **aucune règle
 * de jeu** n'est décidée dans cette fonction, `enPortee` et `dejaPortee` sont les verdicts du
 * moteur, et la phrase ne fait que les mettre en français.
 */

/** Une Pression à un café typé, son nom et son coût étant ce que la ligne affiche. */
function pression(name: string, cafe: Attack['cost'][number], damage = 20): Attack {
  return { name, cost: [cafe], damage };
}

/** Un Planqué minimal : seuls ses Pressions comptent pour la ligne de portée. */
function planque(attaques: Attack[]): PlanqueCard {
  return {
    id: 'sse-model',
    name: 'Planqué de test',
    faction: 'SSE',
    rarity: '1D',
    flavor: 'Une scène de bureau.',
    glyph: '✚',
    palette: '#1f8a68',
    kind: 'PLANQUE',
    stage: 'ENTRANT',
    hp: 60,
    retreat: 1,
    weakness: 'MANAGEMENT',
    attacks: attaques
  };
}

/** Une Action : elle peut être au Poste, mais elle ne porte aucune Pression. */
const action: ActionCard = {
  id: 'sse-objet',
  name: 'Un Objet',
  faction: 'SSE',
  rarity: '1D',
  flavor: 'Une scène de bureau.',
  glyph: '✚',
  palette: '#1f8a68',
  kind: 'OBJET',
  text: 'Un effet.',
  effects: []
};

const pressionSimple = pression('Relecture', 'MANAGEMENT');
const pressionChere = pression('Audit', 'QVT', 40);

describe('phraseDePortee — la phrase de portée de la barre (#320, #324)', () => {
  it('se tait quand ce n’est pas mon tour, même si le café ne couvre rien', () => {
    expect(
      phraseDePortee({ aMoi: false, poste: planque([pressionSimple]), dejaPortee: false, enPortee: [] })
    ).toBeUndefined();
    // Le contrôle mord : le même état à mon tour parle — sans `aMoi`, la ligne ne dirait rien.
    expect(phraseDePortee({ aMoi: true, poste: planque([pressionSimple]), dejaPortee: false, enPortee: [] })).toBe(
      'Hors de portée du café : Relecture (Management).'
    );
  });

  it('se tait sans Poste, sur une Action au Poste, ou sur un Planqué sans Pression', () => {
    expect(phraseDePortee({ aMoi: true, poste: undefined, dejaPortee: false, enPortee: [] })).toBeUndefined();
    expect(phraseDePortee({ aMoi: true, poste: action, dejaPortee: false, enPortee: [] })).toBeUndefined();
    expect(phraseDePortee({ aMoi: true, poste: planque([]), dejaPortee: true, enPortee: [] })).toBeUndefined();
  });

  it('se tait quand le café couvre toutes les Pressions du Poste', () => {
    const poste = planque([pressionSimple, pressionChere]);
    expect(phraseDePortee({ aMoi: true, poste, dejaPortee: false, enPortee: poste.attacks })).toBeUndefined();
  });

  it('nomme chaque Pression hors de portée, avec son coût, dans l’ordre de la carte', () => {
    const poste = planque([pressionSimple, pressionChere]);
    expect(phraseDePortee({ aMoi: true, poste, dejaPortee: false, enPortee: [pressionSimple] })).toBe(
      'Hors de portée du café : Audit (QVT).'
    );
    expect(phraseDePortee({ aMoi: true, poste, dejaPortee: false, enPortee: [] })).toBe(
      'Hors de portée du café : Relecture (Management), Audit (QVT).'
    );
    // Un coût à deux cafés s'écrit avec son séparateur : c'est le même libellé que la carte.
    const double = planque([{ name: 'Comité', cost: ['MANAGEMENT', 'QVT'], damage: 60 }]);
    expect(phraseDePortee({ aMoi: true, poste: double, dejaPortee: false, enPortee: [] })).toBe(
      'Hors de portée du café : Comité (Management · QVT).'
    );
  });

  it('la Pression déjà portée passe avant le café : le tour est fini, ce n’est pas un coût', () => {
    const poste = planque([pressionSimple, pressionChere]);
    // Toutes les Pressions seraient « hors de portée » (le moteur rend une liste vide quand le
    // tour est fini) : la phrase dit la Pression, pas un manque de café.
    expect(phraseDePortee({ aMoi: true, poste, dejaPortee: true, enPortee: [] })).toBe('Pression déjà portée ce tour.');
    // Et elle le dit aussi quand le café couvrirait tout.
    expect(phraseDePortee({ aMoi: true, poste, dejaPortee: true, enPortee: poste.attacks })).toBe(
      'Pression déjà portée ce tour.'
    );
  });
});
