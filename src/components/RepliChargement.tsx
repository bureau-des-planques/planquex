/**
 * Le repli pendant qu'un écran se charge (#478).
 *
 * Depuis #478, les écrans autres que l'Accueil vivent dans leur propre morceau : ouvrir le jeu
 * ne télécharge plus le plateau de combat ni l'administration. Le prix est un délai, court mais
 * réel, entre le clic et le premier pixel de l'écran demandé.
 *
 * Le repli est **visible et annoncé** : `role="status"` le fait lire par le lecteur d'écran, et
 * le texte dit ce qui se passe. Sa hauteur est **réservée** (`styles.css`, `.repli-chargement`)
 * pour que la barre de navigation ne remonte pas sous le pouce quand le contenu arrive.
 *
 * **Pas de barre qui glisse** : `src/components/effets-combat.test.ts` (#294) borne toute
 * animation de la feuille à 800 ms et deux tours — la seule boucle sans fin admise est la scène
 * d'Arrivage (D-141). Un indicateur qui bat la mesure vaut mieux qu'une exception de plus.
 *
 * Il ne s'affiche **jamais sur l'Accueil** : `src/App.tsx` importe `Home` en dur, c'est la porte
 * d'entrée de tous les liens, y compris ceux des testeurs.
 */
export function RepliChargement() {
  return (
    <div className="page repli-chargement" role="status">
      <p className="repli-chargement__texte">Chargement de l’écran…</p>
    </div>
  );
}
