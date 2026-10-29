import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/data';

/**
 * Garde-fou des **documents vivants** — ticket #36, `docs/agents/audit.md` (pièges connus).
 *
 * La classe de bug a déjà été corrigée deux fois (`c550739`, `565c7e8`) : les docs
 * annonçaient encore un décompte de cartes quand le code, lui, avait grossi. Un
 * décompte recopié ne casse rien au moment où il diverge — ce test est donc le seul
 * mécanisme qui le rend visible.
 *
 * Le nombre réel se dérive d'`ALL_CARDS` en un seul endroit : `scripts/preuves/status.mjs`
 * (champ `cards`). `AGENTS.md` §7 et `README.md` y renvoient, et n'ont le droit de
 * citer que les volumes qui sont des **règles** — une **cible** se dit sans le nom juste
 * après le nombre (voir `RULE_VOLUMES`), jamais un décompte du code.
 *
 * `docs/STATUS.md` est un **instantané daté** : il garde ses chiffres et n'est pas lu ici.
 */
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

/**
 * Nombres qu'un document vivant peut écrire sans mentir sur l'état du code :
 * - `20` : la taille du Deck (docs/JEU.md §4).
 * Rien d'autre : `226` et `286` étaient la **cible de lancement** de D-005, que D-063 a
 * retirée. Les blanchir protégeait une cible morte et refusait celle qui la remplace (#151).
 *
 * Tout autre nombre devant « cartes », « variantes », « tests » ou « bases » est un
 * décompte recopié : il doit se lire dans `npm run status` ou `npm test`.
 *
 * **La cible de D-063 reste dicible**, mais **sans le nom juste après le nombre** : on écrit
 * « autour de 300 » (le motif `\b\d+\s+(cartes?|…)` ne matche pas, donc la phrase passe),
 * jamais « 300 cartes » — indistinguable d'un décompte recopié, et donc refusé. C'est la
 * seule façon de dire une cible sans blanchir un nombre, et le commentaire en tient lieu
 * de règle : ajouter un nombre ici, c'est blanchir un décompte qui divergera (#112).
 */
const RULE_VOLUMES = new Set([20]);

const COUNT = /\b(\d+)\s+(cartes?|variantes?|tests?|bases?)\b/gi;

/** Les décomptes en dur d'un texte, hors volumes de règle ou de cible. */
function hardCounts(text: string): string[] {
  return [...text.matchAll(COUNT)]
    .filter(([, value]) => !RULE_VOLUMES.has(Number(value)))
    .map(([label]) => label);
}

/** `docs/COMMANDES.md` (l'ancien `AGENTS.md` §7) : `AGENTS.md` §7 n'en garde qu'un pointeur. */
function agentsSection7(): string {
  const commandes = read('docs/COMMANDES.md');
  expect(commandes.length, 'docs/COMMANDES.md vide').toBeGreaterThan(0);
  return commandes;
}

describe('Documents vivants — décomptes (ticket #36)', () => {
  it('docs/COMMANDES.md ne recopie aucun décompte de cartes ni de tests', () => {
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

/**
 * Le contrôle **mord** (#112) : la garde est confrontée à des textes fabriqués, pas seulement
 * aux fichiers du dépôt. Sans ce bloc, remettre `286` dans `RULE_VOLUMES` passerait inaperçu —
 * c'est exactement ce qui est arrivé jusqu'à #151, où `README.md` portait trois « 286 » en
 * passant au vert.
 */
describe('La garde des décomptes mord — cible retirée (ticket #151)', () => {
  it('refuse les anciennes cibles de D-005, retirées par D-063', () => {
    // Les formulations que `README.md` portait avant #151.
    expect(hardCounts('286 cartes au lancement (226 + 60 secrètes)')).toEqual(['286 cartes']);
    expect(hardCounts('la spécification des 286 cartes')).toEqual(['286 cartes']);
    expect(hardCounts('226 bases illustrées')).toEqual(['226 bases']);
  });

  it('refuse une cible écrite comme un décompte, et accepte « autour de 300 »', () => {
    // Écrire la cible avec le nom juste après le nombre est indistinguable d'un décompte
    // recopié : c'est refusé, et c'est pourquoi D-063 se dit « autour de 300 ».
    expect(hardCounts('300 cartes au lancement')).toEqual(['300 cartes']);
    expect(hardCounts('un set autour de 300, sans compte imposé')).toEqual([]);
  });
});

describe('`npm run status` — décompte dérivé d’ALL_CARDS', () => {
  it('lit les cartes dans `src/data`, sans littéral', () => {
    const output = execFileSync(process.execPath, ['scripts/preuves/status.mjs'], {
      cwd: root,
      encoding: 'utf8'
    });
    const report = JSON.parse(output);
    expect(report.cards.total).toBe(ALL_CARDS.length);
    expect(report.cards.base).toBe(ALL_CARDS.filter((card) => !card.variantOf).length);
    expect(report.cards.variants).toBe(ALL_CARDS.filter((card) => card.variantOf).length);
    expect(report.cards.factions).toEqual([...new Set(ALL_CARDS.map((card) => card.faction))].sort());
    // Le décompte par rareté et par faction est lui aussi **dérivé** (#86) : la cible
    // de `CARD-SPEC.md` §1 (42 cartes en 3◆) se lit dans `npm run status`.
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
