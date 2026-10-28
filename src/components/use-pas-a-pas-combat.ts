import { useCallback, useEffect, useState } from 'react';
import { ETAPES_COMBAT } from '@/components/pas-a-pas-combat-etapes';
import type { CibleCombat, EtapeCombat } from '@/components/pas-a-pas-combat-etapes';
import { useStore } from '@/store/useStore';

/**
 * L'état du **pas-à-pas du premier combat** (#143) : quel cran est affiché, et quand
 * le montrer.
 *
 * Il vit ici, et **une seule fois**, pour trois raisons :
 *
 * 1. **un seul écrivain du drapeau** — `terminer` est le seul endroit qui écrit
 *    `pasAPasCombatVu` ; la croix, « Passer », « Terminer » et le dernier « Suivant »
 *    y passent tous. Un second écrivain le remontrerait aussitôt, ou le perdrait ;
 * 2. la page de combat a besoin des **cibles** de l'étape courante (pour les mettre en
 *    avant) et le panneau a besoin de l'étape : les deux lisent la même source, donc
 *    ils ne peuvent pas se contredire ;
 * 3. le pas-à-pas ne se montre **pas avant que la Journée d'intégration soit finie**
 *    (`tutorielVu`) : la visite du premier lancement est un dialogue modal, et
 *    superposer un second tutoriel par-dessus le premier serait illisible. La Journée
 *    finit justement par « Aller au combat » — le pas-à-pas prend donc le relais.
 *
 * `force` est le **combat guidé** (#272) : le même pas-à-pas, ouvert à la demande depuis
 * Réglages ou la présentation des règles, même quand le drapeau dit « déjà vu ». Il se
 * referme localement (`terminer`) et n'écrit pas le drapeau du store : rejouer le
 * tutoriel ne retire pas le pas-à-pas de la première vraie partie.
 */
export interface PasAPasCombatEtat {
  /** Vrai tant que le pas-à-pas est à l'écran. */
  readonly ouvert: boolean;
  /** L'étape affichée, de 0 à `ETAPES_COMBAT.length - 1`. */
  readonly etape: number;
  /** L'étape courante, telle que les données la déclarent. */
  readonly courante: EtapeCombat;
  /** Vrai sur la dernière étape : le bouton de fin y change de libellé. */
  readonly derniere: boolean;
  /**
   * Les cibles de l'étape courante, séparées par des espaces — la valeur de
   * `data-pas-a-pas-cibles` sur la page. **Vide quand le pas-à-pas est fermé** : le
   * sélecteur d'attribut `~=` ne peut alors rien mettre en avant.
   */
  readonly cibles: string;
  /**
   * La valeur de `data-pas-a-pas` d'un élément : `cible` quand l'étape courante la
   * **désigne**, `undefined` sinon. L'appartenance est **exacte** — `'poste'` n'est pas
   * dans `'poste-actions'` —, ce que la recherche d'une sous-chaîne dans `cibles` ne
   * garantissait pas. Le contour de `styles.css` ne s'applique qu'aux éléments qui
   * portent l'attribut : un élément non désigné n'a donc **jamais** de contour.
   */
  readonly designe: (cible: CibleCombat) => CibleCombat | undefined;
  readonly suivante: () => void;
  readonly precedente: () => void;
  /**
   * La seule sortie : elle écrit le drapeau, et remet l'étape à zéro pour que la
   * réouverture depuis Réglages reparte du début.
   */
  readonly terminer: () => void;
}

/**
 * Le défilement de l'écran de combat : **animé**, sauf si le système (`prefers-reduced-motion`)
 * ou le réglage « Mouvement réduit » de l'application demandent un saut net. Lu à l'appel,
 * jamais en dépendance d'effet : changer le réglage ne doit pas refaire défiler la page.
 */
export function comportementDeDefilement(): ScrollBehavior {
  const reduit =
    useStore.getState().reducedMotion ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reduit ? 'auto' : 'smooth';
}

export function usePasAPasCombat(force = false): PasAPasCombatEtat {
  const tutorielVu = useStore((state) => state.tutorielVu);
  const pasAPasCombatVu = useStore((state) => state.pasAPasCombatVu);
  const setPasAPasCombatVu = useStore((state) => state.setPasAPasCombatVu);
  const [etape, setEtape] = useState(0);
  /**
   * Le **combat guidé** (#272) : la page ouvre le pas-à-pas même quand le drapeau dit
   * « déjà vu ». `termine` referme **ce** combat seulement — l'état est local, et le
   * drapeau du store n'est **pas** réécrit : rejouer le tutoriel ne prive pas la première
   * vraie partie de son pas-à-pas. Un seul écrivain du drapeau, donc, comme avant.
   */
  const [termine, setTermine] = useState(false);

  const ouvert = force ? !termine : !pasAPasCombatVu && tutorielVu;
  const index = Math.min(etape, ETAPES_COMBAT.length - 1);
  const courante = ETAPES_COMBAT[index];

  const terminer = useCallback(() => {
    if (force) {
      setTermine(true);
      setEtape(0);
      return;
    }
    setPasAPasCombatVu(true);
    setEtape(0);
  }, [force, setPasAPasCombatVu]);

  const suivante = useCallback(() => {
    setEtape((courant) => Math.min(courant + 1, ETAPES_COMBAT.length - 1));
  }, []);

  const precedente = useCallback(() => {
    setEtape((courant) => Math.max(courant - 1, 0));
  }, []);

  /**
   * **Désigner, c'est amener l'élément sous les yeux.** Sur un téléphone (420 × 900,
   * D-060), le panneau est en haut et la cible parfois bien plus bas : une étape qui la
   * nomme sans l'amener à l'écran ne la désigne pas (#169). À chaque changement d'étape,
   * « Suivant » comme « Précédent », on amène donc la **première** cible **en haut** de
   * l'écran, **sous** le panneau.
   *
   * Pas au centre (#170) : centrer le plateau laissait la main sous la barre de
   * navigation sur un téléphone. En haut, la cible descend dans l'écran et la console
   * qui suit (actions, main) reste visible. La marge qui la garde sous le panneau est la
   * hauteur réelle du panneau (`--pas-a-pas-hauteur`, `styles.css` → `scroll-margin-top`) :
   * elle suit le repli du détail, sans nombre recopié.
   *
   * Le défilement est **animé**, sauf demande contraire : `prefers-reduced-motion` du
   * système **ou** le réglage « Mouvement réduit » de l'application donnent un saut net
   * (`'auto'`). La valeur se lit **dans l'effet**, pas en dépendance : changer le réglage
   * ne doit pas refaire défiler la page.
   */
  useEffect(() => {
    if (!ouvert) return;
    const cible = courante.cibles[0];
    if (!cible) return;
    const panneau = document.querySelector<HTMLElement>('.pas-a-pas');
    if (panneau) {
      document.documentElement.style.setProperty('--pas-a-pas-hauteur', `${panneau.offsetHeight}px`);
    }
    document.querySelector(`[data-pas-a-pas="${cible}"]`)?.scrollIntoView({
      behavior: comportementDeDefilement(),
      block: 'start'
    });
  }, [ouvert, courante]);

  const designe = useCallback(
    (cible: CibleCombat) => (ouvert && courante.cibles.includes(cible) ? cible : undefined),
    [ouvert, courante]
  );

  return {
    ouvert,
    etape: index,
    courante,
    derniere: index === ETAPES_COMBAT.length - 1,
    cibles: ouvert ? courante.cibles.join(' ') : '',
    designe,
    suivante,
    precedente,
    terminer
  };
}
