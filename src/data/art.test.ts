import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CARDS } from './index';

/**
 * Registre des illustrations (spec #95, ticket #96).
 *
 * Le test de rendu n'existe pas ici — il vit dans les captures (`npm run capturer`,
 * `AGENTS.md` §6). On vérifie ici les **conventions** du champ `art`, celles qu'une
 * revue humaine ne peut pas tenir à jour sur 286 cartes.
 */
const SERVED = 'public/design/illustrations';

describe('Cartes — illustrations (art) (spec #95)', () => {
  it("les fichiers d'images existent quand ils sont définis", () => {
    const imageDir = join(process.cwd(), SERVED);
    for (const card of ALL_CARDS) {
      if (card.art) {
        const path = join(imageDir, card.art);
        expect(existsSync(path), `Le fichier d'image '${card.art}' n'existe pas pour la carte ${card.id}`).toBe(true);
      }
    }
  });

  it("respecte la convention de nommage : l'image porte l'id de la carte de base (#95)", () => {
    // `art` est hérité par les variantes secrètes (`secretVariant` recopie la source,
    // `src/data/planque.ts`), donc l'id attendu est celui du **socle** : `variantOf`.
    for (const card of ALL_CARDS) {
      if (!card.art) continue;
      const baseId = card.variantOf ?? card.id;
      expect(card.art, `convention d'illustration pour ${card.id}`).toBe(`${baseId}.webp`);
    }
  });

  it('aucune illustration orpheline : chaque fichier servi est référencé', () => {
    const imageDir = join(process.cwd(), SERVED);
    if (!existsSync(imageDir)) return;
    const referenced = new Set(ALL_CARDS.map((card) => card.art).filter(Boolean));
    for (const file of readdirSync(imageDir)) {
      expect(referenced.has(file), `illustration orpheline : ${file} (aucune carte ne la porte)`).toBe(true);
    }
  });
});