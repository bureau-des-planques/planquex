import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fou de l'**écran de combat** — ticket #58.
 *
 * Le défaut corrigé : `Battle.tsx` recalculait la légalité à la main
 * (`player.hasAttacked || energy < cost`), alors que le moteur savait déjà. Résultat
 * visible : le premier tour interdisait l'attachement **dans le moteur** et l'écran
 * laissait cliquer. Cinq transitions n'atteignaient aucun écran.
 *
 * La correction est une contrainte de forme, pas une valeur : l'écran doit rendre
 * `legalActions` et exécuter par `applyAction`. Ce test lit la source et échoue si
 * un état `disabled` ou un appel direct à une transition revient — sans lui, la
 * régression se réintroduit silencieusement, un bouton à la fois.
 *
 * Même technique que `scripts/compteurs.test.ts` : le contrat porte sur la source,
 * donc c'est la source qu'on lit.
 */
const source = readFileSync(fileURLToPath(new URL('./Battle.tsx', import.meta.url)), 'utf8');

describe('Battle.tsx — l’écran rend ce que le moteur autorise (#58)', () => {
  it('consomme legalActions et exécute par applyAction', () => {
    expect(source).toMatch(/legalActions\(/);
    expect(source).toMatch(/applyAction\(/);
  });

  it('ne recalcule plus aucun état désactivé : plus un seul disabled', () => {
    expect(source).not.toMatch(/\bdisabled\b/);
  });

  it('n’appelle plus les transitions une par une', () => {
    const transitions = [
      'attack',
      'attachEnergy',
      'endTurn',
      'evolve',
      'playAction',
      'playBasic',
      'promoteActive',
      'retreat',
      'useAbility'
    ];
    for (const transition of transitions) {
      expect(source, `appel direct à ${transition}()`).not.toMatch(new RegExp(`\\b${transition}\\(`));
    }
  });

  it('affiche la main du camp que je tiens', () => {
    // En partie à deux (#125), le camp n'est pas toujours `player` : c'est `mySide`,
    // le camp que le code m'a donné — jamais la main du camp d'en face.
    expect(source).toMatch(/mySide\.hand\.map\(/);
  });

  it('lit les Pressions à portée de café dans le moteur, pas à la main', () => {
    expect(source).toMatch(/legalAttacks\(/);
    expect(source).not.toMatch(/hasAttacked \|\|/);
    expect(source).not.toMatch(/energy \?\? 0\) < /);
  });

  it('offre un abandon confirmé, sans appeler la transition en direct (#79)', () => {
    // Le bouton vient de `legalActions` (le moteur dit si la partie vit), pas d'une
    // liste écrite à la main : il est donc filtré sur le camp du joueur.
    expect(source).toMatch(/action\.type === 'forfeit'/);
    expect(source).toMatch(/window\.confirm\(/);
    expect(source).toMatch(/Abandonner/);
    // Comme les autres transitions, le forfait passe par `applyAction`, pas par un appel direct.
    expect(source).not.toMatch(/\bforfeit\(/);
  });

  /**
   * #117 — **le choix de types de café appartient au Chariot du joueur**, pas au
   * combat. Sur un chariot de test (Chariot illégal remplacé), il décrivait un
   * contenu qui n'était pas le sien : l'écran annonçait des types que la Machine ne
   * pouvait pas tirer de ce chariot-là. Le choix appliqué passe donc par le repli
   * (`usedTestDeck`) — `[]` = proposition automatique du chariot de test — et les
   * **deux** `createBattle` (montage et « Nouveau combat ») lisent la même valeur,
   * sinon ils divergent.
   */
  it('n’applique pas les types du Chariot du joueur à un chariot de test (#117)', () => {
    expect(source).toMatch(/usedTestDeck \? \[\] : storedCafeTypes/);
    expect(source).not.toMatch(/playerCafeTypes: storedCafeTypes/);

    // **Trois** `createBattle` depuis #125 : le montage, « Nouveau combat », et « Créer
    // une partie à deux ». Tous lisent la même valeur, sinon ils divergent.
    const passed = source.match(/playerCafeTypes:\s*([A-Za-z_$][\w$]*)/g) ?? [];
    expect(passed, 'trois `playerCafeTypes` attendus : montage, reprise et partie à deux').toHaveLength(3);
    expect(new Set(passed)).toEqual(new Set(['playerCafeTypes: chosenCafeTypes']));
  });
});
