import type { LucideIcon } from 'lucide-react';
import { Flame, FlaskConical, Lock, Moon, Wind } from 'lucide-react';
import type { Status } from '@/data/types';
import { BURNOUT_DAMAGE, SURCHARGE_DAMAGE } from '@/game/rules';

/**
 * Les cinq conditions de combat (`docs/JEU.md` §4), avec leur libellé, leur règle et leur
 * icône. Une **seule** source : `Battle.tsx` n'a plus sa propre table de libellés, et une
 * condition ajoutée au type s'affiche ici avant d'atteindre l'écran.
 */
export const STATUS_META: Record<Status, { label: string; description: string; icon: LucideIcon }> = {
  SURCHARGE: {
    label: 'Surcharge',
    description: `${SURCHARGE_DAMAGE} de Stress par Contrôle`,
    icon: FlaskConical
  },
  EPUISEMENT: {
    label: 'Épuisement',
    description: `${BURNOUT_DAMAGE} de Stress, plus le lancer de tampon`,
    icon: Flame
  },
  SIESTE: { label: 'Sieste', description: 'Ni Pression ni Rotation ; lancer au Contrôle', icon: Moon },
  IMMOBILISATION: { label: 'Immobilisation', description: 'Ni Pression ni Rotation', icon: Lock },
  DERIVE: { label: 'Dérive', description: 'Lancer avant la Pression : sur un échec, le tour prend fin', icon: Wind }
};

interface Props {
  status: Status;
  /**
   * **La densité du combat** (#189, `SPEC-COMBAT-UI` §4.3) : à `false` (`sobre`), le badge
   * ne garde que son **icône** — le nom est une annotation, et il revient en mode `détaillé`.
   * Le libellé reste lu par un lecteur d'écran dans les deux cas, et l'icône distingue les
   * conditions autrement que par la couleur (le critère WCAG sur la couleur seule).
   */
  nomAffiche?: boolean;
}

export function StatusBadge({ status, nomAffiche = true }: Props) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    // La règle (`description`) n'est plus un `title` au survol : elle est écrite dans la légende
    // des Conditions (menu `⋯` → Règles), atteignable au doigt et au clavier (SPEC-COMBAT-UI §6.7).
    <span className={`status-chip status-chip--${status.toLowerCase()}`}>
      <Icon size={12} strokeWidth={2.2} aria-hidden />
      {nomAffiche ? (
        <span className="status-chip__nom">{meta.label}</span>
      ) : (
        <span className="sr-only">{meta.label}</span>
      )}
    </span>
  );
}
