# Deck et Collection : conception de la synchronisation (T1)

> **Proposition de conception, pas une décision globale de synchro.** Elle décrit l'état observé, chiffre trois options et recommande une piste à soumettre à Bastien. Elle ne modifie ni D-153 ni le schéma. L'arbitrage d'export du 02/11 rapporté pour #495 est noté plus bas, sans modifier `docs/DECISIONS.md`.
>
> **État des sources consultées : 02/11/2026.** Les estimations sont des ordres de grandeur, pas des mesures ni un engagement de délai.

## 1. État des lieux : ce qui existe

### Dans le navigateur

- `src/store/useStore.ts:16-50` définit la clé `bureau-des-planques-v1` et `STORAGE_VERSION = 14`. La forme courante est migrée par `migratePersisted` ; le numéro n'est défini qu'à cet endroit.
- `PersistedState` et `partializeState` (`useStore.ts:264-307`) enregistrent notamment `owned` (quantités par identifiant de carte), `deck` (liste ordonnée), `cafeTypes`, `packsOpened`, le générateur, les réglages et les sauvegardes de partie. Aucun champ de synchro, de version serveur ou de file d'opérations n'y figure.
- `openPack` ajoute les cinq cartes tirées à `owned` et incrémente `packsOpened` (`useStore.ts:341-353`, `src/game/pack.ts:19-20`). Les gestes Deck modifient directement `deck` et, selon le geste, `cafeTypes` (`useStore.ts:360-398`).
- La version 14 **ne promet pas une synchro** : son dernier palier ajoute `difficulte`, avec défaut `normal` (`useStore.ts:20-50, 535-552`). Elle promet la persistance locale de la forme et ses migrations, pas la reprise sur un autre appareil.
- **Trou v10 à fermer avant la synchro :** un navigateur qui porte encore l'ancienne Collection locale v10 la perd lors de la migration : `migratePersisted` remplace `owned` par `starterOwned()`, vide le Deck et les types de café, remet les Arrivages à zéro et efface `partie` (`useStore.ts:569-585`). Ce reset v10→v11 est intentionnel (D-130), mais il précède toute synchro ; si cette Collection n'a pas été exportée ou copiée avant la migration, aucune ligne distante ne la récupère et un upload ultérieur ne connaîtra que l'état vide/de départ. Il faut donc un transfert explicite avant cette purge, sans traiter l'état migré comme une suppression distante.
- L'export/import JSON actuel est lié au store : `SaveFile.version` reçoit `STORAGE_VERSION`, et l'export sérialise tout `partializeState`, dont `owned` et `deck` (`useStore.ts:264-319, 436-480`). Il n'est ni une file hors ligne, ni un transport de changements, ni un mécanisme de conflit.
- **Arbitrage Bastien communiqué pour #495 le 02/11 : étendre l'export/import.** Source : commentaire du ticket daté 02/11/2026, [issuecomment-6578168633](https://github.com/bureau-des-planques/planquex/issues/495#issuecomment-6578168633), vérifié avec `gh issue view 495 --json comments`. Après synchro, l'archive garde les données locales ; Deck et Collection sont lus depuis le compte, pas restaurés depuis un snapshot du navigateur. Cela impose un numéro d'archive distinct de `STORAGE_VERSION` et un import qui n'écrase pas les lignes serveur. La frontière des champs reste à préciser : le commentaire parle des 15 clés actuelles, dont `owned`/`deck`, alors que ces deux contenus sont lus dans la base après synchro.

### Dans Supabase

- La migration réelle `0020_deck_et_collection.sql:49-68` crée `public.collection` : une ligne par `(compte_id, carte_id)`, quantité entière ≥ 1. `:83-104` crée `public.deck` : une ligne par carte avec quantité et rang unique par compte.
- `updated_at` est posé côté serveur par déclencheur ; les droits n'autorisent pas le client à l'écrire (`0020:115-169`). Il indique un mouvement accepté par la base, pas l'ordre véritable d'intentions gardées hors ligne sur plusieurs appareils.
- Les deux tables sont réservées à `authenticated`, en lecture/écriture/suppression sur ses seules lignes par RLS (`0020:151-220`). Cette migration n'exige pas l'approbation du compte : un compte en attente peut jouer (D-088, `0020:21-23`).
- `0021_deck_legal.sql:56-79` ajoute au Deck `nom` et `stade`, fournis par le client. Le déclencheur différé `deck_gardes` (`:89-171`) refuse plus de 20 cartes, plus de deux exemplaires d'un même nom et un Deck complet sans Planqué Entrant. La base ne sait pas vérifier que `carte_id`, `nom` et `stade` décrivent réellement le catalogue (`:31-40`). Le rang est unique, mais les migrations ne définissent pas la stratégie de fusion ni l'ordre d'un journal.
- La migration 0020 annonce explicitement ce qui reste à construire : fusion de la Collection par `max` et replay du journal de Deck par RPC (`:31-33`). Ces deux migrations posent tables, droits et garde légale ; elles ne fournissent pas le transport client, la reprise hors ligne ou l'arbitrage multi-appareil.

### Décisions qui bornent la conception

- **D-153 (29/10/2026)** : Deck et Collection suivent le compte ; Collection fusionnée par `max` par carte, Deck rejoué depuis un journal d'intentions, conflit Deck résolu explicitement. D-153 (2) exige aussi d'ajouter ces tables au reset beta. **Ne pas attribuer cet ajout à D-150** : l'acte du 28/10 (`docs/DECISIONS.md:160`) ne nomme que `combats`, `postits`, `votes`, `commentaires` et les comptes existaient déjà ; les tables 0020/0021 sont postérieures. En revanche, le code actuel l'a étendu : `tools/admin/lib/reset.mjs:4-7, 24-32, 44-67` supprime aussi `collection` et `deck` dans la même instruction, et `tools/admin/reset.test.ts:180-205` le vérifie. C'est une extension ultérieure en code, pas une garantie portée par D-150 seul ; tout changement futur doit garder cette couverture et invalider les files offline anciennes. Source D-153 : `docs/DECISIONS.md`, ligne D-153.
- **D-048 (21/10/2026)** : la beta exige notamment « aucune perte de données possible pour un testeur » (critère 5), en plus du solo complet, du PvP jouable, de l'URL stable et de la décision sur les illustrations. Source : `docs/DECISIONS.md`, ligne D-048, amendée par D-064, D-063 et D-117.
- **D-156 (30/10/2026)** : l'entrée du jeu exige un compte ; une session anonyme ne suffit pas, un compte refusé ne joue pas, un compte en attente joue. Source : `docs/DECISIONS.md`, ligne D-156 ; l'accès Collection/Deck reste distinct de l'approbation selon D-088 et la migration 0020.

### Ce que le mur apporte — et n'apporte pas

- `src/lib/mur.ts:7-20` décrit un port/adapters et un secours de **lecture** : le mur
  peut retomber sur le fichier si la base ne répond pas, avec une notice.
- `AdaptateurMur` (`mur.ts:99-135`) sépare le contrat de la source ; `creerMur`
  (`:546-679`) traduit les erreurs en résultat français. Une écriture échouée rend
  un refus (`:584-600`, puis les autres gestes) ; le module ne contient ni journal
  persistant, ni file d'écritures, ni relance automatique, ni replay à reconnexion.
- Le patron réutilisable est donc l'adapter injectable et le résultat d'erreur
  explicite ; le mécanisme de secours lecture du mur n'est pas une synchro différée.
  Le bandeau (`src/components/BandeauHorsLigne.tsx:4-8`) ne lit que `navigator.onLine`
  et prévient lui-même que cela ne prouve pas que le serveur répond.

## 2. Trois stratégies de conflit, avec leurs coûts

### Hypothèses de chiffrage

- `A` = Arrivages ouverts pendant une partie ; chaque Arrivage ajoute cinq cartes.
  `C` = nombre d'identifiants distincts ajoutés sur ces Arrivages, donc `C ≤ 5A`.
- `D` = gestes Deck enregistrés pendant la partie. Un « geste » est une intention
  métier, pas nécessairement une ligne de table (un remplacement de Deck peut toucher
  jusqu'à 20 lignes).
- On compte séparément **allers-retours réseau** et **lignes modifiées/ajoutées**.
  Une reprise peut agréger un lot en un seul RPC ; une synchro immédiate peut envoyer
  un RPC par geste. Ce ne sont pas des mesures de production.
- Les coûts sont des **ordres de grandeur non mesurés au 02/11/2026**, estimés par
  découpage bottom-up en lots pour un développeur connaissant le dépôt : client/store,
  migration et RPC, tests PGlite à deux appareils, UI minimale. Ils excluent refonte
  des comptes, déploiement et imprévus ; aucune implémentation pilote ne les a validés.

| Option | Lots estimés (jours-personne) | Total indicatif |
|---|---|---:|
| LWW | Client/bootstrap (1–2), RPC de snapshot atomique (1–2), tests/refus (1) | 3–5 |
| Journal complet | Outbox durable/idempotence (2–3), journal serveur/RPC/ordre (3–5), résolution/compaction (2–4), tests/UI (3–4) | 10–16 |
| Hybride | Outbox/auth/bootstrap (1–2), merge Collection (1–2), replay Deck RPC (2–3), tests/UI (2–3) | 6–10 |
| Hybride avec compteurs par appareil | Lots supplémentaires : schéma/reprise des quantités (1–2), RPC idempotent (1–2), tests de synchro (2–3) | +4–7, soit 10–17 |
| Tombstones de suppression, en plus | Champ/révision et refus des hard-delete client (1–2), règles merge/réacquisition et tests (1–2) | +2–4 |

### A. Dernière écriture gagnante (LWW)

**Règle.** Un appareil envoie son état Collection+Deck ; le serveur garde le snapshot reçu comme le plus récent. Il faut définir « récent » par révision serveur/transaction, pas comparer des horloges locales. Un `updated_at` par ligne ne suffit pas à choisir atomiquement entre deux snapshots complets.

- **Téléphone + PC.** Si les deux sont hors ligne et changent le même état, le snapshot envoyé en dernier remplace l'autre : le testeur voit une version gagner et les ajouts ou changements de Deck du second disparaître, sans résolution métier.
- **Panne au mauvais moment.** Avant l'accusé, le changement n'existe que dans le stockage du navigateur et peut disparaître avec le site/appareil. Un appareil ancien peut aussi écraser un état serveur plus récent à sa reconnexion tardive, sauf verrou de révision.
- **Écritures par partie.** Avec `A + D` changements et envoi immédiat : jusqu'à `A + D` appels, chacun remplaçant/retouchant au plus `C + 20` lignes (`(A + D) × (C + 20)` au pire). En différé : un appel, jusqu'à `C + 20` lignes ; une transaction réduit les appels, pas les conflits.
- **Coût estimé : 3–5 jours-personne (ordre de grandeur non mesuré au 02/11/2026).** Le chemin client/SQL est le plus court, mais bootstrap, révision atomique, contrôle Deck et tests de deux appareils restent à faire. Cette option contredit D-048 et D-153 ; le faible coût ne la rend pas recommandable.

### B. Journal d'intentions pour toutes les opérations

**Règle.** Chaque acquisition/modification devient une opération identifiée de façon
unique dans une outbox client persistante ; le serveur reçoit le lot, garde au moins
les identifiants/ordre nécessaires à l'idempotence, puis le rejoue et matérialise le
résultat dans une transaction RPC. Le journal doit distinguer ajout, retrait,
changement de quantité et intentions Deck. Un historique serveur permanent n'est pas
imposé ici : il peut être compacté après accusé, mais le serveur doit bien arbitrer et
appliquer le replay, pas seulement renvoyer un snapshot au client.

- **Téléphone + PC.** Les appareils jouent hors réseau ; à la reconnexion, le serveur rejoue leurs opérations et synchronise le résultat. Les retries doivent être idempotents ; retraits, remplacement/vidage et ordres incompatibles exigent une règle ou un conflit explicite.
- **Panne au mauvais moment.** L'outbox ne survit que si elle est durable avant l'UI et conservée jusqu'à l'accusé. Un timeout après commit exige une clé idempotente ; sinon une acquisition peut être doublée. Effacer le navigateur avant réplication reste une perte possible.
- **Écritures par partie.** Si chaque carte est une intention : jusqu'à `5A + D` lignes de journal (5A acquisitions, D gestes Deck), envoyées dans un RPC si groupées, puis jusqu'à `C + 20` lignes d'état. Regrouper les mêmes identifiants dans un Arrivage réduit les lignes, sans retirer l'idempotence.
- **Coût estimé : 10–16 jours-personne (ordre de grandeur non mesuré au 02/11/2026).** C'est l'option la plus générale : format/rétention du journal, identité des opérations/appareils, replay serveur, compaction, reprises ambiguës, ordre/conflits Collection+Deck, migrations et UI. Elle s'écarte du choix hybride déjà posé par D-153.

### C. Hybride : `max` Collection + journal d'intentions Deck

**Règle.** Conforme à D-153 : fusionner la Collection par `max` ; garder les intentions Deck dans une outbox locale durable, puis les rejouer sur le Deck serveur par RPC transactionnelle. La RPC persiste le résultat et une clé d'idempotence/receipt au moins jusqu'à l'accusé client : le journal ne peut être exclusivement local. C'est le sens proposé par `0020_deck_et_collection.sql:31-33`. La garde `0021` refuse le Deck final illégal ; tout conflit est explicite.

- **Téléphone + PC.** `max` unit les quantités ; les intentions reconstruisent les Decks. Si le résultat enfreint taille, exemplaires ou Entrant, avertir le testeur et préserver le journal ; l'ordre des gestes incompatibles reste à décider.
- **Panne au mauvais moment.** Un gain Collection reste local jusqu'au RPC réussi. L'outbox doit survivre au rechargement, et un journal Deck non acquitté rester rejouable/idempotent ; perdre le stockage avant upload perd l'unique copie.
- **Écritures par partie.** Un lot différé utilise un RPC Collection et un RPC Deck (ou un seul combiné) : jusqu'à `C` lignes fusionnées, `D` intentions et 20 lignes Deck matérialisées. En immédiat, au plus une ligne Collection par identifiant touché et une intention par geste ; le déclencheur différé 0021 vérifie l'état final au commit.
- **Coût estimé : 6–10 jours-personne (ordre de grandeur non mesuré au 02/11/2026)** : RPC de merge/replay, intégration compte, migration/version du store, outbox durable, idempotence, tests PGlite à deux appareils et UI minimale de conflit. Le refus de `max` ajoute 4–7 jours (compteurs) ; voir les tombstones de suppression séparément.

### Pertes chiffrées et suppression sous `max` : décision requise

Pour une carte `i`, si téléphone et PC partent du même compte/quantité `q_i` et tirent
respectivement `a_i` et `b_i` exemplaires hors ligne, l'état correct après les deux
parties vaut `q_i + a_i + b_i`. Fusionner seulement les snapshots par `max` donne
`q_i + max(a_i,b_i)` : il manque donc `min(a_i,b_i)` exemplaires. Sur une partie à
deux appareils, la perte totale est `L = Σ_i min(a_i,b_i)`, pour les acquisitions
concurrentes comparées au même état de base. Le résultat exact dépend des cartes tirées
et du nombre d'Arrivages sur chaque appareil ; ces distributions n'ont pas été mesurées.

Scénarios concrets, avec 300 identifiants comme dénominateur proxy (ordre de grandeur
indiqué par #493, pas 300 exemplaires garantis dans chaque Collection) :

| Scénario | État attendu | Résultat de `max` | Perte |
|---|---|---|---|
| Même carte P : départ `q=1`, téléphone gagne 1 et PC gagne 1 | P=3 | `max(2,2)=2` | **1 exemplaire** manquant ; 1/300 = **0,33 %** d'une Collection de référence à un exemplaire par identifiant. L'identifiant P reste possédé : c'est sa quantité qui est fausse. |
| Cartes différentes P et Q : même départ, téléphone gagne P, PC gagne Q | P=1, Q=1 | `max(P:1,0)` et `max(Q:0,1)` | **0 exemplaire**, 0/300 = **0 %** : le `max` par clé conserve les deux ajouts disjoints. |
| Une seule acquisition de P : départ `q=1`, téléphone gagne 1, PC n'en gagne aucune | P=2 | `max(2,1)=2` | **0 exemplaire**, 0/300 = **0 %** : pas de concurrence d'incréments. |

Pour une paire de parties avec un Arrivage chacune, la borne très lâche par taille est
`L ≤ 5` exemplaires (≤ **1,67 %** de 300 unités); avec la composition réelle de
`src/game/pack.ts:19-42`, un même identifiant appartient à une seule classe de tirage
et ne peut apparaître que dans les trois cases communes : la borne de recouvrement
est donc **3 exemplaires** (≤ **1 %** de 300) pour un Arrivage par appareil. Pour `A_t`
et `A_p` Arrivages hors ligne, cette borne devient `3 × min(A_t,A_p)` dans ce modèle
de départ commun. Cela compte des exemplaires manquants, pas des identifiants distincts
perdus ; le pourcentage d'identifiants dont la quantité est fausse dépend du recouvrement.

Un départ déjà désynchronisé peut faire pire que ce modèle : téléphone part de 2,
acquiert P (snapshot local=3), tandis que le compte est déjà à 5 ; `max(3,5)=5`, alors
que le résultat additif serait 6 : **l'unique gain local est perdu**. Donc la question
explicite avant #491 est : **le `max` scalaire de D-153 est-il accepté pour la Collection,
ou faut-il des additions idempotentes/compteurs par appareil avant de fusionner ?**
Si `max` est refusé, le complément estimé est **4–7 jours-personne** pour des compteurs
par appareil et la reprise des quantités existantes : total hybride **10–17 jours-personne**
(décomposition §2). Ces coûts restent des ordres de grandeur non mesurés.

#### Suppression concurrente

La migration 0020 autorise explicitement `DELETE` sur `collection` (`:163-165`) et
RLS autorise le propriétaire à retirer ses lignes (`:196-199`). Si le téléphone supprime
P pendant que le PC hors ligne conserve `P=1`, l'absence côté serveur lue comme zéro
donne `max(1,0)=1` au replay : la ligne P est **recréée**, donc la suppression est annulée
silencieusement. Les deux faits (gain concurrent perdu, suppression ressuscitée)
interdisent d'appeler le `max` seul « sans perte » au sens de D-048.

Deux pistes à trancher, sans choisir ici : (a) tombstone (`deleted_at` avec révision
serveur/ordre, règle explicite de réacquisition et retrait du hard-delete côté client),
estimé **+2–4 jours-personne** ; ou (b) intention de suppression dans le journal
Collection, idempotente et ordonnée avec les acquisitions, dans la stratégie journal
complet (10–16 jours-personne). Un `deleted_at` sans révision ni règle de réacquisition
ne suffit pas : une acquisition ultérieure valide doit pouvoir relever la suppression,
un snapshot ancien ne doit pas la faire revivre. Ces coûts sont aussi non mesurés.

## 3. Questions à classer avant l'implémentation

### À trancher avant d'implémenter #491

1. **Durabilité (#491).** Le ticket exige Deck retrouvé après rechargement puis synchronisé au retour réseau : la file doit donc être persistante. Choisir IndexedDB ou autre stockage durable, et décider si la promesse couvre aussi fermeture/redémarrage de la PWA.
2. **Retour du réseau et accusé.** Au signal `online`, drainer vers la RPC serveur, garder les opérations jusqu'à accusé idempotent, puis relire/réconcilier le Deck. En cas de refus/session expirée, garder la file et rendre l'erreur visible ; fixer tentatives/backoff et l'UI de conflit.
3. **Même Planqué, Deck et Collection.** Pour Deck : ajout/retrait ou modification concurrente du même identifiant. Pour Collection : gains du même identifiant à cumuler, et suppression sur un appareil pendant que l'autre conserve la ligne. Décider l'ordre/annulation/arbitrage ; le `max` scalaire comme le journal sans sémantique perdent ou annulent silencieusement une intention (voir §2).
4. **Ordre et lieu du journal Deck.** Le Deck est ordonné (`rang` unique par compte) : l'ordre est-il global par compte/serveur, par appareil, ou seulement par carte ? Proposition §2 : outbox durable côté client **et** identifiants/ordre/replay transactionnel côté serveur ; un ordre par carte seul ne définit pas le rang du Deck. Choisir aussi la durée de conservation/compaction après accusé.
5. **Acceptabilité de `max` Collection.** Question bloquante avant le premier changement de synchro : **le `max` scalaire est-il accepté malgré `L=Σmin(a_i,b_i)` et la résurrection des suppressions, ou faut-il des additions idempotentes/compteurs par appareil et des tombstones/journal de suppressions ?** Si Bastien accepte `max`, il faut expliciter les pertes acceptées ; si non, retenir l'option compteurs ou journal et le coût §2. La mesure de charge plus large reste à réaliser pour #493.
6. **Initialisation (#492) et migration v10.** Au premier login, comment départager le Deck local et celui déjà porté par le compte ? Le marqueur d'import doit être serveur et atomique pour qu'un second login n'importe rien ; le transfert doit précéder la purge v10, qui peut détruire la seule Collection locale.
7. **Périmètre et reset.** `cafeTypes` est un attribut du Deck (`useStore.ts:138-160`) : le synchroniser dans le même journal ? La file ancienne doit aussi être invalidée par le reset (D-150 étendu en code, voir §1), sinon elle peut recréer des données effacées.

### Peuvent attendre #491 (mais avant leur ticket d'exécution)

- **Mesure et réalisation Collection (#493).** La décision de principe `max`/compteurs/suppression doit être prise avant #491 ; la mesure réelle de poids et d'écritures, le dimensionnement du batch et les captures Collection peuvent attendre la réalisation de #493.
- **Archive (#495).** Bastien a tranché l'extension ; l'allowlist précise des champs, la migration des anciennes archives et le test aller-retour peuvent être finalisés dans #495 avant modification de Réglages.
- **Captures détaillées (#497).** Le protocole est posé en fin de document ; les captures et leur inspection attendent que les parcours fonctionnent.

## 4. Recommandation (à confirmer, non tranchée)

Recommander de garder l'architecture **hybride de D-153** comme point de départ, plutôt
que LWW : elle conserve le jeu hors ligne, le journal Deck permet le replay serveur,
et `max` traite simplement les snapshots Collection non concurrents. Cette piste ne
peut toutefois pas être présentée comme conforme à D-048 tant que Bastien n'a pas
tranché les ajouts **et suppressions** concurrents : conserver `max` avec pertes
explicitement acceptées, le remplacer par des compteurs/tombstones, ou choisir le
journal complet. C'est une recommandation de conception, pas un arbitrage ; D-153 reste
la décision existante et ne suffit pas à définir ces cas.

**Coûts assumés :** 6–10 jours-personne pour l'hybride max (estimation bottom-up, non
mesurée au 02/11/2026) ; si les incréments passent à des compteurs par appareil, 10–17
au total ; avec en plus des tombstones de suppression, 12–21. Le choix entre ces
contrats, l'initialisation #492 et les conflits de même Planqué conditionne les RPC.
La garde de 0021 est un filet de légalité, pas un résolveur de conflit.

## 5. Ce qui n'a pas été vérifié

- Aucun test n'a simulé deux appareils concurrents, une déconnexion au milieu d'un
  Arrivage, un rechargement avec changements en attente, ni une reconnexion tardive.
- Les migrations 0020/0021 et les contrats qu'elles déclarent ont été lus ; aucune
  instance Supabase distante n'a été interrogée, et aucun état de production n'a été
  inspecté. Les appels à un serveur d'action sont hors du périmètre de cette conception.
- Les coûts sont des estimations par lots décrites en §2, non mesurées par implémentation ; les volumes sont des formules/bornes, pas des traces d'usage. Aucune partie type ni distribution de tirages concurrentes n'a été mesurée.
- Les corps des tickets #491, #492, #493, #495 et #497 ont été lus via `gh issue view <numéro> --json number,title,body`. Le commentaire de décision de #495 a aussi été lu par `gh issue view 495 --json comments` (lien cité ci-dessous) ; les commentaires des autres tickets n'ont pas été consultés.
- `docs/recherches/488-conflit-hors-ligne.md:82-126` recommande déjà l'hybride D et décrit un journal Deck rejoué par RPC ou client ; son tableau d'hypothèses (`:136-143`) marque explicitement l'absence de suppression intentionnelle concurrente comme **non vérifiée** (`:143`). C'est une recherche antérieure, pas une décision supplémentaire ; D-153 adopte l'hybride, mais la conclusion « zéro perte Collection » de la recherche ne couvre ni les incréments concurrents quantifiés ici ni cette suppression.
- Aucun test d'intégration PGlite de synchro, essai visuel ou parcours réel à deux appareils n'a été ajouté : ce livrable ne contient que la conception. Les estimations ne remplacent pas les mesures demandées par #493.

## 6. Ce que ce document répond, ticket par ticket

- **#491 — Synchro du Deck.** Le ticket demande une écriture en base, une file hors ligne renvoyée au réseau, survie au rechargement, conflit sans écrasement silencieux et preuve sur un second appareil. Piste : journal Deck de D-153 ; oui, les intentions doivent survivre au rechargement dans un stockage durable, rester jusqu'à l'accusé idempotent, puis être envoyées/réconciliées au retour du réseau. La technologie de stockage, ordre et UI de conflit restent à trancher avant code.
- **#492 — Migration du store.** Le ticket demande de migrer depuis la forme v14, d'importer le Deck local une seule fois et de faire échouer le test si l'import est rejoué. Au premier login, l'import doit être atomique/idempotent avec un marqueur conservé côté compte ; un second login constate ce marqueur et ne rejoue rien. Si le compte porte déjà un Deck, l'arbitrage est ouvert ; la migration v10 (voir §1) est un cas antérieur qui peut détruire la seule copie locale avant cet import.
- **#493 — Synchro de la Collection.** Le ticket demande le même niveau hors ligne, une mesure du poids et du nombre d'écritures (≈300 cartes possibles selon le ticket) et des captures avant/après. Garder `max` scalaire tel quel perd au moins un des deux gains concurrents quand les appareils partent du même compte ; pour ne rien perdre, il faut des additions identifiées/idempotentes ou des compteurs par appareil agrégés, pas seulement `max`. Les formules de §2 sont des bornes, pas la mesure exigée par le ticket.
- **#495 — Export/import.** Le ticket demande de décider si l'export/import est supprimé, gardé en secours ou étendu ; Bastien a tranché « étendre » dans le commentaire du 02/11/2026 : [`issuecomment-6578168633`](https://github.com/bureau-des-planques/planquex/issues/495#issuecomment-6578168633), lu par `gh issue view 495 --json comments`. Comme le code sérialise `PersistedState` sous la version du store, séparer version d'archive et `STORAGE_VERSION`, garder les champs locaux, et restaurer Deck/Collection depuis le compte par opérations (jamais par `set(migre)`). La liste actuelle de 15 champs inclut aussi `owned`/`deck`/`cafeTypes` : l'archive devra donc définir explicitement leur compatibilité/hors-périmètre au lieu de les appliquer comme snapshots cloud. Tester l'aller-retour réglages sans écraser Deck/Collection du compte et réviser le texte de Réglages (`Settings.tsx:310-314, 96-101`).
- **#497 — Captures de la synchro.** Le ticket demande `Settings` et `Collection` avant/après, au minimum aux gabarits 420×900 et 360×640, `npm run capturer` sans erreur console, puis inspection à taille téléphone. Quand la synchro existera, la preuve doit montrer deux contextes/appareils : état local avant envoi (source hors ligne), puis même compte relu après reconnexion sur l'autre appareil ; capturer les écrans demandés aux deux étapes. Ce parcours n'est pas encore capturable aujourd'hui.
