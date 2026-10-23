/**
 * **La trace d'un combat** — #173, D-086.
 *
 * À la fin d'une partie **solo** terminée, le jeu dépose en arrière-plan de quoi la
 * **rejouer** : la graine, les deux Decks, les types de café et le journal d'actions.
 * C'est exactement le contrat de `replayBattle` (#83) — la ligne ne porte donc **rien
 * d'autre** : ni le pseudo de Réglages, ni un texte libre, ni un identifiant d'appareil.
 * `auteur` est rempli par la base (`auth.uid()`, une identité anonyme, D-059).
 *
 * **Ce module ne bloque jamais le jeu.** `envoyerCombat` rend toujours un résultat, ne lève
 * jamais : sans configuration (`configurerMur()` → `null`), rien n'est envoyé ; une erreur
 * réseau est avalée. La partie n'a jamais dépendu de l'envoi — elle vit dans le store
 * (`@/store/partie`), et une trace perdue ne coûte qu'une trace.
 *
 * **Pur** : aucun React, aucun DOM. L'écran (`Battle.tsx`) appelle `combatTermine` puis
 * `envoyerCombat` ; les dépendances réseau sont injectables, ce qui rend les gardes
 * possibles sans backend (`combats.test.ts`).
 */
import type { BattleAction, BattleState, CafeType } from '@/data/types';
import { configurerMur, ecrireLigne } from '@/lib/supabase';
import type { ConfigurationMur } from '@/lib/supabase';
import type { Decks } from '@/store/partie';
import type { Match } from '@/store/pvp';

/**
 * Ce qu'une partie solo terminée laisse derrière elle : de quoi la rejouer, et rien de plus.
 * Les noms sont ceux du code du jeu (`graine`, `decks`, `typesCafe`, `journal`) ; la ligne
 * envoyée les traduit en colonnes (`ligneDe`).
 */
export interface CombatEnregistre {
  mode: 'solo';
  graine: number;
  decks: Decks;
  typesCafe: {
    playerCafeTypes: CafeType[];
    aiCafeTypes: CafeType[];
  };
  journal: BattleAction[];
}

/**
 * La ligne telle qu'elle part, colonne pour colonne (`public.combats`, `0002_combats.sql`).
 * **Cinq clés, et c'est tout** : `auteur` et `created_at` sont posés par la base.
 *
 * Type alias et non interface : un alias d'objet accepte l'affectation à
 * `Record<string, unknown>`, ce dont `ecrireLigne` a besoin.
 */
export type LigneCombat = {
  mode: 'solo';
  graine: number;
  decks: Decks;
  types_cafe: {
    playerCafeTypes: CafeType[];
    aiCafeTypes: CafeType[];
  };
  journal: BattleAction[];
};

/**
 * Le combat à garder, ou `null` si la partie ne se garde pas : **pas terminée**, ou **à
 * deux** (le PvP attend la beta, #173). Chaque champ est **recopié à la main** : un objet
 * d'état qui porterait un pseudo ou un texte libre ne peut pas fuir par un `...state`.
 */
export function combatTermine(
  state: BattleState,
  match: Match | null,
  decksSolo: Decks
): CombatEnregistre | null {
  if (match !== null) return null;
  if (state.phase !== 'ended') return null;

  return {
    mode: 'solo',
    graine: state.seed,
    decks: {
      playerDeck: [...decksSolo.playerDeck],
      aiDeck: [...decksSolo.aiDeck]
    },
    typesCafe: {
      playerCafeTypes: [...state.players.player.cafeTypes],
      aiCafeTypes: [...state.players.ai.cafeTypes]
    },
    journal: state.actionLog.map((action) => structuredClone(action))
  };
}

/** La ligne à envoyer : les cinq colonnes, et rien d'autre. */
export function ligneDe(combat: CombatEnregistre): LigneCombat {
  return {
    mode: combat.mode,
    graine: combat.graine,
    decks: {
      playerDeck: [...combat.decks.playerDeck],
      aiDeck: [...combat.decks.aiDeck]
    },
    types_cafe: {
      playerCafeTypes: [...combat.typesCafe.playerCafeTypes],
      aiCafeTypes: [...combat.typesCafe.aiCafeTypes]
    },
    journal: combat.journal.map((action) => structuredClone(action))
  };
}

/** Ce que l'envoi a donné : `envoye: false` avec une raison, jamais une exception. */
export interface ResultatEnvoi {
  envoye: boolean;
  raison?: string;
}

/**
 * Les deux dépendances de l'envoi, injectables. La **configuration** est lue avant tout
 * contact : `null` (alpha sans backend) veut dire « ne touche à rien ».
 */
export interface DependancesEnvoi {
  configuration: () => ConfigurationMur | null;
  ecrire: (ligne: LigneCombat) => Promise<{ erreur: string | null }>;
}

/** Les dépendances réelles : la configuration Vite et l'écriture Supabase. */
const DEPENDANCES: DependancesEnvoi = {
  configuration: () => configurerMur(),
  ecrire: (ligne) => ecrireLigne('combats', ligne)
};

/**
 * Dépose un combat, **en silence**. Ne lève jamais et ne rejette jamais : le jeu ne peut pas
 * perdre une fin de partie parce que le réseau est tombé (D-086, #173).
 */
export async function envoyerCombat(
  combat: CombatEnregistre,
  dependances: DependancesEnvoi = DEPENDANCES
): Promise<ResultatEnvoi> {
  try {
    // Une configuration incomplète lève à la lecture : c'est aussi un échec silencieux.
    if (dependances.configuration() === null) {
      return { envoye: false, raison: 'Supabase n’est pas configuré.' };
    }
    const { erreur } = await dependances.ecrire(ligneDe(combat));
    return erreur === null ? { envoye: true } : { envoye: false, raison: erreur };
  } catch (error) {
    return { envoye: false, raison: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Le **seul chemin qu'un écran doit prendre** : déposer, et **avaler** le rejet. La promesse
 * rendue résout toujours, donc `void tracerCombat(combat)` ne laisse jamais un rejet non
 * traité derrière lui — même si `envoyerCombat` régressait un jour.
 *
 * `envoyer` est un paramètre pour que la garde le fasse **mordre** : un `envoyer` qui rejette
 * doit ressortir en `{ envoye: false }`, pas en exception (`combats.test.ts`).
 */
export function tracerCombat(
  combat: CombatEnregistre,
  envoyer: (combat: CombatEnregistre) => Promise<ResultatEnvoi> = envoyerCombat
): Promise<ResultatEnvoi> {
  return envoyer(combat).catch((error) => ({
    envoye: false,
    raison: error instanceof Error ? error.message : String(error)
  }));
}
