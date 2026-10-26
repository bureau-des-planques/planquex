import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard, isBasic, isPlanque } from '@/data';
import { attack, createBattle, endTurn } from '@/game/engine';
import { drawRandom, flipStamp, seedRng } from '@/game/rng';
import type { BattleState, Status } from '@/data/types';

/**
 * Ticket #82 — **un seul lancer de tampon, `face` = succès**.
 *
 * Vocabulaire `AGENTS.md` §3.1 : **Lancer de tampon** — `pile` = **tampon**,
 * `face` = **agrafe**. Source `docs/preuves/astuces-2026-10-20/README.md` §`07` :
 * « Si c'est **face**, le Pokémon est **guéri** » (Épuisement, Sieste) et
 * « Si c'est **face**, l'attaque fonctionne normalement » (Dérive).
 *
 * Avant #82, chaque statut réécrivait son propre seuil (`drawRandom(...) < 0.5`) et
 * la Dérive avait le sens inverse des autres : `face` signifie désormais **succès**
 * partout, porté par `flipStamp`.
 */

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

describe('flipStamp — un lancer de tampon, un seul tirage (#82)', () => {
  it('donne les deux côtés selon l’état du générateur', () => {
    // `stepRng(0).value = 0.266` (< 0.5) → agrafe ; `stepRng(1) = 0.627` (≥ 0.5) → tampon.
    expect(flipStamp({ rng: 0 })).toBe('face');
    expect(flipStamp({ rng: 1 })).toBe('pile');
  });

  it('consomme exactement un tirage de drawRandom', () => {
    const stamped = { rng: 42 };
    const drawn = { rng: 42 };
    flipStamp(stamped);
    drawRandom(drawn);
    expect(stamped.rng).toBe(drawn.rng);
  });

  it('est déterministe : même état, même côté', () => {
    expect(flipStamp({ rng: 7 })).toBe(flipStamp({ rng: 7 }));
    // `stepRng(7).value = 0.0117` : ce cas fixe est bien une agrafe.
    expect(flipStamp({ rng: 7 })).toBe('face');
  });

  it('couvre bien les deux côtés sur une série de tirages', () => {
    const holder = { rng: seedRng(9) };
    const sides = new Set(Array.from({ length: 200 }, () => flipStamp(holder)));
    expect(sides).toEqual(new Set(['face', 'pile']));
  });
});

/**
 * Un Poste solide portant un seul statut, prêt pour un Contrôle de fin de tour.
 * `rng` fixe explicitement le tirage du lancer de tampon : `0` → agrafe, `1` → tampon.
 */
function battleWith(status: Status, rng: number): BattleState {
  const state = createBattle(DECK, DECK, 1);
  state.turn = 3;
  state.current = 'player';
  state.pendingPromotion = null;
  state.players.player.hasAttacked = false;
  const mine = state.players.player.active;
  const foe = state.players.ai.active;
  if (!mine || !foe) throw new Error('Poste vide');
  for (const active of [mine, foe]) {
    active.maxHp = 500;
    active.hp = 500;
    active.statuses = [];
  }
  mine.statuses = [status];
  state.rng = rng;
  return state;
}

/** Un tour du joueur sous Dérive, avec de quoi payer n'importe quelle Pression. */
function battleForDerive(rng: number): BattleState {
  const state = battleWith('DERIVE', rng);
  const mine = state.players.player.active;
  if (!mine) throw new Error('Poste vide');
  const mineCard = getCard(mine.cardId);
  if (!isPlanque(mineCard)) throw new Error('Carte inconnue');
  // Un superset des coûts **typés** (D-037) : la Dérive, pas le café, décide ici.
  mine.energy = mineCard.attacks.flatMap((entry) => entry.cost);
  return state;
}

describe('Épuisement — face guérit, pile persiste (capture 07, #82)', () => {
  it('face : le statut tombe et le journal dit « agrafe »', () => {
    const after = endTurn(battleWith('EPUISEMENT', 0));

    expect(after.players.player.active?.statuses).not.toContain('EPUISEMENT');
    expect(after.log.join(' ')).toContain('Épuisement guéri : agrafe (ton Poste).');
  });

  it('pile : le statut reste, aucun « guéri » au journal', () => {
    const after = endTurn(battleWith('EPUISEMENT', 1));

    expect(after.players.player.active?.statuses).toContain('EPUISEMENT');
    expect(after.log.join(' ')).not.toContain('guéri');
  });
});

describe('Sieste — face guérit, pile reste endormi (capture 07, #82)', () => {
  it('face : le statut tombe et le journal dit « agrafe »', () => {
    const after = endTurn(battleWith('SIESTE', 0));

    expect(after.players.player.active?.statuses).not.toContain('SIESTE');
    expect(after.log.join(' ')).toContain('Sieste guérie : agrafe (ton Poste).');
  });

  it('pile : le statut reste et le journal dit « tampon »', () => {
    const after = endTurn(battleWith('SIESTE', 1));

    expect(after.players.player.active?.statuses).toContain('SIESTE');
    expect(after.log.join(' ')).toContain('Sieste : tampon, toujours endormi (ton Poste).');
  });
});

describe('Dérive — face laisse partir la Pression, pile l’annule (capture 07, #82)', () => {
  it('face : la Pression part normalement', () => {
    const after = attack(battleForDerive(0), 0);

    const foe = after.players.ai.active;
    if (!foe) throw new Error('Poste vide');
    expect(foe.hp).toBeLessThan(500);
    expect(after.log.join(' ')).not.toContain('Pression n’est pas lancée');
  });

  it('pile : la Pression n’est pas lancée et le tour est consommé', () => {
    const after = attack(battleForDerive(1), 0);

    expect(after.players.ai.active?.hp).toBe(500);
    expect(after.players.player.hasAttacked).toBe(true);
    expect(after.log.join(' ')).toContain('Dérive : tampon, la Pression n’est pas lancée, le tour prend fin.');
  });
});

/**
 * Garde-fou : plus aucun lancer de statut réécrit à la main. Un `drawRandom(...) < 0.5`
 * dans `engine.ts` est l'ancien « lancer de tampon » local que #82 a supprimé.
 *
 * Tolérance pour #81 (tirage du **premier joueur** dans `createBattle`, en parallèle) :
 * toute ligne qui nomme « premier joueur » est ignorée, commentée ou non.
 */
describe('Garde-fou — plus de lancer de statut écrit à la main (#82)', () => {
  const source = readFileSync(fileURLToPath(new URL('./engine.ts', import.meta.url)), 'utf8');

  it('aucun `drawRandom(...) < 0.5` hors fonction de lancer et hors premier joueur', () => {
    const offenders = source
      .split('\n')
      .filter((line) => !/premier joueur/i.test(line))
      .map((line) => line.replace(/\/\/.*$/, ''))
      .filter((line) => /drawRandom\([^)]*\)\s*<\s*0\.5/.test(line));

    expect(offenders).toEqual([]);
  });

  it('les statuts à lancer passent bien par `flipStamp`', () => {
    // Deux lancers au Contrôle (Épuisement, Sieste) + un à la Dérive = trois appels.
    expect(source.match(/flipStamp\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
