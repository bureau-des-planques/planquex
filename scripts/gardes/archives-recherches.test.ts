// @vitest-environment node
/**
 * Les archives de `docs/recherches/` ne portent aucun chemin du poste — #669.
 *
 * Les rapports de diagnostic du 03/11/2026 ont été copiés depuis un dossier de travail éphémère,
 * et le dépôt est **public** : une capture citée par son chemin, un `/home/<utilisateur>/…` ou une
 * adresse e-mail y entre et y reste. La copie du #669 a retiré ces chemins à la main ; ce fichier
 * empêche qu'une archive suivante les ramène.
 *
 * Il garde aussi les deux formes que le ticket demande à une archive : elle **dit qu'elle est
 * datée et qu'elle ne fait pas autorité**, et elle est nommée par sa date (`2026-11-03-…`). Un
 * rapport promu en règle du jeu est exactement ce que #669 refuse de faire.
 *
 * **Le contrôle mord** : les deux derniers tests confrontent les contrôles à des textes
 * **fabriqués** — un chemin `/tmp`, un chemin du poste, un tilde, une adresse e-mail, un rapport
 * sans mention d'archive — qui doivent tous être signalés (`AGENTS.md` §6).
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Les rapports archivés, un fichier par document source (03/11/2026 pour #669, 04/11/2026 pour #707). */
const RAPPORTS = [
  'docs/recherches/2026-11-03-diagnostic-journee-integration.md',
  'docs/recherches/2026-11-03-diagnostic-arrivage.md',
  'docs/recherches/2026-11-03-diagnostic-combat.md',
  'docs/recherches/2026-11-03-comparaison-impeccable.md',
  'docs/recherches/2026-11-03-verification-sources-tcg.md',
  'docs/recherches/2026-11-03-references-ui-combat.md',
  'docs/recherches/2026-11-03-chronologie-partie-tcg-pocket.md',
  'docs/recherches/2026-11-03-animations-combat-tcg-pocket.md',
  'docs/recherches/2026-11-04-diagnostic-duree-ci.md'
] as const;

/**
 * Ce qui ne doit pas entrer dans une archive publique : les chemins du dossier de travail
 * (`/tmp/…`) et du poste (`/home/…`, `~/…`), et les adresses e-mail. Les **URL publiques**
 * restent licites — elles sont la source des rapports de recherche.
 */
const FUITES: readonly { motif: RegExp; quoi: string }[] = [
  { motif: /\/tmp\//, quoi: 'chemin éphémère /tmp' },
  { motif: /\/home\//, quoi: 'chemin du poste /home/…' },
  { motif: /~\/\./, quoi: 'chemin du poste ~/…' },
  { motif: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, quoi: 'adresse e-mail' }
];

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const chemin = (file: string) => fileURLToPath(new URL(`../../${file}`, import.meta.url));

/** Les fuites d'un texte, une entrée par motif trouvé : `ligne: quoi — extrait`. */
function fuites(texte: string): string[] {
  const trouvees: string[] = [];
  texte.split('\n').forEach((ligne, index) => {
    for (const { motif, quoi } of FUITES) {
      if (motif.test(ligne)) trouvees.push(`${index + 1}: ${quoi} — ${ligne.trim().slice(0, 120)}`);
    }
  });
  return trouvees;
}

/** La date d'un rapport, lue dans son nom (`2026-11-04-…` → `04/11/2026`) ; `null` sinon. */
function dateDuNom(nom: string): string | null {
  const trouve = nom.match(/(\d{4})-(\d{2})-(\d{2})-/);
  return trouve ? `${trouve[3]}/${trouve[2]}/${trouve[1]}` : null;
}

/** Un texte qui se présente comme une archive datée et non autoritaire. */
function estUneArchiveDatee(texte: string, nom: string): boolean {
  const date = dateDuNom(nom);
  return Boolean(date) && texte.includes('pas une source de vérité') && texte.includes(date!);
}

/** Les textes qui ne se présentent pas comme une archive datée et non autoritaire. */
function sansMentionDArchive(textes: readonly { nom: string; texte: string }[]): string[] {
  return textes.filter(({ nom, texte }) => !estUneArchiveDatee(texte, nom)).map(({ nom }) => nom);
}

describe('Les archives de docs/recherches/ (03/11/2026, #669)', () => {
  it('les rapports archivés sont présents et nommés par leur date', () => {
    const absents = RAPPORTS.filter((nom) => !existsSync(chemin(nom)));
    expect(absents, `rapport(s) manquant(s) : ${absents.join(', ')}`).toEqual([]);
    const malNommes = RAPPORTS.filter((nom) => !/\/\d{4}-\d{2}-\d{2}-[\w-]+\.md$/.test(nom));
    expect(malNommes, `nom(s) sans date : ${malNommes.join(', ')}`).toEqual([]);
  });

  it.each([...RAPPORTS])('%s ne cite aucun chemin du poste ni adresse e-mail', (nom) => {
    const texte = read(nom);
    expect(texte.length, `${nom} est vide : la garde ne lit rien`).toBeGreaterThan(1000);
    const fautes = fuites(texte);
    expect(
      fautes,
      `chemin local ou adresse e-mail dans ${nom} (dépôt public) :\n  ${fautes.join('\n  ')}\n` +
        'Remplacer le chemin par la mention que la pièce n’est pas archivée, ou retirer la ligne.'
    ).toEqual([]);
  });

  it.each([...RAPPORTS])('%s se présente comme une archive datée, pas comme une règle', (nom) => {
    const texte = read(nom);
    expect(
      estUneArchiveDatee(texte, nom),
      `${nom} ne dit plus qu’il est daté (« ${dateDuNom(nom) ?? 'date du nom'} ») et qu’il ne ` +
        'fait pas autorité (« pas une source de vérité ») : une archive promue en règle est ce ' +
        'que #669 refuse.'
    ).toBe(true);
  });
});

describe('La garde des archives mord (#669)', () => {
  it('le contrôle mord : un chemin du poste, un tilde et une adresse e-mail sont refusés', () => {
    const fautif = [
      '# Rapport',
      'Les planches sont dans `/tmp/opencode/diag-combat/planches/`.',
      'Chromium de `~/.cache/ms-playwright` et le dépôt de `/home/chapax/Documents/planquex`.',
      'Écrire à bastien@example.com pour la suite.'
    ].join('\n');
    expect(fuites(fautif).map((f) => f.split(' — ')[0])).toEqual([
      '2: chemin éphémère /tmp',
      '3: chemin du poste /home/…',
      '3: chemin du poste ~/…',
      '4: adresse e-mail'
    ]);
    // Un texte sain passe : une URL publique n'est pas un chemin du poste.
    expect(fuites('Source : https://support.pokemon.com/hc/en-us/articles/1 — lu le 03/11/2026.')).toEqual([]);
  });

  it('le contrôle mord : un rapport sans mention d’archive est refusé', () => {
    expect(sansMentionDArchive([{ nom: 'faux.md', texte: '# Un rapport\n\nRien.' }])).toEqual(['faux.md']);
    expect(
      sansMentionDArchive([
        { nom: '2026-11-03-vrai.md', texte: '# Un rapport\n\npas une source de vérité, 03/11/2026.' }
      ])
    ).toEqual([]);
    // Et les rapports réels portent la mention.
    expect(sansMentionDArchive(RAPPORTS.map((nom) => ({ nom, texte: read(nom) })))).toEqual([]);
  });
});
