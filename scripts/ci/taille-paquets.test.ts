// @vitest-environment node
/**
 * La garde de taille des paquets (#480).
 *
 * Elle mesure `dist/assets/*.js` et refuse un paquet au-dessus de 500 000 octets, ou un paquet
 * principal au-dessus de son cliquet. Ce fichier tient les deux bouts : les fonctions pures
 * (`mesurer`, `verdict`) sont confrontées à des **tailles fabriquées** — juste sous le seuil,
 * juste au-dessus —, et la lecture disque à un **dossier fabriqué**. Sans ces cas fautifs, une
 * garde qui ne garde rien passerait pour verte (`AGENTS.md` §6).
 */
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PLAFOND_PRINCIPAL,
  SEUIL_PAQUET,
  enKb,
  estPerime,
  mesurer,
  paquetsDe,
  verdict
} from './taille-paquets.mjs';

/** Un paquet fabriqué : seul le nom et la taille comptent pour la garde. */
function paquet(nom: string, octets: number) {
  return { nom, octets, gzip: Math.round(octets / 3.3) };
}

const TEMPORAIRES: string[] = [];

function temporaire(): string {
  const dossier = mkdtempSync(join(tmpdir(), 'taille-paquets-'));
  TEMPORAIRES.push(dossier);
  return dossier;
}

afterEach(() => {
  while (TEMPORAIRES.length > 0) rmSync(TEMPORAIRES.pop() as string, { recursive: true, force: true });
});

describe('les seuils de la garde de taille (#480)', () => {
  it('le seuil par paquet est celui de Vite, en octets décimaux', () => {
    // Vite compte en kB décimaux : `290 251` octets s'affichent « 290,25 kB ».
    expect(SEUIL_PAQUET).toBe(500_000);
    expect(SEUIL_PAQUET).toBeLessThan(500 * 1024);
  });

  it('le cliquet du principal est sous le seuil, et daté par son commentaire', () => {
    expect(Number.isInteger(PLAFOND_PRINCIPAL)).toBe(true);
    expect(PLAFOND_PRINCIPAL).toBeLessThan(SEUIL_PAQUET);
  });

  it('une taille se lit dans l’unité de Vite', () => {
    expect(enKb(290_251)).toBe('290,3 kB');
    expect(enKb(SEUIL_PAQUET)).toBe('500,0 kB');
  });
});

describe('la mesure classe le principal et le plus gros (#480)', () => {
  it('le principal est le morceau d’entrée, le plus gros est le plus lourd', () => {
    const mesures = mesurer([
      paquet('Collection-abc.js', 4_000),
      paquet('react-def.js', 219_000),
      paquet('index-ghi.js', 290_251)
    ]);
    expect(mesures.total).toBe(3);
    expect(mesures.plusGros?.nom).toBe('index-ghi.js');
    expect(mesures.principal?.nom).toBe('index-ghi.js');
    expect(mesures.paquets.map((p) => p.nom)).toEqual(['index-ghi.js', 'react-def.js', 'Collection-abc.js']);
  });

  it('le contrôle mord : deux « index-*.js », ou aucun, et la mesure refuse de choisir', () => {
    expect(verdict(mesurer([paquet('index-a.js', 1_000), paquet('index-b.js', 900)]))).not.toEqual([]);
    expect(verdict(mesurer([paquet('react-a.js', 1_000)]))).not.toEqual([]);
  });
});

describe('le verdict de la garde de taille (#480)', () => {
  it('juste sous le seuil, il passe', () => {
    expect(verdict(mesurer([paquet('index-a.js', 290_000), paquet('react-b.js', SEUIL_PAQUET)]))).toEqual([]);
  });

  it('le contrôle mord : un octet de plus que le seuil, il échoue', () => {
    const echecs = verdict(mesurer([paquet('index-a.js', 290_000), paquet('react-b.js', SEUIL_PAQUET + 1)]));
    expect(echecs).toHaveLength(1);
    expect(echecs[0]).toContain('react-b.js');
    expect(echecs[0]).toContain('au-dessus du seuil');
  });

  it('le contrôle mord : le cliquet du principal, un octet de plus, il échoue', () => {
    expect(verdict(mesurer([paquet('index-a.js', PLAFOND_PRINCIPAL)]))).toEqual([]);
    const echecs = verdict(mesurer([paquet('index-a.js', PLAFOND_PRINCIPAL + 1)]));
    expect(echecs).toHaveLength(1);
    expect(echecs[0]).toContain('cliquet');
  });

  it('le contrôle mord : un dossier sans paquet n’est pas un succès', () => {
    expect(verdict(mesurer([]))).not.toEqual([]);
  });
});

describe('la lecture de dist/ (#480)', () => {
  it('ne lit que les .js, et calcule la taille gzip', () => {
    const dossier = temporaire();
    writeFileSync(join(dossier, 'index-x.js'), 'a'.repeat(10_000));
    writeFileSync(join(dossier, 'note.txt'), 'pas un paquet');
    const paquets = paquetsDe(dossier);
    expect(paquets.map((p) => p.nom)).toEqual(['index-x.js']);
    expect(paquets[0].octets).toBe(10_000);
    expect(paquets[0].gzip).toBeGreaterThan(0);
    expect(paquets[0].gzip).toBeLessThan(10_000);
  });

  it('le contrôle mord : un dist absent, ou plus vieux qu’une source, est périmé', () => {
    const racine = temporaire();
    const dist = join(racine, 'dist');
    const source = join(racine, 'src.ts');
    writeFileSync(source, 'const a = 1;\n');
    // Pas de `dist/index.html` : à construire.
    expect(estPerime({ dist, racine, sources: ['src.ts'] })).toBe(true);

    mkdirSync(dist);
    writeFileSync(join(dist, 'index.html'), '<html></html>');
    // Build plus récent que la source : rien à refaire (c'est le cas de la CI, juste après le build).
    utimesSync(join(dist, 'index.html'), new Date('2026-10-29T10:00:00Z'), new Date('2026-10-29T10:00:00Z'));
    utimesSync(source, new Date('2026-10-29T09:00:00Z'), new Date('2026-10-29T09:00:00Z'));
    expect(estPerime({ dist, racine, sources: ['src.ts'] })).toBe(false);

    // Une source touchée après le build : `dist/` ment, il faut reconstruire.
    utimesSync(source, new Date('2026-10-29T11:00:00Z'), new Date('2026-10-29T11:00:00Z'));
    expect(estPerime({ dist, racine, sources: ['src.ts'] })).toBe(true);
  });
});
