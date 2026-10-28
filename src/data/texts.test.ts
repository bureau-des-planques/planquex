import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isPlanque } from '@/data';
import type { Ability, AbilityKind, Attack, AttackEffect, AttackEffectKind, PlanqueCard, Status } from '@/data/types';
import { ABILITY_KINDS, ATTACK_EFFECT_KINDS } from '@/data/types';

/**
 * Garde-fou **texte ⇔ mécanique** (ticket #48).
 *
 * `cards.test.ts` vérifie qu'une attaque qui porte un texte porte **un** effet : c'est
 * la présence, pas l'adéquation. Rien n'empêchait donc un texte (ou un Talent) d'annoncer
 * une mécanique réalisée par une autre. Ce fichier-ci confronte les deux sens :
 *
 * - **texte ⇒ effet** : chaque mot mécanique du texte doit avoir, parmi les primitives
 *   de la carte, celle qui le réalise. Un mot qu'aucune primitive ne réalise
 *   (`kinds: []`) est un mensonge par construction — « défausse 1 carte » n'a pas de
 *   primitive : `discardEnergy` retire un **café** (§3.1) ;
 * - **effet ⇒ texte** : chaque primitive présente doit être **annoncée** par le texte,
 *   montant compris. Une mécanique muette est illisible pour le joueur.
 *
 * Le vocabulaire n'est pas recopié : les deux tables d'attentes sont des
 * `Record<AttackEffectKind, …>` / `Record<AbilityKind, …>`, donc ajouter une primitive à
 * l'union de `@/data/types` sans écrire son attente rend `tsc` rouge. `types.test.ts`
 * tient déjà `ATTACK_EFFECT_KINDS` / `ABILITY_KINDS` alignées sur les unions.
 *
 * **Ce que le garde-fou ne tranche pas.** Il ne dit pas ce que le jeu *devrait* faire :
 * c'est #47. Les mensonges recensés vivaient donc dans `MENSONGES_CONNUS`, avec leur
 * raison. L'inventaire est **clos** : vidé par #65, rouvert et refermé par #167, il est
 * **vide** depuis #175 (les sept mécaniques de D-076 à D-082 sont câblées). Corriger une
 * carte fait toujours échouer le dernier test tant qu'une entrée n'est pas retirée : la
 * liste ne peut pas survivre à sa correction.
 *
 * **Choix de fichier.** Le garde-fou vit ici et non dans `cards.test.ts` : ce dernier est
 * modifié en parallèle (#54, l'oracle `WEAKNESS`), et l'adéquation texte ⇔ effet est une
 * famille d'assertions distincte de la présence, avec son propre vocabulaire.
 */

/** Minuscules sans diacritiques : les motifs s'écrivent sans accent, les textes en ont. */
const normaliser = (texte: string): string =>
  texte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

interface Cue<K extends string> {
  /** Nom lisible du mot, repris dans les messages d'échec. */
  label: string;
  /** Motif cherché dans le texte **normalisé**. */
  pattern: RegExp;
  /** Les primitives qui réalisent ce que le mot promet. Vide : aucune ne le fait. */
  kinds: readonly K[];
}

/**
 * Les mots d'une **Pression** — et d'une carte **Action**, qui emploie les mêmes
 * primitives (`docs/JEU.md` §5) — avec la primitive qui peut les réaliser.
 *
 * `kinds: []` signalerait un mot **sans primitive** : le texte ne pourrait pas être
 * honnête. Depuis #175, aucune primitive d'attaque ne manque plus (#159 à #165) ; la
 * forme vide reste dans la table des Talents simples, qui n'ont pas accès aux
 * primitives d'attaque.
 */
/*
 * Frontières de mot (#166). Un motif sans `\b` trouve son mot **dans un autre** : « demain »,
 * « maintenance » ou « mainmise » déclenchaient `main`, « recherche » déclenchait `cherche`.
 * Règle : un mot **entier** (`main`, `deck`, `banc`, `café`) porte `\b` des deux côtés ; une
 * **racine** ne porte que le `\b` de début, parce que la fin varie (conjugaison, accord,
 * dérivé) : `défauss` couvre défausse / défausser, `cherch` couvre cherche / cherchent,
 * `immobilis` couvre immobilisé / immobilisation, `deriv` couvre dérivé / dérive.
 * Les mots pluriels sont explicites (`mains?`, `bancs?`) plutôt que supposés.
 */
const CUES_EFFET: readonly Cue<AttackEffectKind>[] = [
  // `discardEnergy` retire un café au Planqué d'en face (engine.ts : `discardFirstCafes(defender, 1)`).
  { label: 'café', pattern: /\bcafes?\b/, kinds: ['discardEnergy'] },
  // `discardHand` défausse une carte de la main, au hasard (adversaire) ou par choix (D-076).
  { label: 'défausse N carte', pattern: /\bdefausse (?:\d+|une) carte/, kinds: ['discardHand'] },
  // `damage` : les dégâts d'un Talent ou d'une Pression, au Planqué adverse (D-077).
  { label: 'N dégâts au Planqué', pattern: /\b\d+ degats? au\b/, kinds: ['damage'] },
  { label: 'pioche N cartes', pattern: /\bpioche (\d+) carte/, kinds: ['draw'] },
  { label: 'soigne N de tous tes Planqués', pattern: /\bsoigne (\d+)[^.]*tous tes planques/, kinds: ['healAll'] },
  { label: 'soigne N de ce Planqué', pattern: /\bsoigne (\d+)[^.]*ce planque/, kinds: ['healSelf'] },
  { label: 'subit N de moins', pattern: /\bsubit (\d+)[^.]*de moins/, kinds: ['reduceDamage'] },
  { label: 'prend N de stress', pattern: /\bprend (\d+)[^.]*stress/, kinds: ['selfDamage'] },
  // Racines : `surcharg` couvre surchargé, `epuisement` reste le nom (EPUISEMENT).
  { label: 'statut nommé', pattern: /\b(?:surcharg|epuisement|sieste|immobilis|deriv)/, kinds: ['status'] },
  // `switchSelf` échange le Poste avec le premier Planqué du Banc (engine.ts).
  { label: 'Banc', pattern: /\bbancs?\b/, kinds: ['switchSelf'] },
  // La main est touchée par une défausse (D-076), une révélation (D-078) ou une recherche (D-080).
  { label: 'main', pattern: /\bmains?\b/, kinds: ['discardHand', 'reveal', 'search'] },
  // `reveal` écrit la carte, ou la main, dans le journal (D-078) : « révèle sa main ».
  // Le motif exclut la forme pronominale « révèle-le », qui appartient à la recherche (ci-dessous).
  { label: 'révèle', pattern: /\brevele(?!-le\b)/, kinds: ['reveal'] },
  // `search` écrit au journal la carte trouvée (D-080) : c'est le « révèle-le » du texte
  // (« cherche un Planqué dans ton deck, révèle-le »), pas une révélation de main.
  { label: 'révèle-le (recherche)', pattern: /\brevele-le\b/, kinds: ['search'] },
  // `peek` lit le dessus du Deck sans le modifier (D-079) ; la recherche y cherchera (D-080).
  { label: 'regarde le dessus', pattern: /\bregarde la carte du dessus/, kinds: ['peek'] },
  // `search` cherche une carte du filtre dans le Deck, puis la prend en main (D-080).
  { label: 'cherche', pattern: /\bcherch/, kinds: ['search'] },
  { label: 'deck', pattern: /\bdecks?\b/, kinds: ['search', 'peek'] }
];

/**
 * Les mots d'un **Talent**, avec le `AbilityKind` qui peut les réaliser.
 *
 * Cette table ne sert qu'aux Talents **simples** : un Talent `kind: 'effects'` (D-077)
 * porte les primitives d'attaque et passe par `verifierPression` (`verifierTalent`).
 * Pour un Talent simple, `Banc`, `défausse`, `cherche`, `main`, `deck` n'ont donc aucune
 * primitive de Talent. `attachEnergy` attache un café tiré dans le Deck au **Poste**
 * (engine.ts : `player.active.energy.push(cafe)`), sauf `target: 'rack'` (D-082), et
 * `heal` / `antiStatus` ne soignent que le Poste : viser le Banc ou la main est un mensonge.
 */
const CUES_TALENT: readonly Cue<AbilityKind>[] = [
  { label: 'café', pattern: /\bcafes?\b/, kinds: ['attachEnergy'] },
  { label: 'pioche N cartes', pattern: /\bpioche (\d+) carte/, kinds: ['draw'] },
  { label: 'soigne N', pattern: /\bsoigne (\d+)/, kinds: ['heal', 'antiStatus'] },
  { label: 'retire un statut', pattern: /\bretire un statut/, kinds: ['antiStatus'] },
  { label: 'subit N de moins', pattern: /\bsubit (\d+)[^.]*de moins/, kinds: ['reduceDamage'] },
  // Aucune primitive de Talent ne défausse, ne cherche, ne touche la main, le deck ou le
  // Banc. Le déclenchement « en jouant » se vérifie à part (`verifierTalent`, D-081).
  // Racines (#166) : `defauss` et `cherch` ne portent que le `\b` de début, pour que
  // « recherche » ne déclenche pas `cherche`.
  { label: 'défausse', pattern: /\bdefauss/, kinds: [] },
  { label: 'cherche', pattern: /\bcherch/, kinds: [] },
  { label: 'main', pattern: /\bmains?\b/, kinds: [] },
  { label: 'deck', pattern: /\bdecks?\b/, kinds: [] },
  { label: 'Banc', pattern: /\bbancs?\b/, kinds: [] },
];

interface Attente {
  /** Motif qui doit être présent dans le texte **normalisé**. */
  pattern: RegExp;
  /** Groupe de capture du montant, comparé à `amount` quand il est renseigné. */
  montantGroupe?: number;
}

/**
 * L'inverse des `Cues` : ce que le texte doit dire pour chaque primitive présente.
 * `null` = cas traité à part : `status`, dont le texte doit nommer le statut exact.
 *
 * Le `Record` est la garantie d'exhaustivité : une primitive ajoutée à l'union sans
 * attente ici ne compile pas.
 */
const ATTENTES_EFFET: Record<AttackEffectKind, Attente | null> = {
  healSelf: { pattern: /soigne (\d+)/, montantGroupe: 1 },
  healAll: { pattern: /soigne (\d+)[^.]*tous tes planques/, montantGroupe: 1 },
  status: null,
  draw: { pattern: /pioche (\d+) carte/, montantGroupe: 1 },
  discardEnergy: { pattern: /cafes?\b/ },
  selfDamage: { pattern: /prend (\d+)[^.]*stress/, montantGroupe: 1 },
  switchSelf: { pattern: /banc/ },
  reduceDamage: { pattern: /subit (\d+)[^.]*de moins/, montantGroupe: 1 },
  discardHand: { pattern: /defausse (\d+) carte/, montantGroupe: 1 },
  damage: { pattern: /(\d+) degats? au/, montantGroupe: 1 },
  reveal: { pattern: /revel/ },
  peek: { pattern: /regarde la carte du dessus/ },
  search: { pattern: /cherch/ }
};

const ATTENTES_TALENT: Record<AbilityKind, Attente | null> = {
  heal: { pattern: /soigne (\d+)/, montantGroupe: 1 },
  draw: { pattern: /pioche (\d+) carte/, montantGroupe: 1 },
  attachEnergy: { pattern: /attache 1 cafes?\b/ },
  reduceDamage: { pattern: /subit (\d+)[^.]*de moins/, montantGroupe: 1 },
  antiStatus: { pattern: /soigne (\d+)[^.]*retire un statut/, montantGroupe: 1 },
  // Un Talent `effects` s'annonce primitive par primitive, comme une Pression (D-077) : `verifierTalent`.
  effects: null
};

/** Les mots par lesquels un texte annonce un statut (`docs/JEU.md` §3.1). */
const MOTS_STATUT: Record<Status, RegExp> = {
  // Mêmes règles que `CUES_EFFET` (#166) : racines, `\b` de début seulement.
  SURCHARGE: /\bsurcharg/,
  EPUISEMENT: /\bepuisement/,
  SIESTE: /\bsieste/,
  IMMOBILISATION: /\bimmobilis/,
  DERIVE: /\bderiv/
};

/** Sens « texte ⇒ effet » : chaque mot mécanique doit avoir sa primitive. */
function verifierCues<K extends string>(
  texte: string,
  kinds: ReadonlySet<K>,
  cues: readonly Cue<K>[]
): string[] {
  const problemes: string[] = [];
  for (const cue of cues) {
    if (!cue.pattern.test(texte)) continue;
    if (cue.kinds.length === 0) {
      problemes.push(`« ${cue.label} » : aucune primitive ne le réalise`);
      continue;
    }
    if (!cue.kinds.some((kind) => kinds.has(kind))) {
      problemes.push(
        `« ${cue.label} » attend ${cue.kinds.join(' ou ')}, les primitives sont ${[...kinds].join(' + ') || 'aucune'}`
      );
    }
  }
  return problemes;
}

/** Sens « effet ⇒ texte » : la primitive doit être annoncée, montant compris. */
function verifierAttente<K extends string>(
  texte: string,
  primitive: { kind: K; amount?: number },
  attente: Attente | null,
  nom: string
): string[] {
  if (!attente) return [];
  const trouve = attente.pattern.exec(texte);
  if (!trouve) return [`${nom} sans texte qui l’annonce`];
  if (attente.montantGroupe !== undefined && primitive.amount !== undefined) {
    const annonce = Number(trouve[attente.montantGroupe]);
    if (annonce !== primitive.amount) {
      return [`${nom} : le texte annonce ${annonce}, l’effet vaut ${primitive.amount}`];
    }
  }
  return [];
}

function verifierStatut(texte: string, statut: Status | undefined): string[] {
  if (!statut) return ['statut sans `status` : la carte ne dit pas ce qu’elle applique'];
  const annonces = (Object.entries(MOTS_STATUT) as [Status, RegExp][])
    .filter(([, mot]) => mot.test(texte))
    .map(([nom]) => nom);
  if (annonces.length === 0) return [`statut ${statut} que le texte ne nomme pas`];
  if (!annonces.includes(statut)) return [`statut ${statut} appliqué, le texte annonce ${annonces.join(' ou ')}`];
  return [];
}

/** Contrôle d'un texte de **Pression** ou de carte **Action** contre ses effets. */
function verifierPression(texte: string, effects: readonly AttackEffect[]): string[] {
  const normalise = normaliser(texte);
  const problemes = verifierCues(normalise, new Set(effects.map((effect) => effect.kind)), CUES_EFFET);
  for (const effect of effects) {
    if (effect.kind === 'status') {
      problemes.push(...verifierStatut(normalise, effect.status));
      continue;
    }
    problemes.push(...verifierAttente(normalise, effect, ATTENTES_EFFET[effect.kind], `effet ${effect.kind}`));
  }
  return problemes;
}

/** Contrôle d'un texte de **Talent** contre son `kind`. */
function verifierTalent(
  texte: string,
  ability: Pick<Ability, 'kind' | 'amount' | 'effects' | 'trigger' | 'target'>
): string[] {
  const normalise = normaliser(texte);
  // « en jouant » et le déclenchement à la mise en jeu doivent se répondre (D-081).
  const enJouant = /\ben jouant\b/.test(normalise);
  if (enJouant !== (ability.trigger === 'onPlay')) {
    return [enJouant ? '« en jouant » sans déclenchement à la mise en jeu' : 'déclenchement à la mise en jeu sans « en jouant »'];
  }
  // Un Talent `effects` porte le vocabulaire des Pressions : chaque primitive doit être annoncée (D-077).
  if (ability.kind === 'effects') {
    const problemes = verifierPression(texte, ability.effects ?? []);
    if (!CUES_EFFET.some((cue) => cue.pattern.test(normalise))) problemes.push('texte de Talent sans mécanique');
    return problemes;
  }
  // Un café attaché au Banc (D-082) est le seul cas où « Banc » désigne une primitive de Talent.
  const versBanc = ability.kind === 'attachEnergy' && ability.target === 'rack';
  const cues = versBanc ? CUES_TALENT.filter((cue) => cue.label !== 'Banc') : CUES_TALENT;
  const problemes = verifierCues(normalise, new Set([ability.kind]), cues);
  if (ability.kind === 'attachEnergy' && /\bbancs?\b/.test(normalise) !== versBanc) {
    problemes.push('« Banc » annoncé sans cible Banc, ou cible Banc sans « Banc » dans le texte');
  }
  // Un Talent qui n'annonce aucune mécanique n'est pas vérifiable : il est refusé.
  if (!CUES_TALENT.some((cue) => cue.pattern.test(normalise))) {
    problemes.push('texte de Talent sans mécanique : rien à comparer au `kind`');
  }
  problemes.push(...verifierAttente(normalise, ability, ATTENTES_TALENT[ability.kind], `Talent ${ability.kind}`));
  return problemes;
}

/** Un texte de carte, et ce qu'il faudrait corriger. */
interface Sujet {
  /** Clé stable de la liste d'exceptions : `id/attaque` ou `id#talent` ou `id`. */
  cle: string;
  /** Désignation lisible, pour les messages d'échec. */
  nature: string;
  problemes: string[];
}

/**
 * Tous les textes de mécanique du jeu : les Pressions, les Talents et les cartes Action.
 * Les cartes Action sont incluses gratuitement — elles emploient les mêmes primitives.
 */
const SUJETS: Sujet[] = ALL_CARDS.flatMap((card) => {
  if (isPlanque(card)) {
    const sujets: Sujet[] = card.attacks.map((attack) => ({
      cle: `${card.id}/${attack.name}`,
      nature: `${card.id} — Pression « ${attack.name} »`,
      problemes: verifierPression(attack.text ?? '', attack.effects ?? [])
    }));
    if (card.ability) {
      sujets.push({
        cle: `${card.id}#talent`,
        nature: `${card.id} — Talent « ${card.ability.name} »`,
        problemes: verifierTalent(card.ability.text, card.ability)
      });
    }
    return sujets;
  }
  return [
    {
      cle: card.id,
      nature: `${card.id} — ${card.kind === 'OBJET' ? 'Objet' : 'Collègue'}`,
      problemes: verifierPression(card.text, card.effects)
    }
  ];
});

const MENSONGES = SUJETS.filter((sujet) => sujet.problemes.length > 0);

/**
 * **Inventaire des écarts connus.** Né de #47 (les 22 textes qui annonçaient une mécanique
 * absente). #65 les avait réécrits pour les aligner sur le moteur ; **D-074 rejette cette voie** :
 * une carte vend ce qu'elle dit faire, le moteur rattrape. #167 rétablit les quatre Pressions
 * concernées et inscrit leur écart ici, avec le ticket qui construit la mécanique manquante.
 *
 * Une entrée ne s'ajoute ici que sur une décision datée (D-074) — un texte vendu dont le
 * moteur ne réalise pas encore la mécanique — jamais pour faire passer un test. Elle se
 * retire dès que la primitive existe (le test « l'inventaire ne survit pas » le dit).
 *
 * Clé stable : `id/attaque` ou `id#talent`. Format `src/data/<faction>.ts:<ligne> — #<ticket>` :
 * le test vérifie que le fichier cité est celui de la faction de la carte. Les variantes
 * (`-star`, `-crown`, `-ex`) héritent de l'attaque de leur carte de base : leur ligne est
 * celle de la source.
 *
 * **Vide depuis #175** : les sept mécaniques de D-076 à D-082 sont câblées sur les cartes
 * qui les vendaient, donc les cinq écarts de #167 ont été retirés. Aucun écart ne survit à
 * sa correction.
 */
const MENSONGES_CONNUS: Readonly<Record<string, string>> = {};

/**
 * Les Pressions d'un Planqué qui n'ont **aucun texte** (#158) : absent, vide, ou blanc.
 * Le gabarit (`CardDetail.tsx`) n'affiche rien pour elles, et la carte « vendue » est
 * alors muette. Fonction pure, appelée sur le catalogue **et** sur une carte fautive
 * synthétique : c'est ce qui permet au contrôle de mordre.
 */
function pressionsSansTexte(cartes: readonly PlanqueCard[]): string[] {
  return cartes.flatMap((carte) =>
    carte.attacks
      .filter((attaque: Attack) => !attaque.text?.trim())
      .map((attaque: Attack) => `${carte.id}/${attaque.name}`)
  );
}

describe('Textes ⇔ mécanique — garde-fou (ticket #48)', () => {
  it('ne recopie aucune liste : les attentes couvrent exactement les primitives déclarées', () => {
    expect(Object.keys(ATTENTES_EFFET).sort()).toEqual([...ATTACK_EFFECT_KINDS].sort());
    expect(Object.keys(ATTENTES_TALENT).sort()).toEqual([...ABILITY_KINDS].sort());
    // Aucun vocabulaire ne renvoie à une primitive inventée.
    for (const cue of CUES_EFFET) {
      for (const kind of cue.kinds) expect(ATTACK_EFFECT_KINDS, cue.label).toContain(kind);
    }
    for (const cue of CUES_TALENT) {
      for (const kind of cue.kinds) expect(ABILITY_KINDS, cue.label).toContain(kind);
    }
  });

  it('mord : un texte synthétique incohérent est refusé', () => {
    // Une Pression qui annonce une carte défaussée alors que l'effet retire un café.
    expect(
      verifierPression('L’adversaire défausse 1 carte.', [{ kind: 'discardEnergy', target: 'opponent' }])
    ).not.toEqual([]);
    // Un Talent qui promet de piocher alors que son `kind` attache un café.
    expect(verifierTalent('Une fois par tour : pioche 1 carte.', { kind: 'attachEnergy' })).not.toEqual([]);
    // Un Talent dont le texte ne décrit aucune mécanique.
    expect(verifierTalent('Les réunions, c’est sympa.', { kind: 'heal', amount: 10 })).not.toEqual([]);
    // Un montant qui ne correspond pas.
    expect(verifierTalent('Une fois par tour : soigne 20 de ce Planqué.', { kind: 'heal', amount: 10 })).not.toEqual(
      []
    );
    // Et le témoin : un texte honnête passe.
    expect(verifierTalent('Une fois par tour : soigne 10 de ce Planqué.', { kind: 'heal', amount: 10 })).toEqual([]);
  });

  it('mord : une défausse de carte doit être annoncée et réalisée (#159, D-076)', () => {
    // Un texte qui annonce une défausse sans primitive de main : refusé.
    expect(verifierPression('Ce Planqué défausse 1 carte.', [{ kind: 'draw', amount: 1 }])).not.toEqual([]);
    // La primitive sans texte qui l'annonce : refusée.
    expect(verifierPression('Pioche 1 carte.', [{ kind: 'discardHand', target: 'opponent', amount: 1 }])).not.toEqual([]);
    // Le témoin : une défausse annoncée et réalisée passe.
    expect(
      verifierPression('L’adversaire défausse 1 carte.', [{ kind: 'discardHand', target: 'opponent', amount: 1 }])
    ).toEqual([]);
  });

  it('mord : un Talent composé annonce chacune de ses primitives, montant compris (#164, D-077)', () => {
    const talent = 'Une fois par tour : défausse 1 carte, 10 dégâts au Planqué adverse actif.';
    expect(verifierTalent(talent, { kind: 'effects', effects: [{ kind: 'discardHand', target: 'self', amount: 1 }, { kind: 'damage', amount: 10 }] })).toEqual([]);
    // Le montant annoncé (10) doit être celui de l'effet.
    expect(verifierTalent(talent, { kind: 'effects', effects: [{ kind: 'discardHand', target: 'self', amount: 1 }, { kind: 'damage', amount: 20 }] })).not.toEqual([]);
    // Des dégâts annoncés sans primitive : refusés.
    expect(verifierTalent(talent, { kind: 'effects', effects: [{ kind: 'discardHand', target: 'self', amount: 1 }] })).not.toEqual([]);
  });

  it('mord : « en jouant » et le déclenchement à la mise en jeu se répondent (#163, D-081)', () => {
    // Le texte annonce « en jouant » sans déclencheur : refusé.
    expect(verifierTalent('En jouant : pioche 1 carte.', { kind: 'draw', amount: 1 })).not.toEqual([]);
    // Un déclencheur sans « en jouant » dans le texte : refusé.
    expect(verifierTalent('Une fois par tour : pioche 1 carte.', { kind: 'draw', amount: 1, trigger: 'onPlay' })).not.toEqual([]);
    // Le témoin : les deux se répondent.
    expect(verifierTalent('En jouant : pioche 1 carte.', { kind: 'draw', amount: 1, trigger: 'onPlay' })).toEqual([]);
  });

  it('mord : un café vers le Banc doit dire Banc, et seulement lui (#165, D-082)', () => {
    expect(verifierTalent('Une fois par tour : attache 1 café à un Planqué du Banc.', { kind: 'attachEnergy', target: 'rack' })).toEqual([]);
    // Le Talent de Polyvalence (au Poste) ne doit pas parler du Banc.
    expect(verifierTalent('Une fois par tour : attache 1 café à un Planqué du Banc.', { kind: 'attachEnergy' })).not.toEqual([]);
    // Une cible Banc sans le mot : refusée.
    expect(verifierTalent('Une fois par tour : attache 1 café à ce Planqué.', { kind: 'attachEnergy', target: 'rack' })).not.toEqual([]);
  });

  it('mord : les motifs respectent les frontières de mot (#166)', () => {
    // Le motif `main` doit trouver « main » et ne pas trouver « demain » ni « maintenance ».
    for (const table of [CUES_EFFET, CUES_TALENT]) {
      const motif = table.find((cue) => cue.label === 'main');
      expect(motif, 'motif « main » introuvable').toBeDefined();
      expect(motif?.pattern.test(normaliser('La recette est signée demain.')), '« demain »').toBe(false);
      expect(motif?.pattern.test(normaliser('Un plan de maintenance.')), '« maintenance »').toBe(false);
      expect(motif?.pattern.test(normaliser('Pioche la main.')), '« main »').toBe(true);
    }
    // Le contrôle complet : un texte où `main` n'est qu'un fragment passe, un texte où il est un mot est refusé.
    expect(verifierPression('La recette est signée demain.', [])).toEqual([]);
    expect(verifierPression('Ce Planqué prend la main.', [])).not.toEqual([]);
  });

  it('ne déclenche pas les motifs sur une sous-chaîne : « recherche », « semaines », « demain » (#166)', () => {
    expect(verifierPression('Ce Planqué fait de la recherche.', [])).toEqual([]);
    expect(verifierPression('Trois semaines de maintenance.', [])).toEqual([]);
    expect(verifierPression('Rendez-vous demain.', [])).toEqual([]);
  });

  it('donne un texte à chaque Pression de chaque Planqué (#158, D-074)', () => {
    expect(
      pressionsSansTexte(ALL_CARDS.filter(isPlanque)),
      'Une Pression sans texte : le gabarit ne l’affiche pas. Écrire le texte de la carte telle ' +
        'qu’elle est vendue ; si le moteur ne sait pas la réaliser, inscrire l’écart dans MENSONGES_CONNUS.'
    ).toEqual([]);
  });

  it('mord : une Pression sans texte, vide ou blanche est refusée', () => {
    const fautive = {
      id: 'atelier-synthetique',
      attacks: [
        { name: 'Sans texte', cost: ['ATELIER'], damage: 20 },
        { name: 'Texte vide', cost: ['ATELIER'], damage: 20, text: '' },
        { name: 'Texte blanc', cost: ['ATELIER'], damage: 20, text: '   ' },
        { name: 'Avec texte', cost: ['ATELIER'], damage: 20, text: 'Le Planqué adverse encaisse.' }
      ]
    } as unknown as PlanqueCard;
    expect(pressionsSansTexte([fautive])).toEqual([
      'atelier-synthetique/Sans texte',
      'atelier-synthetique/Texte vide',
      'atelier-synthetique/Texte blanc'
    ]);
  });

  it('« une fois par tour » est réservé aux Talents qui déclarent `oncePerTurn`', () => {
    for (const card of ALL_CARDS.filter(isPlanque)) {
      if (!card.ability) continue;
      const annonce = /une fois par tour/i.test(card.ability.text);
      expect(annonce, `${card.id}#talent : « ${card.ability.text} »`).toBe(card.ability.oncePerTurn === true);
    }
  });

  it('n’a aucun mensonge hors de l’inventaire de #47', () => {
    const horsListe = MENSONGES.filter((sujet) => !Object.hasOwn(MENSONGES_CONNUS, sujet.cle));
    expect(
      horsListe.map((sujet) => `${sujet.nature} : ${sujet.problemes.join(' ; ')}`),
      'Un texte annonce une mécanique que ses effets ne réalisent pas : corriger la carte, ' +
        'ou inscrire le mensonge dans MENSONGES_CONNUS avec sa raison (#47).'
    ).toEqual([]);
  });

  it('l’inventaire de #47 ne survit pas à la correction', () => {
    const perimees = Object.keys(MENSONGES_CONNUS).filter(
      (cle) => !MENSONGES.some((sujet) => sujet.cle === cle)
    );
    expect(perimees, 'Ces entrées ne mentent plus : les retirer de MENSONGES_CONNUS.').toEqual([]);
  });

  it('nomme chaque entrée de l’inventaire, dans le fichier de sa faction', () => {
    for (const [cle, raison] of Object.entries(MENSONGES_CONNUS)) {
      const sujet = SUJETS.find((entry) => entry.cle === cle);
      expect(sujet, `${cle} : aucune Pression ni Talent de ce nom`).toBeDefined();
      const fichier = /^(src\/data\/[a-z]+\.ts):(\d+) — (.+)$/.exec(raison);
      expect(fichier, `${cle} : attendu « src/data/<faction>.ts:<ligne> — <raison> »`).not.toBeNull();
      if (!fichier) continue;
      const faction = cle.split(/[/#]/)[0].split('-')[0];
      expect(fichier[1], `${cle} : le fichier ne correspond pas à la faction`).toBe(`src/data/${faction}.ts`);
      expect(fichier[3].trim().length, `${cle} : raison vide`).toBeGreaterThan(0);
    }
  });
});

/**
 * **Câblage des sept mécaniques du moteur** (#175, D-076 à D-082).
 *
 * Le garde-fou ci-dessus prouve qu'un texte annonce ce que la carte porte ; ce bloc
 * prouve la réciproque du ticket : la carte qui **vend** la mécanique la porte bien,
 * avec la primitive livrée par son ticket. Une carte câblée ne se contente plus d'un
 * texte juste — elle déclenche l'effet.
 *
 * La table se mute comme `pressionsSansTexte` : `cablagesManquants` est confronté au
 * catalogue (vide attendu) **et** à une carte privée de son effet (rouge attendu).
 */
interface Cablage {
  /** Clé stable `id/attaque` ou `id#talent`, celle de `SUJETS`. */
  cle: string;
  /** Ce que la carte vend, avec le ticket du moteur qui l'a livré. */
  mecanique: string;
  /** La carte porte-t-elle ce que son texte vend ? */
  verifie: (carte: PlanqueCard) => boolean;
}

/** Les effets du Talent d'une carte, vide s'il n'en est pas un `effects` (D-077). */
const effetsTalent = (carte: PlanqueCard): readonly AttackEffect[] =>
  carte.ability?.kind === 'effects' ? (carte.ability.effects ?? []) : [];

const declencheEnJouant = (carte: PlanqueCard): boolean => carte.ability?.trigger === 'onPlay';

const effetsAttaque = (carte: PlanqueCard, nom: string): readonly AttackEffect[] =>
  carte.attacks.find((attaque) => attaque.name === nom)?.effects ?? [];

/** Une liste d'effets contient-elle cette primitive, avec ces champs-là ? */
const contient = (effets: readonly AttackEffect[], attendu: Partial<AttackEffect>): boolean =>
  effets.some((effet) =>
    (Object.keys(attendu) as (keyof AttackEffect)[]).every((cle) => effet[cle] === attendu[cle])
  );

const CABLAGES: readonly Cablage[] = [
  // ——— #159 : défausser une carte de la main (D-076) ———
  {
    cle: 'management-manager-proximite#talent',
    mecanique: 'défausse de la main (#159)',
    verifie: (carte) => contient(effetsTalent(carte), { kind: 'discardHand', target: 'self', amount: 1 })
  },
  {
    cle: 'amelioration-auditeur-qualite#talent',
    mecanique: 'défausse de la main (#159)',
    verifie: (carte) => contient(effetsTalent(carte), { kind: 'discardHand', target: 'self', amount: 1 })
  },
  {
    cle: 'direction-directeur-adjoint#talent',
    mecanique: 'défausse de la main (#159)',
    verifie: (carte) =>
      contient(effetsTalent(carte), { kind: 'discardHand', target: 'self', amount: 1 }) &&
      contient(effetsTalent(carte), { kind: 'discardHand', target: 'opponent', amount: 1 })
  },
  {
    cle: 'direction-pdg/Fusion-acquisition',
    mecanique: 'défausse de la main (#159)',
    verifie: (carte) =>
      contient(effetsAttaque(carte, 'Fusion-acquisition'), { kind: 'discardHand', target: 'opponent', amount: 1 })
  },
  {
    cle: 'direction-pdg-ex/Fusion-acquisition',
    mecanique: 'défausse de la main (#159)',
    verifie: (carte) =>
      contient(effetsAttaque(carte, 'Fusion-acquisition'), { kind: 'discardHand', target: 'opponent', amount: 1 })
  },
  {
    cle: 'rh-drh/Plan de carrière',
    mecanique: 'défausse de la main (#159)',
    verifie: (carte) =>
      contient(effetsAttaque(carte, 'Plan de carrière'), { kind: 'discardHand', target: 'opponent', amount: 1 })
  },
  {
    cle: 'rh-drh-ex/Plan de carrière',
    mecanique: 'défausse de la main (#159)',
    verifie: (carte) =>
      contient(effetsAttaque(carte, 'Plan de carrière'), { kind: 'discardHand', target: 'opponent', amount: 1 })
  },
  // ——— #164 : un Talent qui inflige des dégâts (D-077) ———
  {
    cle: 'management-manager-proximite#talent',
    mecanique: 'dégâts d’un Talent (#164)',
    verifie: (carte) => contient(effetsTalent(carte), { kind: 'damage', amount: 10 })
  },
  // ——— #160 : révélation (D-078) ———
  {
    cle: 'rh-assistant-rh/Entretien',
    mecanique: 'révélation (#160)',
    verifie: (carte) => contient(effetsAttaque(carte, 'Entretien'), { kind: 'reveal', target: 'opponent', amount: 1 })
  },
  {
    cle: 'amelioration-auditeur-qualite#talent',
    mecanique: 'révélation (#160)',
    verifie: (carte) => contient(effetsTalent(carte), { kind: 'reveal', target: 'opponent' })
  },
  // ——— #162 : regarder le dessus du Deck (D-079) ———
  {
    cle: 'amelioration-charge-qualite/Checklist',
    mecanique: 'regard du dessus (#162)',
    verifie: (carte) => contient(effetsAttaque(carte, 'Checklist'), { kind: 'peek' })
  },
  // ——— #161 : chercher dans le Deck (D-080) ———
  {
    cle: 'rh-charge-recrutement#talent',
    mecanique: 'recherche dans le Deck (#161)',
    verifie: (carte) => contient(effetsTalent(carte), { kind: 'search', filter: 'PLANQUE' })
  },
  {
    cle: 'support-technicien-support#talent',
    mecanique: 'recherche dans le Deck (#161)',
    verifie: (carte) => contient(effetsTalent(carte), { kind: 'search', filter: 'COLLEAGUE' })
  },
  // ——— #163 : Talent « en jouant » (D-081) ———
  {
    cle: 'amelioration-auditeur-qualite#talent',
    mecanique: 'Talent « en jouant » (#163)',
    verifie: declencheEnJouant
  },
  {
    cle: 'direction-directeur-adjoint#talent',
    mecanique: 'Talent « en jouant » (#163)',
    verifie: declencheEnJouant
  },
  {
    cle: 'rh-charge-recrutement#talent',
    mecanique: 'Talent « en jouant » (#163)',
    verifie: declencheEnJouant
  },
  {
    cle: 'support-technicien-support#talent',
    mecanique: 'Talent « en jouant » (#163)',
    verifie: declencheEnJouant
  },
  // ——— #165 : un café à un Planqué du Banc (D-082) ———
  {
    cle: 'qvt-happiness-manager#talent',
    mecanique: 'café au Banc (#165)',
    verifie: (carte) => carte.ability?.kind === 'attachEnergy' && carte.ability.target === 'rack'
  }
];

/** Les câblages non tenus par `cartes`, désignés par leur clé stable. */
function cablagesManquants(cartes: readonly PlanqueCard[], cablages: readonly Cablage[]): string[] {
  const parId = new Map(cartes.map((carte) => [carte.id, carte]));
  const manquants: string[] = [];
  for (const cablage of cablages) {
    const id = cablage.cle.split(/[/#]/)[0];
    const carte = parId.get(id);
    if (!carte) {
      manquants.push(`${cablage.cle} : carte absente`);
      continue;
    }
    if (!cablage.verifie(carte)) manquants.push(`${cablage.cle} : ne porte pas ${cablage.mecanique}`);
  }
  return manquants;
}

/**
 * Une copie de `carte` **privée** de ce que `cle` désigne : le Talent (`#talent`) ou
 * l'attaque nommée (`/Nom`). C'est la mutation de contrôle du test « mord ».
 */
function amputer(carte: PlanqueCard, cle: string): PlanqueCard {
  if (cle.endsWith('#talent')) {
    return {
      ...carte,
      ability: carte.ability
        ? { ...carte.ability, effects: [], trigger: undefined, target: undefined }
        : undefined
    };
  }
  const nom = cle.slice(cle.indexOf('/') + 1);
  return {
    ...carte,
    attacks: carte.attacks.map((attaque) => (attaque.name === nom ? { ...attaque, effects: [] } : attaque))
  };
}

describe('Câblage des sept mécaniques du moteur (#175, D-076 à D-082)', () => {
  const PLANQUES = ALL_CARDS.filter(isPlanque);

  it('chaque carte qui vend une mécanique la porte', () => {
    expect(
      cablagesManquants(PLANQUES, CABLAGES),
      'Une carte vend une mécanique que sa primitive ne réalise pas : câbler l’effet (D-074).'
    ).toEqual([]);
  });

  it('les sept mécaniques ont au moins une carte qui les porte (#159 à #165)', () => {
    const quelque = (sonde: (carte: PlanqueCard) => boolean): boolean => PLANQUES.some(sonde);
    const effetsDesPressions = (carte: PlanqueCard) => carte.attacks.flatMap((attaque) => attaque.effects ?? []);
    expect(quelque((carte) => [...effetsDesPressions(carte), ...effetsTalent(carte)].some((e) => e.kind === 'discardHand')), 'défausse de la main (#159)').toBe(true);
    expect(quelque((carte) => effetsTalent(carte).some((e) => e.kind === 'damage')), 'Talent qui inflige des dégâts (#164)').toBe(true);
    expect(quelque((carte) => [...effetsDesPressions(carte), ...effetsTalent(carte)].some((e) => e.kind === 'reveal')), 'révélation (#160)').toBe(true);
    expect(quelque((carte) => effetsDesPressions(carte).some((e) => e.kind === 'peek')), 'regard du dessus (#162)').toBe(true);
    expect(quelque((carte) => effetsTalent(carte).some((e) => e.kind === 'search')), 'recherche dans le Deck (#161)').toBe(true);
    expect(quelque(declencheEnJouant), 'Talent « en jouant » (#163)').toBe(true);
    expect(quelque((carte) => carte.ability?.kind === 'attachEnergy' && carte.ability.target === 'rack'), 'café au Banc (#165)').toBe(true);
  });

  it('mord : retirer l’effet d’une carte câblée fait échouer le contrôle', () => {
    const source = PLANQUES.find((carte) => carte.id === 'management-manager-proximite');
    expect(source, 'management-manager-proximite introuvable').toBeDefined();
    if (!source) return;
    // La carte amputée de son Talent : le contrôle doit la signaler.
    const amputee: PlanqueCard = {
      ...source,
      ability: source.ability ? { ...source.ability, effects: [] } : undefined
    };
    expect(cablagesManquants([amputee], CABLAGES)).toContain(
      'management-manager-proximite#talent : ne porte pas défausse de la main (#159)'
    );
    // Et le témoin : la carte réelle passe.
    const cible = CABLAGES.filter((cablage) => cablage.cle.startsWith('management-manager-proximite'));
    expect(cablagesManquants([source], cible)).toEqual([]);
  });

  it('mord : chaque entrée signale la carte amputée de son effet', () => {
    // Une mutation par entrée : c'est ce qui prouve que la table n'est pas décorative.
    for (const cablage of CABLAGES) {
      const source = PLANQUES.find((carte) => carte.id === cablage.cle.split(/[/#]/)[0]);
      expect(source, `${cablage.cle} : carte introuvable`).toBeDefined();
      if (!source) continue;
      expect(cablage.verifie(amputer(source, cablage.cle)), `${cablage.cle} : l’effet retiré passe inaperçu`).toBe(
        false
      );
    }
  });

  it('les variantes héritent du câblage sans être retouchées', () => {
    for (const cablage of CABLAGES) {
      const id = cablage.cle.split(/[/#]/)[0];
      for (const variante of PLANQUES.filter((carte) => carte.variantOf === id)) {
        expect(cablage.verifie(variante), `${variante.id} : variante de ${id}`).toBe(true);
      }
    }
  });
});
