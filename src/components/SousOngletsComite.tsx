/**
 * Les **deux pages du comité** (D-097 (2)) : **Le mur** (`/comite`) et **Le suivi**
 * (`/comite/suivi`), sous une seule barre de sous-onglets.
 *
 * C'est la route qui dit laquelle est ouverte — pas un état de composant : une adresse se
 * partage, se met en favori et survit au rechargement. `end` sur **Le mur** évite qu'il
 * s'allume aussi sous `/comite/suivi` ; `NavLink` pose `aria-current="page"`, donc l'onglet
 * ouvert se lit aussi au lecteur d'écran.
 *
 * Ce n'est pas un `role="tab"` : ces deux pages sont des **adresses**, pas des panneaux d'un
 * même écran — le patron ARIA des onglets imposerait un `tabpanel` et une gestion de focus
 * qui mentiraient sur ce que fait le navigateur.
 */
import { NavLink } from 'react-router-dom';

const ONGLETS = [
  { to: '/comite', label: 'Le mur', fin: true },
  { to: '/comite/suivi', label: 'Le suivi', fin: false }
] as const;

export function SousOngletsComite() {
  return (
    <nav aria-label="Les pages du comité" className="flex flex-wrap gap-2 border-b border-line pb-2">
      {ONGLETS.map((onglet) => (
        <NavLink
          key={onglet.to}
          to={onglet.to}
          end={onglet.fin}
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 py-1.5 text-[0.86rem] no-underline transition-colors ${
              isActive ? 'bg-bg-raised font-semibold text-gold' : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          {onglet.label}
        </NavLink>
      ))}
    </nav>
  );
}
