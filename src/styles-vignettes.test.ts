import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * **Le plancher de lisibilité des vignettes** (#547, 31/10/2026).
 *
 * Le détecteur d'UI refuse le texte fonctionnel sous 11 px. Une carte compacte réduit sa base
 * (`em`) pour tenir dans 200 px de large : ses libellés tombaient à 6,5-10,5 px. On ne peut
 * pas relever le jeton `--fs-2xs` (le plancher du combat est verrouillé par
 * `styles-combat.test.ts`), donc chaque libellé porte son `max(<em actuel>, 0.7rem)`.
 *
 * Ce test garde **la règle**, pas le pixel : `jsdom` ne calcule pas les container queries, et
 * une assertion de `getComputedStyle` ne prouverait rien en CI. Il lit la feuille et exige le
 * motif — comme `styles-combat.test.ts` pour le plancher du combat.
 */
const feuille = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');

/** Les libellés d'une vignette qui doivent se lire (11,2 px), et leur règle. */
const PLANCHERS = [
  // Ancrés en début de ligne : `.attack__name` apparaît aussi dans une règle du plateau,
  // qui n'est pas celle de la vignette.
  { selecteur: '.card__name', bloc: /^\.card__name\s*\{([^}]*)\}/m },
  { selecteur: '.card__name[data-long]', bloc: /^\.card__name\[data-long\]\s*\{([^}]*)\}/m },
  { selecteur: '.card__stage', bloc: /^\.card__stage\s*\{([^}]*)\}/m },
  { selecteur: '.card__legende', bloc: /^\.card__legende\s*\{([^}]*)\}/m },
  { selecteur: '.card__bas small', bloc: /^\.card__bas small\s*\{([^}]*)\}/m },
  { selecteur: '.card__bas b', bloc: /^\.card__bas b\s*\{([^}]*)\}/m },
  { selecteur: '.attack__name', bloc: /^\.attack__name\s*\{([^}]*)\}/m },
  // **La règle qui gagne dans la vignette** : `.card__attacks .attack__name` est plus
  // spécifique que `.attack__name` et l'écrasait (trouvé le 31/10/2026).
  { selecteur: '.card__attacks .attack__name', bloc: /^\.card__attacks \.attack__name\s*\{([^}]*)\}/m },
  { selecteur: '.card__rarity', bloc: /^\.card__rarity\s*\{([^}]*)\}/m },
  { selecteur: '.card__talent span', bloc: /^\.card__talent span\s*\{([^}]*)\}/m },
  { selecteur: '.card__texte', bloc: /^\.card__texte\s*\{([^}]*)\}/m }
];

/** Les sélecteurs dont le bloc ne porte pas `font-size: max(…, 0.7rem)`. */
export function sansPlancher(source: string): string[] {
  return PLANCHERS.filter(({ bloc }) => {
    const corps = bloc.exec(source)?.[1] ?? '';
    // `.*` et non `[^)]` : le mode détaillé écrit `max(var(--fs-2xs), 0.7rem)`.
    const declarations = [...corps.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
    // **La dernière déclaration gagne.** Un `max()` posé avant un `0.82em` restant ne sert
    // à rien — c'est le bug trouvé le 31/10/2026, que ce test ne voyait pas tant qu'il
    // cherchait seulement la présence du motif.
    const effective = declarations.at(-1) ?? '';
    return !/^max\(.*0\.7rem\s*\)$/.test(effective);
  }).map(({ selecteur }) => selecteur);
}

describe('les libellés de la vignette portent un plancher de lisibilité (#547)', () => {
  it('les sept libellés de la vignette ont leur `max(…, 0.7rem)`', () => {
    expect(sansPlancher(feuille)).toEqual([]);
  });

  it('le mode détaillé du plateau garde le nom de Pression au-dessus du plancher mécanique', () => {
    // `max(var(--fs-2xs), 0.7rem)` : le nom se lit sans relever le jeton du combat.
    const bloc = /^\.card--plateau \.card__attacks \.attack__name,[\s\S]*?\{([^}]*)\}/m.exec(feuille)?.[1] ?? '';
    expect(bloc).toMatch(/font-size:\s*max\(var\(--fs-2xs\),\s*0\.7rem\)/);
  });

  it('le contrôle mord : un libellé repassé en `em` nu est vu', () => {
    // Sans cette assertion, un `max()` retiré passerait en silence : c'est exactement la
    // régression que le ticket cherchait à empêcher.
    // Deux cas fautifs : le motif retiré, et le motif **suivi** d'une déclaration qui gagne.
    const sansMotif = feuille.replace(/font-size: max\(0\.66em, 0\.7rem\);/, 'font-size: 0.66em;');
    expect(sansPlancher(sansMotif)).toContain('.card__stage');
    // Un libellé planché puis **écrasé** par une déclaration tardive : le cas exact du
    // `.card__bas b` trouvé le 31/10/2026 (deux `font-size`, l'ancien gagnait).
    const ecrase = feuille.replace(
      /(\.card__bas b \{[^}]*?font-size: max\(0\.82em, 0\.7rem\);)/,
      '$1\n  font-size: 0.82em;'
    );
    expect(sansPlancher(ecrase)).toContain('.card__bas b');
  });
});
