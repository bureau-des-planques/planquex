/*
 * **La pochette d'un Arrivage**, dessinée en vecteurs (#283).
 *
 * Un sachet antistatique métallisé, soudé en haut et en bas, avec son impression : le cadre bleu
 * nuit et or du jeu, le triangle d'avertissement (une tasse de café, pas une main), et la ligne de
 * pointillés où l'on déchire. Vectoriel, il reste net à toute taille et sous toute inclinaison — ce
 * que les photos de la première version ne tenaient pas (rognées en bas, floues de près).
 *
 * Elle est rendue **deux fois** pendant la déchirure (la bande et le corps, découpés sur le même
 * tracé) : les identifiants de dégradés portent donc un suffixe unique par instance.
 */
import { useId } from 'react';

/** Le cadre de la pochette, en unités du `viewBox`. */
export const POCHETTE = { largeur: 300, hauteur: 500 } as const;
/** L'ordonnée de la ligne de pointillés, en fraction de la hauteur. */
export const LIGNE = 44 / POCHETTE.hauteur;

/** La silhouette : soudures crantées en haut et en bas, flancs droits. */
function silhouette(): string {
  const pas = 7.5;
  const { largeur, hauteur } = POCHETTE;
  let d = 'M0,6';
  for (let x = 0; x < largeur; x += pas) d += ` L${x + pas / 2},2 L${x + pas},6`;
  d += ` L${largeur},${hauteur - 6}`;
  for (let x = largeur; x > 0; x -= pas) d += ` L${x - pas / 2},${hauteur - 2} L${x - pas},${hauteur - 6}`;
  return `${d} Z`;
}

export const SILHOUETTE = silhouette();

/** La silhouette en `data:` URI, pour les masques CSS des reflets. */
export const MASQUE_SILHOUETTE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${POCHETTE.largeur} ${POCHETTE.hauteur}' preserveAspectRatio='none'><path d='${SILHOUETTE}' fill='black'/></svg>`
)}")`;

/** Le tracé de la tasse (lucide `coffee`, 24 × 24), centré dans le triangle. */
const TASSE = [
  'M10 2v2',
  'M14 2v2',
  'M6 2v2',
  'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1'
];

export function Pochette({ nombre }: { nombre: number }) {
  const id = useId().replace(/:/g, '');
  const ref = (nom: string) => `url(#${nom}-${id})`;
  return (
    <svg
      className="pochette"
      viewBox={`0 0 ${POCHETTE.largeur} ${POCHETTE.hauteur}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Le film métallisé : des bandes claires et sombres, comme un sachet gonflé. */}
        <linearGradient id={`film-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a5568" />
          <stop offset="0.07" stopColor="#c4ccd8" />
          <stop offset="0.18" stopColor="#8995a8" />
          <stop offset="0.36" stopColor="#eef2f7" />
          <stop offset="0.5" stopColor="#a9b3c3" />
          <stop offset="0.68" stopColor="#dfe5ee" />
          <stop offset="0.86" stopColor="#8b97aa" />
          <stop offset="0.95" stopColor="#c8d0dc" />
          <stop offset="1" stopColor="#4a5568" />
        </linearGradient>
        {/* Le gonflement : plus sombre vers les soudures, où le film se pince. */}
        <linearGradient id={`gonfle-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1220" stopOpacity="0.55" />
          <stop offset="0.12" stopColor="#0b1220" stopOpacity="0" />
          <stop offset="0.86" stopColor="#0b1220" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1220" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={`or-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe7a6" />
          <stop offset="0.35" stopColor="#e6b64c" />
          <stop offset="0.6" stopColor="#a67c22" />
          <stop offset="0.8" stopColor="#f4d68a" />
          <stop offset="1" stopColor="#a67c22" />
        </linearGradient>
        <linearGradient id={`nuit-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2a4a" />
          <stop offset="0.55" stopColor="#0e1830" />
          <stop offset="1" stopColor="#070c16" />
        </linearGradient>
        <radialGradient id={`halo-${id}`} cx="0.5" cy="0.36" r="0.55">
          <stop offset="0" stopColor="#e6b64c" stopOpacity="0.35" />
          <stop offset="1" stopColor="#e6b64c" stopOpacity="0" />
        </radialGradient>
        {/* Les sertissages : de fines stries verticales. */}
        <pattern id={`stries-${id}`} width="3" height="10" patternUnits="userSpaceOnUse">
          <rect width="3" height="10" fill="#9aa5b6" />
          <rect width="1.2" height="10" fill="#5b6679" />
          <rect x="1.6" width="0.6" height="10" fill="#e8edf4" />
        </pattern>
        <clipPath id={`forme-${id}`}>
          <path d={SILHOUETTE} />
        </clipPath>
      </defs>

      <g clipPath={ref('forme')}>
        <rect width={POCHETTE.largeur} height={POCHETTE.hauteur} fill={ref('film')} />
        {/* Les plis du film : quelques reflets obliques, très doux. */}
        <path d="M-20,120 L320,40 L320,70 L-20,165 Z" fill="#ffffff" opacity="0.1" />
        <path d="M-20,380 L320,250 L320,262 L-20,398 Z" fill="#ffffff" opacity="0.12" />
        <path d="M-20,470 L320,350 L320,380 L-20,500 Z" fill="#0b1220" opacity="0.12" />
        {/* Les soudures, en haut et en bas. */}
        <rect y="0" width={POCHETTE.largeur} height="30" fill={ref('stries')} opacity="0.92" />
        <rect y="470" width={POCHETTE.largeur} height="30" fill={ref('stries')} opacity="0.92" />
        <rect y="29" width={POCHETTE.largeur} height="1.5" fill="#3d475a" opacity="0.6" />
        <rect y="469.5" width={POCHETTE.largeur} height="1.5" fill="#3d475a" opacity="0.6" />
        <rect width={POCHETTE.largeur} height={POCHETTE.hauteur} fill={ref('gonfle')} />
      </g>

      {/* La ligne de pointillés : là, et seulement là, le sachet se déchire. */}
      <g fill="#2b3446" opacity="0.85">
        {Array.from({ length: 47 }, (_, i) => (
          <circle key={i} cx={8 + i * 6.2} cy={44} r="1.25" />
        ))}
      </g>
      <path d="M6,40 L1,44 L6,48 Z" fill="#2b3446" opacity="0.85" />
      <path d="M294,40 L299,44 L294,48 Z" fill="#2b3446" opacity="0.85" />

      {/* L'impression : le cadre du jeu. */}
      <rect x="22" y="60" width="256" height="392" rx="14" fill={ref('nuit')} />
      <rect x="22" y="60" width="256" height="392" rx="14" fill={ref('halo')} />
      <rect x="22" y="60" width="256" height="392" rx="14" fill="none" stroke={ref('or')} strokeWidth="2.4" />
      <rect
        x="29"
        y="67"
        width="242"
        height="378"
        rx="10"
        fill="none"
        stroke={ref('or')}
        strokeWidth="0.8"
        opacity="0.6"
      />

      <text
        x="150"
        y="94"
        textAnchor="middle"
        fill={ref('or')}
        fontFamily="var(--font-display)"
        fontSize="11.5"
        fontWeight="700"
        letterSpacing="3.2"
      >
        BUREAU DES PLANQUÉS
      </text>
      <rect x="96" y="104" width="108" height="0.8" fill={ref('or')} opacity="0.7" />

      {/* Le triangle d'avertissement antistatique, détourné : une tasse de café. */}
      <g transform="translate(150 196)">
        <path
          d="M0,-74 Q6,-74 9,-69 L70,38 Q73,44 67,46 L-67,46 Q-73,44 -70,38 L-9,-69 Q-6,-74 0,-74 Z"
          fill={ref('or')}
        />
        <path d="M0,-56 L56,36 L-56,36 Z" fill="#0b1220" />
        <g
          transform="translate(-23 -14) scale(1.9)"
          fill="none"
          stroke={ref('or')}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {TASSE.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>

      <text
        x="150"
        y="318"
        textAnchor="middle"
        fill={ref('or')}
        fontFamily="var(--font-display)"
        fontSize="42"
        fontWeight="800"
        letterSpacing="2"
      >
        ARRIVAGE
      </text>
      <text
        x="150"
        y="344"
        textAnchor="middle"
        fill="#c9d4e6"
        fontFamily="var(--font-display)"
        fontSize="12.5"
        fontWeight="600"
        letterSpacing="2.4"
      >
        {nombre} CARTES · MARCHÉ DE BASE
      </text>

      {/* Le pied : une fausse étiquette de stock, pour la satire. */}
      <g opacity="0.75">
        {[0, 3, 5, 9, 11, 12, 16, 19, 21, 22, 26, 29, 31, 34, 35, 38].map((x, i) => (
          <rect key={x} x={112 + x * 2} y="380" width={i % 3 === 0 ? 2.2 : 1.1} height="26" fill="#c9d4e6" />
        ))}
      </g>
      <text
        x="150"
        y="422"
        textAnchor="middle"
        fill="#9aa9c2"
        fontFamily="var(--font-body)"
        fontSize="7.5"
        letterSpacing="1.6"
      >
        SACHET ANTISTATIQUE · NE PAS PLIER
      </text>
      <text
        x="150"
        y="434"
        textAnchor="middle"
        fill="#7e8fb0"
        fontFamily="var(--font-body)"
        fontSize="7"
        letterSpacing="1.2"
      >
        Contenu non contractuel.
      </text>
    </svg>
  );
}
