import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

/**
 * Le retour d'un écran qui n'a pas la barre du bas (#428, inventaire #426).
 *
 * **D'où l'on vient, quand c'est connu** : `location.key !== 'default'` veut dire qu'une entrée
 * de l'application précède l'écran (la première entrée d'une session porte la clé `default`).
 * Le retour est alors `navigate(-1)`, et le bouton du navigateur reste honoré.
 *
 * **Sinon, le parent nommé** (`vers`, libellé `libelle`, p. ex. « Retour au bureau ») : le lien
 * garde son `href`, donc un lien direct, une PWA rouverte ou un « ouvrir dans un onglet »
 * mènent au parent, jamais à un écran vide.
 *
 * La cible fait au moins 44 px : la classe `.button` porte `min-height: 2.75rem` (`styles.css`),
 * et `retour-ecran.test.tsx` garde cette hauteur.
 */
export function RetourEcran({ vers, libelle }: { vers: string; libelle: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const avecHistorique = location.key !== 'default';

  return (
    <Link
      className="button retour-ecran"
      to={vers}
      onClick={(evenement) => {
        if (!avecHistorique) return;
        evenement.preventDefault();
        void navigate(-1);
      }}
    >
      <ArrowLeft size={16} aria-hidden="true" /> {avecHistorique ? 'Retour' : libelle}
    </Link>
  );
}
