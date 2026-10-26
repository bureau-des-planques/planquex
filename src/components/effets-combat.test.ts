import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isBasic, isPlanque } from '@/data';
import type { BattleState } from '@/data/types';
import { createBattle } from '@/game/engine';
import {
  ajouterEffet,
  DUREE_MAX_MS,
  DUREE_STRESS_MS,
  effetsEntre,
  fusionnerEffets,
  MAX_EFFETS_SIMULTANES,
  MAX_TOURS_BOUCLE
} from './effets-combat';
import type { EffetCombat } from './effets-combat';

/** Un deck légal : deux exemplaires de dix Entrants, commençant par un Entrant. */
function deckDeTest(): string[] {
  const entrants = ALL_CARDS.filter((card) => isPlanque(card) && isBasic(card) && !card.variantOf).slice(0, 10);
  return entrants.flatMap((card) => [card.id, card.id]);
}

function partie(): BattleState {
  return createBattle(deckDeTest(), deckDeTest(), 42);
}

const css = () => readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

const effet = (id: number): EffetCombat => ({
  id,
  nature: 'stress',
  duree: DUREE_STRESS_MS,
  anime: true,
  valeur: 10
});

describe('effets-combat — ce qui vient de changer (#192)', () => {
  it('le Stress qui monte se lit sur la carte touchée, avec sa valeur', () => {
    const avant = partie();
    const apres = structuredClone(avant);
    apres.players.ai.active!.hp -= 30;

    const effets = effetsEntre(avant, apres);
    const stress = effets.find((e) => e.nature === 'stress' && e.camp === 'ai');

    expect(stress?.valeur).toBe(30);
    expect(stress?.duree).toBeLessThanOrEqual(DUREE_MAX_MS);
    expect(stress?.uid).toBe(avant.players.ai.active!.uid);
    expect(stress?.anime).toBe(true);
  });

  it('le craquage se reconnaît à la carte qui quitte le jeu pour le Rebut, et garde son dernier état', () => {
    const avant = partie();
    const apres = structuredClone(avant);
    const tombee = apres.players.ai.active!;
    const hpRestant = tombee.hp;
    tombee.hp = 0;
    apres.players.ai.active = null;
    apres.players.ai.discard.push(tombee);
    apres.players.player.points += 1;

    const effets = effetsEntre(avant, apres);
    const craquage = effets.find((e) => e.nature === 'craquage');

    expect(craquage?.camp).toBe('ai');
    expect(craquage?.carte?.uid).toBe(tombee.uid);
    expect(craquage?.auPoste).toBe(true);
    // Le Stress s'est monté jusqu'au Seuil : c'est ce que le chiffre dit, pas les 30 de l'exemple.
    expect(effets.find((e) => e.nature === 'stress')?.valeur).toBe(hpRestant);
    expect(effets.filter((e) => e.nature === 'intervention').map((e) => e.numero)).toEqual([1]);
  });

  it('la pioche s’allume sur le Deck du camp qui a pioché', () => {
    const avant = partie();
    const apres = structuredClone(avant);
    apres.players.player.deck.pop();

    const pioche = effetsEntre(avant, apres).find((e) => e.nature === 'pioche');
    expect(pioche?.camp).toBe('player');
    expect(pioche?.duree).toBeLessThanOrEqual(DUREE_MAX_MS);
  });

  it('un COMEX qui vaut deux Interventions remplit deux hexagones', () => {
    const avant = partie();
    const apres = structuredClone(avant);
    const depart = avant.players.ai.points;
    apres.players.ai.points = depart + 2;

    const numeros = effetsEntre(avant, apres)
      .filter((e) => e.nature === 'intervention')
      .map((e) => e.numero);
    expect(numeros).toEqual([depart + 1, depart + 2]);
  });

  it('un second coup sur la même carte remplace son chiffre, il ne l’empile pas', () => {
    const premier = { ...effet(1), valeur: 10 };
    const second = { ...effet(2), valeur: 20 };
    const troisieme = { ...effet(3), valeur: 30 };

    let courants = fusionnerEffets([], [premier]);
    courants = fusionnerEffets(courants, [second]);
    courants = fusionnerEffets(courants, [troisieme]);

    expect(courants).toHaveLength(1);
    expect(courants[0].valeur).toBe(30);
  });

  // **La Pression en quatre temps** (#207) : le trait part d'une action `attack`, et il porte
  // les deux uid — sans eux, un second coup sur une autre carte ne pourrait pas avoir « sa »
  // séquence distincte.
  it('une attaque journalisée devient le trait, avec l’attaquant et sa cible', () => {
    const avant = partie();
    const apres = structuredClone(avant);
    // Une entrée porte son action **et** ses faits (#250) : c'est le fait qui dit que la
    // Pression est partie et quel Stress elle a porté.
    apres.actionLog = [
      ...avant.actionLog,
      {
        action: { type: 'attack', attackIndex: 0 },
        faits: [{ type: 'stress', uid: avant.players.ai.active!.uid, montant: 20, auPoste: true }]
      }
    ];
    const effets = effetsEntre(avant, apres);
    const attaque = effets.find((effet) => effet.nature === 'attaque');
    expect(attaque).toBeDefined();
    expect(attaque?.duree).toBeLessThanOrEqual(DUREE_MAX_MS);
    // La séquence entière : l'impact (550 + 150 ms) doit tenir dans la durée de l'effet.
    expect(attaque?.duree).toBeGreaterThanOrEqual(700);
    // L'attaquant est le camp au trait avant le coup (ici `player`), la cible le Poste d'en face.
    expect(attaque?.uid).toBe(avant.players.player.active?.uid);
    expect(attaque?.uidCible).toBe(avant.players.ai.active?.uid);
  });

  // **La Dérive ratée** (D-033 §3) : le moteur journalise quand même l'action `attack` — le tour
  // est consommé — mais la Pression n'est pas lancée. Sans ce filtre, la scène jouerait un coup
  // qui n'a pas eu lieu (D-098).
  it('une Dérive ratée n’émet aucune Pression, et le contrôle mord', () => {
    const avant = partie();
    const apres = structuredClone(avant);
    // La Dérive ratée : l'action est journalisée (le tour est consommé) mais son **fait**
    // dit que la Pression n'est pas partie. Plus une phrase à relire.
    apres.actionLog = [
      ...avant.actionLog,
      {
        action: { type: 'attack', attackIndex: 0 },
        faits: [{ type: 'pressionRatee', uid: avant.players.player.active!.uid, cause: 'derive' }]
      }
    ];
    expect(effetsEntre(avant, apres).some((effet) => effet.nature === 'attaque')).toBe(false);

    // Le cas fautif, pour que le contrôle puisse échouer : la même action **sans** la ligne de
    // Dérive émet bien la Pression.
    const reussie = structuredClone(avant);
    reussie.actionLog = [
      ...avant.actionLog,
      {
        action: { type: 'attack', attackIndex: 0 },
        faits: [{ type: 'stress', uid: avant.players.ai.active!.uid, montant: 20, auPoste: true }]
      }
    ];
    expect(effetsEntre(avant, reussie).some((effet) => effet.nature === 'attaque')).toBe(true);
  });

  it('une attaque sur une autre paire a sa propre séquence ; la même paire est remplacée', () => {
    const a = {
      id: 1,
      nature: 'attaque' as const,
      duree: 350,
      anime: true,
      camp: 'player' as const,
      uid: 'x',
      uidCible: 'y'
    };
    const b = { ...a, id: 2, uidCible: 'z' };
    const c = { ...a, id: 3 };
    expect(fusionnerEffets([a], [b])).toHaveLength(2);
    const fusion = fusionnerEffets([a, b], [c]);
    expect(fusion).toHaveLength(2);
    expect(fusion.some((effet) => effet.uidCible === 'z')).toBe(true);
  });

  it('une Condition qui apparaît devient l’après (le badge naît), sous le plafond', () => {
    const avant = partie();
    const apres = structuredClone(avant);
    const cible = apres.players.player.active!;
    cible.statuses = [...cible.statuses, 'SURCHARGE'] as never;
    const effets = effetsEntre(avant, apres);
    const condition = effets.find((effet) => effet.nature === 'condition');
    expect(condition).toBeDefined();
    expect(condition?.uid).toBe(cible.uid);
    expect(condition?.duree).toBeLessThanOrEqual(DUREE_MAX_MS);
  });

  it('refuse la cinquième demande : quatre éléments animés au plus', () => {
    let courants: EffetCombat[] = [];
    for (let index = 0; index < MAX_EFFETS_SIMULTANES; index += 1) {
      courants = ajouterEffet(courants, effet(index));
    }
    expect(courants).toHaveLength(MAX_EFFETS_SIMULTANES);

    const refuse = ajouterEffet(courants, effet(99));
    expect(refuse).toBe(courants);
    expect(refuse).toHaveLength(MAX_EFFETS_SIMULTANES);
  });
});

/**
 * Les bornes de `SPEC-COMBAT-UI` §6.8, vérifiées sur **la feuille servie** : aucune
 * `animation` de plus de 800 ms, aucune boucle de plus de deux tours, aucun flou en
 * mouvement. C'est cette garde que `scripts/garde-fous.mjs` mute (#192).
 */
describe('styles.css — les bornes des effets (#192, SPEC-COMBAT-UI §6.8)', () => {
  const animations = () =>
    [...css().matchAll(/animation:\s*([^;]+);/g)]
      .map((declaration) => declaration[1].trim())
      .filter((declaration) => declaration !== 'none' && !declaration.includes('none'));

  it('aucune animation ne dure plus de 800 ms', () => {
    for (const declaration of animations()) {
      const durees = [...declaration.matchAll(/(\d+)ms/g)].map((duree) => Number(duree[1]));
      expect(durees.length, declaration).toBeGreaterThan(0);
      expect(Math.max(...durees), declaration).toBeLessThanOrEqual(DUREE_MAX_MS);
    }
  });

  it('aucune animation ne boucle plus de deux fois', () => {
    for (const declaration of animations()) {
      const iterations = [...declaration.matchAll(/(?:^|\s)(\d+)(?=\s|;|$)/g)].map((nombre) => Number(nombre[1]));
      expect(Math.max(0, ...iterations), declaration).toBeLessThanOrEqual(MAX_TOURS_BOUCLE);
    }
  });

  it('aucun flou en mouvement, aucun backdrop-filter sur une surface animée', () => {
    for (const bloc of css().matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?)\n\}/g)) {
      expect(bloc[1]).not.toMatch(/blur\(|backdrop-filter/);
    }
    for (const selecteur of ['.stress-flottant', '.craquage__train', '.craquage__carte', '.piste__hex.is-fraiche']) {
      const regle = css().match(new RegExp(`\\${selecteur}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(regle).not.toMatch(/blur\(|backdrop-filter/);
    }
  });

  it('le store « Mouvement réduit » coupe les quatre effets, sans cacher leur information', () => {
    const feuille = css();
    // Le réglage est relié : le CSS lit l'attribut posé par `App`.
    expect(feuille).toMatch(/:root\[data-mouvement-reduit='true'\] \*/);
    // Le chiffre est figé, pas éteint : une durée de 0,001 ms le rendrait invisible (opacité finale).
    expect(feuille).toMatch(
      /:root\[data-mouvement-reduit='true'\] \.stress-flottant[\s\S]*?animation:\s*none !important/
    );
    expect(feuille).toMatch(/\.stress-flottant\.is-fixe\s*\{[^}]*animation:\s*none/);
    // L'hexagone et la pile gardent leur état (rempli / allumé), sans pulsation.
    expect(feuille).toMatch(
      /:root\[data-mouvement-reduit='true'\] \.piste__hex\.is-fraiche[\s\S]*?animation:\s*none !important/
    );
    expect(feuille).toMatch(
      /:root\[data-mouvement-reduit='true'\] \.pile--deck\.is-piochante::after[\s\S]*?animation:\s*none !important/
    );
    // Le craquage garde la désaturation ; la traînée, elle, n'est pas créée (`Battle.tsx`).
    expect(feuille).toMatch(
      /:root\[data-mouvement-reduit='true'\] \.craquage__carte[\s\S]*?animation:\s*none !important/
    );
  });
});
