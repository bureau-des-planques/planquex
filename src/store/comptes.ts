/**
 * L'état du compte connecté (D-088, #181) — la session, son état d'approbation, et les
 * gestes de connexion.
 *
 * Ce store ne contient **aucune couture réseau** : il appelle `@/lib/comptes`, qui est la
 * couture testable. Les écrans lisent `useComptes` (`Connexion`, `Attente`, `Administration`, le
 * bandeau du `Layout`, le mur et Réglages) ; c'est aussi ce qui permet à un test de poser
 * « un compte en attente » sans backend.
 *
 * **Sans configuration**, `configure` vaut `false` : aucun écran ne demande de compte, et le
 * jeu garde son comportement d'avant D-088. Le store est créé au chargement du module ;
 * `rafraichir()` relit la session persistée au démarrage de l'application.
 */
import { create } from 'zustand';
import {
  comptesEstConfigure,
  connexionCourriel,
  connexionGoogle,
  deconnexion,
  inscriptionCourriel,
  lireMonCompte,
  type Compte,
  type SessionCompte,
} from '@/lib/comptes';

export interface ComptesState {
  /** Le backend est-il configuré ? Faux dans l'alpha sans `.env`, et dans les tests. */
  configure: boolean;
  chargement: boolean;
  session: SessionCompte | null;
  /** La ligne de `public.comptes`, ou `null` tant qu'on ne l'a pas lue. */
  compte: Compte | null;
  erreur: string | null;

  /** Relit la session persistée et la ligne de compte. */
  rafraichir: () => Promise<void>;
  connecterCourriel: (courriel: string, motDePasse: string) => Promise<string | null>;
  inscrireCourriel: (
    courriel: string,
    motDePasse: string,
  ) => Promise<{ erreur: string | null; courrielEnvoye: boolean }>;
  connecterGoogle: (redirectTo?: string) => Promise<string | null>;
  deconnecter: () => Promise<void>;
}

const messageDe = (erreur: unknown): string =>
  erreur instanceof Error ? erreur.message : String(erreur);

/** L'adresse de retour OAuth : la page de connexion, qui lit la session dans l'URL. */
function retourOAuth(): string {
  const origine =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:5178';
  return `${origine}/connexion`;
}

export const useComptes = create<ComptesState>((set, get) => ({
  configure: comptesEstConfigure(),
  // Avec une base, la session persistée n'est pas encore lue : la garde attend plutôt que
  // de renvoyer un testeur déjà connecté vers la page de connexion.
  chargement: comptesEstConfigure(),
  session: null,
  compte: null,
  erreur: null,

  rafraichir: async () => {
    if (!get().configure) {
      set({ chargement: false, session: null, compte: null, erreur: null });
      return;
    }

    set({ chargement: true, erreur: null });
    try {
      const lu = await lireMonCompte();
      set({
        chargement: false,
        session: lu?.session ?? null,
        compte: lu?.compte ?? null,
        // Une ligne illisible ne ferme pas l'entrée : la session reste valable, l'écran
        // d'attente dit ce qui manque.
        erreur: lu?.erreur ?? null,
      });
    } catch (erreur) {
      set({ chargement: false, erreur: messageDe(erreur) });
    }
  },

  connecterCourriel: async (courriel, motDePasse) => {
    set({ chargement: true, erreur: null });
    try {
      await connexionCourriel(courriel, motDePasse);
      await get().rafraichir();
      return null;
    } catch (erreur) {
      const message = messageDe(erreur);
      set({ chargement: false, erreur: message });
      return message;
    }
  },

  inscrireCourriel: async (courriel, motDePasse) => {
    set({ chargement: true, erreur: null });
    try {
      const { session } = await inscriptionCourriel(courriel, motDePasse);
      // Sans session, Supabase attend la confirmation du courriel : la personne doit ouvrir
      // sa boîte. On ne prétend pas qu'elle est connectée.
      await get().rafraichir();
      return { erreur: null, courrielEnvoye: !session };
    } catch (erreur) {
      const message = messageDe(erreur);
      set({ chargement: false, erreur: message });
      return { erreur: message, courrielEnvoye: false };
    }
  },

  connecterGoogle: async (redirectTo = retourOAuth()) => {
    set({ chargement: true, erreur: null });
    try {
      // Le navigateur part chez Google : la suite se lit au retour, dans `Connexion`.
      await connexionGoogle(redirectTo);
      // Le navigateur part chez Google ; si la redirection est bloquée, l'écran ne reste pas
      // bloqué sur « connexion… ».
      set({ chargement: false });
      return null;
    } catch (erreur) {
      const message = messageDe(erreur);
      set({ chargement: false, erreur: message });
      return message;
    }
  },

  deconnecter: async () => {
    set({ chargement: true, erreur: null });
    try {
      await deconnexion();
      set({ chargement: false, session: null, compte: null });
    } catch (erreur) {
      set({ chargement: false, erreur: messageDe(erreur) });
    }
  },
}));
