// @vitest-environment node
/**
 * L'accès Postgres du poste de pilotage — `creerAccesPg` (`tools/admin/lib/acces.mjs`).
 *
 * **Ce que ce fichier garde, et pourquoi il existe** : le 30/10/2026, la migration `0022` a
 * échoué en production (`profils_service_fige`). Son SQL portait un `begin`, donc `pg` s'est
 * arrêté à l'instruction fautive **sans exécuter le `commit`** : la connexion d'administration
 * est restée dans une transaction avortée, et **tous** les gestes suivants ont répondu
 * « current transaction is aborted » jusqu'au redémarrage du poste. Le geste correct est un
 * `rollback` — et il n'était nulle part.
 *
 * Le test injecte un faux client : c'est la seule façon d'éprouver cette couture sans réseau.
 */
import { describe, expect, it, vi } from 'vitest';
import { creerAccesPg } from './acces.mjs';

/** Un client `pg` de laboratoire : il note les requêtes et fait échouer celle qu'on nomme. */
function fauxClient({ echoue = null }: { echoue?: string | null } = {}) {
  const appels: string[] = [];
  const query = vi.fn(async (sql: string) => {
    appels.push(sql);
    if (echoue !== null && sql.includes(echoue)) throw new Error('erreur de la base');
    return { rows: [{ n: 1 }], command: 'SELECT' };
  });
  const client = { connect: vi.fn(async () => {}), end: vi.fn(async () => {}), query };
  return { client, appels, query };
}

const acces = (faux: ReturnType<typeof fauxClient>) =>
  creerAccesPg(
    { lecteur_url: 'postgres://lecteur', admin_url: 'postgres://admin' },
    { creerClient: () => faux.client }
  );

describe('l’accès du poste de pilotage (tools/admin/lib/acces.mjs)', () => {
  it('rend une écriture sous la forme commune `{ rows, command, instructions }`', async () => {
    const faux = fauxClient();
    const a = acces(faux);
    await a.demarrer();
    await expect(a.ecrire('update public.profils set pseudo = $1', ['Anaïs'])).resolves.toEqual({
      rows: [{ n: 1 }],
      command: 'SELECT',
      instructions: 1
    });
    expect(faux.appels).toEqual(['update public.profils set pseudo = $1']);
  });

  it('une écriture qui échoue tente un `rollback`, puis relaie l’erreur', async () => {
    const faux = fauxClient({ echoue: 'begin' });
    const a = acces(faux);
    await a.demarrer();

    await expect(a.ecrire('begin; update public.profils set service = $1; commit;')).rejects.toThrow(
      'erreur de la base'
    );
    // Le contrôle mord : sans ce `rollback`, la connexion restait avortée et le geste suivant
    // répondait « current transaction is aborted ».
    expect(faux.appels).toContain('rollback');
    expect(faux.appels.at(-1)).toBe('rollback');
  });

  it('une lecture ne déclenche aucun `rollback` : elle n’a pas de transaction à refermer', async () => {
    const faux = fauxClient();
    const a = acces(faux);
    await a.demarrer();
    await a.lire('select 1');
    expect(faux.appels).not.toContain('rollback');
  });

  it('un `rollback` qui échoue lui-même ne cache pas l’erreur d’origine', async () => {
    const faux = fauxClient({ echoue: 'begin' });
    faux.query.mockImplementation(async (sql: string) => {
      faux.appels.push(sql);
      throw new Error(sql === 'rollback' ? 'connexion perdue' : 'erreur de la base');
    });
    const a = acces(faux);
    await a.demarrer();
    await expect(a.ecrire('begin; select 1; commit;')).rejects.toThrow('erreur de la base');
  });
});
