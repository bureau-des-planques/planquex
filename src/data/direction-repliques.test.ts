import { describe, expect, it } from 'vitest';
import { FORBIDDEN_ANY_CASE, motInterdit } from '@/test/vocabulaire-interdit';
import {
  MOTS_MAX_REPLIQUE,
  MOTS_MIN_REPLIQUE,
  PHRASES_MAX_REPLIQUE,
  REPLIQUES_DIRECTION,
  REPLIQUES_JOURNEE
} from './repliques-direction';

/**
 * **Le budget d'une réplique du Chef de cabinet** (D-195 (2), #782) : 25 à 35 mots, 1 à 3
 * phrases, aucun mot interdit. Les mots se comptent comme `motsDeLaReplique` (séparateurs
 * d'espaces) ; le nom du locuteur n'est pas compté, la réplique seule l'est (D-186, décision
 * du propriétaire du 10/11/2026).
 *
 * `REPLIQUES_BORNEES` réunit **toutes** les répliques du jeu : les cinq de la Journée et les
 * dix-neuf du combat. Une réplique ajoutée dans `repliques-direction.ts` est bornée d'office.
 */

const MOTS_MIN = MOTS_MIN_REPLIQUE;
const MOTS_MAX = MOTS_MAX_REPLIQUE;
const PHRASES_MAX = PHRASES_MAX_REPLIQUE;

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

/**
 * **Le vocabulaire hors jeu** des répliques (`docs/JEU.md` §3.1, décision du propriétaire du
 * 10/11/2026) : des mots français courants, donc absents de `FORBIDDEN_ANY_CASE`, mais que le
 * jeu remplace par les siens — « paquet » est un **Arrivage**. Cherchés sans tenir compte de la casse.
 */
const VOCABULAIRE_HORS_JEU: readonly { mot: string; remplacement: string }[] = [{ mot: 'paquet', remplacement: 'Arrivage' }];

/** Le premier mot hors jeu trouvé dans `texte`, ou `undefined`. */
function motHorsJeu(texte: string): string | undefined {
  const bas = texte.toLowerCase();
  return VOCABULAIRE_HORS_JEU.find(({ mot }) => new RegExp(`\\b${mot}s?\\b`).test(bas))?.mot;
}

/**
 * **Le camp de la fin** (décision du propriétaire du 10/11/2026) : `victoire` et `defaite` se
 * lisent du côté du testeur (`src/pages/Battle.tsx` : `state.winner === myCamp` → `victoire`).
 * Une `victoire` ne parle donc jamais de perte, une `defaite` jamais de gain.
 */
const FORMULE_DE_PERTE = /perdu|perdre|perds|défaite/i;
const FORMULE_DE_GAIN = /gagné|gagner|gagnes|victoire|félicitations/i;

/** Toutes les répliques du jeu : la Journée (quatre) et le combat (dix-neuf). */
const REPLIQUES_BORNEES: readonly string[] = [
  ...Object.values(REPLIQUES_JOURNEE),
  ...Object.values(REPLIQUES_DIRECTION).flat()
];

/** Un texte de `n` mots, en une seule phrase. */
function phrase(n: number): string {
  return `${Array.from({ length: n }, () => 'mot').join(' ')}.`;
}

describe('le budget d’une réplique du Chef de cabinet (D-195 (2))', () => {
  it('fixe les bornes de D-195 (2) : 25 à 35 mots, 3 phrases au plus', () => {
    // **Le contrôle mord** : une borne qui dérive dans `repliques-direction.ts` se voit ici,
    // et les tests d'écran lisent ces constantes au lieu d'écrire 25 et 35 à la main.
    expect(MOTS_MIN_REPLIQUE).toBe(25);
    expect(MOTS_MAX_REPLIQUE).toBe(35);
    expect(PHRASES_MAX_REPLIQUE).toBe(3);
  });

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

describe('les répliques du jeu passent le budget (D-195 (2), #782)', () => {
  it('borne les quatre répliques de la Journée et les dix-neuf du combat, sans doublon', () => {
    expect(Object.keys(REPLIQUES_JOURNEE)).toHaveLength(4);
    expect(Object.values(REPLIQUES_DIRECTION).flat()).toHaveLength(19);
    expect(REPLIQUES_BORNEES).toHaveLength(23);
    expect(new Set(REPLIQUES_BORNEES).size).toBe(REPLIQUES_BORNEES.length);
  });

  it('chaque réplique fait 25 à 35 mots, 1 à 3 phrases, sans mot interdit', () => {
    for (const replique of REPLIQUES_BORNEES) {
      expect(refusDeReplique(replique), replique).toEqual([]);
    }
  });

  it('n’emploie aucun mot hors jeu : « paquet » se dit « Arrivage » (docs/JEU.md §3.1)', () => {
    for (const replique of REPLIQUES_BORNEES) {
      expect(motHorsJeu(replique), replique).toBeUndefined();
    }
    // **Le contrôle mord** : un texte de bonne longueur qui dit « paquet » est refusé, et le
    // remplacement attendu est nommé.
    const fautif = `${phrase(24)} paquet.`;
    expect(refusDeReplique(fautif)).toEqual([]);
    expect(motHorsJeu(fautif)).toBe('paquet');
    expect(motHorsJeu('Deux paquets.')).toBe('paquet');
    expect(VOCABULAIRE_HORS_JEU.find(({ mot }) => mot === 'paquet')?.remplacement).toBe('Arrivage');
    // « empaqueté » n'est pas « paquet » : la borne de mot tient.
    expect(motHorsJeu('Un dossier empaqueté.')).toBeUndefined();
  });

  it('une victoire dit « tu as gagné », une défaite « tu as perdu » : jamais l’inverse', () => {
    for (const replique of REPLIQUES_DIRECTION.victoire) {
      expect(replique, `victoire : « ${replique} »`).not.toMatch(FORMULE_DE_PERTE);
    }
    for (const replique of REPLIQUES_DIRECTION.defaite) {
      expect(replique, `defaite : « ${replique} »`).not.toMatch(FORMULE_DE_GAIN);
    }
    // Chaque groupe le dit au moins une fois : un groupe muet sur l'issue ne prouverait rien.
    expect(REPLIQUES_DIRECTION.victoire.some((replique) => FORMULE_DE_GAIN.test(replique))).toBe(true);
    expect(REPLIQUES_DIRECTION.defaite.some((replique) => FORMULE_DE_PERTE.test(replique))).toBe(true);
    // **Le contrôle mord** : le brouillon du 10/11/2026 lisait les groupes à l'envers ; ses lignes
    // sont refusées dans le groupe où elles étaient.
    expect('Tu as perdu, mais la réunion a bien avancé, sans toi.').toMatch(FORMULE_DE_PERTE);
    expect('Tu as gagné le combat, félicitations.').toMatch(FORMULE_DE_GAIN);
    expect('Bravo pour cette victoire, qui ne figurera pas dans ton bilan.').toMatch(FORMULE_DE_GAIN);
  });

  it('ne s’en prend jamais à la personne : aucune insulte, aucune vulgarité', () => {
    // **Provocante, et une petite injure de temps en temps** (30/10/2026) : « bras cassé »
    // passe, comme dans un vrai couloir. Ce qui reste interdit, c'est ce qui s'en prend à la
    // personne et non à son travail : l'insulte gratuite, l'ableisme, la vulgarité.
    for (const replique of REPLIQUES_BORNEES) {
      expect(replique).not.toMatch(/idiot|imbécile|débile|abruti|incompétent|crétin|mongol|connard|salope|putain/i);
    }
  });
});
