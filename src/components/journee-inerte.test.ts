// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Inertie } from './journee-inerte';

/**
 * **Le fond est réellement inerte** (D-194 (1), D-195 (3), #778, critère 2) : les frères du chemin
 * qui mène à ce qu'on garde portent `inert` ; le chemin lui-même, non. jsdom ne connaît pas la
 * sémantique de `inert` (le focus), on lit l'attribut ; le navigateur confirme qu'un bouton inerte
 * ne prend pas le focus (preuve du ticket).
 */
function coquille() {
  document.body.innerHTML = `
    <div id="racine">
      <header id="entete"><a href="/settings" id="engrenage">Réglages</a></header>
      <main id="main">
        <section id="autre"><button id="bouton-autre">Ailleurs</button></section>
        <section id="page">
          <button id="cible" data-journee-cible="arrivage">Ouvrir un Arrivage</button>
          <button id="voisin">Voisin</button>
        </section>
      </main>
      <aside id="panneau" data-journee-panneau><button id="passer">Passer</button></aside>
      <div id="scene" class="journee__scene"></div>
      <nav id="barre"><a href="/">Accueil</a></nav>
    </div>`;
  const par = (id: string) => document.getElementById(id)!;
  return { racine: par('racine'), par };
}

describe('Inertie : tout sauf la Journée et sa cible (D-194 (1))', () => {
  it('rend inertes les frères du chemin, et laisse le chemin, la cible et la Journée vivants', () => {
    const { racine, par } = coquille();
    const inertie = new Inertie();
    inertie.appliquer(racine, [par('panneau'), par('scene'), par('cible')]);

    // Le fond : inerte.
    for (const id of ['entete', 'barre', 'autre', 'voisin']) {
      expect(par(id).hasAttribute('inert'), id).toBe(true);
    }
    // Le chemin vers la cible, la cible, le panneau et la scène : vivants.
    for (const id of ['main', 'page', 'cible', 'panneau', 'passer', 'scene']) {
      expect(par(id).hasAttribute('inert'), id).toBe(false);
    }
    // **Le contrôle mord** : un `inert` posé sur `main` (la façon courte) rendrait la cible inerte
    // avec lui, et cette ligne tomberait.
    expect(par('cible').closest('[inert]')).toBeNull();
    expect(par('engrenage').closest('[inert]')).toBe(par('entete'));
  });

  it('sans cible, tout ce qui n’est pas la Journée est inerte, `main` compris', () => {
    const { racine, par } = coquille();
    const inertie = new Inertie();
    inertie.appliquer(racine, [par('panneau'), par('scene'), null]);
    expect(par('main').hasAttribute('inert')).toBe(true);
    expect(par('entete').hasAttribute('inert')).toBe(true);
    expect(par('barre').hasAttribute('inert')).toBe(true);
    expect(par('panneau').hasAttribute('inert')).toBe(false);
    expect(par('scene').hasAttribute('inert')).toBe(false);
  });

  it('se rejoue : une cible qui change libère l’ancien chemin et prend le nouveau', () => {
    const { racine, par } = coquille();
    const inertie = new Inertie();
    inertie.appliquer(racine, [par('panneau'), par('scene'), par('cible')]);
    expect(par('autre').hasAttribute('inert')).toBe(true);
    expect(par('page').hasAttribute('inert')).toBe(false);

    inertie.appliquer(racine, [par('panneau'), par('scene'), par('bouton-autre')]);
    expect(par('autre').hasAttribute('inert')).toBe(false);
    expect(par('page').hasAttribute('inert')).toBe(true);
    expect(par('voisin').hasAttribute('inert')).toBe(false);
    expect([...inertie.inertes].map((element) => element.id).sort()).toEqual(['barre', 'entete', 'page']);
  });

  it('lever rend la page à elle-même, sans toucher à un `inert` qui n’est pas le sien', () => {
    const { racine, par } = coquille();
    // Un dialogue a déjà rendu `autre` inerte : ce n'est pas à la Journée de le lever.
    par('autre').setAttribute('inert', '');
    const inertie = new Inertie();
    inertie.appliquer(racine, [par('panneau'), par('scene'), par('cible')]);
    expect(inertie.inertes.has(par('autre'))).toBe(false);

    inertie.lever();
    expect(racine.querySelectorAll('[inert]')).toHaveLength(1);
    expect(par('autre').hasAttribute('inert')).toBe(true);
    expect(inertie.inertes.size).toBe(0);
  });

  it('ignore un élément à garder qui n’est pas sous la racine', () => {
    const { racine, par } = coquille();
    const dehors = document.createElement('button');
    document.body.appendChild(dehors);
    const inertie = new Inertie();
    inertie.appliquer(racine, [par('panneau'), dehors]);
    expect(dehors.hasAttribute('inert')).toBe(false);
    expect(par('main').hasAttribute('inert')).toBe(true);
    dehors.remove();
  });
});
