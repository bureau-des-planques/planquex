import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /**
   * Une clé qui, en changeant, **referme** l'erreur : le Layout y passe l'adresse, donc
   * quitter l'écran qui a planté rend les autres écrans — le plantage ne suit pas.
   */
  reinitialiseSur?: string;
}

interface Etat {
  erreur: Error | null;
}

/**
 * Le **garde-fou d'erreur de rendu** (#131, D-060 critère 3) : sans lui, une exception
 * dans un écran démonte toute l'application et laisse une page **blanche**, sans un mot.
 *
 * Il ne rattrape que le **rendu** (React ne confie rien d'autre à un garde-fou) : les
 * gestionnaires d'événements et les promesses restent traités là où ils naissent.
 *
 * Le repli n'emploie **ni routeur ni store** : il doit tenir debout même quand l'erreur
 * vient d'eux. Ses sorties sont donc des gestes de navigateur — recharger, ou repartir à
 * l'accueil par une adresse ordinaire.
 */
export class ErreurDeRendu extends Component<Props, Etat> {
  state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    // Le seul endroit où le jeu parle à la console : une erreur de rendu ne doit jamais
    // se perdre en silence, et c'est ce qui fait échouer `npm run capturer`.
    console.error('Erreur de rendu :', erreur, info.componentStack);
  }

  componentDidUpdate(precedent: Props) {
    if (this.state.erreur && precedent.reinitialiseSur !== this.props.reinitialiseSur) {
      this.setState({ erreur: null });
    }
  }

  render() {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;

    return (
      <section className="page erreur-ecran" role="alert">
        <h1>Cet écran a planté</h1>
        <p className="muted">
          Ce n’est pas ta faute, et ta progression n’est pas touchée : elle vit dans ce navigateur, pas dans l’écran qui
          vient de tomber. Recharge, ou repars de l’accueil.
        </p>
        <div className="actions actions--tight">
          <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
            Recharger
          </button>
          <a className="button" href="/">
            Revenir à l’accueil
          </a>
        </div>
        <details className="fold">
          <summary>
            <span>Ce que dit l’erreur</span> <span className="muted">à recopier dans un post-it OUF</span>
          </summary>
          <pre className="fold__body erreur-ecran__detail">{erreur.message}</pre>
        </details>
      </section>
    );
  }
}
