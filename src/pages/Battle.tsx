import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  ClipboardPaste,
  Coffee,
  Copy,
  Flag,
  Info,
  RotateCcw,
  ScrollText,
  Users
} from 'lucide-react';
import { getCard, isPlanque, kindLabel } from '@/data';
import type { BattleAction, BattleState, CardInstance, PlayerId, Status } from '@/data/types';
import { isOpeningTurn, legalActions, legalAttacks } from '@/game/engine';
import { HAND_LIMIT } from '@/game/rules';
import { useStore } from '@/store/useStore';
import { jouer } from '@/audio/sons';
import { CAMP_NAME, campLine, campToAct, handover, matchCode, otherCamp } from '@/store/pvp';
import { useCombat } from '@/combat/useCombat';
import { cardName } from '@/combat/cartes';
import { ActionButton } from '@/combat/actions';
import { Camp, texteMachine } from '@/combat/plateau';
import { endBanner, libelleDuTour, regardDuDernierGeste, RegardDuDessus, useEcranLarge } from '@/combat/presentation';
import { STATUS_META, StatusBadge } from '@/components/StatusBadge';
import { CardView } from '@/components/CardView';
import { FicheCarte, InspecteurCombat } from '@/components/InspecteurCombat';
import { Confirmation } from '@/components/Confirmation';
import { PasAPasCombat } from '@/components/PasAPasCombat';
import { comportementDeDefilement, usePasAPasCombat } from '@/components/use-pas-a-pas-combat';
import { marquerGeste } from '@/components/journee-gestes';
import { avancerJournee, etapeJournee } from '@/components/journee-etape';
import { SceneFin } from '@/components/SceneFin';
import { choisirReplique, type EvenementDirection } from '@/game/repliques-direction';
import { MenuCombat } from '@/components/MenuCombat';
import { PisteInterventions } from '@/components/PisteInterventions';
import { useEffetsDeCombat } from '@/components/effets-combat';
import { phraseDePortee } from './portee';
import { phraseCafeAuPoste } from '@/components/cafe-au-poste';
import { PanneauAttacheCafe } from '@/components/PanneauAttacheCafe';
import { PresentationRegles } from '@/components/PresentationRegles';
import { SceneAttaque } from '@/animation/SceneAttaque';
import { useMouvementReduit } from '@/components/use-mouvement-reduit';
import type { EtatMenu } from '@/components/MenuCombat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

/**
 * Localiser une instance **sur le plateau** : son camp, et si elle est au Poste ou au Banc (et
 * à quelle place). `null` si elle n'y est plus — la carte est morte ou a changé de zone.
 */
function localiser(
  state: BattleState,
  uid: string
): { camp: PlayerId; carte: CardInstance; auPoste: boolean; rang: number } | null {
  for (const camp of ['player', 'ai'] as const) {
    const side = state.players[camp];
    if (side.active?.uid === uid) return { camp, carte: side.active, auPoste: true, rang: -1 };
    const rang = side.bench.findIndex((carte) => carte?.uid === uid);
    const carte = side.bench[rang];
    if (rang >= 0 && carte) return { camp, carte, auPoste: false, rang };
  }
  return null;
}

/**
 * Les gestes qu'une carte **porte**, pris dans la liste du moteur : attacher un café, évoluer,
 * Talent (au Poste), Rotation (depuis le Poste : une cible par Planqué du Banc), relève (depuis le Banc). Rien d'autre :
 * un geste qui n'est pas dans la liste n'est pas offert (SPEC-COMBAT-UI §6.4).
 */
function gestesDeLaCarte(
  actions: readonly BattleAction[],
  uid: string,
  auPoste: boolean,
  rang: number
): BattleAction[] {
  return actions.filter((action) => {
    switch (action.type) {
      case 'attachEnergy':
      case 'evolve':
        return action.targetUid === uid;
      case 'ability':
        return auPoste;
      // La Rotation n'a qu'une entrée, au Poste : ses cibles sont dans son panneau (#455, D-147).
      case 'retreat':
        return auPoste;
      case 'promoteActive':
        return action.benchIndex === rang;
      default:
        return false;
    }
  });
}

/** Les cinq conditions, dans l'ordre d'affichage de la légende. */
const STATUS_LIST = Object.keys(STATUS_META) as Status[];

/**
 * **La leçon du critère WCAG sur les raccourcis à une touche** (#189, `SPEC-COMBAT-UI` §4.2) : un raccourci à une touche est
 * neutralisé dans un champ de saisie, sinon « i » devient une commande au milieu d'un code
 * de partie à deux. Le test couvre les deux zones de texte du code.
 */
function dansUnChampDeSaisie(cible: EventTarget | null): boolean {
  return cible instanceof Element && cible.closest('input, textarea, select, [contenteditable="true"]') !== null;
}

/** Le menu `⋯` au repos : fermé, sur sa liste. */
const MENU_FERME: EtatMenu = { ouvert: false, vue: 'racine' };

/**
 * Les écrans joignables depuis le menu du combat (#427). Ce sont les entrées de la barre du
 * bas (`Layout`, cinq onglets) et les Réglages, que l'en-tête cache sur téléphone.
 */
const ECRANS_DU_MENU = [
  { to: '/', label: 'Accueil' },
  { to: '/collection', label: 'Collection' },
  { to: '/deck', label: 'Deck' },
  { to: '/comite', label: 'Comité' },
  { to: '/settings', label: 'Réglages' }
] as const;

export function Battle() {
  const ecranLarge = useEcranLarge();
  /** La Journée est-elle encore ouverte ? Seule la visite enchaîne après la scène de fin. */
  const tutorielVu = useStore((state) => state.tutorielVu);
  /**
   * **La densité d'infos** (#189, `SPEC-COMBAT-UI` §4.3) : `sobre` par défaut, `détaillé`
   * sur geste. Elle vit dans le store persisté : le choix survit au rechargement.
   */
  const combatDetaille = useStore((state) => state.combatDetaille);
  const basculerCombatDetaille = useStore((state) => state.basculerCombatDetaille);
  /** Les raccourcis clavier du combat, réglés dans Réglages (#189). */
  const raccourcisCombat = useStore((state) => state.raccourcisCombat);
  /**
   * **Le combat guidé** (#272) : `?tutoriel=1` ouvre le pas-à-pas du premier combat même
   * quand le drapeau dit « déjà vu », puis le referme — le testeur finit la partie seul.
   * Aucune règle ne change : c'est le même moteur, le niveau de la Direction par défaut
   * (D-084), et le guidage n'est pas un dialogue : il ne bloque rien.
   */
  const [parametres] = useSearchParams();
  const tutoriel = parametres.get('tutoriel') === '1';
  /**
   * **La fin scriptée** du tutoriel de combat (30/10/2026) : `?scene=fin` ouvre une
   * position déjà gagnable — deux Interventions partout, un Poste adverse à 10 — pour
   * que le testeur **joue** la fin au lieu de la regarder (`etatFinScriptee`).
   * Aucune règle ne change : c'est le même moteur, et la partie n'est pas rangée.
   */
  const sceneFin = parametres.get('scene') === 'fin';
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Le **pas-à-pas du premier combat** (#143) : son ouverture, son cran et ses cibles
   * vivent dans un seul module (`usePasAPasCombat`) — la page ne fait que poser
   * l'attribut qui met l'élément désigné en avant, et rendre le panneau.
   */
  const pasAPas = usePasAPasCombat(tutoriel);

  /** « Mouvement réduit » : il coupe les animations **et** l'attente de la Direction. */
  const sansMouvement = useMouvementReduit();
  /**
   * **La carte choisie dans la main** (#169). Poser est un geste à deux temps : on touche
   * la carte, puis on choisit **où** elle va. La sélection reste visible (cadre accentué,
   * panneau de pose) tant qu'aucune action ne l'a consommée : `jouer` la vide par `onCoup`,
   * et une sélection dont la carte a quitté la main ne montre plus rien (`selected`, plus bas).
   */
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  /**
   * **La mécanique de tour vit dans son module** (`useCombat`, #556) : la table, les coups,
   * la Direction, la sauvegarde. L'écran ne garde que le rendu, et ses propres panneaux.
   */
  const {
    state,
    match,
    jouer: play,
    recommencer,
    creerPartieADeux,
    reprendre,
    partieReprise,
    usedTestDeck,
    raisonsDeckDeTest,
    directionReflechit
  } = useCombat({
    tutoriel,
    sceneFin,
    sansMouvement,
    // Un coup part : la carte choisie ne tient plus, le panneau de pose se referme.
    onCoup: () => setSelectedUid(null)
  });

  /** Ce que le champ de code dit : la raison d'un refus (telle quelle), ou la reprise. */
  const [codeMessage, setCodeMessage] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null);
  /** Le code collé par l'autre joueur. */
  const [incoming, setIncoming] = useState('');

  /**
   * **Le menu `⋯`** (D-093, #191) : ouvert ou non, et laquelle de ses trois vues il montre.
   * `codeAnnonce` est le dernier code que le menu a **annoncé** en s'ouvrant seul — voir plus bas.
   */
  const [menu, setMenu] = useState<EtatMenu>(MENU_FERME);
  const [codeAnnonce, setCodeAnnonce] = useState<string | null>(null);
  /** « Nouveau combat » sur une partie commencée demande confirmation (comme le forfait). */
  const [nouveauDemande, setNouveauDemande] = useState(false);
  /** La scène de fin du tutoriel a-t-elle été refermée ? (30/10/2026) */
  const [sceneFinFermee, setSceneFinFermee] = useState(false);

  /**
   * Le camp que **je** tiens. En solo c'est `player` ; en partie à deux, celui que le
   * code m'a donné (`match.camp`). C'est le seul endroit où l'écran se nomme un siège —
   * tout le reste en dérive, y compris le forfait et la main affichée.
   */
  const myCamp: PlayerId = match?.camp ?? 'player';
  const mySide = state.players[myCamp];
  /** Le camp qui doit agir : la relève en attente d'abord (moteur, `campToAct`). */
  const actor = campToAct(state);
  /** Mon tour ? Sinon l'écran attend l'autre joueur — et ne lui prête aucun bouton. */
  const myMove = state.phase === 'playing' && actor === myCamp;

  const isPlayerTurn = state.current === 'player' && state.phase === 'playing';
  const myCard = mySide.active ? getCard(mySide.active.cardId) : undefined;
  /** Dernière ligne du journal : ce qui vient de se passer, mis en avant. */
  const lastLog = state.log.at(-1) ?? '';
  /**
   * **La Direction parle** (02/11/2026) : aux trois moments — un craquage encaissé,
   * une fin gagnée, une fin perdue. Pas à chaque Pression : la voix deviendrait du bruit.
   * En solo seulement : en partie à deux, un joueur humain n'hérite jamais de ses vannes.
   * Le choix est déterministe par le tour (comme le moteur).
   *
   * **Le craquage se lit dans les faits, jamais dans la phrase du journal** (#544) : la ligne
   * « … craque : 1 Intervention. » n'est jamais la dernière, le moteur y ajoute aussitôt celle
   * de la relève ou du verdict — `evenementDuJournal` ne pouvait donc pas la voir passer (0
   * occurrence sur 10 946 états de parties réelles). Les faits (#250) nomment l'événement là où
   * il est décidé, et disent de qui le Planqué est tombé : la Direction commente **son**
   * personnel, jamais la chute du nôtre.
   */
  const craquageDeLaDirection = (state.actionLog.at(-1)?.faits ?? []).some(
    (fait) => fait.type === 'craquage' && fait.camp === 'ai'
  );
  const evenementDirection: EvenementDirection | null =
    state.phase === 'ended'
      ? // Une **égalité** (limite de tours, D-031) n'est ni gagnée ni perdue : elle ne parle pas.
        state.winner === null
        ? null
        : state.winner === myCamp
          ? 'victoire'
          : 'defaite'
      : craquageDeLaDirection
        ? 'craquage'
        : null;
  // La Direction ne parle que pour elle-même (camp 'ai' en solo). En partie à deux, pas de Direction.
  const evenementQuiParle = match === null ? evenementDirection : null;
  const repliqueDirection = evenementQuiParle ? choisirReplique(evenementQuiParle, state.turn) : null;
  /** La scène de fin est ouverte : c'est elle qui dit le verdict et la phrase de la Direction. */
  const sceneFinOuverte = sceneFin && state.phase === 'ended' && !sceneFinFermee;
  /**
   * **Le combat guidé est un geste de la Journée** (31/10/2026) : elle s'efface sur
   * `/battle`, donc elle ne peut pas voir le plateau. La fin du combat — joué jusqu'au
   * verdict, gagné ou perdu — est la preuve qu'on l'a joué ; `Suivant` s'ouvre alors.
   */
  useEffect(() => {
    if (sceneFinOuverte) marquerGeste('combat');
  }, [sceneFinOuverte]);

  /** Le moteur dit ce qui est possible ; l'écran ne fait que le rendre. */
  const legal = useMemo(() => legalActions(state), [state]);
  // Le camp : seul le joueur dont c'est le tour agit. C'est une garde de **camp**, pas de
  // légalité — la liste du moteur la porte déjà. En solo, la Direction n'a pas de main
  // humaine : hors relève, l'écran ne montre que la fin de son tour. En partie à deux,
  // le camp adverse est tenu par quelqu'un : on ne montre **rien** de ses actions.
  const playable = match
    ? myMove
      ? legal.filter((action) => action.type !== 'forfeit')
      : []
    : state.pendingPromotion || isPlayerTurn
      ? legal
      : legal.filter((action) => action.type === 'endTurn');

  const handActions = playable.filter(
    (action) =>
      action.type === 'playAction' ||
      action.type === 'playBasic' ||
      action.type === 'evolve' ||
      action.type === 'priorityShift'
  );
  const boardActions = playable.filter(
    (action) => action.type === 'attachEnergy' || action.type === 'retreat' || action.type === 'ability'
  );
  /**
   * **Le café a son panneau** (#399) : l'attachement quitte la rangée générique des gestes.
   * Son panneau dit **quel** café attend en Machine (couleur et nom) avant le choix de la
   * cible, et **pourquoi** rien n'est offert quand ce n'est pas possible — au lieu du
   * silence d'un bouton absent (`phraseCafeAuPoste`).
   */
  const attachements = playable.filter((action) => action.type === 'attachEnergy');
  /**
   * **Le café se touche sur le Planqué** (#454, D-145) : les Planqués qui reçoivent le café en
   * Machine sont marqués sur le plateau, et le toucher appelle **le même geste** que la liste du
   * moteur (`attachEnergy`) — rien de nouveau à jouer, un autre endroit pour le faire.
   */
  const cafeAttachable = new Set(
    attachements.flatMap((action) => (action.type === 'attachEnergy' ? [action.targetUid] : []))
  );
  const attacherCafe = (uid: string) => {
    const geste = attachements.find((action) => action.type === 'attachEnergy' && action.targetUid === uid);
    if (geste) play(geste);
  };
  /**
   * **Une seule entrée « Rotation »** (#455, D-147) : la barre ne porte pas une cible par Planqué du
   * Banc. Elle ouvre le panneau du Poste, qui les liste (`gestesDeLaCarte`, la même liste du moteur).
   */
  const cibles = boardActions.filter((action) => action.type === 'retreat');
  const gestesDuPoste = boardActions.filter((action) => action.type !== 'attachEnergy' && action.type !== 'retreat');
  const raisonCafe = phraseCafeAuPoste({
    aMoi: myMove,
    premierTour: isOpeningTurn(state),
    dejaAttache: mySide.energyAttached,
    cafe: mySide.energyZone ?? undefined,
    aCible: mySide.active !== null || mySide.bench.some(Boolean)
  });
  const pressions = playable.filter((action) => action.type === 'attack');
  const promotions = playable.filter((action) => action.type === 'promoteActive');
  const choices = playable.filter((action) => action.type === 'choose');
  const turnActions = playable.filter((action) => action.type === 'endTurn');

  /** Les Pressions que le café couvre, selon le moteur (`legalAttacks`, testée). */
  const inReach = useMemo(() => legalAttacks(state), [state]);

  /**
   * La ligne de **portée** de la barre (« Hors de portée du café : … », « Pression déjà portée ») :
   * `undefined` quand rien n'est à dire. Elle ne parle que quand c'est mon tour (en solo, elle ne
   * décrit plus le Poste de la Direction). Elle vit sous la phrase du journal, à gauche de « Fin du
   * tour » (#320), et non sur une ligne de plus.
   *
   * La phrase elle-même vit dans `./portee` (#324) : six conditions en ternaire imbriqué dans un
   * fichier déjà gros, c'était de la Feature Envy vers le moteur. Ici, on ne fait que lui passer
   * les faits — mon tour, mon Poste, la Pression consommée, ce que le café couvre.
   */
  const porteeLine = phraseDePortee({
    aMoi: myMove,
    poste: myCard,
    dejaPortee: mySide.hasAttacked,
    enPortee: inReach,
    statuts: mySide.active?.statuses
  });

  /**
   * **Le dessus de mon Deck, regardé** (#162, D-079) : `undefined` quand mon dernier
   * geste n'était pas un regard. C'est *mon* Deck — l'adversaire n'y a jamais accès.
   */
  const regard = useMemo(() => regardDuDernierGeste(state, myCamp), [state, myCamp]);

  /**
   * Le panneau de pose vient sous la main : choisir une carte le **cadre** (`nearest` —
   * rien ne bouge s'il est déjà tout entier à l'écran), pour que le geste suivant soit
   * sous le doigt. La marge basse de `.pose` laisse la barre de navigation à sa place.
   */
  const poseRef = useRef<HTMLElement | null>(null);
  /**
   * **Le focus ne tombe pas sur `body` après un coup** (WCAG, ordre du focus). Le geste joué fait disparaître le
   * bouton qui avait le focus (la Pression, un geste de la pose, la sélection vidée) : le clavier
   * repartait du haut de la page. Quand le focus était dans le combat et qu'il n'a plus de place,
   * il revient sur la barre d'action — le point stable de l'écran. Un focus parti ailleurs (un
   * autre onglet de l'application, un champ) n'est jamais repris.
   */
  const barreRef = useRef<HTMLElement | null>(null);
  const focusDansLeCombat = useRef(false);
  useEffect(() => {
    if (!selectedUid) return;
    poseRef.current?.scrollIntoView({ behavior: comportementDeDefilement(), block: 'nearest' });
    // Le focus reste dans la main après un choix : le panneau de pose apparaît sans être annoncé,
    // et le clavier doit refaire jusqu'à 10 cartes pour atteindre les gestes. Le critère WCAG sur
    // l'ordre du focus veut que le focus suive le contenu qui vient d'apparaître (#525). Un clic
    // à la souris a le même effet (le bouton cliqué a le focus) : c'est voulu. Un focus parti
    // ailleurs n'est jamais déplacé.
    if (document.activeElement?.closest('.hand')) {
      poseRef.current?.focus({ preventScroll: true });
    }
  }, [selectedUid]);

  /**
   * **Les effets de la scène** (#192) : le chiffre de Stress, la traînée de craquage, la pile
   * qui s'allume, l'Intervention qui se remplit. Le compteur (quatre au plus) et la durée
   * (800 ms au plus) vivent dans `effets-combat.ts`, pas dans le CSS.
   */
  const effets = useEffetsDeCombat(state, sansMouvement);

  /**
   * **Les trois gestes du combat ont un son** (D-166, critique du 31/10/2026, P2) : le coup, la
   * casse, le point marqué. Le jeu n'en jouait **aucun** en combat — seul le verdict — alors que
   * l'ouverture d'un Arrivage avait le sien : la récompense la plus forte (faire craquer) était
   * muette.
   *
   * Chaque effet porte un `id` qui ne revient pas pendant sa vie ; on joue **une fois** par id, et
   * on oublie les ids sortis du DOM (ils expirent après 800 ms). Aucun son n'est créé ici : le
   * module audio ne joue que si le testeur l'a autorisé et si le contexte est débloqué (D-137).
   */
  const sonsJoues = useRef(new Set<number>());
  useEffect(() => {
    const vivants = new Set(effets.map((effet) => effet.id));
    for (const id of sonsJoues.current) if (!vivants.has(id)) sonsJoues.current.delete(id);
    for (const effet of effets) {
      if (sonsJoues.current.has(effet.id)) continue;
      sonsJoues.current.add(effet.id);
      if (effet.nature === 'attaque') jouer('pression');
      else if (effet.nature === 'craquage') jouer('craquage');
      else if (effet.nature === 'intervention') jouer('intervention');
    }
  }, [effets]);

  /**
   * **La chorégraphie de la Pression** (D-098) : l'effet d'attaque dit qui frappe qui, le
   * journal dit quelle Pression (`attackIndex`). La carte est retrouvée par son `uid` au Poste
   * ou au Banc **des deux camps**. Un attaquant qui a craqué sur son propre coup
   * (`selfDamage`) n'est plus ni à l'un ni à l'autre : la scène n'a alors rien à animer, et
   * c'est le chiffre de Stress de #192 qui raconte le coup.
   */
  const effetAttaque = effets.findLast((effet) => effet.nature === 'attaque');
  const carteAttaque = useMemo(() => {
    if (!effetAttaque?.uid) return undefined;
    for (const camp of ['player', 'ai'] as const) {
      const cote = state.players[camp];
      const instance = [cote.active, ...cote.bench].find((carte) => carte !== null && carte.uid === effetAttaque.uid);
      if (instance) {
        const definition = getCard(instance.cardId);
        if (definition && isPlanque(definition)) return definition;
      }
    }
    return undefined;
  }, [effetAttaque?.uid, state.players]);
  const attaqueJouee = carteAttaque?.attacks[effetAttaque?.attackIndex ?? 0];
  /**
   * Le Stress **encaissé** par la cible : c'est la valeur de l'effet `stress` qui la vise, donc
   * celle que le jeu a réellement retirée (Vulnérabilité comprise) — jamais le chiffre imprimé
   * sur la carte. La scène n'affiche rien si la cible n'a rien encaissé.
   */
  /**
   * **Le coup de grâce** : la cible de la Pression est aussi celle qui craque. La scène joue
   * alors sa saynète de sortie, et vise le **fantôme** de la carte tombée — elle a déjà quitté
   * le plateau, mais `craquage__carte` la montre encore une fraction de seconde.
   */
  const coupDeGrace = effetAttaque?.cibleCraque === true;
  const stressEncaisse = effetAttaque?.stressCible ?? 0;

  /**
   * **Le raccourci de la bascule d'infos** (#189, `SPEC-COMBAT-UI` §4.6) : `I` et son alias
   * `Ctrl`+`I` (le « remap avec un modificateur » du critère WCAG sur les raccourcis à une touche). Les deux se coupent ensemble
   * depuis Réglages — c'est la **désactivation** qu'exige le critère — et aucun des deux ne
   * réagit dans un champ de saisie. `Ctrl`+`Maj`+`I` est laissé au navigateur (outils de
   * développement) : ce n'est pas l'alias.
   */
  useEffect(() => {
    if (!raccourcisCombat) return;
    const surTouche = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.isComposing) return;
      if (event.key !== 'i' && event.key !== 'I') return;
      if ((event.ctrlKey || event.metaKey) && event.shiftKey) return;
      if (dansUnChampDeSaisie(event.target)) return;
      // Un dialogue **modal** ouvert (Confirmation, Conditions, Règles) : la bascule changerait le
      // plateau derrière lui, sans retour visible. Base UI ne pose pas `aria-modal` : le modal se
      // reconnaît à son `data-slot` (`ui/dialog.tsx`) ; le panneau de l'inspecteur, non modal
      // (`dialog-panneau`), laisse le raccourci agir.
      if (document.querySelector('[data-slot="dialog-content"], [role="alertdialog"]')) return;
      event.preventDefault();
      basculerCombatDetaille();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [raccourcisCombat, basculerCombatDetaille]);

  /**
   * **Forfait** (D-030) : la seule action que la Direction ne peut pas porter. Elle
   * vient de `legalActions` (le moteur dit si la partie vit encore, relève comprise) —
   * l'écran ne décide rien — et elle passe par `applyAction` comme les autres boutons.
   *
   * Deux questions distinctes, deux réponses (#123) : le **moteur** dit *si* le forfait
   * est ouvert (`forfeitOffer`), et il le nomme au camp qui a la main ; l'**écran** dit
   * *qui* se couche — mon camp, `myCamp`, qui vaut `player` en solo. On lit donc la
   * présence de l'action, pas son camp : s'arrêter au camp ferait disparaître le bouton
   * pendant le tour de la Direction, ce que D-030 / #79 a justement ouvert. Le forfait de
   * mon siège est accepté tant que la partie vit, donc ce bouton ne peut pas être refusé
   * par le moteur (#58).
   */
  const forfeitAction = useMemo(
    () => (legal.some((action) => action.type === 'forfeit') ? ({ type: 'forfeit', who: myCamp } as const) : undefined),
    [legal, myCamp]
  );

  /**
   * Le forfait **demande confirmation**, avec le composant du jeu (`Confirmation`, #131) :
   * c'est le même que « Réinitialiser la progression » dans Réglages, et il remplace
   * `window.confirm`. La question vit ici ; `forfaitDemande` garde l'action à jouer.
   */
  const [forfaitDemande, setForfaitDemande] = useState<BattleAction | null>(null);
  const gagnantDuForfait = match ? 'L’autre camp' : 'La Direction';

  /**
   * **« Nouveau combat » referme d'abord les panneaux de l'écran** : la carte choisie, le menu,
   * le code annoncé, la confirmation. La table neuve, elle, vient de `useCombat` (`recommencer`)
   * — c'est elle qui relit le cran de difficulté réglé dans Réglages (#251, D-145).
   */
  const restart = () => {
    setSelectedUid(null);
    setCodeMessage(null);
    setIncoming('');
    setMenu(MENU_FERME);
    setCodeAnnonce(null);
    setNouveauDemande(false);
    recommencer();
  };

  /**
   * **Créer une partie à deux** : la table vient de `useCombat` (`creerPartieADeux`). La table est
   * rendue au joueur : c'est à lui de jouer, et si un code est déjà à passer (la Direction
   * ouvrait), le menu se rouvre seul au rendu qui suit.
   */
  const startTwoPlayer = () => {
    setSelectedUid(null);
    setCodeMessage(null);
    setIncoming('');
    setMenu(MENU_FERME);
    creerPartieADeux();
  };

  /** Le code de la partie, recalculé à chaque état : il décrit ce qui est à l'écran. */
  const code = useMemo(() => (match ? matchCode(state, match) : ''), [state, match]);
  /** Peut-on transmettre ? La règle est dans `@/store/pvp`, l'écran n'en décide pas. */
  const transfer = useMemo(() => (match ? handover(state, match) : null), [state, match]);

  /**
   * **La Partie à deux s'ouvre seule** quand un code est prêt à transmettre (D-093, #191) : c'est
   * le seul moment où le testeur a quelque chose à faire dans le menu. On l'annonce **une fois par
   * code** — le testeur qui referme le menu n'est pas rouvert à chaque rendu —, par un ajustement
   * d'état pendant le rendu (la forme que React recommande pour un état dérivé d'un autre) et non
   * par un effet, qui laisserait passer un rendu sans le menu.
   */
  if (transfer?.ready && codeAnnonce !== code) {
    setCodeAnnonce(code);
    setMenu({ ouvert: true, vue: 'pvp' });
  }

  /**
   * La copie du code (#128), **sans mentir** : le presse-papier peut manquer (page servie
   * en clair, navigateur de téléphone ancien — `navigator.clipboard` est alors `undefined`)
   * ou être refusé (permission, geste non reconnu). Les deux cas sont traités : promettre
   * « copié » sans succès ferait perdre le code, et `navigator.clipboard?.writeText(...).then`
   * levait un `TypeError` quand l'API manquait, donc le message ne venait jamais.
   *
   * Le repli est **le code lui-même** : il reste dans la zone, sélectionné d'office, et
   * le testeur le recopie à la main.
   */
  const codeRef = useRef<HTMLTextAreaElement | null>(null);
  const copyCode = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('presse-papier indisponible');
      await navigator.clipboard.writeText(code);
      setCodeMessage({ ton: 'ok', texte: 'Code copié : donne-le à l’autre joueur.' });
    } catch {
      codeRef.current?.select();
      setCodeMessage({
        ton: 'ok',
        texte: 'Le presse-papier a refusé : le code est sélectionné, recopie-le à la main.'
      });
    }
  }, [code]);

  /** **Coller un code** : la partie reprend, et je prends le camp qui doit jouer. */
  const join = () => {
    const resultat = reprendre(incoming);
    if (!resultat.ok) {
      // La raison du codec est déjà une phrase française : on l'affiche telle quelle.
      setCodeMessage({ ton: 'ko', texte: resultat.raison });
      return;
    }
    setSelectedUid(null);
    setIncoming('');
    // La partie est reprise : la table redevient l'écran (le menu se rouvre seul si un code est prêt).
    setMenu(MENU_FERME);
    setCodeMessage({ ton: 'ok', texte: `Partie reprise : tu joues le ${CAMP_NAME[resultat.camp]}.` });
  };

  const campLabel = (id: PlayerId) =>
    match ? `${id === myCamp ? 'Toi' : 'Adversaire'} · ${CAMP_NAME[id]}` : id === 'player' ? 'Toi' : 'La Direction';
  /* Le nom court d'un camp, pour la piste d'Interventions (#190) : sans le nom du siège. */
  const pisteLabel = (id: PlayerId) => (match ? (id === myCamp ? 'Toi' : 'Adversaire') : campLabel(id));

  /**
   * **L'inspecteur** (#188) : la carte que le panneau montre, par son `uid`. Il se ferme de lui-même
   * quand la carte n'est plus sur le plateau (`localiser` rend `null`). Ses gestes viennent de la
   * même liste que la barre d'action (`playable`) — rien de grisé, et seulement mon camp.
   */
  const [inspecte, setInspecte] = useState<string | null>(null);
  /**
   * L'inspecteur lit **le plateau et la main** (#192) : sous mouvement réduit, une carte de la
   * main ne se soulève pas — c'est le panneau qui s'ouvre au survol et au focus. Une carte de
   * main n'a ni Poste ni rang ; ses gestes sont ceux que la main porte déjà (`playable`).
   */
  const inspecteurPlateau = inspecte ? localiser(state, inspecte) : null;
  const carteEnMain = inspecte ? (mySide.hand.find((carte) => carte.uid === inspecte) ?? null) : null;
  const inspecteur = inspecteurPlateau
    ? { ...inspecteurPlateau, enMain: false }
    : carteEnMain
      ? { camp: myCamp, carte: carteEnMain, auPoste: false, rang: -1, enMain: true }
      : null;
  const inspecteurDefinition = inspecteur ? getCard(inspecteur.carte.cardId) : undefined;
  const gestesInspectes =
    inspecteur && inspecteur.camp === myCamp
      ? inspecteur.enMain
        ? playable.filter((action) => 'uid' in action && action.uid === inspecteur.carte.uid)
        : gestesDeLaCarte(playable, inspecteur.carte.uid, inspecteur.auPoste, inspecteur.rang)
      : [];
  const gestesDuPanneau =
    inspecteur && inspecteur.camp === myCamp ? (
      gestesInspectes.length > 0 ? (
        <>
          {inspecteur.auPoste && gestesInspectes.some((action) => action.type === 'retreat') && (
            <p className="muted inspecteur__rotation">
              Rotation : choisis le Planqué du Banc qui prend le Poste. Le Poste défausse les cafés du coût.
            </p>
          )}
          <div className="actions actions--tight">
            {gestesInspectes.map((action) => (
              <ActionButton
                key={JSON.stringify(action)}
                state={state}
                action={action}
                myCamp={myCamp}
                onAction={(geste) => {
                  setInspecte(null);
                  play(geste);
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="muted">Aucun geste pour cette carte ce tour.</p>
      )
    ) : undefined;

  /** La carte choisie, **si elle est encore dans la main** : sinon la sélection est vide. */
  const selected = mySide.hand.find((card) => card.uid === selectedUid) ?? null;
  const selectedDefinition = selected ? getCard(selected.cardId) : undefined;
  const selectedActions = selected
    ? handActions.filter((action) => 'uid' in action && action.uid === selected.uid)
    : [];

  /**
   * **La place libre du Banc reçoit le geste** (critique du 01/11/2026) : le plateau dessine déjà
   * la place à la taille d'une carte ; quand le moteur y accepte la carte choisie, la place
   * devient la cible du `playBasic` que le panneau proposait trois cents pixels plus bas.
   */
  const placesPosables = new Set(
    selectedActions.flatMap((action) =>
      action.type === 'playBasic' && typeof action.slot === 'number' ? [action.slot] : []
    )
  );
  const poserAuBanc = (slot: number) => {
    const action = selectedActions.find((candidat) => candidat.type === 'playBasic' && candidat.slot === slot);
    if (action) play(action);
  };

  /**
   * Ce que dit la barre d'action quand elle n'a rien à offrir : la partie est finie, c'est à
   * l'autre joueur d'agir (partie à deux), ou — le temps d'un rendu — rien n'est ouvert.
   */
  const attendLAutre = match !== null && state.phase === 'playing' && !myMove;
  const idleLine = attendLAutre
    ? `C’est au ${CAMP_NAME[actor]} de jouer.`
    : state.phase === 'ended'
      ? 'Rien à faire : la partie est terminée.'
      : 'Rien à faire pour le moment.';

  /**
   * « Nouveau combat » jette la partie affichée : sur une partie **commencée** il demande
   * confirmation, comme le forfait (T6 : le menu ne détruit rien sans dialogue). Une partie
   * neuve, ou finie, n'a rien à perdre : le geste est direct.
   */
  const demanderNouveauCombat = () => {
    if (state.phase === 'playing' && state.actionLog.length > 0) setNouveauDemande(true);
    else restart();
  };

  /**
   * La légende des Conditions : une seule source de JSX, pour les deux dialogues qui la montrent —
   * « Conditions » (le lien de la barre d'état, #199) et « Règles » (le menu `⋯`). Composant
   * `dialog` (D-035). Un libellé ajouté à `STATUS_META` y apparaît sans être recopié.
   */
  const conditionsLegend = (
    <ul className="status-legend">
      {STATUS_LIST.map((status) => (
        <li key={status}>
          <StatusBadge status={status} />
          <span className="muted">{STATUS_META[status].description}</span>
        </li>
      ))}
    </ul>
  );

  /**
   * La vue « Partie à deux » du menu (#125) : créer, transmettre le code, le coller. Les
   * commandes de jeu restent celles du moteur, dans la barre d'action : cette vue ne fait que
   * passer la main. Elle s'ouvre seule dès qu'il y a un code à passer (voir plus haut).
   */
  const partieADeux = (
    <div className="combat-menu__corps">
      {match === null ? (
        <>
          <p className="muted">
            Crée la partie ici : sa graine, ton Deck, et le camp adverse tenu par l’autre joueur. Un code apparaît à la
            fin de ton tour.
          </p>
          <div className="actions actions--tight">
            <button type="button" className="button button--primary" onClick={startTwoPlayer}>
              <Users size={16} /> Créer une partie à deux
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="notice">{campLine(state, match)}</p>
          <p className="muted">
            Aucun camp n’est joué par l’IA : c’est l’autre joueur qui tient le camp adverse, avec les mêmes boutons que
            toi.
          </p>
          {transfer?.ready ? (
            <>
              <p className="muted">
                Ton tour est fini : copie ce code, l’autre joueur le colle dans son onglet et reprend ici, avec le camp
                adverse.
              </p>
              <div className="actions actions--tight">
                <button type="button" className="button" onClick={copyCode}>
                  <Copy size={16} /> Copier le code
                </button>
              </div>
              {/* Un appui sélectionne le code entier : sur téléphone, c'est le repli
                  quand la copie automatique est refusée (#128). */}
              <textarea
                className="pvp__code"
                ref={codeRef}
                readOnly
                value={code}
                rows={4}
                aria-label="Code de la partie, à transmettre"
                onFocus={(event) => event.currentTarget.select()}
              />
            </>
          ) : (
            <p className="muted">{transfer?.raison}</p>
          )}
          <p className="muted">« Nouveau combat » quitte la partie à deux et rend le combat solo.</p>
        </>
      )}

      <label className="field">
        <span className="field__label">Coller un code reçu</span>
        {/* Sur téléphone, le clavier corrige : un code base64url n'a ni majuscules
            initiales à deviner ni mots à corriger, et une correction le casse en
            silence (#128). Le champ grandit vers le bas, la page ne bouge pas. */}
        <textarea
          className="pvp__code"
          value={incoming}
          onChange={(event) => setIncoming(event.target.value)}
          placeholder="PLQ1.…"
          rows={3}
          aria-label="Code reçu, à coller"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <div className="actions actions--tight">
        <button type="button" className="button" onClick={join}>
          <ClipboardPaste size={16} /> Prendre le camp adverse
        </button>
      </div>
      <p className="muted">
        Coller un code remplace le combat affiché : la partie reprend là où l’autre joueur l’a laissée, et tu prends le
        camp qui doit jouer.
      </p>
      {codeMessage && (
        <p className={codeMessage.ton === 'ok' ? 'muted' : 'muted pvp__message--ko'}>{codeMessage.texte}</p>
      )}
    </div>
  );

  useEffect(() => {
    const actif = document.activeElement;
    if (focusDansLeCombat.current && (actif === null || actif === document.body)) {
      barreRef.current?.focus({ preventScroll: true });
    }
  }, [state]);

  return (
    <div
      onFocusCapture={() => {
        focusDansLeCombat.current = true;
      }}
      onBlurCapture={(evenement) => {
        const suivant = evenement.relatedTarget as Node | null;
        if (suivant && !evenement.currentTarget.contains(suivant)) focusDansLeCombat.current = false;
      }}
      className={`page battle battle--${combatDetaille ? 'detaille' : 'sobre'}${
        pasAPas.ouvert ? ' battle--pas-a-pas' : ''
      }${sansMouvement ? ' battle--mouvement-reduit' : ''}`}
      /* Le CSS lit aussi cet attribut local : le réglage du store passait jusque-là inaperçu
         (#192), seul `prefers-reduced-motion` coupait le soulèvement des cartes. */
      data-mouvement-reduit={sansMouvement ? 'true' : 'false'}
      /* Les cibles de l'étape courante : `styles.css` met en avant l'élément qui porte
         le `data-pas-a-pas` correspondant (`pasAPas.designe`). Fermé, aucun élément ne
         porte l'attribut — donc aucun contour. */
      data-pas-a-pas-cibles={pasAPas.cibles}
    >
      <section className="battle__head">
        {/* **La sortie du combat** : la barre du bas n'existe plus en combat (#275), et sur un écran
            court la barre du haut s'efface aussi (`styles.css`, « écran court »). Ce lien reste donc
            le chemin vers l'accueil, en un geste. Ce n'est **pas** un forfait : la partie est rangée
            à chaque coup (`enregistrerPartie`, #126) et reprend au retour. */}
        <Link
          to="/"
          className="battle__sortie"
          aria-label={tutoriel ? 'Quitter le combat guidé' : 'Quitter le combat, la partie est gardée'}
          onClick={(evenement) => {
            // **Le retour va là d'où l'on vient** (#427) : entré par le Deck, on revient au Deck.
            // Sans page précédente dans l'application (lien direct, PWA rouverte), l'accueil.
            if (location.key === 'default') return;
            evenement.preventDefault();
            void navigate(-1);
          }}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="battle__title">
          <h1>Combat</h1>
          {/* `aria-live` : la ligne change au changement de tour et de camp, et un lecteur d'écran
              l'entend alors (WCAG, messages d’état) ; le moteur ne journalise pas les tours. */}
          <p className="muted" aria-live="polite">
            Tour {state.turn} · {match ? campLine(state, match) : libelleDuTour(state)}
          </p>
          {partieReprise && (
            <p className="battle__reprise" role="status">
              Partie reprise au tour {state.turn}, comme tu l’as laissée.
            </p>
          )}
          {/* L'attente de la Direction (#131) : annoncée au lecteur d'écran, et elle disparaît
              dès que le coup est joué. Aucun point animé : le mouvement réduit n'a rien à couper.
              Sa présence vient de `useCombat` : c'est la Direction qui a une action en main. */}
          {directionReflechit && (
            <p className="battle__attente" role="status">
              La Direction réfléchit…
            </p>
          )}
        </div>
        {/* Les Conditions (#199) : la rangée des cinq a quitté le plateau. Elle tient ici en un lien,
            qui ouvre la même légende que « Règles » dans le menu ; c'est la cible « conditions » du
            pas-à-pas, et elle reste à l'écran. La place du `ⓘ` (#189) reste libre. */}
        <Dialog>
          <DialogTrigger
            render={
              <button type="button" className="battle__conditions" data-pas-a-pas={pasAPas.designe('conditions')} />
            }
          >
            {/* Sous 400 px, le libellé se cache (il reste le nom accessible) et l'icône tient la place :
                « Tour N · à toi » ne se coupait plus qu'au profit de ce bouton (relecture du combat). */}
            <Activity className="battle__conditions-icone" size={18} aria-hidden="true" />
            <span className="battle__conditions-libelle">Conditions</span>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conditions</DialogTitle>
              <DialogDescription>Ce qu’un Planqué au Poste peut subir.</DialogDescription>
            </DialogHeader>
            {conditionsLegend}
          </DialogContent>
        </Dialog>
        {/* La **bascule d'infos** (#189) : c'est elle qui possède cette place dans la barre
            d'état, le `⋯` appartient au menu (#191). Le bouton visible est l'équivalent tactile
            du raccourci (le critère WCAG sur les raccourcis à une touche), `aria-pressed` dit le mode, `aria-keyshortcuts` le geste. Le
            mode courant n'est plus dans un `title` (#286, T3) : `aria-pressed` le porte déjà, et
            un `title` ne s'ouvre ni au clavier ni au doigt. */}
        <button
          type="button"
          className="battle__infos"
          aria-pressed={combatDetaille}
          aria-keyshortcuts="I"
          /* **Le nom dit l'effet, pas la matière** (critique du 31/10/2026) : « Infos détaillées »
             laissait croire à une fiche ou un journal, alors que le bouton **change la densité** du
             plateau (chiffre de Stress, dégâts des Pressions, noms des Conditions). */
          aria-label="Plus de détail sur les cartes"
          onClick={basculerCombatDetaille}
        >
          <Info size={18} aria-hidden="true" />
          {/* La touche, affichée à l'écran (#525) : le raccourci `I` n'était lisible nulle part. Elle est
              `aria-hidden` : le nom accessible reste « Plus de détail sur les cartes », et le geste est déjà dans `aria-keyshortcuts`. */}
          <span className="battle__infos-touche" aria-hidden="true">
            I
          </span>
        </button>
        <MenuCombat etat={menu} onChange={setMenu}>
          {(menuApi) => {
            if (menu.vue === 'journal') {
              return (
                <ol className="log combat-menu__corps">
                  {state.log.slice(-14).map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                </ol>
              );
            }
            if (menu.vue === 'pvp') return partieADeux;
            return (
              <ul className="combat-menu__liste">
                {/* **La navigation en combat** (#427) : la barre du bas est retirée (#275) et la
                    barre du haut s'efface sur téléphone. Ces liens la rendent ici, dans le panneau
                    qui s'ouvre déjà — rien ne reprend la place du plateau. Un lien ne déclare pas de
                    forfait : la partie est rangée à chaque coup (#126) et reprend au retour. */}
                <li>
                  <nav className="combat-menu__ailleurs" aria-label="Aller à un autre écran">
                    {ECRANS_DU_MENU.map((ecran) => (
                      <Link key={ecran.to} to={ecran.to} className="combat-menu__lien">
                        {ecran.label}
                      </Link>
                    ))}
                  </nav>
                </li>
                <li>
                  <button type="button" className="combat-menu__entree" onClick={() => menuApi.aller('journal')}>
                    <ScrollText size={16} aria-hidden="true" /> Journal
                  </button>
                </li>
                <li>
                  <button type="button" className="combat-menu__entree" onClick={() => menuApi.aller('pvp')}>
                    <Users size={16} aria-hidden="true" /> Partie à deux
                    <span className="muted">un code à se passer, sans serveur</span>
                  </button>
                </li>
                <li>
                  {/* **Les règles en une minute** (#270) : le même panneau que dans Réglages —
                      un seul corps, deux entrées. La légende des Conditions reste sur le
                      bouton de la barre d'état, à sa place. */}
                  <PresentationRegles
                    className="combat-menu__entree"
                    extra={
                      <>
                        <h3>Conditions</h3>
                        <p className="muted">Ce qu’un Planqué au Poste peut subir.</p>
                        {conditionsLegend}
                      </>
                    }
                  >
                    <BookOpen size={16} aria-hidden="true" /> Règles
                    <span className="muted">une minute</span>
                  </PresentationRegles>
                </li>
                {forfeitAction && (
                  <li>
                    <button
                      type="button"
                      className="combat-menu__entree"
                      onClick={() => setForfaitDemande(forfeitAction)}
                    >
                      <Flag size={16} aria-hidden="true" /> Abandonner
                    </button>
                  </li>
                )}
                <li>
                  <button type="button" className="combat-menu__entree" onClick={demanderNouveauCombat}>
                    <RotateCcw size={16} aria-hidden="true" /> Nouveau combat
                  </button>
                </li>
              </ul>
            );
          }}
        </MenuCombat>
      </section>

      {/* Le pas-à-pas est **en haut**, collé sous l'en-tête (#169) : il suit la lecture.
          **Il s'efface en fin de partie** (critique du 01/11/2026) : à `?scene=fin`, son panneau
          ouvert plus le bandeau du verdict poussaient la barre d'action 7 à 8 px sous la fenêtre
          (mesuré à 420 × 900 et 390 × 664) — et il n'a plus rien à enseigner une fois la partie
          finie. Le verdict et « Nouveau combat » prennent sa place (D-103). */}
      {state.phase !== 'ended' && <PasAPasCombat pasAPas={pasAPas} />}

      {/* **La scène de fin** (30/10/2026) : dans la fin scriptée seulement, le verdict se
          pose comme un tampon, avec la phrase de la Direction. Un clic la referme ; la
          barre d'action garde ensuite le bandeau et les deux boutons. */}
      {sceneFinOuverte && (
        <SceneFin
          gagne={state.winner === myCamp}
          replique={repliqueDirection}
          calme={sansMouvement}
          onFermer={() => setSceneFinFermee(true)}
          /* **Continuer continue la visite** (31/10/2026) : le panneau est caché sur le
             plateau, donc sans cet enchaînement le testeur restait au combat sans savoir
             qu'il restait deux étapes. Hors Journée, « Continuer » ferme seulement. */
          onContinuer={() => {
            if (!sceneFin || tutorielVu) return;
            // L'étape du combat est la troisième (index 2) : on ne l'avance que depuis elle,
            // sinon un rejeu du combat plus tard sauterait une étape de la visite.
            if (etapeJournee() === 2) avancerJournee();
            navigate('/settings');
          }}
        />
      )}

      {/* **Le combat guidé** (#272) : le bandeau dit ce qui se passe et ce qui suit. Le
          guidage ne bloque rien — on peut le passer à tout moment et jouer dessous. */}
      {tutoriel && state.phase !== 'ended' && (
        <p className={`notice ${pasAPas.ouvert ? 'notice--ok' : ''}`} role="status">
          {pasAPas.ouvert ? (
            <>
              <strong>Combat guidé</strong> contre la Direction : cinq étapes, puis tu joues seul. « Passer le pas-à-pas
              » te rend la main tout de suite.
            </>
          ) : (
            <>
              <strong>À toi de jouer.</strong> Le guidage est fini : la partie continue normalement, et « Nouveau combat
              » en relance une.
            </>
          )}
        </p>
      )}

      {state.phase === 'ended' && (
        // `role="alert"` : le verdict est annoncé à son apparition (WCAG, messages d’état) ; il n'était porté que
        // par un son.
        <p className={`notice ${state.winner === myCamp ? 'notice--ok' : 'notice--warn'}`} role="alert">
          {endBanner(state, match ? myCamp : null)}
        </p>
      )}

      {/*
        **La table** (#169) : le plateau des deux camps, puis la console du joueur — la main et la
        pose. Sur téléphone, tout s'empile et tient dans l'écran ; sur un écran large, la console
        passe à côté du plateau. Les actions sont dans la barre collée plus bas, et tout ce qui est
        secondaire (Journal, Partie à deux, Règles, Abandonner, Nouveau combat) dans le menu `⋯`.
      */}
      <div className="battle__table">
        <section className="board" aria-label="Plateau" data-pas-a-pas={pasAPas.designe('plateau')}>
          {/* La scène de la Pression (D-098) : deux `canvas` et les cartes animées par l'API
              Web Animations. Rien ne se monte sous « Mouvement réduit ». */}
          <SceneAttaque
            effetId={effetAttaque?.id}
            uid={effetAttaque?.uid}
            uidCible={effetAttaque?.uidCible}
            carte={carteAttaque}
            attaque={attaqueJouee}
            stress={stressEncaisse}
            coupDeGrace={coupDeGrace}
            sansMouvement={sansMouvement}
          />
          {/* La piste d'Interventions (#190) sépare les deux camps : elle est **une** seule cible du
              pas-à-pas (son conteneur), jamais une par camp. */}
          {[otherCamp(myCamp), myCamp].map((id, index) => (
            <Fragment key={id}>
              {index === 1 && (
                <PisteInterventions
                  camps={[otherCamp(myCamp), myCamp].map((camp) => ({
                    label: pisteLabel(camp),
                    points: state.players[camp].points,
                    /* Le camp qui a gagné **allume sa piste** : la fin se voit avant de se
                       lire (30/10/2026). */
                    finale: state.phase === 'ended' && state.winner === camp,
                    /* Les crans qui viennent d'être acquis (#192) : leur hexagone rebondit
                       une fois ; sous mouvement réduit, il est simplement déjà rempli. */
                    fraiches: effets
                      .filter((effet) => effet.nature === 'intervention' && effet.camp === camp && effet.anime)
                      .map((effet) => effet.numero ?? 0)
                  }))}
                  designe={pasAPas.designe('interventions')}
                />
              )}
              <Camp
                label={campLabel(id)}
                side={state.players[id]}
                current={state.current === id && state.phase === 'playing'}
                mine={id === myCamp}
                pendingPromotion={state.pendingPromotion === id}
                pasAPas={pasAPas}
                inspecte={inspecte}
                detaille={combatDetaille}
                effets={effets.filter((effet) => effet.camp === id)}
                cibleScene={sansMouvement ? undefined : effetAttaque?.uidCible}
                raisonsDeckDeTest={usedTestDeck && id === myCamp ? raisonsDeckDeTest : undefined}
                cafeAttachable={id === myCamp ? cafeAttachable : undefined}
                onAttacherCafe={attacherCafe}
                onPoserPlace={id === myCamp && selected ? poserAuBanc : undefined}
                nomAPoser={selected ? cardName(selected.cardId) : undefined}
                placesPosables={id === myCamp && selected ? placesPosables : undefined}
                onInspecter={setInspecte}
              />
            </Fragment>
          ))}
          {/* Le trait de la Pression est **dessiné par la scène** (D-098) : deux animations
              pour un seul coup se verraient. La traînée de craquage, elle, reste ici — c'est
              la même règle : une seule bande à la fois. */}
          {/* La traînée de craquage (#192) : une seule, entre l'attaquant et sa cible. Elle ne
              traverse **jamais** sous mouvement réduit — le fantôme désaturé et le bandeau
              « a craqué » disent tout, sans mouvement. */}
          {!sansMouvement &&
            effets
              .filter((effet) => effet.nature === 'craquage')
              .map((effet) => (
                <span
                  key={`train-${effet.id}`}
                  className={`craquage__train ${
                    effet.camp === myCamp ? 'craquage__train--vers-le-bas' : 'craquage__train--vers-le-haut'
                  }`}
                  aria-hidden="true"
                />
              ))}
        </section>

        <div className="battle__console">
          {/* L'inspecteur (#188) : la colonne de droite à partir de 900 px, une feuille basse sur
              téléphone. Il ne recouvre pas la carte qu'il décrit (`InspecteurCombat`). */}
          <InspecteurCombat
            ouvert={inspecteur !== null}
            onOpenChange={(ouvert) => {
              if (!ouvert) setInspecte(null);
            }}
            nom={inspecteur ? cardName(inspecteur.carte.cardId) : ''}
            ancre={inspecte}
            garderLeFocus={mySide.hand.some((carte) => carte.uid === inspecte)}
            fiche={
              inspecteur && inspecteurDefinition ? (
                <FicheCarte
                  instance={inspecteur.carte}
                  card={inspecteurDefinition}
                  machine={inspecteur.auPoste ? texteMachine(state.players[inspecteur.camp]) : undefined}
                />
              ) : null
            }
            gestes={gestesDuPanneau}
          />
          {regard && <RegardDuDessus carte={regard} />}

          <section className="section hand-panel" data-pas-a-pas={pasAPas.designe('main')}>
            <div className="section__head">
              {/* En partie à deux, « ta main » est celle du camp que je tiens : l'autre joueur,
                  lui, n'en voit jamais que le compte (bandeau du plateau). */}
              <h2>{match === null ? 'Ta main' : `Ta main · ${CAMP_NAME[myCamp]}`}</h2>
              <span className="muted">
                {mySide.hand.length} / {HAND_LIMIT}
                {myMove && handActions.length > 0 && !selected ? ' · touche une carte pour la jouer' : ''}
              </span>
            </div>
            {mySide.hand.length === 0 ? (
              <p className="muted">Main vide.</p>
            ) : (
              // **L'éventail** (#200, SPEC-COMBAT-UI §6.8 R1) : chaque carte est le gabarit (`CardView`),
              // inclinée et chevauchée, rognée par le conteneur `.hand`. Le **bouton** est posé par-dessus
              // la carte : il porte le geste, `aria-pressed` et le nom lu par un lecteur d'écran.
              <ul className="hand" style={{ '--n': mySide.hand.length } as CSSProperties}>
                {mySide.hand.map((card, index) => {
                  const definition = getCard(card.cardId);
                  const isSelected = selected?.uid === card.uid;
                  const jouable = handActions.some((action) => 'uid' in action && action.uid === card.uid);
                  // L'éventail se déploie autour du centre : les cartes du bord s'inclinent et s'abaissent.
                  const decalage = index - (mySide.hand.length - 1) / 2;
                  const etat = `${isSelected ? ' is-selected' : ''}${jouable ? ' is-playable' : ''}`;
                  return (
                    <li
                      key={card.uid}
                      className={`hand__carte${etat}`}
                      data-uid={card.uid}
                      style={
                        {
                          '--rot': `${decalage * 2}deg`,
                          '--dec': `${decalage * decalage * 0.8}px`
                        } as CSSProperties
                      }
                      /* Sous « Mouvement réduit », la carte ne se soulève pas : c'est
                         l'inspecteur qui s'ouvre au survol et au focus (#192, #188). */
                      onPointerEnter={(evenement) => {
                        if (!sansMouvement || evenement.pointerType !== 'mouse') return;
                        setInspecte(card.uid);
                      }}
                      onFocus={() => {
                        if (sansMouvement) setInspecte(card.uid);
                      }}
                    >
                      {definition && (
                        <div className="hand__visuel" aria-hidden>
                          <CardView card={definition} calme plateau />
                        </div>
                      )}
                      <button
                        type="button"
                        className={`hand__card${etat}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedUid(isSelected ? null : card.uid)}
                      >
                        {/* Le nom et l'état, lus à voix haute : la carte visible est `aria-hidden`. */}
                        <span className="hand__name sr-only">{cardName(card.cardId)}</span>
                        <span className="hand__meta sr-only">
                          <span className="hand__kind">{definition && kindLabel(definition)}</span>
                          {jouable && <span className="hand__tag">Jouable</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/*
            **La pose** (#169) : la carte choisie reste sous les yeux — nommée, avec son texte —
            tant qu'on ne l'a pas posée, et chaque geste dit **où** : « Poser au Poste »,
            « Mettre au Banc 2 », « Jouer cet Objet ». Il vient **sous la main** et la page le
            cadre dès qu'une carte est choisie (`poseRef`) : sur téléphone il ne reste jamais
            sous la barre de navigation.
          */}
          {selected && (
            <section className="pose panel" aria-label="Poser la carte choisie" tabIndex={-1} ref={poseRef}>
              <p className="pose__titre">
                <span className="muted">Carte choisie</span> <strong>{cardName(selected.cardId)}</strong>{' '}
                <span className="hand__kind">{selectedDefinition && kindLabel(selectedDefinition)}</span>
              </p>
              {selectedDefinition && !isPlanque(selectedDefinition) && (
                <p className="hand__text muted">{selectedDefinition.text}</p>
              )}
              {/* Un Planqué de la main se lit comme au plateau : son Seuil, ses Pressions et leur coût,
                  son Talent. Au toucher, l'inspecteur au survol n'existe pas : la fiche est ici. */}
              {selectedDefinition && isPlanque(selectedDefinition) && (
                <FicheCarte instance={selected} card={selectedDefinition} />
              )}
              {selectedActions.length > 0 ? (
                <>
                  <p className="muted pose__aide">Touche un geste pour la jouer :</p>
                  <div className="actions actions--tight">
                    {selectedActions.map((action) => (
                      <ActionButton
                        key={JSON.stringify(action)}
                        state={state}
                        action={action}
                        myCamp={myCamp}
                        onAction={play}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted">
                  {myMove ? 'Cette carte ne peut pas être jouée maintenant.' : 'Ce n’est pas ton tour de jouer.'}
                </p>
              )}
              <button type="button" className="link-button" onClick={() => setSelectedUid(null)}>
                Reprendre une autre carte
              </button>
            </section>
          )}
          {/* La barre vit **dans la console** : en colonne (téléphone en portrait) elle suit la main
              comme avant ; sur un écran large (paysage, PC) elle reste sous la main, dans la colonne
              de droite, au lieu de flotter sous le plateau. */}
          {/*
            **La barre d'action** (D-093, #191) : collée au-dessus de la navigation, elle porte ce qui
            se joue au Poste — café, Rotation, Talent, les Pressions, « Fin du tour » — et, quand le
            moteur l'ouvre, la relève ou le choix en attente. Elle est **toujours là** (`.combat-barre`,
            mesurée par `npm run capturer`) : c'est la cible « poste-actions » du pas-à-pas, et c'est
            elle qui libère la hauteur dont la main a besoin. Elle ne rend que ce que dit la liste du
            moteur : en partie à deux, le tour de l'autre ne lui prête aucun bouton (#125).
          */}
          {/* `cramped-padding` est désactivé **ici et pour une raison écrite** (#205, AGENTS.md §6) :
                la règle demande 8 px entre les lignes de la barre et son cadre ; D-094 (3) exige, elle,
                20 px entre le bas de la barre et le bas de l'écran, et `npm run capturer` le mesure à
                420 × 900. Les deux ne tiennent pas ensemble : les 16 px d'inset font tomber la marge à
                14 px (mesuré le 28/10/2026). La marge protège le pouce, l'inset est cosmétique —
                c'est la marge qui gagne, et la règle se tait ici plutôt que de rougir une fois sur deux. */}
          <section
            ref={barreRef}
            tabIndex={-1}
            /* Une Pression jouable : « Fin du tour » cède le plein à la Pression (feuille de styles). */
            data-pression-jouable={myMove && pressions.length > 0 ? 'true' : undefined}
            className="combat-barre"
            aria-label="Actions du tour"
            data-impeccable-ignore="cramped-padding"
            data-pas-a-pas={pasAPas.designe('poste-actions')}
            /* Plus de halo local : la cible de la Journée vient d'un seul module
               (`journee-cible`), et le panneau s'efface sur le plateau (31/10/2026) —
               c'est le pas-à-pas qui désigne, ici. */
          >
            {/* **L'annonce du coup** (WCAG, messages d'état) : une zone **persistante** — jamais re-montée, sinon un
                lecteur d'écran ne l'entend pas changer — qui reçoit la dernière ligne du journal. La
                ligne visible, elle, est re-montée à chaque coup pour son entrée animée : elle ne peut
                pas porter l'annonce. En fin de partie, c'est le bandeau du haut qui parle (`alert`). */}
            <p className="sr-only" aria-live="polite" data-testid="annonce-du-coup">
              {state.phase === 'ended' ? '' : lastLog}
            </p>
            {/* **L'annonce de la réplique de la Direction** (02/11/2026) : même principe que le journal,
                `aria-live="polite"` pour que le lecteur d'écran l'entende changer. Elle ne parle qu'en solo,
                aux trois moments (craquage, victoire, défaite). */}
            <p className="sr-only" aria-live="polite" data-testid="annonce-replique-direction">
              {repliqueDirection ?? ''}
            </p>
            {/* La dernière ligne du journal (#199) : « Lancer de tampon : tu ouvres. » et le reste de ce
                qui vient de se passer. Elle vit dans la barre d'action, là où l'œil est déjà : une
                information temporaire n'a pas à occuper une bande de plus. */}
            {/* **« Fin du tour » vit sur cette ligne** (#320), à droite de la phrase du journal : c'est
                l'action principale, et elle garde la même place à chaque état du tour. Quand une
                Pression est jouable, la rangée des gestes dessous porte le café, la Rotation, le Talent
                et la Pression — « Fin du tour » ne descend donc plus jamais sur une ligne de plus, sous
                la barre de navigation (420 × 900, `npm run capturer` le mesure). */}
            {(lastLog || porteeLine || raisonCafe || turnActions.length > 0) && (
              <div className="combat-barre__tete">
                <div className="combat-barre__texte">
                  {lastLog && (
                    /* **`wait`, pas `popLayout`** (#551, mesuré le 31/10/2026) : `popLayout` sort
                       la ligne qui s'en va en `position: absolute`, et la nouvelle ligne la
                       recouvre pendant la sortie. La ligne sortante reste alors **510 ms** en
                       place à l'opacité 0 (mesuré : 113 → 627 ms, 734 → 1246 ms après le
                       chargement) — deux paragraphes superposés, que le détecteur lit comme
                       `text-occlusion`, et qui se marcheraient dessus à l'œil pendant la sortie.
                       `wait` garde la ligne sortante dans le flux (pas de saut de hauteur) et
                       laisse la nouvelle entrer quand elle a fini. */
                    <AnimatePresence mode="wait" initial={false}>
                      {/* Sous « Mouvement réduit », la ligne change sans glisser ni rebondir : le
                          réglage ne coupait que le CSS, framer-motion ne le lisait pas. */}
                      <motion.p
                        key={state.log.length}
                        className={`banner combat-barre__journal ${/craque/.test(lastLog) ? 'banner--ko' : ''}`}
                        initial={sansMouvement ? false : { opacity: 0, y: -10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        /* Une sortie **courte** : c'est elle qui borne l'attente de `wait`, et
                           120 ms suffisent à ne pas voir la ligne tomber. */
                        exit={sansMouvement ? undefined : { opacity: 0, y: 6, transition: { duration: 0.12 } }}
                        transition={sansMouvement ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 26 }}
                      >
                        {lastLog}
                      </motion.p>
                    </AnimatePresence>
                  )}
                  {porteeLine && <p className="muted combat-barre__portee">{porteeLine}</p>}
                  {/* **Pourquoi le café n'est pas attachable** (#399) : la même place que la ligne
                      de portée, sous le journal, là où l'œil cherche déjà ce qui manque au tour. */}
                  {raisonCafe && <p className="muted combat-barre__portee combat-barre__cafe-raison">{raisonCafe}</p>}
                  {repliqueDirection && (
                    /* `data-testid` : le `<strong>` coupe le texte en deux nœuds, donc
                       `getByText` ne peut pas lire la ligne entière — les tests visent
                       l'élément, pas sa mise en forme (#544). */
                    <p className="muted combat-barre__portee combat-replique" data-testid="replique-direction">
                      <strong>La Direction</strong> · {repliqueDirection}
                    </p>
                  )}
                </div>
                {turnActions.map((action) => (
                  <span className="combat-barre__fin" key={JSON.stringify(action)}>
                    <ActionButton state={state} action={action} myCamp={myCamp} onAction={play} />
                  </span>
                ))}
              </div>
            )}

            {state.pendingPromotion && (
              <section className="notice notice--warn promotion">
                {state.pendingPromotion === myCamp ? (
                  <p>Ton Poste a craqué. À toi de choisir ta relève.</p>
                ) : match === null ? (
                  <p>Le Poste de la Direction a craqué. Elle choisit sa relève toute seule.</p>
                ) : (
                  <p>Le Poste adverse a craqué : c’est à l’autre joueur de choisir sa relève. Transmets-lui le code.</p>
                )}
                <div className="actions actions--tight">
                  {promotions.map((action) => (
                    <ActionButton
                      key={JSON.stringify(action)}
                      state={state}
                      action={action}
                      myCamp={myCamp}
                      onAction={play}
                    />
                  ))}
                </div>
              </section>
            )}

            {choices.length > 0 && (
              <section className="notice notice--warn choix">
                <p>Un effet te demande de désigner une carte.</p>
                <div className="actions actions--tight">
                  {choices.map((action) => (
                    <ActionButton
                      key={JSON.stringify(action)}
                      state={state}
                      action={action}
                      myCamp={myCamp}
                      onAction={play}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Les gestes du Poste sur **une seule ligne** quand ils tiennent : la rangée de café,
                Rotation et Talent défile au lieu de passer à la ligne (quatre Planqués à nourrir ne
                font pas quatre lignes), et les Pressions viennent à côté. « Fin du tour » est sur la
                ligne du journal, au-dessus (#320). La barre ne doit jamais recouvrir la main ni passer
                sous la navigation (`npm run capturer` le mesure). */}
            {(gestesDuPoste.length > 0 || cibles.length > 0 || pressions.length > 0 || attachements.length > 0) && (
              <div className="combat-barre__gestes">
                {attachements.length > 0 && (
                  <PanneauAttacheCafe cafe={mySide.energyZone ?? undefined} raison={raisonCafe} />
                )}
                {(gestesDuPoste.length > 0 || cibles.length > 0) && (
                  <div className="actions actions--tight combat-barre__rang">
                    {mySide.active && cibles.length > 0 && (
                      <button type="button" className="button" onClick={() => setInspecte(mySide.active?.uid ?? null)}>
                        <Coffee size={16} />
                        <span>Rotation</span>{' '}
                        <span className="button__detail">
                          {cibles.length} cible{cibles.length > 1 ? 's' : ''}
                        </span>
                      </button>
                    )}
                    {gestesDuPoste.map((action) => (
                      <ActionButton
                        key={JSON.stringify(action)}
                        state={state}
                        action={action}
                        myCamp={myCamp}
                        onAction={play}
                      />
                    ))}
                  </div>
                )}
                {pressions.map((action) => (
                  <ActionButton
                    key={JSON.stringify(action)}
                    state={state}
                    action={action}
                    myCamp={myCamp}
                    onAction={play}
                  />
                ))}
              </div>
            )}

            {playable.length === 0 && state.phase !== 'ended' && (
              <p className="muted combat-barre__repos">
                {idleLine}
                {attendLAutre && (
                  <>
                    {' '}
                    <button type="button" className="link-button" onClick={() => setMenu({ ouvert: true, vue: 'pvp' })}>
                      Coller un code
                    </button>
                  </>
                )}
              </p>
            )}
            {/* **Rejouer, là où l'œil cherche l'action** (relecture du combat, 30/10/2026) : en fin de
                partie, la barre n'offrait qu'une phrase, et « Nouveau combat » vivait dans `⋯`. Le
                bandeau du haut garde le verdict ; D-030 n'écarte que l'écran plein de victoire, pas un
                bouton. Une partie finie n'a rien à perdre : le geste est direct. */}
            {state.phase === 'ended' && (
              <div className="combat-barre__gestes">
                {/* **La fin du tutoriel propose la suite** (30/10/2026) : une partie complète
                    avec le Deck chargé à l'étape 2, ou la reprise de la Journée par son propre
                    panneau (« Suivant », resté ouvert au-dessus). Ici, seul le premier choix
                    a besoin d'un bouton. */}
                {sceneFin && state.winner === 'player' && (
                  <Link className="button" to="/battle">
                    Une partie complète
                  </Link>
                )}
                <button type="button" className="button button--primary" onClick={demanderNouveauCombat}>
                  <RotateCcw size={16} aria-hidden="true" /> Nouveau combat
                </button>
              </div>
            )}
          </section>
          {/* Le journal dans la console (D-158, #520) : la console était vide sous la barre d'action
              sur écran large. Le journal reste aussi dans `⋯`. Pas d'`aria-live` : l'annonce du
              coup a déjà sa zone. */}
          {ecranLarge && (
            <section className="journal-console" aria-label="Journal du combat">
              <h2 className="journal-console__titre">Journal</h2>
              <ol className="log journal-console__liste">
                {state.log.slice(-12).map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>

      <Confirmation
        open={forfaitDemande !== null && forfeitAction !== undefined}
        titre="Déclarer forfait ?"
        texte={`${gagnantDuForfait} l’emporte, quel que soit le score. Tu ne pourras pas reprendre cette partie.`}
        confirmer="Abandonner"
        onConfirm={() => {
          if (forfaitDemande) play(forfaitDemande);
          setForfaitDemande(null);
          // La partie est finie : le menu qui portait « Abandonner » n'a plus rien à offrir.
          setMenu(MENU_FERME);
        }}
        onCancel={() => setForfaitDemande(null)}
      />
      <Confirmation
        open={nouveauDemande}
        titre="Recommencer un combat ?"
        texte="La partie en cours est jetée, et un combat neuf commence. Tu ne pourras pas la reprendre."
        confirmer="Nouveau combat"
        onConfirm={restart}
        onCancel={() => setNouveauDemande(false)}
      />
    </div>
  );
}
