import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **Une carte face cachée ne montre pas sa face en miroir** (retour du 28/10/2026 : le texte d'une
 * carte apparaissait à l'envers avant son retournement). `backface-visibility` seul ne suffit pas
 * partout : la face est donc retirée (`visibility: hidden`) tant que la carte est verso.
 *
 * Le « contrôle mord » : une règle sans `visibility` sur la face verso est refusée.
 */
const CSS = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

/** Vrai si la règle `selecteur { … }` pose `visibility: hidden`. */
function cacheeSi(css: string, selecteur: string): boolean {
  const corps = css.match(new RegExp(`${selecteur.replace(/[.[\]()']/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
  return /visibility:\s*hidden/.test(corps);
}

describe('la face d’une carte verso', () => {
  it('est retirée de l’affichage', () => {
    expect(cacheeSi(CSS, ".ouverture__carte[data-face='verso'] .ouverture__face")).toBe(true);
  });

  it('le contrôle mord : une face verso sans visibility est refusée', () => {
    const sansRetrait = ".ouverture__carte[data-face='verso'] .ouverture__face {\n  opacity: 1;\n}";
    expect(cacheeSi(sansRetrait, ".ouverture__carte[data-face='verso'] .ouverture__face")).toBe(false);
  });
});
