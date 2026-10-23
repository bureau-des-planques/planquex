import { RotateCcw } from 'lucide-react';
import { TRIS, TRI_DEFAUT, TRI_META } from './tri-cartes';
import type { Tri } from './tri-cartes';

interface Props {
  value: Tri;
  onChange: (tri: Tri) => void;
}

/**
 * Le choix du tri, **toujours visible** : la liste montre le tri courant, et
 * « Réinitialiser » le rend à « par défaut » (grisé quand c'est déjà le cas). Un seul
 * contrôle pour la Collection et pour le Deck (#179).
 */
export function TriCartes({ value, onChange }: Props) {
  return (
    <div className="tri">
      <label className="field tri__champ">
        <span className="field__label">Trier par</span>
        <select value={value} title={TRI_META[value].aide} onChange={(event) => onChange(event.target.value as Tri)}>
          {TRIS.map((tri) => (
            <option key={tri} value={tri} title={TRI_META[tri].aide}>
              {TRI_META[tri].label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="button tri__reinit"
        disabled={value === TRI_DEFAUT}
        onClick={() => onChange(TRI_DEFAUT)}
        aria-label="Réinitialiser le tri"
        title="Revenir à l’ordre par défaut"
      >
        <RotateCcw size={14} aria-hidden /> Réinitialiser
      </button>
    </div>
  );
}
