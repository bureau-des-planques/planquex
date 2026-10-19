# Factions, cartes et nommage — version finale

> Noms actés le 18/10/2026. Le code utilise des identifiants stables
> (`SSE`, `MANAGER`, `HAPPINESS`, …) ; les noms sont des données, donc renommables
> plus tard sans casser le moteur.
>
> **Stades** : Entrant → N+1 → **N+2**. Pas de 4ᵉ stade : la Méga-Évolution est hors
> périmètre (D-020).
> **Rareté ex** : COMEX (vaut 2 Interventions). Pas de palier à 3 Interventions (D-020).
> **Types** : **une** faction par Planqué ; le double type est hors périmètre (D-020).

---

## 1. Tableau final

| # | Type | Faction | Rôle mécanique | Faiblesse | Carte signature |
|---|---|---|---|---|---|
| 1 | Plante | **SSE** | Soin, statuts, résilience | Manager | Médecin du travail |
| 2 | Feu | **Management** | Dégâts, burn-out, pression | Happiness Manager | Directeur général |
| 3 | Eau | **QVT** | Énergie, relève, flux | Amélioration continue | Chief Happiness Officer |
| 4 | Électricité | **Amélioration continue** | Dégâts étalés, gel, tempo | Technicien | Directeur qualité |
| 5 | Psychique | **RH** | Dérive, banc, manipulation | Direction | DRH |
| 6 | Combat | **Atelier** | Gros dégâts, gros Seuil | RH | Chef d’atelier |
| 7 | Obscurité | **Direction** | Disruption, contrôle | Technicien | PDG |
| 8 | Métal | **Syndicat** | Tank, soin, protection | Manager | Secrétaire général |
| 9 | Dragon | **Intérim** | Multi-énergie, chaos, aucune faiblesse | Aucune | Intérimaire légendaire |
| 10 | Incolore | **Support** | Polyvalent, pioche, recherche | Technicien | Responsable support |

**Cycle des faiblesses** :

| Faction | Vulnérable à |
|---|---|
| SSE | Manager |
| Manager | Happiness Manager |
| Happiness Manager | Amélioration continue |
| Amélioration continue | Technicien |
| RH | Direction |
| Technicien | RH |
| Direction | Technicien |
| Syndicat | Manager |
| Intérimaire | Aucune |
| Support | Technicien |

---

## 2. SSE — Plante

- **Identité** : le Service Santé Environnement, avec l’infirmière du travail incluse.
  Prévention, arrêts, registre des accidents, bilan de santé. On soigne les dégâts
  que les autres infligent.
- **Rôle** : soin, statuts, lignes d’évolution solides, jeu lent mais increvable.
- **Faiblesse** : Manager (le burn-out finit par gagner).
- **Ligne d’évolution** : Infirmier de site → Infirmière du travail → Médecin du travail.
- **COMEX (ex)** : **Médecin du travail** — « Il a lu ton dossier. Il a soupiré. »

| Carte | Stade | Rôle |
|---|---|---|
| Infirmier de site | Entrant | Base, petit soin |
| Préventeur | Entrant | Base, anti-statut |
| Infirmière du travail | N+1 | Évolution, soin |
| Ergonome | N+1 | Évolution, protection |
| Médecin du travail | N+2 | Gros Seuil, soin global |
| Kiné du travail | Entrant | Base, soin |
| Trousse de secours | Objet | Soin |
| Registre des accidents | Objet | Pioche |
| Arrêt de travail | Objet | Protège un Planqué |
| Gants de protection | Outil | +20 Seuil |
| Visite médicale | Collègue | Soin + pioche |
| Salle de repos | Lieu | +Seuil au banc |
| **COMEX : Médecin du travail** | ex | 2 Interventions, soin de zone |

- **Direction artistique** : blanc, vert menthe, infirmerie, lumière froide, plantes.

---

## 3. Management — Feu

- **Identité** : le management de proximité, les objectifs, les deadlines, les
  réunions d’urgence. Le feu, c’est la pression.
- **Rôle** : dégâts, burn-out, défausse d’énergie, jeu agressif.
- **Faiblesse** : Happiness Manager (le bien-être éteint la pression).
- **Ligne d’évolution** : Jeune manager → Manager de proximité → Directeur.
- **COMEX (ex)** : **Directeur général** — « Il a dit “famille” dans un mail. »

| Carte | Stade | Rôle |
|---|---|---|
| Jeune manager | Entrant | Base, dégâts |
| Chef de projet | Entrant | Base, tempo |
| Ton Entrant | Entrant | Base, pression |
| Manager de proximité | N+1 | Évolution, burn-out |
| Directeur | N+2 | Gros dégâts, contrôle |
| Réunion d’urgence | Objet | Défausse une énergie |
| Deadline hier | Objet | +20 dégâts |
| Objectif irréaliste | Objet | Épuisement |
| Tableau Excel | Outil | +10 dégâts |
| Entretien annuel | Collègue | Défausse + pioche |
| Rack | Lieu | +10 dégâts aux attaques Feu |
| Prime variable | Objet | Pioche / défausse |
| **COMEX : Directeur général** | ex | 2 Interventions, attaque de zone |

- **Direction artistique** : orange, rouge, cravates, tableaux de bord, néons.

---

## 4. QVT — Eau

- **Identité** : la QVT, les perks, les afterworks, les plantes vertes, la corbeille
  de fruits. Le bonheur comme process. L’eau, c’est le flux et le bien-être.
- **Rôle** : accélération d’énergie, relève, dégâts au banc, jeu de flux.
- **Faiblesse** : Amélioration continue (l’audit tue la vibe).
- **Ligne d’évolution** : Chargé QVT → Happiness Manager → Chief Happiness Officer.
- **COMEX (ex)** : **Chief Happiness Officer** — « Le bonheur est obligatoire, 9 h–18 h. »

| Carte | Stade | Rôle |
|---|---|---|
| Chargé QVT | Entrant | Base, soin léger |
| Coach agile | Entrant | Base, relève |
| Sophrologue | Entrant | Base, anti-statut |
| Happiness Manager | N+1 | Évolution, accélération |
| Chief Happiness Officer | N+2 | Gros Seuil, soin global |
| Afterwork | Objet | Pioche + soin |
| Corbeille de fruits | Objet | Soin |
| Plante verte | Outil | +10 Seuil |
| Yoga du rire | Collègue | Soin global |
| Team building | Collègue | Buff |
| Babyfoot | Lieu | +1 café |
| Massage en entreprise | Objet | Soin + relève |
| **COMEX : Chief Happiness Officer** | ex | 2 Interventions, soin de zone |

- **Direction artistique** : bleu-vert, plantes, lumière douce, fruits, bois clair.

---

## 5. Amélioration continue — Électricité

- **Identité** : le Lean, la qualité, les audits, les KPI, les tableaux de bord.
  Chaque petit progrès est une décharge. Le process est partout.
- **Rôle** : dégâts étalés, gel, tempo, agressivité.
- **Faiblesse** : Technicien (le terrain casse le process).
- **Ligne d’évolution** : Chargé qualité → Auditeur → Directeur qualité.
- **COMEX (ex)** : **Directeur qualité** — « On a amélioré le process d’amélioration. »

| Carte | Stade | Rôle |
|---|---|---|
| Chargé qualité | Entrant | Base, dégâts étalés |
| Consultant Lean | Entrant | Base, gel |
| Auditeur qualité | N+1 | Évolution, tempo |
| Directeur qualité | N+2 | Gros dégâts, contrôle |
| Six Sigma | Entrant | Base, protection |
| Tableau de bord | Objet | Pioche |
| KPI | Objet | +10 dégâts |
| Ticket qualité | Objet | Défausse |
| Norme ISO | Outil | +20 Seuil |
| Réunion de suivi | Collègue | Pioche + énergie |
| Kaizen | Objet | Buff |
| Salle de réunion | Lieu | +10 dégâts aux attaques Électrique |
| **COMEX : Directeur qualité** | ex | 2 Interventions, attaque de zone |

- **Direction artistique** : jaune électrique, cyan, dashboards, post-its, néons.

---

## 6. RH — Psychique

- **Identité** : le recrutement, les entretiens, les plans de carrière, la manipulation
  douce. Le sourire est une arme.
- **Rôle** : dérive, dégâts au banc, contrôle, manipulation.
- **Faiblesse** : Direction (le pouvoir renvoie la manipulation).
- **Ligne d’évolution** : Assistant RH → Chargé de recrutement → DRH.
- **COMEX (ex)** : **DRH** — « Il a lu ton CV, il sait où tu habites. »

| Carte | Stade | Rôle |
|---|---|---|
| Assistant RH | Entrant | Base, dérive |
| Recruteur en embuscade | Entrant | Base, défausse |
| Chargé de recrutement | N+1 | Évolution, dégâts au banc |
| DRH | N+2 | Contrôle, gros dégâts |
| Chasseur de têtes | Entrant | Base, pioche |
| Entretien annuel | Objet | Défausse |
| Offre d’emploi | Objet | Recherche |
| Plan de carrière | Objet | Pioche / défausse |
| Badge nominatif | Outil | +10 dégâts |
| Réunion individuelle | Collègue | Contrôle |
| Salle d’entretien | Lieu | +10 dégâts aux attaques Psychique |
| **COMEX : DRH** | ex | 2 Interventions, dégâts au banc |

- **Direction artistique** : violet, rose poudré, miroirs, sourires trop blancs.

---

## 7. Atelier — Combat

- **Identité** : la maintenance, le terrain, les outils, les pannes. Ça parle fort et
  ça répare. Le physique contre la paperasse.
- **Rôle** : gros dégâts, gros Seuil, dégâts au banc, jeu direct.
- **Faiblesse** : RH (la paperasse gagne toujours).
- **Ligne d’évolution** : Apprenti → Technicien → Chef d’atelier.
- **COMEX (ex)** : **Chef d’atelier** — « Il a un plan. Le plan est une clé de 12. »

| Carte | Stade | Rôle |
|---|---|---|
| Apprenti | Entrant | Base, petit Seuil |
| Électricien | Entrant | Base, dégâts |
| Plombier | Entrant | Base, tank |
| Ascensoriste | Entrant | Base, relève |
| Technicien de maintenance | N+1 | Évolution, buff |
| Chef d’atelier | N+2 | Gros dégâts, banc |
| Tournevis | Objet | +10 dégâts |
| Multimètre | Outil | +10 dégâts |
| Échelle | Outil | +20 Seuil |
| Intervention | Objet | Pioche |
| Panne | Objet | Empêche une attaque |
| Atelier | Lieu | +10 dégâts aux attaques Combat |
| **COMEX : Chef d’atelier** | ex | 2 Interventions, attaque de zone |

- **Direction artistique** : brun, ocre, casques, outils, atelier, contre-jour.

---

## 8. Direction — Obscurité

- **Identité** : le N+2, les plans de départ, les consultants, les fusions. Le vide
  organisé. Le pouvoir qui décide sans comprendre.
- **Rôle** : disruption, contrôle, surcharge, attaques pas chères.
- **Faiblesse** : Technicien (le réel finit toujours par revenir).
- **Ligne d’évolution** : Chef de projet fantôme → Directeur adjoint → PDG.
- **COMEX (ex)** : **PDG** — « Il repart avec la prime, tu restes avec le plan. »

| Carte | Stade | Rôle |
|---|---|---|
| Chef de projet fantôme | Entrant | Base, esquive |
| N+2 fantôme | Entrant | Base, surcharge |
| Consultant externe | Entrant | Base, pioche |
| Directeur adjoint | N+1 | Évolution, disruption |
| PDG | N+2 | Gros dégâts, contrôle |
| Plan de départ | Objet | Défausse |
| Note de service | Objet | Contrôle |
| Costume trois pièces | Outil | +10 dégâts |
| Réunion qui aurait pu être un mail | Collègue | Défausse + pioche |
| Audit surprise | Objet | Défausse |
| Fusion-acquisition | Objet | Pioche / contrôle |
| Salle du N+2 | Lieu | +10 dégâts aux attaques Obscurité |
| **COMEX : PDG** | ex | 2 Interventions, attaque de contrôle |

- **Direction artistique** : noir, or, verre fumé, cravates, reflets de tableau.

---

## 9. Syndicat — Métal

- **Identité** : le CSE, les délégués, les tracts, les heures de délégation. Le
  blindage, c’est la procédure.
- **Rôle** : tank, soin, protection, anti-statut.
- **Faiblesse** : Manager (le feu fait fondre le métal).
- **Ligne d’évolution** : Délégué du personnel → Représentant CSE → Secrétaire général.
- **COMEX (ex)** : **Secrétaire général** — « Il a obtenu une réunion. Elle a duré 4 heures. »

| Carte | Stade | Rôle |
|---|---|---|
| Délégué du personnel | Entrant | Base, tank |
| Tract blindé | Entrant | Base, protection |
| Permanent syndical | Entrant | Base, buff |
| Représentant CSE | N+1 | Évolution, soin |
| Secrétaire général | N+2 | Gros Seuil, anti-statut |
| Heure de délégation | Objet | Pioche |
| Motion de censure | Objet | Défausse |
| Badge syndical | Outil | +20 Seuil |
| Assemblée générale | Collègue | Soin global |
| Grève | Objet | Empêche une attaque |
| Convention collective | Outil | +20 Seuil |
| Local syndical | Lieu | +Seuil |
| **COMEX : Secrétaire général** | ex | 2 Interventions, tank |

- **Direction artistique** : acier, rouge, gris, métal brossé, affiches.

---

## 10. Intérim — Dragon

- **Identité** : la mission courte, l’agence, le badge temporaire, le site qu’on
  découvre. La précarité comme énergie brute. Ils gèrent tout, on ne les garde pas.
- **Rôle** : multi-énergie, gros dégâts, aucune faiblesse, jeu à haut risque.
- **Faiblesse** : aucune (comme les Dragons).
- **Ligne d’évolution** : Intérimaire → Intérimaire confirmé → Chef d’équipe intérimaire.
- **COMEX (ex)** : **Intérimaire légendaire** — « Il connaît le site mieux que le directeur. »

| Carte | Stade | Rôle |
|---|---|---|
| Intérimaire | Entrant | Base, multi-énergie |
| Mission courte | Entrant | Base, dégâts |
| Agence d’intérim | Entrant | Base, pioche |
| Intérimaire confirmé | N+1 | Évolution, accélération |
| Chef d’équipe intérimaire | N+2 | Gros dégâts, chaos |
| Contrat | Objet | Recherche |
| Badge temporaire | Outil | +10 dégâts |
| Café renversé | Objet | Défausse |
| Formation express | Collègue | Buff |
| Prime de précarité | Objet | Pioche |
| Site différent | Lieu | +1 café |
| Arrivée demain | Objet | Rotation |
| **COMEX : Intérimaire légendaire** | ex | 2 Interventions, attaque multi-énergie |

- **Direction artistique** : arc-en-ciel, badges, sacs à dos, lumière blanche.

---

## 11. Support — Incolore

- **Identité** : le helpdesk, le support N1, les assistants, les tickets, les FAQ,
  les escalades. Toujours poli, jamais écouté.
- **Rôle** : polyvalent, pioche, recherche, dégâts propres.
- **Faiblesse** : Technicien (le terrain court-circuite le support).
- **Ligne d’évolution** : Agent support → Technicien support → Responsable support.
- **COMEX (ex)** : **Responsable support** — « Avez-vous essayé de redémarrer votre demande ? »

| Carte | Stade | Rôle |
|---|---|---|
| Agent support | Entrant | Base, pioche |
| Assistant de direction | Entrant | Base, dégâts |
| Standard | Entrant | Base, contrôle |
| Technicien support | N+1 | Évolution, buff |
| Responsable support | N+2 | Gros dégâts, contrôle |
| Ticket | Objet | Pioche |
| FAQ | Objet | Recherche |
| Chatbot | Outil | +10 dégâts |
| Casque téléphonique | Outil | +10 Seuil |
| Escalade | Collègue | Buff global |
| Procédure | Objet | Protection |
| Salle de support | Lieu | +10 dégâts aux attaques Incolore |
| **COMEX : Responsable support** | ex | 2 Interventions, attaque de zone |

- **Direction artistique** : rose, cyan, écrans, casques, sourires de plaquette.

---

## 12. Le mot-clé maison : « Changement de priorité »

Le mot-clé est porté par les cartes (`keywords: ["PRIORITY_SHIFT"]`), pas par les
règles de base. Un drapeau global `RULES.PRIORITY_SHIFT_ENABLED` permet de le couper
sans changer les cartes.

> **Changement de priorité** — Une fois par tour, si ce Planqué est au Poste, tu
> peux défausser une carte de ta main. Si tu le fais, pioche une carte.

- **Pourquoi** : consistance sans avantage de cartes net (défausse 1, pioche 1).
- **Risque** : faible. Aucune synergie de défausse au lancement.
- **Test** : winrate avec/sans, 10 000 parties.
- **Désactivation** : `RULES.PRIORITY_SHIFT_ENABLED = false` → le mot-clé ne fait rien,
  les cartes restent jouables, aucun deck ne devient illégal.

### Variantes écartées (pour mémoire)

- **Briefing** : regarde les 3 du dessus, prends-en 1, remets les autres dessous.
- **Débrief** : déplace 1 café vers un Planqué du banc en fin de tour.

---

## 13. Prochaine étape

1. Générer la **spécification des 286 cartes** à partir de ce vocabulaire :
   lignes d’évolution, stades, raretés, stats, attaques, talents, textes.
2. Définir les **3 bacs de lancement** et leurs cartes exclusives.
3. Produire la **direction artistique** : palette, gabarit de carte, 3 planches.
4. Scaffolder le monorepo et le design system.
