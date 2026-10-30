/**
 * La connexion à l'alpha (D-088, #181).
 *
 * L'alpha n'est plus ouverte à tous : un **compte** est nécessaire pour entrer, et il est
 * **validé à la main** par Bastien. Deux portes, et deux seulement : **Google** (un clic) et
 * **courriel + mot de passe**. Pourquoi le mot de passe plutôt qu'un lien magique : le lien
 * dépend d'un serveur d'envoi *et* d'une adresse de retour autorisée, et quand il échoue le
 * testeur ne voit qu'un écran vide ; le mot de passe ne dépend que du fournisseur « Email ».
 *
 * **Sans configuration** (pas de `.env`), cette page ne propose rien et le dit : le jeu
 * reste exactement ce qu'il était avant D-088.
 *
 * États (D-060) : chargement (vérification de la session), erreur (refus de Supabase), et
 * l'état « déjà connecté », qui renvoie vers l'attente ou le bureau.
 *
 * Un compte connecté **sans profil complet** fait d'abord le parcours de première connexion
 * (#325, D-148) : pseudo, service, intitulé. Le profil est lu sur le compte (la base), pas sur
 * l'appareil ; il n'exige pas l'approbation, donc le parcours se fait avant la validation.
 *
 * **Trois choses que la revue du 30/10/2026 a corrigées ici** : un compte **refusé** ne traverse plus les trois
 * étapes avant d'apprendre son refus (D-156 (3)) ; la fin du parcours est un moment — le badge
 * s'affiche et le testeur entre d'où il venait (`depuis`), au lieu d'une disparition ; et les
 * deux attentes sont annoncées (`role="status"`), comme celles de la garde.
 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { RetourEcran } from '@/components/RetourEcran';
import { InvitationTesteurs } from '@/components/InvitationTesteurs';
import { ParcoursProfil } from '@/components/ParcoursProfil';
import { estApprouve } from '@/lib/comptes';
import { changerMotDePasse, recuperationMotDePasse } from '@/lib/recuperation';
import { etapeDuProfil } from '@/lib/profil';
import { fonctionProfil } from '@/game/intitule';
import { useComptes } from '@/store/comptes';
import { useProfil } from '@/store/profil';
import { useStore } from '@/store/useStore';

type Mode = 'connexion' | 'inscription' | 'oubli';

/** Le lien de récupération de Supabase pose son jeton dans le fragment de l'adresse. */
function lienDeRecuperation(): boolean {
  return typeof window !== 'undefined' && /(^|[#&])type=recovery/.test(window.location.hash);
}

/** Le nom local d'un joueur neuf : c'est lui qu'on remplace par le pseudo, à l'entrée. */
const NOM_NEUF = 'Employé 404';

export function Connexion() {
  const navigate = useNavigate();
  const location = useLocation();
  const configure = useComptes((state) => state.configure);
  const chargement = useComptes((state) => state.chargement);
  const session = useComptes((state) => state.session);
  const compte = useComptes((state) => state.compte);
  const erreur = useComptes((state) => state.erreur);
  const rafraichir = useComptes((state) => state.rafraichir);
  const connecterCourriel = useComptes((state) => state.connecterCourriel);
  const inscrireCourriel = useComptes((state) => state.inscrireCourriel);
  const connecterGoogle = useComptes((state) => state.connecterGoogle);

  const profil = useProfil((state) => state.profil);
  const profilCharge = useProfil((state) => state.charge);
  const lectureEchouee = useProfil((state) => state.lectureEchouee);
  const chargementProfil = useProfil((state) => state.chargement);
  const chargerProfil = useProfil((state) => state.charger);
  const setName = useStore((state) => state.setName);
  const deconnecter = useComptes((state) => state.deconnecter);

  const [mode, setMode] = useState<Mode>('connexion');
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [message, setMessage] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null);
  const [nouveau, setNouveau] = useState('');
  // Les deux gestes de récupération vivent hors du store (module à part, D-159) : leur attente
  // se tient donc ici.
  const [envoi, setEnvoi] = useState(false);
  // Le lien de récupération **connecte** : tant qu'il n'a pas servi, on ne renvoie pas le
  // testeur vers le bureau — il choisirait son mot de passe dans le vide (D-159).
  const [recuperation, setRecuperation] = useState(lienDeRecuperation);
  // Le parcours a été montré : sa fin devient un moment (le badge), pas une redirection sèche.
  const [aVuParcours, setAVuParcours] = useState(false);

  // La page d'où l'on vient (`GardeComptes` la pose) : on y retourne après le parcours.
  const depuis = (location.state as { depuis?: string } | null)?.depuis;
  const destination = depuis && depuis !== '/connexion' ? depuis : null;

  // La session peut venir du retour de Google (`detectSessionInUrl`) : on la relit en
  // arrivant, et on ne demande pas de ressaisir quoi que ce soit.
  useEffect(() => {
    if (configure) void rafraichir();
  }, [configure, rafraichir]);

  // Le profil du compte connecté : lu une fois, avant de décider où aller.
  useEffect(() => {
    if (configure && session && compte && !profilCharge) void chargerProfil(compte.id);
  }, [configure, session, compte, profilCharge, chargerProfil]);

  // Déjà connecté : le parcours s'il manque une étape, puis l'attente si le compte n'est pas
  // approuvé, le bureau sinon. Un compte **refusé** n'a rien à faire dans le parcours : la
  // seule page qui lui reste est l'attente, qui dit pourquoi (D-156 (3)).
  const refuse = compte?.etat === 'refuse';
  // Une lecture de profil en échec n'est pas « pas de profil » : sans cette distinction, un
  // testeur de l'étape 3 revoyait le formulaire du pseudo, et son second insert échouait.
  const profilIllisible = Boolean(session && compte && profilCharge && lectureEchouee && !profil);
  const parcoursEnCours = Boolean(
    session && compte && !refuse && !profilIllisible && profilCharge && etapeDuProfil(profil) !== 'fait'
  );
  useEffect(() => {
    if (parcoursEnCours) setAVuParcours(true);
  }, [parcoursEnCours]);

  const profilFini = Boolean(session && compte && profilCharge && etapeDuProfil(profil) === 'fait');
  const ceremonie = aVuParcours && profilFini && profil !== null;

  useEffect(() => {
    if (!configure || !session || chargement || !compte || !profilCharge || parcoursEnCours || ceremonie) return;
    if (profilIllisible || recuperation) return;
    navigate(refuse || !estApprouve(compte) ? '/attente' : (destination ?? '/'), { replace: true });
  }, [
    configure,
    session,
    compte,
    chargement,
    profilCharge,
    parcoursEnCours,
    ceremonie,
    refuse,
    profilIllisible,
    destination,
    navigate
  ]);

  const demanderLien = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setEnvoi(true);
    try {
      await recuperationMotDePasse(courriel, { redirectTo: `${window.location.origin}/connexion` });
    } catch (refus) {
      setMessage({ ton: 'ko', texte: refus instanceof Error ? refus.message : String(refus) });
      return;
    } finally {
      setEnvoi(false);
    }
    setMessage({
      ton: 'ok',
      texte:
        'Si cette adresse a un compte, le lien vient de partir. Regarde ta boîte — et les indésirables. Il te ramènera ici.'
    });
  };

  const poserMotDePasse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setEnvoi(true);
    try {
      await changerMotDePasse(nouveau);
    } catch (refus) {
      setMessage({ ton: 'ko', texte: refus instanceof Error ? refus.message : String(refus) });
      return;
    } finally {
      setEnvoi(false);
    }
    setNouveau('');
    setRecuperation(false);
    // Le jeton reste dans le fragment : on l'efface pour qu'un rechargement ne rejoue pas
    // le formulaire dans le vide.
    window.history.replaceState(null, '', '/connexion');
  };

  // Le lien de récupération ouvre une session : on demande le mot de passe **avant** de
  // renvoyer qui que ce soit vers le bureau (D-159).
  if (recuperation && session) {
    return (
      <div className="page page--nue">
        <section className="section">
          <h1>Un nouveau mot de passe</h1>
          <p className="muted max-w-[64ch]">
            Le lien t’a ramené jusqu’ici, et t’a déjà ouvert la porte. Choisis un mot de passe : c’est lui qui la
            rouvrira la prochaine fois.
          </p>
        </section>
        <section className="section panel" aria-labelledby="recuperation-titre">
          <h2 id="recuperation-titre">Nouveau mot de passe</h2>
          <form className="flex flex-col gap-3" onSubmit={poserMotDePasse}>
            <label className="field">
              <span className="field__label">Mot de passe</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={nouveau}
                onChange={(event) => setNouveau(event.target.value)}
                placeholder="Six caractères au moins"
                aria-describedby="recuperation-aide"
              />
            </label>
            <p id="recuperation-aide" className="m-0 text-sm text-ink-dim">
              C’est ce mot de passe qui rouvrira la porte la prochaine fois.
            </p>
            <div className="actions actions--tight">
              <button type="submit" className="button button--primary" disabled={envoi || nouveau.length < 6}>
                {envoi ? 'Patiente…' : 'Changer mon mot de passe'}
              </button>
            </div>
          </form>
          {erreur && (
            <p className="notice notice--warn m-0" role="alert">
              {erreur}
            </p>
          )}
          {message && (
            <p className={message.ton === 'ok' ? 'notice notice--ok m-0' : 'notice notice--warn m-0'} role="alert">
              {message.texte}
            </p>
          )}
        </section>
      </div>
    );
  }

  if (!configure) {
    return (
      <div className="page page--nue">
        <section className="section panel">
          <h1>Pas de compte sans base</h1>
          <p className="muted max-w-[62ch]">
            Cette version du jeu n’est pas reliée à une base : il n’y a ni compte ni connexion. Tout fonctionne comme
            avant, et le mur lit le fichier du dépôt.
          </p>
          <RetourEcran vers="/" libelle="Retour au bureau" />
        </section>
      </div>
    );
  }

  if (chargement && !session) {
    return (
      <div className="page page--nue">
        <RetourEcran vers="/" libelle="Retour au bureau" />
        <section className="section panel">
          <h1>Connexion</h1>
          <p className="m-0 text-md text-ink-muted" role="status">
            Vérification de ta session…
          </p>
        </section>
      </div>
    );
  }

  if (session && compte && !profilCharge) {
    return (
      <div className="page page--nue">
        <section className="section panel">
          <h1>Connexion</h1>
          <p className="m-0 text-md text-ink-muted" role="status">
            Lecture de ton profil…
          </p>
        </section>
      </div>
    );
  }

  // Le profil n'a pas pu être **lu** : ce n'est pas « pas de profil ». On le dit, et on laisse
  // deux issues — réessayer, ou se déconnecter — au lieu de renvoyer au pseudo.
  if (profilIllisible && compte) {
    return (
      <div className="page page--nue">
        <section className="section panel" aria-labelledby="profil-erreur">
          <h1 id="profil-erreur">Ton profil n’a pas pu être lu</h1>
          <p className="muted max-w-[64ch]">
            La base n’a pas répondu. Rien n’est perdu : ton pseudo, ton service et ton intitulé sont sur ton compte.
          </p>
          <div className="actions actions--tight">
            <button
              type="button"
              className="button button--primary"
              disabled={chargementProfil}
              onClick={() => void chargerProfil(compte.id)}
            >
              {chargementProfil ? 'Lecture…' : 'Réessayer'}
            </button>
            <button type="button" className="button" onClick={() => void deconnecter()}>
              Me déconnecter
            </button>
          </div>
        </section>
      </div>
    );
  }

  // Un compte refusé n'entre pas dans le parcours : il part vers la page qui dit pourquoi.
  if (session && compte && refuse) {
    return (
      <div className="page page--nue">
        <section className="section panel">
          <h1>Ton compte est refusé</h1>
          <p className="m-0 text-md text-ink-muted" role="status">
            La page d’attente dit pourquoi, et ce qu’il reste à faire.
          </p>
        </section>
      </div>
    );
  }

  if (parcoursEnCours && compte) {
    return (
      <div className="page page--nue">
        <section className="section">
          <h1>Bienvenue dans le bureau</h1>
          <p className="muted max-w-[64ch]">
            Trois étapes, et tu entres. Ton pseudo te suit sur le mur ; ton service ne change aucune règle du jeu.
          </p>
        </section>
        <ParcoursProfil uid={compte.id} />
      </div>
    );
  }

  // Le parcours vient de se terminer : un moment, pas une redirection. Le badge s'affiche, et
  // l'entrée mène là où le testeur allait (`depuis`), sinon au bureau ou à l'attente.
  if (ceremonie && compte && profil) {
    const entrer = () => {
      // La continuité d'identité (revue du 30/10/2026) : l'en-tête du jeu lisait « Employé 404 » juste après
      // que le testeur a écrit son pseudo. Sur un nom neuf, le pseudo le remplace ; un nom
      // choisi dans Réglages, lui, reste.
      if (useStore.getState().name === NOM_NEUF) setName(profil.pseudo);
      navigate(destination ?? (estApprouve(compte) ? '/' : '/attente'), { replace: true });
    };

    return (
      <div className="page page--nue">
        <section className="section">
          <h1>Bienvenue, {profil.pseudo}</h1>
          <p className="muted max-w-[64ch]">
            Trois étapes, et tu es dans le bureau. Voici ton badge : il te suit sur le mur et dans tes traces de combat.
          </p>
        </section>
        <section className="section panel" aria-labelledby="badge-titre">
          <h2 id="badge-titre">Ton badge</h2>
          <div className="parcours__tirage">
            <p className="parcours__intitule" data-testid="badge-intitule">
              {profil.intitule}
            </p>
            <p className="parcours__badge-fonction m-0">
              {fonctionProfil({ pseudo: profil.pseudo, service: profil.service ?? '' })}
            </p>
          </div>
          <p className="parcours__aide m-0">
            Ton service ne change rien aux règles ; ton intitulé est là pour rire. Les deux sont désormais figés.
          </p>
          <div className="actions actions--tight">
            <button type="button" className="button button--primary" onClick={entrer}>
              Entrer dans le bureau
            </button>
          </div>
        </section>
      </div>
    );
  }

  const soumettre = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (mode === 'connexion') {
      const refus = await connecterCourriel(courriel, motDePasse);
      if (refus) setMessage({ ton: 'ko', texte: refus });
      return;
    }

    const resultat = await inscrireCourriel(courriel, motDePasse);
    if (resultat.erreur) {
      setMessage({ ton: 'ko', texte: resultat.erreur });
      return;
    }
    if (resultat.courrielEnvoye) {
      setMessage({
        ton: 'ok',
        texte:
          'Compte créé. Un courriel de confirmation est parti : ouvre-le, puis reviens te connecter. Ton compte restera en attente de validation.'
      });
    }
  };

  const google = async () => {
    setMessage(null);
    const refus = await connecterGoogle();
    if (refus) setMessage({ ton: 'ko', texte: refus });
  };

  return (
    <div className="page page--nue">
      <RetourEcran vers="/" libelle="Retour au bureau" />
      <section className="section">
        <h1>Entrer dans l’alpha</h1>
        <p className="muted max-w-[64ch]">
          L’alpha est réservée aux <strong>testeurs</strong> : il faut un compte, et il est{' '}
          <strong>validé à la main</strong>. En attendant, tu peux jouer et lire le mur ; poster un post-it, voter ou
          envoyer une trace de combat s’ouvrira ensuite.
        </p>
      </section>

      <section className="section panel" aria-labelledby="connexion-titre">
        <h2 id="connexion-titre">
          {mode === 'connexion' ? 'Se connecter' : mode === 'inscription' ? 'Créer un compte' : 'Mot de passe oublié'}
        </h2>

        {mode === 'oubli' ? (
          <>
            <p className="muted m-0">
              Indique ton courriel : si un compte y est attaché, un lien part tout de suite. Il te ramènera ici, et tu y
              choisiras un mot de passe.
            </p>
            <form className="flex flex-col gap-3" onSubmit={demanderLien}>
              <label className="field">
                <span className="field__label">Courriel</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={courriel}
                  onChange={(event) => setCourriel(event.target.value)}
                  placeholder="prenom.nom@exemple.fr"
                />
              </label>
              <div className="actions actions--tight">
                <button type="submit" className="button button--primary" disabled={envoi || !courriel.trim()}>
                  {envoi ? 'Patiente…' : 'Recevoir un lien'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            {/* Une seule action pleine à l'écran (revue du 30/10/2026) : l'or va à la porte d'un clic, le
                courriel est l'alternative et garde un bouton de second rang. */}
            <button type="button" className="button button--gold" onClick={google} disabled={chargement}>
              <LogIn size={16} /> Continuer avec Google
            </button>

            <p className="m-0 my-2 text-center text-sm text-ink-dim">ou par courriel</p>

            <form className="flex flex-col gap-3" onSubmit={soumettre}>
              <label className="field">
                <span className="field__label">Courriel</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={courriel}
                  onChange={(event) => setCourriel(event.target.value)}
                  placeholder="prenom.nom@exemple.fr"
                />
              </label>

              <label className="field">
                <span className="field__label">Mot de passe</span>
                <input
                  type="password"
                  autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={motDePasse}
                  onChange={(event) => setMotDePasse(event.target.value)}
                  placeholder="Six caractères au moins"
                />
              </label>

              <div className="actions actions--tight">
                <button
                  type="submit"
                  className="button"
                  disabled={chargement || !courriel.trim() || motDePasse.length < 6}
                >
                  {chargement ? 'Patiente…' : mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
                </button>
              </div>
            </form>
          </>
        )}

        <div className="connexion__bascule">
          {mode === 'oubli' ? (
            <button
              type="button"
              onClick={() => {
                setMode('connexion');
                setMessage(null);
              }}
            >
              Revenir à la connexion
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'connexion' ? 'inscription' : 'connexion');
                  setMessage(null);
                }}
              >
                {mode === 'connexion' ? 'Pas encore de compte ? Crée-le' : 'J’ai déjà un compte'}
              </button>
              {mode === 'connexion' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('oubli');
                    setMessage(null);
                  }}
                >
                  Mot de passe oublié ?
                </button>
              )}
            </>
          )}
        </div>

        {erreur && (
          <p className="notice notice--warn m-0" role="alert">
            {erreur}
          </p>
        )}
        {message && (
          <p
            className={message.ton === 'ok' ? 'notice notice--ok m-0' : 'notice notice--warn m-0'}
            role={message.ton === 'ok' ? 'status' : 'alert'}
          >
            {message.texte}
          </p>
        )}
      </section>

      {/* Le seul secours qui serve à quelqu'un encore dehors (D-159, amende D-120 (2)). */}
      <InvitationTesteurs ou="connexion" />

      <p className="m-0 text-sm text-ink-dim">
        Ton mot de passe ne passe que par le service d’authentification ; le jeu ne le garde pas. Le courriel sert à te
        reconnaître et à te prévenir de la validation. Ce qui est gardé de toi est écrit dans{' '}
        <Link to="/confidentialite">la page de confidentialité</Link>.
      </p>
    </div>
  );
}
