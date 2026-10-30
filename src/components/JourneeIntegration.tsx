import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppelParticiper } from '@/components/AppelParticiper';
import { ETAPES_JOURNEE, libelleSaut } from '@/components/journee-etapes';
import { CIBLE_DE_GESTE } from '@/components/journee-cible';
import { useGesteFait } from '@/components/journee-gestes';
import { poserCibleJournee } from '@/components/journee-cible';
import { useStore } from '@/store/useStore';

export function JourneeIntegration() {
  const tutorielVu = useStore((state) => state.tutorielVu);
  const setTutorielVu = useStore((state) => state.setTutorielVu);
  /** Les deux gestes que la Journée attend (30/10/2026) : un Arrivage ouvert, un Deck chargé. */
  const packsOpened = useStore((state) => state.packsOpened);
  const deck = useStore((state) => state.deck);
  const [etape, setEtape] = useState(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  /** Le panneau, pour mesurer sa hauteur et garder l'élément désigné **sous** lui. */
  const panneauRef = useRef<HTMLElement | null>(null);

  const terminer = () => {
    setTutorielVu(true);
    setEtape(0);
  };

  /**
   * **Elle se montre partout** (30/10/2026, D-161). Le mur du comité en était exclu
   * (D-066, D-058) : on ne posait pas un dialogue de jeu sur le premier contenu qu'un
   * testeur découvre. Depuis que la Journée est un panneau qui se laisse lire et qui
   * s'efface, l'exclusion n'a plus de raison — et l'étape 5 la mène justement au comité.
   */
  const ouvert = !tutorielVu;

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
    // visite bloque les boutons de la scène (constaté le 30/10/2026).
    const autorise = (cible: EventTarget | null) =>
      cible instanceof Element &&
      cible.closest('[data-journee-panneau], [data-journee-cible], [role="dialog"], .ouverture') !== null;
    const bloquer = (evenement: Event) => {
      if (autorise(evenement.target)) return;
      evenement.preventDefault();
      evenement.stopPropagation();
    };
    /**
     * **Le blocage parle** (critique du 30/10/2026, P1) : `Échap` sort, et le panneau prend
     * le focus à l'ouverture. Sans cela, un utilisateur au clavier n'avait aucune sortie et
     * ne savait pas que la page était inerte.
     */
    const sortir = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') terminer();
    };
    document.addEventListener('pointerdown', bloquer, true);
    document.addEventListener('click', bloquer, true);
    document.addEventListener('keydown', sortir);
    panneauRef.current?.focus();
    return () => {
      document.removeEventListener('pointerdown', bloquer, true);
      document.removeEventListener('click', bloquer, true);
      document.removeEventListener('keydown', sortir);
    };
  }, [ouvert]);

  /**
   * La sauvegarde est un fait de session : il se lit dans `journee-gestes`, pas dans le
   * store. **Ce hook se lit avant le retour anticipé** : un `useSyncExternalStore` placé
   * après `if (!ouvert) return null` change le nombre de hooks quand la Journée se ferme
   * (« Rendered fewer hooks than expected », vu par le test d'écran).
   */
  const sauvegardeFaite = useGesteFait('sauvegarde');
  const courante = ETAPES_JOURNEE[Math.min(etape, ETAPES_JOURNEE.length - 1)];

  /**
   * **L'élément désigné vient sous les yeux.** Le panneau occupe le haut de l'écran : sans
   * cela, le bouton qu'il désigne peut être caché derrière lui (constaté sur l'accueil, où
   * « Ouvrir un Arrivage » disparaissait sous le panneau). À chaque étape, on amène la
   * première cible **en haut**, sous le panneau, dont la hauteur réelle devient la marge.
   */
  const amenerLaCible = () => {
    document.querySelector('[data-journee-cible]')?.scrollIntoView({ block: 'center' });
  };

  useEffect(() => {
    if (!ouvert) return;
    const panneau = panneauRef.current;
    if (!panneau) return;
    // **La cible de l'étape, et elle seule** : les pages ne s'allument plus toutes ensemble.
    poserCibleJournee(courante.geste ? CIBLE_DE_GESTE[courante.geste] : null);

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

    // **La cible vient au centre** : en haut, elle se retrouvait sous le panneau, et le
    // premier écran du produit n'offrait plus aucun chemin visible vers l'avant.
    amenerLaCible();
    // Les polices arrivent après le premier rendu : on replace la cible une fois posées.
    void document.fonts?.ready.then(() => amenerLaCible());

    return () => {
      observateur?.disconnect();
      poserCibleJournee(null);
    };
  }, [ouvert, etape, pathname]);

  if (!ouvert) return null;

  const derniere = etape >= ETAPES_JOURNEE.length - 1;
  /**
   * **Le geste réel** : « Suivant » ne s'ouvre qu'une fois fait. C'est ce qui empêche de
   * traverser la Journée en lecture — et c'est pour ça qu'elle a cessé d'être un dialogue
   * modal : le geste se fait sur la page, pas dans le panneau.
   */
  const gesteFait =
    courante.geste === undefined ||
    (courante.geste === 'arrivage' ? packsOpened > 0 : courante.geste === 'deck' ? deck.length > 0 : sauvegardeFaite);

  return (
    <aside
      ref={panneauRef}
      className="journee"
      data-journee-panneau
      role="dialog"
      aria-modal="true"
      aria-labelledby="journee-titre"
      aria-describedby="journee-texte"
      tabIndex={-1}
    >
      <p className="journee__compte">
        <span aria-hidden="true">{`${etape + 1}/${ETAPES_JOURNEE.length}`}</span>
        <span className="sr-only">
          Journée d’intégration — étape {etape + 1} sur {ETAPES_JOURNEE.length}
        </span>
      </p>

      <h2 id="journee-titre" className="journee__titre">
        {courante.titre}
      </h2>

      <p id="journee-texte" className="journee__texte">
        {courante.texte}
      </p>

      {/* La région reste **montée** : un lecteur d'écran n'entend pas un nœud qui
          apparaît, mais il entend un texte qui change. */}
      <p className="journee__geste" role="status">
        {gesteFait
          ? 'C’est fait : « Suivant » est ouvert.'
          : 'Fais le geste sur la page : « Suivant » s’ouvrira ensuite.'}
      </p>

      {/* Le geste de l'étape : on ne renvoie pas à une documentation, on ouvre l'écran.
          Le panneau reste posé par-dessus, pour qu'on lise l'étape en regardant l'écran
          qu'elle décrit — sauf la dernière, qui referme la Journée en menant au combat. */}
      <div className="actions actions--tight">
        {/* Sur l'écran de l'étape, le bouton qui y mène n'a plus rien à faire : il laisse la
            place au geste lui-même (c'est l'élément désigné qui le porte). */}
        {pathname !== courante.cible ? (
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
        ) : (
          /* **Sur l'écran de l'étape**, le panneau garde une action : « Montrer le bouton ».
             Il ne fait pas le geste à la place du testeur, il amène la cible sous ses yeux —
             sans lui, l'écran n'offrait qu'un « Suivant » éteint (critique du 30/10/2026). */
          <button type="button" className="button button--primary" onClick={amenerLaCible}>
            Montrer le bouton
          </button>
        )}
        {/* **Deux sorties, pas trois** (30/10/2026) : « Plus tard » faisait exactement ce que
            fait le lien du dessous, et promettait un retour qui n'arrive jamais — `terminer`
            écrit le drapeau. À la dernière étape, le geste principal suffit. */}
        {!derniere && (
          <button
            type="button"
            className="button"
            disabled={!gesteFait}
            onClick={() => {
              setEtape((courant) => courant + 1);
            }}
          >
            Suivant
          </button>
        )}
      </div>

      <button type="button" className="journee__passer" onClick={terminer}>
        {derniere ? 'Relire la journée plus tard, depuis Réglages' : libelleSaut(etape)}
      </button>

      {/* L'appel à participer (#271) : une ligne, à la fin seulement, à chaque Journée menée
          jusqu'à sa dernière étape. */}
      {derniere && <AppelParticiper surComite={terminer} />}
    </aside>
  );
}
