import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NOTES_VERSIONS, noteDe, noteManquante, type NoteVersion } from './versions';

/**
 * **On ne publie pas une version sans sa note** (`docs/VERSIONS.md`, D-090).
 *
 * La note vit dans l'application (`/nouveautes`), et elle est **prise aux releases
 * GitHub** par `npm run notes:versions`. Ce test est la garde : la version lue dans
 * `package.json` doit avoir son entrée dans `NOTES_VERSIONS`. Monter la version sans
 * écrire ce qu'elle contient fait tomber `npm test` — c'est le geste qu'on veut
 * impossible.
 *
 * **Une note écrite d'avance compte** : le tag part **avant** la release GitHub, donc
 * exiger la release rendrait la garde inapplicable au moment précis où elle sert. Ce qui
 * est refusé, c'est une version **sans note du tout**.
 *
 * Le test garde aussi la **forme** de l'historique, parce que c'est la page qui la
 * subit : de la plus récente à la plus ancienne, une entrée par version, avec une date
 * lisible et au moins un point.
 */
const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as { version: string };

/** L'ordre de comparaison : les trois nombres de `majeur.mineur.correctif`. */
function rangs(version: string): number[] {
  return version.split('.').map(Number);
}

function compare(a: string, b: string): number {
  const [x, y] = [rangs(a), rangs(b)];
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
}

describe('les notes de version', () => {
  it('la version de package.json a sa note', () => {
    // La version vient du paquet, jamais de ce fichier de test : une montée de version
    // sans note doit rougir ici, pas dans un numéro recopié.
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(noteManquante(pkg.version), `aucune note pour ${pkg.version}`).toBe(false);
    expect(noteDe(pkg.version)?.points.length).toBeGreaterThan(0);
  });

  it('va de la plus récente à la plus ancienne', () => {
    const versions = NOTES_VERSIONS.map((note) => note.version);
    for (let i = 1; i < versions.length; i++) {
      expect(
        compare(versions[i - 1], versions[i]),
        `${versions[i - 1]} avant ${versions[i]}`
      ).toBeGreaterThan(0);
    }
  });

  it('porte une entrée par version, datée et remplie', () => {
    const versions = NOTES_VERSIONS.map((note) => note.version);
    expect(new Set(versions).size).toBe(versions.length);

    for (const note of NOTES_VERSIONS) {
      expect(note.version, 'numéro attendu').toMatch(/^\d+\.\d+\.\d+$/);
      expect(note.date, `date de ${note.version}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Une date qui ne se lit pas au calendrier (« 2026-02-31 ») est un défaut d'écriture.
      expect(new Date(`${note.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(note.date);
      expect(note.titre.trim(), `titre de ${note.version}`).not.toBe('');
      expect(note.points.length, `points de ${note.version}`).toBeGreaterThan(0);
      for (const point of note.points) {
        expect(point.texte.trim(), `point vide dans ${note.version}`).not.toBe('');
        // Le markdown de la release est retiré à la génération : un `**` qui reste se
        // lirait tel quel à l'écran, et c'est un défaut visible.
        expect(point.texte, `markdown resté dans ${note.version}`).not.toMatch(/\*\*|`/);
      }
    }
  });

  it('n’a pas deux fois le même point dans une note (le générateur ne doit pas doubler)', () => {
    for (const note of NOTES_VERSIONS) {
      const textes = note.points.map((point) => point.texte);
      expect(new Set(textes).size, `points répétés dans ${note.version}`).toBe(textes.length);
    }
  });

  it('n’écrit d’avance que pour la version à venir, jamais pour une version passée', () => {
    // Une note écrite d'avance (que GitHub ne connaît pas encore) ne peut concerner que la
    // version **courante ou une suivante** : un brouillon oublié sur une vieille version
    // signalerait une release jamais publiée, et l'écran le cacherait en silence.
    for (const note of NOTES_VERSIONS.filter((entree) => entree.brouillon)) {
      expect(
        compare(note.version, pkg.version),
        `${note.version} est écrite d'avance alors que la version courante est ${pkg.version}`
      ).toBeGreaterThanOrEqual(0);
    }
  });

  // Le contrôle doit pouvoir échouer : sans ce cas, l'assertion du dessus ne garde rien.
  it('le contrôle mord : une version sans aucune note est refusée', () => {
    const note: NoteVersion = {
      version: '9.9.9',
      date: '2026-10-24',
      titre: 'Une version quelconque',
      points: [{ texte: 'Un point.' }]
    };
    expect(noteManquante('9.9.9')).toBe(true);
    expect(noteManquante('9.9.9', [note])).toBe(false);
    // Une note écrite d'avance compte aussi : le tag part avant la release.
    expect(noteManquante('9.9.9', [{ ...note, brouillon: true }])).toBe(false);
    // Une note d'une **autre** version ne couvre pas celle-ci.
    expect(noteManquante('9.9.8', [note])).toBe(true);
  });
});
