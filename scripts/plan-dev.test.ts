import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { divergence, entreeDe, lireIssues, rendreFichier } from './plan-dev.mjs';
import { FEATURES_PREVUES } from '@/data/plan-dev';

/**
 * **Le générateur de ce qui arrive** (`npm run plan:dev`, D-097 (3), #214, #336).
 *
 * L'écran `/feuille-de-route` montre les **issues `alpha` et `beta` ouvertes** du dépôt.
 * Elles ne s'écrivent pas à la main : `scripts/plan-dev.mjs` les prend à GitHub et
 * réécrit `src/data/plan-dev.ts`, exactement comme `scripts/notes-versions.mjs` le fait
 * pour les notes de version (D-090). Ce test éprouve la mise en forme **sans réseau** : il
 * donne au générateur des issues fabriquées.
 *
 * Ce qui est gardé, et pourquoi chacun peut échouer :
 *
 * 1. **une entrée sans titre est refusée** — une ligne vide à l'écran ne dit rien, et un
 *    générateur qui l'accepte la publierait en silence ; c'est la garde qui mord ;
 * 2. **une entrée sans étiquette d'étape est refusée** — elle ne se rangerait ni dans
 *    « alpha » ni dans « beta », et la page afficherait un chantier sans jalon ;
 * 3. **les deux étapes entrent** : un ticket `beta` se travaille pendant l'alpha (#336),
 *    donc la liste ne se limite plus aux issues `alpha` ;
 * 4. **aucun lien n'est engendré** : les liens vers le dépôt sont le ticket #343 (D-132),
 *    pas ce fichier ;
 * 5. le fichier commité est **exactement** ce que le générateur écrirait — c'est le
 *    `--verifie` de la commande, mais hors ligne, donc dans la CI ;
 * 6. **le contrôle mord** (#231) : la fonction de comparaison du `--verifie`, confrontée
 *    à un fichier amputé, dit la divergence — sinon la CI ne garderait qu'une apparence.
 */

/** Des issues telles que `gh issue list --json number,title,labels` les rend. */
const ISSUES = [
  { number: 220, title: 'Vocabulaire — l’écran Deck affiche encore « Chariots proposés »', labels: [{ name: 'beta' }] },
  { number: 94, title: 'IA — niveau 3 : expectiminimax + déterminisations', labels: [{ name: 'alpha' }] }
];

describe('plan-dev — la mise en forme d’une issue', () => {
  it('garde le numéro, le titre et l’étape', () => {
    expect(entreeDe({ number: 214, title: '  Feuille de route\n  publique  ', labels: [{ name: 'alpha' }] })).toEqual({
      numero: 214,
      titre: 'Feuille de route publique',
      etape: 'alpha'
    });
    expect(entreeDe({ number: 215, title: 'Un chantier beta', labels: [{ name: 'beta' }] }).etape).toBe('beta');
  });

  it('le contrôle mord : une issue sans titre est refusée', () => {
    // Sans ce cas, le générateur pourrait publier une puce vide sans que rien ne rougisse.
    expect(() => entreeDe({ number: 1, title: '   ', labels: [{ name: 'alpha' }] })).toThrow(/titre/i);
    expect(() => entreeDe({ number: 1, labels: [{ name: 'alpha' }] })).toThrow(/titre/i);
    // Un numéro qui n'en est pas un ne désigne aucune issue : c'est aussi une erreur.
    expect(() => entreeDe({ number: 0, title: 'Un titre', labels: [{ name: 'alpha' }] })).toThrow(/numéro/i);
    expect(() => entreeDe({ number: 'x', title: 'Un titre', labels: [{ name: 'alpha' }] })).toThrow(/numéro/i);
  });

  it('le contrôle mord : une issue sans étiquette d’étape n’entre pas', () => {
    // Une catégorie ou un état ne disent pas le jalon : la puce n'aurait pas de place.
    expect(() => entreeDe({ number: 1, title: 'Un titre', labels: [{ name: 'enhancement' }] })).toThrow(/étape/i);
    expect(() => entreeDe({ number: 1, title: 'Un titre', labels: [] })).toThrow(/étape/i);
    expect(() => entreeDe({ number: 1, title: 'Un titre' })).toThrow(/étape/i);
    // Une étiquette d'étape en majuscules reste reconnue : GitHub ne la casse pas, mais
    // un renommage maladroit ne doit pas faire disparaître un chantier en silence.
    expect(entreeDe({ number: 2, title: 'Un titre', labels: [{ name: 'Beta' }] }).etape).toBe('beta');
  });

  it('trie du plus récent au plus ancien, et prend les deux étapes', () => {
    const features = lireIssues(() => ISSUES);
    expect(features.map((feature) => feature.numero)).toEqual([220, 94]);
    expect(features.map((feature) => feature.etape)).toEqual(['beta', 'alpha']);
  });

  it('demande les deux étapes à gh, en une requête', () => {
    // `label:alpha,beta` est un **OU** : deux appels séparés auraient suffi, mais un seul
    // filtre tient la règle à un endroit. Sans ce cas, un `--label alpha` seul reviendrait
    // sans que le test s'en aperçoive.
    let args: string[] = [];
    lireIssues((appel) => {
      args = appel;
      return ISSUES;
    });
    expect(args.join(' ')).toContain('--search label:alpha,beta');
    expect(args.join(' ')).toContain('--state open');
    expect(args.join(' ')).toContain('number,title,labels');
    expect(args.join(' ')).not.toContain('--label');
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

  it('ne porte aucun lien — les liens sont le ticket #343 (D-132)', () => {
    const fichier = readFileSync(new URL('../src/data/plan-dev.ts', import.meta.url), 'utf8');
    expect(fichier).not.toMatch(/https?:\/\/|github\.com/i);
    expect(rendreFichier([{ numero: 1, titre: 'Un titre', etape: 'beta' }])).not.toMatch(/https?:\/\/|github\.com/i);
  });
});

describe('plan-dev — la commande', () => {
  it('est déclarée dans package.json, et n’ajoute aucune dépendance', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.scripts['plan:dev']).toBe('node scripts/plan-dev.mjs');
    // Le pont avec GitHub est `gh` (la CLI, déjà là) : aucun paquet de plus dans le bundle.
    expect(Object.keys(pkg.dependencies)).not.toContain('@octokit/rest');
    expect(readFileSync(fileURLToPath(new URL('./plan-dev.mjs', import.meta.url)), 'utf8')).toContain(
      "execFileSync('gh'"
    );
  });
});
