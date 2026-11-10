# Icônes de profil (D-197 (2))

Manifeste hors de `public/` (le garde `scripts/gardes/precache.test.ts` refuse tout non-précaché). Les 12 images sont dans `public/design/profils/`.

Douze portraits de planqués pour le profil joueur. Source : gflow (MCP), modèle `nano2`, ratio 1:1,
généré le 10/11/2026, recadré carré et réduit à 512×512 en WebP (qualité 85, 17 à 38 Ko). Images **non vérifiées
visuellement** par l'agent producteur : curation humaine à faire (visages, mains, texte parasite, lisibilité à 48 et 96 px).
Le fond « bleu nuit » est demandé au prompt, sans garantie de la teinte exacte `#0b1220`.

## Liste fermée des slugs (pour le futur check en base, format `^[a-z0-9]+(-[a-z0-9]+)*$`)

```json
[
  "agent-accueil",
  "controleuse",
  "technicien",
  "comptable",
  "cheffe-projet",
  "developpeur",
  "gestionnaire-rh",
  "chef-atelier",
  "charge-communication",
  "archiviste",
  "juriste",
  "logisticien"
]
```

## Manifeste

Prompt = gabarit commun où `X` est remplacé par le sujet (modèle `nano2` pour toutes) :
`Painted semi-realistic illustration, head-and-shoulders portrait of X, warm soft light on the face, thin gold rim light, plain deep midnight-blue background, subtle grain, square composition, no text.`

| Slug | Fichier | Description | Modèle | Date | Sujet (X) |
|---|---|---|---|---|---|
| `agent-accueil` | `agent-accueil.webp` | Agent d'accueil (casque, badge) | nano2 | 2026-11-10 | a cheerful receptionist with a headset |
| `controleuse` | `controleuse.webp` | Contrôleuse (lunettes, bloc-notes) | nano2 | 2026-11-10 | a stern but kind auditor woman with glasses and a clipboard |
| `technicien` | `technicien.webp` | Technicien (tournevis, portable) | nano2 | 2026-11-10 | a young technician man with a screwdriver in his shirt pocket and a laptop |
| `comptable` | `comptable.webp` | Comptable, homme âgé noir, lunettes | nano2 | 2026-11-10 | an older Black man, accountant, with reading glasses and a calm smile |
| `cheffe-projet` | `cheffe-projet.webp` | Cheffe de projet, voile, tasse | nano2 | 2026-11-10 | a woman wearing a hijab, project manager, holding a coffee mug, tired but placid |
| `developpeur` | `developpeur.webp` | Développeur, casque autour du cou | nano2 | 2026-11-10 | a young East Asian man, developer, with headphones around the neck and a hoodie under a blazer |
| `gestionnaire-rh` | `gestionnaire-rh.webp` | Gestionnaire RH, cheveux gris | nano2 | 2026-11-10 | a middle-aged woman, human resources officer, short grey hair, warm welcoming smile |
| `chef-atelier` | `chef-atelier.webp` | Chef d'atelier, casque de chantier, gilet | nano2 | 2026-11-10 | a man with a beard in a hard hat and high-visibility vest, workshop foreman, friendly weary look |
| `charge-communication` | `charge-communication.webp` | Chargée de communication, tablette | nano2 | 2026-11-10 | a young Latina woman, communications officer, with a stylus and tablet, curly hair |
| `archiviste` | `archiviste.webp` | Archiviste, cardigan, dossiers | nano2 | 2026-11-10 | an older South Asian man, archivist, with a cardigan and a stack of folders, gentle patient expression |
| `juriste` | `juriste.webp` | Juriste, blazer noir, tresses, **assise dans un fauteuil roulant de bureau** (voir la note sous le tableau) | nano2 | 2026-11-10 | a woman using a wheelchair-free office setting, legal advisor, black blazer, braided hair, confident calm look |
| `logisticien` | `logisticien.webp` | Logisticien, casquette, colis | nano2 | 2026-11-10 | a young man, mailroom and logistics clerk, with a cap, a parcel and a lanyard, cheerful sleepy expression |

Premier essai rejeté par Flow (politique de contenu, prompt trop long et détaillé) : refait avec le gabarit court.

## Notes de contrôle (10/11/2026)

- **`juriste`** : le prompt consigné ci-dessus contient la formule fautive « wheelchair-free office setting » ; le modèle l'a lue
  à l'envers et a rendu une femme **en fauteuil roulant**. Le portrait est respectueux et cohérent avec les onze autres ; il est
  conservé tel quel, à valider par le propriétaire (sinon : régénérer sans cette formule).
- Les douze images ont été **regardées** sur une planche-contact à 240, 96 et 48 px : cadrage carré, fond bleu nuit, visages
  lisibles à 48 px, aucune caricature visible.
