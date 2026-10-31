import { useState } from 'react';
import { POINTS_TO_WIN } from '@/game/rules';

/**
 * **La scène de fin** (30/10/2026) — le verdict, joué plutôt qu'écrit.
 *
 * À la fin du combat scripté du tutoriel, le bandeau du haut disait « Tu gagnes : 3
 * Interventions » et rien ne se passait. Cette scène pose le verdict comme un **tampon** :
 * le plateau recule sous un voile, le tampon tombe de biais, la phrase de la Direction
 * arrive dessous, et « Continuer » rend la main.
 *
 * **Elle ne bloque pas longtemps et elle ne piège pas** : n'importe où dans la scène, sauf
 * sur le bouton, un clic la referme (`onFermer`) — le même réflexe que la croix d'un
 * dialogue. Sous **mouvement réduit**, elle paraît d'un coup, sans tampon qui tombe.
 *
 * Ce qu'elle n'est pas : une animation de combat. Celle-là vit dans `src/animation/` et
 * joue les Pressions ; ici, il ne reste qu'un verdict à poser.
 */
export function SceneFin({
  gagne,
  replique,
  calme = false,
  onFermer,
  onContinuer
}: {
  /** Vrai quand le joueur a gagné : le tampon change de mot, jamais de place. */
  readonly gagne: boolean;
  /** La phrase de la Direction pour la fin — `null` laisse le tampon seul. */
  readonly replique: string | null;
  /** Mouvement réduit : la scène paraît déjà posée. */
  readonly calme?: boolean;
  readonly onFermer: () => void;
  /**
   * « Continuer » : ce que la suite du parcours attend (31/10/2026). Le clic sur le fond
   * ferme seulement — il ne fait pas avancer la visite à la place du testeur.
   */
  readonly onContinuer?: () => void;
}) {
  const [ferme, setFerme] = useState(false);
  if (ferme) return null;

  const fermer = () => {
    setFerme(true);
    onFermer();
  };

  return (
    <div
      className={`scene-fin${calme ? ' scene-fin--calme' : ''}`}
      role="dialog"
      aria-label={gagne ? 'Tu gagnes' : 'Tu perds'}
      data-testid="scene-fin"
      onClick={fermer}
    >
      <div className="scene-fin__voile" aria-hidden="true" />

      <div className="scene-fin__corps">
        <p className={`scene-fin__tampon${gagne ? ' is-gagne' : ' is-perdu'}`}>
          {gagne ? `${POINTS_TO_WIN} INTERVENTIONS` : 'DÉFAITE'}
        </p>
        <p className="scene-fin__sous">{gagne ? 'La Direction est à court de Planqués.' : 'Ton plateau est vide.'}</p>
        {replique && (
          <p className="scene-fin__replique">
            <strong>La Direction</strong> · {replique}
          </p>
        )}
        <button
          type="button"
          className="button button--primary"
          onClick={(evenement) => {
            // Le clic sur la scène ferme déjà : le bouton ne doit pas le doubler.
            evenement.stopPropagation();
            fermer();
            onContinuer?.();
          }}
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
