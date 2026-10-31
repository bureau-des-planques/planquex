import { Link } from 'react-router-dom';
import { DEPOT_PUBLIC } from '@/lib/depot';

/** La route du comité : le mur, où se posent les post-it IP et OUF (D-058). */
export const ROUTE_COMITE = '/comite';

/**
 * **L'appel à participer** (#271) : une ligne, à la fin de la Journée d'intégration, avec
 * deux portes. Un bug ou une idée va au comité (route interne) ; le code et les designs vont
 * au dépôt GitHub (nouvel onglet, `noreferrer noopener`, comme `InvitationTesteurs`).
 *
 * Aucun widget, aucun script, aucun traceur. Le lien vers le comité ferme la Journée avant
 * de naviguer (`surComite`) : sans cela, la visite se rouvrirait au retour du mur.
 */
export function AppelParticiper({ surComite }: { surComite: () => void }) {
  return (
    <p className="journee__appel m-0 max-w-[66ch] text-[0.78rem] text-ink-dim">
      Envie d’aider ? Un défaut ou une idée, c’est sur{' '}
      <Link to={ROUTE_COMITE} onClick={surComite} className="underline underline-offset-2">
        le comité
      </Link>
      . Le code et le design, c’est sur{' '}
      <a href={DEPOT_PUBLIC} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
        le dépôt GitHub
      </a>
      .
    </p>
  );
}
