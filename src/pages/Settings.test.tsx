// @vitest-environment jsdom
import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Settings, CATEGORIES_REGLAGES } from './Settings';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { useComptes } from '@/store/comptes';
import type { Compte } from '@/lib/comptes';
import { APP_LABEL } from '@/version';

describe('Settings — écran des Réglages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre "Ton poste de travail"', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Ton poste de travail/)).toBeInTheDocument();
  });

  it('affiche la section Identité avec le nom actuel', () => {
    renderWithStore(<Settings />, { name: 'Testeur', tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Identité/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Testeur')).toBeInTheDocument();
  });

  it('permet de changer le nom', () => {
    renderWithStore(<Settings />, { name: 'Testeur', tutorielVu: true, pasAPasCombatVu: true });

    const input = screen.getByDisplayValue('Testeur');
    fireEvent.change(input, { target: { value: 'Nouveau Nom' } });

    const saveButton = screen.getByRole('button', { name: /Enregistrer/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    const state = useStore.getState();
    expect(state.name).toBe('Nouveau Nom');
  });

  it("désactive le bouton Enregistrer si le nom n'a pas changé", () => {
    renderWithStore(<Settings />, { name: 'Testeur', tutorielVu: true, pasAPasCombatVu: true });

    const saveButton = screen.getByRole('button', { name: /Enregistrer/i });
    expect(saveButton).toBeDisabled();
  });

  it("affiche le bloc Accessibilité avec l'option Réduire les animations (#277)", () => {
    renderWithStore(<Settings />, { reducedMotion: false, tutorielVu: true, pasAPasCombatVu: true });

    // Le bloc s'appelle **Accessibilité** : « Affichage » n'existe plus (ses deux seuls
    // réglages y vivaient, et un bloc vidé ferait un titre sans réglage).
    const bloc = screen.getByRole('region', { name: 'Accessibilité' });
    expect(within(bloc).getByText(/Réduire les animations/)).toBeInTheDocument();

    const checkbox = within(bloc).getByRole('checkbox', { name: /Réduire les animations/i });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const state = useStore.getState();
    expect(state.reducedMotion).toBe(true);
  });

  it('coche « Raccourcis clavier au combat » par défaut, et la décoche (#189)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    const checkbox = screen.getByRole('checkbox', { name: /Raccourcis clavier au combat/i });
    expect(checkbox).toBeChecked();
    expect(useStore.getState().raccourcisCombat).toBe(true);

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(useStore.getState().raccourcisCombat).toBe(false);
  });

  it("affiche la section Journée d'intégration", () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Journée d.intégration/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revoir la journée d.intégration/i })).toBeInTheDocument();
  });

  it('remet le tutoriel à false au clic sur "Revoir la journée d\'intégration"', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    const button = screen.getByRole('button', { name: /Revoir la journée d.intégration/i });
    fireEvent.click(button);

    const state = useStore.getState();
    expect(state.tutorielVu).toBe(false);
  });

  it('affiche la section Pas-à-pas du combat', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Pas-à-pas du combat/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Revoir le pas-à-pas du combat/i })).toBeInTheDocument();
  });

  it('un seul bouton, et il ouvre le combat guidé (30/10/2026)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    // **Le contrôle mord** : deux boutons pour un seul effet, c'était le doublon — et
    // « Revoir le pas-à-pas » ne faisait rien de visible depuis Réglages.
    expect(screen.queryByRole('button', { name: /Revoir le pas-à-pas du combat/i })).toBeNull();
    const lien = screen.getByRole('link', { name: /Revoir le pas-à-pas du combat/i });
    expect(lien).toHaveAttribute('href', '/battle?tutoriel=1');
    // Le drapeau de la première partie n'est **pas** touché depuis cet écran.
    expect(useStore.getState().pasAPasCombatVu).toBe(true);
  });

  it('mène à la page d’installation depuis Réglages, une seule fois (sinon le module est introuvable une fois installé)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    const liens = screen.getAllByRole('link', { name: /préarmer/i });
    expect(liens).toHaveLength(1);
    expect(liens[0]).toHaveAttribute('href', '/installation');
  });

  it('affiche la section Sauvegarde', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Sauvegarde/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer ma sauvegarde/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restaurer ce texte/i })).toBeInTheDocument();
  });

  it("crée une sauvegarde et l'affiche dans le textarea", async () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    const createButton = screen.getByRole('button', { name: /Créer ma sauvegarde/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Ta sauvegarde apparaîtra ici/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain('bureau-des-planques');
    });
  });

  it('dit que les parties terminées, solo comme à deux, sont gardées sous le compte, sans case à cocher (D-086, D-088, D-105)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/parties terminées sont gardées sous ton compte/i)).toBeInTheDocument();
    // D-086 : une **mention**, pas un consentement par combat — aucune case ne concerne
    // les traces. Les trois cases de l'écran sont des réglages : le mouvement réduit, les
    // raccourcis clavier du combat (#189), et les deux sons du jeu (D-137, #378).
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    for (const nom of [/Réduire les animations/i, /Raccourcis clavier au combat/i, /Sons du jeu/i]) {
      expect(screen.getByRole('checkbox', { name: nom })).toBeInTheDocument();
    }
  });

  it('la case « Sons du jeu » coupe les deux sons et se retient (#378, D-137)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });
    const case_ = screen.getByRole('checkbox', { name: /Sons du jeu/i });
    // Cochée par défaut : D-137 veut que le testeur entende l'Arrivage sans rien régler.
    expect(case_).toBeChecked();
    fireEvent.click(case_);
    expect(useStore.getState().sons).toBe(false);
    expect(case_).not.toBeChecked();
  });

  it('affiche la section Données locales avec le bouton Réinitialiser', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Données locales/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réinitialiser la progression/i })).toBeInTheDocument();
  });

  it("affiche la version de l'application", () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Version/)).toBeInTheDocument();
    expect(screen.getByText(APP_LABEL)).toBeInTheDocument();
  });

  it('mène à la feuille de route depuis la section Version (D-090, D-097)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    // Le libellé seul ne dit pas ce que la version contient : la section Version doit
    // mener à l'écran qui le dit, sinon la note reste invisible depuis le jeu.
    const lien = screen.getByRole('link', { name: /la feuille de route/i });
    expect(lien).toHaveAttribute('href', '/feuille-de-route');
  });
});

/**
 * Le bloc **Compte** de Réglages, et la médaille de la période d'essai (#346, D-130 (3)).
 *
 * La médaille est une **ligne de plus** sous l'état du compte : présente quand la base la
 * donne, absente sinon — et le courriel comme l'état restent lisibles dans les deux cas,
 * puisqu'elle ne remplace rien. L'emplacement est celui de la note de lecture de D-130 (3) :
 * le bloc Compte, tant que le profil n'a pas d'intitulé (#325).
 */
describe('Settings — le compte, et la médaille de la période d’essai (#346)', () => {
  const COMPTE: Compte = {
    id: 'compte-a',
    courriel: 'a@exemple.test',
    etat: 'approuve',
    raison: '',
    administrateur: false,
    medaille_periode_essai: false,
    medaille_periode_essai_le: null,
    created_at: '2026-10-23T10:00:00.000Z'
  };

  /** L'écran lit le store, jamais la base : c'est lui qu'on pose, comme les autres écrans. */
  const poser = (compte: Compte) =>
    useComptes.setState({
      configure: true,
      chargement: false,
      session: { id: compte.id, courriel: compte.courriel, anonyme: false },
      compte,
      erreur: null
    });

  afterEach(() => {
    useComptes.setState({ configure: false, chargement: false, session: null, compte: null, erreur: null });
  });

  it('affiche la médaille quand elle est vraie, sans écraser l’état du compte', () => {
    poser({ ...COMPTE, medaille_periode_essai: true, medaille_periode_essai_le: '2026-11-03T09:00:00.000Z' });
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Médaille de la période d’essai/)).toBeInTheDocument();
    // Ce qui était là reste là, ligne pour ligne : le courriel, et l'état.
    expect(screen.getByText(/a@exemple\.test/)).toBeInTheDocument();
    expect(screen.getByText(/approuvé/)).toBeInTheDocument();
  });

  it('n’affiche rien quand elle est fausse, et garde l’état lisible', () => {
    poser(COMPTE);
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.queryByText(/Médaille de la période d’essai/)).toBeNull();
    expect(screen.getByText(/a@exemple\.test/)).toBeInTheDocument();
    expect(screen.getByText(/approuvé/)).toBeInTheDocument();
  });
});

/**
 * La porte du serveur des testeurs (#317, D-120) — dans **Réglages**.
 *
 * Le comportement est celui du module `@/components/InvitationTesteurs` : vide → rien du
 * tout, renseignée → un seul lien externe. Ici, ce qui est gardé, c'est **l'emplacement** :
 * sans invitation, l'écran ne garde ni titre ni panneau vide ; avec, le testeur trouve le
 * lien depuis Réglages, sans dépendre d'un message qu'il aurait perdu.
 */
describe('Settings — le serveur des testeurs (#317)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sans invitation, ne laisse ni section ni lien Discord', () => {
    vi.stubEnv('VITE_DISCORD_INVITE', '');
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.queryByText(/serveur des testeurs/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /discord/i })).toBeNull();
  });

  it('avec invitation, donne le lien en nouvel onglet', () => {
    vi.stubEnv('VITE_DISCORD_INVITE', 'https://discord.gg/planquex-test');
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    const lien = screen.getByRole('link', { name: /rejoindre le serveur des testeurs/i });
    expect(lien).toHaveAttribute('href', 'https://discord.gg/planquex-test');
    expect(lien).toHaveAttribute('target', '_blank');
    expect(lien).toHaveAttribute('rel', 'noreferrer noopener');
  });
});

/**
 * Les Réglages par catégories (#277).
 *
 * Ce qui est gardé ici, c'est la **forme** : chaque catégorie est rendue, aucune n'est un
 * titre vide, aucun réglage n'apparaît deux fois, et les deux réglages d'accessibilité
 * vivent dans **Accessibilité** (et non dans l'ancien bloc « Affichage »).
 */
describe('Settings — des catégories, pas une liste (#277)', () => {
  const COMPTE: Compte = {
    id: 'compte-a',
    courriel: 'a@exemple.test',
    etat: 'approuve',
    raison: '',
    administrateur: false,
    medaille_periode_essai: false,
    medaille_periode_essai_le: null,
    created_at: '2026-10-23T10:00:00.000Z'
  };

  function monterReglages() {
    useComptes.setState({
      configure: true,
      chargement: false,
      session: { id: COMPTE.id, courriel: COMPTE.courriel, anonyme: false },
      compte: COMPTE,
      erreur: null
    });
    return renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });
  }

  afterEach(() => {
    useComptes.setState({ configure: false, chargement: false, session: null, compte: null, erreur: null });
  });

  it('rend chaque catégorie, dans l’ordre, et aucune n’est un titre vide', () => {
    monterReglages();
    for (const categorie of CATEGORIES_REGLAGES) {
      const bloc = screen.getByRole('region', { name: categorie });
      // Un titre sans réglage ne compte pas : le bloc porte du texte ou un contrôle.
      expect(bloc.textContent?.trim().length, categorie).toBeGreaterThan(20);
    }
    const titres = screen.getAllByRole('heading', { level: 2 }).map((titre) => titre.textContent);
    expect(titres).toEqual([...CATEGORIES_REGLAGES]);
  });

  it('aucun réglage orphelin : chaque bloc est une catégorie connue', () => {
    monterReglages();
    const connues = new Set<string>(CATEGORIES_REGLAGES);
    for (const bloc of screen.getAllByRole('region')) {
      const nom = bloc.getAttribute('aria-labelledby');
      expect(nom, 'bloc sans catégorie').not.toBeNull();
      expect(connues.has(document.getElementById(nom ?? '')?.textContent ?? ''), nom ?? '').toBe(true);
    }
  });

  it('les deux réglages d’accessibilité sont dans Accessibilité, une seule fois chacun (#277)', () => {
    monterReglages();
    const accessibilite = screen.getByRole('region', { name: 'Accessibilité' });

    for (const nom of [/Réduire les animations/i, /Raccourcis clavier au combat/i]) {
      // **Le contrôle mord** : un doublon (le même réglage laissé dans « Affichage » en
      // plus du nouveau bloc) fait tomber `getAllByRole` à deux, et le test échoue.
      const cases = within(accessibilite).getAllByRole('checkbox', { name: nom });
      expect(cases).toHaveLength(1);
      expect(screen.getAllByRole('checkbox', { name: nom })).toHaveLength(1);
    }
    // « Affichage » n'existe plus comme catégorie, et nulle part ailleurs.
    expect(screen.queryByText('Affichage')).toBeNull();
  });
});
