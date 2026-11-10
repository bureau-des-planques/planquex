import { alea, bezier, eclair, eclatCarte, facilite, hacher, lerp, onde } from '../../moteur';
import { pose } from '../ctx';
import type { CleD } from '../attribution';
import { bas, haut } from '../generique';
import type { CtxMotif, Motif } from './types';

const motifEclair: Motif = {
  voyage: 320,
  lancer({ x, m, de, vers, voyage }: CtxMotif) {
    const graine = hacher(`${x.attaque.name}:eclair`);
    m.effet({
      couche: 'avant',
      duree: voyage + 120,
      additif: true,
      dessiner(ctx, p, temps) {
        const coup = Math.floor(temps / 90);
        const visible = p < 0.25 || (p > 0.4 && p < 0.6) || p > 0.75;
        if (!visible) return;
        const local = alea(graine + coup * 7);
        eclair(ctx, de, vers, local, '#9ef5fb', 26);
        // Le second arc est décidé **par tranche**, pas par image.
        if (alea(graine + coup)() > 0.4)
          eclair(ctx, de, { x: vers.x + (local() - 0.5) * 80, y: vers.y + 20 }, local, '#61d5df', 14);
      }
    });
    eclatCarte(m, x.A, '#9ef5fb', 160);
  },
  impact({ x, m, r }: CtxMotif) {
    m.gerbe(20, x.c, () => {
      const ang = r() * Math.PI * 2;
      return {
        forme: 'trait',
        couleur: '#9ef5fb',
        vx: Math.cos(ang) * 400,
        vy: Math.sin(ang) * 400,
        frein: 5,
        vie: 360,
        taille: 5,
        tailleFin: 1,
        orienter: true,
        additif: true
      };
    });
  }
};

const motifMegaphone: Motif = {
  voyage: 480,
  lancer({ x, m, t, de, vers, voyage }: CtxMotif) {
    for (let i = 0; i < 4; i++) {
      m.effet({
        couche: 'avant',
        debut: t + i * 80,
        duree: voyage - 160,
        additif: true,
        dessiner(ctx, p) {
          const pos = {
            x: lerp(de.x, vers.x, p),
            y: lerp(de.y, vers.y, p)
          };
          const ray = lerp(20, 70, p);
          ctx.globalAlpha = 1 - p * 0.5;
          ctx.strokeStyle = '#e0563f';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y + ray * 0.6, ray, -Math.PI * 0.8, -Math.PI * 0.2);
          ctx.stroke();
        }
      });
    }
    m.gerbe(5, haut(x), (i) => ({
      forme: 'texte',
      texte: '!',
      couleur: '#f7e264',
      vx: (i - 2) * 50,
      vy: -160,
      frein: 1.5,
      vie: 650,
      taille: 8,
      tailleFin: 6
    }));
  },
  impact({ x, m, r }: CtxMotif) {
    m.gerbe(6, x.c, (i) => ({
      forme: 'texte',
      texte: i % 2 ? '!!' : '!',
      couleur: '#e0563f',
      vx: (r() - 0.5) * 240,
      vy: -200,
      frein: 2,
      vie: 700,
      taille: 7
    }));
    m.secouer(12, 420);
  }
};

const motifMarteau: Motif = {
  voyage: 230,
  anticipation: 360,
  lancer({ x, m, voyage }: CtxMotif) {
    const dx = x.c.x - x.a.x;
    const dy = x.C.y + x.C.h * 0.7 - x.A.y;
    const b = x.base;
    m.animer(
      x.att,
      [
        { transform: pose(x, 'none'), easing: 'cubic-bezier(.8,0,1,.6)' },
        {
          transform: `translate(${dx}px, ${dy}px) ${b} scale(1.1) rotate(-5deg)`,
          offset: 0.36
        },
        {
          transform: `translate(${dx * 0.85}px, ${dy * 0.8}px) ${b}`,
          offset: 0.5
        },
        { transform: pose(x, 'none') }
      ],
      voyage / 0.36
    );
  },
  impact({ x, m, r }: CtxMotif) {
    m.effet({
      couche: 'avant',
      duree: 900,
      dessiner(ctx, p) {
        ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 0.9;
        ctx.strokeStyle = '#1b222c';
        ctx.lineWidth = 3;
        const rr = alea(9);
        for (let i = 0; i < 7; i++) {
          const ang = rr() * Math.PI * 2;
          const len = 30 + rr() * 40;
          ctx.beginPath();
          ctx.moveTo(x.c.x, x.c.y);
          ctx.lineTo(x.c.x + Math.cos(ang) * len * 0.5 + 6, x.c.y + Math.sin(ang) * len * 0.5);
          ctx.lineTo(x.c.x + Math.cos(ang) * len, x.c.y + Math.sin(ang) * len);
          ctx.stroke();
        }
      }
    });
    m.gerbe(28, bas(x), () => ({
      forme: 'carre',
      couleur: r() > 0.5 ? '#a56a3a' : '#8a93a8',
      vx: (r() - 0.5) * 520,
      vy: -150 - r() * 380,
      ay: 1500,
      vie: 800,
      taille: 4 + r() * 6,
      vrot: (r() - 0.5) * 18
    }));
    onde(m, bas(x), 180, '#f4e6cc', 520, 7);
    m.secouer(16, 480);
  }
};

const motifChaines: Motif = {
  voyage: 440,
  lancer({ x, m, de, vers, voyage }: CtxMotif) {
    for (const signe of [-1, 1]) {
      m.effet({
        couche: 'avant',
        duree: voyage,
        dessiner(ctx, p) {
          const n = 10;
          for (let i = 0; i < n; i++) {
            const q = Math.min(1, facilite.sortie(p) * (n / (i + 1)) * 0.6);
            if (q <= 0) continue;
            const pos = bezier(
              de,
              {
                x: (de.x + vers.x) / 2 + signe * 150,
                y: (de.y + vers.y) / 2
              },
              { x: x.c.x + signe * 50, y: x.c.y },
              (i / n) * q + (1 - q) * 0
            );
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(i % 2 ? 0 : Math.PI / 2);
            ctx.strokeStyle = '#a3abbd';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      });
    }
  },
  impact({ x, m }: CtxMotif) {
    m.effet({
      couche: 'avant',
      duree: 800,
      dessiner(ctx, p) {
        ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
        ctx.strokeStyle = '#a3abbd';
        ctx.lineWidth = 3;
        for (const s of [-1, 1]) {
          for (let i = 0; i <= 8; i++) {
            const q = i / 8;
            ctx.save();
            ctx.translate(
              lerp(x.C.x, x.C.x + x.C.w, q),
              lerp(s < 0 ? x.C.y : x.C.y + x.C.h, s < 0 ? x.C.y + x.C.h : x.C.y, q)
            );
            ctx.rotate(s * 0.9 + (i % 2 ? Math.PI / 2 : 0));
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    });
  }
};

export const CHOC = {
  eclair: motifEclair,
  megaphone: motifMegaphone,
  marteau: motifMarteau,
  chaines: motifChaines
} satisfies Partial<Record<CleD, Motif>>;
