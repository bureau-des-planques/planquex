-- La table `combats` disparaît — #738, D-183 (annule D-086 et D-105).
--
-- La trace des parties (graine, Decks, types de café, journal : 0002, élargie au PvP par 0012)
-- n'est plus collectée : le client ne l'envoie plus, « Revoir une partie » est retiré, et le
-- poste de pilotage (`tools/admin`) lit et remet à zéro **sans** la table. La numérotation du
-- ticket (0027) était périmée : 0027 à 0029 existent, la suppression prend le suivant (0030).
--
-- **Ordre de déploiement** (D-183 (6), #752) : le client qui n'envoie plus est publié par un tag
-- AVANT cette migration, sinon les PWA déjà installées échouent en silence sur l'envoi. Cette
-- migration est jouée en production par un geste humain, avec l'accord écrit du propriétaire :
-- elle est irréversible pour les lignes.
--
-- `drop table` emporte la table, ses lignes (c'est elle qui purge les traces déjà reçues), ses
-- index (`combats_auteur_created_at`), ses contraintes (`combats_mode_check`) et ses politiques
-- RLS. `compte_approuve()` reste : les politiques du mur, du Deck et des profils la citent encore.
-- `if exists` rend la migration idempotente : rejouée, elle ne fait rien.
--
-- **Retour arrière** : le schéma se recrée, les lignes ne reviennent pas. Rejouer, dans cet ordre,
-- la définition de `0002_combats.sql` (table, index, droits, RLS, politique de lecture), celle de
-- `0012_combats_pvp.sql` (`combats_mode_check` admet 'solo' et 'pvp') et la politique d'écriture
-- « combats : chacun dépose les siens » de `0005_comptes.sql`. On ne modifie jamais ces trois
-- fichiers (D-091) : le retour arrière est une **nouvelle** migration, jamais un rejeu du registre.

begin;

drop table if exists public.combats cascade;

commit;
