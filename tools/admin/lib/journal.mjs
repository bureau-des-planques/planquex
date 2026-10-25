/**
 * Le journal du poste de pilotage (#184) — un flux JSONL hors du dépôt.
 *
 * Chaque geste ou requête écrit **une ligne** : `date`, `geste` (ou la nature d'une requête),
 * `role`, `duree_ms` (la durée), `resultat` (`ok` | `refuse` | `erreur`). **Jamais de valeur de
 * donnée personnelle** : ni courriel, ni pseudo, ni corps de requête — un courriel révélé
 * n'entre pas au journal, un SQL libre y entre seulement par son **empreinte** sha256.
 *
 * Le chemin par défaut est `~/.local/state/planquex-admin/journal.jsonl` (hors du dépôt), et
 * se surcharge par `ADMIN_JOURNAL_FICHIER` pour que les tests écrivent dans un bac temporaire.
 */
import { mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

/** Le fichier du journal : hors du dépôt, dans l'état local de l'utilisateur (XDG). */
export function cheminJournalParDefaut(env = process.env) {
  if (env.ADMIN_JOURNAL_FICHIER) return resolve(env.ADMIN_JOURNAL_FICHIER);
  const racine = env.XDG_STATE_HOME || resolve(homedir(), '.local', 'state');
  return resolve(racine, 'planquex-admin', 'journal.jsonl');
}

/** Un écrivain de journal : une seule ligne par appel, ajoutée à la fin, jamais réécrite. */
export function creerJournal(chemin = cheminJournalParDefaut()) {
  return {
    chemin,
    ecrire(ligne) {
      mkdirSync(dirname(chemin), { recursive: true });
      appendFileSync(chemin, `${JSON.stringify(ligne)}\n`, 'utf8');
    },
  };
}

/** Les dernières lignes du journal : ce que le poste affiche sans être la base. */
export function lireJournal(chemin) {
  let lignes = [];
  try {
    lignes = readFileSync(chemin, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((ligne) => JSON.parse(ligne));
  } catch {
    // Journal absent ou illisible : le poste affiche « rien », ce n'est pas un blocage.
    lignes = [];
  }
  return lignes;
}