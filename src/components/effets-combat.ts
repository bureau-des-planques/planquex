import { useEffect, useRef, useState } from 'react';
import type { BattleState, CardInstance, PlayerId } from '@/data/types';

/**
 * **Les effets de la référence, bornés** (D-093, `SPEC-COMBAT-UI` §6.8, #192).
 *
 * Un effet ne dit **jamais** une information seul : le Stress est déjà écrit sur la carte,
 * l'Intervention déjà remplie, le craquage déjà au journal et dans le bandeau. Ce module ne
 * fait que calculer **ce qui vient de changer** entre deux états, et le composant décide de
 * la surface qui le montre — ou de son repli immobile.
 *
 * Les bornes sont ici, pas dans le CSS, parce que le compteur doit pouvoir refuser un
 * cinquième effet : `MAX_EFFETS_SIMULTANES` est un refus, pas une consigne de style.
 */

/** Le chiffre de Stress : 500 ms (T10), une fois, puis retiré du DOM. */
export const DUREE_STRESS_MS = 500;

/** La traînée de craquage : une seule, courte. */
export const DUREE_TRAINEE_MS = 500;

/** La pile de Deck qui s'allume à la pioche. */
export const DUREE_PIOCHE_MS = 150;

/** Le rebond d'un hexagone d'Intervention. */
export const DUREE_INTERVENTION_MS = 200;

/** `SPEC-COMBAT-UI` §6.8 borne 5 : au plus quatre éléments animés à la fois. */
export const MAX_EFFETS_SIMULTANES = 4;

/** Aucune boucle de plus de deux tours (`SPEC-COMBAT-UI` §6.8 borne 2). */
export const MAX_TOURS_BOUCLE = 2;

/** Aucun effet ne dépasse 800 ms (`SPEC-COMBAT-UI` §6.8 borne 3). */
export const DUREE_MAX_MS = 800;

/**
 * **La Pression en quatre temps** (#207, direction §8.2) : anticipation, trait, impact et
 * après forment **un seul** effet — s'ils étaient quatre, la séquence mangerait à elle seule
 * le plafond de quatre effets simultanés. `condition` est l'après : le badge nommé qui
 * apparaît.
 */
// L'attaque dure le temps de sa séquence, pas celui du trait seul : l'impact part à 550 ms
// (direction §8.4) et finit à 700 ms. Avec 350 ms, l'effet serait retiré avant l'impact.
export const DUREE_ATTAQUE_MS = 700;
/**
 * L'arc d'une Condition posée (#294) : un liseré qui pulse **deux fois** 120 ms, soit 240 ms —
 * la durée **totale** de l'animation (`condition-arc`, `styles.css`), pas celle d'un battement.
 * Le nœud vit exactement ce temps puis quitte le DOM ; le badge nommé, lui, reste.
 */
export const DUREE_CONDITION_MS = 240;

/**
 * Quand la Condition vient **d'une Pression**, l'arc attend l'impact : le coup part, touche à
 * 550 ms (direction §8.4), et c'est alors que la Condition se pose. Sans ce délai, le liseré
 * s'allumerait autour d'une carte que le coup n'a pas encore atteinte. 550 + 240 = 790 ms : le
 * nœud reste sous la borne de 800 ms (`DUREE_MAX_MS`).
 */
export const DELAI_IMPACT_MS = 550;
export const DUREE_CONDITION_APRES_COUP_MS = DELAI_IMPACT_MS + DUREE_CONDITION_MS;

export type NatureEffet = 'stress' | 'craquage' | 'pioche' | 'intervention' | 'attaque' | 'condition';

export interface EffetCombat {
  readonly id: number;
  readonly nature: NatureEffet;
  /** La durée que le composant applique : toujours `<= DUREE_MAX_MS`. */
  readonly duree: number;
  /** Faux sous « Mouvement réduit » : le nœud reste, sans animation. */
  readonly anime: boolean;
  /** Le camp touché (Stress, craquage, pioche, Intervention). */
  readonly camp?: PlayerId;
  /** L'instance touchée (Stress, craquage). */
  readonly uid?: string;
  /** La valeur du Stress qui monte. */
  readonly valeur?: number;
  /** Le numéro de l'Intervention acquise (1 à 3). */
  readonly numero?: number;
  /** Le dernier état connu de la carte : la traînée de craquage la désature même sortie. */
  readonly carte?: CardInstance;
  /** La carte était au Poste : le chiffre peut rester à sa place quand elle a quitté le jeu. */
  readonly auPoste?: boolean;
  /** L'attaque : la carte visée. Le trait relie l'attaquant à elle (nature `attaque`). */
  readonly uidCible?: string;
  /** Une Condition posée par la Pression de ce même pas : l'arc attend l'impact (`DELAI_IMPACT_MS`). */
  readonly apresCoup?: boolean;
  /** La Pression jouée, son rang dans la carte : la chorégraphie en dépend (D-098). */
  readonly attackIndex?: number;
  /**
   * Le Stress **réellement encaissé** par la cible de cette Pression, et si elle a craqué.
   * Ils voyagent **sur l'attaque** et non comme des effets séparés : le plafond de quatre
   * refuserait le Stress ou le craquage de la cible avant qu'ils n'arrivent, et la scène
   * jouerait un coup sans impact (D-098).
   */
  readonly stressCible?: number;
  readonly cibleCraque?: boolean;
}

export function dureeEffet(nature: NatureEffet): number {
  switch (nature) {
    case 'stress':
      return DUREE_STRESS_MS;
    case 'craquage':
      return DUREE_TRAINEE_MS;
    case 'pioche':
      return DUREE_PIOCHE_MS;
    case 'intervention':
      return DUREE_INTERVENTION_MS;
    case 'attaque':
      return DUREE_ATTAQUE_MS;
    case 'condition':
      return DUREE_CONDITION_MS;
  }
}

/**
 * Ajoute un effet **si la place existe**. La cinquième demande est **refusée** : elle rend
 * la liste inchangée, sans lever et sans faire attendre le geste suivant.
 */
export function ajouterEffet(courants: EffetCombat[], effet: EffetCombat): EffetCombat[] {
  if (courants.length >= MAX_EFFETS_SIMULTANES) return courants;
  return [...courants, effet];
}

/** Ce qui fait deux effets « le même » : la même cible, le même cran, la même nature. */
function identite(effet: EffetCombat): string {
  // Une attaque s'identifie par le **couple** attaquant → cible : un second coup sur la même
  // paire remplace la séquence en cours, un coup sur une autre carte a la sienne.
  return [effet.nature, effet.camp ?? '', effet.uid ?? '', effet.uidCible ?? '', effet.numero ?? ''].join('|');
}

/**
 * Fusionne les nouveaux effets avec ceux qui vivent encore : un second coup sur la **même**
 * carte remplace son chiffre au lieu d'en empiler un second. C'est la règle « pas
 * d'empilement au troisième coup » (T10, critère 2), tenue par le composant.
 */
export function fusionnerEffets(courants: EffetCombat[], nouveaux: readonly EffetCombat[]): EffetCombat[] {
  const remplaces = new Set(nouveaux.map(identite));
  let suivants = courants.filter((courant) => !remplaces.has(identite(courant)));
  for (const effet of nouveaux) suivants = ajouterEffet(suivants, effet);
  return suivants;
}

const CAMPS: readonly PlayerId[] = ['player', 'ai'];

/** Les Planqués **en jeu** d'un camp : Poste puis Banc, sans les places libres. */
function enJeu(side: BattleState['players'][PlayerId]): CardInstance[] {
  return [side.active, ...side.bench].filter((carte): carte is CardInstance => carte !== null);
}

/**
 * Les effets d'un pas d'état : on compare l'état d'avant et celui d'après, instance par
 * instance. Aucun journal, aucun champ ajouté au moteur — un rejeu produit donc les mêmes
 * effets, et un rechargement n'anime pas une partie qui n'a pas bougé.
 */
export function effetsEntre(avant: BattleState, apres: BattleState, premierId = 0): EffetCombat[] {
  const effets: EffetCombat[] = [];
  let prochainId = premierId;

  const ajouter = (effet: Omit<EffetCombat, 'id' | 'duree' | 'anime'> & { duree?: number }) => {
    effets.push({
      id: prochainId,
      duree: effet.duree ?? dureeEffet(effet.nature),
      anime: true,
      ...effet
    });
    prochainId += 1;
  };

  // **La Pression est émise en premier** : le plafond de quatre effets refuse le cinquième
  // arrivé, et l'attaque est la plus importante de la liste — la refuser parce que deux
  // Conditions et une Intervention sont passées avant elle serait un mauvais arbitrage.
  // Une action `attack` vient d'être journalisée : l'état est déjà final, l'effet ne retarde
  // rien, il raconte. L'attaquant est le camp au trait **avant** l'action (`attack` ne se joue
  // que pour lui) ; la cible est le Poste d'en face, au moment d'avant.
  const dernier = apres.actionLog[apres.actionLog.length - 1];
  // **Une seule action de plus** : en partie à deux, `join` remplace l'état d'un bloc, et le
  // diff couvre alors tout un tour adverse. L'attaquant lu dans l'état d'avant ne serait plus
  // celui qui a frappé, et la scène jouerait la mauvaise Pression sur la mauvaise carte.
  const uneSeuleAction = apres.actionLog.length === avant.actionLog.length + 1;
  // **Le fait, pas la phrase** (#250) : la transition dit elle-même si la Pression est
  // partie, quel Stress elle a porté et si la cible a craqué. L'écran ne relit plus
  // « Dérive » dans le journal texte, et n'a plus à comparer deux états pour l'attaque.
  const faitsDerniers = uneSeuleAction ? (dernier?.faits ?? []) : [];
  const pressionRatee = faitsDerniers.some((fait) => fait.type === 'pressionRatee');
  if (uneSeuleAction && dernier?.action.type === 'attack' && !pressionRatee) {
    const attaquant = avant.current;
    const adverse = attaquant === 'player' ? 'ai' : 'player';
    const source = avant.players[attaquant].active;
    const cible = avant.players[adverse].active;
    if (source) {
      const porte = faitsDerniers.find((fait) => fait.type === 'stress' && fait.uid === cible?.uid);
      const cibleCraque = faitsDerniers.some((fait) => fait.type === 'craquage' && fait.uid === cible?.uid);
      ajouter({
        nature: 'attaque',
        camp: attaquant,
        uid: source.uid,
        uidCible: cible?.uid,
        attackIndex: dernier.action.attackIndex,
        stressCible: porte?.type === 'stress' ? porte.montant : 0,
        cibleCraque
      });
    }
  }

  for (const camp of CAMPS) {
    const avantCamp = enJeu(avant.players[camp]);
    const apresCamp = enJeu(apres.players[camp]);
    const parUid = new Map(apresCamp.map((carte) => [carte.uid, carte]));

    // Le Stress qui monte : la différence de `Seuil − hp` entre les deux états. Une carte qui a
    // quitté le jeu a reçu au moins tout son `hp` restant : le chiffre dit le Stress encaissé
    // jusqu'au craquage, et le fantôme de la carte le porte encore une fraction de seconde.
    for (const carte of avantCamp) {
      const survivante = parUid.get(carte.uid);
      const stressAvant = carte.maxHp - carte.hp;
      const stressApres = survivante ? survivante.maxHp - survivante.hp : carte.maxHp;
      const montee = stressApres - stressAvant;
      if (montee > 0) {
        ajouter({
          nature: 'stress',
          camp,
          uid: carte.uid,
          valeur: montee,
          carte,
          auPoste: avant.players[camp].active?.uid === carte.uid
        });
      }
    }

    // Le craquage : une instance qui était en jeu, n'y est plus, et **est au Rebut**. Une
    // évolution garde le même `uid`, une Rotation change de place, aucun des deux ne craque.
    for (const carte of avantCamp) {
      const encoreEnJeu = apresCamp.some((autre) => autre.uid === carte.uid);
      const auRebut = apres.players[camp].discard.some((autre) => autre.uid === carte.uid);
      if (!encoreEnJeu && auRebut) {
        ajouter({
          nature: 'craquage',
          camp,
          uid: carte.uid,
          carte,
          auPoste: avant.players[camp].active?.uid === carte.uid,
          duree: DUREE_TRAINEE_MS
        });
      }
    }

    // La pioche : le Deck a perdu une carte. La pile s'allume, le compte dit déjà combien.
    if (apres.players[camp].deck.length < avant.players[camp].deck.length) {
      ajouter({ nature: 'pioche', camp });
    }

    // L'Intervention qui se remplit : chaque cran gagné a son numéro d'hexagone. Un COMEX en
    // remplit deux, donc deux rebonds — et le compteur les refusera au-delà de quatre.
    for (let numero = avant.players[camp].points + 1; numero <= apres.players[camp].points; numero += 1) {
      ajouter({ nature: 'intervention', camp, numero });
    }
  }

  // L'après : une Condition **apparaît** sur une carte en jeu. Le badge existe déjà ; cet
  // effet ne fait que le faire naître (`badge-pop`), et il est refusé au-delà du plafond.
  for (const camp of CAMPS) {
    for (const carte of enJeu(apres.players[camp])) {
      const avantCarte = enJeu(avant.players[camp]).find((autre) => autre.uid === carte.uid);
      if (!avantCarte) continue;
      const nouvelles = carte.statuses.filter((statut) => !avantCarte.statuses.includes(statut));
      if (nouvelles.length > 0) {
        // Posée par la Pression de ce pas : l'arc suit l'impact. Posée par le Contrôle, il joue tout de suite.
        const apresCoup = effets.some((effet) => effet.nature === 'attaque');
        ajouter({
          nature: 'condition',
          camp,
          uid: carte.uid,
          apresCoup,
          duree: apresCoup ? DUREE_CONDITION_APRES_COUP_MS : DUREE_CONDITION_MS
        });
      }
    }
  }

  return effets;
}

/**
 * Le **compteur tenu par le composant** : les effets naissent des changements d'état, vivent
 * leur durée (au plus `DUREE_MAX_MS`) puis sont retirés de la liste — donc du DOM. Sous
 * « Mouvement réduit », ils naissent quand même : c'est le CSS qui les fige, et l'information
 * reste lisible (le chiffre, le badge, le bandeau).
 */
export function useEffetsDeCombat(state: BattleState, sansMouvement: boolean): EffetCombat[] {
  const [effets, setEffets] = useState<EffetCombat[]>([]);
  const precedent = useRef(state);
  const prochainId = useRef(0);
  const minuteries = useRef<number[]>([]);

  // Le réglage peut changer **pendant** un effet : les nœuds déjà sortis perdent leur
  // animation, ils ne restent pas en mouvement sous « Mouvement réduit ».
  useEffect(() => {
    const anime = !sansMouvement;
    setEffets((courants) =>
      courants.some((courant) => courant.anime !== anime)
        ? courants.map((courant) => (courant.anime === anime ? courant : { ...courant, anime }))
        : courants
    );
  }, [sansMouvement]);

  useEffect(() => {
    const avant = precedent.current;
    precedent.current = state;
    // Une transition refusée rend le **même** état : rien n'a bougé, rien ne s'anime.
    if (avant === state) return;

    const nouveaux = effetsEntre(avant, state, prochainId.current).map((effet) => ({
      ...effet,
      anime: !sansMouvement
    }));
    if (nouveaux.length === 0) return;
    prochainId.current += nouveaux.length;

    setEffets((courants) => fusionnerEffets(courants, nouveaux));

    for (const effet of nouveaux) {
      // `Math.min` est la seconde ceinture : même une constante fausse ne peut pas laisser un
      // chiffre plus de 800 ms sur le nom d'une carte.
      const duree = Math.min(effet.duree, DUREE_MAX_MS);
      minuteries.current.push(
        window.setTimeout(() => {
          setEffets((courants) => courants.filter((courant) => courant.id !== effet.id));
        }, duree)
      );
    }
  }, [state, sansMouvement]);

  useEffect(
    () => () => {
      for (const minuterie of minuteries.current) window.clearTimeout(minuterie);
      minuteries.current = [];
    },
    []
  );

  return effets;
}
