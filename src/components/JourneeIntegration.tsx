import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppelParticiper } from '@/components/AppelParticiper';
import {
  ETAPES_JOURNEE,
  cheminDeCible,
  etapePourChemin,
  libelleSaut,
  passeAuGeste,
  tapeAvance,
  type PositionDeGeste
} from '@/components/journee-etapes';
import { CIBLE_DE_GESTE, poserCibleJournee } from '@/components/journee-cible';
import { useGesteFait } from '@/components/journee-gestes';
import {
  allerAEtape,
  etapeJournee,
  prendreRelecture,
  relectureDemandee,
  remettreJourneeAuDebut,
  useEtapeJournee
} from '@/components/journee-etape';
import { useMouvementReduit } from '@/components/use-mouvement-reduit';
import { useStore } from '@/store/useStore';
import { artUrl } from '@/art';

/** La voix de la Direction : son Chef de cabinet, qui transmet ses consignes. */
const PORTRAIT_CHEF_CABINET = artUrl('direction-chef-cabinet.webp');

/**
 * La scène plein écran d'un Arrivage (`SceneOuverture`). Le geste « Arrivage » ne fait avancer la
 * Journée qu'une fois cette scène rangée (D-196 (1)) : sinon l'écran suivant la couperait.
 */
const SCENE_ARRIVAGE = '.ouverture';

export function JourneeIntegration() {
  const tutorielVu = useStore((state) => state.tutorielVu);
  const setTutorielVu = useStore((state) => state.setTutorielVu);
  /** Les gestes que la Journée attend (30/10/2026) : un Arrivage ouvert, un Deck chargé. */
  const packsOpened = useStore((state) => state.packsOpened);
  const deck = useStore((state) => state.deck);
  /**
   * **L'étape vit hors du panneau** (31/10/2026) : le combat la fait avancer en revenant de
   * la scène de fin, sinon « Continuer » ramenait sur Réglages à l'étape 3, avec un bouton
   * mort. Voir `journee-etape`.
   */
  const etape = useEtapeJournee();
  /**
   * **La pause** (31/10/2026). `Échap` ne termine plus la visite, il la met de côté :
   * `terminer()` écrit `tutorielVu`, donc un abandon **définitif** au premier réflexe de
   * fermeture — le contraire de « contraindre sans enfermer ». La barre de pause dit où
   * l'on en est et offre les deux issues.
   */
  const [enPause, setEnPause] = useState(false);
  /**
   * La réplique affichée en entier : par un tap (D-187 (4)), ou par la fin de l'écriture
   * (`onAnimationEnd`). Sous mouvement réduit, elle est entière dès le départ.
   */
  const [repliqueLue, setRepliqueLue] = useState('');
  const reduit = useMouvementReduit();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  /** Le panneau, pour mesurer sa hauteur et garder l'élément désigné **sous** lui. */
  const panneauRef = useRef<HTMLElement | null>(null);

  const terminer = () => {
    setTutorielVu(true);
    remettreJourneeAuDebut();
    setEnPause(false);
  };

  /**
   * **Sur le plateau, la Journée s'efface** (31/10/2026). D-160 (1) promet « zéro
   * recouvrement » ; mesuré le 30/10, le panneau (`y 10 → 258`) couvrait **tout** le
   * pas-à-pas du combat (`y 50 → 99`) et sa garde le **gelait** : le guidage était
   * invisible et impossible, alors que le panneau annonçait justement « le combat guidé
   * t'apprend… ». Le combat a son propre tutoriel : ici, il parle seul. L'étape se valide
   * à sa fin (`geste: 'combat'`, marqué par la scène de fin).
   */
  const surLeCombat = pathname === '/battle';
  /** Le panneau ou sa barre de pause ; `ouvert` est le panneau complet, avec sa garde. */
  const visible = !tutorielVu && !surLeCombat;
  const ouvert = visible && !enPause;

  /**
   * **La garde** : hors du panneau et hors des éléments désignés, le clic n'arrive pas.
   * L'écouteur est posé en **capture** sur `document`, donc avant les gestionnaires de
   * React comme ceux du navigateur (un lien, un bouton natif). On ne fige pas la page :
   * elle défile, elle se lit, et un élément désigné reste cliquable.
   */
  useEffect(() => {
    if (!ouvert) return;
    // **Ce qui prend la main passe au-dessus de la visite.** L'ouverture d'un Arrivage est
    // une scène plein écran (`.ouverture`, dans un dialogue Radix) : sans ces deux
    // exceptions, le testeur qui vient d'ouvrir son sachet ne peut plus le fermer — la
    // visite bloque les boutons de la scène (constaté le 30/10/2026). Le pas-à-pas du
    // combat, la main et le plateau sont joints depuis que le panneau s'efface sur
    // `/battle` : c'est le même principe, appliqué aux écrans que la visite traverse.
    const autorise = (cible: EventTarget | null) =>
      cible instanceof Element &&
      cible.closest(
        '[data-journee-panneau], .journee__parole, [data-journee-cible], [data-pas-a-pas], .hand, .board, [role="dialog"], .ouverture'
      ) !== null;
    const bloquer = (evenement: Event) => {
      if (autorise(evenement.target)) return;
      evenement.preventDefault();
      evenement.stopPropagation();
    };
    /**
     * **Le blocage parle** (30/10/2026) : `Échap` **met en pause** depuis le 31/10 — il ne
     * termine plus. **Le panneau ne prend pas le focus** (D-161, #687) : l'étape s'annonce
     * par `aria-live` (D-162 (1)), le focus reste sur le contrôle qui a déclenché la
     * Journée, et `Tab` en sort librement — ni piège à focus, ni `aria-modal`.
     */
    const mettreEnPause = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') {
        evenement.preventDefault();
        setEnPause(true);
      }
    };
    document.addEventListener('pointerdown', bloquer, true);
    document.addEventListener('click', bloquer, true);
    document.addEventListener('keydown', mettreEnPause);
    return () => {
      document.removeEventListener('pointerdown', bloquer, true);
      document.removeEventListener('click', bloquer, true);
      document.removeEventListener('keydown', mettreEnPause);
    };
  }, [ouvert]);

  /**
   * La sauvegarde et le combat sont des faits de session : ils se lisent dans
   * `journee-gestes`, pas dans le store. **Ces hooks se lisent avant tout retour
   * anticipé** : un `useSyncExternalStore` placé après `return null` change le nombre de
   * hooks quand la Journée se ferme (« Rendered fewer hooks than expected »).
   */
  const sauvegardeFaite = useGesteFait('sauvegarde');
  const combatFait = useGesteFait('combat');

  /**
   * **On reprend à la première étape non faite** (31/10/2026). Au rechargement, l'étape
   * vivait en mémoire et l'on repartait à « 1/5 » avec le combat à rejouer. Les gestes du
   * store (Arrivage, Deck) disent ce qui est déjà fait ; ceux de session disent le reste.
   * Une seule fois par montage : ensuite, c'est le geste validé qui fait avancer (D-196).
   */
  const repriseFaite = useRef(false);
  useEffect(() => {
    if (tutorielVu) return;
    // **Une relecture voulue ne reprend pas** (#731, 04/11/2026) : elle repart de l'étape
    // 1, même si les gestes sont faits et si la route courante est celle d'une autre étape.
    // Le témoin se **lit** ici (l'effet de route le consomme) et se consomme même après
    // une première visite dans la session : le panneau reste monté quand il se cache, donc
    // `repriseFaite` ne doit pas avaler un « Revoir » cliqué plus tard.
    if (relectureDemandee()) {
      repriseFaite.current = true;
      return;
    }
    if (repriseFaite.current) return;
    repriseFaite.current = true;
    const faits = [packsOpened > 0, deck.length > 0, combatFait, sauvegardeFaite];
    const premiere = faits.findIndex((fait) => !fait);
    // `faits` ne couvre que les quatre gestes : `-1` veut dire « tout est fait », et l'on
    // reste à l'étape 1. Seul un index strictement positif déplace la reprise.
    if (premiere > 0) allerAEtape(premiere);
  }, [tutorielVu, packsOpened, deck.length, combatFait, sauvegardeFaite]);
  const courante = ETAPES_JOURNEE[Math.min(etape, ETAPES_JOURNEE.length - 1)];
  const cibleDeLEtape = courante.geste ? (CIBLE_DE_GESTE[courante.geste] ?? null) : null;

  /**
   * **Le geste réel** (D-196) : l'étape suivante s'ouvre dès qu'il est validé. Sans geste
   * (l'étape du comité), il n'y a rien à valider : le tap de l'encadré fait le même chemin.
   */
  const gesteFait =
    courante.geste === undefined ||
    (courante.geste === 'arrivage'
      ? packsOpened > 0
      : courante.geste === 'deck'
        ? deck.length > 0
        : courante.geste === 'sauvegarde'
          ? sauvegardeFaite
          : combatFait);

  /**
   * **Le geste fait avancer** (779, D-196 (1)). Une **transition** seulement (`passeAuGeste`) :
   * un geste déjà fait à l'arrivée n'enchaîne rien (« Revoir », #731). Aucune minuterie
   * (D-196 (2), WCAG « minutage réglable ») : seul le geste fait avancer. Le geste du combat se valide sur
   * `/battle`, où le panneau est effacé : l'effet n'est donc **pas** gardé par `visible`.
   * L'écran suit par l'effet de route plus bas, et `Battle` ouvre l'écran à la fermeture de
   * la scène de fin, pour ne pas couper le verdict.
   */
  const dernierGeste = useRef<PositionDeGeste | null>(null);
  const gesteCourantFait = courante.geste !== undefined && gesteFait;
  useEffect(() => {
    const precedent = dernierGeste.current;
    dernierGeste.current = { etape, fait: gesteCourantFait };
    if (tutorielVu || !passeAuGeste(precedent, etape, gesteCourantFait)) return undefined;
    if (etape >= ETAPES_JOURNEE.length - 1) return undefined;
    const suivante = () => allerAEtape(etape + 1);
    if (!document.querySelector(SCENE_ARRIVAGE)) {
      suivante();
      return undefined;
    }
    // L'Arrivage se range dans sa scène : on attend qu'elle se ferme, puis on avance.
    const observateur = new MutationObserver(() => {
      if (document.querySelector(SCENE_ARRIVAGE)) return;
      observateur.disconnect();
      suivante();
    });
    observateur.observe(document.body, { childList: true, subtree: true });
    return () => observateur.disconnect();
  }, [etape, gesteCourantFait, tutorielVu]);

  /**
   * **L'étape et la route ne divergent pas** (#677, D-181 (5), D-162 (4)).
   *
   * Le compteur d'étape **commande** l'écran : le geste validé avance le compteur, et le
   * compteur ouvre la cible de l'étape. Avant ce correctif, le compteur avançait seul et le
   * panneau décrivait un écran qui n'était pas affiché. La route n'est pourtant **pas**
   * l'identifiant de l'étape : deux étapes peuvent partager un écran, et c'est alors
   * l'étape courante qui tient.
   *
   * Deux temps :
   * - **à l'ouverture**, une URL qui est l'écran d'une étape la désigne (on ne déplace pas
   *   un testeur qui a demandé `/settings`) ; sur un écran hors parcours (le mur, l'attente),
   *   on ne déplace rien : l'étape attend son tour ;
   * - **ensuite**, un changement d'étape ouvre son écran, et un changement de route sans
   *   changement d'étape (le retour du navigateur) réaligne l'étape sur l'écran rouvert.
   */
  const dernierePosition = useRef<{ etape: number; chemin: string } | null>(null);
  useEffect(() => {
    if (!visible) {
      dernierePosition.current = null;
      return;
    }
    // L'étape **réelle** : la reprise peut l'avoir changée dans le même commit.
    const etapeReelle = etapeJournee();
    const precedente = dernierePosition.current;
    dernierePosition.current = { etape: etapeReelle, chemin: pathname };
    // **La relecture voulue se consomme à l'ouverture du panneau** (#731) : une URL
    // directe reste, elle, maîtresse de l'étape à montrer.
    const relecture = prendreRelecture();

    if (!precedente) {
      // **Une relecture voulue ignore la route courante** : elle repart de l'étape 1 et
      // ouvre son écran — c'est ce qui distingue « Revoir » d'un simple rechargement.
      if (relecture) {
        if (cheminDeCible(courante.cible) !== pathname) navigate(courante.cible);
        return;
      }
      const parLaRoute = cheminDeCible(courante.cible) === pathname ? etape : etapePourChemin(pathname);
      if (parLaRoute !== -1 && parLaRoute !== etapeReelle) allerAEtape(parLaRoute);
      return;
    }

    const etapeBouge = etapeReelle !== precedente.etape;
    const cheminBouge = pathname !== precedente.chemin;
    if (!etapeBouge && !cheminBouge) return;

    if (cheminBouge && !etapeBouge) {
      // **Un retour du navigateur** : l'écran rouvert réaligne l'étape, sauf si c'est déjà
      // le sien — c'est ce qui permet à deux étapes de partager une route. Un écran hors
      // parcours ne déplace personne : le mur, l'attente ou l'administration ne sont pas
      // une étape, et la visite n'a pas à les quitter.
      const alignee = cheminDeCible(courante.cible) === pathname ? etapeReelle : etapePourChemin(pathname);
      if (alignee !== -1 && alignee !== etapeReelle) allerAEtape(alignee);
      return;
    }
    // **L'étape commande** : un changement d'étape ouvre son écran.
    if (etapeBouge && cheminDeCible(courante.cible) !== pathname) navigate(courante.cible);
  }, [visible, etape, pathname, courante, navigate]);

  /**
   * **L'élément désigné vient sous les yeux.** Le panneau occupe le haut de l'écran : sans
   * cela, le bouton qu'il désigne peut être caché derrière lui (constaté sur l'accueil, où
   * « Ouvrir un Arrivage » disparaissait sous le panneau).
   *
   * `block: 'start'` et non `'center'` (31/10/2026) : `scroll-margin-top` — la hauteur du
   * panneau — ne s'applique qu'au début de l'alignement. Centré, un volet de 1 299 px
   * posait son en-tête **hors écran** et ses cartes **derrière** le panneau.
   */
  const amenerLaCible = (doucement = false) => {
    const cible = document.querySelector('[data-journee-cible]');
    if (!cible) return;
    cible.scrollIntoView({ block: 'start', behavior: doucement ? 'smooth' : 'auto' });
  };

  /**
   * « Montrer le bouton » doit **faire quelque chose**, même quand la cible est déjà à
   * l'écran : un clic qui ne produit rien se lit comme un bouton cassé (mesuré le 30/10,
   * `scrollY` 0 → 0). La cible pulse une fois, son contour doré s'élargit.
   */
  const montrerLaCible = () => {
    const cible = document.querySelector('[data-journee-cible]');
    amenerLaCible(true);
    if (!cible) return;
    cible.classList.add('est-montre');
    window.setTimeout(() => cible.classList.remove('est-montre'), 1400);
  };

  useEffect(() => {
    if (!ouvert) return;
    const panneau = panneauRef.current;
    if (!panneau) return;
    // **La cible de l'étape, et elle seule** : `combat` n'en a pas (le pas-à-pas désigne).
    poserCibleJournee(cibleDeLEtape);

    /** La pointe du panneau se cale sur le centre horizontal de sa cible. */
    const positionnerPointe = () => {
      if (!cibleDeLEtape) return;
      const pointe = panneau.querySelector<HTMLElement>('.journee__pointe');
      const cible = document.querySelector<HTMLElement>(`[data-journee-cible="${cibleDeLEtape}"]`);
      if (!pointe || !cible) return;

      const panneauRect = panneau.getBoundingClientRect();
      const cibleRect = cible.getBoundingClientRect();
      const centreCible = cibleRect.left + cibleRect.width / 2;
      pointe.style.left = `${centreCible - panneauRect.left}px`;
    };

    /**
     * **La hauteur se mesure en continu** (`ResizeObserver`) : elle était lue une fois, au
     * montage, avant que la police ne change la hauteur d'une ligne — d'où une cible
     * mesurée 14 px sous le panneau (critique du 30/10/2026, P0). Elle alimente
     * `--journee-hauteur`, donc le `scroll-margin-top` du halo.
     */
    const poser = () => {
      document.documentElement.style.setProperty('--journee-hauteur', `${panneau.offsetHeight}px`);
      positionnerPointe();
    };
    poser();
    const observateur = typeof ResizeObserver === 'function' ? new ResizeObserver(poser) : null;
    observateur?.observe(panneau);
    const cible = cibleDeLEtape ? document.querySelector<HTMLElement>(`[data-journee-cible="${cibleDeLEtape}"]`) : null;
    if (cible) observateur?.observe(cible);
    window.addEventListener('resize', positionnerPointe);

    amenerLaCible();
    // Les polices arrivent après le premier rendu : on replace la cible une fois posées.
    void document.fonts?.ready.then(() => {
      amenerLaCible();
      positionnerPointe();
    });

    /**
     * **La cible peut arriver après l'effet** (#679) : les écrans sont paresseux (#478).
     * Sur `/deck`, la Journée se monte avant le morceau du Deck ; `amenerLaCible` ne
     * trouvait alors rien, et le volet des Decks proposés restait hors de la fenêtre
     * (diagnostic du 03/11/2026, `y = 1330`). On l'amène dès qu'il paraît, puis on cesse
     * d'écouter : une cible déjà présente n'a pas besoin de l'observateur.
     */
    let veille: MutationObserver | null = null;
    const selecteurCible = cibleDeLEtape ? `[data-journee-cible="${cibleDeLEtape}"]` : null;
    if (selecteurCible && !document.querySelector(selecteurCible) && typeof MutationObserver === 'function') {
      veille = new MutationObserver(() => {
        if (!document.querySelector(selecteurCible)) return;
        amenerLaCible();
        veille?.disconnect();
      });
      veille.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      veille?.disconnect();
      observateur?.disconnect();
      window.removeEventListener('resize', positionnerPointe);
      poserCibleJournee(null);
    };
  }, [ouvert, etape, pathname, cibleDeLEtape]);

  if (tutorielVu) return null;

  /**
   * **La tête reste d'une étape à l'autre** (D-187 (6)(c)) : un seul nœud, à la même place dans
   * l'arbre, que le panneau soit ouvert, en pause ou effacé sur `/battle`. Seul l'encadré, lui,
   * suit le panneau. Sa copie animée est `aria-hidden` ; la région `aria-live` lit la réplique
   * entière d'un coup (D-187 (4)).
   */
  const scene = (avecParole: boolean) => (
    <div className="journee__scene">
      <img className="journee__portrait" src={PORTRAIT_CHEF_CABINET} alt="" aria-hidden="true" width={56} height={56} />
      {avecParole && (
        // **Un vrai bouton** (779, D-196) : Entrée et Espace le déclenchent, et son nom dit le
        // tap. Le texte visible est `aria-hidden` : la région `aria-live` le lit une fois.
        <button
          type="button"
          className="journee__parole"
          data-complet={repliqueComplete || undefined}
          aria-label={`Chef de cabinet : ${courante.direction}${indicationTap}`}
          onClick={toucherLaReplique}
        >
          <span className="journee__direction" aria-hidden="true">
            <strong>Chef de cabinet</strong>{' '}
            <span
              key={courante.direction}
              className="journee__texte-anime"
              onAnimationEnd={() => setRepliqueLue(courante.direction)}
            >
              {courante.direction}
            </span>
          </span>
        </button>
      )}
      <span className="sr-only" data-journee-voix aria-live="polite" aria-atomic="true">
        {avecParole && `Chef de cabinet : ${courante.direction}`}
      </span>
    </div>
  );
  if (!visible)
    return (
      <>
        {null}
        {scene(false)}
      </>
    );

  const derniere = etape >= ETAPES_JOURNEE.length - 1;

  /**
   * **Le tap sur l'encadré** (779, D-196 (1), D-187 (4)). Premier tap : la réplique s'écrit
   * d'un coup. Second tap, à une étape **sans geste** : l'étape suivante s'ouvre. Une étape
   * avec geste n'avance jamais au tap — son geste la fait avancer. Sous mouvement réduit, la
   * réplique est entière dès le départ : un seul tap avance.
   */
  const repliqueComplete = repliqueLue === courante.direction || reduit;
  const toucherLaReplique = () => {
    if (!repliqueComplete) {
      setRepliqueLue(courante.direction);
      return;
    }
    if (tapeAvance(courante, etape, ETAPES_JOURNEE.length - 1)) allerAEtape(etape + 1);
  };
  /** Ce que fait le tap, dit à la lecture d'écran (le nom accessible porte l'action). */
  const indicationTap = !repliqueComplete
    ? ', appuyer pour afficher tout le texte'
    : tapeAvance(courante, etape, ETAPES_JOURNEE.length - 1)
      ? ', appuyer pour passer à l’étape suivante'
      : '';

  /** Sur l'écran de l'étape : `pathname` n'a pas de requête, la cible peut en avoir une. */
  const surLaPage = pathname === cheminDeCible(courante.cible);

  /** La barre de pause : elle ne bloque rien, et elle dit les deux issues. */
  if (enPause) {
    return (
      <>
        <aside
          ref={panneauRef}
          className="journee journee--pause"
          data-journee-panneau
          aria-label="Journée d’intégration en pause"
        >
          <p>
            Journée en pause · {Math.min(etape, ETAPES_JOURNEE.length - 1) + 1}/{ETAPES_JOURNEE.length}
          </p>
          <button type="button" className="button" onClick={() => setEnPause(false)}>
            Reprendre
          </button>
          {/* **La sortie nomme ce qu'elle coûte** (D-136) : la barre disait « Terminer », sans
            dire qu'on perdait le combat. Elle prend le libellé du panneau. */}
          <button type="button" className="journee__passer" onClick={terminer}>
            {libelleSaut(etape)}
          </button>
        </aside>
        {scene(false)}
      </>
    );
  }

  return (
    <>
      <aside
        ref={panneauRef}
        className="journee"
        data-journee-panneau
        /**
         * **Une région, pas un dialogue** (31/10/2026). Le couple « dialogue » + « modal »
         * annonçait une page inerte et un focus piégé : la garde ne bloque que le pointeur,
         * `Tab` sortait du panneau, et la page restait lisible — le marquage mentait. Une
         * région nommée dit ce qu'elle est, et `aria-live` annonce le changement d'étape.
         */
        role="region"
        aria-labelledby="journee-titre"
        aria-describedby="journee-texte"
        tabIndex={-1}
      >
        {/* **Le compteur passe dans le titre** (31/10/2026) : il tenait une ligne à lui seul.
          Il reste lu par les lecteurs d'écran dans la même région vive. */}
        <div className="journee__tete">
          <div aria-live="polite" aria-atomic="true">
            <h2 id="journee-titre" className="journee__titre">
              <span className="journee__compte" aria-hidden="true">{`${etape + 1}/${ETAPES_JOURNEE.length}`}</span>
              <span className="sr-only">
                Journée d’intégration — étape {etape + 1} sur {ETAPES_JOURNEE.length} :
              </span>
              {courante.titre}
            </h2>
          </div>

          {/* **La sortie monte dans l'en-tête** : elle tenait une ligne de 44 px en bas, et
            c'est elle qui interceptait le clic destiné à la cible de l'étape 1. Elle garde sa
            hauteur tactile et son libellé qui nomme ce qu'on perd (D-136). */}
          <button type="button" className="journee__passer" onClick={terminer}>
            {derniere ? 'Relire la Journée plus tard, depuis Réglages' : libelleSaut(etape)}
          </button>
        </div>

        <p id="journee-texte" className="journee__texte">
          {courante.texte}
        </p>

        {cibleDeLEtape && <span className="journee__pointe" aria-hidden="true" />}

        {/* La région reste **montée** : un lecteur d'écran n'entend pas un nœud qui
          apparaît, mais il entend un texte qui change. Elle ne parle que des étapes qui
          **exigent** un geste : aux autres, « C'est fait » serait faux. */}
        {courante.geste !== undefined &&
          (gesteFait ? (
            // **Fait : l'étape suivante s'annonce** (779, D-196). La ligne reste dans le DOM pour
            // les lecteurs d'écran ; à l'écran, la Journée a déjà avancé.
            <p className="sr-only" role="status">
              C’est fait : l’étape suivante s’ouvre.
            </p>
          ) : (
            // **Lue, pas affichée** (04/11/2026, décision de Bastien, option A) : la ligne reste
            // dans le DOM pour les lecteurs d'écran (`role="status"`), et « Montrer le bouton »
            // dit déjà le geste à l'œil. `sr-only` la retire de la mise en page, et le budget de
            // texte ne la compte pas (D-181 (3)).
            <p className="sr-only" role="status">
              {courante.geste === 'combat'
                ? 'Joue le combat guidé : l’étape suivante s’ouvrira à sa fin.'
                : 'Fais le geste sur la page : l’étape suivante s’ouvrira ensuite.'}
            </p>
          ))}

        {/* Le geste de l'étape : on ne renvoie pas à une documentation, on ouvre l'écran.
          Le panneau reste posé par-dessus, pour qu'on lise l'étape en regardant l'écran
          qu'elle décrit — **la dernière comprise** : arriver sur `/comite` ne termine pas la
          Journée, sinon le mur s'ouvrait sans la réplique finale (D-161, #685). La sortie
          reste explicite : le bouton permanent, ou le lien de l'appel à participer. */}
        <div className="actions actions--tight">
          {/* Sur l'écran de l'étape, le bouton qui y mène n'a plus rien à faire : il laisse la
            place au geste lui-même. Et sans geste, il n'y a rien à montrer. Il n'y a pas de
            bouton « Suivant » (D-196) : le geste validé fait avancer, le tap fait le reste. */}
          {!surLaPage ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                navigate(courante.cible);
              }}
            >
              {courante.action}
            </button>
          ) : courante.geste !== undefined && !gesteFait ? (
            /* **Sur l'écran de l'étape**, le panneau garde une action : « Montrer le bouton ».
             Il ne fait pas le geste à la place du testeur, il amène la cible sous ses yeux
             et la fait pulser — sans lui, l'écran n'offrait aucune action (critique du
             30/10/2026). */
            <button type="button" className="button button--primary" onClick={montrerLaCible}>
              Montrer le bouton
            </button>
          ) : null}
        </div>

        {/* L'appel à participer (#271) : une ligne, à la fin seulement, à chaque Journée menée
          jusqu'à sa dernière étape. */}
        {derniere && <AppelParticiper surComite={terminer} />}
      </aside>
      {scene(true)}
    </>
  );
}
