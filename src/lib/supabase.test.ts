import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  assertClePublique,
  cleEstDeService,
  clientMur,
  configurerMur,
  ecrireLigne,
  identiteSession,
  VARIABLE_CLE,
  VARIABLE_URL,
  type SessionPersistee,
  type ConfigurationMur
} from '@/lib/supabase';

/**
 * La configuration du mur et l'identité de la session (#135, #527).
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

/**
 * Un faux client : la seule méthode dont `identiteSession` a besoin, et rien de plus. Depuis
 * D-156 (#527) le client ne **signe** plus : l'absence de session reste une absence.
 */
function fauxAppareil(options: { session?: string } = {}) {
  const getSession = vi.fn(async () => ({
    data: { session: options.session ? { user: { id: options.session } } : null }
  }));
  const appareil: SessionPersistee = { auth: { getSession } };
  return { appareil, getSession };
}

describe('la configuration du mur (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)', () => {
  it('est inerte quand les deux variables manquent — l’alpha vit sans backend', () => {
    expect(configurerMur({})).toBeNull();
    expect(configurerMur({ [VARIABLE_URL]: '', [VARIABLE_CLE]: '   ' })).toBeNull();
  });

  it('refuse une configuration à moitié posée, au lieu de se taire', () => {
    expect(() => configurerMur({ [VARIABLE_URL]: 'https://exemple.supabase.co' })).toThrow(/incomplète/);
    expect(() => configurerMur({ [VARIABLE_CLE]: CLE_PUBLIQUE_FAUSSE })).toThrow(/incomplète/);
  });

  it('lit les deux variables quand elles sont posées, espaces compris', () => {
    const configuration: ConfigurationMur | null = configurerMur({
      [VARIABLE_URL]: ' https://exemple.supabase.co ',
      [VARIABLE_CLE]: ` ${CLE_PUBLIQUE_FAUSSE} `
    });
    expect(configuration).toEqual({
      url: 'https://exemple.supabase.co',
      clePublique: CLE_PUBLIQUE_FAUSSE
    });
  });

  it('refuse une clé secrète récente (sb_secret_…)', () => {
    expect(cleEstDeService('sb_secret_exemple')).toBe(true);
    expect(() => assertClePublique('sb_secret_exemple')).toThrow(/clé de service/i);
    expect(() =>
      configurerMur({
        [VARIABLE_URL]: 'https://exemple.supabase.co',
        [VARIABLE_CLE]: 'sb_secret_exemple'
      })
    ).toThrow(/clé de service/i);
  });

  it('refuse un JWT de rôle service_role, et accepte un JWT anon', () => {
    const service = jwt({ role: 'service_role', iss: 'supabase' });
    const anon = jwt({ role: 'anon', iss: 'supabase' });

    expect(cleEstDeService(service)).toBe(true);
    expect(() => assertClePublique(service)).toThrow(/clé de service/i);

    expect(cleEstDeService(anon)).toBe(false);
    expect(() => assertClePublique(anon)).not.toThrow();
    expect(() => configurerMur({ [VARIABLE_URL]: 'https://exemple.supabase.co', [VARIABLE_CLE]: anon })).not.toThrow();
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

describe('écrire une ligne (#173 : la trace des combats passe par ici)', () => {
  it('sans configuration, rien n’est contacté et la raison est rendue', async () => {
    // Comme pour l’identité : on ne dépend pas du `.env` local, on vide les deux variables.
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    try {
      await expect(ecrireLigne('combats', { graine: 1 })).resolves.toEqual({
        erreur: 'Supabase n’est pas configuré.'
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('l’identité de la session — un compte (D-088), jamais une signature (D-156)', () => {
  it('rend null sans backend configuré, sans lever', async () => {
    // Le test ne doit pas dépendre du `.env` local : on vide les deux variables explicitement.
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    try {
      await expect(identiteSession(async () => null)).resolves.toBeNull();
      await expect(clientMur()).resolves.toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('rend l’identité de la session persistée — un compte (D-088)', async () => {
    const faux = fauxAppareil({ session: 'compte-a' });
    await expect(identiteSession(async () => faux.appareil)).resolves.toBe('compte-a');
  });

  it('ne signe personne quand aucune session n’existe (#527, D-156 (4))', async () => {
    // C'était la porte d'entrée du bug : le compteur du comité signait l'appareil, et la
    // garde prenait ensuite cette identité anonyme pour un compte.
    const faux = fauxAppareil();
    await expect(identiteSession(async () => faux.appareil)).resolves.toBeNull();
    expect(faux.getSession).toHaveBeenCalledTimes(1);
  });
});
