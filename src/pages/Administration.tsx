/**
 * L'écran d'administration : les comptes de l'alpha (D-088, #181) **et le tri du mur**
 * (`0006_tri_et_corrections.sql`, D-059).
 *
 * Réservé aux comptes marqués **administrateurs** — le compte de Bastien, marqué une fois
 * dans le SQL Editor (`supabase/README.md` §5). La garde est **ici**, dans l'écran, et dans
 * la **base** : les politiques de la 0005 refusent à tout autre compte la lecture des
 * autres lignes et toute décision ; celles de la 0006 lui refusent le tri d'un post-it. Un
 * client bricolé ne peut donc ni approuver ni trier, et cet écran ne fait que ne pas
 * proposer ce que la base refuserait.
 *
 * Ce qu'on peut faire : **approuver** (le compte s'ouvre à l'écriture), **refuser avec une
 * raison** (la base exige la raison ; l'invité la lit sur son écran d'attente), et **trier**
 * chaque post-it — déplacer son **statut**, écrire la **raison** d'un écarté, lier un
 * **ticket**. Le tri ne touche ni le titre ni le texte : ceux-là sont à leur auteur (#139),
 * et le grant de colonnes de la 0006 ne les donne pas, même à l'administration.
 *
 * Le SQL Editor reste le repli — la migration décrit le marquage administrateur.
 *
 * États (D-060) : chargement, erreur de lecture (avec « Réessayer »), liste vide, et
 * l'écran d'un compte non administrateur — pour les comptes **et** pour le mur.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, RefreshCw, X } from 'lucide-react';
import { deciderCompte, libelleEtat, listerComptes, type Compte } from '@/lib/comptes';
import { chargerPostitsDuMur, trierPostit, type TriPostit } from '@/lib/murBase';
import { useComptes } from '@/store/comptes';
import { STATUTS, type Postit } from '@/store/mur';

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

  /** Le mur et son tri (#0006) : les post-its, les brouillons, et l'état de la lecture. */
  const [postits, setPostits] = useState<Postit[] | null>(null);
  const [chargementMur, setChargementMur] = useState(false);
  const [erreurMur, setErreurMur] = useState<string | null>(null);
  const [triEnCours, setTriEnCours] = useState<string | null>(null);
  const [brouillons, setBrouillons] = useState<Record<string, TriPostit>>({});
  const [messageMur, setMessageMur] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null);

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

  /**
   * Le mur se lit par le même chemin que la page du mur (`chargerPostitsDuMur`) : une seule
   * définition de ce qu'est un post-it, donc l'écran de tri ne peut pas afficher autre chose
   * que ce que les invités lisent.
   */
  const chargerLeMur = useCallback(async () => {
    if (!configure || !administrateur) return;
    setChargementMur(true);
    setErreurMur(null);
    try {
      const lus = await chargerPostitsDuMur();
      const liste = lus ?? [];
      setPostits(liste);
      setBrouillons(
        Object.fromEntries(
          liste.map((postit) => [
            postit.id,
            { statut: postit.statut, raison: postit.raison, ticket: postit.ticket },
          ]),
        ),
      );
    } catch (panne) {
      setErreurMur(messageDe(panne));
    } finally {
      setChargementMur(false);
    }
  }, [configure, administrateur]);

  useEffect(() => {
    if (configure && administrateur) void charger();
  }, [configure, administrateur, charger]);

  useEffect(() => {
    if (configure && administrateur) void chargerLeMur();
  }, [configure, administrateur, chargerLeMur]);

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

  /** Le brouillon d'un post-it : ce que l'écran affiche, et ce qui partira au clic. */
  const brouillonDe = (postit: Postit): TriPostit =>
    brouillons[postit.id] ?? { statut: postit.statut, raison: postit.raison, ticket: postit.ticket };

  const changerBrouillon = (id: string, changement: Partial<TriPostit>, postit: Postit) =>
    setBrouillons((courants) => ({
      ...courants,
      [id]: { ...(courants[id] ?? brouillonDe(postit)), ...changement },
    }));

  const enregistrerTri = async (postit: Postit) => {
    const tri = brouillonDe(postit);
    setTriEnCours(postit.id);
    setMessageMur(null);
    try {
      const ecrit = await trierPostit(postit.id, tri);
      setPostits((courants) =>
        courants ? courants.map((ligne) => (ligne.id === postit.id ? { ...ligne, ...ecrit } : ligne)) : courants,
      );
      setBrouillons((courants) => ({ ...courants, [postit.id]: ecrit }));
      setMessageMur({ ton: 'ok', texte: `« ${postit.titre} » : ${ecrit.statut}.` });
    } catch (panne) {
      setMessageMur({ ton: 'ko', texte: messageDe(panne) });
    } finally {
      setTriEnCours(null);
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
              pourquoi, l’invité lira la raison. En dessous, le <strong>tri du mur</strong> :
              statut, raison d’un écarté, ticket.
            </p>
          </div>
          <button
            type="button"
            className="button"
            onClick={() => {
              void charger();
              void chargerLeMur();
            }}
            disabled={chargementListe || chargementMur}
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

      {messageMur && (
        <section className={messageMur.ton === 'ok' ? 'notice notice--ok' : 'notice notice--warn'}>
          <p className="m-0 max-w-[70ch]" role={messageMur.ton === 'ok' ? 'status' : 'alert'}>
            {messageMur.texte}
          </p>
        </section>
      )}

      {erreurMur && (
        <section className="notice notice--warn">
          <p className="m-0 max-w-[70ch]" role="alert">
            {erreurMur}
          </p>
          <button type="button" className="button mt-2" onClick={() => void chargerLeMur()}>
            <RefreshCw size={16} /> Réessayer la lecture du mur
          </button>
        </section>
      )}

      {chargementMur && !postits && (
        <section className="section panel">
          <p className="m-0 text-[0.9rem] text-ink-muted">Le mur se charge…</p>
        </section>
      )}

      {postits && postits.length === 0 && (
        <section className="section panel">
          <h2>Le mur — le tri</h2>
          <p className="m-0 text-[0.9rem] text-ink-muted">
            Aucun post-it sur le mur pour l’instant : le tri s’ouvre au premier.
          </p>
        </section>
      )}

      {postits && postits.length > 0 && (
        <section className="section panel" aria-labelledby="tri-titre">
          <h2 id="tri-titre">Le mur — le tri ({postits.length})</h2>
          <p className="muted max-w-[66ch]">
            Déplacer un <strong>statut</strong>, écrire la <strong>raison</strong> d’un écarté,
            lier un <strong>ticket</strong>. Ni le titre ni le texte ne se modifient ici : ils
            sont à leur auteur (#139), et la base ne les donne pas à l’administration.
          </p>

          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {postits.map((postit) => {
              const brouillon = brouillonDe(postit);
              const change =
                brouillon.statut !== postit.statut ||
                brouillon.raison.trim() !== postit.raison ||
                brouillon.ticket !== postit.ticket;
              const ecarteSansRaison =
                brouillon.statut === 'écarté' && brouillon.raison.trim() === '';

              return (
                <li
                  key={postit.id}
                  data-tri={postit.id}
                  className="flex flex-col gap-3 border-t border-line/40 pt-3 first:border-t-0 first:pt-0"
                >
                  <div>
                    <strong>{postit.titre}</strong>
                    <span className="block text-[0.78rem] text-ink-muted">
                      {postit.gueulage ? 'Gueulage' : postit.kind} · {postit.pseudo || 'anonyme'} ·{' '}
                      {postit.statut}
                      {postit.ticket !== null ? ` · ticket #${postit.ticket}` : ''}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-end">
                    <label className="field min-[700px]:w-[11rem]">
                      <span className="field__label">Statut</span>
                      <select
                        value={brouillon.statut}
                        onChange={(event) =>
                          changerBrouillon(
                            postit.id,
                            { statut: event.target.value as TriPostit['statut'] },
                            postit,
                          )
                        }
                        aria-label={`Statut de « ${postit.titre} »`}
                      >
                        {STATUTS.map((statut) => (
                          <option key={statut} value={statut}>
                            {statut}
                          </option>
                        ))}
                      </select>
                    </label>

                    {brouillon.statut === 'écarté' && (
                      <label className="field flex-1">
                        <span className="field__label">Raison de l’écart</span>
                        <input
                          value={brouillon.raison}
                          onChange={(event) =>
                            changerBrouillon(postit.id, { raison: event.target.value }, postit)
                          }
                          placeholder="Exemple : hors périmètre du lancement."
                          aria-label={`Raison de l’écart de « ${postit.titre} »`}
                        />
                      </label>
                    )}

                    <label className="field min-[700px]:w-[9rem]">
                      <span className="field__label">Ticket</span>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={brouillon.ticket ?? ''}
                        onChange={(event) => {
                          const saisi = event.target.value.trim();
                          const numero = saisi === '' ? null : Number(saisi);
                          changerBrouillon(
                            postit.id,
                            {
                              ticket:
                                numero !== null && Number.isSafeInteger(numero) && numero > 0
                                  ? numero
                                  : null,
                            },
                            postit,
                          );
                        }}
                        aria-label={`Ticket de « ${postit.titre} »`}
                      />
                    </label>

                    <button
                      type="button"
                      className="button button--primary"
                      disabled={!change || ecarteSansRaison || triEnCours === postit.id}
                      onClick={() => void enregistrerTri(postit)}
                      aria-label={`Enregistrer le tri de « ${postit.titre} »`}
                    >
                      {triEnCours === postit.id ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>

                  {ecarteSansRaison && (
                    <p className="m-0 text-[0.8rem] text-ink-muted">
                      Écarter exige une raison écrite : c’est elle qui apprend aux invités ce
                      qui vaut la peine d’être remonté (D-059).
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
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
