import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Illustrations — le **registre** et les **fichiers servis** ne doivent pas dériver (#120).
 *
 * Le gabarit de carte construit une **chaîne d'URL** (`url('/design/illustrations/…')`,
 * `src/components/CardView.tsx`) : Vite ne sert que `public/`. Les illustrations existent
 * donc **en double** :
 *
 * - `design/illustrations/` — le registre (versionné, avec `README.md` et `PROMPTS-flow.md`) ;
 * - `public/design/illustrations/` — ce que l'application sert réellement.
 *
 * Le README du registre annonce que **les 8 images sont à regénérer** (visages trop sombres,
 * `DESIGN.md` §6.1) et une regénération se fait dans `design/`. Sans ce test, l'application
 * continuerait de servir les anciennes et **rien** ne le dirait : le build passe, les captures
 * aussi. `src/data/art.test.ts` vérifie que le fichier cité par une carte **existe** côté
 * servi ; il ne compare pas les deux jeux.
 *
 * **Alternative consignée, non implémentée — c'est une décision, pas un correctif** : servir
 * les images par `import.meta.glob('../design/illustrations/*.webp', { eager: true,
 * query: '?url' })`. Une seule source, empreinte calculée par Vite, et **erreur au build** sur
 * un `art` inconnu. Coût : on perd la chaîne nue `art: 'x.webp'` (le champ devient une URL de
 * module, donc `src/data/art.test.ts` et les conventions de #96 changent), et le registre sort
 * de `public/`. Non fait ici, volontairement.
 */
const root = fileURLToPath(new URL('..', import.meta.url));

const REGISTRE = 'design/illustrations';
const SERVI = 'public/design/illustrations';

/** Le registre porte aussi sa documentation ; seules les images sont servies. */
const IMAGE = /\.(webp|png|jpe?g|avif)$/i;

/** Un jeu d'images : nom de fichier → empreinte SHA-256 de son contenu. */
type Jeu = Map<string, string>;

function empreintes(dir: string): Jeu {
  const jeu: Jeu = new Map();
  for (const fichier of readdirSync(join(root, dir)).filter((nom) => IMAGE.test(nom))) {
    const contenu = readFileSync(join(root, dir, fichier));
    jeu.set(fichier, createHash('sha256').update(contenu).digest('hex'));
  }
  return jeu;
}

/**
 * Les trois écarts possibles entre deux jeux, chacun avec les **noms** des fichiers fautifs.
 * Fonction pure : le test « le contrôle mord » la confronte à un jeu fautif synthétique, donc
 * la garde est prouvée même quand le dépôt est sain.
 */
function ecarts(registre: Jeu, servi: Jeu) {
  const noms = (jeu: Jeu) => [...jeu.keys()].sort();
  return {
    /** Regénérée dans `design/`, jamais copiée dans `public/`. */
    manquantes: noms(registre).filter((fichier) => !servi.has(fichier)),
    /** Servie sans exister au registre : provenance inconnue. */
    orphelines: noms(servi).filter((fichier) => !registre.has(fichier)),
    /** Même nom, contenu différent : la version servie n'est pas celle du registre. */
    divergentes: noms(registre).filter(
      (fichier) => servi.has(fichier) && servi.get(fichier) !== registre.get(fichier)
    )
  };
}

const etat = () => ecarts(empreintes(REGISTRE), empreintes(SERVI));

describe('Illustrations — registre vs fichiers servis (#120)', () => {
  it('le contrôle mord : un fichier absent, orphelin ou divergent est nommé', () => {
    // Cas fautif synthétique : le registre a deux images, le servi en a trois, dont une
    // au contenu différent et une que le registre ignore.
    const registre: Jeu = new Map([
      ['identique.webp', 'aaaa'],
      ['regeneree.webp', 'bbbb'],
      ['jamais-copiee.webp', 'cccc']
    ]);
    const servi: Jeu = new Map([
      ['identique.webp', 'aaaa'],
      ['regeneree.webp', 'ANCIENNE'],
      ['orpheline.webp', 'dddd']
    ]);
    expect(ecarts(registre, servi)).toEqual({
      manquantes: ['jamais-copiee.webp'],
      orphelines: ['orpheline.webp'],
      divergentes: ['regeneree.webp']
    });
  });

  it('le registre n’est pas vide (sinon la comparaison ne garde rien)', () => {
    // Une assertion qui passe sur deux dossiers vides ne garde aucune règle.
    expect(empreintes(REGISTRE).size, `aucune image dans ${REGISTRE}`).toBeGreaterThan(0);
  });

  it('toute image du registre est copiée dans public/ (sens registre → servi)', () => {
    const { manquantes } = etat();
    expect(
      manquantes,
      `illustration(s) du registre jamais copiée(s) dans ${SERVI} : ${manquantes.join(', ')} — ` +
        "l'application servirait l'ancienne version, ou rien. Copier le fichier après l'avoir regénéré."
    ).toEqual([]);
  });

  it('toute image servie vient du registre (sens servi → registre)', () => {
    const { orphelines } = etat();
    expect(
      orphelines,
      `illustration(s) servie(s) sans équivalent dans ${REGISTRE} : ${orphelines.join(', ')} — ` +
        'provenance inconnue. Ajouter le fichier au registre, ou le retirer de `public/`.'
    ).toEqual([]);
  });

  it('chaque image servie est identique au registre, octet pour octet (SHA-256)', () => {
    const { divergentes } = etat();
    const detail = divergentes
      .map((fichier) => {
        const poids = (dir: string) => readFileSync(join(root, dir, fichier)).length;
        return `${fichier} (${REGISTRE} ${poids(REGISTRE)} o, ${SERVI} ${poids(SERVI)} o)`;
      })
      .join(', ');
    expect(
      divergentes,
      `illustration(s) servie(s) différente(s) du registre : ${detail} — ` +
        'le nom est le même mais pas le contenu : la version regénérée n’a pas été copiée dans `public/`.'
    ).toEqual([]);
  });
});
