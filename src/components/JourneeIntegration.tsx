import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppelParticiper } from '@/components/AppelParticiper';
import { ETAPES_JOURNEE, libelleSaut } from '@/components/journee-etapes';
import { useStore } from '@/store/useStore';

/**
 * Le tour de jeu, **joué** (D-136, #334) : deux gestes sur un vrai gabarit de tour —
 * attacher un café, lancer une Pression — et le Stress qui monte à l'écran.
 *
 * Sans ce geste, l'étape ne se comprend pas : « un tour » reste un mot. C'est aussi la
 * garde : le bouton qui mène au combat reste éteint tant que la Pression n'est pas lancée.
 */
function TourDeJeu({ onFait }: { onFait: () => void }) {
  const [cafeAttache, setCafeAttache] = useState(false);
  const [pressionLancee, setPressionLancee] = useState(false);

  return (
    <div className="journee__tour">
      <div className="actions actions--tight">
        <button type="button" className="button" disabled={cafeAttache} onClick={() => setCafeAttache(true)}>
          Attacher un café
        </button>
        <button
          type="button"
          className="button"
          disabled={!cafeAttache || pressionLancee}
          onClick={() => {
            setPressionLancee(true);
            onFait();
          }}
        >
          Lancer une Pression
        </button>
      </div>
      {pressionLancee && (
        <p className="journee__stress" role="status">
          <strong>Stress 20 sur un Seuil de 60.</strong> La barre en réclame encore 40 — le Planqué craque à 60.
        </p>
      )}
    </div>
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
 * (voir le commentaire de `surLeMur`).
 */
export function JourneeIntegration() {
  const tutorielVu = useStore((state) => state.tutorielVu);
  const setTutorielVu = useStore((state) => state.setTutorielVu);
  const [etape, setEtape] = useState(0);
  /** Le geste du tour de jeu est-il fait ? Il conditionne le passage à la suite. */
  const [tourFait, setTourFait] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const terminer = () => {
    setTutorielVu(true);
    setEtape(0);
    setTourFait(false);
  };

  /**
   * Le mur (D-058, D-068) est le seul écran où la visite **s'abstient**. Il ne s'ouvre
   * que par la bulle, pas par la barre de navigation : un testeur qui le lit d'abord n'a
   * pas commencé à jouer, et lui poser un panneau de jeu par-dessus le premier contenu
   * qu'il découvre serait le seul écran de l'application où l'on ne peut rien lire. Rien
   * n'est perdu : `tutorielVu` reste `false`, et la visite se montre dès qu'on quitte le
   * mur — d'autant que ses étapes emmènent justement ailleurs.
   */
  const surLeMur = pathname.startsWith('/comite');
  const ouvert = !tutorielVu && !surLeMur;

  /**
   * **La garde** : hors du panneau et hors des éléments désignés, le clic n'arrive pas.
   * L'écouteur est posé en **capture** sur `document`, donc avant les gestionnaires de
   * React comme ceux du navigateur (un lien, un bouton natif). On ne fige pas la page :
   * elle défile, elle se lit, et un élément désigné reste cliquable.
   */
  useEffect(() => {
    if (!ouvert) return;
    const autorise = (cible: EventTarget | null) =>
      cible instanceof Element && cible.closest('[data-journee-panneau], [data-journee-cible]') !== null;
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

  if (!ouvert) return null;

  const courante = ETAPES_JOURNEE[Math.min(etape, ETAPES_JOURNEE.length - 1)];
  const derniere = etape >= ETAPES_JOURNEE.length - 1;
  /** **Un geste par étape** : le tour de jeu doit être fait avant d'aller au combat. */
  const gesteFait = courante.geste !== 'tour' || tourFait;

  return (
    <aside
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

      {courante.geste === 'tour' && <TourDeJeu onFait={() => setTourFait(true)} />}

      {/* Le geste de l'étape : on ne renvoie pas à une documentation, on ouvre l'écran.
          Le panneau reste posé par-dessus, pour qu'on lise l'étape en regardant l'écran
          qu'elle décrit — sauf la dernière, qui referme la Journée en menant au combat. */}
      <div className="actions actions--tight">
        <button
          type="button"
          className="button button--primary"
          disabled={!gesteFait}
          onClick={() => {
            navigate(courante.cible);
            if (derniere) terminer();
          }}
        >
          {courante.action}
        </button>
        {derniere ? (
          <button type="button" className="button" onClick={terminer} disabled={!gesteFait}>
            Plus tard
          </button>
        ) : (
          <button
            type="button"
            className="button"
            onClick={() => {
              setEtape((courant) => courant + 1);
              setTourFait(false);
            }}
          >
            Suivant
          </button>
        )}
      </div>

      <button type="button" className="journee__passer" onClick={terminer}>
        {libelleSaut(etape, tourFait)}
      </button>

      {/* L'appel à participer (#271) : une ligne, à la fin seulement, à chaque Journée menée
          jusqu'à sa dernière étape. */}
      {derniere && <AppelParticiper surComite={terminer} />}
    </aside>
  );
}
