/**
 * L'écran d'administration des comptes (D-088, #181).
 *
 * Réservé aux comptes marqués **administrateurs** — le compte de Bastien, marqué une fois
 * dans le SQL Editor (`supabase/README.md` §5). La garde est **ici**, dans l'écran, et dans
 * la **base** : les politiques de la 0005 refusent à tout autre compte la lecture des
 * autres lignes et toute décision. Un client bricolé ne peut donc pas approuver, et cet
 * écran ne fait que ne pas proposer ce que la base refuserait.
 *
 * Ce qu'on peut faire : **approuver** (le compte s'ouvre à l'écriture), **refuser avec une
 * raison** (la base exige la raison ; l'invité la lit sur son écran d'attente). Le SQL
 * Editor reste le repli — la migration décrit le marquage administrateur.
 *
 * États (D-060) : chargement, erreur de lecture (avec « Réessayer »), liste vide, et
 * l'écran d'un compte non administrateur.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, RefreshCw, X } from 'lucide-react';
import { deciderCompte, libelleEtat, listerComptes, type Compte } from '@/lib/comptes';
import { useComptes } from '@/store/comptes';

const messageDe = (erreur: unknown): string =>
  erreur instanceof Error ? erreur.message : String(erreur);

export function Administration() {
  const configure = useComptes((state) => state.configure);
  const chargement = useComptes((state) => state.chargement);
  const session = useComptes((state) => state.session);
  const compte = useComptes((state) => state.compte);
  const administrateur = compte?.administrateur === true;

  const [comptes, setComptes] = useState<Compte[] | null>(null);
  const [chargementListe, setChargementListe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [ouvertRefus, setOuvertRefus] = useState<string | null>(null);
  const [raisons, setRaisons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null);

  const charger = useCallback(async () => {
    if (!configure || !administrateur) return;
    setChargementListe(true);
    setErreur(null);
    try {
      setComptes(await listerComptes());
    } catch (panne) {
      setErreur(messageDe(panne));
    } finally {
      setChargementListe(false);
    }
  }, [configure, administrateur]);

  useEffect(() => {
    if (configure && administrateur) void charger();
  }, [configure, administrateur, charger]);

  const remplacer = (decide: Compte) =>
    setComptes((courants) =>
      courants ? courants.map((ligne) => (ligne.id === decide.id ? decide : ligne)) : courants,
    );

  const approuver = async (ligne: Compte) => {
    setEnCours(ligne.id);
    setMessage(null);
    try {
      const decide = await deciderCompte(ligne.id, 'approuve', '');
      remplacer(decide);
      setMessage({ ton: 'ok', texte: `${decide.courriel || 'Ce compte'} est approuvé.` });
    } catch (panne) {
      setMessage({ ton: 'ko', texte: messageDe(panne) });
    } finally {
      setEnCours(null);
    }
  };

  const refuser = async (ligne: Compte) => {
    const raison = (raisons[ligne.id] ?? '').trim();
    if (!raison) {
      setMessage({ ton: 'ko', texte: 'Un refus doit dire pourquoi.' });
      return;
    }
    setEnCours(ligne.id);
    setMessage(null);
    try {
      const decide = await deciderCompte(ligne.id, 'refuse', raison);
      remplacer(decide);
      setOuvertRefus(null);
      setMessage({ ton: 'ok', texte: `${decide.courriel || 'Ce compte'} est refusé.` });
    } catch (panne) {
      setMessage({ ton: 'ko', texte: messageDe(panne) });
    } finally {
      setEnCours(null);
    }
  };

  if (!configure) {
    return (
      <div className="page">
        <section className="section panel">
          <h1>Pas de comptes sans base</h1>
          <p className="muted max-w-[62ch]">
            Cette version du jeu n’est pas reliée à une base : il n’y a ni compte à valider ni
            administration. Le mur lit le fichier du dépôt.
          </p>
          <Link className="button" to="/">
            Retour au bureau
          </Link>
        </section>
      </div>
    );
  }

  if (chargement && !compte) {
    return (
      <div className="page">
        <section className="section panel">
          <h1>Les comptes de l’alpha</h1>
          <p className="m-0 text-[0.9rem] text-ink-muted">Vérification de ton compte…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page">
        <section className="section panel">
          <h1>Les comptes de l’alpha</h1>
          <p className="m-0">
            Tu n’es pas connecté. <Link to="/connexion">Se connecter</Link>
          </p>
        </section>
      </div>
    );
  }

  if (!administrateur) {
    return (
      <div className="page">
        <section className="section panel">
          <h1>Réservé à l’administration</h1>
          <p className="muted max-w-[62ch]">
            Cette page liste les comptes de l’alpha et décide de leur validation. Elle n’est
            ouverte qu’aux comptes marqués administrateurs ; le tien ne l’est pas.
          </p>
          <Link className="button" to="/">
            Retour au bureau
          </Link>
        </section>
      </div>
    );
  }

  const enAttente = (comptes ?? []).filter((ligne) => ligne.etat === 'en attente');
  const traites = (comptes ?? []).filter((ligne) => ligne.etat !== 'en attente');

  return (
    <div className="page">
      <section className="section">
        <div className="section__head">
          <div>
            <h1>Les comptes de l’alpha</h1>
            <p className="muted max-w-[64ch]">
              Chaque compte arrive <strong>en attente</strong> : il peut jouer et lire, pas
              encore écrire. Approuve les invités, refuse les autres — un refus doit dire
              pourquoi, l’invité lira la raison.
            </p>
          </div>
          <button
            type="button"
            className="button"
            onClick={() => void charger()}
            disabled={chargementListe}
          >
            <RefreshCw size={16} /> {chargementListe ? 'Chargement…' : 'Rafraîchir'}
          </button>
        </div>
      </section>

      {message && (
        <section className={message.ton === 'ok' ? 'notice notice--ok' : 'notice notice--warn'}>
          <p className="m-0 max-w-[70ch]" role={message.ton === 'ok' ? 'status' : 'alert'}>
            {message.texte}
          </p>
        </section>
      )}

      {erreur && (
        <section className="notice notice--warn">
          <p className="m-0 max-w-[70ch]" role="alert">
            {erreur}
          </p>
        </section>
      )}

      {chargementListe && !comptes && (
        <section className="section panel">
          <p className="m-0 text-[0.9rem] text-ink-muted">Les comptes se chargent…</p>
        </section>
      )}

      {comptes && comptes.length === 0 && (
        <section className="section">
          <div className="empty">
            <p className="m-0 font-heading text-[1.15rem] font-bold text-ink">
              Aucun compte pour l’instant.
            </p>
            <p className="mx-auto mt-1 mb-0 max-w-[52ch]">
              Les comptes apparaissent ici à leur première connexion — Google ou courriel.
            </p>
          </div>
        </section>
      )}

      {comptes && comptes.length > 0 && (
        <section className="section panel" aria-labelledby="attente-titre">
          <h2 id="attente-titre">En attente ({enAttente.length})</h2>
          {enAttente.length === 0 ? (
            <p className="m-0 text-[0.9rem] text-ink-muted">Aucun compte en attente.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {enAttente.map((ligne) => (
                <li key={ligne.id} className="flex flex-col gap-2 border-t border-line/40 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <strong>{ligne.courriel || 'courriel inconnu'}</strong>
                      <span className="block text-[0.78rem] text-ink-muted">
                        {libelleEtat(ligne.etat)}
                        {ligne.created_at
                          ? ` · arrivé le ${new Date(ligne.created_at).toLocaleDateString('fr-FR')}`
                          : ''}
                      </span>
                    </div>
                    <div className="actions actions--tight">
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => void approuver(ligne)}
                        disabled={enCours === ligne.id}
                        aria-label={`Approuver ${ligne.courriel || 'ce compte'}`}
                      >
                        <Check size={16} /> Approuver
                      </button>
                      <button
                        type="button"
                        className="button"
                        onClick={() =>
                          setOuvertRefus((courant) => (courant === ligne.id ? null : ligne.id))
                        }
                        disabled={enCours === ligne.id}
                        aria-expanded={ouvertRefus === ligne.id}
                        aria-label={`Refuser ${ligne.courriel || 'ce compte'}`}
                      >
                        <X size={16} /> Refuser
                      </button>
                    </div>
                  </div>

                  {ouvertRefus === ligne.id && (
                    <div className="flex flex-col gap-2">
                      <label className="field">
                        <span className="field__label">Raison du refus</span>
                        <textarea
                          rows={2}
                          value={raisons[ligne.id] ?? ''}
                          onChange={(event) =>
                            setRaisons((courantes) => ({
                              ...courantes,
                              [ligne.id]: event.target.value
                            }))
                          }
                          placeholder="Exemple : je ne connais pas cette adresse."
                          aria-label={`Raison du refus pour ${ligne.courriel || 'ce compte'}`}
                        />
                      </label>
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => void refuser(ligne)}
                        disabled={enCours === ligne.id || !(raisons[ligne.id] ?? '').trim()}
                      >
                        Confirmer le refus
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {comptes && comptes.length > 0 && (
        <section className="section panel" aria-labelledby="traites-titre">
          <h2 id="traites-titre">Décidés ({traites.length})</h2>
          {traites.length === 0 ? (
            <p className="m-0 text-[0.9rem] text-ink-muted">Aucune décision pour l’instant.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[0.88rem]">
              {traites.map((ligne) => (
                <li key={ligne.id}>
                  <strong>{ligne.courriel || 'courriel inconnu'}</strong> ·{' '}
                  {libelleEtat(ligne.etat)}
                  {ligne.raison ? ` · ${ligne.raison}` : ''}
                  {ligne.administrateur ? ' · administrateur' : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
