import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fou **du** garde-fou (ticket #112).
 *
 * `scripts/garde-fous.mjs` exige que la suite échoue quand on casse un invariant critique.
 * Le risque évident serait qu'on puisse **vider la table** en silence : ce fichier la
 * compare donc à une **liste attendue**, et fait échouer `npm test` si une entrée disparaît
 * ou si un motif n'est plus ancré dans le code.
 *
 * Le harnais lui-même n'est **pas** lancé ici (il mute des fichiers et prend plusieurs
 * minutes) : c'est `npm run garde-fous`, en local et dans la CI. Ici, seul le contrôle
 * statique `--verifie` est invoqué.
 */
const LANCER = 'scripts/garde-fous.mjs';

/** Les gardes attendues, une par invariant **critique** déjà pris en défaut dans le dépôt. */
// #113, #116 et #118 sont arrivées en parallèle : toutes les entrées sont conservées, et
// la liste est ce que `scripts/garde-fous.test.ts` compare — l'oublier ferait échouer `npm test`.
// #114 : l'évaluation du niveau 2 ne doit pas repartir du flux de hasard de la partie.
const TICKETS_ATTENDUS = [49, 87, 88, 91, 101, 103, 113, 114, 116, 118];

function verifier(args: string[]): { ok: boolean; sortie: string } {
  try {
    const sortie = execFileSync('node', [LANCER, ...args], { encoding: 'utf8' });
    return { ok: true, sortie };
  } catch (erreur) {
    const e = erreur as { stdout?: string; stderr?: string };
    return { ok: false, sortie: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('Garde-fous — la table est ancrée et bornée (#112)', () => {
  it('passe le contrôle statique : chaque motif existe, chaque test ciblé aussi', () => {
    const { ok, sortie } = verifier(['--verifie']);
    expect(sortie, 'le contrôle statique de la table doit passer').toContain('garde-fous ancrés');
    expect(ok, `le contrôle statique a échoué :\n${sortie}`).toBe(true);
  });

  it('couvre exactement les invariants critiques attendus, et rien de moins', () => {
    const { ok, sortie } = verifier(['--verifie', '--json']);
    expect(ok, `le contrôle statique a échoué :\n${sortie}`).toBe(true);
    const rapport = JSON.parse(sortie) as { count: number; tickets: number[]; fichiers: string[] };
    // Retirer une entrée de la table fait échouer ici : c'est ce qui empêche de désarmer
    // le harnais par omission.
    expect(rapport.tickets).toEqual(TICKETS_ATTENDUS);
    expect(rapport.count).toBe(TICKETS_ATTENDUS.length);
    expect(new Set(rapport.fichiers).size).toBeGreaterThan(1);
  });

  it('chaque entrée cite un ticket, un titre et la règle qu’elle garde', () => {
    // Lecture de la **source** de la table, comme `scripts/compteurs.test.ts` lit les
    // docs : une entrée sans justification se glisse plus vite qu'une entrée sans motif.
    // Le comptage est **ancré en début de ligne** : compter `ticket:` en sous-chaîne est
    // faux, car la mutation de #103 porte `ticket: 104` et `ticket: 999` **dans ses
    // propres chaînes**. (Trouvé en écrivant ce test — une garde qui compte mal est une
    // garde qui ment.)
    const source = readFileSync(LANCER, 'utf8');
    const bloc = source.slice(source.indexOf('export const MUTATIONS'), source.indexOf('const VERIFIE'));
    const compter = (champ: string) => (bloc.match(new RegExp(`^\\s{4}${champ}:`, 'gm')) ?? []).length;
    const entrees = compter('ticket');
    expect(entrees, 'nombre d’entrées dans la table').toBe(TICKETS_ATTENDUS.length);
    for (const champ of ['titre', 'garde', 'tests', 'motif', 'remplacement']) {
      expect(compter(champ), `champ ${champ} par entrée`).toBe(entrees);
    }
  });
});