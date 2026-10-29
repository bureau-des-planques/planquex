// @vitest-environment jsdom
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCard } from '@/data';
import type { Card, CardInstance } from '@/data/types';
import { CarteSurvolable, FicheCarte, InspecteurCombat } from '@/components/InspecteurCombat';

/**
 * **L'inspecteur du combat — deux modes, un contenu** (`SPEC-COMBAT-UI` §8 T4, #287).
 *
 * Le test **ne passe pas par l'écran** : il monte les deux surfaces du composant, prises dans
 * un petit harnais qui fait exactement ce que T5 fera dans `Battle.tsx` — la carte désigne,
 * le panneau s'ouvre sur elle. C'est la condition pour que la règle reste vérifiable même
 * quand l'écran bouge : ici, seule compte la promesse du composant.
 *
 * Le contenu (`FicheCarte`) est **le même** dans les deux rendus : l'infobulle n'est pas une
 * version courte, le panneau n'est pas une version longue — il y ajoute les gestes.
 */

/** Une carte réelle, longue et évoluée : son nom dépasse la largeur d'une carte du plateau. */
function carteDeTest(): Card {
  const carte = getCard('qvt-responsable-developpement-competences');
  if (!carte) throw new Error('la carte de test a disparu des données');
  return carte;
}
const CARTE = carteDeTest();
const INSTANCE: CardInstance = {
  uid: 'test-1',
  cardId: CARTE.id,
  hp: 70,
  maxHp: 110,
  energy: ['QVT'],
  statuses: [],
  playedTurn: 1,
  evolvedTurn: null,
  damageReduction: 0
};

const NOM_ENTIER = CARTE.name;
/** Ce que l'écran tronque : un préfixe et une ellipse, jamais le nom entier. */
const NOM_TRONQUE = `${NOM_ENTIER.slice(0, 12)}…`;

/**
 * Le harnais : la carte du plateau et son panneau, comme l'écran les tient. `gestes` est le
 * contenu d'action du panneau — c'est ce que T5 branchera sur la liste du moteur.
 */
function InspecteurDeTest({ gestes }: { gestes?: ReactNode }) {
  const [inspectee, setInspectee] = useState(false);
  const fiche = <FicheCarte instance={INSTANCE} card={CARTE} />;
  return (
    <>
      <CarteSurvolable
        uid={INSTANCE.uid}
        nom={NOM_ENTIER}
        className="carte-de-test"
        fiche={fiche}
        inspectee={inspectee}
        onInspecter={() => setInspectee(true)}
      >
        {/* La carte est **tronquée** à l'écran : c'est le cas que la spec demande de couvrir. */}
        <span className="carte-de-test__nom">{NOM_TRONQUE}</span>
      </CarteSurvolable>
      <InspecteurCombat
        ouvert={inspectee}
        onOpenChange={(ouvert) => {
          if (!ouvert) setInspectee(false);
        }}
        nom={NOM_ENTIER}
        ancre={INSTANCE.uid}
        fiche={fiche}
        gestes={gestes}
      />
    </>
  );
}

/** La carte telle que le plateau la pose : c'est le déclencheur, et le focus doit y revenir. */
function carte(): HTMLElement {
  return screen.getByRole('button', { name: NOM_ENTIER });
}

describe('InspecteurCombat — deux rendus, un seul contenu (T4, #287)', () => {
  it('1. au survol, une infobulle role="tooltip" sans aucun bouton, reliée par aria-describedby', async () => {
    render(<InspecteurDeTest />);

    await userEvent.hover(carte());
    const infobulle = await screen.findByRole('tooltip');

    // L'APG interdit qu'une infobulle contienne un élément focusable : pas un seul bouton.
    expect(within(infobulle).queryAllByRole('button')).toHaveLength(0);
    // Le déclencheur est décrit par elle tant qu'elle est ouverte.
    expect(carte()).toHaveAttribute('aria-describedby', infobulle.id);
  });

  it('2. Échap ferme le panneau et rend le focus à la carte', async () => {
    render(<InspecteurDeTest gestes={<button type="button">Attacher 1 café</button>} />);

    await userEvent.click(carte());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(carte()).toHaveFocus();
  });

  it('3. au clic, le panneau est un dialogue non modal qui porte au moins un bouton', async () => {
    render(<InspecteurDeTest gestes={<button type="button">Attacher 1 café</button>} />);

    await userEvent.click(carte());
    const panneau = await screen.findByRole('dialog');

    // Non modal : la carte décrite reste lisible et agissable sous le panneau.
    expect(panneau).not.toHaveAttribute('aria-modal');
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    expect(within(panneau).getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('4. le contenu porte le Stress chiffré et le nom entier, même quand l’écran tronque le nom', async () => {
    render(<InspecteurDeTest />);

    // Ce que l'écran montre : le nom est coupé.
    expect(carte()).toHaveTextContent(NOM_TRONQUE);
    expect(carte()).not.toHaveTextContent(NOM_ENTIER);

    await userEvent.hover(carte());
    const infobulle = await screen.findByRole('tooltip');

    // Ce que l'inspecteur dit : le nom entier, et le Stress **chiffré** (70/110 sur 110).
    expect(infobulle).toHaveTextContent(NOM_ENTIER);
    expect(infobulle).toHaveTextContent(`${INSTANCE.maxHp - INSTANCE.hp}/${INSTANCE.maxHp} de Stress`);
  });

  it('5. l’infobulle se pose dans l’écran `.battle`, pas dans `body` : ses règles et ses jetons n’existent que là (D-103)', async () => {
    // Dans `body`, `.battle .infobulle` ne s'appliquait pas : l'infobulle tombait nue au bas du
    // document, et l'écran de combat défilait de 177 px dès qu'une carte gardait le focus.
    render(
      <div className="battle">
        <InspecteurDeTest />
      </div>
    );

    await userEvent.hover(carte());
    const infobulle = await screen.findByRole('tooltip');

    expect(infobulle.closest('.battle')).not.toBeNull();
    expect(infobulle.parentElement).toBe(document.querySelector('.battle'));
  });

  it('6. l’infobulle reste dans la fenêtre : une carte au bord gauche ne la pousse pas dehors', async () => {
    render(<InspecteurDeTest />);

    // jsdom pose la carte en (0, 0) : centrée sur elle, la moitié de l'infobulle sortirait à gauche.
    await userEvent.hover(carte());
    const infobulle = await screen.findByRole('tooltip');

    // `min(17rem, 80vw)` = 272 px à 1024 px de large : la moitié (136) plus la marge (8).
    const demi = Math.min(17 * 16, 0.8 * window.innerWidth) / 2;
    expect(infobulle.style.left).toBe(`${demi + 8}px`);
  });
});
