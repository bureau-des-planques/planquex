// @vitest-environment jsdom
import { useEffect } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JourneeIntegration } from './JourneeIntegration';
import { ETAPES_JOURNEE } from './journee-etapes';
import { marquerGeste, oublierGestes } from './journee-gestes';
import { CIBLE_DE_GESTE, cibleJournee } from './journee-cible';
import { allerAEtape, etapeJournee, remettreJourneeAuDebut } from './journee-etape';
import { rendreApplication, setupTestStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { simulerArrivage } from '@/test/arrivageDeTest';

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
 * `waitFor` porte l'attente : un `Suivant` change l'étape et la route en deux temps, et les
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
  setupTestStore({
    tutorielVu: false,
    pasAPasCombatVu: true,
    packsOpened: 1,
    deck: ['atelier-joueur-de-flute']
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
  it('« Suivant » attend les gestes : un Arrivage ouvert, un Deck chargé', async () => {
    setupTestStore({ tutorielVu: false, pasAPasCombatVu: true, packsOpened: 0, deck: [] });
    remettreJourneeAuDebut();
    render(
      <MemoryRouter initialEntries={['/']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    const suivant = () => screen.getByRole('button', { name: /^Suivant$/i });

    // **Le contrôle mord** : sans le geste, on ne traverse pas la Journée en lecture.
    expect(suivant()).toBeDisabled();
    // L'Arrivage passe par le serveur (#651) : le faux serveur rend les cartes.
    simulerArrivage();
    await act(async () => {
      await useStore.getState().openPack();
    });
    await waitFor(() => expect(suivant()).toBeEnabled());

    await userEvent.click(suivant());
    expect(screen.getByRole('heading', { name: /La Collection et le Deck/ })).toBeInTheDocument();
    expect(suivant()).toBeDisabled();
    act(() => {
      useStore.getState().setDeck(['atelier-joueur-de-flute']);
    });
    await waitFor(() => expect(suivant()).toBeEnabled());

    // L'étape 3 (le combat) n'a plus de « Suivant » dans le panneau : il s'efface sur
    // `/battle` (D-162 (3)) et c'est la scène de fin qui avance la visite. L'enchaînement
    // complet se joue dans le test suivant ; ici, on garde la garde des deux gestes du store.
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

    // Étape 1 faite, puis « Suivant » ouvre `/deck` : la Journée et le Deck sont deux
    // morceaux paresseux, le volet peut donc apparaître **après** l'effet de la Journée.
    await userEvent.click(action(/Ouvrir un Arrivage/i));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: /Ranger dans la Collection/i }));
    const suivant = screen.getByRole('button', { name: /^Suivant$/i });
    await waitFor(() => expect(suivant).toBeEnabled());
    scroll.mockClear();
    await userEvent.click(suivant);
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
    // n'arriverait pas, le Deck resterait vide et « Suivant » resterait fermé.
    await userEvent.click(charger);
    await waitFor(() => expect(useStore.getState().deck.length).toBeGreaterThan(0));
    await waitFor(() => expect(suivant).toBeEnabled());

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
    const suivant = () => screen.getByRole('button', { name: /^Suivant$/i });

    // Étape 1 — L'Arrivage, sur l'accueil, avec le bouton d'Arrivage désigné.
    await verifierCorrespondance();
    await userEvent.click(action(/Ouvrir un Arrivage/i));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: /Ranger dans la Collection/i }));
    await waitFor(() => expect(suivant()).toBeEnabled());

    // Étape 2 — La Collection et le Deck, sur /deck, avec le volet des Decks proposés.
    await userEvent.click(suivant());
    await verifierCorrespondance();
    await userEvent.click(screen.getAllByRole('button', { name: 'Charger' })[0]);
    await waitFor(() => expect(suivant()).toBeEnabled());

    // Étape 3 — Le combat, sur /battle : le panneau s'efface, le pas-à-pas parle seul.
    await userEvent.click(suivant());
    await verifierCorrespondance();
    const passer = screen.queryByRole('button', { name: /Passer le pas-à-pas/i });
    if (passer) await userEvent.click(passer);
    await userEvent.click(screen.getByRole('button', { name: /Redémarrage à froid/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Continuer/i }));

    // Étape 4 — Tes données, sur /settings, avec « Créer ma sauvegarde » désigné.
    await verifierCorrespondance();
    await userEvent.click(screen.getByRole('button', { name: /Créer ma sauvegarde/i }));
    await waitFor(() => expect(suivant()).toBeEnabled());

    // Étape 5 — Le comité, sur /comite : la dernière étape ne désigne aucun halo.
    await userEvent.click(suivant());
    await verifierCorrespondance();

    // La sortie explicite referme la Journée sur l'écran qu'elle vient d'ouvrir.
    await userEvent.click(screen.getByRole('button', { name: /Relire la Journée plus tard/i }));
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(document.querySelector('[data-journee-panneau]')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Le comité de pilotage' })).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', { name: /^Suivant$/i }));
    // Le correctif de #677 mène directement à /deck ; avant lui, c'est le bouton de l'étape
    // qui fait ce chemin. Le test suit le bouton quand il est là, sans supposer l'un ou l'autre.
    const allerAuDeck = screen.queryByRole('button', { name: /Aller au Deck/i });
    if (allerAuDeck) await userEvent.click(allerAuDeck);
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
  });
});

describe('la pause se joue au clavier et à l’écran (D-162 (2), #678)', () => {
  it('Échap met en pause sans terminer ; « Reprendre » rend le panneau à la même étape', async () => {
    await monter();
    await userEvent.click(action(/^Suivant$/i));
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
