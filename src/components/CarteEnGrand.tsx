import { useLayoutEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { BattleAction, Card } from '@/data/types';
import { CardView } from '@/components/CardView';
import { Dialog, DialogPanneau, DialogPortal } from '@/components/ui/dialog';

/**
 * **La carte choisie, en grand** (ticket #745, retour du propriétaire, Pokémon TCG Pocket).
 *
 * Toucher une carte de la main l'agrandit au centre de la table, avec son texte et ses gestes
 * **dedans** : le panneau de pose sous la main n'existe plus. C'est un panneau **non modal**
 * (`DialogPanneau`, sans voile ni piège de focus) : le Banc reste touchable. Échap et « Reprendre »
 * le ferment, et le focus revient à la carte de la main. Un toucher hors du panneau ne le ferme
 * pas : une place libre du Banc, touchée à côté, doit encore poser la carte.
 */

/** Ce que l'écran lit d'une carte au moment du vol : sa place à l'écran, et sa face. */
export interface EnvolDeCarte {
  /** Un identifiant par vol : deux poses de suite ne réutilisent pas la même animation. */
  id: number;
  /** La place de la carte **avant** le geste (la feuille, ou la carte de la main). */
  depart: { left: number; top: number; width: number; height: number };
  /** La carte à faire voler : la définition, pour la rendre en gabarit. */
  carte: Card;
  /** Le geste joué : il dit où la carte atterrit (`cibleDuVol`). */
  action: BattleAction;
}

/**
 * **La cible du vol** : l'élément du plateau où le geste pose la carte, ou `null` quand le geste
 * n'a pas de place sur la table (un Objet, une Priorité : la carte se réduit sur place). Le plateau
 * marque ses places (`data-envol`, `src/combat/plateau.tsx`) ; une évolution se lit sur la cible
 * `data-uid` (le Planqué remplacé).
 */
export function cibleDuVol(action: BattleAction): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (action.type === 'playBasic') {
    const repere = action.slot === 'active' ? 'poste' : `banc-${action.slot}`;
    return document.querySelector<HTMLElement>(`[data-envol="${repere}"]`);
  }
  if (action.type === 'evolve') {
    return (
      [...document.querySelectorAll<HTMLElement>('[data-uid]')].find((el) => el.dataset.uid === action.targetUid) ??
      null
    );
  }
  return null;
}

/**
 * **La feuille** : la carte choisie, grande, avec ses gestes. Elle se pose au centre, sans voile.
 * Elle ne défile jamais la page : elle tient dans la fenêtre (`styles.css`, `.carte-grand`).
 */
export function CarteEnGrand({
  carte,
  nom,
  genre,
  fiche,
  gestes,
  finalFocus,
  onFermer
}: {
  carte: Card;
  /** Le nom entier, lu par le lecteur d'écran avec le titre du panneau. */
  nom: string;
  /** Le genre de la carte (« Objet », « Collègue », « Planqué »…), écrit à côté du nom. */
  genre: string;
  /** La fiche lisible de la carte (un Planqué) ou son texte (les autres cartes). */
  fiche: ReactNode;
  /** Les gestes de la carte, ou le mot qui dit pourquoi aucun n'est offert. */
  gestes: ReactNode;
  /** Où rendre le focus à la fermeture : la carte de la main, si elle est encore là. */
  finalFocus: () => HTMLElement | null;
  onFermer: () => void;
}) {
  const repere = useRef<HTMLDivElement | null>(null);
  const titre: RefObject<HTMLParagraphElement | null> = useRef(null);

  return (
    <>
      {/* Le repère du portail : la feuille est rendue **dans** `.battle` (ses jetons de carte y vivent). */}
      <div className="carte-grand-repere" ref={repere} />
      {/* Un toucher hors de la feuille ne la ferme pas : la place libre du Banc, touchée à côté, doit encore poser la carte. */}
      <Dialog modal={false} open disablePointerDismissal onOpenChange={(ouvert) => !ouvert && onFermer()}>
        <DialogPortal container={repere}>
          <DialogPanneau
            className="carte-grand"
            aria-label="Poser la carte choisie"
            initialFocus={titre}
            finalFocus={finalFocus}
          >
            <p className="carte-grand__titre" tabIndex={-1} ref={titre}>
              <span className="muted">Carte choisie</span> <strong>{nom}</strong>{' '}
              <span className="hand__kind">{genre}</span>
            </p>
            <div className="carte-grand__visuel" aria-hidden="true">
              <CardView card={carte} />
            </div>
            {fiche}
            <section className="carte-grand__gestes" aria-label="Gestes de cette carte">
              {gestes}
            </section>
            <button type="button" className="link-button" onClick={onFermer}>
              Reprendre une autre carte
            </button>
          </DialogPanneau>
        </DialogPortal>
      </Dialog>
    </>
  );
}

/**
 * **La carte qui vole** (ticket #745) : la copie de la carte choisie, qui se réduit et glisse vers
 * sa place sur la table. C'est de la mise en scène : le geste du moteur est déjà joué au moment
 * où elle part, et elle ne le retarde ni ne le rejoue. Transform et opacité seuls (composés).
 * Sans `animate` (jsdom, navigateurs anciens) ou sans cible, elle finit tout de suite.
 */
export const DUREE_DU_VOL_MS = 600;

export function CarteEnVol({ vol, onFini, children }: { vol: EnvolDeCarte; onFini: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  // `onFini` change à chaque rendu du parent : on le lit à part, pour que l'animation ne reparte pas.
  const fin = useRef(onFini);
  useLayoutEffect(() => {
    fin.current = onFini;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let termine = false;
    const finir = () => {
      if (termine) return;
      termine = true;
      fin.current();
    };
    if (typeof el.animate !== 'function') {
      finir();
      return undefined;
    }
    // La cible est mesurée **après** le geste : le plateau montre déjà la carte posée à sa place.
    const cible = cibleDuVol(vol.action)?.getBoundingClientRect() ?? null;
    const { depart } = vol;
    const dx = cible ? cible.left + cible.width / 2 - (depart.left + depart.width / 2) : 0;
    const dy = cible ? cible.top + cible.height / 2 - (depart.top + depart.height / 2) : 0;
    const echelle = cible && depart.width > 0 ? Math.min(1, cible.width / depart.width) : 0.4;
    const animation = el.animate(
      [
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${echelle})`, opacity: cible ? 1 : 0 }
      ],
      { duration: DUREE_DU_VOL_MS, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' }
    );
    animation.onfinish = finir;
    // Filet de sécurité : un onglet en arrière-plan peut ne jamais finir l'animation.
    const minuterie = window.setTimeout(finir, DUREE_DU_VOL_MS + 200);
    return () => {
      window.clearTimeout(minuterie);
      animation.onfinish = null;
      animation.cancel();
    };
  }, [vol]);

  return (
    <div
      ref={ref}
      className="carte-vol"
      aria-hidden="true"
      style={{
        left: `${vol.depart.left}px`,
        top: `${vol.depart.top}px`,
        width: `${vol.depart.width}px`,
        height: `${vol.depart.height}px`
      }}
    >
      {children}
    </div>
  );
}
