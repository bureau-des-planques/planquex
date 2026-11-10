# Captures de la synchro — Réglages et Collection (#497)

**Ce que c'est** : les écrans Réglages (section Sauvegarde, #495, D-202) et Collection **après** la synchro, à 420 × 900 et 360 × 640. **L'« avant » n'existe plus** : la synchro (#491 à #493) est fusionnée, aucun build d'avant n'est servi. Les deux écrans sont donc photographiés tels qu'ils sont, pas comparés.

## Méthode

Un **faux compte**, aucun réseau réel (`capturer-synchro.mjs`, dans ce dossier) :

1. build à part avec une configuration factice : `VITE_SUPABASE_URL=https://exemple.test VITE_SUPABASE_ANON_KEY=sb_publishable_test npx vite build --outDir /tmp/dist-synchro --emptyOutDir` (le `dist/` du dépôt reste sans backend) ;
2. une session **approuvée** posée dans `localStorage` (`sb-exemple-auth-token`) — D-201 : sans elle, tout renvoie à `/attente` ;
3. toutes les requêtes vers `exemple.test` interceptées : `comptes` (approuvé), `collection` (40 cartes), `deck` (10 cartes), RPC ;
4. `/collection` : l'app relit la Collection au montage, la page affiche les 40 cartes du compte ; `/settings` : « Créer ma sauvegarde » relit le Deck et la Collection sur le compte et le message le dit.

**Contrôlé par le script** (il sort 1 sinon) : aucune erreur de console ni `pageerror`, aucun débordement horizontal sur `/settings`. Requêtes vues : `GET comptes`, `GET collection`, `GET deck`.

## Fichiers

`collection-apres-synchro-*`, `reglages-haut-*`, `reglages-sauvegarde-texte-*` (le texte qui dit ce que la sauvegarde restaure), `reglages-sauvegarde-geste-*` (la zone, les deux boutons et le message « viennent de ton compte »), pour `420x900` et `360x640`.

## Ce que ça ne prouve pas

Ni un appareil réel, ni un vrai projet Supabase (c'est le rôle de `npm run e2e`), ni la restauration (couverte par `src/store/sauvegarde.test.ts`). Les captures de Réglages montrent encore « Traces de combat » et « Revoir une partie », annulées par D-183 : c'est le lot `v2-c00`, pas ce ticket.
