import { useState } from 'react';
import { ETAPES_COMBAT } from '@/components/pas-a-pas-combat-etapes';
import type { PasAPasCombatEtat } from '@/components/use-pas-a-pas-combat';

/**
 * Le **pas-à-pas du premier combat** (#143) — le panneau, et rien d'autre : il ne lit
 * ni n'écrit l'état, il rend celui que `usePasAPasCombat` lui donne.
 *
 * **Il tient sur une ligne** (#199) : le numéro, le titre de l'étape et « Suivant ». Tout le
 * reste — « Précédent », « Passer le pas-à-pas », « Lire le détail » — se replie derrière
 * « Plus », pour rendre la hauteur au plateau. Le panneau reste **collé en haut** (`position:
 * sticky`, `styles.css`) : il suit la lecture, et « Suivant » fait défiler la page vers
 * l'élément qu'il désigne (`usePasAPasCombat`).
 *
 * **Il ne bloque rien** (critère du ticket). Ce n'est pas un dialogue : pas de fond
 * assombri, pas de focus pris, pas de page figée. C'est une carte qu'on peut ignorer et
 * qui laisse jouer dessous — la différence avec la Journée d'intégration (#130), qui est
 * un dialogue parce qu'elle présente des écrans, pas un geste en cours.
 *
 * La sortie est **toujours offerte** : « Passer le pas-à-pas » est dans « Plus », sur les
 * cinq étapes, et toutes les sorties passent par `terminer` — le seul écrivain du drapeau.
 * Aucune étape ne réclame un geste pour avancer.
 *
 * Les pièces repliées restent **rendues** : elles sont seulement masquées par la feuille de
 * style. Un lecteur d'écran et un test les trouvent donc sans déplier le panneau.
 */
export function PasAPasCombat({ pasAPas }: { pasAPas: PasAPasCombatEtat }) {
  const [plusOuvert, setPlusOuvert] = useState(false);
  const [detailOuvert, setDetailOuvert] = useState(false);
  if (!pasAPas.ouvert) return null;

  const total = ETAPES_COMBAT.length;
  const numero = pasAPas.etape + 1;

  return (
    <aside
      className={`pas-a-pas${plusOuvert ? ' pas-a-pas--plus' : ''}${detailOuvert ? ' pas-a-pas--detail' : ''}`}
      aria-label="Pas-à-pas du combat"
    >
      <div className="pas-a-pas__ligne">
        <p className="pas-a-pas__compte">
          <span aria-hidden="true">
            {numero}/{total}
          </span>
          <span className="sr-only">
            étape {numero} sur {total}
          </span>
        </p>
        <h2 className="pas-a-pas__titre" aria-live="polite">
          {pasAPas.courante.titre}
        </h2>
        <button
          type="button"
          className="button button--primary button--small pas-a-pas__suivant"
          onClick={pasAPas.derniere ? pasAPas.terminer : pasAPas.suivante}
        >
          {pasAPas.derniere ? 'C’est compris' : 'Suivant'}
        </button>
        <button
          type="button"
          className="pas-a-pas__plus"
          aria-expanded={plusOuvert}
          onClick={() => setPlusOuvert((ouvert) => !ouvert)}
        >
          Plus
        </button>
      </div>
      <div className="pas-a-pas__reste">
        <div className="pas-a-pas__actions">
          <button
            type="button"
            className="button button--small"
            onClick={pasAPas.precedente}
            disabled={pasAPas.etape === 0}
          >
            Précédent
          </button>
          <button type="button" className="pas-a-pas__passer" onClick={pasAPas.terminer}>
            Passer le pas-à-pas
          </button>
          <button
            type="button"
            className="pas-a-pas__lire"
            aria-expanded={detailOuvert}
            onClick={() => setDetailOuvert((ouvert) => !ouvert)}
          >
            {detailOuvert ? 'Replier le détail' : 'Lire le détail'}
          </button>
        </div>
        <p className="pas-a-pas__texte">{pasAPas.courante.texte}</p>
      </div>
    </aside>
  );
}
