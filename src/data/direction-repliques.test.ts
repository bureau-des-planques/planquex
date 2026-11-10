import { describe, expect, it } from 'vitest';
import { FORBIDDEN_ANY_CASE, motInterdit } from '@/test/vocabulaire-interdit';

/**
 * **Le budget d'une réplique du Chef de cabinet** (D-195 (2), #782) : 25 à 35 mots, 1 à 3
 * phrases, aucun mot interdit. Les mots se comptent comme `motsDeLaReplique` (séparateurs
 * d'espaces) ; le nom du locuteur n'est pas compté, la réplique seule l'est.
 *
 * Les textes écrits ne sont **pas encore** branchés : `REPLIQUES_BORNEES` est vide, et les
 * anciennes lignes (3 à 11 mots, D-181) ne passeraient pas. Un commit suivant n'a qu'à
 * ajouter les nouvelles répliques dans `REPLIQUES_BORNEES`.
 */

const MOTS_MIN = 25;
const MOTS_MAX = 35;
const PHRASES_MAX = 3;

/** Les mots d'un texte, séparés par des espaces (comme `motsDeLaReplique`). */
function compterMots(texte: string): number {
  return texte.split(/\s+/).filter(Boolean).length;
}

/** Les phrases d'un texte : une coupure sur `.`, `!` ou `?`. */
function compterPhrases(texte: string): number {
  return texte
    .split(/[.!?]+/)
    .map((phrase) => phrase.trim())
    .filter(Boolean).length;
}

/** Les raisons de refuser une réplique ; une liste vide la fait passer. */
function refusDeReplique(texte: string): string[] {
  const refus: string[] = [];
  const mots = compterMots(texte);
  if (mots < MOTS_MIN || mots > MOTS_MAX) refus.push(`${mots} mots (il en faut ${MOTS_MIN} à ${MOTS_MAX})`);
  const phrases = compterPhrases(texte);
  if (phrases < 1 || phrases > PHRASES_MAX) refus.push(`${phrases} phrases (il en faut 1 à ${PHRASES_MAX})`);
  const interdit = motInterdit(texte);
  if (interdit !== undefined) refus.push(`mot interdit « ${interdit} »`);
  return refus;
}

/** Les répliques qui passent le budget. Vide tant que les nouveaux textes ne sont pas branchés. */
const REPLIQUES_BORNEES: readonly string[] = [];

/** Un texte de `n` mots, en une seule phrase. */
function phrase(n: number): string {
  return `${Array.from({ length: n }, () => 'mot').join(' ')}.`;
}

describe('le budget d’une réplique du Chef de cabinet (D-195 (2))', () => {
  it('accepte 25 mots et 35 mots, en une phrase', () => {
    expect(refusDeReplique(phrase(25))).toEqual([]);
    expect(refusDeReplique(phrase(35))).toEqual([]);
  });

  it('refuse 24 mots et 36 mots : la borne est nette', () => {
    expect(refusDeReplique(phrase(24)).join(' ')).toMatch(/24 mots/);
    expect(refusDeReplique(phrase(36)).join(' ')).toMatch(/36 mots/);
  });

  it('refuse une réplique de 12 mots, l’ancien plafond (D-181), et une de 60 mots', () => {
    expect(refusDeReplique(phrase(12)).join(' ')).toMatch(/12 mots/);
    expect(refusDeReplique(phrase(60)).join(' ')).toMatch(/60 mots/);
  });

  it('accepte 1 à 3 phrases, et refuse 4 phrases', () => {
    // 28 mots en quatre phrases de sept : le compte de phrases seul doit échouer.
    const quatre = `${phrase(7)} ${phrase(7)} ${phrase(7)} ${phrase(7)}`;
    expect(compterMots(quatre)).toBe(28);
    expect(refusDeReplique(quatre).join(' ')).toMatch(/4 phrases/);
    // 30 mots en trois phrases de dix : passe.
    expect(refusDeReplique(`${phrase(10)} ${phrase(10)} ${phrase(10)}`)).toEqual([]);
  });

  it('refuse un mot interdit, même dans un texte de bonne longueur', () => {
    // `FORBIDDEN_ANY_CASE` est la seule liste : le contrôle mord sur son premier mot.
    // 25 mots dont un interdit : la longueur passe, le vocabulaire seul fait échouer.
    const interdit = FORBIDDEN_ANY_CASE[0];
    expect(compterMots(`${phrase(24)} ${interdit}`)).toBe(25);
    expect(refusDeReplique(`${phrase(24)} ${interdit}`).join(' ')).toMatch(/mot interdit/);
  });

  it('compte les mots comme `motsDeLaReplique` : une apostrophe ne coupe pas, un espace oui', () => {
    expect(compterMots('C’est fini.')).toBe(2);
    expect(compterMots('  Un   deux  ')).toBe(2);
  });
});

describe('les répliques bornées passent le budget', () => {
  it('ne contient que des répliques qui passent (vide tant que les textes ne sont pas branchés)', () => {
    for (const replique of REPLIQUES_BORNEES) {
      expect(refusDeReplique(replique), replique).toEqual([]);
    }
  });
});
