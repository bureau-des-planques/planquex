import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isPlanque } from '@/data';
import type { Ability, AbilityKind, AttackEffect, AttackEffectKind, Status } from '@/data/types';
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
 * c'est #47. Les mensonges recensés sont donc dans `MENSONGES_CONNUS`, avec leur raison.
 * Corriger une carte (ou son texte) fait échouer le dernier test tant que l'entrée n'est
 * pas retirée : la liste ne peut pas survivre à la correction.
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
 * primitives (`AGENTS.md` §5) — avec la primitive qui peut les réaliser.
 *
 * `kinds: []` signale un mot **sans primitive** : le texte ne peut pas être honnête
 * aujourd'hui. C'est exactement l'inventaire que #47 doit trancher (changer le texte,
 * ou décider la primitive qui manque).
 */
const CUES_EFFET: readonly Cue<AttackEffectKind>[] = [
  // `discardEnergy` retire un café au Planqué d'en face (engine.ts : `defender.energy -= 1`).
  { label: 'café', pattern: /cafes?\b/, kinds: ['discardEnergy'] },
  // Aucune primitive ne défausse une carte de la main : le seul rebut est le café.
  { label: 'défausse 1 carte', pattern: /defausse (?:\d+|une) carte/, kinds: [] },
  { label: 'pioche N cartes', pattern: /pioche (\d+) carte/, kinds: ['draw'] },
  { label: 'soigne N de tous tes Planqués', pattern: /soigne (\d+)[^.]*tous tes planques/, kinds: ['healAll'] },
  { label: 'soigne N de ce Planqué', pattern: /soigne (\d+)[^.]*ce planque/, kinds: ['healSelf'] },
  { label: 'subit N de moins', pattern: /subit (\d+)[^.]*de moins/, kinds: ['reduceDamage'] },
  { label: 'prend N de stress', pattern: /prend (\d+)[^.]*stress/, kinds: ['selfDamage'] },
  { label: 'statut nommé', pattern: /surcharge|epuisement|sieste|immobilis|deriv/, kinds: ['status'] },
  // `switchSelf` échange le Poste avec le premier Planqué du Rack (engine.ts).
  { label: 'Rack', pattern: /rack/, kinds: ['switchSelf'] },
  // Aucune primitive ne touche la main ni ne cherche dans le Chariot.
  { label: 'main', pattern: /main/, kinds: [] },
  { label: 'deck', pattern: /deck/, kinds: [] }
];

/**
 * Les mots d'un **Talent**, avec le `AbilityKind` qui peut les réaliser.
 *
 * Un Talent n'a pas accès aux primitives d'attaque : `Rack`, `défausse`, `cherche`,
 * `main`, `deck` n'ont donc aucune primitive de Talent. `attachEnergy` attache au
 * **Poste** (`engine.ts` : `player.active.energy += 1`) et `heal` / `antiStatus` ne
 * soignent que le Poste : viser le Rack ou la main est un mensonge.
 */
const CUES_TALENT: readonly Cue<AbilityKind>[] = [
  { label: 'café', pattern: /cafes?\b/, kinds: ['attachEnergy'] },
  { label: 'pioche N cartes', pattern: /pioche (\d+) carte/, kinds: ['draw'] },
  { label: 'soigne N', pattern: /soigne (\d+)/, kinds: ['heal', 'antiStatus'] },
  { label: 'retire un statut', pattern: /retire un statut/, kinds: ['antiStatus'] },
  { label: 'subit N de moins', pattern: /subit (\d+)[^.]*de moins/, kinds: ['reduceDamage'] },
  // Aucune primitive de Talent ne défausse, ne cherche, ne touche la main, le deck ou le
  // Rack, et aucune ne se déclenche « en jouant » : `useAbility` est une action du tour.
  { label: 'défausse', pattern: /defauss/, kinds: [] },
  { label: 'cherche', pattern: /cherche/, kinds: [] },
  { label: 'main', pattern: /main/, kinds: [] },
  { label: 'deck', pattern: /deck/, kinds: [] },
  { label: 'Rack', pattern: /rack/, kinds: [] },
  { label: 'en jouant', pattern: /en jouant/, kinds: [] }
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
  switchSelf: { pattern: /rack/ },
  reduceDamage: { pattern: /subit (\d+)[^.]*de moins/, montantGroupe: 1 }
};

const ATTENTES_TALENT: Record<AbilityKind, Attente> = {
  heal: { pattern: /soigne (\d+)/, montantGroupe: 1 },
  draw: { pattern: /pioche (\d+) carte/, montantGroupe: 1 },
  attachEnergy: { pattern: /attache 1 cafes?\b/ },
  reduceDamage: { pattern: /subit (\d+)[^.]*de moins/, montantGroupe: 1 },
  antiStatus: { pattern: /soigne (\d+)[^.]*retire un statut/, montantGroupe: 1 }
};

/** Les mots par lesquels un texte annonce un statut (`AGENTS.md` §3.1). */
const MOTS_STATUT: Record<Status, RegExp> = {
  SURCHARGE: /surcharge/,
  EPUISEMENT: /epuisement/,
  SIESTE: /sieste/,
  IMMOBILISATION: /immobilis/,
  DERIVE: /deriv/
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
function verifierTalent(texte: string, ability: Pick<Ability, 'kind' | 'amount'>): string[] {
  const normalise = normaliser(texte);
  const problemes = verifierCues(normalise, new Set([ability.kind]), CUES_TALENT);
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
 * **Inventaire de #47** : les mensonges texte ⇔ mécanique du contenu actuel.
 *
 * Ce ne sont pas des exceptions de confort : chacun est un texte qui annonce une
 * mécanique que le moteur ne fait pas. #47 tranche — corriger le texte, ou décider la
 * primitive qui manque (et alors retirer l'entrée). Tant que la décision n'est pas
 * prise, le garde-fou ne peut pas être plus strict que cette liste.
 *
 * Clé stable : `id/attaque` ou `id#talent`. Les `fichier:ligne` sont ceux du 20/10/2026
 * (commit de #48) : c'est un relevé, pas une adresse à maintenir. Le test vérifie que le
 * fichier cité est bien celui de la faction de la carte.
 */
const MENSONGES_CONNUS: Readonly<Record<string, string>> = {
  // 10 Pressions qui annoncent une carte défaussée là où `discardEnergy` retire un café.
  'rh-drh/Plan de carrière':
    'src/data/rh.ts:48 — « L’adversaire défausse 1 carte » : discardEnergy retire un café, pas une carte.',
  'rh-recruteur-embuscade/Approche discrète':
    'src/data/rh.ts:62 — « L’adversaire défausse 1 carte » : discardEnergy retire un café, pas une carte.',
  'rh-responsable-relations-sociales/Négociation':
    'src/data/rh.ts:167 — « L’adversaire défausse 1 carte » : discardEnergy retire un café, pas une carte.',
  'rh-charge-offboarding/Entretien départ':
    'src/data/rh.ts:283 — « L’adversaire défausse 1 carte » : discardEnergy retire un café, pas une carte.',
  'rh-drh-ex/Plan de carrière':
    'src/data/rh.ts:308 — « L’adversaire défausse 1 carte » : discardEnergy retire un café, pas une carte.',
  'direction-pdg/Fusion-acquisition':
    'src/data/direction.ts:55 — « L’adversaire défausse 1 carte » : discardEnergy retire un café, pas une carte.',
  'direction-pdg-ex/Fusion-acquisition':
    'src/data/direction.ts:71 — « L’adversaire défausse 1 carte » : discardEnergy retire un café, pas une carte.',
  'direction-chef-cabinet/Note interne':
    'src/data/direction.ts:134 — « L’adversaire défausse 1 carte » : discardEnergy retire un café, pas une carte.',
  'direction-directeur-programme/Recette finale':
    'src/data/direction.ts:160 — « L’adversaire défausse 1 carte » : discardEnergy retire un café, pas une carte.',
  'direction-commissaire-comptes/Rapport d\'anomalie':
    'src/data/direction.ts:195 — « L’adversaire défausse 1 carte » : discardEnergy retire un café, pas une carte.',
  // Une Pression qui annonce une révélation de main et applique Dérive.
  'rh-assistant-rh/Entretien':
    'src/data/rh.ts:24 — « révèle une carte de sa main » : l’effet applique Dérive, rien n’est révélé.',
  // Quatre Talents qui promettent ce que leur `kind` ne fait pas.
  'qvt-happiness-manager#talent':
    'src/data/qvt.ts:35 — « attache 1 café à un Planqué de ton Rack » : attachEnergy attache au Poste.',
  'rh-charge-recrutement#talent':
    'src/data/rh.ts:35 — « cherche dans ton deck, révèle, ajoute à ta main » : draw pioche le dessus.',
  'rh-responsable-inclusion#talent':
    'src/data/rh.ts:206 — « échange 1 carte de ta main avec le dessus de ton deck » : draw pioche le dessus.',
  'direction-directeur-adjoint#talent':
    'src/data/direction.ts:41 — « défausse 1 carte » : draw pioche une carte, rien n’est défaussé.',

  // Sept variantes qui héritent du texte et des effets de leur base (`cards.test.ts`
  // l’assure) : c’est le même mensonge, sur une autre carte. Chacune a son entrée : une
  // clé de base ne doit pas pouvoir couvrir un mensonge qui lui serait propre.
  'rh-assistant-rh-star/Entretien':
    'src/data/rh.ts:329 — variante de rh-assistant-rh : Dérive annoncée comme une révélation de main.',
  'rh-charge-recrutement-star#talent':
    'src/data/rh.ts:330 — variante de rh-charge-recrutement : draw annoncé comme une recherche.',
  'rh-recruteur-embuscade-star/Approche discrète':
    'src/data/rh.ts:331 — variante de rh-recruteur-embuscade : discardEnergy annoncé comme une carte.',
  'rh-drh-star2/Plan de carrière':
    'src/data/rh.ts:333 — variante de rh-drh : discardEnergy annoncé comme une carte.',
  'qvt-happiness-manager-star#talent':
    'src/data/qvt.ts:462 — variante de qvt-happiness-manager : le café annoncé au Rack va au Poste.',
  'direction-directeur-adjoint-star#talent':
    'src/data/direction.ts:216 — variante de direction-directeur-adjoint : draw annoncé comme une défausse.',
  'direction-pdg-star2/Fusion-acquisition':
    'src/data/direction.ts:217 — variante de direction-pdg : discardEnergy annoncé comme une carte.'
};

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
