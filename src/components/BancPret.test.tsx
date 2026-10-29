import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BancPret } from './BancPret';
import type { EtatInvite, Environnement } from '@/lib/installation';
import type { CapteurInvite, ResultatInstallation } from '@/lib/invite-installation';

/**
 * **Le module « Banc prêt »** de `/installation` — le bouton d'installation, selon l'appareil.
 *
 * Trois coutures, pour qu'aucun test n'attende un vrai navigateur : le **capteur** de
 * l'invite (`beforeinstallprompt`), l'**environnement** lu du navigateur, et le
 * **presse-papiers**. L'ordre des situations est tenu par `src/lib/installation.test.ts` ;
 * ici, on tient ce que chacune **affiche** et ce que chaque bouton **fait**.
 *
 * **Le contrôle mord** : si le module n'écoutait pas le capteur, l'invite arrivée après le
 * rendu ne ferait apparaître aucun bouton, et le troisième test tombe.
 */

const LIEN = 'https://planquex.4k7.org/installation';

const UA_CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const UA_WHATSAPP =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.21.80';

const environnement = (champs: Partial<Environnement> = {}): Environnement => ({
  userAgent: UA_CHROME,
  platform: 'Linux x86_64',
  maxTouchPoints: 0,
  standalone: false,
  ...champs
});

/** Un capteur factice : l'invite arrive quand le test le décide, et le choix est écrit d'avance. */
function capteurFactice(
  depart: EtatInvite = { disponible: false, installe: false },
  choix: ResultatInstallation = 'accepted'
) {
  let etat = depart;
  const abonnes = new Set<() => void>();
  const poser = (suivant: EtatInvite) => {
    etat = suivant;
    abonnes.forEach((abonne) => abonne());
  };
  const installer = vi.fn(async () => {
    poser({ disponible: false, installe: choix === 'accepted' });
    return choix;
  });
  const capteur: CapteurInvite = {
    etat: () => etat,
    abonner: (abonne) => {
      abonnes.add(abonne);
      return () => abonnes.delete(abonne);
    },
    installer
  };
  return { capteur, installer, poser, recevoirInvite: () => act(() => poser({ ...etat, disponible: true })) };
}

function monter(
  options: { env?: Environnement; capteur?: CapteurInvite; copier?: (texte: string) => Promise<void> } = {}
) {
  const copier = options.copier ?? vi.fn(() => Promise.resolve());
  render(
    <MemoryRouter>
      <BancPret
        lien={LIEN}
        environnement={options.env ?? environnement()}
        capteur={options.capteur ?? capteurFactice().capteur}
        copier={copier}
      />
    </MemoryRouter>
  );
  return { copier };
}

describe('BancPret — le bouton d’installation, selon l’appareil', () => {
  it('se présente comme le module « Banc prêt »', () => {
    monter();
    expect(screen.getByRole('region', { name: 'Banc prêt' })).toBeTruthy();
  });

  it('sans invite, renvoie vers les étapes du menu, sans bouton d’installation', () => {
    monter();
    expect(screen.getByRole('heading', { level: 2, name: /depuis le menu du navigateur/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /installer le jeu/i })).toBeNull();
  });

  it('une invite arrivée après le rendu fait apparaître le bouton', async () => {
    const { capteur, recevoirInvite } = capteurFactice();
    monter({ capteur });
    expect(screen.queryByRole('button', { name: /installer le jeu/i })).toBeNull();
    await recevoirInvite();
    expect(screen.getByRole('button', { name: /installer le jeu/i })).toBeTruthy();
  });

  it('au clic, montre l’invite du navigateur ; acceptée, dit où trouver l’icône', async () => {
    const { capteur, installer } = capteurFactice({ disponible: true, installe: false }, 'accepted');
    monter({ capteur });

    await userEvent.click(screen.getByRole('button', { name: /installer le jeu/i }));

    expect(installer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 2, name: /c’est installé/i })).toBeTruthy();
    expect(screen.getByText(/écran d’accueil/i)).toBeTruthy();
  });

  it('pendant que la fenêtre du navigateur est ouverte, demande de confirmer, sans dire « pas d’installation »', async () => {
    let repondre: (choix: ResultatInstallation) => void = () => {};
    const { capteur, poser } = capteurFactice({ disponible: true, installe: false });
    // Comme le vrai capteur : l'invite est consommée **avant** la réponse du navigateur.
    capteur.installer = vi.fn(() => {
      poser({ disponible: false, installe: false });
      return new Promise<ResultatInstallation>((resoudre) => {
        repondre = resoudre;
      });
    });
    monter({ capteur });

    await userEvent.click(screen.getByRole('button', { name: /installer le jeu/i }));

    expect(screen.getByRole('heading', { level: 2, name: /confirme dans la fenêtre du navigateur/i })).toBeTruthy();
    expect(screen.queryByText(/ne propose pas d’installation/i)).toBeNull();
    await act(async () => repondre('dismissed'));
    expect(screen.getByRole('status').textContent).toMatch(/installation annulée/i);
  });

  it('refusée, le dit sans insister, et renvoie vers le menu du navigateur', async () => {
    const { capteur } = capteurFactice({ disponible: true, installe: false }, 'dismissed');
    monter({ capteur });

    await userEvent.click(screen.getByRole('button', { name: /installer le jeu/i }));

    expect(screen.getByRole('status').textContent).toMatch(/installation annulée/i);
    expect(screen.queryByRole('button', { name: /installer le jeu/i })).toBeNull();
  });

  it('sur iPhone, renvoie vers Safari et prévient que l’icône ne partage pas les données', () => {
    monter({ env: environnement({ userAgent: UA_IPHONE, platform: 'iPhone', maxTouchPoints: 5 }) });
    expect(screen.getByRole('heading', { level: 2, name: /iphone et ipad/i })).toBeTruthy();
    expect(screen.getByText(/ne partage pas les données de Safari/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /installer le jeu/i })).toBeNull();
  });

  it('dans l’application installée, il n’y a plus rien à installer', () => {
    const { capteur } = capteurFactice({ disponible: true, installe: false });
    monter({ env: environnement({ standalone: true }), capteur });
    expect(screen.getByRole('heading', { level: 2, name: /déjà dans l’application/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /installer le jeu/i })).toBeNull();
  });

  it('dans une messagerie, propose de copier le lien, et dit si la copie a marché', async () => {
    const { copier } = monter({ env: environnement({ userAgent: UA_WHATSAPP }) });
    expect(screen.getByRole('heading', { level: 2, name: /ouvre ce lien dans ton navigateur/i })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /copier le lien/i }));

    expect(copier).toHaveBeenCalledWith(LIEN);
    expect(screen.getByRole('status').textContent).toMatch(/lien copié/i);
  });

  it('une copie refusée par le navigateur donne l’adresse à recopier', async () => {
    monter({
      env: environnement({ userAgent: UA_WHATSAPP }),
      copier: vi.fn(() => Promise.reject(new Error('NotAllowedError')))
    });

    await userEvent.click(screen.getByRole('button', { name: /copier le lien/i }));

    expect(screen.getByRole('status').textContent).toMatch(/copie impossible/i);
    expect(screen.getByRole('status').textContent).toContain(LIEN);
  });
});
