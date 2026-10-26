/*
 * PROTOTYPE JETABLE (skill prototype, UI.md) — ne pas merger tel quel.
 * Question : quelles animations d'attaque, une par attaque, et quelle cinématique pour les
 * grosses attaques des légendaires ? Cinq variantes, dont deux inspirées d'Hearthstone et de
 * Pokémon TCG Pocket. Canvas 2D + Web Animations API, sans dépendance.
 * Route : /prototype/animations?variant=A|B|C|D|E — DEV seulement (src/App.tsx).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ALL_CARDS, RARITY_META, isPlanque } from "@/data";
import type { Attack, PlanqueCard } from "@/data/types";
import { CardView } from "@/components/CardView";
import { Moteur } from "./fx-moteur";
import type { Stats } from "./fx-moteur";
import {
  VARIANTES,
  attribuer,
  choregraphie,
  estLegendaire,
  libelle,
} from "./choregraphies";
import type { Variante } from "./choregraphies";
import "./prototype-animations.css";

const ORDRE: readonly Variante[] = ["A", "B", "C", "D", "E"];

const PLANQUES = ALL_CARDS.filter(isPlanque).filter(
  (c) => c.attacks.length > 0,
);
const LEGENDAIRES = PLANQUES.filter(
  (c) => c.rarity === "COU" || c.rarity === "3S",
);
const COMEX = PLANQUES.filter((c) => c.ex && !LEGENDAIRES.includes(c));
const DEUX = PLANQUES.filter(
  (c) => c.attacks.length > 1 && !c.ex && !LEGENDAIRES.includes(c),
);
const UNE = PLANQUES.filter(
  (c) => c.attacks.length === 1 && !c.ex && !LEGENDAIRES.includes(c),
);
const CIBLE: PlanqueCard =
  PLANQUES.find((c) => c.id === "sse-infirmier-site") ?? PLANQUES[0];
const PREMIERE =
  LEGENDAIRES.find((c) => c.id === "rh-drh-crown") ?? PLANQUES[0];

const VITESSES = [
  { v: 1, l: "×1" },
  { v: 0.5, l: "×½" },
  { v: 0.25, l: "×¼" },
];

export function PrototypeAnimations() {
  const [params, setParams] = useSearchParams();
  const brut = params.get("variant") as Variante | null;
  const variante: Variante = brut && ORDRE.includes(brut) ? brut : "D";
  const [carteId, setCarteId] = useState(params.get("carte") ?? PREMIERE.id);
  const carte = PLANQUES.find((c) => c.id === carteId) ?? PREMIERE;
  const [vitesse, setVitesse] = useState(1);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [stats, setStats] = useState<
    (Stats & { nom: string; attaque: string; cinematique: boolean }) | null
  >(null);

  const sceneRef = useRef<HTMLDivElement>(null);
  const fondRef = useRef<HTMLCanvasElement>(null);
  const avantRef = useRef<HTMLCanvasElement>(null);
  const attRef = useRef<HTMLDivElement>(null);
  const cibRef = useRef<HTMLDivElement>(null);
  const moteur = useRef<Moteur | null>(null);

  useEffect(() => {
    if (!sceneRef.current || !fondRef.current || !avantRef.current) return;
    const m = new Moteur(fondRef.current, avantRef.current, sceneRef.current);
    moteur.current = m;
    const surTaille = () => m.redimensionner();
    window.addEventListener("resize", surTaille);
    return () => {
      window.removeEventListener("resize", surTaille);
      m.arreter();
    };
  }, []);

  const attribution = useMemo(
    () => attribuer(variante, carte),
    [variante, carte],
  );

  function lancer(attaque: Attack) {
    const m = moteur.current;
    if (!m || !attRef.current || !cibRef.current) return;
    m.arreter();
    const ch = choregraphie(variante, carte, attaque, {
      m,
      att: attRef.current,
      cib: cibRef.current,
    });
    m.vitesse = vitesse;
    m.surFin = (s) => {
      setEnCours(null);
      setStats({
        ...s,
        nom: ch.nom,
        attaque: attaque.name,
        cinematique: ch.cinematique,
      });
    };
    setEnCours(attaque.name);
    m.jouer(ch.etapes, ch.duree);
  }

  function aller(v: Variante) {
    moteur.current?.arreter();
    setEnCours(null);
    setParams({ variant: v, carte: carte.id });
  }

  function decaler(pas: number) {
    const i = ORDRE.indexOf(variante);
    aller(ORDRE[(i + pas + ORDRE.length) % ORDRE.length]);
  }

  function choisir(id: string) {
    moteur.current?.arreter();
    setEnCours(null);
    setStats(null);
    setCarteId(id);
    setParams({ variant: variante, carte: id });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null;
      if (cible?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") decaler(-1);
      if (e.key === "ArrowRight") decaler(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variante, carte]);

  const option = (c: PlanqueCard) => (
    <option key={c.id} value={c.id}>
      {c.name} ({RARITY_META[c.rarity].label}
      {c.ex ? ", COMEX" : ""}) — {c.attacks.map((a) => a.name).join(" / ")}
    </option>
  );

  return (
    <main className="proto-anim">
      <p className="proto-bandeau">
        Prototype jetable · DEV seulement · canvas 2D + Web Animations API
      </p>
      <h1 className="proto-titre">
        {variante} · {VARIANTES[variante].titre}
      </h1>
      <p className="proto-regle">{VARIANTES[variante].regle}</p>

      <label className="proto-champ">
        Carte qui attaque
        <select value={carte.id} onChange={(e) => choisir(e.target.value)}>
          <optgroup label="Légendaires (Couronne, 3 étoiles)">
            {LEGENDAIRES.map(option)}
          </optgroup>
          <optgroup label="COMEX">{COMEX.map(option)}</optgroup>
          <optgroup label="Deux attaques">{DEUX.map(option)}</optgroup>
          <optgroup label="Une attaque">{UNE.map(option)}</optgroup>
        </select>
      </label>

      <div className="proto-attaques">
        {carte.attacks.map((a) => (
          <button
            key={a.name}
            type="button"
            className="proto-attaque"
            onClick={() => lancer(a)}
            aria-pressed={enCours === a.name}
          >
            <span className="proto-attaque__nom">
              {a.name} · {a.damage}
            </span>
            <span className="proto-attaque__anim">
              {libelle(variante, attribution.get(a.name) ?? "")}
              {variante === "E" &&
              estLegendaire(carte) &&
              a.cost.length ===
                Math.max(...carte.attacks.map((x) => x.cost.length))
                ? " + cinématique"
                : ""}
            </span>
          </button>
        ))}
        <div className="proto-vitesse" role="group" aria-label="Vitesse">
          {VITESSES.map(({ v, l }) => (
            <button
              key={v}
              type="button"
              aria-pressed={vitesse === v}
              onClick={() => setVitesse(v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="proto-stage">
        <div className="proto-scene" ref={sceneRef}>
          <canvas className="proto-canvas proto-canvas--fond" ref={fondRef} />
          <div className="proto-poste proto-poste--cible" ref={cibRef}>
            <CardView card={CIBLE} compact figee />
          </div>
          <div className="proto-poste proto-poste--att" ref={attRef}>
            <CardView card={carte} compact figee />
          </div>
          <canvas className="proto-canvas proto-canvas--avant" ref={avantRef} />
        </div>
      </div>

      <section className="proto-etat">
        {stats ? (
          <ul>
            <li>
              Dernière attaque : <strong>{stats.attaque}</strong> → {stats.nom}
              {stats.cinematique ? " (cinématique)" : ""}
            </li>
            <li>
              Durée de la chorégraphie : {Math.round(stats.duree)} ms (à ×1)
            </li>
            <li>
              Pic de particules : {stats.picParticules} (budget 300, 600 en
              cinématique) · pic d’effets : {stats.picEffets}
            </li>
            <li>
              Images par seconde : {stats.fpsMoyen} en moyenne · pire image :{" "}
              {stats.pireImage} ms
            </li>
          </ul>
        ) : (
          <p>
            Clique une attaque pour la jouer. Les mesures s’affichent à la fin.
          </p>
        )}
      </section>

      <nav className="proto-barre" aria-label="Variantes du prototype">
        <button
          type="button"
          onClick={() => decaler(-1)}
          aria-label="Variante précédente"
        >
          ←
        </button>
        <span>
          {variante} · {VARIANTES[variante].titre}
        </span>
        <button
          type="button"
          onClick={() => decaler(1)}
          aria-label="Variante suivante"
        >
          →
        </button>
      </nav>
    </main>
  );
}
