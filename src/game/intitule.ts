/**
 * Le parcours de première connexion : les services, le catalogue des intitulés, et leur
 * tirage (#325, D-148).
 *
 * « Service » désigne ici **le groupe du testeur**, pas le vivier d'une faction (AGENTS.md
 * §3.2) : aucune mécanique n'y est attachée à ce stade.
 *
 * Le tirage passe par le **générateur seedé** du moteur (`rng.ts`) : même compte + même nombre
 * de relances = même intitulé. Aucun `Math.random()` : la graine vient du compte lui-même, ce
 * qui fait qu'un rechargement de l'écran ne change pas l'intitulé déjà tiré.
 *
 * La liste des intitulés est **provisoire et courte** (#325) : le contenu final reste une
 * décision de Bastien (#264). Une entrée nouvelle s'ajoute ici, rien d'autre ne bouge.
 */
import { seedRng, stepRng } from './rng';

/** Les cinq groupes du parcours. `complement` se lit après « planqué ». */
export const SERVICES = [
  {
    code: 'red-chaussee',
    libelle: 'Red Chaussée',
    complement: 'de la Red Chaussée',
    dit: 'L’étage dont personne ne prononce le nom.'
  },
  {
    code: 'rez-de-chaussee',
    libelle: 'rez-de-chaussée',
    complement: 'du rez-de-chaussée',
    dit: 'L’accueil, les badges et les colis mal étiquetés.'
  },
  {
    code: '1er',
    libelle: '1er',
    complement: 'du 1er',
    dit: 'Les réunions qui auraient pu être un courriel.'
  },
  {
    code: '2e',
    libelle: '2e',
    complement: 'du 2e',
    dit: 'Les tableurs, la machine à café, le silence.'
  },
  {
    code: '3e',
    libelle: '3e',
    complement: 'du 3e',
    dit: 'La direction, paraît-il.'
  }
] as const;

export type CodeService = (typeof SERVICES)[number]['code'];

/** Le catalogue provisoire des intitulés. Court, et drôle sans viser une personne. */
export const INTITULES = [
  'sculpteur de fumée',
  'archiviste des réunions sans ordre du jour',
  'gardien du café froid',
  'expert en relances cordiales',
  'chef de projet fantôme',
  'optimiseur de tableurs inutiles',
  'ambassadeur des messages en copie',
  'responsable des dossiers en attente'
] as const;

/** Le service d'un code, ou `undefined` si le code n'existe pas. */
export function serviceDe(code: string | null | undefined) {
  return SERVICES.find((service) => service.code === code);
}

/**
 * Hachage FNV-1a d'un texte, sur 32 bits : la graine d'un tirage, à partir d'un identifiant.
 * Déterministe, sans dépendance, identique dans le navigateur et dans Node.
 */
export function graineDe(texte: string): number {
  let empreinte = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    empreinte ^= texte.charCodeAt(i);
    empreinte = Math.imul(empreinte, 0x01000193) >>> 0;
  }
  return empreinte;
}

/**
 * L'intitulé tiré pour un compte, après `relances` relances (0 ou 1).
 *
 * La graine combine le compte et le nombre de relances : une relance donne un **autre**
 * tirage, et un rechargement redonne le même. Une seule étape du générateur suffit pour
 * choisir dans la liste.
 */
export function tirerIntitule(compte: string, relances: number): string {
  const { value } = stepRng(seedRng(graineDe(`${compte}|${relances}`)));
  const index = Math.min(INTITULES.length - 1, Math.floor(value * INTITULES.length));
  return INTITULES[index]!;
}

/** La phrase du profil, telle qu'elle s'affiche : « pseudo / planqué du 2e — sculpteur de fumée ». */
export function phraseProfil(profil: { pseudo: string; service: string; intitule: string }): string {
  const service = serviceDe(profil.service);
  const groupe = service ? service.complement : '';
  return `${profil.pseudo} / planqué ${groupe} — ${profil.intitule}`.replace(/\s+/g, ' ');
}
