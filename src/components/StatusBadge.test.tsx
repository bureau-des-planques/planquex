// @vitest-environment jsdom
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Status } from '@/data/types';
import { StatusBadge } from './StatusBadge';

/**
 * **La densité du combat** (#189, `SPEC-COMBAT-UI` §4.3) : le nom d'une Condition est une
 * annotation. En `sobre`, le badge garde son **icône** (elle distingue les conditions autrement
 * que par la couleur, SC 1.4.1) et le libellé reste lu par un lecteur d'écran ; en `détaillé`,
 * le nom revient.
 */
describe('StatusBadge — le nom est une annotation (#189)', () => {
  it('affiche le nom par défaut, et le garde lisible sans le montrer en `sobre`', () => {
    const avecNom = render(<StatusBadge status="SURCHARGE" />);
    expect(avecNom.container.querySelector('.status-chip__nom')).toHaveTextContent('Surcharge');
    avecNom.unmount();

    const sobre = render(<StatusBadge status="SURCHARGE" nomAffiche={false} />);
    // Aucun nom **visible** : c'est l'annotation que `sobre` coupe.
    expect(sobre.container.querySelector('.status-chip__nom')).toBeNull();
    // Mais il reste lu : le badge ne devient pas une couleur seule.
    expect(screen.getByText('Surcharge')).toHaveClass('sr-only');
    expect(sobre.container.querySelector('svg')).not.toBeNull();
  });
});

/**
 * **Le harnais de `npm run capturer` suit le composant** (#324).
 *
 * `scripts/capturer.mjs` pose le « pire cas » — trois Conditions par camp — **dans le DOM**,
 * parce qu'atteindre ces Conditions en jouant dépend de la graine. Il en connaît donc le
 * balisage : une puce `status-chip`, l'icône à sa taille, puis le nom (visible en `détaillé`,
 * `sr-only` en `sobre`). Recopié à la main, ce balisage survivait au composant : le jour où
 * `StatusBadge` change, la mesure mesurait autre chose — et restait verte.
 *
 * Ce test est le lien : il **rend le vrai composant** et le confronte au modèle publié par
 * `--plan`, que le harnais emploie. Changer une classe, la taille de l'icône, la structure ou
 * un libellé sans toucher au modèle fait tomber ces assertions ; le harnais ne peut donc plus
 * mesurer un badge qui n'existe pas.
 */

/** Le modèle du harnais, lu dans `scripts/capturer.mjs --plan` (pas dans son source). */
interface ModeleBadge {
  racine: string;
  modificateur: string;
  icone: { largeur: number; hauteur: number };
  nom: string;
  masque: string;
  statuts: { code: string; nom: string }[];
}

function modeleDuHarnais(): ModeleBadge {
  const env = { ...process.env };
  // `vitest` exporte `BASE_URL=/` et un `PORT` pour son propre usage : le script refuse une
  // base qui n'est pas une URL absolue.
  delete env.BASE_URL;
  delete env.PORT;
  const sortie = execFileSync(process.execPath, ['scripts/capturer.mjs', '--plan'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env
  });
  const { badge } = JSON.parse(sortie) as { badge: ModeleBadge };
  expect(badge, 'le plan de `npm run capturer` ne publie plus le modèle du badge').toBeDefined();
  return badge;
}

/** Les écarts entre une puce **rendue** et le modèle du harnais — vide quand ils s'accordent. */
function ecartsDuBadge(modele: ModeleBadge, puce: Element, { nomAffiche }: { nomAffiche: boolean }): string[] {
  const ecarts: string[] = [];
  const attendue = `${modele.racine} ${modele.modificateur}${classeDuStatut(modele, puce)}`;
  if (puce.tagName.toLowerCase() !== 'span')
    ecarts.push(`la puce est un <${puce.tagName.toLowerCase()}>, pas un <span>`);
  if (puce.className !== attendue) ecarts.push(`classe « ${puce.className} » au lieu de « ${attendue} »`);
  const [icone, texte, ...reste] = [...puce.children];
  if (!icone || icone.tagName.toLowerCase() !== 'svg') ecarts.push("la première enfant n'est pas le <svg> de l'icône");
  else {
    if (icone.getAttribute('width') !== String(modele.icone.largeur))
      ecarts.push(`icône de ${icone.getAttribute('width')} px au lieu de ${modele.icone.largeur}`);
    if (icone.getAttribute('height') !== String(modele.icone.hauteur))
      ecarts.push(`icône de ${icone.getAttribute('height')} px de haut au lieu de ${modele.icone.hauteur}`);
  }
  const classeTexte = nomAffiche ? modele.nom : modele.masque;
  if (!texte) ecarts.push('pas de seconde enfant : le libellé manque');
  else {
    if (texte.className !== classeTexte) ecarts.push(`libellé « ${texte.className} » au lieu de « ${classeTexte} »`);
    const nom = modele.statuts.find((statut) => statut.code.toLowerCase() === classeDuStatut(modele, puce))?.nom;
    if (texte.textContent !== nom) ecarts.push(`libellé « ${texte.textContent} » au lieu de « ${nom} »`);
  }
  if (reste.length > 0) ecarts.push(`${reste.length} enfant(s) de trop dans la puce`);
  return ecarts;
}

/** Le statut que la puce prétend porter, lu dans son modificateur de classe. */
function classeDuStatut(modele: ModeleBadge, puce: Element): string {
  const suffixe = puce.className.slice(`${modele.racine} ${modele.modificateur}`.length);
  return modele.statuts.some((statut) => statut.code.toLowerCase() === suffixe) ? suffixe : '?';
}

describe('StatusBadge — le pire cas du harnais de capture vient du composant (#324)', () => {
  const modele = modeleDuHarnais();

  it('chaque Condition du pire cas se rend exactement comme le modèle du harnais le décrit', () => {
    // Le modèle doit couvrir les Conditions que le harnais pose : trois, qui se cumulent.
    expect(modele.statuts.map((statut) => statut.code)).toEqual(['SURCHARGE', 'EPUISEMENT', 'IMMOBILISATION']);
    for (const { code, nom } of modele.statuts) {
      const rendu = render(<StatusBadge status={code as Status} />);
      expect(ecartsDuBadge(modele, rendu.container.firstElementChild!, { nomAffiche: true }), code).toEqual([]);
      expect(rendu.container.querySelector('.status-chip')?.textContent).toContain(nom);
      rendu.unmount();

      const sobre = render(<StatusBadge status={code as Status} nomAffiche={false} />);
      expect(ecartsDuBadge(modele, sobre.container.firstElementChild!, { nomAffiche: false }), code).toEqual([]);
      sobre.unmount();
    }
  });

  it('le contrôle mord : une icône plus grosse, une classe ou un libellé changés sont vus', () => {
    const rendu = render(<StatusBadge status="SURCHARGE" />);
    const puce = rendu.container.firstElementChild!;
    expect(ecartsDuBadge(modele, puce, { nomAffiche: true })).toEqual([]);

    // La taille de l'icône (le 12 px que le harnais recopie).
    expect(ecartsDuBadge({ ...modele, icone: { largeur: 14, hauteur: 14 } }, puce, { nomAffiche: true })).toEqual([
      'icône de 12 px au lieu de 14',
      'icône de 12 px de haut au lieu de 14'
    ]);
    // La classe de la puce, et celle du libellé.
    expect(ecartsDuBadge({ ...modele, racine: 'condition' }, puce, { nomAffiche: true })[0]).toContain('classe');
    expect(ecartsDuBadge({ ...modele, nom: 'chip__label' }, puce, { nomAffiche: true })[0]).toContain('libellé');
    // Un libellé de Condition renommé.
    const renomme = {
      ...modele,
      statuts: modele.statuts.map((statut) => ({ ...statut, nom: `${statut.nom} ?` }))
    };
    expect(ecartsDuBadge(renomme, puce, { nomAffiche: true })[0]).toContain('au lieu de « Surcharge ? »');
    rendu.unmount();
  });

  it('le harnais pose ce modèle-là : son balisage n’est plus recopié à la main', () => {
    const source = readFileSync('scripts/capturer.mjs', 'utf8');
    expect(source).toContain('page.evaluate(poserLePireCas, [detaille, MODELE_BADGE])');
    // Le HTML n'est plus écrit à la main : ni la puce, ni le 12 px de l'icône.
    expect(source).not.toContain('puce.className = `status-chip status-chip--${classe}`');
    expect(source).not.toContain("icone.setAttribute('width', '12')");
    expect(source).toContain('modele.icone.largeur');
  });
});
