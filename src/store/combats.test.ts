import { describe, expect, it, vi } from 'vitest';
import type { BattleState } from '@/data/types';
import { applyAction, createBattle, legalActions, replayBattle } from '@/game/engine';
import { factionDeck } from '@/game/simulation';
import {
  combatTermine,
  envoyerCombat,
  ligneDe,
  tracerCombat,
  type DependancesEnvoi
} from '@/store/combats';
import type { Decks } from '@/store/partie';
import type { Match } from '@/store/pvp';

/**
 * **La trace des combats** — #173, D-086.
 *
 * Quatre choses sont gardées ici, et chacune peut réellement échouer :
 *
 * 1. **ce qui part est ce qui se rejoue** : la ligne ne porte que la graine, les deux Decks,
 *    les types de café et le journal, et `replayBattle` redonne l'état final **à l'identique** ;
 * 2. **le pseudo et le texte libre ne partent jamais** : un état qui en porterait ne les
 *    laisse pas entrer dans la ligne (chaque champ est recopié à la main) ;
 * 3. **sans configuration, aucun envoi** : `configurerMur()` rend `null`, l'écriture n'est
 *    même pas appelée ;
 * 4. **une erreur réseau ne casse rien** : `envoyerCombat` ne rejette jamais, même quand
 *    l'écriture lève.
 */

/** Un combat solo qui a réellement agi, puis se termine au forfait (journal non vide). */
function combatSolo(seed = 42): { state: BattleState; decks: Decks } {
  const decks: Decks = {
    playerDeck: factionDeck('SSE'),
    aiDeck: factionDeck('MANAGEMENT')
  };
  let state = createBattle(decks.playerDeck, decks.aiDeck, seed);
  for (let i = 0; i < 12; i += 1) {
    const action = legalActions(state).find((candidate) => candidate.type !== 'forfeit');
    if (!action) break;
    state = applyAction(state, action);
  }
  state = applyAction(state, { type: 'forfeit', who: 'player' });
  expect(state.phase).toBe('ended');
  expect(state.actionLog.length).toBeGreaterThan(0);
  return { state, decks };
}

/** Les dépendances d'un envoi de test : une configuration, une écriture espionnée. */
function dependances(ecrire: DependancesEnvoi['ecrire']): DependancesEnvoi {
  return {
    configuration: () => ({ url: 'https://exemple.supabase.co', clePublique: 'sb_publishable_fausse' }),
    ecrire
  };
}

describe('combatTermine — ce qui est gardé, et rien d’autre (#173, D-086)', () => {
  it('garde une partie solo terminée : graine, Decks, types de café, journal', () => {
    const { state, decks } = combatSolo();
    const combat = combatTermine(state, null, decks);

    expect(combat).not.toBeNull();
    expect(combat?.mode).toBe('solo');
    expect(combat?.graine).toBe(state.seed);
    expect(combat?.decks).toEqual(decks);
    expect(combat?.typesCafe).toEqual({
      playerCafeTypes: state.players.player.cafeTypes,
      aiCafeTypes: state.players.ai.cafeTypes
    });
    expect(combat?.journal).toEqual(state.actionLog);
  });

  it('ne garde pas une partie en cours', () => {
    const { decks } = combatSolo();
    const enCours = createBattle(decks.playerDeck, decks.aiDeck, 7);
    expect(enCours.phase).toBe('playing');
    expect(combatTermine(enCours, null, decks)).toBeNull();
  });

  it('ne garde pas une partie à deux : le PvP attend la beta', () => {
    const { state, decks } = combatSolo();
    const match: Match = { camp: 'player', ...decks };
    expect(combatTermine(state, match, decks)).toBeNull();
  });

  it('la ligne porte cinq clés, et aucune autre', () => {
    const { state, decks } = combatSolo();
    const ligne = ligneDe(combatTermine(state, null, decks)!);
    expect(Object.keys(ligne).sort()).toEqual(['decks', 'graine', 'journal', 'mode', 'types_cafe']);
  });

  it('le pseudo et un texte libre ne peuvent pas entrer dans la ligne', () => {
    const { state, decks } = combatSolo();
    // Un état qui porterait malgré tout un nom et un commentaire : la recopie champ par
    // champ les laisse dehors. Un `...state` les ferait partir, et ce test rougirait.
    const contamine = { ...state, pseudo: 'Employé 404', note: 'Il triche au tour 3.' } as BattleState;

    // Deux barrières, et les deux sont contrôlées : ce que `combatTermine` garde, puis ce
    // que `ligneDe` envoie.
    const combat = combatTermine(contamine, null, decks)!;
    const texte = JSON.stringify(combat);
    expect(texte).not.toContain('Employé 404');
    expect(texte).not.toContain('Il triche');
    expect(texte).not.toContain('pseudo');
    expect(texte).not.toContain('note');

    const ligne = JSON.stringify(ligneDe(combat));
    expect(ligne).not.toContain('Employé 404');
    expect(ligne).not.toContain('Il triche');
  });

  it('le rejeu de la ligne redonne exactement l’état final (critère du ticket)', () => {
    const { state, decks } = combatSolo();
    const combat = combatTermine(state, null, decks)!;

    const rejoue = replayBattle(
      combat.decks.playerDeck,
      combat.decks.aiDeck,
      combat.graine,
      combat.journal,
      combat.typesCafe
    );
    expect(rejoue).toEqual(state);
  });
});

describe('envoyerCombat — silencieux, et jamais bloquant (#173)', () => {
  it('sans configuration, rien n’est envoyé', async () => {
    const { state, decks } = combatSolo();
    const combat = combatTermine(state, null, decks)!;
    const ecrire = vi.fn(async () => ({ erreur: null }));

    const resultat = await envoyerCombat(combat, {
      configuration: () => null,
      ecrire
    });

    expect(ecrire).not.toHaveBeenCalled();
    expect(resultat.envoye).toBe(false);
  });

  it('avec configuration, la ligne passe par l’écriture — et elle ne contient rien d’autre', async () => {
    const { state, decks } = combatSolo();
    const combat = combatTermine(state, null, decks)!;
    const vues: unknown[] = [];

    const resultat = await envoyerCombat(
      combat,
      dependances(async (ligne) => {
        vues.push(ligne);
        return { erreur: null };
      })
    );

    expect(resultat).toEqual({ envoye: true });
    expect(vues).toHaveLength(1);
    expect(vues[0]).toEqual(ligneDe(combat));
  });

  it('une erreur réseau ne rejette pas et rend une raison', async () => {
    const { state, decks } = combatSolo();
    const combat = combatTermine(state, null, decks)!;

    const resultat = await envoyerCombat(
      combat,
      dependances(async () => {
        throw new Error('Failed to fetch');
      })
    );

    expect(resultat.envoye).toBe(false);
    expect(resultat.raison).toMatch(/Failed to fetch/);
  });

  it('une erreur rendue par la base est une raison, pas une exception', async () => {
    const { state, decks } = combatSolo();
    const combat = combatTermine(state, null, decks)!;

    const resultat = await envoyerCombat(
      combat,
      dependances(async () => ({ erreur: 'new row violates row-level security policy' }))
    );

    expect(resultat).toEqual({ envoye: false, raison: 'new row violates row-level security policy' });
  });

  it('tracerCombat avale un rejet : la ceinture de l’écran', async () => {
    const { state, decks } = combatSolo();
    const combat = combatTermine(state, null, decks)!;

    // Un `envoyer` qui rejette (régression de `envoyerCombat`, ou panne inattendue) doit
    // ressortir en résultat, jamais en promesse rejetée : un effet d'écran ne peut pas
    // laisser un rejet non traité derrière lui.
    await expect(
      tracerCombat(combat, async () => {
        throw new Error('réseau coupé');
      })
    ).resolves.toEqual({ envoye: false, raison: 'réseau coupé' });
  });

  it('une configuration à moitié posée est avalée elle aussi', async () => {
    const { state, decks } = combatSolo();
    const combat = combatTermine(state, null, decks)!;
    const ecrire = vi.fn(async () => ({ erreur: null }));

    const resultat = await envoyerCombat(combat, {
      configuration: () => {
        throw new Error('Configuration Supabase incomplète');
      },
      ecrire
    });

    expect(resultat.envoye).toBe(false);
    expect(ecrire).not.toHaveBeenCalled();
  });
});

describe('le volume d’une trace (#173 : « sur 20 combats simulés »)', () => {
  /**
   * Le ticket demande un chiffre, pas une impression. Un combat enregistré est une **petite**
   * donnée (graine + deux Decks + types de café + journal) : la borne large ci-dessous n'est
   * pas le sujet — elle attrape une dérive (un champ d'état qui partirait en entier, par
   * exemple), et la valeur mesurée est écrite dans le commentaire de fermeture du ticket.
   */
  it('mesure la taille d’une ligne de combat sur 20 graines', () => {
    const tailles: number[] = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      const { state, decks } = combatSolo(seed);
      const ligne = ligneDe(combatTermine(state, null, decks)!);
      tailles.push(new TextEncoder().encode(JSON.stringify(ligne)).length);
    }
    const moyenne = Math.round(tailles.reduce((a, b) => a + b, 0) / tailles.length);
    const max = Math.max(...tailles);
    console.log(
      `[#173] combat enregistré : moyenne ${moyenne} o, max ${max} o, sur ${tailles.length} combats`
    );

    expect(moyenne).toBeGreaterThan(0);
    expect(max).toBeLessThan(64 * 1024);
  });
});
