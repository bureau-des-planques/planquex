import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InstallationBanc from './InstallationBanc';
import { PROCEDURES } from '@/pages/Installation';
import type { Environnement } from '@/lib/installation';
import type { CapteurInvite, EtatInvite, ResultatInstallation } from '@/lib/invite-installation';

/**
 * **Le banc d'installation** (#504) — le contenu de la future page, non branchée.
 *
 * Trois coutures suffisent à ne dépendre d'aucun vrai navigateur : l'**environnement**,
 * le **capteur** de l'invite, et les **durées** d'allumage (mises à `0` pour les cas de
 * contenu). L'animation garde un test à elle, pour montrer qu'elle passe bien par un délai.
 *
 * **Le contrôle mord** : sans l'abonnement au capteur, l'invite arrivée après le rendu ne
 * ferait apparaître aucun bouton, et le test « une invite tardive » tombe.
 */

const UA_CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const UA_WHATSAPP_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.21.80';
const UA_WHATSAPP_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.24.21.80';
const UA_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';

const environnement = (champs: Partial<Environnement> = {}): Environnement => ({
  userAgent: UA_CHROME,
  platform: 'Linux x86_64',
  maxTouchPoints: 0,
  standalone: false,
  ...champs
});

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
  return { capteur, installer, recevoirInvite: () => act(() => poser({ ...etat, disponible: true })) };
}

function monter(
  options: {
    env?: Environnement;
    capteur?: CapteurInvite;
    reduireMouvement?: boolean;
    dureeAllumage?: number;
    dureeCourte?: number;
  } = {}
) {
  render(
    <MemoryRouter>
      <InstallationBanc
        environnement={options.env ?? environnement()}
        capteur={options.capteur ?? capteurFactice().capteur}
        reduireMouvement={options.reduireMouvement ?? true}
        dureeAllumage={options.dureeAllumage ?? 0}
        dureeCourte={options.dureeCourte ?? 0}
      />
    </MemoryRouter>
  );
}

/**
 * Monte la page **dans de vraies routes** : `/installation` porte le banc, `/` porte un
 * repère. C'est ce qui permet de prouver la navigation, pas seulement le rendu.
 */
function monterDansLeRoutage(
  options: {
    env?: Environnement;
    reduireMouvement?: boolean;
    dureeAllumage?: number;
    dureeCourte?: number;
  } = {}
) {
  render(
    <MemoryRouter initialEntries={['/installation']}>
      <Routes>
        <Route path="/" element={<h1>Le bureau</h1>} />
        <Route
          path="/installation"
          element={
            <InstallationBanc
              environnement={options.env ?? environnement()}
              capteur={capteurFactice().capteur}
              reduireMouvement={options.reduireMouvement ?? true}
              dureeAllumage={options.dureeAllumage ?? 0}
              dureeCourte={options.dureeCourte ?? 0}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('InstallationBanc — le contenu de la future page (#504)', () => {
  it('montre toujours le lien « Jouer dans le navigateur »', () => {
    monter();
    expect(screen.getByRole('link', { name: /jouer dans le navigateur/i }).getAttribute('href')).toBe('/');
  });

  it('sur Chrome, sans invite, renvoie au menu et ne promet pas de bouton', () => {
    monter();
    expect(screen.getByRole('heading', { level: 2, name: /installer en un geste/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /installer le jeu/i })).toBeNull();
    expect(screen.getByText(/pas encore proposé l’installation/i)).toBeTruthy();
  });

  it('une invite tardive fait apparaître le bouton, et le clic l’utilise', async () => {
    const { capteur, installer, recevoirInvite } = capteurFactice();
    monter({ capteur });
    expect(screen.queryByRole('button', { name: /installer le jeu/i })).toBeNull();

    await recevoirInvite();
    await userEvent.click(screen.getByRole('button', { name: /installer le jeu/i }));

    expect(installer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toMatch(/l’application est installée/i);
  });

  it('une installation refusée le dit sans insister', async () => {
    const { capteur } = capteurFactice({ disponible: true, installe: false }, 'dismissed');
    monter({ capteur });

    await userEvent.click(screen.getByRole('button', { name: /installer le jeu/i }));

    expect(screen.getByRole('status').textContent).toMatch(/installation annulée/i);
  });

  it('sur iPhone, donne les gestes de Safari, sans bouton d’installation', () => {
    monter({ env: environnement({ userAgent: UA_IPHONE, platform: 'iPhone', maxTouchPoints: 5 }) });
    expect(screen.getByRole('heading', { level: 2, name: /l’ajout se fait dans safari/i })).toBeTruthy();
    const liste = screen.getByRole('list', { name: PROCEDURES[0]!.titre });
    expect(liste.tagName).toBe('OL');
    expect(screen.queryByRole('button', { name: /installer le jeu/i })).toBeNull();
  });

  it('dans une application embarquée sur Android, propose le lien intent://', () => {
    monter({ env: environnement({ userAgent: UA_WHATSAPP_ANDROID }) });
    const lien = screen.getByRole('link', { name: /ouvrir dans le navigateur/i });
    expect(lien.getAttribute('href')).toMatch(/^intent:\/\/planquex\.4k7\.org\//);
  });

  it('dans une application embarquée sur iPhone, renvoie vers Safari en texte', () => {
    monter({ env: environnement({ userAgent: UA_WHATSAPP_IPHONE, platform: 'iPhone', maxTouchPoints: 5 }) });
    expect(screen.getByText(/ouvre cette adresse dans safari/i)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /ouvrir dans le navigateur/i })).toBeNull();
  });

  it('déjà installé, s’ouvre tout seul après l’allumage court', () => {
    monterDansLeRoutage({ env: environnement({ standalone: true }) });
    expect(screen.getByRole('heading', { level: 1, name: /le bureau/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /ouvrir le jeu/i })).toBeNull();
  });

  it('déjà installé, dit qu’il ouvre, sans bouton « Ouvrir le jeu »', () => {
    monter({ env: environnement({ standalone: true }) });
    expect(screen.getByRole('heading', { level: 2, name: /tu es déjà dans l’application/i })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/ouverture du jeu en cours/i);
    expect(screen.queryByRole('link', { name: /ouvrir le jeu/i })).toBeNull();
  });

  it('sur un autre navigateur, ne propose que de jouer', () => {
    monter({ env: environnement({ userAgent: UA_FIREFOX }) });
    expect(screen.getByRole('heading', { level: 2, name: /l’installation n’est pas proposée/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /installer le jeu/i })).toBeNull();
  });

  it('le mouvement réduit affiche directement, sans passer par l’allumage', () => {
    monter({ reduireMouvement: true, dureeAllumage: 1800 });
    expect(screen.queryByRole('heading', { name: /le banc s’allume/i })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /installer le jeu/i })).toBeTruthy();
  });

  it('déjà installé, l’allumage court passe avant l’allumage complet', () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <InstallationBanc
          environnement={environnement({ standalone: true })}
          capteur={capteurFactice().capteur}
          reduireMouvement={false}
          dureeAllumage={5000}
          dureeCourte={100}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /le banc s’allume/i })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole('heading', { level: 2, name: /tu es déjà dans l’application/i })).toBeTruthy();
  });

  it('sans mouvement réduit, l’allumage dure avant de proposer l’installation', () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <InstallationBanc
          environnement={environnement()}
          capteur={capteurFactice().capteur}
          reduireMouvement={false}
          dureeAllumage={100}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /le banc s’allume/i })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole('heading', { level: 1, name: /installer le jeu/i })).toBeTruthy();
  });
});
