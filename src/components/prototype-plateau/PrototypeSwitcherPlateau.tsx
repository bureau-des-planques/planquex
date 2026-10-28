/**
 * PROTOTYPE JETABLE — la barre flottante des variantes de carte au plateau (en haut : le bas de
 * l'écran de combat porte déjà la barre d'action). Pas de flèches clavier : au combat, ← → peuvent
 * servir ailleurs. Absente hors `import.meta.env.DEV`.
 */
import { VARIANTES, choisirVariante, useVariante } from './variante';

export function PrototypeSwitcherPlateau() {
  const courante = useVariante();
  if (!import.meta.env.DEV) return null;
  const index = VARIANTES.findIndex((v) => v.key === courante);
  const aller = (pas: number) => choisirVariante(VARIANTES[(index + pas + VARIANTES.length) % VARIANTES.length].key);

  return (
    <div className="proto-switcher-plateau" role="toolbar" aria-label="Variantes de carte au plateau (prototype)">
      <button type="button" onClick={() => aller(-1)} aria-label="Variante précédente">
        ←
      </button>
      <span>
        <strong>{courante}</strong> · {VARIANTES[index].nom}
      </span>
      <button type="button" onClick={() => aller(1)} aria-label="Variante suivante">
        →
      </button>
    </div>
  );
}
