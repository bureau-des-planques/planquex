/**
 * « Ton compte attend d'être validé » (D-088, #181).
 *
 * C'est l'écran qui rend l'attente **visible** : un compte en attente peut jouer et lire, il
 * ne peut pas encore écrire. On y dit aussi **ce qui s'ouvrira** après l'approbation, pour
 * que l'attente ne ressemble pas à une panne.
 *
 * Un compte **refusé** lit sa raison ici (la base exige qu'un refus en ait une) ; un compte
 * **approuvé** peut venir vérifier que c'est bien passé. La route est protégée par la même
 * garde que le reste : sans session, on repart vers la connexion.
 *
 * États (D-060) : chargement, erreur de lecture, compte absent de la base, et les trois
 * états de la demande.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { estApprouve, libelleEtat } from '@/lib/comptes';
import { useComptes } from '@/store/comptes';

export function Attente() {
  const configure = useComptes((state) => state.configure);
  const chargement = useComptes((state) => state.chargement);
  const session = useComptes((state) => state.session);
  const compte = useComptes((state) => state.compte);
  const erreur = useComptes((state) => state.erreur);
  const rafraichir = useComptes((state) => state.rafraichir);
  const deconnecter = useComptes((state) => state.deconnecter);

  useEffect(() => {
    if (configure) void rafraichir();
  }, [configure, rafraichir]);

  if (!configure) {
    return (
      <div className="page">
        <section className="section panel">
          <h1>Pas de compte sans base</h1>
          <p className="muted max-w-[62ch]">
            Cette version du jeu n’est pas reliée à une base : il n’y a ni compte ni
            validation. Tout fonctionne comme avant.
          </p>
          <Link className="button" to="/">
            Retour au bureau
          </Link>
        </section>
      </div>
    );
  }

  const approuve = estApprouve(compte);

  return (
    <div className="page">
      <section className="section">
        <h1>
          {approuve
            ? 'Ton compte est validé'
            : compte?.etat === 'refuse'
              ? 'Ton compte est refusé'
              : 'Ton compte attend d’être validé'}
        </h1>
        <p className="muted max-w-[64ch]">
          {approuve
            ? 'Tu peux écrire : post-it, pouce, trace de combat. Merci d’être là.'
            : 'Bastien valide les comptes à la main. En attendant, tu peux déjà jouer et lire le mur ; l’écriture s’ouvrira à son approbation.'}
        </p>
      </section>

      <section className="section panel">
        <h2>Ton état</h2>
        {chargement && !compte ? (
          <p className="m-0 text-[0.9rem] text-ink-muted">Lecture de ton compte…</p>
        ) : !session ? (
          <p className="m-0">
            Tu n’es pas connecté.{' '}
            <Link to="/connexion">Se connecter</Link>
          </p>
        ) : compte ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[0.9rem]">
            <li>
              <strong>Courriel</strong> · {compte.courriel || session.courriel || '—'}
            </li>
            <li>
              <strong>État</strong> · {libelleEtat(compte.etat)}
              {compte.administrateur ? ' · administrateur' : ''}
            </li>
            {compte.etat === 'refuse' && (
              <li>
                <strong>Raison</strong> · {compte.raison || 'aucune raison donnée'}
              </li>
            )}
          </ul>
        ) : (
          <p className="m-0 max-w-[62ch]">
            Ton compte existe, mais la base ne le connaît pas encore : la migration des
            comptes n’est peut-être pas appliquée. Réessaie dans un instant ; si cela dure,
            signale-le à Bastien.
          </p>
        )}

        <div className="actions actions--tight mt-3">
          <button
            type="button"
            className="button"
            onClick={() => void rafraichir()}
            disabled={chargement}
          >
            <RefreshCw size={16} /> Revérifier mon état
          </button>
          <button type="button" className="button" onClick={() => void deconnecter()} disabled={chargement}>
            Se déconnecter
          </button>
        </div>

        {erreur && (
          <p className="notice notice--warn m-0" role="alert">
            {erreur}
          </p>
        )}
      </section>

      <section className="section panel">
        <h2>En attendant</h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[0.9rem]">
          <li>
            <Link to="/">Jouer une partie</Link> — le solo ne demande rien à la base.
          </li>
          <li>
            <Link to="/comite">Lire le mur</Link> — les post-its et les compteurs de pouces
            sont ouverts à tout compte.
          </li>
          <li>
            <Link to="/settings">Tes réglages</Link> — ta Collection et ton Deck restent dans
            ce navigateur.
          </li>
        </ul>
      </section>
    </div>
  );
}
