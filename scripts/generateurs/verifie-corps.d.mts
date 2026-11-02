/**
 * Les types de `scripts/generateurs/verifie-corps.mjs` — le contrôle d'un corps de release
 * avant publication (#624).
 *
 * Comme `notes-versions.d.mts` : le script est du **JavaScript**, et son test l'importe. Cette
 * déclaration est le contrat de cet import.
 */

/** Un défaut trouvé dans un corps de release, nommé par sa ligne. */
export interface DefautCorps {
  /** La ligne du fichier, à partir de 1. */
  ligne: number;
  /** Ce qui ne va pas, en clair. */
  quoi: string;
  /** Le début de la ligne fautive, replié. */
  extrait: string;
}

/** Une section telle que `analyserCorps` la rend : son titre et ses points. */
export interface GroupeCorps {
  titre: string | null;
  points: string[];
}

/** Une section gardée, réduite à son titre, sa ligne et son nombre de points. */
export interface SectionCorps {
  titre: string | null;
  ligne: number;
  points: number;
}

/** Le verdict du contrôle : publiable, ou refusé avec ses défauts. */
export interface VerdictCorps {
  ok: boolean;
  nom: string;
  defauts: DefautCorps[];
  /** Ce que le générateur (`analyserCorps`) ferait de ce corps. */
  groupes: GroupeCorps[];
  sections: SectionCorps[];
  points: number;
  ecartees: SectionCorps[];
}

/**
 * Le corps d'une release est-il publiable ? Rend les défauts avec leur ligne, et le regard du
 * générateur. Ne lit rien, n'écrit rien.
 */
export function verifierCorps(corps: string, options?: { nom?: string }): VerdictCorps;

/** Le fichier demandé par la ligne de commande (`--corps <fichier>`, `--corps=<fichier>` ou positionnel). */
export function lireArguments(argv: string[]): { fichier: string };

/** Le rapport lisible d'un verdict : la ligne d'ouverture, puis un défaut par ligne. */
export function formaterVerdict(verdict: VerdictCorps): string;
