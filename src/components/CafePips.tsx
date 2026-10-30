import type { CSSProperties } from 'react';
import { FACTION_META } from '@/data';
import { cafeLabel } from '@/data/vocabulaire';
import type { CafeSymbol } from '@/data/types';

/**
 * **Une pastille de café** : colorée de la faction pour un café typé, en pointillés
 * pour l'incolore. Un café est un `CafeSymbol` (D-037) : un type de faction, ou
 * `INCOLORE` — distinct de `SUPPORT`. La Machine ne produit jamais l'incolore
 * (D-034) ; il n'existe que comme symbole de coût, et se dessine outré (en
 * pointillés) plutôt que coloré. La couleur vient de `FACTION_META`, la seule
 * source des couleurs de faction (`AGENTS.md` §6).
 */
export function CafeDot({ cafe, sansTitre = false }: { cafe: CafeSymbol; sansTitre?: boolean }) {
  const titre = sansTitre ? undefined : cafeLabel(cafe);
  if (cafe === 'INCOLORE') return <i className="pip pip--free" title={titre} />;
  const { color, glyph } = FACTION_META[cafe];
  const style = { '--cafe': color, '--cafe-encre': encreSur(color) } as CSSProperties;
  // **Le glyphe de la faction** (#525) : un café ne se distinguait que par sa couleur (le critère WCAG sur la couleur seule).
  // Il n'est montré que là où la pastille est assez grande pour le porter (le combat, 14 à 18 px) ;
  // le sélecteur de texte U+FE0E garde ✊ et ☺ en symboles, jamais en émoji.
  return (
    <i className="pip pip--typed" style={style} title={titre}>
      <span className="pip__glyphe" aria-hidden="true">
        {glyph}
        {'\uFE0E'}
      </span>
    </i>
  );
}

const ENCRE_CLAIRE = '#ffffff';
const ENCRE_SOMBRE = '#0b1220';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Le rapport de contraste WCAG entre deux couleurs hexadécimales `#rrggbb`. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * L'encre du glyphe sur la couleur d'une faction : le blanc ou le bleu nuit (`--bg`), **le plus
 * lisible des deux**. Le pire des dix, SSE, reste à 4,36:1 — au-dessus des 3:1 d'un symbole.
 */
export function encreSur(couleur: string): string {
  return contraste(couleur, ENCRE_CLAIRE) >= contraste(couleur, ENCRE_SOMBRE) ? ENCRE_CLAIRE : ENCRE_SOMBRE;
}

/**
 * Le libellé français d'un café vient de `@/data/vocabulaire` (#248) : le moteur l'écrit
 * dans son journal, l'écran l'affiche, et il n'y a plus qu'un corps. On le ré-exporte pour
 * que les appelants de l'écran continuent d'importer depuis ce module.
 */
export { cafeLabel };

interface Props {
  /**
   * La liste de cafés à dessiner : le **coût** d'une Pression (D-037) ou les cafés
   * **attachés** à une instance. Une liste vide reste visible : la pastille viseuse
   * (pointillés) dit « aucun café requis » pour un coût, « rien d'attaché » ailleurs.
   */
  symbols: readonly CafeSymbol[];
  /** Libellé de survol ; déduit de la liste quand il n'est pas fourni. */
  label?: string;
  /**
   * **Pas de bulle native.** Sur une carte de grille, le `title` du groupe s'affiche au
   * survol et **recouvre le coût** et le reste de la carte (constat du 30/10/2026) : la
   * vue compacte s'en passe, l'`aria-label` reste, et la fiche nomme les cafés.
   */
  sansTitre?: boolean;
}

/**
 * Le coût en **cafés typés** d'une Pression, ou les cafés attachés, dessinés en
 * pastilles — une par café, colorée par sa faction.
 *
 * Un seul rendu pour la carte (`CardView`), la fiche (`CardDetail`) et le plateau
 * (`Battle`) : le mot « café » reste du code, la pastille est le motif de la maison.
 */
export function CafePips({ symbols, label, sansTitre = false }: Props) {
  const names = symbols.map(cafeLabel);
  const title = label ?? (names.length > 0 ? `Coût : ${names.join(' · ')}` : 'Aucun café requis');
  return (
    // `role="img"` : sans rôle, l'`aria-label` d'un `<span>` n'est pas un nom fiable (#525).
    <span className="pips" role="img" title={sansTitre ? undefined : title} aria-label={title}>
      {names.length > 0 ? (
        symbols.map((cafe, index) => <CafeDot key={`${index}-${cafe}`} cafe={cafe} sansTitre={sansTitre} />)
      ) : (
        <i className="pip pip--free" />
      )}
    </span>
  );
}
