/**
 * PROTOTYPE JETABLE — la barre flottante qui fait défiler les variantes de carte.
 * Flèches ← → du clavier aussi (sauf dans un champ). Absente hors `import.meta.env.DEV`.
 */
import { useEffect } from 'react';
import { VARIANTES, choisirVariante, useVariante } from './variante';

export function PrototypeSwitcher() {
  const courante = useVariante();
  const index = VARIANTES.findIndex((v) => v.key === courante);

  const aller = (pas: number) => {
    const suivante = VARIANTES[(index + pas + VARIANTES.length) % VARIANTES.length];
    choisirVariante(suivante.key);
  };

  useEffect(() => {
    const clavier = (event: KeyboardEvent) => {
      const cible = event.target as HTMLElement | null;
      if (cible && cible.closest('input, textarea, select, [contenteditable]') !== null) return;
      if (event.key === 'ArrowLeft') aller(-1);
      if (event.key === 'ArrowRight') aller(1);
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <div className="proto-switcher" role="toolbar" aria-label="Variantes de carte (prototype)">
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
