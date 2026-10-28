import { describe, expect, it } from 'vitest';
import { factionDeck } from '@/game/simulation';
import {
  BANDE_ARCHETYPES,
  ECART_ALERTE,
  GRAINE_MESURE_ARCHETYPES,
  ecartAlerte,
  ecartEnPoints,
  formatTableArchetypes,
  formeDeck,
  mesurerArchetypes,
  pairesArchetypes,
  pressionPayable
} from '@/game/mesure-archetypes';
import { GRAINES_DE_LA_POLITIQUE, GRAINE_MESURE_DIRECTION } from '@/game/mesure-direction';

/**
 * **La table des archétypes mord-elle ?** (#360, D-134 (2))
 *
 * Le contrôle demandé par la spec est **le contrôle mord** : un écart de **16 points** doit
 * lever l'alerte, un écart de **14** non. Une assertion qui répondrait « alerte » aux deux
 * ne garderait rien ; celle-ci lit le même seuil que la table publiée.
 *
 * S'y ajoutent la **reproductibilité** (même graine → même table) et la **disjonction des
 * graines** (aucune graine du pesage #111, aucune de la mesure de la Direction #354).
 *
 * Les parties sont peu nombreuses et fixes : la table publiée se régénère par la commande
 * `npm run mesure:archetypes`, pas par `npm test`.
 */
describe('table des archétypes (#360)', () => {
  const OPTIONS = { partiesParPaire: 4, factions: ['ATELIER', 'RH', 'SSE'] as const };

  it('le contrôle mord : 16 points lèvent l’alerte, 14 non', () => {
    // 0,66 → 16 points ; 0,64 → 14 points.
    expect(ecartEnPoints(0.66)).toBeCloseTo(16, 5);
    expect(ecartEnPoints(0.64)).toBeCloseTo(14, 5);
    expect(ecartAlerte(0.66)).toBe(true);
    expect(ecartAlerte(0.64)).toBe(false);
    // Symétrique : un archétype qui écrase d'en dessous compte aussi.
    expect(ecartAlerte(0.34)).toBe(true);
    expect(ecartAlerte(0.36)).toBe(false);
    // Le seuil lui-même (15,0 points) est **encore** assumé : le dépassement est strict.
    expect(ECART_ALERTE).toBe(0.15);
    expect(ecartAlerte(0.65)).toBe(false);
    expect(ecartAlerte(0.6501)).toBe(true);
    // Une donnée absente ne lève pas d'alerte par accident.
    expect(ecartAlerte(Number.NaN)).toBe(false);
  });

  it('reproduit la même table à graine fixe', () => {
    const une = mesurerArchetypes(OPTIONS);
    const deux = mesurerArchetypes(OPTIONS);
    expect(deux).toEqual(une);
  });

  it('mesure toutes les paires, en miroir, et chaque ligne a son compte', () => {
    const rapport = mesurerArchetypes(OPTIONS);
    // Trois factions → trois paires, dans l'ordre des factions données.
    expect(rapport.paires.map((l) => `${l.a}/${l.b}`)).toEqual(['ATELIER/RH', 'ATELIER/SSE', 'RH/SSE']);
    for (const ligne of rapport.paires) {
      expect(ligne.parties).toBe(4);
      expect(ligne.victoiresA + ligne.victoiresB + ligne.nulles).toBe(4);
      expect(ligne.horsBande).toBe(ligne.tauxA < BANDE_ARCHETYPES.bas || ligne.tauxA > BANDE_ARCHETYPES.haut);
    }
    // L'agrégat d'un archétype couvre ses deux affrontements.
    const atelier = rapport.archetypes.find((a) => a.faction === 'ATELIER')!;
    expect(atelier.parties).toBe(8);
  });

  it('dix factions font quarante-cinq affrontements', () => {
    expect(pairesArchetypes()).toHaveLength(45);
  });

  /**
   * **La forme des Decks** (#412) : un écart entre deux archétypes se lit d'abord dans le
   * Deck, pas dans la courbe de ses Pressions. Publiée avec la table, elle doit rester vraie
   * — un Deck qui perd son N+2 n'a pas de réponse à un COMEX de 180 de Seuil, et le document
   * de mesure n'a pas à le deviner.
   */
  it('publie la forme des Decks mesurés, lue dans le catalogue (#412)', () => {
    const rapport = mesurerArchetypes(OPTIONS);
    expect(rapport.decks.map((deck) => deck.faction)).toEqual(['ATELIER', 'RH', 'SSE']);
    for (const deck of rapport.decks) {
      // Un Deck d'archétype fait 20 cartes ; ses stades et ses Actions les partagent tous.
      expect(deck.cartes, deck.faction).toBe(20);
      expect(deck.entrants + deck.n1 + deck.n2 + deck.actions, deck.faction).toBe(deck.cartes);
      // Les COMEX font partie des N+2 : la somme ne les compte pas deux fois.
      expect(deck.comex, deck.faction).toBeLessThanOrEqual(deck.n2);
      expect(deck.seuilMax, deck.faction).toBeGreaterThan(0);
      // Chaque Pression du Deck est comptée, et les payables en sont un sous-ensemble.
      expect(deck.pressions, deck.faction).toBeGreaterThan(0);
      expect(deck.payables, deck.faction).toBeLessThanOrEqual(deck.pressions);
    }
    // Le contrôle mord : la forme est publiée par le formateur, pas seulement calculée.
    const markdown = formatTableArchetypes(rapport);
    expect(markdown).toContain('### La forme des Decks mesurés');
    expect(markdown).toMatch(/\| SSE \| 20 \|/);
  });

  it('publie la composition de chaque Deck, carte par carte, et le plafond d’Entrants (#417)', () => {
    const forme = formeDeck('SSE', factionDeck('SSE'));
    const exemplaires = forme.composition.reduce((somme, ligne) => somme + ligne.exemplaires, 0);
    expect(exemplaires).toBe(20);
    expect(forme.composition.every((ligne) => ligne.exemplaires <= 2)).toBe(true);
    expect(forme.composition.some((ligne) => ligne.stade === 'Action' || ligne.stade === 'ENTRANT')).toBe(true);

    const rapport = mesurerArchetypes({ ...OPTIONS, factions: ['SSE', 'RH'] });
    expect(rapport.entrantsMax).toBe(8);
    const markdown = formatTableArchetypes(rapport);
    expect(markdown).toContain('### La composition des Decks mesurés');
    expect(markdown).toContain('Plafond : 8 Entrants distincts');
  });

  it('compte une Pression payable comme le moteur la paie (D-037) : le contrôle mord', () => {
    // L'incolore accepte n'importe quel café ; un symbole typé exige son type.
    expect(pressionPayable(['INCOLORE'], [])).toBe(true);
    expect(pressionPayable(['SSE'], ['SSE'])).toBe(true);
    expect(pressionPayable(['SSE'], ['RH', 'ATELIER'])).toBe(false);
    expect(pressionPayable(['RH', 'ATELIER'], ['SSE', 'RH', 'ATELIER'])).toBe(true);
    // Une Pression entièrement impayable ne compte pas, même à un seul symbole près.
    expect(pressionPayable(['RH', 'ATELIER'], ['SSE', 'ATELIER'])).toBe(false);
  });

  it('les graines de la table sont disjointes de celles de la politique et de la Direction', () => {
    expect(GRAINES_DE_LA_POLITIQUE).not.toContain(GRAINE_MESURE_ARCHETYPES);
    expect(GRAINE_MESURE_ARCHETYPES).not.toBe(GRAINE_MESURE_DIRECTION);
  });
});
