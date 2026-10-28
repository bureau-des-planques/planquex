import { describe, expect, it } from 'vitest';
import { ALL_CARDS, FACTION_META, isPlanque } from '@/data';
import type { Faction, PlanqueCard, Stage } from '@/data/types';
import { DECK_SIZE, MAX_COPIES_PER_NAME, deckLegal } from '@/game/deck';

/**
 * **Chaque faction peut tenir un Deck de 20 cartes** (ticket #352).
 *
 * Un Deck de 20 cartes avec **2 exemplaires par nom** demande **10 noms distincts**
 * (`DECK_SIZE / MAX_COPIES_PER_NAME`). Une faction qui n'en a que 6 ne peut pas être
 * jouée seule : son Deck est refusé, et rien ne dit au testeur que c'est le **contenu**
 * qui manque. Le 27/10/2026, le Syndicat en avait 6 et l'Intérim 6.
 *
 * Le contrôle porte sur les **cartes de base** seulement : une variante secrète partage
 * le nom de sa base et ne compte donc pas comme un nom de plus (`deck.ts` compte par nom).
 *
 * Il **mord** : le prédicat est nommé et confronté, plus bas, à une faction privée d'un
 * nom — une assertion qui ne peut pas échouer ne garde rien (`AGENTS.md` §6, #112).
 */

/** Les noms distincts qu'un Deck mono-faction demande (`20 / 2`). */
const NOMS_MINIMUM = DECK_SIZE / MAX_COPIES_PER_NAME;

const STAGE_ORDER: Record<Stage, number> = { ENTRANT: 0, 'N+1': 1, 'N+2': 2 };

/** Les Planqués de **base** d'une faction — les seuls à porter un nom propre. */
const basesDe = (faction: Faction, cards: readonly PlanqueCard[]): PlanqueCard[] =>
  cards.filter((card) => card.faction === faction);

/** Les noms distincts portés par ces cartes. */
const nomsDistincts = (cards: readonly PlanqueCard[]): number => new Set(cards.map((card) => card.name)).size;

/**
 * Un Deck mono-faction de 20 cartes : 2 exemplaires de chaque nom, Entrants d'abord pour
 * que le Deck porte toujours son Planqué Entrant. L'ordre est **déterministe** (stade
 * puis id) : un rapport d'échec doit être le même d'une machine à l'autre.
 */
const deckMonoFaction = (cards: readonly PlanqueCard[]): string[] => {
  const deck: string[] = [];
  const ordonnees = [...cards].sort(
    (a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const vus = new Set<string>();
  for (const card of ordonnees) {
    if (deck.length >= DECK_SIZE) break;
    if (vus.has(card.name)) continue;
    vus.add(card.name);
    for (let copie = 0; copie < MAX_COPIES_PER_NAME && deck.length < DECK_SIZE; copie += 1) {
      deck.push(card.id);
    }
  }
  return deck;
};

/**
 * La règle, en un prédicat : les noms suffisent **et** le Deck construit est légal.
 * Nommé pour que le contrôle « mord » puisse le confronter à un cas fautif.
 */
const factionJouableSeule = (cards: readonly PlanqueCard[]): boolean => {
  if (nomsDistincts(cards) < NOMS_MINIMUM) return false;
  return deckLegal(deckMonoFaction(cards)).ok;
};

const PLANQUES_BASES: PlanqueCard[] = ALL_CARDS.filter(isPlanque).filter((card) => !card.variantOf);
const FACTIONS = Object.keys(FACTION_META) as Faction[];

describe('Contenu — chaque faction peut faire un Deck de 20 cartes (#352)', () => {
  it(`porte au moins ${NOMS_MINIMUM} noms de base distincts par faction`, () => {
    for (const faction of FACTIONS) {
      const bases = basesDe(faction, PLANQUES_BASES);
      expect(
        nomsDistincts(bases),
        `${faction} : ${nomsDistincts(bases)} noms de base pour un Deck de ${DECK_SIZE} cartes (2 par nom) — ${bases.map((card) => card.id).join(', ')}`
      ).toBeGreaterThanOrEqual(NOMS_MINIMUM);
    }
  });

  it('construit un Deck mono-faction de 20 cartes **légal** pour chacune des dix factions', () => {
    for (const faction of FACTIONS) {
      const bases = basesDe(faction, PLANQUES_BASES);
      const deck = deckMonoFaction(bases);
      const legal = deckLegal(deck);
      expect(deck, `${faction} : ${deck.length} cartes`).toHaveLength(DECK_SIZE);
      expect(legal, `${faction} : ${legal.reasons.join(' ')}`).toEqual({ ok: true, reasons: [] });
      // Le Deck ne mélange pas les factions : c'est le sens même de « jouable seule ».
      for (const id of deck) {
        const card = ALL_CARDS.find((entry) => entry.id === id);
        expect(card?.faction, `${faction} : ${id}`).toBe(faction);
      }
    }
  });

  it('le contrôle mord : privée d’un nom, une faction n’est plus jouable seule', () => {
    // Le Syndicat est à **exactement** 10 noms : lui retirer une carte le fait tomber à 9,
    // et le Deck de 20 ne se remplit plus (9 × 2 = 18).
    const syndicat = basesDe('SYNDICAT', PLANQUES_BASES);
    expect(factionJouableSeule(syndicat), 'Syndicat au complet').toBe(true);

    const ampute = syndicat.filter((card) => card.name !== 'Représentant de section');
    expect(ampute.length, 'une carte retirée').toBe(syndicat.length - 1);
    expect(nomsDistincts(ampute), 'noms restants').toBe(NOMS_MINIMUM - 1);
    expect(factionJouableSeule(ampute), 'Syndicat privé d’un nom').toBe(false);
  });
});
