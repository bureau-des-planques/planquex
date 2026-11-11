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
 * **Le budget** (D-195 (2), qui amende D-181) : **1 à 3 phrases, 25 à 35 mots**, une idée et
 * une chute ; le nom du locuteur « Chef de cabinet » est **hors budget** (D-186, décision du
 * propriétaire du 10/11/2026). Les mots se comptent aux espaces, les phrases sur `. ! ?`.
 * `src/data/direction-repliques.test.ts` borne chaque texte ; la Journée entière se mesure
 * en secondes dans `src/components/journee-etapes.ts` (plafond d'environ 90 s).
 *
 * **Le ton** (D-195 (2), acquis de Bastien du 05/11/2026) : sarcastique, qui argumente, une
 * blague sur ce que le testeur vient de faire ; jamais une insulte, jamais une personne —
 * toujours un dossier, une réunion, un compte rendu. Les mots interdits de `docs/JEU.md` §3
 * s'appliquent (`src/test/vocabulaire-interdit.ts`), et le test les cherche. Le mot reste
 * « réplique » (D-181 (8)(b)) : « bulle » appartient au comité.
 *
 * **Les textes** sont la variante 1 de chaque ligne, choisie par le propriétaire le 10/11/2026
 * parmi les trois variantes classées de l'agent `redacteur` (#782), avec quatre corrections du
 * même jour : les groupes `victoire` et `defaite` sont **permutés** (le brouillon lisait
 * `victoire` du côté de la Direction, le code la lit du côté du testeur), la ligne « Bravo » est
 * réécrite en défaite, et les répliques de l'Arrivage, du Deck et du comité sont réécrites en
 * **annonce** : la réplique s'affiche **avant** le geste, elle ne peut pas le raconter au passé.
 */

/** Une réplique fait **au moins** 25 mots (D-195 (2)) : en dessous, c'est une étiquette. */
export const MOTS_MIN_REPLIQUE = 25;
/** Une réplique fait **au plus** 35 mots (D-195 (2)) : au-delà, le Chef de cabinet fait un discours. */
export const MOTS_MAX_REPLIQUE = 35;
/** Une réplique tient en **1 à 3 phrases** (D-195 (2)). */
export const PHRASES_MAX_REPLIQUE = 3;

/** Les cinq moments où la Direction parle pendant un combat. */
export type EvenementDirection = 'ouverture' | 'pression' | 'craquage' | 'victoire' | 'defaite';

/**
 * Les répliques de combat, par événement. **Deux au moins par événement** : la même phrase à
 * chaque fois ferait un perroquet, pas un adversaire. `victoire` et `defaite` se lisent du
 * côté du **testeur** (`src/pages/Battle.tsx` : `state.winner === myCamp` → `victoire`) : une
 * `victoire` dit « tu as gagné », une `defaite` « tu as perdu », et le test le garde.
 */
export const REPLIQUES_DIRECTION: Record<EvenementDirection, readonly string[]> = {
  ouverture: [
    'Tu poses ta première carte avec enthousiasme, comme on signe une note sans la lire. Bonne nouvelle : je l’ai lue pour toi, et tu es désormais dans la boucle, la mienne.',
    'Tu as cinq minutes à me consacrer ? Parfait, elles sont déjà prises sur ton compteur, et je les ai comptées avant toi. Commence, le temps d’une réunion ne s’arrête jamais.',
    'Ça tombe bien, j’avais un point à te faire, et tu viens de l’ouvrir toi-même. Tu as cliqué sans lire l’objet du mail, c’est la meilleure façon de commencer une carrière.'
  ],
  pression: [
    'Tu attaques, avec un statut de stagiaire et une stratégie de stagiaire. C’est courageux, je te l’accorde, et ça figurera dans ton prochain entretien annuel, sans relecture.',
    'C’est noté, et je le range dans un tableau que tu ne verras jamais. Chaque coup que tu portes rejoint un dossier, et ces dossiers, eux, sont toujours bien rangés.',
    'Tu me rappelles quelqu’un, un ancien collègue qui attaquait avec la même assurance. Il est parti depuis un trimestre, et son bureau n’a pas encore été repeint.',
    'On en parlera lors de ton EPDP, avec tes objectifs, dont l’un était de ne pas attaquer. Tu as déjà raté le premier. Les autres seront traités en réunion de suivi.'
  ],
  craquage: [
    'Il était en réunion, et il y est resté. Depuis 2019, ses réunions durent plus longtemps que ses carrières. Tu viens de faire sortir un Planqué de la salle.',
    'Ce n’est pas un départ, c’est une fin de mission, avec une prime de fin de mission. Tu l’as provoqué, mais on ne parle plus de lui. Le dossier est déjà classé.',
    'On va mutualiser son poste, c’est-à-dire le donner à trois personnes qui ne se connaissent pas. Tu as fait une économie, la Direction appelle ça une synergie. Félicitations.',
    'Un bras cassé de moins, et la pause du midi est enfin libre pour tout le monde. Tu as réduit l’effectif, la Direction appelle ça une optimisation. Le planning te remercie.'
  ],
  victoire: [
    'Je te mets en copie, pour information seulement, ce qui veut dire que tu ne décides de rien. Tu as gagné le combat, félicitations, mais le mail part quand même à la Direction.',
    'La porte reste ouverte, celle de sortie, et tu l’as trouvée sans chercher. Tu as gagné, c’est une belle façon de partir, avec un badge encore actif pendant trois jours.',
    'Je transmets ta partie à ton manager, qui appréciera le contexte, c’est-à-dire tout ce que tu viens de faire. Tu as gagné, c’est exact, mais il faudra le lui expliquer en réunion.',
    'Ce n’était pas un test, c’était un entretien, et tu viens de le réussir, ce qui inquiète un peu. Tu as gagné la partie, c’est remarquable, mais l’évaluation reste confidentielle, comme toujours.',
  ],
  defaite: [
    'Je déléguerai ce point à personne, comme d’habitude, et vous le lirez dans le compte rendu de la semaine prochaine. Tu as perdu, mais la réunion a bien avancé, sans toi.',
    'Le sujet est clos, mais le dossier reste ouvert, avec ton nom dedans, pour la forme. Tu as perdu une partie, la Direction garde l’archive et le droit de la relire.',
    'On fera un retour d’expérience, un REX, et tu n’y es pas convié. Tu as perdu, c’est la meilleure base de travail. Nous garderons ta partie pour les prochaines formations.',
    'Bravo pour l’effort, qui ne figurera pas dans ton bilan, puisque la Direction rédige le bilan. Tu as perdu avec sincérité. Nous en prendrons acte, mais pas au tableau.'
  ]
};

/**
 * **La Direction accueille le nouveau** (31/10/2026 ; réécrit le 10/11/2026, D-195 (2)) : une
 * réplique par étape de la Journée, dite dans l'encadré de parole du Chef de cabinet, au-dessus
 * du geste. Les clés nomment les étapes de `ETAPES_JOURNEE` (`src/components/journee-etapes.ts`),
 * qui les lit dans l'ordre.
 */
export const REPLIQUES_JOURNEE = {
  arrivage:
    'Ouvre ton premier Arrivage : cinq cartes, choisies pour toi par personne. La Direction appelle ça une surprise, le service achats appelle ça un reliquat. Tu feras la grimace, c’est prévu dans le planning.',
  // **Texte provisoire** (D-205 (2), O-017) : l'ancienne annonce demandait de charger un Deck, ce
  // n'est plus le geste. Trois variantes sont proposées dans le rapport du #805 ; le propriétaire tranche.
  collectionDeck:
    'Ouvre l’onglet Deck : vingt cartes, déjà comptées par la Direction, et des Decks proposés pour t’éviter d’en choisir. Un Deck, c’est un organigramme : tout le monde y figure, personne ne sait pourquoi.',
  combat:
    'Le combat guidé te tient la main, c’est rassurant. Trois Interventions suffisent pour gagner, mais la Direction a déjà rédigé le compte rendu de ta défaite.',
  /** La dernière étape : c'est elle qui porte la **phrase de fin** de la Journée (D-195 (5)). */
  comite:
    'Colle un post-it, IP pour une idée, OUF pour un défaut : ce sera ta première contribution au débat. Le mur ne lit rien, mais il archive tout. La Journée est finie, le travail commence.'
} as const;
