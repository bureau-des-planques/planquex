/**
 * Le mur branché sur la base — la **couture** historique, désormais **déléguée** (#254).
 *
 * Ce module portait un miroir 1:1 des requêtes : une fonction par appel réseau, un
 * `messageDeX` par famille de refus. Depuis le ticket #254, les **sept gestes** du mur
 * (`charger`, `poster`, `voter`, `trier`, `deplacer`, `corriger`, `retirer`) vivent dans un
 * **port** — `src/lib/mur.ts` — branché sur trois **adapters** (`src/lib/murAdaptateurs.ts`) :
 * la base, le fichier, la mémoire.
 *
 * **Ce fichier reste, et délègue** : ses fonctions gardent leur nom, leur signature et leurs
 * messages, pour qu'aucun appelant ne casse (les pages, les composants et leurs tests s'en
 * servent tels quels). Ce qui n'est pas un geste reste **ici** :
 *
 * - **le fil d'un post-it** (#138) — commenter, lire, retirer son commentaire ;
 * - **le repère du suivi** (D-097 (5), migration `0008`) — `public.marquer_comite_vu()`,
 *   jamais un `update` de `comptes` dont la RLS ne distingue pas les colonnes ;
 * - **le compteur « choses à voir »** (#212) — trois lectures fixes, jamais une par post-it.
 *
 * **Les deux sources, et le repli** : la base est configurée (`VITE_SUPABASE_URL` +
 * `VITE_SUPABASE_ANON_KEY`) ou elle ne l'est pas — dans le second cas `chargerPostitsDuMur`
 * rend `null` et la page garde le fichier qu'elle a déjà bundlé (D-058). Une base configurée
 * qui **ne répond pas** lève : la page retombe sur le fichier avec un message. C'est le port
 * qui décide de ce repli (`creerMur(adaptateur, { secours })`) ; ici, on se contente de
 * traduire son résultat dans l'ancien contrat, qui lève.
 */
import { clientMur, identiteAppareil, type ClientMur } from '@/lib/supabase';
import { adaptateurFichier, resoudreAdaptateur } from '@/lib/murAdaptateurs';
import {
  creerMur,
  estEntier,
  estObjet,
  type BrouillonPostit,
  type Correction,
  type OptionsPostit,
  type TriPostit
} from '@/lib/mur';
import type { Postit, PositionPostit, SensVote } from '@/store/mur';

// Les primitives du port et son choix de source sont **réexportés** : ils étaient l'API de ce
// module, et un appelant qui les importait d'ici n'a pas à changer (#254).
export {
  composerLignePostit,
  compterApres,
  gesteDeVote,
  idPostit,
  lireMesVotes,
  lirePostitsDeLaBase,
  messageDeCorrection,
  messageDePlace,
  messageDeTri,
  messageDeVote,
  positionDepuisId,
  texteAvecCapture,
  titreDepuisTexte,
  verifierPosition,
  verifierTri
} from '@/lib/mur';
export type { BrouillonPostit, OptionsPostit, TriPostit } from '@/lib/mur';
export { murEstConfigure } from '@/lib/murAdaptateurs';

// ---------------------------------------------------------------------------------------------
// Les sept gestes — délégués au port (#254)
// ---------------------------------------------------------------------------------------------

/** Les options d'un dépôt, plus la couture réseau (injectable pour un test déterministe). */
export type OptionsPostitDuJeu = OptionsPostit & {
  chargerClient?: () => Promise<ClientMur | null>;
};

/**
 * Lit le mur dans la base. Rend `null` quand aucune base n'est configurée : c'est le signal
 * « garde ton fichier » (D-058). Une base configurée qui ne répond pas **lève** — le port a
 * lu le fichier de secours, et lève avec la notice de la panne pour que la page le dise sans
 * afficher un mur vide qui aurait l'air vrai.
 *
 * Une session est signée **avant** la lecture : les droits sont donnés au rôle
 * `authenticated`, pas à `anon` (migration #135, D-088).
 */
export async function chargerPostitsDuMur(
  chargerClient: () => Promise<ClientMur | null> = clientMur
): Promise<Postit[] | null> {
  const { adaptateur, base } = await resoudreAdaptateur(chargerClient);
  if (!base) return null;

  const resultat = await creerMur(adaptateur, { secours: adaptateurFichier() }).charger();
  if (!resultat.ok) throw new Error(resultat.message);
  if (resultat.source !== 'base') {
    throw new Error(resultat.notice ?? 'La base n’a pas répondu : le mur retombe sur le fichier.');
  }
  return resultat.postits;
}

/**
 * Poste un post-it depuis le jeu, et le rend dans la forme du contrat pour que l'écran
 * l'affiche sans relire la base. Sans configuration, le port refuse **avant** d'écrire : le
 * bouton n'est qu'une seconde garde.
 */
export async function posterPostit(brouillon: BrouillonPostit, options: OptionsPostitDuJeu = {}): Promise<Postit> {
  const { adaptateur } = await resoudreAdaptateur(options.chargerClient ?? clientMur);
  const resultat = await creerMur(adaptateur).poster(brouillon, options);
  if (!resultat.ok) throw new Error(resultat.message);
  return resultat.postit;
}

/**
 * Vote, change ou retire mon pouce sur un post-it (#137) : le port décide du geste
 * (`gesteDeVote`) et rend mon vote **après**.
 */
export async function voterPourPostit(
  postitId: string,
  demande: SensVote,
  actuel: SensVote | null,
  options: { chargerClient?: () => Promise<ClientMur | null> } = {}
): Promise<SensVote | null> {
  const { adaptateur } = await resoudreAdaptateur(options.chargerClient ?? clientMur);
  const resultat = await creerMur(adaptateur).voter(postitId, demande, actuel);
  if (!resultat.ok) throw new Error(resultat.message);
  return resultat.vote;
}

/**
 * Déplace le tri d'un post-it — le geste de l'**administration** (0006, D-088). Le contrôle
 * (`verifierTri`) passe avant la source, et une modification qui ne touche aucune ligne n'est
 * jamais un succès.
 */
export async function trierPostit(
  id: string,
  tri: TriPostit,
  options: { chargerClient?: () => Promise<ClientMur | null> } = {}
): Promise<TriPostit> {
  const { adaptateur } = await resoudreAdaptateur(options.chargerClient ?? clientMur);
  const resultat = await creerMur(adaptateur).trier(id, tri);
  if (!resultat.ok) throw new Error(resultat.message);
  return resultat.tri;
}

/**
 * Écrit la place d'un post-it en base (#185, #186) : le geste passe par `deplacer_postit`
 * (0007), jamais par un `update` — une politique RLS ne distingue pas les colonnes (D-092).
 * La place rendue est celle que la base a gardée, arrondie au dixième.
 */
export async function deplacerPostit(
  id: string,
  position: PositionPostit,
  options: { chargerClient?: () => Promise<ClientMur | null> } = {}
): Promise<PositionPostit> {
  const { adaptateur } = await resoudreAdaptateur(options.chargerClient ?? clientMur);
  const resultat = await creerMur(adaptateur).deplacer(id, position);
  if (!resultat.ok) throw new Error(resultat.message);
  return resultat.position;
}

/**
 * Corrige le titre et le texte d'un post-it, **par son auteur** et **tant qu'il est
 * `en attente`** (#139). Le geste passe par la fonction `corriger_postit` (0006).
 */
export async function corrigerPostit(
  id: string,
  correction: Correction,
  options: { chargerClient?: () => Promise<ClientMur | null> } = {}
): Promise<Correction> {
  const { adaptateur } = await resoudreAdaptateur(options.chargerClient ?? clientMur);
  const resultat = await creerMur(adaptateur).corriger(id, correction);
  if (!resultat.ok) throw new Error(resultat.message);
  return { titre: resultat.titre, texte: resultat.texte };
}

/**
 * Retire mon post-it : il est **supprimé** (§3 de `docs/COMITE.md`). L'**administration**,
 * elle, retire n'importe quel post-it à n'importe quel statut (#186, `0007`) — c'est la RLS
 * qui décide, et le geste est visé par son seul `id`.
 */
export async function retirerPostit(
  id: string,
  options: { chargerClient?: () => Promise<ClientMur | null> } = {}
): Promise<void> {
  const { adaptateur } = await resoudreAdaptateur(options.chargerClient ?? clientMur);
  const resultat = await creerMur(adaptateur).retirer(id);
  if (!resultat.ok) throw new Error(resultat.message);
}

// ---------------------------------------------------------------------------------------------
// Le fil d'un post-it — commenter, et retirer son commentaire (#138)
// ---------------------------------------------------------------------------------------------

/**
 * La longueur maximale d'un commentaire (#138). Un commentaire précise un cas, il ne
 * remplace pas un post-it ; l'écran dit la limite **avant** de refuser, et la dépasse en le
 * disant (le message porte les deux nombres).
 *
 * Cette limite est tenue par l'écran : la base ne la connaît pas (elle ne vérifie que « non
 * vide »). Ce n'est pas un droit, c'est une forme — un client bricolé qui l'ignore ne
 * contourne aucun accès.
 */
export const LIMITE_COMMENTAIRE = 500;

/** Un commentaire tel que l'écran le lit — jamais l'identité d'un autre. */
export interface Commentaire {
  /** `bigint` en base, donc un nombre ici : l'`id` sert au retrait, pas au tri. */
  id: number;
  postitId: string;
  texte: string;
  pseudo: string;
  /** La date de la base (ISO 8601), `''` si elle manque. */
  creeLe: string;
  /** `true` quand c'est le mien : seul celui-là se retire (#138). */
  mien: boolean;
}

/**
 * Une ligne de `public.commentaires` ramenée à ce que l'écran affiche. `auteur` ne sort pas
 * d'ici : on n'en garde que la réponse à « est-ce le mien ? », parce que c'est la seule
 * chose dont l'écran a besoin.
 */
export function lireCommentaire(ligne: unknown, identite: string | null): Commentaire | null {
  if (!estObjet(ligne)) return null;
  if (!estEntier(ligne.id)) return null;
  if (typeof ligne.postit_id !== 'string' || !ligne.postit_id) return null;
  if (typeof ligne.texte !== 'string' || !ligne.texte.trim()) return null;
  return {
    id: ligne.id,
    postitId: ligne.postit_id,
    texte: ligne.texte,
    pseudo: typeof ligne.pseudo === 'string' ? ligne.pseudo : '',
    creeLe: typeof ligne.created_at === 'string' ? ligne.created_at : '',
    mien: identite !== null && ligne.auteur === identite
  };
}

/** Les commentaires lisibles ; une ligne illisible est **écartée**, pas affichée à moitié. */
export function lireCommentaires(lignes: unknown, identite: string | null): Commentaire[] {
  if (!Array.isArray(lignes)) return [];
  return lignes.flatMap((ligne): Commentaire[] => {
    const lu = lireCommentaire(ligne, identite);
    return lu ? [lu] : [];
  });
}

/**
 * Le fil, rangé par post-it, **du plus ancien au plus récent** (l'ordre de la lecture :
 * `created_at` croissant, sans imbrication). Un post-it sans commentaire n'a pas de clé.
 */
export function grouperCommentaires(liste: readonly Commentaire[]): Record<string, Commentaire[]> {
  const parPostit: Record<string, Commentaire[]> = {};
  for (const commentaire of liste) {
    (parPostit[commentaire.postitId] ??= []).push(commentaire);
  }
  return parPostit;
}

/**
 * Le refus qu'un commentaire mérite, ou `null` s'il est acceptable. Séparé de l'envoi pour
 * que l'écran dise la règle **pendant** la frappe, et pas seulement après un refus.
 */
export function verifierCommentaire(texte: string): string | null {
  const propre = texte.trim();
  if (!propre) return 'Un commentaire vide ne dit rien : écris au moins un mot.';
  if (propre.length > LIMITE_COMMENTAIRE) {
    return `Un commentaire fait au plus ${LIMITE_COMMENTAIRE} caractères (le tien en fait ${propre.length}).`;
  }
  return null;
}

/** Un refus de la base sur un commentaire, dit en français. */
export function messageDeCommentaire(message: string): string {
  if (/row-level security/i.test(message)) {
    return 'La base refuse ce commentaire : ton compte doit être approuvé avant d’écrire.';
  }
  if (/foreign key/i.test(message)) return 'Ce post-it n’existe plus : recharge le mur.';
  return `Le commentaire n’est pas passé (${message}).`;
}

/**
 * Lit **tous** les commentaires du mur, du plus ancien au plus récent. La lecture est
 * ouverte à un compte en attente (D-088) : c'est l'écriture qui exige l'approbation.
 *
 * Sans configuration, rend une liste vide sans rien contacter — le mur est alors le fichier,
 * qui ne porte pas de commentaires.
 */
export async function chargerCommentaires(
  chargerClient: () => Promise<ClientMur | null> = clientMur
): Promise<Commentaire[]> {
  const client = await chargerClient();
  if (!client) return [];

  const identite = await identiteAppareil(chargerClient);
  if (!identite) throw new Error('Aucune session : la base refuse la lecture des commentaires.');

  const { data, error } = await client
    .from('commentaires')
    .select('id, postit_id, texte, pseudo, auteur, created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Lecture des commentaires impossible : ${error.message}`);
  return lireCommentaires(data ?? [], identite);
}

/**
 * Commente un post-it. Le client n'écrit **jamais** `auteur` : la base le remplit par
 * `auth.uid()`, et sa politique d'insertion (0005) exige en plus un compte **approuvé** —
 * un compte en attente est refusé par la base, pas seulement par l'écran.
 */
export async function commenterPostit(
  postitId: string,
  texte: string,
  options: { pseudo?: string; chargerClient?: () => Promise<ClientMur | null> } = {}
): Promise<Commentaire> {
  const refus = verifierCommentaire(texte);
  if (refus) throw new Error(refus);

  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) throw new Error('Le mur n’est pas configuré : on ne commente pas.');

  const identite = await identiteAppareil(chargerClient);
  if (!identite) throw new Error('Aucune session : le commentaire ne peut pas être signé.');

  const { data, error } = await client
    .from('commentaires')
    .insert({
      postit_id: postitId,
      texte: texte.trim(),
      // Le pseudo local (Réglages) ; « anonyme » s'il est vide (D-059).
      pseudo: options.pseudo?.trim() || 'anonyme'
    })
    .select('id, postit_id, texte, pseudo, auteur, created_at');
  if (error) throw new Error(messageDeCommentaire(error.message));

  const ligne = Array.isArray(data) ? data[0] : data;
  const commentaire = lireCommentaire(ligne, identite);
  if (!commentaire) throw new Error('La base n’a pas rendu le commentaire écrit.');
  return { ...commentaire, mien: true };
}

/**
 * Retire **mon** commentaire. La ligne est visée par son `id` **et** par mon identité : la
 * politique de 0001/0005 n'en laisse pas passer une autre, mais une suppression qui ne
 * touche aucune ligne ne lève pas — sans ce contrôle, l'écran croirait avoir retiré.
 */
export async function supprimerCommentaire(
  id: number,
  options: { chargerClient?: () => Promise<ClientMur | null> } = {}
): Promise<void> {
  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) throw new Error('Le mur n’est pas configuré : on ne retire pas de commentaire.');

  const identite = await identiteAppareil(chargerClient);
  if (!identite) throw new Error('Aucune session : le retrait ne peut pas être signé.');

  const { data, error } = await client.from('commentaires').delete().eq('id', id).eq('auteur', identite).select('id');
  if (error) throw new Error(messageDeCommentaire(error.message));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Ce commentaire n’est plus le tien : recharge le mur.');
  }
}

// ---------------------------------------------------------------------------------------------
// Le repère du suivi (#211, D-097 (5), migration 0008)
// ---------------------------------------------------------------------------------------------

/** Un refus de la base sur le repère, dit en français. */
export function messageDeRepere(message: string): string {
  if (/comite_vu_sans_compte/i.test(message)) {
    return 'Le repère du suivi demande un compte : sans compte, il n’y a rien à marquer.';
  }
  if (/permission denied|insufficient_privilege/i.test(message)) {
    return 'La base refuse ce repère : ton compte ne peut pas l’écrire.';
  }
  return `Le repère du suivi n’a pas pu être posé (${message}).`;
}

/**
 * Pose le repère du suivi au compte de la session : c'est ce qui remet le compteur du
 * comité à zéro quand la page **Le suivi** s'ouvre (D-097 (5)).
 *
 * Le geste passe par la fonction `marquer_comite_vu()` (0008), et **pas** par un `update` :
 * une politique RLS ne distingue pas les colonnes, donc donner `comptes.vu_le` au rôle
 * `authenticated` rouvrirait `etat` et `raison` à leur propriétaire, que la 0005 réserve à
 * l'administration (le même raisonnement que `deplacer_postit`, D-092).
 *
 * La fonction vise **`auth.uid()`** : le client ne passe aucun identifiant, donc il ne peut
 * pas marquer le repère d'un autre. Sans base configurée, rien n'est contacté et la réponse
 * est `null` — le repli inerte de D-097 (5). Un compte absent est un refus **nommé** de la
 * base, traduit par `messageDeRepere` : la page le dit sans casser le suivi.
 */
export async function marquerComiteVu(
  options: { chargerClient?: () => Promise<ClientMur | null> } = {}
): Promise<string | null> {
  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) return null;

  const { data, error } = await client.rpc('marquer_comite_vu');
  if (error) throw new Error(messageDeRepere(error.message));
  return typeof data === 'string' && data ? data : null;
}

// ---------------------------------------------------------------------------------------------
// Le compteur « choses à voir » (#212, D-097 (5))
// ---------------------------------------------------------------------------------------------

/**
 * Deux dates de la base : la première est-elle **strictement postérieure** à la seconde ?
 * `false` dès que l'une des deux est illisible : un compteur ne crie pas pour une date qu'il
 * ne sait pas lire. Les deux viennent de PostgreSQL en ISO 8601 ; `Date.parse` accepte `Z`
 * comme `+00:00`.
 *
 * Sert deux fois au compteur : comparer un mouvement au **repère** `vu_le`, et comparer
 * `updated_at` à `created_at` (un post-it neuf ne compte pas, #239).
 */
export function estApres(date: unknown, depuis: unknown): boolean {
  if (typeof date !== 'string' || typeof depuis !== 'string') return false;
  const quand = Date.parse(date);
  const reference = Date.parse(depuis);
  return Number.isFinite(quand) && Number.isFinite(reference) && quand > reference;
}

/**
 * **Mes** post-its dont le **statut** a bougé depuis le repère, et leurs ids — les ids
 * servent à lire leurs commentaires en une seule requête.
 *
 * `updated_at` n'est posé que par le déclencheur du statut (0008) : corriger son texte ou
 * ranger son post-it ne réveille donc pas le compteur, ce qui est la règle de D-097 (5).
 *
 * **`updated_at` seul ne suffit pas** (#239) : son défaut est `now()`, donc un post-it que je
 * viens de poser porte `updated_at = created_at` — postérieur au repère, mais son statut n'a
 * jamais bougé. D-097 (5) ne compte que les statuts **changés** : il faut donc aussi que
 * `updated_at` soit postérieur à `created_at`. Pas de colonne nouvelle, le déclencheur de
 * 0008 ne datant que le statut (l'insertion ne le déclenche pas).
 */
export function lireMouvements(lignes: unknown, repere: string | null): { ids: string[]; mouvements: number } {
  const ids: string[] = [];
  let mouvements = 0;
  if (!Array.isArray(lignes) || repere === null) return { ids, mouvements };

  for (const ligne of lignes) {
    if (!estObjet(ligne) || typeof ligne.id !== 'string' || !ligne.id) continue;
    ids.push(ligne.id);
    // Les deux conditions, dans cet ordre : le statut a bougé **et** ce mouvement est plus
    // récent que mon repère — un post-it que je viens de poser ne compte pas.
    if (estApres(ligne.updated_at, ligne.created_at) && estApres(ligne.updated_at, repere)) {
      mouvements += 1;
    }
  }
  return { ids, mouvements };
}

/**
 * Les **commentaires des autres** arrivés sur mes post-its depuis le repère. Le mien ne
 * compte pas : répondre à son propre post-it n'apprend rien de neuf (D-097 (5)) — c'est la
 * règle que `npm run garde-fous` fait mordre (#212), et une pastille qui ne retombe jamais
 * quand on se relit serait du bruit, pas un signal.
 */
export function compterCommentairesDesAutres(lignes: unknown, repere: string | null, identite: string): number {
  if (!Array.isArray(lignes) || repere === null) return 0;
  let nombre = 0;
  for (const ligne of lignes) {
    if (!estObjet(ligne)) continue;
    if (ligne.auteur === identite) continue;
    if (estApres(ligne.created_at, repere)) nombre += 1;
  }
  return nombre;
}

/**
 * Le nombre de « choses à voir » du comité depuis mon repère `vu_le` (D-097 (5), #212) :
 * **mes** post-its dont le statut a changé, et les **commentaires des autres** sur eux.
 *
 * Rend **`null` sans base configurée** — le repli inerte de `marquerComiteVu` : l'alpha
 * fonctionne sans backend (D-058), et il n'y a alors aucune alerte à porter. Une base
 * configurée qui échoue **lève** : l'appelant décide de ne rien afficher, mais il le sait.
 *
 * **Trois lectures, et jamais une par post-it** (le N+1 que #212 interdit) :
 *
 * 1. mon repère — `comptes.vu_le`, ma seule ligne étant lisible (0005) ;
 * 2. **mes** post-its — la vue `postits_avec_votes`, filtrée par `auteur` côté base ;
 * 3. les commentaires de **tous** mes post-its — un `in` sur leurs ids, filtré en mémoire
 *    par la date et par l'auteur (le repère est une donnée de mon compte, pas de la table
 *    lue : il n'y a pas de colonne à comparer dans la requête).
 *
 * Sans repère lisible, le compte est **0** : le repère se pose à l'ouverture du suivi
 * (`marquerComiteVu`), et un compteur ne crie pas pour une donnée qu'il n'a pas lue.
 */
export async function compterChosesAVoir(
  options: { chargerClient?: () => Promise<ClientMur | null> } = {}
): Promise<number | null> {
  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) return null;

  const identite = await identiteAppareil(chargerClient);
  if (!identite) throw new Error('Aucune session : la base refuse de compter le comité.');

  const { data: comptes, error: erreurRepere } = await client.from('comptes').select('vu_le').eq('id', identite);
  if (erreurRepere) {
    throw new Error(`Lecture du repère du comité impossible : ${erreurRepere.message}`);
  }
  const mienne = Array.isArray(comptes) ? comptes[0] : comptes;
  const repere = estObjet(mienne) && typeof mienne.vu_le === 'string' ? mienne.vu_le : null;
  if (repere === null) return 0;

  const { data: miens, error: erreurPostits } = await client
    .from('postits_avec_votes')
    // `created_at` sert à distinguer un statut **changé** d'un post-it **neuf** (#239).
    .select('id, created_at, updated_at')
    .eq('auteur', identite);
  if (erreurPostits) {
    throw new Error(`Lecture de mes post-its impossible : ${erreurPostits.message}`);
  }

  const { ids, mouvements } = lireMouvements(miens ?? [], repere);
  if (ids.length === 0) return mouvements;

  const { data: commentaires, error: erreurCommentaires } = await client
    .from('commentaires')
    .select('postit_id, auteur, created_at')
    .in('postit_id', ids);
  if (erreurCommentaires) {
    throw new Error(`Lecture des commentaires de mes post-its impossible : ${erreurCommentaires.message}`);
  }

  return mouvements + compterCommentairesDesAutres(commentaires ?? [], repere, identite);
}
