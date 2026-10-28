import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CARDS, CARD_BY_ID } from './index';
import { artFileOf, artUrl } from '@/art';

/**
 * Registre des illustrations (spec #95, ticket #96, D-045, **D-139**).
 *
 * Le test de rendu n'existe pas ici — il vit dans les captures (`npm run capturer`,
 * `AGENTS.md` §6). On vérifie ici les **conventions** du champ `art`, celles qu'une
 * revue humaine ne peut pas tenir à jour sur l'ensemble du set.
 *
 * **Ce que D-139 change** : une variante ne recopie plus l'`art` de sa base. Trois
 * conséquences, et trois tests :
 *
 * 1. une carte qui **déclare** `art` déclare **son** fichier (`<son id>.webp`), variante
 *    comprise — c'était `'<variantOf>.webp'`, c'est-à-dire la copie, déguisée en règle ;
 * 2. un fichier du registre qu'aucune carte ne déclare reste une **orpheline** ;
 * 3. le **repli** d'une variante sans image se fait à la lecture (`artFileOf`, `@/art`),
 *    pas dans la donnée — la copie diverge à la première regénération de la base.
 */
const SERVED = 'design/illustrations';

/** Une carte, réduite à ce que le contrôle de nommage regarde. */
type ArtCarte = { id: string; art?: string };

/** Les manquements à la convention de nommage : l'image **porte l'id de sa carte**. */
function problemesDeNommage(cartes: readonly ArtCarte[]): string[] {
  const problemes: string[] = [];
  for (const carte of cartes) {
    if (!carte.art) continue;
    if (carte.art !== `${carte.id}.webp`)
      problemes.push(`${carte.id} : « ${carte.art} » ne porte pas l'id de la carte`);
  }
  return problemes;
}

/**
 * Les dimensions d'un WebP, lues dans l'en-tête — sans dépendance (le registre est
 * versionné et le test tourne en `node`) : `VP8 ` (avec perte) porte sa taille à
 * l'octet 26, `VP8X` (étendu) à l'octet 24, en 24 bits.
 */
function dimensionsWebp(chemin: string): { largeur: number; hauteur: number } {
  const octets = readFileSync(chemin);
  if (octets.toString('latin1', 0, 4) !== 'RIFF' || octets.toString('latin1', 8, 12) !== 'WEBP')
    throw new Error(`pas un WebP : ${chemin}`);
  const morceau = octets.toString('latin1', 12, 16);
  if (morceau === 'VP8X') {
    return { largeur: 1 + octets.readUIntLE(24, 3), hauteur: 1 + octets.readUIntLE(27, 3) };
  }
  if (morceau === 'VP8 ') {
    // 3 octets de « frame tag », puis le code de départ (9d 01 2a) : 26 et 28.
    if (octets[23] !== 0x9d || octets[24] !== 0x01 || octets[25] !== 0x2a)
      throw new Error(`WebP « VP8 » sans code de départ : ${chemin}`);
    return { largeur: octets.readUInt16LE(26) & 0x3fff, hauteur: octets.readUInt16LE(28) & 0x3fff };
  }
  throw new Error(`WebP de forme inconnue (${morceau}) : ${chemin}`);
}

describe('Cartes — illustrations (art) (spec #95, D-045, D-139)', () => {
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

  /**
   * **La règle de D-139, à la place de l'ancienne** (`art === '<variantOf>.webp'`).
   * L'image d'une carte porte **son** id : une variante qui déclare `art` déclare donc
   * sa propre planche, jamais celle de sa base. C'est aussi ce qui rend l'orpheline
   * détectable — une copie ne crée aucun fichier, donc aucune image à vérifier.
   */
  it("respecte la convention de nommage : l'image porte l'id de la carte (D-139)", () => {
    const problemes = problemesDeNommage(ALL_CARDS);
    expect(problemes, problemes.join('\n')).toEqual([]);
  });

  it('le contrôle mord : une variante qui recopie l’image de sa base est refusée', () => {
    // Le défaut exact que D-139 a levé : `secretVariant` recopiait `art`, donc
    // `-star3` portait `sse-medecin-travail.webp`. Le contrôle doit le voir.
    const variante = CARD_BY_ID.get('sse-medecin-travail-star3');
    expect(variante?.variantOf, 'la variante doit exister pour que ce test ait un sujet').toBe(
      'sse-medecin-travail'
    );
    const copie: ArtCarte[] = ALL_CARDS.map((card) =>
      card.id === 'sse-medecin-travail-star3' ? { id: card.id, art: 'sse-medecin-travail.webp' } : card
    );
    expect(problemesDeNommage(copie).join('\n')).toContain('sse-medecin-travail-star3');
  });

  /**
   * **Le gabarit** — même cadrage, même poids que les images de base (critère de #340).
   * Sans ce contrôle, une image 1536×1024 ou un WebP de 4 Mo passerait la revue : le
   * registre ne regardait que l'existence du fichier.
   */
  it('chaque illustration est carrée, au moins 1024 px, et pèse moins de 1 Mo', () => {
    const imageDir = join(process.cwd(), SERVED);
    const problemes: string[] = [];
    for (const card of ALL_CARDS) {
      if (!card.art) continue;
      const chemin = join(imageDir, card.art);
      if (!existsSync(chemin)) continue; // le test d'existence le dit, plus haut.
      const { largeur, hauteur } = dimensionsWebp(chemin);
      if (largeur !== hauteur) problemes.push(`${card.art} : ${largeur}×${hauteur}, pas carrée`);
      if (largeur < 1024) problemes.push(`${card.art} : ${largeur} px de large, moins que les 1024 du gabarit`);
      const poids = statSync(chemin).size;
      // Les 225 images de base pèsent au plus 235 ko ; 1 Mo laisse la marge d'un rendu
      // plus détaillé sans laisser passer une planche non compressée.
      if (poids > 1_000_000) problemes.push(`${card.art} : ${poids} octets, plus d'1 Mo`);
    }
    expect(problemes, problemes.join('\n')).toEqual([]);
  });

  /**
   * **Le repli de D-139**, prouvé sur la fonction que l'écran appelle : `art` déclaré →
   * le sien ; sinon celui de `variantOf` ; sinon rien (la carte garde son aplat).
   */
  it('une variante sans image résout celle de sa base (D-139)', () => {
    const variante = CARD_BY_ID.get('sse-infirmiere-travail-star');
    expect(variante?.variantOf).toBe('sse-infirmiere-travail');
    expect(variante?.art, 'la variante ne doit pas déclarer art').toBeUndefined();
    expect(artFileOf(variante!)).toBe('sse-infirmiere-travail.webp');
    expect(artUrl(artFileOf(variante!)), 'le repli doit être une image que Vite sert').toBeTruthy();
  });

  it('une variante qui a sa propre image ne résout pas celle de sa base', () => {
    expect(artFileOf({ art: 'sse-medecin-travail-star3.webp', variantOf: 'sse-medecin-travail' })).toBe(
      'sse-medecin-travail-star3.webp'
    );
  });

  it('le repli ne fabrique rien quand la base n’a pas d’image', () => {
    // Aucune base du set n'est sans illustration aujourd'hui ; la résolution doit
    // pourtant rendre `undefined` dans ce cas, sinon elle afficherait un 404 muet.
    expect(artFileOf({ variantOf: 'sse-sans-planche' }, { art: undefined })).toBeUndefined();
    expect(artFileOf({ variantOf: 'sse-sans-planche' }), 'une base inconnue ne donne rien').toBeUndefined();
    expect(artFileOf({}), 'une carte sans art ni variante ne donne rien').toBeUndefined();
  });

  it('aucune illustration orpheline : chaque fichier du registre est référencé', () => {
    const imageDir = join(process.cwd(), SERVED);
    if (!existsSync(imageDir)) return;
    // Seules les **déclarations** comptent : le repli de D-139 ne référence aucun
    // fichier de plus, donc une image que personne ne déclare reste une orpheline.
    const referenced = new Set(ALL_CARDS.map((card) => card.art).filter(Boolean));
    for (const file of readdirSync(imageDir)) {
      // Le registre porte aussi le README, les prompts, les accents et les planches : seules
      // les illustrations comptent ici.
      if (!file.endsWith('.webp')) continue;
      expect(referenced.has(file), `illustration orpheline : ${file} (aucune carte ne la porte)`).toBe(true);
    }
  });
});
