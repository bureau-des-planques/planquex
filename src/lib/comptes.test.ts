// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  comptesEstConfigure,
  connexionCourriel,
  connexionGoogle,
  deciderCompte,
  deconnexion,
  estApprouve,
  inscriptionCourriel,
  libelleEtat,
  lireCompte,
  lireMonCompte,
  listerComptes,
  messageDeCompte,
  messageDeConnexion,
  type ClientComptes
} from '@/lib/comptes';
import type { RequeteMur, ReponseMur } from '@/lib/supabase';

/**
 * La couture des comptes, sans réseau (D-088, #181).
 *
 * Ce que ces tests gardent : la session et la ligne de compte se lisent correctement, les
 * messages d'erreur disent la vérité en français, et **une décision qui ne touche aucune
 * ligne est une erreur** — le piège de RLS (une modification refusée ne lève pas, elle
 * porte sur 0 ligne). La base elle-même est éprouvée par `supabase/comptes.test.ts`.
 */

const COMPTE = {
  id: 'compte-a',
  courriel: 'a@exemple.test',
  etat: 'approuve',
  raison: '',
  administrateur: false,
  medaille_periode_essai: false,
  medaille_periode_essai_le: null,
  created_at: '2026-10-23T10:00:00.000Z'
};

interface Reponses {
  session?: { id: string; email?: string | null } | null;
  /** Le porteur est une identité anonyme (`is_anonymous`) : ni courriel, ni ligne de compte. */
  anonyme?: boolean;
  lignes?: unknown[];
  lignesEcrites?: unknown[];
  erreurLecture?: string;
  erreurEcriture?: string;
}

function fauxClient(reponses: Reponses = {}) {
  const lectures: Array<{ table: string; filtres: Array<[string, string | number]> }> = [];
  const ecritures: Array<{
    table: string;
    valeurs?: Record<string, unknown>;
    filtres: Array<[string, string | number]>;
  }> = [];
  const ordres: Array<{ colonne: string; ascendant?: boolean }> = [];

  const getSession = vi.fn(async () => ({
    data: {
      session:
        reponses.session === null
          ? null
          : reponses.anonyme
            ? { user: { id: reponses.session?.id ?? 'appareil-anonyme', is_anonymous: true } }
            : { user: { id: reponses.session?.id ?? 'compte-a', email: reponses.session?.email ?? 'a@exemple.test' } }
    }
  }));
  type RetourConnexion = {
    data: { session: { user: { id: string } } | null };
    error: { message: string } | null;
  };
  const signInWithOAuth = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({
    error: null
  }));
  const signInWithPassword = vi.fn(async (): Promise<RetourConnexion> => ({
    data: { session: reponses.session === null ? null : { user: { id: 'compte-a' } } },
    error: null
  }));
  const signUp = vi.fn(async (): Promise<RetourConnexion> => ({
    data: { session: reponses.session === null ? null : { user: { id: 'compte-a' } } },
    error: null
  }));
  const signOut = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));

  const client = {
    auth: {
      getSession,
      signInWithOAuth,
      signInWithPassword,
      signUp,
      signOut
    },
    from(table: string): RequeteMur {
      let geste: 'select' | 'update' = 'select';
      const filtres: Array<[string, string | number]> = [];
      const requete: RequeteMur = {
        select: () => requete,
        order: (colonne, options) => {
          ordres.push({ colonne, ascendant: options?.ascending });
          return requete;
        },
        insert: () => requete,
        eq: (colonne, valeur) => {
          filtres.push([colonne, valeur]);
          return requete;
        },
        // Jamais employé ici (`comptes` se lit par `eq`) : le filtre existe pour le contrat
        // de `RequeteMur`, que le compteur du comité étend (#212).
        in: () => requete,
        update: (nouvelles) => {
          geste = 'update';
          ecritures.push({ table, valeurs: nouvelles, filtres });
          return requete;
        },
        delete: () => requete,
        then: (onfulfilled, onrejected) => {
          let reponse: ReponseMur<unknown>;
          if (geste === 'update') {
            reponse = {
              data: reponses.lignesEcrites ?? [],
              error: reponses.erreurEcriture ? { message: reponses.erreurEcriture } : null
            };
          } else {
            lectures.push({ table, filtres });
            reponse = {
              data: reponses.lignes ?? [],
              error: reponses.erreurLecture ? { message: reponses.erreurLecture } : null
            };
          }
          return Promise.resolve(reponse).then(onfulfilled, onrejected);
        }
      };
      return requete;
    }
  };

  return {
    client: client as unknown as ClientComptes,
    charger: async () => client as unknown as ClientComptes,
    getSession,
    signInWithOAuth,
    signInWithPassword,
    signUp,
    signOut,
    lectures,
    ecritures,
    ordres
  };
}

describe('la lecture d’un compte', () => {
  it('lit une ligne valide, et refuses une ligne illisible', () => {
    expect(lireCompte(COMPTE)).toEqual(COMPTE);
    expect(lireCompte({ ...COMPTE, etat: 'peut-être' })).toBeNull();
    expect(lireCompte({ ...COMPTE, id: 4 })).toBeNull();
    expect(lireCompte(null)).toBeNull();
  });

  it('un administrateur est toujours approuvé (la 0005 le dit aussi)', () => {
    expect(estApprouve({ ...COMPTE, etat: 'en attente', administrateur: true })).toBe(true);
    expect(estApprouve({ ...COMPTE, etat: 'en attente' })).toBe(false);
    expect(estApprouve(null)).toBe(false);
  });

  it('lit la médaille de la période d’essai, et ne l’invente pas quand la base l’ignore (D-130 (3))', () => {
    // La base la donne : le drapeau et sa date passent tels quels.
    expect(
      lireCompte({
        ...COMPTE,
        medaille_periode_essai: true,
        medaille_periode_essai_le: '2026-11-03T09:00:00.000Z'
      })
    ).toEqual({
      ...COMPTE,
      medaille_periode_essai: true,
      medaille_periode_essai_le: '2026-11-03T09:00:00.000Z'
    });

    // Une base qui n'a pas encore la 0016 ne rend pas les colonnes : pas de médaille inventée.
    const sansColonne = { ...COMPTE };
    delete (sansColonne as { medaille_periode_essai?: unknown }).medaille_periode_essai;
    delete (sansColonne as { medaille_periode_essai_le?: unknown }).medaille_periode_essai_le;
    expect(lireCompte(sansColonne)).toMatchObject({ medaille_periode_essai: false, medaille_periode_essai_le: null });

    // Une valeur qui n'est pas un booléen vrai (chaîne, 1) ne vaut pas une médaille.
    expect(lireCompte({ ...COMPTE, medaille_periode_essai: 'oui' })).toMatchObject({
      medaille_periode_essai: false
    });
  });

  it('les libellés d’état sont ceux de l’écran', () => {
    expect(libelleEtat('approuve')).toBe('approuvé');
    expect(libelleEtat('refuse')).toBe('refusé');
    expect(libelleEtat('en attente')).toBe('en attente de validation');
  });

  it('sans configuration, il n’y a pas de compte à lire', async () => {
    await expect(lireMonCompte(async () => null)).resolves.toBeNull();
  });

  it('sans session, rend une session nulle et aucun compte', async () => {
    const faux = fauxClient({ session: null });
    await expect(lireMonCompte(faux.charger)).resolves.toEqual({
      session: null,
      compte: null,
      erreur: null
    });
    // Aucune lecture de `comptes` n'a été tentée.
    expect(faux.lectures).toHaveLength(0);
  });

  it('avec une session, lit la ligne de l’appelant — et seulement la sienne', async () => {
    const faux = fauxClient({ lignes: [COMPTE] });
    const lu = await lireMonCompte(faux.charger);
    expect(lu?.session).toEqual({ id: 'compte-a', courriel: 'a@exemple.test', anonyme: false });
    expect(lu?.compte).toEqual(COMPTE);
    expect(faux.lectures[0].table).toBe('comptes');
    expect(faux.lectures[0].filtres).toEqual([['id', 'compte-a']]);
  });

  it('une identité anonyme porte son drapeau, et n’a pas de compte (#527)', async () => {
    // Le déclencheur de 0005 ne crée rien sans courriel : la session serait `compte: null`
    // comme une base en retard, d'où le drapeau — c'est lui que la garde interroge (D-156).
    const faux = fauxClient({ lignes: [], anonyme: true });
    const lu = await lireMonCompte(faux.charger);
    expect(lu?.session).toEqual({ id: 'appareil-anonyme', courriel: '', anonyme: true });
    expect(lu?.compte).toBeNull();
    expect(lu?.erreur).toBeNull();
  });

  it('une ligne manquante n’invente pas un état', async () => {
    const faux = fauxClient({ lignes: [] });
    const lu = await lireMonCompte(faux.charger);
    expect(lu?.session?.id).toBe('compte-a');
    expect(lu?.compte).toBeNull();
  });

  it('une erreur de lecture garde la session, et dit l’erreur', async () => {
    // Sans cette distinction, une base qui n'a pas encore la 0005 fermerait l'entrée à tout
    // le monde : lire et jouer ne dépendent pourtant pas de la table `comptes`.
    const faux = fauxClient({ erreurLecture: 'relation "comptes" does not exist' });
    const lu = await lireMonCompte(faux.charger);
    expect(lu?.session?.id).toBe('compte-a');
    expect(lu?.compte).toBeNull();
    expect(lu?.erreur).toMatch(/Lecture de ton compte impossible/);
  });
});

describe('se connecter, s’inscrire, se déconnecter', () => {
  it('sans configuration, la connexion est refusée clairement', async () => {
    await expect(connexionCourriel('a@exemple.test', 'motdepasse', async () => null)).rejects.toThrow(/pas configuré/);
  });

  it('le courriel est nettoyé, le mot de passe passe tel quel', async () => {
    const faux = fauxClient();
    await connexionCourriel('  a@exemple.test ', 'secret1', faux.charger);
    expect(faux.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@exemple.test',
      password: 'secret1'
    });
  });

  it('un refus de Supabase devient un message français', async () => {
    const faux = fauxClient();
    faux.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' }
    });
    await expect(connexionCourriel('a@exemple.test', 'faux', faux.charger)).rejects.toThrow(
      'Courriel ou mot de passe incorrect.'
    );
  });

  it('l’inscription dit quand un courriel de confirmation est attendu', async () => {
    const faux = fauxClient({ session: null });
    await expect(inscriptionCourriel('a@exemple.test', 'secret1', faux.charger)).resolves.toEqual({
      session: false
    });
  });

  it('Google reçoit le fournisseur et l’adresse de retour', async () => {
    const faux = fauxClient();
    await connexionGoogle('https://planquex.4k7.org/connexion', faux.charger);
    expect(faux.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://planquex.4k7.org/connexion' }
    });
  });

  it('la déconnexion appelle signOut ; sans backend, elle ne fait rien', async () => {
    const faux = fauxClient();
    await deconnexion(faux.charger);
    expect(faux.signOut).toHaveBeenCalledTimes(1);
    await expect(deconnexion(async () => null)).resolves.toBeUndefined();
  });
});

describe('l’administration des comptes', () => {
  it('liste les comptes par date d’arrivée, et refuse une ligne illisible', async () => {
    const faux = fauxClient({ lignes: [COMPTE, { ...COMPTE, id: 'compte-b', courriel: 'b@exemple.test' }] });
    const liste = await listerComptes(faux.charger);
    expect(liste.map((c) => c.id)).toEqual(['compte-a', 'compte-b']);
    expect(faux.ordres).toEqual([{ colonne: 'created_at', ascendant: true }]);

    const casse = fauxClient({ lignes: [{ ...COMPTE, id: 'compte-c', etat: 'inconnu' }] });
    await expect(listerComptes(casse.charger)).rejects.toThrow(/compte illisible/);
  });

  it('une décision envoie l’état et la raison, et rend la ligne écrite', async () => {
    const faux = fauxClient({ lignesEcrites: [{ ...COMPTE, etat: 'refuse', raison: 'Pas un testeur.' }] });
    const compte = await deciderCompte('compte-a', 'refuse', 'Pas un testeur.', faux.charger);
    expect(compte.etat).toBe('refuse');
    expect(faux.ecritures).toEqual([
      { table: 'comptes', valeurs: { etat: 'refuse', raison: 'Pas un testeur.' }, filtres: [['id', 'compte-a']] }
    ]);
  });

  it('une décision qui ne touche aucune ligne est une erreur, pas un succès', async () => {
    // C'est le piège de RLS : refusée, la modification ne lève pas — elle porte sur 0 ligne.
    const faux = fauxClient({ lignesEcrites: [] });
    await expect(deciderCompte('compte-a', 'approuve', '', faux.charger)).rejects.toThrow(/n’a changé aucun compte/);
  });

  it('un refus de la base est traduit, jamais recraché brut', async () => {
    const faux = fauxClient({ erreurEcriture: 'permission denied for table comptes' });
    await expect(deciderCompte('compte-a', 'approuve', '', faux.charger)).rejects.toThrow(/seul un administrateur/);
  });
});

describe('les messages d’erreur', () => {
  it('connexion : les cas connus sont dits en français', () => {
    expect(messageDeConnexion('Email not confirmed')).toMatch(/n’est pas encore confirmé/);
    expect(messageDeConnexion('User already registered')).toMatch(/déjà un compte/);
    expect(messageDeConnexion('Password should be at least 6 characters')).toMatch(/6 caractères/);
    expect(messageDeConnexion('Provider is not enabled')).toMatch(/Providers/);
    expect(messageDeConnexion('boom')).toMatch(/n’a pas abouti \(boom\)/);
  });

  it('compte : le refus muet et la permission sont nommés', () => {
    expect(messageDeCompte('comptes_refus_a_sa_raison : un refus')).toMatch(/doit dire pourquoi/);
    expect(messageDeCompte('permission denied for table comptes')).toMatch(/administrateur/);
    expect(messageDeCompte('row-level security policy')).toMatch(/pas permis/);
  });

  it('la configuration se lit comme celle du mur', () => {
    expect(comptesEstConfigure({})).toBe(false);
    expect(
      comptesEstConfigure({ VITE_SUPABASE_URL: 'https://x.test', VITE_SUPABASE_ANON_KEY: 'sb_publishable_x' })
    ).toBe(true);
    // Une configuration à moitié posée vaut « pas de base » pour l'écran, jamais une page blanche.
    expect(comptesEstConfigure({ VITE_SUPABASE_URL: 'https://x.test' })).toBe(false);
  });
});
