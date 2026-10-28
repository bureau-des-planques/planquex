/* PROTOTYPE JETABLE (#283) — la pression du doigt sur le sachet, commune aux trois rendus. */

/** Le creux : 0 = film plat, 1 = enfoncé à fond. Négatif un instant au relâchement (rebond). */
export interface EtatPression {
  /** Point touché, en fraction du sachet (0..1). */
  px: number;
  py: number;
  creux: number;
  cible: number;
  vitesse: number;
}

export type Ecouteur = (etat: Readonly<EtatPression>) => void;

const RAIDEUR = 240;
const AMORTISSEMENT = 15;

/**
 * Un ressort sous-amorti : il s'enfonce vite, et rebondit au relâchement. Les trois rendus
 * s'abonnent au même état et ne se partagent rien d'autre : c'est ce qui rend leur coût comparable.
 */
export class Pression {
  readonly etat: EtatPression = { px: 0.5, py: 0.55, creux: 0, cible: 0, vitesse: 0 };
  /** Réglage du banc, lu par le shader : plis en étoile (la cible E) plutôt qu'anneaux (le clip 0). */
  readonly options = { radial: false };
  /** Temps moyen passé dans les écouteurs, en ms par image (moyenne glissante). */
  coutMs = 0;
  private readonly ecouteurs = new Set<Ecouteur>();
  private raf = 0;
  private dernier = 0;

  surveiller(f: Ecouteur): () => void {
    this.ecouteurs.add(f);
    f(this.etat);
    return () => {
      this.ecouteurs.delete(f);
    };
  }

  appuyer(px: number, py: number): void {
    this.etat.px = px;
    this.etat.py = py;
    this.etat.cible = 1;
    this.lancer();
  }

  deplacer(px: number, py: number): void {
    if (this.etat.cible !== 1) return;
    this.etat.px = px;
    this.etat.py = py;
    this.notifier();
  }

  relacher(): void {
    this.etat.cible = 0;
    this.lancer();
  }

  /** Le scénario automatique : appui au centre, tenu 1,2 s, relâché. Sert aux planches de frames. */
  jouer(): void {
    this.appuyer(0.5, 0.55);
    window.setTimeout(() => this.relacher(), 1200);
  }

  private lancer(): void {
    if (this.raf) return;
    this.dernier = performance.now();
    this.raf = requestAnimationFrame(this.pas);
  }

  private readonly pas = (t: number): void => {
    const dt = Math.min(0.033, (t - this.dernier) / 1000);
    this.dernier = t;
    const e = this.etat;
    e.vitesse += (RAIDEUR * (e.cible - e.creux) - AMORTISSEMENT * e.vitesse) * dt;
    e.creux += e.vitesse * dt;
    this.notifier();
    if (Math.abs(e.cible - e.creux) < 0.002 && Math.abs(e.vitesse) < 0.01) {
      e.creux = e.cible;
      e.vitesse = 0;
      this.notifier();
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.pas);
  };

  private notifier(): void {
    const debut = performance.now();
    for (const f of this.ecouteurs) f(this.etat);
    this.coutMs = this.coutMs * 0.9 + (performance.now() - debut) * 0.1;
  }
}
