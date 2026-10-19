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
import type { AttackEffectKind, Card, Faction, PlanqueCard, Rarity, Stage } from '@/data/types';
import { damageBand, hpBand } from '@/game/curves';
import { isValidCafeCost } from '@/game/rules';

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

const EFFECT_KINDS: AttackEffectKind[] = [
  'healSelf',
  'healAll',
  'status',
  'draw',
  'discardEnergy',
  'selfDamage',
  'switchSelf',
  'reduceDamage'
];

const ABILITY_KINDS: NonNullable<PlanqueCard['ability']>['kind'][] = [
  'heal',
  'draw',
  'attachEnergy',
  'reduceDamage',
  'antiStatus'
];

/** Les **Planqués** : seuls à porter un stade, un Seuil, des Pressions, une Vulnérabilité. */
const PLANQUES = ALL_CARDS.filter(isPlanque);
/** Les Planqués de base (hors variantes) : les seuls à définir une ligne d'évolution. */
const BASE_PLANQUES = PLANQUES.filter((card) => !card.variantOf);
/** Les **cartes Action** : 8 Collègues et 3 Objets (D-005). */
const ACTIONS = ALL_CARDS.filter(isActionCard);

/** `AGENTS.md` §3.2 : chaque faction est vulnérable à une seule autre. */
const WEAKNESS: Record<Faction, Faction | null> = {
  SSE: 'MANAGEMENT',
  MANAGEMENT: 'QVT',
  QVT: 'AMELIORATION',
  AMELIORATION: 'ATELIER',
  RH: 'DIRECTION',
  ATELIER: 'RH',
  DIRECTION: 'ATELIER',
  SYNDICAT: 'MANAGEMENT',
  INTERIM: null,
  SUPPORT: 'ATELIER'
};

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
        expect(attack.cost, `${card.id}/${attack.name}`).toBeGreaterThanOrEqual(0);
        expect(attack.damage, `${card.id}/${attack.name}`).toBeGreaterThanOrEqual(0);
        for (const effect of attack.effects ?? []) {
          expect(EFFECT_KINDS, `${card.id}/${attack.name}`).toContain(effect.kind);
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
        expect(EFFECT_KINDS, card.id).toContain(effect.kind);
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
 * Aucune carte réelle de ces raretés n'existe encore : les cartes ci-dessous sont
 * **synthétiques** et ne sont jamais enregistrées dans `ALL_CARDS`. Elles servent
 * uniquement à prouver que le type et les métadonnées acceptent les nouveaux paliers.
 */
const RARITES_HAUTES: Rarity[] = ['3S', 'COU'];
const TOUTES_LES_RARETES: Rarity[] = ['1D', '2D', '3D', '4D', '1S', '2S', '3S', 'COU'];

const carteSynthetique = (rarity: Rarity): Card => ({
  id: `sse-socle-${rarity.toLowerCase()}`,
  name: `Carte de test ${rarity}`,
  kind: 'PLANQUE',
  faction: 'SSE',
  stage: 'ENTRANT',
  rarity,
  hp: 60,
  retreat: 1,
  weakness: 'MANAGEMENT',
  attacks: [{ name: 'Pression de test', cost: 1, damage: 10 }],
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

/**
 * Socle du coût de café typé — ticket #30, étape *expand*. Cette carte est
 * **synthétique** : aucune carte réelle ne porte `cafeCost` tant que #33 n'a pas migré.
 */
const CARTE_CAFE_TYPE: PlanqueCard = {
  id: 'sse-socle-cafe-type',
  name: 'Carte de test à café typé',
  kind: 'PLANQUE',
  faction: 'SSE',
  stage: 'ENTRANT',
  rarity: '2D',
  hp: 60,
  retreat: 1,
  weakness: 'MANAGEMENT',
  attacks: [{ name: 'Pression de test', cost: 2, cafeCost: { type: 'QVT', amount: 2 }, damage: 40 }],
  flavor: 'Carte synthétique : elle n’entre jamais dans le Parc.',
  glyph: '✦',
  palette: '#24303c'
};

describe('Coût de café typé — expand (#30)', () => {
  it('accepte un coût typé à côté du coût numérique, avec au moins 1 café', () => {
    const attack = CARTE_CAFE_TYPE.attacks[0];
    expect(attack.cost).toBe(2);
    expect(attack.cafeCost).toEqual({ type: 'QVT', amount: 2 });
    expect(CARD_BY_ID.has(CARTE_CAFE_TYPE.id)).toBe(false);
  });

  it('garde le coût numérique des cartes existantes et valide tout coût typé présent', () => {
    for (const card of PLANQUES) {
      for (const attack of card.attacks) {
        expect(Number.isInteger(attack.cost), `${card.id}/${attack.name}`).toBe(true);
        expect(attack.cost, `${card.id}/${attack.name}`).toBeGreaterThanOrEqual(0);
        if (attack.cafeCost) {
          expect(isValidCafeCost(attack.cafeCost), `${card.id}/${attack.name}`).toBe(true);
        }
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
      expect(variant.id, variant.id).toMatch(/-star2?$/);
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
        const band = damageBand(attack.cost);
        expect(band, `${card.id}/${attack.name} : coût ${attack.cost} café(s) non couvert`).toBeDefined();
        if (!band) continue;
        const label = `${card.id}/${attack.name} à ${attack.cost} café(s)`;
        expect(attack.damage, label).toBeGreaterThanOrEqual(band[0]);
        expect(attack.damage, label).toBeLessThanOrEqual(band[1]);
      }
    }
  });
});

describe('Cartes — COMEX et Vulnérabilité (AGENTS.md §3.2, §5)', () => {
  it('vulnérabilise chaque carte selon la table des factions', () => {
    for (const card of PLANQUES) {
      expect(card.weakness, card.id).toBe(WEAKNESS[card.faction]);
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
  it('compte 8 Collègues et 3 Objets au lancement (CARD-SPEC.md §1)', () => {
    expect(ACTIONS.filter((card) => card.kind === 'COLLEAGUE')).toHaveLength(8);
    expect(ACTIONS.filter((card) => card.kind === 'OBJET')).toHaveLength(3);
    expect(ACTIONS).toHaveLength(11);
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
});
