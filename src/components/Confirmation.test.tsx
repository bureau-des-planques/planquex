// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Confirmation } from './Confirmation';

/**
 * La confirmation du jeu (#131) : un geste irréversible ne part pas sur un clic seul, et
 * tout chemin de sortie qui n'est pas « confirmer » **annule**.
 */
function monter(open = true) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const vue = render(
    <Confirmation
      open={open}
      titre="Déclarer forfait ?"
      texte="La Direction l’emporte."
      confirmer="Abandonner"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
  return { onConfirm, onCancel, ...vue };
}

describe('Confirmation', () => {
  it('est un dialogue nommé, avec son texte', () => {
    monter();
    const dialogue = screen.getByRole('dialog', { name: /Déclarer forfait/ });
    expect(dialogue).toHaveTextContent('La Direction l’emporte.');
  });

  it('fermée, elle ne rend rien', () => {
    monter(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirmer appelle onConfirm, et seulement lui', () => {
    const { onConfirm, onCancel } = monter();
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Annuler annule, sans confirmer', () => {
    const { onConfirm, onCancel } = monter();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Échap annule : on n’efface rien par réflexe', async () => {
    const { onConfirm, onCancel } = monter();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('le focus d’ouverture est sur Annuler, pas sur le bouton destructeur', () => {
    monter();
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus();
  });
});
