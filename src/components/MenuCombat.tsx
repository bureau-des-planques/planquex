import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowLeft, Ellipsis } from 'lucide-react';

/**
 * **Le menu unique du combat** (D-093, #191, `docs/SPEC-COMBAT-UI.md` §6.1) : un seul bouton
 * `⋯` dans la barre d'état, qui absorbe tout le secondaire — Journal, Partie à deux, Règles,
 * Abandonner, Nouveau combat. C'est ce qui libère la hauteur dont le plateau a besoin.
 *
 * Ce n'est **pas** un `role="menu"` : la Partie à deux contient des champs de saisie et des
 * boutons, et un menu ARIA n'en porte pas. C'est un **panneau de commande** qui montre **une
 * seule vue à la fois** (la liste, le Journal ou la Partie à deux) : « une seule surface ouverte
 * à la fois ».
 *
 * Le composant est **contrôlé** — la page décide d'ouvrir (la Partie à deux s'ouvre seule quand
 * un code est prêt) et de fermer (créer une partie rend la table au joueur). Il garde pour lui
 * ce qui est du clavier : Échap ferme et **rend le focus au bouton**, et quand la fermeture
 * vient d'ailleurs (le geste est fait, l'entrée cliquée a disparu) le focus ne reste pas perdu
 * sur `body`.
 */
export type VueMenu = 'racine' | 'journal' | 'pvp';

export interface EtatMenu {
  ouvert: boolean;
  vue: VueMenu;
}

/** Ce que le contenu du menu peut demander au panneau. */
export interface MenuApi {
  /** Passe à une autre vue ; le focus suit le titre de la vue, sinon il serait perdu. */
  aller: (vue: VueMenu) => void;
  fermer: () => void;
}

const TITRES: Record<VueMenu, string> = {
  racine: 'Menu du combat',
  journal: 'Journal',
  pvp: 'Partie à deux'
};

interface Props {
  etat: EtatMenu;
  onChange: (etat: EtatMenu) => void;
  children: (api: MenuApi) => ReactNode;
}

export function MenuCombat({ etat, onChange, children }: Props) {
  const idPanneau = useId();
  const racine = useRef<HTMLDivElement | null>(null);
  const bouton = useRef<HTMLButtonElement | null>(null);
  const titre = useRef<HTMLHeadingElement | null>(null);
  /** Vrai quand le joueur vient de changer de vue : seul ce geste déplace le focus. */
  const navigue = useRef(false);
  const etaitOuvert = useRef(false);

  const fermer = () => onChange({ ouvert: false, vue: 'racine' });
  const aller = (vue: VueMenu) => {
    navigue.current = true;
    onChange({ ouvert: true, vue });
  };

  useEffect(() => {
    if (!navigue.current) return;
    navigue.current = false;
    titre.current?.focus();
  }, [etat.vue]);

  useEffect(() => {
    // Fermé par un geste dont l'entrée a disparu avec le panneau : le focus revient au bouton.
    if (etaitOuvert.current && !etat.ouvert) {
      const actif = document.activeElement;
      if (!actif || actif === document.body) bouton.current?.focus();
    }
    etaitOuvert.current = etat.ouvert;
  }, [etat.ouvert]);

  const surTouche = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !etat.ouvert) return;
    // Un dialogue ouvert depuis le panneau (Règles) est dans l'arbre React du panneau mais
    // pas dans son DOM : son Échap ferme le dialogue, pas le menu.
    if (!racine.current?.contains(event.target as Node)) return;
    event.stopPropagation();
    fermer();
    bouton.current?.focus();
  };

  return (
    <div className="combat-menu" ref={racine} onKeyDown={surTouche}>
      <button
        type="button"
        ref={bouton}
        className="combat-menu__bouton"
        aria-label="Menu du combat"
        aria-expanded={etat.ouvert}
        aria-controls={idPanneau}
        onClick={() => (etat.ouvert ? fermer() : onChange({ ouvert: true, vue: 'racine' }))}
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>
      {etat.ouvert && (
        <section className="combat-menu__panneau panel" id={idPanneau} aria-label="Menu du combat">
          <header className="combat-menu__entete">
            {etat.vue !== 'racine' && (
              <button type="button" className="combat-menu__retour" onClick={() => aller('racine')}>
                <ArrowLeft size={16} aria-hidden="true" /> Retour au menu
              </button>
            )}
            <h2 className="combat-menu__titre" tabIndex={-1} ref={titre}>
              {TITRES[etat.vue]}
            </h2>
          </header>
          {children({ aller, fermer })}
        </section>
      )}
    </div>
  );
}
