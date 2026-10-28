import { CARD_BY_ID, isPlanque } from '@/data';
import type { CafeSymbol, Faction, PlanqueCard } from '@/data/types';
import { deckCafeTypes } from '@/game/deck';
import type { Politique } from '@/game/ia';
import {
  DEFAULT_MAX_TURNS,
  FACTION_ORDER,
  factionCafeTypes,
  ENTRANTS_MAX_DECK_DERIVE,
  factionDecks,
  jouerPartiePolitiques
} from '@/game/simulation';
import type { OptionsDeckDerive } from '@/game/simulation';
import { drawRandom, seedRng } from '@/game/rng';
import { intervalleWilson } from '@/game/mesure-direction';

/**
 * **La table des archétypes, mesurée** (#360, D-134 (2)).
 *
 * ## Ce que la table répond
 *
 * Le simulateur sait opposer deux politiques (#34), mais **aucune table d'équilibrage
 * n'était publiée** : les valeurs cibles vivaient dans un commentaire. Le contenu est là
 * (225 bases, dix factions qui font un Deck depuis #352) ; ce qui manquait, c'est le
 * **chiffre** qui dit si un archétype écrase les autres — et un testeur qui tombe sur le
 * Deck imbattable n'ouvrira pas un ticket, il arrêtera de jouer.
 *
 * ## Le protocole (fixé d'avance, D-134 (2))
 *
 * - **Les archétypes sont les Decks proposés** (`factionDeck`, `src/game/simulation.ts`) :
 *   un Deck de 20 cartes par faction, étiqueté par sa faction, pas une liste écrite à la main.
 * - **Toutes les paires** de factions, chacune jouée **en miroir** : chaque partie a son
 *   jumeau, même graine, camps échangés. `partiesParPaire` est donc **pair** et chaque
 *   faction occupe les deux sièges autant de fois.
 * - **Les deux camps jouent la politique scriptée** (`'scripte'`, `nextAction(state, 1)`),
 *   déterministe et **symétrique** : une table d'archétypes doit mesurer les **Decks**, pas
 *   l'asymétrie de deux politiques. C'est aussi la politique du simulateur historique.
 * - **La bande est 40–60 %** d'un affrontement, et un **écart de plus de 15 points** entre
 *   les deux archétypes est **à corriger avant la beta** ; en dessous, l'écart est **assumé
 *   avec sa raison écrite** dans le document de mesure.
 * - **Les graines sont disjointes de celles qui ont réglé quoi que ce soit** : graine
 *   maîtresse `20261029`, et aucune des graines du pesage (#111).
 *
 * ## Reproductibilité
 *
 * Aucun horodatage, aucun ordre dépendant d'un `Map` : deux lancements à graine fixe
 * produisent la **même** table. `formatTableArchetypes` en rend le markdown publié, que le
 * script écrit tel quel — la table du document n'est pas recopiée à la main.
 */

/** La bande d'un affrontement entre deux archétypes (D-134 (2)). */
export const BANDE_ARCHETYPES = { bas: 0.4, haut: 0.6 } as const;

/**
 * Le seuil d'alerte, en points de pourcentage : au-delà, l'écart est « à corriger avant la
 * beta ». **Strictement** supérieur — 15,0 points est encore assumé, 15,1 ne l'est plus.
 */
export const ECART_ALERTE = 0.15;

/** La graine maîtresse de la table. Disjointe de celle de la Direction (#354) et du pesage. */
export const GRAINE_MESURE_ARCHETYPES = 20261029;

/** Le nombre de parties par paire de la table publiée (20 par siège). */
export const PARTIES_PAR_PAIRE = 40;

/** Les paires d'archétypes, dans un ordre stable : l'ordre de `FACTION_ORDER`. */
export function pairesArchetypes(factions: readonly Faction[] = FACTION_ORDER): [Faction, Faction][] {
  const paires: [Faction, Faction][] = [];
  for (let i = 0; i < factions.length; i += 1) {
    for (let j = i + 1; j < factions.length; j += 1) {
      paires.push([factions[i]!, factions[j]!]);
    }
  }
  return paires;
}

/**
 * L'écart à 50 % d'un taux d'affrontement, en points de pourcentage :
 * `0,66` → `16` ; `0,64` → `14`.
 */
export function ecartEnPoints(taux: number): number {
  return Number.isFinite(taux) ? Math.abs(taux - 0.5) * 100 : Number.NaN;
}

/**
 * L'écart lève-t-il l'alerte ? **Strictement** au-delà de `ECART_ALERTE` : 16 points
 * lèvent l'alerte, 14 non (D-134 (2)) — c'est le contrôle qui mord de ce module.
 */
export function ecartAlerte(taux: number, seuil: number = ECART_ALERTE): boolean {
  const ecart = ecartEnPoints(taux);
  // Tolérance de 1e-9 point : `0,65 − 0,5` vaut `0,15000000000000002` en flottant, et
  // 15,0 points doit rester **assumé** (le dépassement est strict).
  return Number.isFinite(ecart) && ecart > seuil * 100 + 1e-9;
}

/** Une ligne de la table : un affrontement, avec son compte et son verdict. */
export interface LigneArchetype {
  a: Faction;
  b: Faction;
  /** Parties jouées sur cet affrontement (les deux sièges). */
  parties: number;
  victoiresA: number;
  victoiresB: number;
  nulles: number;
  /** Parties décidées : les nulles ne comptent ni pour ni contre. */
  decidees: number;
  /** Taux de victoire de `a` parmi les décidées. */
  tauxA: number;
  /** Intervalle de confiance à 95 % (Wilson) du taux de `a`. */
  intervalle: [number, number];
  /** Écart à l'équilibre, en points de pourcentage. */
  ecart: number;
  /** `true` quand l'écart dépasse 15 points : à corriger avant la beta. */
  alerte: boolean;
  /** `true` quand le taux sort de la bande 40–60 %. */
  horsBande: boolean;
}

/** L'agrégat d'un archétype sur **tous** ses affrontements. */
export interface ArchetypeAgrege {
  faction: Faction;
  parties: number;
  victoires: number;
  decidees: number;
  taux: number;
  intervalle: [number, number];
  horsBande: boolean;
}

/**
 * La **forme** du Deck d'un archétype (ticket #412).
 *
 * Un écart entre deux archétypes se lit d'abord ici : un Deck qui ne porte **aucun** N+2 n'a
 * pas de réponse à un COMEX à 180 de Seuil, quelle que soit la courbe de ses Pressions. La
 * table publiait le **résultat** sans publier le **Deck** ; ce bloc publie l'objet mesuré.
 */
export interface FormeDeck {
  faction: Faction;
  /** Cartes effectivement dans le Deck d'archétype (20 par construction). */
  cartes: number;
  entrants: number;
  n1: number;
  n2: number;
  /** Les COMEX du Deck : chacun vaut deux Interventions, donc le Deck en porte la menace. */
  comex: number;
  actions: number;
  /** Le plus haut Seuil du Deck : le plafond que l'archétype peut opposer. */
  seuilMax: number;
  /** Les noms distincts (Deck de 20 cartes, deux exemplaires par nom au plus). */
  noms: number;
  /** Les Pressions que le Deck porte (une par Pression de chaque carte). */
  pressions: number;
  /**
   * Les Pressions **payables** avec les types de café du Deck (D-037) : un symbole typé
   * exige un café de son type, l'incolore accepte tout. C'est la mesure qui a désigné
   * INTERIM en #412 — 12 sur 28, et le COMEX ne pouvait pas attaquer.
   */
  payables: number;
  /**
   * La composition du Deck, nom par nom (#417) : un lecteur voit ce qui s'affronte.
   * Dans l'ordre du Deck (Entrants, évolutions, Actions), une entrée par nom.
   */
  composition: LigneComposition[];
}

/** Une ligne de composition : un nom de carte, son stade (ou « Action »), ses exemplaires. */
export interface LigneComposition {
  nom: string;
  stade: string;
  exemplaires: number;
}

/** Une Pression est-elle payable avec ces types de café (D-037) ? */
export function pressionPayable(cost: readonly CafeSymbol[], types: readonly string[]): boolean {
  return cost.every((symbol) => symbol === 'INCOLORE' || types.includes(symbol));
}

export interface RapportArchetypes {
  graine: number;
  politique: Politique;
  partiesParPaire: number;
  maxTurns: number;
  /** Le plafond d'Entrants distincts par Deck dérivé (#417) ; `null` = sans plafond. */
  entrantsMax: number | null;
  bande: { bas: number; haut: number };
  /** Le seuil d'alerte, en points de pourcentage. */
  seuilAlerte: number;
  paires: LigneArchetype[];
  archetypes: ArchetypeAgrege[];
  /** La forme des Decks mesurés, dans l'ordre des factions (#412). */
  decks: FormeDeck[];
  /** Les affrontements à corriger avant la beta, du plus déséquilibré au moins. */
  alertes: LigneArchetype[];
}

/** La forme d'un Deck d'archétype, lue dans le catalogue (`CARD_BY_ID`). */
export function formeDeck(faction: Faction, deck: readonly string[]): FormeDeck {
  const planques: PlanqueCard[] = [];
  let actions = 0;
  const parNom = new Map<string, LigneComposition>();
  for (const id of deck) {
    const card = CARD_BY_ID.get(id);
    if (card && isPlanque(card)) planques.push(card);
    else actions += 1;
    const stade = card && isPlanque(card) ? (card.ex ? `${card.stage} · COMEX` : card.stage) : 'Action';
    const nom = card?.name ?? id;
    const ligne = parNom.get(nom);
    if (ligne) ligne.exemplaires += 1;
    else parNom.set(nom, { nom, stade, exemplaires: 1 });
  }
  const auStade = (stage: PlanqueCard['stage']) => planques.filter((card) => card.stage === stage).length;
  // Les types que la partie utilise réellement : la table explicite du harnais (#113)
  // quand l'archétype en a besoin, la dérivation du Deck sinon — exactement ce que
  // `mesurerArchetypes` passe à `createBattle`.
  const types = factionCafeTypes(faction) ?? deckCafeTypes(deck);
  const pressions = planques.flatMap((card) => card.attacks);
  return {
    faction,
    cartes: deck.length,
    entrants: auStade('ENTRANT'),
    n1: auStade('N+1'),
    n2: auStade('N+2'),
    comex: planques.filter((card) => card.ex === true).length,
    actions,
    seuilMax: planques.reduce((max, card) => Math.max(max, card.hp), 0),
    noms: new Set(deck).size,
    pressions: pressions.length,
    payables: pressions.filter((attack) => pressionPayable(attack.cost, types)).length,
    composition: [...parNom.values()]
  };
}

export interface OptionsMesureArchetypes {
  /** Parties par paire, **pair** (le miroir). Défaut : 40. */
  partiesParPaire?: number;
  graine?: number;
  maxTurns?: number;
  factions?: readonly Faction[];
  bande?: { bas: number; haut: number };
  seuilAlerte?: number;
  /**
   * Plafond d'Entrants distincts des Decks dérivés (#417). Défaut :
   * `ENTRANTS_MAX_DECK_DERIVE`. `Infinity` mesure l'ancien comportement, sans plafond.
   */
  entrantsMax?: OptionsDeckDerive['entrantsMax'];
}

/**
 * **La mesure** : chaque paire d'archétypes joue `partiesParPaire` parties en miroir, la
 * politique scriptée des deux côtés. Le résultat est une table, rien d'autre — aucune
 * correction de carte, aucun réglage (D-134).
 */
export function mesurerArchetypes(options: OptionsMesureArchetypes = {}): RapportArchetypes {
  const partiesParPaire = options.partiesParPaire ?? PARTIES_PAR_PAIRE;
  const graine = options.graine ?? GRAINE_MESURE_ARCHETYPES;
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const bande = options.bande ?? BANDE_ARCHETYPES;
  const seuilAlerte = options.seuilAlerte ?? ECART_ALERTE;

  if (!Number.isInteger(partiesParPaire) || partiesParPaire <= 0) {
    throw new Error(`Nombre de parties par paire invalide : ${partiesParPaire}. Il faut un entier ≥ 1.`);
  }
  if (partiesParPaire % 2 !== 0) {
    throw new Error(`Le miroir apparie les parties : le nombre par paire doit être pair, reçu ${partiesParPaire}.`);
  }
  if (!Number.isFinite(graine)) throw new Error(`Graine invalide : ${graine}.`);

  const factions = [...(options.factions?.length ? options.factions : FACTION_ORDER)];
  const decks = factionDecks(factions, { entrantsMax: options.entrantsMax });
  const paires = pairesArchetypes(factions);
  const master = { rng: seedRng(graine) };
  const lignes: LigneArchetype[] = [];

  for (const [a, b] of paires) {
    let victoiresA = 0;
    let victoiresB = 0;
    let nulles = 0;
    for (let index = 0; index < partiesParPaire; index += 1) {
      // Miroir : `a` au siège `player` la première moitié, au siège `ai` la seconde.
      const aEstJoueur = index % 2 === 0;
      const gameSeed = Math.floor(drawRandom(master) * 0x100000000) >>> 0;
      const { state } = jouerPartiePolitiques(
        decks.get(a) ?? [],
        decks.get(b) ?? [],
        gameSeed,
        {
          player: 'scripte',
          ai: 'scripte'
        },
        {
          maxTurns,
          cafeTypes: {
            playerCafeTypes: factionCafeTypes(aEstJoueur ? a : b),
            aiCafeTypes: factionCafeTypes(aEstJoueur ? b : a)
          }
        }
      );
      if (state.winner === null) nulles += 1;
      else if ((state.winner === 'player') === aEstJoueur) victoiresA += 1;
      else victoiresB += 1;
    }

    const decidees = victoiresA + victoiresB;
    const tauxA = decidees === 0 ? Number.NaN : victoiresA / decidees;
    lignes.push({
      a,
      b,
      parties: partiesParPaire,
      victoiresA,
      victoiresB,
      nulles,
      decidees,
      tauxA,
      intervalle: decidees === 0 ? [0, 0] : intervalleWilson(victoiresA, decidees),
      ecart: ecartEnPoints(tauxA),
      alerte: ecartAlerte(tauxA, seuilAlerte),
      horsBande: Number.isFinite(tauxA) && (tauxA < bande.bas || tauxA > bande.haut)
    });
  }

  const archetypes: ArchetypeAgrege[] = factions.map((faction) => {
    const jouees = lignes.filter((ligne) => ligne.a === faction || ligne.b === faction);
    let parties = 0;
    let victoires = 0;
    let decidees = 0;
    for (const ligne of jouees) {
      parties += ligne.parties;
      decidees += ligne.decidees;
      victoires += ligne.a === faction ? ligne.victoiresA : ligne.victoiresB;
    }
    const taux = decidees === 0 ? Number.NaN : victoires / decidees;
    return {
      faction,
      parties,
      victoires,
      decidees,
      taux,
      intervalle: decidees === 0 ? [0, 0] : intervalleWilson(victoires, decidees),
      horsBande: Number.isFinite(taux) && (taux < bande.bas || taux > bande.haut)
    };
  });

  return {
    graine,
    politique: 'scripte',
    partiesParPaire,
    maxTurns,
    entrantsMax: Number.isFinite(options.entrantsMax ?? ENTRANTS_MAX_DECK_DERIVE)
      ? (options.entrantsMax ?? ENTRANTS_MAX_DECK_DERIVE)
      : null,
    bande: { ...bande },
    seuilAlerte,
    paires: lignes,
    archetypes,
    decks: factions.map((faction) => formeDeck(faction, decks.get(faction) ?? [])),
    alertes: lignes.filter((ligne) => ligne.alerte).sort((x, y) => y.ecart - x.ecart || (x.a < y.a ? -1 : 1))
  };
}

/**
 * La table en **markdown**, telle qu'elle est publiée : c'est le script qui l'écrit, le
 * document de mesure la reçoit. Aucun chiffre n'est recopié à la main.
 */
export function formatTableArchetypes(rapport: RapportArchetypes): string {
  const pourcent = (v: number) => (Number.isFinite(v) ? `${(100 * v).toFixed(1)} %` : '—');
  const signe = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)} pts` : '—');

  const lignes = [
    '### Taux de victoire par archétype, tous affrontements',
    '',
    `Politique : ${rapport.politique} des deux côtés · ${rapport.partiesParPaire} parties par paire en miroir · graine ${rapport.graine}.`,
    '',
    `| Archétype | Parties | Victoires | Décidées | Taux | IC 95 % | Bande ${pourcent(rapport.bande.bas)} – ${pourcent(rapport.bande.haut)} |`,
    '|---|---:|---:|---:|---:|---|---|'
  ];
  for (const ligne of rapport.archetypes) {
    lignes.push(
      `| ${ligne.faction} | ${ligne.parties} | ${ligne.victoires} | ${ligne.decidees} | ${pourcent(ligne.taux)} | ` +
        `${pourcent(ligne.intervalle[0])} – ${pourcent(ligne.intervalle[1])} | ${ligne.horsBande ? '**hors bande**' : 'dans la bande'} |`
    );
  }

  lignes.push(
    '',
    '### La forme des Decks mesurés',
    '',
    'Un écart se lit d’abord ici : un Deck sans N+2 n’a pas de réponse à un COMEX de 180 de Seuil,',
    'et un Deck dont les Pressions ne sont pas payables par ses trois types de café (D-037) ne peut pas attaquer.',
    '',
    '| Archétype | Cartes | Entrants | N+1 | N+2 | COMEX | Actions | Noms | Seuil max | Pressions payables |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
  );
  for (const deck of rapport.decks) {
    lignes.push(
      `| ${deck.faction} | ${deck.cartes} | ${deck.entrants} | ${deck.n1} | ${deck.n2} | ${deck.comex} | ` +
        `${deck.actions} | ${deck.noms} | ${deck.seuilMax} | ${deck.payables} / ${deck.pressions} |`
    );
  }

  lignes.push(
    '',
    '### La composition des Decks mesurés',
    '',
    rapport.entrantsMax === null
      ? 'Sans plafond d’Entrants (#417 désactivé) : une faction de plus de dix Entrants remplit son Deck avant ses évolutions.'
      : `Plafond : ${rapport.entrantsMax} Entrants distincts au plus par Deck dérivé (#417) ; les Entrants gardés sont ceux dont la ligne d’évolution est la plus longue.`,
    '',
    '| Archétype | Composition (20 cartes : nom ×exemplaires (stade)) |',
    '|---|---|'
  );
  for (const deck of rapport.decks) {
    const texte = deck.composition.map((ligne) => `${ligne.nom} ×${ligne.exemplaires} (${ligne.stade})`).join(' ; ');
    lignes.push(`| ${deck.faction} | ${texte} |`);
  }

  lignes.push(
    '',
    '### Les affrontements, deux à deux',
    '',
    `| A | B | Parties | A gagne | B gagne | Nulles | Taux de A | IC 95 % | Écart | Verdict |`,
    '|---|---|---:|---:|---:|---:|---:|---|---:|---|'
  );
  for (const ligne of rapport.paires) {
    const verdict = ligne.alerte
      ? '**à corriger avant la beta**'
      : ligne.horsBande
        ? 'assumé (hors bande, sous 15 points)'
        : 'assumé';
    lignes.push(
      `| ${ligne.a} | ${ligne.b} | ${ligne.parties} | ${ligne.victoiresA} | ${ligne.victoiresB} | ${ligne.nulles} | ` +
        `${pourcent(ligne.tauxA)} | ${pourcent(ligne.intervalle[0])} – ${pourcent(ligne.intervalle[1])} | ` +
        `${signe(ligne.ecart)} | ${verdict} |`
    );
  }

  lignes.push('', `### Écarts de plus de ${signe(rapport.seuilAlerte * 100)}`, '');
  if (rapport.alertes.length === 0) {
    lignes.push(`Aucun : tous les affrontements sont à ${signe(rapport.seuilAlerte * 100)} ou moins de l'équilibre.`);
  } else {
    for (const ligne of rapport.alertes) {
      lignes.push(
        `- **${ligne.a} / ${ligne.b}** — ${signe(ligne.ecart)} d'écart (${ligne.victoiresA}–${ligne.victoiresB}, ` +
          `${ligne.nulles} nulle(s)) : à corriger avant la beta.`
      );
    }
  }
  return lignes.join('\n');
}
