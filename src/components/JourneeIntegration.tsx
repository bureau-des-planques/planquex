import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ETAPES_JOURNEE } from '@/components/journee-etapes';
import { useStore } from '@/store/useStore';

/**
 * La « Journée d'intégration » : les quatre choses qu'un testeur ne devine pas
 * (`AGENTS.md` §3 — le tutoriel s'appelle comme ça, jamais « onboarding »).
 *
 * **Forme courte** (D-066, #130) : quatre étapes, et **chaque étape ouvre l'écran
 * qu'elle décrit** — un geste, pas un renvoi de documentation. La forme **guidée**
 * (attendre que le geste soit fait) est un travail de beta, pas d'alpha.
 *
 * Elle se montre **une fois** (`tutorielVu`, forme persistée v5 : aucun changement de
 * forme, donc aucune migration), se referme par n'importe quel chemin de fermeture —
 * la croix, Échap, le fond, « Suivant » jusqu'au bout, « Passer » —, et se rouvre depuis
 * **Réglages** (le drapeau y repasse à `false`). Une fois fermée, elle ne se remontre pas :
 * tous les chemins de fermeture passent par `terminer`, le seul endroit qui écrit le
 * drapeau.
 *
 * **Le mur du comité (`/comite`) est exclu** : la visite guidée s'abstient sur
 * cette page (voir le commentaire de `surLeMur`).
 */
export function JourneeIntegration() {
  const tutorielVu = useStore((state) => state.tutorielVu);
  const setTutorielVu = useStore((state) => state.setTutorielVu);
  const [etape, setEtape] = useState(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const terminer = () => {
    setTutorielVu(true);
    setEtape(0);
  };

  /**
   * Le mur (D-058, D-068) est le seul écran où la visite **s'abstient**. Il ne s'ouvre
   * que par la bulle, pas par la barre de navigation : un testeur qui le lit d'abord n'a
   * pas commencé à jouer, et lui poser un dialogue de jeu par-dessus le premier contenu
   * qu'il découvre serait le seul écran de l'application où l'on ne peut rien lire. Rien
   * n'est perdu : `tutorielVu` reste `false`, et la visite se montre dès qu'on quitte le
   * mur — d'autant que ses étapes emmènent justement ailleurs.
   */
  const surLeMur = pathname.startsWith('/comite');

  const courante = ETAPES_JOURNEE[Math.min(etape, ETAPES_JOURNEE.length - 1)];
  const derniere = etape >= ETAPES_JOURNEE.length - 1;

  return (
    <Dialog
      open={!tutorielVu && !surLeMur}
      onOpenChange={(ouvert) => {
        if (!ouvert) terminer();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{courante.titre}</DialogTitle>
          <DialogDescription>
            Journée d’intégration — étape {etape + 1} sur {ETAPES_JOURNEE.length}
          </DialogDescription>
        </DialogHeader>

        <p>{courante.texte}</p>

        {/* Le geste de l'étape : on ne renvoie pas à une documentation, on ouvre l'écran.
            La visite reste ouverte par-dessus, pour qu'on lise l'étape en regardant
            l'écran qu'elle décrit. */}
        <div className="actions actions--tight">
          <button type="button" className="button button--primary" onClick={() => navigate(courante.cible)}>
            {courante.action}
          </button>
          {derniere ? (
            <button type="button" className="button button--gold" onClick={terminer}>
              C’est parti
            </button>
          ) : (
            <button
              type="button"
              className="button"
              onClick={() => {
                setEtape((courant) => courant + 1);
              }}
            >
              Suivant
            </button>
          )}
        </div>

        <button type="button" className="journee__passer" onClick={terminer}>
          Passer la journée d’intégration
        </button>
      </DialogContent>
    </Dialog>
  );
}
