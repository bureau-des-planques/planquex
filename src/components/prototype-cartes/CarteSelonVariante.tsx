/**
 * PROTOTYPE JETABLE — choisit le rendu d'une carte hors plateau selon `?variant=`.
 * A (ou hors dev) : `CardView`, la carte de la branche. B, C, D : `VariantesCarte.tsx`.
 */
import { useEffect } from 'react';
import type { Card } from '@/data/types';
import { CardView } from '../CardView';
import { COMPOSANTS } from './VariantesCarte';
import { useVariante } from './variante';

interface Props {
  card: Card;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
}

export function CarteSelonVariante({ card, onClick, compact, selected }: Props) {
  const variante = useVariante();
  // Le chrome du slot (bouton +, pastilles ×n) se replace selon la variante.
  useEffect(() => {
    document.documentElement.dataset.protoVariante = variante;
  }, [variante]);

  if (variante === 'A') return <CardView card={card} onClick={onClick} compact={compact} selected={selected} />;
  const Variante = COMPOSANTS[variante];
  return <Variante card={card} onClick={onClick} selected={selected} grand={!compact} />;
}
