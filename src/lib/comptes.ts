/**
 * Les comptes de l'alpha — connexion et validation manuelle (D-088, #181).
 *
 * Ce module est la **couture réseau** : il parle à Supabase Auth (`Google` ou courriel) et
 * à la table `public.comptes` (`supabase/migrations/0005_comptes.sql`). Les écrans ne
 * l'appellent pas directement : `@/store/comptes` garde l'état, et les pages lisent le
 * store — c'est ce qui les rend testables sans réseau.
 *
 * **Sans configuration, rien ne change.** `configurerMur()` rend `null` quand les deux
 * `VITE_SUPABASE_*` manquent : `comptesEstConfigure()` rend alors `false`, et le jeu se
 * comporte exactement comme avant D-088 (le mur lit le fichier, aucun bouton d'écriture).
 * Aucun écran ne contacte le réseau dans ce cas.
 *
 * **Deux choix, écrits ici pour ne pas les redécouvrir :**
 *
 * 1. **Courriel + mot de passe**, pas de lien magique. Le lien magique exige un serveur
 *    d'envoi **et** une adresse de retour autorisée dans Supabase ; quand il échoue, le
 *    testeur reste sur un écran vide sans savoir pourquoi. Le mot de passe ne dépend que
 *    d'une chose : le fournisseur « Email » activé. La confirmation d'adresse peut rester
 *    active (le compte existe alors sans session, et l'écran le dit) ou être coupée — ce
 *    n'est **pas** elle qui protège l'alpha, c'est l'approbation manuelle (D-088).
 * 2. **Google** en un clic, par `signInWithOAuth`. Le retour OAuth est lu par
 *    `@supabase/supabase-js` (`detectSessionInUrl`, `src/lib/supabase.ts`) et la même
 *    garde d'écran s'applique : un compte Google arrive **en attente**, comme les autres.
 *
 * **La base fait foi** : ce module ne décide pas qui a le droit d'écrire. Les politiques de
 * la 0005 refusent un compte non approuvé ; l'écran ne fait que ne pas proposer ce que la
 * base refuserait.
 */
import type { RequeteMur } from '@/lib/supabase';
import { clientMur, configurerMur } from '@/lib/supabase';

/** Les trois états d'une demande de compte (0005). */
export const ETATS_COMPTE = ['en attente', 'approuve', 'refuse'] as const;
export type EtatCompte = (typeof ETATS_COMPTE)[number];

/** Une ligne de `public.comptes`, telle que l'écran la lit (jamais un mot de passe). */
export interface Compte {
  id: string;
  courriel: string;
  etat: EtatCompte;
  raison: string;
  administrateur: boolean;
  /** L'arrivée du compte, telle que la base la donne (ISO 8601). */
  created_at: string;
}

/** La session Supabase réduite à ce que le jeu affiche. */
export interface SessionCompte {
  id: string;
  courriel: string;
}

/**
 * Le sous-ensemble du client Supabase dont ce module a besoin. Structurel, comme
 * `AppareilAnonyme` : un faux client à quelques méthodes rend ces fonctions éprouvables
 * sans réseau.
 */
export interface ClientComptes {
  auth: {
    getSession(): Promise<{
      data: { session: { user: { id: string; email?: string | null } } | null };
    }>;
    signInAnonymously(): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
    signInWithOAuth(options: {
      provider: 'google';
      options?: { redirectTo?: string };
    }): Promise<{ error: { message: string } | null }>;
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{
      data: { session: { user: { id: string; email?: string | null } } | null };
      error: { message: string } | null;
    }>;
    signUp(credentials: { email: string; password: string }): Promise<{
      data: { session: { user: { id: string; email?: string | null } } | null };
      error: { message: string } | null;
    }>;
    signOut(): Promise<{ error: { message: string } | null }>;
  };
  from(table: string): RequeteMur;
}

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

/**
 * Le backend est-il armé ? Même règle que `murEstConfigure()` : une configuration à moitié
 * posée vaut « pas de base » pour l'écran, jamais une page blanche.
 */
export function comptesEstConfigure(env?: Record<string, string | boolean | undefined>): boolean {
  try {
    return configurerMur(env ?? import.meta.env) !== null;
  } catch {
    return false;
  }
}

/** Le client réel, réduit à `ClientComptes`. `null` quand rien n'est configuré. */
async function clientComptes(): Promise<ClientComptes | null> {
  return (await clientMur()) as unknown as ClientComptes | null;
}

/**
 * Une ligne de `comptes` ramenée à la forme de l'écran. Une ligne illisible rend `null` :
 * l'appelant décide (l'administration lève, la lecture de son propre compte dit « inconnu »).
 */
export function lireCompte(ligne: unknown): Compte | null {
  if (!estObjet(ligne)) return null;
  if (typeof ligne.id !== 'string') return null;
  if (!ETATS_COMPTE.includes(ligne.etat as EtatCompte)) return null;
  return {
    id: ligne.id,
    courriel: typeof ligne.courriel === 'string' ? ligne.courriel : '',
    etat: ligne.etat as EtatCompte,
    raison: typeof ligne.raison === 'string' ? ligne.raison : '',
    // Le drapeau vient de la base ; un client ne peut ni l'écrire ni le deviner.
    administrateur: ligne.administrateur === true,
    created_at: typeof ligne.created_at === 'string' ? ligne.created_at : '',
  };
}

/** Un administrateur est toujours approuvé (la fonction SQL le dit aussi, 0005). */
export function estApprouve(compte: Compte | null): boolean {
  return compte !== null && (compte.etat === 'approuve' || compte.administrateur);
}

/** Le libellé d'un état, pour les écrans. */
export function libelleEtat(etat: EtatCompte): string {
  if (etat === 'approuve') return 'approuvé';
  if (etat === 'refuse') return 'refusé';
  return 'en attente de validation';
}

/** Un refus de la base, dit en français. */
export function messageDeCompte(message: string): string {
  if (/comptes_refus_a_sa_raison/i.test(message)) return 'Un refus doit dire pourquoi.';
  if (/permission denied/i.test(message)) {
    return 'La base refuse : seul un administrateur peut changer l’état d’un compte.';
  }
  if (/row-level security/i.test(message)) {
    return 'La base refuse : ce changement de compte n’est pas permis.';
  }
  if (/jwt|session/i.test(message)) return 'Ta session a expiré : reconnecte-toi.';
  return `L’opération n’a pas abouti (${message}).`;
}

/** Un échec de connexion, dit en français — sans jamais recracher un message brut seul. */
export function messageDeConnexion(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Courriel ou mot de passe incorrect.';
  if (/email not confirmed/i.test(message)) {
    return 'Ton courriel n’est pas encore confirmé : regarde ta boîte de réception.';
  }
  if (/user already registered/i.test(message)) {
    return 'Ce courriel a déjà un compte : choisis « Se connecter ».';
  }
  if (/password should be at least/i.test(message)) {
    return 'Le mot de passe doit faire au moins 6 caractères.';
  }
  if (/signups? not allowed|email signups? (are|is) disabled/i.test(message)) {
    return 'L’inscription par courriel est fermée sur ce projet.';
  }
  if (/provider is not enabled/i.test(message)) {
    return 'Ce fournisseur n’est pas activé sur le projet Supabase (Authentication → Providers).';
  }
  return `La connexion n’a pas abouti (${message}).`;
}

/**
 * La session et la ligne de compte de l'appelant. Rend `null` quand le backend n'est pas
 * configuré ; `{ session: null, compte: null }` quand personne n'est connecté.
 *
 * Un compte connecté dont la ligne manque (déclencheur non appliqué, migration oubliée) rend
 * `compte: null` : l'écran le dit, il n'invente pas un état.
 */
export async function lireMonCompte(
  chargerClient: () => Promise<ClientComptes | null> = clientComptes,
): Promise<{ session: SessionCompte | null; compte: Compte | null } | null> {
  const client = await chargerClient();
  if (!client) return null;

  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  if (!user) return { session: null, compte: null };

  const { data: lignes, error } = await client.from('comptes').select('*').eq('id', user.id);
  if (error) throw new Error(`Lecture de ton compte impossible : ${error.message}`);

  return {
    session: { id: user.id, courriel: user.email ?? '' },
    compte: Array.isArray(lignes) ? lireCompte(lignes[0]) : null,
  };
}

/**
 * Connexion Google. Le navigateur part chez Google puis revient sur `redirectTo` ; la
 * session est lue au retour (`detectSessionInUrl`). Rien à attendre ici, sinon l'erreur de
 * configuration.
 */
export async function connexionGoogle(
  redirectTo: string,
  chargerClient: () => Promise<ClientComptes | null> = clientComptes,
): Promise<void> {
  const client = await chargerClient();
  if (!client) throw new Error('Supabase n’est pas configuré : pas de connexion possible.');
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw new Error(messageDeConnexion(error.message));
}

/** Connexion par courriel et mot de passe. */
export async function connexionCourriel(
  courriel: string,
  motDePasse: string,
  chargerClient: () => Promise<ClientComptes | null> = clientComptes,
): Promise<void> {
  const client = await chargerClient();
  if (!client) throw new Error('Supabase n’est pas configuré : pas de connexion possible.');
  const { error } = await client.auth.signInWithPassword({
    email: courriel.trim(),
    password: motDePasse,
  });
  if (error) throw new Error(messageDeConnexion(error.message));
}

/**
 * Inscription par courriel. Rend `session: false` quand Supabase demande une confirmation
 * d'adresse : la personne doit ouvrir le courriel, rien n'est cassé.
 */
export async function inscriptionCourriel(
  courriel: string,
  motDePasse: string,
  chargerClient: () => Promise<ClientComptes | null> = clientComptes,
): Promise<{ session: boolean }> {
  const client = await chargerClient();
  if (!client) throw new Error('Supabase n’est pas configuré : pas d’inscription possible.');
  const { data, error } = await client.auth.signUp({
    email: courriel.trim(),
    password: motDePasse,
  });
  if (error) throw new Error(messageDeConnexion(error.message));
  return { session: data.session !== null };
}

/** Se déconnecter. Sans backend, il n'y a rien à faire et rien à dire. */
export async function deconnexion(
  chargerClient: () => Promise<ClientComptes | null> = clientComptes,
): Promise<void> {
  const client = await chargerClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw new Error(messageDeCompte(error.message));
}

/** La liste des comptes, pour l'écran d'administration. La RLS ne la donne qu'à un admin. */
export async function listerComptes(
  chargerClient: () => Promise<ClientComptes | null> = clientComptes,
): Promise<Compte[]> {
  const client = await chargerClient();
  if (!client) throw new Error('Supabase n’est pas configuré : il n’y a pas de comptes.');

  const { data, error } = await client.from('comptes').select('*').order('created_at', {
    ascending: true
  });
  if (error) throw new Error(`Lecture des comptes impossible : ${error.message}`);
  if (!Array.isArray(data)) throw new Error('La base n’a pas rendu une liste de comptes.');

  return data.map((ligne, index) => {
    const compte = lireCompte(ligne);
    if (!compte) throw new Error(`La base a rendu un compte illisible (ligne ${index + 1}).`);
    return compte;
  });
}

/**
 * Approuver ou refuser un compte. Rend la ligne telle que la base l'a écrite.
 *
 * Une décision refusée par la RLS ne lève **pas** : elle porte sur 0 ligne. Sans ce
 * contrôle, l'écran d'administration croirait avoir approuvé quelqu'un alors que rien n'a
 * changé — le piège que `supabase/comptes.test.ts` fait mordre.
 */
export async function deciderCompte(
  id: string,
  etat: EtatCompte,
  raison: string,
  chargerClient: () => Promise<ClientComptes | null> = clientComptes,
): Promise<Compte> {
  const client = await chargerClient();
  if (!client) throw new Error('Supabase n’est pas configuré : il n’y a pas de comptes.');

  const { data, error } = await client
    .from('comptes')
    .update({ etat, raison })
    .eq('id', id)
    .select('*');
  if (error) throw new Error(messageDeCompte(error.message));

  const ligne = Array.isArray(data) ? data[0] : null;
  if (!ligne) {
    throw new Error(
      'La base n’a changé aucun compte : ton compte n’est peut-être pas administrateur.',
    );
  }
  const compte = lireCompte(ligne);
  if (!compte) throw new Error('La base a rendu un compte illisible après la décision.');
  return compte;
}
