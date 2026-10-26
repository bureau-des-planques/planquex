import { useEffect, useRef } from 'react';
import type { Attack, PlanqueCard } from '@/data/types';
import { choregraphie } from './attaque';
import { Moteur } from './moteur';
import type { Stats } from './moteur';

/** Ce qu'une scène joue : capturé **au déclenchement**, jamais relu ensuite. */
interface Lancee {
  id: number;
  carte: PlanqueCard;
  attaque: Attack;
  uid?: string;
  uidCible?: string;
  /** Le Stress réellement encaissé par la cible (Vulnérabilité comprise). */
  stress: number;
  coupDeGrace: boolean;
}

/** La copie de la carte qui craque, posée par la scène et retirée à sa fin. */
interface Doublure {
  /** Le conteneur posé sur le plateau : il porte la place vide et la carte. */
  el: HTMLElement;
  /** La carte copiée : c'est elle que la chorégraphie vise, anime et fait partir. */
  carte: HTMLElement;
  /** Le fantôme du plateau, caché pendant que sa copie joue. */
  source: HTMLElement | null;
}

/** Le gabarit d'une carte : 63 × 88 (`CARD-SPEC.md`). */
const RAPPORT_CARTE = 88 / 63;

/**
 * Pose la doublure **à la place de la carte**. Quand un Poste se vide, il se referme sur son
 * texte (« Poste libre ») : son rectangle ne fait plus la taille d'une carte, donc on le redresse
 * autour de son centre, et la saynète vise un vrai Planqué et non une bande de vingt pixels.
 */
function poserDoublure(
  m: Moteur,
  scene: HTMLElement,
  poste: HTMLElement,
  fantome: HTMLElement | null,
): Doublure {
  const r = m.rect(poste);
  const h = Math.max(r.h, r.w * RAPPORT_CARTE);
  // Un Poste refermé n'a plus la hauteur d'une carte : la carte, elle, était **en haut de sa ligne**
  // (la ligne était aussi haute qu'elle). On reprend donc le haut de la ligne, pas le centre du reste.
  const ligne = poste.closest<HTMLElement>(".board__poste-ligne");
  const replie = r.h < r.w * RAPPORT_CARTE * 0.9;
  const haut = replie && ligne ? m.rect(ligne).y : r.y;
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.dataset.doublure = "";
  Object.assign(el.style, {
    position: "absolute",
    left: `${r.x}px`,
    top: `${haut}px`,
    width: `${r.w}px`,
    height: `${h}px`,
    zIndex: "5",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  const carte = document.createElement("div");
  Object.assign(carte.style, { position: "absolute", inset: "0" } satisfies Partial<CSSStyleDeclaration>);
  if (fantome) {
    // Le fantôme est la carte **sans** son voile gris : la copie la montre en couleur jusqu'à l'impact.
    // Il n'y a **pas de fond** derrière elle : la relève, que le combat pose au même Poste, reste
    // visible dès que la carte est partie.
    for (const enfant of Array.from(fantome.children)) carte.appendChild(enfant.cloneNode(true));
    fantome.style.visibility = "hidden";
  }
  el.append(carte);
  scene.appendChild(el);
  return { el, carte, source: fantome };
}

function retirerDoublure(ref: { current: Doublure | null }) {
  const d = ref.current;
  if (!d) return;
  d.el.remove();
  d.source?.style.removeProperty("visibility");
  ref.current = null;
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
  coupDeGrace = false,
  carte,
  attaque,
  sansMouvement,
  onMoteur,
  surFin,
}: {
  /** L'identifiant de l'effet d'attaque : un même effet ne se joue qu'une fois. */
  effetId?: number;
  /** L'attaquant. */
  uid?: string;
  /** La cible. */
  uidCible?: string;
  /** Le Stress encaissé par la cible, tel que l'effet `stress` le calcule. */
  stress?: number;
  /** La Pression fait craquer la cible : la scène joue sa saynète de sortie. */
  coupDeGrace?: boolean;
  carte?: PlanqueCard;
  attaque?: Attack;
  sansMouvement: boolean;
  /** Le moteur monté (ou `null` au démontage) : le banc d'essai y règle la vitesse et lit l'horloge. */
  onMoteur?: (m: Moteur | null) => void;
  /** Appelé quand la chorégraphie va au bout, après le nettoyage de la scène. */
  surFin?: (stats: Stats) => void;
}) {
  const fondRef = useRef<HTMLCanvasElement>(null);
  const avantRef = useRef<HTMLCanvasElement>(null);
  const moteur = useRef<Moteur | null>(null);
  const joue = useRef<number | null>(null);
  const lancee = useRef<Lancee | null>(null);
  const doublure = useRef<Doublure | null>(null);

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
    onMoteur?.(m);
    const surTaille = () => m.redimensionner();
    window.addEventListener('resize', surTaille);
    return () => {
      window.removeEventListener('resize', surTaille);
      m.arreter();
      retirerDoublure(doublure);
      onMoteur?.(null);
      moteur.current = null;
      joue.current = null;
      lancee.current = null;
    };
  }, [sansMouvement]);

  useEffect(() => {
    const m = moteur.current;
    if (sansMouvement || !m || !carte || !attaque || effetId === undefined) return;
    if (joue.current === effetId) return;
    lancee.current = {
      id: effetId,
      carte,
      attaque,
      uid,
      uidCible,
      stress: stress ?? 0,
      coupDeGrace,
    };
    joue.current = effetId;
  }, [effetId, uid, uidCible, stress, coupDeGrace, carte, attaque, sansMouvement]);

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
    const visee = cible.uidCible
      ? scene.querySelector<HTMLElement>(`[data-uid="${CSS.escape(cible.uidCible)}"]`)
      : null;
    // **Le coup de grâce** : la carte a quitté le plateau pour le Rebut, mais son fantôme
    // désaturé est encore là — c'est lui que la scène vise, et c'est lui qui part.
    const fantome = cible.coupDeGrace
      ? scene.querySelector<HTMLElement>(".craquage__carte")
      : null;
    // Le fantôme ne vit que 500 ms (`DUREE_TRAINEE_MS`) ; la Pression, elle, frappe plus tard.
    // À défaut de carte, la **zone du Poste** adverse reste : c'est là que le carton et le
    // tampon se posent, et c'est la place que la carte vient de quitter.
    const posteVide = cible.coupDeGrace
      ? ([...scene.querySelectorAll<HTMLElement>(".board__poste")].find(
          (poste) => !poste.contains(att),
        ) ?? null)
      : null;
    let cib = visee ?? fantome ?? posteVide;
    // Une carte déjà retirée sans fantôme (relève, craquage au Banc) n'a pas de cible à viser.
    if (!att || !cib) return;
    // Arrêter **avant** de mesurer : une scène encore en cours laisserait les cartes déplacées,
    // et les positions de départ seraient fausses.
    m.arreter();
    retirerDoublure(doublure);
    // **La doublure** : la carte a déjà quitté le Poste quand la Pression part, et son fantôme
    // s'éteint en 500 ms — avant l'impact. Sans elle, le coup de grâce se jouerait sur une table
    // vide. La scène pose donc sa propre copie de la carte, de la taille d'une carte même si le
    // Poste s'est refermé, et c'est **elle** qui encaisse, craque et part au carton.
    if (cible.coupDeGrace) {
      const poste = cib.closest<HTMLElement>(".board__poste") ?? cib;
      const copie = poserDoublure(m, scene, poste, fantome ?? (cib === poste ? null : cib));
      doublure.current = copie;
      cib = copie.carte;
    }
    const ch = choregraphie(cible.carte, cible.attaque, {
      m,
      att,
      cib,
      stress: cible.stress,
      coupDeGrace: cible.coupDeGrace,
    });
    m.surFin = (stats) => {
      retirerDoublure(doublure);
      surFin?.(stats);
    };
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
