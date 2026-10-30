/**
 * **Ce que la Direction dit** (30/10/2026) — la parole de l'adversaire pendant le combat.
 *
 * Le jeu n'avait **aucune** réplique : l'IA jouait, encaissait, perdait, en silence. Le
 * tutoriel de combat demande l'inverse — une Direction qui réagit, comme dans les jeux de
 * cartes du genre, mais dans **son** registre : le sien n'est pas la méchanceté, c'est la
 * réunion, le plan, la délégation. Elle ne parle jamais d'une personne, toujours d'un
 * dossier.
 *
 * **Le ton** : une phrase, sèche, jamais une insulte. Les mots interdits de
 * `docs/JEU.md` §3 s'appliquent aussi ici, et le test les cherche.
 *
 * **Le tirage n'est pas aléatoire** : les lignes se choisissent par le numéro de tour
 * (`choisirReplique`). Une partie rejouée depuis sa graine dit donc exactement les mêmes
 * phrases — le déterminisme du moteur vaut aussi pour les vannes.
 */
export type EvenementDirection = 'ouverture' | 'pression' | 'craquage' | 'victoire' | 'defaite';

/**
 * Les répliques, par événement. **Deux au moins par événement** : la même phrase à chaque
 * fois ferait un perroquet, pas un adversaire.
 */
export const REPLIQUES_DIRECTION: Record<EvenementDirection, readonly string[]> = {
  ouverture: [
    'Je t’ai mis dans la boucle. Tu ne sais pas laquelle.',
    'Tu as cinq minutes ? Elles sont décomptées.',
    'Ça tombe bien, j’avais un point à te faire.'
  ],
  pression: [
    'Ambitieux. On repère vite les gens ambitieux.',
    'C’est noté dans ton dossier.',
    'Continue. Ça m’occupe.',
    'Tu veux vraiment qu’on en parle en revue ?'
  ],
  craquage: [
    'Il était en réunion. Depuis 2019.',
    'Un départ, pas un problème : une réorganisation.',
    'On va mutualiser son poste.',
    'Un bras cassé de moins. On respire.'
  ],
  victoire: [
    'Je déléguerai. À personne.',
    'Le sujet est clos. Le dossier reste ouvert.',
    'On fera un retour d’expérience. Sans toi.',
    'Tu gagnes. Ça ne compte pas dans ton évaluation.'
  ],
  defaite: [
    'Je te mets en copie. Pour information.',
    'On garde la porte ouverte. Elle donne sur le parking.',
    'Ce sera un excellent point pour ta revue.',
    'Tu as perdu. Évidemment.'
  ]
};

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
