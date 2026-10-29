import { describe, expect, it } from 'vitest';
import {
  estIOS,
  estMessagerie,
  lireEnvironnement,
  situationDInstallation,
  type Environnement
} from '@/lib/installation';

/**
 * **La situation d'installation** — quelle aide le module « Banc prêt » de `/installation` doit
 * donner, selon l'appareil.
 *
 * L'ordre des cas est la règle que ces tests tiennent :
 *
 * 1. **déjà dans l'application installée** : plus rien à installer, quoi que dise le reste ;
 *    une installation **faite pendant la session** vient juste après — la page est encore
 *    dans l'onglet, et il faut dire où est passée l'icône ;
 * 2. **un navigateur de messagerie** (WhatsApp, Messenger…) : on ne peut rien y installer,
 *    même si une invite arrivait — il faut rouvrir le lien ailleurs ;
 * 3. **l'invite du navigateur est là** (`beforeinstallprompt` capté) : un bouton suffit ;
 * 4. **iPhone ou iPad** : pas d'invite possible, l'ajout se fait à la main dans Safari ;
 * 5. **sinon** : les étapes manuelles de la page (Firefox, invite pas encore arrivée, ou jeu
 *    déjà installé que Chrome ne réannonce pas).
 *
 * Les agents utilisateurs sont des chaînes réelles, recopiées telles quelles.
 */

const UA = {
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  chromeBureau: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  // iPadOS demande le site « ordinateur » par défaut : il se dit Mac. Seul l'écran tactile le trahit.
  safariIpad:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  whatsappAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.21.80',
  messengerIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0.0.40.104]',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.40.92 Android',
  firefoxBureau: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0'
};

const env = (champs: Partial<Environnement>): Environnement => ({
  userAgent: UA.chromeBureau,
  platform: 'Linux x86_64',
  maxTouchPoints: 0,
  standalone: false,
  ...champs
});

const sansInvite = { disponible: false, installe: false };
const avecInvite = { disponible: true, installe: false };

describe('estMessagerie — le navigateur intégré d’une application', () => {
  it('reconnaît WhatsApp, Messenger et Instagram', () => {
    expect(estMessagerie(UA.whatsappAndroid)).toBe(true);
    expect(estMessagerie(UA.messengerIphone)).toBe(true);
    expect(estMessagerie(UA.instagramAndroid)).toBe(true);
  });

  it('le contrôle mord : un vrai navigateur n’est pas une messagerie', () => {
    for (const ua of [UA.chromeAndroid, UA.chromeBureau, UA.safariIphone, UA.firefoxBureau]) {
      expect(estMessagerie(ua), ua).toBe(false);
    }
  });
});

describe('estIOS — iPhone et iPad, iPad déguisé en Mac compris', () => {
  it('reconnaît l’iPhone, et l’iPad qui se dit Mac mais a un écran tactile', () => {
    expect(estIOS(env({ userAgent: UA.safariIphone, platform: 'iPhone', maxTouchPoints: 5 }))).toBe(true);
    expect(estIOS(env({ userAgent: UA.safariIpad, platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true);
  });

  it('le contrôle mord : un vrai Mac, sans écran tactile, n’est pas un iPad', () => {
    expect(estIOS(env({ userAgent: UA.safariIpad, platform: 'MacIntel', maxTouchPoints: 0 }))).toBe(false);
    expect(estIOS(env({ userAgent: UA.chromeAndroid, platform: 'Linux armv8l', maxTouchPoints: 5 }))).toBe(false);
  });
});

describe('situationDInstallation — l’ordre des cas', () => {
  it('dans l’application installée, il n’y a plus rien à installer', () => {
    expect(situationDInstallation(env({ standalone: true }), avecInvite)).toBe('application');
    expect(situationDInstallation(env({ userAgent: UA.safariIphone, standalone: true }), sansInvite)).toBe(
      'application'
    );
    // Même une messagerie ne l'emporte pas : la fenêtre de l'application est la preuve.
    expect(situationDInstallation(env({ userAgent: UA.whatsappAndroid, standalone: true }), sansInvite)).toBe(
      'application'
    );
  });

  it('une installation faite pendant la session compte comme installée', () => {
    expect(situationDInstallation(env({}), { disponible: false, installe: true })).toBe('installe');
  });

  it('dans une messagerie, on renvoie vers le navigateur, même avec une invite', () => {
    expect(situationDInstallation(env({ userAgent: UA.whatsappAndroid }), avecInvite)).toBe('messagerie');
    expect(
      situationDInstallation(env({ userAgent: UA.messengerIphone, platform: 'iPhone', maxTouchPoints: 5 }), sansInvite)
    ).toBe('messagerie');
  });

  it('avec l’invite du navigateur, un bouton suffit', () => {
    expect(situationDInstallation(env({ userAgent: UA.chromeAndroid }), avecInvite)).toBe('invite');
    expect(situationDInstallation(env({}), avecInvite)).toBe('invite');
  });

  it('sur iPhone et iPad, l’ajout se fait à la main', () => {
    expect(
      situationDInstallation(env({ userAgent: UA.safariIphone, platform: 'iPhone', maxTouchPoints: 5 }), sansInvite)
    ).toBe('ios');
    expect(
      situationDInstallation(env({ userAgent: UA.safariIpad, platform: 'MacIntel', maxTouchPoints: 5 }), sansInvite)
    ).toBe('ios');
  });

  it('sans invite ni iPhone, ce sont les étapes manuelles', () => {
    expect(situationDInstallation(env({ userAgent: UA.firefoxBureau }), sansInvite)).toBe('manuel');
    expect(situationDInstallation(env({ userAgent: UA.chromeAndroid }), sansInvite)).toBe('manuel');
  });
});

describe('lireEnvironnement — ce que la page lit du navigateur', () => {
  it('lit l’agent, la plateforme, le tactile, et le mode installé des deux façons', () => {
    const fenetre = (standaloneMedia: boolean, standaloneIOS?: boolean) =>
      ({
        navigator: { userAgent: UA.safariIphone, platform: 'iPhone', maxTouchPoints: 5, standalone: standaloneIOS },
        matchMedia: (requete: string) => ({ matches: standaloneMedia && requete === '(display-mode: standalone)' })
      }) as unknown as Window;

    expect(lireEnvironnement(fenetre(false))).toEqual({
      userAgent: UA.safariIphone,
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: false
    });
    expect(lireEnvironnement(fenetre(true)).standalone).toBe(true);
    // Safari sur iOS ne connaissait pas `display-mode` avant iOS 16 : il dit `navigator.standalone`.
    expect(lireEnvironnement(fenetre(false, true)).standalone).toBe(true);
  });

  it('sans `matchMedia` (un navigateur ancien), la page ne tombe pas', () => {
    const fenetre = {
      navigator: { userAgent: UA.firefoxBureau, platform: 'Linux x86_64', maxTouchPoints: 0 }
    } as unknown as Window;
    expect(lireEnvironnement(fenetre).standalone).toBe(false);
  });
});
