import { describe, expect, it } from 'vitest';
import {
  ACTION_KIND_META,
  ALL_CARDS,
  CARD_BY_ID,
  FACTION_META,
  ITEM_KIND_META,
  RARITY_META,
  STAGE_META,
  getCard,
  isActionCard,
  isPlanque
} from '@/data';
import type { Card, CafeSymbol, Faction, PlanqueCard, Rarity, Stage } from '@/data/types';
import { ABILITY_KINDS, ATTACK_EFFECT_KINDS } from '@/data/types';
import { secretSuffix } from '@/data/planque';
import { damageBand, hpBand } from '@/game/curves';

/**
 * Fichier de contrôle des conventions d'écriture des cartes.
 *
 * Chaque assertion cite sa règle : `AGENTS.md` §3 (vocabulaire), §5 (écriture des
 * cartes) ou `docs/CARD-SPEC.md` §1-2. Une carte qui échoue ici est une carte à
 * rectifier — pas un test à assouplir.
 *
 * Les deux mots interdits qui partagent la même racine sont reconstruits par
 * fragments : `AGENTS.md` §8.4 exige **zéro** occurrence de ce mot dans `src/`,
 * y compris dans les tests. Le test doit donc le chercher sans l'écrire.
 */
const FORBIDDEN_ANY_CASE = [
  'Gal' + 'ère',
  'Gal' + 'èreMon',
  'Grèvomon',
  'Pokémon',
  // Vocabulaire abandonné (D-024, D-026), cherché **sans tenir compte de la casse**.
  // Termes non ambigus uniquement : `Cadre`, `Prime`, `Moral`, `Courrier` sont des mots
  // français courants (un cadre, une prime de rendement, le moral d'une équipe…) et
  // feraient des faux positifs ; « K.O. » reste un identifiant interne du code.
  'Open-space',
  'Classeur',
  'Galérodex',
  'Bac à courrier',
  'Reprise de poste'
];

/**
 * Anciens codes de statut et de faction, cherchés en **respectant la casse** : les
 * minuscules `manager`, `technicien`, `happiness`… sont des mots légitimes (D-024).
 * Les nouveaux codes : EPUISEMENT, SIESTE, IMMOBILISATION ; MANAGEMENT, QVT, ATELIER,
 * INTERIM.
 */
const FORBIDDEN_UPPER = ['BURNOUT', 'BLOQUE', 'GELE', 'MANAGER', 'HAPPINESS', 'TECHNICIEN', 'INTERIMAIRE'];

/**
 * Les primitives d'effet et de Talent ne sont **pas** recopiées ici (#56) : leur liste
 * unique vit à côté de leur union, dans `@/data/types`. Ce fichier la consomme, il ne la
 * redéclare pas — sinon un membre ajouté au type passerait inaperçu.
 */

/** Les **Planqués** : seuls à porter un stade, un Seuil, des Pressions, une Vulnérabilité. */
const PLANQUES = ALL_CARDS.filter(isPlanque);
/** Les Planqués de base (hors variantes) : les seuls à définir une ligne d'évolution. */
const BASE_PLANQUES = PLANQUES.filter((card) => !card.variantOf);
/** Les **cartes Action** : 8 Collègues, 3 Objets et leurs variantes secrètes (D-005). */
const ACTIONS = ALL_CARDS.filter(isActionCard);
/** Les cartes Action de **base** : 8 Collègues et 3 Objets (CARD-SPEC.md §1). */
const BASE_ACTIONS = ACTIONS.filter((card) => !card.variantOf);
/** Les **variantes de Collègues** : les 8 dernières cartes des 286 (CARD-SPEC.md §1). */
const ACTION_VARIANTS = ACTIONS.filter((card) => card.variantOf);

const STAGE_ORDER: Stage[] = ['ENTRANT', 'N+1', 'N+2'];

/**
 * Les bandes chiffrées de `CARD-SPEC.md` §2 vivent dans `@/game/curves` (ticket #55) :
 * `damageBand()` pour les dégâts par café, `hpBand()` pour le Seuil par stade et rareté.
 * Ce fichier ne recopie **aucune** borne : il confronte les cartes réelles au module.
 */

const texts = (card: Card): string[] => [
  card.name,
  card.flavor,
  ...(isPlanque(card)
    ? [
        ...card.attacks.flatMap((attack) => [attack.name, attack.text ?? '']),
        card.ability?.name ?? '',
        card.ability?.text ?? ''
      ]
    : [card.text])
];

describe('Cartes — structure (CARD-SPEC.md §1)', () => {
  it('n’a aucun identifiant en double et chaque carte est enregistrée', () => {
    const ids = ALL_CARDS.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const card of ALL_CARDS) {
      expect(getCard(card.id)).toBe(card);
      expect(CARD_BY_ID.get(card.id)).toBe(card);
    }
  });

  it('identifie chaque carte en kebab-case préfixé par sa faction (AGENTS.md §5)', () => {
    for (const card of ALL_CARDS) {
      expect(card.id, card.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(card.id.startsWith(`${card.faction.toLowerCase()}-`), `${card.id} vs ${card.faction}`).toBe(true);
    }
  });

  it('a un stade, une rareté et des métadonnées connues', () => {
    for (const card of ALL_CARDS) {
      expect(RARITY_META[card.rarity], card.id).toBeDefined();
      expect(FACTION_META[card.faction], card.id).toBeDefined();
      expect(card.palette.length, card.id).toBeGreaterThan(0);
      expect(card.glyph.length, card.id).toBeGreaterThan(0);
    }
    for (const card of PLANQUES) {
      expect(STAGE_ORDER, card.id).toContain(card.stage);
      expect(STAGE_META[card.stage], card.id).toBeDefined();
      expect(card.hp, card.id).toBeGreaterThan(0);
      expect(card.retreat, card.id).toBeGreaterThanOrEqual(0);
      expect(card.attacks.length, card.id).toBeGreaterThan(0);
    }
  });

  it('n’utilise que les primitives d’effet et de talent déclarées (AGENTS.md §5)', () => {
    for (const card of PLANQUES) {
      for (const attack of card.attacks) {
        // La contrainte de coût ne vit **pas** ici : ce `describe` porte sur les
        // primitives d'effet et de talent (AGENTS.md §5). Le refus du coût vide pour un
        // Planqué **typé** (D-037 (3)) est affirmé dans le `describe` dédié
        // « Coût en café typé — attribution », par le prédicat `coutTypeConforme`.
        // On ne l'étend pas à `SUPPORT` : `Attack.cost` documente la liste vide comme
        // une **Pression gratuite** (`src/data/types.ts`), `DAMAGE_BY_COST[0]` existe
        // (`src/game/curves.ts`) et §4 parle d'une attaque qui « coûte 0 ». La règle
        // générale sur le coût 0 est ouverte (ticket #102) — un test ne la tranche pas.
        expect(attack.damage, `${card.id}/${attack.name}`).toBeGreaterThanOrEqual(0);
        for (const effect of attack.effects ?? []) {
          expect(ATTACK_EFFECT_KINDS, `${card.id}/${attack.name}`).toContain(effect.kind);
          if (effect.kind === 'status') {
            expect(effect.status, `${card.id}/${attack.name}`).toBeDefined();
          }
        }
      }
      if (card.ability) {
        expect(ABILITY_KINDS, card.id).toContain(card.ability.kind);
      }
    }
  });

  it('n’utilise, pour un effet de carte Action, que les primitives existantes (AGENTS.md §5)', () => {
    for (const card of ACTIONS) {
      expect(card.effects.length, card.id).toBeGreaterThan(0);
      for (const effect of card.effects) {
        expect(ATTACK_EFFECT_KINDS, card.id).toContain(effect.kind);
        if (effect.kind === 'status') {
          expect(effect.status, card.id).toBeDefined();
        }
        // Une carte Action n'a pas d'attaquant : les primitives qui en supposent un
        // (`healSelf`, `selfDamage`, `switchSelf`, `reduceDamage`) ne sont pas employées.
        expect(['draw', 'healAll', 'status', 'discardEnergy'], card.id).toContain(effect.kind);
      }
    }
  });
});

/**
 * Socle des raretés hautes — `CARD-SPEC.md` §1 et `AGENTS.md` §3.2.
 * Les cartes ci-dessous sont **synthétiques** et ne sont jamais enregistrées dans
 * `ALL_CARDS` : elles prouvent que le type et les métadonnées acceptent les paliers
 * **avant** qu'une carte réelle ne les emploie. Les variantes réelles sont contrôlées
 * dans le `describe` suivant (#87).
 */
const RARITES_HAUTES: Rarity[] = ['3S', 'COU'];
const TOUTES_LES_RARETES: Rarity[] = ['1D', '2D', '3D', '4D', '1S', '2S', '3S', 'COU'];

/**
 * Le coût est paramétrable : les contrôles d'attribution (D-037 (3)) l'emploient pour
 * prouver qu'ils **mordent** — une carte valide acceptée, une carte fautive refusée.
 */
const carteSynthetique = (rarity: Rarity, cost: CafeSymbol[] = ['SSE']): PlanqueCard => ({
  id: `sse-socle-${rarity.toLowerCase()}`,
  name: `Carte de test ${rarity}`,
  kind: 'PLANQUE',
  faction: 'SSE',
  stage: 'ENTRANT',
  rarity,
  hp: 60,
  retreat: 1,
  weakness: 'MANAGEMENT',
  attacks: [{ name: 'Pression de test', cost, damage: 10 }],
  flavor: 'Carte synthétique : elle n’entre jamais dans le Parc.',
  glyph: '✦',
  palette: '#24303c'
});

describe('Raretés hautes — socle de type (CARD-SPEC.md §1, AGENTS.md §3.2)', () => {
  it('accepte `3S` et `COU` dans `Rarity` et `RARITY_META`, après `2S`', () => {
    expect(Object.keys(RARITY_META).sort()).toEqual([...TOUTES_LES_RARETES].sort());
    for (const rarity of RARITES_HAUTES) {
      const meta = RARITY_META[rarity];
      expect(meta, rarity).toBeDefined();
      expect(meta.label.trim(), rarity).not.toBe('');
      expect(meta.color, rarity).toMatch(/^#[0-9a-f]{6}$/i);
      expect(meta.order, rarity).toBeGreaterThan(RARITY_META['2S'].order);
    }
    expect(RARITY_META['3S'].order).toBeLessThan(RARITY_META.COU.order);
  });

  it('déclare une carte synthétique de chaque nouvelle rareté sans l’enregistrer', () => {
    for (const rarity of RARITES_HAUTES) {
      const card = carteSynthetique(rarity);
      expect(card.rarity, card.id).toBe(rarity);
      expect(RARITY_META[card.rarity], card.id).toBeDefined();
      expect(CARD_BY_ID.has(card.id), card.id).toBe(false);
    }
  });
});

describe('Raretés hautes — les variantes réelles (#87)', () => {
  const VARIANTS = PLANQUES.filter((card) => card.variantOf);
  const variantesDe = (rarity: Rarity) => VARIANTS.filter((card) => card.rarity === rarity);

  it('porte 4 variantes `3S` et 3 variantes `COU`, sans créer de variante', () => {
    // Q14 : la vague 3 **re-raréfie** des variantes existantes. Le set garde donc ses
    // 67 variantes de Planqués ; seuls leurs paliers changent.
    expect(VARIANTS).toHaveLength(67);
    expect(variantesDe('3S')).toHaveLength(4);
    expect(variantesDe('COU')).toHaveLength(3);
  });

  it('n’a aucune rareté déclarée mais inutilisée dans le catalogue', () => {
    const utilisees = new Set(ALL_CARDS.map((card) => card.rarity));
    expect([...utilisees].sort()).toEqual([...TOUTES_LES_RARETES].sort());
  });

  it('suffixe chaque variante haute par le suffixe de sa rareté, et la rattache à une base', () => {
    for (const card of [...variantesDe('3S'), ...variantesDe('COU')]) {
      const suffix = secretSuffix(card.rarity);
      expect(suffix, card.id).toBeDefined();
      expect(card.id, card.id).toMatch(new RegExp(`-${suffix}$`));
      const source = card.variantOf ? getCard(card.variantOf) : undefined;
      expect(isPlanque(source), card.id).toBe(true);
      expect(source?.variantOf, `${card.id} : une variante de variante`).toBeUndefined();
      expect(source?.rarity, card.id).toBe('3D');
    }
  });
});

/**
 * Forme et attribution du coût en café typé — D-037, tickets #30/#33/#35.
 *
 * Le coût d'une Pression est une **liste de symboles** (`CafeSymbol`) : un type de
 * faction produit, ou `INCOLORE` — qui n'est **pas** `SUPPORT`. La **longueur** de la
 * liste = l'ancien coût numérique, donc l'équilibrage de D-021 est intact.
 */

/** Les types de café que la Machine peut **produire**, dans l'ordre des factions. */
const PRODUITS: CafeSymbol[] = ['SSE', 'MANAGEMENT', 'QVT', 'AMELIORATION', 'RH', 'ATELIER', 'DIRECTION', 'SYNDICAT'];

/** Total des cafés de toutes les Pressions **de base**, avant et après migration (#33). */
const TOTAL_CAFES_BASES = 477;

describe('Coût en café typé — forme (D-037 (1), #35)', () => {
  it('chaque Pression porte une liste de symboles : type produit ou `INCOLORE`', () => {
    for (const card of PLANQUES) {
      for (const attack of card.attacks) {
        expect(Array.isArray(attack.cost), `${card.id}/${attack.name}`).toBe(true);
        for (const symbol of attack.cost) {
          expect([...PRODUITS, 'INCOLORE'], `${card.id}/${attack.name} → ${symbol}`).toContain(symbol);
        }
        // `INCOLORE` n'est pas `SUPPORT` : aucun coût ne porte le symbole `SUPPORT` (D-037 (1)).
        expect(attack.cost, `${card.id}/${attack.name}`).not.toContain('SUPPORT' as never);
      }
    }
  });

  it('garde le nombre de cafés par Pression — total inchangé (D-021, #33)', () => {
    let total = 0;
    for (const card of BASE_PLANQUES) {
      for (const attack of card.attacks) total += attack.cost.length;
    }
    expect(total).toBe(TOTAL_CAFES_BASES);
  });
});

/**
 * D-037 (3) : un Planqué **typé** met **au moins un café de son type** dans chacune de
 * ses Pressions, **le reste en `INCOLORE`**. La règle ne fixe **aucune position** ;
 * un coût **vide** est refusé, il ne porte aucun café de son type (ticket #101).
 *
 * Un prédicat nommé, et non des `expect` en ligne : le test « le contrôle mord » le
 * confronte à des cartes jetables, il ne se contente pas de relire les cartes réelles.
 */
const coutTypeConforme = (cost: readonly CafeSymbol[], faction: Faction): boolean =>
  cost.length > 0 &&
  cost.includes(faction) &&
  cost.every((symbol) => symbol === faction || symbol === 'INCOLORE');

describe('Coût en café typé — attribution (D-037 (3), #33, #101)', () => {
  it('un Planqué typé met ≥ 1 café de son type, le reste incolore, sans position imposée', () => {
    for (const card of BASE_PLANQUES) {
      if (card.faction === 'SUPPORT' || card.faction === 'INTERIM') continue;
      for (const attack of card.attacks) {
        expect(
          coutTypeConforme(attack.cost, card.faction),
          `${card.id}/${attack.name} : ${JSON.stringify(attack.cost)}`
        ).toBe(true);
      }
    }
  });

  it('refuse un coût vide : le contrôle mord', () => {
    // La carte jetable de ce fichier : elle n'entre jamais dans `ALL_CARDS`.
    const cout = (cost: CafeSymbol[]): CafeSymbol[] => carteSynthetique('1D', cost).attacks[0].cost;

    // Un coût vide ne porte aucun café de son type : il est refusé, pas sauté.
    expect(coutTypeConforme(cout([]), 'SSE'), 'coût vide').toBe(false);
    // « le reste en incolore » : un second café typé étranger est refusé.
    expect(coutTypeConforme(cout(['SSE', 'MANAGEMENT']), 'SSE'), 'coût [SSE, MANAGEMENT]').toBe(false);
  });

  it('accepte le café typé à toute position : le contrôle mord', () => {
    const cout = (cost: CafeSymbol[]): CafeSymbol[] => carteSynthetique('1D', cost).attacks[0].cost;

    // D-037 (3) n'impose aucune position : le café typé peut être ailleurs qu'en tête.
    expect(coutTypeConforme(cout(['SSE']), 'SSE'), 'coût [SSE]').toBe(true);
    expect(coutTypeConforme(cout(['INCOLORE', 'SSE']), 'SSE'), 'coût [INCOLORE, SSE]').toBe(true);
    expect(coutTypeConforme(cout(['SSE', 'INCOLORE']), 'SSE'), 'coût [SSE, INCOLORE]').toBe(true);
  });

  it('`SUPPORT` n’a que des coûts incolores', () => {
    for (const card of BASE_PLANQUES.filter((entry) => entry.faction === 'SUPPORT')) {
      for (const attack of card.attacks) {
        expect(attack.cost.every((symbol) => symbol === 'INCOLORE'), `${card.id}/${attack.name}`).toBe(true);
      }
    }
  });

  it('`INTERIM` mêle deux types produits distincts, jamais `INTERIM` ni incolore seul', () => {
    for (const card of BASE_PLANQUES.filter((entry) => entry.faction === 'INTERIM')) {
      for (const attack of card.attacks) {
        const label = `${card.id}/${attack.name}`;
        const types = new Set(attack.cost);
        expect(attack.cost, label).not.toContain('INTERIM' as never);
        expect(attack.cost.some((symbol) => PRODUITS.includes(symbol)), label).toBe(true);
        if (attack.cost.length >= 2) expect(types.size, label).toBe(2);
      }
    }
  });
});

describe('Cartes — lignes d’évolution (AGENTS.md §5)', () => {
  it('fait pointer `evolvesFrom` vers la carte du stade précédent', () => {
    for (const card of BASE_PLANQUES) {
      const index = STAGE_ORDER.indexOf(card.stage);
      if (card.stage === 'ENTRANT') {
        expect(card.evolvesFrom, `${card.id} ne doit pas évoluer`).toBeUndefined();
        continue;
      }
      expect(card.evolvesFrom, `${card.id} doit évoluer`).toBeTruthy();
      const previous = card.evolvesFrom ? getCard(card.evolvesFrom) : undefined;
      expect(previous, `${card.id} → ${card.evolvesFrom}`).toBeDefined();
      expect(isPlanque(previous) ? previous.stage : undefined, `${card.id} → ${card.evolvesFrom}`).toBe(
        STAGE_ORDER[index - 1]
      );
    }
  });

  it('fait hériter une variante de sa carte de base', () => {
    const variants = PLANQUES.filter((card) => card.variantOf);
    expect(variants.length).toBeGreaterThan(0);
    for (const variant of variants) {
      const source = variant.variantOf ? getCard(variant.variantOf) : undefined;
      expect(source, variant.id).toBeDefined();
      if (!source || !isPlanque(source)) continue;
      expect(source.variantOf, `${variant.id} : une variante de variante`).toBeUndefined();
      const suffix = secretSuffix(variant.rarity);
      expect(suffix, `${variant.id} : rareté sans suffixe de variante`).toBeDefined();
      expect(variant.id, variant.id).toMatch(new RegExp(`-${suffix}$`));
      expect(variant.faction, variant.id).toBe(source.faction);
      expect(variant.stage, variant.id).toBe(source.stage);
      expect(variant.hp, variant.id).toBe(source.hp);
      expect(variant.retreat, variant.id).toBe(source.retreat);
      expect(variant.weakness, variant.id).toBe(source.weakness);
      expect(variant.attacks, variant.id).toEqual(source.attacks);
      expect(variant.ability, variant.id).toEqual(source.ability);
      expect(variant.flavor, variant.id).toBe(source.flavor);
      expect(variant.ex, variant.id).toBe(source.ex);
    }
  });
});

describe('Cartes — Seuil par stade (CARD-SPEC.md §2, D-023)', () => {
  it('place chaque carte dans la bande de Seuil de son stade et de sa rareté', () => {
    // Les variantes héritent du Seuil de leur base : couvertes par le test d'héritage.
    for (const card of BASE_PLANQUES) {
      const band = hpBand(card.stage, card.rarity);
      expect(band, `${card.id} : ${card.stage}/${card.rarity} non couvert`).toBeDefined();
      if (!band) continue;
      expect(card.hp, `${card.id} (${card.stage} ${card.rarity})`).toBeGreaterThanOrEqual(band[0]);
      expect(card.hp, `${card.id} (${card.stage} ${card.rarity})`).toBeLessThanOrEqual(band[1]);
    }
  });
});

describe('Cartes — dégâts par café (CARD-SPEC.md §2, normatif depuis D-021)', () => {
  it('place chaque attaque dans la bande de son coût', () => {
    for (const card of PLANQUES) {
      for (const attack of card.attacks) {
        const band = damageBand(attack.cost.length);
        expect(band, `${card.id}/${attack.name} : coût ${attack.cost.length} café(s) non couvert`).toBeDefined();
        if (!band) continue;
        const label = `${card.id}/${attack.name} à ${attack.cost.length} café(s)`;
        expect(attack.damage, label).toBeGreaterThanOrEqual(band[0]);
        expect(attack.damage, label).toBeLessThanOrEqual(band[1]);
      }
    }
  });
});

describe('Cartes — COMEX et Vulnérabilité (AGENTS.md §3.2, §5)', () => {
  /**
   * La vulnérabilité est portée par `FACTION_META` (`src/data/factions.ts`), pas par la
   * carte. Ce test ne relit donc pas les cartes — il vérifierait la même source que le
   * code — il vérifie la **forme du cycle** : dix factions, une seule vulnérabilité
   * chacune, aucune tournée vers elle-même, et l'Intérim à aucune.
   */
  it('forme le cycle des Vulnérabilités : dix factions, une chacune, l’Intérim aucune', () => {
    const factions = Object.keys(FACTION_META) as Faction[];
    expect(factions).toHaveLength(10);

    const sansVulnerabilite = factions.filter((faction) => FACTION_META[faction].weakness === null);
    expect(sansVulnerabilite).toEqual(['INTERIM']);

    for (const faction of factions) {
      const { weakness } = FACTION_META[faction];
      if (weakness === null) continue;
      expect(weakness, `${faction} ne peut pas être vulnérable à elle-même`).not.toBe(faction);
      expect(factions, `${faction} → ${weakness} : faction inconnue`).toContain(weakness);
    }
  });

  it('réserve le COMEX aux 4 diamants, et le nom ne porte pas la marque « ex »', () => {
    for (const card of PLANQUES) {
      if (card.ex) {
        // D-026 : le COMEX est un **statut**, pas un stade — un ex peut être Entrant, N+1
        // ou N+2, comme dans le jeu de base. Le seul fait mécanique est la rareté.
        expect(card.rarity, card.id).toBe('4D');
      }
      // L'UI affiche le nom : il ne doit pas porter la marque « ex ».
      expect(card.name, card.id).not.toMatch(/(?:^|\s)ex(?:\s|$)/i);
    }
  });
});

describe('Cartes — les COMEX de la vague 1 (#66)', () => {
  const COMEX = PLANQUES.filter((card) => card.ex);

  it('compte 15 COMEX : les dix factions en portent au moins un, cinq en portent deux', () => {
    // CARD-SPEC.md §1 : 15 cartes en 4◆. Les dix signatures (AGENTS.md §3.2) plus les
    // cinq seconds COMEX de la vague 1 (#66).
    expect(COMEX).toHaveLength(15);
    const parFaction = new Map<Faction, number>();
    for (const card of COMEX) parFaction.set(card.faction, (parFaction.get(card.faction) ?? 0) + 1);
    expect([...parFaction.keys()].sort()).toEqual((Object.keys(FACTION_META) as Faction[]).sort());
    expect([...parFaction.values()].sort()).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
  });

  it('fait évoluer chaque COMEX d’un N+1 de sa faction, sur une ligne distincte dans une même faction', () => {
    const lignes = new Map<Faction, string[]>();
    for (const card of COMEX) {
      const previous = card.evolvesFrom ? getCard(card.evolvesFrom) : undefined;
      expect(isPlanque(previous) ? previous.stage : undefined, card.id).toBe('N+1');
      expect(previous?.faction, card.id).toBe(card.faction);
      lignes.set(card.faction, [...(lignes.get(card.faction) ?? []), card.evolvesFrom ?? '']);
    }
    for (const [faction, parents] of lignes) {
      expect(new Set(parents).size, `${faction} : deux COMEX sur la même ligne`).toBe(parents.length);
    }
  });

  it('suffixe l’identifiant de chaque COMEX par `-ex` (D-027)', () => {
    for (const card of COMEX) expect(card.id, card.id).toMatch(/-ex$/);
  });
});

describe('Cartes — textes (AGENTS.md §3, §5)', () => {
  it('écrit les textes en français, sans mot interdit ni « banc »', () => {
    for (const card of ALL_CARDS) {
      for (const text of texts(card)) {
        for (const word of FORBIDDEN_ANY_CASE) {
          expect(text.toLowerCase(), `${card.id} : « ${word} »`).not.toContain(word.toLowerCase());
        }
        for (const word of FORBIDDEN_UPPER) {
          expect(text, `${card.id} : « ${word} »`).not.toContain(word);
        }
        // §3.1 : Bench → Rack. « banc » n'a rien à faire dans un texte de carte.
        expect(text, `${card.id} : « ${text} »`).not.toMatch(/\bbanc\b/i);
      }
    }
  });

  it('ne donne de texte (d’effet) à une attaque que si elle porte un effet', () => {
    // Sens inverse du test suivant : un texte qui décrit un effet doit être adossé à un
    // `effects` réel — sinon la carte promet une mécanique qui n'arrive pas.
    for (const card of PLANQUES) {
      for (const attack of card.attacks) {
        if (attack.text?.trim()) {
          expect(
            (attack.effects ?? []).length,
            `${card.id}/${attack.name} : texte sans effet`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('donne un texte à toute attaque portant un effet', () => {
    for (const card of PLANQUES) {
      for (const attack of card.attacks) {
        expect(attack.name.trim(), card.id).not.toBe('');
        if ((attack.effects ?? []).length > 0) {
          expect(attack.text?.trim(), `${card.id}/${attack.name} : effet sans texte`).toBeTruthy();
        }
      }
      if (card.ability) {
        expect(card.ability.name.trim(), card.id).not.toBe('');
        expect(card.ability.text.trim(), card.id).not.toBe('');
      }
      expect(card.flavor.trim(), card.id).not.toBe('');
    }
  });
});

describe('Cartes — unicité des noms (deck.ts compte par nom)', () => {
  it('n’a aucun nom partagé par deux cartes de bases différentes', () => {
    // `deck.ts` limite les exemplaires **par nom**. Une base et ses variantes peuvent
    // partager un nom (c'est la même carte) ; deux bases distinctes, non — sinon la
    // limite sauterait silencieusement.
    const byName = new Map<string, Card[]>();
    for (const card of ALL_CARDS) {
      byName.set(card.name, [...(byName.get(card.name) ?? []), card]);
    }
    const bad = [...byName.entries()].filter(([, cards]) => {
      const bases = new Set(cards.map((card) => card.variantOf ?? card.id));
      return bases.size > 1;
    });
    expect(
      bad.map(([name]) => name),
      `noms partagés par des bases distinctes : ${JSON.stringify(bad.map(([name, c]) => [name, c.map((x) => x.id)]))}`,
    ).toEqual([]);
  });
});

describe('Cartes Action — Collègues et Objets (D-005, D-027, AGENTS.md §4)', () => {
  it('compte 8 Collègues et 3 Objets au lancement, plus 8 variantes de Collègues (CARD-SPEC.md §1)', () => {
    expect(BASE_ACTIONS.filter((card) => card.kind === 'COLLEAGUE')).toHaveLength(8);
    expect(BASE_ACTIONS.filter((card) => card.kind === 'OBJET')).toHaveLength(3);
    expect(BASE_ACTIONS).toHaveLength(11);
    // Les 8 variantes des 60 cartes secrètes : une par Collègue, aucune pour un Objet.
    expect(ACTION_VARIANTS).toHaveLength(8);
    expect(ACTION_VARIANTS.filter((card) => card.kind === 'COLLEAGUE')).toHaveLength(8);
    expect(ACTIONS).toHaveLength(19);
  });

  it('n’attribue jamais à une carte Action les champs d’un Planqué', () => {
    for (const card of ACTIONS) {
      expect(card.kind, card.id).not.toBe('PLANQUE');
      expect('stage' in card, card.id).toBe(false);
      expect('hp' in card, card.id).toBe(false);
      expect('retreat' in card, card.id).toBe(false);
      expect('weakness' in card, card.id).toBe(false);
      expect('attacks' in card, card.id).toBe(false);
    }
  });

  it('donne à chaque Objet sa catégorie NEUF ou MRO, et à aucun Collègue (D-027)', () => {
    for (const card of ACTIONS) {
      if (card.kind === 'OBJET') {
        expect(card.itemKind, card.id).toBeDefined();
        expect(Object.keys(ITEM_KIND_META), card.id).toContain(card.itemKind);
      } else {
        expect(card.itemKind, card.id).toBeUndefined();
      }
    }
  });

  it('décrit son effet en français, et la variante d’un Collègue hérite de sa base', () => {
    for (const card of ACTIONS) {
      expect(card.text.trim(), card.id).not.toBe('');
      expect(ACTION_KIND_META[card.kind], card.id).toBeDefined();
      if (card.variantOf) {
        const source = getCard(card.variantOf);
        expect(source, card.id).toBeDefined();
        expect(source?.kind, card.id).toBe(card.kind);
      }
    }
  });

  it('fait hériter chaque variante de Collègue de sa base, sans variante de variante (AGENTS.md §5)', () => {
    const seen = new Set<string>();
    for (const variant of ACTION_VARIANTS) {
      const source = variant.variantOf ? getCard(variant.variantOf) : undefined;
      expect(source, variant.id).toBeDefined();
      if (!source || !isActionCard(source)) continue;
      expect(source.variantOf, `${variant.id} : une variante de variante`).toBeUndefined();
      expect(seen.has(source.id), `${source.id} a plus d’une variante`).toBe(false);
      seen.add(source.id);
      expect([`${source.id}-star`, `${source.id}-star2`], variant.id).toContain(variant.id);
      expect(variant.kind, variant.id).toBe(source.kind);
      expect(variant.faction, variant.id).toBe(source.faction);
      expect(variant.name, variant.id).toBe(source.name);
      expect(variant.text, variant.id).toBe(source.text);
      expect(variant.effects, variant.id).toEqual(source.effects);
      expect(variant.itemKind, variant.id).toBe(source.itemKind);
      expect(variant.flavor, variant.id).toBe(source.flavor);
      expect(variant.palette, variant.id).toBe(source.palette);
      expect(variant.glyph, variant.id).toBe(source.glyph);
      expect(['1S', '2S', '3S', 'COU'], variant.id).toContain(variant.rarity);
    }
    // Une variante par Collègue de base, et aucune pour un Objet.
    expect(seen).toEqual(
      new Set(BASE_ACTIONS.filter((card) => card.kind === 'COLLEAGUE').map((card) => card.id))
    );
  });
});
