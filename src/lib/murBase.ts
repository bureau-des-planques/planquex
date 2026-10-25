/**
 * Le mur branché sur la base (#136) — la **couture** entre l'écran et la source.
 *
 * Le mur ne sait pas d'où viennent ses post-its : `src/pages/BoiteAIdees.tsx` appelle
 * `chargerPostitsDuMur`, et c'est ce module qui décide. Trois cas, et un seul est une
 * erreur :
 *
 * 1. **la base est configurée** (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) : on signe
 *    l'appareil anonymement (D-059) puis on lit `postits_avec_votes`, la vue qui recompose
 *    la forme du contrat (`docs/BOITE-A-IDEES.md` §3, `src/store/mur.ts`) ;
 * 2. **elle ne l'est pas** : on rend `null`, et la page garde le fichier JSON — c'est ce qui
 *    laisse l'alpha fonctionner sans backend (D-058) et ce que la production sans
 *    variables Vercel doit continuer à faire ;
 * 3. **elle est configurée mais ne répond pas** : on **lève**, et la page retombe sur le
 *    fichier avec un message. Un mur n'est jamais un écran cassé à cause du réseau.
 *
 * **Ce que le client n'écrit jamais** : `auteur`. La migration (`0001_mur.sql`) le remplit
 * par `auth.uid()`, et sa politique d'insertion exige `auteur = auth.uid()` : l'appareil ne
 * peut donc ni se faire passer pour un autre, ni choisir son statut (`en attente` est la
 * seule valeur écrite ici). Le statut avance par le tri (D-059), pas par le posteur.
 *
 * **Les pouces (#137)** : le compteur `up`/`down` vient de la vue ; **mon** vote se lit dans
 * `votes`, filtré sur mon identité. Le client écrit `postit_id` et `sens` — **jamais `votant`** :
 * la base le remplit par `auth.uid()` (`0001_mur.sql`), et sa politique le refuse autrement.
 * « Pas pour soi » et « une fois par post-it » sont tenus **par la base** (clé primaire de
 * `votes`, migration `0004_pouces.sql`) ; l'écran ne fait que ne pas proposer ce que la base
 * refuserait.
 *
 * **Le gueulage (D-085)** n'a pas de famille : il s'écrit avec `kind` nul, ce que la
 * migration 0003 permet (à appliquer avant le premier dépôt d'un gueulage). Une ancienne
 * ligne `IP` reste lisible : la lecture retire la famille d'un gueulage.
 *
 * **Le fil et la relecture (#138, #139)** : un post-it porte des **commentaires** — lecture
 * ouverte à tout compte, écriture réservée à un compte approuvé, retrait réservé à son
 * auteur —, et son auteur peut **corriger** son titre et son texte tant qu'il est
 * `en attente`, ou le **retirer**. Rien de tout cela n'est décidé ici : la base le refuse
 * (`0005`, `0006`), et ce module traduit ses refus en français. Le tri (`statut`, `raison`,
 * `ticket`) est au contraire **réservé à l'administration** : `trierPostit` n'est appelé que
 * par l'écran d'administration, et la base le refuse à tout autre compte.
 *
 * **La place sur le tableau (#185)** : la base porte `position_x`, `position_y` et
 * `position_angle`, et sa politique laisse chacun déplacer **ses** post-its. `deplacerPostit`
 * est ce geste — le mode de placement de l'écran n'exporte donc plus un fichier quand le mur
 * vient de la base. Et à la pose, `positionDepuisId` évite les places déjà prises : un
 * post-it neuf ne se colle plus sur le texte d'un autre (D-068).
 */
import {
  clientMur,
  configurerMur,
  identiteAppareil,
  type ClientMur,
} from '@/lib/supabase';
import { APP_LABEL } from '@/version';
import {
  FAMILLES,
  STATUTS,
  lireMur,
  type Ecran,
  type Famille,
  type Postit,
  type PositionPostit,
  type SensVote,
  type Statut,
  type VotesPostit,
} from '@/store/mur';

/** La seule écriture que le jeu produit : le contenu saisi, et rien de plus. */
export interface BrouillonPostit {
  /** `null` pour un gueulage : il ne porte aucune famille (D-085). */
  famille: Famille | null;
  gueulage: boolean;
  titre: string;
  texte: string;
  ecran: Ecran | '';
  /** Un **lien** vers une image, jamais un fichier (§4 : l'envoi oblige à un compte). */
  capture?: string;
}

export interface OptionsPostit {
  /** Le pseudo local (Réglages) ; vide = « anonyme » (D-059). */
  pseudo?: string;
  /** Ce que Réglages affichait ; par défaut, le libellé de cette build. */
  version?: string;
  /** Court, stable, jamais réutilisé. Injectable pour un test déterministe. */
  id?: string;
  /**
   * Les places **déjà prises** sur le tableau (#185). Sans elles, deux post-its voisins
   * peuvent atterrir au même endroit ; avec elles, le nouveau se pose là où il cache le
   * moins de texte (voir `positionDepuisId`).
   */
  positionsPrises?: ReadonlyArray<PositionPostit>;
  /** Injectable pour tester sans réseau. */
  chargerClient?: () => Promise<ClientMur | null>;
}

/**
 * Le backend est-il armé ? Lit `import.meta.env` par `configurerMur` (la seule source de
 * configuration, `src/lib/supabase.ts`). Une configuration à moitié posée est une erreur
 * de déploiement : pour le mur, cela vaut « pas de base » plutôt qu'un écran blanc.
 *
 * Sous Vitest, `.env.test` vide les deux variables : aucun test ne contacte le réseau.
 */
export function murEstConfigure(): boolean {
  try {
    return configurerMur() !== null;
  } catch {
    return false;
  }
}

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

/**
 * Une ligne de `postits_avec_votes` ramenée à la forme du contrat. `lie` n'est pas dans la
 * vue (elle date de #135, avant D-085) : un post-it lu en base n'est jamais collé sur un
 * autre, donc `null`. Un gueulage ne reçoit **pas** de `kind` (D-085).
 */
function versContrat(ligne: unknown): Record<string, unknown> | null {
  if (!estObjet(ligne)) return null;

  const gueulage = ligne.gueulage === true;
  const brut: Record<string, unknown> = {
    id: ligne.id,
    titre: ligne.titre,
    texte: ligne.texte,
    ecran: ligne.ecran ?? '',
    pseudo: ligne.pseudo,
    version: ligne.version,
    statut: ligne.statut,
    raison: ligne.raison ?? '',
    ticket: ligne.ticket ?? null,
    gueulage,
    lie: null,
    position: ligne.position,
    votes: ligne.votes,
  };
  if (!gueulage) brut.kind = ligne.kind;
  return brut;
}

/**
 * Contrôle une liste de lignes avec **le même** `lireMur` que le fichier : une seule
 * définition de la forme, donc les deux sources ne peuvent pas diverger en silence.
 */
export function lirePostitsDeLaBase(lignes: unknown): {
  postits: Postit[] | null;
  erreurs: string[];
} {
  if (!Array.isArray(lignes)) {
    return { postits: null, erreurs: ['la base n’a pas rendu une liste de post-its'] };
  }

  const bruts: unknown[] = [];
  const erreurs: string[] = [];
  lignes.forEach((ligne, index) => {
    const brut = versContrat(ligne);
    if (!brut) {
      erreurs.push(`base[${index}] : ligne illisible`);
      return;
    }
    bruts.push(brut);
  });

  const lu = lireMur({ formulaire: '', postits: bruts });
  const toutes = [...erreurs, ...lu.erreurs];
  return {
    // Une seule ligne illisible suffit : un mur à moitié faux vaut moins qu'un message.
    postits: lu.mur && toutes.length === 0 ? lu.mur.postits : null,
    erreurs: toutes,
  };
}

/**
 * Lit le mur dans la base. Rend `null` quand aucune base n'est configurée : c'est le signal
 * « garde ton fichier ». Toute autre panne **lève**, pour que la page puisse retomber sur
 * le fichier sans afficher un mur vide qui aurait l'air vrai.
 *
 * Une session est signée **avant** la lecture : les droits sont donnés au rôle
 * `authenticated`, pas à `anon` (migration #135). Sans session, `identiteAppareil` en signe
 * une anonyme (lecture seule depuis D-088) ; sans identité du tout, la base refuse.
 */
export async function chargerPostitsDuMur(
  chargerClient: () => Promise<ClientMur | null> = clientMur,
): Promise<Postit[] | null> {
  const client = await chargerClient();
  if (!client) return null;

  const identite = await identiteAppareil(chargerClient);
  if (!identite) {
    throw new Error('Aucune session : la base refuse la lecture du mur.');
  }

  const { data, error } = await client
    .from('postits_avec_votes')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Lecture du mur impossible : ${error.message}`);

  const { postits, erreurs } = lirePostitsDeLaBase(data ?? []);
  if (!postits) {
    throw new Error(`Le mur de la base n’a pas la forme du contrat : ${erreurs.join(' ; ')}`);
  }

  // Mon vote se distingue du total (#137). Si je ne peux pas le lire, je ne peux pas non plus
  // proposer de voter sans risquer un doublon : la panne lève, la page retombe sur le fichier.
  const { data: mesLignes, error: erreurVotes } = await client
    .from('votes')
    .select('postit_id, sens')
    .eq('votant', identite);
  if (erreurVotes) throw new Error(`Lecture de tes votes impossible : ${erreurVotes.message}`);
  const mesVotes = lireMesVotes(mesLignes ?? []);

  const auteurs = new Map<string, unknown>(
    (Array.isArray(data) ? data : []).flatMap((ligne): Array<[string, unknown]> =>
      estObjet(ligne) && typeof ligne.id === 'string' ? [[ligne.id, ligne.auteur]] : [],
    ),
  );
  return postits.map((postit) => ({
    ...postit,
    votes: { ...postit.votes, mon: mesVotes.get(postit.id) ?? null },
    mien: auteurs.get(postit.id) === identite,
  }));
}

/** Mes votes, par post-it. Une ligne illisible est ignorée : elle ne peut pas s'afficher. */
export function lireMesVotes(lignes: unknown): Map<string, SensVote> {
  const votes = new Map<string, SensVote>();
  if (!Array.isArray(lignes)) return votes;
  for (const ligne of lignes) {
    if (!estObjet(ligne)) continue;
    if (typeof ligne.postit_id !== 'string') continue;
    if (ligne.sens === 'up' || ligne.sens === 'down') votes.set(ligne.postit_id, ligne.sens);
  }
  return votes;
}

/**
 * Ce que devient le compteur quand mon vote passe de `avant` à `apres` : on retire l'ancien
 * pouce, on ajoute le nouveau. Pure et sans plancher caché — un compteur ne descend pas sous
 * zéro, mais c'est la base qui compte, pas ce calcul : il ne sert qu'à l'affichage immédiat.
 */
export function compterApres(
  votes: VotesPostit,
  avant: SensVote | null,
  apres: SensVote | null,
): VotesPostit {
  const compte = { up: votes.up, down: votes.down };
  if (avant) compte[avant] = Math.max(0, compte[avant] - 1);
  if (apres) compte[apres] += 1;
  return { ...compte, mon: apres };
}

/**
 * Ce que donne un clic sur un pouce, **dans cet ordre de priorité** :
 *
 * 1. le même pouce que mon vote → je **retire** mon vote ;
 * 2. l'autre pouce → je **change** mon vote (une modification de ma ligne, jamais une seconde) ;
 * 3. aucun vote → j'**insère** le mien.
 */
export function gesteDeVote(
  actuel: SensVote | null,
  demande: SensVote,
): { geste: 'inserer' | 'changer' | 'retirer'; apres: SensVote | null } {
  if (actuel === demande) return { geste: 'retirer', apres: null };
  if (actuel) return { geste: 'changer', apres: demande };
  return { geste: 'inserer', apres: demande };
}

/** Un refus de la base, dit en français : l'écran affiche ce message, discrètement. */
export function messageDeVote(message: string): string {
  if (/row-level security/i.test(message)) {
    return 'La base refuse ce vote : on ne vote pas pour son propre post-it.';
  }
  if (/foreign key/i.test(message)) return 'Ce post-it n’existe plus : recharge le mur.';
  if (/duplicate key/i.test(message)) {
    return 'Tu as déjà voté pour ce post-it : recharge le mur pour voir ton vote.';
  }
  return `Le vote n’est pas passé (${message}).`;
}

/**
 * Vote, change ou retire mon pouce sur un post-it. Rend mon vote **après** le geste.
 *
 * - **sans configuration, rien n'est contacté** : on lève avant même de créer un client
 *   (la page ne propose d'ailleurs aucun bouton dans ce cas, mais une garde qui ne vit que
 *   dans l'interface est une garde qu'un autre appelant contourne) ;
 * - **le client n'écrit jamais `votant`** : à l'insertion, `{ postit_id, sens }` seulement ;
 *   à la modification et au retrait, la ligne est visée par `postit_id` **et** `votant`
 *   (un filtre, pas une écriture) ;
 * - une modification ou un retrait qui ne touche **aucune ligne** (le vote a disparu entre-temps)
 *   est une erreur : une RLS qui refuse ne lève rien, elle rend 0 ligne — sans ce contrôle
 *   l'écran croirait avoir voté.
 *
 * L'appelant garde l'ancien état et le rétablit si la promesse est rejetée (erreur réseau).
 */
export async function voterPourPostit(
  postitId: string,
  demande: SensVote,
  actuel: SensVote | null,
  options: { chargerClient?: () => Promise<ClientMur | null> } = {},
): Promise<SensVote | null> {
  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) throw new Error('Le mur n’est pas configuré : on ne vote pas.');

  const identite = await identiteAppareil(chargerClient);
  if (!identite) throw new Error('Aucune session : le vote ne peut pas être signé.');

  const { geste, apres } = gesteDeVote(actuel, demande);

  const reponse =
    geste === 'inserer'
      ? await client.from('votes').insert({ postit_id: postitId, sens: demande })
      : geste === 'changer'
        ? await client
            .from('votes')
            .update({ sens: demande })
            .eq('postit_id', postitId)
            .eq('votant', identite)
            .select('postit_id')
        : await client
            .from('votes')
            .delete()
            .eq('postit_id', postitId)
            .eq('votant', identite)
            .select('postit_id');

  if (reponse.error) throw new Error(messageDeVote(reponse.error.message));
  if (geste !== 'inserer' && (!Array.isArray(reponse.data) || reponse.data.length === 0)) {
    throw new Error('Ton vote n’existe plus : recharge le mur pour voir où il en est.');
  }
  return apres;
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

const estEntier = (valeur: unknown): valeur is number =>
  typeof valeur === 'number' && Number.isInteger(valeur);

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
    mien: identite !== null && ligne.auteur === identite,
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
  chargerClient: () => Promise<ClientMur | null> = clientMur,
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
  options: { pseudo?: string; chargerClient?: () => Promise<ClientMur | null> } = {},
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
      pseudo: options.pseudo?.trim() || 'anonyme',
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
  options: { chargerClient?: () => Promise<ClientMur | null> } = {},
): Promise<void> {
  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) throw new Error('Le mur n’est pas configuré : on ne retire pas de commentaire.');

  const identite = await identiteAppareil(chargerClient);
  if (!identite) throw new Error('Aucune session : le retrait ne peut pas être signé.');

  const { data, error } = await client
    .from('commentaires')
    .delete()
    .eq('id', id)
    .eq('auteur', identite)
    .select('id');
  if (error) throw new Error(messageDeCommentaire(error.message));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Ce commentaire n’est plus le tien : recharge le mur.');
  }
}

// ---------------------------------------------------------------------------------------------
// Corriger ou retirer son post-it (#139)
// ---------------------------------------------------------------------------------------------

/** Un refus de la base sur une correction ou un retrait, dit en français. */
export function messageDeCorrection(message: string): string {
  if (/postit_corrige_trop_tard/i.test(message)) {
    return 'Ce post-it a bougé de statut : il ne se corrige plus, sinon le mur ne dirait plus la même chose à tout le monde.';
  }
  if (/postit_corrige_refuse/i.test(message)) {
    return 'La base refuse : ce post-it n’est pas le tien, ou ton compte n’est pas encore approuvé.';
  }
  if (/postit_corrige_vide/i.test(message)) return 'Le titre et le texte ne peuvent pas être vides.';
  if (/postit_corrige_inconnu/i.test(message)) return 'Ce post-it n’existe plus : recharge le mur.';
  if (/permission denied/i.test(message)) {
    return 'La base refuse cette correction : ton compte ne peut pas l’écrire.';
  }
  return `La correction n’est pas passée (${message}).`;
}

/**
 * Corrige le titre et le texte d'un post-it, **par son auteur** et **tant qu'il est
 * `en attente`** (#139). Le geste passe par la fonction `corriger_postit` (0006) : le client
 * n'a plus de droit direct sur `titre` et `texte`, précisément pour qu'un administrateur ne
 * puisse pas réécrire le post-it d'un autre.
 */
export async function corrigerPostit(
  id: string,
  correction: { titre: string; texte: string },
  options: { chargerClient?: () => Promise<ClientMur | null> } = {},
): Promise<{ titre: string; texte: string }> {
  const titre = correction.titre.trim();
  const texte = correction.texte.trim();
  if (!titre || !texte) throw new Error('Le titre et le texte ne peuvent pas être vides.');

  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) throw new Error('Le mur n’est pas configuré : on ne corrige pas de post-it.');

  const identite = await identiteAppareil(chargerClient);
  if (!identite) throw new Error('Aucune session : la correction ne peut pas être signée.');

  const { data, error } = await client.rpc('corriger_postit', {
    p_id: id,
    p_titre: titre,
    p_texte: texte,
  });
  if (error) throw new Error(messageDeCorrection(error.message));

  const ligne = estObjet(data) ? data : null;
  if (!ligne || typeof ligne.titre !== 'string' || typeof ligne.texte !== 'string') {
    throw new Error('La base n’a pas rendu le post-it corrigé.');
  }
  return { titre: ligne.titre, texte: ligne.texte };
}

/**
 * Retire mon post-it : il est **supprimé**. Pas de statut « retiré », et pas de ligne
 * barrée — §3 de `docs/BOITE-A-IDEES.md` le dit depuis D-059 : « un post-it retiré par son
 * auteur disparaît du fichier : il n'existe pas de statut retiré ». En base c'est le même
 * geste : `delete`, qui emporte ses votes et ses commentaires (`on delete cascade`, 0001).
 *
 * La base ne l'autorise, pour l'auteur, que **tant que le post-it est `en attente`** (0006) :
 * après, il porte un tri — une raison, un ticket — que le retrait emporterait, et le mur ne
 * dirait plus la même chose à tout le monde. L'**administration**, elle, retire n'importe
 * quel post-it à n'importe quel statut (#186, `0007`) : c'est le geste de modération.
 * Visé par son `id` — c'est la RLS qui sait qui a le droit d'effacer la ligne.
 */
export async function retirerPostit(
  id: string,
  options: { chargerClient?: () => Promise<ClientMur | null> } = {},
): Promise<void> {
  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) throw new Error('Le mur n’est pas configuré : on ne retire pas de post-it.');

  const identite = await identiteAppareil(chargerClient);
  if (!identite) throw new Error('Aucune session : le retrait ne peut pas être signé.');

  // **Pas de filtre sur `auteur`** (#186) : c'est la RLS qui décide, et elle en connaît deux
  // — l'auteur, tant que le post-it est `en attente` (0006), et l'administrateur, à tout
  // statut (`0007`). Filtrer ici retirerait son geste à l'administration.
  const { data, error } = await client.from('postits').delete().eq('id', id).select('id');
  if (error) throw new Error(messageDeCorrection(error.message));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      'La base n’a retiré aucun post-it : il a peut-être bougé de statut (on ne retire le sien qu’en attente), ou tu n’as pas le droit de le retirer.',
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Le tri par l'administration (0006, D-088)
// ---------------------------------------------------------------------------------------------

/** Les trois colonnes du tri — et rien d'autre : `titre` et `texte` sont à leur auteur. */
export interface TriPostit {
  statut: Statut;
  raison: string;
  ticket: number | null;
}

/** Un refus de la base sur un tri, dit en français. */
export function messageDeTri(message: string): string {
  if (/permission denied/i.test(message)) {
    return 'La base refuse : seul un administrateur trie le mur (D-088, migration 0006).';
  }
  if (/postits_ecarte_a_sa_raison/i.test(message)) {
    return 'Un post-it écarté doit dire pourquoi (D-059).';
  }
  if (/postits_statut_check/i.test(message)) return 'Ce statut n’existe pas sur le mur.';
  if (/jwt|session/i.test(message)) return 'Ta session a expiré : reconnecte-toi.';
  return `Le tri n’est pas passé (${message}).`;
}

/**
 * Contrôle un tri **avant** de l'envoyer : les cinq statuts de §2, la raison obligatoire
 * d'un écarté, un ticket qui est un entier strictement positif. L'écran le fait aussi ; la
 * fonction est exportée pour que le contrôle soit éprouvé sans réseau.
 */
export function verifierTri(tri: TriPostit): string | null {
  if (!STATUTS.includes(tri.statut)) return `« ${tri.statut} » n’est pas un statut du mur.`;
  if (tri.statut === 'écarté' && !tri.raison.trim()) {
    return 'Écarter un post-it exige une raison écrite : c’est elle qui apprend ce qui vaut la peine d’être remonté.';
  }
  if (tri.ticket !== null && !(Number.isSafeInteger(tri.ticket) && tri.ticket > 0)) {
    return 'Un ticket est un numéro d’issue GitHub : un entier strictement positif, ou rien.';
  }
  return null;
}

/**
 * Déplace le tri d'un post-it, **n'importe lequel** : c'est le geste de l'administration.
 * La base le refuse à qui n'est pas administrateur (politique du 0006) ; une modification
 * filtrée par la RLS ne lève pas, elle porte sur 0 ligne — d'où le contrôle explicite.
 */
export async function trierPostit(
  id: string,
  tri: TriPostit,
  options: { chargerClient?: () => Promise<ClientMur | null> } = {},
): Promise<TriPostit> {
  const refus = verifierTri(tri);
  if (refus) throw new Error(refus);

  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) throw new Error('Supabase n’est pas configuré : il n’y a pas de mur à trier.');

  const { data, error } = await client
    .from('postits')
    .update({ statut: tri.statut, raison: tri.raison.trim(), ticket: tri.ticket })
    .eq('id', id)
    .select('statut, raison, ticket');
  if (error) throw new Error(messageDeTri(error.message));

  const ligne = Array.isArray(data) ? data[0] : null;
  if (!estObjet(ligne)) {
    throw new Error('La base n’a changé aucun post-it : ton compte n’est peut-être pas administrateur.');
  }
  return {
    statut: STATUTS.includes(ligne.statut as Statut) ? (ligne.statut as Statut) : tri.statut,
    raison: typeof ligne.raison === 'string' ? ligne.raison : tri.raison.trim(),
    ticket: estEntier(ligne.ticket) ? ligne.ticket : null,
  };
}

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** `p-<horodatage base 36>-<6 caractères>` : court, stable, jamais réutilisé (§3). */
export function idPostit(maintenant = Date.now(), aleatoire: () => number = Math.random): string {
  let suffixe = '';
  for (let i = 0; i < 6; i += 1) {
    const indice = Math.min(ALPHABET.length - 1, Math.max(0, Math.floor(aleatoire() * ALPHABET.length)));
    suffixe += ALPHABET[indice];
  }
  return `p-${maintenant.toString(36)}-${suffixe}`;
}

/** La place qu'un id tirerait du seul hasard : stable, dans les bornes de la migration. */
function placeNaturelle(id: string): PositionPostit {
  let empreinte = 0;
  for (const caractere of id) {
    empreinte = (Math.imul(empreinte, 31) + caractere.charCodeAt(0)) >>> 0;
  }
  return {
    x: 6 + (empreinte % 68),
    y: 6 + ((empreinte >>> 8) % 58),
    angle: -3 + ((empreinte >>> 16) % 7)
  };
}

/**
 * Les bornes du tableau, en pourcentage, et la taille d'un post-it **exprimée de la même
 * façon**. Les deux sont des ordres de grandeur (un post-it fait 236 px sur un tableau large
 * de ~1100 px, et ~200 px de haut sur les 600 px mini) : ils servent à comparer des places,
 * jamais à dessiner quoi que ce soit — le rendu lit des pourcentages, pas cette table.
 */
const BORD = 6;
const LARGEUR_POSTIT = 22;
const HAUTEUR_POSTIT = 30;
const PAS_DE_BALAYAGE = 1;

/** De combien deux places s'écartent, en post-its : ≥ 1 veut dire « l'un ne cache pas l'autre ». */
function ecart(a: PositionPostit, b: PositionPostit): number {
  return Math.max(
    Math.abs(a.x - b.x) / LARGEUR_POSTIT,
    Math.abs(a.y - b.y) / HAUTEUR_POSTIT
  );
}

/** Le pire écart d'une place à toutes les places prises : c'est ce qu'on maximise. */
function ecartMinimum(place: PositionPostit, prises: ReadonlyArray<PositionPostit>): number {
  return prises.reduce((pire, prise) => Math.min(pire, ecart(place, prise)), Infinity);
}

/**
 * Une place sur le tableau, **en pourcentage** (D-068), dérivée de l'id : sans elle, la base
 * poserait tous les post-its au centre, empilés les uns sur les autres. Elle est stable —
 * le même id redonne la même place — et reste dans les bornes de la migration.
 *
 * **`prises` : les places déjà occupées** (#185). Deux empreintes ne s'évitent pas : sans ce
 * paramètre, un post-it neuf peut se coller **sur** un autre et en cacher le texte — ce que
 * D-068 interdit. Quand on connaît les places prises, le tableau est donc balayé au pour
 * cent, et l'on garde celle dont l'**écart minimum** aux autres est le plus grand : la
 * première qui ne cache personne si elle existe, sinon la moins mauvaise. À égalité, la plus
 * proche de la place naturelle — le mur garde son air de hasard quand la place est libre.
 */
export function positionDepuisId(
  id: string,
  prises: ReadonlyArray<PositionPostit> = []
): PositionPostit {
  const naturelle = placeNaturelle(id);
  if (prises.length === 0) return naturelle;

  let meilleure = naturelle;
  let meilleurEcart = ecartMinimum(naturelle, prises);
  let meilleureDistance = 0;

  for (let x = BORD; x <= 100 - BORD; x += PAS_DE_BALAYAGE) {
    for (let y = BORD; y <= 100 - BORD; y += PAS_DE_BALAYAGE) {
      const candidate = { x, y, angle: naturelle.angle };
      const e = ecartMinimum(candidate, prises);
      // Le tableau est balayé dans un ordre fixe : à égalité stricte, la première gagne.
      if (e < meilleurEcart) continue;
      const distance = Math.hypot(candidate.x - naturelle.x, candidate.y - naturelle.y);
      if (e > meilleurEcart || distance < meilleureDistance) {
        meilleure = candidate;
        meilleurEcart = e;
        meilleureDistance = distance;
      }
    }
  }
  return meilleure;
}

// ---------------------------------------------------------------------------------------------
// La place sur le tableau, en base (0001, D-068)
// ---------------------------------------------------------------------------------------------

/** Une place hors des bornes n'est pas une place : la base la refuserait (contraintes de 0001). */
export function verifierPosition(position: PositionPostit): string | null {
  if (![position.x, position.y, position.angle].every((valeur) => Number.isFinite(valeur))) {
    return 'Une place sur le tableau, ce sont trois nombres : x, y et l’angle.';
  }
  if (position.x < 0 || position.x > 100 || position.y < 0 || position.y > 100) {
    return 'Une place se donne en pourcentage du tableau : elle doit tenir entre 0 et 100.';
  }
  if (position.angle < -5 || position.angle > 5) {
    return 'L’inclinaison d’un post-it va de -5 à 5 degrés.';
  }
  return null;
}

/** Un refus de la base sur un déplacement, dit en français. */
export function messageDePlace(message: string): string {
  if (/postit_deplace_refuse/i.test(message)) {
    return 'La base refuse ce déplacement : ce post-it n’est pas le tien, ou ton compte n’est pas approuvé.';
  }
  if (/postit_deplace_inconnu/i.test(message)) return 'Ce post-it n’existe plus : recharge le mur.';
  if (/postit_deplace_hors_bornes|check constraint|position_/i.test(message)) {
    return 'Cette place sort du tableau : elle n’a pas été enregistrée.';
  }
  if (/permission denied/i.test(message)) {
    return 'La base refuse ce déplacement : ton compte ne peut pas l’écrire.';
  }
  if (/jwt|session/i.test(message)) return 'Ta session a expiré : reconnecte-toi.';
  return `La place n’a pas été enregistrée (${message}).`;
}

const arrondi = (valeur: number) => Math.round(valeur * 10) / 10;

/**
 * Écrit la place d'un post-it **en base** (#185, #186) : c'est ce qui fait du mode de
 * placement autre chose qu'un export de fichier — la disposition est partagée sans commit.
 *
 * Le geste passe par la fonction `deplacer_postit` (0007), et **pas** par un `update` : une
 * politique RLS ne distingue pas les colonnes, donc rendre `position_*` écrivable au rôle
 * `authenticated` rendrait aussi `statut` à l'auteur de la ligne — et le posteur se trierait
 * lui-même, ce que D-059 refuse. La fonction, elle, décide **qui** déplace : l'auteur
 * approuvé, ou l'administrateur (0007).
 *
 * La place appliquée est arrondie au dixième, comme le fait la page : ce qui revient ici est
 * exactement ce que le mur affichera, et non ce qui a été demandé.
 */
export async function deplacerPostit(
  id: string,
  position: PositionPostit,
  options: { chargerClient?: () => Promise<ClientMur | null> } = {}
): Promise<PositionPostit> {
  const refus = verifierPosition(position);
  if (refus) throw new Error(refus);

  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) throw new Error('Le mur n’est pas configuré : la place ne peut pas s’écrire.');

  const identite = await identiteAppareil(chargerClient);
  if (!identite) throw new Error('Aucune session : la place ne peut pas être signée.');

  const demandee: PositionPostit = {
    x: arrondi(position.x),
    y: arrondi(position.y),
    angle: arrondi(position.angle)
  };

  const { data, error } = await client.rpc('deplacer_postit', {
    p_id: id,
    p_x: demandee.x,
    p_y: demandee.y,
    p_angle: demandee.angle
  });
  if (error) throw new Error(messageDePlace(error.message));

  const ligne = estObjet(data) ? data : null;
  if (!ligne) throw new Error('La base n’a pas rendu le post-it déplacé.');
  return {
    x: Number(ligne.position_x),
    y: Number(ligne.position_y),
    angle: Number(ligne.position_angle)
  };
}

/**
 * Un gueulage n'a **pas de titre** (D-085) : au tri, on le fabrique avec ses **premiers
 * mots**, jamais un titre inventé qui trahirait le propos (§3, §4.3 bis). C'est ce que fait
 * la base pour elle-même, puisque `titre` y est obligatoire.
 */
export function titreDepuisTexte(texte: string): string {
  const mots = texte.trim().split(/\s+/).slice(0, 8).join(' ');
  return mots.length > 64 ? `${mots.slice(0, 61).trimEnd()}…` : mots;
}

/** Le texte tel qu'il sera lu : le retour, puis le lien de capture s'il y en a un (§4.5). */
export function texteAvecCapture(brouillon: BrouillonPostit): string {
  const texte = brouillon.texte.trim();
  const capture = brouillon.capture?.trim() ?? '';
  if (capture && !/^https?:\/\//i.test(capture)) {
    throw new Error('Le lien de capture doit commencer par http:// ou https://.');
  }
  return capture ? `${texte}\n\nCapture : ${capture}` : texte;
}

/**
 * La ligne insérée dans `public.postits`. **Aucun `auteur`** : la base le remplit avec
 * `auth.uid()`, et sa politique d'insertion refuse qu'on écrive au nom d'un autre.
 * **Un seul statut écrit** : `en attente` — le tri seul fait avancer un post-it (D-059).
 *
 * Exportée pour que le test lise exactement ce qui part au réseau, plutôt que de croire un
 * faux client sur parole.
 */
export function composerLignePostit(
  brouillon: BrouillonPostit,
  options: OptionsPostit = {},
): Record<string, unknown> {
  const gueulage = brouillon.gueulage;
  if (!gueulage && !FAMILLES.includes(brouillon.famille as Famille)) {
    throw new Error('Choisis une famille : une IP ou un OUF.');
  }

  const texte = texteAvecCapture(brouillon);
  if (!texte) throw new Error('Le texte du post-it est vide.');

  // Le titre d'un gueulage vient du **texte brut**, jamais du lien de capture ajouté après.
  const titre = gueulage ? titreDepuisTexte(brouillon.texte) : brouillon.titre.trim();
  if (!titre) throw new Error('Le titre du post-it est vide.');

  const id = options.id ?? idPostit();
  const position = positionDepuisId(id, options.positionsPrises ?? []);

  return {
    id,
    // Un gueulage n'a pas de famille (D-085, migration 0003) : `kind` est nul.
    kind: gueulage ? null : brouillon.famille,
    titre,
    texte,
    ecran: brouillon.ecran || null,
    pseudo: options.pseudo?.trim() || 'anonyme',
    version: options.version ?? APP_LABEL,
    statut: 'en attente',
    gueulage,
    // La position s'écrit en pourcentage, colonne par colonne (la vue la recompose).
    position_x: position.x,
    position_y: position.y,
    position_angle: position.angle,
  };
}

/**
 * Poste un post-it depuis le jeu. Rend le post-it dans la forme du contrat, pour que
 * l'écran puisse l'afficher sans relire toute la base.
 *
 * Sans configuration, **rien n'est écrit** : on lève avant même de créer un client. La page
 * n'offre d'ailleurs pas le bouton dans ce cas (exigence de #136), mais la garde est ici
 * aussi — une garde qui ne vit que dans l'interface est une garde qu'un autre appelant
 * contourne.
 */
export async function posterPostit(
  brouillon: BrouillonPostit,
  options: OptionsPostit = {},
): Promise<Postit> {
  const chargerClient = options.chargerClient ?? clientMur;
  const client = await chargerClient();
  if (!client) {
    throw new Error('Le mur n’est pas configuré : le retour se donne pour l’instant de vive voix.');
  }

  const identite = await identiteAppareil(chargerClient);
  if (!identite) {
    throw new Error('Aucune session : le post-it ne peut pas être signé.');
  }

  const ligne = composerLignePostit(brouillon, options);
  const { error } = await client.from('postits').insert(ligne);
  if (error) throw new Error(`Le post-it n’a pas pu être collé : ${error.message}`);

  const { postits, erreurs } = lirePostitsDeLaBase([
    {
      ...ligne,
      lie: null,
      position: {
        x: Number(ligne.position_x),
        y: Number(ligne.position_y),
        angle: Number(ligne.position_angle)
      },
      votes: { up: 0, down: 0 }
    },
  ]);
  if (!postits) {
    throw new Error(`Le post-it écrit n’a pas la forme du contrat : ${erreurs.join(' ; ')}`);
  }
  // Il est à moi : pas de pouce sur mon propre post-it (#137).
  return { ...postits[0], votes: { up: 0, down: 0, mon: null }, mien: true };
}
