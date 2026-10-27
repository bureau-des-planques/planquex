import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACTION_META } from './factions';

/**
 * La table des factions n'a **qu'une** source de valeurs : `FACTION_META` (#369).
 *
 * `AGENTS.md` §3.2 reprend le vivier, la Vulnérabilité et l'étiquette pour les agents, et
 * `docs/FACTIONS.md` n'en recopie plus aucune. Cette garde lit la table d'`AGENTS.md` et
 * échoue si elle dit autre chose que le code. Elle ne **réécrit** rien : `AGENTS.md` est un
 * document d'autorité, c'est le code qui fait foi et la table qui suit.
 */

const lire = (chemin: string) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');

/** `| `SSE` | `SSE` | Plante | `MANAGEMENT` | Bureaux | Médecin du travail |` */
const LIGNE_FACTION =
  /^\| `([A-Z]+)` \| `([A-Z]+)` \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$/gm;

const VIVIER_DE_LA_TABLE: Record<string, string> = {
  Atelier: 'ATELIER',
  Étage: 'ETAGE',
  Bureaux: 'BUREAUX',
};

interface LigneTable {
  code: string;
  etiquette: string;
  vulnerable: string | null;
  vivier: string;
}

/** Les lignes de la table d'`AGENTS.md` §3.2, telles qu'un agent les lit. */
function lignesDeLaTable(texte: string): LigneTable[] {
  return [...texte.matchAll(LIGNE_FACTION)].map(([, code, etiquette, , vulnerable, vivier]) => ({
    code,
    etiquette,
    vulnerable: vulnerable.includes('Aucune') ? null : (/`([A-Z]+)`/.exec(vulnerable)?.[1] ?? vulnerable),
    vivier: VIVIER_DE_LA_TABLE[vivier.trim()] ?? vivier.trim(),
  }));
}

/** Les écarts entre une table et `FACTION_META`. Liste vide = la table dit le code. */
function ecarts(texte: string): string[] {
  const lignes = lignesDeLaTable(texte);
  const trouves: string[] = [];
  for (const ligne of lignes) {
    const meta = FACTION_META[ligne.code as keyof typeof FACTION_META];
    if (!meta) {
      trouves.push(`${ligne.code} : faction inconnue du code`);
      continue;
    }
    if (meta.short !== ligne.etiquette) trouves.push(`${ligne.code} : étiquette ${ligne.etiquette} ≠ ${meta.short}`);
    if (meta.vivier !== ligne.vivier) trouves.push(`${ligne.code} : vivier ${ligne.vivier} ≠ ${meta.vivier}`);
    if (meta.weakness !== ligne.vulnerable) {
      trouves.push(`${ligne.code} : vulnérable à ${ligne.vulnerable} ≠ ${meta.weakness}`);
    }
  }
  if (lignes.length !== Object.keys(FACTION_META).length) {
    trouves.push(`${lignes.length} lignes, le code en compte ${Object.keys(FACTION_META).length}`);
  }
  return trouves;
}

/** Une ligne de carte typée Outil ou Lieu : hors du set (D-020). */
const CARTE_HORS_SET = /^\| .+ \| (Outil|Lieu) \| .+ \|$/m;

describe('la table des factions', () => {
  it('AGENTS.md §3.2 dit les mêmes valeurs que FACTION_META', () => {
    expect(lignesDeLaTable(lire('AGENTS.md'))).toHaveLength(10);
    expect(ecarts(lire('AGENTS.md'))).toEqual([]);
  });

  it('docs/FACTIONS.md renvoie à la source, et ne recopie plus la Vulnérabilité', () => {
    const doc = lire('docs/FACTIONS.md');
    expect(doc).toContain('src/data/factions.ts');
    expect(doc).toContain('FACTION_META.weakness');
    expect(doc).not.toMatch(/^- \*\*Vulnérabilité\*\* :/m);
  });

  it('docs/FACTIONS.md ne compte aucun Outil ni Lieu parmi les cartes du set', () => {
    expect(CARTE_HORS_SET.test(lire('docs/FACTIONS.md'))).toBe(false);
  });

  // Le contrôle doit pouvoir échouer : sans ces cas, les gardes du dessus ne gardent rien.
  // Les cas fautifs prennent une valeur **différente** de celle du code, quelle qu'elle soit :
  // le test ne dépend pas de la valeur courante, seulement de l'écart.
  it('le contrôle mord : une Vulnérabilité fausse est refusée', () => {
    const attendue = FACTION_META.SSE.weakness;
    const fausse = attendue === 'QVT' ? 'RH' : 'QVT';
    const faux = lire('AGENTS.md').replace(
      '| `SSE` | `SSE` | Plante | `MANAGEMENT` | Bureaux |',
      `| \`SSE\` | \`SSE\` | Plante | \`${fausse}\` | Bureaux |`
    );
    expect(ecarts(faux)).toContain(`SSE : vulnérable à ${fausse} ≠ ${attendue}`);
  });

  it('le contrôle mord : un vivier faux est refusé', () => {
    const attendu = FACTION_META.RH.vivier;
    const fauxVivier = attendu === 'ETAGE' ? 'ATELIER' : 'ETAGE';
    const libelle = Object.entries(VIVIER_DE_LA_TABLE).find(([, v]) => v === fauxVivier)![0];
    const texte = lire('AGENTS.md').replace(
      '| `RH` | `RH` | Psychique | `DIRECTION` | Bureaux |',
      `| \`RH\` | \`RH\` | Psychique | \`DIRECTION\` | ${libelle} |`
    );
    expect(ecarts(texte)).toContain(`RH : vivier ${fauxVivier} ≠ ${attendu}`);
  });

  it('le contrôle mord : une carte Outil réintroduite est détectée', () => {
    expect(CARTE_HORS_SET.test('| Gants de protection | Outil | +20 Seuil |')).toBe(true);
    expect(CARTE_HORS_SET.test('| Salle de repos | Lieu | +Seuil au Banc |')).toBe(true);
  });
});
