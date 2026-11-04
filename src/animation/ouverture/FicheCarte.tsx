/*
 * **La fiche d'une carte de l'Arrivage** : tout ce que la carte porte, en toutes lettres (#283).
 *
 * La carte agrandie abrège ses textes (une Pression longue finit en « … ») ; la fiche les donne
 * entiers, comme la fiche de la Collection (`CardDetail`), mais **dans** la scène : un second
 * dialogue par-dessus celui de l'Arrivage volerait le focus et l'Échap.
 */
import { useEffect, useRef, useState } from 'react';
import { ACTION_KIND_META, FACTION_META, ITEM_KIND_META, RARITY_META, isPlanque, kindLabel } from '@/data';
import type { Card } from '@/data/types';
import { CafePips } from '@/components/CafePips';
import { WEAKNESS_BONUS } from '@/game/rules';

interface Props {
  carte: Card;
  neuve: boolean;
  style: React.CSSProperties;
  disposition: 'cote' | 'dessous';
  onFermer: () => void;
}

export function FicheCarte({ carte, neuve, style, disposition, onFermer }: Props) {
  const faction = FACTION_META[carte.faction];
  const rarete = RARITY_META[carte.rarity];
  const planque = isPlanque(carte);

  /**
   * **La fiche défile-t-elle encore ?** (D-170) À 390 × 664, le panneau mesure 254 px pour 323 px
   * de texte : 71 px coupés, sans barre ni dégradé — et comme son bas tombe sur le pied, la
   * dernière Pression se lisait tranchée par le bord. Le repère ne s'affiche que s'il reste du
   * texte **sous** le viseur, et s'efface quand on arrive au bout.
   */
  const boite = useRef<HTMLElement>(null);
  const [defile, setDefile] = useState(false);
  useEffect(() => {
    const el = boite.current;
    if (!el) return undefined;
    const mesurer = () => setDefile(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    // **La mesure attend la première peinture** (#605) : lire `scrollHeight` dans l'effet de
    // montage forçait la mise en page du panneau qui vient d'être inséré, dans l'image même où
    // la fiche apparaît — celle du retournement, sur un écran étroit. Une tâche plus tard, le
    // panneau est peint, et le repère « La suite ↓ » se pose sans retarder l'image.
    const id = window.setTimeout(mesurer, 0);
    el.addEventListener('scroll', mesurer, { passive: true });
    return () => {
      window.clearTimeout(id);
      el.removeEventListener('scroll', mesurer);
    };
  }, [carte.id, disposition]);

  return (
    <section
      ref={boite}
      className="ouverture__fiche"
      data-disposition={disposition}
      aria-label={`Fiche : ${carte.name}`}
      style={{ ...style, ['--accent' as string]: faction.color, ['--rarity' as string]: rarete.color }}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="ouverture__fiche-tete">
        <p className="eyebrow">
          <span className="card-detail__faction">
            <i className="card__faction-dot" aria-hidden />
            {faction.name}
          </span>
          {' · '}
          {kindLabel(carte)}
        </p>
        <button type="button" className="button ouverture__fiche-fermer" onClick={onFermer}>
          Reposer
        </button>
      </header>
      <h2 className="ouverture__fiche-nom">{carte.name}</h2>
      {neuve && <p className="ouverture__fiche-neuve">Nouvelle dans ta Collection</p>}

      <div className="stat-row">
        {planque && (
          <div>
            <span className="stat-label">Seuil</span>
            <strong>{carte.hp}</strong>
          </div>
        )}
        {planque && (
          <div>
            <span className="stat-label">Rotation</span>
            <strong>{carte.retreat}</strong>
          </div>
        )}
        {!planque && carte.itemKind && (
          <div title={ITEM_KIND_META[carte.itemKind].description}>
            <span className="stat-label">Catégorie</span>
            <strong>{ITEM_KIND_META[carte.itemKind].label}</strong>
          </div>
        )}
        <div>
          <span className="stat-label">Rareté</span>
          <strong className="card__rarity">
            {rarete.name} · {rarete.symbol.name}
          </strong>
        </div>
      </div>

      {planque && carte.ability && (
        <section className="detail-section">
          <h3>Talent</h3>
          <p>
            <strong>{carte.ability.name}</strong> — {carte.ability.text}
          </p>
        </section>
      )}

      {planque ? (
        <section className="detail-section">
          <h3>Pressions</h3>
          {carte.attacks.map((attaque) => (
            <div className="detail-attack" key={attaque.name}>
              <div className="detail-attack__head">
                <CafePips symbols={attaque.cost} />
                <strong>{attaque.name}</strong>
                <span className="detail-attack__dmg">{attaque.damage}</span>
              </div>
              {attaque.text && <p>{attaque.text}</p>}
            </div>
          ))}
        </section>
      ) : (
        <section className="detail-section">
          <h3>{ACTION_KIND_META[carte.kind].label}</h3>
          <p>{carte.text}</p>
          <p className="muted">{ACTION_KIND_META[carte.kind].rule}</p>
        </section>
      )}

      {planque && carte.weakness && (
        <p className="muted card-detail__weakness">
          Vulnérable à{' '}
          <strong style={{ color: FACTION_META[carte.weakness].color }}>{FACTION_META[carte.weakness].name}</strong> (+
          {WEAKNESS_BONUS})
        </p>
      )}

      <p className="ouverture__fiche-flavour">« {carte.flavor} »</p>

      {defile && (
        <p className="ouverture__fiche-suite" aria-hidden="true">
          La suite ↓
        </p>
      )}
    </section>
  );
}
