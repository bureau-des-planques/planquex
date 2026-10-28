import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ETAPES_REGLES } from '@/components/regles-etapes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

/**
 * **La présentation des règles au nouvel inscrit** (#270) : une minute, six étapes, et
 * aucun manuel. Elle s'ouvre depuis **Réglages** et depuis **le menu du combat** — les deux
 * endroits où un testeur la cherche —, et se referme par la croix que porte le dialogue.
 *
 * Ce n'est **pas** un second tutoriel : la Journée d'intégration (#130) et le pas-à-pas du
 * combat (#143) restent ce qu'ils sont. Ici, on lit les lignes d'`docs/JEU.md` §4 qui décident
 * d'une partie, et le dernier écran propose le **combat guidé** (#272) à qui veut jouer.
 *
 * Les textes viennent de `regles-etapes.ts`, les chiffres de leurs sources : rien n'est
 * recopié dans le JSX.
 */
export function PresentationRegles({
  className = 'button',
  extra,
  children
}: {
  className?: string;
  /** Ce qu'une entrée ajoute au panneau : le menu du combat y met la légende des Conditions. */
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={className} />}>{children}</DialogTrigger>
      <DialogContent className="regles-dialogue">
        <DialogHeader>
          <DialogTitle>Les règles en une minute</DialogTitle>
          <DialogDescription>
            Six étapes, et tu sais jouer. Rien ne remplace une partie : le combat guidé t’attend à la fin.
          </DialogDescription>
        </DialogHeader>
        <EtapesRegles />
        {extra}
      </DialogContent>
    </Dialog>
  );
}

/** Les étapes, une à la fois : « Précédent », « Suivant », et le guidage à la dernière. */
export function EtapesRegles() {
  const [cran, setCran] = useState(0);
  const index = Math.min(cran, ETAPES_REGLES.length - 1);
  const etape = ETAPES_REGLES[index];
  const derniere = index === ETAPES_REGLES.length - 1;

  return (
    <div className="regles">
      <p className="regles__compte muted">
        <span aria-hidden="true">
          {index + 1}/{ETAPES_REGLES.length}
        </span>
        <span className="sr-only">
          étape {index + 1} sur {ETAPES_REGLES.length}
        </span>
      </p>
      <h3 className="regles__titre" aria-live="polite">
        {etape.titre}
      </h3>
      <p className="regles__texte">{etape.texte}</p>
      <div className="actions actions--tight">
        <button type="button" className="button" onClick={() => setCran(index - 1)} disabled={index === 0}>
          Précédent
        </button>
        {!derniere && (
          <button type="button" className="button button--primary" onClick={() => setCran(index + 1)}>
            Suivant
          </button>
        )}
      </div>
      {derniere && (
        <p className="regles__essai">
          <Link className="button button--primary" to="/battle?tutoriel=1">
            Essayer un combat guidé
          </Link>
        </p>
      )}
    </div>
  );
}
