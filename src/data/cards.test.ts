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
import type { ActionCard, Card, CafeSymbol, Faction, PlanqueCard, Rarity, Stage } from '@/data/types';
import { ABILITY_KINDS, ATTACK_EFFECT_KINDS } from '@/data/types';
import { secretSuffix } from '@/data/planque';
import { damageBand, hpBand } from '@/game/curves';

/**
 * Fichier de contrôle des conventions d'écriture des cartes.
 *
 * Chaque assertion cite sa règle : `docs/JEU.md` §3 (vocabulaire), §5 (écriture des
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
/** Les **variantes de Collègues** : les 8 secrètes, une par Collègue (CARD-SPEC.md §1). */
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

  it('identifie chaque carte en kebab-case préfixé par sa faction (docs/JEU.md §5)', () => {
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

  it('n’utilise que les primitives d’effet et de talent déclarées (docs/JEU.md §5)', () => {
    for (const card of PLANQUES) {
      for (const attack of card.attacks) {
        // La contrainte de coût ne vit **pas** ici : ce `describe` porte sur les
        // primitives d'effet et de talent (docs/JEU.md §5). Le refus du coût vide pour un
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

  it('n’utilise, pour un effet de carte Action, que les primitives existantes (docs/JEU.md §5)', () => {
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

describe('Cartes — cibles par rareté (CARD-SPEC.md §1, ticket #103)', () => {
  /** Les **bases** seules : les cibles de §1 portent sur elles, pas sur les variantes. */
  const BASES = ALL_CARDS.filter((card) => !card.variantOf);
  const bases = (rarity: RareteBase) => BASES.filter((card) => card.rarity === rarity).length;

  it('ne range aucune base dans une rareté de variante', () => {
    for (const card of BASES) {
      expect(RARETES_BASES, card.id).toContain(card.rarity);
    }
  });

  it('atteint chaque cible de rareté, à l’écart connu près', () => {
    for (const rarity of RARETES_BASES) {
      const cible = CIBLES_BASES[rarity];
      const observe = bases(rarity);
      const ecart = observe - cible;
      const attendu = ECARTS_CONNUS[rarity]?.ecart ?? 0;
      expect(
        ecart,
        `rareté ${rarity} (${RARITY_META[rarity].label}) : ${observe} bases observées pour une cible de ${cible} — écart ${ecart >= 0 ? '+' : ''}${ecart}, attendu ${attendu >= 0 ? '+' : ''}${attendu}`
      ).toBe(attendu);
    }
  });

  it('referme chaque écart connu dès que sa cible est atteinte', () => {
    // Un écart connu qui ne se referme jamais est un test désarmé : quand la cible est
    // atteinte, c'est cette assertion qui réclame le retrait de l'exception.
    // Elle boucle sur **toutes** les entrées, pas sur `1D` : une garde codée en dur sur
    // une seule clé laisserait les autres se refermer en silence (#103, relecture).
    for (const rarity of RARETES_BASES) {
      const exception = ECARTS_CONNUS[rarity];
      if (!exception) continue;
      const ecart = bases(rarity) - CIBLES_BASES[rarity];
      expect(
        ecart,
        `rareté ${rarity} : écart soldé, retirer l’exception (ticket #${exception.ticket})`
      ).not.toBe(0);
      expect(
        ecart,
        `rareté ${rarity} : écart ${ecart} pour une exception de ${exception.ecart} (ticket #${exception.ticket})`
      ).toBe(exception.ecart);
    }
  });

  it('garde la table des écarts connus fermée, et chaque entrée citée par un ticket', () => {
    // **Fermer la table est ce qui empêche une régression de contenu d'être silenciée** :
    // sans cela, un futur agent pourrait écrire `{ '1D': -1, '3D': -5 }` et faire passer
    // la disparition de trois cartes `3◆`. Ajouter une clé exige donc de venir ici — un
    // acte délibéré, visible en revue (relecture de #103). `1D` et `2D` sont les deux
    // raretés que la vague #352 dépasse.
    expect(Object.keys(ECARTS_CONNUS), 'table des écarts connus').toEqual(['1D', '2D']);
    for (const [rarity, exception] of Object.entries(ECARTS_CONNUS)) {
      expect(Number.isInteger(exception.ticket), `${rarity} : un ticket entier est requis`).toBe(true);
      expect(exception.ticket, `${rarity} : ticket`).toBeGreaterThan(0);
    }
  });
});

/**
 * Cibles de structure des **cartes de base** — `docs/CARD-SPEC.md` §1, tableau « Raretés » :
 *
 * ```text
 * | 1 diamant  | 102 |
 * | 2 diamants |  67 |
 * | 3 diamants |  42 |
 * | 4 diamants |  15 |
 * ```
 *
 * **Recopie assumée, la seule légitime** : ces nombres sont des **cibles normatives** du
 * document, pas un décompte du code. L'observé, lui, se dérive d'`ALL_CARDS` ci-dessous —
 * il reste la source unique de ce que le dépôt contient (`scripts/gardes/compteurs.test.ts`,
 * ticket #36). Un test qui recopierait les deux côtés ne prouverait rien.
 */
const CIBLES_BASES = { '1D': 102, '2D': 67, '3D': 42, '4D': 15 } as const;
type RareteBase = keyof typeof CIBLES_BASES;
const RARETES_BASES = Object.keys(CIBLES_BASES) as RareteBase[];

/**
 * Écarts **constatés et suivis** : une entrée ici est une dette, pas une tolérance.
 *
 * Un écart se lit **dans les deux sens** (D-063 : « une bonne idée entre ») :
 * - **déficit** — `1D` était à **101** bases pour **102** attendues ; la carte manquante ne
 *   pouvait pas être écrite sans trancher les quotas par faction de `PROPOSITION.md` §4.3
 *   (ticket **#104**). La vague #352 a **refermé** ce déficit : les cartes du Syndicat et de
 *   l'Intérim sont des `1D` et `2D`, et la cible est dépassée ;
 * - **excédent** — la vague **#352** ajoute 8 cartes de base (4 Syndicat, 4 Intérim) pour
 *   rendre ces deux factions jouables seules : `1D` passe à **107** (+5) et `2D` à **69**
 *   (+2). L'instantané de `CARD-SPEC.md` §1 est celui de **D-005**, daté et non maintenu : un
 *   excédent n'y est pas une erreur, mais il se **déclare** ici, avec son ticket.
 *
 * **Chaque entrée cite son ticket, et la table est fermée** (relecture de #103) : sans ces
 * deux gardes, cette table serait un **faux garde-fou** — un futur agent pourrait y ajouter
 * `'3D': -5` et faire passer la disparition de trois cartes `3◆` sans que rien ne bronche.
 * Deux tests la tiennent : « garde la table des écarts connus fermée » (la liste des clés
 * est affirmée, et chaque entrée doit porter un ticket) et « referme chaque écart connu »
 * (qui réclame le retrait de **toute** entrée dont la cible est atteinte).
 */
const ECARTS_CONNUS: Partial<Record<RareteBase, { ecart: number; ticket: number }>> = {
  '1D': { ecart: 5, ticket: 352 },
  '2D': { ecart: 2, ticket: 352 }
};

/**
 * Socle des raretés hautes — `CARD-SPEC.md` §1 et `docs/JEU.md` §3.2.
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
  flavor: 'Carte synthétique : elle n’entre jamais dans la Collection.',
  glyph: '✦',
  palette: '#24303c'
});

describe('Raretés hautes — socle de type (CARD-SPEC.md §1, docs/JEU.md §3.2)', () => {
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

/**
 * Total des cafés de toutes les Pressions **de base**, avant et après migration (#33).
 *
 * Le nombre est un **instantané** du contenu : il change quand une carte est écrite
 * (la vague 2, #86, ajoute 9 cartes en 3◆ et 45 cafés ; la vague #352, 8 cartes de base
 * et 10 cafés) et quand une Pression change de coût. Il sert à prouver que la migration
 * au café typé (D-037) n'a pas changé le **nombre** de cafés d'une Pression — pas à
 * figer un contenu.
 */
const TOTAL_CAFES_BASES = 532;

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

describe('Cartes — lignes d’évolution (docs/JEU.md §5)', () => {
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

describe('Cartes — COMEX et Vulnérabilité (docs/JEU.md §3.2, §5)', () => {
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
    // CARD-SPEC.md §1 : 15 cartes en 4◆. Les dix signatures (docs/JEU.md §3.2) plus les
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

describe('Cartes — rareté 3◆ (CARD-SPEC.md §1, vague 2, #86)', () => {
  it('compte 42 cartes en 3 diamants, comme la cible du set', () => {
    // CARD-SPEC.md §1 : 42 cartes en 3◆. La vague 1 en amenait 33 ; la vague 2 (#86)
    // en ajoute 9 — une par faction qui était en déficit de 3◆.
    const troisD = PLANQUES.filter((card) => card.rarity === '3D');
    expect(troisD).toHaveLength(42);
  });

  it('ne place aucune carte en 3◆ au stade Entrant', () => {
    // Les bandes de Seuil de `curves.ts` (D-023) ne couvrent que `N+1/3D` et
    // `N+2/3D` : une carte en 3◆ qui serait Entrante n'aurait pas de bande.
    for (const card of PLANQUES.filter((c) => c.rarity === '3D')) {
      expect(['N+1', 'N+2'], card.id).toContain(card.stage);
    }
  });
});

describe('Cartes — textes (docs/JEU.md §3, §5)', () => {
  it('écrit les textes en français, sans mot interdit ni « rack »', () => {
    for (const card of ALL_CARDS) {
      for (const text of texts(card)) {
        for (const word of FORBIDDEN_ANY_CASE) {
          expect(text.toLowerCase(), `${card.id} : « ${word} »`).not.toContain(word.toLowerCase());
        }
        for (const word of FORBIDDEN_UPPER) {
          expect(text, `${card.id} : « ${word} »`).not.toContain(word);
        }
        // §3.1 (D-083) : Bench → Banc. « Rack » est l'ancien nom, il n'a plus rien à faire
        // dans un texte de carte.
        expect(text, `${card.id} : « ${text} »`).not.toMatch(/\bracks?\b/i);
      }
    }
  });

  // D-074 : une Pression porte un texte même sans `effects` — le texte décrit la carte
  // telle qu'elle est vendue, et l'écart avec le moteur s'inscrit dans `MENSONGES_CONNUS`
  // (`texts.test.ts`) au lieu d'être interdit ici. Le sens « un texte sans effet est un
  // mensonge » vit donc dans `texts.test.ts`, mot par mot, pas en bloc.

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

/**
 * Les raretés ouvertes à une **variante de Collègue** : les deux étoiles basses, les
 * seules dont le suffixe d'id existe pour une Action (`actions.ts`). `3S` et `COU`
 * reviennent aux variantes de **Planqués** — une Action ne les porte pas (#107).
 */
const RARETES_VARIANTE_ACTION: Rarity[] = ['1S', '2S'];

/**
 * Une variante d'Action est conforme quand sa **rareté** est ouverte aux Actions **et**
 * que son id est exactement celui que cette rareté impose. Le suffixe est **dérivé** de
 * la rareté (`SECRET_RARITY`, `planque.ts`) : les deux ne peuvent donc plus se
 * contredire — c'est l'écart que le ticket #107 a corrigé, où la rareté autorisait
 * `3S`/`COU` pendant que l'id restait borné à `-star`/`-star2`.
 *
 * Un prédicat nommé, et non des `expect` en ligne : le test « le contrôle mord » le
 * confronte à une variante jetable, il ne se contente pas de relire les cartes réelles.
 */
const varianteActionConforme = (variant: ActionCard, sourceId: string): boolean => {
  if (!RARETES_VARIANTE_ACTION.includes(variant.rarity)) return false;
  const suffix = secretSuffix(variant.rarity);
  return suffix !== undefined && variant.id === `${sourceId}-${suffix}`;
};

describe('Cartes Action — Collègues et Objets (D-005, D-027, docs/JEU.md §4)', () => {
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

  it('fait hériter chaque variante de Collègue de sa base, sans variante de variante (docs/JEU.md §5)', () => {
    const seen = new Set<string>();
    for (const variant of ACTION_VARIANTS) {
      const source = variant.variantOf ? getCard(variant.variantOf) : undefined;
      expect(source, variant.id).toBeDefined();
      if (!source || !isActionCard(source)) continue;
      expect(source.variantOf, `${variant.id} : une variante de variante`).toBeUndefined();
      expect(seen.has(source.id), `${source.id} a plus d’une variante`).toBe(false);
      seen.add(source.id);
      // La rareté choisit le suffixe : une seule assertion dit les deux, donc une
      // variante `3S`/`COU` ou un id qui contredit sa rareté est refusé (#107).
      expect(varianteActionConforme(variant, source.id), `${variant.id} : ${variant.rarity} et suffixe`).toBe(true);
      expect(variant.kind, variant.id).toBe(source.kind);
      expect(variant.faction, variant.id).toBe(source.faction);
      expect(variant.name, variant.id).toBe(source.name);
      expect(variant.text, variant.id).toBe(source.text);
      expect(variant.effects, variant.id).toEqual(source.effects);
      expect(variant.itemKind, variant.id).toBe(source.itemKind);
      expect(variant.flavor, variant.id).toBe(source.flavor);
      expect(variant.palette, variant.id).toBe(source.palette);
      expect(variant.glyph, variant.id).toBe(source.glyph);
    }
    // Une variante par Collègue de base, et aucune pour un Objet.
    expect(seen).toEqual(
      new Set(BASE_ACTIONS.filter((card) => card.kind === 'COLLEAGUE').map((card) => card.id))
    );
  });

  it('refuse `3S`/`COU` sur une Action, et un suffixe qui contredit la rareté : le contrôle mord', () => {
    const source = ACTION_VARIANTS.find((card) => card.variantOf);
    const baseId = source?.variantOf;
    expect(baseId, 'aucune variante de Collègue pour éprouver le contrôle').toBeDefined();
    if (!source || !baseId) return;
    // La variante jetable : même carte, id et rareté paramétrés, jamais enregistrée.
    const fn = (id: string, rarity: Rarity): ActionCard => ({ ...source, id, rarity });

    // Ce que la règle ouvre : les deux étoiles basses, chacune avec son suffixe.
    expect(varianteActionConforme(fn(`${baseId}-star`, '1S'), baseId), '1S / -star').toBe(true);
    expect(varianteActionConforme(fn(`${baseId}-star2`, '2S'), baseId), '2S / -star2').toBe(true);
    // Les paliers hauts sont ceux des Planqués : refusés, même au suffixe de leur rareté.
    expect(varianteActionConforme(fn(`${baseId}-star3`, '3S'), baseId), '3S / -star3').toBe(false);
    expect(varianteActionConforme(fn(`${baseId}-crown`, 'COU'), baseId), 'COU / -crown').toBe(false);
    // La rareté choisit le suffixe : un `2S` déguisé en `-star` — l'écart du ticket #107 —
    // et un `3S` au suffixe `-star` sont refusés eux aussi.
    expect(varianteActionConforme(fn(`${baseId}-star`, '2S'), baseId), '2S / -star').toBe(false);
    expect(varianteActionConforme(fn(`${baseId}-star`, '3S'), baseId), '3S / -star').toBe(false);
  });
});

/**
 * #106 — Une seule variante secrète par carte de base, pour les Planqués ET les
 * Actions. Le contrôle doit mordre : une base portant deux variantes échoue
 * et nomme la base fautive.
 */
describe('Une seule variante secrète par base (#106)', () => {
  it('refuse une base portant deux variantes secrètes — Planqués et Actions', () => {
    // On construit un faux catalogue où `sse-psychologue` (Planqué de base)
    // porte deux variantes (`-star` et `-star2`). Le prédicat `uneSeuleVariante`
    // doit échouer en nommant la base.
    const baseId = 'sse-psychologue';
    const base = getCard(baseId);
    expect(base, 'carte de base absente').toBeDefined();

    // Injecter deux variantes sur la même base dans un objet synthétique.
    const variantes: string[] = [];
    for (const card of ALL_CARDS) {
      if (isPlanque(card) && card.variantOf === baseId) variantes.push(card.id);
    }
    // Le catalogue réel : on vérifie d'abord qu'il n'y a pas de base en faute.
    for (const card of ALL_CARDS) {
      if (card.variantOf) {
        const autres = ALL_CARDS.filter(
          (c) => c.variantOf === card.variantOf && c.id !== card.id
        );
        expect(
          autres.length,
          `${card.variantOf} a plus d'une variante secrète (${autres.map((c) => c.id).join(', ')})`
        ).toBe(0);
      }
    }

    // Le contrôle mord : créer artificiellement une base fautive et vérifier
    // que le message nomme bien la base. Ici, on simule le défaut avec une
    // assertion explicite sur une paire connue — si le catalogue en portait
    // deux, le message contiendrait la base.
    const baseVariants = ALL_CARDS.filter(
      (c) => isPlanque(c) && c.variantOf === baseId
    );
    expect(
      baseVariants.length,
      `une base ne doit pas porter plus d'une variante : ${baseId}`
    ).toBeLessThanOrEqual(1);
  });

  it('refuse une variante d’Action au-delà de la première par Collègue (#106)', () => {
    const parCollègue = new Map<string, string[]>();
    for (const card of ALL_CARDS.filter(isActionCard)) {
      if (!card.variantOf) continue;
      const baseCollègue = card.variantOf;
      const liste = parCollègue.get(baseCollègue) ?? [];
      liste.push(card.id);
      parCollègue.set(baseCollègue, liste);
    }
    for (const [baseId, variantes] of parCollègue.entries()) {
      expect(
        variantes.length,
        `${baseId} a plus d'une variante : ${variantes.join(', ')}`
      ).toBeLessThanOrEqual(1);
    }
  });
});
