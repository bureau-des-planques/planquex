import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * **La mécanique de tour n'est plus dans l'écran** (#556, tranche 5.1, décision du 02/11/2026).
 *
 * `Battle.tsx` garde le rendu ; `src/combat/useCombat.ts` porte la mécanique. La garde est la
 * raison d'être de la tranche : sans elle, un `applyAction` ajouté un vendredi dans la page ne
 * se verrait nulle part — l'écran marcherait, et l'orchestration serait de retour dans le
 * fichier dont on vient de la sortir.
 *
 * Décision (5) du 02/11/2026 : **simples tests, pas de mutation** — la mutation reste pour les
 * règles du jeu. La garde nouvelle s'ancre donc par son « contrôle mord » ci-dessous : le
 * prédicat est confronté à des sources fautives, pas seulement à la vraie.
 */
const lire = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

/**
 * Les appels qui **sont** la mécanique de tour, et que la page ne fait plus elle-même :
 * appliquer un coup, faire décider la Direction, monter une table.
 */
const APPELS_DU_HOOK = ['applyAction(', 'aiTurnAction(', 'createBattle(', 'joinMatch('];

/** Ce qu'une source garde encore de la mécanique : la liste des appels trouvés. */
function appelsDeMecanique(source: string): string[] {
  return APPELS_DU_HOOK.filter((appel) => source.includes(appel));
}

describe('Battle.tsx ne porte plus la mécanique de tour (#556)', () => {
  it('ne joue aucun coup et ne fait décider personne : tout passe par `useCombat`', () => {
    expect(appelsDeMecanique(lire('../pages/Battle.tsx'))).toEqual([]);
  });

  it('importe le hook, et ne garde pas sa copie', () => {
    const page = lire('../pages/Battle.tsx');
    expect(page).toMatch(/from '@\/combat\/useCombat'/);
    expect(page).toMatch(/useCombat\(\{/);
  });

  it('le contrôle mord : une page qui applique un coup elle-même est vue', () => {
    expect(appelsDeMecanique('setState((current) => applyAction(current, action));')).toEqual(['applyAction(']);
    expect(appelsDeMecanique("const action = aiTurnAction(state, match, 'recherche');")).toEqual(['aiTurnAction(']);
    expect(appelsDeMecanique('const { state } = useCombat({ tutoriel, sceneFin });')).toEqual([]);
  });
});
