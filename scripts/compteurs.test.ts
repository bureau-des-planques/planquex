import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/data';

/**
 * Garde-fou des **documents vivants** — ticket #36, `AGENTS.md` §8.3.
 *
 * La classe de bug a déjà été corrigée deux fois (`c550739`, `565c7e8`) : les docs
 * annonçaient encore un décompte de cartes quand le code, lui, avait grossi. Un
 * décompte recopié ne casse rien au moment où il diverge — ce test est donc le seul
 * mécanisme qui le rend visible.
 *
 * Le nombre réel se dérive d'`ALL_CARDS` en un seul endroit : `scripts/status.mjs`
 * (champ `cards`). `AGENTS.md` §7 et `README.md` y renvoient, et n'ont le droit de
 * citer que les volumes qui sont des règles ou des cibles, jamais un décompte du code.
 *
 * `docs/STATUS.md` est un **instantané daté** : il garde ses chiffres et n'est pas lu ici.
 */
const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

/**
 * Nombres qu'un document vivant peut écrire sans mentir sur l'état du code :
 * - `20` : la taille du Chariot (AGENTS.md §4) ;
 * - `226` et `286` : la cible de lancement (AGENTS.md §4.2, CARD-SPEC.md §2).
 * Tout autre nombre devant « cartes », « variantes », « tests » ou « bases » est un
 * décompte recopié : il doit se lire dans `npm run status` ou `npm test`.
 */
const RULE_VOLUMES = new Set([20, 226, 286]);

const COUNT = /\b(\d+)\s+(cartes?|variantes?|tests?|bases?)\b/gi;

/** Les décomptes en dur d'un texte, hors volumes de règle ou de cible. */
function hardCounts(text: string): string[] {
  return [...text.matchAll(COUNT)]
    .filter(([, value]) => !RULE_VOLUMES.has(Number(value)))
    .map(([label]) => label);
}

/** `AGENTS.md` §7 seulement : les autres sections sont des documents d'autorité hors périmètre. */
function agentsSection7(): string {
  const agents = read('AGENTS.md');
  const start = agents.indexOf('## 7. Commandes');
  const end = agents.indexOf('## 8. Audits');
  expect(start, 'AGENTS.md §7 introuvable').toBeGreaterThanOrEqual(0);
  expect(end, 'AGENTS.md §8 introuvable').toBeGreaterThan(start);
  return agents.slice(start, end);
}

describe('Documents vivants — décomptes (ticket #36)', () => {
  it('AGENTS.md §7 ne recopie aucun décompte de cartes ni de tests', () => {
    expect(hardCounts(agentsSection7())).toEqual([]);
  });

  it('README.md ne recopie aucun décompte de cartes ni de tests', () => {
    expect(hardCounts(read('README.md'))).toEqual([]);
  });

  it('les deux renvoient à `npm run status`, la source unique', () => {
    expect(agentsSection7()).toContain('npm run status');
    expect(read('README.md')).toContain('npm run status');
  });
});

describe('`npm run status` — décompte dérivé d’ALL_CARDS', () => {
  it('lit les cartes dans `src/data`, sans littéral', () => {
    const output = execFileSync(process.execPath, ['scripts/status.mjs'], {
      cwd: root,
      encoding: 'utf8'
    });
    const report = JSON.parse(output);
    expect(report.cards.total).toBe(ALL_CARDS.length);
    expect(report.cards.base).toBe(ALL_CARDS.filter((card) => !card.variantOf).length);
    expect(report.cards.variants).toBe(ALL_CARDS.filter((card) => card.variantOf).length);
    expect(report.cards.factions).toEqual([...new Set(ALL_CARDS.map((card) => card.faction))].sort());
    // Le décompte par rareté et par faction est lui aussi **dérivé** : la cible de
    // `CARD-SPEC.md` §1 et les paliers hauts (#87) se lisent dans `npm run status`.
    const raretes = [...new Set(ALL_CARDS.map((card) => card.rarity))].sort();
    expect(Object.keys(report.cards.rarities)).toEqual(raretes);
    for (const rarete of raretes) {
      expect(report.cards.rarities[rarete], rarete).toBe(
        ALL_CARDS.filter((card) => card.rarity === rarete).length
      );
    }
    for (const faction of report.cards.factions) {
      const list = ALL_CARDS.filter((card) => card.faction === faction);
      const parFaction = report.cards.byFaction[faction];
      expect(parFaction.total, faction).toBe(list.length);
      expect(parFaction.base, faction).toBe(list.filter((card) => !card.variantOf).length);
      expect(parFaction.variants, faction).toBe(list.filter((card) => card.variantOf).length);
      expect(parFaction['3D'], faction).toBe(list.filter((card) => card.rarity === '3D').length);
    }
  }, 30_000);
});
