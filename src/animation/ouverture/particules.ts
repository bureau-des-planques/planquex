/*
 * **Les particules de l'ouverture** : poussière en suspension, étincelles du front de déchirure,
 * gerbe de l'ouverture, pluie d'étoiles des cartes secrètes (#283).
 *
 * Un seul canvas 2D, une seule boucle, composition additive (`lighter`) : c'est la lumière qui fait
 * le spectaculaire, pas le nombre. La boucle s'arrête d'elle-même quand il n'y a plus rien à
 * dessiner et que la poussière est coupée — un dialogue fermé ne laisse pas tourner de
 * `requestAnimationFrame`.
 *
 * Purement décoratif : rien d'informatif n'y vit (D-098), et la scène ne le monte pas sous
 * « Mouvement réduit ».
 */

type Forme = 'point' | 'trait' | 'etoile';

interface Particule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  duree: number;
  taille: number;
  couleur: string;
  forme: Forme;
  gravite: number;
  frein: number;
  angle: number;
  spin: number;
}

export interface Emission {
  x: number;
  y: number;
  nombre: number;
  couleurs: readonly string[];
  /** Vitesse de départ, en px/s (une plage). */
  vitesse: [number, number];
  /** Direction moyenne, en radians, et son ouverture. Par défaut : toutes les directions. */
  direction?: number;
  ouverture?: number;
  duree?: [number, number];
  taille?: [number, number];
  gravite?: number;
  frein?: number;
  forme?: Forme;
}

const entre = ([a, b]: [number, number]): number => a + Math.random() * (b - a);

export class Particules {
  private readonly ctx: CanvasRenderingContext2D;
  private liste: Particule[] = [];
  private raf = 0;
  private dernier = 0;
  private largeur = 0;
  private hauteur = 0;
  private poussiere = true;
  private ratio = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2D indisponible');
    this.ctx = ctx;
  }

  redimensionner(largeur: number, hauteur: number): void {
    this.ratio = Math.min(2, window.devicePixelRatio || 1);
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.canvas.width = Math.round(largeur * this.ratio);
    this.canvas.height = Math.round(hauteur * this.ratio);
    this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
  }

  /** La poussière d'ambiance : quelques grains qui montent lentement dans le faisceau. */
  ambiance(active: boolean): void {
    this.poussiere = active;
    if (active) this.lancer();
  }

  emettre(e: Emission): void {
    for (let i = 0; i < e.nombre; i += 1) {
      const angle =
        e.direction === undefined
          ? Math.random() * Math.PI * 2
          : e.direction + (Math.random() - 0.5) * (e.ouverture ?? 1);
      const v = entre(e.vitesse);
      const duree = entre(e.duree ?? [0.5, 1.1]);
      this.liste.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        vie: duree,
        duree,
        taille: entre(e.taille ?? [1, 2.6]),
        couleur: e.couleurs[i % e.couleurs.length] ?? '#fff',
        forme: e.forme ?? 'trait',
        gravite: e.gravite ?? 520,
        frein: e.frein ?? 1.6,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 8
      });
    }
    // Un plafond : un appareil lent ne doit pas s'écrouler sous une gerbe trop riche.
    if (this.liste.length > 900) this.liste.splice(0, this.liste.length - 900);
    this.lancer();
  }

  detruire(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.liste = [];
  }

  private lancer(): void {
    if (this.raf) return;
    this.dernier = performance.now();
    this.raf = requestAnimationFrame(this.pas);
  }

  private semerPoussiere(dt: number): void {
    if (!this.poussiere) return;
    // ~14 grains par seconde, qui vivent 4 à 7 s : une trentaine à l'écran.
    if (Math.random() > dt * 14) return;
    const duree = 4 + Math.random() * 3;
    this.liste.push({
      x: this.largeur * (0.15 + Math.random() * 0.7),
      y: this.hauteur * (0.35 + Math.random() * 0.65),
      vx: (Math.random() - 0.5) * 10,
      vy: -8 - Math.random() * 16,
      vie: duree,
      duree,
      taille: 0.6 + Math.random() * 1.6,
      couleur: Math.random() < 0.3 ? '#f4d68a' : '#cfe3ff',
      forme: 'point',
      gravite: 0,
      frein: 0,
      angle: 0,
      spin: 0
    });
  }

  private readonly pas = (t: number): void => {
    const dt = Math.min(0.04, (t - this.dernier) / 1000 || 0.016);
    this.dernier = t;
    this.semerPoussiere(dt);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.largeur, this.hauteur);
    ctx.globalCompositeOperation = 'lighter';
    const vivantes: Particule[] = [];
    for (const p of this.liste) {
      p.vie -= dt;
      if (p.vie <= 0) continue;
      p.vx -= p.vx * p.frein * dt;
      p.vy += p.gravite * dt - p.vy * p.frein * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      const f = p.vie / p.duree;
      // Les grains de poussière naissent et meurent en fondu ; les étincelles s'éteignent.
      const alpha = p.forme === 'point' ? Math.sin(f * Math.PI) * 0.55 : Math.min(1, f * 1.6);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.couleur;
      ctx.strokeStyle = p.couleur;
      if (p.forme === 'trait') {
        ctx.lineWidth = p.taille;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.forme === 'etoile') {
        dessinerEtoile(ctx, p.x, p.y, p.taille * 2.2, p.angle);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.taille, 0, Math.PI * 2);
        ctx.fill();
      }
      vivantes.push(p);
    }
    ctx.globalAlpha = 1;
    this.liste = vivantes;
    if (this.liste.length > 0 || this.poussiere) {
      this.raf = requestAnimationFrame(this.pas);
    } else {
      this.raf = 0;
      ctx.clearRect(0, 0, this.largeur, this.hauteur);
    }
  };
}

function dessinerEtoile(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const rayon = i % 2 === 0 ? r : r * 0.38;
    const a = angle + (i * Math.PI) / 4;
    ctx.lineTo(x + Math.cos(a) * rayon, y + Math.sin(a) * rayon);
  }
  ctx.closePath();
  ctx.fill();
}
