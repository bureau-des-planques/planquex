/*
 * PROTOTYPE JETABLE — le banc d'essai des saynètes d'attaque (D-095).
 * Question : le coup de grâce et la cinématique COMEX sont-ils lisibles et drôles à 420 × 900 ?
 *
 * Ce n'est PAS une scène réécrite : le plateau reprend le gabarit réel de `Battle.tsx`
 * (mêmes classes, mêmes tailles : `.board` > `.board__side` > `.board__poste`), et la scène qui
 * joue est la vraie — `SceneAttaque` → `choregraphie` → `Moteur`. Seul le déclencheur est faux.
 *
 * Le coup de grâce rejoue l'état **réel** du combat au moment du coup : la carte visée n'est
 * déjà plus au Poste, seul son fantôme `craquage__carte` y reste 500 ms (DUREE_TRAINEE_MS).
 *
 * DEV seulement : `/src/prototype/scene.html`. Les sondes `window.__scene` servent à la capture.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_CARDS, isPlanque } from '@/data';
import type { Attack, PlanqueCard } from '@/data/types';
import { CardView } from '@/components/CardView';
import { SceneAttaque } from '@/animation/SceneAttaque';
import { attribuer, cinematiqueDe, libelle } from '@/animation/attaque';
import type { Moteur } from '@/animation/moteur';

const PLANQUES = ALL_CARDS.filter(isPlanque).filter((c) => c.attacks.length > 0);
const carte = (id: string): PlanqueCard => {
  const c = PLANQUES.find((x) => x.id === id);
  if (!c) throw new Error(`Carte introuvable : ${id}`);
  return c;
};

/** La durée du fantôme de craquage dans le vrai combat (`DUREE_TRAINEE_MS`). */
const FANTOME_MS = 500;

type Preset = 'normale' | 'grace' | 'comex';

/** Les trois scénarios demandés, sur des cartes réelles du catalogue. */
const PRESETS: Record<
  Preset,
  { attaquant: string; rang: number; cible: string; grace: boolean; stress: number; libelle: string }
> = {
  normale: { attaquant: 'sse-medecin-travail', rang: 0, cible: 'direction-directeur-regional', grace: false, stress: 60, libelle: 'Attaque normale' },
  grace: { attaquant: 'sse-preventeur', rang: 0, cible: 'direction-directeur-regional', grace: true, stress: 20, libelle: 'Coup de grâce' },
  comex: { attaquant: 'direction-pdg-ex', rang: 1, cible: 'sse-infirmier-site', grace: false, stress: 120, libelle: 'Cinématique COMEX' },
};

interface Lancee {
  id: number;
  uid: string;
  uidCible: string;
  carte: PlanqueCard;
  attaque: Attack;
  stress: number;
  coupDeGrace: boolean;
}

const BANC_HAUT = ['management-responsable-unite', 'sse-preventeur', 'qvt-chief-happiness-officer'];
const BANC_BAS = ['rh-assistant-rh', 'atelier-chef-atelier', 'syndicat-secretaire-general'];

declare global {
  interface Window {
    __scene?: {
      jouer: (p: Preset) => void;
      jouerCarte: (att: string, rang: number, cible: string, grace: boolean, stress: number) => void;
      vitesse: (v: number) => void;
      inverse: (b: boolean) => void;
      reserve: (b: boolean) => void;
      releve: (b: boolean) => void;
      t: () => number;
      enCours: () => boolean;
      info: () => unknown;
    };
  }
}

export function PrototypeScene() {
  const [attaquantId, setAttaquantId] = useState(PRESETS.normale.attaquant);
  const [rang, setRang] = useState(PRESETS.normale.rang);
  const [cibleId, setCibleId] = useState(PRESETS.normale.cible);
  const [grace, setGrace] = useState(false);
  const [stress, setStress] = useState(PRESETS.normale.stress);
  const [vitesse, setVitesse] = useState(1);
  const [lancee, setLancee] = useState<Lancee | null>(null);
  /** Le fantôme de la cible craquée : vrai pendant 500 ms (comme dans le vrai combat). */
  const [fantome, setFantome] = useState(false);
  /** La cible a craqué : sa carte a déjà quitté le Poste. */
  const [cibleTombee, setCibleTombee] = useState(false);
  /** La relève de la cible : la Direction relève 600 ms après le craquage (`Battle.tsx`, minuterie de l'IA). */
  const [releve, setReleve] = useState(true);
  const [releveFaite, setReleveFaite] = useState(false);
  /** La Direction frappe : l'attaquant est en haut, la cible en bas. */
  const [inverse, setInverse] = useState(false);
  /**
   * Le Poste garde la hauteur d'une carte quand il se vide. **Pas le cas dans le vrai combat** : le Poste
   * se referme sur « Poste libre » et le plateau saute. C'est le correctif de styles.css que ce
   * prototype propose — à comparer avec le plateau tel qu'il est.
   */
  const [reserve, setReserve] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [bilan, setBilan] = useState('');
  const moteur = useRef<Moteur | null>(null);
  const compteur = useRef(0);
  const minuterie = useRef<number | null>(null);
  const vitesseRef = useRef(1);
  vitesseRef.current = vitesse;
  const releveRef = useRef(true);
  releveRef.current = releve;
  const minuterieReleve = useRef<number | null>(null);

  const attaquant = carte(attaquantId);
  const cible = carte(cibleId);
  const attaque = attaquant.attacks[Math.min(rang, attaquant.attacks.length - 1)];
  const motifs = useMemo(() => attribuer(attaquant), [attaquant]);
  const cinematique = cinematiqueDe(attaquant, attaque);

  const lancer = useCallback(
    (c: PlanqueCard, r: number, cb: PlanqueCard, g: boolean, s: number) => {
      const m = moteur.current;
      if (!m) return;
      m.arreter();
      if (minuterie.current) window.clearTimeout(minuterie.current);
      if (minuterieReleve.current) window.clearTimeout(minuterieReleve.current);
      setReleveFaite(false);
      compteur.current += 1;
      setEnCours(true);
      setBilan('');
      // Même séquence qu'en combat : l'état est déjà celui d'après le coup (la carte a quitté le
      // Poste, son fantôme reste 500 ms) quand la scène se déclenche.
      setCibleTombee(g);
      setFantome(g);
      if (g) {
        minuterie.current = window.setTimeout(() => setFantome(false), FANTOME_MS / vitesseRef.current);
        if (releveRef.current)
          minuterieReleve.current = window.setTimeout(() => setReleveFaite(true), 600 / vitesseRef.current);
      }
      setLancee({
        id: compteur.current,
        uid: 'att',
        uidCible: 'cib',
        carte: c,
        attaque: c.attacks[r],
        stress: s,
        coupDeGrace: g,
      });
      void cb;
    },
    [],
  );

  const preset = useCallback(
    (p: Preset) => {
      const d = PRESETS[p];
      setAttaquantId(d.attaquant);
      setRang(d.rang);
      setCibleId(d.cible);
      setGrace(d.grace);
      setStress(d.stress);
      lancer(carte(d.attaquant), d.rang, carte(d.cible), d.grace, d.stress);
    },
    [lancer],
  );

  const surMoteur = useCallback((m: Moteur | null) => {
    moteur.current = m;
    if (m) m.vitesse = vitesseRef.current;
  }, []);

  const surFin = useCallback((s?: { duree: number; picParticules: number; picEffets: number }) => {
    setEnCours(false);
    setCibleTombee(false);
    setFantome(false);
    setReleveFaite(false);
    if (s) setBilan(`${Math.round(s.duree)} ms · pic ${s.picParticules} particules · ${s.picEffets} effets`);
  }, []);

  useEffect(() => {
    if (moteur.current) moteur.current.vitesse = vitesse;
  }, [vitesse]);

  useEffect(() => {
    window.__scene = {
      jouer: preset,
      jouerCarte: (att, r, cb, g, st) => {
        setAttaquantId(att);
        setRang(r);
        setCibleId(cb);
        setGrace(g);
        setStress(st);
        // Le temps que React range l'attaquant au Poste avant que la scène ne le mesure.
        window.setTimeout(() => lancer(carte(att), r, carte(cb), g, st), 150);
      },
      vitesse: (v) => setVitesse(v),
      inverse: (b) => setInverse(b),
      reserve: (b) => setReserve(b),
      releve: (b) => setReleve(b),
      t: () => moteur.current?.t ?? 0,
      enCours: () => enCours,
      info: () => ({ cinematique, motif: libelle(motifs.get(rang) ?? '') }),
    };
    return () => {
      window.__scene = undefined;
    };
  }, [preset, lancer, enCours, cinematique, motifs, rang]);

  const banc = (ids: string[]) => (
    <div className="board__bench">
      <ul className="bench">
        {ids.map((id) => (
          <li className="bench__slot" key={id}>
            <div className="bench__carte">
              <CardView card={carte(id)} figee plateau />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  const fiche = (nom: string, main: number, deck: number, rebut: number) => (
    <div className="board__fiche">
      <header className="board__head">
        <h2>{nom}</h2>
        <span className="board__counts muted">main {main}</span>
        <span className="piles">
          <span className="pile pile--deck">
            Deck <strong>{deck}</strong>
          </span>
          <span className="pile pile--rebut">
            Rebut <strong>{rebut}</strong>
          </span>
        </span>
      </header>
    </div>
  );

  const styleReserve = reserve ? { minHeight: 'calc(6rem * 88 / 63)' } : undefined;

  const posteAttaquant = (
    <div className="board__poste" style={styleReserve}>
      <span className="sr-only">Poste</span>
      <div className="poste__carte" data-uid="att">
        <CardView card={attaquant} figee plateau stress={0} seuil={attaquant.hp} />
      </div>
    </div>
  );

  const relevee = carte('management-responsable-unite');
  const posteCible = (
    <div className="board__poste" style={styleReserve}>
      <span className="sr-only">Poste</span>
      {!cibleTombee && (
        <div className="poste__carte" data-uid="cib">
          <CardView card={cible} figee plateau stress={0} seuil={cible.hp} />
        </div>
      )}
      {cibleTombee && releveFaite && (
        <div className="poste__carte" data-uid="releve">
          <CardView card={relevee} figee plateau stress={0} seuil={relevee.hp} />
        </div>
      )}
      {cibleTombee && !releveFaite && !fantome && <strong className="muted poste__libre">Poste libre</strong>}
      {cibleTombee && !releveFaite && fantome && <strong className="muted poste__libre">Poste libre</strong>}
      {fantome && (
        <div className="craquage__carte" data-uid="cib" aria-hidden="true">
          <CardView card={cible} figee plateau />
        </div>
      )}
    </div>
  );

  const campCible = (haut: boolean) => (
    <article className={`board__side ${haut ? 'is-direction' : ''}`}>
      <div className="board__zone">
        {haut && banc(BANC_HAUT)}
        <div className="board__poste-ligne">
          {posteCible}
          {fiche(haut ? 'La Direction' : 'Toi', 3, 12, 1)}
        </div>
        {!haut && banc(BANC_BAS)}
      </div>
    </article>
  );

  const campAttaquant = (haut: boolean) => (
    <article className={`board__side ${haut ? 'is-direction' : ''}`}>
      <div className="board__zone">
        {haut && banc(BANC_HAUT)}
        <div className="board__poste-ligne">
          {posteAttaquant}
          {fiche(haut ? 'La Direction' : 'Toi', 2, 14, 0)}
        </div>
        {!haut && banc(BANC_BAS)}
      </div>
    </article>
  );

  return (
    <main className="proto-scene">
      <p className="proto-scene__bandeau">Banc d’essai jetable · DEV · la vraie scène, sur le vrai gabarit du plateau</p>
      <div className="battle">
        <div className="battle__table">
          <section className="board" aria-label="Plateau" id="plateau">
            <SceneAttaque
              effetId={lancee?.id}
              uid={lancee?.uid}
              uidCible={lancee?.uidCible}
              carte={lancee?.carte}
              attaque={lancee?.attaque}
              stress={lancee?.stress}
              coupDeGrace={lancee?.coupDeGrace}
              sansMouvement={false}
              onMoteur={surMoteur}
              surFin={surFin}
            />
            {inverse ? campAttaquant(true) : campCible(true)}
            <div className="piste" aria-hidden="true" style={{ minHeight: 28 }} />
            {inverse ? campCible(false) : campAttaquant(false)}
          </section>
        </div>
      </div>

      <section className="proto-scene__regie" aria-label="Régie">
        <div className="proto-scene__ligne">
          {(Object.keys(PRESETS) as Preset[]).map((p) => (
            <button key={p} type="button" data-preset={p} onClick={() => preset(p)} disabled={enCours}>
              {PRESETS[p].libelle}
            </button>
          ))}
        </div>
        <label>
          Attaquant
          <select
            value={attaquantId}
            onChange={(e) => {
              setAttaquantId(e.target.value);
              setRang(carte(e.target.value).attacks.length - 1);
            }}
          >
            {PLANQUES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.ex ? '(COMEX)' : ''} [{c.rarity}]
              </option>
            ))}
          </select>
        </label>
        <label>
          Pression
          <select value={rang} onChange={(e) => setRang(Number(e.target.value))}>
            {attaquant.attacks.map((a, i) => (
              <option key={a.name} value={i}>
                {a.name} · {a.cost.length} café(s) · {libelle(motifs.get(i) ?? '')}
                {cinematiqueDe(attaquant, a) ? ' + cinématique' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cible
          <select value={cibleId} onChange={(e) => setCibleId(e.target.value)}>
            {PLANQUES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="proto-scene__ligne">
          <label>
            <input type="checkbox" checked={grace} onChange={(e) => setGrace(e.target.checked)} /> la cible craque
          </label>
          <label>
            <input type="checkbox" checked={releve} onChange={(e) => setReleve(e.target.checked)} /> relève à 600 ms
          </label>
          <label>
            <input type="checkbox" checked={reserve} onChange={(e) => setReserve(e.target.checked)} /> Poste réservé (correctif CSS)
          </label>
          <label>
            <input type="checkbox" checked={inverse} onChange={(e) => setInverse(e.target.checked)} /> la Direction frappe
          </label>
          <label>
            Stress
            <input type="number" min={0} max={300} step={10} value={stress} onChange={(e) => setStress(Number(e.target.value))} />
          </label>
          {[1, 0.5, 0.2].map((v) => (
            <button key={v} type="button" aria-pressed={vitesse === v} onClick={() => setVitesse(v)}>
              ×{v}
            </button>
          ))}
          <button
            type="button"
            data-rejouer
            disabled={enCours}
            onClick={() => lancer(attaquant, rang, cible, grace, stress)}
          >
            Jouer
          </button>
        </div>
        <p>
          {attaquant.name} — <strong>{attaque.name}</strong> → {libelle(motifs.get(rang) ?? '')}
          {cinematique ? ' + cinématique' : ''}
          {bilan ? ` · ${bilan}` : ''}
        </p>
      </section>
    </main>
  );
}
