import { useEffect, useRef } from 'react';
import type { Attack, PlanqueCard } from '@/data/types';
import { choregraphie } from './attaque';
import { Moteur } from './moteur';

/** Ce qu'une scène joue : capturé **au déclenchement**, jamais relu ensuite. */
interface Lancee {
  id: number;
  carte: PlanqueCard;
  attaque: Attack;
  uid?: string;
  uidCible?: string;
  /** Le Stress réellement encaissé par la cible (Vulnérabilité comprise). */
  stress: number;
}

/**
 * **La scène d'attaque** (D-095) : deux `canvas` posés sur le plateau, un derrière les cartes
 * (halo, ombre) et un devant (trait, particules), plus les animations de carte par l'API
 * Web Animations.
 *
 * Le composant ne décide de **rien** : il joue la chorégraphie de l'attaque qu'on lui donne.
 * Sous « Mouvement réduit », il ne monte pas de moteur et ne joue rien : **le repli est
 * l'information immobile** — le chiffre de Stress, le badge de Condition nommé, la ligne du
 * journal et le bandeau « a craqué ». Aucune information ne vit dans l'animation, donc rien ne
 * se perd.
 *
 * **Sa durée de vie n'est pas celle de l'effet.** L'effet de combat vit 700 ms (`DUREE_ATTAQUE_MS`)
 * ; une chorégraphie en dure de 1,4 à 3,2 s. La scène est donc lancée par l'effet mais ne
 * s'arrête pas avec lui : elle tient sa propre fin, et seul le démontage ou un nouvel effet
 * l'interrompt. Le tirer l'un avec l'autre coupait la séquence en plein impact.
 */
export function SceneAttaque({
  effetId,
  uid,
  uidCible,
  stress,
  carte,
  attaque,
  sansMouvement,
}: {
  /** L'identifiant de l'effet d'attaque : un même effet ne se joue qu'une fois. */
  effetId?: number;
  /** L'attaquant. */
  uid?: string;
  /** La cible. */
  uidCible?: string;
  /** Le Stress encaissé par la cible, tel que l'effet `stress` le calcule. */
  stress?: number;
  carte?: PlanqueCard;
  attaque?: Attack;
  sansMouvement: boolean;
}) {
  const fondRef = useRef<HTMLCanvasElement>(null);
  const avantRef = useRef<HTMLCanvasElement>(null);
  const moteur = useRef<Moteur | null>(null);
  const joue = useRef<number | null>(null);
  const lancee = useRef<Lancee | null>(null);

  useEffect(() => {
    if (sansMouvement) return;
    const fond = fondRef.current;
    const avant = avantRef.current;
    const scene = fond?.parentElement;
    if (!fond || !avant || !scene) return;
    // Un environnement sans canvas 2D (jsdom, navigateur exotique) n'a pas de scène : les
    // tests de l'écran rendent le combat, et le repli est déjà le comportement par défaut.
    let m: Moteur;
    try {
      m = new Moteur(fond, avant, scene);
    } catch {
      return;
    }
    moteur.current = m;
    const surTaille = () => m.redimensionner();
    window.addEventListener('resize', surTaille);
    return () => {
      window.removeEventListener('resize', surTaille);
      m.arreter();
      moteur.current = null;
      joue.current = null;
      lancee.current = null;
    };
  }, [sansMouvement]);

  useEffect(() => {
    const m = moteur.current;
    if (sansMouvement || !m || !carte || !attaque || effetId === undefined) return;
    if (joue.current === effetId) return;
    lancee.current = { id: effetId, carte, attaque, uid, uidCible, stress: stress ?? 0 };
    joue.current = effetId;
  }, [effetId, uid, uidCible, stress, carte, attaque, sansMouvement]);

  // La lecture est séparée du déclenchement : elle ne dépend plus des props, donc la
  // disparition de l'effet (700 ms) n'interrompt plus la chorégraphie.
  useEffect(() => {
    const m = moteur.current;
    const cible = lancee.current;
    if (sansMouvement || !m || !cible) return;
    const scene = fondRef.current?.parentElement;
    if (!scene) return;
    const att = cible.uid
      ? scene.querySelector<HTMLElement>(`[data-uid="${CSS.escape(cible.uid)}"]`)
      : null;
    const cib = cible.uidCible
      ? scene.querySelector<HTMLElement>(`[data-uid="${CSS.escape(cible.uidCible)}"]`)
      : null;
    // Une carte déjà retirée (craquage, relève) n'a pas de cible à viser : l'animation du
    // craquage raconte déjà ce qui vient d'arriver.
    if (!att || !cib) return;
    // Arrêter **avant** de mesurer : une scène encore en cours laisserait les cartes déplacées,
    // et les positions de départ seraient fausses.
    m.arreter();
    const ch = choregraphie(cible.carte, cible.attaque, { m, att, cib, stress: cible.stress });
    m.jouer(ch.etapes, ch.duree, ch.cinematique ? 600 : 300);
  }, [effetId, sansMouvement]);

  if (sansMouvement) return null;
  return (
    <>
      <canvas className="scene-attaque scene-attaque--fond" ref={fondRef} aria-hidden="true" />
      <canvas className="scene-attaque scene-attaque--avant" ref={avantRef} aria-hidden="true" />
    </>
  );
}
