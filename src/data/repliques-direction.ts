/**
 * **Les répliques du Chef de cabinet** — la voix de la Direction (D-181 (1)), en combat
 * comme dans la Journée d'intégration (#782, 10/11/2026).
 *
 * Elles vivaient dans `src/game/repliques-direction.ts` (le combat) et dans le champ
 * `direction` de `src/components/journee-etapes.ts` (la Journée). `AGENTS.md` §6 ne veut
 * **aucun texte de carte ni de réplique hors de `src/data`** : les textes sont ici, et les
 * deux modules les importent. Le choix de la réplique (`choisirReplique`) reste dans le
 * moteur, déterministe par le tour ; l'ordre des listes et leurs clés ne changent pas, une
 * partie rejouée dit donc toujours les mêmes phrases.
 *
 * **Le ton** (D-195 (2), acquis de Bastien du 05/11/2026) : sarcastique, qui argumente, une
 * blague sur ce que le testeur vient de faire ; jamais une insulte, jamais une personne —
 * toujours un dossier, une réunion, un compte rendu. Les mots interdits de `docs/JEU.md` §3
 * s'appliquent (`src/test/vocabulaire-interdit.ts`), et le test les cherche. Le mot reste
 * « réplique » (D-181 (8)(b)) : « bulle » appartient au comité.
 */

/** Les cinq moments où la Direction parle pendant un combat. */
export type EvenementDirection = 'ouverture' | 'pression' | 'craquage' | 'victoire' | 'defaite';

/**
 * Les répliques de combat, par événement. **Deux au moins par événement** : la même phrase à
 * chaque fois ferait un perroquet, pas un adversaire. `victoire` et `defaite` se lisent du
 * côté du **testeur** (`src/pages/Battle.tsx` : `state.winner === myCamp` → `victoire`).
 */
export const REPLIQUES_DIRECTION: Record<EvenementDirection, readonly string[]> = {
  ouverture: [
    'Je t’ai mis dans la boucle. Tu ne sais pas laquelle.',
    'Tu as cinq minutes ? Elles sont prises sur ton compteur.',
    'Ça tombe bien, j’avais un point à te faire.'
  ],
  pression: [
    'Tu attaques. C’est courageux, pour ton statut.',
    'C’est noté. À un endroit que tu ne verras pas.',
    'Tu me rappelles quelqu’un. Il est parti.',
    'On en parlera à ton EPDP. Avec tes objectifs.'
  ],
  craquage: [
    'Il était en réunion. Depuis 2019.',
    'Ce n’est pas un départ. C’est une fin de mission.',
    'On va mutualiser son poste.',
    'Un bras cassé de moins. On respire.'
  ],
  victoire: [
    'Je déléguerai. À personne.',
    'Le sujet est clos. Le dossier reste ouvert.',
    'On fera un REX. Tu n’es pas convié.',
    'Bravo. Ça ne figurera pas dans ton bilan.'
  ],
  defaite: [
    'Je te mets en copie. Pour information seulement.',
    'La porte reste ouverte. Celle de sortie.',
    'Je transmets à ton manager. Il appréciera le contexte.',
    'Ce n’était pas un test. C’était un entretien.'
  ]
};

/**
 * **La Direction accueille le nouveau** (31/10/2026) : une réplique par étape de la Journée,
 * dite dans l'encadré de parole du Chef de cabinet, au-dessus du geste. Les clés nomment les
 * étapes de `ETAPES_JOURNEE` (`src/components/journee-etapes.ts`), qui les lit dans l'ordre.
 */
export const REPLIQUES_JOURNEE = {
  arrivage: 'De la part de la Direction.',
  collectionDeck: 'Vingt cartes, comptées.',
  combat: 'Trois Interventions et c’est gagné.',
  donnees: 'Sinon, tout s’efface.',
  /** La dernière étape : c'est elle qui porte la **phrase de fin** de la Journée. */
  comite: 'Le mur lit tout, promis.'
} as const;
