import { arrondi, facilite, hacher, lerp } from '../../moteur';
import type { CleD } from '../attribution';
import { projectile } from '../generique';
import type { CtxMotif, Motif } from './types';

/** Les mots que le tampon imprime (le motif `tampon`). */
const MOTS_TAMPON = ['NON CONFORME', 'VALIDÉ', 'À REVOIR', 'URGENT', 'VU', 'REFUSÉ'];

const motifTampon: Motif = {
  voyage: 420,
  lancer({ x, m, voyage }: CtxMotif) {
    m.effet({
      couche: 'avant',
      duree: voyage,
      dessiner(ctx, p) {
        const q = facilite.entree(p);
        const y = lerp(x.C.y - 160, x.c.y - 10, q);
        const s = lerp(1.6, 1, q);
        ctx.translate(x.c.x, y);
        ctx.scale(s, s);
        ctx.fillStyle = '#5a2a1a';
        arrondi(ctx, -14, -70, 28, 50, 8);
        ctx.fill();
        ctx.fillStyle = '#3a1d12';
        arrondi(ctx, -46, -24, 92, 26, 5);
        ctx.fill();
        ctx.fillStyle = '#b3261e';
        ctx.fillRect(-42, 0, 84, 6);
      }
    });
  },
  impact({ x, m, r, de }: CtxMotif) {
    const mot = MOTS_TAMPON[hacher(x.attaque.name) % MOTS_TAMPON.length];
    m.secouer(9, 260);
    // Au coup de grâce, le tampon du motif cède la place à celui de la sortie : deux tampons
    // rouges au même endroit, penchés pareil, ne se liraient ni l'un ni l'autre.
    if (!x.coupDeGrace) {
      m.effet({
        couche: 'avant',
        duree: 1100,
        dessiner(ctx, p) {
          ctx.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 0.92;
          ctx.translate(x.c.x, x.c.y);
          ctx.rotate(-0.22);
          ctx.strokeStyle = '#d0352b';
          ctx.lineWidth = 4;
          ctx.strokeRect(-x.C.w * 0.46, -20, x.C.w * 0.92, 40);
          ctx.fillStyle = '#d0352b';
          ctx.font = `900 ${mot.length > 8 ? 15 : 22}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(mot, 0, 1);
        }
      });
    }
    m.gerbe(14, x.c, () => ({
      forme: 'goutte',
      couleur: '#b3261e',
      vx: (r() - 0.5) * 360,
      vy: (r() - 0.5) * 360,
      frein: 6,
      vie: 500,
      taille: 3,
      tailleFin: 2
    }));
  }
};

const motifDossiers: Motif = {
  voyage: 480,
  lancer({ x, m, r, t, voyage }: CtxMotif) {
    for (let i = 0; i < 5; i++) {
      const cible = {
        x: x.c.x + (r() - 0.5) * 50,
        y: x.c.y + 30 - i * 14
      };
      const rot = (r() - 0.5) * 0.6;
      m.effet({
        couche: 'avant',
        debut: t + i * 70,
        duree: voyage - 140,
        dessiner(ctx, p) {
          const q = facilite.entree(p);
          ctx.translate(cible.x, lerp(-60, cible.y, q));
          ctx.rotate(rot * (1 - q) * 3 + rot);
          ctx.fillStyle = ['#e6b64c', '#c9a227', '#d4622a', '#a67c22', '#e6b64c'][i];
          ctx.fillRect(-34, -22, 68, 44);
          ctx.fillRect(-34, -28, 24, 8);
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          ctx.fillRect(-24, -10, 48, 4);
          ctx.fillRect(-24, 0, 36, 4);
        }
      });
    }
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

const motifEnveloppes: Motif = {
  voyage: 520,
  lancer({ x, r, t, de, vers, voyage }: CtxMotif) {
    for (let i = 0; i < 8; i++) {
      projectile(x, {
        de: { x: de.x + (r() - 0.5) * 40, y: de.y },
        vers: { x: vers.x + (r() - 0.5) * 60, y: vers.y - r() * 40 },
        debut: t + i * 45,
        duree: voyage - 180,
        courbe: (r() - 0.5) * 220,
        dessin(ctx, pos, ang) {
          ctx.translate(pos.x, pos.y);
          ctx.rotate(ang * 0.3);
          ctx.fillStyle = '#eef3fb';
          ctx.fillRect(-12, -8, 24, 16);
          ctx.strokeStyle = '#6f7fd1';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-12, -8);
          ctx.lineTo(0, 2);
          ctx.lineTo(12, -8);
          ctx.stroke();
        }
      });
    }
  },
  impact({ x, m, r }: CtxMotif) {
    m.gerbe(10, x.c, () => ({
      forme: 'enveloppe',
      couleur: '#eef3fb',
      vx: (r() - 0.5) * 420,
      vy: -150 - r() * 200,
      ay: 900,
      vie: 800,
      taille: 9,
      vrot: (r() - 0.5) * 10
    }));
  }
};

const motifPostits: Motif = {
  voyage: 620,
  lancer({ x, m, r, t, voyage }: CtxMotif) {
    for (let i = 0; i < 12; i++) {
      const ang0 = (i / 12) * Math.PI * 2;
      const coul = ['#f7e264', '#f4a6c0', '#9ef5fb', '#b6e388'][i % 4];
      const cible = {
        x: x.c.x + (r() - 0.5) * x.C.w * 0.8,
        y: x.c.y + (r() - 0.5) * x.C.h * 0.6
      };
      m.effet({
        couche: 'avant',
        debut: t,
        duree: voyage,
        dessiner(ctx, p) {
          const orbite = Math.min(1, p / 0.45);
          const vol = Math.max(0, (p - 0.45) / 0.55);
          const ang = ang0 + orbite * Math.PI * 1.5;
          const o = {
            x: x.a.x + Math.cos(ang) * 70,
            y: x.a.y + Math.sin(ang) * 50
          };
          const pos = {
            x: lerp(o.x, cible.x, facilite.entree(vol)),
            y: lerp(o.y, cible.y, facilite.entree(vol))
          };
          ctx.translate(pos.x, pos.y);
          ctx.rotate(ang);
          ctx.fillStyle = coul;
          ctx.fillRect(-9, -9, 18, 18);
          ctx.fillStyle = 'rgba(0,0,0,.15)';
          ctx.fillRect(-9, -9, 18, 4);
        }
      });
    }
  },
  impact({ x, m, r }: CtxMotif) {
    m.gerbe(10, x.c, (i) => ({
      forme: 'postit',
      couleur: ['#f7e264', '#f4a6c0', '#9ef5fb', '#b6e388'][i % 4],
      vx: (r() - 0.5) * 200,
      vy: -50 - r() * 100,
      ay: 500,
      vie: 1000,
      taille: 8,
      vrot: (r() - 0.5) * 6
    }));
  }
};

const motifCv: Motif = {
  voyage: 480,
  lancer({ x, r, t, de, vers, voyage }: CtxMotif) {
    for (let i = 0; i < 6; i++) {
      projectile(x, {
        de,
        vers: { x: vers.x + (i - 2.5) * 22, y: x.c.y + (r() - 0.5) * 40 },
        debut: t + i * 50,
        duree: voyage - 200,
        courbe: (i - 2.5) * 50,
        dessin(ctx, pos, ang) {
          ctx.translate(pos.x, pos.y);
          ctx.rotate(ang + (1 - i / 6) * 4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-11, -14, 22, 28);
          ctx.fillStyle = '#8b5fb0';
          ctx.fillRect(-7, -10, 7, 7);
          ctx.fillStyle = '#9aa3b2';
          ctx.fillRect(-7, 0, 14, 2);
          ctx.fillRect(-7, 5, 10, 2);
        }
      });
    }
  },
  impact({ x, m, r }: CtxMotif) {
    m.gerbe(8, x.c, () => ({
      forme: 'carte',
      couleur: '#ffffff',
      vx: (r() - 0.5) * 380,
      vy: -120 - r() * 200,
      ay: 800,
      vie: 800,
      taille: 8,
      vrot: (r() - 0.5) * 12
    }));
  }
};

export const PAPIER = {
  tampon: motifTampon,
  dossiers: motifDossiers,
  enveloppes: motifEnveloppes,
  postits: motifPostits,
  cv: motifCv
} satisfies Partial<Record<CleD, Motif>>;
