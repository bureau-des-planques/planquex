import { ALL_CARDS, FACTION_META, RARITY_META, isPlanque } from '@/data';
import type { Card, Faction, Rarity, Stage } from '@/data/types';
import { TRIS, TRI_DEFAUT } from './tri-cartes';
import type { Tri } from './tri-cartes';

/**
 * Les filtres de la Collection (#365) — purs : pas de React, pas de store.
 *
 * Ils vivent dans l'**adresse** de la page (`?q=…&rarete=2S`), pas dans le store : revenir
 * de la fiche d'une carte, ou de n'importe quelle page, les retrouve sans rien changer à la
 * forme persistée (`bureau-des-planques-v1`, `migratePersisted`).
 */

export interface Filtres {
  texte: string;
  faction: Faction | 'ALL';
  stade: Stage | 'ALL';
  rarete: Rarity | 'ALL';
  /** Le nombre de cafés d'une Pression du Planqué (`attacks[].cost.length`), ou `ALL`. */
  cout: number | 'ALL';
  /** Seulement ce que le testeur possède (au moins un exemplaire). */
  possedees: boolean;
}

export const FILTRES_DEFAUT: Filtres = {
  texte: '',
  faction: 'ALL',
  stade: 'ALL',
  rarete: 'ALL',
  cout: 'ALL',
  possedees: false
};

const STADES: Stage[] = ['ENTRANT', 'N+1', 'N+2'];
const RARETES = Object.keys(RARITY_META) as Rarity[];
const FACTIONS = Object.keys(FACTION_META) as Faction[];

/**
 * Les coûts en café **présents dans le catalogue** : un filtre ne propose pas un coût que
 * personne ne porte. Dérivé des données, il suit l'ajout d'une carte.
 */
export const COUTS_PRESENTS: readonly number[] = [
  ...new Set(ALL_CARDS.filter(isPlanque).flatMap((card) => card.attacks.map((attaque) => attaque.cost.length)))
].sort((a, b) => a - b);

/** Le libellé d'un coût : « 2 cafés », ou « Gratuite » pour une Pression sans café. */
export function libelleCout(cafes: number): string {
  if (cafes === 0) return 'Gratuite';
  return cafes === 1 ? '1 café' : `${cafes} cafés`;
}

/** Le nombre de filtres réellement posés (la recherche compte si elle n'est pas vide). */
export function filtresActifs(filtres: Filtres): number {
  return [
    filtres.texte.trim() !== '',
    filtres.faction !== 'ALL',
    filtres.stade !== 'ALL',
    filtres.rarete !== 'ALL',
    filtres.cout !== 'ALL',
    filtres.possedees
  ].filter(Boolean).length;
}

/**
 * Une carte passe le filtre de coût si **une** de ses Pressions coûte ce nombre de cafés.
 * Une carte Action n'a pas de Pression : elle ne passe pas un filtre de coût (même logique
 * que le filtre de stade, qui ne concerne que les Planqués).
 */
function coutCorrespond(card: Card, cout: number): boolean {
  return isPlanque(card) && card.attacks.some((attaque) => attaque.cost.length === cout);
}

/**
 * Filtre `cartes` selon `filtres`. Les filtres se **combinent** (ET) ; un filtre absent ne
 * retire rien. L'ordre d'entrée est conservé : le tri se fait ensuite (`trierCartes`).
 */
export function filtrerCartes<T extends Card>(
  cartes: readonly T[],
  filtres: Filtres,
  owned: Readonly<Record<string, number>>
): T[] {
  const needle = filtres.texte.trim().toLowerCase();
  return cartes.filter((card) => {
    if (needle && !card.name.toLowerCase().includes(needle)) return false;
    if (filtres.faction !== 'ALL' && card.faction !== filtres.faction) return false;
    // Le stade ne concerne que les Planqués : une carte Action n'a pas de stade.
    if (filtres.stade !== 'ALL' && (!isPlanque(card) || card.stage !== filtres.stade)) return false;
    if (filtres.rarete !== 'ALL' && card.rarity !== filtres.rarete) return false;
    if (filtres.cout !== 'ALL' && !coutCorrespond(card, filtres.cout)) return false;
    if (filtres.possedees && (owned[card.id] ?? 0) <= 0) return false;
    return true;
  });
}

/**
 * Lit les filtres et le tri dans une adresse. Une valeur inconnue (lien tapé à la main, ancien
 * format) **retombe sur le défaut** : on ne filtre jamais sur une valeur qu'aucun menu ne propose.
 */
export function lireFiltres(params: URLSearchParams): { filtres: Filtres; tri: Tri } {
  const choisi = <T extends string>(valeur: string | null, valides: readonly T[]): T | undefined =>
    valides.find((item) => item === valeur);

  // `Number(null)` vaut 0 : sans ce garde, une adresse sans `cout` filtrerait sur les Pressions
  // gratuites dès qu'une carte en porterait une (le coût 0 existe, D-039).
  const brut = params.get('cout');
  const cout = brut === null || brut === '' ? Number.NaN : Number(brut);
  const tri = choisi(params.get('tri'), TRIS);

  return {
    filtres: {
      texte: params.get('q') ?? '',
      faction: choisi(params.get('faction'), FACTIONS) ?? 'ALL',
      stade: choisi(params.get('stade'), STADES) ?? 'ALL',
      rarete: choisi(params.get('rarete'), RARETES) ?? 'ALL',
      cout: COUTS_PRESENTS.includes(cout) ? cout : 'ALL',
      possedees: params.get('possedees') === '1'
    },
    tri: tri ?? TRI_DEFAUT
  };
}

/**
 * Écrit filtres et tri dans une copie de `actuels`, en retirant chaque valeur par défaut :
 * une adresse propre (`/collection` seul quand rien n'est posé).
 */
export function ecrireFiltres(actuels: URLSearchParams, filtres: Filtres, tri: Tri): URLSearchParams {
  const adresse = new URLSearchParams(actuels);
  const poser = (cle: string, valeur: string | null) => {
    if (valeur === null) adresse.delete(cle);
    else adresse.set(cle, valeur);
  };
  poser('q', filtres.texte.trim() === '' ? null : filtres.texte);
  poser('faction', filtres.faction === 'ALL' ? null : filtres.faction);
  poser('stade', filtres.stade === 'ALL' ? null : filtres.stade);
  poser('rarete', filtres.rarete === 'ALL' ? null : filtres.rarete);
  poser('cout', filtres.cout === 'ALL' ? null : String(filtres.cout));
  poser('possedees', filtres.possedees ? '1' : null);
  poser('tri', tri === TRI_DEFAUT ? null : tri);
  return adresse;
}
