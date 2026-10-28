import { describe, expect, it } from 'vitest';
import { ALL_INTERIM_CARDS, INTERIM_CARDS, INTERIM_VARIANTS } from '@/data/interim';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, getCard, isPlanque, vivierOf } from '@/data';
import { MAX_DECK_CAFE_TYPES } from '@/game/deck';
import type { CafeSymbol, PlanqueCard } from '@/data/types';

/**
 * Contrôles propres à la faction **Intérim** (code `INT`), ticket #22.
 *
 * Les conventions générales (identifiants, lignes d'évolution, Seuil, dégâts par
 * café, vocabulaire) sont déjà vérifiées sur `ALL_CARDS` par `cards.test.ts` : ce
 * fichier ne contrôle que ce que le ticket demande explicitement — le **nombre
 * d'entrées** (`PROPOSITION.md` §4.3 : 4), le **vivier Bureaux** (D-026), l'absence
 * de **vulnérabilité** et le **COMEX** (D-020, D-027).
 */

const byId = (id: string): PlanqueCard | undefined => {
  const card = getCard(id);
  return isPlanque(card) ? card : undefined;
};

const LINE = ['interim-interimaire', 'interim-interimaire-confirme', 'interim-chef-equipe-interimaire'];

describe('Intérim — enregistrement (ticket #22)', () => {
  it('compte 10 entrées, toutes des bases (vague 2, #86 ; vague #352)', () => {
    // Les 4 entrées de `PROPOSITION.md` §4.3 (la ligne à 3 stades + la carte signature
    // COMEX) sont dépassées de 2 : la vague 2 (#86) ajoute une ligne à 3 stades pour
    // atteindre la cible de rareté `CARD-SPEC.md` §1 (42 cartes en 3◆). La vague #352
    // ajoute 4 bases (Vacataire, Chargé de mission → Coordinateur intérimaire,
    // Suppléant) : la faction atteint **10 noms de base**, le minimum pour un Deck
    // mono-faction de 20 cartes. L'écart avec le quota de faction est signalé au ticket #63.
    expect(INTERIM_CARDS).toHaveLength(10);
    expect(INTERIM_VARIANTS).toHaveLength(0);
    expect(ALL_INTERIM_CARDS).toHaveLength(10);
  });

  it('est enregistrée dans ALL_CARDS et CARD_BY_ID', () => {
    for (const card of ALL_INTERIM_CARDS) {
      expect(ALL_CARDS, card.id).toContain(card);
      expect(CARD_BY_ID.get(card.id), card.id).toBe(card);
    }
    // Le spread de `index.ts` : aucune carte de la faction ne doit manquer.
    expect(ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'INTERIM')).toHaveLength(
      ALL_INTERIM_CARDS.length
    );
  });

  it('identifie chaque carte par le préfixe `interim-` (AGENTS.md §5)', () => {
    for (const card of ALL_INTERIM_CARDS) {
      expect(card.id, card.id).toMatch(/^interim-[a-z0-9-]*$/);
      expect(card.faction, card.id).toBe('INTERIM');
    }
  });

  it('range toute la faction dans le vivier Bureaux (D-026)', () => {
    expect(FACTION_META.INTERIM.vivier).toBe('BUREAUX');
    for (const card of ALL_INTERIM_CARDS) {
      expect(vivierOf(card), card.id).toBe('BUREAUX');
    }
  });
});

describe('Intérim — Dragon sans faiblesse (AGENTS.md §3.2)', () => {
  it('ne donne aucune vulnérabilité à la faction', () => {
    for (const card of ALL_INTERIM_CARDS.filter(isPlanque)) {
      expect(card.weakness, card.id).toBeNull();
    }
  });
});

describe('Intérim — ligne et COMEX (D-020)', () => {
  it('a une ligne complète Entrant → N+1 → N+2', () => {
    const [entrant, n1, n2] = LINE.map(byId);
    expect(entrant?.stage).toBe('ENTRANT');
    expect(entrant?.evolvesFrom).toBeUndefined();
    expect(n1?.stage).toBe('N+1');
    expect(n1?.evolvesFrom).toBe(LINE[0]);
    expect(n2?.stage).toBe('N+2');
    expect(n2?.evolvesFrom).toBe(LINE[1]);
  });

  it('a exactement un COMEX, en 4 diamants, à 2 Interventions', () => {
    const comex = ALL_INTERIM_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex).toHaveLength(1);
    expect(comex[0]?.id).toBe('interim-interimaire-legendaire-ex');
    // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
    expect(comex[0]?.rarity).toBe('4D');
    expect(comex[0]?.stage).toBe('N+2');
    expect(comex[0]?.evolvesFrom).toBe('interim-interimaire-confirme');
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of INTERIM_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });
});

/**
 * Ticket **#116** : une **ligne d'évolution** doit rester payable avec les types de café
 * d'un Deck, donc avec **au plus `MAX_DECK_CAFE_TYPES`** symboles typés distincts
 * (D-034, D-037 (4)). Le contrôle est **par ligne**, pas carte par carte : une ligne joue
 * ses trois stades avec le même Deck, et c'est l'union qui décide si le joueur peut
 * évoluer sans perdre l'accès à ses Pressions.
 *
 * Le contrôle est un **prédicat nommé** (`typesExiges`, `pairesDeLigne`) pour qu'un test
 * « le contrôle mord » puisse le confronter aux coûts d'avant le correctif — une assertion
 * qui ne peut pas échouer ne garde rien (AGENTS.md §6, #112).
 */
const PLANQUES_INTERIM: PlanqueCard[] = ALL_INTERIM_CARDS.filter(isPlanque);

/**
 * Les **lignes d'évolution** de la faction : chaque chemin d'une racine (Entrant) à une
 * feuille (une carte sans successeur). Le graphe en compte **six** (#352) : la N+1
 * `interim-interimaire-confirme` se ramifie vers le N+2 et vers le COMEX, la ligne
 * `interim-charge-mission → interim-coordinateur-interimaire` est nouvelle, et les deux
 * Entrants seuls (`interim-vacataire`, `interim-suppleant`) sont des lignes d'un stade.
 */
function lignesDEvolution(cards: readonly PlanqueCard[]): PlanqueCard[][] {
  const enfants = new Map<string, PlanqueCard[]>();
  for (const card of cards) {
    if (!card.evolvesFrom) continue;
    enfants.set(card.evolvesFrom, [...(enfants.get(card.evolvesFrom) ?? []), card]);
  }
  const lignes: PlanqueCard[][] = [];
  const descendre = (chemin: PlanqueCard[]): void => {
    const suite = enfants.get(chemin[chemin.length - 1].id) ?? [];
    if (suite.length === 0) {
      lignes.push(chemin);
      return;
    }
    for (const enfant of suite) descendre([...chemin, enfant]);
  };
  for (const card of cards.filter((entry) => !entry.evolvesFrom)) descendre([card]);
  return lignes;
}

/** Les symboles **typés** exigés par une liste de coûts, sans doublon ni `INCOLORE`. */
const typesExiges = (couts: readonly (readonly CafeSymbol[])[]): string[] =>
  [...new Set(couts.flat())].filter((symbol) => symbol !== 'INCOLORE');

/** Les types distincts qu'une ligne exige, **tous stades confondus**. */
const typesDeLigne = (ligne: readonly PlanqueCard[]): string[] =>
  typesExiges(ligne.flatMap((card) => card.attacks.map((attack) => attack.cost)));

/**
 * Les paires de types des Pressions à 2 cafés et plus, sur les stades **N+1 et N+2** :
 * c'est là que D-037 (3) impose deux types produits distincts. Une ligne doit garder la
 * **même** paire d'un stade à l'autre — sinon chaque évolution réclame un nouveau type.
 */
const pairesDeLigne = (ligne: readonly PlanqueCard[]): string[] =>
  ligne
    .filter((card) => card.stage !== 'ENTRANT')
    .flatMap((card) => card.attacks)
    .filter((attack) => attack.cost.length >= 2)
    .map((attack) => typesExiges([attack.cost]).sort().join(' + '));

describe('Intérim — lignes payables avec les types du Deck (#116, D-034, D-037 (4))', () => {
  const LIGNES = lignesDEvolution(PLANQUES_INTERIM);
  const etiquette = (ligne: readonly PlanqueCard[]): string => ligne.map((card) => card.id).join(' → ');

  it('décrit six lignes : deux partagent la N+1, les autres ont leur propre sortie', () => {
    expect(LIGNES).toHaveLength(6);
    expect(new Set(LIGNES.map((ligne) => ligne[ligne.length - 1].id))).toEqual(
      new Set([
        'interim-chef-equipe-interimaire',
        'interim-interimaire-legendaire-ex',
        'interim-responsable-interim',
        // Vague #352 : un Entrant seul de chaque côté de la ligne nouvelle.
        'interim-vacataire',
        'interim-coordinateur-interimaire',
        'interim-suppleant'
      ])
    );
    expect(LIGNES.filter((ligne) => ligne[1]?.id === 'interim-interimaire-confirme')).toHaveLength(2);
  });

  it(`n’exige pas plus de ${MAX_DECK_CAFE_TYPES} types par ligne, tous stades confondus`, () => {
    for (const ligne of LIGNES) {
      const types = typesDeLigne(ligne);
      expect(types.length, `${etiquette(ligne)} : ${types.join(', ')}`).toBeLessThanOrEqual(
        MAX_DECK_CAFE_TYPES
      );
    }
  });

  it('garde la même paire de types du N+1 au N+2', () => {
    // Une ligne d'un seul stade (un Entrant seul, #352) n'a pas de paire à garder : la
    // règle porte sur les Pressions à 2 cafés, qui n'existent qu'à partir du N+1.
    const evolutives = LIGNES.filter((ligne) => ligne.some((card) => card.stage !== 'ENTRANT'));
    expect(evolutives.length, 'aucune ligne évolutive à contrôler').toBeGreaterThan(0);
    for (const ligne of evolutives) {
      const paires = pairesDeLigne(ligne);
      expect(paires.length, etiquette(ligne)).toBeGreaterThan(0);
      for (const paire of paires) expect(paire.split(' + '), etiquette(ligne)).toHaveLength(2);
      expect(new Set(paires).size, `${etiquette(ligne)} : ${paires.join(' | ')}`).toBe(1);
    }
  });

  it('le contrôle mord : les coûts d’avant #116 (cinq types sur une ligne) sont refusés', () => {
    // La ligne `interim-interimaire → …-confirme → …-chef-equipe-interimaire` avant le
    // correctif : `SSE`, `MANAGEMENT`, `QVT`, `AMELIORATION` et `RH` — cinq types pour
    // trois stades, donc aucun Deck plafonné à trois ne peut payer la ligne entière.
    const avant: CafeSymbol[][] = [
      ['SSE'],
      ['MANAGEMENT', 'QVT'],
      ['QVT', 'AMELIORATION'],
      ['AMELIORATION', 'AMELIORATION', 'RH']
    ];
    expect(typesExiges(avant)).toHaveLength(5);
    expect(typesExiges(avant).length).toBeGreaterThan(MAX_DECK_CAFE_TYPES);
  });
});
