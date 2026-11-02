// @vitest-environment node
/**
 * Le recensement des illustrations (#499) — sans Vite, sans disque.
 *
 * Le script porte une fonction pure, `recenser` : elle est confrontée ici à un catalogue
 * **fabriqué** dont chaque piège est un cas réel du set :
 *
 * - une base illustrée (fichier présent **et** servi par Vite) ;
 * - une base sans `art` ;
 * - une base dont l'`art` est déclaré mais dont le fichier **manque** ;
 * - une base dont le fichier existe mais que **Vite ne sert pas** (`artUrl` absent) ;
 * - une variante avec sa propre planche, et deux variantes en repli (D-139) ;
 * - un fichier **orphelin**, que personne ne déclare.
 *
 * Le contrôle mord : chaque mauvais compte a un test qui échouerait si le script comptait
 * un simple `art` déclaré, une présence sur disque, ou un repli de variante comme une
 * illustration de plus.
 */
import { describe, expect, it } from 'vitest';
import { recenser, rendreMarkdown, type CarteIllustrable } from './mesure-illustrations.mjs';

const CARTES: CarteIllustrable[] = [
  { id: 'b1', faction: 'SSE', art: 'b1.webp' },
  { id: 'b2', faction: 'SSE' },
  { id: 'b3', faction: 'INTERIM', art: 'b3.webp' },
  { id: 'b4', faction: 'SYNDICAT', art: 'b4.webp' },
  { id: 'v1', faction: 'SSE', art: 'v1.webp', variantOf: 'b1' },
  { id: 'v2', faction: 'SSE', variantOf: 'b1' },
  { id: 'v3', faction: 'SSE', variantOf: 'b2' }
];

/** Le disque : `b3.webp` est déclaré mais absent ; `b4.webp` existe mais n'est pas servi. */
const SUR_DISQUE = ['b1.webp', 'b4.webp', 'v1.webp', 'orpheline.webp'];
const SERVIS = new Set(['b1.webp', 'v1.webp']);

const parId = new Map(CARTES.map((carte) => [carte.id, carte]));
const sources = {
  art: {
    // Le repli de D-139, réduit à ce que `recenser` appelle : la base déclarée, sinon rien.
    artFileOf: (carte: CarteIllustrable) =>
      carte.art ?? (carte.variantOf ? parId.get(carte.variantOf)?.art : undefined),
    artUrl: (fichier: string | undefined) => (fichier && SERVIS.has(fichier) ? `/assets/${fichier}` : undefined)
  },
  fichiers: SUR_DISQUE,
  existe: (fichier: string) => SUR_DISQUE.includes(fichier),
  libelle: (faction: string) => faction
};

describe('recenser — les bases', () => {
  const rapport = recenser(CARTES, sources);

  it('compte les bases et les variantes séparément', () => {
    expect(rapport.cartes).toBe(7);
    expect(rapport.bases).toBe(4);
    expect(rapport.variantes).toBe(3);
  });

  it("ne compte illustrée que la base dont l'art est déclaré, présent et servi par Vite", () => {
    expect(rapport.basesIllustrees).toBe(1);
    expect(rapport.basesSans).toBe(3);
    expect(rapport.idsSansIllustration).toEqual(['b2', 'b3', 'b4']);
  });

  it('un art déclaré sans fichier est une manquante, pas une illustration', () => {
    expect(rapport.manquantes).toEqual(['b3.webp']);
    expect(rapport.idsSansIllustration).toContain('b3');
  });

  it('un fichier présent que Vite ne sert pas ne suffit pas', () => {
    expect(SUR_DISQUE).toContain('b4.webp');
    expect(rapport.idsSansIllustration).toContain('b4');
  });

  it('le fichier que personne ne déclare est une orpheline', () => {
    expect(rapport.orphelines).toEqual(['orpheline.webp']);
  });
});

describe('recenser — les variantes', () => {
  const rapport = recenser(CARTES, sources);

  it('distingue la planche déclarée du repli sur la base (D-139)', () => {
    expect(rapport.variantesAvecPlanche).toBe(1);
    expect(rapport.variantesEnRepli).toBe(2);
  });

  it('un repli n’ajoute aucun fichier au registre', () => {
    // Quatre `art` distincts (b1, b3, b4, v1) ; les deux variantes en repli n'en ajoutent pas.
    expect(rapport.fichiersDeclares).toBe(4);
    expect(rapport.webpSurDisque).toBe(4);
  });
});

describe('recenser — par faction', () => {
  const rapport = recenser(CARTES, sources);

  it('donne les identifiants sans illustration faction par faction', () => {
    expect(rapport.parFaction).toEqual([
      { faction: 'SSE', label: 'SSE', bases: 2, illustrees: 1, sans: 1, ids: ['b2'] },
      { faction: 'INTERIM', label: 'INTERIM', bases: 1, illustrees: 0, sans: 1, ids: ['b3'] },
      { faction: 'SYNDICAT', label: 'SYNDICAT', bases: 1, illustrees: 0, sans: 1, ids: ['b4'] }
    ]);
  });

  it('le compte se referme : bases = illustrées + sans', () => {
    expect(rapport.bases).toBe(rapport.basesIllustrees + rapport.basesSans);
  });
});

describe('rendreMarkdown', () => {
  it('rend le compte, les factions et les deux défauts du registre', () => {
    const markdown = rendreMarkdown(recenser(CARTES, sources));
    expect(markdown).toContain('**1 bases illustrées sur 4**, **3 sans illustration**');
    expect(markdown).toContain('| INTERIM | 1 | 0 | 1 | b3 |');
    expect(markdown).toContain('**Manquantes** (un `art` déclaré sans fichier) : b3.webp.');
    expect(markdown).toContain('**Orphelines** (fichier que personne ne déclare) : orpheline.webp.');
  });
});
