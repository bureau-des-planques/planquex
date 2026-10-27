import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Confidentialite, CONTACT } from '@/pages/Confidentialite';

/**
 * La page de confidentialité est **publique** : elle se lit sans compte, et elle est exigée
 * par Google pour publier l'application OAuth (D-088).
 *
 * Ce test garde trois choses, et chacune peut échouer :
 *
 * 1. la page se rend **sans** compte, sans base et sans configuration ;
 * 2. elle dit les trois familles de données qu'on collecte réellement — un compte, ce qu'on
 *    écrit sur le mur, le déroulé des parties, solo comme à deux (D-105) — parce qu'une page
 *    qui oublierait l'une des trois serait un mensonge par omission ;
 * 3. elle donne un moyen d'écrire (l'adresse de contact), sans quoi on ne peut pas demander
 *    la suppression de ses données.
 *
 * Le contenu lui-même n'est pas figé mot pour mot : on vérifie les **rubriques**, pas les
 * phrases — une réécriture du texte ne doit pas casser le test, un retrait de rubrique, si.
 */
describe('Confidentialité — la page publique', () => {
  const rendre = () =>
    render(
      <MemoryRouter>
        <Confidentialite />
      </MemoryRouter>
    );

  it('se rend sans compte, sans base et sans configuration', () => {
    rendre();
    expect(screen.getByRole('heading', { level: 1, name: /confidentialité/i })).toBeTruthy();
  });

  it('nomme les trois familles de données réellement collectées', () => {
    rendre();
    // 1. le compte (Google ou courriel)
    expect(screen.getByText(/adresse de courriel et un identifiant technique/i)).toBeTruthy();
    // 2. ce qu'on écrit sur le mur
    expect(screen.getByText(/un post-it : son titre, son texte/i)).toBeTruthy();
    // 3. le déroulé des parties, solo comme à deux (D-105)
    expect(screen.getByText(/la graine de hasard, les deux Decks/i)).toBeTruthy();
  });

  it('dit aussi ce qu’on ne fait pas, et donne un moyen d’écrire', () => {
    rendre();
    expect(screen.getByText(/aucune publicité, aucun traceur/i)).toBeTruthy();
    const lien = screen.getByRole('link', { name: new RegExp(CONTACT.replace('.', '\\.')) });
    expect(lien.getAttribute('href')).toBe(`mailto:${CONTACT}`);
  });

  it('porte une adresse de contact plausible, jamais un reste de gabarit', () => {
    // Une page publiée avec « exemple.com » ou « à compléter » est un défaut visible.
    expect(CONTACT).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
    expect(CONTACT).not.toMatch(/exemple|a-completer|todo/i);
  });
});

/**
 * Le serveur des testeurs (#317, D-118).
 *
 * La page promet « aucun traceur » : un lien vers un **service tiers** doit donc y être dit.
 * Ce qui est gardé, et qui peut échouer :
 *
 * 1. la rubrique existe, et dit que rejoindre est **facultatif** — quitter le jeu sans
 *    rejoindre reste normal ;
 * 2. elle dit qu'on **sort du jeu** et que **Discord applique ses propres règles** : c'est la
 *    phrase qui empêche la page de laisser croire que le jeu garde ce qu'on y écrit ;
 * 3. elle ne dit **rien des annonces** : elles n'existent pas encore (#318), et une page qui
 *    décrit un flux qui n'est pas branché est un mensonge d'avance.
 */
describe('Confidentialité — le serveur des testeurs (#317)', () => {
  const rendre = () =>
    render(
      <MemoryRouter>
        <Confidentialite />
      </MemoryRouter>
    );

  it('dit que rejoindre est facultatif, hors du jeu, et que Discord a ses propres règles', () => {
    rendre();

    expect(screen.getByRole('heading', { level: 2, name: /serveur des testeurs/i })).toBeTruthy();
    expect(screen.getByText(/facultatif/i)).toBeTruthy();
    expect(screen.getAllByText(/discord/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/hors du jeu|service à part/i)).toBeTruthy();
    expect(screen.getByText(/ses propres règles|sa propre politique/i)).toBeTruthy();
  });

  it('ne dit rien des annonces tant qu’elles n’existent pas (#318)', () => {
    rendre();
    expect(document.body.textContent).not.toMatch(/annonce/i);
  });
});
