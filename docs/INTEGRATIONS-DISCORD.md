# Le serveur des testeurs — le contrat produit

> **Ce document dit ce que le jeu promet et attend du serveur Discord des testeurs.** Il ne dit
> pas comment le serveur s'exploite : le runbook (création, salons, règles, webhooks, intégrations,
> invitation permanente, modération, rejeu) vit dans le dépôt d'exploitation **`planquex-infra`**
> (D-177 (3), qui amende D-120). Le message que reçoivent les testeurs est
> `docs/ALPHA-TESTEURS.md`. Décision d'origine : **D-120**.

## 1. Ce que le jeu attend

- **Une variable, une seule** : `VITE_DISCORD_INVITE`, une invitation **permanente** Discord. Vide
  (ou absente), le jeu n'affiche **rien** : aucun trou de mise en page. C'est l'état par défaut du
  build, et la CI construit sans elle.
- Le lien est rendu par **`src/components/InvitationTesteurs.tsx`**, **seul module** qui lit la
  variable. Une valeur posée est vérifiée : `http:`, `javascript:` ou un hôte qui n'est pas
  Discord font lever le module.
- **Aucune dépendance npm** n'est ajoutée, et il n'y a **rien à héberger** côté client.

## 2. Les trois emplacements du lien

Le même module rend les trois, pour que le `rel` et le libellé ne divergent pas :

| Emplacement | Où | Pourquoi |
|---|---|---|
| **Réglages** | `src/pages/Settings.tsx` | le lien se retrouve à un endroit stable |
| **Pied du comité** | `src/pages/Comite.tsx` | le mur est l'endroit où l'on cherche un coup de main |
| **Connexion** | `src/pages/Connexion.tsx` (D-159) | le seul secours qui serve à quelqu'un encore dehors |

Le lien s'ouvre dans un **nouvel onglet**, avec `rel="noreferrer noopener"`.
`src/components/InvitationTesteurs.test.tsx` couvre les trois.

## 3. Ce qui n'entre jamais dans le jeu

**Aucun `iframe`, aucun script, aucun widget Discord** : la page Confidentialité promet « aucun
traceur », et le test ci-dessus le vérifie. Un embed ou « Se connecter avec Discord » sont hors
périmètre.

## 4. Un serveur facultatif

Ne pas rejoindre le serveur reste normal : **le lien est facultatif**, le serveur peut ne pas
exister, et le jeu marche sans lui, comme il marche sans backend. Discord **ne remplace pas le
mur** : un testeur qui n'a pas Discord voit exactement la même chose dans `/comite` ; le salon est
un rappel, la page la source. Le salon ne répond pas non plus : le mur n'y écrit que des messages.

## 5. Les frontières de données (D-120 (2))

Le mur s'annonce dans le salon des testeurs, par la **base** (migrations `0013` et `0017`, détail
dans `supabase/README.md` §9) et non par le client. Liste **fermée** de ce qui sort : l'arrivée
d'un post-it (famille IP/OUF, titre, pseudo, lien vers `/comite`) et chaque changement de statut,
avec la raison d'un `écarté`.

Ne sortent **jamais** : le **texte d'un gueulage** (D-085 : on annonce qu'il est arrivé, pas ce
qu'il dit), ni **aucune donnée de compte** — ni auteur, ni courriel, ni identifiant ; le pseudo,
déjà public sur le mur, est la seule identité admise. Un titre qui contient une mention reste du
texte (`allowed_mentions.parse = []`). L'adresse d'envoi est un **secret** : elle ne vit ni dans le
dépôt, ni dans le client, ni dans une migration.

## 9. Contraintes de format des annonces

Ce numéro est cité par les migrations `0013` et `0017` et par `supabase/discord.test.ts` : il ne
bouge pas. Les anciennes sections d'exploitation (§2 à §8 et §10 de la procédure) sont dans
`planquex-infra`.

- **2 000 caractères** par message : une annonce doit tenir, sinon elle est refusée.
- **Cadence** d'un salon : de l'ordre de **30 messages par minute** ; au-delà, Discord répond
  `429` et peut abandonner des messages.
