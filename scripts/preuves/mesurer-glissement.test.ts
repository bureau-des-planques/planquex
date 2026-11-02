import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error — module .mjs sans déclaration de types.
import { CONFIGURATION, RETOURNEMENT, analyserCadence, creerMouvements, deltasMesures, emettreMouvements } from './mesurer-glissement.mjs';

const lire = (fichier: string) => readFileSync(new URL(`../../${fichier}`, import.meta.url), 'utf8');

describe('`npm run mesurer:glissement` — la mesure reproductible du geste (#577)', () => {
  it('fixe la taille, le bridage CPU et le nombre de mouvements mesurés', () => {
    expect(CONFIGURATION).toMatchObject({
      viewport: { width: 390, height: 664 },
      cpuThrottlingRate: 6,
      mouvements: 60,
      depart: 0.1,
      arrivee: 0.6
    });
  });

  it('fixe la fenêtre du retournement : même durée pour la référence et le geste (#605)', () => {
    expect(RETOURNEMENT).toEqual({ attenteRevelation: 600, duree: 1400 });
  });

  it('place les 60 mouvements sur la ligne, de 10 % à 60 % de la largeur', () => {
    const mouvements: { clientX: number; clientY: number }[] = creerMouvements({
      left: 20,
      top: 30,
      width: 300,
      lineY: 74
    });
    expect(mouvements).toHaveLength(60);
    expect(mouvements[0].clientX).toBe(52.5);
    expect(mouvements[59].clientX).toBe(200);
    expect(mouvements.every(({ clientY }) => clientY === 74)).toBe(true);
  });

  it('attend une frame distincte avant chaque pointermove', async () => {
    const callbacks: FrameRequestCallback[] = [];
    const raf = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const dispatch = vi.fn();
    const zone = { dispatchEvent: dispatch } as unknown as HTMLElement;
    vi.stubGlobal('document', { querySelector: vi.fn(() => zone) });
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('PointerEvent', class {
      constructor(
        readonly type: string,
        readonly options: PointerEventInit
      ) {}
    });

    try {
      const geste = emettreMouvements({
        selecteur: '[data-zone]',
        mouvements: [{ clientX: 1, clientY: 2 }, { clientX: 3, clientY: 4 }]
      });
      expect(raf).toHaveBeenCalledTimes(1);
      expect(dispatch).not.toHaveBeenCalled();
      callbacks.shift()?.(16);
      await Promise.resolve();
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(raf).toHaveBeenCalledTimes(2);
      callbacks.shift()?.(32);
      await geste;
      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(dispatch.mock.calls.map(([event]) => [event.type, event.options.clientX, event.options.clientY])).toEqual([
        ['pointermove', 1, 2],
        ['pointermove', 3, 4]
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rend les deltas des métriques CDP, pas les compteurs cumulés', () => {
    const cdp = (decalage: number) => ({
      metrics: [
        ['TaskDuration', 1 + decalage],
        ['RecalcStyleDuration', 0.4 + decalage],
        ['ScriptDuration', 0.2 + decalage],
        ['LayoutDuration', 0.05 + decalage]
      ].map(([name, value]) => ({ name, value }))
    });

    expect(deltasMesures(cdp(0), cdp(0.25))).toEqual({
      TaskDuration: 0.25,
      RecalcStyleDuration: 0.25,
      ScriptDuration: 0.25,
      LayoutDuration: 0.25
    });
    expect(() => deltasMesures({ metrics: [] }, { metrics: [] })).toThrow('Métrique CDP absente : TaskDuration');
  });

  it('nomme les images trop longues, avec leur instant : c’est la saccade (#605)', () => {
    const frames = [
      { t: 0, now: 0 },
      { t: 16, now: 16 },
      { t: 32, now: 32 },
      { t: 82, now: 82 }, // une image de 50 ms
      { t: 98, now: 98 }
    ];
    const cadence = analyserCadence(frames);
    expect(cadence.images).toBe(5);
    expect(cadence.mediane).toBe(16);
    expect(cadence.pire).toBe(50);
    expect(cadence.longues).toEqual([{ ecart: 50, offset: 82 }]);
    // Le contrôle mord : une cadence régulière ne signale rien.
    expect(analyserCadence(frames.slice(0, 3)).longues).toEqual([]);
  });

  it('est déclarée et documentée comme commande du dépôt', () => {
    const paquet = JSON.parse(lire('package.json')) as { scripts: Record<string, string> };
    expect(paquet.scripts['mesurer:glissement']).toBe('node scripts/preuves/mesurer-glissement.mjs');
    expect(lire('docs/COMMANDES.md')).toContain('npm run mesurer:glissement');
    expect(lire('scripts/preuves/mesurer-glissement.mjs')).toContain('process.env.CHROME_PATH');
    expect(lire('scripts/preuves/mesurer-glissement.mjs')).toContain('chromium.executablePath()');
  });

  it('garde l’instrumentation CDP, l’ouverture de l’Arrivage et le mode headless', () => {
    const source = lire('scripts/preuves/mesurer-glissement.mjs');
    expect(source).toContain('Emulation.setCPUThrottlingRate');
    expect(source).toContain('Performance.getMetrics');
    for (const metric of ['TaskDuration', 'RecalcStyleDuration', 'ScriptDuration', 'LayoutDuration']) {
      expect(source).toContain(metric);
    }
    expect(source).toContain("'.hero__ouvrir'");
    expect(source).toContain("'[data-zone]'");
    expect(source).toContain('headless: true');
  });

  it('mesure le retournement de la première carte, sur le même appareil simulé (#605)', () => {
    const source = lire('scripts/preuves/mesurer-glissement.mjs');
    // Le mode s'ajoute au glissement, il ne le remplace pas.
    expect(source).toContain("process.argv.includes('--retournement')");
    expect(source).toContain("'.ouverture__carte'");
    expect(source).toContain("dataset.etape === 'revelation'");
    // La fenêtre de référence existe : sans elle, le bruit des particules d'ambiance se lisait
    // comme le coût du retournement.
    expect(source).toContain('mesurerFenetre');
  });
});
