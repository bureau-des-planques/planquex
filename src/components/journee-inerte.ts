/**
 * **Le fond est réellement inerte** (D-194 (1), D-195 (3), #778).
 *
 * D-160 (3) rendait la page inerte par un écouteur de pointeur : le clic n'arrivait pas, mais
 * `Tab` passait, un lecteur d'écran lisait tout, et un `aria-modal` aurait menti (D-162 (1)).
 * L'attribut `inert` fait ce que l'écouteur promettait : plus de focus, plus de clic, plus
 * de lecture — par le navigateur, pas par du code.
 *
 * `inert` ne se lève pas sur un descendant : on ne peut pas rendre `main` inerte **et** garder
 * la cible cliquable dedans. On rend donc inertes les **frères** de chaque nœud du chemin qui va
 * d'un élément à garder jusqu'à la racine — le motif des pièges à focus, appliqué à l'inverse.
 * Ce qui reste vivant : le panneau, la scène du Chef de cabinet, et la cible que la Journée
 * désigne, avec leurs ancêtres. Tout le reste de la coquille porte `inert`.
 *
 * L'écouteur de pointeur de `JourneeIntegration` reste en seconde ligne : un frère qui
 * apparaît entre deux passes (un rendu paresseux, #478) n'est pas inerte avant la passe
 * suivante, et le clic ne doit pas arriver pour autant.
 */
export class Inertie {
  /** Les éléments que **cette** instance a rendus inertes : on ne retire jamais l'`inert` d'un autre. */
  private marques = new Set<Element>();

  /**
   * Rend inerte tout ce qui, sous `racine`, n'est ni l'un des éléments `garder`, ni l'un de
   * leurs ancêtres, ni l'un de leurs descendants. Rejouable : un élément qui n'est plus à
   * rendre inerte perd l'attribut, un nouveau le prend.
   */
  appliquer(racine: Element, garder: readonly (Element | null)[]): void {
    const vivants = new Set<Element>();
    for (const element of garder) {
      if (!element || !racine.contains(element)) continue;
      for (let noeud: Element | null = element; noeud && noeud !== racine; noeud = noeud.parentElement) {
        vivants.add(noeud);
      }
    }

    const voulus = new Set<Element>();
    for (const vivant of vivants) {
      const parent = vivant.parentElement;
      if (!parent) continue;
      for (const frere of parent.children) {
        if (!vivants.has(frere)) voulus.add(frere);
      }
    }
    // Aucun élément à garder sous la racine : tout ce qu'elle contient est inerte.
    if (vivants.size === 0) {
      for (const enfant of racine.children) voulus.add(enfant);
    }

    for (const marque of this.marques) {
      if (!voulus.has(marque)) {
        marque.removeAttribute('inert');
        this.marques.delete(marque);
      }
    }
    for (const voulu of voulus) {
      if (this.marques.has(voulu)) continue;
      // Un `inert` posé par un autre (un dialogue, une scène) n'est pas le nôtre : on le laisse.
      if (voulu.hasAttribute('inert')) continue;
      voulu.setAttribute('inert', '');
      this.marques.add(voulu);
    }
  }

  /** Rend la page à elle-même : chaque élément marqué perd son `inert`. */
  lever(): void {
    for (const marque of this.marques) marque.removeAttribute('inert');
    this.marques.clear();
  }

  /** Les éléments inertes du fait de cette instance, pour les tests. */
  get inertes(): ReadonlySet<Element> {
    return this.marques;
  }
}
