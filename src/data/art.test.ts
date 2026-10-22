import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CARDS } from './index';
import { artUrl } from '@/art';

/**
 * Registre des illustrations (spec #95, ticket #96).
 *
 * Le test de rendu n'existe pas ici — il vit dans les captures (`npm run capturer`,
 * `AGENTS.md` §6). On vérifie ici les **conventions** du champ `art`, celles qu'une
 * revue humaine ne peut pas tenir à jour sur l'ensemble du set.
 */
const SERVED = 'design/illustrations';

describe('Cartes — illustrations (art) (spec #95, D-045)', () => {
  it("les fichiers d'images existent quand ils sont définis", () => {
    const imageDir = join(process.cwd(), SERVED);
    for (const card of ALL_CARDS) {
      if (card.art) {
        const path = join(imageDir, card.art);
        expect(existsSync(path), `Le fichier d'image '${card.art}' n'existe pas pour la carte ${card.id}`).toBe(true);
      }
    }
  });

  /**
   * **La garde qui remplace #120** (D-045). Depuis que la copie servie a disparu, une image
   * peut exister dans le registre **et** ne pas être vue par Vite : la carte afficherait
   * alors silencieusement son aplat. Ce test traverse la même résolution que l'écran
   * (`@/art`), donc il tombe si le glob cesse de ramasser un fichier.
   */
  it('chaque illustration est résolue par Vite (le glob de @/art la voit)', () => {
    for (const card of ALL_CARDS) {
      if (!card.art) continue;
      expect(artUrl(card.art), `l'illustration '${card.art}' de ${card.id} n'est pas résolue par @/art`).toBeTruthy();
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

  it('aucune illustration orpheline : chaque fichier du registre est référencé', () => {
    const imageDir = join(process.cwd(), SERVED);
    if (!existsSync(imageDir)) return;
    const referenced = new Set(ALL_CARDS.map((card) => card.art).filter(Boolean));
    for (const file of readdirSync(imageDir)) {
      // Le registre porte aussi le README, les prompts, les accents et les planches : seules
      // les illustrations comptent ici.
      if (!file.endsWith('.webp')) continue;
      expect(referenced.has(file), `illustration orpheline : ${file} (aucune carte ne la porte)`).toBe(true);
    }
  });
});