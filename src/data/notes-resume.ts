/**
 * **Le résumé des notes de version** — de quoi nommer une version et la dater.
 *
 * **Fichier généré : ne pas éditer à la main.** Il est écrit par `npm run notes:versions`
 * (`scripts/generateurs/notes-versions.mjs`), en même temps que `src/data/versions.ts`.
 *
 * **Pourquoi deux fichiers** : `Home` est la porte d'entrée, et elle n'affiche d'une note que
 * son **titre** et sa **date**. Importer `versions.ts` y faisait entrer tout le texte de
 * l'historique — le paquet principal grossissait d'environ 1 kB à chaque release, et le cliquet
 * de `scripts/ci/taille-paquets.mjs` le refusait. Le texte des notes ne vit donc que dans
 * `versions.ts`, lu par le morceau **paresseux** de `/feuille-de-route`.
 *
 * La forme est gardée par `scripts/generateurs/notes-versions.test.ts` : le fichier commité doit
 * être exactement ce que le générateur écrit.
 */

export interface ResumeNote {
  /** Le numéro, sans le `v` du tag : `0.1.16`. */
  version: string;
  /** Le jour de la publication, au format `AAAA-MM-JJ`. */
  date: string;
  /** Le titre de la release : `Version 0.1.16`. */
  titre: string;
  /** Écrite d'avance : sa release n'est pas encore publiée, donc `Home` ne l'annonce pas. */
  brouillon?: boolean;
}

/** Le résumé, **de la plus récente à la plus ancienne**, comme `versions.ts`. */
export const NOTES_RESUME: ResumeNote[] = [
  {
    version: '0.1.17',
    date: '2026-11-02',
    titre: 'Version 0.1.17'
  },
  {
    version: '0.1.16',
    date: '2026-11-01',
    titre: 'Version 0.1.16'
  },
  {
    version: '0.1.15',
    date: '2026-10-29',
    titre: 'Version 0.1.15'
  },
  {
    version: '0.1.14',
    date: '2026-10-27',
    titre: 'Version 0.1.14'
  },
  {
    version: '0.1.13',
    date: '2026-10-26',
    titre: 'Version 0.1.13'
  },
  {
    version: '0.1.12',
    date: '2026-10-26',
    titre: 'Version 0.1.12'
  },
  {
    version: '0.1.11',
    date: '2026-10-25',
    titre: 'Version 0.1.11'
  },
  {
    version: '0.1.10',
    date: '2026-10-25',
    titre: 'Version 0.1.10'
  },
  {
    version: '0.1.9',
    date: '2026-10-25',
    titre: 'Version 0.1.9'
  },
  {
    version: '0.1.8',
    date: '2026-10-25',
    titre: 'Version 0.1.8'
  },
  {
    version: '0.1.7',
    date: '2026-10-25',
    titre: 'Version 0.1.7'
  },
  {
    version: '0.1.6',
    date: '2026-10-23',
    titre: 'Version 0.1.6'
  },
  {
    version: '0.1.5',
    date: '2026-10-22',
    titre: 'Version 0.1.5'
  },
  {
    version: '0.1.4',
    date: '2026-10-22',
    titre: 'Version 0.1.4'
  },
  {
    version: '0.1.3',
    date: '2026-10-22',
    titre: 'Version 0.1.3'
  },
  {
    version: '0.1.2',
    date: '2026-10-21',
    titre: 'Version 0.1.2'
  },
  {
    version: '0.1.1',
    date: '2026-10-21',
    titre: 'Version 0.1.1'
  }
];
