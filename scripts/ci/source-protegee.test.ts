import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  cheminJournal,
  installerSignaux,
  proteger,
  reparerAuDemarrage,
  restaurer,
  terminer
} from './source-protegee.mjs';

/**
 * Le garde-fou du garde-fou, sur l'interruption (#622).
 *
 * Mesuré le 02/11/2026 : un `npm run garde-fous` interrompu a laissé
 * `src/components/InvitationTesteurs.tsx` muté. Un `finally` ne s'exécute pas quand le
 * processus meurt sur un signal, et une source du dépôt laissée fausse peut être commitée.
 *
 * Les deux protections sont éprouvées ici, et chacune **peut échouer** : sans le journal,
 * le premier test tombe ; sans les gestionnaires, le second laisse le fichier muté.
 */
const MODULE = fileURLToPath(new URL('./source-protegee.mjs', import.meta.url));
const HARNAIS = fileURLToPath(new URL('./garde-fous.mjs', import.meta.url));

/** Un bac à sable : une source, un journal, et rien d'autre. */
function bac() {
  const dossier = mkdtempSync(join(tmpdir(), 'source-protegee-'));
  const fichier = join(dossier, 'source.ts');
  const journal = join(dossier, 'journal.json');
  writeFileSync(fichier, 'export const valeur = 1;\n', 'utf8');
  return { dossier, fichier, journal };
}

describe('source protégée — une mutation interrompue ne laisse pas le dépôt faux', () => {
  it('répare la source laissée mutée par une exécution morte, et efface le journal', () => {
    const { fichier, journal } = bac();
    // Ce que fait le harnais : journal, puis mutation. Puis plus rien — le processus meurt.
    proteger(fichier, journal);
    writeFileSync(fichier, 'export const valeur = 2;\n', 'utf8');
    expect(readFileSync(fichier, 'utf8')).toContain('valeur = 2');
    expect(existsSync(journal)).toBe(true);

    const repare = reparerAuDemarrage(journal);

    expect(repare).toBe(fichier);
    expect(readFileSync(fichier, 'utf8')).toBe('export const valeur = 1;\n');
    expect(existsSync(journal)).toBe(false);
  });

  it('ne touche à rien quand il n’y a pas de journal — il ne devine pas', () => {
    const { fichier, journal } = bac();
    writeFileSync(fichier, 'export const valeur = 7;\n', 'utf8');

    expect(reparerAuDemarrage(journal)).toBeNull();
    expect(readFileSync(fichier, 'utf8')).toBe('export const valeur = 7;\n');
  });

  it('refuse un journal illisible au lieu de continuer sur un état inconnu', () => {
    const { journal } = bac();
    writeFileSync(journal, 'pas du JSON', 'utf8');

    expect(() => reparerAuDemarrage(journal)).toThrow(/journal de mutation illisible/);
  });

  it('restaure sur un signal, et sort en 130 — la preuve par un vrai processus', () => {
    const { fichier, journal } = bac();
    // Le sous-processus fait exactement ce que fait le harnais : il installe les signaux,
    // protège la source, la mute, puis se signale lui-même. Sans les gestionnaires, le
    // `SIGINT` par défaut tue le processus **et laisse la mutation en place**.
    const script = `
      import { writeFileSync } from 'node:fs';
      import { installerSignaux, proteger } from ${JSON.stringify(pathToFileURL(MODULE).href)};
      installerSignaux();
      proteger(${JSON.stringify(fichier)}, ${JSON.stringify(journal)});
      writeFileSync(${JSON.stringify(fichier)}, 'export const valeur = 2;\\n', 'utf8');
      process.kill(process.pid, 'SIGINT');
      setTimeout(() => process.exit(0), 2000);
    `;
    const enfant = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      timeout: 20_000
    });

    expect(enfant.status).toBe(130);
    expect(readFileSync(fichier, 'utf8')).toBe('export const valeur = 1;\n');
    expect(existsSync(journal)).toBe(false);
  });

  it('restaurer et terminer sont sans effet quand rien n’est en cours', () => {
    expect(restaurer()).toBe(false);
    expect(terminer()).toBe(false);
  });

  it('le harnais branche les quatre gestes — un module juste mais non branché ne protège rien', () => {
    // Le test au-dessus éprouve le module ; celui-ci éprouve le **câblage**. Les deux sont
    // nécessaires : un module parfait qu'on oublie d'appeler laisse exactement le défaut de
    // #622, et le harnais est un script, donc ni typé ni importé par les autres tests.
    const source = readFileSync(HARNAIS, 'utf8');
    expect(source).toContain('proteger(chemin, journal)');
    expect(source).toContain('terminer()');
    expect(source).toContain('reparerAuDemarrage(journal)');
    expect(source).toContain('installerSignaux()');
  });

  it('le journal vit dans node_modules, donc hors de git', () => {
    const journal = cheminJournal('/tmp/exemple');
    expect(journal).toBe('/tmp/exemple/node_modules/.garde-fous-en-cours.json');
  });

  it('un signal sans mutation en cours ne sort pas en erreur de restauration', () => {
    const { fichier } = bac();
    const sorties: number[] = [];
    const messages: string[] = [];
    installerSignaux({
      signaux: ['SIGUSR2'],
      sortie: (code: number) => sorties.push(code),
      dire: (message: string) => messages.push(message)
    });
    process.emit('SIGUSR2', 'SIGUSR2');

    expect(sorties).toEqual([130]);
    expect(messages.join(' ')).toContain("aucune source n'était mutée");
    expect(readFileSync(fichier, 'utf8')).toBe('export const valeur = 1;\n');
  });
});
