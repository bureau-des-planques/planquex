import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lireMur } from '../src/store/mur';

/**
 * L'import des réponses du formulaire (#177).
 *
 * Le script est testé **comme une commande** (`AGENTS.md` §7, même technique que
 * `simulate.test.ts`) : c'est `npm run mur:import` que Bastien lancera, pas une fonction.
 * Aucun test ne touche le réseau : `--fichier` lit un CSV temporaire, et `--mur` écrit
 * dans une copie du fichier du mur. Sans `--mur`, ces tests écraseraient le vrai fichier.
 *
 * **Les en-têtes sont ceux du vrai formulaire**, mesurés le 23/10/2026 : 19 colonnes, dont
 * trois en double (`Titre`, `Écran`, `Capture`) — les colonnes 7 à 12 pour le chemin bug,
 * 13 à 17 pour le chemin idée. C'est le piège : un mapping par nom perdrait la première.
 *
 * Chaque garde est confrontée à un cas fautif — un CSV vide, sans en-tête, un post-it
 * déjà trié (ticket #112 : une assertion qui ne peut pas échouer ne garde rien).
 */
const RACINE = fileURLToPath(new URL('..', import.meta.url));
const MUR_SOURCE = join(RACINE, 'docs', 'boite-a-idees.json');
const SCRIPT = 'scripts/mur-import.mjs';

const q = (valeur: string) => `"${valeur.replace(/"/g, '""')}"`;
const ligne = (valeurs: string[]) => valeurs.map(q).join(',');

/** Les 19 colonnes réelles, dans l'ordre de la feuille (23/10/2026). */
const COLONNES = [
  'Horodateur',
  'Pseudo',
  'Quelle Version du Jeux',
  'Tu veux quoi ? ',
  'Exprime toi',
  "Envie d'aider ? ",
  'Titre',
  'Ce que tu faisais ? ',
  "Ce qui c'est passé ? ",
  'Ce que tu attendais ? ',
  'Écran',
  'Capture',
  'Titre',
  "L'idée",
  'À quoi ça servirait ? ',
  'Écran',
  'Capture',
  'Ce que tu as aimé ? ',
  "Ce que tu n'as pas aimé ? "
];

const H = {
  horodateur: 0,
  pseudo: 1,
  version: 2,
  entree: 3,
  gueule: 4,
  envie: 5,
  titreBug: 6,
  faisais: 7,
  passe: 8,
  attendais: 9,
  ecranBug: 10,
  captureBug: 11,
  titreIdee: 12,
  idee: 13,
  servirait: 14,
  ecranIdee: 15,
  captureIdee: 16,
  aime: 17,
  aimePas: 18
} as const;

const rangee = (valeurs: Partial<Record<number, string>> = {}) =>
  Array.from({ length: COLONNES.length }, (_, index) => valeurs[index] ?? '');

const csv = (...lignes: string[][]) => `${[COLONNES, ...lignes].map(ligne).join('\n')}\n`;

/**
 * **Les deux réponses réelles** du 23/10/2026 — la fixture du ticket. Le gueulage n'a
 * aucun titre, le bug s'appelle « papi ».
 */
const REEL_GUEULAGE = rangee({
  [H.horodateur]: '23/10/2026 01:36:03',
  [H.pseudo]: 'Moi',
  [H.version]: 'je sais pas',
  [H.entree]: 'Gueuler',
  [H.gueule]: "c'est de la merde ton jeux\nBastien",
  [H.envie]: "Non j'ai déja assez gueuler comme ça"
});

const REEL_BUG = rangee({
  [H.horodateur]: '23/10/2026 01:37:45',
  [H.pseudo]: "L'autre",
  [H.version]: '0.1.4',
  [H.entree]: 'Remonter un bug',
  [H.titreBug]: 'papi',
  [H.faisais]: 'rien',
  [H.passe]: 'rien',
  [H.attendais]: 'du fun'
});

const FIXTURE = csv(REEL_GUEULAGE, REEL_BUG);

type Postit = Record<string, unknown> & {
  id: string;
  kind: string;
  titre: string;
  texte: string;
  ecran: string;
  pseudo: string;
  version: string;
  statut: string;
  raison: string;
  ticket: number | null;
  gueulage: boolean;
  position: { x: number; y: number; angle: number };
};

type Document = { formulaire: string; reponses?: string; postits: Postit[] };

let compteur = 0;

/** Un bac temporaire : une copie du fichier du mur, et des CSV à côté. */
function bac(): { dossier: string; mur: string; texteInitial: string } {
  const dossier = mkdtempSync(join(tmpdir(), 'mur-import-'));
  const mur = join(dossier, 'boite-a-idees.json');
  copyFileSync(MUR_SOURCE, mur);
  return { dossier, mur, texteInitial: readFileSync(mur, 'utf8') };
}

function ecrireCsv(dossier: string, texte: string): string {
  compteur += 1;
  const chemin = join(dossier, `reponses-${compteur}.csv`);
  writeFileSync(chemin, texte, 'utf8');
  return chemin;
}

function lancer(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: RACINE,
    encoding: 'utf8',
    // Vide, la variable ne surcharge rien : sans `--fichier`, le script doit alors
    // constater qu'aucune adresse n'est publiée — et n'appeler personne.
    env: { ...process.env, MUR_REPONSES_CSV: '', ...env }
  });
}

const lireMurEcrit = (chemin: string): Document => JSON.parse(readFileSync(chemin, 'utf8')) as Document;

describe('les deux réponses réelles du 23/10/2026', () => {
  it('un gueulage sans titre devient une IP au titre fabriqué, le bug devient un OUF « papi »', () => {
    const { dossier, mur } = bac();
    const fichier = ecrireCsv(dossier, FIXTURE);

    const resultat = lancer(['--fichier', fichier, '--mur', mur]);
    expect(resultat.stderr).toBe('');
    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain('lus : 2 — ajoutés : 2 — déjà là : 0');

    const postits = lireMurEcrit(mur).postits;
    expect(postits).toHaveLength(2);

    // Le gueulage sans suite : IP, gueulage, et le formulaire ne demandait pas de titre.
    const gueulage = postits[0];
    expect(gueulage).toMatchObject({ kind: 'IP', gueulage: true, pseudo: 'Moi', version: 'je sais pas' });
    expect(gueulage.titre).toBe("c'est de la merde ton jeux");
    // Le post-it dit que le titre est fabriqué — et le texte brut n'est pas trahi.
    expect(gueulage.texte).toContain('Titre fabriqué avec les premiers mots du message');
    expect(gueulage.texte).toContain("c'est de la merde ton jeux\nBastien");

    // Le bug : OUF, son titre, ses trois paragraphes, son pseudo.
    const bug = postits[1];
    expect(bug).toMatchObject({ kind: 'OUF', gueulage: false, titre: 'papi', pseudo: "L'autre", version: '0.1.4' });
    expect(bug.texte).toContain('Ce que tu faisais : rien');
    expect(bug.texte).toContain('Ce qui s’est passé : rien');
    expect(bug.texte).toContain('Ce que tu attendais : du fun');
    expect(bug.texte).not.toContain('Titre fabriqué');

    // Le document produit passe le contrat du mur, sans autre travail.
    expect(lireMur(lireMurEcrit(mur)).erreurs).toEqual([]);
  });

  it('le titre fabriqué n’est pas une invention : ce sont les premiers mots du message', () => {
    const { dossier, mur } = bac();
    expect(lancer(['--fichier', ecrireCsv(dossier, FIXTURE), '--mur', mur]).status).toBe(0);
    const [gueulage] = lireMurEcrit(mur).postits;
    // Les premiers mots du message, au mot près (le retour à la ligne arrête le titre).
    expect("c'est de la merde ton jeux\nBastien".startsWith(gueulage.titre)).toBe(true);
  });
});

describe('scripts/mur-import.mjs — le CSV publié devient des post-its', () => {
  it('lit un CSV correct : guillemets échappés, virgules et retours à la ligne dans un champ', () => {
    const { dossier, mur } = bac();
    const fichier = ecrireCsv(
      dossier,
      csv(
        rangee({
          [H.horodateur]: '23/10/2026 14:05:32',
          [H.version]: 'Alpha · 0.1.4',
          [H.entree]: 'Remonter un bug',
          [H.titreBug]: 'Le bouton "Fin du tour" reste grisé',
          [H.faisais]: 'J’étais au combat, et j’ai cliqué.\nPuis rien ne s’est passé.'
        })
      )
    );

    const resultat = lancer(['--fichier', fichier, '--mur', mur]);
    expect(resultat.stderr).toBe('');
    expect(resultat.status).toBe(0);

    const [postit] = lireMurEcrit(mur).postits;
    // Un `split(',')` aurait coupé la phrase à la virgule et laissé le retour à la ligne
    // devenir une nouvelle ligne du CSV : c'est le piège que le parseur doit tenir.
    expect(postit.texte).toContain('J’étais au combat, et j’ai cliqué.\nPuis rien ne s’est passé.');
    expect(postit.titre).toBe('Le bouton "Fin du tour" reste grisé');
    expect(postit.kind).toBe('OUF');
  });

  it('range les quatre chemins du formulaire dans les deux familles (§4.3 bis)', () => {
    const { dossier, mur } = bac();
    const fichier = ecrireCsv(
      dossier,
      csv(
        rangee({
          [H.horodateur]: '23/10/2026 14:06:10',
          [H.pseudo]: 'Employé 404',
          [H.version]: 'Alpha · 0.1.4',
          [H.entree]: 'Proposer une feature',
          [H.titreIdee]: 'Voir combien d’Arrivages il me reste à ouvrir',
          [H.idee]: 'Un compteur dans la Collection.',
          [H.servirait]: 'Je saurais quand ouvrir mes brouillons.',
          [H.ecranIdee]: 'Deck'
        }),
        rangee({
          [H.horodateur]: '23/10/2026 14:07:30',
          [H.version]: 'Alpha · 0.1.4',
          [H.entree]: 'Gueuler',
          [H.gueule]: 'Le jeu plante au lancement, encore.',
          [H.envie]: 'Remonter un bug'
        }),
        rangee({
          [H.horodateur]: '23/10/2026 14:08:00',
          [H.version]: 'Alpha · 0.1.4',
          [H.entree]: 'Donner ton avis sur le Jeux',
          [H.aime]: 'J’aime les cartes',
          [H.aimePas]: 'Les animations sont lentes'
        })
      )
    );

    const resultat = lancer(['--fichier', fichier, '--mur', mur]);
    expect(resultat.status).toBe(0);

    const postits = lireMurEcrit(mur).postits;
    expect(postits).toHaveLength(3);

    // IP : une feature, l'écran de la **seconde** section (15), pas celui du bug (10).
    expect(postits[0]).toMatchObject({
      kind: 'IP',
      pseudo: 'Employé 404',
      ecran: 'Deck',
      titre: 'Voir combien d’Arrivages il me reste à ouvrir'
    });
    expect(postits[0].texte).toContain('L’idée : Un compteur dans la Collection.');

    // Gueuler puis choisir « Remonter un bug » : OUF, et toujours un gueulage.
    expect(postits[1]).toMatchObject({ kind: 'OUF', gueulage: true });
    expect(postits[1].titre.startsWith('Le jeu plante au lancement')).toBe(true);

    // Avis : IP, et les deux champs libres ne sont pas perdus.
    expect(postits[2]).toMatchObject({ kind: 'IP', gueulage: false, titre: 'J’aime les cartes' });
    expect(postits[2].texte).toContain('Ce que tu as aimé : J’aime les cartes');
    expect(postits[2].texte).toContain('Ce que tu n’as pas aimé : Les animations sont lentes');
  });

  it('un pseudo vide devient « anonyme », et la capture (un lien) rejoint le texte', () => {
    const { dossier, mur } = bac();
    const fichier = ecrireCsv(
      dossier,
      csv(
        rangee({
          [H.horodateur]: '23/10/2026 14:09:00',
          [H.version]: 'Alpha · 0.1.4',
          [H.entree]: 'Proposer une feature',
          [H.titreIdee]: 'Un lien de capture',
          [H.idee]: 'Rien de plus.',
          [H.captureIdee]: 'https://exemple.test/capture.png'
        })
      )
    );

    expect(lancer(['--fichier', fichier, '--mur', mur]).status).toBe(0);
    const [postit] = lireMurEcrit(mur).postits;
    expect(postit.pseudo).toBe('anonyme');
    // Le post-it n'a pas de champ capture (§3) : on n'en invente pas, le lien est au texte.
    expect(postit.texte).toContain('Capture : https://exemple.test/capture.png');
    expect(postit).not.toHaveProperty('capture');
  });

  it('produit un document que le mur lit sans autre travail', () => {
    const { dossier, mur } = bac();
    expect(lancer(['--fichier', ecrireCsv(dossier, FIXTURE), '--mur', mur]).status).toBe(0);

    const { mur: lu, erreurs } = lireMur(lireMurEcrit(mur));
    expect(erreurs).toEqual([]);
    expect(lu?.postits).toHaveLength(2);
    for (const postit of lu?.postits ?? []) {
      expect(postit.statut).toBe('en attente');
      expect(postit.position.x).toBeGreaterThanOrEqual(0);
      expect(postit.position.x).toBeLessThanOrEqual(100);
      expect(Math.abs(postit.position.angle)).toBeLessThanOrEqual(5);
    }
  });
});

describe('l’idempotence tient à la clé horodatage + titre', () => {
  it('deux imports du même CSV ne laissent que les deux post-its', () => {
    const { dossier, mur } = bac();
    const fichier = ecrireCsv(dossier, FIXTURE);

    const premier = lancer(['--fichier', fichier, '--mur', mur]);
    expect(premier.status).toBe(0);
    expect(premier.stdout).toContain('lus : 2 — ajoutés : 2 — déjà là : 0');

    const second = lancer(['--fichier', fichier, '--mur', mur]);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('lus : 2 — ajoutés : 0 — déjà là : 2');
    expect(lireMurEcrit(mur).postits).toHaveLength(2);
    expect(readFileSync(mur, 'utf8')).not.toContain('p-23-10-2026-01-36-03-c-est-de-la-merde-ton-jeux-2');
  });

  it('deux réponses au même titre à des heures différentes restent deux post-its', () => {
    const { dossier, mur } = bac();
    const fichier = ecrireCsv(
      dossier,
      csv(
        rangee({
          [H.horodateur]: '23/10/2026 14:12:00',
          [H.version]: 'Alpha · 0.1.4',
          [H.entree]: 'Remonter un bug',
          [H.titreBug]: 'Le même titre',
          [H.faisais]: 'Le matin.'
        }),
        rangee({
          [H.horodateur]: '23/10/2026 18:12:00',
          [H.version]: 'Alpha · 0.1.4',
          [H.entree]: 'Remonter un bug',
          [H.titreBug]: 'Le même titre',
          [H.faisais]: 'Le soir.'
        })
      )
    );

    expect(lancer(['--fichier', fichier, '--mur', mur]).status).toBe(0);
    expect(lireMurEcrit(mur).postits).toHaveLength(2);
  });
});

describe('le tri humain est intouchable (D-059, D-068)', () => {
  it('un post-it retenu garde son statut, son ticket et sa raison quand un autre arrive', () => {
    const { dossier, mur } = bac();
    expect(lancer(['--fichier', ecrireCsv(dossier, FIXTURE), '--mur', mur]).status).toBe(0);

    // Le tri : c'est un humain qui l'écrit, pas l'import.
    const document = lireMurEcrit(mur);
    document.postits[0].statut = 'retenu';
    document.postits[0].ticket = 177;
    document.postits[0].raison = 'Retenue le 23/10.';
    document.postits[0].position = { x: 42, y: 24, angle: 3 };
    writeFileSync(mur, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    const trie = JSON.stringify(document.postits[0]);

    const deux = ecrireCsv(
      dossier,
      csv(
        rangee({
          [H.horodateur]: '23/10/2026 14:14:00',
          [H.version]: 'Alpha · 0.1.4',
          [H.entree]: 'Remonter un bug',
          [H.titreBug]: 'Une nouvelle arrivée',
          [H.faisais]: 'Rien de spécial.'
        })
      )
    );

    const resultat = lancer(['--fichier', deux, '--mur', mur]);
    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain('lus : 1 — ajoutés : 1 — déjà là : 0');

    const apres = lireMurEcrit(mur);
    expect(apres.postits).toHaveLength(3);
    // Aucun champ du post-it trié n'a bougé, position comprise.
    expect(JSON.stringify(apres.postits[0])).toBe(trie);
    expect(apres.postits[2].statut).toBe('en attente');
  });

  it('un second import ne réécrit même pas le fichier quand tout est déjà là', () => {
    const { dossier, mur } = bac();
    const fichier = ecrireCsv(dossier, FIXTURE);
    expect(lancer(['--fichier', fichier, '--mur', mur]).status).toBe(0);
    const avant = readFileSync(mur, 'utf8');

    const second = lancer(['--fichier', fichier, '--mur', mur]);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('Rien à écrire');
    expect(readFileSync(mur, 'utf8')).toBe(avant);
  });
});

describe('un CSV illisible ne s’écrit pas — le fichier reste intact', () => {
  it('un CSV vide sort en erreur', () => {
    const { dossier, mur, texteInitial } = bac();
    const fichier = ecrireCsv(dossier, '');
    const resultat = lancer(['--fichier', fichier, '--mur', mur]);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('le CSV est vide');
    expect(resultat.stderr).toContain('Rien n’a été écrit');
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });

  it('un CSV réduit à son en-tête sort en erreur', () => {
    const { dossier, mur, texteInitial } = bac();
    const fichier = ecrireCsv(dossier, csv());
    const resultat = lancer(['--fichier', fichier, '--mur', mur]);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('aucune réponse');
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });

  it('un guillemet jamais refermé sort en erreur', () => {
    const { dossier, mur, texteInitial } = bac();
    // Un seul guillemet ouvrant, jamais refermé : le parseur doit le dire, pas deviner.
    const fichier = ecrireCsv(
      dossier,
      'Horodateur,Quelle Version du Jeux,Tu veux quoi ? ,Titre\n"23/10/2026 14:16:00,0.1.4\n'
    );
    const resultat = lancer(['--fichier', fichier, '--mur', mur]);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('guillemet');
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });

  it('un en-tête inattendu sort en erreur, au lieu d’écrire des post-its vides', () => {
    const { dossier, mur, texteInitial } = bac();
    const fichier = ecrireCsv(
      dossier,
      `Date,Qui,Titre\n"23/10/2026 14:17:00","Employé 404","Un titre sans colonnes attendues"\n`
    );
    const resultat = lancer(['--fichier', fichier, '--mur', mur]);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('en-tête inattendu');
    expect(resultat.stderr).toContain('Version du jeu');
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });

  it('sans adresse publiée et sans --fichier, il dit quoi faire et ne touche pas au réseau', () => {
    // Un bac dont le champ `reponses` est vidé : c'est le cas « rien n'est publié ».
    const { mur } = bac();
    const document = lireMurEcrit(mur);
    document.reponses = '';
    writeFileSync(mur, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    const vide = readFileSync(mur, 'utf8');

    const resultat = lancer(['--mur', mur]);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('aucune adresse de CSV publiée');
    expect(resultat.stderr).toContain('reponses');
    expect(resultat.stderr).toContain('Rien n’a été écrit');
    expect(resultat.stdout).not.toContain('Lecture du CSV publié');
    expect(readFileSync(mur, 'utf8')).toBe(vide);
  });

  it('un fichier CSV introuvable sort en erreur', () => {
    const { dossier, mur, texteInitial } = bac();
    const resultat = lancer(['--fichier', join(dossier, 'absent.csv'), '--mur', mur]);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('introuvable');
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });
});

describe('--dry-run', () => {
  it('annonce les deux post-its réels et n’écrit rien', () => {
    const { dossier, mur, texteInitial } = bac();
    const fichier = ecrireCsv(dossier, FIXTURE);

    const resultat = lancer(['--fichier', fichier, '--mur', mur, '--dry-run']);
    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain('lus : 2 — ajoutés : 2 — déjà là : 0');
    expect(resultat.stdout).toContain('IP (gueulage)');
    expect(resultat.stdout).toContain('OUF — papi');
    expect(resultat.stdout).toContain('Rien n’a été écrit (--dry-run)');
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });

  it('la commande est déclarée dans package.json', () => {
    const pkg = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['mur:import']).toBe('node scripts/mur-import.mjs');
  });
});
