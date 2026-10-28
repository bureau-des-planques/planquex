// @vitest-environment jsdom
// Lenteur justifiée (D-143 (5)) — rend la Feuille de route sous jsdom, bloc par bloc
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_LABEL, APP_VERSION } from '@/version';
import { NOTES_VERSIONS } from '@/data/versions';
import { CRITERES_ALPHA, DECIDE_PLUS_TARD, JALONS, PAS_MAINTENANT } from '@/data/plan';
import { FEATURES_PREVUES, type FeaturePrevue } from '@/data/plan-dev';
import { FeuilleDeRoute, DEPOT, LIEN_RELEASES, lienIssue } from '@/pages/FeuilleDeRoute';

/**
 * **La feuille de route publique** (D-097 (3), #214) — `/feuille-de-route`.
 *
 * Elle **absorbe** les nouveautés de D-090 (le journal des versions) et y ajoute ce qui
 * ne se génère pas : l'étape en cours, les critères de sortie d'alpha (D-056), les jalons
 * (D-048) et ce qui est décidé pour plus tard (D-061). **Ce qui arrive** vient de
 * `src/data/plan-dev.ts`, que `npm run plan:dev` prend aux issues **`alpha` et `beta`** :
 * un ticket `beta` se travaille pendant l'alpha (#336).
 *
 * Ce test garde cinq choses, et chacune peut échouer :
 *
 * 1. **les blocs sont là**, avec leur contenu — un bloc vide ne renseigne personne ;
 * 2. **la version courante est celle de `package.json`**, lue par `APP_LABEL` — jamais un
 *    numéro recopié dans la page ;
 * 3. **les liens mènent au dépôt, mais à ce qui intéresse un testeur** (D-132) : les
 *    releases et les chantiers ouverts, en nouvel onglet et avec le `rel` de sécurité. Le
 *    dépôt nu et le code ne sont **pas** liés ;
 * 4. **la page vit hors de la garde** dans `src/App.tsx` — elle se lit sans compte ;
 * 5. **les modes parkés n'y sont pas** (D-019) : ils ne s'annoncent jamais.
 *
 * Et **l'étape de chaque chantier s'affiche** : un testeur doit pouvoir dire « pour
 * l'alpha » de « pour la beta » sans deviner (#336). Le contrôle mord : une entrée privée
 * de son étape n'affiche plus le mot.
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

  it('montre ce qui arrive, avec le numéro, le titre et l’étape', () => {
    rendre();
    expect(screen.getByRole('heading', { level: 2, name: /ce qui arrive/i })).toBeTruthy();
    expect(FEATURES_PREVUES.length).toBeGreaterThan(0);
    for (const feature of FEATURES_PREVUES) {
      expect(screen.getAllByText(new RegExp(`#${feature.numero}`)).length, `issue ${feature.numero}`).toBeGreaterThan(
        0
      );
      expect(
        screen.getAllByText(new RegExp(echapper(feature.titre))).length,
        `titre ${feature.numero}`
      ).toBeGreaterThan(0);
      // L'étape est un des deux mots du jalon, jamais vide : le triage l'impose.
      expect(['alpha', 'beta']).toContain(feature.etape);
    }
  });

  it('range chaque chantier sous son étape, et le dit en toutes lettres', () => {
    // L'état réel du tracker change : on donne les deux étapes au rendu pour que le test
    // dise la **règle** (les deux se lisent), pas l'état d'un jour.
    const features: FeaturePrevue[] = [
      { numero: 9001, titre: 'Un chantier de la boucle', etape: 'alpha' },
      { numero: 9002, titre: 'Un chantier du PvP', etape: 'beta' }
    ];
    const { container } = render(
      <MemoryRouter>
        <FeuilleDeRoute features={features} />
      </MemoryRouter>
    );

    const lignes = [...container.querySelectorAll('.feuille-de-route__arrivage')];
    expect(lignes).toHaveLength(2);
    const [ligneAlpha, ligneBeta] = lignes as HTMLElement[];
    expect(within(ligneAlpha).getByText('alpha', { exact: true })).toBeTruthy();
    expect(within(ligneBeta).getByText('beta', { exact: true })).toBeTruthy();
    // Et pas l'inverse : le mot vient de l'entrée, pas de sa place dans la liste.
    expect(within(ligneAlpha).queryByText('beta', { exact: true })).toBeNull();
    expect(within(ligneBeta).queryByText('alpha', { exact: true })).toBeNull();
    // Les deux groupes sont annoncés : l'ordre est l'alpha puis la beta.
    expect(screen.getByRole('heading', { level: 3, name: /étape alpha/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /étape beta/i })).toBeTruthy();
  });

  it('le contrôle mord : sans leur étape, les chantiers ne se rangent plus', () => {
    // Une entrée amputée de son étape (ce que le générateur refuse désormais) ne doit pas
    // emprunter le mot de sa voisine : c'est la preuve que le badge lit la donnée.
    // La page affiche aussi les **jalons**, qui s'appellent `alpha` et `beta` : on regarde
    // donc la section « Ce qui arrive », pas toute la page.
    const sectionArrivee = () =>
      screen.getByRole('heading', { level: 2, name: /ce qui arrive/i }).closest('section') as HTMLElement;

    const entree: FeaturePrevue = { numero: 9003, titre: 'Un chantier sans étape', etape: 'beta' };
    render(
      <MemoryRouter>
        <FeuilleDeRoute features={[entree]} />
      </MemoryRouter>
    );
    expect(within(sectionArrivee()).getByText(/Un chantier sans étape/)).toBeTruthy();
    expect(sectionArrivee().querySelectorAll('.feuille-de-route__etape')).toHaveLength(1);
    cleanup();

    const ampute = [{ numero: 9003, titre: 'Un chantier sans étape' } as unknown as FeaturePrevue];
    render(
      <MemoryRouter>
        <FeuilleDeRoute features={ampute} />
      </MemoryRouter>
    );
    // Le chantier n'est plus rangé sous aucune étape : il disparaît de la section.
    expect(sectionArrivee().querySelectorAll('.feuille-de-route__etape')).toHaveLength(0);
    expect(within(sectionArrivee()).queryByText(/Un chantier sans étape/)).toBeNull();
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

  it('n’ouvre que les portes du dépôt que D-132 a tranchées — releases et issues', () => {
    const { container } = rendre();
    // La règle inverse (« aucun lien vers le dépôt », D-097 (3)) s'appuyait sur un dépôt
    // **privé** qui rendait un 404 ; il est public depuis D-118. D-132 ouvre les
    // **releases** et les **chantiers ouverts**, et rien d'autre : ni le dépôt nu, ni le
    // code, ni une ressource distante d'un autre site.
    const liens = [...container.querySelectorAll('a')];
    const externes = liens.filter((lien) => /^https?:/i.test(lien.getAttribute('href') ?? ''));
    expect(externes.length, 'aucune porte du dépôt n’est ouverte').toBeGreaterThan(0);

    for (const lien of externes) {
      const href = lien.getAttribute('href') ?? '';
      const permises = [LIEN_RELEASES, ...FEATURES_PREVUES.map((feature) => lienIssue(feature.numero))];
      expect(permises, `${href} n’est ni une release ni une issue`).toContain(href);
      // Nouvel onglet et `rel` de sécurité, comme le lien du serveur des testeurs (D-120).
      expect(lien.getAttribute('target'), `${href} s’ouvre dans l’onglet courant`).toBe('_blank');
      expect(lien.getAttribute('rel'), `${href} n’a pas le rel de sécurité`).toBe('noreferrer noopener');
    }
    // Le dépôt **nu** et le code ne sont jamais liés : c'est la moitié de la décision.
    for (const href of externes.map((lien) => lien.getAttribute('href') ?? '')) {
      expect(href).not.toBe(DEPOT);
      expect(href).not.toMatch(/\/tree\/|\/blob\/|\/pulls?\/|\.git$/);
      expect(href).not.toMatch(/discord|\.(png|jpe?g|svg|webp)$/i);
    }
  });

  it('le contrôle mord : un lien vers le code est refusé', () => {
    // Le contrôle lit une **liste blanche** (releases, issues). Confronté à un href de
    // code, il doit le refuser — sinon il ne garderait que ce que la page fait aujourd'hui.
    const permises = [LIEN_RELEASES, lienIssue(214)];
    expect(permises).toContain(lienIssue(214));
    expect(permises).not.toContain(`${DEPOT}/tree/main/src`);
    expect(permises).not.toContain(`${DEPOT}/blob/main/AGENTS.md`);
    expect(permises).not.toContain(DEPOT);
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
