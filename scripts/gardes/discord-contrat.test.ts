import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * **La page Discord est un contrat produit, pas un runbook** (D-177 (3), #636).
 *
 * `docs/INTEGRATIONS-DISCORD.md` est dans un dépôt public. Le runbook d'exploitation du serveur
 * (salons, règles, webhooks, intégration Vercel, invitation permanente, modération) vit dans
 * `planquex-infra`. Cette garde exige que la page **garde** le contrat (la variable, le module
 * unique, les trois emplacements, le `rel`, aucun widget, le facultatif, les frontières de
 * données) et **ne reprenne aucun geste d'exploitation ni secret**.
 *
 * Chaque contrôle est une fonction pure essayée sur un **cas fautif** : une garde qui ne peut
 * pas échouer ne compte pas (`AGENTS.md` §6).
 */

const PAGE = 'docs/INTEGRATIONS-DISCORD.md';

/** Ce que le contrat doit dire : chaque motif peut manquer, c'est ce qui fait mordre la garde. */
const CONTRAT = [
  { quoi: 'la variable VITE_DISCORD_INVITE', motif: /VITE_DISCORD_INVITE/ },
  { quoi: 'le module unique InvitationTesteurs', motif: /src\/components\/InvitationTesteurs\.tsx/ },
  { quoi: 'l’emplacement Réglages', motif: /\*\*Réglages\*\*/ },
  { quoi: 'l’emplacement pied du comité', motif: /\*\*Pied du comité\*\*/ },
  { quoi: 'l’emplacement Connexion (D-159)', motif: /\*\*Connexion\*\*[^\n]*D-159/ },
  { quoi: 'le rel noreferrer noopener', motif: /rel="noreferrer noopener"/ },
  { quoi: 'aucun iframe, script ou widget', motif: /Aucun `iframe`, aucun script, aucun widget/ },
  { quoi: 'le lien facultatif', motif: /facultatif/ },
  { quoi: 'les frontières de données (gueulage, compte)', motif: /gueulage[\s\S]*donnée de compte/ },
  { quoi: 'le renvoi du runbook à planquex-infra', motif: /planquex-infra/ }
] as const;

/** Ce qu'une page publique ne porte pas : un secret, un identifiant du serveur, un geste d'exploitation. */
const EXPLOITATION = [
  { quoi: 'une URL de webhook', motif: /discord(?:app)?\.com\/api\/webhooks/i },
  { quoi: 'un secret Vault', motif: /vault\.(?:create_secret|secrets)/i },
  { quoi: 'un identifiant Discord (snowflake)', motif: /\b\d{17,20}\b/ },
  { quoi: 'un identifiant d’équipe ou de projet Vercel', motif: /\bteam_[A-Za-z0-9]{10,}|chapaxs-projects/ },
  { quoi: 'une invitation Discord en dur', motif: /discord\.gg\/(?!<code>)[A-Za-z0-9-]{4,}/ },
  {
    quoi: 'un geste d’interface (Modifier le salon, Add webhook, Intégrations → Webhooks)',
    motif: /Modifier le salon|Add webhook|Nouveau webhook/
  },
  { quoi: 'un geste de CLI ou d’API d’exploitation', motif: /vercel integration|supabase db push|POST \/v1\/webhooks/ },
  { quoi: 'la procédure d’invitation permanente', motif: /Recréer l.invitation|Modifier le lien/ },
  { quoi: 'le règlement du serveur', motif: /Règlement intérieur/ }
] as const;

/** Ce que le contrat ne dit pas — vide quand il est complet. */
function contratManquant(texte: string, attendu: readonly { quoi: string; motif: RegExp }[] = CONTRAT): string[] {
  return attendu.filter(({ motif }) => !motif.test(texte)).map(({ quoi }) => quoi);
}

/** Ce que la page porte et ne devrait pas — vide quand elle est publique sans risque. */
function exploitationPresente(
  texte: string,
  interdit: readonly { quoi: string; motif: RegExp }[] = EXPLOITATION
): string[] {
  return interdit.filter(({ motif }) => motif.test(texte)).map(({ quoi }) => quoi);
}

const page = readFileSync(fileURLToPath(new URL(`../../${PAGE}`, import.meta.url)), 'utf8');

describe('Discord — la page est un contrat produit (#636, D-177)', () => {
  it('la page garde tout le contrat produit', () => {
    expect(contratManquant(page), `${PAGE} ne dit plus : ${contratManquant(page).join(', ')}`).toEqual([]);
  });

  it('la page ne porte ni secret ni geste d’exploitation', () => {
    expect(exploitationPresente(page), `${PAGE} est publique : le runbook vit dans planquex-infra (D-177 (3))`).toEqual(
      []
    );
  });

  it('le contrôle mord : un contrat amputé est refusé', () => {
    const amputee = page.replace(/Connexion/g, 'Ailleurs');
    expect(contratManquant(amputee)).toContain('l’emplacement Connexion (D-159)');
    expect(contratManquant('')).toHaveLength(CONTRAT.length);
  });

  it('le contrôle mord : un runbook recollé est refusé, geste par geste', () => {
    const fautifs: Record<string, string> = {
      'une URL de webhook': 'https://discord.com/api/webhooks/123/abc',
      'un secret Vault': "select vault.create_secret('x', 'discord_webhook_comite');",
      'un identifiant Discord (snowflake)': '`1487523730438492231`',
      'un identifiant d’équipe ou de projet Vercel': 'l’équipe `chapaxs-projects`',
      'une invitation Discord en dur': 'https://discord.gg/NvfrzCeJee',
      'un geste d’interface (Modifier le salon, Add webhook, Intégrations → Webhooks)':
        'Modifier le salon → Intégrations',
      'un geste de CLI ou d’API d’exploitation': '`vercel integration add discord`',
      'la procédure d’invitation permanente': 'Recréer l’invitation : clic droit',
      'le règlement du serveur': '📜 Règlement intérieur'
    };
    expect(Object.keys(fautifs).sort()).toEqual(EXPLOITATION.map(({ quoi }) => quoi).sort());
    for (const [quoi, extrait] of Object.entries(fautifs)) {
      expect(exploitationPresente(`${page}\n${extrait}\n`), extrait).toContain(quoi);
    }
  });
});
