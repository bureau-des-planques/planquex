/**
 * La garde d'entrée de l'alpha (D-088, D-156, #527).
 *
 * Quand la base est configurée, **aucune page du jeu** ne s'ouvre sans **compte** : on
 * repart vers `/connexion`. C'est ce qui fait de l'alpha un lieu réservé aux testeurs, et
 * non un site public dont seules les écritures seraient fermées — le mur du comité compris
 * (D-156 (1), qui amende D-110).
 *
 * **Ce que la garde juge** : l'**identité**, pas l'état du compte. Une **session anonyme**
 * (D-059) n'est pas un compte : elle n'a ni courriel ni ligne `comptes`, et elle repart vers
 * la connexion comme si personne n'était là (#527). Le drapeau vient de la session
 * (`anonyme`), jamais de l'absence de ligne — une base en retard rend `compte: null` sans
 * être anonyme.
 *
 * Un compte **non approuvé** — en attente **ou** refusé — ne joue pas : c'est la **seule**
 * exception à « la garde ne juge que la session » — il ne lui reste que `/attente`, son état et
 * la déconnexion (D-156 (3), amendée par D-201 : l'attente ne joue plus, ni Journée ni combat).
 *
 * Un compte dont la ligne est **illisible** (erreur de lecture, `compte: null`) traverse :
 * D-088 veut qu'une erreur de lecture ne ferme pas l'entrée.
 *
 * Sans configuration, elle laisse tout passer : le jeu garde exactement son comportement
 * d'avant D-088, et `npm run capturer` ne se heurte à aucun écran de connexion.
 *
 * Une configuration **cassée** (une seule variable, ou une clé de service) n'est **pas**
 * l'absence de base : la garde affiche le refus (`RefusConfiguration`) au lieu du jeu (#529).
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { RefusConfiguration } from '@/components/RefusConfiguration';
import { estApprouve } from '@/lib/comptes';
import { useComptes } from '@/store/comptes';

export function GardeComptes({ children }: { children: ReactNode }) {
  const configure = useComptes((state) => state.configure);
  const configurationCassee = useComptes((state) => state.configurationCassee);
  const chargement = useComptes((state) => state.chargement);
  const session = useComptes((state) => state.session);
  const compte = useComptes((state) => state.compte);
  const { pathname, search } = useLocation();

  // Déploiement fautif (#529) : ni le jeu, ni la connexion — la raison, à l'écran.
  if (configurationCassee) return <RefusConfiguration raison={configurationCassee} />;

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

  // Pas de session, ou une **identité anonyme** : ce n'est pas un compte (D-156 (2)).
  if (!session || session.anonyme) {
    return <Navigate to="/connexion" replace state={{ depuis: `${pathname}${search}` }} />;
  }

  // Un compte **non approuvé** (en attente ou refusé) ne joue pas : l'attente est la seule page
  // qui lui reste (D-156 (3), amendée par D-201). Une ligne illisible (`compte: null`) n'est pas
  // fermée (D-088) ; un administrateur est toujours approuvé.
  if (compte !== null && !estApprouve(compte) && pathname !== '/attente') {
    return <Navigate to="/attente" replace />;
  }

  return <>{children}</>;
}
