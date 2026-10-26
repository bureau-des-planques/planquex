import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isPlanque } from '@/data';
import type { PlanqueCard } from '@/data/types';
import { attribuer, cinematiqueDe, libelle } from './attaque';

/**
 * **Une attaque, une animation** (D-098). Ces tests gardent la règle que le prototype a
 * tranchée : deux Pressions d'une même carte ne partagent jamais leur motif, et la
 * cinématique reste réservée à la grosse attaque d'un COU, d'un 3 étoiles ou d'un COMEX.
 *
 * Ils lisent le **catalogue réel** : une carte ajoutée demain est couverte sans qu'on y pense.
 */
const planques = ALL_CARDS.filter(isPlanque);

const DEUX_ATTAQUES = planques.filter((carte) => carte.attacks.length > 1);

describe('les chorégraphies de Pression — l’attribution des motifs (D-098)', () => {
  it('le catalogue contient bien des cartes à deux Pressions (le test mord)', () => {
    // Sans ce cas, le test suivant passerait sur une liste vide et ne garderait rien.
    expect(DEUX_ATTAQUES.length).toBeGreaterThan(20);
  });

  it('deux Pressions d’une même carte ne partagent jamais leur motif', () => {
    for (const carte of DEUX_ATTAQUES) {
      const motifs = [...attribuer(carte).values()];
      expect(new Set(motifs).size, `${carte.id} — ${motifs.join(', ')}`).toBe(motifs.length);
    }
  });

  it('le motif suit le nom de l’attaque quand il parle', () => {
    const parNom = (nom: string) => {
      const carte = planques.find((c) => c.attacks.some((a) => a.name === nom));
      expect(carte, `attaque « ${nom} » introuvable`).toBeDefined();
      const rang = (carte as PlanqueCard).attacks.findIndex((a) => a.name === nom);
      return attribuer(carte as PlanqueCard).get(rang);
    };
    expect(parNom('Norme ISO')).toBe('tampon');
    expect(parNom('Grève')).toBe('megaphone');
    expect(parNom('Yoga du rire')).toBe('zen');
  });

  it('quand deux Pressions veulent le même motif, la seconde cède', () => {
    // « Plan de carrière » et « Entretien annuel » parlent tous deux du CV. L'unicité passe
    // avant le nom : le premier garde son motif, le second prend le suivant.
    const drh = planques.find((c) => c.id === 'rh-drh-crown') as PlanqueCard;
    const motifs = attribuer(drh);
    const rang = (nom: string) => drh.attacks.findIndex((a) => a.name === nom);
    expect(motifs.get(rang('Plan de carrière'))).toBe('cv');
    expect(motifs.get(rang('Entretien annuel'))).not.toBe('cv');
  });

  it('un motif inconnu retombe sur son libellé, il ne plante pas', () => {
    expect(libelle('tampon')).toBe('Coup de tampon');
    expect(libelle('inexistant')).toBe('inexistant');
  });
});

describe('la cinématique est réservée (D-098)', () => {
  const legendaires = planques.filter((c) => c.rarity === 'COU' || c.rarity === '3S' || c.ex === true);

  it('le catalogue contient des légendaires (le test mord)', () => {
    expect(legendaires.length).toBeGreaterThan(20);
  });

  it('la grosse Pression d’un légendaire a sa cinématique, la petite non', () => {
    for (const carte of legendaires) {
      const plusChere = Math.max(...carte.attacks.map((a) => a.cost.length));
      for (const attaque of carte.attacks) {
        const attendu = attaque.cost.length === plusChere;
        expect(cinematiqueDe(carte, attaque), `${carte.id} — ${attaque.name}`).toBe(attendu);
      }
    }
  });

  it('une carte ordinaire n’a jamais de cinématique', () => {
    const ordinaires = planques.filter((c) => c.rarity !== 'COU' && c.rarity !== '3S' && c.ex !== true);
    expect(ordinaires.length).toBeGreaterThan(50);
    for (const carte of ordinaires) {
      for (const attaque of carte.attacks) {
        expect(cinematiqueDe(carte, attaque), `${carte.id} — ${attaque.name}`).toBe(false);
      }
    }
  });
});
