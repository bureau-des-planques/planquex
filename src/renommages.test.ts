import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **Les anciens noms de la Boîte à idées ne reviennent pas** (#210, D-097 (9)).
 *
 * D-097 renomme l'entrée en **le comité** : `/idees` devient `/comite`, `BoiteAIdees.tsx`
 * devient `Comite.tsx`, `BulleBoiteAIdees.tsx` devient `AlerteComite.tsx`, et
 * `docs/boite-a-idees.json` devient `docs/comite.json`. Un nom d'écran renommé à moitié se
 * remet à vivre au premier fichier recopié : c'est un *Mysterious Name* (`AGENTS.md` §5),
 * et c'est exactement ce que D-097 (9) demande de refuser.
 *
 * Le contrôle lit le dépôt, comme `scripts/compteurs.test.ts` : pas de linter de plus. Deux
 * exceptions seulement, chacune avec sa raison, et le second test montre que le contrôle
 * **mord** — un bac fabriqué qui réintroduit un nom est trouvé.
 */
const RACINE = process.cwd();
const DOSSIERS = ['src', 'scripts', 'supabase'] as const;

/** Les trois formes interdites : l'adresse du fichier, le module, le document. */
const ANCIENS_NOMS = ['boite-a-idees', 'BoiteAIdees', 'BOITE-A-IDEES'] as const;

const EXCEPTIONS = [
  // **Généré** : `npm run notes:versions` recopie les notes des releases GitHub, qui
  // parlent de `docs/boite-a-idees.json` à leur date. On ne réécrit pas une release.
  'src/data/versions.ts',
  // Ce fichier-ci nomme ce qu'il interdit : il ne peut pas se compter comme une référence.
  'src/renommages.test.ts'
];

/** Les fichiers des dossiers donnés qui portent encore un ancien nom, triés. */
function references(root: string, dossiers: readonly string[], exceptions: readonly string[] = []): string[] {
  const trouvees: string[] = [];
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) {
        parcourir(chemin);
        continue;
      }
      const relatif = relative(root, chemin).split(sep).join('/');
      if (exceptions.includes(relatif)) continue;
      const texte = readFileSync(chemin, 'utf8');
      for (const nom of ANCIENS_NOMS) {
        if (texte.includes(nom)) trouvees.push(`${relatif} : ${nom}`);
      }
    }
  };
  for (const dossier of dossiers) {
    const chemin = join(root, dossier);
    if (existsSync(chemin)) parcourir(chemin);
  }
  return trouvees.sort();
}

describe('les anciens noms de la boîte à idées ne reviennent pas (#210, D-097 (9))', () => {
  it('aucune référence dans src/, scripts/ et supabase/', () => {
    expect(references(RACINE, DOSSIERS, EXCEPTIONS)).toEqual([]);
  });

  it('le contrôle mord : un fichier qui réintroduit un ancien nom est trouvé', () => {
    const bac = mkdtempSync(join(tmpdir(), 'renommages-'));
    try {
      mkdirSync(join(bac, 'src', 'pages'), { recursive: true });
      writeFileSync(join(bac, 'src', 'pages', 'Retour.tsx'), "import { x } from '@/pages/BoiteAIdees';\n");
      mkdirSync(join(bac, 'scripts'), { recursive: true });
      writeFileSync(join(bac, 'scripts', 'mur.mjs'), "const fichier = 'docs/boite-a-idees.json';\n");
      writeFileSync(join(bac, 'scripts', 'contrat.mjs'), 'La forme est dans docs/BOITE-A-IDEES.md.\n');

      expect(references(bac, ['src', 'scripts'])).toEqual([
        'scripts/contrat.mjs : BOITE-A-IDEES',
        'scripts/mur.mjs : boite-a-idees',
        'src/pages/Retour.tsx : BoiteAIdees'
      ]);

      // Une exception ne masque que **son** fichier : les deux autres restent trouvés.
      expect(references(bac, ['src', 'scripts'], ['scripts/contrat.mjs'])).toEqual([
        'scripts/mur.mjs : boite-a-idees',
        'src/pages/Retour.tsx : BoiteAIdees'
      ]);
    } finally {
      rmSync(bac, { recursive: true, force: true });
    }
  });
});
