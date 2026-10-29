/**
 * **Le capteur de l'invite d'installation** — `beforeinstallprompt`, gardée pour le bouton
 * « Installer le jeu » du module « Banc prêt » (`src/components/BancPret.tsx`).
 *
 * Pourquoi un capteur **au démarrage** : Chromium (Chrome, Edge, Brave, Samsung Internet)
 * envoie l'invite **une fois**, souvent avant que React ait monté le moindre composant. Un
 * écouteur posé par la page `/installation` la raterait. `main.tsx` appelle donc
 * `capterInviteInstallation()` avant le rendu, et la page lit l'état ici.
 *
 * Trois règles (`invite-installation.test.ts`) :
 *
 * 1. l'invite est gardée et le bandeau du navigateur est **retenu** (`preventDefault`) :
 *    c'est le bouton du jeu qui la montre, jamais une barre surgie au chargement ;
 * 2. elle **ne sert qu'une fois** — après `prompt()`, Chromium la refuse ;
 * 3. `appinstalled` marque l'installation, même faite depuis le menu du navigateur.
 *
 * Safari et Firefox n'envoient jamais l'invite : l'état reste `disponible: false`, et le
 * module retombe sur les étapes manuelles.
 */

/** L'état de l'invite d'installation, lu par `src/lib/installation.ts`. */
export interface EtatInvite {
  /** Le navigateur a proposé l'installation, et l'invite n'a pas encore servi. */
  disponible: boolean;
  /** L'installation a été faite pendant cette session (`appinstalled`, ou invite acceptée). */
  installe: boolean;
}

/** Avant toute invite : rien de disponible, rien d'installé. */
export const ETAT_INVITE_INITIAL: EtatInvite = Object.freeze({ disponible: false, installe: false });

/** Le choix rendu par le navigateur (`userChoice.outcome`, ses mots), ou l'invite absente. */
export type ChoixNavigateur = 'accepted' | 'dismissed';
export type ResultatInstallation = ChoixNavigateur | 'indisponible';

/** Le contrat de `BeforeInstallPromptEvent`, absent de `lib.dom` (l'API n'est pas standard). */
interface EvenementInvite extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: ChoixNavigateur; platform: string }>;
}

export interface CapteurInvite {
  /** Une référence **stable** tant que rien ne change (le contrat de `useSyncExternalStore`). */
  etat(): EtatInvite;
  abonner(abonne: () => void): () => void;
  /** Montre l'invite du navigateur. À appeler **depuis un geste** : sinon Chromium refuse. */
  installer(): Promise<ResultatInstallation>;
}

export function creerCapteurInvite(cible: EventTarget): CapteurInvite {
  let evenement: EvenementInvite | null = null;
  let etat: EtatInvite = ETAT_INVITE_INITIAL;
  const abonnes = new Set<() => void>();

  const poser = (suivant: EtatInvite) => {
    if (suivant.disponible === etat.disponible && suivant.installe === etat.installe) return;
    etat = suivant;
    for (const abonne of abonnes) abonne();
  };

  cible.addEventListener('beforeinstallprompt', (brut) => {
    brut.preventDefault();
    evenement = brut as EvenementInvite;
    poser({ ...etat, disponible: true });
  });

  cible.addEventListener('appinstalled', () => {
    evenement = null;
    poser({ disponible: false, installe: true });
  });

  return {
    etat: () => etat,
    abonner(abonne) {
      abonnes.add(abonne);
      return () => {
        abonnes.delete(abonne);
      };
    },
    async installer() {
      const courant = evenement;
      if (!courant) return 'indisponible';
      // Consommée **avant** d'attendre : un double clic ne rejoue pas une invite morte.
      evenement = null;
      poser({ ...etat, disponible: false });
      try {
        await courant.prompt();
        const { outcome } = await courant.userChoice;
        if (outcome === 'accepted') poser({ disponible: false, installe: true });
        return outcome;
      } catch {
        return 'indisponible';
      }
    }
  };
}

/** Un capteur qui n'a jamais rien capté : le rendu sans navigateur (tests, rendu serveur). */
const CAPTEUR_INERTE: CapteurInvite = {
  etat: () => ETAT_INVITE_INITIAL,
  abonner: () => () => {},
  installer: () => Promise.resolve('indisponible')
};

let capteurDuJeu: CapteurInvite | null = null;

/**
 * Pose le capteur de l'application, **une fois** — appelé par `main.tsx` avant le rendu.
 * Un second appel rend le même capteur : deux écouteurs se disputeraient l'invite.
 */
export function capterInviteInstallation(cible: EventTarget): CapteurInvite {
  capteurDuJeu ??= creerCapteurInvite(cible);
  return capteurDuJeu;
}

/** Le capteur de l'application, ou un capteur inerte s'il n'a pas été posé. */
export function capteurInvite(): CapteurInvite {
  return capteurDuJeu ?? CAPTEUR_INERTE;
}
