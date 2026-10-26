// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { adaptateurFichier, adaptateurMemoire } from '@/lib/murAdaptateurs';
import { creerMur, type AdaptateurMur } from '@/lib/mur';
import type { Postit } from '@/store/mur';

/**
 * Le port du mur (#254), éprouvé **sans réseau ni navigateur** — l'adapter mémoire est là
 * pour ça.
 *
 * Ce que ces tests gardent, et qui peut réellement échouer :
 *
 * 1. **le port a sept gestes**, pas un de plus : c'est lui la couture, pas un miroir des
 *    requêtes ;
 * 2. **un refus est un résultat, pas une exception** : là où `murBase.ts` levait, le port
 *    rend `{ ok: false, message }` — et le test « le contrôle mord » montre que le refus
 *    existe vraiment (l'adapter, appelé seul, lève) ;
 * 3. **une base muette ne fait pas un mur vide** : la source de secours prend le relais et le
 *    résultat porte la notice de la panne (D-058) ;
 * 4. **le fichier est en lecture seule** : ses six gestes d'écriture sont refusés dans les
 *    termes que les écrans affichent déjà.
 */

/** Un post-it dans la forme du contrat : le mien, en attente, votable par les autres. */
const LE_MIEN: Postit = {
  id: 'p-mien',
  kind: 'IP',
  titre: 'Un bouton pour rendre la main',
  texte: 'Le bouton Fin du tour reste grisé au deuxième tour.',
  ecran: 'Combat',
  pseudo: 'Employé 404',
  version: 'Alpha',
  statut: 'en attente',
  raison: '',
  ticket: null,
  gueulage: false,
  lie: null,
  position: { x: 12, y: 34, angle: -2 },
  votes: { up: 1, down: 0, mon: null },
  mien: true
};

/** Le post-it de quelqu'un d'autre : je peux le voter, pas le corriger ni le retirer. */
const LE_SIEN: Postit = {
  ...LE_MIEN,
  id: 'p-sien',
  titre: 'Le compteur des tickets ment',
  votes: { up: 0, down: 3, mon: null },
  mien: false
};

const DOCUMENT = {
  formulaire: 'https://exemple.test/formulaire',
  postits: [
    {
      id: 'p-fichier',
      kind: 'OUF',
      titre: 'Post-it du fichier',
      texte: 'Le fichier reste la source sans backend.',
      ecran: 'Collection',
      pseudo: 'Employé 404',
      version: 'Alpha',
      statut: 'en attente',
      raison: '',
      ticket: null,
      gueulage: false,
      lie: null,
      position: { x: 8, y: 6, angle: 1 },
      votes: { up: 0, down: 0 }
    }
  ]
};

describe('le port expose sept gestes, et rien de plus (#254)', () => {
  it('les sept gestes sont là, et le port dit d’où il lit', () => {
    const mur = creerMur(adaptateurMemoire());
    expect(Object.keys(mur).sort()).toEqual(
      ['charger', 'corriger', 'deplacer', 'poster', 'retirer', 'source', 'trier', 'voter'].sort()
    );
    expect(mur.source).toBe('memoire');
  });
});

describe('le contrôle mord : un refus est un message, pas une exception (#254)', () => {
  it('l’adapter mémoire refuse un vote pour son propre post-it, et le port le dit', async () => {
    const memoire = adaptateurMemoire([LE_MIEN]);
    const mur = creerMur(memoire);

    // 1. le refus **existe** : appelé seul, l'adapter lève. Si l'adapter se mettait à
    //    accepter, cette assertion tomberait — c'est ce qui fait mordre ce test.
    await expect(memoire.voter('p-mien', 'up', 'inserer')).rejects.toThrow(/on ne vote pas pour son propre post-it/);

    // 2. le port, lui, **rend** le refus : pas de promesse rejetée, un message affichable.
    const resultat = await mur.voter('p-mien', 'up', null);
    expect(resultat).toEqual({
      ok: false,
      message: 'La base refuse ce vote : on ne vote pas pour son propre post-it.'
    });
  });

  it('un refus explicite de l’adapter traverse le port comme un message', async () => {
    const mur = creerMur(adaptateurMemoire([LE_SIEN], { refuse: () => 'La base refuse : compte en attente.' }));
    const resultat = await mur.voter('p-sien', 'up', null);
    expect(resultat).toEqual({ ok: false, message: 'La base refuse : compte en attente.' });
    // Rien n'a été écrit : un refus n'est pas un demi-geste.
    expect(await mur.charger()).toMatchObject({ ok: true });
  });

  it('la panne d’une source devient un message, quelle que soit sa forme', async () => {
    const enPanne: AdaptateurMur = {
      ...adaptateurMemoire(),
      source: 'base',
      async charger() {
        throw 'TypeError: Failed to fetch';
      }
    };
    expect(await creerMur(enPanne).charger()).toEqual({
      ok: false,
      message: 'TypeError: Failed to fetch'
    });
  });
});

describe('la base muette rend le fichier, avec sa notice (D-058)', () => {
  it('une base configurée qui ne répond pas ne fait pas un mur vide', async () => {
    const enPanne: AdaptateurMur = {
      ...adaptateurMemoire([], { sansSession: true }),
      source: 'base',
      async charger() {
        throw new Error('Lecture du mur impossible : TypeError: Failed to fetch');
      }
    };
    const mur = creerMur(enPanne, { secours: adaptateurFichier(DOCUMENT) });

    const resultat = await mur.charger();
    expect(resultat).toMatchObject({
      ok: true,
      source: 'fichier',
      notice: 'Lecture du mur impossible : TypeError: Failed to fetch'
    });
    expect(resultat.ok && resultat.postits.map((postit) => postit.id)).toEqual(['p-fichier']);
  });

  it('quand les deux sources sont muettes, le refus dit les deux pannes', async () => {
    const enPanne: AdaptateurMur = {
      ...adaptateurMemoire(),
      source: 'base',
      async charger() {
        throw new Error('base muette');
      }
    };
    const mur = creerMur(enPanne, { secours: adaptateurFichier({ postits: 'pas une liste' }) });

    const resultat = await mur.charger();
    expect(resultat.ok).toBe(false);
    expect(resultat.ok === false && resultat.message).toMatch(/base muette/);
    expect(resultat.ok === false && resultat.message).toMatch(/fichier/);
  });
});

describe('le fichier est en lecture seule (D-058)', () => {
  it('les six gestes d’écriture sont refusés, dans les termes que les écrans affichent', async () => {
    const mur = creerMur(adaptateurFichier(DOCUMENT));

    expect(
      await mur.poster({ famille: 'IP', gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' })
    ).toEqual({
      ok: false,
      message: 'Le mur n’est pas configuré : le retour se donne pour l’instant de vive voix.'
    });
    expect(await mur.voter('p-fichier', 'up', null)).toMatchObject({ ok: false, message: /on ne vote pas/ });
    expect(await mur.trier('p-fichier', { statut: 'retenu', raison: '', ticket: null })).toMatchObject({
      ok: false,
      message: /il n’y a pas de mur à trier/
    });
    expect(await mur.deplacer('p-fichier', { x: 10, y: 20, angle: 0 })).toMatchObject({
      ok: false,
      message: /la place ne peut pas s’écrire/
    });
    expect(await mur.corriger('p-fichier', { titre: 'T', texte: 'X.' })).toMatchObject({
      ok: false,
      message: /on ne corrige pas de post-it/
    });
    expect(await mur.retirer('p-fichier')).toMatchObject({
      ok: false,
      message: /on ne retire pas de post-it/
    });
  });

  it('lit le fichier quand il a la forme du contrat, et le refuse sinon', async () => {
    expect(await creerMur(adaptateurFichier(DOCUMENT)).charger()).toMatchObject({
      ok: true,
      source: 'fichier'
    });

    const fautif = await creerMur(adaptateurFichier({ formulaire: '', postits: [{ id: 'x' }] })).charger();
    expect(fautif.ok).toBe(false);
    expect(fautif.ok === false && fautif.message).toMatch(/n’a pas la forme du contrat/);
  });

  it('sans document injecté, il lit le vrai `docs/comite.json` du dépôt', async () => {
    const resultat = await adaptateurFichier().charger();
    expect(resultat.length).toBeGreaterThan(0);
    expect(resultat.every((postit) => typeof postit.id === 'string' && postit.id.length > 0)).toBe(true);
  });
});

describe('la mécanique des gestes, sans réseau', () => {
  it('poste un post-it en attente, à moi, dans la forme du contrat', async () => {
    const memoire = adaptateurMemoire();
    const resultat = await creerMur(memoire).poster(
      { famille: 'OUF', gueulage: false, titre: 'Le bouton reste grisé', texte: 'Au combat.', ecran: 'Combat' },
      { id: 'p-neuf', pseudo: 'Employé 404' }
    );

    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.postit).toMatchObject({
      id: 'p-neuf',
      kind: 'OUF',
      statut: 'en attente',
      mien: true,
      votes: { up: 0, down: 0, mon: null }
    });
    // La place est dérivée de l'id, en pourcentage, et dans les bornes de la migration.
    expect(resultat.postit.position.x).toBeGreaterThanOrEqual(0);
    expect(resultat.postit.position.x).toBeLessThanOrEqual(100);
    expect(memoire.contenu()).toHaveLength(1);
  });

  it('un brouillon fautif est un refus, et rien n’est écrit', async () => {
    const memoire = adaptateurMemoire();
    const mur = creerMur(memoire);

    const vide = await mur.poster({ famille: 'IP', gueulage: false, titre: 'Une idée', texte: '  ', ecran: '' });
    expect(vide).toEqual({ ok: false, message: 'Le texte du post-it est vide.' });

    const sansFamille = await mur.poster({
      famille: null,
      gueulage: false,
      titre: 'Une idée',
      texte: 'Un texte.',
      ecran: ''
    });
    expect(sansFamille).toEqual({ ok: false, message: 'Choisis une famille : une IP ou un OUF.' });
    expect(memoire.contenu()).toHaveLength(0);
  });

  it('vote sur le post-it d’un autre, puis retire son pouce', async () => {
    const mur = creerMur(adaptateurMemoire([LE_SIEN]));

    expect(await mur.voter('p-sien', 'up', null)).toEqual({ ok: true, vote: 'up' });
    const apres = await mur.charger();
    expect(apres.ok && apres.postits[0].votes).toEqual({ up: 1, down: 3, mon: 'up' });

    expect(await mur.voter('p-sien', 'up', 'up')).toEqual({ ok: true, vote: null });

    // Un vote qui n'existe plus ne se retire pas en silence : c'est la règle des « 0 ligne »
    // de la base, tenue aussi par la doublure.
    expect(await mur.voter('p-sien', 'down', 'down')).toEqual({
      ok: false,
      message: 'Ton vote n’existe plus : recharge le mur pour voir où il en est.'
    });
  });

  it('trie, mais refuse un écarté sans raison avant d’atteindre la source', async () => {
    const memoire = adaptateurMemoire([LE_SIEN]);
    const mur = creerMur(memoire);

    expect(await mur.trier('p-sien', { statut: 'écarté', raison: '  ', ticket: null })).toMatchObject({
      ok: false,
      message: /raison écrite/
    });
    expect(memoire.contenu()[0].statut).toBe('en attente');

    expect(await mur.trier('p-sien', { statut: 'retenu', raison: '', ticket: null })).toEqual({
      ok: true,
      tri: { statut: 'retenu', raison: '', ticket: null }
    });
  });

  it('un tri réservé à l’administration est refusé à qui ne l’est pas', async () => {
    const mur = creerMur(adaptateurMemoire([LE_SIEN], { administrateur: false }));
    expect(await mur.trier('p-sien', { statut: 'retenu', raison: '', ticket: null })).toMatchObject({
      ok: false,
      message: /seul un administrateur/
    });
  });

  it('déplace une place et la rend arrondie au dixième', async () => {
    const mur = creerMur(adaptateurMemoire([LE_MIEN]));
    expect(await mur.deplacer('p-mien', { x: 12.34, y: 45.67, angle: -1.55 })).toEqual({
      ok: true,
      position: { x: 12.3, y: 45.7, angle: -1.5 }
    });
  });

  it('une place hors du tableau est refusée sans toucher à la source', async () => {
    const memoire = adaptateurMemoire([LE_MIEN]);
    const mur = creerMur(memoire);
    expect(await mur.deplacer('p-mien', { x: 120, y: 20, angle: 0 })).toMatchObject({
      ok: false,
      message: /entre 0 et 100/
    });
    expect(memoire.contenu()[0].position).toEqual(LE_MIEN.position);
  });

  it('corrige mon post-it en attente, et refuse après un tri', async () => {
    const memoire = adaptateurMemoire([LE_MIEN]);
    const mur = creerMur(memoire);

    expect(await mur.corriger('p-mien', { titre: '  ', texte: 'X.' })).toEqual({
      ok: false,
      message: 'Le titre et le texte ne peuvent pas être vides.'
    });
    expect(await mur.corriger('p-mien', { titre: '  Un titre  ', texte: ' Un texte. ' })).toEqual({
      ok: true,
      titre: 'Un titre',
      texte: 'Un texte.'
    });

    await mur.trier('p-mien', { statut: 'retenu', raison: '', ticket: 254 });
    expect(await mur.corriger('p-mien', { titre: 'T', texte: 'X.' })).toMatchObject({
      ok: false,
      message: /a bougé de statut/
    });
  });

  it('retire mon post-it, et refuse celui d’un autre', async () => {
    // Un compte qui n'est pas administrateur : il ne retire que les siens.
    const memoire = adaptateurMemoire([LE_MIEN, LE_SIEN], { administrateur: false });
    const mur = creerMur(memoire);

    expect(await mur.retirer('p-sien')).toEqual({
      ok: false,
      message:
        'La base n’a retiré aucun post-it : il a peut-être bougé de statut (on ne retire le sien qu’en attente), ou tu n’as pas le droit de le retirer.'
    });
    expect(await mur.retirer('p-mien')).toEqual({ ok: true });
    expect(memoire.contenu().map((postit) => postit.id)).toEqual(['p-sien']);
  });

  it('l’administration retire n’importe quel post-it à tout statut (#186)', async () => {
    const memoire = adaptateurMemoire([{ ...LE_SIEN, statut: 'fait', ticket: 254 }]);
    expect(await creerMur(memoire).retirer('p-sien')).toEqual({ ok: true });
    expect(memoire.contenu()).toHaveLength(0);
  });

  it('un post-it disparu est un refus, jamais un succès silencieux', async () => {
    expect(await creerMur(adaptateurMemoire()).voter('p-fantome', 'up', null)).toEqual({
      ok: false,
      message: 'Ce post-it n’existe plus : recharge le mur.'
    });
  });
});
