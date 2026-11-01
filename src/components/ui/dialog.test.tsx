import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from './dialog';

/**
 * **Le fond d'un dialogue modal est inerte** (D-169, critique du 01/11/2026).
 *
 * Base UI marque la page (`aria-hidden`, `data-base-ui-inert`) mais ne pose pas l'attribut
 * `inert` : dix `Tab` depuis l'Arrivage atteignaient « Ouvrir un Arrivage », sous un sous-arbre
 * `aria-hidden`, et `Entrée` ouvrait **un second paquet** (`packsOpened` 1 → 2, mesuré au
 * navigateur). Le `inert` est posé par `InertReste`, monté **dans le portail** — donc seulement
 * quand le dialogue est ouvert.
 *
 * Les deux cas sont ici, et le second est celui qui a mordu : posé dans `DialogContent`
 * lui-même, le `inert` s'appliquait aussi **fermé**, et l'accueil entier devenait inerte au
 * chargement (le clic sur « Ouvrir un Arrivage » ne passait plus).
 */
function racine(): HTMLDivElement {
  const div = document.createElement('div');
  div.id = 'root';
  document.body.appendChild(div);
  return div;
}

function dialogue(ouvert: boolean) {
  return (
    <Dialog open={ouvert}>
      <DialogContent>
        <DialogTitle>Fiche</DialogTitle>
        <p>Une carte.</p>
      </DialogContent>
    </Dialog>
  );
}

describe('le fond d’un dialogue modal (D-169)', () => {
  it('rend la page inerte tant que le dialogue est ouvert, et la rend en se fermant', () => {
    const root = racine();
    const { unmount } = render(dialogue(true));

    // Le contrôle mord : sans `inert`, l'attribut n'est pas là et le clavier sort du dialogue.
    expect(root.hasAttribute('inert')).toBe(true);

    unmount();
    expect(root.hasAttribute('inert')).toBe(false);
    root.remove();
  });

  it('ne touche pas la page quand le dialogue est fermé', () => {
    const root = racine();
    const { unmount } = render(dialogue(false));

    // Le contrôle mord : `InertReste` posé dans `DialogContent` s'exécutait même fermé, et
    // l'accueil entier devenait inerte (le bouton « Ouvrir un Arrivage » ne recevait plus le clic).
    expect(root.hasAttribute('inert')).toBe(false);

    unmount();
    root.remove();
  });

  it('deux dialogues empilés ne rendent la page qu’au dernier fermé', () => {
    const root = racine();
    const premier = render(dialogue(true));
    const second = render(dialogue(true));

    expect(root.hasAttribute('inert')).toBe(true);
    premier.unmount();
    expect(root.hasAttribute('inert')).toBe(true);
    second.unmount();
    expect(root.hasAttribute('inert')).toBe(false);
    root.remove();
  });
});
