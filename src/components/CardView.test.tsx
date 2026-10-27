// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ALL_CARDS, FACTION_META, RARITY_META, isPlanque } from '@/data';
import type { PlanqueCard } from '@/data/types';
import { CardView } from './CardView';

/**
 * **Le geste observé, pas deviné** (#285). jsdom ne calcule aucune mise en page : avec la
 * vraie librairie, `whileHover` ne produit **jamais** de `transform` dans le DOM du test
 * (vérifié : survol + attente, `style.transform` reste vide, la carte animée comme la
 * figée). L'assertion « ni `whileHover` ni `transform` » y serait donc un faux garde-fou —
 * une assertion qui ne peut pas échouer.
 *
 * Ce simulacre rend le geste **visible** sans l'inventer : `whileHover` devient, au survol,
 * le `transform` que la librairie poserait, et les deux props sont exposées en attributs
 * `data-`. Le reste de l'arbre est rendu tel quel (une `div` ou un `button`, avec ses
 * classes et son style).
 */
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const motion = new Proxy(
    {},
    {
      get: (_cible, balise: string) =>
        function Motion(props: {
          children?: React.ReactNode;
          whileHover?: unknown;
          whileTap?: unknown;
          transition?: unknown;
          onClick?: () => void;
          [cle: string]: unknown;
        }) {
          const { children, whileHover, whileTap, transition, onClick, ...reste } = props;
          return React.createElement(
            balise,
            {
              ...(reste as Record<string, string>),
              onClick,
              // Le `transform` que `whileHover` produirait réellement, au survol.
              onMouseEnter: (evenement: React.MouseEvent<HTMLElement>) => {
                if (whileHover) evenement.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
              },
              'data-while-hover': whileHover ? 'oui' : undefined,
              'data-while-tap': whileTap ? 'oui' : undefined,
              'data-transition': transition ? 'oui' : undefined
            },
            children
          );
        }
    }
  );
  return { motion };
});

/**
 * Le gabarit de carte (#179) : ce qu'une carte de jeu porte — rareté, nom, Seuil, Pressions
 * et coût, illustration, faction — se **lit dans le rendu**. La mise en page (cadre, format,
 * atténuation) se juge à la capture ; ici, les éléments y sont et viennent des données.
 */
const planques = ALL_CARDS.filter(isPlanque);
const avecArt = planques.find((carte) => carte.art);
// Depuis le 26/10/2026, **toutes** les cartes de base ont une illustration : le cas
// « sans illustration » n'existe plus dans le catalogue, mais le **repli** doit rester
// gardé (une image peut manquer au registre, ou le champ être retiré). On le fabrique
// donc à partir d'une carte réelle, au lieu de dépendre d'une carte qui n'en a pas.
const sansArt = avecArt ? { ...avecArt, art: undefined } : undefined;
const comex = planques.find((carte) => carte.ex);
const action = ALL_CARDS.find((carte) => !isPlanque(carte));

describe('CardView — le gabarit à cadre', () => {
  it('une Planqué porte nom, Seuil, Pressions avec leur coût, faction et rareté', () => {
    const carte = planques.find((c) => c.attacks.length >= 2) as PlanqueCard;
    const { container } = render(<CardView card={carte} compact />);
    const face = container.querySelector('.card__face') as HTMLElement;

    expect(within(face).getByText(carte.name)).toHaveClass('card__name');
    expect(within(face).getByLabelText(`Seuil ${carte.hp}`)).toHaveTextContent(String(carte.hp));
    for (const attaque of carte.attacks) {
      expect(within(face).getByText(attaque.name)).toBeInTheDocument();
      expect(within(face).getAllByText(String(attaque.damage)).length).toBeGreaterThan(0);
    }
    expect(container.querySelectorAll('.card__attacks .pips')).toHaveLength(carte.attacks.length);
    expect(within(face).getByText(FACTION_META[carte.faction].short)).toBeInTheDocument();
    expect(within(face).getByText(RARITY_META[carte.rarity].label)).toBeInTheDocument();
  });

  it('le cadre porte la rareté, et la face est dedans (l’anneau n’est pas un filet)', () => {
    const carte = avecArt!;
    const { container } = render(<CardView card={carte} compact />);
    const cadre = container.querySelector('.card') as HTMLElement;
    expect(cadre.style.getPropertyValue('--rarity')).toBe(RARITY_META[carte.rarity].color);
    expect(cadre.style.getPropertyValue('--accent')).toBe(FACTION_META[carte.faction].color);
    expect(cadre.querySelector(':scope > .card__face')).not.toBeNull();
  });

  it('une carte avec illustration reçoit l’emblème de sa faction ; sans, le glyphe du fond suffit', () => {
    expect(avecArt, 'le catalogue a au moins une illustration').toBeDefined();
    expect(sansArt, 'le catalogue a au moins une carte sans illustration').toBeDefined();

    const avec = render(<CardView card={avecArt!} compact />);
    expect(avec.container.querySelector('.card__emblem')).toHaveTextContent(FACTION_META[avecArt!.faction].glyph);
    expect(avec.container.querySelector('.card__glyph')).toBeNull();
    avec.unmount();

    const sans = render(<CardView card={sansArt!} compact />);
    expect(sans.container.querySelector('.card__emblem')).toBeNull();
    expect(sans.container.querySelector('.card__glyph')).not.toBeNull();
    // Le repli sur l'aplat : le fond est la palette de la carte.
    expect((sans.container.querySelector('.card__art') as HTMLElement).style.background).not.toBe('');
  });

  it('un COMEX porte son statut et le cadre or', () => {
    const { container } = render(<CardView card={comex!} compact />);
    expect(screen.getByText('COMEX')).toHaveClass('card__comex');
    expect(container.querySelector('.card')).toHaveClass('card--comex');
  });

  it('une carte Action n’a ni Seuil ni barre de Seuil, mais son texte', () => {
    const { container } = render(<CardView card={action!} compact />);
    expect(container.querySelector('.card__seuil-badge')).toBeNull();
    expect(container.querySelector('.card__seuil')).toBeNull();
    expect(container.querySelector('.card__attacks')).toHaveTextContent(action!.text);
  });

  it('la flavour et l’identifiant ne sont écrits que sur la carte en grand', () => {
    const carte = planques[0];
    const petite = render(<CardView card={carte} compact />);
    expect(petite.container.querySelector('.card__flavor')).toBeNull();
    expect(petite.container.querySelector('.card__id')).toBeNull();
    petite.unmount();

    const grande = render(<CardView card={carte} />);
    expect(grande.container.querySelector('.card__flavor')).toHaveTextContent(carte.flavor);
    expect(grande.container.querySelector('.card__id')).not.toBeNull();
  });

  it('calme : ni `whileHover`, ni `transform`, ni nom, et le gabarit réduit imposé (#285, T2, #324)', () => {
    const carte = planques[0];

    const calme = render(<CardView card={carte} calme />);
    const carteCalme = calme.container.querySelector('.card') as HTMLElement;
    // Le gabarit réduit est **imposé** : pas de flavour, pas d'identifiant, la classe y est
    // sans que l'appelant ait passé `compact`.
    expect(carteCalme).toHaveClass('card--compact');
    // Le geste coupé est **le même drapeau** : la classe du silence y est aussi (#324).
    expect(carteCalme).toHaveClass('card--figee');
    expect(calme.container.querySelector('.card__flavor')).toBeNull();
    expect(calme.container.querySelector('.card__id')).toBeNull();
    // Aucun geste, donc : ni au survol (`whileHover` / `whileTap`), ni en `transform`.
    expect(carteCalme).not.toHaveAttribute('data-while-hover');
    expect(carteCalme).not.toHaveAttribute('data-while-tap');
    expect(carteCalme).not.toHaveAttribute('data-transition');
    fireEvent.mouseEnter(carteCalme);
    expect(carteCalme.style.transform).toBe('');
    calme.unmount();

    // **Le contrôle mord** : la même carte **sans** le drapeau porte le geste, et le survol
    // la transforme. Retirer le drapeau du composant fait donc tomber les assertions du
    // dessus.
    const animee = render(<CardView card={carte} />);
    const mobile = animee.container.querySelector('.card') as HTMLElement;
    expect(mobile).not.toHaveClass('card--compact');
    expect(mobile).not.toHaveClass('card--figee');
    expect(mobile).toHaveAttribute('data-while-hover', 'oui');
    expect(mobile).toHaveAttribute('data-while-tap', 'oui');
    fireEvent.mouseEnter(mobile);
    expect(mobile.style.transform).not.toBe('');
  });

  it('au plateau, la barre montre le Stress qui monte, et elle se lit (#187)', () => {
    const carte = planques[0];
    const { container } = render(<CardView card={carte} calme stress={15} seuil={60} />);
    const barre = container.querySelector('.card__seuil-bar') as HTMLElement;
    expect(barre).toHaveAttribute('aria-label', 'Stress 15 sur 60');
    const remplissage = barre.querySelector('.stress__fill') as HTMLElement;
    expect(remplissage.style.width).toBe('25%');
    expect(remplissage.className).not.toContain('is-high');

    const presque = render(<CardView card={carte} calme stress={50} seuil={60} />);
    expect(presque.container.querySelector('.stress__fill')).toHaveClass('is-high');
  });

  it('chargement : l’illustration repose sur l’aplat de faction, qui reste dessous (#131)', () => {
    const { container } = render(<CardView card={avecArt!} compact />);
    const art = container.querySelector('.card__art') as HTMLElement;
    // Deux couches : l'image, puis l'aplat — sans le second, la fenêtre reste un trou
    // tant que l'image n'est pas arrivée (ou si elle n'arrive pas, hors ligne).
    expect(art.style.background).toContain('url(');
    // Un **aplat** depuis #208, pas le dégradé de faction : un dégradé violet ou cyan sur
    // fond sombre est un tell d'UI générée (`impeccable`, `ai-color-palette`).
    expect(art.style.background).toContain('color-mix');
    expect(art.style.background).not.toContain('linear-gradient');
  });

  it('porte sa rareté en attribut, pour que le CSS traite une rareté sans recopier un hex (#208)', () => {
    const cou = planques.find((carte) => carte.rarity === 'COU');
    expect(cou, 'le catalogue a une Couronne').toBeDefined();
    const { container } = render(<CardView card={cou!} compact />);
    expect(container.querySelector('.card')).toHaveAttribute('data-rarity', 'COU');

    // Le contrôle mord : une autre rareté ne prend pas l'attribut de la Couronne.
    const commune = planques.find((carte) => carte.rarity === '1D');
    expect(commune, 'le catalogue a une carte commune').toBeDefined();
    const autre = render(<CardView card={commune!} compact />);
    expect(autre.container.querySelector('.card')).toHaveAttribute('data-rarity', '1D');
  });
});
