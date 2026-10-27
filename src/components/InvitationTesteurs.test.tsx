// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  InvitationTesteurs,
  LIBELLE_INVITATION,
  VARIABLE_INVITATION,
  invitationDiscord
} from '@/components/InvitationTesteurs';

/**
 * Le mot que D-117 a retiré pour désigner le testeur de l'alpha, assemblé en deux morceaux :
 * écrit d'un seul tenant, ce fichier de test serait compté par la garde de
 * `src/renommages.test.ts` comme une réintroduction du vieux mot.
 */
const MOT_ECARTE = new RegExp(`invi${'té'}`, 'i');

/**
 * La porte du serveur des testeurs (#317, D-118).
 *
 * Ce que ce test garde, et qui peut réellement échouer :
 *
 * 1. **vide veut dire rien** : sans invitation configurée, aucun bloc, aucun lien — pas un
 *    titre orphelin, pas un trou de mise en page. C'est l'état par défaut d'un build sans
 *    configuration, celui que la CI construit ;
 * 2. **renseignée, un seul lien** : externe, nouvel onglet, `rel="noreferrer noopener"`, et le
 *    libellé dit « testeur » (D-117) ;
 * 3. **aucun tiers embarqué** : ni `iframe`, ni `script`, ni `embed` — la page Confidentialité
 *    promet « aucun traceur », un embed la rendrait fausse ;
 * 4. **une adresse douteuse est refusée** : `javascript:`, `http:`, ou un hôte qui n'est pas
 *    Discord ne deviennent pas un lien cliquable. Le contrôle mord : sans lui, une valeur
 *    mal saisie passerait en silence dans le bouton.
 */
const INVITATION = 'https://discord.gg/planquex-test';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('l’invitation Discord — le seul module qui la lit', () => {
  it('vide ou absente, elle vaut `null` : rien à rendre', () => {
    expect(invitationDiscord({})).toBeNull();
    expect(invitationDiscord({ [VARIABLE_INVITATION]: '   ' })).toBeNull();
  });

  it('renseignée, elle rend l’adresse telle quelle', () => {
    expect(invitationDiscord({ [VARIABLE_INVITATION]: INVITATION })).toBe(INVITATION);
  });

  it('refuse une adresse qui n’est pas une invitation Discord en https', () => {
    for (const mauvaise of [
      'javascript:alert(1)',
      'http://discord.gg/planquex-test',
      'https://exemple.test/invitation',
      'https://discord.gg.evil.test/abc',
      'pas une adresse'
    ]) {
      expect(() => invitationDiscord({ [VARIABLE_INVITATION]: mauvaise }), mauvaise).toThrow(
        new RegExp(VARIABLE_INVITATION)
      );
    }
  });
});

describe('InvitationTesteurs — le rendu', () => {
  it('sans invitation, ne rend rien du tout, ni à Réglages ni au comité', () => {
    vi.stubEnv(VARIABLE_INVITATION, '');
    for (const ou of ['reglages', 'comite'] as const) {
      const { container, unmount } = render(<InvitationTesteurs ou={ou} />);
      expect(container.innerHTML, ou).toBe('');
      unmount();
    }
  });

  it('renseignée, rend un seul lien, externe, avec le bon `rel` et le mot « testeur »', () => {
    vi.stubEnv(VARIABLE_INVITATION, INVITATION);
    for (const ou of ['reglages', 'comite'] as const) {
      const { container, unmount } = render(<InvitationTesteurs ou={ou} />);
      const liens = container.querySelectorAll('a');
      expect(liens, ou).toHaveLength(1);

      const lien = liens[0];
      expect(lien.getAttribute('href'), ou).toBe(INVITATION);
      expect(lien.getAttribute('target'), ou).toBe('_blank');
      expect(lien.getAttribute('rel'), ou).toBe('noreferrer noopener');
      expect(lien.textContent, ou).toContain(LIBELLE_INVITATION);
      expect(lien.textContent, ou).toMatch(/testeur/i);
      expect(lien.textContent, ou).not.toMatch(MOT_ECARTE);

      unmount();
    }
    // Le libellé lui-même, hors rendu : la règle de vocabulaire de D-117.
    expect(LIBELLE_INVITATION).not.toMatch(MOT_ECARTE);
  });

  it('n’embarque aucun tiers : ni iframe, ni script, ni embed', () => {
    vi.stubEnv(VARIABLE_INVITATION, INVITATION);
    const { container } = render(<InvitationTesteurs ou="reglages" />);
    expect(container.querySelector('iframe, script, embed, object')).toBeNull();
  });

  it('dit que c’est facultatif, dans les deux emplacements', () => {
    vi.stubEnv(VARIABLE_INVITATION, INVITATION);
    for (const ou of ['reglages', 'comite'] as const) {
      const { unmount } = render(<InvitationTesteurs ou={ou} />);
      expect(screen.getAllByText(/facultatif/i).length, ou).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });
});
