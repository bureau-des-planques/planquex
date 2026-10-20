import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fou de l'**écran du Chariot** — ticket #91 (D-037 (4)).
 *
 * Le contrat porte sur la source, donc c'est la source qu'on lit (même technique que
 * `Battle.test.ts`) : la proposition vient de `deckCafeTypes`, le choix manuel des
 * factions produisibles de `CAFE_FACTIONS`, et la Machine lit les types **effectifs**
 * par `resolveCafeTypes` — jamais une liste recalculée à la main dans l'écran.
 */
const source = readFileSync(fileURLToPath(new URL('./Deck.tsx', import.meta.url)), 'utf8');

describe('Deck.tsx — le joueur choisit les types de café (#91)', () => {
  it('propose la dérivation du Chariot, plus les autres factions produisibles', () => {
    expect(source).toMatch(/deckCafeTypes\(deck\)/);
    expect(source).toMatch(/CAFE_FACTIONS\.filter/);
    expect(source).toMatch(/resolveCafeTypes\(deck, chosenCafeTypes\)/);
  });

  it('laisse cocher et décocher un type par le store', () => {
    expect(source).toMatch(/toggleCafeType\(type\)/);
    expect(source).toMatch(/setCafeTypes\(\[\]\)/);
  });

  it('plafonne à 3 types et expose l’état pressé', () => {
    expect(source).toMatch(/MAX_DECK_CAFE_TYPES/);
    expect(source).toMatch(/aria-pressed=\{chosen\}/);
    expect(source).toMatch(/disabled=\{full\}/);
  });
});
