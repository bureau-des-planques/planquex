import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { creerCapteurInvite } from '@/lib/invite-installation';

/**
 * **Le capteur de l'invite d'installation** (`beforeinstallprompt`).
 *
 * Chromium envoie l'invite **une fois**, souvent avant que React ait monté le moindre
 * composant : le capteur l'écoute dès `main.tsx`, la garde, et la rejoue au clic. Ces tests
 * tiennent quatre règles, et chacune peut échouer :
 *
 * 1. **l'invite est gardée, et le bandeau du navigateur est retenu** (`preventDefault`) : c'est
 *    le bouton du jeu qui la montre, pas une barre surgie au chargement ;
 * 2. **elle ne sert qu'une fois** : après `prompt()`, Chromium la refuse ; le capteur la
 *    rend indisponible, qu'elle soit acceptée ou non ;
 * 3. **sans invite, `installer` ne fait rien** et le dit (`indisponible`) ;
 * 4. **`appinstalled` marque l'installation**, même faite depuis le menu du navigateur.
 *
 * La cible est un `EventTarget` nu : aucun DOM, aucun navigateur.
 */

type Choix = 'accepted' | 'dismissed';

/** Une invite factice, au contrat de `BeforeInstallPromptEvent`. */
function invite(choix: Choix) {
  const evenement = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: Choix; platform: string }>;
  };
  evenement.prompt = vi.fn(() => Promise.resolve());
  evenement.userChoice = Promise.resolve({ outcome: choix, platform: 'web' });
  return evenement;
}

describe('creerCapteurInvite — l’invite gardée pour le bouton du jeu', () => {
  it('sans invite, rien n’est disponible et installer le dit', async () => {
    const capteur = creerCapteurInvite(new EventTarget());
    expect(capteur.etat()).toEqual({ disponible: false, installe: false });
    expect(await capteur.installer()).toBe('indisponible');
  });

  it('garde l’invite, retient le bandeau du navigateur, et prévient les abonnés', () => {
    const cible = new EventTarget();
    const capteur = creerCapteurInvite(cible);
    const abonne = vi.fn();
    capteur.abonner(abonne);

    const evenement = invite('accepted');
    cible.dispatchEvent(evenement);

    expect(evenement.defaultPrevented).toBe(true);
    expect(capteur.etat().disponible).toBe(true);
    expect(abonne).toHaveBeenCalledTimes(1);
  });

  it('au clic, montre l’invite ; acceptée, le jeu est installé et l’invite est consommée', async () => {
    const cible = new EventTarget();
    const capteur = creerCapteurInvite(cible);
    const evenement = invite('accepted');
    cible.dispatchEvent(evenement);

    expect(await capteur.installer()).toBe('accepted');
    expect(evenement.prompt).toHaveBeenCalledTimes(1);
    expect(capteur.etat()).toEqual({ disponible: false, installe: true });
    // Une seconde demande ne rejoue pas l'invite : Chromium la refuserait.
    expect(await capteur.installer()).toBe('indisponible');
    expect(evenement.prompt).toHaveBeenCalledTimes(1);
  });

  it('refusée, l’invite est consommée aussi, et rien n’est installé', async () => {
    const cible = new EventTarget();
    const capteur = creerCapteurInvite(cible);
    cible.dispatchEvent(invite('dismissed'));

    expect(await capteur.installer()).toBe('dismissed');
    expect(capteur.etat()).toEqual({ disponible: false, installe: false });
  });

  it('une invite qui échoue au clic ne fait pas tomber la page', async () => {
    const cible = new EventTarget();
    const capteur = creerCapteurInvite(cible);
    const evenement = invite('accepted');
    evenement.prompt = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    cible.dispatchEvent(evenement);

    expect(await capteur.installer()).toBe('indisponible');
    expect(capteur.etat().disponible).toBe(false);
  });

  it('`appinstalled` marque l’installation, même faite depuis le menu du navigateur', () => {
    const cible = new EventTarget();
    const capteur = creerCapteurInvite(cible);
    cible.dispatchEvent(invite('accepted'));
    cible.dispatchEvent(new Event('appinstalled'));

    expect(capteur.etat()).toEqual({ disponible: false, installe: true });
  });

  it('l’état ne change de référence que s’il change (le contrat de useSyncExternalStore)', () => {
    const cible = new EventTarget();
    const capteur = creerCapteurInvite(cible);
    const avant = capteur.etat();
    expect(capteur.etat()).toBe(avant);
    cible.dispatchEvent(invite('accepted'));
    expect(capteur.etat()).not.toBe(avant);
  });

  it('un abonné qui se désabonne n’est plus prévenu', () => {
    const cible = new EventTarget();
    const capteur = creerCapteurInvite(cible);
    const abonne = vi.fn();
    const desabonner = capteur.abonner(abonne);
    desabonner();
    cible.dispatchEvent(invite('accepted'));
    expect(abonne).toHaveBeenCalledTimes(0);
  });
});

/**
 * **Le branchement** : sans l'appel dans `main.tsx`, `capteurInvite()` rend le capteur inerte,
 * le bouton n'apparaît plus jamais en production — et tous les tests d'écran resteraient
 * verts, puisqu'ils injectent un capteur factice. Ce garde le tient, et il mord.
 */
describe('main.tsx pose le capteur avant le rendu', () => {
  it('appelle capterInviteInstallation(window) avant createRoot', () => {
    const main = readFileSync(join(process.cwd(), 'src/main.tsx'), 'utf8');
    expect(captureAvantRendu(main), 'le capteur doit être posé avant `createRoot(`').toBe(true);
  });

  it('le contrôle mord : un appel absent, commenté ou posé après le rendu est refusé', () => {
    expect(captureAvantRendu('createRoot(container).render(<App />);')).toBe(false);
    expect(captureAvantRendu('// capterInviteInstallation(window);\ncreateRoot(container).render(<App />);')).toBe(
      false
    );
    expect(captureAvantRendu('createRoot(container).render(<App />);\ncapterInviteInstallation(window);')).toBe(false);
    expect(captureAvantRendu('capterInviteInstallation(window);\ncreateRoot(container).render(<App />);')).toBe(true);
  });
});

/** L'appel est-il une vraie ligne de code (pas un commentaire), placée avant `createRoot(` ? */
function captureAvantRendu(source: string): boolean {
  const lignes = source.split('\n').filter((ligne) => !ligne.trim().startsWith('//'));
  const code = lignes.join('\n');
  const appel = code.indexOf('capterInviteInstallation(window)');
  const rendu = code.indexOf('createRoot(');
  return appel >= 0 && rendu >= 0 && appel < rendu;
}
