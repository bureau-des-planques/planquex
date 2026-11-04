import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — le pool de captures est un module `.mjs` sans déclaration TypeScript.
import { configVoie, fusionnerSorties, lancerVoies, nettoyerSorties, preparerSorties, voieDe } from './capturer-voies.mjs';

/**
 * #707 — le pool de voies de `capturer.mjs`, sans navigateur.
 *
 * Le pool doit conserver **le même inventaire** (chaque scène dans une voie et une seule),
 * donner à chaque voie **son port et son dossier de sortie**, et faire échouer l'ensemble
 * dès qu'une voie échoue. Ces tests mordent : ils confrontent le pool à un enfant qui sort 1
 * et à des dossiers temporaires, ils ne se contentent pas de relire une chaîne du source.
 */
function dossier(): string {
  return mkdtempSync(join(tmpdir(), 'planquex-voies-'));
}

type FauxEnfant = EventEmitter & {
  pid?: number;
  exitCode: number | null;
  killAppele: boolean;
  kill: (signal: string) => void;
};

function fauxEnfant(): FauxEnfant {
  const enfant = new EventEmitter() as FauxEnfant;
  enfant.exitCode = null;
  enfant.killAppele = false;
  enfant.kill = () => {
    enfant.killAppele = true;
    enfant.exitCode = 0;
  };
  return enfant;
}

describe('capturer-voies — le pool de scènes (#707)', () => {
  it('répartit chaque scène dans exactement une voie, et les deux voies travaillent', () => {
    // La suite compte 35 scènes aujourd'hui (19 pages et états, 3 graines, 4 pas-à-pas,
    // 4 mesures de densité, 5 gabarits). Le découpage doit en couvrir exactement 35.
    const voies = Array.from({ length: 35 }, (_, unite) => voieDe(unite, 2));
    expect(voies.every((voie, unite) => voie === unite % 2)).toBe(true);
    expect(new Set(voies)).toEqual(new Set([0, 1]));
    // `VOIES = 1` joue tout, dans l'ordre : le poste garde son comportement.
    expect(Array.from({ length: 35 }, (_, unite) => voieDe(unite, 1))).toEqual(new Array(35).fill(0));
  });

  it('donne à chaque voie un port et un dossier de sortie distincts', () => {
    const captures = join(dossier(), 'captures');
    const a = configVoie(0, 2, { captures });
    const b = configVoie(1, 2, { captures });
    // Deux `vite preview` sur le même port se disputeraient le port ; deux dossiers
    // confondus feraient écrire deux Chrome au même endroit.
    expect(a.port).not.toBe(b.port);
    expect(a.sortie).not.toBe(b.sortie);
    expect(a.env.PORT).not.toBe(b.env.PORT);
    expect(a.env.CAPTURER_SORTIE).not.toBe(b.env.CAPTURER_SORTIE);
  });

  it('fusionne les fichiers des deux voies dans `captures/` sans perdre de nom', () => {
    const racine = dossier();
    try {
      const captures = join(racine, 'captures');
      mkdirSync(captures, { recursive: true });
      preparerSorties(captures, 2);
      writeFileSync(join(captures, '.voie-0', 'a.png'), 'a');
      writeFileSync(join(captures, '.voie-0', 'b.png'), 'b');
      writeFileSync(join(captures, '.voie-1', 'c.png'), 'c');
      fusionnerSorties(captures, 2);
      expect(readdirSync(captures).sort()).toEqual(['a.png', 'b.png', 'c.png']);
      expect(existsSync(join(captures, '.voie-0'))).toBe(false);
      expect(existsSync(join(captures, '.voie-1'))).toBe(false);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('nettoie les dossiers sans fusionner quand une voie échoue', () => {
    const racine = dossier();
    try {
      const captures = join(racine, 'captures');
      mkdirSync(captures, { recursive: true });
      preparerSorties(captures, 2);
      writeFileSync(join(captures, '.voie-0', 'a.png'), 'a');
      nettoyerSorties(captures, 2);
      expect(readdirSync(captures)).toEqual([]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('fait échouer l’ensemble dès qu’une voie échoue, et ferme l’autre', async () => {
    const racine = dossier();
    const enfants: FauxEnfant[] = [];
    try {
      const promesse = lancerVoies({
        total: 2,
        captures: join(racine, 'captures'),
        commande: 'node',
        args: ['capturer.mjs'],
        env: {},
        spawn: () => {
          const enfant = fauxEnfant();
          enfants.push(enfant);
          return enfant;
        }
      });
      // La voie 0 échoue : la voie 1 est encore vivante et doit être fermée.
      enfants[0].emit('close', 1);
      expect(enfants[1].killAppele, 'la voie survivante doit être fermée').toBe(true);
      enfants[1].emit('close', 0);
      const { code, codes } = await promesse;
      expect(code, 'un échec de voie doit faire échouer la capture').toBe(1);
      expect(codes).toEqual([1, 0]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('rend 0 quand les deux voies réussissent', async () => {
    const racine = dossier();
    const enfants: FauxEnfant[] = [];
    try {
      const promesse = lancerVoies({
        total: 2,
        captures: join(racine, 'captures'),
        commande: 'node',
        args: ['capturer.mjs'],
        env: {},
        spawn: () => {
          const enfant = fauxEnfant();
          enfants.push(enfant);
          return enfant;
        }
      });
      enfants[0].emit('close', 0);
      enfants[1].emit('close', 0);
      expect(await promesse).toEqual({ code: 0, codes: [0, 0] });
      expect(enfants[0].killAppele).toBe(false);
      expect(enfants[1].killAppele).toBe(false);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});
