import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';

/**
 * Une adresse que le jeu ne connaît pas (#131). Elle affichait l'Accueil sans le dire :
 * un lien cassé, ou une faute de frappe, passait pour la page voulue. Les **anciennes**
 * adresses (`/parc`, `/chariot`…) redirigent avant d'arriver ici (`src/redirections.ts`).
 */
export function Introuvable() {
  const { pathname } = useLocation();

  return (
    <div className="page introuvable">
      <section className="section__head">
        <div>
          <h1>Ce couloir ne mène nulle part</h1>
          <p className="muted">
            Aucun écran à l’adresse <code>{pathname}</code>. Le bureau n’a pas cette porte.
          </p>
        </div>
      </section>
      <div className="actions actions--tight">
        <Link className="button button--primary" to="/">
          <Home size={16} /> Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
