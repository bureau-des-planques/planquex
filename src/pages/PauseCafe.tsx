/**
 * **La pause café** (D-190) : l'espace social du bureau, cinquième onglet de la barre du bas.
 *
 * Rien n'y est encore jouable : la page dit ce qui s'y préparera. Elle annonce l'espace des
 * collègues et **le tiroir du voisin** — le nom satirique de la pioche dans l'Arrivage d'un
 * autre (le « Wonder Pick » du jeu de référence, `docs/JEU.md` §3), renvoyée à la release par
 * D-061. Aucune règle n'est créée ici : le tiroir du voisin reprend la ligne de §3
 * (cinq cartes, au moins une rare), sans rien y ajouter.
 */
import { RetourEcran } from '@/components/RetourEcran';

export function PauseCafe() {
  return (
    <div className="page pause-cafe">
      <section className="section">
        <h1>La pause café</h1>
        <p className="pause-cafe__chapo">
          Le seul endroit du bureau où l’on avance vraiment : celui où l’on parle des autres.
        </p>
        <p className="pause-cafe__etat">Bientôt</p>
      </section>

      <section className="section pause-cafe__annonces" aria-label="Ce qui se prépare">
        <article className="pause-cafe__annonce">
          <h2>Les collègues</h2>
          <p className="muted">
            Croiser les autres planqués du bureau, voir ce qu’ils ont sorti de leurs Arrivages, et comparer qui en fait
            le moins.
          </p>
        </article>
        <article className="pause-cafe__annonce">
          <h2>Le tiroir du voisin</h2>
          <p className="muted">
            Un collègue vient d’ouvrir un Arrivage ; ses cartes traînent dans son tiroir. Cinq cartes, au moins une rare
            : tu en pioches une, sans regarder.
          </p>
          <p className="pause-cafe__quand">Prévu pour la version finale du jeu.</p>
        </article>
      </section>

      <RetourEcran vers="/" libelle="Retour au bureau" />
    </div>
  );
}
