/*
 * **La navette de courrier interne d'un Arrivage** (#671).
 *
 * Le bordereau, son tampon et le scellé sont dessinés en SVG : les libellés restent du vrai texte,
 * et les surfaces de fond sont nommées pour que `capturer` puisse mesurer leur contraste rendu.
 * La même pochette est découpée en deux sur la ligne de déchirure ; les identifiants de masque sont
 * donc uniques par instance.
 */
import { useId } from 'react';

/** Le cadre de la pochette, en unités du `viewBox`. */
export const POCHETTE = { largeur: 300, hauteur: 500 } as const;
/** L'ordonnée de la ligne de pointillés, en fraction de la hauteur. */
export const LIGNE = 44 / POCHETTE.hauteur;

/** Le contour cranté d'une navette de papier, en haut et en bas. */
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
        <clipPath id={`forme-${id}`}>
          <path d={SILHOUETTE} />
        </clipPath>
      </defs>

      <g clipPath={ref('forme')}>
        {/* Papier kraft mat, avec les plis d'une vraie enveloppe navette. */}
        <rect width={POCHETTE.largeur} height={POCHETTE.hauteur} fill="var(--pochette-kraft)" />
        <path
          d="M7 54 150 143 293 54v25l-143 91L7 79Z"
          fill="var(--pochette-tranche)"
          opacity="0.72"
          data-pochette-dos
        />
        <path d="M8 393 150 483l142-90v78l-10 17H18L8 471Z" fill="var(--pochette-kraft-fonce)" />
        <path d="M8 393 150 483l142-90" fill="none" stroke="var(--pochette-tranche)" strokeWidth="2" />
        <path
          d="M18 56 18 474M282 56v418"
          fill="none"
          stroke="var(--pochette-tranche)"
          strokeWidth="2"
          opacity="0.56"
          data-pochette-tranche
        />
        <path
          d="M24 59 150 137 276 59"
          fill="none"
          stroke="var(--pochette-kraft-clair)"
          strokeWidth="2"
          opacity="0.58"
        />

        {/* Le bordereau est un aplat de papier clair : chaque texte mesuré tombe sur lui. */}
        <rect
          x="28"
          y="73"
          width="244"
          height="322"
          rx="3"
          fill="var(--pochette-papier)"
          data-pochette-surface="bordereau"
        />
        <rect
          x="34"
          y="79"
          width="232"
          height="310"
          rx="1"
          fill="none"
          stroke="var(--pochette-tranche)"
          strokeWidth="1.2"
          opacity="0.75"
        />

        <text
          x="48"
          y="108"
          fill="var(--pochette-encre)"
          fontFamily="var(--font-display)"
          fontSize="16.5"
          fontWeight="800"
          letterSpacing="0.8"
          data-pochette-texte
          data-fond="bordereau"
        >
          COURRIER INTERNE
        </text>
        <text
          x="48"
          y="136"
          fill="var(--pochette-encre)"
          fontFamily="var(--font-body)"
          fontSize="16.5"
          fontWeight="700"
          letterSpacing="0.35"
          data-pochette-texte
          data-fond="bordereau"
        >
          BORDEREAU D’ARRIVAGE
        </text>
        <path d="M48 151h204" stroke="var(--pochette-tranche)" strokeWidth="1.2" />

        <text
          x="48"
          y="185"
          fill="var(--pochette-encre)"
          fontFamily="var(--font-display)"
          fontSize="25"
          fontWeight="800"
          letterSpacing="1"
          data-pochette-texte
          data-fond="bordereau"
        >
          ARRIVAGE
        </text>
        <text
          x="48"
          y="211"
          fill="var(--pochette-encre)"
          fontFamily="var(--font-body)"
          fontSize="16.5"
          fontWeight="700"
          letterSpacing="0.45"
          data-pochette-texte
          data-fond="bordereau"
        >
          {nombre} CARTES
        </text>
        <text
          x="48"
          y="237"
          fill="var(--pochette-encre)"
          fontFamily="var(--font-body)"
          fontSize="16.5"
          fontWeight="700"
          letterSpacing="0.4"
          data-pochette-texte
          data-fond="bordereau"
        >
          MARCHÉ DE BASE
        </text>

        <text
          x="48"
          y="280"
          fill="var(--pochette-encre)"
          fontFamily="var(--font-body)"
          fontSize="16.5"
          fontWeight="700"
          letterSpacing="0.45"
          data-pochette-texte
          data-fond="bordereau"
        >
          DESTINATAIRE
        </text>
        <text
          x="48"
          y="308"
          fill="var(--pochette-encre)"
          fontFamily="var(--font-display)"
          fontSize="19"
          fontWeight="800"
          letterSpacing="0.4"
          data-pochette-texte
          data-fond="bordereau"
        >
          LE TESTEUR
        </text>
        {/* Tampon administratif, sans symbole de jeu ni motif de tasse. */}
        <g data-pochette-tampon>
          <circle cx="215" cy="340" r="31" fill="none" stroke="var(--pochette-encre)" strokeWidth="2.2" />
          <circle cx="215" cy="340" r="25" fill="none" stroke="var(--pochette-encre)" strokeWidth="1" />
          <text
            x="215"
            y="346"
            textAnchor="middle"
            fill="var(--pochette-encre)"
            fontFamily="var(--font-display)"
            fontSize="16"
            fontWeight="800"
            letterSpacing="0.5"
            data-pochette-texte
            data-fond="bordereau"
          >
            REÇU
          </text>
        </g>

        {/* Marque d'annulation et code de tri décoratif, sans faux identifiant. */}
        <g opacity="0.72">
          {[0, 4, 7, 12, 16, 21, 25, 29, 35, 39, 44, 48].map((x, i) => (
            <rect
              key={x}
              x={48 + x * 1.6}
              y="330"
              width={i % 3 === 0 ? 2 : 1}
              height="25"
              fill="var(--pochette-encre)"
            />
          ))}
        </g>
        <text
          x="48"
          y="381"
          fill="var(--pochette-encre)"
          fontFamily="var(--font-body)"
          fontSize="16.5"
          fontWeight="700"
          letterSpacing="0.5"
          data-pochette-texte
          data-fond="bordereau"
        >
          SERVICE COURRIER
        </text>

        {/* Une languette scellée chevauche la ligne de déchirure et s'envole avec la lèvre. */}
        <g data-pochette-scellement>
          <rect
            x="38"
            y="15"
            width="104"
            height="25"
            rx="2"
            fill="var(--pochette-encre)"
            data-pochette-surface="scelle"
          />
          <text
            x="90"
            y="33"
            textAnchor="middle"
            fill="var(--pochette-papier)"
            fontFamily="var(--font-body)"
            fontSize="16.5"
            fontWeight="800"
            letterSpacing="0.7"
            data-pochette-texte
            data-fond="scelle"
          >
            SCELLÉ
          </text>
          <path d="M146 17v21" stroke="var(--pochette-papier-clair)" strokeWidth="2" opacity="0.85" />
        </g>

        {/* La bouche, son ombre et sa lèvre donnent une tranche visible sous la déchirure. */}
        <path d="M7 45h286v12H7Z" fill="var(--pochette-tranche)" data-pochette-levre />
        <path d="M7 45h286" stroke="var(--pochette-papier-clair)" strokeWidth="2.4" data-pochette-levre />
        <path d="M10 57h280" stroke="var(--pochette-kraft-fonce)" strokeWidth="1.5" opacity="0.8" />

        {/* Soudures du haut et du bas, mates et sans effet métallisé. */}
        <path d="M0 7h300M0 493h300" stroke="var(--pochette-tranche)" strokeWidth="1.4" opacity="0.8" />
      </g>

      {/* La ligne reste le seul endroit où la pochette se déchire. */}
      <g fill="var(--pochette-encre)" opacity="0.9">
        {Array.from({ length: 47 }, (_, i) => (
          <circle key={i} cx={8 + i * 6.2} cy={44} r="1.15" />
        ))}
      </g>
      <path d="M6 40 1 44l5 4Z M294 40l5 4-5 4Z" fill="var(--pochette-encre)" opacity="0.9" />

      <path d={SILHOUETTE} fill="none" stroke="var(--pochette-tranche)" strokeWidth="2" />
    </svg>
  );
}
