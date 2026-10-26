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
export function CafeDot({ cafe }: { cafe: CafeSymbol }) {
  if (cafe === 'INCOLORE') return <i className="pip pip--free" title={cafeLabel(cafe)} />;
  const style = { '--cafe': FACTION_META[cafe].color } as CSSProperties;
  return <i className="pip pip--typed" style={style} title={cafeLabel(cafe)} />;
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
}

/**
 * Le coût en **cafés typés** d'une Pression, ou les cafés attachés, dessinés en
 * pastilles — une par café, colorée par sa faction.
 *
 * Un seul rendu pour la carte (`CardView`), la fiche (`CardDetail`) et le plateau
 * (`Battle`) : le mot « café » reste du code, la pastille est le motif de la maison.
 */
export function CafePips({ symbols, label }: Props) {
  const names = symbols.map(cafeLabel);
  const title = label ?? (names.length > 0 ? `Coût : ${names.join(' · ')}` : 'Aucun café requis');
  return (
    <span className="pips" title={title} aria-label={title}>
      {names.length > 0 ? (
        symbols.map((cafe, index) => <CafeDot key={`${index}-${cafe}`} cafe={cafe} />)
      ) : (
        <i className="pip pip--free" />
      )}
    </span>
  );
}
