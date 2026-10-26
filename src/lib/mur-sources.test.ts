import { describe, expect, it } from 'vitest';
import { adaptateurFichier, resoudreAdaptateur } from '@/lib/murAdaptateurs';
import { creerMur } from '@/lib/mur';
import type { ClientMur } from '@/lib/supabase';

/**
 * **Le choix de la source, et l'ordre des refus** — les deux trous de la relecture du
 * 26/10/2026 (#254).
 *
 * Le port promet deux choses que rien ne gardait :
 * 1. il **ne lève pas**, même quand le client Supabase ne se charge pas ;
 * 2. sur une source en **lecture seule**, le refus rendu est celui de **la source**, avant
 *    celui du brouillon — sans base, personne n'aurait pu écrire ce brouillon.
 *
 * Chaque test porte son cas fautif : c'est ce qui le rend capable d'échouer.
 */

/** Un client factice : `resoudreAdaptateur` ne fait que le retenir et le rendre. */
const FAUX_CLIENT = { from: () => ({}) } as unknown as ClientMur;

describe('resoudreAdaptateur — les trois cas de l’en-tête de murBase.ts', () => {
  it('sans client, c’est le fichier qui lit — et la base n’est pas annoncée', async () => {
    const { adaptateur, base } = await resoudreAdaptateur(async () => null);
    expect(base).toBe(false);
    expect(adaptateur.source).toBe('fichier');
  });

  it('avec un client, c’est la base', async () => {
    const { adaptateur, base } = await resoudreAdaptateur(async () => FAUX_CLIENT);
    expect(base).toBe(true);
    expect(adaptateur.source).toBe('base');
  });

  it('un client qui **rejette** retombe sur le fichier au lieu de lever', async () => {
    // Le cas trouvé par la relecture : `configurerMur` lève sur une configuration à moitié
    // posée, et l'import dynamique du SDK peut échouer. Sans `catch`, l'erreur remontait
    // jusqu'à l'écran — le seul chemin par lequel le port pouvait encore faire lever.
    const resolution = await resoudreAdaptateur(async () => {
      throw new Error('Configuration Supabase incomplète');
    });

    expect(resolution.base).toBe(false);
    expect(resolution.adaptateur.source).toBe('fichier');
    // Le contrôle mord : avec la version d'avant, `resoudreAdaptateur` rejetait ici.
    await expect(
      resoudreAdaptateur(async () => {
        throw new Error('Configuration Supabase incomplète');
      })
    ).resolves.toBeDefined();
  });
});

describe('le refus de la source passe avant celui du brouillon', () => {
  it('sur le fichier, un brouillon invalide rend le message de la source', async () => {
    const mur = creerMur(adaptateurFichier());

    // Brouillon volontairement vide : la composition le refuserait aussi. Ce qui compte est
    // **lequel** des deux refus arrive — celui de la source, qui dit la vérité du moment.
    const resultat = await mur.poster({ texte: '', famille: null } as never);

    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.message).toBe('Le mur n’est pas configuré : le retour se donne pour l’instant de vive voix.');
    // Contrôle : le message de composition, lui, ne dit pas la même chose.
    expect(resultat.message).not.toMatch(/Choisis|obligatoire|trop long/i);
  });

  it('sur le fichier, l’ordre est **validation puis source** pour un tri et une place', async () => {
    // L'ordre n'est pas le même que pour `poster`, et c'est voulu : un tri ou une place se
    // valident avant d'interroger la source (c'était déjà le cas dans `murBase.ts`). Ce
    // test fixe l'asymétrie au lieu de la laisser au hasard d'un remaniement.
    const mur = creerMur(adaptateurFichier());

    const triInvalide = await mur.trier('p-1', { statut: 'inconnu', raison: '', ticket: null } as never);
    const placeInvalide = await mur.deplacer('p-1', { x: -50, y: 400, angle: 0 } as never);
    expect(triInvalide.ok).toBe(false);
    expect(placeInvalide.ok).toBe(false);
    if (triInvalide.ok || placeInvalide.ok) return;
    expect(triInvalide.message).toContain('n’est pas un statut');
    expect(placeInvalide.message).toMatch(/place|position|hors/i);

    // Valides, ils atteignent la source — qui refuse, en lecture seule.
    const triValide = await mur.trier('p-1', { statut: 'retenu', raison: '', ticket: null } as never);
    const placeValide = await mur.deplacer('p-1', { x: 50, y: 40, angle: 2 } as never);
    expect(triValide.ok).toBe(false);
    expect(placeValide.ok).toBe(false);
    if (triValide.ok || placeValide.ok) return;
    expect(triValide.message).toContain('pas de mur à trier');
    expect(placeValide.message).toContain('la place ne peut pas s’écrire');
  });
});
