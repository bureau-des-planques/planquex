/*
 * **L'orchestration d'un combat** (#556, tranche 5.1) : la mécanique de tour sort de
 * `Battle.tsx`, qui garde le rendu.
 *
 * Ce que le hook tient : l'état de la table et sa **création** (une partie rangée qu'on
 * reprend, la fin scriptée du tutoriel, le combat guidé), le seul chemin vers `applyAction`
 * (`jouer`), le tour de la Direction (sa décision, et le délai qui la rend lisible), la
 * partie à deux (créer, reprendre un code), l'enregistrement de la partie et la trace de fin,
 * et le verdict sonore.
 *
 * Ce que l'écran garde : ce qu'il **montre** — la liste du moteur mise en boutons, la main,
 * les panneaux, le menu, le code à copier, les effets de la scène. Il tient aussi ce qui n'est
 * qu'à lui : la carte choisie, l'inspecteur, le menu. Le hook ne les connaît pas, et c'est
 * pourquoi il prévient par `onCoup` : un coup part, la carte que l'écran tenait ne tient plus.
 *
 * Décision du 02/11/2026 (#556) : le hook vit dans un dossier de **domaine**, `src/combat/`,
 * sur le précédent de `src/animation/` — pas un `src/hooks/` générique. La scène de la Pression
 * viendra à côté (`scene-de-pression.ts`, tranche 6).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_CARDS, isBasic, isPlanque } from '@/data';
import type { BattleAction, BattleState, CafeType, PlayerId } from '@/data/types';
import { applyAction, createBattle } from '@/game/engine';
import { deckDeLaDirection, reglageDirection } from '@/game/deck-direction';
import { DECK_SIZE, deckLegal } from '@/game/deck';
import { etatFinScriptee } from '@/game/scenario-fin';
import { jouer as jouerSon } from '@/audio/sons';
import { partieSauvegardee, reprendrePartie } from '@/store/partie';
import type { Decks, Reprise } from '@/store/partie';
import { combatTermine, tracerCombat } from '@/store/combats';
import { derniereDe } from '@/store/derniere';
import { aiTurnAction, createMatch, joinMatch } from '@/store/pvp';
import type { Match } from '@/store/pvp';
import { useStore } from '@/store/useStore';

/**
 * Deck de test, quand le deck du joueur n'est pas encore valide : 8 cartes
 * Action (2 Objets et 2 Collègues distincts, en double) puis des Planqués, en
 * commençant par les Entrants.
 *
 * Les cartes Action y sont volontairement : depuis le ticket #58 la main est
 * affichée et ses cartes se jouent, et un deck de démonstration sans aucun
 * Objet ne montrerait jamais cette partie de l'écran.
 */
export function testDeck(): string[] {
  const planques = ALL_CARDS.filter(isPlanque).filter((card) => !card.variantOf);
  const ordered = [...planques.filter(isBasic), ...planques.filter((card) => !isBasic(card))];
  const actionCards = ALL_CARDS.filter((card) => !isPlanque(card)).filter((card) => !card.variantOf);
  const showcase = [
    ...actionCards.filter((card) => card.kind === 'OBJET').slice(0, 2),
    ...actionCards.filter((card) => card.kind === 'COLLEAGUE').slice(0, 2)
  ];
  const deck: string[] = [];
  for (const card of showcase) deck.push(card.id, card.id);
  for (const card of ordered) {
    if (deck.length >= DECK_SIZE) break;
    deck.push(card.id);
    if (deck.length < DECK_SIZE) deck.push(card.id);
  }
  return deck.slice(0, DECK_SIZE);
}

/** Ce que l'écran dit au hook, et qu'il est seul à savoir. */
export interface OptionsCombat {
  /** Le combat guidé (`?tutoriel=1`) : une table neuve, et rien n'est enregistré. */
  tutoriel: boolean;
  /** La fin scriptée (`?scene=fin`) : une position déjà gagnable, rien n'est enregistré. */
  sceneFin: boolean;
  /** « Mouvement réduit » : l'attente de la Direction tombe à zéro, comme les animations. */
  sansMouvement: boolean;
  /** Un coup vient de partir : la carte que l'écran tenait ne tient plus. */
  onCoup?: () => void;
}

/** Reprendre un code : la table est remplacée, ou le refus dit **pourquoi** (phrase du codec). */
export type RepriseParCode = { ok: true; camp: PlayerId } | { ok: false; raison: string };

/** Ce que l'écran lit de la mécanique de tour. Rien de plus : le reste est à lui. */
export interface Combat {
  state: BattleState;
  match: Match | null;
  /** Le seul chemin vers `applyAction` : c'est lui qui journalise (`actionLog`). */
  jouer: (action: BattleAction) => void;
  /** « Nouveau combat » : une table neuve, avec le cran réglé à cet instant (#251, D-145). */
  recommencer: () => void;
  /** « Créer une partie à deux » : mon Deck d'un côté, le Deck de démonstration de l'autre. */
  creerPartieADeux: () => void;
  /** Coller un code : la partie reprend, et je prends le camp qui doit jouer. */
  reprendre: (code: string) => RepriseParCode;
  /** La partie a été reprise au montage : l'écran le dit jusqu'au premier coup (#427). */
  partieReprise: boolean;
  /** Le Deck joueur n'est pas légal : ce combat joue un deck de test, et l'écran le dit. */
  usedTestDeck: boolean;
  /** Pourquoi on a replié sur le deck de test (#251) : `deckLegal` les connaît. */
  raisonsDeckDeTest: readonly string[];
  /**
   * La Direction a une action en main. Sa **présence** est l'attente que l'écran montre
   * (« La Direction réfléchit… », #131) — sans elle, 600 ms de silence ressemblent à un
   * écran figé. L'action elle-même ne sort pas : l'écran ne la joue pas, c'est le hook.
   */
  directionReflechit: boolean;
}

/**
 * La mécanique de tour d'un combat, sans un nœud de DOM : la table, ses coups, la Direction,
 * et ce que le store en garde. `src/pages/Battle.tsx` n'en fait plus que le rendu.
 */
export function useCombat({ tutoriel, sceneFin, sansMouvement, onCoup }: OptionsCombat): Combat {
  /**
   * **La difficulté du combat** (#251, D-145) : elle est **figée au montage**, et relue
   * seulement par « Nouveau combat ». Changer le cran dans Réglages ne déplace donc pas
   * la politique au milieu d'une partie — un combat garde la Direction qu'il a commencée.
   */
  const difficulteReglee = useStore((state) => state.difficulte);
  const [difficulte, setDifficulte] = useState(difficulteReglee);
  const reglage = useMemo(() => reglageDirection(difficulte), [difficulte]);
  /** Le Deck que la Direction joue : un Deck proposé, légal, choisi par la difficulté. */
  const directionDeck = useMemo(() => [...reglage.deck.cartes], [reglage]);
  /** Les types de café choisis au Deck (#91), lus bruts dans le store. */
  const storedCafeTypes = useStore((state) => state.cafeTypes);
  const storeDeck = useStore((state) => state.deck);

  // Le deck du joueur est utilisé s'il est légal, sinon on retombe sur un
  // deck de test. Calculé une seule fois par rendu : `deckLegal` est appelé
  // au plus une fois, et l'identité de la référence dit si on a replié.
  /**
   * Le Deck joué, et **pourquoi** on a replié sur le deck de test (#251, revue du 29/10/2026) :
   * le bandeau disait « ton deck n'est pas valide » sans jamais dire quelle règle était violée,
   * alors que `deckLegal` la connaît. Un refus qui n'explique pas ne s'apprend pas.
   */
  const legaliteDuDeck = useMemo(() => deckLegal(storeDeck), [storeDeck]);
  const playerDeck = useMemo(() => (legaliteDuDeck.ok ? storeDeck : testDeck()), [legaliteDuDeck, storeDeck]);
  const raisonsDeckDeTest: readonly string[] = legaliteDuDeck.ok ? [] : legaliteDuDeck.reasons;
  const usedTestDeck = playerDeck !== storeDeck;

  /**
   * Le choix **appliqué à ce combat** (#117). Il appartient au Deck du joueur
   * (`useStore`, `cafeTypes`) : le poser sur un **deck de test** ferait afficher
   * les types d'un contenu à la place d'un autre. Replié sur le deck de test, le
   * combat repart donc en **proposition automatique** (`[]`), dérivée de ce deck —
   * ce que dit aussi le bandeau « ce combat utilise un deck de test ».
   */
  const chosenCafeTypes = useMemo<CafeType[]>(
    () => (usedTestDeck ? [] : storedCafeTypes),
    [usedTestDeck, storedCafeTypes]
  );

  /**
   * **La partie reprise** (#126) : la partie rangée dans le store, rejouée depuis sa graine
   * et son journal. À défaut (rien de rangé, partie terminée, journal qui ne rejoue pas),
   * un combat neuf contre la Direction, comme avant.
   */
  const [depart] = useState<Reprise & { reprise: boolean }>(() => {
    // La fin scriptée impose sa position : rien n'est repris, rien n'est écrasé.
    if (sceneFin) {
      return {
        state: etatFinScriptee(playerDeck, directionDeck, chosenCafeTypes),
        match: null,
        decksSolo: { playerDeck, aiDeck: directionDeck },
        reprise: false
      };
    }
    // Le combat guidé part d'une table neuve : une partie rangée n'est pas reprise, et
    // elle n'est pas écrasée non plus (voir l'enregistrement, plus bas).
    const reprise = tutoriel ? null : reprendrePartie(useStore.getState().partie);
    if (reprise) return { ...reprise, reprise: true };
    return {
      state: createBattle(playerDeck, directionDeck, undefined, { playerCafeTypes: chosenCafeTypes }),
      match: null,
      decksSolo: { playerDeck, aiDeck: directionDeck },
      reprise: false
    };
  });
  const [state, setState] = useState<BattleState>(depart.state);
  /**
   * **Ce que le testeur sait de sa partie quittée** (#427) : une partie rangée est reprise
   * seule au retour, et l'écran le **dit** jusqu'au premier coup. Sans ce mot, la sortie
   * de la veille ressemblait à un abandon.
   */
  const [partieReprise, setPartieReprise] = useState(depart.reprise);
  /** Les Decks du combat solo : une partie à deux porte les siens dans son `Match`. */
  const [decksSolo, setDecksSolo] = useState<Decks>(depart.decksSolo);
  /**
   * **La partie à deux** (#125) : `null` en solo. Le **code** reste le moyen de la passer
   * d'un onglet à l'autre ; la reprise après rechargement passe par le store (#126).
   */
  const [match, setMatch] = useState<Match | null>(depart.match);

  // Le rappel de l'écran vit dans une référence : un `onCoup` recréé à chaque rendu ne doit
  // pas changer l'identité de `jouer`, dont dépend l'effet de la Direction.
  const coupAnnonce = useRef(onCoup);
  coupAnnonce.current = onCoup;

  const jouer = useCallback((action: BattleAction) => {
    coupAnnonce.current?.();
    setPartieReprise(false);
    setState((current) => applyAction(current, action));
  }, []);

  /**
   * **IA de niveau 1, en solo seulement** : quand c'est à la Direction de jouer — ou de
   * choisir sa relève après un craquage —, ses actions s'enchaînent seules, une par un
   * court délai pour rester lisibles. `prefers-reduced-motion` supprime le délai, comme
   * pour les animations de l'écran.
   *
   * La décision appartient à `aiTurnAction` (`@/store/pvp`) : en **partie à deux**, elle
   * rend `null` **sans appeler** la politique — le camp `ai` est tenu par quelqu'un, et
   * l'écran ne doit pas jouer son tour à sa place (critère du #125).
   */
  const aiAction = useMemo(() => aiTurnAction(state, match, reglage.politique), [state, match, reglage.politique]);

  useEffect(() => {
    if (!aiAction) return;
    const timer = window.setTimeout(() => jouer(aiAction), sansMouvement ? 0 : 600);
    return () => window.clearTimeout(timer);
  }, [aiAction, sansMouvement, jouer]);

  /**
   * **Ranger la partie** (#126) : à chaque état, le store garde de quoi la rejouer. Une
   * partie terminée n'y reste pas (`partieSauvegardee` rend `null`). Le store ne fait
   * qu'écrire ; le hook reste seul maître de l'état.
   */
  const enregistrerPartie = useStore((store) => store.enregistrerPartie);
  const enregistrerDerniere = useStore((store) => store.enregistrerDerniere);
  useEffect(() => {
    // Un combat guidé ne s'enregistre pas : le testeur qui le rejoue ne doit pas perdre la
    // partie qu'il avait en cours (#272).
    if (tutoriel || sceneFin) return;
    enregistrerPartie(partieSauvegardee(state, match, decksSolo));
    // La dernière partie terminée (#366) : une partie finie se revoit depuis Réglages.
    const derniere = derniereDe(state, match, decksSolo);
    if (derniere !== null) enregistrerDerniere(derniere);
  }, [state, match, decksSolo, enregistrerPartie, enregistrerDerniere, tutoriel]);

  /**
   * **La trace du combat** (#173, D-086 ; #228, D-105) : une partie **terminée** part en
   * arrière-plan, une seule fois — solo comme à deux, le mode de la ligne le dit. Sans
   * configuration, rien ne part ; un échec réseau ne touche pas l'écran — la partie n'a
   * jamais été perdue, elle vit dans le store (`partieSauvegardee` ci-dessus).
   *
   * La clé évite un second envoi : la fin d'une partie peut re-rendre l'écran (choix, relève),
   * et la même trace ne se dépose qu'une fois.
   */
  const tracesEnvoyees = useRef<Set<string>>(new Set());
  useEffect(() => {
    const combat = combatTermine(state, match, decksSolo);
    if (combat === null) return;
    const cle = `${combat.graine}:${combat.journal.length}`;
    if (tracesEnvoyees.current.has(cle)) return;
    tracesEnvoyees.current.add(cle);
    // `tracerCombat` avale le rejet : une trace perdue ne change rien à la fin de partie
    // affichée, et un rejet non traité ne doit jamais remonter d'un simple effet.
    void tracerCombat(combat);
  }, [state, match, decksSolo]);

  /**
   * **Le verdict** (#378, D-137) : le second et dernier son du jeu. Il part **une fois**, quand la
   * partie se termine — victoire ou défaite, c'est le même mécanisme.
   */
  const verdictJoue = useRef(false);
  useEffect(() => {
    if (state.phase !== 'ended' || verdictJoue.current) return;
    verdictJoue.current = true;
    jouerSon('verdict');
  }, [state.phase]);

  /**
   * « Nouveau combat » : « Nouveau combat » est le moment où le cran réglé dans Réglages prend
   * effet (#251, D-145) — le combat en cours, lui, a gardé celui de son montage. Les panneaux
   * de l'écran (la carte choisie, le menu) ne sont pas au hook : c'est à l'écran de les
   * refermer en appelant celui-ci.
   */
  const recommencer = useCallback(() => {
    const nouvelle = useStore.getState().difficulte;
    const aiDeck = [...deckDeLaDirection(nouvelle).cartes];
    setDifficulte(nouvelle);
    setMatch(null);
    setDecksSolo({ playerDeck, aiDeck });
    setState(createBattle(playerDeck, aiDeck, undefined, { playerCafeTypes: chosenCafeTypes }));
  }, [playerDeck, chosenCafeTypes]);

  /**
   * **Créer une partie à deux** : elle a sa **graine** (l'horloge, comme le `createBattle`
   * par défaut d'un combat solo), **mon Deck** au siège `player`, et le Deck de
   * démonstration pour le camp adverse — l'échange des deux Decks est le ticket
   * suivant, le code porte déjà les deux. Le lancer de tampon décide qui ouvre (D-033) :
   * si la Direction ouvre, le code est prêt tout de suite, et c'est à l'autre joueur de
   * commencer.
   */
  const creerPartieADeux = useCallback(() => {
    const created = createMatch(playerDeck, testDeck(), Date.now(), { playerCafeTypes: chosenCafeTypes });
    setMatch(created.match);
    setState(created.state);
  }, [playerDeck, chosenCafeTypes]);

  /**
   * **Reprendre par un code** : la table est remplacée, et je prends le camp qui doit jouer.
   * Un refus du codec remonte **tel quel** — sa `raison` est déjà une phrase française, que
   * l'écran affiche sans la réécrire.
   */
  const reprendre = useCallback((code: string): RepriseParCode => {
    const joined = joinMatch(code);
    if (!joined.ok) return { ok: false, raison: joined.raison };
    setMatch(joined.match);
    setState(joined.state);
    return { ok: true, camp: joined.match.camp };
  }, []);

  return {
    state,
    match,
    jouer,
    recommencer,
    creerPartieADeux,
    reprendre,
    partieReprise,
    usedTestDeck,
    raisonsDeckDeTest,
    directionReflechit: aiAction !== null
  };
}
