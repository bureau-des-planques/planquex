import { cafeLabel } from '@/components/CafePips';
import { STATUS_META } from '@/components/StatusBadge';
import { isPlanque } from '@/data';
import type { Attack, Card, Status } from '@/data/types';

/**
 * **La ligne de portée de la barre d'action** (#320, extraite par #324).
 *
 * Elle ne dit que deux choses, et seulement quand c'est *mon* tour : « Pression déjà portée ce
 * tour. » quand la Pression est consommée, et « Hors de portée du café : … » quand le café ne
 * couvre pas toutes les Pressions du Poste. `undefined` quand il n'y a rien à dire — la ligne
 * n'existe alors pas.
 *
 * Elle vivait en ternaire imbriqué dans `Battle.tsx`, où elle lisait `hasAttacked`, le Poste et
 * la liste des Pressions légales : de la **Feature Envy** vers le moteur, dans un fichier déjà
 * gros. Ici, c'est une fonction pure, et son test dit chaque cas sans monter React. **Aucune
 * règle de jeu** n'est décidée ici : `enPortee` est le verdict du moteur (`legalAttacks`), et
 * `dejaPortee` le sien (`hasAttacked`).
 */
export function phraseDePortee({
  aMoi,
  poste,
  dejaPortee,
  enPortee,
  statuts = []
}: {
  /** C'est mon tour de jouer : hors de mon tour, la ligne ne décrit rien (ni mon Poste, ni le sien). */
  aMoi: boolean;
  /** Mon Poste, la carte telle que la connaît le catalogue. */
  poste: Card | undefined;
  /** La Pression a déjà été portée ce tour (`PlayerState.hasAttacked`). */
  dejaPortee: boolean;
  /** Les Pressions que le café couvre (`legalAttacks(state)`). */
  enPortee: readonly Attack[];
  /** Les Conditions de mon Poste : la Sieste et l'Immobilisation interdisent la Pression (D-033 §2). */
  statuts?: readonly Status[];
}): string | undefined {
  // Un Poste vide, une Action au Poste (pas de Pression) ou une carte sans attaque : rien à dire.
  if (!aMoi || !poste || !isPlanque(poste) || poste.attacks.length === 0) return undefined;

  // La Pression consommée : c'est le premier fait, et il suffit — la liste du moteur est alors
  // vide pour une autre raison (le tour est fini), qu'il serait faux de présenter comme un café.
  if (dejaPortee) return 'Pression déjà portée ce tour.';

  // **La vraie cause d'abord** : sous Sieste ou Immobilisation, le moteur ne rend aucune Pression,
  // café ou pas. Les dire « hors de portée du café » enverrait le joueur chercher un café qu'il a
  // peut-être déjà ; la ligne nomme la Condition et sa règle (`STATUS_META`).
  const bloquante = statuts.find((statut) => statut === 'SIESTE' || statut === 'IMMOBILISATION');
  if (bloquante) return `${STATUS_META[bloquante].label} au Poste : ni Pression ni Rotation.`;

  const hors = poste.attacks.filter((entree) => !enPortee.includes(entree));
  if (hors.length === 0) return undefined;
  return `Hors de portée du café : ${hors
    .map((entree) => `${entree.name} (${entree.cost.map(cafeLabel).join(' · ')})`)
    .join(', ')}.`;
}
