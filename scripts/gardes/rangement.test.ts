// @vitest-environment node
/**
 * Le rangement de `scripts/` — #485.
 *
 * `scripts/` a vécu à **83 fichiers à plat** jusqu'au 29/10/2026. Ce cliquet tient le
 * découpage par métier qui en est sorti : un fichier posé à la racine de `scripts/`, un
 * dossier vidé ou un dossier inventé sans être nommé ici fait échouer la suite. Sans lui,
 * le plat se reforme en trois semaines — et personne ne le voit, puisque rien ne lit une
 * arborescence.
 *
 * **Le contrôle mord** : les règles sont confrontées plus bas à des listes fabriquées —
 * un fichier à la racine, un dossier vide, un dossier inconnu — qui doivent toutes être
 * signalées.
 */
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `scripts/` — la racine du rangement, quel que soit le dossier de travail du test. */
const SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Les dossiers admis sous `scripts/`, et ce qu'ils portent. */
const DOSSIERS: Readonly<Record<string, string>> = {
  preuves: 'ce qui mesure, filme, joue et éprouve le jeu, sans écrire de fichier du dépôt',
  generateurs: 'ce qui écrit un fichier du dépôt, une action GitHub ou une ligne du mur',
  ci: 'la chaîne : chemins, état, format, durées, gardes, dispatch, worktree, UI, gflow',
  ressources: 'ce qui produit ou installe ce que le jeu sert, et l’outillage du poste',
  gardes: 'les tests de cohérence du dépôt, sans exécutable à côté'
};

interface EntreeScripts {
  /** Le nom de l'entrée, sous `scripts/`. */
  nom: string;
  /** Vrai pour un dossier. */
  dossier: boolean;
  /** Le nombre de fichiers dans ce dossier (0 pour un fichier). */
  fichiers: number;
}

/** Les défauts de rangement d'une liste d'entrées ; vide = le rangement est sain. */
function defautsRangement(
  entrees: readonly EntreeScripts[],
  admis: Readonly<Record<string, string>> = DOSSIERS
): string[] {
  const defauts: string[] = [];
  for (const e of entrees) {
    if (!e.dossier) {
      defauts.push(`${e.nom} : un fichier à la racine de scripts/ (il va dans un dossier)`);
      continue;
    }
    if (!(e.nom in admis)) defauts.push(`${e.nom}/ : dossier inconnu (l'ajouter à DOSSIERS avec sa raison)`);
    if (e.fichiers === 0) defauts.push(`${e.nom}/ : dossier vide (un dossier vide ne range rien)`);
  }
  for (const nom of Object.keys(admis)) {
    if (!entrees.some((e) => e.nom === nom)) defauts.push(`${nom}/ : dossier annoncé mais absent`);
  }
  return defauts;
}

describe('le rangement de scripts/ (#485)', () => {
  it('ne laisse que les cinq dossiers connus, tous remplis', () => {
    const entrees = readdirSync(SCRIPTS, { encoding: 'utf8', withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => {
        const chemin = resolve(SCRIPTS, d.name);
        return {
          nom: d.name,
          dossier: d.isDirectory(),
          fichiers: d.isDirectory() ? readdirSync(chemin).length : 1
        };
      });
    expect(defautsRangement(entrees)).toEqual([]);
  });

  it('le contrôle mord : un fichier à la racine, un dossier vide et un dossier inconnu sont signalés', () => {
    const fautif: EntreeScripts[] = [
      { nom: 'preuves', dossier: true, fichiers: 3 },
      { nom: 'capturer.mjs', dossier: false, fichiers: 1 },
      { nom: 'vide', dossier: true, fichiers: 0 },
      { nom: 'mystere', dossier: true, fichiers: 2 }
    ];
    const defauts = defautsRangement(fautif);
    expect(defauts).toContain('capturer.mjs : un fichier à la racine de scripts/ (il va dans un dossier)');
    expect(defauts).toContain('vide/ : dossier vide (un dossier vide ne range rien)');
    expect(defauts).toContain("mystere/ : dossier inconnu (l'ajouter à DOSSIERS avec sa raison)");
    // Les dossiers annoncés qui manquent : tous sauf `preuves`, le seul présent.
    expect(defauts.filter((d) => d.endsWith('absent'))).toHaveLength(Object.keys(DOSSIERS).length - 1);
  });
});
