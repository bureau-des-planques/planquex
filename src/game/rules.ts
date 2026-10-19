import type { Status } from '@/data/types';

/**
 * Drapeaux globaux du moteur.
 *
 * `priorityShiftEnabled` coupe le mot-clé maison « Changement de priorité »
 * (D-004) sans toucher aux cartes : désactivé, une carte qui le porte ne fait
 * rien de spécial. C'est le seul interrupteur prévu pour l'instant.
 */
export const RULES = {
  priorityShiftEnabled: true
};

/**
 * Ordre de résolution des conditions en fin de tour (`AGENTS.md` §4) :
 * **Surcharge → Burn-out → Bloqué → Gelé**. Un Planqué peut en subir plusieurs.
 *
 * `DERIVE` n'y figure pas : elle se résout **avant l'attaque** (§4), pas au checkup.
 */
export const STATUS_ORDER: readonly Status[] = ['SURCHARGE', 'BURNOUT', 'BLOQUE', 'GELE'];
