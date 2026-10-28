/**
 * Le profil du testeur — la couture réseau de `public.profils` (#325, D-088, D-148).
 *
 * Le profil est **attaché au compte** : la base le porte (`0019_profils.sql`), et le
 * tirage de l'intitulé, lui, se fait dans le navigateur (`src/game/intitule.ts`). Ce module
 * ne décide rien de ce que la base refuse : il traduit les refus en français, et il refuse
 * d'avance la seconde relance pour que l'écran n'appelle pas la base pour rien.
 */
import { clientMur } from '@/lib/supabase';
import type { ClientComptes } from '@/lib/comptes';
import { SERVICES, type CodeService } from '@/game/intitule';

/** Une ligne de `public.profils`, telle que l'écran la lit. */
export interface Profil {
  id: string;
  pseudo: string;
  service: CodeService | null;
  intitule: string | null;
  intitule_relances: number;
}

/** Les étapes du parcours, dans l'ordre. `fait` : le profil est complet. */
export type EtapeProfil = 'pseudo' | 'service' | 'intitule' | 'fait';

/** Le sous-ensemble du client dont ce module a besoin (structurel : éprouvable sans réseau). */
export type ClientProfil = ClientComptes;

const clientParDefaut = async (): Promise<ClientProfil | null> => (await clientMur()) as unknown as ClientProfil | null;

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

/** Une ligne de `profils` ramenée à la forme de l'écran ; `null` si elle est illisible. */
export function lireProfil(ligne: unknown): Profil | null {
  if (!estObjet(ligne) || typeof ligne.id !== 'string' || typeof ligne.pseudo !== 'string') return null;
  const service = SERVICES.find((s) => s.code === ligne.service)?.code ?? null;
  return {
    id: ligne.id,
    pseudo: ligne.pseudo,
    service,
    intitule: typeof ligne.intitule === 'string' ? ligne.intitule : null,
    intitule_relances: typeof ligne.intitule_relances === 'number' ? ligne.intitule_relances : 0
  };
}

/** L'étape où en est le parcours. Un profil absent commence par le pseudo. */
export function etapeDuProfil(profil: Profil | null): EtapeProfil {
  if (!profil) return 'pseudo';
  if (profil.service === null) return 'service';
  if (profil.intitule === null) return 'intitule';
  return 'fait';
}

/** Un refus de la base, dit en français. */
export function messageDeProfil(message: string): string {
  if (/profils_service_fige/.test(message)) return 'Ton service est figé : il ne se change plus.';
  if (/profils_intitule_fige/.test(message)) return 'Ton intitulé est enregistré : il ne se change plus.';
  if (/profils_relance_figee/.test(message)) return 'Tu as déjà validé ton intitulé : plus de relance.';
  if (/profils_intitule_apres_service/.test(message)) return 'Choisis d’abord ton service.';
  if (/profils_pseudo_check/.test(message)) {
    return 'Ton pseudo doit faire entre 1 et 24 caractères, sans blanc aux bords.';
  }
  if (/profils_service_check/.test(message)) return 'Ce service n’existe pas dans la liste.';
  if (/profils_intitule_check/.test(message)) return 'L’intitulé doit faire entre 1 et 80 caractères.';
  if (/intitule_relances_check/.test(message)) return 'Une seule relance est permise.';
  if (/row-level security|permission denied/i.test(message)) return 'La base refuse ce changement de profil.';
  if (/jwt|session/i.test(message)) return 'Ta session a expiré : reconnecte-toi.';
  return `Le profil n’a pas été enregistré (${message}).`;
}

async function client(chargerClient: () => Promise<ClientProfil | null>): Promise<ClientProfil> {
  const c = await chargerClient();
  if (!c) throw new Error('Supabase n’est pas configuré : pas de profil possible.');
  return c;
}

async function relire(c: ClientProfil, uid: string): Promise<Profil | null> {
  const { data, error } = await c.from('profils').select('*').eq('id', uid);
  if (error) throw new Error(messageDeProfil(error.message));
  return Array.isArray(data) ? lireProfil(data[0]) : null;
}

/** Le profil du compte, ou `null` s'il n'a pas encore fait le parcours. */
export async function lireMonProfil(uid: string, chargerClient = clientParDefaut): Promise<Profil | null> {
  return relire(await client(chargerClient), uid);
}

/** Étape 1 : le pseudo. Crée la ligne, puis la relit. */
export async function creerProfil(
  uid: string,
  pseudo: string,
  chargerClient = clientParDefaut
): Promise<Profil | null> {
  const c = await client(chargerClient);
  const { error } = await c.from('profils').insert({ id: uid, pseudo: pseudo.trim() });
  if (error) throw new Error(messageDeProfil(error.message));
  return relire(c, uid);
}

/** Étape 2 : le service. Figé dès qu'il est posé (la base le tient). */
export async function poserService(
  uid: string,
  service: CodeService,
  chargerClient = clientParDefaut
): Promise<Profil | null> {
  const c = await client(chargerClient);
  const { error } = await c.from('profils').update({ service }).eq('id', uid);
  if (error) throw new Error(messageDeProfil(error.message));
  return relire(c, uid);
}

/**
 * Une relance de l'intitulé. Refusée d'avance si elle a déjà eu lieu ; la base refuse
 * de toute façon une seconde (borne `0..1`) et une relance après enregistrement.
 */
export async function relancerIntitule(
  uid: string,
  relancesActuelles: number,
  chargerClient = clientParDefaut
): Promise<Profil | null> {
  if (relancesActuelles >= 1) throw new Error('Tu as déjà relancé ton intitulé : une seule relance est permise.');
  const c = await client(chargerClient);
  const { error } = await c.from('profils').update({ intitule_relances: 1 }).eq('id', uid);
  if (error) throw new Error(messageDeProfil(error.message));
  return relire(c, uid);
}

/** Étape 3 : l'intitulé, enregistré et figé. */
export async function poserIntitule(
  uid: string,
  intitule: string,
  chargerClient = clientParDefaut
): Promise<Profil | null> {
  const c = await client(chargerClient);
  const { error } = await c.from('profils').update({ intitule }).eq('id', uid);
  if (error) throw new Error(messageDeProfil(error.message));
  return relire(c, uid);
}
