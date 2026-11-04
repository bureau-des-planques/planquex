import { RARITY_META, RARITY_SYMBOL_VIEWBOX } from '@/data';
import type { Rarity } from '@/data/types';

interface Props {
  rarete: Rarity;
  className?: string;
}

/** Le tracé d’une rareté vient de `RARITY_META` (D-180), jamais d’un composant d’écran. */
export function RaritySymbol({ rarete, className }: Props) {
  const { symbol } = RARITY_META[rarete];

  return (
    <svg
      aria-hidden="true"
      className={['symbole-rarete', className].filter(Boolean).join(' ')}
      data-symbole-rarete={rarete}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox={RARITY_SYMBOL_VIEWBOX}
    >
      <path d={symbol.path} />
    </svg>
  );
}
