import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Les commandes `gh` que la doc prescrit doivent **marcher**.
 *
 * Constaté du 23 au 26/10/2026 : `docs/agents/issue-tracker.md` disait « resolve with
 * `gh pr view 42` and fall back to `gh issue view 42 » sans `--json`. Sur ce dépôt, ces deux
 * commandes sortent **1** — l'avertissement « Projects (classic) is being deprecated » compte
 * comme une erreur. Les sous-agents recopiaient la ligne telle quelle : **42 appels en échec
 * en trois jours**, mesurés dans la base des sessions.
 *
 * Un document n'est lu par aucun test, donc la correction de la doc ne tient que si un test la
 * garde. Celui-ci lit les documents que les agents consomment et refuse la forme sans `--json`.
 *
 * **Le contrôle mord** : il est confronté à deux textes fabriqués, un fautif et un correct,
 * pour qu'une réécriture du motif ne le rende pas silencieusement inerte (#112).
 */

const RACINE = fileURLToPath(new URL('..', import.meta.url));

/** Les documents lus par les agents : AGENTS.md, docs/ et les skills versionnés. */
function documents(): string[] {
  const trouves: string[] = [];
  const visiter = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      if (entree === 'node_modules' || entree === '.git' || entree === 'dist') continue;
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) visiter(chemin);
      else if (entree.endsWith('.md')) trouves.push(chemin);
    }
  };
  trouves.push(join(RACINE, 'AGENTS.md'));
  visiter(join(RACINE, 'docs'));
  visiter(join(RACINE, '.agents'));
  return trouves;
}

/**
 * Une commande `gh` de lecture **sans `--json`**. `gh ... list` est exclu : il marche sans
 * `--json` (vérifié le 26/10/2026). `gh api`, `gh issue create|comment|edit|close` aussi.
 */
const LECTURE_SANS_JSON = /\bgh (issue|pr) view\b(?![^\n`]*--json)[^\n`]*/g;

/** Le contrôle, pur : ce qu'il trouve de fautif dans un texte. */
export function commandesFautives(texte: string): string[] {
  const fautives: string[] = [];
  // Paragraphe par paragraphe : une ligne qui *documente* le piège (« sans `--json`, `gh`
  // échoue ») couvre sa suite immédiate, où la forme interdite est citée en contre-exemple.
  for (const bloc of texte.split(/\n\s*\n/)) {
    if (/sort\b.*\*\*1\*\*|compte comme une erreur|jamais la sortie par défaut|échoue|erreurs? dans/i.test(bloc)) continue;
    for (const ligne of bloc.split('\n')) {
      for (const m of ligne.matchAll(LECTURE_SANS_JSON)) fautives.push(m[0].trim());
    }
  }
  return fautives;
}

describe('la doc ne prescrit aucune commande `gh` qui échoue (26/10/2026)', () => {
  it('aucun document ne lance `gh issue view` ou `gh pr view` sans --json', () => {
    const fautes: string[] = [];
    for (const doc of documents()) {
      for (const commande of commandesFautives(readFileSync(doc, 'utf8'))) {
        fautes.push(`${relative(RACINE, doc)} : ${commande}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('le contrôle mord : une commande sans --json est refusée, la bonne forme passe', () => {
    expect(commandesFautives('resolve with `gh issue view 42` and fall back')).toEqual(['gh issue view 42']);
    expect(commandesFautives('`gh pr view 42 --comments`')).toEqual(['gh pr view 42 --comments']);
    expect(commandesFautives('`gh issue view 42 --json number,title`')).toEqual([]);
    expect(commandesFautives('`gh pr view 42 --json number`')).toEqual([]);
    // `list` marche sans `--json` : ce n'est pas une faute.
    expect(commandesFautives('`gh issue list --state open`')).toEqual([]);
    // La ligne qui documente le piège pour l'interdire n'est pas fautive.
    expect(commandesFautives('`gh issue view 42` sort **1** sur ce dépôt')).toEqual([]);
  });
});
