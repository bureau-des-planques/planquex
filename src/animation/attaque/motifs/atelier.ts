import { alea, eclair, facilite, hacher, onde } from '../../moteur';
import type { CleD } from '../attribution';
import { projectile } from '../generique';
import type { CtxMotif, Motif } from './types';

const motifSoudure: Motif = {
  voyage: 520,
  lancer({ x, m, de, vers, voyage }: CtxMotif) {
    let derniereTrancheSoudure = -1;
    m.effet({
      couche: 'avant',
      duree: voyage,
      additif: true,
      dessiner(ctx, p, temps) {
        const local = alea(Math.floor(temps / 40));
        eclair(ctx, de, vers, local, '#f7a54a', 8);
        ctx.globalAlpha = 0.8;
        const g = ctx.createRadialGradient(vers.x, vers.y, 0, vers.x, vers.y, 30);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(vers.x - 30, vers.y - 30, 60, 60);
        void p;
      },
      maj(temps) {
        // **Une gerbe par tranche de 40 ms**, jamais par image : le tirage était déjà
        // dérivé du temps, mais le nombre de particules suivait la fréquence d'affichage
        // (D-098, budget de 300 hors cinématique).
        const tranche = Math.floor(temps / 40);
        if (tranche === derniereTrancheSoudure) return;
        derniereTrancheSoudure = tranche;
        const rt = alea(hacher(`${x.attaque.name}:soudure:${tranche}`));
        for (let i = 0; i < 3; i++)
          m.emettre({
            x: vers.x,
            y: vers.y,
            vx: (rt() - 0.5) * 300,
            vy: -100 - rt() * 240,
            ay: 1200,
            forme: 'trait',
            couleur: rt() > 0.5 ? '#f7a54a' : '#ffe9a8',
            vie: 450,
            taille: 3,
            tailleFin: 1,
            orienter: true,
            additif: true
          });
      }
    });
  },
  impact({ m, r, vers }: CtxMotif) {
    m.gerbe(24, vers, () => ({
      forme: 'point',
      couleur: r() > 0.5 ? '#f7a54a' : '#ffe9a8',
      vx: (r() - 0.5) * 360,
      vy: -80 - r() * 260,
      ay: 1100,
      vie: 700,
      taille: 2.5,
      additif: true
    }));
  }
};

const motifExtincteur: Motif = {
  voyage: 480,
  lancer({ x, m, de, vers, voyage, impact }: CtxMotif) {
    // Une seule gerbe par tranche de 40 ms : à 144 Hz, émettre par image remplissait le
    // budget de particules et refusait l'impact lui-même.
    let derniereTranche = -1;
    m.effet({
      couche: 'avant',
      duree: voyage,
      dessiner() {},
      maj(temps) {
        const tranche = Math.floor(temps / 40);
        if (tranche === derniereTranche) return;
        derniereTranche = tranche;
        const rt = alea(hacher(`${x.attaque.name}:extincteur:${tranche}`));
        for (let i = 0; i < 5; i++) {
          const ang = Math.atan2(vers.y - de.y, vers.x - de.x) + (rt() - 0.5) * 0.35;
          const v = 700 + rt() * 200;
          m.emettre({
            x: de.x,
            y: de.y,
            vx: Math.cos(ang) * v,
            vy: Math.sin(ang) * v,
            frein: 2.2,
            forme: 'point',
            couleur: 'rgba(240,244,250,.85)',
            vie: 520,
            taille: 3,
            tailleFin: 11
          });
        }
      }
    });
  },
  impact({ x, m, r }: CtxMotif) {
    m.gerbe(26, x.c, () => ({
      forme: 'point',
      couleur: 'rgba(240,244,250,.9)',
      vx: (r() - 0.5) * 220,
      vy: (r() - 0.5) * 220,
      frein: 2.5,
      vie: 900,
      taille: 6,
      tailleFin: 18
    }));
  }
};

const motifSoin: Motif = {
  voyage: 260,
  lancer({ x, de, vers, voyage }: CtxMotif) {
    projectile(x, {
      de,
      vers,
      duree: voyage,
      facilite: facilite.entree,
      dessin(ctx, pos, ang) {
        ctx.translate(pos.x, pos.y);
        ctx.rotate(ang);
        ctx.fillStyle = '#e8eef8';
        ctx.fillRect(-26, -5, 30, 10);
        ctx.fillStyle = '#46c78c';
        ctx.fillRect(-20, -3, 18, 6);
        ctx.fillStyle = '#c0c8d4';
        ctx.fillRect(-34, -8, 8, 16);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(20, 0);
        ctx.stroke();
      }
    });
  },
  impact({ x, m, r }: CtxMotif) {
    m.gerbe(10, x.c, () => ({
      forme: 'croix',
      couleur: '#46c78c',
      vx: (r() - 0.5) * 200,
      vy: -80 - r() * 120,
      frein: 1.5,
      vie: 700,
      taille: 6
    }));
  }
};

const motifZen: Motif = {
  voyage: 640,
  lancer({ x, r, t, de, vers, voyage }: CtxMotif) {
    for (let i = 0; i < 22; i++) {
      projectile(x, {
        de: { x: de.x + (r() - 0.5) * 50, y: de.y },
        vers: {
          x: vers.x + (r() - 0.5) * 80,
          y: x.c.y + (r() - 0.5) * 60
        },
        debut: t + i * 18,
        duree: voyage - 220,
        courbe: Math.sin(i) * 120,
        facilite: facilite.entreeSortie,
        dessin(ctx, pos, ang) {
          ctx.translate(pos.x, pos.y);
          ctx.rotate(ang + i);
          ctx.fillStyle = i % 3 ? '#f4a6c0' : '#ffffff';
          ctx.beginPath();
          ctx.ellipse(0, 0, 8, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  },
  impact({ x, m }: CtxMotif) {
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      m.emettre({
        x: x.c.x + Math.cos(ang) * 60,
        y: x.c.y + Math.sin(ang) * 60,
        vx: -Math.sin(ang) * 120,
        vy: Math.cos(ang) * 120,
        frein: 1,
        forme: 'petale',
        couleur: '#f4a6c0',
        vie: 900,
        taille: 7,
        vrot: 3
      });
    }
    onde(m, x.c, 110, '#f4a6c0', 700, 4);
  }
};

export const ATELIER = {
  soudure: motifSoudure,
  extincteur: motifExtincteur,
  soin: motifSoin,
  zen: motifZen
} satisfies Partial<Record<CleD, Motif>>;
