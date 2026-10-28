// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ClientProfil } from './profil';
import {
  creerProfil,
  etapeDuProfil,
  lireProfil,
  messageDeProfil,
  poserService,
  relancerIntitule,
  type Profil
} from './profil';

/**
 * La couture du profil (#325, D-148) : le parcours avance dans l'ordre, la seconde relance est
 * refusée **avant** d'appeler la base, et un refus de la base est dit en français.
 *
 * Un faux client à quatre méthodes suffit : `from(table)` rend une requête qui enregistre ce
 * qu'on lui demande et rend la ligne voulue.
 */
function faux(ligne: Record<string, unknown> | null, erreur: string | null = null) {
  const appels: Array<{ methode: string; valeurs?: unknown }> = [];
  const requete = {
    select: () => requete,
    eq: () => requete,
    insert: (valeurs: unknown) => (appels.push({ methode: 'insert', valeurs }), requete),
    update: (valeurs: unknown) => (appels.push({ methode: 'update', valeurs }), requete),
    then: (resoudre: (v: unknown) => unknown) =>
      resoudre({ data: ligne ? [ligne] : [], error: erreur ? { message: erreur } : null })
  };
  const client = { from: vi.fn(() => requete), auth: {} } as unknown as ClientProfil;
  return { client: () => Promise.resolve(client), appels };
}

const LIGNE = { id: 'u-1', pseudo: 'Anaïs', service: null, intitule: null, intitule_relances: 0 };

describe('ordre du parcours', () => {
  it('sans profil, l’étape est le pseudo ; avec pseudo seul, le service ; avec service, l’intitulé ; avec intitulé, c’est fait', () => {
    expect(etapeDuProfil(null)).toBe('pseudo');
    expect(etapeDuProfil({ ...LIGNE, service: null } as Profil)).toBe('service');
    expect(etapeDuProfil({ ...LIGNE, service: '2e' } as Profil)).toBe('intitule');
    expect(etapeDuProfil({ ...LIGNE, service: '2e', intitule: 'sculpteur de fumée' } as Profil)).toBe('fait');
  });

  it('lit un service inconnu comme absent, et une ligne illisible comme rien', () => {
    expect(lireProfil({ ...LIGNE, service: 'sous-sol' })?.service).toBeNull();
    expect(lireProfil({ pas: 'une ligne' })).toBeNull();
  });
});

describe('relance', () => {
  it('refuse une seconde relance sans appeler la base', async () => {
    const { client, appels } = faux(LIGNE);
    await expect(relancerIntitule('u-1', 1, client)).rejects.toThrow(/une seule relance/);
    expect(appels).toHaveLength(0);
  });

  it('une première relance écrit 1 dans le compteur', async () => {
    const { client, appels } = faux({ ...LIGNE, intitule_relances: 1 });
    await relancerIntitule('u-1', 0, client);
    expect(appels).toEqual([{ methode: 'update', valeurs: { intitule_relances: 1 } }]);
  });
});

describe('écritures', () => {
  it('crée la ligne avec l’identifiant du compte et le pseudo, rognés', async () => {
    const { client, appels } = faux(LIGNE);
    await creerProfil('u-1', '  Anaïs  ', client);
    expect(appels[0]).toEqual({ methode: 'insert', valeurs: { id: 'u-1', pseudo: 'Anaïs' } });
  });

  it('un refus de la base est dit en français, pas recraché brut', async () => {
    const { client } = faux(null, 'new row violates row-level security policy for table "profils"');
    await expect(poserService('u-1', '2e', client)).rejects.toThrow(/refuse ce changement de profil/);
  });
});

describe('messages de refus', () => {
  it('reconnaît les gardes de la migration', () => {
    expect(messageDeProfil('profils_service_fige : …')).toMatch(/figé/);
    expect(messageDeProfil('profils_intitule_fige : …')).toMatch(/enregistré/);
    expect(messageDeProfil('profils_relance_figee : …')).toMatch(/plus de relance/);
    expect(messageDeProfil('profils_intitule_apres_service : …')).toMatch(/service/);
  });
});
