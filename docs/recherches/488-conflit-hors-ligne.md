# Recherche #488 — Stratégie de conflit hors ligne pour le Deck et la Collection

**Date** : 29/10/2026  
**Ticket** : #488 — Stratégie de synchro (dernier écrit gagne, fusion par carte, ou serveur autoritaire)  
**Périmètre** : Deck (20 cartes) et Collection (toutes les cartes possédées) — hors ligne d'abord, synchro différée

---

## Contexte observé dans le code

### Store local (source de vérité hors ligne)
- **Fichier** : `src/store/useStore.ts` (lignes 16-50, 270-307, 539-587)
- **Clé de persistance** : `bureau-des-planques-v1` (ligne 17)
- **Version courante** : `STORAGE_VERSION = 14` (ligne 50)
- **Champs persistés** (lignes 270-306) : `name`, `owned` (Collection), `deck` (Deck), `cafeTypes`, `packsOpened`, `reducedMotion`, `sons`, `combatDetaille`, `raccourcisCombat`, `rng`, `tutorielVu`, `pasAPasCombatVu`, `partie`, `derniere`, `difficulte`
- **Migration** : `migratePersisted()` (lignes 539-587) — seule source du numéro de version ; chaque modification de forme se migre
- **Export/Import** : `exporterSauvegarde()` / `importerSauvegarde()` (lignes 436-480) — format JSON versionné, nommage `bureau-des-planques`

### Pas de code de synchronisation existant
- **Observé** : Aucun module `sync`, `queue`, `offline` dans `src/` (grep négatif)
- **Observé** : Aucun Background Sync, Service Worker queue, ni file d'attente maison dans `public/` (glob négatif)
- **Observé** : `src/lib/supabase.ts` est **inerte sans configuration** (lignes 5-8, 176-191) — l'alpha fonctionne sans backend
- **Observé** : `src/store/combats.ts` envoie les traces **en silence**, n'interrompt jamais le jeu (lignes 11-14, 131-149)

### Schéma Supabase (cible de synchronisation future)
- **Migrations** : `supabase/migrations/` — 17 migrations, rejouées par PGlite dans les tests
- **Tables actuelles** : `postits`, `votes`, `commentaires`, `combats`, `comptes`, `profils`, `annonces_discord`
- **Pas de table** : `decks`, `user_cards` (Collection), `deck_cards` — prévues dans `PROPOSITION.md` §6.3 mais **non créées**

### Critères D-048 (beta) — critère 5
> **« Aucune perte de données possible pour un testeur »** (D-048, ligne 58 du DECISIONS.md)
- Ce critère **vaut après le reset de beta** (D-124), pas contre lui
- Le reset beta efface `combats`, `postits`, `votes`, `commentaires` — **pas** les comptes
- Collection et Deck **tombent d'eux-mêmes par migration de store** (ils vivent dans le navigateur, D-086)

### Vocabulaire (D-075, D-026)
- **Deck** = ancien « Chariot » (20 cartes)
- **Collection** = ancien « Parc » (toutes les cartes possédées avec quantités)
- Identifiants de code déjà en anglais : `deck`, `owned`, `Card` (union de `PlanqueCard` et `ActionCard` dans `src/data/types.ts`)

---

## Options analysées

### Option A — Dernier écrivain gagnant par horodatage serveur (Last-Writer-Wins, LWW)

**Principe** : Chaque écriture (Deck ou Collection) porte un `updated_at` serveur ; à la synchro, la version la plus récente écrase l'autre.

| Aspect | Analyse |
|--------|---------|
| **Coût** | Faible. Une colonne `updated_at timestamptz not null default now()` sur les tables cibles ; côté client, un champ `lastSyncedAt` dans le store. Pas de résolution de conflit : `MAX(updated_at)` gagne. |
| **Risque de perte de données** | **Élevé**. Si le testeur modifie son Deck sur téléphone (hors ligne) puis sur tablette (hors ligne), la seconde synchro écrase la première **sans fusion**. Perte garantie d'au moins une modification. |
| **Lien avec D-048 critère 5** | **Non respecté**. « Aucune perte de données possible » est violé dès deux appareils hors ligne. Le critère exige une stratégie qui **préserve** les deux intentions, pas qui en choisit une arbitrairement. |
| **Complexité implémentation** | Simple. Compatible avec l'architecture actuelle (store local + envoi ponctuel). |
| **Adéquation PWA offline-first** | Faible. LWW suppose une connexion fiable ; hors ligne, l'horodatage client n'est pas fiable (horloge déréglée, fuseau). |

### Option B — Fusion par identifiant de carte (Merge by Card ID)

**Principe** : La Collection est un ensemble de `(cardId, quantity)`. Le Deck est une liste ordonnée de `cardId` (max 20, max 2 par nom). À la synchro : fusion **par carte** — `quantity = max(local, remote)` pour la Collection ; pour le Deck, réunion des deux listes puis re-validation règles (20 cartes, 2 max, ≥1 Entrant).

| Aspect | Analyse |
|--------|---------|
| **Coût** | Modéré. Côté serveur : fonction SQL `merge_collection(uuid, jsonb)` et `merge_deck(uuid, jsonb)` avec logique de fusion. Côté client : file d'attente d'opérations (add/remove/set) avec `cardId` + timestamp local + version de base. |
| **Risque de perte de données** | **Faible pour la Collection** (quantités fusionnées par `max`). **Moyen pour le Deck** : deux ajouts concurrents valides peuvent produire un Deck illégal (21 cartes, 3 exemplaires) — nécessite re-validation + choix utilisateur ou heuristique (ex. garder les 20 premières). |
| **Lien avec D-048 critère 5** | **Respecté pour la Collection** (aucune carte perdue). **Partiellement respecté pour le Deck** : si re-validation échoue, il faut un arbitrage (utilisateur ou déterministe). Une heuristique documentée (ex. « garder les cartes les plus récentes par `added_at` local ») peut le rendre déterministe sans perte silencieuse. |
| **Complexité implémentation** | Moyenne. Nécessite : (1) tables `user_cards`, `decks`, `deck_cards` (PROPOSITION.md §6.3) ; (2) opérations idempotentes côté client ; (3) résolution de conflit Deck côté serveur ou client. |
| **Adéquation PWA offline-first** | Forte. Les opérations sont commutatives pour la Collection. Le Deck demande une sérialisation d'intentions (file d'opérations) plutôt qu'un état final. |

### Option C — Serveur autoritaire (toutes écritures passent par Supabase)

**Principe** : Pas d'écriture locale directe. Toute modification (addToDeck, removeFromDeck, openPack) appelle une Edge Function / RPC Supabase. Hors ligne = **lecture seule** (cache local). File d'attente locale d'intentions, rejouée à la reconnexion.

| Aspect | Analyse |
|--------|---------|
| **Coût** | **Élevé**. Change l'architecture : `useStore.ts` ne mute plus `owned`/`deck` directement ; chaque action → `supabase.rpc('add_card', ...)` ou Edge Function. Nécessite : authentification permanente, gestion file d'attente, retry, conflit de version (optimistic locking via `version` sur la ligne). |
| **Risque de perte de données** | **Nul** (source unique serveur). Mais **indisponibilité hors ligne** : le testeur ne peut **pas** ouvrir d'Arrivage, ni modifier son Deck, ni construire de stratégie sans réseau. |
| **Lien avec D-048 critère 5** | **Respecté techniquement** (pas de perte), **violé en pratique** : « aucune perte de données possible » inclut la **disponibilité** — un testeur dans le métro ne peut pas jouer. D-048 alpha/beta visent le **hors ligne** (PWA installable, D-090). |
| **Complexité implémentation** | Très élevée. Edge Functions pour chaque mutation, RLS par utilisateur, gestion des conflits de version, UI d'attente/réessai, tests d'intégration PGlite complets. |
| **Adéquation PWA offline-first** | **Nulle**. Contredit D-090 (« l'application marche hors ligne ») et D-048 (alpha testée hors ligne). |

### Option D — Hybride : Fusion par carte (Collection) + LWW avec journal d'intentions (Deck)

**Principe** : 
- **Collection** : fusion par `cardId` → `quantity = max(local, remote)` (commutatif, sans perte)
- **Deck** : journal d'opérations locales (`added:cardId`, `removed:cardId`, `reordered:index`) avec horodatage local + `baseVersion` (version du Deck au moment de l'édition). À la synchro : replay des opérations dans l'ordre chronologique sur la version serveur, re-validation règles à chaque étape. Si conflit (Deck illégal) → notification utilisateur + choix manuel (UI dédiée).

| Aspect | Analyse |
|--------|---------|
| **Coût** | Modéré-élevé. Collection : simple. Deck : file d'opérations (array persistant dans le store), replay côté serveur (RPC) ou client (download → merge → upload). |
| **Risque de perte de données** | **Très faible**. Collection : zéro perte. Deck : seule une réorganisation concurrente non commutative (ex. A ajoute carte X, B retire carte Y, les deux valides séparément mais ensemble >20) demande arbitrage. L'UI de résolution est **explicite**, pas silencieuse. |
| **Lien avec D-048 critère 5** | **Respecté**. Aucune perte silencieuse. Le testeur récupère ses cartes (Collection) et son Deck (avec résolution explicite si conflit rare). |
| **Complexité implémentation** | Modérée. Réutilise `migratePersisted` comme modèle (transformation d'état versionnée). File d'opérations ≈ `actionLog` de `BattleState` (déjà existant, `src/data/types.ts`). |
| **Adéquation PWA offline-first** | Forte. Écriture locale immédiate, synchro différée, résolution explicite seulement si nécessaire. |

---

## Recommandation argumentée

**Recommandation : Option D (Hybride)** — Fusion par carte pour la Collection + Journal d'intentions avec replay pour le Deck.

### Justification

1. **Respecte D-048 critère 5** : « aucune perte de données possible pour un testeur » — la Collection ne perd jamais de carte (`max` commutatif) ; le Deck n'a de conflit que sur réorganisation concurrente (rare), résolu **explicitement** par l'utilisateur, pas silencieusement.

2. **Compatible avec l'existant** : 
   - Le store utilise déjà `migratePersisted` pour transformer l'état versionné (ligne 539-587) — même patron pour le journal d'opérations Deck.
   - `actionLog` dans `BattleState` (déjà implémenté, `src/data/types.ts`) prouve le pattern « journal d'actions rejouables ».
   - Export/Import de sauvegarde (lignes 436-480) montre la sérialisation JSON versionnée attendue.

3. **Offline-first réel** : Le testeur ouvre des Arrivages, modifie son Deck, construit des stratégies **sans réseau**. La synchro se fait en arrière-plan à la reconnexion (comme `envoyerCombat` qui « avale le rejet », `src/store/combats.ts:159-166`).

4. **Coût maîtrisé** (estimation non mesurée) : 
   - Collection : fonction SQL `merge_collection` + 1 champ `lastSyncedAt` store.
   - Deck : file d'opérations dans le store (nouveau champ `deckOps: DeckOp[]`, mécanisme à construire), RPC `replay_deck_ops(uuid, jsonb, base_version)` côté serveur, UI de résolution conflits (rare).
   - Pas d'Edge Functions pour chaque mutation — le store reste source de vérité locale.

5. **Évolutivité** : Le journal d'opérations Deck sert aussi le **replay** (déjà requis pour PvP, D-008/D-105) et le **debug** (actionLog existant).

### Ce qu'il faut construire (pour T4)

1. **Tables Supabase** (migration) : `user_cards`, `decks`, `deck_cards` — avec `version integer not null default 1` pour optimistic locking.
2. **Store** : champ `deckOps: DeckOp[]` persisté (mécanisme à construire), `lastSyncedAt: number | null`, fonctions `enqueueDeckOp`, `flushDeckOps`.
3. **RPC Supabase** : `merge_collection(uuid, jsonb)`, `replay_deck_ops(uuid, jsonb, base_version)` retournant `{ success, deck, version, conflicts }`.
4. **UI** : Écran « Résolution conflit Deck » (rare) — liste des opérations en conflit, choix utilisateur.
5. **Tests** : Scénario « deux appareils hors ligne modifient Collection/Deck » — vérifie `max` Collection et replay Deck sans perte.

---

## Risques du Deck

Sans re-validation des règles de jeu, deux ajouts concurrents peuvent donner un Deck illégal (plus de 3 exemplaires, plus de 21 cartes) ; deux retraits peuvent le rendre sous la taille minimale ; la résolution de conflit demande une UI qui n'existe pas. Ce risque doit être traité avant la beta : sans elle, deux modifications simultanées peuvent produire un Deck invalide sans alerte.

---

## Hypothèses non vérifiées (marquées explicitement)

| Hypothèse | Pourquoi non vérifiée | Comment valider |
|-----------|----------------------|-----------------|
| Les tables `user_cards`/`decks` n'existent pas encore | Schéma Supabase actuel ne les contient pas (grep migrations) | Créer migration test, rejouer avec PGlite |
| Le replay d'opérations Deck est déterministe | Dépend de l'ordre des opérations + re-validation règles | Test propriété `fast-check` : même opérations → même Deck final |
| L'UI de résolution conflit est rare | Deux appareils modifiant le même Deck en même temps = cas marginal | Mesurer en beta : logger les conflits réels |
| `max(local, remote)` suffit pour Collection | Suppose pas de suppression intentionnelle concurrente | Ajouter `deleted_at` soft-delete si besoin (future) |

---

## Références décisions

- **D-048** : Critères alpha/beta — critère 5 « aucune perte de données possible »
- **D-075** : « Chariot » → « Deck », « Parc » → « Collection »
- **D-086** : Traces de combat — écriture silencieuse, jamais bloquante
- **D-090** : Application marche hors ligne (note de version embarquée)
- **D-124** : Reset beta épargne compte, efface progression (Collection/Deck via migration store)
- **D-148** : Profil testeur en colonne Supabase (pas dans store)
- **PROPOSITION.md §6.3** : Modèle de données cible (`user_cards`, `decks`, `deck_cards`)

---

## Fichiers cités

- `src/store/useStore.ts` — store principal, `migratePersisted`, export/import
- `src/store/combats.ts` — envoi silencieux, pattern « avaler le rejet »
- `src/store/partie.ts` — `actionLog`, `BattleState`, replay
- `src/lib/supabase.ts` — client inerte sans config, `ecrireLigne` (ligne 241)
- `supabase/migrations/` — schéma cible, RLS, PGlite tests
- `docs/DECISIONS.md` — D-048, D-075, D-086, D-090, D-124, D-148
- `docs/PROPOSITION.md` §6.3 — modèle de données serveur

---

## Trois conclusions

1. **Option D (hybride) est la seule qui respecte D-048 critère 5** tout en gardant l'offline-first réel : Collection = fusion commutative `max` (zéro perte) ; Deck = journal d'intentions replayé (perte uniquement sur réorganisation concurrente rare, résolue explicitement).

2. **Aucun code de synchronisation n'existe aujourd'hui** — le store est purement local (`bureau-des-planques-v1`, v14), Supabase ne porte que mur/combats/comptes/profils. La synchro Deck/Collection demande nouvelles tables + RPC + file d'opérations locale.

3. **Le pattern existe déjà dans le codebase** : `migratePersisted` (transformation versionnée), `actionLog` (journal rejouable), `envoyerCombat` (envoi silencieux non bloquant) — réutiliser ces patrons réduit le coût et le risque.
