/**
 * Un post-it du mur (#129) — le papier, la famille, et ce qu'il porte.
 *
 * Trois apparences pour deux familles (D-068) : **jaune** = IP, **rouge** = OUF,
 * **blanc et plus grand** = un gueulage. Un gueulage **reste** une IP ou un OUF : le
 * papier dit d'où vient le message, la famille conduit le tri — l'étiquette du haut
 * porte donc les deux (« Gueulage · OUF »).
 *
 * Le papier est une **surface colorée**, pas un composant de l'identité : sa teinte
 * vient des jetons (`--gold-soft`, `--danger`, `--text`), et l'encre est
 * `--primary-foreground`, le jeton « texte posé sur une surface teintée » (contraste
 * AA sur les trois papiers). Aucun hex n'est recopié ici.
 */
import type { CSSProperties, PointerEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Postit, PositionPostit, Statut } from '@/store/mur';

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

interface Props {
  postit: Postit;
  position: PositionPostit;
  ordre: number;
  placement: boolean;
  agrandi: boolean;
  onAgrandir: (id: string) => void;
  glisser: GlisserPostit;
}

export function PostitDuMur({ postit, position, ordre, placement, agrandi, onAgrandir, glisser }: Props) {
  const papier = PAPIERS[apparenceDe(postit)];

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
      <span className="flex items-baseline justify-between gap-3 text-[0.64rem] font-bold uppercase tracking-[0.13em]">
        <span>{postit.gueulage ? `${papier.nom} · ${postit.kind}` : papier.nom}</span>
        <span className="text-[0.7rem] font-medium normal-case tracking-normal opacity-80">
          {postit.pseudo || 'anonyme'}
        </span>
      </span>

      <span className="mt-2 block font-heading text-[1.02rem] font-bold leading-tight">
        {postit.titre}
      </span>

      <span className={`mt-1.5 block leading-snug whitespace-pre-line ${postit.gueulage ? 'text-[0.94rem]' : 'text-[0.83rem]'}`} data-postit-texte>
        {postit.texte}
      </span>
    </>
  );

  return (
    <div
      data-postit={postit.id}
      className={`w-full min-[900px]:absolute min-[900px]:w-[236px] ${postit.gueulage ? 'min-[900px]:w-[300px]' : ''} ${
        placement ? 'min-[900px]:cursor-grab min-[900px]:touch-none min-[900px]:select-none' : ''
      }`}
      style={cadre}
      onPointerDown={placement ? (event) => glisser.debut(event, postit) : undefined}
      onPointerMove={placement ? glisser.deplace : undefined}
      onPointerUp={placement ? glisser.fin : undefined}
      onPointerCancel={placement ? glisser.fin : undefined}
    >
      <article
        className="relative rounded-[3px] px-4 pt-4 pb-3.5 text-left shadow-[4px_6px_16px_rgba(0,0,0,0.45)] transition-shadow duration-200 hover:shadow-[6px_10px_24px_rgba(0,0,0,0.55)]"
        style={feuille}
      >
        {/* Le morceau de scotch : c'est lui qui dit « collé », avec l'inclinaison. */}
        <span
          aria-hidden="true"
          className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 -rotate-2 bg-white/20"
        />

        {placement ? (
          <div>{contenu}</div>
        ) : (
          <button
            type="button"
            className="block w-full cursor-pointer text-left"
            aria-expanded={agrandi}
            aria-label={`Agrandir le post-it « ${postit.titre} »`}
            onClick={() => onAgrandir(postit.id)}
          >
            {contenu}
          </button>
        )}

        {/* Sur écran large, le statut et le ticket vivent sur le post-it ; en étroit,
            ils se rangent derrière une pression (D-068). */}
        <div
          className={
            agrandi
              ? 'mt-3 flex flex-col gap-1.5'
              : 'mt-3 hidden flex-col gap-1.5 min-[900px]:flex'
          }
        >
          <span className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.1em]">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ background: TEINTE_STATUT[postit.statut] }}
            />
            {postit.statut}
          </span>

          {postit.statut === 'écarté' && postit.raison && (
            <span className="block text-[0.76rem] leading-snug italic opacity-80">
              Raison : {postit.raison}
            </span>
          )}

          {postit.ticket !== null && (
            <a
              className="inline-flex items-center gap-1 self-start text-[0.76rem] font-semibold underline underline-offset-2"
              href={`https://github.com/Chapax/planquex/issues/${postit.ticket}`}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(event) => event.stopPropagation()}
            >
              Ticket #{postit.ticket} <ExternalLink size={12} />
            </a>
          )}

          {postit.version && (
            <span className="block text-[0.7rem] opacity-70">Écrit en {postit.version}</span>
          )}
        </div>
      </article>
    </div>
  );
}
