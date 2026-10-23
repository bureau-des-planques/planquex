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
 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { estApprouve } from '@/lib/comptes';
import { useComptes } from '@/store/comptes';

type Mode = 'connexion' | 'inscription';

export function Connexion() {
  const navigate = useNavigate();
  const configure = useComptes((state) => state.configure);
  const chargement = useComptes((state) => state.chargement);
  const session = useComptes((state) => state.session);
  const compte = useComptes((state) => state.compte);
  const erreur = useComptes((state) => state.erreur);
  const rafraichir = useComptes((state) => state.rafraichir);
  const connecterCourriel = useComptes((state) => state.connecterCourriel);
  const inscrireCourriel = useComptes((state) => state.inscrireCourriel);
  const connecterGoogle = useComptes((state) => state.connecterGoogle);

  const [mode, setMode] = useState<Mode>('connexion');
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [message, setMessage] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null);

  // La session peut venir du retour de Google (`detectSessionInUrl`) : on la relit en
  // arrivant, et on ne demande pas de ressaisir quoi que ce soit.
  useEffect(() => {
    if (configure) void rafraichir();
  }, [configure, rafraichir]);

  // Déjà connecté : l'attente si le compte n'est pas approuvé, le bureau sinon.
  useEffect(() => {
    if (!configure || !session || chargement) return;
    navigate(estApprouve(compte) ? '/' : '/attente', { replace: true });
  }, [configure, session, compte, chargement, navigate]);

  if (!configure) {
    return (
      <div className="page">
        <section className="section panel">
          <h1>Pas de compte sans base</h1>
          <p className="muted max-w-[62ch]">
            Cette version du jeu n’est pas reliée à une base : il n’y a ni compte ni connexion.
            Tout fonctionne comme avant, et le mur lit le fichier du dépôt.
          </p>
          <Link className="button" to="/">
            Retour au bureau
          </Link>
        </section>
      </div>
    );
  }

  if (chargement && !session) {
    return (
      <div className="page">
        <section className="section panel">
          <h1>Connexion</h1>
          <p className="m-0 text-[0.9rem] text-ink-muted">Vérification de ta session…</p>
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
    <div className="page">
      <section className="section">
        <h1>Entrer dans l’alpha</h1>
        <p className="muted max-w-[64ch]">
          L’alpha est réservée aux <strong>invités</strong> : il faut un compte pour entrer.
          Il est <strong>validé à la main</strong> — en attendant, tu peux jouer et lire le
          mur ; poster un post-it, voter ou envoyer une trace de combat s’ouvrira ensuite.
        </p>
      </section>

      <section className="section panel" aria-labelledby="connexion-titre">
        <h2 id="connexion-titre">
          {mode === 'connexion' ? 'Se connecter' : 'Créer un compte'}
        </h2>

        <button type="button" className="button button--gold" onClick={google} disabled={chargement}>
          <LogIn size={16} /> Continuer avec Google
        </button>

        <p className="m-0 my-2 text-center text-[0.78rem] text-ink-dim">ou par courriel</p>

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
              className="button button--primary"
              disabled={chargement || !courriel.trim() || motDePasse.length < 6}
            >
              {chargement
                ? 'Patiente…'
                : mode === 'connexion'
                  ? 'Se connecter'
                  : 'Créer mon compte'}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setMode(mode === 'connexion' ? 'inscription' : 'connexion');
                setMessage(null);
              }}
            >
              {mode === 'connexion' ? 'Pas encore de compte ?' : 'J’ai déjà un compte'}
            </button>
          </div>
        </form>

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

      <p className="m-0 text-[0.78rem] text-ink-dim">
        Ton mot de passe ne transite que vers Supabase Auth ; le jeu ne le garde pas. Le
        courriel sert à te reconnaître et à te prévenir de la validation.{' '}
        <Link to="/">Retour au bureau</Link>
      </p>
    </div>
  );
}
