/**
 * Les types de `scripts/generateurs/note-brouillon.mjs` — la note d'une version à venir,
 * écrite par le générateur (#623).
 *
 * Comme `notes-versions.d.mts` : le script est du **JavaScript** (le patron des générateurs
 * du dépôt), et son test l'importe. Cette déclaration est le contrat de cet import.
 */

/** Un point de note, tel que `lirePoints` le rend. */
export interface PointNote {
  /** Le groupe de la release, quand la ligne du fichier en portait un. */
  groupe?: string;
  /** Le point lui-même, en clair. */
  texte: string;
}

/** Une entrée de `src/data/versions.ts`, en mémoire. */
export interface NoteVersion {
  version: string;
  date: string;
  titre: string;
  points: PointNote[];
  brouillon?: boolean;
}

/**
 * Le fichier de points, ligne à ligne (`groupe | texte`, ou `texte`). Lève au premier défaut :
 * liste vide, ligne vide, point sans texte.
 */
export function lirePoints(texte: string, nom?: string): PointNote[];

/** L'entrée de brouillon : titre `Version <numéro>`, date du jour, `brouillon: true`. */
export function noteBrouillon(args: {
  version: string;
  points: PointNote[];
  date?: string;
}): NoteVersion;

/** L'historique avec le brouillon en tête ; refuse une version qui a déjà sa note. */
export function ajouterBrouillon(notes: NoteVersion[], note: NoteVersion): NoteVersion[];

/** Relit l'historique, refuse ce qui doit l'être, et réécrit les deux fichiers. */
export function ecrireBrouillon(args: {
  version: string;
  points: PointNote[];
  date?: string;
  cible?: string;
  resume?: string;
}): Promise<{ note: NoteVersion; notes: NoteVersion[] }>;

/** Les deux options de la ligne de commande ; lève quand il en manque une. */
export function lireArguments(argv: string[]): { version: string; points: string };
