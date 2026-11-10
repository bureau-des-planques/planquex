import { facilite, lerp, onde } from '../../moteur';
import type { Pt } from '../../moteur';
import type { CleD } from '../attribution';
import { bas, haut, projectile } from '../generique';
import type { CtxMotif, Motif } from './types';

const motifAvion: Motif = {
  voyage: 520,
  lancer({ x, m, r, de, vers, voyage }: CtxMotif) {
    projectile(x, {
      de,
      vers,
      duree: voyage,
      courbe: 140 * (r() > 0.5 ? 1 : -1),
      facilite: facilite.entreeSortie,
      dessin(ctx, pos, ang) {
        ctx.translate(pos.x, pos.y);
        ctx.rotate(ang);
        ctx.fillStyle = '#f4f1e8';
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-16, -14);
        ctx.lineTo(-8, 0);
        ctx.lineTo(-16, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-8, 0);
        ctx.stroke();
      },
      trainee: (pos) =>
        m.emettre({
          x: pos.x,
          y: pos.y,
          forme: 'point',
          couleur: 'rgba(255,255,255,.7)',
          vie: 300,
          taille: 2,
          tailleFin: 0.5
        })
    });
  },
  impact({ x, m, r, cle }: CtxMotif) {
    m.gerbe(cle === 'dossiers' ? 30 : 18, x.c, () => ({
      forme: 'carre',
      couleur: '#f4f1e8',
      vx: (r() - 0.5) * 420,
      vy: -100 - r() * 300,
      ay: 700,
      frein: 1.5,
      vie: 900,
      taille: 6 + r() * 6,
      vrot: (r() - 0.5) * 14
    }));
  }
};

const motifGraphe: Motif = {
  voyage: 520,
  lancer({ x, m, t, de, vers, voyage, cinematique }: CtxMotif) {
    const pts: Pt[] = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const p = i / n;
      pts.push({
        x: lerp(de.x - 50, vers.x, p) + (i % 2 ? 22 : -22) * (1 - p),
        y: lerp(de.y, vers.y, p) + (i % 2 ? 18 : 0)
      });
    }
    pts[n] = vers;
    m.effet({
      couche: 'avant',
      duree: voyage + 300,
      dessiner(ctx, p) {
        const q = Math.min(1, p * ((voyage + 300) / voyage));
        const k = q * n;
        ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
        ctx.lineJoin = 'round';
        // Dans une cinématique la flèche se voit de la salle : plus épaisse, plus grande.
        const gros = cinematique ? 1.7 : 1;
        for (const [w, c] of [
          [12 * gros, 'rgba(70,199,140,.35)'],
          [5 * gros, '#46c78c']
        ] as const) {
          ctx.strokeStyle = c;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i <= Math.floor(k); i++) ctx.lineTo(pts[i].x, pts[i].y);
          const i = Math.floor(k);
          if (i < n) ctx.lineTo(lerp(pts[i].x, pts[i + 1].x, k - i), lerp(pts[i].y, pts[i + 1].y, k - i));
          ctx.stroke();
        }
        const i = Math.min(n - 1, Math.floor(k));
        const bout = {
          x: lerp(pts[i].x, pts[i + 1].x, Math.min(1, k - i)),
          y: lerp(pts[i].y, pts[i + 1].y, Math.min(1, k - i))
        };
        const ang = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
        ctx.translate(bout.x, bout.y);
        ctx.rotate(ang);
        ctx.fillStyle = '#46c78c';
        ctx.beginPath();
        ctx.moveTo(16 * gros, 0);
        ctx.lineTo(-6 * gros, -11 * gros);
        ctx.lineTo(-6 * gros, 11 * gros);
        ctx.fill();
      }
    });
    for (let b = 0; b < 4; b++) {
      m.effet({
        couche: 'fond',
        debut: t + b * 60,
        duree: voyage + 200,
        dessiner(ctx, p) {
          const h = facilite.ressort(Math.min(1, p * 2.5)) * (20 + b * 14);
          ctx.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 0.85;
          ctx.fillStyle = b === 3 ? '#46c78c' : '#5b6472';
          ctx.fillRect(x.A.x + x.A.w + 8 + b * 12, x.A.y + x.A.h * 0.6 - h, 9, h);
        }
      });
    }
  },
  impact({ x, m, r, cinematique }: CtxMotif) {
    m.gerbe(cinematique ? 5 : 12, x.c, () => ({
      forme: 'texte',
      texte: r() > 0.5 ? '%' : '€',
      couleur: '#46c78c',
      vx: (r() - 0.5) * 300,
      vy: -120 - r() * 200,
      ay: 400,
      vie: 800,
      taille: 6
    }));
  }
};

const motifCafe: Motif = {
  voyage: 460,
  lancer({ x, m, r, de, vers, voyage }: CtxMotif) {
    projectile(x, {
      de,
      vers,
      duree: voyage,
      courbe: -120,
      dessin(ctx, pos) {
        ctx.fillStyle = '#5a3415';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath();
        ctx.arc(pos.x - 4, pos.y - 4, 4, 0, Math.PI * 2);
        ctx.fill();
      },
      trainee: (pos) =>
        m.emettre({
          x: pos.x,
          y: pos.y,
          vx: (r() - 0.5) * 60,
          vy: 40,
          ay: 900,
          forme: 'goutte',
          couleur: '#6b3e1a',
          vie: 420,
          taille: 3,
          tailleFin: 2
        })
    });
    m.gerbe(6, haut(x), () => ({
      forme: 'point',
      couleur: 'rgba(255,255,255,.5)',
      vx: (r() - 0.5) * 30,
      vy: -60,
      vie: 700,
      taille: 6,
      tailleFin: 14
    }));
  },
  impact({ x, m, r }: CtxMotif) {
    m.gerbe(36, bas(x), () => {
      const ang = -Math.PI * r();
      const v = 150 + r() * 330;
      return {
        forme: 'goutte',
        couleur: r() > 0.3 ? '#5a3415' : '#8a5a2b',
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        ay: 1300,
        vie: 800,
        taille: 3 + r() * 3,
        tailleFin: 2,
        orienter: true
      };
    });
  }
};

const motifChrono: Motif = {
  voyage: 560,
  lancer({ x, m, voyage }: CtxMotif) {
    m.effet({
      couche: 'avant',
      duree: voyage,
      dessiner(ctx, p) {
        const s = facilite.ressort(Math.min(1, p * 3));
        ctx.translate(x.c.x, x.c.y);
        ctx.scale(s, s);
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = '#f4e6cc';
        ctx.strokeStyle = '#241a0c';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 6);
          ctx.fillStyle = '#241a0c';
          ctx.fillRect(-1.5, -42, 3, 8);
          ctx.restore();
        }
        const tours = facilite.entree(p) * 14;
        ctx.save();
        ctx.rotate(tours * Math.PI * 2);
        ctx.fillStyle = '#e0563f';
        ctx.fillRect(-2, -38, 4, 38);
        ctx.restore();
        ctx.rotate((tours / 12) * Math.PI * 2);
        ctx.fillStyle = '#241a0c';
        ctx.fillRect(-3, -26, 6, 26);
      }
    });
  },
  impact({ x, m, r }: CtxMotif) {
    m.gerbe(22, x.c, () => {
      const ang = r() * Math.PI * 2;
      const v = 160 + r() * 280;
      return {
        forme: 'carre',
        couleur: r() > 0.5 ? '#f4e6cc' : '#241a0c',
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        ay: 500,
        vie: 800,
        taille: 5 + r() * 5,
        vrot: (r() - 0.5) * 16
      };
    });
  }
};

const motifLaser: Motif = {
  voyage: 520,
  lancer({ x, m, de, vers, voyage }: CtxMotif) {
    m.effet({
      couche: 'avant',
      duree: voyage + 100,
      additif: true,
      dessiner(ctx, p, temps) {
        const cal = Math.max(0, 1 - p * 1.4);
        const point = {
          x: vers.x + Math.sin(temps / 60) * 60 * cal,
          y: x.c.y + Math.cos(temps / 47) * 50 * cal
        };
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(de.x, de.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        const g = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 14);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, '#ff3b30');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(point.x - 14, point.y - 14, 28, 28);
      }
    });
  },
  impact({ x, m, r }: CtxMotif) {
    m.gerbe(16, bas(x), () => ({
      forme: 'point',
      couleur: r() > 0.5 ? '#ff3b30' : '#ffd1cc',
      vx: (r() - 0.5) * 300,
      vy: -60 - r() * 200,
      ay: 600,
      vie: 500,
      taille: 2.5,
      additif: true
    }));
    onde(m, bas(x), 50, '#ff3b30', 300, 5);
  }
};

export const BUREAU = {
  avion: motifAvion,
  graphe: motifGraphe,
  cafe: motifCafe,
  chrono: motifChrono,
  laser: motifLaser
} satisfies Partial<Record<CleD, Motif>>;
