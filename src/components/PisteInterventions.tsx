import { Fragment } from 'react';
import { POINTS_TO_WIN } from '@/game/rules';

/**
 * La piste d'Interventions (D-093, #190) : le score du combat, en hexagones, à la place de
 * `★★☆`. Une étoile est une **rareté** (`1S`, `2S`, `3S`, `docs/JEU.md` §3) ; un hexagone ne
 * se confond avec aucune rareté, et il se lit d'un coup d'œil à 420 px.
 *
 * Trois hexagones par camp, remplis **dans l'ordre** : les premiers sont acquis, en or. Chacun
 * porte son `aria-label` (« Intervention 2 sur 3, La Direction ») pour le lecteur d'écran ; le
 * groupe de chaque camp donne le nom du camp, et le conteneur la lecture d'ensemble.
 *
 * **Le score s'écrit entre les deux camps** (D-161, critique du 31/10/2026) : `0 — 0` et le
 * seuil de victoire `/ 3`, une seule fois, sur l'axe central. Avant, la condition de victoire
 * n'existait qu'en hexagones : il fallait les compter, et rien à l'écran ne disait « trois ».
 *
 * `designe` est le `data-pas-a-pas` du pas-à-pas (#143) : il tombe sur **le conteneur**, une
 * seule fois, jamais sur un camp — `Battle.tsx` ne le pose pas ailleurs.
 */

export interface CampPiste {
  /** Le nom du camp, lu par l'écran (« Toi », « La Direction »). */
  readonly label: string;
  /** Les Interventions marquées par ce camp. */
  readonly points: number;
  /**
   * Les numéros d'hexagone **qui viennent d'être acquis** (#192) : ils portent `is-fraiche`,
   * et le CSS leur donne un rebond d'une fois — ou aucun sous mouvement réduit, où le
   * remplissage de `is-acquise` suffit déjà.
   */
  readonly fraiches?: readonly number[];
}

export function PisteInterventions({
  camps,
  designe
}: {
  camps: readonly CampPiste[];
  /** Le `data-pas-a-pas` du pas-à-pas, posé sur le conteneur seul. */
  designe?: string;
}) {
  const lecture = camps.map(({ label, points }) => `${label} ${points} sur ${POINTS_TO_WIN}`).join(', ');
  // La capsule est `aria-hidden` : `lecture` la dit déjà au lecteur d'écran, dans l'ordre des
  // camps. Les chiffres sont donc une **aide visuelle**, pas une seconde source.
  const score = camps.map(({ points }) => points).join(' — ');

  return (
    <div className="piste" role="group" aria-label={`Interventions : ${lecture}`} data-pas-a-pas={designe}>
      {camps.map(({ label, points, fraiches = [] }, campIndex) => (
        <Fragment key={label}>
          {campIndex === 1 && (
            <span className="piste__score" aria-hidden="true">
              <strong className="piste__points">{score}</strong>
              <span className="piste__seuil">sur {POINTS_TO_WIN}</span>
            </span>
          )}
          <div className="piste__camp" role="group" aria-label={label}>
            <span className="piste__nom" aria-hidden="true">
              {label}
            </span>
            {Array.from({ length: POINTS_TO_WIN }, (_, index) => {
              const numero = index + 1;
              return (
                <span
                  key={numero}
                  role="img"
                  // L'état se **dit** : il n'était porté que par le remplissage de l'hexagone (WCAG, nom, rôle, valeur).
                  aria-label={`Intervention ${numero} sur ${POINTS_TO_WIN}, ${label}, ${numero <= points ? 'acquise' : 'à venir'}`}
                  className={`piste__hex${numero <= points ? ' is-acquise' : ''}${
                    fraiches.includes(numero) ? ' is-fraiche' : ''
                  }`}
                />
              );
            })}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
