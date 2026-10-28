import { describe, expect, it } from 'vitest';
import { phraseCafeAuPoste } from './cafe-au-poste';

/**
 * **Le panneau du café doit pouvoir se taire au bon endroit** (#399).
 *
 * Le moteur refuse un attachement pour quatre raisons distinctes (`attachEnergy`,
 * `engine.ts`) : un café par tour, rien au premier tour de qui ouvre, une Machine vide, et
 * pas de Planqué à qui donner le café. La phrase les dit dans cet ordre, et **se tait**
 * quand l'attachement est possible — sinon la barre dirait « rien à faire » à côté de
 * boutons qui, eux, sont offerts.
 */
const possible = {
  aMoi: true,
  premierTour: false,
  dejaAttache: false,
  cafe: 'QVT' as const,
  aCible: true
};

describe('phraseCafeAuPoste', () => {
  it('se tait quand l’attachement est possible', () => {
    expect(phraseCafeAuPoste(possible)).toBeUndefined();
  });

  it('se tait quand ce n’est pas mon tour, même si tout manque', () => {
    expect(
      phraseCafeAuPoste({ aMoi: false, premierTour: true, dejaAttache: true, cafe: undefined, aCible: false })
    ).toBeUndefined();
  });

  it('dit chaque refus du moteur, dans son ordre', () => {
    expect(phraseCafeAuPoste({ ...possible, dejaAttache: true })).toMatch(/déjà attaché/i);
    expect(phraseCafeAuPoste({ ...possible, premierTour: true })).toMatch(/premier tour/i);
    expect(phraseCafeAuPoste({ ...possible, cafe: undefined })).toMatch(/vide/i);
    expect(phraseCafeAuPoste({ ...possible, aCible: false })).toMatch(/aucun Planqué/i);
    // Le café déjà attaché passe avant tout le reste : c'est le fait, pas le manque.
    expect(phraseCafeAuPoste({ ...possible, dejaAttache: true, premierTour: true, cafe: undefined })).toMatch(
      /déjà attaché/i
    );
  });

  it('le contrôle mord : un cas fautif est refusé', () => {
    // Sans la garde `dejaAttache`, la phrase décrirait un café à attacher alors qu'il l'est
    // déjà : c'est exactement le silence ambigu que le post-it reprochait à la barre.
    const faux = { ...possible, dejaAttache: true };
    expect(phraseCafeAuPoste(faux)).not.toBeUndefined();
    expect(phraseCafeAuPoste(faux)).not.toMatch(/choisis/i);
  });
});
