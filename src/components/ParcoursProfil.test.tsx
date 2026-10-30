// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParcoursProfil } from './ParcoursProfil';
import { tirerIntitule } from '@/game/intitule';
import { useProfil } from '@/store/profil';
import type { Profil } from '@/lib/profil';

/**
 * Le parcours de première connexion à l'écran (#325, D-148) : trois étapes dans l'ordre, un
 * intitulé tiré au sort (le même tirage que le moteur, seedé), une relance possible une fois,
 * et plus de relance ensuite. Les gestes réseau sont remplacés par des gestes qui posent
 * l'état du store, comme le fait la base : le test parle au store, pas à Supabase.
 *
 * **Le contrôle mord** : sans la borne d'une relance, le bouton « Relancer une fois » resterait
 * affiché après la relance — le test « une seule relance » échoue alors.
 */
const UID = 'compte-a';

/** Pose un champ du profil, sans toucher aux autres (comme la relecture de la base). */
function geste(champs: Partial<Profil>) {
  const actuel = useProfil.getState().profil ?? {
    id: UID,
    pseudo: 'Anaïs',
    service: null,
    intitule: null,
    intitule_relances: 0
  };
  useProfil.setState({ profil: { ...actuel, ...champs } as Profil });
}

function poserStore(profil: Profil | null) {
  useProfil.setState({
    profil,
    charge: true,
    chargement: false,
    erreur: null,
    creerPseudo: vi.fn(async (_uid: string, pseudo: string) => {
      geste({ pseudo });
      return null;
    }),
    choisirService: vi.fn(async (_uid: string, service: Profil['service']) => {
      geste({ service });
      return null;
    }),
    relancer: vi.fn(async () => {
      geste({ intitule_relances: (useProfil.getState().profil?.intitule_relances ?? 0) + 1 });
      return null;
    }),
    valider: vi.fn(async (_uid: string, intitule: string) => {
      geste({ intitule });
      return null;
    })
  });
}

beforeEach(() => poserStore(null));
afterEach(cleanup);

describe('le parcours, à l’écran (#325, D-148)', () => {
  it('commence par le pseudo, à l’étape 1 sur 3', () => {
    render(<ParcoursProfil uid={UID} />);
    expect(screen.getByText('Étape 1 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Ton pseudo/ })).toBeInTheDocument();
  });

  it('fait les trois étapes dans l’ordre, et tire l’intitulé du compte', async () => {
    const { container } = render(<ParcoursProfil uid={UID} />);

    fireEvent.change(screen.getByLabelText(/Pseudo/), { target: { value: 'Anaïs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByRole('heading', { name: /Ton service/ })).toBeInTheDocument();
    expect(container.querySelector('[data-etape]')).toHaveAttribute('data-etape', 'service');

    fireEvent.click(screen.getByRole('radio', { name: /^2e/ }));
    fireEvent.click(screen.getByRole('button', { name: /Valider mon service/ }));
    expect(await screen.findByRole('heading', { name: /Ton intitulé/ })).toBeInTheDocument();
    expect(useProfil.getState().profil?.service).toBe('2e');

    // L'intitulé affiché est celui du tirage seedé, et l'aperçu suit le gabarit du ticket.
    const tire = tirerIntitule(UID, 0);
    expect(screen.getByTestId('intitule-tire')).toHaveTextContent(tire);
    expect(screen.getByTestId('apercu-profil')).toHaveTextContent(`Anaïs / planqué du 2e — ${tire}`);
  });

  it('dit ce que le service engage — et qu’il ne change aucune règle (D-135)', async () => {
    poserStore({ id: UID, pseudo: 'Anaïs', service: null, intitule: null, intitule_relances: 0 });
    render(<ParcoursProfil uid={UID} />);

    // Chaque service porte sa phrase : le choix ne se fait plus sur un mot nu.
    expect(screen.getByText('L’étage dont personne ne prononce le nom.')).toBeInTheDocument();
    // Et l'aide dit la vérité : décoratif (D-135), figé quand même (D-148).
    expect(screen.getByText(/ne change aucune règle du jeu/)).toBeInTheDocument();
    expect(screen.getByText(/figé dès que tu le valides/)).toBeInTheDocument();
  });

  it('porte le focus sur le titre de l’étape suivante (un lecteur d’écran l’annonce)', async () => {
    const { container } = render(<ParcoursProfil uid={UID} />);
    expect(document.activeElement).toBe(document.body);

    fireEvent.change(screen.getByLabelText(/Pseudo/), { target: { value: 'Anaïs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    const titre = await screen.findByRole('heading', { name: /Ton service/ });
    expect(document.activeElement).toBe(titre);
    expect(container.querySelector('[data-etape]')).toHaveAttribute('data-etape', 'service');
    // Le contrôle mord : sans le `useEffect` de focus, l'actif reste `<body>`.
    expect(document.activeElement).not.toBe(document.body);
  });

  it('relance l’intitulé une fois, puis plus de relance', async () => {
    poserStore({ id: UID, pseudo: 'Anaïs', service: '3e', intitule: null, intitule_relances: 0 });
    render(<ParcoursProfil uid={UID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Essayer un autre titre' }));
    await waitFor(() => expect(useProfil.getState().profil?.intitule_relances).toBe(1));
    // Le contrôle mord : après la relance, le bouton n'existe plus.
    expect(screen.queryByRole('button', { name: 'Essayer un autre titre' })).toBeNull();
    expect(screen.getByTestId('intitule-tire')).toHaveTextContent(tirerIntitule(UID, 1));
  });

  it('ne propose pas une relance qui rendrait le même titre (revue du 30/10/2026)', () => {
    // Le tirage est déterministe : pour ce compte, les deux tirages sont identiques. Proposer
    // la relance consommerait l'unique essai pour rien ; l'écran le dit au lieu de le cacher.
    expect(tirerIntitule('compte-0', 0)).toBe(tirerIntitule('compte-0', 1));
    poserStore({ id: 'compte-0', pseudo: 'Anaïs', service: '2e', intitule: null, intitule_relances: 0 });
    render(<ParcoursProfil uid="compte-0" />);

    expect(screen.queryByRole('button', { name: 'Essayer un autre titre' })).toBeNull();
    expect(screen.getByText(/le sort s’acharne/i)).toBeInTheDocument();
    // Le contrôle mord : sur un compte où la relance change le titre, le bouton est là.
    cleanup();
    poserStore({ id: UID, pseudo: 'Anaïs', service: '2e', intitule: null, intitule_relances: 0 });
    render(<ParcoursProfil uid={UID} />);
    expect(screen.getByRole('button', { name: 'Essayer un autre titre' })).toBeInTheDocument();
  });

  it('l’intitulé se garde aussi par Entrée : l’étape 3 est un formulaire', async () => {
    poserStore({ id: UID, pseudo: 'Anaïs', service: '1er', intitule: null, intitule_relances: 0 });
    const { container } = render(<ParcoursProfil uid={UID} />);
    const tire = screen.getByTestId('intitule-tire').textContent ?? '';

    // `requestSubmit` est ce que fait Entrée dans un formulaire : c'est le geste du clavier.
    const formulaire = container.querySelector('[data-etape="intitule"] form');
    expect(formulaire).not.toBeNull();
    fireEvent.submit(formulaire!);

    await waitFor(() => expect(useProfil.getState().profil?.intitule).toBe(tire));
  });

  it('garder l’intitulé l’enregistre et le fige (le parcours est fini)', async () => {
    poserStore({ id: UID, pseudo: 'Anaïs', service: '1er', intitule: null, intitule_relances: 0 });
    const { container } = render(<ParcoursProfil uid={UID} />);
    const tire = screen.getByTestId('intitule-tire').textContent ?? '';

    fireEvent.click(screen.getByRole('button', { name: 'Garder celui-là' }));
    await waitFor(() => expect(useProfil.getState().profil?.intitule).toBe(tire));
    expect(container.firstChild).toBeNull();
  });
});
