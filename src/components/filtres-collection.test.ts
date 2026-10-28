import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isPlanque } from '@/data';
import type { Card } from '@/data/types';
import {
  COUTS_PRESENTS,
  FILTRES_DEFAUT,
  ecrireFiltres,
  filtrerCartes,
  filtresActifs,
  lireFiltres,
  libelleCout
} from './filtres-collection';
import { TRI_DEFAUT } from './tri-cartes';

const possedeeUne = (id: string) => ({ [id]: 1 });

describe('filtres de la Collection (#365)', () => {
  it('filtre par rareté : toutes les cartes rendues ont cette rareté', () => {
    const rendues = filtrerCartes(ALL_CARDS, { ...FILTRES_DEFAUT, rarete: '1S' }, {});
    expect(rendues.length).toBeGreaterThan(0);
    expect(rendues.every((card) => card.rarity === '1S')).toBe(true);
  });

  it('le contrôle mord : le catalogue contient d’autres raretés, donc le filtre retire quelque chose', () => {
    // Un filtre rareté qui ne filtrerait pas laisserait passer ces cartes : le test échoue alors.
    const autres = ALL_CARDS.filter((card) => card.rarity !== '1S');
    expect(autres.length).toBeGreaterThan(0);
    const rendues = filtrerCartes(ALL_CARDS, { ...FILTRES_DEFAUT, rarete: '1S' }, {});
    expect(rendues.length).toBeLessThan(ALL_CARDS.length);
    expect(rendues.some((card) => card.rarity !== '1S')).toBe(false);
  });

  it('filtre par coût : une carte passe si une de ses Pressions coûte ce nombre de cafés', () => {
    for (const cafes of COUTS_PRESENTS) {
      const rendues = filtrerCartes(ALL_CARDS, { ...FILTRES_DEFAUT, cout: cafes }, {});
      expect(rendues.length, `coût ${cafes}`).toBeGreaterThan(0);
      for (const card of rendues) {
        expect(isPlanque(card) && card.attacks.some((a) => a.cost.length === cafes)).toBe(true);
      }
    }
  });

  it('les cartes Action ne passent pas un filtre de coût', () => {
    const action = ALL_CARDS.find((card) => !isPlanque(card));
    expect(action).toBeTruthy();
    const rendues = filtrerCartes(ALL_CARDS, { ...FILTRES_DEFAUT, cout: COUTS_PRESENTS[0] }, {});
    expect(rendues.some((card) => card.id === action!.id)).toBe(false);
  });

  it('« seulement ce que je possède » ne garde que les cartes possédées au moins une fois', () => {
    const carte = ALL_CARDS[0];
    const rendues = filtrerCartes(ALL_CARDS, { ...FILTRES_DEFAUT, possedees: true }, possedeeUne(carte.id));
    expect(rendues.map((c) => c.id)).toEqual([carte.id]);
    expect(filtrerCartes(ALL_CARDS, { ...FILTRES_DEFAUT, possedees: true }, {})).toEqual([]);
  });

  it('les filtres se combinent (ET) : rareté et possession ensemble', () => {
    const rare = ALL_CARDS.find((card) => card.rarity === '1S')!;
    const commune = ALL_CARDS.find((card) => card.rarity === '1D')!;
    const owned = { [rare.id]: 1, [commune.id]: 1 };
    const rendues = filtrerCartes(ALL_CARDS, { ...FILTRES_DEFAUT, rarete: '1S', possedees: true }, owned);
    expect(rendues.map((c) => c.id)).toEqual([rare.id]);
  });

  it('la recherche textuelle se combine avec les nouveaux filtres', () => {
    const rendues = filtrerCartes(ALL_CARDS, { ...FILTRES_DEFAUT, texte: 'zzzz-introuvable' }, {});
    expect(rendues).toEqual([]);
    expect(filtresActifs({ ...FILTRES_DEFAUT, texte: '  ' })).toBe(0);
    expect(filtresActifs({ ...FILTRES_DEFAUT, texte: 'x', rarete: '1S', possedees: true })).toBe(3);
  });

  it('lit et écrit les filtres dans l’adresse, sans valeur par défaut', () => {
    const filtres = { ...FILTRES_DEFAUT, texte: 'infirmier', rarete: '2S' as const, cout: 2, possedees: true };
    const adresse = ecrireFiltres(new URLSearchParams(), filtres, 'nom');
    expect(adresse.get('rarete')).toBe('2S');
    expect(adresse.get('cout')).toBe('2');
    expect(adresse.get('possedees')).toBe('1');
    expect(lireFiltres(adresse)).toEqual({ filtres, tri: 'nom' });

    const propre = ecrireFiltres(adresse, FILTRES_DEFAUT, TRI_DEFAUT);
    expect([...propre.keys()]).toEqual([]);
  });

  it('une valeur inconnue dans l’adresse retombe sur le défaut (on ne filtre pas sur du vide)', () => {
    const { filtres, tri } = lireFiltres(
      new URLSearchParams('rarete=ZZ&cout=99&faction=NOPE&tri=bidule&possedees=oui')
    );
    expect(filtres).toEqual(FILTRES_DEFAUT);
    expect(tri).toBe(TRI_DEFAUT);
  });

  it('libelle le coût : « 1 café », « 2 cafés », « Gratuite » pour zéro', () => {
    expect(libelleCout(0)).toBe('Gratuite');
    expect(libelleCout(1)).toBe('1 café');
    expect(libelleCout(3)).toBe('3 cafés');
  });

  it('ne retire rien quand aucun filtre n’est posé', () => {
    const cartes: Card[] = ALL_CARDS;
    expect(filtrerCartes(cartes, FILTRES_DEFAUT, {})).toHaveLength(cartes.length);
  });
});
