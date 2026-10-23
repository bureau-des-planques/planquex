/**
 * Les **outils de test** — ce qu'un invité de l'alpha ne doit pas voir (#131) : le bouton
 * « Ajouter un exemplaire (test) » de la fiche d'une carte, qui fabrique des cartes hors
 * Arrivage.
 *
 * Ils n'existent qu'en **développement** (`vite`, `vitest`) : le build de production
 * (`import.meta.env.DEV === false`) les retire, et Vite élimine la branche morte. C'est
 * une **fonction** et non une constante, pour qu'un test puisse simuler la production
 * (`vi.stubEnv('DEV', false)`) sans recharger le module.
 */
export function outilsDeTest(): boolean {
  return import.meta.env.DEV === true;
}
