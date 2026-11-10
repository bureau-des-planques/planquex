// @vitest-environment node
import { readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FORME_ICONE, ICONES_PROFIL } from './profil';

/**
 * Le lot de douze portraits de profil (#791, D-197 (2)) : `public/design/profils/`.
 *
 * Ce test **compte** l'art : il y a exactement les douze images de la liste, ni plus ni moins,
 * chacune sous 200 Ko, chacune nommée au format des slugs. L'ajout d'un fichier orphelin, le
 * retrait d'un portrait ou un portrait trop lourd casse ici, pas à l'écran d'un testeur.
 */
const DOSSIER = new URL('../../public/design/profils/', import.meta.url);
const MAX_OCTETS = 200 * 1024;

export interface Fichier {
  nom: string;
  octets: number;
}

/** Les écarts entre les fichiers d'un dossier et la liste fermée : vide si tout va bien. */
export function ecartsDuLot(fichiers: readonly Fichier[], slugs: readonly string[]): string[] {
  const ecarts: string[] = [];
  for (const { nom, octets } of fichiers) {
    const slug = nom.replace(/\.webp$/, '');
    if (!nom.endsWith('.webp') || !FORME_ICONE.test(slug)) ecarts.push(`${nom} : nom hors format`);
    else if (!slugs.includes(slug)) ecarts.push(`${nom} : hors liste`);
    if (octets > MAX_OCTETS) ecarts.push(`${nom} : ${octets} octets, plus de 200 Ko`);
  }
  for (const slug of slugs) if (!fichiers.some((f) => f.nom === `${slug}.webp`)) ecarts.push(`${slug}.webp : absent`);
  return ecarts;
}

const slugs = ICONES_PROFIL.map((i) => i.slug);
const reels: Fichier[] = readdirSync(DOSSIER).map((nom) => ({ nom, octets: statSync(new URL(nom, DOSSIER)).size }));

describe('les portraits de profil (D-197 (2))', () => {
  it('il y a exactement douze images, une par slug de la liste, ≤ 200 Ko, nommées au format des slugs', () => {
    expect(reels).toHaveLength(12);
    expect(ecartsDuLot(reels, slugs)).toEqual([]);
  });

  it('le contrôle mord : un fichier orphelin, un nom hors format, un portrait trop lourd, un portrait absent', () => {
    expect(ecartsDuLot([...reels, { nom: 'intrus.webp', octets: 10 }], slugs)).toEqual(['intrus.webp : hors liste']);
    expect(ecartsDuLot([...reels, { nom: 'Mauvais_Nom.webp', octets: 10 }], slugs)).toEqual([
      'Mauvais_Nom.webp : nom hors format'
    ]);
    expect(
      ecartsDuLot(
        reels.map((f, i) => (i === 0 ? { ...f, octets: MAX_OCTETS + 1 } : f)),
        slugs
      )
    ).toHaveLength(1);
    expect(ecartsDuLot(reels.slice(1), slugs)).toHaveLength(1);
  });
});
