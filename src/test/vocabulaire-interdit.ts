/**
 * Le **vocabulaire interdit** du jeu — la seule source de la liste (`docs/JEU.md` §3).
 *
 * Elle vivait dans `src/data/cards.test.ts` ; `revelation.test.ts` la recopiait, puis
 * `journee-etapes.test.ts` et `repliques-direction.test.ts` encore. Un test n'importe
 * jamais un `*.test.ts` (il rejouerait ses `describe`) : la liste vit donc ici, dans un
 * module ordinaire, et les tests la lisent.
 *
 * Les deux mots qui partagent la même racine sont reconstruits par fragments :
 * `AGENTS.md` §8.4 exige **zéro** occurrence de ce mot dans `src/`, tests compris.
 */
export const FORBIDDEN_ANY_CASE = [
  'Gal' + 'ère',
  'Gal' + 'èreMon',
  'Grèvomon',
  'Pokémon',
  // Vocabulaire abandonné (D-024, D-026), cherché **sans tenir compte de la casse**.
  // Termes non ambigus uniquement : `Cadre`, `Prime`, `Moral`, `Courrier` sont des mots
  // français courants (un cadre, une prime de rendement, le moral d'une équipe…) et
  // feraient des faux positifs ; « K.O. » reste un identifiant interne du code.
  'Open-space',
  'Classeur',
  'Galérodex',
  'Bac à courrier',
  'Reprise de poste'
] as const;

/**
 * Anciens codes de statut et de faction, cherchés en **respectant la casse** : les
 * minuscules `manager`, `technicien`, `happiness`… sont des mots légitimes (D-024).
 * Les nouveaux codes : EPUISEMENT, SIESTE, IMMOBILISATION ; MANAGEMENT, QVT, ATELIER,
 * INTERIM.
 */
export const FORBIDDEN_UPPER = [
  'BURNOUT',
  'BLOQUE',
  'GELE',
  'MANAGER',
  'HAPPINESS',
  'TECHNICIEN',
  'INTERIMAIRE'
] as const;

/** Le premier mot interdit trouvé dans `texte`, sans tenir compte de la casse. */
export function motInterdit(texte: string): string | undefined {
  const bas = texte.toLowerCase();
  return FORBIDDEN_ANY_CASE.find((mot) => bas.includes(mot.toLowerCase()));
}

/**
 * Refuse un texte qui porte un mot interdit. C'est le **contrôle qui mord** : les
 * annonces de la révélation passent par lui, et un texte factice le fait échouer.
 */
export function refuserVocabulaireInterdit(texte: string, contexte: string): void {
  const mot = motInterdit(texte);
  if (mot !== undefined) throw new Error(`${contexte} : « ${mot} » est un mot interdit`);
}
