import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppelParticiper } from '@/components/AppelParticiper';
import { ETAPES_JOURNEE, libelleSaut } from '@/components/journee-etapes';
import { CIBLE_DE_GESTE, poserCibleJournee } from '@/components/journee-cible';
import { useGesteFait } from '@/components/journee-gestes';
import { allerAEtape, remettreJourneeAuDebut, useEtapeJournee } from '@/components/journee-etape';
import { useStore } from '@/store/useStore';
import { artUrl } from '@/art';

/** Le visage de la Direction : l'illustration du PDG, la seule qui la représente. */
const PORTRAIT_DIRECTION = artUrl('direction-pdg.webp');

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
        '[data-journee-panneau], [data-journee-cible], [data-pas-a-pas], .hand, .board, [role="dialog"], .ouverture'
      ) !== null;
    const bloquer = (evenement: Event) => {
      if (autorise(evenement.target)) return;
      evenement.preventDefault();
      evenement.stopPropagation();
    };
    /**
     * **Le blocage parle** (30/10/2026) : `Échap` **met en pause** depuis le 31/10 — il ne
     * termine plus. Le panneau prend le focus à l'ouverture, pour que le clavier entre dans
     * la visite plutôt que de traverser les contrôles que le pointeur ne peut pas activer.
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
    panneauRef.current?.focus();
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
   * Une seule fois par montage : ensuite, c'est « Suivant » qui commande.
   */
  const repriseFaite = useRef(false);
  useEffect(() => {
    if (repriseFaite.current || tutorielVu) return;
    repriseFaite.current = true;
    const faits = [packsOpened > 0, deck.length > 0, combatFait, sauvegardeFaite];
    const premiere = faits.findIndex((fait) => !fait);
    if (premiere > 0) allerAEtape(premiere === -1 ? ETAPES_JOURNEE.length - 1 : premiere);
  }, [tutorielVu, packsOpened, deck.length, combatFait, sauvegardeFaite]);
  const courante = ETAPES_JOURNEE[Math.min(etape, ETAPES_JOURNEE.length - 1)];

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
    poserCibleJournee(courante.geste ? (CIBLE_DE_GESTE[courante.geste] ?? null) : null);

    /**
     * **La hauteur se mesure en continu** (`ResizeObserver`) : elle était lue une fois, au
     * montage, avant que la police ne change la hauteur d'une ligne — d'où une cible
     * mesurée 14 px sous le panneau (critique du 30/10/2026, P0). Elle alimente
     * `--journee-hauteur`, donc le `scroll-margin-top` du halo.
     */
    const poser = () => document.documentElement.style.setProperty('--journee-hauteur', `${panneau.offsetHeight}px`);
    poser();
    const observateur = typeof ResizeObserver === 'function' ? new ResizeObserver(poser) : null;
    observateur?.observe(panneau);

    amenerLaCible();
    // Les polices arrivent après le premier rendu : on replace la cible une fois posées.
    void document.fonts?.ready.then(() => amenerLaCible());

    return () => {
      observateur?.disconnect();
      poserCibleJournee(null);
    };
  }, [ouvert, etape, pathname]);

  if (!visible) return null;

  const derniere = etape >= ETAPES_JOURNEE.length - 1;
  /**
   * **Le geste réel** : « Suivant » ne s'ouvre qu'une fois fait. C'est ce qui empêche de
   * traverser la Journée en lecture — et c'est pour ça qu'elle a cessé d'être un dialogue
   * modal : le geste se fait sur la page, pas dans le panneau.
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

  /** Sur l'écran de l'étape : `pathname` n'a pas de requête, la cible peut en avoir une. */
  const surLaPage = pathname === courante.cible.split('?')[0];

  /** La barre de pause : elle ne bloque rien, et elle dit les deux issues. */
  if (enPause) {
    return (
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
    );
  }

  return (
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

      {/* **La Direction sort de sa bulle** (31/10/2026) : son portrait, puis sa phrase.
          Même voix que la réplique de fin de combat — le produit a une seule Direction. La
          bulle est compacte et paraît d'un coup, pour que le panneau reste court. */}
      <div className="journee__bulle">
        {PORTRAIT_DIRECTION ? (
          <img
            className="journee__portrait"
            src={PORTRAIT_DIRECTION}
            alt=""
            aria-hidden="true"
            width={36}
            height={36}
            loading="lazy"
          />
        ) : null}
        <p className="journee__direction">
          <strong>La Direction</strong> · {courante.direction}
        </p>
      </div>

      {/* La région reste **montée** : un lecteur d'écran n'entend pas un nœud qui
          apparaît, mais il entend un texte qui change. Elle ne parle que des étapes qui
          **exigent** un geste : aux autres, « C'est fait » serait faux. */}
      {courante.geste !== undefined &&
        (gesteFait ? (
          // **Fait : la ligne se tait** (31/10/2026). Elle explique un « Suivant » fermé ; une
          // fois ouvert, « Suivant » et le halo le disent. Elle reste annoncée aux lecteurs
          // d'écran, et le panneau gagne la hauteur d'une ligne.
          <p className="sr-only" role="status">
            C’est fait : « Suivant » est ouvert.
          </p>
        ) : (
          <p className="journee__geste" role="status">
            {courante.geste === 'combat'
              ? 'Joue le combat guidé : « Suivant » s’ouvrira à sa fin.'
              : 'Fais le geste sur la page : « Suivant » s’ouvrira ensuite.'}
          </p>
        ))}

      {/* Le geste de l'étape : on ne renvoie pas à une documentation, on ouvre l'écran.
          Le panneau reste posé par-dessus, pour qu'on lise l'étape en regardant l'écran
          qu'elle décrit — sauf la dernière, qui referme la Journée en menant au combat. */}
      <div className="actions actions--tight">
        {/* Sur l'écran de l'étape, le bouton qui y mène n'a plus rien à faire : il laisse la
            place au geste lui-même. Et sans geste, il n'y a rien à montrer.
            **Une fois le geste fait, il disparaît** (31/10/2026) : laisser un bouton
            principal qui ne sert plus, à côté d'un « Suivant » en contour, inversait la
            hiérarchie au moment précis où l'on attend « Suivant ». */}
        {!surLaPage ? (
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              navigate(courante.cible);
              if (derniere) terminer();
            }}
          >
            {courante.action}
          </button>
        ) : courante.geste !== undefined && !gesteFait ? (
          /* **Sur l'écran de l'étape**, le panneau garde une action : « Montrer le bouton ».
             Il ne fait pas le geste à la place du testeur, il amène la cible sous ses yeux
             et la fait pulser — sans lui, l'écran n'offrait qu'un « Suivant » éteint
             (critique du 30/10/2026). */
          <button type="button" className="button button--primary" onClick={montrerLaCible}>
            Montrer le bouton
          </button>
        ) : null}
        {/* **Deux sorties, pas trois** (30/10/2026) : « Plus tard » faisait exactement ce que
            fait le lien du dessous, et promettait un retour qui n'arrive jamais — `terminer`
            écrit le drapeau. À la dernière étape, le geste principal suffit. */}
        {!derniere && (
          <button
            type="button"
            className={gesteFait ? 'button button--primary' : 'button'}
            disabled={!gesteFait}
            onClick={() => {
              allerAEtape(etape + 1);
            }}
          >
            Suivant
          </button>
        )}
      </div>

      {/* L'appel à participer (#271) : une ligne, à la fin seulement, à chaque Journée menée
          jusqu'à sa dernière étape. */}
      {derniere && <AppelParticiper surComite={terminer} />}
    </aside>
  );
}
