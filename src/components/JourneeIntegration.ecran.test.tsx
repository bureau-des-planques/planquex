// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JourneeIntegration } from './JourneeIntegration';
import {
  ETAPES_JOURNEE,
  LOCUTEUR_JOURNEE,
  MOTS_CIBLE_JOURNEE,
  MOTS_MAX_JOURNEE,
  MOTS_MAX_REPLIQUE,
  MOTS_MIN_JOURNEE
} from './journee-etapes';
import { marquerGeste, oublierGestes } from './journee-gestes';
import { CIBLE_DE_GESTE, cibleJournee } from './journee-cible';
import { allerAEtape, etapeJournee, rejouerJournee, remettreJourneeAuDebut } from './journee-etape';
import { rendreApplication, setupTestStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { simulerArrivage } from '@/test/arrivageDeTest';
import { artUrl } from '@/art';

const STYLES_JOURNEE = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

/**
 * La « Journée d'intégration » **jouée** (30/10/2026) — le rendu, pas la source.
 *
 * Ce que `journee-etapes.test.ts` ne peut pas prouver : que les étapes **s'enchaînent**
 * dans le panneau, que la dernière referme la Journée, et que le saut mène au même état
 * que la fin. Les trois se voient ici, dans un panneau réel.
 *
 * **La garde de #666** : le test rend l'application avec ses **vraies routes** — aucun
 * `path="*"` de test qui absorberait un chemin inconnu — et vérifie, à chaque étape, que
 * le contenu du panneau, la cible qu'il désigne et l'écran affiché disent la même chose.
 * Plusieurs étapes peuvent partager une route : le test ne déduit jamais l'étape d'un
 * chemin, il demande à l'étape quel écran elle décrit (D-162 (4), D-181 (5)).
 */

/** Le chemin d'une cible, sans sa requête (D-162 (4)). */
function cheminDe(cible: string): string {
  return cible.split('?')[0];
}

/**
 * Le chemin **du routeur**, pas celui de `window` : `MemoryRouter` ne touche pas à la barre
 * d'adresse du navigateur. Ce composant de test le publie dans un nœud que les assertions
 * lisent ; il ne crée aucune route.
 */
function FilDuChemin() {
  const { pathname } = useLocation();
  return (
    <span data-testid="chemin-courant" hidden>
      {pathname}
    </span>
  );
}

function cheminCourant(): string {
  return document.querySelector('[data-testid="chemin-courant"]')?.textContent ?? '';
}

/**
 * L'écran attendu pour chaque étape, **par son titre** — pas par son index ni par sa route.
 *
 * C'est le contenu qui situe l'écran : une étape qui ouvrirait `/` en s'appelant « La
 * Collection et le Deck » tombe ici, même si sa `cible` a été changée en même temps. Le
 * test ne déduit donc jamais l'étape d'une route : il ne déclare qu'une entrée par
 * **titre**, et chaque titre porte son écran. Deux étapes pourraient partager une route
 * sans qu'il faille en changer une ligne.
 */
const ECRAN_DE_L_ETAPE = new Map<string, { chemin: string; present: () => boolean }>([
  ['L’Arrivage', { chemin: '/', present: () => document.querySelector('.page.home') !== null }],
  ['La Collection et le Deck', { chemin: '/deck', present: () => document.querySelector('.page.deck') !== null }],
  ['Le combat', { chemin: '/battle', present: () => document.querySelector('.page.battle') !== null }],
  ['Tes données', { chemin: '/settings', present: () => document.querySelector('.page.settings') !== null }],
  [
    'Le comité',
    { chemin: '/comite', present: () => screen.queryByRole('heading', { name: 'Le comité de pilotage' }) !== null }
  ]
]);

/**
 * Le contrôle lui-même : l'étape courante (lue dans son module), son titre dans le panneau
 * quand il est visible, sa cible déclarée, l'écran réellement affiché et l'élément désigné.
 *
 * `waitFor` porte l'attente : un geste validé change l'étape et la route en deux temps, et les
 * écrans sont chargés à la demande (#478). Le message nomme l'étape, pas le numéro de ligne.
 */
async function verifierCorrespondance() {
  await waitFor(
    () => {
      const index = Math.min(etapeJournee(), ETAPES_JOURNEE.length - 1);
      const etape = ETAPES_JOURNEE[index];
      const attendu = ECRAN_DE_L_ETAPE.get(etape.titre);
      if (!attendu) throw new Error(`aucun écran déclaré pour « ${etape.titre} »`);

      // Le panneau, quand il est visible (il s'efface sur /battle, D-162 (3)), dit l'étape
      // courante et son rang. Le contenu et le compteur viennent du même état.
      const panneau = document.querySelector('[data-journee-panneau]');
      if (panneau) {
        expect(panneau).toHaveTextContent(etape.titre);
        expect(panneau).toHaveTextContent(`Journée d’intégration — étape ${index + 1} sur ${ETAPES_JOURNEE.length}`);
      }

      // La cible que l'étape déclare et l'écran que l'application rend ne peuvent pas diverger.
      expect(cheminDe(etape.cible), `la cible de « ${etape.titre} »`).toBe(attendu.chemin);
      expect(cheminCourant(), `l’écran de « ${etape.titre} »`).toBe(attendu.chemin);
      expect(attendu.present(), `le contenu de ${attendu.chemin}`).toBe(true);

      // Le halo désigne exactement l'élément du geste de l'étape, et rien d'autre.
      const cible = etape.geste ? (CIBLE_DE_GESTE[etape.geste] ?? null) : null;
      if (cible) {
        expect(cibleJournee(), `la cible posée pour « ${etape.titre} »`).toBe(cible);
        expect(
          document.querySelector(`[data-journee-cible="${cible}"]`),
          `l’élément désigné de « ${etape.titre} »`
        ).not.toBeNull();
      } else {
        expect(cibleJournee(), `aucune cible pour « ${etape.titre} »`).toBeNull();
        expect(document.querySelector('[data-journee-cible]')).toBeNull();
      }
    },
    { timeout: 5_000 }
  );
}

/** Attend que la Journée soit à l'étape `n` (0 = la première) : le geste validé la fait avancer. */
async function attendreEtape(n: number) {
  await waitFor(() => expect(etapeJournee()).toBe(n), { timeout: 5_000 });
}

function monterAvecGestesFaits() {
  oublierGestes();
  marquerGeste('sauvegarde');
  marquerGeste('combat');
  remettreJourneeAuDebut();
}

async function monter() {
  monterAvecGestesFaits();
  const resultat = await rendreApplication({
    chemin: '/',
    storeState: {
      tutorielVu: false,
      pasAPasCombatVu: true,
      packsOpened: 1,
      deck: ['atelier-joueur-de-flute']
    },
    extra: <FilDuChemin />
  });
  await screen.findByRole('region', { name: /Journée d’intégration/ });
  return resultat;
}

/**
 * Le panneau seul, à une étape et sur l'écran qu'elle décrit. Sert aux propriétés du
 * panneau (l'appel à participer) qui n'ont pas besoin du parcours complet ; le parcours,
 * lui, passe par l'application réelle.
 */
function monterPanneau(index: number) {
  // Le mouvement n'est pas réduit : la réplique s'écrit, et le tap a quelque chose à faire.
  setupTestStore({
    tutorielVu: false,
    pasAPasCombatVu: true,
    packsOpened: 1,
    deck: ['atelier-joueur-de-flute'],
    reducedMotion: false
  });
  monterAvecGestesFaits();
  allerAEtape(index);
  return render(
    <MemoryRouter initialEntries={[ETAPES_JOURNEE[index].cible]}>
      <JourneeIntegration />
    </MemoryRouter>
  );
}

/** Le bouton qui mène au geste de l'étape courante. */
function action(nom: RegExp) {
  return screen.getByRole('button', { name: nom });
}

/**
 * Le retour arrière du navigateur, hors du DOM : la garde du panneau bloque les clics
 * (D-160 (3)), mais un vrai retour n'est pas un clic dans la page. L'événement l'imite.
 */
function RetourDuNavigateur() {
  const navigate = useNavigate();
  useEffect(() => {
    const retour = (_: Event) => navigate(-1);
    window.addEventListener('test-retour', retour);
    return () => window.removeEventListener('test-retour', retour);
  }, [navigate]);
  return null;
}

describe('la Journée d’intégration se joue (D-160)', () => {
  it('pas de bouton « Suivant » : le geste validé fait avancer l’étape (D-196)', async () => {
    setupTestStore({ tutorielVu: false, pasAPasCombatVu: true, packsOpened: 0, deck: [] });
    remettreJourneeAuDebut();
    render(
      <MemoryRouter initialEntries={['/']}>
        <JourneeIntegration />
      </MemoryRouter>
    );

    // **Le contrôle mord** : aucun bouton « Suivant » n'est rendu, à aucune étape.
    expect(screen.queryByRole('button', { name: /^Suivant$/i })).toBeNull();
    // **Le geste pas fait ne fait pas avancer** : l'étape reste l'Arrivage.
    expect(etapeJournee()).toBe(0);

    // L'Arrivage passe par le serveur (#651) : le faux serveur rend les cartes.
    simulerArrivage();
    await act(async () => {
      await useStore.getState().openPack();
    });
    await waitFor(() => expect(etapeJournee()).toBe(1));
    expect(screen.getByRole('heading', { name: /La Collection et le Deck/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Suivant$/i })).toBeNull();

    act(() => {
      useStore.getState().setDeck(['atelier-joueur-de-flute']);
    });
    await waitFor(() => expect(etapeJournee()).toBe(2));
    // Le combat s'efface sur `/battle` (D-162 (3)) : c'est la fin de la partie qui le valide.
  });

  it('un geste déjà fait à l’arrivée n’enchaîne rien (« Revoir » ne traverse pas la Journée)', async () => {
    // Tous les gestes sont faits à l'arrivée : la reprise reste à l'étape 1, et aucune
    // transition ne se produit. **Le contrôle mord** : sans `passeAuGeste`, l'étape enchaînerait.
    setupTestStore({
      tutorielVu: false,
      pasAPasCombatVu: true,
      packsOpened: 1,
      deck: ['atelier-joueur-de-flute']
    });
    oublierGestes();
    marquerGeste('combat');
    marquerGeste('sauvegarde');
    remettreJourneeAuDebut();
    render(
      <MemoryRouter initialEntries={['/']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(etapeJournee()).toBe(0);
  });

  it('un geste validé pendant la scène d’Arrivage attend qu’elle se range (D-196)', async () => {
    setupTestStore({ tutorielVu: false, pasAPasCombatVu: true, packsOpened: 0, deck: [] });
    oublierGestes();
    remettreJourneeAuDebut();
    render(
      <MemoryRouter initialEntries={['/']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    const scene = document.createElement('div');
    scene.className = 'ouverture';
    document.body.appendChild(scene);
    try {
      // **Le contrôle mord** : sans l'attente, l'écran suivant couperait la scène en cours.
      act(() => {
        useStore.setState({ packsOpened: 1 });
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(etapeJournee()).toBe(0);
      act(() => scene.remove());
      await waitFor(() => expect(etapeJournee()).toBe(1));
    } finally {
      scene.remove();
    }
  });

  it('le volet des Decks proposés vient dans la fenêtre, et « Charger » s’y atteint (#679)', async () => {
    // **L'ordre compte** : ce test passe avant le parcours complet, donc le morceau
    // `/deck` est encore froid. Réchauffé, il se monterait avant l'effet de la Journée et
    // le défaut (cible arrivée après l'effet) ne se verrait plus.
    simulerArrivage();
    oublierGestes();
    remettreJourneeAuDebut();
    await rendreApplication({
      chemin: '/',
      storeState: { tutorielVu: false, pasAPasCombatVu: true, packsOpened: 0, deck: [] },
      extra: <FilDuChemin />
    });
    await screen.findByRole('region', { name: /Journée d’intégration/ });
    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

    // Étape 1 faite : le geste fait ouvrir `/deck` seul. La Journée et le Deck sont deux
    // morceaux paresseux, le volet peut donc apparaître **après** l'effet de la Journée.
    await userEvent.click(action(/Ouvrir un Arrivage/i));
    await screen.findByRole('dialog');
    scroll.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Ranger dans la Collection/i }));
    await attendreEtape(1);
    await verifierCorrespondance();

    // **Le conteneur, pas le bouton** : la cible est le `<details>` des Decks proposés.
    const volet = document.querySelector('[data-journee-cible="decks-proposes"]');
    expect(volet).toBeInstanceOf(HTMLDetailsElement);
    expect(volet).toHaveAttribute('data-journee-cible', 'decks-proposes');
    expect(volet).toHaveAttribute('open');
    // Il a été **amené** sous le panneau (jsdom ne défile pas : on lit la doublure).
    await waitFor(() => expect(scroll.mock.contexts).toContain(volet));
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });

    // Le contrôle d'action est **dans** le volet, et c'est le volet qui porte la cible.
    const charger = within(volet as HTMLElement).getAllByRole('button', { name: 'Charger' })[0];
    expect(charger).not.toHaveAttribute('data-journee-cible');
    // **La garde laisse passer le geste** (D-160 (3)) : sans cette exception, le clic
    // n'arriverait pas, le Deck resterait vide et l'étape ne suivrait pas.
    await userEvent.click(charger);
    await waitFor(() => expect(useStore.getState().deck.length).toBeGreaterThan(0));
    await attendreEtape(2);

    // Étape, route et cible n'ont pas divergé pendant le geste.
    await verifierCorrespondance();
  });

  it('chaque étape ouvre l’écran qu’elle décrit, et le geste se fait sur cet écran', async () => {
    simulerArrivage();
    oublierGestes();
    remettreJourneeAuDebut();
    await rendreApplication({
      chemin: '/',
      storeState: { tutorielVu: false, pasAPasCombatVu: true, packsOpened: 0, deck: [] },
      extra: <FilDuChemin />
    });
    await screen.findByRole('region', { name: /Journée d’intégration/ });

    // Étape 1 — L'Arrivage, sur l'accueil, avec le bouton d'Arrivage désigné.
    await verifierCorrespondance();
    const tete = document.querySelector('.journee__portrait');
    expect(tete).not.toBeNull();
    await userEvent.click(action(/Ouvrir un Arrivage/i));
    await screen.findByRole('dialog');
    // Le geste se range dans la scène : l'étape 2 s'ouvre seule, une fois la scène fermée.
    await userEvent.click(screen.getByRole('button', { name: /Ranger dans la Collection/i }));
    await attendreEtape(1);

    // Étape 2 — La Collection et le Deck, sur /deck, avec le volet des Decks proposés.
    await verifierCorrespondance();
    expect(document.querySelector('.journee__portrait')).toBe(tete);
    await userEvent.click(screen.getAllByRole('button', { name: 'Charger' })[0]);
    await attendreEtape(2);

    // Étape 3 — Le combat, sur /battle : le panneau s'efface, le pas-à-pas parle seul.
    await verifierCorrespondance();
    expect(document.querySelector('.journee__portrait')).toBe(tete);
    expect(document.querySelector('.journee__parole')).toBeNull();
    const passer = screen.queryByRole('button', { name: /Passer le pas-à-pas/i });
    if (passer) await userEvent.click(passer);
    await userEvent.click(screen.getByRole('button', { name: /Redémarrage à froid/i }));
    // La scène de fin valide le geste ; sa fermeture ouvre l'étape 4 (Réglages).
    await userEvent.click(await screen.findByRole('button', { name: /^Fermer$/ }));
    await attendreEtape(3);

    // Étape 4 — Tes données, sur /settings, avec « Créer ma sauvegarde » désigné.
    await verifierCorrespondance();
    await userEvent.click(screen.getByRole('button', { name: /Créer ma sauvegarde/i }));
    await attendreEtape(4);

    // Étape 5 — Le comité, sur /comite : la dernière étape ne désigne aucun halo.
    await verifierCorrespondance();
    // **L'arrivée ne termine pas la Journée** (#685) : la réplique finale se lit avant
    // que la sortie explicite ne soit choisie.
    expect(useStore.getState().tutorielVu).toBe(false);

    // La sortie explicite referme la Journée sur l'écran qu'elle vient d'ouvrir.
    await userEvent.click(screen.getByRole('button', { name: /Relire la Journée plus tard/i }));
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(document.querySelector('[data-journee-panneau]')).toBeNull();
    expect(document.querySelector('.journee__portrait')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Le comité de pilotage' })).toBeInTheDocument();
  });

  it('la dernière étape reste visible au Comité, et seule une clôture explicite la termine (#685)', async () => {
    // **Le défaut reproduit** : l'étape 5 (le comité) est courante mais le panneau est monté
    // hors de son écran — une pause suivie d'une navigation, ou une reprise, laisse la
    // visite sur une route qui n'est pas une étape (ici `/attente`) ; son bouton
    // « Voir le comité » menait à `/comite` **en terminant** la Journée, si bien que le
    // testeur arrivait sur le mur sans la réplique finale (D-161, D-162 (2)).
    simulerArrivage();
    oublierGestes();
    remettreJourneeAuDebut();
    marquerGeste('combat');
    marquerGeste('sauvegarde');
    allerAEtape(ETAPES_JOURNEE.length - 1);
    await rendreApplication({
      chemin: '/attente',
      storeState: {
        tutorielVu: false,
        pasAPasCombatVu: true,
        packsOpened: 1,
        deck: ['atelier-joueur-de-flute']
      },
      extra: <FilDuChemin />
    });
    const panneau = () => screen.getByRole('region', { name: /Journée d’intégration/ });
    await screen.findByRole('button', { name: 'Voir le comité' });
    expect(within(panneau()).getByRole('heading', { name: /Le comité/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Voir le comité' }));
    await screen.findByRole('heading', { name: 'Le comité de pilotage' });
    expect(cheminCourant()).toBe('/comite');

    // **Les critères 1 et 2 mordent ici** : une arrivée qui écrit `tutorielVu` retire le
    // panneau et la réplique finale, et cette ligne tombe.
    expect(useStore.getState().tutorielVu).toBe(false);
    expect(panneau()).toBeInTheDocument();
    expect(within(panneau()).getByRole('heading', { name: /Le comité/ })).toBeInTheDocument();

    // **Critère 3** : la sortie est un geste explicite de la Journée, pas l'arrivée.
    await userEvent.click(screen.getByRole('button', { name: /Relire la Journée plus tard/i }));
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(document.querySelector('[data-journee-panneau]')).toBeNull();
  });

  it('une URL directe ne laisse pas l’étape décrire un autre écran', async () => {
    oublierGestes();
    remettreJourneeAuDebut();
    await rendreApplication({
      chemin: '/settings',
      storeState: {
        tutorielVu: false,
        pasAPasCombatVu: true,
        packsOpened: 1,
        deck: ['atelier-joueur-de-flute']
      },
      extra: <FilDuChemin />
    });
    await verifierCorrespondance();
  });

  it('le retour arrière laisse l’étape sur l’écran qu’elle décrit', async () => {
    monterAvecGestesFaits();
    await rendreApplication({
      chemin: '/',
      storeState: {
        tutorielVu: false,
        pasAPasCombatVu: true,
        packsOpened: 1,
        deck: ['atelier-joueur-de-flute']
      },
      extra: (
        <>
          <FilDuChemin />
          <RetourDuNavigateur />
        </>
      )
    });
    await screen.findByRole('region', { name: /Journée d’intégration/ });
    await verifierCorrespondance();

    // Le geste déjà fait ne passe pas l'étape seul : on la fait avancer comme le ferait un
    // geste validé, et l'écran doit suivre (#677).
    act(() => allerAEtape(1));
    await verifierCorrespondance();

    act(() => {
      window.dispatchEvent(new Event('test-retour'));
    });
    await verifierCorrespondance();
  });

  it('rouvrir depuis Réglages laisse l’étape sur l’écran qu’elle décrit', async () => {
    oublierGestes();
    remettreJourneeAuDebut();
    await rendreApplication({
      chemin: '/settings',
      storeState: {
        tutorielVu: true,
        pasAPasCombatVu: true,
        packsOpened: 1,
        deck: ['atelier-joueur-de-flute']
      },
      extra: <FilDuChemin />
    });
    await userEvent.click(screen.getByRole('button', { name: /Revoir la Journée d’intégration/i }));
    await verifierCorrespondance();
  });

  it('« Revoir » repart de l’étape 1, même quand tout est fait (#731)', async () => {
    // **Le défaut reproduit** : l'Arrivage et le Deck sont faits dans le store, le combat
    // et la sauvegarde dans la session ; « Revoir » les oublie, la reprise sautait donc à
    // l'étape 3, puis le réalignement sur `/settings` à l'étape 4. Le testeur relisait la
    // Journée au milieu, jamais à son début.
    const etat = {
      tutorielVu: false,
      pasAPasCombatVu: true,
      packsOpened: 1,
      deck: ['atelier-joueur-de-flute']
    };
    marquerGeste('combat');
    marquerGeste('sauvegarde');
    await rendreApplication({ chemin: '/settings', storeState: etat, extra: <FilDuChemin /> });
    // **Une première visite dans la même session** : le panneau se montre (et la reprise
    // joue), puis se cache comme le ferait « Terminer ». Le composant reste monté : c'est
    // ce cas que « Revoir » doit encore défaire.
    expect(document.querySelector('[data-journee-panneau]')).not.toBeNull();
    act(() => useStore.getState().setTutorielVu(true));
    await waitFor(() => expect(document.querySelector('[data-journee-panneau]')).toBeNull());

    await userEvent.click(screen.getByRole('button', { name: /Revoir la Journée d’intégration/i }));

    // Le panneau revient sur l'accueil : la section des Réglages porte le même nom de
    // région, on lit donc le panneau par son attribut.
    await waitFor(() => expect(screen.getByRole('heading', { name: /L’Arrivage/ })).toBeInTheDocument());
    const panneau = document.querySelector<HTMLElement>('[data-journee-panneau]')!;
    // **Le contrôle mord** : avec l'ancienne reprise, on lisait ici « 3/5 » (le combat)
    // puis « 4/5 » (la route des Réglages) ; sans le réalignement ignoré, l'étape restait
    // sur `/settings` au lieu d'ouvrir son écran.
    expect(within(panneau).getByText('1/5')).toBeInTheDocument();
    expect(within(panneau).getByRole('heading', { name: /L’Arrivage/ })).toBeInTheDocument();
    await waitFor(() => expect(cheminCourant()).toBe('/'));
    // **L'Arrivage déjà ouvert reste fait** : on ne « dé-ouvre » pas un paquet, et « Revoir »
    // ne traverse pas la Journée : tous les gestes étaient faits, l'étape reste la première.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(etapeJournee()).toBe(0);
    expect(screen.queryByRole('button', { name: /^Suivant$/i })).toBeNull();
  });

  it('le saut dit ce qu’il coûte, et mène au même état que la fin', async () => {
    const saut = await monter();
    const bouton = screen.getByRole('button', { name: /passer : tu ne verras pas le combat/i });
    await userEvent.click(bouton);
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(document.querySelector('[data-journee-panneau]')).toBeNull();
    saut.unmount();

    // La fin, par le même panneau : même drapeau, même état de store. L'étape du comité
    // ouvre elle-même son écran ; sa sortie explicite est le lien de l'appel à participer.
    await monter();
    act(() => {
      allerAEtape(ETAPES_JOURNEE.length - 1);
    });
    await userEvent.click(screen.getByRole('link', { name: 'le comité' }));
    expect(useStore.getState().tutorielVu).toBe(true);
  });

  it('l’appel à participer n’apparaît qu’à la fin, et son lien comité referme la Journée (#271)', async () => {
    const appel = /Envie d’aider/;
    // **Le contrôle mord** : une ligne posée à une étape intermédiaire se verrait ici.
    for (let index = 0; index < ETAPES_JOURNEE.length - 1; index += 1) {
      const { unmount } = monterPanneau(index);
      // Sur /battle le panneau s'efface (D-162 (3)) : l'absence de la ligne n'y prouve rien,
      // et c'est le test de parcours qui vérifie cette étape-là.
      if (document.querySelector('[data-journee-panneau]')) {
        expect(screen.queryByText(appel), `étape ${index + 1}`).toBeNull();
      }
      unmount();
    }
    const { unmount } = monterPanneau(ETAPES_JOURNEE.length - 1);
    expect(screen.getByText(appel)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'le comité' }));
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(document.querySelector('[data-journee-panneau]')).toBeNull();
    unmount();
  });
});

describe('la reprise repart de la première étape non faite (#687)', () => {
  it('reprend à la première étape dont le geste manque, et reste à la première quand tout est fait', () => {
    // Arrivage fait, Deck à charger : la reprise s'arrête à l'étape 2. Hors parcours
    // (`/attente`), aucune route ne réaligne l'étape : c'est bien la reprise qu'on lit.
    setupTestStore({ tutorielVu: false, pasAPasCombatVu: true, packsOpened: 1, deck: [] });
    oublierGestes();
    remettreJourneeAuDebut();
    const { unmount } = render(
      <MemoryRouter initialEntries={['/attente']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /La Collection et le Deck/ })).toBeInTheDocument();
    unmount();

    // Arrivage et Deck faits, combat non joué : l'étape 3.
    setupTestStore({
      tutorielVu: false,
      pasAPasCombatVu: true,
      packsOpened: 1,
      deck: ['atelier-joueur-de-flute']
    });
    oublierGestes();
    remettreJourneeAuDebut();
    const { unmount: apresCombat } = render(
      <MemoryRouter initialEntries={['/attente']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /Le combat/ })).toBeInTheDocument();
    apresCombat();

    // Les quatre gestes faits : `findIndex` rend `-1`, et le panneau reste à l'étape 1.
    // **Le contrôle mord** : la branche morte `premiere === -1` prétendait glisser à la
    // dernière étape ; un `findIndex` non gardé ferait tomber cette ligne.
    setupTestStore({
      tutorielVu: false,
      pasAPasCombatVu: true,
      packsOpened: 1,
      deck: ['atelier-joueur-de-flute']
    });
    oublierGestes();
    marquerGeste('combat');
    marquerGeste('sauvegarde');
    remettreJourneeAuDebut();
    const { unmount: toutFait } = render(
      <MemoryRouter initialEntries={['/attente']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /L’Arrivage/ })).toBeInTheDocument();
    toutFait();
  });

  it('le rechargement reprend, « Revoir » repart de l’étape 1 : le même état, deux issues (#731)', () => {
    const etat = {
      tutorielVu: false,
      pasAPasCombatVu: true,
      packsOpened: 1,
      deck: ['atelier-joueur-de-flute']
    };
    // **Le rechargement** : l'étape et les gestes de session repartent de zéro, le store
    // reste. Arrivage et Deck sont faits, le combat ne l'est pas : on reprend à l'étape 3.
    setupTestStore(etat);
    oublierGestes();
    remettreJourneeAuDebut();
    const { unmount } = render(
      <MemoryRouter initialEntries={['/attente']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    // **Le contrôle mord** : supprimer la reprise ferait tomber cette ligne (on lirait
    // « L’Arrivage ») ; c'est le critère 2 de #731, la reprise reste pour le rechargement.
    expect(screen.getByRole('heading', { name: /Le combat/ })).toBeInTheDocument();
    unmount();

    // **« Revoir »**, même état : la reprise est ignorée, la Journée repart de l'étape 1.
    setupTestStore(etat);
    oublierGestes();
    rejouerJournee();
    const { unmount: relecture } = render(
      <MemoryRouter initialEntries={['/attente']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /L’Arrivage/ })).toBeInTheDocument();
    relecture();
  });
});

describe('le focus reste sur le déclencheur (D-161, #687)', () => {
  it('ouvrir la Journée ne déplace pas le focus dans le panneau, et l’étape s’annonce', async () => {
    setupTestStore({
      tutorielVu: true,
      pasAPasCombatVu: true,
      packsOpened: 1,
      deck: ['atelier-joueur-de-flute']
    });
    monterAvecGestesFaits();
    function Declencheur() {
      const setTutorielVu = useStore((state) => state.setTutorielVu);
      return (
        <button type="button" onClick={() => setTutorielVu(false)}>
          Ouvrir la Journée
        </button>
      );
    }
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <>
          <JourneeIntegration />
          <Declencheur />
        </>
      </MemoryRouter>
    );

    const declencheur = screen.getByRole('button', { name: 'Ouvrir la Journée' });
    await userEvent.click(declencheur);
    const panneau = screen.getByRole('region', { name: /Journée d’intégration/ });

    // **Le contrôle mord** : remettre `panneauRef.current?.focus()` à l'ouverture fait
    // tomber ces deux lignes — le focus partirait dans la région.
    expect(declencheur).toHaveFocus();
    expect(document.activeElement).not.toBe(panneau);

    // La région ne devient pas modale pour autant, et son titre annonce l'étape : le focus
    // reste dehors, `aria-live` fait le travail (D-162 (1)).
    expect(panneau).toHaveAttribute('role', 'region');
    expect(panneau.getAttribute('aria-modal')).toBeNull();
    expect(within(panneau).queryByRole('dialog')).toBeNull();
    expect(panneau.querySelector('[aria-live="polite"]')).toHaveTextContent('L’Arrivage');
    unmount();
  });
});

describe('la ligne du geste se lit, sans s’afficher (04/11/2026, option A)', () => {
  it('reste dans le DOM en `role="status"`, en `sr-only` : lue par les lecteurs d’écran, pas affichée', () => {
    // L'étape 1 (l'Arrivage) n'a pas son geste : aucun Arrivage ouvert, la ligne d'aide est
    // rendue. (`monterPanneau` poserait `packsOpened: 1`, geste déjà fait : on pose l'état ici.)
    setupTestStore({ tutorielVu: false, pasAPasCombatVu: true, packsOpened: 0, deck: [] });
    oublierGestes();
    remettreJourneeAuDebut();
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    const aide = screen.getByText(/Fais le geste sur la page/);
    expect(aide.tagName).toBe('P');
    expect(aide).toHaveAttribute('role', 'status');
    // **Le contrôle mord** : sans `sr-only`, la ligne reprend sa place visible dans le panneau
    // et ce test tombe (mutant : retirer la classe de cette ligne, le texte reste).
    expect(aide.classList.contains('sr-only')).toBe(true);
    unmount();
  });
});

describe('le plateau garde son tutoriel (31/10/2026)', () => {
  it('sur /battle, le panneau s’efface : le pas-à-pas du combat parle seul', () => {
    // Mesuré le 30/10 : le panneau (y 10 → 258) recouvrait le pas-à-pas (y 50 → 99) et sa
    // garde le gelait. D-160 (1) promet « zéro recouvrement ».
    setupTestStore({ tutorielVu: false, pasAPasCombatVu: false, packsOpened: 1, deck: [] });
    oublierGestes();
    remettreJourneeAuDebut();
    render(
      <MemoryRouter initialEntries={['/battle?tutoriel=1&scene=fin']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    // **Le contrôle mord** : le panneau reparaîtrait ici si l'exclusion tombait.
    expect(document.querySelector('[data-journee-panneau]')).toBeNull();
    expect(document.querySelector('.journee__portrait')).not.toBeNull();
    expect(document.querySelector('.journee__parole')).toBeNull();
  });
});

describe('la réplique de la Journée reste courte et désigne sa cible (D-181, #681)', () => {
  it('sort du panneau, annonce le texte entier et garde le portrait dans sa borne', () => {
    for (const index of [0, 1, 3, 4]) {
      const { unmount } = monterPanneau(index);
      const panneau = screen.getByRole('region', { name: /Journée d’intégration/ });
      const portrait = document.querySelector<HTMLImageElement>('.journee__portrait');
      const encadre = document.querySelector<HTMLElement>('.journee__parole');
      const visuel = encadre?.querySelector('.journee__direction');
      const annonce = document.querySelector('[data-journee-voix]');

      expect(panneau.querySelector('[aria-live="polite"]')).not.toBeNull();
      expect(panneau.getAttribute('aria-modal')).toBeNull();
      expect(within(panneau).queryByRole('dialog')).toBeNull();
      expect(panneau.querySelector('.journee__parole')).toBeNull();
      expect(panneau.querySelector('.journee__portrait')).toBeNull();
      expect(document.documentElement.style.getPropertyValue('--journee-hauteur')).toBe(`${panneau.offsetHeight}px`);
      expect(portrait).not.toBeNull();
      expect(portrait!.getAttribute('src')).toBe(artUrl('direction-chef-cabinet.webp'));
      expect(portrait!.getAttribute('width')).toBe('56');
      expect(portrait!.getAttribute('height')).toBe('56');
      expect(visuel).toHaveAttribute('aria-hidden', 'true');
      expect(visuel?.querySelector('strong')?.textContent).toBe('Chef de cabinet');
      expect(annonce).toHaveAttribute('aria-live', 'polite');
      expect(annonce).toHaveAttribute('aria-atomic', 'true');
      expect(annonce).toHaveTextContent(`Chef de cabinet : ${ETAPES_JOURNEE[index].direction}`);
      expect((annonce?.textContent ?? '').trim().split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(12);
      unmount();
    }
  });

  it('un tap affiche toute la réplique, et ne fait pas avancer une étape avec geste (D-187 (4), D-196)', async () => {
    const { unmount } = monterPanneau(0);
    const encadre = screen.getByRole('button', { name: /Chef de cabinet : De la part de la Direction/ });
    expect(encadre.querySelector('.journee__texte-anime')).toHaveTextContent(ETAPES_JOURNEE[0].direction);
    expect(encadre).not.toHaveAttribute('data-complet');
    await userEvent.click(encadre);
    expect(encadre).toHaveAttribute('data-complet', 'true');
    // **Le contrôle mord** : un tap qui ferait avancer une étape avec geste la ferait passer ici.
    await userEvent.click(encadre);
    expect(etapeJournee()).toBe(0);
    unmount();
  });

  it('la réplique est un vrai bouton : Entrée et Espace l’affichent, et son nom dit l’action', async () => {
    const { unmount } = monterPanneau(1);
    const encadre = screen.getByRole('button', { name: /Chef de cabinet : Vingt cartes, comptées\..*tout le texte/ });
    act(() => encadre.focus());
    await userEvent.keyboard('{Enter}');
    expect(encadre).toHaveAttribute('data-complet', 'true');
    unmount();

    const { unmount: autre } = monterPanneau(3);
    const espace = screen.getByRole('button', { name: /Chef de cabinet : Sinon, tout s’efface/ });
    act(() => espace.focus());
    await userEvent.keyboard(' ');
    expect(espace).toHaveAttribute('data-complet', 'true');
    autre();
  });

  it('sous mouvement réduit, la réplique est entière d’emblée : le nom ne demande plus de tap d’affichage', () => {
    const { unmount } = monterPanneau(0);
    act(() => useStore.setState({ reducedMotion: true }));
    const encadre = screen.getByRole('button', { name: /Chef de cabinet : De la part de la Direction/ });
    // **Le contrôle mord** : sous mouvement réduit, la phrase « tout le texte » ne se lit plus.
    expect(encadre).toHaveAttribute('data-complet', 'true');
    expect(encadre.getAttribute('aria-label')).not.toMatch(/tout le texte/);
    unmount();
    act(() => useStore.setState({ reducedMotion: false }));
  });

  it('aucune minuterie : 60 s écoulées, l’étape sans geste ne s’avance pas seule (D-196 (2))', () => {
    vi.useFakeTimers();
    try {
      const { unmount } = monterPanneau(ETAPES_JOURNEE.length - 1);
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(etapeJournee()).toBe(ETAPES_JOURNEE.length - 1);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('aucune minuterie : 60 s écoulées, l’étape avec geste attend son geste', () => {
    vi.useFakeTimers();
    try {
      setupTestStore({ tutorielVu: false, pasAPasCombatVu: true, packsOpened: 0, deck: [] });
      oublierGestes();
      remettreJourneeAuDebut();
      const { unmount } = render(
        <MemoryRouter initialEntries={['/']}>
          <JourneeIntegration />
        </MemoryRouter>
      );
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      // **Le contrôle mord** : un geste non fait ne fait pas avancer, même après un long délai.
      expect(etapeJournee()).toBe(0);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('le premier tap du comité finit l’écriture ; le second termine la Journée (10/11/2026)', async () => {
    const { unmount } = monterPanneau(ETAPES_JOURNEE.length - 1);
    const encadre = screen.getByRole('button', { name: /Chef de cabinet : Le mur lit tout/ });
    await userEvent.click(encadre);
    // **Le contrôle mord** : un premier tap qui terminerait ferait passer ce test.
    expect(encadre).toHaveAttribute('data-complet', 'true');
    expect(useStore.getState().tutorielVu).toBe(false);
    await userEvent.click(encadre);
    // **Le contrôle mord** : sans le second tap terminal, le drapeau reste à `false`.
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(document.querySelector('[data-journee-panneau]')).toBeNull();
    unmount();
  });

  it('sous mouvement réduit, un seul tap sur le comité termine la Journée', async () => {
    const { unmount } = monterPanneau(ETAPES_JOURNEE.length - 1);
    act(() => useStore.setState({ reducedMotion: true }));
    const encadre = screen.getByRole('button', { name: /Chef de cabinet : Le mur lit tout.*terminer la Journée/ });
    await userEvent.click(encadre);
    expect(useStore.getState().tutorielVu).toBe(true);
    unmount();
    act(() => useStore.setState({ reducedMotion: false }));
  });

  it('un tap sur une étape avec geste ne termine jamais la Journée', async () => {
    const { unmount } = monterPanneau(1);
    const encadre = screen.getByRole('button', { name: /Chef de cabinet : Vingt cartes, comptées\./ });
    await userEvent.click(encadre);
    await userEvent.click(encadre);
    // **Le contrôle mord** : un tap qui terminerait sur une étape avec geste écrirait `tutorielVu`.
    expect(useStore.getState().tutorielVu).toBe(false);
    expect(etapeJournee()).toBe(1);
    unmount();
  });

  it('termine l’écriture en moins de 1,5 s et révèle tout sous mouvement réduit', () => {
    const duree = /\.journee__texte-anime\s*\{[^}]*animation:\s*journee-ecrit\s+([\d.]+)(ms|s)/.exec(STYLES_JOURNEE);
    expect(duree).not.toBeNull();
    expect(Number(duree?.[1]) * (duree?.[2] === 's' ? 1000 : 1)).toBeLessThanOrEqual(1500);
    expect(STYLES_JOURNEE).toMatch(
      /:root\[data-mouvement-reduit='true'\]\s+\.journee__texte-anime,[\s\S]*?clip-path:\s*none;/
    );
    expect(STYLES_JOURNEE).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.journee__texte-anime\s*\{[^}]*clip-path:\s*none;/
    );
    expect(STYLES_JOURNEE).toMatch(
      /\.journee__parole\[data-complet='true'\]\s+\.journee__texte-anime\s*\{[^}]*clip-path:\s*none;/
    );
  });

  it('place la pointe dans la cible et le contrôle échoue si elle est décalée', async () => {
    const gaucheBulle = 20;
    const rect = (left: number, top: number, width: number, height: number): DOMRect =>
      ({
        x: left,
        y: top,
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        toJSON: () => ({})
      }) as DOMRect;

    const geometrie = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.matches('[data-journee-cible]')) return rect(132, 460, 190, 44);
      if (this.matches('.journee')) return rect(gaucheBulle, 10, 380, 280);
      if (this.matches('.journee__pointe')) {
        const centre = gaucheBulle + Number.parseFloat(this.style.left || '0');
        return rect(centre - 8, 268, 16, 8);
      }
      return rect(0, 0, 0, 0);
    });

    setupTestStore({ tutorielVu: false, pasAPasCombatVu: true, packsOpened: 0, deck: [] });
    oublierGestes();
    remettreJourneeAuDebut();
    const onClick = vi.fn();
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <>
          <JourneeIntegration />
          <button type="button" data-journee-cible="arrivage" onClick={onClick}>
            Ouvrir un Arrivage
          </button>
        </>
      </MemoryRouter>
    );

    const panneau = screen.getByRole('region', { name: /Journée d’intégration/ });
    const cible = document.querySelector<HTMLElement>('[data-journee-cible="arrivage"]');
    const pointe = panneau.querySelector<HTMLElement>('.journee__pointe');
    expect(pointe).not.toBeNull();
    expect(pointe?.getAttribute('aria-hidden')).toBe('true');
    const verifierPointeDansLaCible = () => {
      const pointeRect = pointe!.getBoundingClientRect();
      const cibleRect = cible!.getBoundingClientRect();
      const pointeX = pointeRect.left + pointeRect.width / 2;
      expect(pointeX).toBeGreaterThanOrEqual(cibleRect.left);
      expect(pointeX).toBeLessThanOrEqual(cibleRect.right);
    };

    verifierPointeDansLaCible();

    // **Le contrôle mord** : une pointe déplacée hors de l'élément montré invalide l'assertion.
    const positionInitiale = pointe!.style.left;
    pointe!.style.left = `${Number.parseFloat(positionInitiale) + 100}px`;
    expect(verifierPointeDansLaCible).toThrow();
    pointe!.style.left = positionInitiale;
    await userEvent.click(cible!);
    expect(onClick).toHaveBeenCalledOnce();

    unmount();
    geometrie.mockRestore();
  });

  it('laisse Tab sortir du panneau et ne rend pas de pointe sans cible', async () => {
    setupTestStore({ tutorielVu: false, pasAPasCombatVu: true, packsOpened: 0, deck: [] });
    oublierGestes();
    remettreJourneeAuDebut();
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <>
          <JourneeIntegration />
          <button type="button" data-journee-cible="arrivage">
            Cible
          </button>
        </>
      </MemoryRouter>
    );

    const panneau = screen.getByRole('region', { name: /Journée d’intégration/ });
    const cible = screen.getByRole('button', { name: 'Cible' });
    const derniereAction = within(panneau).getByRole('button', { name: 'Montrer le bouton' });
    derniereAction.focus();
    // La réplique est un vrai bouton (D-196) : Tab s'y arrête avant la cible suivante.
    await userEvent.tab();
    expect(document.activeElement).toBe(document.querySelector('.journee__parole'));
    await userEvent.tab();
    expect(document.activeElement).toBe(cible);
    unmount();

    const { unmount: unmountComite } = monterPanneau(4);
    expect(screen.getByRole('region', { name: /Journée d’intégration/ }).querySelector('.journee__pointe')).toBeNull();
    unmountComite();

    setupTestStore({ tutorielVu: false, pasAPasCombatVu: false, packsOpened: 1, deck: [] });
    render(
      <MemoryRouter initialEntries={['/battle?tutoriel=1&scene=fin']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    expect(document.querySelector('.journee__pointe')).toBeNull();
  });
});

describe('la pause se joue au clavier et à l’écran (D-162 (2), #678)', () => {
  it('Échap met en pause sans terminer ; « Reprendre » rend le panneau à la même étape', async () => {
    await monter();
    // L'étape 2 s'ouvre par son geste ; ici le geste de l'Arrivage est déjà fait, on la fait avancer.
    act(() => allerAEtape(1));
    await verifierCorrespondance();
    expect(screen.getByRole('heading', { name: /La Collection et le Deck/ })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    // **Le contrôle mord** : si Échap écrivait `tutorielVu` (ancien comportement), le drapeau
    // serait à `true` ici et le panneau serait retiré.
    expect(screen.getByText(/Journée en pause/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Passer : tu ne verras pas le combat/ })).toBeInTheDocument();
    expect(useStore.getState().tutorielVu).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    // **Le contrôle mord** : « Reprendre » qui terminerait la Journée retirerait le panneau.
    expect(useStore.getState().tutorielVu).toBe(false);
    expect(screen.queryByText(/Journée en pause/)).toBeNull();
    expect(screen.getByRole('heading', { name: /La Collection et le Deck/ })).toBeInTheDocument();
  });

  it('la sortie explicite termine la Journée ; Échap seul ne la termine pas', async () => {
    await monter();
    await userEvent.keyboard('{Escape}');
    // **Le contrôle mord** : un Échap qui terminerait ferait échouer cette ligne.
    expect(useStore.getState().tutorielVu).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /Passer : tu ne verras pas le combat/ }));
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(document.querySelector('[data-journee-panneau]')).toBeNull();
  });

  it('en pause, la page n’est plus bloquée et « Reprendre » se tient au clavier', async () => {
    await monter();
    // La page d'accueil, hors du panneau : c'est elle que la garde protège.
    const probe = screen.getByRole('heading', { level: 1 });
    const clic = () => {
      const evenement = new MouseEvent('click', { bubbles: true, cancelable: true });
      probe.dispatchEvent(evenement);
      return evenement.defaultPrevented;
    };
    // **Le contrôle mord** : hors pause, la garde annule le clic sur la page.
    expect(clic()).toBe(true);

    await userEvent.keyboard('{Escape}');
    expect(clic()).toBe(false);
    // Au clavier : « Reprendre » est tabulable (pas de `tabindex="-1"`), et Entrée le
    // déclenche. Le focus y arrive comme il arriverait par `Tab`.
    const reprendre = screen.getByRole('button', { name: 'Reprendre' });
    expect(reprendre.tabIndex).toBeGreaterThanOrEqual(0);
    act(() => {
      reprendre.focus();
    });
    expect(reprendre).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    // **Le contrôle mord** : si la barre ne tenait pas au clavier, Entrée ne la rendrait pas.
    expect(screen.queryByText(/Journée en pause/)).toBeNull();
    expect(useStore.getState().tutorielVu).toBe(false);
  });
});

/**
 * **Le budget de texte rendu** (D-181 (3), #682) — mesuré sur le **DOM**, pas sur les
 * objets de données : un libellé ajouté dans le JSX doit peser.
 *
 * Ce qui compte (D-181 (3), précisé par D-185 (1) et D-186 (1)) : le titre
 * (`#journee-titre`, compteur et préfixe `sr-only` exclus), le texte (`#journee-texte`),
 * la **réplique sans son locuteur** (`.journee__direction`, le `<strong>` retiré) et les
 * libellés des boutons d'action de l'étape (`.actions` : le geste, s'il est
 * visible). Fourchette : 54 à 66 mots.
 *
 * **Hors budget** : le **nom du locuteur** « Chef de cabinet » (D-186 (1)), libellé répété
 * à chaque étape, et le **bouton de sortie permanent** « Passer : tu ne verras pas le
 * combat » / « Relire la Journée… » (D-185 (1)), un contrôle, le même partout. Le nom reste
 * dans la **borne par réplique** : « Chef de cabinet » + réplique ≤ 12 mots (D-186 (3)).
 */
function mots(texte: string): number {
  return texte.split(/\s+/).filter(Boolean).length;
}

interface CompteDeTexte {
  titre: string;
  mots: number;
  /** La réplique **sans** le nom du locuteur : c'est ce que le budget compte (D-186 (1)). */
  repliqueMots: number;
  /** La réplique **avec** le nom : c'est elle que la borne de 12 mots lit (D-186 (3)). */
  repliqueAvecNomMots: number;
  replique: string;
  repliqueAvecNom: string;
  detail: string;
  source: 'DOM' | 'données';
}

function compteDeLEtape(index: number): CompteDeTexte {
  const etape = ETAPES_JOURNEE[index];
  const { unmount } = monterPanneau(index);
  const panneau = document.querySelector<HTMLElement>('[data-journee-panneau]');
  let compte: CompteDeTexte;

  if (panneau) {
    const titreEl = panneau.querySelector('#journee-titre')?.cloneNode(true) as HTMLElement | undefined;
    titreEl?.querySelector('.journee__compte')?.remove();
    titreEl?.querySelector('.sr-only')?.remove();
    const titreRendu = titreEl?.textContent?.trim() ?? etape.titre;
    const texte = panneau.querySelector('#journee-texte')?.textContent?.trim() ?? '';
    // La réplique rendue, nom compris (`<strong>Chef de cabinet</strong> …`), puis la même
    // **sans** le nom : on retire le `<strong>` du clone. Le nom est un libellé répété, hors
    // budget (D-186 (1)) ; il reste dans la borne de 12 mots (D-186 (3)).
    const repliqueEl = document.querySelector('.journee__direction');
    const repliqueAvecNom = repliqueEl?.textContent?.trim() ?? '';
    const repliqueClone = repliqueEl?.cloneNode(true) as HTMLElement | undefined;
    repliqueClone?.querySelector('strong')?.remove();
    const replique = repliqueClone?.textContent?.trim() ?? '';
    const boutons = [...panneau.querySelectorAll<HTMLButtonElement>('.actions button')].map(
      (bouton) => bouton.textContent?.trim() ?? ''
    );
    const morceaux = [titreRendu, texte, replique, ...boutons];
    compte = {
      titre: etape.titre,
      mots: morceaux.reduce((somme, morceau) => somme + mots(morceau), 0),
      repliqueMots: mots(replique),
      repliqueAvecNomMots: mots(repliqueAvecNom),
      repliqueAvecNom,
      replique,
      detail: morceaux.map((morceau) => `« ${morceau} »`).join(' + '),
      source: 'DOM'
    };
  } else {
    // **Le panneau de l'étape du combat n'est jamais rendu** (D-162 (3)) : il s'efface sur
    // `/battle`. On compte la même source que le panneau lirait, sans quoi cette étape
    // échapperait au budget ; un mot ajouté à son texte pèse quand même.
    // Sans le nom, comme le DOM ci-dessus (D-186 (1)) ; avec le nom pour la borne (D-186 (3)).
    const replique = etape.direction;
    const repliqueAvecNom = `${LOCUTEUR_JOURNEE} ${etape.direction}`;
    const morceaux = [etape.titre, etape.texte, replique];
    compte = {
      titre: etape.titre,
      mots: morceaux.reduce((somme, morceau) => somme + mots(morceau), 0),
      repliqueMots: mots(replique),
      repliqueAvecNomMots: mots(repliqueAvecNom),
      repliqueAvecNom,
      replique,
      detail: morceaux.map((morceau) => `« ${morceau} »`).join(' + '),
      source: 'données'
    };
  }

  unmount();
  return compte;
}

function detailDesComptes(comptes: readonly CompteDeTexte[]): string {
  const total = comptes.reduce((somme, compte) => somme + compte.mots, 0);
  return [
    `Le budget de texte rendu (D-181 (3), #682) : ${total} mots, cible ${MOTS_CIBLE_JOURNEE} (${MOTS_MIN_JOURNEE} à ${MOTS_MAX_JOURNEE}).`,
    ...comptes.map(
      (compte, index) =>
        `  étape ${index + 1} « ${compte.titre} » : ${compte.mots} mots, réplique ${compte.repliqueMots} sans le nom (${compte.repliqueAvecNomMots} avec) [${compte.source}] = ${compte.detail}`
    )
  ].join('\n');
}

describe('le budget de texte de la Journée (D-181 (3), #682)', () => {
  it('tient ≈ 60 mots rendus sur les cinq étapes, et 12 mots par réplique', () => {
    const comptes = ETAPES_JOURNEE.map((_, index) => compteDeLEtape(index));
    const total = comptes.reduce((somme, compte) => somme + compte.mots, 0);
    const detail = detailDesComptes(comptes);

    // **Le contrôle mord** : la borne de 12 mots se lit **avec** le nom (D-186 (3)) ; une
    // réplique à 13 mots, nom compris, nomme l'étape, son compte et son texte.
    for (const compte of comptes) {
      expect(
        compte.repliqueAvecNomMots,
        `${detail}\nLa réplique de « ${compte.titre} » fait ${compte.repliqueAvecNomMots} mots avec le nom : « ${compte.repliqueAvecNom} »`
      ).toBeLessThanOrEqual(MOTS_MAX_REPLIQUE);
    }
    // **Le contrôle mord** : le total hors nom et hors sortie doit rester dans la fourchette
    // (54 à 66) ; un texte qui la dépasse fait échouer cette ligne, et c'est ce que vérifie
    // le mutant « total > 66 ».
    expect(total, detail).toBeGreaterThanOrEqual(MOTS_MIN_JOURNEE);
    expect(total, detail).toBeLessThanOrEqual(MOTS_MAX_JOURNEE);
  });
});
