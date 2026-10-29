import type { EtatInvite } from '@/lib/invite-installation';

/**
 * **La situation d'installation** — ce que le module « Banc prêt » de `/installation` doit
 * proposer, selon l'appareil. Code pur : il lit une description de l'environnement, jamais
 * `window` directement (sauf `lireEnvironnement`, la seule porte vers le navigateur).
 *
 * Six situations, **dans cet ordre** (`installation.test.ts` le tient) :
 *
 * 1. `application` — la page tourne déjà dans la fenêtre de l'application installée ;
 * 2. `installe` — l'installation vient d'être faite, pendant cette session (invite acceptée,
 *    ou `appinstalled`) : la page est encore dans l'onglet, l'icône est ailleurs ;
 * 3. `messagerie` — le lien s'est ouvert dans le navigateur intégré d'une messagerie
 *    (WhatsApp, Messenger, Instagram…), où l'on ne peut rien installer : il faut rouvrir le
 *    lien dans Chrome ou Safari ;
 * 4. `invite` — le navigateur a proposé l'installation (`beforeinstallprompt`, Chromium
 *    seulement) : un bouton la déclenche ;
 * 5. `ios` — iPhone ou iPad : Safari n'a pas d'invite, l'ajout se fait à la main
 *    (`docs/DISTRIBUTION.md` §3) ;
 * 6. `manuel` — tout le reste : Firefox, une invite pas encore arrivée, ou un jeu déjà
 *    installé que Chrome ne réannonce pas. Les étapes de la page suffisent.
 *
 * La reconnaissance passe par l'agent utilisateur : c'est une **heuristique**, qui peut se
 * tromper. Le module ne s'en sert que pour **ajouter** une aide ; les étapes manuelles de la
 * page restent toujours affichées.
 */

export type SituationInstallation = 'application' | 'installe' | 'messagerie' | 'invite' | 'ios' | 'manuel';

/** Ce que la page lit du navigateur — rien de plus. */
export interface Environnement {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** La page tourne dans la fenêtre de l'application installée. */
  standalone: boolean;
}

/**
 * Les navigateurs intégrés des messageries : leurs marqueurs dans l'agent utilisateur.
 * `FBAN`/`FBAV`/`FB_IAB` couvrent Facebook et Messenger ; les autres se nomment. Discord y
 * est : c'est le serveur des testeurs (D-120), et son application ouvre les liens chez elle.
 */
const MESSAGERIES = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Messenger|Snapchat|Discord|LinkedInApp|TikTok/i;

export function estMessagerie(userAgent: string): boolean {
  return MESSAGERIES.test(userAgent);
}

/**
 * iPhone, iPod, iPad — y compris l'**iPad qui se dit Mac** : depuis iPadOS 13, Safari demande
 * le site « ordinateur » et annonce `MacIntel`. Un Mac n'a pas d'écran tactile, un iPad si.
 */
export function estIOS(environnement: Environnement): boolean {
  if (/iPad|iPhone|iPod/.test(environnement.userAgent)) return true;
  return environnement.platform === 'MacIntel' && environnement.maxTouchPoints > 1;
}

export function situationDInstallation(environnement: Environnement, invite: EtatInvite): SituationInstallation {
  if (environnement.standalone) return 'application';
  if (invite.installe) return 'installe';
  if (estMessagerie(environnement.userAgent)) return 'messagerie';
  if (invite.disponible) return 'invite';
  if (estIOS(environnement)) return 'ios';
  return 'manuel';
}

/**
 * La seule lecture du vrai navigateur. Le mode installé se lit **des deux façons** :
 * `display-mode: standalone` (le standard, et Safari depuis iOS 16) et `navigator.standalone`
 * (Safari, avant). Un navigateur sans `matchMedia` ne fait pas tomber la page.
 */
export function lireEnvironnement(fenetre: Window = window): Environnement {
  const nav = fenetre.navigator as Navigator & { standalone?: boolean };
  const parMedia = typeof fenetre.matchMedia === 'function' && fenetre.matchMedia('(display-mode: standalone)').matches;
  return {
    userAgent: nav.userAgent ?? '',
    platform: nav.platform ?? '',
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: parMedia || nav.standalone === true
  };
}
