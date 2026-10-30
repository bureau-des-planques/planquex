/**
 * La porte du serveur des testeurs — **le seul module qui lit l'invitation** (#317, D-120).
 *
 * Un **service tiers** entre dans le périmètre : un serveur Discord facultatif, où les
 * testeurs de l'alpha se parlent entre deux parties. Le client n'en garde **qu'un lien** :
 * aucun widget, aucun `iframe`, aucun script Discord — la page Confidentialité promet
 * « aucun traceur », et un embed la rendrait fausse.
 *
 * **Une seule variable** : `VITE_DISCORD_INVITE`, l'invitation **permanente** du serveur
 * (créée sans expiration). Elle n'est pas un secret — c'est une adresse publique — mais elle
 * ne vit **que** là : la changer ne demande pas de toucher au code, et un build sans elle
 * reste l'état par défaut.
 *
 * **Vide veut dire rien** : sans invitation, les deux emplacements (Réglages et pied du
 * comité) ne rendent **rien du tout** — pas un titre orphelin, pas un panneau vide, pas un
 * test d'écran à réécrire.
 *
 * **Une valeur posée est vérifiée** : `http:`, `javascript:`, un hôte qui n'est pas Discord ou
 * une adresse qui n'est pas une invitation font **lever** le module, avec le nom de la
 * variable. Une configuration fausse ne doit pas se taire (même parti pris que
 * `src/lib/supabase.ts`) ; le build de la CI, sans variable, ne la rencontre jamais.
 */
import { ExternalLink } from 'lucide-react';

/** Le nom de la variable Vite qui porte l'invitation permanente. */
export const VARIABLE_INVITATION = 'VITE_DISCORD_INVITE';

/** Le libellé du lien — il dit « testeur » (D-117). */
export const LIBELLE_INVITATION = 'Rejoindre le serveur des testeurs';

type Environnement = Record<string, string | boolean | undefined>;

/** Les deux formes d'une invitation Discord : `discord.gg/<code>` ou `discord.com/invite/<code>`. */
function estInvitation(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  const segments = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'discord.gg') return segments.length === 1;
  if (url.hostname === 'discord.com' || url.hostname === 'www.discord.com') {
    return segments.length === 2 && segments[0] === 'invite';
  }
  return false;
}

/**
 * L'invitation permanente, ou `null` si la variable est vide (l'état par défaut du build).
 *
 * Lève si la variable est **posée mais fausse** : mieux vaut une erreur nommée qu'un lien
 * mort ou trompeur dans Réglages.
 */
export function invitationDiscord(env: Environnement = import.meta.env): string | null {
  const brut = typeof env[VARIABLE_INVITATION] === 'string' ? env[VARIABLE_INVITATION].trim() : '';
  if (!brut) return null;

  let url: URL;
  try {
    url = new URL(brut);
  } catch {
    throw new Error(
      `${VARIABLE_INVITATION} n’est pas une adresse : « ${brut} ». Attendu une invitation Discord ` +
        '(https://discord.gg/<code> ou https://discord.com/invite/<code>), ou rien du tout.'
    );
  }

  if (!estInvitation(url)) {
    throw new Error(
      `${VARIABLE_INVITATION} n’est pas une invitation Discord : « ${brut} ». Attendu ` +
        'https://discord.gg/<code> ou https://discord.com/invite/<code>, en https, ou rien du tout.'
    );
  }

  return url.toString();
}

/**
 * Le lien, posé à **trois endroits** depuis D-159 : la section de **Réglages**, le **pied du
 * comité**, et la **page de connexion** — le seul qui serve à quelqu'un qui n'est pas encore
 * entré. Le même module rend les trois, pour que `rel` et le libellé ne divergent pas.
 */
export function InvitationTesteurs({ ou }: { ou: 'reglages' | 'comite' | 'connexion' }) {
  const invitation = invitationDiscord();
  if (!invitation) return null;

  const lien = (
    <a
      className={ou === 'reglages' ? 'button' : 'underline underline-offset-2'}
      href={invitation}
      target="_blank"
      rel="noreferrer noopener"
    >
      {ou === 'reglages' && <ExternalLink size={16} aria-hidden />} {LIBELLE_INVITATION}
    </a>
  );

  if (ou === 'reglages') {
    return (
      <section className="section panel">
        <h2>Le serveur des testeurs</h2>
        <p className="muted max-w-[62ch]">
          Les testeurs de l’alpha se retrouvent aussi sur un serveur Discord, pour se parler entre deux parties. C’est{' '}
          <strong>facultatif</strong> : le jeu se joue sans, et le lien ouvre Discord dans un nouvel onglet.
        </p>
        <p className="m-0">{lien}</p>
      </section>
    );
  }

  if (ou === 'connexion') {
    return (
      <p className="m-0 max-w-[64ch] text-sm text-ink-dim">
        Un coup de main ? Les testeurs se retrouvent aussi sur le serveur Discord de l’alpha — c’est{' '}
        <strong>facultatif</strong>. {lien}
      </p>
    );
  }

  return (
    <p className="m-0 max-w-[66ch] text-[0.78rem] text-ink-dim">
      Les testeurs se retrouvent aussi sur le serveur Discord de l’alpha, pour se parler entre deux parties — c’est{' '}
      <strong>facultatif</strong>. {lien}
    </p>
  );
}
