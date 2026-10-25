// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ALL_CARDS, FACTION_META, RARITY_META, isPlanque } from '@/data';
import type { PlanqueCard } from '@/data/types';
import { CardView } from './CardView';

/**
 * Le gabarit de carte (#179) : ce qu'une carte de jeu porte — rareté, nom, Seuil, Pressions
 * et coût, illustration, faction — se **lit dans le rendu**. La mise en page (cadre, format,
 * atténuation) se juge à la capture ; ici, les éléments y sont et viennent des données.
 */
const planques = ALL_CARDS.filter(isPlanque);
const avecArt = planques.find((carte) => carte.art);
const sansArt = planques.find((carte) => !carte.art && !carte.ex);
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

  it('figée : la carte du plateau ne se soulève pas au survol (#187)', () => {
    const carte = planques[0];
    const figee = render(<CardView card={carte} compact figee />);
    expect(figee.container.querySelector('.card')).toHaveClass('card--figee');
    figee.unmount();

    // Le contrôle mord : sans la prop, la classe n'existe pas — si quelqu'un retire le
    // drapeau, la première assertion tombe.
    const animee = render(<CardView card={carte} compact />);
    expect(animee.container.querySelector('.card')).not.toHaveClass('card--figee');
  });

  it('au plateau, la barre montre le Stress qui monte, et elle se lit (#187)', () => {
    const carte = planques[0];
    const { container } = render(<CardView card={carte} compact figee stress={15} seuil={60} />);
    const barre = container.querySelector('.card__seuil-bar') as HTMLElement;
    expect(barre).toHaveAttribute('aria-label', 'Stress 15 sur 60');
    const remplissage = barre.querySelector('.stress__fill') as HTMLElement;
    expect(remplissage.style.width).toBe('25%');
    expect(remplissage.className).not.toContain('is-high');

    const presque = render(<CardView card={carte} compact figee stress={50} seuil={60} />);
    expect(presque.container.querySelector('.stress__fill')).toHaveClass('is-high');
  });

  it('chargement : l’illustration repose sur l’aplat de faction, qui reste dessous (#131)', () => {
    const { container } = render(<CardView card={avecArt!} compact />);
    const art = container.querySelector('.card__art') as HTMLElement;
    // Deux couches : l'image, puis la palette — sans la seconde, la fenêtre reste un trou
    // tant que l'image n'est pas arrivée (ou si elle n'arrive pas, hors ligne).
    expect(art.style.background).toContain('url(');
    expect(art.style.background).toContain('linear-gradient');
  });
});
