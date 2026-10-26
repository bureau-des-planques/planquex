import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { basename } from 'node:path';

/**
 * Un test n'ouvre rien sur le poste de l'utilisateur.
 *
 * Le 25/10/2026, `admin.test.ts` appelait un vrai `xdg-open` : à chaque `npm test`, de n'importe
 * quelle session, la page du poste admin (`?jeton=test`) s’ouvrait dans le navigateur de Bastien.
 * Quatre heures de diagnostic ont accusé le navigateur avant que la cause soit trouvée.
 *
 * Ce fichier fait échouer tout lancement d'un ouvreur de fenêtre. Le test doit injecter son
 * lanceur (`ouvrirNavigateur(url, faux)`). Garde : `setup-poste.test.ts`.
 */
const OUVREURS = new Set(['xdg-open', 'open', 'gio', 'sensible-browser', 'x-www-browser', 'wslview']);

export function estOuvreur(commande: unknown): boolean {
  return typeof commande === 'string' && OUVREURS.has(basename(commande));
}

export function refuserOuverture<A extends unknown[], R>(reel: (commande: string, ...reste: A) => R) {
  return (commande: string, ...reste: A): R => {
    if (estOuvreur(commande)) {
      throw new Error(
        `Un test a lancé « ${commande} » : il ouvrirait une fenêtre sur le poste de l'utilisateur. Injecter le lanceur.`,
      );
    }
    return reel(commande, ...reste);
  };
}

const cp = childProcess as unknown as Record<string, (commande: string, ...reste: unknown[]) => unknown>;
for (const nom of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {
  cp[nom] = refuserOuverture(cp[nom]!.bind(childProcess));
}
syncBuiltinESMExports();
