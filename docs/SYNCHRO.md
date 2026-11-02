# Deck et Collection : conception de la synchronisation (T1)

> **Proposition de conception, pas une décision.** Ce document décrit l'état observé, chiffre trois options et recommande une piste à soumettre à Bastien. Il ne modifie ni D-153 ni le schéma. La décision datée reste à écrire par Bastien.
>
> **État des sources consultées : 02/11/2026.** Les estimations sont des ordres de grandeur, pas des mesures ni un engagement de délai.

## 1. État des lieux : ce qui existe

### Dans le navigateur

- `src/store/useStore.ts:16-50` définit la clé `bureau-des-planques-v1` et `STORAGE_VERSION = 14`. La forme courante est migrée par `migratePersisted` ; le numéro n'est défini qu'à cet endroit.
- `PersistedState` et `partializeState` (`useStore.ts:264-307`) enregistrent notamment `owned` (quantités par identifiant de carte), `deck` (liste ordonnée), `cafeTypes`, `packsOpened`, le générateur, les réglages et les sauvegardes de partie. Aucun champ de synchro, de version serveur ou de file d'opérations n'y figure.
- `openPack` ajoute les cinq cartes tirées à `owned` et incrémente `packsOpened` (`useStore.ts:341-353`, `src/game/pack.ts:19-20`). Les gestes Deck modifient directement `deck` et, selon le geste, `cafeTypes` (`useStore.ts:360-398`).
- La version 14 **ne promet pas une synchro** : son dernier palier ajoute `difficulte`, avec défaut `normal` (`useStore.ts:20-50, 535-552`). Elle promet la persistance locale de la forme et ses migrations, pas la reprise sur un autre appareil.
- Le cas historique est important : un état dont la version source vaut exactement 10 reçoit volontairement `starterOwned()`, `deck: []`, `cafeTypes: []`, zéro Arrivage et `partie: null` (`useStore.ts:569-585`). La remise à zéro v10→v11 est intentionnelle (D-130) ; une future restauration cloud ne doit pas prendre cette forme vide pour une demande de suppression de la sauvegarde du compte.
- L'export/import JSON versionné est un outil manuel (`useStore.ts:436-480`), pas une
  file hors ligne, un transport de changements, ni un mécanisme de conflit.

### Dans Supabase

- La migration réelle `0020_deck_et_collection.sql:49-68` crée `public.collection` : une ligne par `(compte_id, carte_id)`, quantité entière ≥ 1. `:83-104` crée `public.deck` : une ligne par carte avec quantité et rang unique par compte.
- `updated_at` est posé côté serveur par déclencheur ; les droits n'autorisent pas le client à l'écrire (`0020:115-169`). Il indique un mouvement accepté par la base, pas l'ordre véritable d'intentions gardées hors ligne sur plusieurs appareils.
- Les deux tables sont réservées à `authenticated`, en lecture/écriture/suppression sur ses seules lignes par RLS (`0020:151-220`). Cette migration n'exige pas l'approbation du compte : un compte en attente peut jouer (D-088, `0020:21-23`).
- `0021_deck_legal.sql:56-79` ajoute au Deck `nom` et `stade`, fournis par le client. Le déclencheur différé `deck_gardes` (`:89-171`) refuse plus de 20 cartes, plus de deux exemplaires d'un même nom et un Deck complet sans Planqué Entrant. La base ne sait pas vérifier que `carte_id`, `nom` et `stade` décrivent réellement le catalogue (`:31-40`). Le rang est unique, mais les migrations ne définissent pas la stratégie de fusion ni l'ordre d'un journal.
- La migration 0020 annonce explicitement ce qui reste à construire : fusion de la Collection par `max` et replay du journal de Deck par RPC (`:31-33`). Ces deux migrations posent tables, droits et garde légale ; elles ne fournissent pas le transport client, la reprise hors ligne ou l'arbitrage multi-appareil.

### Décisions qui bornent la conception

- **D-153 (29/10/2026)** : le Deck et la Collection doivent suivre le compte pour la beta ; Collection fusionnée par `max` par carte, Deck rejoué depuis un journal d'intentions, conflit Deck résolu explicitement, jamais en silence. Le reset beta efface aussi ces données (avec le geste D-150). Source : `docs/DECISIONS.md`, ligne D-153 ; index `docs/DECISIONS-INDEX.md`, entrée D-153.
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
- Les coûts en jours-personne incluent le minimum de client, SQL/RPC, tests PGlite et
  UI d'état ; ils excluent les refontes de comptes et de déploiement.

### A. Dernière écriture gagnante (LWW)

**Règle.** Un appareil envoie son état Collection+Deck ; le serveur garde le snapshot
reçu comme le plus récent. Il faut définir « récent » par révision serveur/transaction,
pas comparer des horloges locales. Un `updated_at` par ligne ne suffit pas à choisir
atomiquement entre deux snapshots complets.

- **Téléphone + PC.** Si les deux sont hors ligne et changent le même état, le snapshot
  envoyé en dernier remplace l'autre. Le testeur voit une version gagner et des ajouts
  ou changements de Deck de l'autre appareil disparaître, sans résolution métier.
- **Panne au mauvais moment.** Tant que le snapshot n'a pas été acquitté, le changement
  local n'existe qu'en stockage du navigateur ; panne, effacement de site ou perte de
  l'appareil peuvent le faire perdre. Si l'appareil ancien resynchronise tard, il peut
  aussi écraser un état serveur plus récent en temps réel, sauf verrou de révision.
- **Écritures par partie.** Avec `A + D` changements locaux et envoi immédiat : jusqu'à
  `A + D` appels. Avec un état complet par appel : jusqu'à `(A + D) × (C + 20)` lignes
  remplacées/retouchées au pire ; en différé, un appel et jusqu'à `C + 20` lignes.
  Une transaction de remplacement peut réduire les appels, pas le risque de conflit.
- **Coût estimé : 3–5 jours-personne.** Le chemin client/SQL est le plus court, mais
  bootstrap, révision atomique, contrôle Deck et tests de deux appareils restent à faire.
  Cette option contredit l'exigence de conservation de D-048 et l'approche de D-153 ;
  le faible coût n'en fait pas une option recommandable.

### B. Journal d'intentions pour toutes les opérations

**Règle.** Chaque acquisition/modification devient une opération identifiée de façon
unique, persistée localement, acquittée par le serveur puis rejouée une seule fois.
Le journal doit distinguer ajout, retrait, changement de quantité et intentions Deck.

- **Téléphone + PC.** Les appareils peuvent travailler sans réseau ; à la reconnexion,
  leurs opérations sont rejouées et leurs effets sont visibles sur les deux. Une
  opération répétée après un timeout doit être idempotente. Des opérations incompatibles
  (retraits, remplacement/vidage, même carte ou ordre) exigent encore un ordre stable ou
  un conflit explicite : le journal seul ne tranche pas la sémantique.
- **Panne au mauvais moment.** Une opération déjà mise en file survit seulement si le
  journal est écrit durablement avant de mettre l'UI à jour et reste conservé jusqu'à
  l'acquittement. Une panne réseau après commit mais avant réponse exige un identifiant
  idempotent ; sinon le replay peut doubler une acquisition. Effacement du navigateur
  avant réplication reste une perte possible.
- **Écritures par partie.** Si chaque carte tirée est une intention : au plus `5A`
  opérations Collection, plus `D` opérations Deck, soit `5A + D` lignes de journal
  insérées ; un lot peut tenir dans un RPC, suivi de jusqu'à `C + 20` lignes d'état
  matérialisé. Agréger les cinq tirages par identifiant réduit le premier terme à au
  plus `5A`, souvent moins, sans supprimer le besoin d'idempotence.
- **Coût estimé : 10–16 jours-personne.** C'est l'option la plus générale : format et
  rétention de journal, identité des opérations/appareils, replay serveur, compaction,
  reprise après acquittement ambigu, ordre/conflits pour Collection et Deck, migrations
  et UI. Elle s'écarte du choix hybride déjà posé par D-153.

### C. Hybride : `max` Collection + journal d'intentions Deck

**Règle.** Conforme à D-153 : envoyer les quantités de Collection et les fusionner par
`max` par carte ; enregistrer les gestes Deck, les rejouer sur la version serveur et
refuser toute sortie illégale par la garde existante. Un conflit de Deck ne se résout
pas silencieusement.

- **Téléphone + PC.** Les quantités serveur/locales sont réunies par maximum ; les deux
  Decks sont reconstruits depuis leurs intentions. Si le résultat enfreint taille,
  exemplaires ou Entrant, le testeur doit être averti et garder un choix possible, sans
  sacrifier l'autre journal. L'ordre et la résolution de deux gestes incompatibles ne
  sont pas encore définis.
- **Panne au mauvais moment.** Collection : une valeur encore locale n'est pas sur le
  compte tant que le RPC n'a pas réussi ; la file locale doit survivre à la panne et au
  rechargement si l'on promet une vraie reprise. Deck : un journal non acquitté doit
  rester rejouable et idempotent. Une perte du stockage navigateur avant upload peut
  toujours faire perdre l'unique copie.
- **Écritures par partie.** Pour `A` Arrivages et `D` gestes Deck : un lot différé peut
  se traiter en un RPC Collection et un RPC Deck (ou un RPC combiné), avec au plus `C`
  lignes Collection fusionnées, `D` entrées de journal et jusqu'à 20 lignes Deck
  matérialisées. En immédiat, la Collection change au plus une ligne par identifiant
  touché ; le Deck ajoute une intention par geste. Les déclencheurs différés de 0021
  se déclenchent pour les lignes Deck modifiées et vérifient le Deck final au commit.
- **Coût estimé : 6–10 jours-personne**, hors clarification ci-dessous : RPC de merge et
  replay, intégration à la porte de compte, migration/version du store, file durable,
  idempotence, tests PGlite à deux appareils et résolution Deck minimale. Le blocage
  Collection peut ajouter du travail si `max` doit préserver des ajouts concurrents.

### Limite de `max` à résoudre avant de promettre « aucune perte »

`max` est commutatif et idempotent pour deux **snapshots comparables**, mais ne cumule
pas deux acquisitions concurrentes. Exemple : les deux appareils partent de quantité
1 ; chacun gagne une carte hors ligne et arrive à 2 ; `max(2, 2)` donne 2, alors que
trois exemplaires ont été acquis au total. Autre cas : un appareil hors ligne part de
2, acquiert une carte (3), tandis que le serveur est déjà à 5 ; `max(3, 5)` reste 5.

La table 0020 porte une quantité scalaire, pas un compteur par appareil ni un journal
d'acquisitions. La promesse « `max` par carte, sans perte » de D-153 ne démontre donc
pas à elle seule la conservation des Arrivages concurrentes. Il faut demander si
« Collection fusionnée par max » signifie vraiment fusion de snapshots, ou si la
quantité doit être alimentée par des événements/additions idempotents avant agrégation.
Cette précision est une question de conception, pas un changement tacite de D-153.

## 3. Questions à trancher explicitement

1. **Durabilité de la file.** Les intentions hors ligne doivent-elles survivre à un
   simple rechargement ? À une fermeture/redémarrage de PWA ? À l'effacement du stockage
   local ? `localStorage`, IndexedDB ou un journal exportable ? Une file en mémoire ne
   couvre qu'une coupure réseau sans rechargement et ne satisfait pas la reprise après
   fermeture.
2. **Même Planqué sur deux appareils.** Que signifie deux ajouts concurrents du même
   identifiant, deux retraits, ou un ajout face à un retrait ? Les opérations sont-elles
   fusionnées, annulées par ordre, ou montrées au testeur ? La quantité et le Deck ne
   peuvent pas être traités comme la même donnée.
3. **Ordre des intentions Deck.** L'ordre est-il global par compte (séquence serveur),
   par appareil avec arbitrage, ou par carte ? Une collection d'intentions par carte
   ne suffit pas pour définir le `rang` global unique exigé par `public.deck`.
4. **Deck local face au Deck du compte (#492).** Au premier chargement, le compte a
   déjà un Deck et le navigateur en a un autre : garder le compte, garder le local,
   fusionner via intentions, ou demander un choix ? Le client ne doit pas remplacer
   silencieusement l'un par l'autre. Le même arbitrage existe pour une Collection
   locale non encore envoyée.
5. **Migration v10.** Si la migration locale v10 vide volontairement `owned` et
   `deck`, le serveur est-il chargé avant cette migration, après, ou dans un parcours
   de restauration séparé ? L'état vide migré ne doit pas devenir un snapshot LWW ni
   être interprété comme une collection supprimée.
6. **Sémantique Collection.** Comment la fusion `max` respecte-t-elle deux gains
   concurrents et un appareil en retard ? Faut-il versionner l'époque de progression,
   garder des incréments idempotents, ou accepter que `max` ne cumule pas les gains
   concurrents ? La réponse doit être compatible avec le critère 5 de D-048.
7. **Résolution Deck.** À partir de quelle erreur demande-t-on une intervention
   (conflit d'ordre, 21e carte, 3e exemplaire, absence d'Entrant) ? Le testeur choisit-il
   parmi les deux Decks, édite le résultat, ou conserve deux variantes ? Combien de
   temps garde-t-on les intentions non résolues ?
8. **Périmètre synchronisé.** D-153 vise `owned`/Collection et Deck. `cafeTypes` est
   pourtant un attribut du contenu du Deck dans le store (`useStore.ts:138-160`) : suit-il
   le même journal et le même conflit que le Deck, ou reste-t-il un réglage local ?
9. **Accusé et reprise.** Quelle réponse serveur prouve qu'une opération est durable ?
   Combien de tentatives, quel backoff et quelle interface après refus RLS, session
   expirée, carte inconnue ou Deck refusé par `deck_gardes` ? Un indicateur `online`
   ne prouve pas que Supabase est joignable.
10. **Initialisation et reset beta.** À la première connexion, comment distinguer
    compte vide, nouvel appareil et données locales héritées ? Le reset D-150 doit-il
    aussi invalider un journal local ancien afin qu'il ne recrée pas les données effacées ?

## 4. Recommandation (à confirmer, non tranchée)

Recommander la voie **hybride de D-153**, plutôt que LWW : elle maintient l'accès
hors ligne et évite de choisir silencieusement un Deck arbitraire ; elle isole le
problème de fusion des quantités du journal d'ordre du Deck. Mais ne pas annoncer que
le `max` scalaire suffit à satisfaire D-048 avant que Bastien tranche la sémantique des
acquisitions concurrentes. La règle de D-153 reste la source d'autorité : ce document
met en évidence son point technique à préciser, il ne la remplace pas.

**Coût assumé :** estimation initiale de 6–10 jours-personne, avec un risque de hausse
sur la Collection. Il faut une file persistante et idempotente, les RPC, le bootstrap
sans écrasement, les gardes/testeurs à deux appareils, l'UI minimale de conflit et un
test de panne/rechargement. La réponse à #492 et aux questions 1, 2, 3 et 6 conditionne
le contrat serveur ; la garde du Deck de 0021 est un filet de légalité, pas un
résolveur de conflit.

## 5. Ce qui n'a pas été vérifié

- Aucun test n'a simulé deux appareils concurrents, une déconnexion au milieu d'un
  Arrivage, un rechargement avec changements en attente, ni une reconnexion tardive.
- Les migrations 0020/0021 et les contrats qu'elles déclarent ont été lus ; aucune
  instance Supabase distante n'a été interrogée, et aucun état de production n'a été
  inspecté. Les appels à un serveur d'action sont hors du périmètre de cette conception.
- Les coûts et volumes ci-dessus sont des calculs de borne à partir de `A`, `C` et `D`,
  pas des traces d'usage ; aucune partie type n'a été mesurée.
- Le scénario précis du ticket #492 et les corps/commentaires des tickets #491, #493,
  #495 et #497 n'ont pas été consultés dans GitHub. Le document s'appuie sur les faits
  locaux, D-153 et les questions telles qu'elles sont données pour cette tâche.
- `docs/recherches/488-conflit-hors-ligne.md` a été lu comme recherche antérieure ; ses
  descriptions historiques des tables ne remplacent pas l'état courant observé dans
  les migrations 0020/0021. Il n'a pas été corrigé dans ce travail.
- Aucune commande de build, aucun test d'intégration PGlite de synchro et aucun essai
  visuel d'écran n'a été ajouté : ce livrable ne contient que la conception.
