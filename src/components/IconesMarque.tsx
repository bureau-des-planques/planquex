import type { ReactNode, SVGProps } from 'react';

/**
 * **Les icônes de la marque** (D-191) : trait fin (1,25), extrémités carrées, angles vifs —
 * la géométrie stricte de la refonte « aéro-institutionnelle ». Elles remplacent, dans la barre
 * du haut et la barre du bas, les icônes `lucide-react` au trait rond.
 *
 * Même contrat qu'une icône `lucide` (`size`, attributs SVG) : `Layout` les passe dans le même
 * tableau d'onglets. Décoratives par défaut : le lien qui les porte a son propre nom.
 */
type Props = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function Icone({ size = 22, children, ...rest }: Props & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Accueil : une maison, toit en chevron, porte au centre. */
export function IconeAccueil(props: Props) {
  return (
    <Icone {...props}>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </Icone>
  );
}

/** Cartes : deux cartes décalées. */
export function IconeCartes(props: Props) {
  return (
    <Icone {...props}>
      <rect x="7" y="3" width="12" height="16" />
      <path d="M5 6v15h11" />
    </Icone>
  );
}

/** Combat : deux lames croisées, gardes en équerre. */
export function IconeCombat(props: Props) {
  return (
    <Icone {...props}>
      <path d="M4 20 20 4" />
      <path d="M14 4h6v6" />
      <path d="M4 4l6 6" />
      <path d="M14 14l6 6" />
      <path d="M4 14v6h6" />
    </Icone>
  );
}

/** Pause café : une tasse droite, son anse, un filet de vapeur. */
export function IconeCafe(props: Props) {
  return (
    <Icone {...props}>
      <path d="M4 10h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M17 12h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M10 3c-1.2 1.4 1.2 2.6 0 4" />
    </Icone>
  );
}

/** Comité : une table de réunion et deux têtes. */
export function IconeComite(props: Props) {
  return (
    <Icone {...props}>
      <rect x="3" y="10" width="18" height="4" />
      <circle cx="7" cy="6" r="2" />
      <circle cx="17" cy="6" r="2" />
      <path d="M6 14v6M18 14v6" />
    </Icone>
  );
}

/** Réglages : un moyeu et huit rayons, comme un viseur d'instrument. */
export function IconeReglages(props: Props) {
  return (
    <Icone {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
    </Icone>
  );
}
