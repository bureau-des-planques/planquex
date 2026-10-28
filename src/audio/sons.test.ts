import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '@/store/useStore';
import { attendreAmorcage, deverrouiller, jouer, oublier, pret, sonsActives } from './sons';

/**
 * **Le module des deux sons** (#378, D-137). Ce qui se garde ici, ce sont les trois règles de la
 * décision, pas le timbre :
 *
 *  1. **rien au chargement** — importer le module ne crée aucun contexte ;
 *  2. **le réglage coupe** — `sons: false` et aucune lecture n'est demandée (le contrôle mord :
 *     sans cette garde, le son partirait quand même) ;
 *  3. **deux sons** — et pas de lecture quand le contexte n'est pas prêt (mieux vaut le silence
 *     qu'un son en retard).
 */
class FauxContexte {
  static instances: FauxContexte[] = [];
  state: AudioContextState = 'running';
  destination = {} as AudioDestinationNode;
  demarrages = 0;
  constructor() {
    FauxContexte.instances.push(this);
  }
  resume = vi.fn().mockResolvedValue(undefined);
  decodeAudioData = vi.fn().mockResolvedValue({ duree: 1 } as unknown as AudioBuffer);
  createBufferSource = vi.fn(() => ({
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(() => {
      this.demarrages += 1;
    })
  })) as unknown as AudioContext['createBufferSource'];
}

const TAILLE = new Uint8Array(8).buffer;

beforeEach(() => {
  oublier();
  FauxContexte.instances = [];
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = FauxContexte;
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn().mockResolvedValue({ arrayBuffer: async () => TAILLE });
  useStore.setState({ sons: true });
});

afterEach(() => {
  oublier();
  delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
  vi.restoreAllMocks();
});

describe('les deux sons du jeu (#378)', () => {
  it('importer le module ne joue rien et ne crée aucun contexte', () => {
    // Le cas fautif serait un contexte créé au chargement : iOS le laisserait suspendu pour
    // toujours, et le premier son ne partirait jamais.
    expect(FauxContexte.instances).toHaveLength(0);
    expect(pret()).toBe(false);
  });

  it('réglage coupé : le module ne demande aucune lecture — et le contrôle mord', async () => {
    useStore.setState({ sons: false });
    expect(sonsActives()).toBe(false);
    jouer('arrivage');
    expect(FauxContexte.instances.filter((c) => c.demarrages > 0)).toHaveLength(0);

    // Le contrôle mord : le même appel, réglage actif, **doit** produire une lecture. Si la garde
    // disparaissait, la première assertion passerait encore mais celle-ci échouerait.
    useStore.setState({ sons: true });
    deverrouiller();
    await attendreAmorcage();
    expect(pret()).toBe(true);
    jouer('arrivage');
    const ctx = FauxContexte.instances[0];
    expect(ctx.demarrages).toBe(1);
  });

  it('les deux clés jouent chacune leur tampon, et un son inconnu ne joue rien', async () => {
    deverrouiller();
    await attendreAmorcage();
    jouer('arrivage');
    jouer('verdict');
    const ctx = FauxContexte.instances[0];
    expect(ctx.demarrages).toBe(2);
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(2);
  });

  it('un contexte suspendu ne joue pas : mieux vaut le silence qu’un son en retard', async () => {
    deverrouiller();
    await attendreAmorcage();
    const ctx = FauxContexte.instances[0];
    ctx.state = 'suspended';
    jouer('verdict');
    expect(ctx.demarrages).toBe(0);
  });
});
