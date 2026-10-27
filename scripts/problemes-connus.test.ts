// @vitest-environment node
/**
 * Les problèmes connus d'une release (#299, D-119).
 *
 * Trois preuves, et chacune peut échouer :
 *
 * 1. **le filtre** — un OUF `en cours` reste, un `fait` sort, un `en attente` attend, un
 *    `écarté` sort, une IP sort, et un **gueulage ne sort jamais** (ni son titre, ni son
 *    texte) : c'est l'OUF qu'il désigne qui porte le signalement ;
 * 2. **le rendu** — le bloc se colle sous `## Pour un testeur`, et `analyserCorps`
 *    (`scripts/notes-versions.mjs`) ne le fait **pas** entrer dans la note du jeu : la
 *    section est écartée par son titre, pas par le contenu ;
 * 3. **la lecture** — la requête ne demande ni `texte` ni `pseudo`, et le rôle de connexion
 *    doit être `lecteur`. Un `postgres` est refusé **avant** de se connecter.
 *
 * Le banc de la base est le même que les autres gardes : les migrations réelles dans PGlite
 * (`supabase/pglite.ts`), aucun réseau.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyserCorps } from './notes-versions.mjs';
import {
  REQUETE_PROBLEMES,
  STATUTS_PUBLIES,
  argumentsProblemes,
  blocProblemes,
  filtrerProblemes,
  lireProblemesConnus,
  principalProblemes,
  roleDe,
  verifierLectureSeule
} from './problemes-connus.mjs';
import { APPAREIL_A, baseAvecAppareils, avecAppareil, type Base } from '../supabase/pglite';

type Ligne = Record<string, unknown> & {
  id: string;
  kind?: string | null;
  titre: string;
  statut: string;
  ticket?: number | null;
  gueulage?: boolean;
  lie?: string | null;
  version?: string;
};

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = 'scripts/statut-mur.mjs';
const TITRE_GUEULAGE = 'C’EST DE LA MERDE TON JEUX';

function ligne(id: string, statut: string, extra: Partial<Ligne> = {}): Ligne {
  return {
    id,
    kind: 'OUF',
    titre: `Le problème ${id}`,
    statut,
    ticket: null,
    gueulage: false,
    lie: null,
    version: 'Alpha · 0.1.13',
    ...extra
  };
}

/** Une ligne de « problème connu », telle que le filtre la rend (le module `.mjs` n'a pas de types). */
type Probleme = { id: string; titre: string; ticket: number | null };

/** Les points que le parseur de notes **garderait** : ceux qui entrent dans `/feuille-de-route`. */
function pointsDe(corps: string): string[] {
  return analyserCorps(corps).flatMap((groupe) => groupe.points);
}

describe('le filtre des problèmes connus (D-119)', () => {
  it('garde « retenu » et « en cours », et laisse sortir les trois autres statuts', () => {
    // La liste est lue à la source : la changer sans changer ce test doit le faire tomber.
    expect(STATUTS_PUBLIES).toEqual(['retenu', 'en cours']);

    const lignes = [
      ligne('p-retenu', 'retenu'),
      ligne('p-en-cours', 'en cours'),
      ligne('p-en-attente', 'en attente'),
      ligne('p-fait', 'fait'),
      ligne('p-ecarte', 'écarté')
    ];

    const retenus = filtrerProblemes(lignes).map((probleme) => probleme.id);
    expect(retenus).toEqual(['p-retenu', 'p-en-cours']);
    expect(retenus).not.toContain('p-fait');
    expect(retenus).not.toContain('p-en-attente');
    expect(retenus).not.toContain('p-ecarte');
  });

  it('un gueulage ne sort jamais, même retenu : son OUF lié porte le signalement', () => {
    const gueulage = ligne('p-gueulage', 'retenu', {
      kind: null,
      gueulage: true,
      titre: TITRE_GUEULAGE,
      lie: 'p-ouf'
    });
    const ouf = ligne('p-ouf', 'en cours', { titre: 'Le bouton Remplir ne remplit rien' });

    const problemes = filtrerProblemes([gueulage, ouf]);
    expect(problemes.map((probleme: Probleme) => probleme.id)).toEqual(['p-ouf']);

    const bloc = blocProblemes(problemes);
    expect(bloc).toContain('Le bouton Remplir ne remplit rien');
    expect(bloc).not.toContain(TITRE_GUEULAGE);
    expect(bloc).not.toMatch(/gueul/i);
  });

  it('un gueulage seul, sans OUF, ne produit aucune ligne', () => {
    const gueulage = ligne('p-gueulage-seul', 'en cours', {
      kind: null,
      gueulage: true,
      titre: TITRE_GUEULAGE,
      lie: null
    });
    expect(filtrerProblemes([gueulage])).toEqual([]);
  });

  it('une IP n’est pas un problème, et une ligne illisible ne s’affiche pas à moitié', () => {
    const problemes = filtrerProblemes([
      ligne('p-idee', 'en cours', { kind: 'IP' }),
      ligne('p-sans-titre', 'en cours', { titre: '   ' }),
      { id: '', kind: 'OUF', titre: 'orphelin', statut: 'en cours' },
      null
    ]);
    expect(problemes).toEqual([]);
  });

  it('un titre est ramené sur une ligne : un retour ne casse pas la puce', () => {
    const [probleme] = filtrerProblemes([
      ligne('p-multiligne', 'retenu', { titre: 'Première ligne\n\nseconde   ligne', ticket: 299 })
    ]);
    expect(probleme).toMatchObject({ id: 'p-multiligne', titre: 'Première ligne seconde ligne', ticket: 299 });
    expect(blocProblemes([probleme]).split('\n')).toContain('- Première ligne seconde ligne (#299)');
  });

  it('un ticket qui n’est pas un entier positif n’est pas repris', () => {
    const problemes = filtrerProblemes([
      ligne('p-ticket-negatif', 'retenu', { ticket: -4 }),
      ligne('p-ticket-decimal', 'retenu', { ticket: 299.5 })
    ]);
    expect(problemes.map((probleme: Probleme) => probleme.ticket)).toEqual([null, null]);
  });
});

describe('le bloc de release (D-119)', () => {
  const problemes = filtrerProblemes([
    ligne('p-1', 'retenu', { titre: 'Le bouton Remplir ne remplit rien', ticket: 301 }),
    ligne('p-2', 'en cours', { titre: 'La partie à deux perd son code' })
  ]);

  it('n’ouvre aucun titre markdown : un sous-titre rouvrirait la section écartée', () => {
    const bloc = blocProblemes(problemes);
    const titres = bloc.split('\n').filter((ligneBloc: string) => /^#{1,6}\s/.test(ligneBloc));
    expect(titres).toEqual([]);
    expect(bloc).toContain('**Problèmes connus** —');
  });

  it('le contrôle mord : un sous-titre, lui, ferait entrer les problèmes dans la note', () => {
    // Le parseur écarte `## Pour un testeur` par son **titre** ; un `###` le rouvre. C'est la
    // raison du bloc sans titre, et ce test la rend visible : le devient alors un point de
    // la note du jeu.
    const avecSousTitre = ['## Pour un testeur', '', '### Problèmes connus', '', '- Un problème'].join('\n');
    expect(pointsDe(avecSousTitre)).toContain('Un problème');
  });

  it('se lit dans le corps de release, sous « Pour un testeur », sans entrer dans la note', () => {
    const corps = [
      '## Ajouts et améliorations',
      '',
      '- Une nouveauté.',
      '',
      '## Pour un testeur',
      '',
      'Recopie ta version en bas de Réglages.',
      '',
      blocProblemes(problemes)
    ].join('\n');

    expect(corps).toContain('## Pour un testeur');
    expect(corps).toContain('Le bouton Remplir ne remplit rien (#301)');
    expect(corps).toContain('La partie à deux perd son code');

    const points = pointsDe(corps);
    expect(points).toEqual(['Une nouveauté.']);
    expect(points.join('\n')).not.toContain('Le bouton Remplir');
  });

  it('dit qu’il n’y a rien quand la liste est vide, sans inventer de puce', () => {
    const bloc = blocProblemes([]);
    expect(bloc).toBe('**Problèmes connus** — aucun problème ouvert à ce jour.');
    expect(bloc).not.toContain('- ');
  });
});

describe('la lecture de la base (D-119)', () => {
  it('la requête est une lecture, et ne demande ni le texte ni le pseudo', () => {
    expect(REQUETE_PROBLEMES.trim().toLowerCase()).toMatch(/^select\s/);
    expect(REQUETE_PROBLEMES).not.toMatch(/\b(insert|update|delete|drop|alter|truncate|grant|revoke)\b/i);
    // Un gueulage ne peut pas laisser fuir son texte : la colonne n'est pas demandée.
    expect(REQUETE_PROBLEMES).not.toMatch(/\btexte\b/i);
    // Ni le pseudo, qui est une donnée personnelle du mur.
    expect(REQUETE_PROBLEMES).not.toMatch(/\bpseudo\b/i);
    // Le `lie` est lu : c'est lui qui dit quel OUF porte le signalement d'un gueulage.
    expect(REQUETE_PROBLEMES).toMatch(/\blie\b/);
  });

  it('le rôle de la connexion doit être « lecteur », jamais « postgres »', () => {
    expect(roleDe('postgresql://lecteur.abcdef:secret@exemple.test:5432/postgres')).toBe('lecteur');
    expect(roleDe('postgresql://postgres.abcdef:secret@exemple.test:5432/postgres')).toBe('postgres');
    expect(verifierLectureSeule('postgresql://lecteur.abcdef:secret@exemple.test/db')).toBeNull();
    expect(verifierLectureSeule('postgresql://postgres.abcdef:secret@exemple.test/db')).toMatch(/rôle « lecteur »/);
    expect(verifierLectureSeule('')).toMatch(/aucune connexion/);
    expect(verifierLectureSeule('pas une url')).toMatch(/inconnu/);
  });

  /**
   * Le vrai chemin de lecture, sur les **migrations réelles** : un OUF par statut, un
   * gueulage lié, une IP. Seuls les deux OUF publiables doivent revenir — et le gueulage
   * n'est pas dans la requête.
   */
  it('lit les post-its de la base et n’en garde que les OUF publiables', async () => {
    const db: Base = await baseAvecAppareils();
    try {
      const coller = (params: unknown[]) =>
        avecAppareil(db, APPAREIL_A, () =>
          db.query(
            `insert into public.postits (id, kind, titre, texte, version, statut, gueulage, lie, ticket, raison)
             values ($1, $2, $3, $4, 'Alpha · 0.1.13', $5, $6, $7, $8, $9)`,
            params
          )
        );

      await coller(['p-ouf-retenu', 'OUF', 'Le bouton Remplir ne remplit rien', 'Texte.', 'retenu', false, null, 301, '']);
      await coller(['p-ouf-en-cours', 'OUF', 'La partie à deux perd son code', 'Texte.', 'en cours', false, null, null, '']);
      await coller(['p-ouf-fait', 'OUF', 'Déjà corrigé', 'Texte.', 'fait', false, null, null, '']);
      await coller(['p-ouf-attente', 'OUF', 'Pas encore trié', 'Texte.', 'en attente', false, null, null, '']);
      await coller(['p-ouf-ecarte', 'OUF', 'Doublon', 'Texte.', 'écarté', false, null, null, 'doublon de #100']);
      await coller(['p-ip', 'IP', 'Une idée', 'Texte.', 'en cours', false, null, null, '']);
      await coller([
        'p-gueulage',
        null,
        TITRE_GUEULAGE,
        'Le texte brut du gueulage, qui ne doit jamais sortir.',
        'en cours',
        true,
        'p-ouf-en-cours',
        null,
        ''
      ]);

      const problemes = await lireProblemesConnus((sql: string) => db.query(sql));
      expect(problemes.map((probleme: Probleme) => probleme.id)).toEqual(['p-ouf-retenu', 'p-ouf-en-cours']);

      const bloc = blocProblemes(problemes);
      expect(bloc).toContain('Le bouton Remplir ne remplit rien (#301)');
      expect(bloc).toContain('La partie à deux perd son code');
      expect(bloc).not.toContain(TITRE_GUEULAGE);
      expect(bloc).not.toContain('Le texte brut du gueulage');
      expect(bloc).not.toContain('Déjà corrigé');
      expect(bloc).not.toContain('Pas encore trié');
      expect(bloc).not.toContain('Doublon');
      expect(bloc).not.toContain('Une idée');
    } finally {
      await db.close();
    }
  }, 90_000);
});

describe('la commande (D-119)', () => {
  function sortieFactice() {
    const lignes: string[] = [];
    const erreurs: string[] = [];
    return {
      lignes,
      erreurs,
      log: (message: string) => lignes.push(message),
      error: (message: string) => erreurs.push(message)
    };
  }

  it('refuse sans configuration, sans lire docs/comite.json ni se connecter', async () => {
    const sortie = sortieFactice();
    let ouvert = false;
    const code = await principalProblemes(
      [],
      { PROBLEMES_SECRETS_FICHIER: join(mkdtempSync(join(tmpdir(), 'problemes-')), 'absent.json') },
      { sortie, ouvrir: async () => ((ouvert = true), { query: async () => ({ rows: [] }), end: async () => {} }) }
    );

    expect(code).toBe(1);
    expect(ouvert).toBe(false);
    expect(sortie.erreurs.join('\n')).toContain('Aucun repli sur docs/comite.json');
    expect(sortie.lignes).toEqual([]);
  });

  it('refuse un rôle qui n’est pas lecteur avant toute connexion', async () => {
    const sortie = sortieFactice();
    let ouvert = false;
    const code = await principalProblemes(
      [],
      { PROBLEMES_LECTEUR_URL: 'postgresql://postgres.abcdef:secret@exemple.test:5432/postgres' },
      { sortie, ouvrir: async () => ((ouvert = true), { query: async () => ({ rows: [] }), end: async () => {} }) }
    );

    expect(code).toBe(1);
    expect(ouvert).toBe(false);
    expect(sortie.erreurs.join('\n')).toContain('rôle « lecteur »');
  });

  it('lit par le client injecté, imprime le bloc et ferme la connexion', async () => {
    const sortie = sortieFactice();
    let ferme = false;
    const code = await principalProblemes(
      [],
      { PROBLEMES_LECTEUR_URL: 'postgresql://lecteur.abcdef:secret@exemple.test:5432/postgres' },
      {
        sortie,
        ouvrir: async () => ({
          query: async () => ({ rows: [ligne('p-1', 'en cours', { titre: 'La partie à deux perd son code' })] }),
          end: async () => {
            ferme = true;
          }
        })
      }
    );

    expect(code).toBe(0);
    expect(ferme).toBe(true);
    expect(sortie.erreurs).toEqual([]);
    expect(sortie.lignes.join('\n')).toContain('La partie à deux perd son code');
  });

  it('--json rend les lignes, sans mise en forme de release', async () => {
    const sortie = sortieFactice();
    const code = await principalProblemes(
      ['--json'],
      { PROBLEMES_LECTEUR_URL: 'postgresql://lecteur.abcdef:secret@exemple.test:5432/postgres' },
      {
        sortie,
        ouvrir: async () => ({
          query: async () => ({ rows: [ligne('p-1', 'retenu', { titre: 'Un problème', ticket: 301 })] }),
          end: async () => {}
        })
      }
    );

    expect(code).toBe(0);
    expect(JSON.parse(sortie.lignes[0])).toEqual({
      problemes: [{ id: 'p-1', titre: 'Un problème', ticket: 301 }]
    });
  });

  it('un argument inconnu sort en erreur, sans se connecter', async () => {
    const sortie = sortieFactice();
    const code = await principalProblemes(['--ticket', '299'], {}, { sortie });
    expect(code).toBe(1);
    expect(sortie.erreurs[0]).toContain('argument inconnu');
  });

  it('reconnaît --json, --aide, et rien d’autre', () => {
    expect(argumentsProblemes(['--json'])).toEqual({ json: true, aide: false, erreur: null });
    expect(argumentsProblemes(['--aide']).aide).toBe(true);
    expect(argumentsProblemes(['--problemes']).erreur).toContain('argument inconnu');
  });
});

describe('npm run statut -- --problemes (D-119)', () => {
  function lancer(args: string[], env: Record<string, string> = {}) {
    return spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: RACINE,
      encoding: 'utf8',
      env: {
        ...process.env,
        PROBLEMES_LECTEUR_URL: '',
        ADMIN_LECTEUR_URL: '',
        PROBLEMES_SECRETS_FICHIER: join(mkdtempSync(join(tmpdir(), 'problemes-cli-')), 'absent.json'),
        ...env
      }
    });
  }

  it('refuse sans configuration, et ne lit pas le fichier du mur', () => {
    const resultat = lancer(['--problemes']);
    expect(resultat.status).toBe(1);
    expect(resultat.stdout).toBe('');
    expect(resultat.stderr).toContain('Aucun repli sur docs/comite.json');
    // Les titres du fichier ne doivent pas apparaître : c'est le défaut que #299 corrige.
    expect(resultat.stderr).not.toContain('papi');
  });

  it('ne se combine pas avec un déplacement de post-it', () => {
    const resultat = lancer(['p-23-10-2026-01-37-45-papi', 'retenu', '--problemes']);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('ne se combine pas');
    expect(resultat.stderr).toContain('Rien n’a été écrit');
  });

  it('--aide dit les deux modes', () => {
    const resultat = lancer(['--aide']);
    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain('--problemes');
    expect(resultat.stdout).toContain('npm run problemes');
  });
});
