/**
 * L'état du profil du testeur (#325, D-088, D-148) : le pseudo, le service et l'intitulé qui
 * suivent le **compte**, pas l'appareil.
 *
 * Le store ne garde que ce que la base a renvoyé : chaque geste écrit, puis relit la ligne.
 * Les écrans lisent `useProfil` ; `src/lib/profil.ts` est la couture réseau, testée à part.
 * Les actions rendent un message d'erreur en français, ou `null` quand le geste a réussi.
 */
import { create } from 'zustand';
import { comptesEstConfigure } from '@/lib/comptes';
import { creerProfil, lireMonProfil, poserIntitule, poserService, relancerIntitule, type Profil } from '@/lib/profil';
import type { CodeService } from '@/game/intitule';

export interface ProfilState {
  profil: Profil | null;
  /** Vrai dès que la lecture a eu lieu une fois (même si le profil est absent). */
  charge: boolean;
  chargement: boolean;
  erreur: string | null;

  charger: (uid: string) => Promise<void>;
  creerPseudo: (uid: string, pseudo: string) => Promise<string | null>;
  choisirService: (uid: string, service: CodeService) => Promise<string | null>;
  relancer: (uid: string) => Promise<string | null>;
  valider: (uid: string, intitule: string) => Promise<string | null>;
}

const messageDe = (erreur: unknown): string => (erreur instanceof Error ? erreur.message : String(erreur));

/** Lance un geste, relit le résultat dans le store, et rend l'erreur éventuelle. */
async function geste(
  set: (partiel: Partial<ProfilState>) => void,
  action: () => Promise<Profil | null>
): Promise<string | null> {
  set({ chargement: true, erreur: null });
  try {
    const profil = await action();
    set({ profil, chargement: false, charge: true });
    return null;
  } catch (erreur) {
    const message = messageDe(erreur);
    set({ chargement: false, erreur: message });
    return message;
  }
}

export const useProfil = create<ProfilState>((set, get) => ({
  profil: null,
  charge: false,
  chargement: false,
  erreur: null,

  charger: async (uid) => {
    if (!comptesEstConfigure()) {
      set({ charge: true, profil: null });
      return;
    }
    set({ chargement: true, erreur: null });
    try {
      const profil = await lireMonProfil(uid);
      set({ profil, charge: true, chargement: false });
    } catch (erreur) {
      set({ charge: true, chargement: false, erreur: messageDe(erreur) });
    }
  },

  creerPseudo: (uid, pseudo) => geste(set, () => creerProfil(uid, pseudo)),

  choisirService: (uid, service) => geste(set, () => poserService(uid, service)),

  relancer: (uid) => geste(set, () => relancerIntitule(uid, get().profil?.intitule_relances ?? 0)),

  valider: (uid, intitule) => geste(set, () => poserIntitule(uid, intitule))
}));
