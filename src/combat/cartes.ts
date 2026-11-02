import { getCard } from '@/data';
import type { CardInstance } from '@/data/types';

export function cardName(cardId: string): string {
  return getCard(cardId)?.name ?? 'Carte inconnue';
}

/** Le nom d'une instance, sans mentir quand elle a disparu de l'état. */
export function instanceName(instance: CardInstance | null | undefined): string {
  return instance ? cardName(instance.cardId) : 'un Planqué';
}
