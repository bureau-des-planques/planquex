// @vitest-environment node
/**
 * La ligne d'une migration dans la page du poste (#224).
 *
 * Le bouton n'est offert que sur une migration **manquante** : une migration appliquée **avant**
 * le registre l'est déjà, et le poste ne connaît pas son empreinte — la proposer serait un pari
 * (0001 et 0002 ne sont pas idempotentes). Chaque contrôle **mord** : la ligne « antérieure » ne
 * doit porter **aucun** bouton, et le cas « manquante » prouve que le contrôle ne l'interdit pas
 * partout — sinon une page qui n'afficherait jamais de bouton passerait aussi.
 */
import { describe, expect, it } from 'vitest';
import { ligneMigration } from './lib/ligne-migration.mjs';

const EMPREINTE = 'a'.repeat(64);

describe('la ligne de migration de la page (#224)', () => {
  it('offre le bouton sur une migration manquante', () => {
    const ligne = ligneMigration({ fichier: '0009_neuve.sql', etat: 'manquante', empreinte: EMPREINTE });
    expect(ligne).toContain('appliquer');
    expect(ligne).toContain('0009_neuve.sql');
  });

  it('dit « appliquée avant le registre », sans bouton ni empreinte affirmée', () => {
    const ligne = ligneMigration({ fichier: '0001_mur.sql', etat: 'anterieure', empreinte: EMPREINTE });
    expect(ligne).toContain('appliquée avant le registre');
    expect(ligne).not.toContain('appliquer');
    // Aucune empreinte n'est affirmée : le fichier d'aujourd'hui n'est pas celui d'alors.
    expect(ligne).not.toContain(EMPREINTE.slice(0, 16));
    expect(ligne).toContain('non enregistrée');
  });

  it('ne propose rien à rejouer sur une migration appliquée ou à l’empreinte changée', () => {
    for (const etat of ['appliquee', 'empreinte-changee']) {
      const ligne = ligneMigration({ fichier: '0008_comite.sql', etat, empreinte: EMPREINTE });
      expect(ligne, etat).not.toContain('appliquer');
    }
  });
});
