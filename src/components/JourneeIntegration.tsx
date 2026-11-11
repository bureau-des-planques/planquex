import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppelParticiper } from '@/components/AppelParticiper';
import {
  ETAPES_JOURNEE,
  cheminDeCible,
  dureeEcriture,
  etapePourChemin,
  libelleSaut,
  ligneAideGeste,
  pasEcriture,
  passeAuGeste,
  tapeAvance,
  tapeTermine,
  type PositionDeGeste
} from '@/components/journee-etapes';
import { CIBLE_DE_GESTE, poserCibleJournee } from '@/components/journee-cible';
import { useGesteFait } from '@/components/journee-gestes';
import { Inertie } from '@/components/journee-inerte';
import {
  allerAEtape,
  etapeJournee,
  poserJourneeOuverte,
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

/**
 * **L'éclairage de la cible** (D-195 (3), D-194 (1)) : le voile est **un seul élément**, posé sur
 * la cible, dont l'ombre étalée (`box-shadow`, `src/styles.css`) assombrit tout le reste de la
 * page. La cible reste à sa clarté, sans qu'il faille la remonter d'un plan — un `z-index` sur
 * la cible se perdrait dans le premier ancêtre qui forme un contexte d'empilement. La marge
 * laisse respirer le halo doré (`outline-offset: 3px`, plus le contour).
 */
const MARGE_ECLAIRAGE_PX = 8;

/**
 * Ce que la Journée garde vivant quand le fond est inerte : son panneau, la scène du Chef de
 * cabinet et son voile. La cible désignée s'y ajoute, étape par étape.
 */
const SELECTEUR_JOURNEE = '[data-journee-panneau], .journee__scene, .journee__voile';

export function JourneeIntegration() {
  const tutorielVu = useStore((state) => state.tutorielVu);
  const setTutorielVu = useStore((state) => state.setTutorielVu);
  /** Le geste du store (30/10/2026) : un Arrivage ouvert. Les deux autres sont des faits de session. */
  const packsOpened = useStore((state) => state.packsOpened);
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
   * **La barre de navigation s'efface** (D-194 (2), D-195 (1), #778) : le `Layout` lit ce fait et
   * ne rend pas la barre tant que la Journée est ouverte. La pause, « Passer » et la fin la
   * rendent (D-162 (2)) ; le démontage aussi.
   */
  useEffect(() => {
    poserJourneeOuverte(ouvert);
    return () => poserJourneeOuverte(false);
  }, [ouvert]);

  /**
   * **La garde** : hors du panneau et hors des éléments désignés, le clic n'arrive pas.
   * L'écouteur est posé en **capture** sur `document`, donc avant les gestionnaires de
   * React comme ceux du navigateur (un lien, un bouton natif). On ne fige pas la page :
   * elle défile, elle se lit, et un élément désigné reste cliquable. Depuis #778, c'est la
   * **seconde ligne** : le fond porte `inert` (effet plus bas), l'écouteur rattrape ce qui
   * apparaît entre deux passes.
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
   * L'onglet Deck ouvert (D-205 (2)) et le combat sont des faits de session : ils se lisent dans
   * `journee-gestes`, pas dans le store. **Ces hooks se lisent avant tout retour
   * anticipé** : un `useSyncExternalStore` placé après `return null` change le nombre de
   * hooks quand la Journée se ferme (« Rendered fewer hooks than expected »).
   */
  const deckVu = useGesteFait('deck');
  const combatFait = useGesteFait('combat');

  /**
   * **On reprend à la première étape non faite** (31/10/2026). Au rechargement, l'étape
   * vivait en mémoire et l'on repartait à « 1/4 » avec le combat à rejouer. Le geste du
   * store (l'Arrivage) dit ce qui est déjà fait ; ceux de session disent le reste.
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
    const faits = [packsOpened > 0, deckVu, combatFait];
    const premiere = faits.findIndex((fait) => !fait);
    // `faits` ne couvre que les trois gestes : `-1` veut dire « tout est fait », et l'on
    // reste à l'étape 1. Seul un index strictement positif déplace la reprise.
    if (premiere > 0) allerAEtape(premiere);
  }, [tutorielVu, packsOpened, deckVu, combatFait]);
  const courante = ETAPES_JOURNEE[Math.min(etape, ETAPES_JOURNEE.length - 1)];
  const cibleDeLEtape = courante.geste ? (CIBLE_DE_GESTE[courante.geste] ?? null) : null;

  /**
   * **Le geste réel** (D-196) : l'étape suivante s'ouvre dès qu'il est validé. Sans geste
   * (l'étape du comité), il n'y a rien à valider : le tap de l'encadré fait le même chemin.
   */
  const gesteFait =
    courante.geste === undefined ||
    (courante.geste === 'arrivage' ? packsOpened > 0 : courante.geste === 'deck' ? deckVu : combatFait);

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
    const selecteurCible = cibleDeLEtape ? `[data-journee-cible="${cibleDeLEtape}"]` : null;
    const trouverLaCible = () => (selecteurCible ? document.querySelector<HTMLElement>(selecteurCible) : null);

    /** La pointe du panneau se cale sur le centre horizontal de sa cible. */
    const positionnerPointe = () => {
      if (!cibleDeLEtape) return;
      const pointe = panneau.querySelector<HTMLElement>('.journee__pointe');
      const cible = trouverLaCible();
      if (!pointe || !cible) return;

      const panneauRect = panneau.getBoundingClientRect();
      const cibleRect = cible.getBoundingClientRect();
      const centreCible = cibleRect.left + cibleRect.width / 2;
      pointe.style.left = `${centreCible - panneauRect.left}px`;
    };

    /**
     * **Le voile éclaire la cible** (D-195 (3)) : l'élément `.journee__voile` se pose sur le
     * rectangle de la cible, et son ombre étalée assombrit le reste. Sans cible (le comité, ou
     * une cible pas encore montée), `data-cible="false"` : il couvre toute la page.
     */
    const positionnerEclairage = () => {
      const voile = document.querySelector<HTMLElement>('.journee__voile');
      if (!voile) return;
      const cible = trouverLaCible();
      if (!cible) {
        voile.dataset.cible = 'false';
        voile.style.removeProperty('top');
        voile.style.removeProperty('left');
        voile.style.removeProperty('width');
        voile.style.removeProperty('height');
        return;
      }
      const rect = cible.getBoundingClientRect();
      voile.dataset.cible = 'true';
      voile.style.top = `${rect.top - MARGE_ECLAIRAGE_PX}px`;
      voile.style.left = `${rect.left - MARGE_ECLAIRAGE_PX}px`;
      voile.style.width = `${rect.width + 2 * MARGE_ECLAIRAGE_PX}px`;
      voile.style.height = `${rect.height + 2 * MARGE_ECLAIRAGE_PX}px`;
    };

    /**
     * **Le fond est inerte** (D-194 (1), D-195 (3)) : tout ce qui n'est ni la Journée ni la cible
     * porte `inert`, par les frères du chemin (`journee-inerte`). La passe se rejoue quand la
     * coquille change d'enfants : un écran paresseux qui arrive, une cible qui se monte.
     * **Aucun `aria-modal`** pour autant : le panneau est une `region` (D-162 (1)), et la cible
     * désignée vit **hors** du panneau — `aria-modal` sur le panneau la cacherait au lecteur
     * d'écran qui doit justement l'atteindre, et l'attribut n'est pas permis sur une `region`.
     * `inert` fait ce que `aria-modal` promettrait : le fond sort de l'arbre d'accessibilité.
     */
    const racine = panneau.parentElement;
    const inertie = new Inertie();
    const rendreInerte = () => {
      if (!racine) return;
      inertie.appliquer(racine, [...racine.querySelectorAll(SELECTEUR_JOURNEE), trouverLaCible()]);
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
      positionnerEclairage();
    };
    rendreInerte();
    poser();
    const observateur = typeof ResizeObserver === 'function' ? new ResizeObserver(poser) : null;
    observateur?.observe(panneau);
    const cible = trouverLaCible();
    if (cible) observateur?.observe(cible);
    window.addEventListener('resize', poser);
    // La cible bouge avec la page : l'éclairage la suit. Passif : on ne retient pas le défilement.
    document.addEventListener('scroll', positionnerEclairage, { capture: true, passive: true });

    amenerLaCible();
    // Les polices arrivent après le premier rendu : on replace la cible une fois posées.
    void document.fonts?.ready.then(() => {
      amenerLaCible();
      poser();
    });

    // La coquille change d'enfants (écran paresseux, re-rendu) ou une page pose son halo
    // (`data-journee-cible` arrive **par attribut**, après le montage, quand `useEstCibleJournee`
    // répond — mesuré le 10/11/2026 sur `/settings` : sans ce filtre, `main` restait inerte avec la
    // cible dedans) : le fond se remet inerte, et l'éclairage se repose sur la cible. Les `inert`
    // posés ici ne sont pas dans le filtre : aucune boucle.
    let coquille: MutationObserver | null = null;
    if (racine && typeof MutationObserver === 'function') {
      coquille = new MutationObserver(() => {
        rendreInerte();
        positionnerEclairage();
      });
      coquille.observe(racine, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-journee-cible']
      });
    }

    /**
     * **La cible peut arriver après l'effet** (#679) : les écrans sont paresseux (#478).
     * Sur `/deck`, la Journée se monte avant le morceau du Deck ; `amenerLaCible` ne
     * trouvait alors rien, et le volet des Decks proposés restait hors de la fenêtre
     * (diagnostic du 03/11/2026, `y = 1330`). On l'amène dès qu'il paraît, puis on cesse
     * d'écouter : une cible déjà présente n'a pas besoin de l'observateur.
     */
    let veille: MutationObserver | null = null;
    if (selecteurCible && !document.querySelector(selecteurCible) && typeof MutationObserver === 'function') {
      veille = new MutationObserver(() => {
        if (!document.querySelector(selecteurCible)) return;
        amenerLaCible();
        poser();
        veille?.disconnect();
      });
      veille.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-journee-cible']
      });
    }

    return () => {
      veille?.disconnect();
      coquille?.disconnect();
      observateur?.disconnect();
      window.removeEventListener('resize', poser);
      document.removeEventListener('scroll', positionnerEclairage, { capture: true });
      inertie.lever();
      poserCibleJournee(null);
    };
  }, [ouvert, etape, pathname, cibleDeLEtape]);

  if (tutorielVu) return null;

  /**
   * **La tête reste d'une étape à l'autre** (D-187 (6)(c)) : un seul nœud, à la même place dans
   * l'arbre, que le panneau soit ouvert, en pause ou effacé sur `/battle`. Seul l'encadré, lui,
   * suit le panneau. Sa copie animée est `aria-hidden` ; la région `aria-live` lit la réplique
   * entière d'un coup (D-187 (4)).
   *
   * **Deux tailles** (D-195 (1) pour le grand format, D-204 (3) pour la petite tête de 56 px). Quand le Chef de
   * cabinet parle, la tête fait **un tiers de l'écran** (`--journee-tete`, `journee-tete.ts`), en
   * bas, à la place de la barre de navigation, et le **voile** assombrit la page autour de la
   * cible. En pause et sur `/battle`, elle est **discrète** : 56 px dans le coin bas gauche, sans
   * voile — sur le plateau, la table ronde de D-193 reste entière, et la réplique tient sur une
   * ligne (`journee__ligne`, pas un bouton : rien à y faire, le pas-à-pas du combat guide).
   */
  const aide = !gesteFait ? ligneAideGeste(courante) : null;
  const scene = (avecParole: boolean, uneLigne = false) => (
    <div className={`journee__scene${avecParole ? '' : ' journee__scene--discrete'}`}>
      <img className="journee__portrait" src={PORTRAIT_CHEF_CABINET} alt="" aria-hidden="true" />
      {uneLigne && (
        <p className="journee__ligne" aria-hidden="true" title={courante.direction}>
          <strong>Chef de cabinet</strong> {courante.direction}
        </p>
      )}
      {avecParole && (
        // **L'encadré** : le bouton de la réplique et, dessous, la ligne d'aide du geste. Le
        // bouton garde le tap ; la ligne n'est pas dedans (un bouton n'a pas de région `status`).
        <div className="journee__encadre">
          {/* **Un vrai bouton** (779, D-196) : Entrée et Espace le déclenchent, et son nom dit le
          tap. Le texte visible est `aria-hidden` : la région `aria-live` le lit une fois. */}
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
                // La durée suit les mots (60 ms par mot, 3 s au plus) et les pas suivent les
                // caractères : `src/styles.css` lit ces deux variables (décision du 10/11/2026).
                style={
                  {
                    '--duree-ecriture': `${dureeEcriture(courante.direction)}ms`,
                    '--pas-ecriture': pasEcriture(courante.direction)
                  } as CSSProperties
                }
                onAnimationEnd={() => setRepliqueLue(courante.direction)}
              >
                {courante.direction}
              </span>
            </span>
          </button>
          {aide !== null && (
            // **Visible, une seule ligne** (D-198 (6), #788) : la forme la plus sobre — une ligne
            // en petit, collée sous la réplique, dans le même cadre. `role="status"` : annoncée une
            // fois, par elle-même (la région `data-journee-voix` ne lit que la réplique).
            <p className="journee__aide" role="status">
              {aide}
            </p>
          )}
        </div>
      )}
      <span className="sr-only" data-journee-voix aria-live="polite" aria-atomic="true">
        {(avecParole || uneLigne) && `Chef de cabinet : ${courante.direction}`}
      </span>
    </div>
  );
  // Sur `/battle` (la seule raison d'être ici) : la tête discrète et la réplique sur une ligne.
  // La scène garde son **rang** dans le fragment (le second enfant) : c'est ce qui fait que la
  // tête est le même nœud d'un état à l'autre (D-187 (6)(c)).
  if (!visible)
    return (
      <>
        {null}
        {scene(false, surLeCombat)}
      </>
    );

  const derniere = etape >= ETAPES_JOURNEE.length - 1;

  /**
   * **Le tap sur l'encadré** (779, D-196 (1), D-187 (4)). Premier tap : la réplique s'écrit
   * d'un coup. Second tap, à une étape **sans geste** : l'étape suivante s'ouvre, et à la
   * **dernière** (le comité) la Journée se termine, comme « Relire la Journée plus tard »
   * (décision du propriétaire, 10/11/2026). Une étape avec geste n'avance jamais au tap — son
   * geste la fait avancer. Sous mouvement réduit, la réplique est entière dès le départ : un
   * seul tap suffit.
   */
  const repliqueComplete = repliqueLue === courante.direction || reduit;
  const dernier = ETAPES_JOURNEE.length - 1;
  const toucherLaReplique = () => {
    if (!repliqueComplete) {
      setRepliqueLue(courante.direction);
      return;
    }
    if (tapeTermine(courante, etape, dernier)) {
      terminer();
      return;
    }
    if (tapeAvance(courante, etape, dernier)) allerAEtape(etape + 1);
  };
  /** Ce que fait le tap, dit à la lecture d'écran (le nom accessible porte l'action). */
  const indicationTap = !repliqueComplete
    ? ', appuyer pour afficher tout le texte'
    : tapeTermine(courante, etape, dernier)
      ? ', appuyer pour terminer la Journée'
      : tapeAvance(courante, etape, dernier)
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
          {/* **La fin n'a qu'un bouton** (D-205 (3)) : à la dernière étape, la phrase « Relire la
            Journée plus tard » ne ferme plus rien ; la relecture reste dans Réglages. */}
          {!derniere && (
            <button type="button" className="journee__passer" onClick={terminer}>
              {libelleSaut(etape)}
            </button>
          )}
        </div>

        <p id="journee-texte" className="journee__texte">
          {courante.texte}
        </p>

        {cibleDeLEtape && <span className="journee__pointe" aria-hidden="true" />}

        {/* La région reste **montée** : un lecteur d'écran n'entend pas un nœud qui
          apparaît, mais il entend un texte qui change. Elle ne parle que des étapes qui
          **exigent** un geste : aux autres, « C'est fait » serait faux. */}
        {courante.geste !== undefined && gesteFait && (
          // **Fait : l'étape suivante s'annonce** (779, D-196). La ligne reste dans le DOM pour
          // les lecteurs d'écran ; à l'écran, la Journée a déjà avancé. La ligne d'aide d'avant le
          // geste est **visible**, dans l'encadré de parole (D-198 (6), #788).
          <p className="sr-only" role="status">
            C’est fait : l’étape suivante s’ouvre.
          </p>
        )}

        {/* Le geste de l'étape : on ne renvoie pas à une documentation, on ouvre l'écran.
          Le panneau reste posé par-dessus, pour qu'on lise l'étape en regardant l'écran
          qu'elle décrit — **la dernière comprise** : arriver sur `/comite` ne termine pas la
          Journée, sinon le mur s'ouvrait sans la réplique finale (D-161, #685). La sortie
          reste explicite : le bouton permanent, ou le lien de l'appel à participer. */}
        <div className="actions actions--tight">
          {/* Sur l'écran de l'étape, le bouton qui y mène n'a plus rien à faire : il laisse la
            place au geste lui-même. Et sans geste, il n'y a rien à montrer. Il n'y a pas de
            bouton « Suivant » (D-196) : le geste validé fait avancer, le tap fait le reste. */}
          {derniere ? (
            /* **Le seul bouton de la fin** (D-205 (3)) : il ferme la Journée et ouvre le comité. */
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                terminer();
                navigate(courante.cible);
              }}
            >
              {courante.action}
            </button>
          ) : !surLaPage ? (
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
      {/* **Le voile** (D-195 (3)) : hors de la scène, dont l'animation de `transform` ferait le bloc
        conteneur d'un élément fixe, et **après** elle, pour que la scène garde son rang. Posé sur
        la cible par `positionnerEclairage`, il assombrit le reste de la page par son ombre ;
        `data-cible="false"` tant qu'aucune cible n'est montée. */}
      <div className="journee__voile" data-journee-voile data-cible="false" aria-hidden="true" />
    </>
  );
}
