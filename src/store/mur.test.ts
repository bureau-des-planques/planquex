import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOCUMENT_MUR, ECRANS, FAMILLES, STATUTS, exporterMur, lireMur } from './mur';

/**
 * Le contrat du fichier du mur (#129, `docs/BOITE-A-IDEES.md` §3).
 *
 * Deux choses sont vérifiées ici, et la seconde compte autant que la première :
 * le **vrai** fichier est conforme, et le contrôle **mord** — chaque règle est
 * confrontée à un `postit` fabriqué qui la viole (`AGENTS.md` §6, ticket #112 : une
 * assertion qui passe quoi qu'il arrive ne garde rien).
 */
const CHEMIN = fileURLToPath(new URL('../../docs/boite-a-idees.json', import.meta.url));

/** Un post-it conforme, qu'un test peut abîmer champ par champ. */
function postit(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p-001',
    kind: 'IP',
    titre: 'Voir combien d’Arrivages il reste à ouvrir',
    texte: 'Je ne sais jamais combien de brouillons il me reste.',
    ecran: 'Accueil',
    pseudo: 'Employé 404',
    version: 'Alpha',
    statut: 'en attente',
    raison: '',
    ticket: null,
    gueulage: false,
    position: { x: 12, y: 34, angle: -2 },
    votes: { up: 0, down: 0 },
    ...extra
  };
}

function doc(...entrees: Array<Record<string, unknown>>) {
  return { formulaire: 'https://exemple.test/formulaire', postits: entrees };
}

const erreursDe = (source: unknown) => lireMur(source).erreurs;

describe('docs/boite-a-idees.json — le fichier du mur', () => {
  it('se lit sans une erreur', () => {
    const { mur, erreurs } = lireMur(DOCUMENT_MUR);
    expect(erreurs).toEqual([]);
    expect(mur).not.toBeNull();
    expect(mur?.postits).toBeInstanceOf(Array);
  });

  it('porte une adresse de formulaire, la seule porte d’écriture de l’alpha', () => {
    const { mur } = lireMur(DOCUMENT_MUR);
    expect(mur?.formulaire).toMatch(/^https:\/\//);
  });

  it('garde les listes admises de la doc, sans en inventer', () => {
    expect([...FAMILLES]).toEqual(['IP', 'OUF']);
    expect([...STATUTS]).toEqual(['en attente', 'retenu', 'en cours', 'fait', 'écarté']);
    expect(ECRANS).toContain('Combat');
  });
});

describe('lireMur — le contrôle mord sur un fichier fabriqué', () => {
  it('accepte un document conforme (le contrôle n’échoue pas toujours)', () => {
    expect(erreursDe(doc(postit()))).toEqual([]);
    expect(erreursDe(doc(postit({ statut: 'écarté', raison: 'hors périmètre' })))).toEqual([]);
  });

  it('refuse une famille hors liste — `kind` vaut IP ou OUF, rien d’autre', () => {
    const erreurs = erreursDe(doc(postit({ kind: 'BUG' })));
    expect(erreurs.some((erreur) => erreur.includes('.kind'))).toBe(true);
    expect(lireMur(doc(postit({ kind: 'BUG' }))).mur).toBeNull();
  });

  it('refuse un statut hors liste', () => {
    expect(erreursDe(doc(postit({ statut: 'peut-être' }))).some((e) => e.includes('.statut'))).toBe(true);
  });

  it('exige une raison dès que le statut vaut « écarté »', () => {
    const sansRaison = erreursDe(doc(postit({ statut: 'écarté', raison: '   ' })));
    expect(sansRaison.some((erreur) => erreur.includes('.raison'))).toBe(true);
  });

  it('refuse deux post-its qui partagent un id', () => {
    const erreurs = erreursDe(doc(postit(), postit({ titre: 'Un doublon' })));
    expect(erreurs.some((erreur) => erreur.includes('identifiant en double'))).toBe(true);
  });

  it('borne la position : x et y dans [0, 100], angle dans [-5, 5]', () => {
    const erreurs = erreursDe(doc(postit({ position: { x: 120, y: -1, angle: 9 } })));
    expect(erreurs.filter((erreur) => erreur.includes('.position'))).toHaveLength(3);
  });

  it('exige le champ `gueulage`, et un booléen', () => {
    expect(erreursDe(doc(postit({ gueulage: 'oui' }))).some((e) => e.includes('.gueulage'))).toBe(true);
    const sansChamp = postit();
    delete sansChamp.gueulage;
    expect(erreursDe(doc(sansChamp)).some((e) => e.includes('.gueulage'))).toBe(true);
  });

  it('refuse ce qui n’est pas un document', () => {
    expect(erreursDe(null)).toEqual(['la racine du fichier n’est pas un objet']);
    expect(erreursDe({ formulaire: '', postits: 'aucun' }).some((e) => e.includes('postits'))).toBe(true);
  });
});

describe('exporterMur — le seul mécanisme d’écriture de l’alpha', () => {
  it('ne remplace que `position`, et rend le reste du fichier tel quel', () => {
    const source = {
      _lisez_moi: 'Le mur se tient à la main.',
      formulaire: 'https://exemple.test/formulaire',
      postits: [postit({ position: { x: 1, y: 2, angle: 0 } })]
    };

    const texte = exporterMur({ 'p-001': { x: 45.67, y: 8.04, angle: -3 } }, source);
    const lu = JSON.parse(texte) as {
      _lisez_moi: string;
      formulaire: string;
      postits: Array<{ position: { x: number; y: number; angle: number }; titre: string }>;
    };

    expect(lu._lisez_moi).toBe('Le mur se tient à la main.');
    expect(lu.formulaire).toBe('https://exemple.test/formulaire');
    expect(lu.postits[0].position).toEqual({ x: 45.7, y: 8, angle: -3 });
    expect(lu.postits[0].titre).toBe('Voir combien d’Arrivages il reste à ouvrir');
    // L'entrée d'origine n'est pas modifiée : l'export travaille sur une copie.
    expect(source.postits[0].position).toEqual({ x: 1, y: 2, angle: 0 });
  });

  it('rend un document relisible, et garde le fichier vide vide', () => {
    const lu = JSON.parse(exporterMur({})) as { postits: unknown[]; formulaire: string };
    const surDisque = JSON.parse(readFileSync(CHEMIN, 'utf8')) as { formulaire: string; postits: unknown[] };

    expect(lu.postits).toEqual(surDisque.postits);
    expect(lu.formulaire).toBe(surDisque.formulaire);
    expect(lireMur(lu).erreurs).toEqual([]);
  });
});
