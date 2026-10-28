/**
 * **Ce que dit une grille vide** (#131) : la recherche, un filtre, ou les deux. Le message
 * n'accuse que ce qui est réellement en cause — « cette recherche » à un testeur qui n'a rien
 * tapé et a choisi une faction le renvoie chercher au mauvais endroit.
 *
 * Un filtre **seul** peut vider la grille : la rareté et le coût en café (#365) croisent le
 * catalogue et n'en gardent parfois rien (« seulement ce que je possède » sur une Collection
 * vide, par exemple). La fonction ne dépend pas de la combinaison : elle dit la cause réelle.
 */
export function causeDuVide(recherche: string, filtreActif: boolean): string {
  const cherche = recherche.trim() !== '';
  if (cherche && filtreActif) return 'cette recherche et ces filtres';
  return cherche ? 'cette recherche' : 'ces filtres';
}
