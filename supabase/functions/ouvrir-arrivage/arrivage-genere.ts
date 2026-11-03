/**
 * **Fichier généré : ne pas éditer à la main.**
 *
 * La copie serveur de l'Arrivage (#651, D-179) : le catalogue réduit à ce que le tirage lit
 * (`id`, `rarity`), la composition de `src/game/pack.ts` et le générateur seedé de
 * `src/game/rng.ts`. Elle est écrite par `npm run arrivage:serveur`
 * (`scripts/generateurs/arrivage-serveur.mjs`).
 *
 * **Pourquoi une copie et non un import** : Supabase déploie le dossier de la fonction, pas
 * le dépôt — un chemin relatif vers `src/` casserait au déploiement. La garde
 * `scripts/gardes/arrivage-serveur.test.ts` compare cette copie à sa source, graine par
 * graine et carte par carte : une composition changée d'un côté seulement la fait tomber.
 *
 * L'ordre de `CARDS` est celui de `ALL_CARDS` : il décide du tirage, ne pas le trier.
 */

/** Une carte, réduite à ce que le tirage lit. Pas de nom, pas de texte. */
export interface Carte {
  id: string;
  rarity: string;
}

/** Une ligne de composition : `count` cartes tirées dans les raretés données. */
export interface PackSlot {
  count: number;
  rarities: readonly string[];
}

/** Le catalogue, dans l'ordre de `ALL_CARDS`. */
export const CARDS: readonly Carte[] = [
  { id: 'sse-infirmier-site', rarity: '1D' },
  { id: 'sse-infirmiere-travail', rarity: '2D' },
  { id: 'sse-medecin-travail', rarity: '3D' },
  { id: 'sse-preventeur', rarity: '1D' },
  { id: 'sse-ergonome', rarity: '2D' },
  { id: 'sse-responsable-sse', rarity: '3D' },
  { id: 'sse-kine-travail', rarity: '1D' },
  { id: 'sse-sophrologue', rarity: '2D' },
  { id: 'sse-medecin-chef', rarity: '3D' },
  { id: 'sse-secouriste', rarity: '1D' },
  { id: 'sse-chef-secours', rarity: '2D' },
  { id: 'sse-agent-entretien', rarity: '1D' },
  { id: 'sse-responsable-hygiene', rarity: '2D' },
  { id: 'sse-psychologue', rarity: '1D' },
  { id: 'sse-psychiatre', rarity: '2D' },
  { id: 'sse-dieteticien', rarity: '1D' },
  { id: 'sse-nutritionniste', rarity: '2D' },
  { id: 'sse-interne', rarity: '1D' },
  { id: 'sse-infirmier-volant', rarity: '1D' },
  { id: 'sse-pompier-volontaire', rarity: '1D' },
  { id: 'sse-medecin-sport', rarity: '1D' },
  { id: 'sse-assistante-sociale', rarity: '1D' },
  { id: 'sse-controleur-securite', rarity: '1D' },
  { id: 'sse-responsable-securite', rarity: '3D' },
  { id: 'sse-brancardier', rarity: '1D' },
  { id: 'sse-medecin-legiste', rarity: '1D' },
  { id: 'sse-medecin-chef-ex', rarity: '4D' },
  { id: 'sse-responsable-sse-ex', rarity: '4D' },
  { id: 'sse-infirmiere-travail-star', rarity: '1S' },
  { id: 'sse-ergonome-star', rarity: '1S' },
  { id: 'sse-sophrologue-star', rarity: '1S' },
  { id: 'sse-chef-secours-star', rarity: '1S' },
  { id: 'sse-responsable-hygiene-star', rarity: '1S' },
  { id: 'sse-psychiatre-star', rarity: '1S' },
  { id: 'sse-medecin-travail-star3', rarity: '3S' },
  { id: 'sse-responsable-sse-star2', rarity: '2S' },
  { id: 'sse-medecin-chef-star2', rarity: '2S' },
  { id: 'sse-psychologue-star2', rarity: '2S' },
  { id: 'sse-nutritionniste-star2', rarity: '2S' },
  { id: 'management-jeune-manager', rarity: '1D' },
  { id: 'management-chef-de-projet', rarity: '1D' },
  { id: 'management-technico-commercial', rarity: '1D' },
  { id: 'management-assistant-manager', rarity: '1D' },
  { id: 'management-superviseur', rarity: '1D' },
  { id: 'management-animateur-equipe', rarity: '1D' },
  { id: 'management-chargee-clientele', rarity: '1D' },
  { id: 'management-planificateur', rarity: '1D' },
  { id: 'management-controleur-gestion', rarity: '1D' },
  { id: 'management-chef-equipe', rarity: '1D' },
  { id: 'management-charge-affaires', rarity: '1D' },
  { id: 'management-manager-proximite', rarity: '2D' },
  { id: 'management-responsable-projet', rarity: '2D' },
  { id: 'management-responsable-commercial', rarity: '2D' },
  { id: 'management-chef-service', rarity: '2D' },
  { id: 'management-responsable-production', rarity: '2D' },
  { id: 'management-responsable-unite', rarity: '3D' },
  { id: 'management-directeur-projet', rarity: '3D' },
  { id: 'management-directeur-production', rarity: '3D' },
  { id: 'management-directeur-service', rarity: '3D' },
  { id: 'management-responsable-unite-ex', rarity: '4D' },
  { id: 'management-manager-proximite-star', rarity: '1S' },
  { id: 'management-responsable-projet-star', rarity: '1S' },
  { id: 'management-responsable-commercial-star', rarity: '1S' },
  { id: 'management-chef-service-star', rarity: '1S' },
  { id: 'management-responsable-unite-star2', rarity: '2S' },
  { id: 'management-directeur-projet-star2', rarity: '2S' },
  { id: 'management-directeur-production-star2', rarity: '2S' },
  { id: 'management-jeune-manager-star2', rarity: '2S' },
  { id: 'amelioration-charge-qualite', rarity: '1D' },
  { id: 'amelioration-auditeur-qualite', rarity: '2D' },
  { id: 'amelioration-directeur-qualite', rarity: '3D' },
  { id: 'amelioration-consultant-lean', rarity: '1D' },
  { id: 'amelioration-responsable-process', rarity: '2D' },
  { id: 'amelioration-responsable-amelioration-continue', rarity: '3D' },
  { id: 'amelioration-gestionnaire-flux', rarity: '1D' },
  { id: 'amelioration-responsable-flux', rarity: '2D' },
  { id: 'amelioration-directeur-flux', rarity: '3D' },
  { id: 'amelioration-auditeur-interne', rarity: '1D' },
  { id: 'amelioration-responsable-audit', rarity: '2D' },
  { id: 'amelioration-directeur-audit-interne', rarity: '3D' },
  { id: 'amelioration-charge-amelioration', rarity: '1D' },
  { id: 'amelioration-charge-process', rarity: '2D' },
  { id: 'amelioration-controleur-qualite', rarity: '1D' },
  { id: 'amelioration-chef-projet-qualite', rarity: '2D' },
  { id: 'amelioration-stagiaire-qualite', rarity: '1D' },
  { id: 'amelioration-directeur-qualite-ex', rarity: '4D' },
  { id: 'amelioration-auditeur-qualite-star', rarity: '1S' },
  { id: 'amelioration-responsable-process-star', rarity: '1S' },
  { id: 'amelioration-responsable-audit-star', rarity: '1S' },
  { id: 'amelioration-chef-projet-qualite-star', rarity: '1S' },
  { id: 'amelioration-directeur-qualite-star3', rarity: '3S' },
  { id: 'amelioration-responsable-amelioration-continue-star2', rarity: '2S' },
  { id: 'amelioration-directeur-flux-star2', rarity: '2S' },
  { id: 'qvt-charge-qvt', rarity: '1D' },
  { id: 'qvt-happiness-manager', rarity: '2D' },
  { id: 'qvt-chief-happiness-officer', rarity: '3D' },
  { id: 'qvt-animateur-bien-etre', rarity: '1D' },
  { id: 'qvt-responsable-qvt', rarity: '2D' },
  { id: 'qvt-directeur-qvt', rarity: '3D' },
  { id: 'qvt-coach-sante', rarity: '1D' },
  { id: 'qvt-expert-bien-etre', rarity: '2D' },
  { id: 'qvt-coordinateur-flux', rarity: '2D' },
  { id: 'qvt-optimiseur-process', rarity: '3D' },
  { id: 'qvt-referent-qvt', rarity: '1D' },
  { id: 'qvt-chef-projet-qvt', rarity: '2D' },
  { id: 'qvt-charge-mission', rarity: '1D' },
  { id: 'qvt-facilitateur', rarity: '2D' },
  { id: 'qvt-charge-logistique', rarity: '1D' },
  { id: 'qvt-responsable-evenementiel', rarity: '1D' },
  { id: 'qvt-charge-ergonomie', rarity: '1D' },
  { id: 'qvt-gestionnaire-moyens-generaux', rarity: '1D' },
  { id: 'qvt-charge-environnement-travail', rarity: '1D' },
  { id: 'qvt-masseur-kinesitherapeute', rarity: '1D' },
  { id: 'qvt-charge-integration', rarity: '1D' },
  { id: 'qvt-responsable-integration', rarity: '2D' },
  { id: 'qvt-conseiller-evolution-professionnelle', rarity: '1D' },
  { id: 'qvt-responsable-developpement-competences', rarity: '3D' },
  { id: 'qvt-consultant-qvt', rarity: '1D' },
  { id: 'qvt-responsable-experience-collaborateur', rarity: '2D' },
  { id: 'qvt-charge-formation', rarity: '1D' },
  { id: 'qvt-chef-projet-formation', rarity: '2D' },
  { id: 'qvt-charge-engagement', rarity: '1D' },
  { id: 'qvt-responsable-engagement', rarity: '3D' },
  { id: 'qvt-chief-happiness-officer-ex', rarity: '4D' },
  { id: 'qvt-assistant-qvt', rarity: '1D' },
  { id: 'qvt-charge-communication-interne', rarity: '1D' },
  { id: 'qvt-charge-evenements-internes', rarity: '1D' },
  { id: 'qvt-charge-mobilite-interne', rarity: '1D' },
  { id: 'qvt-charge-vie-associative', rarity: '1D' },
  { id: 'qvt-directeur-qvt-ex', rarity: '4D' },
  { id: 'qvt-happiness-manager-star', rarity: '1S' },
  { id: 'qvt-chief-happiness-officer-star3', rarity: '3S' },
  { id: 'qvt-responsable-qvt-star', rarity: '1S' },
  { id: 'qvt-directeur-qvt-star2', rarity: '2S' },
  { id: 'qvt-charge-integration-star', rarity: '1S' },
  { id: 'qvt-consultant-qvt-star', rarity: '1S' },
  { id: 'qvt-charge-formation-star', rarity: '1S' },
  { id: 'qvt-charge-communication-interne-star', rarity: '1S' },
  { id: 'qvt-responsable-integration-star2', rarity: '2S' },
  { id: 'qvt-responsable-developpement-competences-star2', rarity: '2S' },
  { id: 'qvt-responsable-engagement-star2', rarity: '2S' },
  { id: 'qvt-responsable-experience-collaborateur-star2', rarity: '2S' },
  { id: 'rh-assistant-rh', rarity: '1D' },
  { id: 'rh-charge-recrutement', rarity: '2D' },
  { id: 'rh-drh', rarity: '3D' },
  { id: 'rh-charge-sourcing', rarity: '1D' },
  { id: 'rh-chasseur-tetes', rarity: '2D' },
  { id: 'rh-directeur-talents', rarity: '3D' },
  { id: 'rh-gestionnaire-formation', rarity: '1D' },
  { id: 'rh-responsable-formation', rarity: '2D' },
  { id: 'rh-drh-formation', rarity: '3D' },
  { id: 'rh-responsable-comp-ben', rarity: '2D' },
  { id: 'rh-juriste-social', rarity: '1D' },
  { id: 'rh-responsable-relations-sociales', rarity: '2D' },
  { id: 'rh-drh-juridique', rarity: '3D' },
  { id: 'rh-charge-diversite', rarity: '1D' },
  { id: 'rh-responsable-inclusion', rarity: '2D' },
  { id: 'rh-drh-diversite', rarity: '3D' },
  { id: 'rh-charge-mobilite', rarity: '1D' },
  { id: 'rh-gestionnaire-rh', rarity: '1D' },
  { id: 'rh-assistant-paie', rarity: '1D' },
  { id: 'rh-referent-handicap', rarity: '1D' },
  { id: 'rh-charge-prevention', rarity: '1D' },
  { id: 'rh-charge-offboarding', rarity: '1D' },
  { id: 'rh-charge-sirh', rarity: '1D' },
  { id: 'rh-drh-ex', rarity: '4D' },
  { id: 'rh-directeur-talents-ex', rarity: '4D' },
  { id: 'rh-assistant-rh-star', rarity: '1S' },
  { id: 'rh-charge-recrutement-star', rarity: '1S' },
  { id: 'rh-charge-sourcing-star', rarity: '1S' },
  { id: 'rh-chasseur-tetes-star', rarity: '1S' },
  { id: 'rh-drh-crown', rarity: 'COU' },
  { id: 'rh-directeur-talents-star2', rarity: '2S' },
  { id: 'rh-drh-formation-star2', rarity: '2S' },
  { id: 'rh-responsable-comp-ben-star2', rarity: '2S' },
  { id: 'atelier-joueur-de-flute', rarity: '1D' },
  { id: 'atelier-technicien-systeme', rarity: '2D' },
  { id: 'atelier-responsable-process', rarity: '3D' },
  { id: 'atelier-opticien', rarity: '1D' },
  { id: 'atelier-rpo', rarity: '2D' },
  { id: 'atelier-rui', rarity: '3D' },
  { id: 'atelier-regleur', rarity: '1D' },
  { id: 'atelier-rpi', rarity: '2D' },
  { id: 'atelier-responsable-flux', rarity: '3D' },
  { id: 'atelier-controleur-vibration', rarity: '1D' },
  { id: 'atelier-responsable-qualite', rarity: '2D' },
  { id: 'atelier-mecanicien', rarity: '1D' },
  { id: 'atelier-gestionnaire-fod', rarity: '2D' },
  { id: 'atelier-monteur-optique', rarity: '1D' },
  { id: 'atelier-technicien-banc-essai', rarity: '3D' },
  { id: 'atelier-pointeur', rarity: '1D' },
  { id: 'atelier-ordonnanceur', rarity: '2D' },
  { id: 'atelier-responsable-pole', rarity: '3D' },
  { id: 'atelier-cariste-salle-blanche', rarity: '1D' },
  { id: 'atelier-planificateur-moyens-essai', rarity: '2D' },
  { id: 'atelier-gardien-usine', rarity: '1D' },
  { id: 'atelier-magasinier', rarity: '1D' },
  { id: 'atelier-assistant-rpo', rarity: '1D' },
  { id: 'atelier-agent-maintenance', rarity: '1D' },
  { id: 'atelier-rpo-sans-rui-ex', rarity: '4D' },
  { id: 'atelier-rui-non-toxique-ex', rarity: '4D' },
  { id: 'atelier-technicien-systeme-star', rarity: '1S' },
  { id: 'atelier-rpo-star', rarity: '1S' },
  { id: 'atelier-responsable-qualite-star', rarity: '1S' },
  { id: 'atelier-rpi-star', rarity: '1S' },
  { id: 'atelier-responsable-process-star3', rarity: '3S' },
  { id: 'atelier-rui-star2', rarity: '2S' },
  { id: 'atelier-responsable-flux-star2', rarity: '2S' },
  { id: 'atelier-joueur-de-flute-star2', rarity: '2S' },
  { id: 'direction-chef-projet-fantome', rarity: '1D' },
  { id: 'direction-directeur-adjoint', rarity: '2D' },
  { id: 'direction-pdg', rarity: '3D' },
  { id: 'direction-pdg-ex', rarity: '4D' },
  { id: 'direction-directeur-fantome', rarity: '1D' },
  { id: 'direction-directeur-regional', rarity: '2D' },
  { id: 'direction-directeur-general', rarity: '3D' },
  { id: 'direction-assistant-direction', rarity: '1D' },
  { id: 'direction-chef-cabinet', rarity: '2D' },
  { id: 'direction-secretaire-direction', rarity: '1D' },
  { id: 'direction-directeur-programme', rarity: '2D' },
  { id: 'direction-directeur-cabinet', rarity: '3D' },
  { id: 'direction-directeur-strategie', rarity: '3D' },
  { id: 'direction-stagiaire-direction', rarity: '1D' },
  { id: 'direction-auditeur-direction', rarity: '1D' },
  { id: 'direction-commissaire-comptes', rarity: '2D' },
  { id: 'direction-chef-projet-fantome-star', rarity: '1S' },
  { id: 'direction-directeur-adjoint-star', rarity: '1S' },
  { id: 'direction-pdg-crown', rarity: 'COU' },
  { id: 'direction-directeur-general-star', rarity: '1S' },
  { id: 'interim-interimaire', rarity: '1D' },
  { id: 'interim-interimaire-confirme', rarity: '2D' },
  { id: 'interim-chef-equipe-interimaire', rarity: '3D' },
  { id: 'interim-interimaire-legendaire-ex', rarity: '4D' },
  { id: 'interim-consultant-interimaire', rarity: '3D' },
  { id: 'interim-responsable-interim', rarity: '3D' },
  { id: 'interim-vacataire', rarity: '1D' },
  { id: 'interim-charge-mission', rarity: '1D' },
  { id: 'interim-coordinateur-interimaire', rarity: '2D' },
  { id: 'interim-suppleant', rarity: '1D' },
  { id: 'support-agent-support', rarity: '1D' },
  { id: 'support-technicien-support', rarity: '2D' },
  { id: 'support-responsable-support', rarity: '3D' },
  { id: 'support-responsable-support-ex', rarity: '4D' },
  { id: 'support-standardiste', rarity: '1D' },
  { id: 'support-assistant-direction', rarity: '2D' },
  { id: 'support-responsable-services-generaux', rarity: '3D' },
  { id: 'support-technicien-micro-informatique', rarity: '1D' },
  { id: 'support-administrateur-systemes', rarity: '2D' },
  { id: 'support-ingenieur-systemes', rarity: '3D' },
  { id: 'support-redacteur-technique', rarity: '1D' },
  { id: 'support-charge-documentation', rarity: '2D' },
  { id: 'support-responsable-documentation', rarity: '3D' },
  { id: 'support-technicien-reseau', rarity: '1D' },
  { id: 'support-administrateur-reseau', rarity: '2D' },
  { id: 'support-correspondant-informatique', rarity: '1D' },
  { id: 'support-referent-informatique', rarity: '2D' },
  { id: 'support-assistant-methodes', rarity: '1D' },
  { id: 'support-technicien-methodes', rarity: '2D' },
  { id: 'support-formateur-informatique', rarity: '1D' },
  { id: 'support-charge-formation-informatique', rarity: '2D' },
  { id: 'support-gestionnaire-tickets', rarity: '1D' },
  { id: 'support-superviseur-support', rarity: '3D' },
  { id: 'support-assistant-administratif', rarity: '1D' },
  { id: 'support-archiviste', rarity: '1D' },
  { id: 'support-receptionniste', rarity: '1D' },
  { id: 'support-teleconseiller', rarity: '1D' },
  { id: 'support-operateur-saisie', rarity: '1D' },
  { id: 'support-testeur-logiciel', rarity: '1D' },
  { id: 'support-coordinateur-support', rarity: '2D' },
  { id: 'support-ingenieur-systemes-ex', rarity: '4D' },
  { id: 'support-technicien-support-star', rarity: '1S' },
  { id: 'support-administrateur-systemes-star', rarity: '1S' },
  { id: 'support-charge-documentation-star', rarity: '1S' },
  { id: 'support-superviseur-support-star', rarity: '1S' },
  { id: 'support-responsable-support-star2', rarity: '2S' },
  { id: 'support-ingenieur-systemes-star2', rarity: '2S' },
  { id: 'support-responsable-documentation-star2', rarity: '2S' },
  { id: 'support-responsable-services-generaux-star2', rarity: '2S' },
  { id: 'syndicat-delegue-personnel', rarity: '1D' },
  { id: 'syndicat-representant-cse', rarity: '2D' },
  { id: 'syndicat-secretaire-general', rarity: '3D' },
  { id: 'syndicat-secretaire-general-ex', rarity: '4D' },
  { id: 'syndicat-tresorier-cse', rarity: '3D' },
  { id: 'syndicat-president-cse', rarity: '3D' },
  { id: 'syndicat-delegue-syndical', rarity: '1D' },
  { id: 'syndicat-permanent-syndical', rarity: '2D' },
  { id: 'syndicat-collectif-atelier', rarity: '1D' },
  { id: 'syndicat-representant-section', rarity: '1D' },
  { id: 'syndicat-secretaire-general-crown', rarity: 'COU' },
  { id: 'sse-trousse-secours', rarity: '2D' },
  { id: 'amelioration-baie-test', rarity: '2D' },
  { id: 'atelier-colle-cyanoacrylate', rarity: '2D' },
  { id: 'sse-visite-medicale', rarity: '2D' },
  { id: 'management-entretien-annuel', rarity: '2D' },
  { id: 'qvt-yoga-du-rire', rarity: '2D' },
  { id: 'amelioration-reunion-de-suivi', rarity: '2D' },
  { id: 'rh-reunion-individuelle', rarity: '2D' },
  { id: 'direction-reunion-qui-aurait-pu-etre-un-mail', rarity: '2D' },
  { id: 'syndicat-assemblee-generale', rarity: '2D' },
  { id: 'support-escalade', rarity: '2D' },
  { id: 'sse-visite-medicale-star', rarity: '1S' },
  { id: 'management-entretien-annuel-star', rarity: '1S' },
  { id: 'qvt-yoga-du-rire-star', rarity: '1S' },
  { id: 'amelioration-reunion-de-suivi-star', rarity: '1S' },
  { id: 'rh-reunion-individuelle-star', rarity: '1S' },
  { id: 'direction-reunion-qui-aurait-pu-etre-un-mail-star', rarity: '1S' },
  { id: 'syndicat-assemblee-generale-star', rarity: '1S' },
  { id: 'support-escalade-star', rarity: '1S' }
];

/** Nombre de cartes d'un Arrivage. */
export const PACK_SIZE = 5;

/** Composition de l'Arrivage, du plus courant au plus rare. */
export const PACK_COMPOSITION: readonly PackSlot[] = [
  { count: 3, rarities: ['1D', '2D'] },
  { count: 1, rarities: ['3D'] },
  { count: 1, rarities: ['1S', '2S', '4D'] }
];

/** État du générateur : un entier 32 bits non signé. */
export type RngState = number;

/** Tout ce qui porte un état de générateur. */
export interface RngHolder {
  rng: RngState;
}

/** État initial pour une graine quelconque — copie de `seedRng` (`src/game/rng.ts`). */
export function seedRng(seed: number): RngState {
  const normalized = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  return (normalized ^ 0x9e3779b9) >>> 0;
}

/** Un pas de mulberry32 — copie de `stepRng` (`src/game/rng.ts`). */
function stepRng(state: RngState): { value: number; state: RngState } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/** Consomme un tirage dans `[0, 1)` — copie de `drawRandom` (`src/game/rng.ts`). */
export function drawRandom(holder: RngHolder): number {
  const step = stepRng(holder.rng);
  holder.rng = step.state;
  return step.value;
}

/** Les cartes dont la rareté est dans `rarities`. */
function poolOf(rarities: readonly string[]): Carte[] {
  return CARDS.filter((card) => rarities.includes(card.rarity));
}

/** Tire une carte du vivier, en avançant le générateur. */
function pick(pool: Carte[], holder: RngHolder): Carte {
  return pool[Math.floor(drawRandom(holder) * pool.length)] ?? CARDS[0];
}

/** Ouvre un Arrivage — copie de `openPackCards` (`src/game/pack.ts`). */
export function openPackCards(holder: RngHolder): Carte[] {
  return PACK_COMPOSITION.flatMap((slot) => {
    const pool = poolOf(slot.rarities);
    return Array.from({ length: slot.count }, () => pick(pool, holder));
  });
}
