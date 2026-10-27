/**
 * **Ce que dit une grille vide** (#131) : la recherche, un filtre, ou les deux. Le message
 * n'accuse que ce qui est réellement en cause — « cette recherche » à un testeur qui n'a rien
 * tapé et a choisi une faction le renvoie chercher au mauvais endroit.
 *
 * Aujourd'hui le catalogue croise toutes les factions et tous les stades : un filtre **seul**
 * ne vide pas la grille, et seule la recherche (ou recherche et filtre) y mène. La fonction
 * n'en dépend pas : elle dit la vérité le jour où un couple se vide.
 */
export function causeDuVide(recherche: string, filtreActif: boolean): string {
  const cherche = recherche.trim() !== '';
  if (cherche && filtreActif) return 'cette recherche et ces filtres';
  return cherche ? 'cette recherche' : 'ces filtres';
}
