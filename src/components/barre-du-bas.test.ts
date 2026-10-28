import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * La barre du bas (#275) — ce que `jsdom` ne sait pas mesurer.
 *
 * `Layout.test.tsx` prouve le **comportement** : en combat, aucune barre ; ailleurs, un
 * onglet courant marqué. Il ne prouve pas la **cible tactile** : `jsdom` ne calcule pas de
 * mise en page. La cible de 44 px (D-120, #322) se lit donc dans `src/styles.css`, sur la
 * règle qui la porte, et c'est ce que fait ce fichier.
 *
 * **Le contrôle mord** : retirer `min-height` de `.bottom-nav__item`, c'est repasser sous
 * 44 px, et la seconde assertion tombe.
 */
const layout = readFileSync(fileURLToPath(new URL('./Layout.tsx', import.meta.url)), 'utf8');
const styles = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8');

/** Le corps de la dernière règle `.selecteur { … }` d'une feuille, ou null. */
function corpsDeRegle(source: string, selecteur: string): string | null {
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regle = new RegExp(`(?:^|\\n)${echappe}\\s*\\{([^}]*)\\}`, 'g');
  let corps: string | null = null;
  for (const trouve of source.matchAll(regle)) corps = trouve[1];
  return corps;
}

describe('la barre du bas ne tient aucune place en combat (#275)', () => {
  it('la barre est rendue sous `!enCombat` — pas cachée, pas rendue', () => {
    expect(layout).toMatch(/\{!enCombat && \(\s*<nav/);
    // Aucun `hidden` ni `display: none` sur la barre : une barre masquée resterait dans le
    // focus et dans l'arbre d'accessibilité, ce que le ticket refuse.
    expect(layout).not.toMatch(/className="bottom-nav"[^>]*hidden/);
  });

  it('la hauteur d’un onglet fait au moins 44 px', () => {
    const corps = corpsDeRegle(styles, '.bottom-nav__item');
    expect(corps, '.bottom-nav__item').not.toBeNull();
    const hauteur = /min-height:\s*([\d.]+)rem/.exec(corps ?? '');
    expect(hauteur, 'min-height manquant sur .bottom-nav__item').not.toBeNull();
    // 1rem = 16px : 2.75rem = 44px, la cible de D-120.
    expect(Number(hauteur?.[1]) * 16).toBeGreaterThanOrEqual(44);
    const largeur = /min-width:\s*([\d.]+)rem/.exec(corps ?? '');
    expect(Number(largeur?.[1]) * 16).toBeGreaterThanOrEqual(44);
  });
});
