// @vitest-environment node
/**
 * La numérotation des migrations — #371.
 *
 * Le registre (`admin.migrations`) applique les fichiers dans l'ordre de leur nom. Une
 * migration appliquée ne se renumérote pas (D-091) : si le disque a un **trou**, ou si une
 * migration arrive **sous** une plus grande déjà présente, l'ordre du registre et l'ordre du
 * disque se contredisent — et on le découvre en production.
 *
 * La règle : chaque numéro suit le précédent de **1**, sans doublon. La seule entorse admise
 * est listée dans `SAUTS_CONNUS`, avec le numéro **exact** qui la précède : combler le trou
 * après coup (une `0014` ajoutée aujourd'hui) casse donc la garde, au lieu de passer.
 *
 * **Le contrôle mord** : la règle est confrontée plus bas à des suites fabriquées — un trou,
 * un doublon, une migration glissée sous la plus grande, un nom mal formé.
 */
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOSSIER_MIGRATIONS } from './pglite';

/**
 * Les sauts déjà appliqués en production : numéro → numéro qui le précède sur le disque.
 *
 * - `0016` suit `0013` : la médaille de la période d'essai (#346) a pris `0016` alors que
 *   D-133 (4) réservait `0014` (#339) et `0015` (#341). Elle est appliquée, donc elle garde
 *   son numéro (D-091) ; c'est le plan qui cède : les deux migrations à venir prennent `0017`
 *   et `0018` (#371). `0014` et `0015` ne seront **jamais** utilisés.
 */
export const SAUTS_CONNUS: Readonly<Record<number, number>> = { 16: 13 };

const FORME = /^(\d{4})_[a-z0-9_]+\.sql$/;

/** Les défauts de numérotation d'une liste de noms de fichiers ; vide = la suite est saine. */
export function defautsNumerotation(
  noms: readonly string[],
  sauts: Readonly<Record<number, number>> = SAUTS_CONNUS
): string[] {
  const defauts: string[] = [];
  const numeros: number[] = [];
  for (const nom of noms.filter((n) => n.endsWith('.sql'))) {
    const m = FORME.exec(nom);
    if (!m) defauts.push(`${nom} : nom hors de la forme NNNN_nom.sql`);
    else numeros.push(Number(m[1]));
  }
  numeros.sort((a, b) => a - b);
  numeros.forEach((n, i) => {
    if (i === 0) {
      if (n !== 1) defauts.push(`la suite commence à ${n}, pas à 1`);
      return;
    }
    const avant = numeros[i - 1]!;
    if (n === avant) defauts.push(`numéro ${n} en double`);
    else if (n in sauts) {
      if (sauts[n] !== avant) defauts.push(`${n} doit suivre ${sauts[n]} (saut connu), il suit ${avant}`);
    } else if (n !== avant + 1) defauts.push(`trou entre ${avant} et ${n}`);
  });
  return defauts;
}

describe('numérotation des migrations (#371)', () => {
  it('le disque a une suite sans trou, hors sauts connus', () => {
    const noms = readdirSync(DOSSIER_MIGRATIONS);
    expect(noms.length).toBeGreaterThan(0);
    expect(defautsNumerotation(noms)).toEqual([]);
  });

  describe('le contrôle mord', () => {
    const sain = ['0012_a.sql', '0013_b.sql', '0016_c.sql'];
    const depuisUn = (suite: string[]) => [
      ...Array.from({ length: 11 }, (_, i) => `${String(i + 1).padStart(4, '0')}_x.sql`),
      ...suite
    ];

    it('la suite de référence passe, et la suivante 0017 aussi', () => {
      expect(defautsNumerotation(depuisUn(sain))).toEqual([]);
      expect(defautsNumerotation(depuisUn([...sain, '0017_d.sql']))).toEqual([]);
    });

    it('refuse un trou (0013 puis 0016) sans saut connu', () => {
      expect(defautsNumerotation(depuisUn(sain), {})).toEqual(['trou entre 13 et 16']);
    });

    it('refuse un fichier retiré de la suite', () => {
      const sansDouze = depuisUn(sain).filter((n) => !n.startsWith('0012'));
      expect(defautsNumerotation(sansDouze)).toEqual(['trou entre 11 et 13']);
    });

    it('refuse une migration glissée sous la plus grande (0014 après 0016)', () => {
      expect(defautsNumerotation(depuisUn([...sain, '0014_tard.sql']))).toEqual([
        '16 doit suivre 13 (saut connu), il suit 14'
      ]);
    });

    it('refuse un trou après le saut connu (0016 puis 0018)', () => {
      expect(defautsNumerotation(depuisUn([...sain, '0018_d.sql']))).toEqual(['trou entre 16 et 18']);
    });

    it('refuse un doublon et un nom mal formé', () => {
      expect(defautsNumerotation(depuisUn([...sain, '0016_bis.sql']))).toEqual(['numéro 16 en double']);
      expect(defautsNumerotation(depuisUn([...sain, '17_d.sql']))).toEqual([
        '17_d.sql : nom hors de la forme NNNN_nom.sql'
      ]);
    });
  });
});
