import { ETAPES_COMBAT } from '@/components/pas-a-pas-combat-etapes';
import type { PasAPasCombatEtat } from '@/components/use-pas-a-pas-combat';

/**
 * Le **pas-à-pas du premier combat** (#143) — le panneau, et rien d'autre : il ne lit
 * ni n'écrit l'état, il rend celui que `usePasAPasCombat` lui donne.
 *
 * **Il est en haut** (#169), sous l'en-tête de la page, et **collé** (`position: sticky`,
 * `styles.css`) : il reste sous les yeux pendant qu'« Suivant » fait défiler la page vers
 * l'élément qu'il décrit. En bas, il décrivait un élément plus haut sans jamais
 * l'amener à l'écran.
 *
 * **Il ne bloque rien** (critère du ticket). Ce n'est pas un dialogue : pas de fond
 * assombri, pas de focus pris, pas de page figée. C'est une carte qu'on peut ignorer et
 * qui laisse jouer dessous — la différence avec la Journée d'intégration (#130), qui est
 * un dialogue parce qu'elle présente des écrans, pas un geste en cours.
 *
 * La sortie est **toujours offerte** : « Passer » est sur les cinq étapes, et toutes
 * les sorties passent par `terminer` — le seul écrivain du drapeau. Aucune étape ne
 * réclame un geste pour avancer : un invité qui sait déjà jouer appuie sur « Passer »
 * et n'en entend plus parler.
 */
export function PasAPasCombat({ pasAPas }: { pasAPas: PasAPasCombatEtat }) {
  if (!pasAPas.ouvert) return null;

  return (
    <aside className="pas-a-pas" aria-label="Pas-à-pas du combat">
      <div className="pas-a-pas__entete">
        <p className="pas-a-pas__compte">
          Pas-à-pas · étape {pasAPas.etape + 1} sur {ETAPES_COMBAT.length}
        </p>
        <button type="button" className="pas-a-pas__passer" onClick={pasAPas.terminer}>
          Passer le pas-à-pas
        </button>
      </div>
      <div className="pas-a-pas__etape" aria-live="polite">
        <h2 className="pas-a-pas__titre">{pasAPas.courante.titre}</h2>
        <p className="pas-a-pas__texte">{pasAPas.courante.texte}</p>
      </div>
      <div className="actions actions--tight">
        <button
          type="button"
          className="button button--small"
          onClick={pasAPas.precedente}
          disabled={pasAPas.etape === 0}
        >
          Précédent
        </button>
        <button
          type="button"
          className="button button--primary button--small"
          onClick={pasAPas.derniere ? pasAPas.terminer : pasAPas.suivante}
        >
          {pasAPas.derniere ? 'C’est compris' : 'Suivant'}
        </button>
      </div>
    </aside>
  );
}
