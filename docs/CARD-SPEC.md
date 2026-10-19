# Spécification du set — 286 cartes

> État : cadre + échantillon de 30 cartes. Le set complet sera généré après validation
> du ton, des noms et des courbes de stats.

---

## 1. Contraintes de structure

| Bloc | Nombre |
|---|---:|
| Cartes de base | **226** |
| — Planqués uniques | 215 |
| — Collègues | 8 |
| — Objets | 3 |
| Cartes secrètes | **60** |
| — variantes de Planqués | 52 |
| — variantes de Collègues | 8 |
| **Total** | **286** |

### Raretés

| Rareté | Nombre |
|---|---:|
| 1 diamant | 102 |
| 2 diamants | 67 |
| 3 diamants | 42 |
| 4 diamants | 15 |
| 1 étoile | 24 |
| 2 étoiles | 29 |
| 3 étoiles | 4 |
| Couronne | 3 |

### Stades (entrées, variantes incluses)

| Stade | Nombre |
|---|---:|
| Entrant | 133 |
| N+1 | 94 |
| N+2 | 40 |
| **Total Planqués** | **267** |

Aucun **4ᵉ stade** : la Méga-Évolution (3 Interventions) est hors périmètre (D-020). Le set se
construit sur Entrant → N+1 → N+2.

*État au 19/10/2026 : les **3 Objets** et **8 Collègues** sont écrits (`src/data/actions.ts`,
enregistrés dans `src/data/index.ts`), et le moteur applique « Objet illimité » et « Collègue
1 par tour » (`playAction`, `src/game/engine.ts`). Les 215 Planqués et les variantes restent à
produire.*

### Lignes d’évolution (Planqués uniques)

| Type de ligne | Nombre de lignes | Cartes |
|---|---:|---:|
| Ligne à 3 stades (Entrant → N+1 → N+2) | 25 | 75 |
| Ligne à 2 stades (Entrant → N+1) | 49 | 98 |
| Entrant seul (sans évolution) | 42 | 42 |
| **Total** | **116** | **215** |

---

## 2. Courbes de stats

Valeurs cibles, à ajuster par simulation. Le Seuil et les dégâts sont des multiples
de 10 pour rester lisibles.

| Stade / rareté | Seuil | Attaques | Dégâts indicatifs | Rotation |
|---|---:|---|---:|---:|
| Entrant 1◆ | 50–70 | 1 attaque | 10–20 | 1 |
| Entrant 2◆ (ligne) | 60–80 | 1–2 attaques | 10–30 | 1 |
| N+1 2◆ | 90–110 | 1–2 attaques | 30–50 | 1–2 |
| N+1 3◆ | 100–120 | 2 attaques | 40–60 | 2 |
| N+2 3◆ | 140–160 | 2 attaques | 50–80 | 2 |
| N+2 4◆ (ex) | 170–190 | 2 attaques | 70–120 | 2–3 |

**Le Seuil suit le jeu réel** (D-023), à ±10 près sur chaque borne pour garder une
progression lisible entre raretés d'un même stade : Basique **50–80**, Stade 1
**90–120**, Stade 2 **140–160**, ex **170–190** (relevés du 19/10/2026). Notre
ancienne courbe plafonnait 20 points plus bas, ce qui rendait les K.O. **moins
chers** que dans le jeu de référence.

### Dégâts par café — **règle normative** (D-021)

Les dégâts se lisent **par coût en café**, pas par rareté. La colonne « Dégâts indicatifs »
ci-dessus est un repère de lecture ; elle ne plafonne rien.

| Café | Dégâts | Effet porté par l'attaque |
|---|---:|---|
| 1 | 10–30 | gratuit |
| 2 | 40–80 | gratuit |
| 3 | 70–120 | coûte 20 à 40 dégâts |
| 4 | 100–160 | coûte 20 à 70 dégâts |

Un **effet** (statut, soin, pioche, défausse, échange) ne coûte **pas** de dégâts à 1 et 2 cafés ;
à partir de 3 cafés il en coûte 20 à 40. Un **fardeau** (se blesser, défausser ses propres cafés)
est ce qui permet d'atteindre le haut de la bande.

*(Ancrage : cartes réelles de TCG Pocket relevées le 19/10/2026. Scyther 30 brut contre
Venomoth 30 + Empoisonné à 1 énergie — effet gratuit. Dewgong 90 brut contre Vaporeon
60 + soin 30 à 3 énergies — effet payé. Starmie ex 90 et Greninja ex 100 à 2 énergies :
la bande des COMEX n'est pas celle des N+1.)*

**Règles de conception** :

- Un effet ne fait donc **jamais** descendre les dégâts sous le bas de la bande de son coût.
- Une capacité (Talent) ne doit pas créer d’avantage de cartes net sans coût.
- Une carte ex vaut 2 Interventions ; elle doit être plus forte, mais pas auto-include. Il n'existe **pas** de palier à 3 Interventions : la Méga-Évolution est hors périmètre (D-020).
- La **Vulnérabilité** ajoute +20 ; l'**Intérim** n'a pas de vulnérabilité.

---

## 3. Archétypes par faction

| Faction | Archétype principal | Archétype secondaire | Signature mécanique |
|---|---|---|---|
| SSE | Contrôle / soin | Midrange | Soin, anti-statut |
| Management | Aggro | Midrange | Épuisement, pression |
| QVT | Midrange / tempo | Contrôle | Accélération, soin |
| Amélioration continue | Tempo | Contrôle | Dégâts étalés, gel |
| RH | Contrôle | Combo | Dérive, défausse |
| Atelier | Aggro | Midrange | Gros dégâts, tank |
| Direction | Contrôle | Combo | Disruption, défausse |
| Syndicat | Tank | Contrôle | Protection, soin |
| Intérim | Combo | Aggro | Multi-énergie, chaos |
| Support | Midrange | Contrôle | Pioche, polyvalence |

---

## 4. Échantillon de 30 cartes

Trois cartes par faction : un Entrant, un N+1, un N+2. Les noms,
textes et effets sont là pour valider le ton et les courbes.

### SSE — Plante

| Carte | Stade | Rareté | Seuil | Rotation | Attaque / Talent | Texte |
|---|---|---|---:|---:|---|---|
| Infirmier de site | Entrant | 1◆ | 60 | 1 | **Pansement** (1 café) : 10 dégâts, soigne 10 de ce Planqué | « Il a lu la notice. En diagonale. » |
| Infirmière du travail | N+1 | 2◆ | 90 | 1 | **Prévention** (Talent, 1/tour) : soigne 10 d’un Planqué. **Piqûre de rappel** (2 cafés) : 40 | « Elle sait où tu as mal avant toi. » |
| Médecin du travail | N+2 | 3◆ | 130 | 2 | **Arrêt de travail** (2 cafés) : 60, le Planqué adverse est Sieste. **Bilan de santé** (3 cafés) : 80, soigne 20 de tous tes Planqués | « Il a signé. Tu ne reviens pas avant lundi. » |

### Management — Feu

| Carte | Stade | Rareté | Seuil | Rotation | Attaque / Talent | Texte |
|---|---|---|---:|---:|---|---|
| Jeune manager | Entrant | 1◆ | 60 | 1 | **Objectif** (1 café) : 20 | « Il a un plan. Le plan est un post-it. » |
| Manager de proximité | N+1 | 2◆ | 90 | 1 | **Pression** (Talent, 1/tour) : défausse 1 carte, 10 dégâts au Planqué adverse actif. **Deadline** (2 cafés) : 50 | « Il manage par mail. Il ne lit pas les réponses. » |
| Directeur général | N+2 | 3◆ | 140 | 2 | **Restructuration** (2 cafés) : 60, défausse 1 café adverse. **Plan de croissance** (3 cafés) : 100, ce Planqué subit 20 | « La croissance est externe. Les dégâts sont internes. » |

### QVT — Eau

| Carte | Stade | Rareté | Seuil | Rotation | Attaque / Talent | Texte |
|---|---|---|---:|---:|---|---|
| Chargé QVT | Entrant | 1◆ | 60 | 1 | **Corbeille de fruits** (1 café) : 10, soigne 10 d’un Planqué | « Il a apporté des clémentines. C’est son projet. » |
| Happiness Manager | N+1 | 2◆ | 90 | 1 | **Bulletin de bonheur** (Talent, 1/tour) : attache 1 café à un Planqué du Rack. **Afterwork** (2 cafés) : 40, pioche 1 | « Le bonheur est un KPI comme un autre. » |
| Chief Happiness Officer | N+2 | 3◆ | 130 | 2 | **Team building** (2 cafés) : 60, soigne 20 de tous tes Planqués. **Yoga du rire** (3 cafés) : 80, le Planqué adverse est Dérivé | « Riez. C’est obligatoire. » |

### Amélioration continue — Électricité

| Carte | Stade | Rareté | Seuil | Rotation | Attaque / Talent | Texte |
|---|---|---|---:|---:|---|---|
| Chargé qualité | Entrant | 1◆ | 60 | 1 | **Checklist** (1 café) : 10, regarde la carte du dessus de ton deck | « Il a coché la case. La case ne sert à rien. » |
| Auditeur qualité | N+1 | 2◆ | 90 | 1 | **Audit** (Talent, en jouant) : défausse 1 carte, l’adversaire révèle sa main. **Non-conformité** (2 cafés) : 40 | « Il a trouvé un problème. C’est toi. » |
| Directeur qualité | N+2 | 3◆ | 130 | 2 | **Tableau de bord** (2 cafés) : 60, pioche 1. **Norme ISO** (3 cafés) : 90, le Planqué adverse est Immobilisation | « Le process est conforme. Le produit est cassé. » |

### RH — Psychique

| Carte | Stade | Rareté | Seuil | Rotation | Attaque / Talent | Texte |
|---|---|---|---:|---:|---|---|
| Assistant RH | Entrant | 1◆ | 60 | 1 | **Entretien** (1 café) : 10, l’adversaire révèle une carte de sa main | « Il a posé la question. Il n’a pas écouté la réponse. » |
| Chargé de recrutement | N+1 | 2◆ | 90 | 1 | **Sourcing** (Talent, en jouant) : cherche un Planqué dans ton deck, révèle-le, ajoute-le à ta main. **Promesse d’embauche** (2 cafés) : 40 | « Le poste est passionnant. Le salaire est confidentiel. » |
| DRH | N+2 | 3◆ | 130 | 2 | **Plan de carrière** (2 cafés) : 60, l’adversaire défausse 1 carte. **Entretien annuel** (3 cafés) : 80, le Planqué adverse est Dérivé | « Il a lu ton CV. Il sait où tu habites. » |

### Atelier — Combat

| Carte | Stade | Rareté | Seuil | Rotation | Attaque / Talent | Texte |
|---|---|---|---:|---:|---|---|
| Apprenti | Entrant | 1◆ | 70 | 1 | **Coup de clé** (1 café) : 20 | « Il a serré dans le bon sens. Presque. » |
| Technicien de maintenance | N+1 | 2◆ | 100 | 2 | **Dépannage** (Talent, 1/tour) : soigne 10 de ce Planqué. **Multimètre** (2 cafés) : 50 | « Il a réparé la machine. Elle marche moins bien. » |
| Chef d’atelier | N+2 | 3◆ | 150 | 3 | **Intervention** (2 cafés) : 70. **Gros œuvre** (3 cafés) : 110, ce Planqué subit 20 | « Il a un plan. Le plan est une clé de 12. » |

### Direction — Obscurité

| Carte | Stade | Rareté | Seuil | Rotation | Attaque / Talent | Texte |
|---|---|---|---:|---:|---|---|
| Chef de projet fantôme | Entrant | 1◆ | 60 | 1 | **Reporting** (1 café) : 10, pioche 1 | « Il est en réunion. Depuis 2019. » |
| Directeur adjoint | N+1 | 2◆ | 90 | 1 | **Cabinet** (Talent, en jouant) : défausse 1 carte, l’adversaire défausse 1 carte. **Note de service** (2 cafés) : 40 | « Il a délégué. À personne. » |
| PDG | N+2 | 3◆ | 140 | 2 | **Plan de départ** (2 cafés) : 60, défausse 1 café adverse. **Fusion-acquisition** (3 cafés) : 100, l’adversaire défausse 1 carte | « Il repart avec la prime. Tu restes avec le plan. » |

### Syndicat — Métal

| Carte | Stade | Rareté | Seuil | Rotation | Attaque / Talent | Texte |
|---|---|---|---:|---:|---|---|
| Délégué du personnel | Entrant | 1◆ | 70 | 1 | **Tract** (1 café) : 10, soigne 10 de ce Planqué | « Il a imprimé 400 tracts. En noir et blanc. » |
| Représentant CSE | N+1 | 2◆ | 100 | 2 | **Heure de délégation** (Talent, 1/tour) : pioche 1. **Motion** (2 cafés) : 40 | « La réunion a duré 4 heures. Elle a été reportée. » |
| Secrétaire général | N+2 | 3◆ | 150 | 3 | **Convention collective** (2 cafés) : 50, ce Planqué subit 10 de moins au prochain tour. **Grève** (3 cafés) : 80, le Planqué adverse est Immobilisation | « Il a obtenu une réunion. Elle a duré 4 heures. » |

### Intérim — Dragon

| Carte | Stade | Rareté | Seuil | Rotation | Attaque / Talent | Texte |
|---|---|---|---:|---:|---|---|
| Intérimaire | Entrant | 1◆ | 60 | 1 | **Mission courte** (1 café) : 20 | « Il connaît le site mieux que le directeur. Il part vendredi. » |
| Intérimaire confirmé | N+1 | 2◆ | 90 | 1 | **Polyvalence** (Talent) : ce Planqué peut utiliser n’importe quel café pour ses attaques. **Démerde** (2 cafés) : 50 | « Il a fait le boulot de trois personnes. Il est payé pour une. » |
| Chef d’équipe intérimaire | N+2 | 3◆ | 140 | 2 | **Site différent** (2 cafés) : 60, échange ce Planqué avec un Planqué du Rack. **Prime de précarité** (3 cafés) : 100, ce Planqué subit 20 | « Il gère l’équipe. Il n’a pas de badge. » |

### Support — Incolore

| Carte | Stade | Rareté | Seuil | Rotation | Attaque / Talent | Texte |
|---|---|---|---:|---:|---|---|
| Agent support | Entrant | 1◆ | 60 | 1 | **Ticket** (1 café) : 10, pioche 1 | « Il a ouvert le ticket. Il l’a fermé. Sans réponse. » |
| Technicien support | N+1 | 2◆ | 90 | 1 | **Escalade** (Talent, en jouant) : cherche un Collègue dans ton deck, révèle-le, ajoute-le à ta main. **Procédure** (2 cafés) : 40 | « Avez-vous essayé de redémarrer votre demande ? » |
| Responsable support | N+2 | 3◆ | 130 | 2 | **FAQ** (2 cafés) : 50, pioche 2. **Chatbot** (3 cafés) : 80, le Planqué adverse est Dérivé | « Le chatbot a compris. Personne n’a compris le chatbot. » |

---

## 5. Prochaines étapes

1. Valider le ton et les courbes sur ces 30 cartes.
2. Générer les **215 Planqués uniques** (25 lignes à 3 stades, 49 à 2 stades, 42 Entrant seuls).
3. Ajouter les **11 Collègues/Objets** de base et les **52 variantes de Planqués + 8 variantes de Collègues**.
4. Calibrer les raretés et les taux de drop.
5. Passer les 286 cartes dans la simulation d’équilibrage.
6. Produire la direction artistique et les prompts d’illustration.
