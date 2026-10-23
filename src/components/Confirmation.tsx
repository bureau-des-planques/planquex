import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  titre: string;
  /** Ce que le geste fait, et ce qu'il ne permet pas de défaire. */
  texte: string;
  /** Le verbe du bouton qui confirme : « Abandonner », « Tout effacer »… jamais « OK ». */
  confirmer: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * **La** confirmation du jeu (#131, D-035) : un seul composant pour les gestes qu'on ne
 * défait pas — le forfait du Combat, la réinitialisation de Réglages. Elle remplace
 * `window.confirm`, que le navigateur peut taire et que rien ne dessine aux couleurs du
 * jeu, et elle passe par le dialogue générique (rôle, Échap, focus piégé, fond).
 *
 * Le bouton qui **annule** vient en premier et porte le focus d'ouverture : Entrée ne
 * détruit rien par réflexe. Échap, le fond et la croix annulent aussi.
 */
export function Confirmation({ open, titre, texte, confirmer, onConfirm, onCancel }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(ouvert) => {
        if (!ouvert) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          <DialogDescription>{texte}</DialogDescription>
        </DialogHeader>
        <div className="actions actions--tight">
          <button type="button" className="button" onClick={onCancel} autoFocus>
            Annuler
          </button>
          <button type="button" className="button button--danger" onClick={onConfirm}>
            {confirmer}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
