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
  DELTA_MAX_SANS_ASSUME,
  PLAFOND_PRINCIPAL,
  SEUIL_PAQUET,
  dateCourte,
  deciderReleve,
  enKb,
  estPerime,
  ligneReleve,
  mesurer,
  paquetsDe,
  releveDansSource,
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
    expect(verdict(mesurer([paquet('index-a.js', PLAFOND_PRINCIPAL - 1), paquet('react-b.js', SEUIL_PAQUET)]))).toEqual(
      []
    );
  });

  it('le contrôle mord : un octet de plus que le seuil, il échoue', () => {
    const echecs = verdict(
      mesurer([paquet('index-a.js', PLAFOND_PRINCIPAL - 1), paquet('react-b.js', SEUIL_PAQUET + 1)])
    );
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

/** Le 02/11/2026, la date des relevés du ticket #581. */
const LE_02_11_2026 = new Date(2026, 10, 2);

/** Une source fabriquée : la forme exacte du fichier, réduite au commentaire et au cliquet. */
const SOURCE = `/**
 * Le cliquet du paquet principal.
 *
 * **Relevé de 673 octets le 02/11/2026** (268 361 octets) (#566) : la déchirure.
 */
export const PLAFOND_PRINCIPAL = 268_361;
`;

describe('le relevé du cliquet exige sa raison (#581)', () => {
  it('la ligne datée reprend la forme des relevés déjà écrits', () => {
    expect(dateCourte(LE_02_11_2026)).toBe('02/11/2026');
    expect(ligneReleve({ delta: 462, octets: 268_823, raison: 'le glyphe (#525)', date: LE_02_11_2026 })).toBe(
      '**Relevé de 462 octets le 02/11/2026** (268 823 octets) — le glyphe (#525)'
    );
    // Les milliers s'écrivent avec une espace, comme dans les relevés du commentaire.
    expect(ligneReleve({ delta: 12_345, octets: 280_706, raison: 'x', date: LE_02_11_2026 })).toContain(
      '**Relevé de 12 345 octets le 02/11/2026** (280 706 octets)'
    );
  });

  it('le contrôle mord : sans raison, il refuse et dit la commande à taper', () => {
    const refus = deciderReleve({ octets: PLAFOND_PRINCIPAL + 1, raison: '' });
    expect(refus.releve).toBe(false);
    expect(refus.refus).toContain('--raison');
    expect(deciderReleve({ octets: PLAFOND_PRINCIPAL + 1, raison: '   ' }).releve).toBe(false);
  });

  it('le contrôle mord : au-delà de 5 000 octets, il refuse sans --assume', () => {
    const plafond = PLAFOND_PRINCIPAL;
    expect(DELTA_MAX_SANS_ASSUME).toBe(5_000);
    const refus = deciderReleve({ octets: plafond + DELTA_MAX_SANS_ASSUME + 1, raison: 'gros ajout' });
    expect(refus.releve).toBe(false);
    expect(refus.refus).toContain('--assume');
    // La borne est inclusive : 5 000 octets passent, 5 001 non.
    expect(deciderReleve({ octets: plafond + DELTA_MAX_SANS_ASSUME, raison: 'gros ajout' }).releve).toBe(true);
    expect(
      deciderReleve({ octets: plafond + DELTA_MAX_SANS_ASSUME + 1, raison: 'gros ajout', assume: true }).releve
    ).toBe(true);
  });

  it('rien à relever quand le paquet tient déjà sous le cliquet', () => {
    expect(deciderReleve({ octets: PLAFOND_PRINCIPAL, raison: 'x' })).toEqual({
      releve: false,
      delta: 0,
      octets: PLAFOND_PRINCIPAL,
      raison: 'x'
    });
    expect(deciderReleve({ octets: PLAFOND_PRINCIPAL - 10_000, raison: 'x' }).releve).toBe(false);
  });

  it('la raison tient sur une ligne, même écrite avec des retours', () => {
    const decision = deciderReleve({ octets: PLAFOND_PRINCIPAL + 10, raison: '  une raison\n  sur deux lignes  ' });
    expect(decision.raison).toBe('une raison sur deux lignes');
  });

  it('le relevé réécrit le nombre et pose la ligne datée dans le commentaire', () => {
    const releve = releveDansSource(SOURCE, {
      octets: 268_823,
      delta: 462,
      raison: 'le glyphe (#525)',
      date: LE_02_11_2026
    });
    expect(
      releve.endsWith(
        ' *\n * **Relevé de 462 octets le 02/11/2026** (268 823 octets) — le glyphe (#525)\n */\n' +
          'export const PLAFOND_PRINCIPAL = 268_823;\n'
      )
    ).toBe(true);
    // Le relevé précédent reste, et le nombre n'apparaît qu'une fois sous sa nouvelle valeur.
    expect(releve).toContain('**Relevé de 673 octets le 02/11/2026** (268 361 octets) (#566)');
    expect(releve.match(/export const PLAFOND_PRINCIPAL/g)).toHaveLength(1);
  });

  it('le relevé est idempotent : au nouveau plafond, il n’y a plus rien à relever', () => {
    const releve = releveDansSource(SOURCE, {
      octets: 268_823,
      delta: 462,
      raison: 'le glyphe (#525)',
      date: LE_02_11_2026
    });
    const nouveau = Number(/export const PLAFOND_PRINCIPAL = (\d[\d_]*);/.exec(releve)![1].replaceAll('_', ''));
    expect(nouveau).toBe(268_823);
    // Ce que la commande redemande au second passage : la mesure égale au cliquet ne réécrit rien.
    expect(deciderReleve({ octets: nouveau, plafond: nouveau, raison: 'le glyphe (#525)' }).releve).toBe(false);
  });

  it('le contrôle mord : une source sans PLAFOND_PRINCIPAL lève au lieu d’écrire à l’aveugle', () => {
    expect(() =>
      releveDansSource('export const AUTRE = 1;\n', { octets: 2, delta: 1, raison: 'x', date: LE_02_11_2026 })
    ).toThrow(/PLAFOND_PRINCIPAL/);
  });
});
