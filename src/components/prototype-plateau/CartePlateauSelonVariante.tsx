/**
 * PROTOTYPE JETABLE — choisit le rendu d'une carte au plateau selon `?variant=`.
 * A (ou hors dev) : `CardView calme plateau`, la carte de la branche. B, C, D : `VariantesPlateau.tsx`.
 */
import type { Card } from '@/data/types';
import { CardView } from '../CardView';
import { COMPOSANTS, type Lieu } from './VariantesPlateau';
import { useVariante } from './variante';

interface Props {
  card: Card;
  lieu: Lieu;
  stress?: number;
  seuil?: number;
  annotations?: boolean;
}

export function CartePlateauSelonVariante({ card, lieu, stress, seuil, annotations }: Props) {
  const variante = useVariante();
  if (variante === 'A')
    return <CardView card={card} calme plateau annotations={annotations} stress={stress} seuil={seuil} />;
  const Variante = COMPOSANTS[variante];
  return <Variante card={card} lieu={lieu} stress={stress} seuil={seuil} annotations={annotations} />;
}
