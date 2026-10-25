import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
 *
 * #176 : les deux ordres ne doivent **pas** se chevaucher — `npm run garde-fous` mute un
 * fichier que `npm test` lit. C'est pourquoi le contrôle statique est lancé par son
 * **chemin absolu**, et qu'un test vérifie qu'il ne touche à **aucun** fichier de la
 * table : la cohabitation reste une règle de lancement (la CI enchaîne les deux), et
 * l'état lu par `npm test` ne dépend plus d'un `cwd` ni d'une écriture.
 */
const LANCER = 'scripts/garde-fous.mjs';

/**
 * La racine du dépôt, et **non le répertoire courant** du worker : un sous-processus
 * lancé avec un chemin relatif dépend du `cwd` que `vitest` a bien voulu donner.
 * Depuis #176, le harnais est lancé par son **chemin absolu**, dans la racine — un
 * test qui lançait `node scripts/garde-fous.mjs` héritait du `cwd` et pouvait lire un
 * autre fichier que celui du dépôt testé.
 */
const racine = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(racine, LANCER);

/** Les gardes attendues, une par invariant **critique** déjà pris en défaut dans le dépôt. */
// #113, #116 et #118 sont arrivées en parallèle : toutes les entrées sont conservées, et
// la liste est ce que `scripts/garde-fous.test.ts` compare — l'oublier ferait échouer `npm test`.
// #114 : l'évaluation du niveau 2 ne doit pas repartir du flux de hasard de la partie.
// #97 : le wizard d'illustration — le nom du fichier rangé, l'arrêt sur une vérification
// ratée, et le message du registre, qui ne doit pas annoncer ce qui n'a pas eu lieu.
// #123 : le forfait suit le camp qui a la main — une entrée de plus, et une seule, pour
// le préfacteur du PvP (#122).
// #124 : le codec du PvP — sans son empreinte, un code altéré rejoue une autre partie
// en silence ; la mutation tombe sur la comparaison, pas sur la fonction.
// #182 : la note de version (D-090) — sans la recherche de la note courante, la garde
// « on ne publie pas une version sans sa note » ne garde plus rien.
// #188 : l'inspecteur du combat — une infobulle de lecture ne porte aucun bouton (le patron ARIA).
// #192 : les effets de la scène — aucune animation de plus de 800 ms (SPEC-COMBAT-UI §6.8.3).
const TICKETS_ATTENDUS = [49, 87, 88, 91, 97, 97, 97, 101, 103, 113, 114, 116, 118, 123, 124, 182, 184, 188, 192];

function verifier(args: string[]): { ok: boolean; sortie: string } {
  try {
    // `process.execPath` et non `'node'` : le nœud qui exécute la suite, pas celui que
    // le `PATH` du moment désigne. Un chemin **absolu**, un `cwd` explicite, et un
    // délai borné : un enfant qui se bloque doit rendre un échec nommé, jamais
    // suspendre la suite (constat de #176 : deux ordres pouvaient se bloquer l'un
    // l'autre sans un mot).
    const sortie = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: racine,
      encoding: 'utf8',
      timeout: 120_000
    });
    return { ok: true, sortie };
  } catch (erreur) {
    const e = erreur as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, sortie: `${e.stdout ?? ''}${e.stderr ?? ''}${e.stdout || e.stderr ? '' : e.message ?? ''}` };
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
    const source = readFileSync(SCRIPT, 'utf8');
    const bloc = source.slice(source.indexOf('export const MUTATIONS'), source.indexOf('const VERIFIE'));
    const compter = (champ: string) => (bloc.match(new RegExp(`^\\s{4}${champ}:`, 'gm')) ?? []).length;
    const entrees = compter('ticket');
    expect(entrees, 'nombre d’entrées dans la table').toBe(TICKETS_ATTENDUS.length);
    for (const champ of ['titre', 'garde', 'tests', 'motif', 'remplacement']) {
      expect(compter(champ), `champ ${champ} par entrée`).toBe(entrees);
    }
  });

  /**
   * Le contrôle **mord** (#176) : `npm test` ne doit lire que du code stable.
   *
   * `--verifie` est présenté comme « ne mute rien ». C'était une promesse de
   * commentaire, pas une garde : ce test prend l'empreinte des fichiers que la table
   * vise, lance le contrôle statique, et exige que **rien** ait bougé. Rendre le
   * contrôle mutant (ou lui faire écrire un fichier de cache) le fait tomber.
   *
   * La liste vient du rapport `--json` du script : elle n'est pas recopiée ici, donc
   * elle ne peut pas prendre du retard sur la table.
   */
  it('le contrôle statique ne mute aucun fichier de la table', () => {
    const { ok, sortie } = verifier(['--verifie', '--json']);
    expect(ok, `le contrôle statique a échoué :\n${sortie}`).toBe(true);
    const { fichiers } = JSON.parse(sortie) as { fichiers: string[] };
    const empreinte = () =>
      [...new Set(fichiers)]
        .sort()
        .map((fichier) => `${fichier}:${createHash('sha1').update(readFileSync(join(racine, fichier))).digest('hex')}`)
        .join('\n');

    const avant = empreinte();
    verifier(['--verifie']);
    expect(empreinte(), 'le contrôle statique a modifié un fichier qu’un autre test lit').toBe(avant);
  });
});