import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
// @ts-expect-error — module .mjs sans déclaration de types
import { decisions, rendre } from './index-decisions.mjs';

/**
 * L'index de `docs/DECISIONS.md` (26/10/2026) — la porte d'entrée du journal.
 *
 * Constaté : `AGENTS.md` §1.1 demandait de lire le journal (113 décisions)
 * avant toute modification. 5 sessions l'ont fait, **68 ont écrit sans le lire**, 123 greps
 * ciblés à la place. L'index rend la règle tenable ; ce test empêche qu'il dérive du journal.
 *
 * Le contrôle **mord** : il est confronté à un journal fabriqué dont une décision manque à
 * l'index, et à une décision ajoutée sans ligne d'index.
 */

const lire = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

describe("l'index des décisions couvre le journal (26/10/2026)", () => {
  it('docs/DECISIONS-INDEX.md est à jour — `npm run index:decisions` le réécrit', () => {
    const attendu = rendre(decisions(lire('docs/DECISIONS.md')));
    expect(lire('docs/DECISIONS-INDEX.md')).toBe(attendu);
  });

  it('porte une ligne par décision, dans l’ordre du journal', () => {
    const ids = decisions(lire('docs/DECISIONS.md')).map((d: { id: string }) => d.id);
    const lignes = [...lire('docs/DECISIONS-INDEX.md').matchAll(/^\| (D-\d+) \|/gm)].map((m) => m[1]);
    expect(lignes).toEqual(ids);
  });

  it('le contrôle mord : une décision absente de l’index est vue', () => {
    const journal = [
      '| D-001 | 18/10/2026 | Premier choix | parce que |',
      '| D-002 | 19/10/2026 | Second choix | parce que |'
    ].join('\n');
    const indexFaux = rendre(decisions(journal.split('\n')[0]));
    const lignesFausses = [...indexFaux.matchAll(/^\| (D-\d+) \|/gm)].map((m) => m[1]);
    // L'index fabriqué ne couvre que D-001 : la comparaison avec le journal complet échoue.
    expect(lignesFausses).not.toEqual(decisions(journal).map((d: { id: string }) => d.id));
  });

  it('lit l’identifiant, la date et le début de l’intitulé, sans le gras Markdown', () => {
    const [d] = decisions('| D-042 | 21/10/2026 | **Un titre gras** et la suite | raison |');
    expect(d.id).toBe('D-042');
    expect(d.date).toBe('21/10/2026');
    expect(d.court).toBe('Un titre gras et la suite');
  });

  it('la colonne « Amendée par » lit le lien dans les deux sens (07/11/2026)', () => {
    const liste = decisions(
      [
        '| D-001 | 18/10/2026 | ⚠️ **Amendée par D-003** : premier choix | parce que |',
        '| D-002 | 18/10/2026 | ⚠️ **Remplacée le 20/10/2026 — voir D-004** : second | parce que |',
        '| D-003 | 19/10/2026 | Troisième (Bastien) ; amende D-001 (2) et D-002 | parce que |',
        '| D-004 | 20/10/2026 | Quatrième | parce que |'
      ].join('\n')
    );
    const par = Object.fromEntries(liste.map((d: { id: string; amendeePar: string[] }) => [d.id, d.amendeePar]));
    expect(par).toEqual({ 'D-001': ['D-003'], 'D-002': ['D-003', 'D-004'], 'D-003': [], 'D-004': [] });
  });

  it('le contrôle mord : un passif en texte courant ne compte pas', () => {
    const liste = decisions(
      [
        '| D-001 | 18/10/2026 | Premier | parce que |',
        '| D-002 | 19/10/2026 | Le backend, remplacé par D-001 ; le point (c), amendé par D-001 | parce que |'
      ].join('\n')
    );
    expect(liste.map((d: { amendeePar: string[] }) => d.amendeePar)).toEqual([[], []]);
  });

  it('l’index porte la colonne, vide quand rien n’amende la décision', () => {
    const index = rendre(decisions('| D-001 | 18/10/2026 | Premier | parce que |'));
    expect(index).toContain('| ID | Date | Intitulé (début) | Amendée par |');
    expect(index).toContain('| D-001 | 18/10/2026 | Premier |  |');
  });
});
