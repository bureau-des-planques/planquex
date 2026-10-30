import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppelParticiper } from '@/components/AppelParticiper';
import { CARTES_MONTREES, ETAPES_JOURNEE, libelleSaut } from '@/components/journee-etapes';
import { useGesteFait } from '@/components/journee-gestes';
import { CARD_BY_ID } from '@/data';
import type { Card } from '@/data/types';
import { useStore } from '@/store/useStore';

/** Les cartes montrées à l'étape « La Collection et le Deck » — la carte parle, on n'ajoute rien. */
function CartesMontrees() {
  const cartes = CARTES_MONTREES.map((id) => CARD_BY_ID.get(id)).filter((card): card is Card => Boolean(card));
  return (
    <ul className="journee__cartes" aria-label="Quelques cartes, pour le plaisir">
      {cartes.map((card) => (
        <li key={card.id} className="journee__carte">
          <strong>{card.name}</strong>
          {'flavor' in card && card.flavor ? <em>{card.flavor}</em> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * La « Journée d'intégration » : ce qu'un testeur ne devine pas (`docs/JEU.md` §3 — le
 * tutoriel s'appelle comme ça, jamais « onboarding »).
 *
 * **Un panneau, plus un dialogue** (30/10/2026). Elle était un `Dialog` : un fond sombre,
 * la page figée, et des étapes qui se lisaient sans qu'on puisse rien faire dessous. Or la
 * suite du parcours demande des **gestes réels** — ouvrir un Arrivage, choisir un Deck —
 * qu'un dialogue modal rend impossibles. Elle devient donc le **même motif que le
 * pas-à-pas du combat** : un panneau posé sur l'écran, sans fond sombre.
 *
 * **Ce qui la rend contraignante** : tant qu'elle est ouverte, tout ce qui n'est pas le
 * panneau (`data-journee-panneau`) ou un élément qu'elle désigne (`data-journee-cible`)
 * est **inerte** — un écouteur en phase de capture avale le clic avant React. On ne sort
 * donc pas du parcours en touchant la barre du bas sans le vouloir ; la seule sortie est
 * « Passer », qui **dit ce qu'elle coûte** (`libelleSaut`, D-136).
 *
 * Elle se montre **une fois** (`tutorielVu`, forme persistée v5 : aucun champ nouveau, donc
 * aucune migration), se referme par n'importe quel chemin de fermeture — « Suivant »
 * jusqu'au bout, le saut —, et se rouvre depuis **Réglages** (le drapeau y repasse à `false`).
 *
 * **Le mur du comité (`/comite`) est exclu** : la visite guidée s'abstient sur cette page
 * a été levée le 30/10/2026 (D-161).
 */
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
    document.addEventListener('pointerdown', bloquer, true);
    document.addEventListener('click', bloquer, true);
    return () => {
      document.removeEventListener('pointerdown', bloquer, true);
      document.removeEventListener('click', bloquer, true);
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
  useEffect(() => {
    if (!ouvert) return;
    const panneau = panneauRef.current;
    if (panneau) {
      document.documentElement.style.setProperty('--journee-hauteur', `${panneau.offsetHeight}px`);
    }
    document.querySelector('[data-journee-cible]')?.scrollIntoView({ block: 'start' });
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
      aria-labelledby="journee-titre"
      aria-describedby="journee-texte"
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

      {courante.montreCartes && <CartesMontrees />}

      {!gesteFait && (
        <p className="journee__geste" role="status">
          Fais le geste sur la page : « Suivant » s’ouvrira ensuite.
        </p>
      )}

      {/* Le geste de l'étape : on ne renvoie pas à une documentation, on ouvre l'écran.
          Le panneau reste posé par-dessus, pour qu'on lise l'étape en regardant l'écran
          qu'elle décrit — sauf la dernière, qui referme la Journée en menant au combat. */}
      <div className="actions actions--tight">
        {/* Sur l'écran de l'étape, le bouton qui y mène n'a plus rien à faire : il laisse la
            place au geste lui-même (c'est l'élément désigné qui le porte). */}
        {pathname !== courante.cible && (
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
        )}
        {derniere ? (
          <button type="button" className="button" onClick={terminer}>
            Plus tard
          </button>
        ) : (
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
        {libelleSaut(etape)}
      </button>

      {/* L'appel à participer (#271) : une ligne, à la fin seulement, à chaque Journée menée
          jusqu'à sa dernière étape. */}
      {derniere && <AppelParticiper surComite={terminer} />}
    </aside>
  );
}
