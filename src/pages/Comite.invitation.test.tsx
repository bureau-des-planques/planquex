// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * La porte du serveur des testeurs (#317, D-120) — au **pied du comité**.
 *
 * Le mur est lu dans le fichier du dépôt (`@/store/mur` est mocké), donc le rendu ne
 * contacte rien. Ce qui est gardé ici, c'est l'**emplacement** : au bas de la page, sous le
 * mur, le testeur qui a quelque chose à dire trouve la conversation ; sans invitation, il
 * n'y a rien de plus — pas de paragraphe vide, pas de lien mort.
 */
vi.mock('@/store/mur', async () => {
  const vrai = await vi.importActual<typeof import('@/store/mur')>('@/store/mur');
  return {
    ...vrai,
    DOCUMENT_MUR: { formulaire: 'https://exemple.test/formulaire', postits: [] }
  };
});

import { Comite } from './Comite';

const rendre = () =>
  render(
    <MemoryRouter>
      <Comite />
    </MemoryRouter>
  );

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('Comité — le serveur des testeurs (#317)', () => {
  it('sans invitation, ne rend aucun lien externe', () => {
    vi.stubEnv('VITE_DISCORD_INVITE', '');
    rendre();

    expect(screen.queryByRole('link', { name: /discord|serveur des testeurs/i })).toBeNull();
    expect(document.querySelector('a[href^="https://discord"]')).toBeNull();
  });

  it('avec invitation, pose le lien au pied du mur, en nouvel onglet', () => {
    vi.stubEnv('VITE_DISCORD_INVITE', 'https://discord.gg/planquex-test');
    const { container } = rendre();

    const lien = screen.getByRole('link', { name: /rejoindre le serveur des testeurs/i });
    expect(lien).toHaveAttribute('href', 'https://discord.gg/planquex-test');
    expect(lien).toHaveAttribute('target', '_blank');
    expect(lien).toHaveAttribute('rel', 'noreferrer noopener');

    // Aucun tiers embarqué, et un seul lien Discord.
    expect(container.querySelector('iframe, script, embed, object')).toBeNull();
    expect(container.querySelectorAll('a[href^="https://discord"]')).toHaveLength(1);
  });
});
