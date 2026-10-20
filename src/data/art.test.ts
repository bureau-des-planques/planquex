import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CARDS } from './index';

describe('Cartes — illustrations (art) (spec #95)', () => {
  it("les fichiers d'images existent quand ils sont définis", () => {
    const imageDir = join(process.cwd(), 'public/design/illustrations');
    for (const card of ALL_CARDS) {
      if (card.art) {
        const path = join(imageDir, card.art);
        expect(existsSync(path), `Le fichier d'image '${card.art}' n'existe pas pour la carte ${card.id}`).toBe(true);
      }
    }
  });
});