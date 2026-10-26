import { spawn, spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { estOuvreur, refuserOuverture } from './setup-poste';

describe('Un test n’ouvre rien sur le poste (25/10/2026)', () => {
  it('reconnaît les ouvreurs de fenêtre, par nom ou par chemin', () => {
    expect(estOuvreur('xdg-open')).toBe(true);
    expect(estOuvreur('/usr/bin/xdg-open')).toBe(true);
    expect(estOuvreur('open')).toBe(true);
    expect(estOuvreur('node')).toBe(false);
    expect(estOuvreur(undefined)).toBe(false);
  });

  it('le contrôle mord : un vrai `spawn("xdg-open")` lève, sans rien lancer', () => {
    expect(() => spawn('xdg-open', ['http://127.0.0.1:5199/?jeton=test'])).toThrow(/ouvrirait une fenêtre/);
    expect(() => spawnSync('/usr/bin/xdg-open', ['x'])).toThrow(/ouvrirait une fenêtre/);
  });

  it('laisse passer toute autre commande', () => {
    const reel = vi.fn((_commande: string, ..._reste: string[]) => 'ok');
    expect(refuserOuverture(reel)('node', '-e', '0')).toBe('ok');
    expect(reel).toHaveBeenCalledWith('node', '-e', '0');
    expect(spawnSync('node', ['-e', '0']).status).toBe(0);
  });
});
