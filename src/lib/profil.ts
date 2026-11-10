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
  /**
   * L'icône de profil (D-197 (2), colonne de `0027`, liste fermée de `0029`) : l'un des douze
   * slugs d'`ICONES_PROFIL`, `null` tant que le parcours ne l'a pas posée. Une valeur hors liste
   * (base d'avant `0029`, pas encore migrée) se lit comme `null` : le parcours la redemande.
   */
  icone: SlugIcone | null;
  /**
   * Quand le compte a fait la Journée (D-197 (3)) ; `null` = pas faite. Posée **une fois**, datée
   * par le serveur, jamais défaite : rejouer la Journée depuis Réglages ne touche pas à ce fait.
   */
  journee_faite_le: string | null;
}

/**
 * La forme d'une icône, telle que la base la tient : minuscules, chiffres, tirets simples,
 * 1 à 40 caractères. Depuis `0029_profil_icone_liste.sql` la base tient **en plus** la liste
 * fermée ci-dessous (#791, D-197 (2)) ; la forme reste ce que garde `design/profils/` (les noms
 * de fichiers).
 */
export const FORME_ICONE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Les douze portraits de planqués (D-197 (2)), dans l'ordre où le parcours les montre. Le slug est
 * le nom du fichier `public/design/profils/<slug>.webp` **et** la valeur de `profils.icone` ; le
 * libellé dit le portrait, il n'a aucun effet en jeu (D-135). La liste est doublée dans la base
 * (`0029_profil_icone_liste.sql`) : `src/lib/profil-icones.test.ts` et
 * `supabase/profil-icone-liste.test.ts` gardent les deux ensemble.
 */
export const ICONES_PROFIL = [
  { slug: 'agent-accueil', libelle: 'Agent d’accueil' },
  { slug: 'controleuse', libelle: 'Contrôleuse' },
  { slug: 'technicien', libelle: 'Technicien' },
  { slug: 'comptable', libelle: 'Comptable' },
  { slug: 'cheffe-projet', libelle: 'Cheffe de projet' },
  { slug: 'developpeur', libelle: 'Développeur' },
  { slug: 'gestionnaire-rh', libelle: 'Gestionnaire RH' },
  { slug: 'chef-atelier', libelle: 'Chef d’atelier' },
  { slug: 'charge-communication', libelle: 'Chargée de communication' },
  { slug: 'archiviste', libelle: 'Archiviste' },
  { slug: 'juriste', libelle: 'Juriste' },
  { slug: 'logisticien', libelle: 'Logisticien' }
] as const;

export type SlugIcone = (typeof ICONES_PROFIL)[number]['slug'];

/** Vrai si l'icône est l'une des douze : refusé d'avance ce que la base refuserait. */
export function iconeDeLaListe(icone: unknown): icone is SlugIcone {
  return typeof icone === 'string' && ICONES_PROFIL.some((i) => i.slug === icone);
}

/** Où se trouve l'image d'une icône. */
export const urlIcone = (slug: SlugIcone): string => `/design/profils/${slug}.webp`;

/** Vrai si l'icône a la forme que la base accepte (la liste, elle, est `iconeDeLaListe`). */
export function iconeBienFormee(icone: string): boolean {
  return icone.length >= 1 && icone.length <= 40 && FORME_ICONE.test(icone);
}

/** Vrai si le compte a fait la Journée (D-197 (3)) : le fait est sur le profil, pas sur l'appareil. */
export function journeeFaite(profil: Profil | null): boolean {
  return profil?.journee_faite_le !== null && profil?.journee_faite_le !== undefined;
}

/** Les étapes du parcours, dans l'ordre. `fait` : le profil est complet. */
export type EtapeProfil = 'pseudo' | 'icone' | 'service' | 'intitule' | 'fait';

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
    intitule_relances: typeof ligne.intitule_relances === 'number' ? ligne.intitule_relances : 0,
    icone: iconeDeLaListe(ligne.icone) ? ligne.icone : null,
    journee_faite_le: typeof ligne.journee_faite_le === 'string' ? ligne.journee_faite_le : null
  };
}

/** L'étape où en est le parcours. Un profil absent commence par le pseudo. */
export function etapeDuProfil(profil: Profil | null): EtapeProfil {
  if (!profil) return 'pseudo';
  if (profil.icone === null) return 'icone';
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
  if (/profils_journee_figee/.test(message)) return 'Ta Journée est faite : ce fait ne se défait pas.';
  if (/profils_icone_check/.test(message)) return 'Cette icône n’est pas dans la liste.';
  if (/profils_pseudo_check/.test(message)) {
    return 'Ton pseudo doit faire entre 1 et 24 caractères, sans blanc aux bords.';
  }
  if (/profils_service_check/.test(message)) return 'Ce service n’existe pas dans la liste.';
  if (/profils_intitule_check/.test(message)) return 'L’intitulé doit faire entre 1 et 80 caractères.';
  if (/intitule_relances_check/.test(message)) return 'Une seule relance est permise.';
  if (/row-level security|permission denied/i.test(message)) return 'La base refuse ce changement de profil.';
  if (/jwt|session/i.test(message)) return 'Ta session a expiré : reconnecte-toi.';
  // Le message brut de PostgREST est de l'anglais technique : il part en console pour qui
  // cherche, jamais à l'écran d'un testeur (revue du 30/10/2026).
  console.error(`profil : ${message}`);
  return 'Le profil n’a pas été enregistré. Réessaie dans un instant.';
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

/**
 * L'icône de profil (D-197 (2)). Refusée d'avance si elle n'est pas dans la liste ; la base la refuse
 * de toute façon (`profils_icone_check`). Elle se change librement, comme le pseudo.
 */
export async function poserIcone(uid: string, icone: string, chargerClient = clientParDefaut): Promise<Profil | null> {
  if (!iconeDeLaListe(icone)) throw new Error(messageDeProfil('profils_icone_check'));
  const c = await client(chargerClient);
  const { error } = await c.from('profils').update({ icone }).eq('id', uid);
  if (error) throw new Error(messageDeProfil(error.message));
  return relire(c, uid);
}

/**
 * Marque la Journée faite sur le compte (D-197 (3)). La valeur envoyée ne compte pas : le
 * serveur la redate à `now()`. Un second appel est refusé par la base (`profils_journee_figee`)
 * **sauf** si la date renvoyée est identique ; ce module n'appelle donc la base que si le fait
 * n'est pas déjà posé, et rend le profil tel quel sinon.
 */
export async function marquerJourneeFaite(
  uid: string,
  profilActuel: Profil | null,
  chargerClient = clientParDefaut
): Promise<Profil | null> {
  if (journeeFaite(profilActuel)) return profilActuel;
  const c = await client(chargerClient);
  const { error } = await c.from('profils').update({ journee_faite_le: new Date().toISOString() }).eq('id', uid);
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
