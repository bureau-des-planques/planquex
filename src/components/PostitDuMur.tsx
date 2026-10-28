/**
 * Un post-it du mur (#129) — le papier, la famille, et ce qu'il porte.
 *
 * Trois apparences pour **deux familles et une nature à part** : **jaune** = IP,
 * **rouge** = OUF, **blanc et plus grand** = un gueulage. Depuis D-085, un gueulage
 * n'est **ni une IP ni un OUF** : il ne porte pas de famille, son étiquette dit
 * « Gueulage », et rien de plus. Quand la même réponse a produit un post-it (une IP ou
 * un OUF), il **se colle** sur le gueulage : c'est le prop `associe`.
 *
 * Le papier est une **surface colorée**, pas un composant de l'identité : sa teinte
 * vient des jetons (`--gold-soft`, `--danger`, `--text`), et l'encre est
 * `--primary-foreground`, le jeton « texte posé sur une surface teintée » (contraste
 * AA sur les trois papiers). Aucun hex n'est recopié ici.
 */
import type { CSSProperties, PointerEvent } from 'react';
import { ExternalLink, ThumbsDown, ThumbsUp } from 'lucide-react';
import { CorrectionDuPostit, FilDuPostit, RetraitDuPostit } from '@/components/FilDuPostit';
import type { CorrectionPostit, FilPostit, RetraitPostit } from '@/components/FilDuPostit';
import type { Postit, PositionPostit, SensVote, Statut } from '@/store/mur';

/** Les trois papiers. Exporté pour la légende de la page : une seule source. */
export const PAPIERS = {
  ip: { nom: 'IP', teinte: 'var(--gold-soft)' },
  ouf: { nom: 'OUF', teinte: 'var(--danger)' },
  gueulage: { nom: 'Gueulage', teinte: 'var(--text)' }
} as const;

function apparenceDe(postit: Postit): keyof typeof PAPIERS {
  if (postit.gueulage) return 'gueulage';
  return postit.kind === 'OUF' ? 'ouf' : 'ip';
}

/** Le témoin du statut : une pastille discrète, le statut écrit à côté. */
const TEINTE_STATUT: Record<Statut, string> = {
  'en attente': 'var(--text-dim)',
  retenu: 'var(--gold-deep)',
  'en cours': 'var(--accent-deep)',
  fait: 'var(--ok)',
  écarté: 'var(--danger)'
};

/** Les gestes du mode de placement, tenus par la page (D-068). */
export interface GlisserPostit {
  debut: (event: PointerEvent<HTMLElement>, postit: Postit) => void;
  deplace: (event: PointerEvent<HTMLElement>) => void;
  fin: (event: PointerEvent<HTMLElement>) => void;
}

/**
 * Les pouces d'un post-it (#137). La page ne les donne **que** lorsque la base a répondu :
 * sans elle (le fichier du dépôt), pas de prop, donc ni bouton ni compteur.
 */
export interface PoucesDuPostit {
  /** Un vote de ce post-it est en vol : on n'en empile pas un second. */
  occupe: boolean;
  /** Le dernier vote refusé ou perdu, dit discrètement ; `null` sinon. */
  erreur: string | null;
  onVoter: (postit: Postit, sens: SensVote) => void;
}

interface Props {
  postit: Postit;
  position: PositionPostit;
  ordre: number;
  placement: boolean;
  /**
   * Ce post-it se prend-il en mode placement (#185) ? Sur le fichier, oui, tous — c'est le
   * bureau qui range. Sur la base, la politique de `0001`/`0005` n'autorise que l'auteur à
   * déplacer le sien : un post-it d'un autre n'offre donc pas la prise, et le dit.
   */
  deplacable?: boolean;
  agrandi: boolean;
  onAgrandir: (id: string) => void;
  glisser: GlisserPostit;
  pouces?: PoucesDuPostit;
  /** Le post-it (IP ou OUF) que la même réponse a produit, **collé** sur le gueulage. */
  associe?: Postit | null;
  /**
   * Le fil du post-it (#138). Comme les pouces, la page ne le donne **que** lorsque la base
   * a répondu : le fichier du dépôt ne porte pas de commentaires.
   */
  fil?: FilPostit;
  /** La relecture (#139), seulement sur **mon** post-it et seulement branché sur la base. */
  correction?: CorrectionPostit;
  /**
   * Le retrait d'administration (#186) : sur le post-it d'un **autre**, quand je suis
   * administrateur. La base le permet à tout statut (`0007`), l'auteur non (`0006`).
   */
  retrait?: RetraitPostit;
}

export function PostitDuMur({
  postit,
  position,
  ordre,
  placement,
  deplacable = true,
  agrandi,
  onAgrandir,
  glisser,
  pouces,
  associe,
  fil,
  correction,
  retrait
}: Props) {
  const papier = PAPIERS[apparenceDe(postit)];
  const papierAssocie = associe ? PAPIERS[apparenceDe(associe)] : null;
  /** La prise n'existe qu'en mode placement, et seulement sur un post-it qu'on a le droit de ranger. */
  const poignee = placement && deplacable;
  /** L'identifiant du détail : `aria-controls` du bouton le désigne, et le bloc le porte. */
  const detailId = `postit-detail-${postit.id}`;

  const cadre: CSSProperties = {
    left: `${position.x}%`,
    top: `${position.y}%`,
    zIndex: 1 + ordre
  };

  const feuille: CSSProperties = {
    background: papier.teinte,
    color: 'var(--primary-foreground)',
    transform: `rotate(${position.angle}deg)`
  };

  const contenu = (
    <>
      <span className="flex items-baseline justify-between gap-3 text-[0.7rem] font-bold uppercase tracking-[0.13em]">
        {/* Un gueulage ne porte **aucune** famille : « Gueulage », jamais « · IP » (D-085). */}
        <span>{papier.nom}</span>
        <span className="text-[0.7rem] font-medium normal-case tracking-normal opacity-80">
          {postit.pseudo || 'anonyme'}
        </span>
      </span>

      <span className="mt-2 block font-heading text-[1.02rem] font-bold leading-tight">{postit.titre}</span>

      {/* **Compact** (#280) : trois lignes au repos pour parcourir le mur d'un coup d'œil ;
          le texte entier revient quand le post-it est ouvert. */}
      <span
        className={`mt-1.5 leading-snug whitespace-pre-line ${
          postit.gueulage ? 'text-[0.94rem]' : 'text-[0.83rem]'
        } ${agrandi ? 'block' : 'line-clamp-3'}`}
        data-postit-texte
      >
        {postit.texte}
      </span>

      {/* L'affordance du clic : elle dit qu'un détail existe, sans promettre une navigation. */}
      {!placement && (
        <span className="mt-2 block text-[0.72rem] font-bold uppercase tracking-[0.14em] opacity-90" aria-hidden="true">
          {agrandi ? 'Réduire' : 'Ouvrir'}
        </span>
      )}
    </>
  );

  return (
    <div
      data-postit={postit.id}
      className={`w-full min-[900px]:absolute min-[900px]:w-[236px] ${postit.gueulage ? 'min-[900px]:w-[300px]' : ''} ${
        poignee ? 'min-[900px]:cursor-grab min-[900px]:touch-none min-[900px]:select-none' : ''
      } ${placement && !deplacable ? 'min-[900px]:cursor-not-allowed' : ''}`}
      style={cadre}
      title={placement && !deplacable ? 'On ne range que ses propres post-its.' : undefined}
      onPointerDown={poignee ? (event) => glisser.debut(event, postit) : undefined}
      onPointerMove={poignee ? glisser.deplace : undefined}
      onPointerUp={poignee ? glisser.fin : undefined}
      onPointerCancel={poignee ? glisser.fin : undefined}
    >
      <article
        data-ouvert={agrandi}
        className="relative rounded-[3px] px-3.5 pt-3.5 pb-3 text-left shadow-[4px_6px_16px_rgba(0,0,0,0.45)] transition-shadow duration-200 hover:shadow-[6px_10px_24px_rgba(0,0,0,0.55)] hover:brightness-[1.03] focus-within:ring-2 focus-within:ring-current focus-within:ring-offset-2"
        style={feuille}
      >
        {/* Le morceau de scotch : c'est lui qui dit « collé », avec l'inclinaison. */}
        <span aria-hidden="true" className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 -rotate-2 bg-white/20" />

        {placement ? (
          <div>{contenu}</div>
        ) : (
          <button
            type="button"
            className="block w-full cursor-pointer rounded-[2px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            aria-expanded={agrandi}
            aria-controls={detailId}
            aria-label={`Agrandir le post-it « ${postit.titre} »`}
            onClick={() => onAgrandir(postit.id)}
          >
            {contenu}
          </button>
        )}

        {/* Le statut, le ticket et la version **au repos** : c'est ce qu'on lit sans ouvrir
            (#280). Le fil, la correction et le retrait suivent, dans le détail. */}
        <div id={detailId} className="mt-2.5 flex flex-col gap-1.5">
          {pouces && <PoucesDuMur postit={postit} pouces={pouces} />}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] font-bold uppercase tracking-[0.1em]">
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ background: TEINTE_STATUT[postit.statut] }}
              />
              {postit.statut}
            </span>
            {postit.ticket !== null && (
              <a
                className="inline-flex items-center gap-1 text-[0.72rem] font-bold underline underline-offset-2"
                href={`https://github.com/bureau-des-planques/planquex/issues/${postit.ticket}`}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={(event) => event.stopPropagation()}
              >
                Ticket #{postit.ticket} <ExternalLink size={12} />
              </a>
            )}
          </div>

          {postit.statut === 'écarté' && postit.raison && (
            <span className="block text-[0.76rem] leading-snug italic opacity-80">Raison : {postit.raison}</span>
          )}

          {/* La version, une seule fois : elle dit de quand date le post-it (#280). */}
          {postit.version && <span className="block text-[0.72rem] opacity-80">Écrit en {postit.version}</span>}

          {/* Le détail (#280) : le fil et la relecture ne se déplient qu'à la demande, et un
              seul post-it à la fois (la page tient `agrandi`). */}
          {agrandi && !placement && correction && <CorrectionDuPostit postit={postit} correction={correction} />}
          {agrandi && !placement && retrait && <RetraitDuPostit postit={postit} retrait={retrait} />}
          {agrandi && !placement && fil && <FilDuPostit postit={postit} fil={fil} />}
        </div>

        {/* Un post-it qui a des commentaires le dit **même replié** : sans ça, personne
            n'irait les chercher derrière une pression (D-068). Ce n'est pas un compteur de
            vanité comme les pouces : c'est du texte déjà là, et la ligne mène au fil. */}
        {!agrandi && fil && fil.commentaires.length > 0 && (
          <p className="fil__compte">
            {fil.commentaires.length} commentaire{fil.commentaires.length > 1 ? 's' : ''} — ouvrir pour lire
          </p>
        )}

        {/* Le post-it associé (D-085) : petit, incliné, avec son scotch — il se lit
            **collé sur** le gueulage, jamais comme un second post-it libre. Sa teinte
            est celle de sa famille : l'OUF reste rouge, l'IP reste jaune. */}
        {associe && papierAssocie && (
          <div
            data-associe={associe.id}
            className="relative -mt-2 ml-auto mr-0.5 w-[86%] max-w-[240px] -rotate-2 rounded-[2px] px-3 pt-3 pb-2 text-left shadow-[3px_5px_12px_rgba(0,0,0,0.5)]"
            style={{
              background: papierAssocie.teinte,
              color: 'var(--primary-foreground)'
            }}
          >
            <span
              aria-hidden="true"
              className="absolute -top-1.5 left-1/2 h-3 w-9 -translate-x-1/2 -rotate-3 bg-white/25"
            />
            <span className="flex items-baseline justify-between gap-2 text-[0.7rem] font-bold uppercase tracking-[0.13em]">
              <span>{papierAssocie.nom}</span>
              <span className="text-[0.7rem] font-medium normal-case tracking-normal opacity-80">
                {associe.pseudo || 'anonyme'}
              </span>
            </span>
            <span className="mt-1.5 block font-heading text-[0.86rem] font-bold leading-tight">{associe.titre}</span>
            <span className="mt-1 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.1em]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: TEINTE_STATUT[associe.statut] }}
              />
              {associe.statut}
            </span>
          </div>
        )}
      </article>
    </div>
  );
}

/**
 * Les deux pouces avec leur compte, et **mon** vote distinct du total : le pouce que j'ai
 * levé est plein et porte « ton vote ». Sur mon propre post-it, on voit les comptes mais on
 * ne vote pas — la base le refuse de toute façon (migration 0004).
 */
function PoucesDuMur({ postit, pouces }: { postit: Postit; pouces: PoucesDuPostit }) {
  const mon = postit.votes.mon ?? null;
  const mien = postit.mien === true;

  const pouce = (sens: SensVote) => {
    const Icone = sens === 'up' ? ThumbsUp : ThumbsDown;
    const compte = postit.votes[sens];
    const choisi = mon === sens;
    const nom = sens === 'up' ? 'pouce levé' : 'pouce baissé';
    return (
      <button
        type="button"
        className="pouce"
        aria-pressed={choisi}
        disabled={mien || pouces.occupe}
        title={mien ? 'On ne vote pas pour son propre post-it.' : undefined}
        aria-label={`${nom}, ${compte} ${compte > 1 ? 'votes' : 'vote'}${choisi ? ' — ton vote' : ''}`}
        // Le glisser du mode de placement écoute le post-it entier : un pouce n'est pas une prise.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => pouces.onVoter(postit, sens)}
      >
        <Icone size={15} aria-hidden="true" />
        <span>{compte}</span>
        {choisi && <span className="pouce__mien">ton vote</span>}
      </button>
    );
  };

  return (
    <div className="pouces" data-pouces={postit.id}>
      {pouce('up')}
      {pouce('down')}
      {mien && <p className="pouces__note">C’est ton post-it : les autres votent, pas toi.</p>}
      {pouces.erreur && (
        <p className="pouces__note pouces__note--erreur" role="status">
          {pouces.erreur}
        </p>
      )}
    </div>
  );
}
