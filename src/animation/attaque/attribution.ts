import type { Attack, PlanqueCard } from '@/data/types';
import { hacher } from '../moteur';

// ---------- Attribution : une animation distincte par attaque d'une carte ----------

export type CleD =
  | 'tampon'
  | 'avion'
  | 'enveloppes'
  | 'graphe'
  | 'dossiers'
  | 'cafe'
  | 'postits'
  | 'eclair'
  | 'megaphone'
  | 'marteau'
  | 'soudure'
  | 'zen'
  | 'soin'
  | 'extincteur'
  | 'laser'
  | 'chrono'
  | 'chaines'
  | 'cv';

export const MOTIFS_D: Record<CleD, { libelle: string; mots: RegExp }> = {
  tampon: {
    libelle: 'Coup de tampon',
    mots: /conformit|norme|certific|contr[ôo]le|audit|inspection|v[ée]rification|attestation|recette|z[ée]ro d[ée]faut|[ée]cart|checklist|validation/i
  },
  avion: {
    libelle: 'Avion en papier',
    mots: /note|newsletter|compte rendu|convocation|mot doux|tract|mutation|renvoi|export|transport|relais|affectation|mission/i
  },
  enveloppes: {
    libelle: 'Avalanche de mails',
    mots: /relance|ticket|faq|chatbot|connaissances|facture|devis|appel d|commande|prospection|transfert d.appel|assistance|mise à jour/i
  },
  graphe: {
    libelle: 'Courbe qui grimpe',
    mots: /tableau de bord|reporting|barom|objectif|prime|croissance|rendement|budg|tr[ée]sorerie|virement|index|performance|enqu[êe]te|analyse|revue/i
  },
  dossiers: {
    libelle: 'Pile de dossiers',
    mots: /dossier|proc[ée]dure|protocole|mode op|mode d.emploi|archiv|inventaire|catalogue|script|clause|contrat|contentieux|accord|convention|gamme|ordre de|saisie|sauvegarde|relev/i
  },
  cafe: {
    libelle: 'Café renversé',
    mots: /caf[ée]|afterwork|pot de|verre|pause|corbeille|panier|menu|babyfoot/i
  },
  postits: {
    libelle: 'Nuée de post-its',
    mots: /atelier|kaizen|plan d.action|feuille de route|planning|agenda|jalon|team|icebreaker|briefing|point de suivi|lean|r[ée]troplanning|semaine/i
  },
  eclair: {
    libelle: 'Arc électrique',
    mots: /[ée]lectri|c[âa]blage|raccordement|multim|bobinage|d[ée]nudage|deadline|acc[ée]l[ée]ration|chargement|remise en service|d[ée]blocage|radio/i
  },
  megaphone: {
    libelle: 'Mégaphone',
    mots: /gr[èe]ve|action collective|motion|n[ée]gociation|marque employeur|escalade|contre-ordre|r[ée]quisition|consigne/i
  },
  marteau: {
    libelle: 'Coup de massue',
    mots: /gros|frappe|cl[ée]|usinage|levage|chariot|coulage|restructuration|r[ée]organisation|plan social|fusion|d[ée]part|refonte|d[ée]merde|manipulation/i
  },
  soudure: {
    libelle: 'Chalumeau',
    mots: /soudure|graissage|r[ée]glage|gabarit|pliage|lissage|r[ée]vision|maintenance|r[ée]installation/i
  },
  zen: {
    libelle: 'Pétales zen',
    mots: /yoga|lotus|relaxation|shiatsu|[ée]tirement|oxyg|[ée]coute|bilan forme|bonheur|inclusion|mixit|amiti/i
  },
  soin: {
    libelle: 'Piqûre',
    mots: /pansement|bandage|piq[ûu]re|massage|sant[ée]|diagnostic|arr[êe]t|autopsie|pr[ée]l[èe]vement|r[ée]gime/i
  },
  extincteur: {
    libelle: 'Extincteur',
    mots: /extincteur|serpill|fluidif|filtr/i
  },
  laser: {
    libelle: 'Pointeur laser',
    mots: /pr[ée]sentation|direction|arbitrage|strat[ée]g|cibl|recherche|approche|discr[èe]te/i
  },
  chrono: {
    libelle: 'Chrono qui s’emballe',
    mots: /chrono|cadence|rattrapage|ronde|ligne|ordonnancement|goulot|plan de charge|continuit|reprise|express/i
  },
  chaines: {
    libelle: 'Chaînes',
    mots: /porte ferm|garde|r[ée]tention|bascule|contre-offre|offre|clause/i
  },
  cv: {
    libelle: 'Pluie de CV',
    mots: /entretien|comp[ée]tences|carri[èe]re|promesse|embauche|stage|initiation|int[ée]gration|accueil|livret|universit|module|formation|parcours|mont[ée]e|programme|remplacement|renfort|pr[ée]carit/i
  }
};

export const REPLI_FACTION: Record<PlanqueCard['faction'], CleD> = {
  SSE: 'soin',
  MANAGEMENT: 'postits',
  QVT: 'zen',
  AMELIORATION: 'tampon',
  RH: 'cv',
  ATELIER: 'marteau',
  DIRECTION: 'graphe',
  SYNDICAT: 'megaphone',
  INTERIM: 'avion',
  SUPPORT: 'enveloppes'
};

export function ordreHache<T>(cles: readonly T[], graine: string): T[] {
  return [...cles].sort((x, y) => hacher(graine + String(x)) - hacher(graine + String(y)));
}

export function candidats(carte: PlanqueCard, attaque: Attack): CleD[] {
  const graine = `${carte.id}:${attaque.name}`;
  const cles = Object.keys(MOTIFS_D) as CleD[];
  const parNom = cles.filter((k) => MOTIFS_D[k].mots.test(attaque.name));
  return [...parNom, REPLI_FACTION[carte.faction], ...ordreHache(cles, graine)];
}

/** Le motif de chaque attaque de la carte, distinct d'une attaque à l'autre. */
export function attribuer(carte: PlanqueCard): Map<number, CleD> {
  const pris = new Set<CleD>();
  const sortie = new Map<number, CleD>();
  // La clé est le **rang** de la Pression, jamais son nom : deux attaques homonymes d'une même
  // carte gardent chacune la leur, là où une `Map` par nom écrasait la première.
  carte.attacks.forEach((attaque, rang) => {
    const cle = candidats(carte, attaque).find((k) => !pris.has(k)) ?? 'postits';
    pris.add(cle);
    sortie.set(rang, cle);
  });
  return sortie;
}

export function libelle(cle: string): string {
  return MOTIFS_D[cle as CleD]?.libelle ?? cle;
}

export function estLegendaire(carte: PlanqueCard): boolean {
  return carte.rarity === 'COU' || carte.rarity === '3S' || carte.ex === true;
}

/**
 * **La cinématique est réservée** (D-098) : un Planqué COU, 3 étoiles ou COMEX, et seulement
 * sur sa Pression la plus chère. Une carte ordinaire n'en a jamais, et la petite attaque d'un
 * légendaire non plus — sinon la carte aurait deux fois la même fête.
 */
export function cinematiqueDe(carte: PlanqueCard, attaque: Attack): boolean {
  if (!estLegendaire(carte)) return false;
  const max = Math.max(...carte.attacks.map((a) => a.cost.length));
  if (attaque.cost.length !== max) return false;
  // À coût égal, la fête va à la **première** Pression de la carte, pas aux deux.
  const premiere = carte.attacks.findIndex((a) => a.cost.length === max);
  return premiere === carte.attacks.indexOf(attaque);
}
