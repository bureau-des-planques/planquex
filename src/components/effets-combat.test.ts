import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isBasic, isPlanque } from '@/data';
import type { BattleState } from '@/data/types';
import { createBattle } from '@/game/engine';
import {
  ajouterEffet,
  DELAI_IMPACT_MS,
  dureeDeLEffet,
  DUREE_CONDITION_APRES_COUP_MS,
  DUREE_CONDITION_MS,
  DUREE_MAX_MS,
  DUREE_PIOCHE_MS,
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
    expect(dureeDeLEffet(stress!)).toBe(DUREE_STRESS_MS);
    expect(dureeDeLEffet(stress!)).toBeLessThanOrEqual(DUREE_MAX_MS);
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
    expect(dureeDeLEffet(pioche!)).toBe(DUREE_PIOCHE_MS);
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
    expect(dureeDeLEffet(attaque!)).toBeLessThanOrEqual(DUREE_MAX_MS);
    // La séquence entière : l'impact (550 + 150 ms) doit tenir dans la durée de l'effet.
    expect(dureeDeLEffet(attaque!)).toBeGreaterThanOrEqual(700);
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
    expect(dureeDeLEffet(condition!)).toBeLessThanOrEqual(DUREE_MAX_MS);
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
 * **La scène d'Arrivage est hors de ces bornes** (D-141). Une ouverture d'Arrivage est une
 * célébration qu'on passe d'un bouton, pas un effet qui retarde la lecture du coup suivant : ses
 * animations (toutes préfixées `ouverture-`) suivent **leurs propres bornes**, gardées plus bas
 * (`bornesDeLArrivage`). Une déclaration qui mêle une animation de la scène et une autre reste
 * sous les bornes du combat.
 */
function horsBornes(declaration: string): boolean {
  return animationsDe(declaration).every((partie) => /^ouverture-[\w-]+/.test(partie));
}

/** Les animations d'une déclaration, séparées aux virgules **hors** parenthèses (`cubic-bezier(…)`). */
function animationsDe(declaration: string): string[] {
  const parties: string[] = [];
  let profondeur = 0;
  let courante = '';
  for (const c of declaration) {
    if (c === '(') profondeur += 1;
    if (c === ')') profondeur -= 1;
    if (c === ',' && profondeur === 0) {
      parties.push(courante.trim());
      courante = '';
    } else courante += c;
  }
  parties.push(courante.trim());
  return parties.filter(Boolean);
}

/**
 * Les bornes de `SPEC-COMBAT-UI` §6.8, vérifiées sur **la feuille servie** : aucune
 * `animation` de plus de 800 ms, aucune boucle de plus de deux tours, aucun flou en
 * mouvement. C'est cette garde que `scripts/garde-fous.mjs` mute (#192).
 */
describe('styles.css — les bornes des effets (#192, SPEC-COMBAT-UI §6.8)', () => {
  const animations = () =>
    [...css().matchAll(/animation:\s*([^;]+);/g)]
      .map((declaration) => declaration[1].trim())
      .filter((declaration) => declaration !== 'none' && !declaration.includes('none'))
      .filter((declaration) => !horsBornes(declaration));

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

/**
 * **T11 — les bornes, avec leur contrôle qui mord** (#294, `SPEC-COMBAT-UI` §8 T11).
 *
 * Les trois premiers tests de la section précédente lisent la feuille ; celui-ci confronte la
 * **même** règle à des feuilles fautives, pour qu'elle puisse échouer (`AGENTS.md` §6) :
 * une `@keyframes` jouée plus de 800 ms (durée × tours comprise), une boucle de plus de deux
 * tours, ou une boucle sans fin (`infinite`, que le décompte des chiffres ne voyait pas).
 */
function animationsFautives(feuille: string): string[] {
  const sansCommentaires = feuille.replace(/\/\*[\s\S]*?\*\//g, '');
  const fautes: string[] = [];
  for (const declaration of sansCommentaires.matchAll(/animation:\s*([^;]+);/g)) {
    const valeur = declaration[1].trim();
    if (valeur.includes('none') || horsBornes(valeur)) continue;
    const durees = [...valeur.matchAll(/(\d+)ms/g)].map((duree) => Number(duree[1]));
    const tours = valeur.includes('infinite')
      ? Number.POSITIVE_INFINITY
      : Math.max(1, ...[...valeur.matchAll(/(?:^|\s)(\d+)(?=\s|$)/g)].map((nombre) => Number(nombre[1])));
    const duree = durees.length === 0 ? Number.POSITIVE_INFINITY : Math.max(...durees);
    if (duree > DUREE_MAX_MS) fautes.push(`${valeur} : plus de ${DUREE_MAX_MS} ms`);
    else if (tours > MAX_TOURS_BOUCLE) fautes.push(`${valeur} : plus de ${MAX_TOURS_BOUCLE} tours`);
    else if (duree * tours > DUREE_MAX_MS) fautes.push(`${valeur} : ${duree * tours} ms au total`);
  }
  return fautes;
}

/**
 * **Les bornes propres à la scène d'Arrivage** (D-141) : une boucle d'ambiance y est permise, mais
 * **lente** — une seconde au moins par tour, jamais un clignotement (SC 2.3.1) — et une animation
 * qui finit dure **trois secondes** au plus. « Mouvement réduit » les coupe toutes (règle globale
 * de la feuille, et bloc final de la scène).
 */
function bornesDeLArrivage(feuille: string): string[] {
  const sansCommentaires = feuille.replace(/\/\*[\s\S]*?\*\//g, '');
  const fautes: string[] = [];
  for (const declaration of sansCommentaires.matchAll(/animation:\s*([^;]+);/g)) {
    const valeur = declaration[1].trim();
    if (valeur.includes('none') || !horsBornes(valeur)) continue;
    for (const partie of animationsDe(valeur)) {
      const duree = Number(/(\d+)ms/.exec(partie)?.[1] ?? Number.NaN);
      if (Number.isNaN(duree)) continue;
      if (partie.includes('infinite') && duree < 1000) fautes.push(`${partie.trim()} : boucle de moins d’une seconde`);
      if (!partie.includes('infinite') && duree > 3000) fautes.push(`${partie.trim()} : plus de 3 s`);
    }
  }
  return fautes;
}

/** Les blocs `selecteur { corps }` de la feuille, commentaires retirés. */
function reglesDe(feuille: string): { selecteur: string; corps: string }[] {
  return [...feuille.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({
    selecteur: m[1].trim().replace(/\s+/g, ' '),
    corps: m[2]
  }));
}

/** Les règles de survol de la case de la main (`<li>`) qui portent un `transform` : la cible bougerait. */
function transformsDuSurvolDeLaCase(feuille: string): string[] {
  return reglesDe(feuille)
    .filter((r) => r.selecteur === '.hand > li:is(:hover, :focus-within, .is-selected)')
    .flatMap((r) => {
      const transform = r.corps.match(/transform:\s*([^;]+);/);
      return transform ? [`${r.selecteur} { transform: ${transform[1].trim()} }`] : [];
    });
}

describe('styles.css — durée, tours et durée totale des animations (#294)', () => {
  it('aucune animation de la feuille ne dépasse 800 ms, deux tours, ni 800 ms au total', () => {
    expect(animationsFautives(css())).toEqual([]);
  });

  it('la scène d’Arrivage tient ses propres bornes (D-141)', () => {
    expect(bornesDeLArrivage(css())).toEqual([]);
    // Elle a bien des animations : sans elles, l'exemption ne garderait rien.
    expect(css()).toMatch(/animation:\s*ouverture-[\w-]+ \d+ms[^;]*infinite/);
  });

  it('le contrôle mord : l’exemption ne couvre que la scène, et la scène a ses bornes', () => {
    const fautive = [
      css(),
      '.a { animation: ouverture-a 200ms linear infinite; }',
      '.b { animation: ouverture-b 4000ms ease-out both; }',
      '.c { animation: ouverture-c 900ms ease infinite, autre 900ms ease both; }'
    ].join('\n');
    expect(bornesDeLArrivage(fautive)).toEqual([
      'ouverture-a 200ms linear infinite : boucle de moins d’une seconde',
      'ouverture-b 4000ms ease-out both : plus de 3 s'
    ]);
    // Une déclaration mêlée reste sous les bornes du combat : l'exemption ne s'étend pas.
    expect(animationsFautives(fautive)).toContain(
      'ouverture-c 900ms ease infinite, autre 900ms ease both : plus de 800 ms'
    );
  });

  it('le contrôle mord : durée, boucle sans fin, trop de tours et total sont vus', () => {
    const fautive = [
      css(),
      '.a { animation: x 1600ms ease-out 1 both; }',
      '.b { animation: y 300ms ease-in-out infinite both; }',
      '.c { animation: z 100ms ease-in-out 3 both; }',
      '.d { animation: w 500ms ease-in-out 2 both; }'
    ].join('\n');
    expect(animationsFautives(fautive)).toEqual([
      'x 1600ms ease-out 1 both : plus de 800 ms',
      'y 300ms ease-in-out infinite both : plus de 2 tours',
      'z 100ms ease-in-out 3 both : plus de 2 tours',
      'w 500ms ease-in-out 2 both : 1000 ms au total'
    ]);
  });

  it('l’arc de Condition pulse deux fois et le nœud vit exactement le temps de l’animation', () => {
    const arc = css().match(/\.condition__arc\s*\{([^}]*)\}/)?.[1] ?? '';
    const declaration = arc.match(/animation:\s*condition-arc (\d+)ms [\w-]+ (\d+) both;/);
    expect(declaration, 'la règle .condition__arc porte l’animation condition-arc').not.toBeNull();
    const [, battement, tours] = declaration!;
    expect(Number(tours)).toBe(2);
    expect(Number(battement) * Number(tours)).toBe(DUREE_CONDITION_MS);
    // Seule l'opacité bouge, et l'arc ne capte aucun clic ni ne sort du flux.
    expect(arc).toMatch(/pointer-events:\s*none;/);
    expect(arc).toMatch(/position:\s*absolute;/);
    // Posé par une Pression, l'arc attend l'impact : le délai, ajouté à la durée, reste sous 800 ms.
    const retard = css().match(/\.condition__arc--apres-coup\s*\{[^}]*animation-delay:\s*(\d+)ms;/)?.[1];
    expect(Number(retard)).toBe(DELAI_IMPACT_MS);
    expect(Number(retard) + Number(battement) * Number(tours)).toBe(DUREE_CONDITION_APRES_COUP_MS);
    expect(DUREE_CONDITION_APRES_COUP_MS).toBeLessThanOrEqual(DUREE_MAX_MS);
    const keyframes = css().match(/@keyframes condition-arc\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(keyframes).toMatch(/opacity/);
    expect(keyframes).not.toMatch(/transform|blur|filter|box-shadow/);
  });

  it('la carte de la main se soulève sans déplacer sa cible de clic, et se tait sous mouvement réduit', () => {
    // Aucune règle de survol de l'`<li>` ne porte de `transform` : c'est elle qui déplacerait le bouton.
    expect(transformsDuSurvolDeLaCase(css())).toEqual([]);
    const regles = reglesDe(css());
    // Le visuel monte, en 160 ms.
    const visuel = regles.find(
      (r) => r.selecteur === '.hand > li:is(:hover, :focus-within, .is-selected) .hand__visuel'
    );
    expect(visuel?.corps).toMatch(/transform:\s*translateY\(-0\.5rem\);/);
    expect(regles.find((r) => r.selecteur === '.hand__visuel')?.corps).toMatch(/transition:\s*transform 160ms/);
    // Les deux coupures (store, système) ramènent le visuel à sa place.
    const replis = regles.filter(
      (r) => /\.hand__visuel$/.test(r.selecteur) && /mouvement-reduit|^\.hand > li/.test(r.selecteur)
    );
    const coupes = replis.filter((r) => /transform:\s*none;/.test(r.corps)).map((r) => r.selecteur);
    expect(coupes.some((s) => /^:root\[data-mouvement-reduit='true'\] .*\.battle--mouvement-reduit/.test(s))).toBe(
      true
    );
    expect(coupes.some((s) => s === '.hand > li:is(:hover, :focus-within, .is-selected) .hand__visuel')).toBe(true);
  });

  it('le contrôle mord : un survol qui soulève l’`<li>` est vu', () => {
    const fautive = `${css()}\n.hand > li:is(:hover, :focus-within, .is-selected) { transform: translateY(-1rem) rotate(0deg); }`;
    expect(transformsDuSurvolDeLaCase(fautive)).toEqual([
      '.hand > li:is(:hover, :focus-within, .is-selected) { transform: translateY(-1rem) rotate(0deg) }'
    ]);
  });

  it('l’arc a son repli : aucun arc sous « Mouvement réduit », store comme système', () => {
    const feuille = css();
    expect(feuille).toMatch(
      /:root\[data-mouvement-reduit='true'\] \.condition__arc,\s*\.battle--mouvement-reduit \.condition__arc\s*\{[^}]*animation:\s*none !important;[^}]*display:\s*none;/
    );
    expect(feuille).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.condition__arc\s*\{[^}]*animation:\s*none !important;[^}]*display:\s*none;/
    );
  });
});
