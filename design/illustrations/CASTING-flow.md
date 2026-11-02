# Casting — une ligne par Planqué

> **La table de distribution des visages** (D-174, #583) : une ligne par **carte de base
> Planqué**, avec son origine, son genre et sa tranche d'âge. Elle vit **ici**, jamais dans
> `src/data` (Q1) : c'est une donnée de production, pas du jeu.
>
> Sans elle, les 225 planches partageaient un seul visage — homme blanc, 45–60 ans, lunettes
> — et les seules personnes visiblement racisées étaient exactement la carte « diversité /
> inclusion ». C'est D-065 (5) : « les 30 se ressemblent ».
>
> **Ce que le casting n'est pas** : un reflet du prestige du poste. Le PDG peut être une
> femme noire, l'agent d'entretien un homme blanc. C'est une **règle de rédaction**, dite
> dans D-174 et vérifiée par relecture — pas par la garde, qui ne sait pas juger un poste.

## Le format

```text
| `id` | origine | genre | âge |
```

- **`id`** : celui de la **carte de base** (`src/data/**`). Une **variante** n'a pas de
  ligne : elle emprunte le casting de sa base (D-139), comme son sujet. Les **11 cartes
  Action** de la planche Objet n'en ont pas non plus — un objet n'a ni origine ni genre.
- **origine**, vocabulaire fermé :

  | Code | Ce qu'il couvre |
  |---|---|
  | `blanc` | blanc |
  | `maghrebin` | Maghreb, descendance nord-africaine |
  | `noir` | Afrique subsaharienne, Caraïbes |
  | `metis` | métis |
  | `asiatique` | Vietnam, Cambodge, Chine, Laos |
  | `autre` | portugais, turc, réunionnais… |

- **genre**, vocabulaire fermé : `femme` ou `homme`.
- **âge**, vocabulaire fermé : `20`, `30`, `40`, `50`, `60` — la tranche décennale. Les
  rôles qui imposent leur âge le gardent (`stagiaire`, `interne` restent jeunes) ; un DRH
  ou un PDG peut avoir 35 ou 60 ans.

## Le prompt

Il se compose désormais : `<socle de la planche> <casting>, <sujet>, muted <accent> accent.`
Le casting devient, dans la langue des modèles : `a Black woman in her forties`,
`a white man in his thirties`, `an Asian woman in her twenties`… C'est
`scripts/ressources/illustration-vague.sh` qui le traduit (`casting_phrase`), et `socle_de(id)`
qui choisit le socle **Portrait** ou **Objet** (`PROMPTS-flow.md`).

## La distribution validée

**222 Planqués**, la cible que D-174 acte et que la garde vérifie :

| Groupe | Part | Cartes |
|---|---:|---:|
| blanc | 60 % | 133 |
| maghrebin | 12 % | 27 |
| noir | 10 % | 22 |
| metis | 8 % | 18 |
| asiatique | 5 % | 11 |
| autre | 5 % | 11 |

Genre : **111 femmes / 111 hommes**. Âge : 20 ans **33**, 30 ans **56**, 40 ans **67**,
50 ans **44**, 60 ans **22** — les quatre rôles qui imposent leur âge (`sse-interne`,
`management-jeune-manager`, `amelioration-stagiaire-qualite`, `direction-stagiaire-direction`)
sont à 20 ans.

Par faction, la garde exige en plus : **aucune faction au-delà de 70 %** d'un même groupe,
**au moins 3 groupes** pour toute faction de 10 cartes et plus (toutes le sont), et
**40 à 60 % de femmes**. Les comptes ci-dessous sont la distribution réelle de la table.

## La table

| Carte (`id`) | Origine | Genre | Âge |
|---|---|---|---|

<!-- sse — 28 cartes -->
| `sse-infirmier-site` | blanc | homme | 40 |
| `sse-infirmiere-travail` | maghrebin | femme | 30 |
| `sse-medecin-travail` | blanc | homme | 50 |
| `sse-preventeur` | noir | homme | 40 |
| `sse-ergonome` | blanc | femme | 40 |
| `sse-responsable-sse` | metis | homme | 60 |
| `sse-kine-travail` | blanc | femme | 50 |
| `sse-sophrologue` | blanc | homme | 50 |
| `sse-medecin-chef` | asiatique | femme | 40 |
| `sse-secouriste` | blanc | homme | 30 |
| `sse-chef-secours` | maghrebin | femme | 40 |
| `sse-agent-entretien` | blanc | homme | 50 |
| `sse-responsable-hygiene` | autre | femme | 20 |
| `sse-psychologue` | blanc | homme | 30 |
| `sse-psychiatre` | noir | femme | 40 |
| `sse-dieteticien` | blanc | homme | 60 |
| `sse-nutritionniste` | metis | femme | 50 |
| `sse-interne` | blanc | homme | 20 |
| `sse-infirmier-volant` | blanc | femme | 30 |
| `sse-pompier-volontaire` | maghrebin | homme | 40 |
| `sse-medecin-sport` | blanc | femme | 20 |
| `sse-assistante-sociale` | blanc | femme | 40 |
| `sse-controleur-securite` | noir | femme | 30 |
| `sse-responsable-securite` | blanc | homme | 50 |
| `sse-brancardier` | metis | femme | 40 |
| `sse-medecin-legiste` | blanc | homme | 60 |
| `sse-medecin-chef-ex` | maghrebin | femme | 30 |
| `sse-responsable-sse-ex` | blanc | homme | 50 |

<!-- management — 21 cartes -->
| `management-jeune-manager` | blanc | homme | 20 |
| `management-chef-de-projet` | maghrebin | homme | 40 |
| `management-technico-commercial` | blanc | homme | 30 |
| `management-assistant-manager` | blanc | femme | 20 |
| `management-superviseur` | noir | homme | 40 |
| `management-animateur-equipe` | blanc | femme | 50 |
| `management-chargee-clientele` | metis | femme | 30 |
| `management-planificateur` | blanc | femme | 40 |
| `management-controleur-gestion` | blanc | homme | 60 |
| `management-chef-equipe` | asiatique | femme | 30 |
| `management-charge-affaires` | blanc | homme | 50 |
| `management-manager-proximite` | maghrebin | femme | 40 |
| `management-responsable-projet` | blanc | homme | 20 |
| `management-responsable-commercial` | autre | femme | 40 |
| `management-chef-service` | blanc | homme | 30 |
| `management-responsable-production` | blanc | femme | 50 |
| `management-responsable-unite` | noir | homme | 40 |
| `management-directeur-projet` | blanc | femme | 60 |
| `management-directeur-production` | blanc | homme | 30 |
| `management-directeur-service` | maghrebin | femme | 50 |
| `management-responsable-unite-ex` | blanc | homme | 40 |

<!-- qvt — 37 cartes -->
| `qvt-charge-qvt` | blanc | femme | 20 |
| `qvt-happiness-manager` | maghrebin | femme | 30 |
| `qvt-chief-happiness-officer` | blanc | femme | 40 |
| `qvt-animateur-bien-etre` | noir | femme | 50 |
| `qvt-responsable-qvt` | blanc | homme | 30 |
| `qvt-directeur-qvt` | blanc | femme | 40 |
| `qvt-coach-sante` | metis | homme | 60 |
| `qvt-expert-bien-etre` | blanc | femme | 20 |
| `qvt-coordinateur-flux` | asiatique | homme | 30 |
| `qvt-optimiseur-process` | blanc | femme | 40 |
| `qvt-referent-qvt` | blanc | homme | 50 |
| `qvt-chef-projet-qvt` | maghrebin | femme | 40 |
| `qvt-charge-mission` | blanc | homme | 30 |
| `qvt-facilitateur` | noir | femme | 50 |
| `qvt-charge-logistique` | blanc | homme | 40 |
| `qvt-responsable-evenementiel` | blanc | femme | 30 |
| `qvt-charge-ergonomie` | autre | homme | 60 |
| `qvt-gestionnaire-moyens-generaux` | blanc | femme | 20 |
| `qvt-charge-environnement-travail` | maghrebin | homme | 40 |
| `qvt-masseur-kinesitherapeute` | blanc | femme | 50 |
| `qvt-charge-integration` | metis | homme | 30 |
| `qvt-responsable-integration` | blanc | femme | 40 |
| `qvt-conseiller-evolution-professionnelle` | blanc | homme | 50 |
| `qvt-responsable-developpement-competences` | noir | femme | 30 |
| `qvt-consultant-qvt` | blanc | homme | 40 |
| `qvt-responsable-experience-collaborateur` | maghrebin | femme | 20 |
| `qvt-charge-formation` | blanc | homme | 60 |
| `qvt-chef-projet-formation` | blanc | femme | 30 |
| `qvt-charge-engagement` | asiatique | homme | 40 |
| `qvt-responsable-engagement` | blanc | femme | 50 |
| `qvt-chief-happiness-officer-ex` | metis | homme | 40 |
| `qvt-assistant-qvt` | blanc | femme | 30 |
| `qvt-charge-communication-interne` | blanc | homme | 20 |
| `qvt-charge-evenements-internes` | noir | femme | 50 |
| `qvt-charge-mobilite-interne` | blanc | homme | 20 |
| `qvt-charge-vie-associative` | maghrebin | femme | 20 |
| `qvt-directeur-qvt-ex` | blanc | homme | 40 |

<!-- amelioration — 18 cartes -->
| `amelioration-charge-qualite` | blanc | femme | 30 |
| `amelioration-auditeur-qualite` | blanc | homme | 60 |
| `amelioration-directeur-qualite` | maghrebin | femme | 40 |
| `amelioration-consultant-lean` | blanc | homme | 50 |
| `amelioration-responsable-process` | noir | femme | 30 |
| `amelioration-responsable-amelioration-continue` | blanc | homme | 40 |
| `amelioration-gestionnaire-flux` | metis | femme | 20 |
| `amelioration-responsable-flux` | blanc | homme | 30 |
| `amelioration-directeur-flux` | blanc | femme | 50 |
| `amelioration-auditeur-interne` | asiatique | homme | 20 |
| `amelioration-responsable-audit` | blanc | femme | 40 |
| `amelioration-directeur-audit-interne` | autre | homme | 20 |
| `amelioration-charge-amelioration` | blanc | femme | 60 |
| `amelioration-charge-process` | maghrebin | homme | 30 |
| `amelioration-controleur-qualite` | blanc | femme | 40 |
| `amelioration-chef-projet-qualite` | blanc | homme | 50 |
| `amelioration-stagiaire-qualite` | noir | femme | 20 |
| `amelioration-directeur-qualite-ex` | blanc | homme | 30 |

<!-- rh — 25 cartes -->
| `rh-assistant-rh` | blanc | femme | 40 |
| `rh-charge-recrutement` | maghrebin | femme | 20 |
| `rh-drh` | blanc | homme | 50 |
| `rh-charge-sourcing` | blanc | femme | 40 |
| `rh-chasseur-tetes` | noir | homme | 30 |
| `rh-directeur-talents` | blanc | femme | 60 |
| `rh-gestionnaire-formation` | metis | homme | 40 |
| `rh-responsable-formation` | blanc | femme | 50 |
| `rh-drh-formation` | asiatique | homme | 30 |
| `rh-responsable-comp-ben` | blanc | femme | 20 |
| `rh-juriste-social` | blanc | homme | 40 |
| `rh-responsable-relations-sociales` | autre | femme | 30 |
| `rh-drh-juridique` | blanc | homme | 50 |
| `rh-charge-diversite` | maghrebin | femme | 40 |
| `rh-responsable-inclusion` | blanc | homme | 60 |
| `rh-drh-diversite` | blanc | femme | 30 |
| `rh-charge-mobilite` | noir | homme | 40 |
| `rh-gestionnaire-rh` | blanc | femme | 50 |
| `rh-assistant-paie` | metis | homme | 20 |
| `rh-referent-handicap` | blanc | femme | 40 |
| `rh-charge-prevention` | asiatique | homme | 30 |
| `rh-charge-offboarding` | blanc | femme | 50 |
| `rh-charge-sirh` | blanc | homme | 40 |
| `rh-drh-ex` | maghrebin | femme | 30 |
| `rh-directeur-talents-ex` | blanc | homme | 60 |

<!-- atelier — 26 cartes -->
| `atelier-joueur-de-flute` | blanc | homme | 20 |
| `atelier-technicien-systeme` | blanc | homme | 30 |
| `atelier-responsable-process` | maghrebin | homme | 30 |
| `atelier-opticien` | blanc | homme | 20 |
| `atelier-rpo` | noir | femme | 40 |
| `atelier-rui` | blanc | homme | 30 |
| `atelier-regleur` | metis | femme | 50 |
| `atelier-rpi` | blanc | homme | 40 |
| `atelier-responsable-flux` | blanc | femme | 60 |
| `atelier-controleur-vibration` | asiatique | homme | 30 |
| `atelier-responsable-qualite` | blanc | femme | 40 |
| `atelier-mecanicien` | autre | homme | 20 |
| `atelier-gestionnaire-fod` | blanc | femme | 50 |
| `atelier-monteur-optique` | maghrebin | homme | 30 |
| `atelier-technicien-banc-essai` | blanc | femme | 40 |
| `atelier-pointeur` | blanc | homme | 50 |
| `atelier-ordonnanceur` | noir | femme | 40 |
| `atelier-responsable-pole` | blanc | homme | 30 |
| `atelier-cariste-salle-blanche` | blanc | femme | 60 |
| `atelier-planificateur-moyens-essai` | metis | homme | 20 |
| `atelier-gardien-usine` | blanc | femme | 40 |
| `atelier-magasinier` | blanc | homme | 30 |
| `atelier-assistant-rpo` | maghrebin | femme | 50 |
| `atelier-agent-maintenance` | blanc | homme | 40 |
| `atelier-rpo-sans-rui-ex` | noir | femme | 30 |
| `atelier-rui-non-toxique-ex` | blanc | homme | 50 |

<!-- direction — 16 cartes -->
| `direction-chef-projet-fantome` | blanc | femme | 40 |
| `direction-directeur-adjoint` | blanc | homme | 20 |
| `direction-pdg` | maghrebin | femme | 60 |
| `direction-pdg-ex` | blanc | homme | 30 |
| `direction-directeur-fantome` | noir | femme | 40 |
| `direction-directeur-regional` | blanc | homme | 50 |
| `direction-directeur-general` | metis | femme | 30 |
| `direction-assistant-direction` | blanc | homme | 40 |
| `direction-chef-cabinet` | blanc | femme | 20 |
| `direction-secretaire-direction` | asiatique | homme | 50 |
| `direction-directeur-programme` | blanc | femme | 40 |
| `direction-directeur-cabinet` | autre | homme | 30 |
| `direction-directeur-strategie` | blanc | femme | 60 |
| `direction-stagiaire-direction` | blanc | homme | 20 |
| `direction-auditeur-direction` | maghrebin | femme | 40 |
| `direction-commissaire-comptes` | blanc | homme | 30 |

<!-- syndicat — 10 cartes -->
| `syndicat-delegue-personnel` | blanc | femme | 50 |
| `syndicat-representant-cse` | autre | homme | 40 |
| `syndicat-secretaire-general` | blanc | femme | 30 |
| `syndicat-secretaire-general-ex` | maghrebin | homme | 20 |
| `syndicat-tresorier-cse` | blanc | femme | 40 |
| `syndicat-president-cse` | noir | homme | 50 |
| `syndicat-delegue-syndical` | metis | femme | 30 |
| `syndicat-permanent-syndical` | blanc | homme | 60 |
| `syndicat-collectif-atelier` | autre | femme | 40 |
| `syndicat-representant-section` | blanc | homme | 50 |

<!-- interim — 10 cartes -->
| `interim-interimaire` | blanc | femme | 30 |
| `interim-interimaire-confirme` | maghrebin | homme | 40 |
| `interim-chef-equipe-interimaire` | blanc | femme | 20 |
| `interim-interimaire-legendaire-ex` | noir | homme | 40 |
| `interim-consultant-interimaire` | blanc | femme | 50 |
| `interim-responsable-interim` | blanc | homme | 30 |
| `interim-vacataire` | metis | femme | 60 |
| `interim-charge-mission` | autre | homme | 40 |
| `interim-coordinateur-interimaire` | blanc | femme | 30 |
| `interim-suppleant` | blanc | homme | 50 |

<!-- support — 31 cartes -->
| `support-agent-support` | blanc | femme | 40 |
| `support-technicien-support` | blanc | femme | 20 |
| `support-responsable-support` | maghrebin | homme | 30 |
| `support-responsable-support-ex` | blanc | femme | 40 |
| `support-standardiste` | noir | homme | 50 |
| `support-assistant-direction` | blanc | femme | 30 |
| `support-responsable-services-generaux` | metis | homme | 60 |
| `support-technicien-micro-informatique` | blanc | femme | 40 |
| `support-administrateur-systemes` | asiatique | homme | 50 |
| `support-ingenieur-systemes` | blanc | femme | 20 |
| `support-redacteur-technique` | blanc | homme | 30 |
| `support-charge-documentation` | autre | femme | 40 |
| `support-responsable-documentation` | blanc | homme | 40 |
| `support-technicien-reseau` | blanc | femme | 30 |
| `support-administrateur-reseau` | maghrebin | homme | 50 |
| `support-correspondant-informatique` | blanc | femme | 60 |
| `support-referent-informatique` | noir | homme | 40 |
| `support-assistant-methodes` | blanc | femme | 30 |
| `support-technicien-methodes` | metis | homme | 20 |
| `support-formateur-informatique` | blanc | femme | 50 |
| `support-charge-formation-informatique` | blanc | homme | 40 |
| `support-gestionnaire-tickets` | blanc | femme | 30 |
| `support-superviseur-support` | asiatique | homme | 40 |
| `support-assistant-administratif` | blanc | femme | 50 |
| `support-archiviste` | maghrebin | homme | 30 |
| `support-receptionniste` | blanc | femme | 60 |
| `support-teleconseiller` | noir | homme | 40 |
| `support-operateur-saisie` | blanc | femme | 20 |
| `support-testeur-logiciel` | metis | homme | 50 |
| `support-coordinateur-support` | blanc | femme | 30 |
| `support-ingenieur-systemes-ex` | blanc | homme | 40 |
