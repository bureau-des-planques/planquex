# #320 — « Fin du tour » sous la barre de navigation (420 × 900)

Même état avant / après : graine figée `2026-10-22T09:00Z`, pas-à-pas ouvert, tour 3, un café SSE
attaché, une Pression jouable (« Massage cardiaque »).

| | avant | après |
|---|---|---|
| Fichier | `avant-420-tour3-pression.png` | `apres-420-tour3-pression.png` |
| Barre d'action | 731 → **836** px (navigation à 830) | 731 → **809** px |
| « Fin du tour » | bas à **834** px, rogné | 733 → **770** px |
| Défilement de la page | **24** px | **0** |

Mesures : `npm run capturer`, états « Pression jouable » (`jusquAUnePression`), quatre graines × pas-à-pas
ouvert / terminé. Sur le code d'avant, la même commande échoue sur les quatre graines du pas-à-pas ouvert
(« « Fin du tour » n'est pas visible sans défiler : bas à 834 px, barre de navigation à 830 px ») ; sur le
code d'après, elle passe, marge la plus faible 21 px (D-094 (3) exige 20).

## Suite : les 44 px tenus (même ticket)

Les boutons de la barre d'action et ceux de la ligne du pas-à-pas (« Suivant », « Plus ») passent de 36 /
33 px à **44 px** ; la hauteur est gagnée ailleurs, **sans toucher aux cartes** (D-094 (1)) :

| Poste de hauteur (pas-à-pas ouvert, tour 3, Pression jouable) | gain |
|---|---|
| marge haute de l'écran de combat (`.main`) 9,6 → 3,2 px | 6,4 px |
| gouttière `.battle` 3,2 → 1,6 px (3 gouttières) | 4,8 px |
| cadre du pas-à-pas 4 → 1,6 px | 4,8 px |
| cadre et gouttière de la barre 3,2 + 0,8 → 0 | 4 px |
| main : interligne du titre (1,5 → 1,2) et soulèvement (9,6 → 6,4 px) | 8 px |
| **gain total** | **~28 px** |
| coût brut des 44 px : barre +16 px (deux rangées de 44), pas-à-pas +8 px (ligne de 44) | −24 px |
| **solde** : bas de la barre 809 → 806 px | +3 px |

Mesuré par `npm run capturer` (16 états) : défilement 0, aucun bouton sous 44 px, marge de la barre sous la
navigation **24 px au plus juste** (D-094 (3) : 20), « Fin du tour » 717 → 761 px. Fichiers
`apres-44px-*.png` (420 × 900). Sur le code précédent, la même commande échoue : « Fin du tour » à 36 px,
« Suivant » à 33,3 px, les boutons de Rotation, d'attache de café et de Pression à 36 px.
