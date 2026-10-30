/**
 * Le mot de passe oublié (D-159) : le lien de récupération, et le nouveau mot de passe.
 *
 * **Un module à part, et c'est un choix de poids** : `src/lib/comptes.ts` vit dans le paquet
 * principal (la garde du `Layout` le lit avant tout écran), et ces deux gestes ne servent qu'à
 * la page de connexion, qui est un morceau à part. Les y laisser coûtait ~1,4 kB au paquet
 * principal, au-dessus de son cliquet (`npm run mesure:paquets`).
 *
 * Le lien **connecte** : Supabase ouvre une session en revenant sur `…/connexion#…type=recovery`.
 * Changer le mot de passe est donc un second geste (`updateUser`), jamais un effet du lien.
 */
import type { ClientComptes } from '@/lib/comptes';
import { messageDeConnexion } from '@/lib/comptes';
import { clientMur } from '@/lib/supabase';

/**
 * Le client, réduit à ce dont ce module a besoin. La même ligne que `clientComptes()` de
 * `comptes.ts` : **on ne l'importe pas**, l'exporter ferait garder son nom au symbole dans le
 * paquet principal (mesuré : 21 octets, et le cliquet n'en laisse pas un).
 */
const chargerClient = async (): Promise<ClientComptes | null> => (await clientMur()) as unknown as ClientComptes | null;

/**
 * Le refus de Supabase, dit en français.
 *
 * **Aucun message ne dit si l'adresse existe** : c'est la règle de Supabase (il répond pareil
 * dans les deux cas), et c'est aussi la bonne — une porte qui avoue « ce courriel n'existe
 * pas » est un annuaire.
 */
export function messageDeRecuperation(message: string): string {
  if (/rate limit|too many|after \d+ seconds/i.test(message)) {
    return 'Trop de demandes d’un coup : réessaie dans quelques minutes.';
  }
  if (/invalid email|unable to validate email|email address .* is invalid/i.test(message)) {
    return 'Cette adresse n’a pas l’air d’un courriel.';
  }
  if (/redirect|not allowed/i.test(message)) {
    return 'L’adresse de retour n’est pas autorisée sur ce projet (Authentication → URL Configuration).';
  }
  return 'Le lien n’a pas pu partir. Réessaie dans un instant.';
}

/** Envoie le lien de récupération. Sans backend, il n'y a rien à envoyer et on le dit. */
export async function recuperationMotDePasse(
  courriel: string,
  options: { chargerClient?: () => Promise<ClientComptes | null>; redirectTo?: string } = {}
): Promise<void> {
  const client = await (options.chargerClient ?? chargerClient)();
  if (!client) throw new Error('Supabase n’est pas configuré : pas de lien possible.');
  const { error } = await client.auth.resetPasswordForEmail(courriel.trim(), { redirectTo: options.redirectTo });
  if (error) throw new Error(messageDeRecuperation(error.message));
}

/** Pose le nouveau mot de passe d'une session ouverte par le lien de récupération. */
export async function changerMotDePasse(
  motDePasse: string,
  charger: () => Promise<ClientComptes | null> = chargerClient
): Promise<void> {
  const client = await charger();
  if (!client) throw new Error('Supabase n’est pas configuré : pas de mot de passe possible.');
  const { error } = await client.auth.updateUser({ password: motDePasse });
  if (error) throw new Error(messageDeConnexion(error.message));
}
