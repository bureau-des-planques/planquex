/**
 * La garde d'entrée de l'alpha (D-088, #181).
 *
 * Quand la base est configurée, **aucune page du jeu** ne s'ouvre sans session : on repart
 * vers `/connexion`. C'est ce qui fait de l'alpha un lieu réservé aux invités, et non un
 * site public dont seules les écritures seraient fermées.
 *
 * Un compte **en attente** passe : il peut jouer et lire (D-088) ; c'est l'écriture que la
 * base refuse, et le bandeau du `Layout` le lui rappelle. La garde ne juge donc que la
 * **session**, jamais l'état du compte.
 *
 * Sans configuration, elle laisse tout passer : le jeu garde exactement son comportement
 * d'avant D-088, et `npm run capturer` ne se heurte à aucun écran de connexion.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useComptes } from '@/store/comptes';

export function GardeComptes({ children }: { children: ReactNode }) {
  const configure = useComptes((state) => state.configure);
  const chargement = useComptes((state) => state.chargement);
  const session = useComptes((state) => state.session);
  const { pathname, search } = useLocation();

  if (!configure) return <>{children}</>;

  // Au premier rendu, la session persistée n'est pas encore relue : on attend plutôt que de
  // renvoyer un testeur déjà connecté vers la page de connexion.
  if (chargement && !session) {
    return (
      <div className="page">
        <section className="section panel">
          <p className="m-0 text-[0.9rem] text-ink-muted" role="status">
            Vérification de ta session…
          </p>
        </section>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/connexion" replace state={{ depuis: `${pathname}${search}` }} />;
  }

  return <>{children}</>;
}
