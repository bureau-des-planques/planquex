// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ClientComptes } from '@/lib/comptes';
import { changerMotDePasse, messageDeRecuperation, recuperationMotDePasse } from './recuperation';

/**
 * Le mot de passe oublié (D-159) : le lien part vers l'adresse de retour, le refus se dit en
 * français, et le nouveau mot de passe passe par `updateUser` — le lien, lui, ne change rien.
 *
 * La couture vit dans `src/lib/recuperation.ts` et non dans `comptes.ts` : le paquet principal
 * ne paie que ce que la garde lit au démarrage.
 */

function fauxClient() {
  const resetPasswordForEmail = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
  const updateUser = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
  const client = { auth: { resetPasswordForEmail, updateUser } } as unknown as ClientComptes;
  return { charger: async () => client, resetPasswordForEmail, updateUser };
}

describe('le mot de passe oublié (D-159)', () => {
  it('le lien part vers l’adresse de retour, courriel nettoyé', async () => {
    const faux = fauxClient();
    await recuperationMotDePasse('  a@exemple.test ', {
      chargerClient: faux.charger,
      redirectTo: 'https://planquex.4k7.org/connexion'
    });
    expect(faux.resetPasswordForEmail).toHaveBeenCalledWith('a@exemple.test', {
      redirectTo: 'https://planquex.4k7.org/connexion'
    });
  });

  it('sans configuration, il n’y a pas de lien à envoyer', async () => {
    await expect(recuperationMotDePasse('a@exemple.test', { chargerClient: async () => null })).rejects.toThrow(
      /pas configuré/
    );
  });

  it('une limitation de débit se dit en français, sans le code anglais', async () => {
    const faux = fauxClient();
    faux.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'Email rate limit exceeded' } });
    await expect(recuperationMotDePasse('a@exemple.test', { chargerClient: faux.charger })).rejects.toThrow(
      /Trop de demandes/
    );
  });

  it('une adresse de retour refusée par le projet est nommée', () => {
    // Le cas de l'infra : sans `…/connexion` en liste blanche, Supabase refuse le redirectTo.
    expect(messageDeRecuperation('Redirect URL not allowed')).toMatch(/Authentication → URL Configuration/);
  });

  it('le nouveau mot de passe passe par `updateUser`', async () => {
    const faux = fauxClient();
    await changerMotDePasse('nouveau1', faux.charger);
    expect(faux.updateUser).toHaveBeenCalledWith({ password: 'nouveau1' });
  });
});
