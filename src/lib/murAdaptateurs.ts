/**
 * Les trois adapters du mur (#254) — la **base**, le **fichier**, la **mémoire**.
 *
 * Le port (`src/lib/mur.ts`) parle en gestes ; ce module-ci sait où les gestes atterrissent.
 * Trois sources, une seule forme (`AdaptateurMur`) :
 *
 * 1. **la base** (`postits_avec_votes`, D-058, D-088) : c'est la source réelle, celle qui
 *    partage les post-its entre appareils, qui compte les pouces (#137) et dont la RLS décide
 *    qui a le droit d'écrire (D-059) ;
 * 2. **le fichier** (`docs/comite.json`, lu par `@/store/mur`) : l'alpha **en lecture seule**
 *    (D-058). Un site statique ne peut pas écrire dans son propre dépôt — ses six gestes
 *    d'écriture sont donc refusés, avec le message que les écrans connaissent déjà ;
 * 3. **la mémoire** : un mur qui vit dans une variable, pour éprouver la mécanique **sans
 *    réseau ni navigateur**. C'est la doublure des tests du port, et la seule source qui
 *    puisse refuser un geste **exprès** (`refuse`) — de quoi prouver que le port rend un
 *    message là où l'ancien code levait.
 *
 * **Le choix entre les deux sources réelles vit ici aussi** (`resoudreAdaptateur`) : la base
 * quand elle est configurée, le fichier sinon. Le port, lui, ne sait pas d'où il lit.
 */
import { clientMur, configurerMur, identiteSession, type ClientMur } from '@/lib/supabase';
import {
  DOCUMENT_MUR,
  STATUTS,
  lireMur,
  type PositionPostit,
  type Postit,
  type SensVote,
  type Statut,
  type VotesPostit
} from '@/store/mur';
import {
  estEntier,
  estObjet,
  lireMesVotes,
  lirePostitsDeLaBase,
  messageDeCorrection,
  messageDePlace,
  messageDeTri,
  messageDeVote,
  type AdaptateurMur,
  type Correction,
  type GesteEcriture,
  type GesteVote,
  type LignePostit,
  type TriPostit
} from '@/lib/mur';

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

// ---------------------------------------------------------------------------------------------
// L'adapter du fichier — l'alpha en lecture seule (D-058)
// ---------------------------------------------------------------------------------------------

/**
 * Le refus de chaque geste sur le fichier, **mot pour mot** celui de `murBase.ts` : il est
 * affiché par les écrans, et un message qui change sous un test est une régression déguisée.
 */
const REFUS_DU_FICHIER: Record<GesteEcriture, string> = {
  poster: 'Le mur n’est pas configuré : le retour se donne pour l’instant de vive voix.',
  voter: 'Le mur n’est pas configuré : on ne vote pas.',
  trier: 'Supabase n’est pas configuré : il n’y a pas de mur à trier.',
  deplacer: 'Le mur n’est pas configuré : la place ne peut pas s’écrire.',
  corriger: 'Le mur n’est pas configuré : on ne corrige pas de post-it.',
  retirer: 'Le mur n’est pas configuré : on ne retire pas de post-it.'
};

/**
 * Le mur du dépôt : il **se lit**, il ne s'écrit pas. `fichier` est injectable pour qu'un
 * test éprouve un fichier fautif sans toucher au vrai — un contrôle qui ne peut pas échouer
 * ne garde rien (`AGENTS.md` §6).
 *
 * `charger` passe par `lireMur`, **la** définition de la forme (§3 de `docs/COMITE.md`) : un
 * fichier qui ne l'a pas lève ici, il ne s'affiche pas à moitié.
 */
export function adaptateurFichier(fichier?: unknown): AdaptateurMur {
  const refus = (geste: GesteEcriture) => REFUS_DU_FICHIER[geste];
  /** Le geste d'écriture sur une source en lecture seule : refusé, jamais silencieux. */
  const lectureSeule = (geste: GesteEcriture) => async (): Promise<never> => {
    throw new Error(refus(geste));
  };

  return {
    source: 'fichier',
    refus,
    async charger() {
      const lu = lireMur(fichier ?? DOCUMENT_MUR);
      if (!lu.mur) {
        throw new Error(`Le mur du fichier n’a pas la forme du contrat : ${lu.erreurs.join(' ; ')}`);
      }
      return lu.mur.postits;
    },
    poster: lectureSeule('poster'),
    voter: lectureSeule('voter'),
    trier: lectureSeule('trier'),
    deplacer: lectureSeule('deplacer'),
    corriger: lectureSeule('corriger'),
    retirer: lectureSeule('retirer')
  };
}

// ---------------------------------------------------------------------------------------------
// L'adapter de la base — la source réelle (D-058, D-088)
// ---------------------------------------------------------------------------------------------

/**
 * La base, signée de mon identité. `chargerClient` est injectable : c'est ce qui rend cet
 * adapter éprouvable **sans réseau** (un faux client à trois méthodes suffit).
 *
 * **Ce que le client n'écrit jamais** : `auteur` (la base le remplit par `auth.uid()`), ni
 * `votant`, ni un statut autre que `en attente`. Les politiques de `0001`/`0004`/`0005` le
 * refuseraient de toute façon — l'écran ne fait que ne pas le proposer.
 */
export function adaptateurBase(
  client: ClientMur,
  chargerClient: () => Promise<ClientMur | null> = async () => client
): AdaptateurMur {
  return {
    source: 'base',
    // La base accepte les six gestes : c'est sa RLS qui tranche, pas l'adapter.
    refus: () => null,

    async charger() {
      const identite = await identiteSession(chargerClient);
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

      // Mon vote se distingue du total (#137). Si je ne peux pas le lire, je ne peux pas non
      // plus proposer de voter sans risquer un doublon : la panne lève, et le port retombe
      // sur la source de secours.
      const { data: mesLignes, error: erreurVotes } = await client
        .from('votes')
        .select('postit_id, sens')
        .eq('votant', identite);
      if (erreurVotes) {
        throw new Error(`Lecture de tes votes impossible : ${erreurVotes.message}`);
      }
      const mesVotes = lireMesVotes(mesLignes ?? []);

      const auteurs = new Map<string, unknown>(
        (Array.isArray(data) ? data : []).flatMap((ligne): Array<[string, unknown]> =>
          estObjet(ligne) && typeof ligne.id === 'string' ? [[ligne.id, ligne.auteur]] : []
        )
      );
      return postits.map((postit) => ({
        ...postit,
        votes: { ...postit.votes, mon: mesVotes.get(postit.id) ?? null },
        mien: auteurs.get(postit.id) === identite
      }));
    },

    async poster(ligne: LignePostit) {
      const identite = await identiteSession(chargerClient);
      if (!identite) {
        throw new Error('Aucune session : le post-it ne peut pas être signé.');
      }

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
        }
      ]);
      if (!postits) {
        throw new Error(`Le post-it écrit n’a pas la forme du contrat : ${erreurs.join(' ; ')}`);
      }
      // Il est à moi : pas de pouce sur mon propre post-it (#137).
      return { ...postits[0], votes: { up: 0, down: 0, mon: null }, mien: true };
    },

    async voter(postitId: string, demande: SensVote, geste: GesteVote) {
      const identite = await identiteSession(chargerClient);
      if (!identite) throw new Error('Aucune session : le vote ne peut pas être signé.');

      // Le client n'écrit **jamais** `votant` : à l'insertion, `{ postit_id, sens }`
      // seulement ; à la modification et au retrait, la ligne est visée par `postit_id`
      // **et** `votant` (un filtre, pas une écriture).
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
            : await client.from('votes').delete().eq('postit_id', postitId).eq('votant', identite).select('postit_id');

      if (reponse.error) throw new Error(messageDeVote(reponse.error.message));
      // Une modification ou un retrait qui ne touche **aucune ligne** (le vote a disparu
      // entre-temps) est une erreur : une RLS qui refuse ne lève rien, elle rend 0 ligne.
      if (geste !== 'inserer' && (!Array.isArray(reponse.data) || reponse.data.length === 0)) {
        throw new Error('Ton vote n’existe plus : recharge le mur pour voir où il en est.');
      }
    },

    async trier(id: string, tri: TriPostit) {
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
        ticket: estEntier(ligne.ticket) ? ligne.ticket : null
      };
    },

    async deplacer(id: string, position: PositionPostit) {
      const identite = await identiteSession(chargerClient);
      if (!identite) throw new Error('Aucune session : la place ne peut pas être signée.');

      // La fonction `deplacer_postit` (0007), et **pas** un `update` : une politique RLS ne
      // distingue pas les colonnes, donc rendre `position_*` écrivable rendrait aussi
      // `statut` à l'auteur de la ligne (D-092). La position reçue est **déjà arrondie** par
      // le port.
      const { data, error } = await client.rpc('deplacer_postit', {
        p_id: id,
        p_x: position.x,
        p_y: position.y,
        p_angle: position.angle
      });
      if (error) throw new Error(messageDePlace(error.message));

      const ligne = estObjet(data) ? data : null;
      if (!ligne) throw new Error('La base n’a pas rendu le post-it déplacé.');
      return {
        x: Number(ligne.position_x),
        y: Number(ligne.position_y),
        angle: Number(ligne.position_angle)
      };
    },

    async corriger(id: string, correction: Correction) {
      const identite = await identiteSession(chargerClient);
      if (!identite) throw new Error('Aucune session : la correction ne peut pas être signée.');

      // La fonction `corriger_postit` (0006) : le client n'a pas de droit direct sur `titre`
      // et `texte`, précisément pour qu'un administrateur ne puisse pas réécrire le post-it
      // d'un autre (#139).
      const { data, error } = await client.rpc('corriger_postit', {
        p_id: id,
        p_titre: correction.titre,
        p_texte: correction.texte
      });
      if (error) throw new Error(messageDeCorrection(error.message));

      const ligne = estObjet(data) ? data : null;
      if (!ligne || typeof ligne.titre !== 'string' || typeof ligne.texte !== 'string') {
        throw new Error('La base n’a pas rendu le post-it corrigé.');
      }
      return { titre: ligne.titre, texte: ligne.texte };
    },

    async retirer(id: string) {
      const identite = await identiteSession(chargerClient);
      if (!identite) throw new Error('Aucune session : le retrait ne peut pas être signé.');

      // **Pas de filtre sur `auteur`** (#186) : c'est la RLS qui décide, et elle en connaît
      // deux — l'auteur, tant que le post-it est `en attente` (0006), et l'administrateur, à
      // tout statut (`0007`). Filtrer ici retirerait son geste à l'administration.
      const { data, error } = await client.from('postits').delete().eq('id', id).select('id');
      if (error) throw new Error(messageDeCorrection(error.message));
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(
          'La base n’a retiré aucun post-it : il a peut-être bougé de statut (on ne retire le sien qu’en attente), ou tu n’as pas le droit de le retirer.'
        );
      }
    }
  };
}

// ---------------------------------------------------------------------------------------------
// L'adapter mémoire — éprouver la mécanique sans réseau ni navigateur
// ---------------------------------------------------------------------------------------------

export interface OptionsMemoire {
  /** Mes post-its : `true` partout par défaut (le mur d'un appareil qui vient de poster). */
  mien?: boolean | ((id: string) => boolean);
  /** Un compte approuvé peut écrire (D-088) ; sinon les gestes sont refusés. */
  approuve?: boolean;
  /** L'administration range et retire n'importe quel post-it (D-092, #186). */
  administrateur?: boolean;
  /**
   * Le refus **explicite** d'un geste, en français, pour ce que le cas réel ne fabrique pas :
   * c'est la doublure qui permet de prouver que le port **rend un message** au lieu de
   * laisser filer l'exception (#254).
   */
  refuse?: (geste: GesteEcriture) => string | null;
  /** Aucune session : la lecture elle-même est refusée, comme une RLS qui ne laisse rien voir. */
  sansSession?: boolean;
}

/** L'adapter mémoire, et son contenu — pour qu'un test puisse lire ce qui a été écrit. */
export interface AdaptateurMemoire extends AdaptateurMur {
  /** Le mur tel qu'il est en mémoire : une **copie**, le test ne peut pas le trafiquer. */
  contenu(): Postit[];
}

/** Un post-it neuf, dans la forme du contrat, à partir de la ligne composée par le port. */
function postitDepuisLigne(ligne: LignePostit): Postit {
  return {
    id: String(ligne.id ?? ''),
    kind: (ligne.kind as Postit['kind']) ?? null,
    titre: String(ligne.titre ?? ''),
    texte: String(ligne.texte ?? ''),
    ecran: (ligne.ecran as Postit['ecran']) ?? '',
    pseudo: String(ligne.pseudo ?? ''),
    version: String(ligne.version ?? ''),
    statut: 'en attente',
    raison: '',
    ticket: null,
    gueulage: ligne.gueulage === true,
    lie: null,
    position: {
      x: Number(ligne.position_x ?? 0),
      y: Number(ligne.position_y ?? 0),
      angle: Number(ligne.position_angle ?? 0)
    },
    votes: { up: 0, down: 0, mon: null },
    mien: true
  };
}

const arrondi = (valeur: number) => Math.round(valeur * 10) / 10;

/**
 * Un mur en mémoire : les sept gestes, les règles que la base tient elle-même (pas de vote
 * pour soi, une correction tant que le post-it est `en attente`, un tri réservé à
 * l'administration), et **aucun réseau**.
 *
 * Il ne singe pas la base : il garde la **mécanique** du port (résultat honnête, ordre des
 * contrôles, messages) et il peut **refuser exprès** (`refuse`), ce que la vraie base ne sait
 * pas faire à la demande.
 */
export function adaptateurMemoire(postits: readonly Postit[] = [], options: OptionsMemoire = {}): AdaptateurMemoire {
  const etat = structuredClone([...postits]);
  const estAMoi = (postit: Postit): boolean => {
    if (typeof options.mien === 'function') return options.mien(postit.id);
    return options.mien ?? postit.mien ?? true;
  };
  const approuve = options.approuve ?? true;
  const administrateur = options.administrateur ?? true;

  const trouver = (id: string): Postit => {
    const postit = etat.find((candidat) => candidat.id === id);
    if (!postit) throw new Error('Ce post-it n’existe plus : recharge le mur.');
    return postit;
  };

  const adapter: AdaptateurMemoire = {
    source: 'memoire',

    refus(geste) {
      const explicitementRefuse = options.refuse?.(geste) ?? null;
      if (explicitementRefuse) return explicitementRefuse;
      if (!approuve) return 'La base refuse : ton compte doit être approuvé avant d’écrire.';
      return null;
    },

    async charger() {
      if (options.sansSession) throw new Error('Aucune session : la base refuse la lecture du mur.');
      return structuredClone(etat);
    },

    async poster(ligne) {
      const postit = postitDepuisLigne(ligne);
      etat.push(postit);
      return structuredClone(postit);
    },

    async voter(postitId, demande, geste) {
      const postit = trouver(postitId);
      if (geste === 'inserer' && estAMoi(postit)) {
        throw new Error('La base refuse ce vote : on ne vote pas pour son propre post-it.');
      }
      const avant = postit.votes.mon ?? null;
      // Le pendant de « 0 ligne touchée » côté base : changer ou retirer un vote qui n'existe
      // plus n'est pas un succès silencieux.
      if (geste !== 'inserer' && avant === null) {
        throw new Error('Ton vote n’existe plus : recharge le mur pour voir où il en est.');
      }
      const compte: VotesPostit = { up: postit.votes.up, down: postit.votes.down };
      if (avant) compte[avant] = Math.max(0, compte[avant] - 1);
      if (geste !== 'retirer') compte[demande] += 1;
      postit.votes = { ...compte, mon: geste === 'retirer' ? null : demande };
    },

    async trier(id, tri) {
      if (!administrateur) {
        throw new Error('La base refuse : seul un administrateur trie le mur (D-088, migration 0006).');
      }
      const postit = trouver(id);
      postit.statut = tri.statut;
      postit.raison = tri.raison.trim();
      postit.ticket = tri.ticket;
      return { statut: postit.statut, raison: postit.raison, ticket: postit.ticket };
    },

    async deplacer(id, position) {
      const postit = trouver(id);
      if (!estAMoi(postit) && !administrateur) {
        throw new Error(
          'La base refuse ce déplacement : ce post-it n’est pas le tien, ou ton compte n’est pas approuvé.'
        );
      }
      postit.position = {
        x: arrondi(position.x),
        y: arrondi(position.y),
        angle: arrondi(position.angle)
      };
      return { ...postit.position };
    },

    async corriger(id, correction) {
      const postit = trouver(id);
      if (!estAMoi(postit)) {
        throw new Error('La base refuse : ce post-it n’est pas le tien, ou ton compte n’est pas encore approuvé.');
      }
      if (postit.statut !== 'en attente') {
        throw new Error(
          'Ce post-it a bougé de statut : il ne se corrige plus, sinon le mur ne dirait plus la même chose à tout le monde.'
        );
      }
      postit.titre = correction.titre;
      postit.texte = correction.texte;
      return { titre: postit.titre, texte: postit.texte };
    },

    async retirer(id) {
      const postit = trouver(id);
      const aMoiEtEnAttente = estAMoi(postit) && postit.statut === 'en attente';
      if (!aMoiEtEnAttente && !administrateur) {
        throw new Error(
          'La base n’a retiré aucun post-it : il a peut-être bougé de statut (on ne retire le sien qu’en attente), ou tu n’as pas le droit de le retirer.'
        );
      }
      etat.splice(etat.indexOf(postit), 1);
    },

    contenu: () => structuredClone(etat)
  };

  return adapter;
}

// ---------------------------------------------------------------------------------------------
// Le choix de la source
// ---------------------------------------------------------------------------------------------

/**
 * Branche le port sur la source **réelle** : la base quand elle est configurée, le fichier
 * sinon. `base` dit laquelle a été retenue — c'est ce qui permet à `murBase.ts` de rendre
 * `null` quand il n'y a pas de base (la page garde alors le fichier qu'elle a déjà bundlé).
 *
 * Le client est demandé **une fois** : sans session ni configuration, il est `null`, et
 * c'est le fichier qui prend le relais.
 */
export async function resoudreAdaptateur(
  chargerClient: () => Promise<ClientMur | null> = clientMur
): Promise<{ adaptateur: AdaptateurMur; base: boolean }> {
  // **Un client qui ne se charge pas n'est pas un plantage de l'écran** : `configurerMur`
  // lève sur une configuration à moitié posée, et l'import dynamique du SDK peut échouer.
  // Sans ce `catch`, l'erreur remontait jusqu'à la page — c'est le seul chemin par lequel
  // le port pouvait encore faire lever un appelant, et la relecture du 26/10/2026 l'a
  // trouvé. On retombe sur le fichier, comme quand la base n'est pas configurée : le mur
  // reste lisible, et c'est la promesse de l'en-tête de `mur.ts`.
  let client: ClientMur | null = null;
  try {
    client = await chargerClient();
  } catch {
    client = null;
  }
  if (!client) return { adaptateur: adaptateurFichier(), base: false };
  return { adaptateur: adaptateurBase(client, chargerClient), base: true };
}
