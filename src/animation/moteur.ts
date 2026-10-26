/*
 * **Le moteur de la scène d'attaque** (D-098) : deux `canvas`, une horloge, des particules.
 * Sans dépendance.
 * Deux canvas (derrière et devant les cartes), une horloge unique : ralenti, gel d'impact
 * (hit-stop) et tremblement s'appliquent à la fois aux particules et aux animations des cartes
 * (Web Animations API), qui échappent ainsi à la règle CSS globale « Mouvement réduit ».
 */

export type Couche = "fond" | "avant";

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Forme =
  | "point"
  | "trait"
  | "carre"
  | "papier"
  | "agrafe"
  | "enveloppe"
  | "postit"
  | "goutte"
  | "zzz"
  | "croix"
  | "flamme"
  | "etoile"
  | "tasse"
  | "carte"
  | "maillon"
  | "petale"
  | "dossier"
  | "texte";

export interface Particule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  frein: number;
  age: number;
  vie: number;
  taille: number;
  tailleFin: number;
  rot: number;
  vrot: number;
  couleur: string;
  forme: Forme;
  couche: Couche;
  additif: boolean;
  orienter: boolean;
  texte?: string;
}

export interface Effet {
  couche: Couche;
  debut: number;
  duree: number;
  additif?: boolean;
  dessiner(ctx: CanvasRenderingContext2D, p: number, t: number): void;
  maj?(t: number, dt: number): void;
}

export interface Etape {
  a: number;
  faire: () => void;
}

export interface Stats {
  duree: number;
  picParticules: number;
  picEffets: number;
  fpsMoyen: number;
  pireImage: number;
}

/** Budget de la recherche (sandbox, recherche-animations-attaque-cartes.md) : 300, 600 en finisher. */
const PLAFOND_PARTICULES = 600;

export function centre(r: Rect): Pt {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

export function bezier(a: Pt, c: Pt, b: Pt, p: number): Pt {
  const q = 1 - p;
  return {
    x: q * q * a.x + 2 * q * p * c.x + p * p * b.x,
    y: q * q * a.y + 2 * q * p * c.y + p * p * b.y,
  };
}

export const facilite = {
  sortie: (p: number) => 1 - (1 - p) ** 3,
  entree: (p: number) => p ** 3,
  entreeSortie: (p: number) =>
    p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2,
  rebond: (p: number) => {
    const c = 1.70158 * 1.525;
    return p < 0.5
      ? ((2 * p) ** 2 * ((c + 1) * 2 * p - c)) / 2
      : ((2 * p - 2) ** 2 * ((c + 1) * (p * 2 - 2) + c) + 2) / 2;
  },
  ressort: (p: number) => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2,
};

export function alea(graine: number): () => number {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hacher(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Moteur {
  readonly ctxFond: CanvasRenderingContext2D;
  readonly ctxAvant: CanvasRenderingContext2D;
  largeur = 0;
  hauteur = 0;
  /** Le temps de la chorégraphie, en ms, ralenti et gelé compris. */
  t = 0;
  vitesse = 1;
  private echelle = 1;
  private finRalenti = 0;
  private finGel = 0;
  private secousse = { force: 0, debut: 0, duree: 0 };
  private particules: Particule[] = [];
  private effets: Effet[] = [];
  private etapes: Etape[] = [];
  private animations: Animation[] = [];
  /** Les animations que le gel a suspendues : lui seul les reprend. */
  private suspendues = new Set<Animation>();
  /** Les éléments que le moteur anime : `arreter()` les rend à leur état naturel. */
  private elements = new Set<HTMLElement>();
  /** Le plafond de particules de la chorégraphie en cours (300, 600 en cinématique). */
  private plafond = 600;
  private taux = 1;
  private raf = 0;
  private dernier = 0;
  private images: number[] = [];
  private stats: Stats = {
    duree: 0,
    picParticules: 0,
    picEffets: 0,
    fpsMoyen: 0,
    pireImage: 0,
  };
  private fin = 0;
  surFin?: (stats: Stats) => void;

  constructor(
    private readonly fond: HTMLCanvasElement,
    private readonly avant: HTMLCanvasElement,
    private readonly scene: HTMLElement,
  ) {
    const a = fond.getContext("2d");
    const b = avant.getContext("2d");
    if (!a || !b) throw new Error("Canvas 2D indisponible");
    this.ctxFond = a;
    this.ctxAvant = b;
    this.redimensionner();
  }

  redimensionner() {
    const r = this.scene.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.largeur = r.width;
    this.hauteur = r.height;
    for (const c of [this.fond, this.avant]) {
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      c.style.width = `${r.width}px`;
      c.style.height = `${r.height}px`;
      c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /** Position d'un élément dans le repère de la scène (avant toute animation). */
  rect(el: HTMLElement): Rect {
    const s = this.scene.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
  }

  jouer(etapes: Etape[], duree: number, plafond = PLAFOND_PARTICULES) {
    this.arreter();
    this.plafond = plafond;
    this.redimensionner();
    this.t = 0;
    this.fin = duree;
    this.etapes = [...etapes].sort((x, y) => x.a - y.a);
    this.stats = {
      duree,
      picParticules: 0,
      picEffets: 0,
      fpsMoyen: 0,
      pireImage: 0,
    };
    this.images = [];
    this.dernier = performance.now();
    this.raf = requestAnimationFrame(this.boucle);
  }

  arreter() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const a of this.animations) a.cancel();
    this.animations = [];
    this.suspendues.clear();
    // Une animation annulée rend déjà l'élément à son état naturel ; ce retrait couvre le cas
    // d'une séquence interrompue au milieu et les styles qu'une ancienne version aurait laissés.
    for (const el of this.elements) {
      el.style.removeProperty("transform");
      el.style.removeProperty("opacity");
      el.style.pointerEvents = el.dataset.pointeurAvant ?? "";
      delete el.dataset.pointeurAvant;
    }
    this.elements.clear();
    this.particules = [];
    this.effets = [];
    this.etapes = [];
    this.echelle = 1;
    this.finGel = 0;
    this.finRalenti = 0;
    this.secousse = { force: 0, debut: 0, duree: 0 };
    this.scene.style.transform = "";
    this.ctxFond.clearRect(0, 0, this.largeur, this.hauteur);
    this.ctxAvant.clearRect(0, 0, this.largeur, this.hauteur);
  }

  // ---------- API des chorégraphies ----------

  emettre(
    p: Partial<Particule> & Pick<Particule, "x" | "y" | "forme" | "couleur">,
  ) {
    if (this.particules.length >= this.plafond) return;
    this.particules.push({
      vx: 0,
      vy: 0,
      ay: 0,
      frein: 0,
      age: 0,
      vie: 600,
      taille: 4,
      tailleFin: p.taille ?? 4,
      rot: 0,
      vrot: 0,
      couche: "avant",
      additif: false,
      orienter: false,
      ...p,
    });
  }

  gerbe(
    n: number,
    o: Pt,
    f: (i: number) => Partial<Particule> & Pick<Particule, "forme" | "couleur">,
  ) {
    for (let i = 0; i < n; i++) this.emettre({ x: o.x, y: o.y, ...f(i) });
  }

  effet(e: Omit<Effet, "debut"> & { debut?: number }) {
    this.effets.push({ ...e, debut: e.debut ?? this.t });
  }

  secouer(force: number, duree: number) {
    if (
      force <
      this.secousse.force *
        (1 - (this.t - this.secousse.debut) / this.secousse.duree)
    )
      return;
    this.secousse = { force, debut: this.t, duree };
  }

  geler(ms: number) {
    this.finGel = Math.max(this.finGel, performance.now() + ms / this.vitesse);
  }

  ralentir(facteur: number, ms: number) {
    this.echelle = facteur;
    this.finRalenti = this.t + ms;
  }

  /** Une animation de carte (WAAPI) dont la vitesse suit l'horloge du moteur. */
  animer(
    el: HTMLElement,
    images: Keyframe[],
    duree: number,
    easing = "ease-out",
  ) {
    const a = el.animate(images, { duration: duree, easing, fill: "both" });
    a.playbackRate = this.taux;
    // Pas de `commitStyles()` : il écrit la dernière image en style **en ligne**, que rien ne
    // retire ensuite — la carte resterait décalée. `fill: "both"` suffit pendant la séquence,
    // et `arreter()` annule l'animation, ce qui rend l'élément à son état naturel.
    a.onfinish = () => {
      el.style.removeProperty("transform");
      el.style.removeProperty("opacity");
    };
    // Une carte qui bouge ne doit pas capter un clic : la scène déplace ses cibles (D-098).
    if (!el.dataset.pointeurAvant) el.dataset.pointeurAvant = el.style.pointerEvents;
    el.style.pointerEvents = "none";
    this.animations.push(a);
    this.elements.add(el);
    return a;
  }

  // ---------- Boucle ----------

  private boucle = (maintenant: number) => {
    try {
      this.image(maintenant);
    } catch (erreur) {
      // Une étape qui lève ne doit pas laisser la scène figée avec sa secousse et ses canvas :
      // on rend l'écran propre, et on le dit dans la console plutôt que de le taire.
      console.error("Scène d'attaque interrompue", erreur);
      this.arreter();
      // Le composant doit retirer ce qu'il a posé pour la scène (la doublure du coup de grâce),
      // sinon elle resterait sur le plateau jusqu'à la Pression suivante.
      this.surFin?.(this.stats);
    }
  };

  private image(maintenant: number) {
    const brut = Math.min(Math.max(0, maintenant - this.dernier), 50);
    this.dernier = maintenant;
    this.images.push(brut);
    const gele = maintenant < this.finGel;
    if (this.t > this.finRalenti) this.echelle = 1;
    const taux = gele ? 0 : this.vitesse * this.echelle;
    if (taux !== this.taux) {
      this.taux = taux;
      for (const a of this.animations) {
        if (taux === 0) {
          // **Seules les animations en cours** sont suspendues : une animation déjà terminée
          // que l'on remet en `play()` repart de zéro (spec WAAPI), et la carte rejouerait son
          // anticipation pendant l'impact. Celles que le moteur suspend, il les reprend.
          if (a.playState === "running") {
            a.pause();
            this.suspendues.add(a);
          }
        } else {
          a.playbackRate = taux;
          if (this.suspendues.has(a)) {
            this.suspendues.delete(a);
            a.play();
          }
        }
      }
    }
    const dt = brut * taux;
    this.t += dt;

    while (this.etapes.length && this.etapes[0].a <= this.t)
      this.etapes.shift()?.faire();

    this.majParticules(dt);
    this.dessiner();
    this.appliquerSecousse();

    this.stats.picParticules = Math.max(
      this.stats.picParticules,
      this.particules.length,
    );
    this.stats.picEffets = Math.max(this.stats.picEffets, this.effets.length);

    const fini =
      this.t >= this.fin && !this.particules.length && !this.etapes.length;
    if (fini) {
      const n = this.images.length;
      const somme = this.images.reduce((s, x) => s + x, 0);
      this.stats.fpsMoyen = n ? Math.round(1000 / (somme / n)) : 0;
      this.stats.pireImage = Math.round(Math.max(0, ...this.images.slice(1)));
      this.scene.style.transform = "";
      this.effets = [];
      // **Les animations de carte sont annulées, pas seulement terminées** : avec
      // `fill: "both"`, une animation finie continue d'appliquer sa dernière image — la carte
      // resterait sur la pose de son anticipation. `cancel()` la rend à son état naturel.
      for (const a of this.animations) a.cancel();
      this.animations = [];
      this.suspendues.clear();
      for (const el of this.elements) {
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
        el.style.pointerEvents = el.dataset.pointeurAvant ?? "";
        delete el.dataset.pointeurAvant;
      }
      this.elements.clear();
      this.ctxFond.clearRect(0, 0, this.largeur, this.hauteur);
      this.ctxAvant.clearRect(0, 0, this.largeur, this.hauteur);
      this.raf = 0;
      this.surFin?.(this.stats);
      return;
    }
    this.raf = requestAnimationFrame(this.boucle);
  }

  private majParticules(dt: number) {
    const s = dt / 1000;
    for (const p of this.particules) {
      p.age += dt;
      p.vy += p.ay * s;
      const k = Math.max(0, 1 - p.frein * s);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.rot += p.vrot * s;
    }
    this.particules = this.particules.filter((p) => p.age < p.vie);
    // **`dt === 0` pendant le gel** : sans ce filtre, chaque image gelée rappellerait `maj`, et
    // les émetteurs par image verseraient des particules identiques (même tranche, même graine).
    if (dt > 0) for (const e of this.effets) e.maj?.(this.t, dt);
    this.effets = this.effets.filter((e) => this.t < e.debut + e.duree);
  }

  private dessiner() {
    for (const [ctx, couche] of [
      [this.ctxFond, "fond"],
      [this.ctxAvant, "avant"],
    ] as const) {
      ctx.clearRect(0, 0, this.largeur, this.hauteur);
      for (const e of this.effets) {
        if (e.couche !== couche || this.t < e.debut) continue;
        ctx.save();
        ctx.globalCompositeOperation = e.additif ? "lighter" : "source-over";
        e.dessiner(ctx, Math.min(1, (this.t - e.debut) / e.duree), this.t);
        ctx.restore();
      }
      for (const p of this.particules) {
        if (p.couche !== couche) continue;
        dessinerParticule(ctx, p);
      }
    }
  }

  private appliquerSecousse() {
    const { force, debut, duree } = this.secousse;
    const p = duree ? (this.t - debut) / duree : 1;
    if (p >= 1 || force === 0) {
      if (this.scene.style.transform) this.scene.style.transform = "";
      return;
    }
    const f = force * (1 - p) ** 2;
    const x = Math.sin(this.t * 0.09) * f;
    const y = Math.cos(this.t * 0.113) * f * 0.8;
    this.scene.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
  }
}

function dessinerParticule(ctx: CanvasRenderingContext2D, p: Particule) {
  const v = p.age / p.vie;
  const alpha = v < 0.15 ? v / 0.15 : 1 - Math.max(0, (v - 0.5) / 0.5);
  const taille = lerp(p.taille, p.tailleFin, v);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.globalCompositeOperation = p.additif ? "lighter" : "source-over";
  ctx.translate(p.x, p.y);
  ctx.rotate(p.orienter ? Math.atan2(p.vy, p.vx) : p.rot);
  ctx.fillStyle = p.couleur;
  ctx.strokeStyle = p.couleur;
  const s = taille;
  switch (p.forme) {
    case "point":
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "trait":
      ctx.lineWidth = Math.max(1, s / 3);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-s * 2, 0);
      ctx.lineTo(s * 2, 0);
      ctx.stroke();
      break;
    case "carre":
      ctx.fillRect(-s / 2, -s / 2, s, s);
      break;
    case "papier":
      ctx.beginPath();
      ctx.moveTo(s * 1.4, 0);
      ctx.lineTo(-s, -s * 0.8);
      ctx.lineTo(-s * 0.5, 0);
      ctx.lineTo(-s, s * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s * 1.4, 0);
      ctx.lineTo(-s * 0.5, 0);
      ctx.stroke();
      break;
    case "agrafe":
      ctx.lineWidth = Math.max(1.5, s / 4);
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.5);
      ctx.lineTo(-s, -s * 0.3);
      ctx.lineTo(s, -s * 0.3);
      ctx.lineTo(s, s * 0.5);
      ctx.stroke();
      break;
    case "enveloppe":
      ctx.fillRect(-s, -s * 0.65, s * 2, s * 1.3);
      ctx.strokeStyle = "rgba(0,0,0,.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.65);
      ctx.lineTo(0, s * 0.15);
      ctx.lineTo(s, -s * 0.65);
      ctx.stroke();
      break;
    case "postit":
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.fillRect(-s, -s, s * 2, s * 0.45);
      break;
    case "dossier":
      ctx.fillRect(-s * 1.2, -s * 0.8, s * 2.4, s * 1.6);
      ctx.fillRect(-s * 1.2, -s * 1.05, s * 0.9, s * 0.3);
      ctx.fillStyle = "rgba(255,255,255,.7)";
      ctx.fillRect(-s * 0.9, -s * 0.5, s * 1.8, s * 0.12);
      break;
    case "goutte":
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.4, s * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "zzz":
    case "texte":
      ctx.font = `800 ${Math.round(s * 3)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.texte ?? "z", 0, 0);
      break;
    case "croix":
      ctx.fillRect(-s * 0.3, -s, s * 0.6, s * 2);
      ctx.fillRect(-s, -s * 0.3, s * 2, s * 0.6);
      break;
    case "flamme":
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.6);
      ctx.quadraticCurveTo(s, 0, 0, s);
      ctx.quadraticCurveTo(-s, 0, 0, -s * 1.6);
      ctx.fill();
      break;
    case "etoile": {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? s * 0.35 : s;
        const a = (i * Math.PI) / 4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "tasse":
      ctx.fillRect(-s * 0.7, -s * 0.6, s * 1.4, s * 1.3);
      ctx.lineWidth = Math.max(1.5, s / 4);
      ctx.beginPath();
      ctx.arc(s * 0.8, 0, s * 0.4, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      break;
    case "carte":
      ctx.fillRect(-s * 0.7, -s, s * 1.4, s * 2);
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-s * 0.7, -s, s * 1.4, s * 2);
      break;
    case "maillon":
      ctx.lineWidth = Math.max(2, s / 3);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.2, s * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "petale":
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

// ---------- Effets réutilisables ----------

export function onde(
  m: Moteur,
  o: Pt,
  rayon: number,
  couleur: string,
  duree = 420,
  epaisseur = 8,
) {
  m.effet({
    couche: "avant",
    duree,
    additif: true,
    dessiner(ctx, p) {
      const e = facilite.sortie(p);
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = couleur;
      ctx.lineWidth = Math.max(0.5, epaisseur * (1 - p));
      ctx.beginPath();
      ctx.arc(o.x, o.y, rayon * e, 0, Math.PI * 2);
      ctx.stroke();
    },
  });
}

export function eclatCarte(
  m: Moteur,
  r: Rect,
  couleur = "#ffffff",
  duree = 220,
) {
  m.effet({
    couche: "avant",
    duree,
    additif: true,
    dessiner(ctx, p) {
      ctx.globalAlpha = (1 - p) * 0.85;
      ctx.fillStyle = couleur;
      arrondi(ctx, r.x, r.y, r.w, r.h, 10);
      ctx.fill();
    },
  });
}

export function arrondi(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function chiffre(
  m: Moteur,
  o: Pt,
  texte: string,
  couleur: string,
  grand = false,
) {
  const taille = grand ? 56 : 40;
  m.effet({
    couche: "avant",
    duree: 900,
    dessiner(ctx, p) {
      const pop = p < 0.18 ? facilite.ressort(p / 0.18) : 1;
      const montee = p < 0.35 ? 0 : facilite.sortie((p - 0.35) / 0.65) * 34;
      ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      ctx.translate(o.x, o.y - montee);
      ctx.scale(lerp(1.6, 1, Math.min(1, pop)), lerp(1.6, 1, Math.min(1, pop)));
      ctx.font = `900 ${taille}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#140d05";
      ctx.strokeText(texte, 0, 0);
      ctx.fillStyle = couleur;
      ctx.fillText(texte, 0, 0);
    },
  });
}

export function eclair(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  rnd: () => number,
  couleur: string,
  ampleur = 18,
) {
  const n = 9;
  const pts: Pt[] = [a];
  for (let i = 1; i < n; i++) {
    const p = i / n;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = (rnd() - 0.5) * 2 * ampleur;
    pts.push({
      x: a.x + dx * p + (-dy / len) * off,
      y: a.y + dy * p + (dx / len) * off,
    });
  }
  pts.push(b);
  for (const [w, al, c] of [
    [9, 0.25, couleur],
    [3, 1, "#ffffff"],
  ] as const) {
    ctx.globalAlpha = al;
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
  }
}
