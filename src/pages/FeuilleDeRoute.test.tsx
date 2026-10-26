// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_LABEL, APP_VERSION } from '@/version';
import { NOTES_VERSIONS } from '@/data/versions';
import { CRITERES_ALPHA, DECIDE_PLUS_TARD, JALONS, PAS_MAINTENANT } from '@/data/plan';
import { FEATURES_PREVUES } from '@/data/plan-dev';
import { FeuilleDeRoute } from '@/pages/FeuilleDeRoute';

/**
 * **La feuille de route publique** (D-097 (3), #214) — `/feuille-de-route`.
 *
 * Elle **absorbe** les nouveautés de D-090 (le journal des versions) et y ajoute ce qui
 * ne se génère pas : l'étape en cours, les critères de sortie d'alpha (D-056), les jalons
 * (D-048) et ce qui est décidé pour plus tard (D-061). Les fonctionnalités prévues, elles,
 * viennent de `src/data/plan-dev.ts`, que `npm run plan:dev` prend aux issues `alpha`.
 *
 * Ce test garde cinq choses, et chacune peut échouer :
 *
 * 1. **les blocs sont là**, avec leur contenu — un bloc vide ne renseigne personne ;
 * 2. **la version courante est celle de `package.json`**, lue par `APP_LABEL` — jamais un
 *    numéro recopié dans la page ;
 * 3. **aucun lien ne mène au dépôt** : il est privé, donc `github.com` s'y ouvrirait sur un
 *    `404` (D-097 (3)). Le numéro et le titre de l'issue suffisent ;
 * 4. **la page vit hors de la garde** dans `src/App.tsx` — elle se lit sans compte ;
 * 5. **les modes parkés n'y sont pas** (D-019) : ils ne s'annoncent jamais.
 */
const publiees = NOTES_VERSIONS.filter((note) => !note.brouillon);

const rendre = () =>
  render(
    <MemoryRouter>
      <FeuilleDeRoute />
    </MemoryRouter>
  );

afterEach(cleanup);

describe('Feuille de route — les blocs de la page', () => {
  it('met en avant la version courante, lue par APP_LABEL', () => {
    rendre();
    expect(screen.getByRole('heading', { level: 1, name: /feuille de route/i })).toBeTruthy();
    // Le libellé complet (« Alpha · … ») : c'est celui que Réglages affiche aussi.
    expect(screen.getByText(APP_LABEL)).toBeTruthy();
    const courante = NOTES_VERSIONS.find((note) => note.version === APP_VERSION);
    expect(courante, `aucune note pour ${APP_VERSION}`).toBeDefined();
    expect(screen.getByRole('heading', { name: courante!.titre })).toBeTruthy();
    expect(screen.getByText(courante!.points[0].texte)).toBeTruthy();
  });

  it('donne l’historique, une entrée par version publiée', () => {
    rendre();
    for (const note of publiees) {
      expect(screen.getByText(note.points[0].texte), `points de ${note.version}`).toBeTruthy();
    }
  });

  it('montre l’étape en cours, les critères et les jalons', () => {
    rendre();
    expect(screen.getByRole('heading', { level: 2, name: /étape en cours/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /critères de sortie/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /jalons/i })).toBeTruthy();

    for (const critere of CRITERES_ALPHA) {
      // Un même critère peut se lire deux fois (ici, et dans le jalon alpha) : on compte.
      expect(screen.getAllByText(critere.texte).length, `critère : ${critere.texte}`).toBeGreaterThan(0);
    }
    for (const jalon of JALONS) {
      expect(screen.getAllByText(jalon.texte).length, `jalon ${jalon.etape}`).toBeGreaterThan(0);
    }
  });

  it('montre les fonctionnalités prévues, par leur numéro et leur titre', () => {
    rendre();
    expect(screen.getByRole('heading', { level: 2, name: /prévu/i })).toBeTruthy();
    expect(FEATURES_PREVUES.length).toBeGreaterThan(0);
    for (const feature of FEATURES_PREVUES) {
      expect(screen.getAllByText(new RegExp(`#${feature.numero}`)).length, `issue ${feature.numero}`).toBeGreaterThan(
        0
      );
      expect(
        screen.getAllByText(new RegExp(echapper(feature.titre))).length,
        `titre ${feature.numero}`
      ).toBeGreaterThan(0);
    }
  });

  it('dit ce qui est décidé pour plus tard, et ce qui n’est pas pour maintenant', () => {
    rendre();
    expect(screen.getByRole('heading', { level: 2, name: /plus tard/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /pas maintenant/i })).toBeTruthy();
    for (const element of DECIDE_PLUS_TARD) {
      expect(screen.getAllByText(element.texte).length, element.texte).toBeGreaterThan(0);
    }
    for (const quoi of PAS_MAINTENANT) {
      expect(screen.getAllByText(quoi).length, quoi).toBeGreaterThan(0);
    }
  });

  it('ne mène jamais vers le dépôt privé (D-097 (3))', () => {
    const { container } = rendre();
    // Aucun `href` sortant : la page n'a que ses liens internes (retour au bureau).
    for (const lien of [...container.querySelectorAll('a')]) {
      const href = lien.getAttribute('href') ?? '';
      expect(href.startsWith('/'), `${href} n’est pas interne`).toBe(true);
    }
    // Et aucune ressource distante : l'`xmlns` du SVG est un espace de noms, pas un lien.
    for (const element of [...container.querySelectorAll('[href], [src], [srcSet]')]) {
      for (const attribut of ['href', 'src', 'srcSet']) {
        const valeur = element.getAttribute(attribut);
        if (valeur) expect(valeur, `${attribut} distant`).not.toMatch(/^https?:/i);
      }
    }
    expect(container.textContent ?? '').not.toMatch(/https?:\/\/|github\.com/i);
  });

  it('n’annonce aucun mode parké (D-019)', () => {
    const { container } = rendre();
    expect(container.textContent ?? '').not.toMatch(/RULES-4b|modes? (parké|futur)/i);
  });

  it('est déclarée hors de la garde des comptes, dans App.tsx', () => {
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    const route = app.indexOf('<Route path="feuille-de-route"');
    const garde = app.indexOf('<Route element={<Layout />}>');
    expect(route, 'route /feuille-de-route introuvable dans src/App.tsx').toBeGreaterThanOrEqual(0);
    expect(garde, 'la garde `<Route element={<Layout />}>` a disparu').toBeGreaterThanOrEqual(0);
    // Avant la garde = hors de `Layout`, donc hors de `GardeComptes` : lisible sans compte.
    expect(route).toBeLessThan(garde);
  });
});

/** Un titre d'issue peut porter des caractères de regex : on les échappe avant le `RegExp`. */
function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
