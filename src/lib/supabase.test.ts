import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  assertClePublique,
  cleEstDeService,
  clientMur,
  configurerMur,
  identiteAppareil,
  VARIABLE_CLE,
  VARIABLE_URL,
  type AppareilAnonyme,
  type ConfigurationMur,
} from '@/lib/supabase';

/**
 * La configuration du mur et l'identité anonyme (#135).
 *
 * Trois choses sont gardées ici, et chacune peut réellement échouer :
 *
 * 1. **l'alpha marche sans backend** : sans les deux variables, le module est inerte (`null`)
 *    et ne lève rien — c'est ce qui laisse `npm run build` et `npm run capturer` debout ;
 * 2. **la clé du jeu est publique** : une clé de service est refusée (elle contournerait les
 *    règles d'accès de la base depuis le navigateur) ;
 * 3. **le module ne lit que les deux variables publiques** : un scan de sa source nomme les
 *    variables `VITE_SUPABASE_*` qu'il touche — en ajouter une troisième casse le test.
 */

/** Un JWT faux, mais de la bonne forme : c'est la charge qui décide du rôle. */
function jwt(charge: Record<string, unknown>): string {
  const segment = (valeur: unknown) => Buffer.from(JSON.stringify(valeur)).toString('base64url');
  return `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment(charge)}.signature-fausse`;
}

const CLE_PUBLIQUE_FAUSSE = 'sb_publishable_exemple-cle-publique-fausse';

/** Un faux client : les trois gestes dont `identiteAppareil` a besoin, et rien de plus. */
function fauxAppareil(options: { session?: string; erreur?: string } = {}) {
  const signInAnonymously = vi.fn(async () => ({
    data: { user: options.erreur ? null : { id: 'appareil-neuf' } },
    error: options.erreur ? { message: options.erreur } : null,
  }));
  const getSession = vi.fn(async () => ({
    data: { session: options.session ? { user: { id: options.session } } : null },
  }));
  const appareil: AppareilAnonyme = { auth: { getSession, signInAnonymously } };
  return { appareil, getSession, signInAnonymously };
}

describe('la configuration du mur (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)', () => {
  it('est inerte quand les deux variables manquent — l’alpha vit sans backend', () => {
    expect(configurerMur({})).toBeNull();
    expect(configurerMur({ [VARIABLE_URL]: '', [VARIABLE_CLE]: '   ' })).toBeNull();
  });

  it('refuse une configuration à moitié posée, au lieu de se taire', () => {
    expect(() => configurerMur({ [VARIABLE_URL]: 'https://exemple.supabase.co' })).toThrow(
      /incomplète/,
    );
    expect(() => configurerMur({ [VARIABLE_CLE]: CLE_PUBLIQUE_FAUSSE })).toThrow(/incomplète/);
  });

  it('lit les deux variables quand elles sont posées, espaces compris', () => {
    const configuration: ConfigurationMur | null = configurerMur({
      [VARIABLE_URL]: ' https://exemple.supabase.co ',
      [VARIABLE_CLE]: ` ${CLE_PUBLIQUE_FAUSSE} `,
    });
    expect(configuration).toEqual({
      url: 'https://exemple.supabase.co',
      clePublique: CLE_PUBLIQUE_FAUSSE,
    });
  });

  it('refuse une clé secrète récente (sb_secret_…)', () => {
    expect(cleEstDeService('sb_secret_exemple')).toBe(true);
    expect(() => assertClePublique('sb_secret_exemple')).toThrow(/clé de service/i);
    expect(() =>
      configurerMur({
        [VARIABLE_URL]: 'https://exemple.supabase.co',
        [VARIABLE_CLE]: 'sb_secret_exemple',
      }),
    ).toThrow(/clé de service/i);
  });

  it('refuse un JWT de rôle service_role, et accepte un JWT anon', () => {
    const service = jwt({ role: 'service_role', iss: 'supabase' });
    const anon = jwt({ role: 'anon', iss: 'supabase' });

    expect(cleEstDeService(service)).toBe(true);
    expect(() => assertClePublique(service)).toThrow(/clé de service/i);

    expect(cleEstDeService(anon)).toBe(false);
    expect(() => assertClePublique(anon)).not.toThrow();
    expect(() =>
      configurerMur({ [VARIABLE_URL]: 'https://exemple.supabase.co', [VARIABLE_CLE]: anon }),
    ).not.toThrow();
  });

  it('ne prend pas un JWT illisible pour une clé de service', () => {
    expect(cleEstDeService('pas.un.jwt')).toBe(false);
    expect(cleEstDeService('')).toBe(false);
  });

  it('ne lit que les deux variables publiques — aucune troisième, aucun accès dynamique', () => {
    const source = readFileSync(new URL('./supabase.ts', import.meta.url), 'utf8');
    const variables = [...new Set(source.match(/VITE_SUPABASE_[A-Z_]+/g) ?? [])].sort();
    expect(variables).toEqual([VARIABLE_CLE, VARIABLE_URL].sort());

    // Une lecture par clé dynamique (`import.meta.env[...]`) ou par `process.env`
    // passerait à côté du scan ci-dessus : on la refuse aussi.
    expect(source).not.toMatch(/import\.meta\.env\s*\[/);
    expect(source).not.toMatch(/process\.env/);
  });
});

describe('l’identité anonyme de l’appareil (D-059 : ni compte, ni mot de passe, ni courriel)', () => {
  it('rend null sans backend configuré, sans lever', async () => {
    await expect(identiteAppareil(async () => null)).resolves.toBeNull();
    await expect(clientMur()).resolves.toBeNull();
  });

  it('signe anonymement un appareil neuf, à sa première visite', async () => {
    const faux = fauxAppareil();
    const identite = await identiteAppareil(async () => faux.appareil);
    expect(identite).toBe('appareil-neuf');
    expect(faux.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('reprend la session persistée, et ne resign pas', async () => {
    const faux = fauxAppareil({ session: 'appareil-deja-signe' });
    const identite = await identiteAppareil(async () => faux.appareil);
    expect(identite).toBe('appareil-deja-signe');
    expect(faux.signInAnonymously).not.toHaveBeenCalled();
  });

  it('dit clairement quand la signature anonyme est refusée (réglage du projet)', async () => {
    const faux = fauxAppareil({ erreur: 'Anonymous sign-ins are disabled' });
    await expect(identiteAppareil(async () => faux.appareil)).rejects.toThrow(
      /Identité anonyme impossible/,
    );
  });
});
