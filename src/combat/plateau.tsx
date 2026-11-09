import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Coffee } from 'lucide-react';
import { FACTION_META, getCard } from '@/data';
import type { CafeSymbol, CardInstance, PlayerState } from '@/data/types';
import { DECK_SIZE, MAX_COPIES_PER_NAME } from '@/game/deck';
import { STATUS_META, StatusBadge } from '@/components/StatusBadge';
import { CafeDot, cafeLabel, CafePips } from '@/components/CafePips';
import { CardView } from '@/components/CardView';
import { CarteSurvolable, FicheCarte } from '@/components/InspecteurCombat';
import { delaiDeRetournement, type EffetCombat } from '@/components/effets-combat';
import type { PasAPasCombatEtat } from '@/components/use-pas-a-pas-combat';
import { cardName } from '@/combat/cartes';
import { PileRebut } from '@/combat/pile-rebut';

/** Le nombre de dos empilés sous le Deck : trois suffisent à dire « un paquet » (#739). */
const DOS_EMPILES = 3;

/**
 * Un Planqué **sur le plateau** (D-093, #187) : la carte du gabarit, figée, avec son Stress
 * vivant (`hp` reste le champ technique du moteur ; le Stress est ce que le joueur lit, D-026).
 * Le groupe porte le **nom** du Planqué : c'est par lui qu'on le retrouve, au Poste comme au
 * Banc. Sans définition connue, le nom seul reste lisible.
 */
/**
 * **Ce qu'une carte du plateau dit au focus** (#525) : son Stress sur son Seuil, puis ses Conditions.
 * Le chiffre visible est un `role="img"` rendu présentationnel par la carte-bouton : sans cette
 * phrase, Stress et Seuil n'existaient pour un lecteur d'écran qu'une fois le panneau ouvert.
 */
function resumeDeCarte(instance: CardInstance): string {
  const stress = `${instance.maxHp - instance.hp} sur ${instance.maxHp} de Stress`;
  const conditions = instance.statuses.map((statut) => STATUS_META[statut].label);
  return conditions.length > 0 ? `${stress}. ${conditions.join(', ')}.` : `${stress}.`;
}

export function CartePlateau({
  instance,
  className,
  machine,
  inspectee,
  annotations = false,
  effets = [],
  dansScene = false,
  retournement,
  evolution,
  onInspecter,
  onAttacher
}: {
  instance: CardInstance;
  className: string;
  /** Le texte de la Machine du camp, pour le Poste : il entre dans l'inspecteur (#188). */
  machine?: string;
  /** Cette carte est celle que le panneau montre. */
  inspectee: boolean;
  /** Le mode `détaillé` du combat (#189) : les Pressions et le chiffre du Stress reviennent. */
  annotations?: boolean;
  /** Les effets de la scène qui visent cette instance (#192) : un chiffre de Stress, pas plus. */
  effets?: readonly EffetCombat[];
  /**
   * C'est **la cible de la Pression en cours** : la scène dessine son chiffre à l'impact, donc
   * le chiffre du DOM s'efface pour ne pas en afficher deux (D-098). Les autres chiffres —
   * Surcharge et Épuisement au Contrôle, dégâts sur soi — restent visibles.
   */
  dansScene?: boolean;
  /**
   * **L'ouverture d'un combat neuf** (#746) : le délai, en ms, de la bascule dos → face de ce
   * Planqué. Absent, la carte est face visible (le cas de toute partie reprise, et de « Mouvement
   * réduit »), et son rendu ne change pas d'un octet.
   */
  retournement?: number;
  /** L'évolution de ce Planqué (#748) : son pouls, sur la carte nouvelle. Absent, rien ne pulse. */
  evolution?: EffetCombat;
  onInspecter: () => void;
  /** Le café en Machine attache à ce Planqué (#454, D-145) : le toucher l'attache. */
  onAttacher?: () => void;
}) {
  const nom = cardName(instance.cardId);
  const definition = getCard(instance.cardId);
  if (!definition) return <span className="muted">{nom}</span>;
  const carte = (
    <CardView
      card={definition}
      calme
      plateau
      annotations={annotations}
      stress={instance.maxHp - instance.hp}
      seuil={instance.maxHp}
    />
  );
  return (
    <CarteSurvolable
      uid={instance.uid}
      nom={nom}
      className={className}
      inspectee={inspectee}
      onInspecter={onInspecter}
      onAttacher={onAttacher}
      resume={resumeDeCarte(instance)}
      fiche={<FicheCarte instance={instance} card={definition} machine={machine} />}
    >
      {/* Le dos se retourne (#746) : le recto et le verso se partagent le même retournement, le
          verso est un dos de carte (`.entrant__verso`), jamais la carte elle-même. */}
      {retournement === undefined ? (
        carte
      ) : (
        <span className="entrant entrant--ouverture" style={{ '--delai': `${retournement}ms` } as CSSProperties}>
          <span className="entrant__recto">{carte}</span>
          <span className="entrant__verso" aria-hidden="true" />
        </span>
      )}
      {/* Le chiffre de Stress (#192) : il naît avec l'instance touchée, vit 700 ms et quitte le
          DOM. `aria-hidden` : l'information est déjà dans la barre de Stress et au journal. */}
      {effets.map((effet) => (
        <span
          key={effet.id}
          className={`stress-flottant${effet.anime ? '' : ' is-fixe'}${dansScene ? ' is-scene' : ''}`}
          aria-hidden="true"
        >
          +{effet.valeur}
        </span>
      ))}
      {/* Le pouls d'une évolution (#748) : un liseré qui se referme sur la carte nouvelle, 300 ms. Il
          naît avec l'effet et quitte le DOM avec lui. `aria-hidden` : l'évolution est lue au journal. */}
      {evolution?.anime && <span key={evolution.id} className="evolution-flash" aria-hidden="true" />}
    </CarteSurvolable>
  );
}

/**
 * Les cafés **attachés** d'un Planqué, en pastilles typées (D-037) : chaque pastille
 * porte la couleur de sa faction, vide si rien n'est attaché.
 *
 * Le rang est **nommé** (#399) : à côté de la Machine, deux pastilles voisines se
 * ressemblaient trop, et un café en Machine se lisait comme « le second café attaché ».
 * `data-cafes` et `aria-label` disent lequel est lequel ; la Machine, elle, porte une
 * tasse et une pastille carrée (`styles.css`).
 */
export function CafesPips({ cafes }: { cafes: readonly CafeSymbol[] }) {
  const names = cafes.map((cafe) => cafeLabel(cafe));
  return (
    <span className="poste__cafes" data-cafes="attaches" role="group" aria-label="Cafés attachés au Poste">
      <CafePips
        symbols={cafes}
        label={names.length > 0 ? `Cafés attachés : ${names.join(' · ')}` : 'Aucun café attaché'}
      />
    </span>
  );
}

/**
 * La **Machine à café** d'un camp : au plus un café typé (D-034) — pastille colorée
 * du type produit, ou pastille vide quand rien n'est à attacher. Le survol rappelle
 * les **types du Deck** (1 à 3, D-037 (4)) dont la Machine tire le café.
 */
export function MachinePips({
  side,
  designe = false,
  detaille = false
}: {
  side: PlayerState;
  /** Le pas-à-pas du combat (#143) désigne la Machine du joueur, pas celle de la Direction. */
  designe?: boolean;
  /** Le mode `détaillé` (#189) remet les **types du Deck** à côté de la pastille. */
  detaille?: boolean;
}) {
  const zone = side.energyZone;
  const types = side.cafeTypes.map((type) => FACTION_META[type].name).join(' · ');
  // La Machine se **lit** dans l'inspecteur du Poste (#188) : sur le plateau, seule sa pastille
  // reste — sans le mot « Machine », qui ne dit plus rien à côté de la carte. Le texte est lu
  // par le nom accessible, comme l'ancien `title` (SPEC-COMBAT-UI §6.7). En `détaillé`, les
  // types du Deck sont une annotation visible (#189).
  return (
    <span
      className="poste__machine"
      data-cafes="machine"
      role="group"
      aria-label="Machine à café"
      data-pas-a-pas={designe ? 'machine' : undefined}
    >
      <Coffee size={12} className="poste__machine-icone" aria-hidden="true" />
      <span aria-hidden="true">{zone ? <CafeDot cafe={zone} /> : <i className="pip pip--free" />}</span>
      <span className="sr-only">{texteMachine(side)}</span>
      {detaille && <span className="poste__machine-types">{types || 'aucun type particulier'}</span>}
    </span>
  );
}

/** La Machine à café d'un camp, dite en une phrase : le café produit, les types du Deck (D-037 (4)). */
export function texteMachine(side: PlayerState): string {
  const types = side.cafeTypes.map((type) => FACTION_META[type].name).join(' · ');
  return `Machine à café : ${side.energyZone ? cafeLabel(side.energyZone) : 'vide'} (types du Deck : ${types || 'aucun'})`;
}

/** La taille d'un dos de carte, comme la feuille le fixe (`.eventail__dos`, 1,1 × 1,6 rem). */
function tailleDUnDos(): { w: number; h: number } {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return { w: 1.1 * rem, h: 1.6 * rem };
}

/** Une boîte à l'écran : son centre et sa taille, en pixels de fenêtre. */
interface Boite {
  x: number;
  y: number;
  w: number;
  h: number;
}

function boiteDe(el: Element): Boite {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: rect.width, h: rect.height };
}

/**
 * **Où part et où arrive le vol** (#748), lu dans le DOM **après** le geste. Le départ est le Deck
 * du camp (tirage) ou l'éventail de dos adverse (pose) ; l'arrivée est la carte de la main (tirage du
 * joueur), l'éventail (tirage adverse) ou la place du Poste ou du Banc (pose). `null` : une cible
 * absente ou sans taille ; le vol ne se joue pas, et ne bloque rien.
 */
function planDuVol(
  effet: Pick<EffetCombat, 'nature' | 'uid' | 'lieu' | 'emplacement'>,
  mine: boolean
): { boite: Boite; dx: number; dy: number; k: number } | null {
  const camp = mine ? 'mien' : 'direction';
  const eventail = document.querySelector<HTMLElement>('[data-camp="direction"] .eventail');
  const dos = tailleDUnDos();
  let depart: Boite | null;
  let arrivee: Boite | null;
  if (effet.nature === 'pose') {
    const repere = effet.lieu === 'poste' ? 'poste' : `banc-${effet.emplacement ?? 0}`;
    const cible = document.querySelector<HTMLElement>(`[data-camp="direction"] [data-arrivee="${repere}"]`);
    if (!eventail || !cible) return null;
    depart = { ...boiteDe(eventail), w: dos.w, h: dos.h };
    arrivee = boiteDe(cible);
  } else {
    const deck = document.querySelector<HTMLElement>(`[data-camp="${camp}"] .pile--deck .pile__visuel`);
    if (!deck) return null;
    depart = boiteDe(deck);
    if (mine) {
      const main = [...document.querySelectorAll<HTMLElement>('.hand [data-uid]')].find(
        (el) => el.dataset.uid === effet.uid
      );
      arrivee = main ? boiteDe(main) : null;
    } else {
      arrivee = eventail ? { ...boiteDe(eventail), w: dos.w, h: dos.h } : null;
    }
  }
  if (!depart || !arrivee || arrivee.w <= 0 || arrivee.h <= 0) return null;
  return {
    boite: arrivee,
    dx: depart.x - arrivee.x,
    dy: depart.y - arrivee.y,
    k: depart.w / arrivee.w
  };
}

/**
 * **Le vol d'une carte** (#748, retour du propriétaire, Pokémon TCG Pocket) : une carte part du
 * Deck (tirage) ou de l'éventail de dos adverse (pose), et arrive à sa place. Elle se retourne en
 * vol **si** on voit sa face (le joueur qui pioche, la Direction qui pose) ; la pioche adverse reste
 * un dos, sa main est cachée. Le mouvement est dans la feuille (`.vol-effet`, `transform` et
 * `rotateY` seuls), et sa durée est celle de l'effet : le nœud quitte le DOM avec lui.
 */
function VolDeCarte({ effet, mine }: { effet: EffetCombat; mine: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const retourne = effet.nature === 'pose' || (effet.nature === 'tirage' && mine);
  const definition = retourne && effet.carte ? getCard(effet.carte.cardId) : undefined;

  // Mesuré **après** le geste : le plateau a déjà sa carte à la place d'arrivée. Avant la peinture,
  // pour que le vol ne se montre jamais à la mauvaise place.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const plan = planDuVol(effet, mine);
    el.hidden = plan === null;
    if (!plan) return;
    const { x, y, w, h } = plan.boite;
    el.style.left = `${x - w / 2}px`;
    el.style.top = `${y - h / 2}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.setProperty('--dx', `${plan.dx}px`);
    el.style.setProperty('--dy', `${plan.dy}px`);
    el.style.setProperty('--k', String(plan.k));
  }, [effet, mine]);

  return createPortal(
    <div
      ref={ref}
      className={`vol-effet vol-effet--${effet.nature}${retourne ? ' vol-effet--retourne' : ''}`}
      aria-hidden="true"
    >
      <span className="vol-effet__face vol-effet__dos" />
      {definition && (
        <span className="vol-effet__face vol-effet__recto">
          <CardView card={definition} calme plateau />
        </span>
      )}
    </div>,
    document.body
  );
}

/**
 * **Un camp du plateau** (#169, #187) : le Poste (une carte) et le Banc (trois cartes) se
 * côtoient sur une ligne, le Poste à gauche, pour les deux camps : les deux Postes sont sur
 * le même axe vertical. La hauteur est comptée : il faut que les deux camps, la main et les
 * actions se voient d'un coup sur un téléphone (`npm run capturer`).
 *
 * Le pas-à-pas désigne le Poste, la Machine et les Interventions **du joueur seulement**
 * (`mine`) : l'adversaire n'a jamais d'attribut `data-pas-a-pas`.
 */
export function Camp({
  label,
  side,
  current,
  mine,
  pendingPromotion,
  pasAPas,
  inspecte,
  detaille,
  effets = [],
  cibleScene,
  ouverture,
  raisonsDeckDeTest = [],
  cafeAttachable,
  onInspecter,
  onAttacherCafe,
  onPoserPlace,
  nomAPoser,
  placesPosables
}: {
  label: string;
  side: PlayerState;
  /** Le camp qui a la main : son cadre s'allume. */
  current: boolean;
  mine: boolean;
  /** Vrai quand ce camp attend de choisir sa relève. */
  pendingPromotion: boolean;
  pasAPas: PasAPasCombatEtat;
  /** Le `uid` de la carte que le panneau montre, ou `null` (#188). */
  inspecte: string | null;
  /** La densité du combat (#189) : annotations sur le Poste et sur la Machine. */
  detaille: boolean;
  /** Les effets de la scène qui touchent **ce** camp (#192). */
  effets?: readonly EffetCombat[];
  /** Le `uid` de la cible de la Pression en cours : c'est elle que la scène anime (D-098). */
  cibleScene?: string;
  /**
   * **L'ouverture d'un combat neuf** (#746) : les Planqués du camp se retournent, en cascade. Le
   * `rangDeBase` est le rang du Poste de ce camp (0 pour le joueur, 4 pour la Direction).
   * Absent : rien ne se retourne (partie reprise, « Mouvement réduit »).
   */
  ouverture?: { rangDeBase: number };
  /**
   * Ce camp joue le **deck de test**, parce que le Deck du joueur n'est pas valide (D-103, #243).
   * L'avertissement tenait sur sa propre ligne (30 px) ; il est désormais une étiquette de la
   * fiche du camp, où la place existait déjà.
   */
  raisonsDeckDeTest?: readonly string[];
  /** Les Planqués qui reçoivent le café en Machine, par `uid` (#454, D-145). */
  cafeAttachable?: ReadonlySet<string>;
  /** Toucher un Planqué de `cafeAttachable` attache le café à lui. */
  onAttacherCafe?: (uid: string) => void;
  /**
   * **La place libre est la cible** (critique du 01/11/2026) : quand une carte de la main peut
   * être posée au Banc, la place vide — déjà dessinée à sa taille — reçoit le geste. Le panneau de
   * pose garde ses boutons, mais on n'a plus à faire défiler l'écran pour trouver « Banc 2 ».
   */
  onPoserPlace?: (slot: number) => void;
  /** Le nom de la carte à poser, pour le nom accessible de la place. */
  nomAPoser?: string;
  /** Les places du Banc où le moteur accepte la carte choisie (`playBasic`). */
  placesPosables?: ReadonlySet<number>;
  onInspecter: (uid: string) => void;
}) {
  const attacher = (uid: string) =>
    cafeAttachable?.has(uid) && onAttacherCafe ? () => onAttacherCafe(uid) : undefined;
  const effetsStress = effets.filter((effet) => effet.nature === 'stress');
  const craquage = effets.find((effet) => effet.nature === 'craquage');
  const pioche = effets.some((effet) => effet.nature === 'pioche');
  // L'arc d'une Condition (#294) : seul un effet **animé** en porte un. Sous « Mouvement réduit »
  // le nœud n'est pas créé : le badge nommé de la fiche (`StatusBadge`) dit déjà la Condition.
  const arcs = effets.filter((effet) => effet.nature === 'condition' && effet.anime);
  const uidsEnJeu = new Set([side.active, ...side.bench].filter(Boolean).map((carte) => carte!.uid));
  // Un Planqué qui vient de craquer n'a plus de carte au Poste : son chiffre de Stress reste
  // à la place de la carte, sur le fantôme désaturé, plutôt que de disparaître avec elle.
  const stressHorsCarte = effetsStress.filter((effet) => effet.auPoste && (!effet.uid || !uidsEnJeu.has(effet.uid)));
  const craquageDefinition = craquage ? getCard(craquage.carte?.cardId ?? '') : undefined;
  // Le Poste : la carte, en grand, au centre du camp (R4). Le nom et la barre de Stress sont
  // **sur** la carte. Le mot « Poste » est lu, pas affiché : la hauteur du plateau est comptée par
  // la garde (`npm run capturer`), et une étiquette de plus la ferait déborder.
  const posteActif = side.active;
  // **La Pression** est jouée par la scène (D-098) : le cabrage, le trait et l'anneau d'impact
  // du CSS de #207 ont disparu, sinon deux animations se superposeraient. Ce qui reste ici, et
  // qui ne dépend d'aucun mouvement, c'est le **chiffre de Stress** (`effetsStress`).
  // La pose de la Direction (#748) : la place d'arrivée se cache le temps du vol, puis la carte
  // se montre. Le vol part de l'éventail de dos et atterrit sur `data-arrivee`.
  const poseAuPoste = effets.some((effet) => effet.nature === 'pose' && effet.anime && effet.lieu === 'poste');
  const poste = (
    <div
      className={`board__poste${poseAuPoste ? ' is-arrivee' : ''}`}
      data-pas-a-pas={mine ? pasAPas.designe('poste') : undefined}
      /* La cible du vol d'une carte posée au Poste (`CarteEnVol`), côté mien seulement. */
      data-envol={mine ? 'poste' : undefined}
      /* La cible du vol de la Direction (`VolDeCarte`, #748), côté adverse seulement. */
      data-arrivee={mine ? undefined : 'poste'}
    >
      <span className="sr-only">Poste</span>
      {posteActif ? (
        <CartePlateau
          instance={posteActif}
          className="poste__carte"
          machine={texteMachine(side)}
          inspectee={inspecte === posteActif.uid}
          annotations={detaille}
          effets={effetsStress.filter((effet) => effet.uid === posteActif.uid)}
          dansScene={cibleScene === posteActif.uid}
          retournement={ouverture ? delaiDeRetournement(ouverture.rangDeBase) : undefined}
          evolution={effets.find((effet) => effet.nature === 'evolution' && effet.uid === posteActif.uid)}
          onInspecter={() => onInspecter(posteActif.uid)}
          onAttacher={attacher(posteActif.uid)}
        />
      ) : (
        <strong className="muted poste__libre">
          {pendingPromotion ? 'Aucun Planqué — relève à choisir' : 'Poste libre'}
        </strong>
      )}
      {/* Le craquage (#192) : la carte tombée reste une fraction de seconde, désaturée, à la
          place qu'elle occupait — et son chiffre de Stress avec elle. Le bandeau « a craqué »
          et le journal restent les porteurs de l'information sous mouvement réduit. */}
      {craquage && craquage.auPoste && (
        <div className="craquage__carte" data-uid={craquage.uid} aria-hidden="true">
          {craquageDefinition && <CardView card={craquageDefinition} calme plateau />}
        </div>
      )}
      {/* L'arc de Condition (#294) : un liseré qui pulse deux fois autour de la carte du Poste, puis
          quitte le DOM. Il est hors du flux (`position: absolute`) et ne capte aucun clic. */}
      {posteActif &&
        arcs
          .filter((effet) => effet.uid === posteActif.uid)
          .map((effet) => (
            <span
              key={effet.id}
              className={`condition__arc${effet.apresCoup ? ' condition__arc--apres-coup' : ''}`}
              aria-hidden="true"
            />
          ))}
      {stressHorsCarte.map((effet) => (
        <span key={effet.id} className={`stress-flottant${effet.anime ? '' : ' is-fixe'}`} aria-hidden="true">
          +{effet.valeur}
        </span>
      ))}
    </div>
  );

  // Les piles de Deck et de Rebut (D-093, #190 ; D-182, #749), visibles des deux camps, avec leur
  // compte. Elles sortent de la fiche : posées en **colonne** à droite de la table, comme des objets
  // sur le plateau — les deux de la Direction en haut, les deux du joueur en bas.
  // Le Deck n'est qu'un **dos** empilé : aucun nom, aucun identifiant, aucun ordre n'en sort (#739).
  // Le Rebut montre la **dernière** carte défaussée (`discard.push`, D-093), face visible, et s'ouvre
  // en panneau non modal qui liste toutes les défausses (#740, `PileRebut`).
  const dosDuDeck = Array.from({ length: Math.min(DOS_EMPILES, side.deck.length) }, (_, index) => index);
  const piles = (
    <div className="piles">
      <div className={`pile pile--deck${pioche ? ' is-piochante' : ''}`} role="group" aria-label={`Deck : ${label}`}>
        <div className="pile__visuel" aria-hidden="true">
          {dosDuDeck.map((index) => (
            <span key={index} className="pile__dos" style={{ '--i': index } as CSSProperties} />
          ))}
        </div>
        <div className="pile__compte">
          <span>Deck</span>
          <strong>{side.deck.length}</strong>
        </div>
      </div>
      <PileRebut label={label} discard={side.discard} />
    </div>
  );

  // La fiche du camp, **à côté** de la carte du Poste et non au-dessus (#199) : le nom du camp, ses
  // piles, puis ce qui se passe au Poste (Stress écrit, cafés, Machine, Conditions). Le camp tient
  // ainsi en deux rangées, et non en trois : c'est ce qui rend la hauteur au plateau.
  const fiche = (
    <div className="board__fiche">
      <header className="board__head">
        <h2>{label}</h2>
        {/* **La main en éventail de dos** (D-182, #747) : autant de dos que de cartes, jamais la carte
            elle-même — aucun nom, aucun identifiant ne passe ici. Le compte reste lu par les
            lecteurs d'écran. */}
        <span className="board__counts muted">
          <span className="sr-only">main {side.hand.length}</span>
          <span className="eventail" aria-hidden="true" style={{ '--n': side.hand.length } as CSSProperties}>
            {side.hand.map((_, index) => (
              <span key={index} className="eventail__dos" style={{ '--i': index } as CSSProperties} />
            ))}
          </span>
        </span>
        {raisonsDeckDeTest.length > 0 && (
          <span
            className="board__test"
            title={`Un deck valide : ${DECK_SIZE} cartes, ${MAX_COPIES_PER_NAME} exemplaires max, 1 Entrant minimum.`}
          >
            <span aria-hidden="true">deck de test</span>
            <span className="sr-only">
              Ton deck n’est pas valide : ce combat utilise un deck de test.
              {raisonsDeckDeTest.length > 0 ? ` ${raisonsDeckDeTest.join(' ')}` : ''}
            </span>
          </span>
        )}
      </header>
      {side.active && (
        <div className="poste__info">
          {/* Le chiffre du Stress et le mot « Machine » sont dans l'inspecteur (#188) : la carte
              porte la barre, et la pastille de la Machine reste seule, pour le pas-à-pas. */}
          <CafesPips cafes={side.active.energy} />
          <MachinePips side={side} designe={mine && pasAPas.designe('machine') !== undefined} detaille={detaille} />
          {side.active.statuses.map((status) => (
            <StatusBadge key={status} status={status} nomAffiche={detaille} />
          ))}
        </div>
      )}
    </div>
  );

  // Le Banc : trois places, sur une seule rangée. Une place libre garde la forme d'une carte.
  const banc = (
    <div className="board__bench">
      <span className="sr-only">Banc</span>
      <ul className="bench">
        {side.bench.map((slot, index) => (
          <li
            className={`bench__slot ${slot ? '' : 'is-free'}${
              !slot && onPoserPlace && placesPosables?.has(index) ? ' is-cible' : ''
            }${effets.some((effet) => effet.nature === 'pose' && effet.anime && effet.emplacement === index) ? ' is-arrivee' : ''}`}
            key={index}
            /* La cible du vol d'une carte posée au Banc (`CarteEnVol`), côté mien seulement. */
            data-envol={mine ? `banc-${index}` : undefined}
            /* La cible du vol de la Direction (`VolDeCarte`, #748), côté adverse seulement. */
            data-arrivee={mine ? undefined : `banc-${index}`}
          >
            {slot ? (
              <CartePlateau
                instance={slot}
                className="bench__carte"
                inspectee={inspecte === slot.uid}
                effets={effetsStress.filter((effet) => effet.uid === slot.uid)}
                dansScene={cibleScene === slot.uid}
                retournement={ouverture ? delaiDeRetournement(ouverture.rangDeBase + 1 + index) : undefined}
                evolution={effets.find((effet) => effet.nature === 'evolution' && effet.uid === slot.uid)}
                onInspecter={() => onInspecter(slot.uid)}
                onAttacher={attacher(slot.uid)}
              />
            ) : onPoserPlace && placesPosables?.has(index) ? (
              <button
                type="button"
                className="bench__place"
                onClick={() => onPoserPlace(index)}
                aria-label={`Poser ${nomAPoser ?? 'cette carte'} au Banc ${index + 1}`}
              >
                <span className="sr-only">Place libre</span>
              </button>
            ) : (
              <span className="sr-only">Place libre</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  // La pile du camp (#199) : le camp adverse lit **Banc puis Poste**, le mien **Poste puis Banc**.
  // Ainsi les deux Postes se font face, au centre du plateau.
  const ligneDuPoste = (
    <div className="board__poste-ligne">
      {poste}
      {fiche}
    </div>
  );

  // Empilés (#199) : le Poste et le Banc du camp, dans l'ordre qui met les deux Postes face à face.
  // Le camp qui a la main est porté par le cadre du camp.
  // Les vols (#748) : le tirage et la pose de la Direction. Le vol est rendu à part, dans `body`,
  // et ne prend aucune place dans le plateau. La pose du joueur n'a pas de vol ici (`CarteEnVol`).
  const vols = effets.filter((effet) => (effet.nature === 'tirage' || effet.nature === 'pose') && effet.anime);
  return (
    <article
      className={`board__side ${current ? 'is-current' : ''} ${mine ? '' : 'is-direction'}`}
      data-camp={mine ? 'mien' : 'direction'}
    >
      <div className="board__zone">
        {piles}
        {mine ? (
          <>
            {ligneDuPoste}
            {banc}
          </>
        ) : (
          <>
            {banc}
            {ligneDuPoste}
          </>
        )}
      </div>
      {vols.map((effet) => (
        <VolDeCarte key={effet.id} effet={effet} mine={mine} />
      ))}
    </article>
  );
}
