import { useCallback, useEffect, useState } from 'react';
import { ETAPES_COMBAT } from '@/components/pas-a-pas-combat-etapes';
import type { EtapeCombat } from '@/components/pas-a-pas-combat-etapes';
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
  readonly suivante: () => void;
  readonly precedente: () => void;
  /**
   * La seule sortie : elle écrit le drapeau, et remet l'étape à zéro pour que la
   * réouverture depuis Réglages reparte du début.
   */
  readonly terminer: () => void;
}

export function usePasAPasCombat(): PasAPasCombatEtat {
  const tutorielVu = useStore((state) => state.tutorielVu);
  const pasAPasCombatVu = useStore((state) => state.pasAPasCombatVu);
  const setPasAPasCombatVu = useStore((state) => state.setPasAPasCombatVu);
  const [etape, setEtape] = useState(0);

  const ouvert = !pasAPasCombatVu && tutorielVu;
  const index = Math.min(etape, ETAPES_COMBAT.length - 1);
  const courante = ETAPES_COMBAT[index];

  const terminer = useCallback(() => {
    setPasAPasCombatVu(true);
    setEtape(0);
  }, [setPasAPasCombatVu]);

  const suivante = useCallback(() => {
    setEtape((courant) => Math.min(courant + 1, ETAPES_COMBAT.length - 1));
  }, []);

  const precedente = useCallback(() => {
    setEtape((courant) => Math.max(courant - 1, 0));
  }, []);

  /**
   * **Désigner, c'est amener l'élément sous les yeux.** Sur un téléphone (420 × 900,
   * D-060), le Poste est sous la ligne de flottaison : une étape qui le nomme sans
   * l'amener à l'écran ne le désigne pas. On cadre donc la **première** cible de
   * l'étape — les autres sont dans le même voisinage.
   *
   * `behavior: 'auto'` plutôt que `'smooth'`, à dessein : un saut net ne dépend pas de
   * `prefers-reduced-motion`, et une capture prise pendant un défilement animé ne
   * montrerait pas l'écran qu'elle nomme (#153).
   */
  useEffect(() => {
    if (!ouvert) return;
    const cible = courante.cibles[0];
    if (!cible) return;
    document.querySelector(`[data-pas-a-pas="${cible}"]`)?.scrollIntoView({
      behavior: 'auto',
      block: 'center'
    });
  }, [ouvert, courante]);

  return {
    ouvert,
    etape: index,
    courante,
    derniere: index === ETAPES_COMBAT.length - 1,
    cibles: ouvert ? courante.cibles.join(' ') : '',
    suivante,
    precedente,
    terminer
  };
}
