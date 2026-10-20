/**
 * Le coût en **cafés** d'une Pression ou d'une Rotation, dessiné en pastilles d'or.
 *
 * Un seul rendu pour la carte (`CardView`), la fiche (`CardDetail`) et le bouton du
 * combat : le mot « café » reste du code, la pastille est le motif de la maison.
 */
interface Props {
  cost: number;
}

export function CafePips({ cost }: Props) {
  const label = cost > 0 ? `Coût : ${cost} café${cost > 1 ? 's' : ''}` : 'Aucun café requis';
  return (
    <span className="pips" title={label} aria-label={label}>
      {cost > 0 ? (
        Array.from({ length: cost }, (_, index) => <i className="pip" key={index} />)
      ) : (
        <i className="pip pip--free" />
      )}
    </span>
  );
}
