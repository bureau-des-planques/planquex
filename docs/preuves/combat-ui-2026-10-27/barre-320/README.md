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
