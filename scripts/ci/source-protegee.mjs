// source-protegee — une source mutée par un harnais revient toujours à son état d'origine.
//
// Pourquoi ce module existe (ticket #622, rétro du 02/11/2026) : `garde-fous.mjs` restaure
// chaque fichier dans un `finally`, et un `finally` **ne s'exécute pas** quand le processus
// meurt sur un signal. Le 02/11/2026, un `npm run garde-fous` interrompu a laissé
// `src/components/InvitationTesteurs.tsx` muté, sans que rien ne le dise. Une source du
// dépôt laissée dans un état faux peut être **commitée** ; c'est pire qu'un test lent.
//
// Deux protections, et il faut les deux :
//
// 1. un **journal** écrit **avant** la mutation, qui porte la source d'origine. Il survit à
//    tout, y compris à un `SIGKILL` que Node ne peut pas intercepter ;
// 2. des **gestionnaires de signal**, qui restaurent tout de suite quand le signal arrive
//    pendant que JavaScript tourne.
//
// Le journal vit dans `node_modules/`, donc ignoré par git : un dépôt propre le reste même
// après une coupure.
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** La mutation en cours, s'il y en a une. */
let enCours = null;

/** Le journal d'une racine de dépôt — un seul à la fois, le harnais mute séquentiellement. */
export function cheminJournal(racine) {
  return join(racine, 'node_modules', '.garde-fous-en-cours.json');
}

/**
 * Écrit le journal, **puis** rend la source d'origine.
 *
 * L'appelant écrit la mutation après cet appel : entre les deux, le journal est déjà là.
 */
export function proteger(fichier, journal) {
  const original = readFileSync(fichier, 'utf8');
  writeFileSync(journal, JSON.stringify({ fichier, original }), 'utf8');
  enCours = { fichier, journal, original };
  return original;
}

/**
 * Oublie la mutation en cours et efface le journal. Appelé après une restauration réussie :
 * le journal qui resterait ferait « réparer » une source pourtant saine au démarrage suivant.
 */
export function terminer() {
  const mutation = enCours;
  enCours = null;
  if (!mutation) return false;
  try {
    unlinkSync(mutation.journal);
  } catch {
    // Le journal a déjà disparu : ce n'est pas une erreur, l'état est celui qu'on veut.
  }
  return true;
}

/**
 * Restaure la source de la mutation en cours, si elle existe. Rend `true` si quelque chose
 * a été restauré — c'est ce que le gestionnaire de signal dit à l'utilisateur.
 */
export function restaurer() {
  if (!enCours) return false;
  writeFileSync(enCours.fichier, enCours.original);
  terminer();
  return true;
}

/**
 * Répare ce qu'une exécution précédente a laissé : restaure le fichier depuis le journal,
 * efface le journal, et rend le chemin réparé (ou `null` s'il n'y avait rien à faire).
 *
 * Ne devine rien : sans journal, il n'y a rien à réparer, et on ne touche à aucun fichier.
 */
export function reparerAuDemarrage(journal) {
  if (!existsSync(journal)) return null;
  let contenu;
  try {
    contenu = JSON.parse(readFileSync(journal, 'utf8'));
  } catch (erreur) {
    throw new Error(
      `journal de mutation illisible (${journal}) : ${erreur.message}. ` +
        'Restaure la source à la main (`git checkout -- <fichier>`), puis relance.'
    );
  }
  if (typeof contenu?.fichier !== 'string' || typeof contenu?.original !== 'string') {
    throw new Error(
      `journal de mutation incomplet (${journal}) : il lui manque le fichier ou la source d’origine. ` +
        'Restaure la source à la main, puis relance.'
    );
  }
  writeFileSync(contenu.fichier, contenu.original);
  unlinkSync(journal);
  // Ce journal-là est réparé : plus rien n'est « en cours », même si ce processus l'avait
  // ouvert (le test le fait, et un harnais relancé dans le même processus ne doit pas
  // restaurer deux fois).
  if (enCours?.journal === journal) enCours = null;
  return contenu.fichier;
}

/**
 * Restaure sur `SIGINT`, `SIGTERM` et `SIGHUP`, puis sort en **130** (le code d'un
 * processus interrompu). Un `SIGKILL` n'est pas interceptable : c'est le journal qui le
 * couvre, au démarrage suivant.
 *
 * `sortie` est injectable pour que le test n'ait pas à tuer le worker de Vitest.
 */
export function installerSignaux({
  signaux = ['SIGINT', 'SIGTERM', 'SIGHUP'],
  sortie = (code) => process.exit(code),
  dire = (message) => console.error(message)
} = {}) {
  for (const signal of signaux) {
    process.once(signal, () => {
      const restaure = restaurer();
      dire(
        restaure ? `\n✖ ${signal} : la source mutée a été restaurée.` : `\n✖ ${signal} : aucune source n'était mutée.`
      );
      sortie(130);
    });
  }
}
