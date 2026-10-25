# Sujets — une ligne par carte de base

> **Le plan de travail de #121** (`docs/SPEC-ILLUSTRATIONS.md` §3, §4 et §5) : le sujet de
> chaque **carte de base**, en **anglais** (les modèles d'image répondent mieux), avec
> l'`id` de la carte comme clé. Il vit **ici**, jamais dans `src/data` (Q1) : c'est une
> donnée de production, pas du jeu.
>
> L'**accent** n'est **pas** ici : il est **par faction**, dans `ACCENTS-flow.md` (D-046).
> Recopier un accent sur une ligne de sujet serait la seconde source que D-046 supprime.
>
> **La source des `id` est le code** (`src/data/**`), et le compte se lit avec
> `npm run status` (`cards.base`). Ce fichier ne recopie **aucun** nombre : la garde
> (`scripts/illustration-vague.test.ts`) compare ses lignes à `ALL_CARDS` **dans les deux
> sens** — une carte manquante, une ligne orpheline.

## Le format

Un **Planqué** — cinq créneaux, séparés par des virgules, **dans cet ordre** :

```text
<rôle>, <tenue>, holding <objet tenu>, <geste>, <expression>
```

- **rôle** : qui c'est, avec son article (`a site nurse`, `the chief physician`) ;
- **tenue** : ce qu'il porte, et **un** mot de vêtement (`coat`, `overalls`, `scrubs`…) ;
- **objet tenu** : `holding ` + **un seul** objet — c'est lui qui dit le métier ;
- **geste** : ce qu'il fait, à un verbe en `-ing` (`leaning`, `checking`, `running`…) ;
- **expression** : ce que dit son visage (`weary`, `smug`, `kind`…).

Le prompt final reste celui de `PROMPTS-flow.md` :
`<socle aplati> <sujet>, muted <accent> accent.` — donc **pas de virgule en trop** et
**un seul objet** par sujet : deux objets concurrents sont l'« à éviter » de la planche
Portrait.

Une **carte Action** (les Collègues et les Objets) suit la planche **Objet** (Q4′) : un
**objet symbolique unique**, **sans personne**, donc sans les cinq créneaux — la ligne
commence par un article, ne tient rien et ne fait rien.

## Le rang est un modificateur, pas un sujet neuf (Q10)

Une ligne d'évolution **garde la racine** de son Entrant — même métier, même service —
et change de **rang** : la tenue se gagne (`a white coat with gold piping`), l'objet
devient celui du poste, le geste se fige. Deux cartes d'une même ligne ne partagent donc
**jamais** le couple objet + geste : la répétition à l'identique est un défaut (D-065,
critère 5), et la garde la refuse.

## La table

| Carte (`id`) | Sujet |
|---|---|
| `sse-infirmier-site` | a site nurse, in pale blue scrubs with a paper cap, holding a clipboard, leaning against the workshop door, tired but kind |
| `sse-infirmiere-travail` | a work nurse, in a white tunic with a lanyard, holding a blood-pressure cuff, crouching beside an office chair, patient and grave |
| `sse-medecin-travail` | a workplace doctor, in a white coat over a grey shirt, holding a clipboard, sitting behind a steel desk, calm and weary |
| `sse-preventeur` | a prevention officer, in a hi-vis vest over a dark shirt, holding a hard hat, checking a stairwell rail, watchful and unimpressed |
| `sse-ergonome` | an ergonomist, in a knitted cardigan and trousers, holding a tape measure, measuring a desk edge, focused and mildly smug |
| `sse-responsable-sse` | a health-and-safety manager, in a grey suit with a hi-vis armband, holding a protocol binder, standing before a noticeboard, stern and resigned |
| `sse-kine-travail` | a physiotherapist, in navy scrubs with rolled sleeves, holding a massage ball, pressing a colleague's shoulder, encouraging and tired |
| `sse-sophrologue` | a sophrologist, in a loose linen blouse, holding a small brass bell, standing in a humming corridor, calm and serene |
| `sse-medecin-chef` | a chief physician, in a long white coat with a stethoscope, holding an ink stamp, sitting behind a heavy desk, severe and bored |
| `sse-secouriste` | a first-aider, in a red tabard over overalls, holding a first-aid box, running up a metal staircase, alarmed but hopeful |
| `sse-chef-secours` | a rescue team leader, in a red jacket with reflective bands, holding a two-way radio, waving a crowd back from a loading bay, calm under pressure |
| `sse-agent-entretien` | a cleaner, in a blue tabard and rubber gloves, holding a mop, wiping a corridor floor, placid and unbothered |
| `sse-responsable-hygiene` | a hygiene manager, in a white smock over a shirt, holding a swab kit, inspecting a canteen counter, precise and suspicious |
| `sse-psychologue` | a work psychologist, in a soft grey suit, holding a notebook, listening towards an empty chair, kind and slightly sad |
| `sse-psychiatre` | a work psychiatrist, in a dark suit with a stethoscope, holding a prescription sheet, leaning on a filing cabinet, dry and detached |
| `sse-dieteticien` | a dietitian, in a mint-green apron over a shirt, holding a tray of steamed vegetables, pointing at a canteen menu, earnest and apologetic |
| `sse-nutritionniste` | a nutritionist, in a white blouse with a badge, holding a sugar packet, reading a vending-machine label, doubtful and polite |
| `sse-interne` | a medical intern, in crumpled scrubs and a stethoscope, holding three stacked files, running through a hospital corridor, exhausted but eager |
| `sse-infirmier-volant` | a roving nurse, in a light blue uniform with a shoulder bag, holding a thermometer, stepping off a freight lift, brisk and unbothered |
| `sse-pompier-volontaire` | a volunteer firefighter, in a beige turnout coat, holding a fire extinguisher, jogging across a factory yard, determined and late |
| `sse-medecin-sport` | a sports physician, in a tracksuit jacket over scrubs, holding a cold pack, kneeling by a sprained ankle, sympathetic and brisk |
| `sse-assistante-sociale` | a social worker, in a wool coat with a tote bag, holding a thin case file, standing in a waiting room, kind and overworked |
| `sse-controleur-securite` | a safety inspector, in a grey jacket with a hi-vis armband, holding an exit checklist, testing a fire door, methodical and grim |
| `sse-responsable-securite` | a security manager, in a dark suit and a safety helmet, holding a site map, standing on a mezzanine, vigilant and tired |
| `sse-brancardier` | a stretcher-bearer, in green overalls, holding a folded stretcher, waiting by a lift with no light, stoic and patient |
| `sse-medecin-legiste` | a forensic doctor, in a white coat and blue gloves, holding a slim metal case, standing in a cold tiled room, wry and unshockable |
| `sse-medecin-chef-ex` | the hospital's chief physician, in a white coat with gold piping, holding an embossed seal, pausing in a boardroom doorway, imperious and weary |
| `sse-responsable-sse-ex` | a regional health-and-safety director, in a dark suit with a hi-vis stripe, holding a signed prevention plan, stepping onto a factory floor, grim and determined |
| `management-jeune-manager` | a junior manager, in a cheap slim suit, holding a single post-it, rehearsing in front of a whiteboard, bright and nervous |
| `management-chef-de-projet` | a project manager, in a checked shirt with rolled sleeves, holding three rolled-up schedules, juggling them against the wall, overworked and earnest |
| `management-technico-commercial` | a technical sales rep, in a navy blazer over a polo, holding a signed quote, leaning on a client's desk, cheerful and late |
| `management-assistant-manager` | an assistant manager, in a grey suit with a lanyard, holding a laminated dashboard, walking behind a colleague, polite and impatient |
| `management-superviseur` | a shift supervisor, in a dark blue jacket with a whistle, holding a briefing sheet, standing on a catwalk over the line, stern and tired |
| `management-animateur-equipe` | a team facilitator, in a soft knit sweater, holding a marker pen, drawing circles on a flip chart, cheerful and encouraging |
| `management-chargee-clientele` | a customer accounts officer, in a fitted blouse with a headset, holding a folder of reminders, speaking into the headset, apologetic and brisk |
| `management-planificateur` | a planner, in a company polo and trousers, holding a printed schedule, pinning it over an older one, focused and doubtful |
| `management-controleur-gestion` | a management controller, in a dark suit and thin tie, holding a spreadsheet printout, walking away from a whiteboard, dry and smug |
| `management-chef-equipe` | a team leader, in a hi-vis waistcoat over a shirt, holding a clipboard of orders, relaying it to the bench, grave and methodical |
| `management-charge-affaires` | a business developer, in a grey suit with an open collar, holding a leather quote folder, closing a meeting-room door, cheerful and determined |
| `management-manager-proximite` | a line manager, in a navy jacket with a badge, holding a phone at arm's length, typing a mail while walking, distracted and polite |
| `management-responsable-projet` | a project owner, in a grey suit with a project lanyard, holding a milestone chart, pointing at a date nobody believes, confident and tired |
| `management-responsable-commercial` | a sales manager, in a dark suit with a red tie, holding a discount sheet, shaking hands across a table, cheerful and smug |
| `management-chef-service` | a department head, in a charcoal suit, holding a signature pen, standing behind a junior's chair, impatient and polite |
| `management-responsable-production` | a production manager, in a white hard hat and a grey jacket, holding a stopwatch, watching a conveyor line, stern and overworked |
| `management-responsable-unite` | a middle manager, in a pressed suit and a clipboard, holding a unit report, standing outside a meeting room, slightly smug |
| `management-directeur-projet` | a programme director, in a dark suit and a visitor badge, holding a delivery certificate, walking into a handover meeting, calm and determined |
| `management-directeur-production` | a production director, in a grey suit with steel-toe boots, holding a capacity chart, striding along the line, grim and determined |
| `management-directeur-service` | a service director, in a black suit with a gold pin, holding three objective cards, fanning them out, bored and smug |
| `management-responsable-unite-ex` | a senior middle manager, in a midnight suit with gold cufflinks, holding a unit plaque, posing for a team photo, smug and weary |
| `qvt-charge-qvt` | a quality-of-life officer, in a knitted vest over a shirt, holding a net of clementines, setting it on a shared desk, cheerful and overworked |
| `qvt-happiness-manager` | a happiness manager, in a bright yellow cardigan, holding a bundle of balloons, crossing an open-plan floor, cheerful and nervous |
| `qvt-chief-happiness-officer` | a chief happiness officer, in a pale aqua suit, holding a bouquet of balloons, posing under an office banner, bright and smug |
| `qvt-animateur-bien-etre` | a wellbeing host, in a soft fleece with a whistle, holding a portable speaker, starting a stretch break between desks, cheerful and brisk |
| `qvt-responsable-qvt` | a wellbeing manager, in a linen jacket over a blouse, holding a stack of survey replies, standing at a printer, resigned and polite |
| `qvt-directeur-qvt` | a wellbeing director, in a pale blue suit, holding a budget folder, walking out of a boardroom, calm and detached |
| `qvt-coach-sante` | a health coach, in a fitted sports jacket, holding a step counter, pacing a corridor, encouraging and brisk |
| `qvt-expert-bien-etre` | a wellbeing expert, in a cream blouse and trousers, holding a framed certificate, standing by a repurposed gym, serene and smug |
| `qvt-coordinateur-flux` | a flow officer, in a grey polo and trousers, holding a process diagram, tracing an arrow on a whiteboard, focused and doubtful |
| `qvt-optimiseur-process` | a process optimiser, in a slim grey suit, holding a stopwatch, timing a meeting from the doorway, dry and smug |
| `qvt-referent-qvt` | a wellbeing correspondent, in a company polo with a lanyard, holding a reminder postcard, pinning it to a crowded board, tired and polite |
| `qvt-chef-projet-qvt` | a wellbeing project lead, in a navy blazer, holding a project charter, presenting it to three empty chairs, earnest and nervous |
| `qvt-charge-mission` | a kindness ambassador, in a soft grey sweater, holding a pack of post-its, sticking one on a colleague's screen, cheerful and apologetic |
| `qvt-facilitateur` | a facilitator, in a loose shirt with rolled sleeves, holding a talking stick, sitting in a circle of empty chairs, calm and encouraging |
| `qvt-charge-logistique` | a logistics officer, in a hi-vis vest over a shirt, holding a delivery manifest, checking a pallet at a loading bay, tired and precise |
| `qvt-responsable-evenementiel` | an events organiser, in a dark shirt with a phone holster, holding a bar reservation, checking it by a lift, cheerful and overworked |
| `qvt-charge-ergonomie` | an ergonomics officer, in a grey wrap top and loose trousers, holding a foam roller, demonstrating a posture by a desk, serene and encouraging |
| `qvt-gestionnaire-moyens-generaux` | a facilities host, in a blue work jacket, holding a coffee-machine key, kneeling to unblock the machine, patient and grim |
| `qvt-charge-environnement-travail` | a workplace environment officer, in a canvas apron over a shirt, holding a potted ficus, wedging it between two desks, cheerful and determined |
| `qvt-masseur-kinesitherapeute` | a massage therapist, in a white polo and trousers, holding a folded massage stool, setting it up behind a chair, calm and brisk |
| `qvt-charge-integration` | an onboarding officer, in a light blue shirt with a lanyard, holding a welcome booklet, walking a newcomer down a corridor, cheerful and brisk |
| `qvt-responsable-integration` | an onboarding manager, in a navy cardigan, holding a signed induction sheet, standing at the end of a corridor, polite and tired |
| `qvt-conseiller-evolution-professionnelle` | a career adviser, in a soft tweed jacket, holding a skills passport, sitting across a small table, kind and doubtful |
| `qvt-responsable-developpement-competences` | a skills development manager, in a grey suit with a lanyard, holding a training catalogue, closing it on a desk, resigned and polite |
| `qvt-consultant-qvt` | a wellbeing consultant, in a sharp pale suit, holding a diagnostic report, walking away from a site visit, bright and detached |
| `qvt-responsable-experience-collaborateur` | an employee experience lead, in a dove-grey suit, holding a journey map, unrolling it across a table, focused and smug |
| `qvt-charge-formation` | a training officer, in a checked shirt with a lanyard, holding a stack of convocations, handing one over an empty desk, apologetic and brisk |
| `qvt-chef-projet-formation` | a training project lead, in a navy jacket, holding a signed attendance sheet, standing by a blank projector, calm and resigned |
| `qvt-charge-engagement` | an engagement officer, in a light knit sweater, holding a barometer chart, pinning it above the coffee machine, hopeful and tired |
| `qvt-responsable-engagement` | an engagement manager, in a grey blazer over a polo, holding a small trophy, lifting it towards an empty room, cheerful and dry |
| `qvt-chief-happiness-officer-ex` | the group's happiness officer, in an aqua suit with gold trim, holding a framed happiness contract, standing on a small stage, bright and imperious |
| `qvt-assistant-qvt` | a wellbeing assistant, in a company hoodie, holding a fruit invoice, sorting it in a supply cupboard, tired and polite |
| `qvt-charge-communication-interne` | an internal communication officer, in a crisp shirt and cardigan, holding a mock-up newsletter, taping it to a lift door, cheerful and precise |
| `qvt-charge-evenements-internes` | an internal events officer, in a dark blouse with a badge, holding a folding seminar backdrop, struggling with it alone, determined and overworked |
| `qvt-charge-mobilite-interne` | an internal mobility officer, in a navy blouse, holding a transfer form, standing by a sealed lift, hopeful and resigned |
| `qvt-charge-vie-associative` | a staff-life officer, in a sports club jacket, holding a small cup, polishing it on a shelf, cheerful and bored |
| `qvt-directeur-qvt-ex` | a group wellbeing director, in a pale blue suit with gold trim, holding a bonus cheque, raising it at a town hall, smiling and detached |
| `amelioration-charge-qualite` | a quality officer, in a light grey shirt with a lanyard, holding a tick-box form, ticking a box in a doorway, tired and polite |
| `amelioration-auditeur-qualite` | a quality auditor, in a navy jacket over a shirt, holding an audit grid, crouching by a workbench, focused and suspicious |
| `amelioration-directeur-qualite` | a quality director, in a dark suit with a plain tie, holding a thick procedures binder, standing before a shelf of binders, weary and stern |
| `amelioration-consultant-lean` | a lean consultant, in a sharp grey suit with no tie, holding a stopwatch, circling a workbench, bright and smug |
| `amelioration-responsable-process` | a process owner, in a pale blue shirt with rolled sleeves, holding a process map, pinning it over an older map, resigned and focused |
| `amelioration-responsable-amelioration-continue` | a continuous improvement manager, in a grey cardigan and trousers, holding a kanban card, moving it to a full column, calm and dry |
| `amelioration-gestionnaire-flux` | a flow planner, in a company polo and trousers, holding a flow chart, tracing a bottleneck on the floor, doubtful and focused |
| `amelioration-responsable-flux` | a flow manager, in a navy fleece, holding a shift plan, crossing out a line on it, grim and methodical |
| `amelioration-directeur-flux` | a flow director, in a charcoal suit, holding a throughput chart, walking down a warehouse aisle, smug and bored |
| `amelioration-auditeur-interne` | an internal auditor, in a dark suit with a visitor badge, holding a sealed sample bag, inspecting a parts bin, precise and unimpressed |
| `amelioration-responsable-audit` | an audit manager, in a grey suit with a red folder, holding an open finding, sitting across a table, severe and calm |
| `amelioration-directeur-audit-interne` | a head of internal audit, in a black suit with a gold pen, holding an audit report, closing it on a boardroom table, dry and imperious |
| `amelioration-charge-amelioration` | a continuous improvement officer, in a light blue polo, holding an improvement board, hanging it in a corridor, hopeful and tired |
| `amelioration-charge-process` | a process officer, in a checked shirt, holding a single procedure page, crossing out a step with a pen, focused and doubtful |
| `amelioration-controleur-qualite` | a quality controller, in a white coat over a polo, holding a caliper, measuring a machined part, precise and bored |
| `amelioration-chef-projet-qualite` | a quality project lead, in a navy blazer, holding a project plan, standing by a milestone wall, calm and determined |
| `amelioration-stagiaire-qualite` | a quality intern, in an oversized shirt and lanyard, holding a clipboard of checklists, trailing after an auditor, eager and nervous |
| `amelioration-directeur-qualite-ex` | a group quality director, in a dark suit with gold trim, holding a gold-sealed binder, presenting it to an empty boardroom, smug and weary |
| `rh-assistant-rh` | an HR assistant, in a pale shirt with a lanyard, holding an application form, filing it in the wrong drawer, polite and distracted |
| `rh-charge-recrutement` | a recruiter, in a navy blouse with a headset, holding a printed CV, scanning it at a desk, cheerful and tired |
| `rh-drh` | an HR director, in a charcoal suit with a lanyard, holding a blank org chart, standing in front of a whiteboard, calm and knowing |
| `rh-charge-sourcing` | a sourcing recruiter, in a dark polo with a headset, holding a phone, messaging a stranger from a lift, cheerful and unbothered |
| `rh-chasseur-tetes` | a headhunter, in a sharp dark suit, holding a salary offer letter, sliding it across a café table, smug and polite |
| `rh-directeur-talents` | a talent director, in a grey suit with a gold pin, holding a shortlist of names, reading it behind a glass wall, smug and detached |
| `rh-gestionnaire-formation` | a training administrator, in a light cardigan, holding a training link, showing it to an empty chair, apologetic and tired |
| `rh-responsable-formation` | a training manager, in a navy jacket with a lanyard, holding a licence invoice, opening it at a desk, grim and resigned |
| `rh-drh-formation` | an HR director for training, in a charcoal suit, holding an expired certificate, pinning it to a board, tired and dry |
| `rh-responsable-comp-ben` | a compensation manager, in a grey shirt with a tie, holding a health-insurance leaflet, comparing two columns, precise and doubtful |
| `rh-juriste-social` | a labour lawyer, in a dark suit with a plain tie, holding a labour code, reading it with heavy eyelids, sleepy and precise |
| `rh-responsable-relations-sociales` | an employee relations manager, in a navy suit, holding a signed agreement, standing at the end of a long table, calm and tired |
| `rh-drh-juridique` | a legal HR director, in a black suit with a red folder, holding a court file, closing it on a desk, dry and smug |
| `rh-charge-diversite` | a diversity officer, in a soft blouse and cardigan, holding a bias workshop sheet, taping it to a meeting-room wall, hopeful and polite |
| `rh-responsable-inclusion` | an inclusion manager, in a grey blazer over a blouse, holding an index chart, presenting it to a leadership row, calm and smug |
| `rh-drh-diversite` | an HR director for diversity, in a pale suit, holding a new signage plan, standing by a closed door, tired and defiant |
| `rh-charge-mobilite` | a mobility officer, in a company polo with a badge, holding a transfer letter, walking it to a sealed office, hopeful and resigned |
| `rh-gestionnaire-rh` | an HR administrator, in a beige cardigan, holding a personnel file, shelving it in an archive, placid and tired |
| `rh-assistant-paie` | a payroll assistant, in a light shirt and tie, holding a payslip printout, checking a bank slip, worried and precise |
| `rh-referent-handicap` | a disability officer, in a navy cardigan with a badge, holding a desk-assessment form, measuring a doorway, patient and tired |
| `rh-charge-prevention` | a prevention officer, in a hi-vis jacket over a shirt, holding a risk questionnaire, reading replies at a desk, grave and polite |
| `rh-charge-offboarding` | an offboarding officer, in a dark blouse with a lanyard, holding a deactivated badge, dropping it in a box, polite and detached |
| `rh-charge-sirh` | an HRIS officer, in a grey hoodie and trousers, holding a hard drive, waiting for an export bar, tired and focused |
| `rh-drh-ex` | a senior HR director, in a midnight suit with gold trim, holding a single dossier, standing in an empty office, imperious and dry |
| `rh-directeur-talents-ex` | a group talent director, in a black suit with gold cufflinks, holding a signed contract, watching the signatory walk away, smug and weary |
| `atelier-joueur-de-flute` | a flute player, in a shirt with rolled sleeves, holding a flute, playing through a team meeting, unbothered |
| `atelier-technicien-systeme` | a systems technician, in a grey polo, holding a power cable, rebooting a server rack, hopeful |
| `atelier-responsable-process` | a process manager, in a suit jacket over overalls, holding a procedure binder, pointing at a flowchart, stern |
| `atelier-opticien` | an optician, in a white lab coat, holding a lens up to the light, adjusting a mount with tweezers, focused and tired |
| `atelier-rpo` | a production manager, in a blue jacket, holding meeting notes, reading a whiteboard, tired |
| `atelier-rui` | a unit manager, in a dark jacket, holding a badge, looking at a distant factory, proud |
| `atelier-regleur` | a setter, in a grey coat, holding a micrometer, adjusting a machine dial, precise and skeptical |
| `atelier-rpi` | an interface manager, in a casual shirt, holding a cable adapter, checking a wall of connectors, nervous and polite |
| `atelier-responsable-flux` | a flow manager, in a hi-vis vest, holding a tablet, watching arrows on a wall map, under pressure |
| `atelier-controleur-vibration` | a vibration tester, in a lab coat, holding ear protectors, watching a shaker table, bored |
| `atelier-responsable-qualite` | a quality manager, in a blazer, holding a stamped form, reviewing a red stamp, stern |
| `atelier-mecanicien` | a mechanic, in a worn blue overall with greasy hands, holding a hammer, listening to a gearbox, focused and placid |
| `atelier-gestionnaire-fod` | a debris manager, in a grey overall, holding a magnet, picking a screw off a clean floor, precise |
| `atelier-monteur-optique` | an optical assembler, in a clean-room suit, holding a lens, placing it in a mount, patient |
| `atelier-technicien-banc-essai` | a test-bench technician, in a navy overall, holding a tablet, checking a bench readout, smug |
| `atelier-pointeur` | a measurer, in a grey overall, holding a precision gauge, measuring a part, doubtful |
| `atelier-ordonnanceur` | a scheduler, in a cardigan, holding a marker, updating a planning board, overworked |
| `atelier-responsable-pole` | a team leader, in a blazer, holding a lanyard, surveying a production floor, proud |
| `atelier-cariste-salle-blanche` | a forklift driver, in a clean-room suit, holding a pallet list, steering through an airlock door, cheerful |
| `atelier-planificateur-moyens-essai` | a test scheduler, in a cardigan, holding a wall calendar, marking a test bench, precise |
| `atelier-gardien-usine` | a night watchman, in a dark uniform and a peaked cap, holding a torch, patrolling an empty yard, placid and watchful |
| `atelier-magasinier` | a storekeeper, in a blue work coat, holding a barcode scanner, scanning a shelf of bins, tired and precise |
| `atelier-assistant-rpo` | an assistant, in a casual shirt, holding a stack of notes, sitting beside a manager, eager |
| `atelier-agent-maintenance` | a maintenance hand, in a grey overall and a flat cap, holding an oil can, greasing a chain, placid and methodical |
| `atelier-rpo-sans-rui-ex` | a senior production manager, in a dark suit, holding a signed form, standing alone in a meeting room, imperious |
| `atelier-rui-non-toxique-ex` | a senior unit manager, in a dark suit, holding a parking badge, leaning on a car, unbothered |
| `direction-chef-projet-fantome` | a phantom project manager, in a crisp shirt with no tie, holding a laptop, standing in an empty meeting room, blank and unbothered |
| `direction-directeur-adjoint` | a deputy director, in a dark grey suit, holding a delegation note, handing it to an empty chair, polite and detached |
| `direction-pdg` | a CEO, in a tailored midnight suit, holding a board resolution, leaning back in an executive chair, confident and smug |
| `direction-pdg-ex` | the group CEO, in a black suit with gold cufflinks, holding a golden pen, standing at a floor-to-ceiling window, imperious and calm |
| `direction-directeur-fantome` | a phantom director, in a grey suit with an empty badge holder, holding a nameplate, hanging it on a closed door, blank and dry |
| `direction-directeur-regional` | a regional director, in a navy suit with a pin, holding a map of three sites, standing in a regional office, cheerful and stern |
| `direction-directeur-general` | a general manager, in a charcoal suit, holding an annual report, walking out of a shareholders' room, smug and tired |
| `direction-assistant-direction` | a director's assistant, in a neat blouse and cardigan, holding an appointment diary, guarding a closed door, polite and watchful |
| `direction-chef-cabinet` | a chief of staff, in a dark suit with a slim tie, holding a visitor list, standing at a corner desk, calm and knowing |
| `direction-secretaire-direction` | a director's secretary, in a grey cardigan over a blouse, holding a stack of mail, opening envelopes, placid and precise |
| `direction-directeur-programme` | a programme director, in a pale grey suit, holding a board pack, climbing a staircase two steps at a time, brisk and determined |
| `direction-directeur-cabinet` | a cabinet director, in a black suit with a silk tie, holding a cabinet key, locking a private office, dry and smug |
| `direction-directeur-strategie` | a strategy director, in a soft navy suit, holding a strategy deck, presenting a slide to a single chair, calm and imperious |
| `direction-stagiaire-direction` | a direction intern, in an oversized blazer, holding a cold coffee cup, standing by a photocopier, sheepish and hopeful |
| `direction-auditeur-direction` | a direction auditor, in a grey suit with a visitor badge, holding a sample folder, standing in an archive, precise and bored |
| `direction-commissaire-comptes` | an external auditor, in a dark suit with a briefcase, holding an audit certificate, shaking hands with the finance director, grave and polite |
| `syndicat-delegue-personnel` | a staff representative, in a corduroy jacket over a shirt, holding a stack of leaflets, handing them out at a gate, determined and tired |
| `syndicat-representant-cse` | a works-council member, in a dark suit with a union badge, holding a meeting agenda, sitting at a long table, stern and tired |
| `syndicat-secretaire-general` | a union general secretary, in a grey suit with a red badge, holding a small plain flag, standing on a canteen table, determined and weary |
| `syndicat-secretaire-general-ex` | the union's general secretary, in a dark suit with a gold-tipped badge, holding a forty-page report, walking out of a negotiation, imperious and tired |
| `syndicat-tresorier-cse` | a works-council treasurer, in a knitted vest over a shirt, holding a cash box, counting coins for coffee, precise and worried |
| `syndicat-president-cse` | a works-council chair, in a navy suit with a lanyard, holding a wooden gavel, calling a room to order, stern and bored |
| `interim-interimaire` | a temp worker, in a borrowed overall and a blank visitor badge, holding a folder of instructions, standing at the wrong workstation, hopeful and nervous |
| `interim-interimaire-confirme` | a seasoned temp, in a clean overall with several badges, holding a mug, straddling two workstations, cheerful and unbothered |
| `interim-chef-equipe-interimaire` | a temp team leader, in a hi-vis vest with no name on it, holding a shift sheet, pointing three people in one direction, brisk and unimpressed |
| `interim-interimaire-legendaire-ex` | a legendary temp, in a gold-trimmed overall with stacked visitor badges, holding a mug, standing on a loading dock at dawn, bright and smug |
| `interim-consultant-interimaire` | an interim consultant, in a sharp grey suit with no badge, holding a laptop, presenting to three empty desks, calm and detached |
| `interim-responsable-interim` | an interim supply manager, in a navy suit with a phone headset, holding a staffing schedule, dialling at a cluttered desk, cheerful and dry |
| `support-agent-support` | a support agent, in a polo shirt with a headset, holding a printed ticket, closing it without reading, tired and unbothered |
| `support-technicien-support` | a support technician, in a dark hoodie and a lanyard, holding a headset, repeating a reboot instruction, patient and deadpan |
| `support-responsable-support` | a support team lead, in a charcoal shirt with a headset, holding a response script, standing behind a row of screens, patient and weary |
| `support-responsable-support-ex` | a group support director, in a charcoal suit with gold trim, holding a single auto-reply printout, standing in an empty service floor, calm and dry |
| `support-standardiste` | a switchboard operator, in a light blouse with a phone headset, holding a handwritten message, waving it at a passing colleague, brisk and apologetic |
| `support-assistant-direction` | a management assistant, in a grey cardigan over a blouse, holding a stack of minutes, distributing them to empty desks, polite and resigned |
| `support-responsable-services-generaux` | a facilities manager, in a navy jacket with a lanyard, holding a contract folder, standing in a corridor of locked doors, tired and unimpressed |
| `support-technicien-micro-informatique` | a desktop technician, in a company polo and work trousers, holding a backup tape, blowing dust off it, doubtful and precise |
| `support-administrateur-systemes` | a systems administrator, in a dark hoodie with a badge, holding a server rack key, standing in a cold aisle, calm and tired |
| `support-ingenieur-systemes` | a systems engineer, in a grey shirt with rolled sleeves, holding a continuity plan, reading it by a dead rack, grim and focused |
| `support-redacteur-technique` | a technical writer, in a soft shirt and cardigan, holding a procedure manual, crossing out a whole chapter, focused and sad |
| `support-charge-documentation` | a documentation officer, in a light blouse with a lanyard, holding a knowledge-base printout, filing it under an old product name, precise and bored |
| `support-responsable-documentation` | a documentation manager, in a grey blazer, holding a documentation standard, pinning it to a partition, resigned and polite |
| `support-technicien-reseau` | a network technician, in a hi-vis vest over a shirt, holding a patch cable, tracing it under a raised floor, focused and doubtful |
| `support-administrateur-reseau` | a network administrator, in a dark fleece with a badge, holding a firewall printout, reading it at a locked door, dry and smug |
| `support-correspondant-informatique` | an IT correspondent, in a company polo with a lanyard, holding an incident sheet, walking it to a closed IT office, hopeful and tired |
| `support-referent-informatique` | an IT referent, in a checked shirt with a badge, holding a software catalogue, searching it for a missing tool, doubtful and polite |
| `support-assistant-methodes` | a methods assistant, in a blue work jacket, holding a work instruction, comparing it with an old machine, focused and tired |
| `support-technicien-methodes` | a methods technician, in a grey overall with a clipboard, holding an operator sheet, taping it beside a press, methodical and grim |
| `support-formateur-informatique` | an IT trainer, in a light shirt and a lanyard, holding a training laptop, waiting for a licence to install, cheerful and overworked |
| `support-charge-formation-informatique` | an IT training officer, in a navy cardigan, holding an e-learning module, playing it to an empty room, polite and dry |
| `support-gestionnaire-tickets` | a ticket handler, in a company fleece, holding a two-year-old ticket, blowing the dust off it, tired and unimpressed |
| `support-superviseur-support` | a support supervisor, in a dark shirt with a headset, holding a shift rota, crossing out a name, brisk and grim |
| `support-assistant-administratif` | an administrative assistant, in a beige blouse, holding a paper form, retyping it into a screen, patient and bored |
| `support-archiviste` | an archivist, in a grey work coat, holding an archive box, sealing it with tape, placid and precise |
| `support-receptionniste` | a receptionist, in a neat blazer over a blouse, holding a visitor badge, waving a courier through, cheerful and watchful |
| `support-teleconseiller` | a call-centre adviser, in a light shirt and a headset, holding a call script, reading it upside down, cheerful and glazed |
| `support-operateur-saisie` | a data-entry operator, in a plain shirt with a badge, holding a keyboard, typing faster than the screen responds, focused and blank |
| `support-testeur-logiciel` | a software tester, in a hoodie and a lanyard, holding a test plan, ticking the happy path only, precise and sheepish |
| `support-coordinateur-support` | a support coordinator, in a navy polo with a headset, holding a queue board, stacking three queues into one, brisk and resigned |
| `support-ingenieur-systemes-ex` | a principal systems engineer, in a charcoal suit with gold trim, holding a one-page continuity plan, standing over a dead rack, calm and imperious |
| `sse-trousse-secours` | an open first-aid box with dusty bandages and an untouched register |
| `amelioration-baie-test` | a test rack with blinking indicators and one loose screw |
| `atelier-colle-cyanoacrylate` | a half-used tube of superglue welded to a workbench |
| `sse-visite-medicale` | an abandoned doctor's chair and a clipboard already ticking apte |
| `management-entretien-annuel` | a blank annual-review form and a pen still capped on a meeting table |
| `qvt-yoga-du-rire` | a rolled laughing-yoga mat left alone in a meeting room |
| `amelioration-reunion-de-suivi` | a whiteboard of action points that concern no product |
| `rh-reunion-individuelle` | a career plan written on a single post-it stuck to a desk |
| `direction-reunion-qui-aurait-pu-etre-un-mail` | an empty meeting room with forty-five minutes left on the clock |
| `syndicat-assemblee-generale` | a folded general-meeting agenda beside an untouched microphone |
| `support-escalade` | a printed support ticket pinned to the wrong department's door |
