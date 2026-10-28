import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { binairePrettier, messageAbsent, versionDemandee } from './format-check.mjs';

/**
 * **Le formateur ne tombe plus en 127 muet** (#422, D-143).
 *
 * Constaté le 28/10/2026 : `npm run format:check` sortait **127** (« command not found ») quand
 * `prettier` manquait de `node_modules`. Ce code-là ne dit rien à personne, et les agents de la
 * journée l'ont contourné par `~/.npm/_npx/…` : **deux PR sont tombées en CI** sur un formatage
 * qu'aucun contrôle local n'avait réellement vérifié.
 *
 * Le contrôle mord sur un **cas fautif fabriqué** : un dossier sans `node_modules/prettier`, où
 * le script doit rendre `null` et un message qui nomme la commande d'installation. Sans ce bloc,
 * la garde s'appuierait sur le seul état (sain aujourd'hui) de ce worktree.
 */

/** Un faux dépôt : `package.json`, puis le binaire seulement si on le demande. */
function fauxDepot({ avecPrettier }: { avecPrettier: boolean }): string {
  const racine = mkdtempSync(join(tmpdir(), 'format-check-'));
  writeFileSync(
    join(racine, 'package.json'),
    JSON.stringify({ devDependencies: { prettier: '1.2.3' } }, null, 2)
  );
  if (avecPrettier) {
    mkdirSync(join(racine, 'node_modules', 'prettier', 'bin'), { recursive: true });
    writeFileSync(join(racine, 'node_modules', 'prettier', 'bin', 'prettier.cjs'), '// le binaire\n');
  }
  return racine;
}

describe('le formateur résolu par son binaire, jamais par le PATH (#422)', () => {
  it('trouve le binaire là où `npm ci` le pose', () => {
    const racine = fauxDepot({ avecPrettier: true });
    expect(binairePrettier(racine)).toBe(join(racine, 'node_modules', 'prettier', 'bin', 'prettier.cjs'));
  });

  it('le contrôle mord : sans binaire, il rend null et un message qui dit quoi faire', () => {
    const racine = fauxDepot({ avecPrettier: false });
    expect(binairePrettier(racine)).toBeNull();

    const message = messageAbsent(racine);
    expect(message).toMatch(/ABSENT/);
    expect(message).toMatch(/npm run installer/);
    // La version vient de `package.json`, jamais recopiée dans le script : un `1.2.3` en dur
    // dans `messageAbsent()` ferait mentir le message au premier changement de version.
    expect(message).toContain('prettier 1.2.3');
    expect(message).toMatch(/npx prettier/);
  });

  it('la version du message se lit à la source (package.json)', () => {
    const racine = fauxDepot({ avecPrettier: false });
    expect(versionDemandee(racine)).toBe('1.2.3');
  });

  it('ce worktree a bien le binaire que la CI utilise', () => {
    // C'est le défaut du 28/10/2026 : un contrôle local qui ne tournait pas. S'il manque ici,
    // `npm run format:check` échoue avec le message ci-dessus — jamais en 127.
    expect(binairePrettier(), 'prettier absent de node_modules : lancer `npm run installer`').not.toBeNull();
    expect(versionDemandee()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
