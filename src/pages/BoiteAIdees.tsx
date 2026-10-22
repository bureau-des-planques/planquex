/**
 * Le mur de la Boîte à idées (#129, D-058 et D-068).
 *
 * **C'est une page**, pas un panneau : la bulle y mène, et elle est absente pendant un
 * combat — donc on ne quitte jamais une partie en cours pour venir lire le mur (D-068).
 *
 * L'alpha est en **lecture seule** : le mur affiche ce que porte `docs/boite-a-idees.json`,
 * et rien d'autre. Pas de compteur, pas de commentaire, pas d'écriture (D-058, D-068).
 * La seule écriture possible est l'**export** des positions du mode de placement : un site
 * statique ne peut pas écrire dans son dépôt, donc le fichier se télécharge et se commite.
 *
 * États (D-060) : **vide** et **erreur** sont rendus ; **chargement** et **hors ligne**
 * n'ont pas lieu d'être — le fichier est bundlé par Vite, il n'y a aucune requête. C'est
 * écrit en bas de page plutôt que laissé à deviner.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Download, ExternalLink, Move, RotateCcw } from 'lucide-react';
import { PAPIERS, PostitDuMur } from '@/components/PostitDuMur';
import type { GlisserPostit } from '@/components/PostitDuMur';
import { DOCUMENT_MUR, exporterMur, lireMur } from '@/store/mur';
import type { Mur, PositionPostit } from '@/store/mur';

/** Le fichier est lu une fois : il ne change pas sans un nouveau déploiement. */
const LECTURE = lireMur(DOCUMENT_MUR);

/** La légende des trois papiers, dans l'ordre où ils se lisent (D-068). */
const LEGENDE: Array<[keyof typeof PAPIERS, string]> = [
  ['ip', 'jaune · une IP, une idée'],
  ['ouf', 'rouge · un OUF, un signalement'],
  ['gueulage', 'blanc et plus grand · un gueulage']
];

/** Les positions du fichier, indexées par post-it. */
function positionsDuMur(mur: Mur | null): Record<string, PositionPostit> {
  return Object.fromEntries((mur?.postits ?? []).map((postit) => [postit.id, postit.position]));
}

const borner = (valeur: number) => Math.min(100, Math.max(0, Math.round(valeur * 10) / 10));

export function BoiteAIdees() {
  const { mur, erreurs } = LECTURE;
  const [positions, setPositions] = useState(() => positionsDuMur(mur));
  const [placement, setPlacement] = useState(false);
  const [agrandi, setAgrandi] = useState<string | null>(null);
  const [message, setMessage] = useState<{ texte: string; alerte?: boolean } | null>(null);
  /** Compte les lâchers : l'effet qui contrôle le recouvrement tourne après le rendu. */
  const [lachers, setLachers] = useState(0);
  const tableau = useRef<HTMLDivElement>(null);
  const saisie = useRef<{ id: string; dx: number; dy: number } | null>(null);

  /**
   * Le placement laisse faire un vrai tableau : on peut se tromper. Ce contrôle dit
   * quand une place recouvre le **texte** d'un autre post-it — la règle de D-068 se
   * vérifie sur le rendu, pas sur la foi d'un commentaire.
   */
  const recouvrements = (): string[] => {
    const cadre = tableau.current;
    if (!cadre) return [];
    const textes = [...cadre.querySelectorAll<HTMLElement>('[data-postit-texte]')].map((texte) => ({
      id: texte.closest<HTMLElement>('[data-postit]')?.dataset.postit ?? '?',
      boite: texte.getBoundingClientRect()
    }));
    const paires: string[] = [];
    for (let i = 0; i < textes.length; i += 1) {
      for (let j = i + 1; j < textes.length; j += 1) {
        const a = textes[i].boite;
        const b = textes[j].boite;
        const largeur = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const hauteur = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (largeur > 2 && hauteur > 2) paires.push(`${textes[i].id} / ${textes[j].id}`);
      }
    }
    return paires;
  };

  /**
   * Le glisser du mode de placement. La position s'exprime en pourcentage du tableau,
   * jamais en pixels : c'est ce qui la fait survivre au changement d'écran (D-068).
   */
  const glisser: GlisserPostit = {
    debut: (event, postit) => {
      const cadre = tableau.current;
      if (!cadre || !event.isPrimary) return;
      const boite = cadre.getBoundingClientRect();
      const feuille = event.currentTarget.getBoundingClientRect();
      saisie.current = {
        id: postit.id,
        dx: ((event.clientX - feuille.left) / boite.width) * 100,
        dy: ((event.clientY - feuille.top) / boite.height) * 100
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    deplace: (event) => {
      const prise = saisie.current;
      const cadre = tableau.current;
      if (!prise || !cadre) return;
      const boite = cadre.getBoundingClientRect();
      const x = borner(((event.clientX - boite.left) / boite.width) * 100 - prise.dx);
      const y = borner(((event.clientY - boite.top) / boite.height) * 100 - prise.dy);
      setPositions((courantes) => {
        const courante = courantes[prise.id];
        return courante ? { ...courantes, [prise.id]: { ...courante, x, y } } : courantes;
      });
    },
    fin: (event) => {
      saisie.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setLachers((compte) => compte + 1);
    }
  };

  // Après un lâcher seulement : mesurer à chaque déplacement ferait clignoter l'alerte.
  useEffect(() => {
    if (!lachers) return;
    const paires = recouvrements();
    setMessage(
      paires.length
        ? {
            alerte: true,
            texte: `Ce placement recouvre le texte de ${paires.join(', ')}. Déplace le post-it avant d’exporter — un texte ne doit jamais en cacher un autre.`
          }
        : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `recouvrements` lit le DOM.
  }, [lachers]);

  const fichier = useMemo(() => exporterMur(positions), [positions]);

  const telecharger = () => {
    const url = URL.createObjectURL(new Blob([fichier], { type: 'application/json' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = 'boite-a-idees.json';
    lien.click();
    URL.revokeObjectURL(url);
    setMessage({
      texte:
        'Fichier téléchargé. Remplace docs/boite-a-idees.json par lui, puis commite — c’est tout le mécanisme de l’alpha.'
    });
  };

  const copier = () => {
    const refus = () =>
      setMessage({
        texte: 'Le navigateur a refusé le presse-papier : le texte est dans la zone, recopie-le à la main.'
      });
    const envoi = navigator.clipboard?.writeText(fichier);
    if (!envoi) {
      refus();
      return;
    }
    envoi.then(
      () => setMessage({ texte: 'Fichier copié. Colle-le dans docs/boite-a-idees.json, puis commite.' }),
      refus
    );
  };

  return (
    <div className="page">
      <section className="section">
        <div className="section__head">
          <div>
            <h1>La Boîte à idées</h1>
            <p className="muted max-w-[62ch]">
              Le mur des retours d’alpha : ce que les invités proposent (<strong>IP</strong>) et
              signalent (<strong>OUF</strong>). Le jeu le lit et n’y écrit pas — pour laisser un
              post-it, passe par le formulaire.
            </p>
          </div>
          <div className="actions">
            {mur?.formulaire ? (
              <a
                className="button button--gold"
                href={mur.formulaire}
                target="_blank"
                rel="noopener noreferrer"
              >
                Proposer une idée / signaler <ExternalLink size={16} />
              </a>
            ) : (
              <p className="notice notice--warn m-0 max-w-[38ch]">
                Le formulaire n’est pas encore branché : le retour se donne pour l’instant de
                vive voix, à Bastien.
              </p>
            )}
            <Link className="button" to="/">
              <ArrowLeft size={16} /> Retour au bureau
            </Link>
          </div>
        </div>

        <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-[0.76rem] text-ink-muted">
          {LEGENDE.map(([apparence, texte]) => (
            <li className="flex items-center gap-2" key={apparence}>
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 rounded-[2px] ring-1 ring-black/30"
                style={{ background: PAPIERS[apparence].teinte }}
              />
              {texte}
            </li>
          ))}
          <li>Un gueulage reste une IP ou un OUF : le papier dit d’où il vient.</li>
        </ul>
      </section>

      {erreurs.length > 0 && (
        <section className="notice notice--warn">
          <h2>Le fichier du mur n’a pas pu être lu</h2>
          <p className="m-0 max-w-[70ch]">
            Le mur reste fermé tant que le fichier n’est pas réparé :{' '}
            <code>docs/boite-a-idees.json</code>, dont la forme est écrite dans{' '}
            <code>docs/BOITE-A-IDEES.md</code> §3.
          </p>
          <ul className="mt-2 mb-0 flex flex-col gap-1 text-[0.84rem]">
            {erreurs.map((erreur) => (
              <li key={erreur}>{erreur}</li>
            ))}
          </ul>
        </section>
      )}

      {mur && mur.postits.length === 0 && (
        <section className="section">
          <div className="empty">
            <p className="m-0 font-heading text-[1.15rem] font-bold text-ink">
              Le mur est encore vide.
            </p>
            <p className="mx-auto mt-1 mb-0 max-w-[52ch]">
              Les post-its arrivent par le formulaire : ils apparaîtront ici avec leur papier et
              leur place sur le tableau.
            </p>
            {mur.formulaire && (
              <a
                className="button button--gold mt-4"
                href={mur.formulaire}
                target="_blank"
                rel="noopener noreferrer"
              >
                Laisser le premier post-it <ExternalLink size={16} />
              </a>
            )}
          </div>
        </section>
      )}

      {mur && mur.postits.length > 0 && (
        <section className="panel">
          <div
            ref={tableau}
            className="relative max-[899px]:grid max-[899px]:grid-cols-1 max-[899px]:gap-4 min-[421px]:max-[899px]:grid-cols-2 min-[900px]:min-h-[600px]"
          >
            {mur.postits.map((postit, ordre) => (
              <PostitDuMur
                key={postit.id}
                postit={postit}
                position={positions[postit.id] ?? postit.position}
                ordre={ordre}
                placement={placement}
                agrandi={agrandi === postit.id}
                onAgrandir={(id) => setAgrandi((courant) => (courant === id ? null : id))}
                glisser={glisser}
              />
            ))}
          </div>
        </section>
      )}

      <section className="section panel">
        <h2>Le rangement</h2>
        <p className="muted max-w-[64ch] min-[900px]:hidden">
          Sur téléphone, les post-its s’empilent et la page défile. Le rangement se fait sur un
          écran large, au glisser — pas au doigt.
        </p>

        <div className="flex max-[899px]:hidden flex-col gap-3">
          <p className="m-0 max-w-[66ch] text-[0.9rem]">
            En mode placement, un post-it se <strong>glisse</strong> à la souris et sa position
            s’écrit en pourcentage du tableau : tout le monde verra la même disposition, quel que
            soit l’écran. L’application est un <strong>site statique</strong> — elle ne peut pas
            écrire dans le dépôt : le fichier exporté ci-dessous se <strong>commite</strong> à la
            place de <code>docs/boite-a-idees.json</code>. C’est le mécanisme de l’alpha, en
            attendant la base.
          </p>

          {mur && mur.postits.length > 0 ? (
            <>
              <div className="actions">
                <button
                  type="button"
                  className={placement ? 'button button--gold' : 'button'}
                  aria-pressed={placement}
                  onClick={() => {
                    setPlacement((actif) => !actif);
                    setMessage(null);
                  }}
                >
                  <Move size={16} /> {placement ? 'Terminer le placement' : 'Mode de placement'}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setPositions(positionsDuMur(mur));
                    setMessage({ texte: 'Positions revenues à celles du fichier.' });
                  }}
                >
                  <RotateCcw size={16} /> Revenir aux positions du fichier
                </button>
              </div>

              {placement && (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="settings__save"
                    readOnly
                    rows={10}
                    value={fichier}
                    aria-label="Le fichier du mur, avec les positions choisies"
                  />
                  <div className="actions actions--tight">
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={telecharger}
                    >
                      <Download size={16} /> Télécharger le fichier
                    </button>
                    <button type="button" className="button" onClick={copier}>
                      <Copy size={16} /> Copier
                    </button>
                  </div>
                </div>
              )}

              {message && (
                <p
                  className={
                    message.alerte ? 'notice notice--warn m-0' : 'm-0 text-[0.86rem] text-ink-muted'
                  }
                >
                  {message.texte}
                </p>
              )}
            </>
          ) : (
            <p className="m-0 text-[0.86rem] text-ink-dim">
              Rien à ranger pour l’instant : le mode s’ouvre dès le premier post-it.
            </p>
          )}
        </div>
      </section>

      <p className="m-0 text-[0.78rem] text-ink-dim">
        Le mur est dans le paquet de l’application : il n’a rien à charger, et il s’affiche aussi
        hors ligne. Aucun compteur ici — les pouces arrivent avec la base (#135, puis #137).
      </p>
    </div>
  );
}
