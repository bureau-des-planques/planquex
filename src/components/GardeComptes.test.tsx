// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { GardeComptes } from './GardeComptes';
import { useComptes } from '@/store/comptes';
import type { Compte } from '@/lib/comptes';

/**
 * La garde d'entrée (D-088, D-156, #527).
 *
 * Ce qu'elle juge : **l'identité**, pas l'état du compte — sauf le refus, seule exception
 * écrite (D-156 (3)). Cinq cas, et chacun peut réellement échouer :
 *
 * 1. personne → la connexion, avec la destination mémorisée ;
 * 2. une session **anonyme** → la connexion (c'est le bug #527 : elle passait) ;
 * 3. un compte **en attente** → le jeu (D-088 : il joue et lit) ;
 * 4. un compte **approuvé** → le jeu ;
 * 5. un compte **refusé** → l'attente, sa raison, et lui seul.
 *
 * Et le cas de la base en retard : un compte réel dont la ligne est illisible traverse
 * (`compte: null`, `erreur` renseignée) — D-088 veut que l'erreur de lecture ne ferme pas
 * l'entrée.
 */

const EN_ATTENTE: Compte = {
  id: 'compte-a',
  courriel: 'a@exemple.test',
  etat: 'en attente',
  raison: '',
  administrateur: false,
  medaille_periode_essai: false,
  medaille_periode_essai_le: null,
  created_at: '2026-10-30T10:00:00.000Z'
};

const APPROUVE: Compte = { ...EN_ATTENTE, etat: 'approuve' };
const REFUSE: Compte = { ...EN_ATTENTE, etat: 'refuse', raison: 'pas cette fois' };

/** Le compte, tel que le store le porte : le drapeau d'anonymat vient de la session. */
const SESSION = { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false };
const SESSION_ANONYME = { id: 'appareil-anonyme', courriel: '', anonyme: true };

function poser(etat: Partial<ReturnType<typeof useComptes.getState>> = {}) {
  useComptes.setState({
    configure: true,
    chargement: false,
    session: null,
    compte: null,
    erreur: null,
    ...etat
  });
}

/** La connexion affiche d'où l'on vient : la garde doit le transmettre. */
function ConnexionTemoin() {
  const { state } = useLocation();
  const depuis = (state as { depuis?: string } | null)?.depuis ?? '';
  return <p>la connexion depuis {depuis}</p>;
}

function rendre(adresse = '/') {
  return render(
    <MemoryRouter initialEntries={[adresse]}>
      <Routes>
        <Route path="/connexion" element={<ConnexionTemoin />} />
        <Route path="/attente" element={<p>l’attente</p>} />
        <Route
          path="*"
          element={
            <GardeComptes>
              <p>le bureau</p>
            </GardeComptes>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  poser();
});

describe('la garde d’entrée (D-088, D-156)', () => {
  it('sans session, renvoie vers la connexion en mémorisant la destination', () => {
    poser();
    rendre('/deck');
    expect(screen.getByText('la connexion depuis /deck')).toBeInTheDocument();
    expect(screen.queryByText('le bureau')).toBeNull();
  });

  it('une session anonyme n’est pas un compte : retour à la connexion (#527)', () => {
    poser({ session: SESSION_ANONYME });
    rendre('/');
    expect(screen.getByText(/la connexion/)).toBeInTheDocument();
    expect(screen.queryByText('le bureau')).toBeNull();
  });

  it('un compte en attente entre et joue (D-088)', () => {
    poser({ session: SESSION, compte: EN_ATTENTE });
    rendre('/');
    expect(screen.getByText('le bureau')).toBeInTheDocument();
  });

  it('un compte approuvé entre', () => {
    poser({ session: SESSION, compte: APPROUVE });
    rendre('/');
    expect(screen.getByText('le bureau')).toBeInTheDocument();
  });

  it('un compte refusé ne joue pas : l’attente, et rien d’autre (D-156 (3))', () => {
    poser({ session: SESSION, compte: REFUSE });
    rendre('/');
    expect(screen.getByText('l’attente')).toBeInTheDocument();
    expect(screen.queryByText('le bureau')).toBeNull();
  });

  it('un compte refusé peut encore lire l’attente', () => {
    poser({ session: SESSION, compte: REFUSE });
    rendre('/attente');
    expect(screen.getByText('l’attente')).toBeInTheDocument();
  });

  it('une base en retard ne ferme pas l’entrée : compte illisible, session valable', () => {
    poser({ session: SESSION, compte: null, erreur: 'Lecture de ton compte impossible.' });
    rendre('/');
    expect(screen.getByText('le bureau')).toBeInTheDocument();
  });

  it('sans base configurée, la garde laisse tout passer (comportement d’avant D-088)', () => {
    poser({ configure: false });
    rendre('/');
    expect(screen.getByText('le bureau')).toBeInTheDocument();
  });

  it('au premier rendu, attend la session au lieu de renvoyer un testeur déjà connecté', () => {
    poser({ chargement: true, session: null });
    rendre('/');
    expect(screen.getByRole('status')).toHaveTextContent(/Vérification de ta session/);
  });
});
