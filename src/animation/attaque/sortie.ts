import { arrondi, facilite, hacher, lerp } from '../moteur';
import type { Etape } from '../moteur';
import type { Ctx } from './ctx';

/** Le coup de grâce commence juste après l'impact (le temps que le gel d'impact passe)… */
export const SORTIE_DEBUT = 100;
/** …et sa dernière image est la fin de la note de service : voir `sayneteDeSortie`. */
export const SORTIE_DUREE = 2250;

// ---------- Le coup de grâce : la sortie, en satire de bureau ----------

/**
 * Les formules creuses du départ, en deux lignes de tampon. On se moque du formulaire, jamais de
 * celle ou celui qui le reçoit : « plan de sauvegarde », c'est le nom officiel du plan social.
 */
export const SORTIES: readonly (readonly [string, string])[] = [
  ['POSTE', 'SUPPRIMÉ'],
  ['RUPTURE', 'CONVENTIONNELLE'],
  ['OPTIMISATION', 'DES EFFECTIFS'],
  ['MUTATION', 'À DISTANCE'],
  ['FIN DE', 'MISSION'],
  ['PLAN DE', 'SAUVEGARDE']
];

/** La note qui accompagne le carton : la politesse de la formule, vide de tout le reste. */
export const MOTS_DU_DEPART = [
  'Merci pour votre engagement.',
  'Vos tâches sont réparties.',
  'Un pot de départ sera organisé.',
  'Le poste n’est pas reconduit.'
];

/** Coupe un texte en lignes qui tiennent dans `largeur` (la police du contexte est déjà posée). */
export function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const sortie: string[] = [];
  let ligne = '';
  for (const mot of texte.split(' ')) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ligne && ctx.measureText(essai).width > largeur) {
      sortie.push(ligne);
      ligne = mot;
    } else {
      ligne = essai;
    }
  }
  if (ligne) sortie.push(ligne);
  return sortie;
}

/**
 * **Le coup de grâce** : la cible craque, elle part au Rebut. Sa saynète tient en quatre gestes de
 * bureau, **un par temps** — le tampon, la carte qui part dans son carton, la note de service. Le
 * ton est celui du jeu : on ridiculise le cérémonial et le formulaire.
 *
 * La carte visée est la doublure de la scène (`SceneAttaque`) : elle est encore là à l'impact,
 * c'est elle qu'on voit encaisser, se griser et disparaître.
 *
 * Rien de ce que ça dit n'est perdu sous « Mouvement réduit » : le bandeau « a craqué », la
 * ligne du journal et l'Intervention marquée le disent déjà.
 */
export function sayneteDeSortie(x: Ctx, e: Etape[], t: number) {
  const m = x.m;
  const r = x.rnd;
  const [l1, l2] = SORTIES[hacher(`${x.attaque.name}:sortie`) % SORTIES.length];
  const mot = MOTS_DU_DEPART[hacher(`${x.attaque.name}:mot`) % MOTS_DU_DEPART.length];
  const C = x.C;
  const largeurPlateau = () => m.largeur;

  // 1. Le tampon s'abat sur la carte, qui se grise — le geste administratif, sec et rouge.
  e.push({
    a: t,
    faire: () => {
      m.geler(70);
      m.secouer(6, 240);
      m.animer(x.cib, [{ filter: 'grayscale(0)' }, { filter: 'grayscale(1) brightness(0.8)' }], 260, 'ease-out');
      m.gerbe(8, x.c, () => ({
        forme: 'carre',
        couleur: '#f4f1e8',
        vx: (r() - 0.5) * 340,
        vy: -80 - r() * 200,
        ay: 700,
        frein: 1.5,
        vie: 800,
        taille: 5 + r() * 4,
        vrot: (r() - 0.5) * 12
      }));
      m.effet({
        couche: 'avant',
        duree: 1000,
        dessiner(ctx, p) {
          const pose = p < 0.14 ? facilite.sortie(p / 0.14) : 1;
          const s = lerp(2.4, 1, pose);
          ctx.globalAlpha = (p > 0.8 ? (1 - p) / 0.2 : 1) * Math.min(1, p * 14);
          // La taille du texte s'adapte : « CONVENTIONNELLE » doit tenir sur le plateau, penchée.
          ctx.font = '900 19px system-ui, sans-serif';
          const mesure = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width);
          const plein = Math.min(largeurPlateau() - 44, 240);
          const px = Math.min(19, (19 * (plein - 26)) / mesure);
          ctx.font = `900 ${px.toFixed(1)}px system-ui, sans-serif`;
          const w = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 26;
          const h = px * 2.3 + 16;
          const cx = Math.min(Math.max(x.c.x, w / 2 + 14), largeurPlateau() - w / 2 - 14);
          ctx.translate(cx, x.c.y);
          ctx.rotate(-0.2);
          ctx.scale(s, s);
          // Une plaque claire sous l'encre : le rouge doit se lire sur une carte grise comme sur le feutre.
          ctx.fillStyle = 'rgba(250,244,230,.92)';
          arrondi(ctx, -w / 2, -h / 2, w, h, 6);
          ctx.fill();
          ctx.strokeStyle = '#d0352b';
          ctx.lineWidth = 4;
          arrondi(ctx, -w / 2, -h / 2, w, h, 6);
          ctx.stroke();
          ctx.lineWidth = 1.5;
          arrondi(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 3);
          ctx.stroke();
          ctx.fillStyle = '#d0352b';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(l1, 0, -px * 0.58);
          ctx.fillText(l2, 0, px * 0.62);
        }
      });
    }
  });

  // 2. Le carton se glisse sous la carte ; la carte s'y range, rapetissée, comme on referme un dossier.
  const bw = Math.min(124, C.w * 1.28);
  const bordCarton = C.y + C.h * 0.7;
  e.push({
    a: t + 640,
    faire: () => {
      const duree = SORTIE_DUREE - 640;
      m.effet({
        couche: 'avant',
        duree,
        dessiner(ctx, p, temps) {
          void temps;
          const ms = p * duree;
          const monte = facilite.ressort(Math.min(1, ms / 260));
          ctx.globalAlpha = p > 0.88 ? (1 - p) / 0.12 : Math.min(1, ms / 90);
          ctx.translate(0, (1 - monte) * 44);
          const bx = x.c.x - bw / 2;
          const y = bordCarton;
          // L'ouverture du carton, sombre : c'est là que la carte disparaît.
          ctx.fillStyle = '#2a1a0a';
          ctx.beginPath();
          ctx.ellipse(x.c.x, y, Math.max(0.5, bw / 2 - 3), 10, 0, 0, Math.PI * 2);
          ctx.fill();
          // La plante du bureau (à gauche) et la tasse (à droite) dépassent du carton.
          const oscille = Math.sin(ms / 260) * 2;
          ctx.strokeStyle = '#3f7d3f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x.c.x - 34, y + 2);
          ctx.quadraticCurveTo(x.c.x - 36 + oscille, y - 14, x.c.x - 33 + oscille, y - 26);
          ctx.stroke();
          ctx.fillStyle = '#58b058';
          for (const [dx, dy, a] of [
            [-33 + oscille, -27, -0.6],
            [-33 + oscille, -24, 0.6],
            [-33 + oscille, -31, 0]
          ] as const) {
            ctx.beginPath();
            ctx.ellipse(x.c.x + dx, y + dy, 8, 4, a - Math.PI / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#f4f1e8';
          arrondi(ctx, x.c.x + 24, y - 14, 17, 17, 3);
          ctx.fill();
          ctx.strokeStyle = '#f4f1e8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x.c.x + 43, y - 6, 5, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
          // La face avant : carton, scotch, étiquette au feutre.
          ctx.fillStyle = '#c49a58';
          arrondi(ctx, bx, y, bw, 46, 3);
          ctx.fill();
          ctx.fillStyle = '#a67c22';
          ctx.fillRect(bx, y, bw, 6);
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          ctx.fillRect(x.c.x - 12, y, 24, 46);
          ctx.strokeStyle = '#664d38';
          ctx.lineWidth = 2;
          arrondi(ctx, bx, y, bw, 46, 3);
          ctx.stroke();
          ctx.fillStyle = '#2a1a0a';
          ctx.font = '800 italic 13px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('MES AFFAIRES', x.c.x, y + 29);
        }
      });
    }
  });
  e.push({
    a: t + 800,
    faire: () =>
      // La carte se range : elle se rapetisse en tombant dans le carton, **opaque** jusqu'au bout, et
      // ne s'efface que derrière la face avant. Ainsi on voit un Planqué entrer dans une boîte.
      m.animer(
        x.cib,
        [
          { transform: 'none', opacity: 1 },
          { transform: 'translateY(-12px) rotate(-4deg) scale(1.02)', opacity: 1, offset: 0.22 },
          {
            transform: `translateY(${(bordCarton - x.c.y + 18).toFixed(1)}px) rotate(-9deg) scale(0.5)`,
            opacity: 1,
            offset: 0.88
          },
          {
            transform: `translateY(${(bordCarton - x.c.y + 30).toFixed(1)}px) rotate(-9deg) scale(0.46)`,
            opacity: 0
          }
        ],
        560,
        'cubic-bezier(.45,0,.55,1)'
      )
  });

  // 3. La note de service : la formule creuse, signée de rien.
  e.push({
    a: t + 1150,
    faire: () => {
      const duree = SORTIE_DUREE - 1150;
      m.effet({
        couche: 'avant',
        duree,
        dessiner(ctx, p) {
          const entree = facilite.ressort(Math.min(1, (p * duree) / 280));
          ctx.globalAlpha = p > 0.84 ? (1 - p) / 0.16 : Math.min(1, (p * duree) / 100);
          ctx.font = '700 15px system-ui, sans-serif';
          const corps = lignes(ctx, mot, 168);
          const larg = 190;
          const h = 34 + corps.length * 19 + 20;
          const bord = largeurPlateau() - larg - 10;
          const gauche = Math.min(C.x + C.w + 12, bord);
          const hautNote = C.y + 6;
          ctx.translate(gauche + larg / 2 + (1 - entree) * 120, hautNote + h / 2);
          ctx.rotate(0.05 - (1 - entree) * 0.2);
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.fillRect(-larg / 2 + 4, -h / 2 + 5, larg, h);
          ctx.fillStyle = '#f6efd8';
          ctx.fillRect(-larg / 2, -h / 2, larg, h);
          ctx.fillStyle = '#c0442e';
          ctx.fillRect(-larg / 2, -h / 2, larg, 22);
          ctx.fillStyle = '#fff6e6';
          ctx.font = '800 12px system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('NOTE INTERNE', -larg / 2 + 9, -h / 2 + 11.5);
          ctx.fillStyle = '#2a1d0e';
          ctx.font = '700 15px system-ui, sans-serif';
          corps.forEach((ligne, i) => ctx.fillText(ligne, -larg / 2 + 9, -h / 2 + 38 + i * 19));
          ctx.font = 'italic 600 13px system-ui, sans-serif';
          ctx.fillStyle = '#6a5a40';
          ctx.textAlign = 'right';
          ctx.fillText('Cordialement.', larg / 2 - 9, h / 2 - 11);
        }
      });
    }
  });
}
