/** Types de `scripts/preuves/mesure-illustrations.mjs` (#499), pour son test. */
export interface CarteIllustrable {
  id: string;
  faction: string;
  art?: string;
  variantOf?: string;
}

export interface SourcesIllustrations {
  art: {
    artFileOf(card: CarteIllustrable): string | undefined;
    artUrl(fichier: string | undefined): string | undefined;
  };
  fichiers: readonly string[];
  existe(fichier: string): boolean;
  libelle?(faction: string): string;
}

export interface LigneFaction {
  faction: string;
  label: string;
  bases: number;
  illustrees: number;
  sans: number;
  ids: string[];
}

export interface RapportIllustrations {
  cartes: number;
  bases: number;
  basesIllustrees: number;
  basesSans: number;
  variantes: number;
  variantesAvecPlanche: number;
  variantesEnRepli: number;
  webpSurDisque: number;
  fichiersDeclares: number;
  orphelines: string[];
  manquantes: string[];
  parFaction: LigneFaction[];
  idsSansIllustration: string[];
}

export function recenser(
  cartes: readonly CarteIllustrable[],
  sources: SourcesIllustrations
): RapportIllustrations;
export function rendreMarkdown(rapport: RapportIllustrations): string;
