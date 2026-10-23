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
 * **Le gueulage (D-085)** n'a pas de famille : il s'écrit avec `kind` nul, ce que la
 * migration 0003 permet (à appliquer avant le premier dépôt d'un gueulage). Une ancienne
 * ligne `IP` reste lisible : la lecture retire la famille d'un gueulage.
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
  lireMur,
  type Ecran,
  type Famille,
  type Postit,
  type PositionPostit,
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
 * L'identité anonyme est signée **avant** la lecture : les droits sont donnés au rôle
 * `authenticated`, pas à `anon` (migration #135). Sans session, la base refuse — c'est voulu.
 */
export async function chargerPostitsDuMur(
  chargerClient: () => Promise<ClientMur | null> = clientMur,
): Promise<Postit[] | null> {
  const client = await chargerClient();
  if (!client) return null;

  const identite = await identiteAppareil(chargerClient);
  if (!identite) {
    throw new Error('Identité anonyme indisponible : la base refuse la lecture du mur.');
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
  return postits;
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

/**
 * Une place sur le tableau, **en pourcentage** (D-068), dérivée de l'id : sans elle, la base
 * poserait tous les post-its au centre, empilés les uns sur les autres. Elle est stable —
 * le même id redonne la même place — et reste dans les bornes de la migration.
 */
export function positionDepuisId(id: string): PositionPostit {
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
  const position = positionDepuisId(id);

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
    throw new Error('Identité anonyme indisponible : le post-it ne peut pas être signé.');
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
  return postits[0];
}
