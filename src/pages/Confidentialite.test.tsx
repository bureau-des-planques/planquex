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
