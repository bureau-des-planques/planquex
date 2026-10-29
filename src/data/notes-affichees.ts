/**
 * **Ce que l'écran `/feuille-de-route` montre** (D-090) — module **à part**, et c'est exprès :
 * `src/data/versions.ts` est **généré** par `npm run notes:versions`, et
 * `scripts/generateurs/notes-versions.test.ts` exige qu'il soit exactement la sortie du générateur.
 * Une fonction écrite à la main n'y survivrait pas. Elle vit donc ici, et se teste sur des
 * **fixtures**.
 */
import { noteDe, type NoteVersion, NOTES_VERSIONS } from '@/data/versions';

export { NOTES_VERSIONS };
export type { NoteVersion };

/**
 * **Ce que l'écran `/feuille-de-route` montre**, en deux tas (D-090) :
 *
 * - la note de la **version sous les yeux**, publiée ou **écrite d'avance** — le tag part
 *   avant la release GitHub, donc un brouillon doit s'afficher pour la version courante ;
 * - l'**historique** : les notes **publiées** des autres versions. Un brouillon d'une
 *   version à venir ne se montre pas — elle n'est pas sortie, personne n'a à la lire ici.
 *
 * Fonction pure et exportée : `versions.test.ts` l'éprouve sur des **fixtures**, donc le
 * contrôle ne dépend plus de l'état du fichier un jour donné (le 25/10/2026, un test
 * supposait qu'une version restait un brouillon, et il est devenu faux en la publiant).
 */
export function notesAffichees(
  version: string,
  notes: NoteVersion[] = NOTES_VERSIONS
): { courante: NoteVersion | undefined; precedentes: NoteVersion[] } {
  return {
    courante: noteDe(version, notes),
    precedentes: notes.filter((note) => !note.brouillon && note.version !== version)
  };
}