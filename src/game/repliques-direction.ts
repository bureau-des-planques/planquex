import { REPLIQUES_DIRECTION, type EvenementDirection } from '@/data/repliques-direction';

/**
 * **Ce que la Direction dit** (30/10/2026) — la parole de l'adversaire pendant le combat.
 *
 * Le jeu n'avait **aucune** réplique : l'IA jouait, encaissait, perdait, en silence. Le
 * tutoriel de combat demande l'inverse — une Direction qui réagit, comme dans les jeux de
 * cartes du genre, mais dans **son** registre : le sien n'est pas la méchanceté, c'est la
 * réunion, le plan, la délégation. Elle ne parle jamais d'une personne, toujours d'un
 * dossier.
 *
 * **Les textes vivent dans `src/data/repliques-direction.ts`** (#782) : aucun texte de
 * réplique hors de `src/data` (`AGENTS.md` §6). Ce module ne garde que le **choix**.
 *
 * **Le tirage n'est pas aléatoire** : les lignes se choisissent par le numéro de tour
 * (`choisirReplique`). Une partie rejouée depuis sa graine dit donc exactement les mêmes
 * phrases — le déterminisme du moteur vaut aussi pour les vannes.
 */

/**
 * La réplique d'un événement, choisie par le tour : déterministe, donc rejouable.
 * `tour` est le numéro de tour du combat ; la partie commencée au tour 6 dira la
 * deuxième ligne d'une liste de trois.
 */
export function choisirReplique(evenement: EvenementDirection, tour: number): string {
  const lignes = REPLIQUES_DIRECTION[evenement];
  const index = Math.abs(Math.trunc(tour)) % lignes.length;
  return lignes[index];
}

/**
 * **Ce que la dernière ligne du journal raconte** — le seul événement que l'écran peut
 * nommer sans deviner. `null` quand rien ne mérite une réplique : la Direction ne parle
 * pas à chaque carte posée.
 */
export function evenementDuJournal(derniereLigne: string): EvenementDirection | null {
  if (/craque/i.test(derniereLigne)) return 'craquage';
  if (/Pression|Stress/i.test(derniereLigne)) return 'pression';
  return null;
}
