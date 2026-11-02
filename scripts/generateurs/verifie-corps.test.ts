// @vitest-environment node
/**
 * **Le corps d'une release, vérifié avant de publier** — #624.
 *
 * Le défaut mesuré, le 02/11/2026 : la release `v0.1.17-alpha` a été publiée avec le corps de
 * `docs/ALPHA-TESTEURS.md`. Ce document est le **message aux testeurs**, plein de gras et de
 * code ; `src/data/versions.test.ts` a refusé ce markdown resté dans une note **après** la
 * publication, au moment de `npm run notes:versions`. Il a fallu réécrire le corps,
 * `gh release edit`, puis régénérer — un acte irréversible fait avant son contrôle.
 *
 * Ce test éprouve le contrôle qui arrive **avant** : `npm run release:verifie --corps <fichier>`
 * (`scripts/generateurs/verifie-corps.mjs`). Ce qui est gardé, et pourquoi chacun peut échouer :
 *
 * 1. **le corps réel de 0.1.16 passe** — sections thématiques, points en clair, et son
 *    introduction porte un code span (`v0.1.16-alpha`) qui **ne va pas dans la note** : le
 *    générateur jette les paragraphes, le contrôle aussi ;
 * 2. **un corps gras est refusé**, avec le **numéro de ligne** de la puce fautive — sans lui,
 *    un corps de quarante lignes se cherche à l'œil ;
 * 3. **le corps de `docs/ALPHA-TESTEURS.md` est refusé** : c'est le document qui a coûté la
 *    release 0.1.17, et il porte 26 défauts (gras, code, sections vides) ;
 * 4. **les sections de `SECTIONS_ECARTEES` gardent leur markdown** : c'est là que se colle le
 *    bloc de `npm run problemes`, qui en porte, et le générateur les jette ;
 * 5. **la commande sort 0 et 1**, en positionnel comme avec `--corps` : npm 10 avale `--corps`
 *    quand il n'est pas suivi de `--`, et la commande reçoit alors le fichier seul.
 *
 * Le corps de 0.1.16 est recopié **verbatim** de la release publiée (mesuré le 02/11/2026) :
 * c'est la preuve que la convention accepte ce qui a réellement été publié, pas un exemple
 * fabriqué pour passer.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { formaterVerdict, lireArguments, verifierCorps } from './verifie-corps.mjs';

const CHEMIN = fileURLToPath(new URL('./verifie-corps.mjs', import.meta.url));
const lire = (chemin: string) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');

/** Le corps **réel** de `v0.1.16-alpha`, tel que GitHub le rend (copié le 02/11/2026). */
const CORPS_0116 = `La première version qui suit la critique du combat, et la seizième d'une alpha.

Version 0.1.16, étape alpha. Elle s'appelle \`v0.1.16-alpha\` partout : dans Réglages, sur le tag et sur cette page.

## Le combat

- Le Stress se lit d'un coup d'œil, et la Pression dit ce qu'elle applique : plus besoin d'ouvrir la fiche pour savoir ce qui va tomber.
- Le score s'écrit, les gestes sonnent, et la fiche d'un Planqué dit sa flavour.
- La Direction parle : vingt répliques, du commentaire sec à la provocation — jamais l'insulte à la personne.
- La fin d'une partie s'allume dans la piste d'Interventions, et la scène de fin ne double plus la phrase de la barre.
- Le journal ne se superpose plus à lui-même, et sur écran large il remplit la console.
- Au clavier et au lecteur d'écran : l'infobulle d'une carte se pose dans l'écran, le panneau de pose prend le focus et le rend, et l'état des boutons se dit.

## La Journée d'intégration

- Le tutoriel n'est plus une fenêtre qui fige la page : c'est un panneau posé en haut, qui laisse faire les gestes qu'il demande.
- L'étape du combat se joue vraiment : une position déjà gagnable, une Pression, et la troisième Intervention.
- Une scène de fin tombe sur la partie scriptée — le tampon, la raison, la phrase de la Direction — et le mur du comité n'est plus exclu du parcours.
- On ne sort plus du parcours par accident : « Passer » reste la seule sortie, avec ce qu'elle coûte.

## L'entrée dans le jeu

- Un mot de passe oublié : le lien part, et le retour ouvre l'écran du nouveau mot de passe. La réponse ne dit jamais si l'adresse a un compte.
- Le lien du serveur des testeurs s'affiche aussi sur la page de connexion, là où il sert à quelqu'un qui n'est pas encore entré.
- Les cinq services sont ceux d'un immeuble — Rez-de-chaussée, 1er, 2ème, 3ème, 4ème — et « Red Chaussée » disparaît.
- L'intitulé tiré au sort se lit en grand, sous la fonction, au lieu de se noyer dans une phrase.

## La Collection et le Deck

- La grille de la Collection devient une vitrine, et sa jauge ne ment plus : elle compte les cartes tirables, pas celles qui existent.
- La Collection se lit au clavier et au lecteur d'écran : la recherche a un nom, le compteur s'annonce, et le nom lu d'une carte dit sa possession et son Deck.
- Les filtres, les Decks proposés et les versions passées se replient derrière un bouton.

## Plus léger

- Les écrans se chargent à la demande, les dépendances sont découpées par famille, et l'historique des notes ne pèse plus sur l'entrée : le premier affichage est plus court de 24 kB.

## À savoir avant de jouer

- L'entrée exige un compte : une session anonyme ne joue plus, et un compte refusé ne voit que la page d'attente.

`;

/** Les bacs du test, supprimés après chaque cas : aucun fichier ne survit dans /tmp. */
const bacs: string[] = [];

afterEach(() => {
  for (const bac of bacs.splice(0)) rmSync(bac, { recursive: true, force: true });
});

/** Écrit un corps dans un fichier temporaire, et rend son chemin absolu. */
function fichier(corps: string, nom = 'corps.md'): string {
  const dossier = mkdtempSync(join(tmpdir(), 'verifie-corps-'));
  bacs.push(dossier);
  const chemin = join(dossier, nom);
  writeFileSync(chemin, corps);
  return chemin;
}

/** Lance le CLI comme le ferait un agent : un processus neuf, le fichier en argument. */
function lancer(args: string[]): { code: number; sortie: string; erreur: string } {
  try {
    const sortie = execFileSync(process.execPath, [CHEMIN, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, sortie, erreur: '' };
  } catch (erreur) {
    const echec = erreur as { status?: number; stdout?: string; stderr?: string };
    return { code: echec.status ?? 1, sortie: String(echec.stdout ?? ''), erreur: String(echec.stderr ?? '') };
  }
}

describe('verifie-corps — le corps réel de 0.1.16 est publiable', () => {
  it('passe, et le générateur en ferait six sections thématiques', () => {
    const verdict = verifierCorps(CORPS_0116, { nom: 'v0.1.16-alpha' });
    expect(verdict.defauts, formaterVerdict(verdict)).toEqual([]);
    expect(verdict.ok).toBe(true);
    expect(verdict.groupes.map((groupe) => groupe.titre)).toEqual([
      'Le combat',
      'La Journée d’intégration',
      'L’entrée dans le jeu',
      'La Collection et le Deck',
      'Plus léger',
      'À savoir avant de jouer'
    ]);
    expect(verdict.points).toBe(19);
    expect(formaterVerdict(verdict)).toContain('corps conforme');
  });

  it('le paragraphe d’introduction est jeté : son code span ne fait pas échouer 0.1.16', () => {
    // Le corps réel porte deux backticks dans son introduction (« `v0.1.16-alpha` »). Ils ne
    // vont pas dans la note, et le générateur jette le paragraphe : le contrôle aussi.
    expect(CORPS_0116).toContain('`v0.1.16-alpha`');
    expect(verifierCorps(CORPS_0116).ok).toBe(true);
  });
});

describe('verifie-corps — le markdown en ligne est refusé, avec sa ligne', () => {
  it('refuse le gras d’une puce', () => {
    const corps = '## Le combat\n\n- **Le Stress** se lit d’un coup d’œil, et la Pression dit ce qu’elle applique.\n';
    const verdict = verifierCorps(corps);
    expect(verdict.ok).toBe(false);
    expect(verdict.defauts[0]).toMatchObject({ ligne: 3 });
    expect(verdict.defauts[0].quoi).toContain('du gras');
    expect(verdict.defauts[0].extrait).toContain('**Le Stress**');
    expect(formaterVerdict(verdict)).toContain('ligne 3');
  });

  it('refuse un backtick et un lien markdown', () => {
    const corps = [
      '## Le combat',
      '',
      '- La feuille de route (`/feuille-de-route`) se lit sans compte.',
      '- Le guide est sur [la page](https://planquex.4k7.org).',
      ''
    ].join('\n');
    const verdict = verifierCorps(corps);
    expect(verdict.ok).toBe(false);
    expect(verdict.defauts.some((defaut) => defaut.ligne === 3 && defaut.quoi.includes('backtick'))).toBe(true);
    expect(verdict.defauts.some((defaut) => defaut.ligne === 4 && defaut.quoi.includes('lien markdown'))).toBe(true);
  });

  it('refuse un titre en gras : une section s’écrit `##`, pas `**`', () => {
    const corps = '**Le combat**\n\n- Une phrase complète.\n';
    const verdict = verifierCorps(corps);
    expect(verdict.ok).toBe(false);
    expect(verdict.defauts[0]).toMatchObject({ ligne: 1 });
    expect(verdict.defauts[0].quoi).toContain('le titre porte du gras');
  });

  it('laisse le markdown des sections écartées : c’est là que se colle `npm run problemes`', () => {
    const corps = [
      '## Le combat',
      '',
      '- Une phrase complète.',
      '',
      '## Pour un testeur',
      '',
      '**Problèmes connus** — ce qui est déjà signalé, et pas encore corrigé :',
      '',
      '- Un titre — écran, version (#401)',
      ''
    ].join('\n');
    const verdict = verifierCorps(corps);
    expect(verdict.defauts, formaterVerdict(verdict)).toEqual([]);
    expect(verdict.ok).toBe(true);
    expect(verdict.ecartees.map((section) => section.titre)).toEqual(['Pour un testeur']);
  });
});

describe('verifie-corps — une section vide est refusée, avec son titre', () => {
  it('refuse un titre `##` sans aucun point', () => {
    const corps = '## Le combat\n\n## Les sons\n\n- Un tampon, un tiroir, du papier, une manche.\n';
    const verdict = verifierCorps(corps);
    expect(verdict.ok).toBe(false);
    expect(verdict.defauts[0]).toMatchObject({ ligne: 1 });
    expect(verdict.defauts[0].quoi).toContain('section vide');
    expect(verdict.defauts[0].extrait).toContain('Le combat');
  });

  it('refuse un corps sans aucune section', () => {
    const verdict = verifierCorps('- Une phrase complète.\n');
    expect(verdict.ok).toBe(false);
    expect(verdict.defauts[0].quoi).toContain('aucune section');
  });

  it('refuse un corps vide', () => {
    const verdict = verifierCorps('   \n\n');
    expect(verdict.ok).toBe(false);
    expect(verdict.defauts[0].quoi).toContain('le corps est vide');
  });
});

describe('verifie-corps — un point sans phrase est refusé, avec sa ligne', () => {
  it('refuse une puce vide', () => {
    const verdict = verifierCorps('## Le combat\n\n-   \n');
    expect(verdict.ok).toBe(false);
    expect(verdict.defauts[0]).toMatchObject({ ligne: 3 });
    expect(verdict.defauts[0].quoi).toContain('la puce est vide');
  });

  it('refuse un point de moins de trois mots', () => {
    const verdict = verifierCorps('## Le combat\n\n- Corrigé\n');
    expect(verdict.ok).toBe(false);
    expect(verdict.defauts[0]).toMatchObject({ ligne: 3 });
    expect(verdict.defauts[0].quoi).toContain('il en faut 3');
  });

  it('refuse un point qui ne finit pas par une ponctuation de fin de phrase', () => {
    const verdict = verifierCorps('## Le combat\n\n- Le Stress se lit d’un coup d’œil\n');
    expect(verdict.ok).toBe(false);
    expect(verdict.defauts[0]).toMatchObject({ ligne: 3 });
    expect(verdict.defauts[0].quoi).toContain('ponctuation de fin de phrase');
  });

  it('accepte une phrase repliée sur deux lignes, comme le générateur la recolle', () => {
    const corps = [
      '## Le combat',
      '',
      '- Le Stress se lit d’un coup d’œil, et la Pression dit ce qu’elle applique :',
      '  plus besoin d’ouvrir la fiche pour savoir ce qui va tomber.',
      ''
    ].join('\n');
    const verdict = verifierCorps(corps);
    expect(verdict.defauts, formaterVerdict(verdict)).toEqual([]);
    expect(verdict.points).toBe(1);
  });
});

describe('verifie-corps — le corps de docs/ALPHA-TESTEURS.md est refusé', () => {
  const corps = lire('docs/ALPHA-TESTEURS.md');
  const verdict = verifierCorps(corps, { nom: 'docs/ALPHA-TESTEURS.md' });

  it('le message aux testeurs n’est pas un corps de release', () => {
    expect(verdict.ok).toBe(false);
    expect(verdict.defauts.length).toBeGreaterThan(10);
    expect(formaterVerdict(verdict)).toContain('corps de release refusé');
  });

  it('nomme des lignes qui portent vraiment le markdown fautif', () => {
    const lignes = corps.split('\n');
    const gras = verdict.defauts.filter((defaut) => defaut.quoi.includes('du gras'));
    expect(gras.length).toBeGreaterThan(0);
    for (const defaut of gras) {
      // La ligne nommée est la ligne réelle du fichier, et elle porte bien le gras.
      expect(lignes[defaut.ligne - 1]).toContain('**');
      expect(defaut.extrait).toContain('**');
    }
    expect(gras[0].ligne).toBe(13);
  });

  it('refuse aussi ses sections vides et ses titres en gras', () => {
    expect(verdict.defauts.some((defaut) => defaut.quoi.includes('section vide'))).toBe(true);
    expect(verdict.defauts.some((defaut) => defaut.quoi.includes('le titre porte du gras'))).toBe(true);
  });
});

describe('verifie-corps — les arguments de la commande', () => {
  it('reçoit le fichier en `--corps <fichier>`, en `--corps=<fichier>` et en positionnel', () => {
    expect(lireArguments(['--corps', 'corps.md'])).toEqual({ fichier: 'corps.md' });
    expect(lireArguments(['--corps=corps.md'])).toEqual({ fichier: 'corps.md' });
    // npm 10 avale `--corps` sans le `--` : le fichier arrive seul.
    expect(lireArguments(['corps.md'])).toEqual({ fichier: 'corps.md' });
  });

  it('refuse une option inconnue, aucun fichier, ou deux fichiers', () => {
    expect(() => lireArguments(['--autre', 'x'])).toThrow(/option inconnue/);
    expect(() => lireArguments([])).toThrow(/aucun fichier/);
    expect(() => lireArguments(['a.md', 'b.md'])).toThrow(/un seul fichier/);
    expect(() => lireArguments(['--corps'])).toThrow(/demande un fichier/);
  });
});

describe('verifie-corps — la commande sort 0 ou 1', () => {
  it('sort 0 sur le corps réel de 0.1.16, en positionnel comme avec `--corps`', () => {
    const chemin = fichier(CORPS_0116, 'v0.1.16-alpha.md');
    for (const args of [[chemin], ['--corps', chemin], [`--corps=${chemin}`]]) {
      const { code, sortie } = lancer(args);
      expect(code, `arguments ${args.join(' ')}`).toBe(0);
      expect(sortie).toContain('corps conforme');
      expect(sortie).toContain('6 section(s), 19 point(s)');
    }
  });

  it('sort 1 sur le corps de docs/ALPHA-TESTEURS.md, et nomme la ligne', () => {
    const chemin = fichier(lire('docs/ALPHA-TESTEURS.md'), 'ALPHA-TESTEURS.md');
    const { code, erreur } = lancer(['--corps', chemin]);
    expect(code).toBe(1);
    expect(erreur).toContain('corps de release refusé');
    expect(erreur).toContain('ligne 13');
    expect(erreur).toContain('**');
  });

  it('sort 1 quand le fichier est introuvable', () => {
    const { code, erreur } = lancer(['--corps', '/tmp/ce-fichier-n-existe-pas-624.md']);
    expect(code).toBe(1);
    expect(erreur).toContain('illisible');
  });
});
