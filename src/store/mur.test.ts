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
    lie: null,
    position: { x: 12, y: 34, angle: -2 },
    votes: { up: 0, down: 0 },
    ...extra
  };
}

/**
 * Un gueulage conforme **depuis D-085** : `gueulage: true`, **pas de `kind`** (une
 * famille n'est pas la sienne), et `lie` nul ou l'id du post-it collé dessus.
 */
function gueulage(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const entree = postit({ gueulage: true, lie: null, ...extra });
  // `extra` peut **ajouter** une famille : c'est le cas fautif que le contrôle doit mordre.
  if (!('kind' in extra)) delete entree.kind;
  return entree;
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

/**
 * D-085 : un gueulage n'est **ni une IP ni un OUF**, c'est une nature à part. Il ne porte
 * aucune famille (`kind` absent du fichier), et peut porter `lie`, l'id du post-it
 * (IP ou OUF) qu'on lui a collé dessus.
 */
describe('un gueulage est à part — D-085', () => {
  it('accepte un gueulage sans famille, et le lit avec `kind === null`', () => {
    const { mur, erreurs } = lireMur(doc(gueulage()));
    expect(erreurs).toEqual([]);
    expect(mur?.postits[0].kind).toBeNull();
    expect(mur?.postits[0].gueulage).toBe(true);
  });

  it('refuse une famille portée par un gueulage — la règle de D-068 §2 est amendée', () => {
    const erreurs = erreursDe(doc(gueulage({ kind: 'IP' })));
    expect(
      erreurs.some((erreur) => erreur.includes('.kind') && erreur.includes('un gueulage ne porte pas de famille'))
    ).toBe(true);
    expect(lireMur(doc(gueulage({ kind: 'OUF' }))).mur).toBeNull();
  });

  it('exige toujours une famille sur un post-it ordinaire', () => {
    const sansFamille = postit();
    delete sansFamille.kind;
    expect(erreursDe(doc(sansFamille)).some((erreur) => erreur.includes('.kind'))).toBe(true);
    expect(erreursDe(doc(postit({ kind: null }))).some((erreur) => erreur.includes('.kind'))).toBe(true);
  });

  it('lit un `lie` valide, quelle que soit la place du post-it collé dans le fichier', () => {
    // Le post-it collé **précède** le gueulage : le contrôle passe après la boucle.
    const { mur, erreurs } = lireMur(
      doc(postit({ id: 'p-002', kind: 'OUF', titre: 'Le bouton reste grisé' }), gueulage({ lie: 'p-002' }))
    );
    expect(erreurs).toEqual([]);
    expect(mur?.postits[1].lie).toBe('p-002');
    expect(mur?.postits[1].kind).toBeNull();
  });

  it('refuse un `lie` qui ne désigne aucun post-it du fichier', () => {
    const erreurs = erreursDe(doc(gueulage({ lie: 'p-absent' })));
    expect(erreurs.some((erreur) => erreur.includes('.lie') && erreur.includes('p-absent'))).toBe(true);
    expect(lireMur(doc(gueulage({ lie: 'p-absent' }))).mur).toBeNull();
  });

  it('refuse un `lie` qui désigne un gueulage — un gueulage ne se colle pas sur un gueulage', () => {
    const erreurs = erreursDe(doc(gueulage({ id: 'p-001', lie: 'p-002' }), gueulage({ id: 'p-002' })));
    expect(erreurs.some((erreur) => erreur.includes('.lie') && erreur.includes('gueulage'))).toBe(true);
  });

  it('refuse un `lie` vide ou qui n’est pas un texte', () => {
    expect(erreursDe(doc(gueulage({ lie: '   ' }))).some((e) => e.includes('.lie'))).toBe(true);
    expect(erreursDe(doc(gueulage({ lie: 42 }))).some((e) => e.includes('.lie'))).toBe(true);
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

  it('ne fabrique pas de famille, et laisse `lie` traverser tel quel (D-085)', () => {
    const source = {
      formulaire: '',
      postits: [
        gueulage({ id: 'p-gueule', lie: 'p-002' }),
        postit({ id: 'p-002', kind: 'OUF' })
      ]
    };

    const lu = JSON.parse(exporterMur({}, source)) as { postits: Array<Record<string, unknown>> };
    // Le gueulage garde `kind` **absent** : l'export ne le réécrit pas en « IP ».
    expect(lu.postits[0]).not.toHaveProperty('kind');
    expect(lu.postits[0].lie).toBe('p-002');
    expect(lu.postits[1].kind).toBe('OUF');
  });

  it('rend un document relisible, et garde le fichier vide vide', () => {
    const lu = JSON.parse(exporterMur({})) as { postits: unknown[]; formulaire: string };
    const surDisque = JSON.parse(readFileSync(CHEMIN, 'utf8')) as { formulaire: string; postits: unknown[] };

    expect(lu.postits).toEqual(surDisque.postits);
    expect(lu.formulaire).toBe(surDisque.formulaire);
    expect(lireMur(lu).erreurs).toEqual([]);
  });
});
