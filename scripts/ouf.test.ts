// @vitest-environment node
/**
 * Le post-it du mur qui devient une issue (#400).
 *
 * Trois preuves, et chacune peut échouer :
 *
 * 1. **le corps** — il dit la famille, l'écran, la version, le pseudo et le **texte
 *    verbatim**, et il cite l'identifiant `p-…` du post-it (le lien dans les deux sens) ;
 * 2. **les refus** — un gueulage n'entre jamais dans un ticket (D-085), une IP non plus, et
 *    sans configuration la commande refuse **avant** de se connecter ;
 * 3. **la couture** — le lanceur `gh` est injecté : sans `--creer`, il n'est **jamais**
 *    appelé (le contrôle mord), et avec lui, son numéro ressort. Aucun réseau ici.
 *
 * La lecture réelle est éprouvée sur les **migrations réelles** dans PGlite, comme
 * `problemes-connus.test.ts`.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REQUETE_POSTIT,
  argumentsOuf,
  corpsDeTicket,
  lirePostit,
  numeroDeIssue,
  principalOuf,
  titreDeTicket,
  verifierPostit
} from './ouf.mjs';
import { APPAREIL_A, baseAvecAppareils, avecAppareil, type Base } from '../supabase/pglite';

const POSTIT = {
  id: 'p-mvrome4s-f93mg6',
  kind: 'OUF',
  titre: 'Bug café attaché',
  texte: 'J’attache un café au Poste, puis il reste sur la Machine à café.',
  ecran: 'Combat',
  version: 'Alpha · 0.1.14',
  pseudo: 'Employé 404',
  statut: 'retenu',
  ticket: null,
  gueulage: false,
  lie: null
};

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

/** Une URL de rôle `lecteur`, et un client factice qui rend la ligne demandée. */
const ENV = { PROBLEMES_LECTEUR_URL: 'postgresql://lecteur.abcdef:secret@exemple.test:5432/postgres' };

function clientFactice(lignes: Record<string, unknown>[]) {
  return {
    query: async () => ({ rows: lignes }),
    end: async () => {}
  };
}

describe('le corps du ticket (#400)', () => {
  it('dit la famille, l’écran, la version, le pseudo, le texte verbatim et le post-it', () => {
    const corps = corpsDeTicket(POSTIT);

    expect(corps).toContain('**Post-it** : `p-mvrome4s-f93mg6`');
    expect(corps).toContain('**Famille** : OUF');
    expect(corps).toContain('**Écran** : Combat');
    expect(corps).toContain('**Version** : Alpha · 0.1.14');
    expect(corps).toContain('**Pseudo** : Employé 404');
    // Le texte est **verbatim**, en citation : on ne le reformule ni ne le tronque.
    expect(corps).toContain('> J’attache un café au Poste, puis il reste sur la Machine à café.');
    expect(corps).not.toMatch(/undefined|null|NaN/);
  });

  it('met chaque ligne du post-it en citation, sans en perdre une', () => {
    const corps = corpsDeTicket({ ...POSTIT, texte: 'Première ligne.\n\nSeconde ligne.' });
    expect(corps).toContain('> Première ligne.\n> \n> Seconde ligne.');
  });

  it('omet un champ vide au lieu d’écrire une étiquette orpheline', () => {
    const corps = corpsDeTicket({ ...POSTIT, ecran: '', version: '', pseudo: '' });
    expect(corps).not.toContain('**Écran**');
    expect(corps).not.toContain('**Version**');
    expect(corps).not.toContain('**Pseudo**');
    expect(corps).not.toMatch(/undefined|null/);
  });

  it('le titre est celui du post-it, sur une ligne', () => {
    expect(titreDeTicket(POSTIT)).toBe('Bug café attaché');
    expect(titreDeTicket({ ...POSTIT, titre: 'Une ligne\n\net une autre ' })).toBe('Une ligne et une autre');
    expect(titreDeTicket({ ...POSTIT, titre: '   ' })).toBe('Post-it p-mvrome4s-f93mg6');
  });

  it('le contrôle mord : retirer l’écran du corps le fait changer', () => {
    const avec = corpsDeTicket(POSTIT);
    const sans = corpsDeTicket({ ...POSTIT, ecran: '' });
    expect(avec).toContain('**Écran** : Combat');
    expect(sans).not.toContain('**Écran** : Combat');
    expect(avec).not.toBe(sans);
  });
});

describe('ce qui ne devient pas un ticket (#400)', () => {
  it('un gueulage est refusé (D-085)', () => {
    const refus = verifierPostit({ ...POSTIT, kind: null, gueulage: true, titre: 'C’EST DE LA MERDE' });
    expect(refus).toContain('gueulage');
    expect(refus).toContain('D-085');
  });

  it('une IP est refusée : la commande ne crée que des signalements', () => {
    expect(verifierPostit({ ...POSTIT, kind: 'IP' })).toContain('pas un OUF');
  });

  it('une ligne illisible ou sans identifiant est refusée', () => {
    expect(verifierPostit(null)).toContain('identifiant');
    expect(verifierPostit({ ...POSTIT, id: '' })).toContain('identifiant');
    expect(verifierPostit(POSTIT)).toBeNull();
  });

  it('la requête est une lecture, par identifiant en paramètre', () => {
    expect(REQUETE_POSTIT.trim().toLowerCase()).toMatch(/^select\s/);
    expect(REQUETE_POSTIT).not.toMatch(/\b(insert|update|delete|drop|alter|truncate|grant|revoke)\b/i);
    expect(REQUETE_POSTIT).toContain('where id = $1');
    // Le corps du ticket porte le texte et le pseudo : la requête les demande.
    expect(REQUETE_POSTIT).toMatch(/\btexte\b/);
    expect(REQUETE_POSTIT).toMatch(/\becran\b/);
    expect(REQUETE_POSTIT).toMatch(/\bversion\b/);
  });
});

describe('la commande ouf (#400)', () => {
  it('refuse sans configuration, sans se connecter ni lancer gh', async () => {
    const sortie = sortieFactice();
    let ouvert = false;
    let lance = false;
    const code = await principalOuf(
      ['p-1'],
      { PROBLEMES_SECRETS_FICHIER: join(mkdtempSync(join(tmpdir(), 'ouf-')), 'absent.json') },
      {
        sortie,
        ouvrir: async () => ((ouvert = true), clientFactice([POSTIT])),
        lancer: () => ((lance = true), { code: 0, sortie: '' })
      }
    );

    expect(code).toBe(1);
    expect(ouvert).toBe(false);
    expect(lance).toBe(false);
    expect(sortie.erreurs.join('\n')).toContain('Aucun repli sur docs/comite.json');
    expect(sortie.lignes).toEqual([]);
  });

  it('refuse un rôle qui n’est pas lecteur avant toute connexion', async () => {
    const sortie = sortieFactice();
    let ouvert = false;
    const code = await principalOuf(
      ['p-1'],
      { PROBLEMES_LECTEUR_URL: 'postgresql://postgres.abcdef:secret@exemple.test:5432/postgres' },
      { sortie, ouvrir: async () => ((ouvert = true), clientFactice([POSTIT])) }
    );
    expect(code).toBe(1);
    expect(ouvert).toBe(false);
    expect(sortie.erreurs.join('\n')).toContain('rôle « lecteur »');
  });

  it('sans --creer, imprime le corps et n’appelle jamais le lanceur — le contrôle mord', async () => {
    const sortie = sortieFactice();
    const lances: string[][] = [];
    const code = await principalOuf(['p-mvrome4s-f93mg6'], ENV, {
      sortie,
      ouvrir: async () => clientFactice([POSTIT]),
      lancer: (args: string[]) => (lances.push(args), { code: 0, sortie: '' })
    });

    expect(code).toBe(0);
    expect(lances).toEqual([]);
    const imprime = sortie.lignes.join('\n');
    expect(imprime).toContain('**Écran** : Combat');
    expect(imprime).toContain('> J’attache un café au Poste');
    // Le contrôle mord : le même appel avec `--creer` **appelle** le lanceur.
    const avec = sortieFactice();
    await principalOuf(['p-mvrome4s-f93mg6', '--creer'], ENV, {
      sortie: avec,
      ouvrir: async () => clientFactice([POSTIT]),
      lancer: (args: string[]) => (lances.push(args), { code: 0, sortie: 'https://github.com/x/issues/402' })
    });
    expect(lances).toHaveLength(1);
    expect(lances[0]).toEqual(['issue', 'create', '--title', 'Bug café attaché', '--body', corpsDeTicket(POSTIT)]);
  });

  it('--creer rend le numéro de l’issue créée', async () => {
    const sortie = sortieFactice();
    const code = await principalOuf(['p-mvrome4s-f93mg6', '--creer'], ENV, {
      sortie,
      ouvrir: async () => clientFactice([POSTIT]),
      lancer: () => ({
        code: 0,
        sortie: 'https://github.com/bureau-des-planques/planquex/issues/402\n'
      })
    });
    expect(code).toBe(0);
    expect(sortie.lignes.join('\n')).toContain('#402');
  });

  it('un gueulage est refusé par la commande, et rien n’est créé', async () => {
    const sortie = sortieFactice();
    const lances: string[][] = [];
    const code = await principalOuf(['p-gueulage', '--creer'], ENV, {
      sortie,
      ouvrir: async () => clientFactice([{ ...POSTIT, id: 'p-gueulage', kind: null, gueulage: true }]),
      lancer: (args: string[]) => (lances.push(args), { code: 0, sortie: '' })
    });
    expect(code).toBe(1);
    expect(lances).toEqual([]);
    expect(sortie.erreurs.join('\n')).toContain('D-085');
  });

  it('un post-it inconnu est refusé, sans composer de ticket', async () => {
    const sortie = sortieFactice();
    const code = await principalOuf(['p-absent'], ENV, { sortie, ouvrir: async () => clientFactice([]) });
    expect(code).toBe(1);
    expect(sortie.erreurs.join('\n')).toContain('aucun post-it');
    expect(sortie.lignes).toEqual([]);
  });

  it('un échec de gh est dit, avec son code', async () => {
    const sortie = sortieFactice();
    const code = await principalOuf(['p-mvrome4s-f93mg6', '--creer'], ENV, {
      sortie,
      ouvrir: async () => clientFactice([POSTIT]),
      lancer: () => ({ code: 1, sortie: 'HTTP 401: Bad credentials' })
    });
    expect(code).toBe(1);
    expect(sortie.erreurs.join('\n')).toContain('Bad credentials');
  });

  it('reconnaît --creer, --aide, un identifiant, et rien d’autre', () => {
    expect(argumentsOuf(['p-1', '--creer'])).toEqual({ id: 'p-1', creer: true, aide: false, erreur: null });
    expect(argumentsOuf(['--aide']).aide).toBe(true);
    expect(argumentsOuf(['--creer']).id).toBeNull();
    expect(argumentsOuf(['--ticket', '4']).erreur).toContain('argument inconnu');
    expect(argumentsOuf(['p-1', 'p-2']).erreur).toContain('un seul post-it');
  });

  it('lit le numéro dans la sortie de gh, et rend null quand il n’y en a pas', () => {
    expect(numeroDeIssue('https://github.com/bureau-des-planques/planquex/issues/402')).toBe(402);
    expect(numeroDeIssue('rien à voir')).toBeNull();
  });
});

describe('la lecture de la base (#400)', () => {
  it('lit un post-it par son identifiant, sur les migrations réelles', async () => {
    const db: Base = await baseAvecAppareils();
    try {
      await avecAppareil(db, APPAREIL_A, () =>
        db.query(
          `insert into public.postits (id, kind, titre, texte, version, statut, gueulage, lie, ticket, raison, ecran)
           values ('p-ouf-ecran', 'OUF', 'Bug café attaché', 'Le texte du testeur.', 'Alpha · 0.1.14', 'retenu', false, null, null, '', 'Combat')`
        )
      );

      const ligne = await lirePostit((sql: string, params?: unknown[]) => db.query(sql, params), 'p-ouf-ecran');
      expect(ligne).toMatchObject({ id: 'p-ouf-ecran', texte: 'Le texte du testeur.', ecran: 'Combat' });
      expect(verifierPostit(ligne)).toBeNull();

      const corps = corpsDeTicket(ligne!);
      expect(corps).toContain('**Écran** : Combat');
      expect(corps).toContain('**Version** : Alpha · 0.1.14');
      expect(corps).toContain('> Le texte du testeur.');
      expect(corps).toContain('`p-ouf-ecran`');

      expect(await lirePostit((sql: string, params?: unknown[]) => db.query(sql, params), 'p-inconnu')).toBeNull();
    } finally {
      await db.close();
    }
  }, 90_000);
});
