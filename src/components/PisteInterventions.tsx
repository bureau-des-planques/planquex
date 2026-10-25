/**
 * La piste d'Interventions (D-093, #190) : le score du combat, en hexagones, à la place de
 * `★★☆`. Une étoile est une **rareté** (`1S`, `2S`, `3S`, `AGENTS.md` §3) ; un hexagone ne
 * se confond avec aucune rareté, et il se lit d'un coup d'œil à 420 px.
 *
 * Trois hexagones par camp, remplis **dans l'ordre** : les premiers sont acquis, en or. Chacun
 * porte son `aria-label` (« Intervention 2 sur 3, La Direction ») pour le lecteur d'écran ; le
 * groupe de chaque camp donne le nom du camp, et le conteneur la lecture d'ensemble.
 *
 * `designe` est le `data-pas-a-pas` du pas-à-pas (#143) : il tombe sur **le conteneur**, une
 * seule fois, jamais sur un camp — `Battle.tsx` ne le pose pas ailleurs.
 */

/** Interventions pour gagner (AGENTS.md §4, `engine.ts` : 3). */
const INTERVENTIONS_POUR_GAGNER = 3;

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
  const lecture = camps.map(({ label, points }) => `${label} ${points} sur ${INTERVENTIONS_POUR_GAGNER}`).join(', ');

  return (
    <div className="piste" role="group" aria-label={`Interventions : ${lecture}`} data-pas-a-pas={designe}>
      {camps.map(({ label, points, fraiches = [] }) => (
        <div className="piste__camp" role="group" aria-label={label} key={label}>
          <span className="piste__nom" aria-hidden="true">
            {label}
          </span>
          {Array.from({ length: INTERVENTIONS_POUR_GAGNER }, (_, index) => {
            const numero = index + 1;
            return (
              <span
                key={numero}
                role="img"
                aria-label={`Intervention ${numero} sur ${INTERVENTIONS_POUR_GAGNER}, ${label}`}
                className={`piste__hex${numero <= points ? ' is-acquise' : ''}${
                  fraiches.includes(numero) ? ' is-fraiche' : ''
                }`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
