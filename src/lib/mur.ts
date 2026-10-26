/**
 * Le mur, d'un cran plus haut (#254) — un **port** de sept gestes, et son **résultat honnête**.
 *
 * Le mur ne savait parler qu'en requêtes — c'était le constat du ticket #254 : un miroir 1:1
 * des appels de la base, une fonction par requête et un `messageDeX` par famille de refus.
 * Ce module-ci parle en **gestes** — `charger`, `poster`, `voter`, `trier`, `deplacer`,
 * `corriger`, `retirer` — et rend toujours la même forme : `{ ok: true, … }` quand le geste
 * est passé, `{ ok: false, message }` quand il ne l'est pas. **Le port ne lève pas** : une
 * panne de réseau, un refus de la RLS et un brouillon vide se disent de la même façon, et
 * c'est l'écran qui décide quoi en faire.
 *
 * Les sources sont des **adapters** (`src/lib/murAdaptateurs.ts`) : la **base**
 * (`postits_avec_votes`, D-058, D-088), le **fichier** (`docs/comite.json`, en lecture seule),
 * et la **mémoire**, qui sert à éprouver la mécanique sans réseau ni navigateur. Le port ne
 * sait pas laquelle il tient — il valide, il appelle, et il traduit un refus en message.
 *
 * **Le choix entre les deux sources, et le cas « base configurée mais muette » → fichier +
 * message, vivent ici** : `creerMur(adaptateur, { secours })` lit la base, et si elle ne
 * répond pas, rend le fichier **avec la notice** de la panne (D-058 : un mur n'est jamais un
 * écran cassé à cause du réseau).
 *
 * **Ce que le port garde du vocabulaire d'avant** : les contrôles (`verifierTri`,
 * `verifierPosition`, la composition d'une ligne) et les **messages en français**, tels quels —
 * les tests de page les éprouvent, et un message qui change sous un test est une régression
 * déguisée. `src/lib/murBase.ts` les réexporte : aucun appelant ne casse (#254, 1re partie).
 */
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
  type VotesPostit
} from '@/store/mur';

/** D'où vient le mur — c'est ce que `charger` rend, et ce que la page affiche. */
export type SourceMur = 'base' | 'fichier' | 'memoire';

/** Les six gestes qui **écrivent** : `charger` ne se refuse pas de la même façon. */
export type GesteEcriture = 'poster' | 'voter' | 'trier' | 'deplacer' | 'corriger' | 'retirer';

/** Ce qu'un pouce demande à la base : insérer ma ligne, la changer, ou la retirer (#137). */
export type GesteVote = 'inserer' | 'changer' | 'retirer';

/** Un geste refusé : le message est **en français**, prêt à afficher. */
export interface RefusMur {
  ok: false;
  message: string;
}

/** Le résultat d'un geste : la réussite porte sa donnée, le refus porte son message. */
export type ResultatMur<T extends object = object> = ({ ok: true } & T) | RefusMur;

/** Une correction de titre et de texte, **par l'auteur** et **tant qu'il est `en attente`**. */
export interface Correction {
  titre: string;
  texte: string;
}

/** La ligne insérée dans `public.postits` : ce que la source écrit, jamais un `auteur`. */
export type LignePostit = Record<string, unknown>;

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
}

// ---------------------------------------------------------------------------------------------
// Les adapters — ce qu'une source du mur sait faire
// ---------------------------------------------------------------------------------------------

/**
 * Une source du mur, vue par le port. Chaque méthode rend la forme du contrat ou **lève** :
 * c'est le port qui attrape et qui rend le message. Un adapter qui rend un succès partiel
 * mentirait à l'écran.
 */
export interface AdaptateurMur {
  readonly source: SourceMur;

  /**
   * Le refus que ce geste reçoit **ici**, en français, ou `null` s'il est permis. Le fichier
   * est en **lecture seule** (D-058) et le dit ; la base et la mémoire écrivent. C'est ce qui
   * permet au port de refuser **avant** de composer quoi que ce soit, comme le faisait
   * `murBase.ts` en regardant son client.
   */
  refus(geste: GesteEcriture): string | null;

  /** Lit le mur entier, dans la forme du contrat. */
  charger(): Promise<Postit[]>;

  /** Colle une ligne déjà composée, et rend le post-it tel que la source le porte. */
  poster(ligne: LignePostit): Promise<Postit>;

  /** Écrit le geste de vote décidé par `gesteDeVote` (le port a déjà tranché lequel). */
  voter(postitId: string, demande: SensVote, geste: GesteVote): Promise<void>;

  /** Déplace le tri d'un post-it — le geste de l'administration (0006, D-088). */
  trier(id: string, tri: TriPostit): Promise<TriPostit>;

  /** Écrit la place d'un post-it, **déjà arrondie** par le port. */
  deplacer(id: string, position: PositionPostit): Promise<PositionPostit>;

  /** Corrige le titre et le texte de **mon** post-it, tant qu'il est `en attente` (#139). */
  corriger(id: string, correction: Correction): Promise<Correction>;

  /** Retire un post-it : il est **supprimé** (§3), la RLS sachant qui en a le droit (#186). */
  retirer(id: string): Promise<void>;
}

/** Le port, une fois branché sur une source : les sept gestes, et rien d'autre. */
export interface PortMur {
  readonly source: SourceMur;
  charger(): Promise<ResultatMur<{ postits: Postit[]; source: SourceMur; notice?: string }>>;
  poster(brouillon: BrouillonPostit, options?: OptionsPostit): Promise<ResultatMur<{ postit: Postit }>>;
  voter(postitId: string, demande: SensVote, actuel: SensVote | null): Promise<ResultatMur<{ vote: SensVote | null }>>;
  trier(id: string, tri: TriPostit): Promise<ResultatMur<{ tri: TriPostit }>>;
  deplacer(id: string, position: PositionPostit): Promise<ResultatMur<{ position: PositionPostit }>>;
  corriger(id: string, correction: Correction): Promise<ResultatMur<Correction>>;
  retirer(id: string): Promise<ResultatMur>;
}

/** Le message d'une panne, quelle que soit sa forme : jamais `[object Object]`. */
export function messageDErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

/** Un objet de la forme du contrat — jamais un tableau, jamais `null`. */
export const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

/** Un entier : un `id` de commentaire (`bigint`), un numéro de ticket. */
export const estEntier = (valeur: unknown): valeur is number => typeof valeur === 'number' && Number.isInteger(valeur);

// ---------------------------------------------------------------------------------------------
// La lecture d'une source, ramenée à la forme du contrat
// ---------------------------------------------------------------------------------------------

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
    votes: ligne.votes
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
    erreurs: toutes
  };
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

// ---------------------------------------------------------------------------------------------
// Les pouces : ce qu'un clic demande, et ce que dit un refus (#137)
// ---------------------------------------------------------------------------------------------

/**
 * Ce que devient le compteur quand mon vote passe de `avant` à `apres` : on retire l'ancien
 * pouce, on ajoute le nouveau. Pure et sans plancher caché — un compteur ne descend pas sous
 * zéro, mais c'est la base qui compte, pas ce calcul : il ne sert qu'à l'affichage immédiat.
 */
export function compterApres(votes: VotesPostit, avant: SensVote | null, apres: SensVote | null): VotesPostit {
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
export function gesteDeVote(actuel: SensVote | null, demande: SensVote): { geste: GesteVote; apres: SensVote | null } {
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

// ---------------------------------------------------------------------------------------------
// La place sur le tableau (D-068, #185)
// ---------------------------------------------------------------------------------------------

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
  return Math.max(Math.abs(a.x - b.x) / LARGEUR_POSTIT, Math.abs(a.y - b.y) / HAUTEUR_POSTIT);
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
export function positionDepuisId(id: string, prises: ReadonlyArray<PositionPostit> = []): PositionPostit {
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

/** La place appliquée est arrondie au dixième : c'est ce que le mur affichera. */
const arrondi = (valeur: number) => Math.round(valeur * 10) / 10;

// ---------------------------------------------------------------------------------------------
// Le dépôt d'un post-it (#136, D-085)
// ---------------------------------------------------------------------------------------------

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
export function composerLignePostit(brouillon: BrouillonPostit, options: OptionsPostit = {}): Record<string, unknown> {
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
    position_angle: position.angle
  };
}

// ---------------------------------------------------------------------------------------------
// Le port : sept gestes, et un résultat honnête
// ---------------------------------------------------------------------------------------------

export interface OptionsPortMur {
  /**
   * La source de **secours**, lue quand la principale ne répond pas : c'est ce qui laisse
   * l'alpha fonctionner sans backend (D-058) et ce qui empêche un mur muet d'être un écran
   * cassé. Un mur n'est **jamais** vide « parce que le réseau ».
   */
  secours?: AdaptateurMur;
}

/**
 * Branche le port sur une source. Chaque geste **rend** un résultat : rien ne sort d'ici en
 * exception, donc un écran peut tout afficher sans `try`/`catch` — et le même contrat vaut
 * pour la base, le fichier et la mémoire.
 *
 * Le port **ne décide pas** de qui a le droit : il valide la forme (un tri, une place, un
 * brouillon), il demande à l'adapter si le geste est permis là où il est branché, et il
 * laisse la source trancher le reste (RLS, D-059, D-088).
 */
export function creerMur(adaptateur: AdaptateurMur, options: OptionsPortMur = {}): PortMur {
  /** Le refus du port : un message en français, jamais une exception. */
  const refuse = (message: string): RefusMur => ({ ok: false, message });

  return {
    source: adaptateur.source,

    /**
     * Lit le mur. Si la source principale lève, la **secours** prend le relais et le résultat
     * porte une `notice` : la page dit la panne, et affiche quand même un mur.
     */
    async charger() {
      try {
        return { ok: true as const, postits: await adaptateur.charger(), source: adaptateur.source };
      } catch (erreur) {
        const panne = messageDErreur(erreur);
        if (!options.secours) return refuse(panne);
        const secours = options.secours;
        try {
          return {
            ok: true as const,
            postits: await secours.charger(),
            source: secours.source,
            notice: panne
          };
        } catch (erreurDeSecours) {
          return refuse(
            `${panne.replace(/\.?$/, '.')} Le mur de secours (${secours.source}) est illisible lui aussi : ${messageDErreur(erreurDeSecours)}`
          );
        }
      }
    },

    /**
     * Poste un post-it. La source est interrogée **avant** la composition, comme le faisait
     * `murBase.ts` : sans base, le refus est celui de la source (« le retour se donne de vive
     * voix »), pas celui d'un brouillon que personne n'aurait pu écrire.
     */
    async poster(brouillon, optionsBrouillon = {}) {
      const refus = adaptateur.refus('poster');
      if (refus) return refuse(refus);

      let ligne: LignePostit;
      try {
        ligne = composerLignePostit(brouillon, optionsBrouillon);
      } catch (erreur) {
        return refuse(messageDErreur(erreur));
      }

      try {
        return { ok: true as const, postit: await adaptateur.poster(ligne) };
      } catch (erreur) {
        return refuse(messageDErreur(erreur));
      }
    },

    /** Vote, change d'avis ou retire mon pouce — l'ordre de priorité est dans `gesteDeVote`. */
    async voter(postitId, demande, actuel) {
      const refus = adaptateur.refus('voter');
      if (refus) return refuse(refus);

      const { geste, apres } = gesteDeVote(actuel, demande);
      try {
        await adaptateur.voter(postitId, demande, geste);
        return { ok: true as const, vote: apres };
      } catch (erreur) {
        return refuse(messageDErreur(erreur));
      }
    },

    /** Déplace le tri d'un post-it : le contrôle passe **avant** la source, comme avant. */
    async trier(id, tri) {
      const malForme = verifierTri(tri);
      if (malForme) return refuse(malForme);

      const refus = adaptateur.refus('trier');
      if (refus) return refuse(refus);

      try {
        return { ok: true as const, tri: await adaptateur.trier(id, tri) };
      } catch (erreur) {
        return refuse(messageDErreur(erreur));
      }
    },

    /** Écrit la place d'un post-it, arrondie au dixième comme le fait la page. */
    async deplacer(id, position) {
      const horsBornes = verifierPosition(position);
      if (horsBornes) return refuse(horsBornes);

      const refus = adaptateur.refus('deplacer');
      if (refus) return refuse(refus);

      const demandee: PositionPostit = {
        x: arrondi(position.x),
        y: arrondi(position.y),
        angle: arrondi(position.angle)
      };
      try {
        return { ok: true as const, position: await adaptateur.deplacer(id, demandee) };
      } catch (erreur) {
        return refuse(messageDErreur(erreur));
      }
    },

    /** Corrige le titre et le texte : vides, c'est un refus **sans** toucher à la source. */
    async corriger(id, correction) {
      const titre = correction.titre.trim();
      const texte = correction.texte.trim();
      if (!titre || !texte) return refuse('Le titre et le texte ne peuvent pas être vides.');

      const refus = adaptateur.refus('corriger');
      if (refus) return refuse(refus);

      try {
        return { ok: true as const, ...(await adaptateur.corriger(id, { titre, texte })) };
      } catch (erreur) {
        return refuse(messageDErreur(erreur));
      }
    },

    /** Retire mon post-it — ou n'importe lequel, si je suis l'administration (#186). */
    async retirer(id) {
      const refus = adaptateur.refus('retirer');
      if (refus) return refuse(refus);

      try {
        await adaptateur.retirer(id);
        return { ok: true as const };
      } catch (erreur) {
        return refuse(messageDErreur(erreur));
      }
    }
  };
}
