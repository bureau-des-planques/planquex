import type { Card, PlanqueCard } from './types';
import { planqueBase } from './planque';

/**
 * Faction **Intérim** (`INT`) — Dragon, vivier **Bureaux** (D-024, D-026).
 * Archétype combo / aggro : multi-énergie, chaos, **aucune vulnérabilité**
 * (`CARD-SPEC.md` §3). Les intitulés sont des postes réels, les Pressions des
 * tâches ou documents de mission, les Talents des compétences de métier (D-027).
 *
 * 4 entrées (`PROPOSITION.md` §4.3), toutes des bases : la ligne à 3 stades plus
 * la carte signature COMEX épuise le quota. Seuil par stade/rareté et dégâts par
 * café conformes à `CARD-SPEC.md` §2 (D-021, D-023) ; COMEX `ex: true` en 4D,
 * valant 2 Interventions (D-020).
 */

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('INTERIM');

export const INTERIM_CARDS: PlanqueCard[] = [
  base({
    id: 'interim-interimaire',
    name: 'Intérimaire',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Mission courte', cost: 1, damage: 20 }],
    flavor: 'Il connaît le site mieux que le directeur. Il part vendredi.'
  }),
  base({
    id: 'interim-interimaire-confirme',
    evolvesFrom: 'interim-interimaire',
    name: 'Intérimaire confirmé',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    ability: {
      name: 'Polyvalence',
      text: 'Une fois par tour : attache 1 café à ce Planqué.',
      kind: 'attachEnergy',
      oncePerTurn: true
    },
    attacks: [{ name: 'Démerde', cost: 2, damage: 50 }],
    flavor: 'Il a fait le boulot de trois personnes. Il est payé pour une.'
  }),
  base({
    id: 'interim-chef-equipe-interimaire',
    evolvesFrom: 'interim-interimaire-confirme',
    name: "Chef d'équipe intérimaire",
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      {
        name: 'Site différent',
        cost: 2,
        damage: 60,
        text: 'Échange ce Planqué avec un Planqué du Rack.',
        effects: [{ kind: 'switchSelf' }]
      },
      {
        name: 'Prime de précarité',
        cost: 3,
        damage: 100,
        text: 'Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: "Il gère l'équipe. Il n'a pas de badge."
  }),
  // COMEX : carte signature de la faction, 2 Interventions (D-020, D-026).
  base({
    id: 'interim-interimaire-legendaire-ex',
    evolvesFrom: 'interim-interimaire-confirme',
    name: 'Intérimaire légendaire',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      {
        name: 'Renfort express',
        cost: 2,
        damage: 70,
        text: 'Envoie 1 café du Planqué adverse au rebut.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      },
      {
        name: 'Prime de précarité',
        cost: 3,
        damage: 120,
        text: 'Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: 'Il a sauvé la production. Le badge a expiré avant les remerciements.'
  })
];

/**
 * Les 4 entrées de `PROPOSITION.md` §4.3 sont épuisées par les bases : pas de
 * variante secrète pour l'Intérim. Le tableau reste déclaré pour que l'enregistrement
 * et les tests suivent la même forme que les autres factions.
 */
export const INTERIM_VARIANTS: Card[] = [];

export const ALL_INTERIM_CARDS: Card[] = [...INTERIM_CARDS, ...INTERIM_VARIANTS];
