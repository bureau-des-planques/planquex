import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACTION_META } from './factions';

/**
 * La table des factions n'a **qu'une** source de valeurs : `FACTION_META` (#369).
 *
 * `docs/JEU.md` §3.2 reprend le vivier, la Vulnérabilité et l'étiquette pour les agents, et
 * `docs/FACTIONS.md` n'en recopie plus aucune. Cette garde lit la table de `docs/JEU.md` et
 * échoue si elle dit autre chose que le code. Elle ne **réécrit** rien : c'est un document
 * d'autorité, c'est le code qui fait foi et la table qui suit.
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

/** Les lignes de la table d'`docs/JEU.md` §3.2, telles qu'un agent les lit. */
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

/** Le titre de la section où ces cartes sont gardées, étiquetées, pour que l'idée ne se perde pas. */
const SECTION_HORS_PERIMETRE = '## Hors périmètre du lancement';

/** Le document sans sa section « hors périmètre » : c'est lui qui ne doit porter aucun Outil ni Lieu. */
function sansHorsPerimetre(doc: string): string {
  const debut = doc.indexOf(`\n${SECTION_HORS_PERIMETRE}\n`);
  return debut === -1 ? doc : doc.slice(0, debut);
}

describe('la table des factions', () => {
  it('docs/JEU.md §3.2 dit les mêmes valeurs que FACTION_META', () => {
    expect(lignesDeLaTable(lire('docs/JEU.md'))).toHaveLength(10);
    expect(ecarts(lire('docs/JEU.md'))).toEqual([]);
  });

  it('docs/FACTIONS.md renvoie à la source, et ne recopie plus la Vulnérabilité', () => {
    const doc = lire('docs/FACTIONS.md');
    expect(doc).toContain('src/data/factions.ts');
    expect(doc).toContain('FACTION_META.weakness');
    expect(doc).not.toMatch(/^- \*\*Vulnérabilité\*\* :/m);
  });

  it('docs/FACTIONS.md ne compte aucun Outil ni Lieu hors de sa section « hors périmètre »', () => {
    const doc = lire('docs/FACTIONS.md');
    expect(doc).toContain(`\n${SECTION_HORS_PERIMETRE}\n`);
    expect(CARTE_HORS_SET.test(sansHorsPerimetre(doc))).toBe(false);
  });

  // Le contrôle doit pouvoir échouer : sans ces cas, les gardes du dessus ne gardent rien.
  // Les cas fautifs prennent une valeur **différente** de celle du code, quelle qu'elle soit :
  // le test ne dépend pas de la valeur courante, seulement de l'écart.
  it('le contrôle mord : une Vulnérabilité fausse est refusée', () => {
    const attendue = FACTION_META.SSE.weakness;
    const fausse = attendue === 'QVT' ? 'RH' : 'QVT';
    const faux = lire('docs/JEU.md').replace(
      '| `SSE` | `SSE` | Plante | `MANAGEMENT` | Bureaux |',
      `| \`SSE\` | \`SSE\` | Plante | \`${fausse}\` | Bureaux |`
    );
    expect(ecarts(faux)).toContain(`SSE : vulnérable à ${fausse} ≠ ${attendue}`);
  });

  it('le contrôle mord : un vivier faux est refusé', () => {
    const attendu = FACTION_META.RH.vivier;
    const fauxVivier = attendu === 'ETAGE' ? 'ATELIER' : 'ETAGE';
    const libelle = Object.entries(VIVIER_DE_LA_TABLE).find(([, v]) => v === fauxVivier)![0];
    const texte = lire('docs/JEU.md').replace(
      '| `RH` | `RH` | Psychique | `DIRECTION` | Bureaux |',
      `| \`RH\` | \`RH\` | Psychique | \`DIRECTION\` | ${libelle} |`
    );
    expect(ecarts(texte)).toContain(`RH : vivier ${fauxVivier} ≠ ${attendu}`);
  });

  it('le contrôle mord : une carte Outil réintroduite est détectée', () => {
    expect(CARTE_HORS_SET.test('| Gants de protection | Outil | +20 Seuil |')).toBe(true);
    expect(CARTE_HORS_SET.test('| Salle de repos | Lieu | +Seuil au Banc |')).toBe(true);
  });

  it('le contrôle mord : seule la section « hors périmètre » est exemptée', () => {
    const ligne = '| Gants de protection | Outil | +20 Seuil |';
    const dansLaSection = `# Doc\n\n| Carte | Stade | Rôle |\n\n${SECTION_HORS_PERIMETRE}\n\n${ligne}\n`;
    const avantLaSection = `# Doc\n\n${ligne}\n\n${SECTION_HORS_PERIMETRE}\n\nrien\n`;
    expect(CARTE_HORS_SET.test(sansHorsPerimetre(dansLaSection))).toBe(false);
    expect(CARTE_HORS_SET.test(sansHorsPerimetre(avantLaSection))).toBe(true);
  });
});
