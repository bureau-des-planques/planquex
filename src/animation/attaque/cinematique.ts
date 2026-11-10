import { arrondi, facilite, lerp, onde } from '../moteur';
import type { Etape, Rect } from '../moteur';
import type { Ctx } from './ctx';

// ---------- E : la cinématique légendaire ----------

/**
 * Le voile, le fond et le bandeau d'une cinématique. Elle dure `PRELUDE_COMEX` ms avant que la
 * Pression ne parte (`PRELUDE_AUTRE` pour une Couronne ou un 3 étoiles, sans conseil à jouer).
 *
 * **Le COMEX moque le cérémonial** : l'ordre du jour s'affiche, sept silhouettes sans visage lèvent
 * la main l'une après l'autre sur une courbe qui monte, puis le tampon « adopté à l'unanimité »
 * tombe — et seulement alors, la Pression part. Une salle de conseil sans personne en particulier :
 * la satire vise le système, jamais quelqu'un.
 *
 * Un geste principal par temps : le bandeau (0–1,2 s), la salle (0,5–1,1 s), le tampon (1,1–1,7 s),
 * la cible éclairée (dès 1,15 s). La carte de l'attaquant est toujours **au centre**, du côté
 * opposé à sa cible, pour que celle-ci reste visible.
 */
export const PRELUDE_COMEX = 1250;
export const PRELUDE_AUTRE = 1000;
/** Les sept sièges du conseil : l'unanimité est un chiffre, pas une personne. */
export const SIEGES = 7;

/** Le plateau privé de la carte de l'attaquant : le décor passe derrière elle, jamais dessus. */
export function sauf(ctx: CanvasRenderingContext2D, W: number, H: number, r: Rect) {
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.roundRect(r.x, r.y, r.w, r.h, 12);
  ctx.clip('evenodd');
}

/**
 * Une silhouette du conseil : un buste sans visage au-dessus de la table, un bras qui se lève
 * (`levee` de 0 à 1). Toujours à l'endroit, que la salle soit en haut ou en bas du plateau.
 */
export function silhouette(ctx: CanvasRenderingContext2D, cx: number, yTable: number, levee: number) {
  const tete = yTable - 30;
  ctx.fillStyle = '#cfd6e4';
  ctx.strokeStyle = '#cfd6e4';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, tete, 9, 0, Math.PI * 2);
  ctx.fill();
  arrondi(ctx, cx - 17, tete + 11, 34, 24, 8);
  ctx.fill();
  if (levee > 0) {
    const epaule = tete + 15;
    const long = 38 * levee;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx + 15, epaule);
    ctx.lineTo(cx + 20, epaule - long);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 20, epaule - (long + 3), 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** La taille de police qui fait tenir `texte` dans `largeur`, sans dépasser `max`. */
export function ajuster(
  ctx: CanvasRenderingContext2D,
  texte: string,
  max: number,
  largeur: number,
  poids = 900
): number {
  ctx.font = `${poids} ${max}px system-ui, sans-serif`;
  const w = ctx.measureText(texte).width;
  return w > largeur ? Math.floor((max * largeur) / w) : max;
}

export function prelude(x0: Ctx, e: Etape[], comex: boolean): number {
  const x = { ...x0 };
  const m = x.m;
  const T0 = comex ? PRELUDE_COMEX : PRELUDE_AUTRE;
  // -1 : la cible est au-dessus de l'attaquant (c'est le cas de mon Poste). On place l'attaquant
  // au centre, du côté opposé : sa cible reste entièrement visible, et le bandeau tombe de son côté.
  const dir = x.c.y < x.a.y ? -1 : 1;
  const centreY = m.hauteur * (dir < 0 ? 0.65 : 0.35);
  const dx = m.largeur / 2 - x.a.x;
  const dy = centreY - x.a.y;
  const s = 1.3;
  x0.base = `translate(${dx}px, ${dy - 6}px) scale(${s})`;
  x0.a = { x: x.a.x + dx, y: x.a.y + dy - 6 };
  x0.A = {
    x: x0.a.x - (x.A.w * s) / 2,
    y: x0.a.y - (x.A.h * s) / 2,
    w: x.A.w * s,
    h: x.A.h * s
  };
  const o = x0.a;
  const carte = x0.A;
  const cible = x.C;
  const yBandeau = m.hauteur * (dir < 0 ? 0.13 : 0.87);
  // La salle est du côté de l'attaquant : la table est au bord du plateau, derrière sa carte.
  const yTable = dir < 0 ? m.hauteur - 36 : 86;

  e.push({
    a: 0,
    faire: () => {
      // Le voile : le plateau s'assombrit, l'attaquant reste éclairé. Dès que la Pression va partir,
      // un second trou de lumière s'ouvre sur la cible — c'est elle qu'il faut regarder.
      m.effet({
        couche: 'avant',
        duree: 99999,
        dessiner(ctx, _p, temps) {
          const montee = Math.min(1, temps / 300);
          const g = ctx.createRadialGradient(o.x, o.y, x.A.w * 0.7, o.x, o.y, Math.max(m.largeur, m.hauteur));
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(0.25, `rgba(5,8,14,${0.72 * montee})`);
          g.addColorStop(1, `rgba(5,8,14,${0.82 * montee})`);
          ctx.globalAlpha = alphaVoile(temps);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, m.largeur, m.hauteur);
          const feu = Math.max(0, Math.min(1, (temps - (T0 - 120)) / 260));
          if (feu > 0) {
            const t = ctx.createRadialGradient(x.c.x, x.c.y, cible.w * 0.3, x.c.x, x.c.y, cible.w * 1.5);
            t.addColorStop(0, 'rgba(0,0,0,1)');
            t.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = feu * alphaVoile(temps);
            ctx.fillStyle = t;
            ctx.fillRect(x.c.x - cible.w * 1.6, x.c.y - cible.h * 1.1, cible.w * 3.2, cible.h * 2.2);
          }
        }
      });

      if (comex) {
        // La salle de conseil : courbe qui monte, barres, sept sièges, table. Derrière la carte.
        m.effet({
          couche: 'avant',
          duree: 99999,
          dessiner(ctx, _p, temps) {
            const voileA = alphaVoile(temps);
            if (voileA <= 0) return;
            const W = m.largeur;
            const H = m.hauteur;
            ctx.save();
            sauf(ctx, W, H, carte);
            const xs = Array.from({ length: SIEGES }, (_, i) => 38 + (i * (W - 76)) / (SIEGES - 1));
            const base = H * (dir < 0 ? 0.74 : 0.4);
            const pousse = Math.min(1, Math.max(0, (temps - 250) / 800));
            // Après le tampon, le décor se retire : la Pression est seule à l'écran.
            const calme = temps > T0 ? 0.5 : 1;
            // Les barres, qui montent avec l'ordre du jour…
            ctx.globalAlpha = 0.34 * voileA * calme;
            ctx.fillStyle = '#46c78c';
            xs.forEach((px, i) => {
              const h = (14 + i * 13) * pousse;
              ctx.fillRect(px - 11, base - h, 22, h);
            });
            // …et la courbe, qui monte plus vite qu'elles.
            ctx.globalAlpha = 0.85 * voileA * calme;
            ctx.strokeStyle = '#f7e264';
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            const n = Math.floor(pousse * (SIEGES - 1));
            const pts = xs.map((px, i) => ({
              x: px,
              y: base - (22 + i * 17) * (i % 2 ? 1 : 0.85)
            }));
            pts.slice(0, n + 2).forEach((q, i) => {
              const f = i === n + 1 ? pousse * (SIEGES - 1) - n : 1;
              const prev = pts[Math.max(0, i - 1)];
              const px = i === n + 1 ? lerp(prev.x, q.x, f) : q.x;
              const py = i === n + 1 ? lerp(prev.y, q.y, f) : q.y;
              if (i) ctx.lineTo(px, py);
              else ctx.moveTo(px, py);
            });
            ctx.stroke();
            ctx.fillStyle = '#f7e264';
            pts.slice(0, n + 1).forEach((q) => {
              ctx.beginPath();
              ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.restore();

            // Le conseil, sur un fond uni : sans lui, le Banc passait entre les silhouettes.
            // Les mains se lèvent à la queue leu leu, puis sautent ensemble au tampon.
            ctx.save();
            sauf(ctx, W, H, carte);
            ctx.globalAlpha = voileA * calme;
            ctx.fillStyle = '#0a1018';
            ctx.fillRect(0, yTable - 78, W, 96);
            ctx.globalAlpha = 0.95 * voileA * calme;
            const claque = Math.max(0, 1 - Math.abs(temps - (T0 - 130)) / 160);
            xs.forEach((px, i) => {
              const depart = 520 + i * 70;
              const levee = facilite.sortie(Math.min(1, Math.max(0, (temps - depart) / 160)));
              silhouette(ctx, px, yTable - claque * 6, levee);
            });
            // La table, devant eux.
            ctx.fillStyle = '#5a3d24';
            arrondi(ctx, 12, yTable, W - 24, 14, 5);
            ctx.fill();
            ctx.fillStyle = '#8a6038';
            ctx.fillRect(16, yTable, W - 32, 3);
            ctx.restore();
          }
        });
      } else {
        m.effet({
          couche: 'fond',
          duree: 99999,
          additif: true,
          dessiner(ctx, _p, temps) {
            ctx.globalAlpha = Math.min(1, temps / 400) * 0.55 * alphaVoile(temps);
            ctx.translate(o.x, o.y);
            ctx.rotate(temps / 1400);
            for (let i = 0; i < 12; i++) {
              ctx.rotate(Math.PI / 6);
              const g = ctx.createLinearGradient(0, 0, 0, -m.hauteur * 0.7);
              g.addColorStop(0, '#f7e264');
              g.addColorStop(1, 'transparent');
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(-22, -m.hauteur * 0.7);
              ctx.lineTo(22, -m.hauteur * 0.7);
              ctx.fill();
            }
          }
        });
      }
      m.animer(
        x.att,
        [
          { transform: 'none', zIndex: '6' },
          {
            transform: `translate(${dx}px, ${dy}px) scale(1.28) rotateY(0deg)`,
            zIndex: '6',
            offset: 0.55
          },
          { transform: `translate(${dx}px, ${dy - 6}px) scale(1.3)`, zIndex: '6' }
        ],
        620,
        'cubic-bezier(.2,.8,.2,1)'
      );
    }
  });

  e.push({
    a: 380,
    faire: () => {
      for (let i = 0; i < 70; i++) {
        const ang = x.rnd() * Math.PI * 2;
        const r = 120 + x.rnd() * 120;
        m.emettre({
          x: o.x + Math.cos(ang) * r,
          y: o.y + Math.sin(ang) * r,
          vx: -Math.cos(ang) * r * 1.9,
          vy: -Math.sin(ang) * r * 1.9,
          forme: 'point',
          couleur: x.rnd() > 0.4 ? '#f7e264' : '#ffffff',
          vie: 520,
          taille: 2.6,
          tailleFin: 0.6,
          additif: true
        });
      }
    }
  });

  // Le bandeau : l'ordre du jour, au nom de la Pression.
  e.push({
    a: comex ? 180 : 380,
    faire: () => {
      const titre = comex ? 'COMEX · SÉANCE EXTRAORDINAIRE' : x.carte.rarity === 'COU' ? 'COURONNE' : '★ ★ ★';
      const nom = x.attaque.name.toUpperCase();
      // Le bandeau cède la place au tampon (T0 − 140) : il s'efface juste avant lui.
      const duree = comex ? PRELUDE_COMEX - 180 - 60 : 1000;
      m.effet({
        couche: 'avant',
        duree,
        dessiner(ctx, p) {
          const entree = facilite.sortie(Math.min(1, (p * duree) / 260));
          const sortie = p > 0.78 ? (p - 0.78) / 0.22 : 0;
          const W = m.largeur;
          const y = yBandeau;
          ctx.globalAlpha = 1 - sortie;
          ctx.fillStyle = 'rgba(10,8,4,.86)';
          ctx.fillRect(0, y - 38, W * entree, 76);
          ctx.fillStyle = '#f7e264';
          ctx.fillRect(0, y - 38, W * entree, 3);
          ctx.fillRect(W * (1 - entree), y + 35, W, 3);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const xx = lerp(-W * 0.3, W / 2, entree) + p * 12;
          ctx.font = '800 13px system-ui, sans-serif';
          ctx.fillStyle = '#f7e264';
          ctx.fillText(titre, xx, y - 20);
          const px = ajuster(ctx, nom, 30, W - 28);
          ctx.font = `900 ${px}px system-ui, sans-serif`;
          ctx.lineJoin = 'round';
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#140d05';
          ctx.strokeText(nom, xx, y + 8);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(nom, xx, y + 8);
        }
      });
    }
  });

  if (comex) {
    // Le tampon de l'unanimité, sur l'ordre du jour : le seul « geste » de la séance.
    e.push({
      a: T0 - 140,
      faire: () => {
        m.geler(60);
        m.secouer(6, 240);
        const duree = 600;
        m.effet({
          couche: 'avant',
          duree,
          dessiner(ctx, p) {
            const pose = p < 0.22 ? facilite.sortie(p / 0.22) : 1;
            ctx.globalAlpha = (p > 0.7 ? (1 - p) / 0.3 : 1) * Math.min(1, p * 12);
            const W = m.largeur;
            const texte = 'ADOPTÉ À L’UNANIMITÉ';
            const px = ajuster(ctx, texte, 24, W - 70);
            ctx.font = `900 ${px}px system-ui, sans-serif`;
            const w = ctx.measureText(texte).width + 30;
            const h = px + 22;
            ctx.translate(W / 2, yBandeau + dir * 2);
            ctx.rotate(-0.07);
            ctx.scale(lerp(2.2, 1, pose), lerp(2.2, 1, pose));
            ctx.fillStyle = 'rgba(250,244,230,.94)';
            arrondi(ctx, -w / 2, -h / 2, w, h, 6);
            ctx.fill();
            ctx.strokeStyle = '#1f8f5c';
            ctx.lineWidth = 4;
            arrondi(ctx, -w / 2, -h / 2, w, h, 6);
            ctx.stroke();
            ctx.lineWidth = 1.5;
            arrondi(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 3);
            ctx.stroke();
            ctx.fillStyle = '#1f8f5c';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(texte, 0, 1);
          }
        });
      }
    });
  }
  return T0;
}

/**
 * Le voile d'une cinématique : il monte en 300 ms, reste, puis retombe en 340 ms au retour.
 * Il se calcule **du temps de la chorégraphie** — un compteur décrémenté par image donnerait un
 * voile différent à 30 et à 144 Hz, et le laisserait à mi-course si la scène s'arrêtait.
 */
export const voile = { monteeMs: 300, retourMs: 340, debutRetour: Number.POSITIVE_INFINITY };

export function alphaVoile(temps: number): number {
  if (temps < voile.monteeMs) return temps / voile.monteeMs;
  const depuis = temps - voile.debutRetour;
  if (depuis <= 0) return 1;
  return Math.max(0, 1 - depuis / voile.retourMs);
}

export function impactLegendaire(x: Ctx) {
  const m = x.m;
  m.geler(100);
  m.secouer(18, 600);
  m.effet({
    couche: 'avant',
    duree: 260,
    additif: true,
    dessiner(ctx, p) {
      ctx.globalAlpha = (1 - p) * 0.42;
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(0, 0, m.largeur, m.hauteur);
    }
  });
  onde(m, x.c, 240, '#f7e264', 600, 14);
  onde(m, x.c, 160, '#ffffff', 420, 6);
  m.gerbe(80, x.c, () => {
    const ang = x.rnd() * Math.PI * 2;
    const v = 200 + x.rnd() * 520;
    return {
      forme: 'etoile',
      couleur: x.rnd() > 0.35 ? '#f7e264' : '#ffffff',
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      ay: 300,
      frein: 2,
      vie: 900 + x.rnd() * 400,
      taille: 4 + x.rnd() * 5,
      tailleFin: 1,
      vrot: 8,
      additif: true
    };
  });
}

export function retourCinematique(x: Ctx) {
  const m = x.m;
  m.animer(
    x.att,
    [
      { transform: x.base, zIndex: '6' },
      { transform: 'none', zIndex: '6' }
    ],
    340,
    'cubic-bezier(.4,0,.2,1)'
  );
  voile.debutRetour = m.t;
}

export function preparerVoile() {
  voile.debutRetour = Number.POSITIVE_INFINITY;
}
