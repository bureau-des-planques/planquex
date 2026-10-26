import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { divergence, entreeDe, lireIssues, rendreFichier } from './plan-dev.mjs';
import { FEATURES_PREVUES } from '@/data/plan-dev';

/**
 * **Le générateur des fonctionnalités prévues** (`npm run plan:dev`, D-097 (3), #214).
 *
 * L'écran `/feuille-de-route` montre les **issues `alpha` ouvertes** du dépôt. Elles ne
 * s'écrivent pas à la main : `scripts/plan-dev.mjs` les prend à GitHub et réécrit
 * `src/data/plan-dev.ts`, exactement comme `scripts/notes-versions.mjs` le fait pour les
 * notes de version (D-090). Ce test éprouve la mise en forme **sans réseau** : il donne au
 * générateur des issues fabriquées.
 *
 * Ce qui est gardé, et pourquoi chacun peut échouer :
 *
 * 1. **une entrée sans titre est refusée** — une ligne vide à l'écran ne dit rien, et un
 *    générateur qui l'accepte la publierait en silence ; c'est la garde qui mord ;
 * 2. **aucun lien n'est engendré** : le dépôt est **privé**, donc un `#214` se lit, un
 *    `https://github.com/…` ne s'ouvre pas (D-097 (3)) ;
 * 3. le fichier commité est **exactement** ce que le générateur écrirait — c'est le
 *    `--verifie` de la commande, mais hors ligne, donc dans la CI ;
 * 4. **le contrôle mord** (#231) : la fonction de comparaison du `--verifie`, confrontée
 *    à un fichier amputé, dit la divergence — sinon la CI ne garderait qu'une apparence.
 */

/** Deux issues telles que `gh issue list --json number,title` les rend. */
const ISSUES = [
  { number: 220, title: 'Vocabulaire — l’écran Deck affiche encore « Chariots proposés »' },
  { number: 94, title: 'IA — niveau 3 : expectiminimax + déterminisations' }
];

describe('plan-dev — la mise en forme d’une issue', () => {
  it('garde le numéro et le titre, sur une seule ligne', () => {
    expect(entreeDe({ number: 214, title: '  Feuille de route\n  publique  ' })).toEqual({
      numero: 214,
      titre: 'Feuille de route publique'
    });
  });

  it('le contrôle mord : une issue sans titre est refusée', () => {
    // Sans ce cas, le générateur pourrait publier une puce vide sans que rien ne rougisse.
    expect(() => entreeDe({ number: 1, title: '   ' })).toThrow(/titre/i);
    expect(() => entreeDe({ number: 1 })).toThrow(/titre/i);
    // Un numéro qui n'en est pas un ne désigne aucune issue : c'est aussi une erreur.
    expect(() => entreeDe({ number: 0, title: 'Un titre' })).toThrow(/numéro/i);
    expect(() => entreeDe({ number: 'x', title: 'Un titre' })).toThrow(/numéro/i);
  });

  it('trie du plus récent au plus ancien, sans doublon', () => {
    const features = lireIssues(() => ISSUES);
    expect(features.map((feature) => feature.numero)).toEqual([220, 94]);
  });
});

describe('plan-dev — le fichier engendré', () => {
  it('est exactement ce que le générateur écrirait (le `--verifie` hors ligne)', () => {
    // `rendreFichier` est la seule mise en forme : un fichier édité à la main serait
    // effacé en silence par la prochaine exécution de `npm run plan:dev`. On le dit ici.
    const fichier = readFileSync(new URL('../src/data/plan-dev.ts', import.meta.url), 'utf8');
    expect(fichier).toBe(rendreFichier(FEATURES_PREVUES));
  });

  it('le contrôle mord : un fichier amputé est une divergence, pas un vert (#231)', () => {
    // C'est la fonction que `-- --verifie` appelle (CI, étape « fichiers générés »).
    // Sans ce cas, elle pourrait toujours répondre `null` et personne ne le verrait.
    const attendu = rendreFichier(FEATURES_PREVUES);
    expect(divergence(attendu, attendu)).toBeNull();

    // Une entrée de moins, comme un fichier édité à la main après un merge.
    const sansUne = rendreFichier(FEATURES_PREVUES.slice(0, -1));
    expect(sansUne).not.toBe(attendu);
    expect(divergence(sansUne, attendu)).toMatch(/a divergé de GitHub — lance `npm run plan:dev`/);

    // Une seule ligne changée suffit : la comparaison est à l'octet, pas à l'à-peu-près.
    expect(divergence(`${attendu}\n`, attendu)).toMatch(/divergé/);
  });

  it('ne porte aucun lien — le dépôt est privé (D-097 (3))', () => {
    const fichier = readFileSync(new URL('../src/data/plan-dev.ts', import.meta.url), 'utf8');
    expect(fichier).not.toMatch(/https?:\/\/|github\.com/i);
    expect(rendreFichier([{ numero: 1, titre: 'Un titre' }])).not.toMatch(/https?:\/\/|github\.com/i);
  });
});

describe('plan-dev — la commande', () => {
  it('est déclarée dans package.json, et n’ajoute aucune dépendance', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    ) as { scripts: Record<string, string>; dependencies: Record<string, string> };
    expect(pkg.scripts['plan:dev']).toBe('node scripts/plan-dev.mjs');
    // Le pont avec GitHub est `gh` (la CLI, déjà là) : aucun paquet de plus dans le bundle.
    expect(Object.keys(pkg.dependencies)).not.toContain('@octokit/rest');
    expect(readFileSync(fileURLToPath(new URL('./plan-dev.mjs', import.meta.url)), 'utf8')).toContain(
      "execFileSync('gh'"
    );
  });
});
