// ============================================================================
// BOSSES — each is a real organism with a real resistance arc.
// spec: { id, bug, name, title, hp, size, speed, dmg, resist, traits, vis,
//         patterns[], phases[{at, ...}], shootKind, shootEvery, capsuleRegen,
//         minion:{bug,n,cap,text}, intro[pages], lesson{title,bullets},
//         reward:{heartContainer, drug, item, pearls}, onDefeat(game) }
// Phase fields: resistAdd/resistRemove, vis, speedMult, patterns, heal, capsule, spawn, text, sub, env
// ============================================================================
export const BOSSES = {};
const def = (s) => { BOSSES[s.id] = s; return s; };

// ───────────────────────── D1: MSSA → penicillinase ─────────────────────────
def({
  id: 'mssa_d1', bug: 'mssa', name: 'THE GOLDEN CLUSTER', title: 'Staphylococcus aureus · penicillinase-producing',
  hp: 26, size: 30, speed: 0.55, dmg: 1, resist: ['penicillinase'], traits: ['toxin'],
  vis: { shape: 'cluster', color: '#ffd166', dark: '#8a5a00', n: 6, aura: '#ffe066' },
  patterns: ['chase', 'dash', 'ring', 'spawn'], shootKind: 'toxin', shootEvery: 150,
  minion: { bug: 'mssa', n: 2, cap: 4, text: 'BUDDING OFF!' },
  phases: [
    { at: 0.6, text: 'ABSCESS WALL', sub: 'It surrounds itself with pus — drain it with the scalpel', patterns: ['chase', 'ring', 'spawn', 'dash'], speedMult: 1.15 },
    { at: 0.3, text: 'TOXIN STORM', sub: 'Clindamycin would silence the toxin factory', patterns: ['dash', 'aim', 'ring'], speedMult: 1.15 },
  ],
  intro: [
    { speaker: 'The Golden Cluster', text: 'Grapes of gold, coagulase-positive, catalase-positive. I was the first to break penicillin — 1942, two years after your miracle drug reached its first patient.' },
    { speaker: 'The Golden Cluster', text: 'My penicillinase snaps the β-lactam ring like a twig. Bring something my enzyme cannot eat, Doctor — or bring nothing at all.' },
  ],
  lesson: { title: 'S. aureus & the first resistance', bullets: [
    '<b>Penicillinase (blaZ)</b> hydrolyzes the β-lactam ring. Over 90% of S. aureus carry it — penicillin has been useless against staph for 80 years.',
    'The answers: <b>penicillinase-stable β-lactams</b> (nafcillin, oxacillin, dicloxacillin, cefazolin, cephalexin) or a <b>β-lactamase inhibitor</b> (amox-clav).',
    'For MSSA bacteremia, a β-lactam beats vancomycin — lower mortality. Always de-escalate from vancomycin when the culture says MSSA.',
    '<b>Source control</b>: abscesses need drainage. Antibiotics can’t penetrate pus (low pH, no blood supply, huge inoculum, β-lactamase concentrated inside).',
    'S. aureus in the blood is never a contaminant: repeat cultures, echocardiogram, look for seeded joints and spine, ≥2 weeks IV.',
  ] },
  reward: { heartContainer: true, drug: 'nafcillin', pearls: 3 },
});

// ───────────────────────── D2: Mycoplasma → no cell wall ─────────────────────────
def({
  id: 'mycoplasma_d2', bug: 'mycoplasma', name: 'THE WALL-LESS WRAITH', title: 'Mycoplasma pneumoniae · no peptidoglycan at all',
  hp: 30, size: 30, speed: 0.75, dmg: 1, resist: [], traits: ['nowall'],
  vis: { shape: 'ghost', color: '#90e0ef', dark: '#0077b6', wobbly: true, spiky: false },
  patterns: ['spiral', 'teleport', 'ring', 'chase'], shootKind: 'toxin', shootEvery: 130,
  phases: [
    { at: 0.66, text: 'PHASE SHIFT', sub: 'Cell-wall drugs pass straight through', patterns: ['teleport', 'ring', 'spiral'], speedMult: 1.2 },
    { at: 0.33, text: 'MACROLIDE RESISTANCE', sub: '23S rRNA mutation — try a tetracycline or a quinolone', resistAdd: ['erm'], vis: { spiky: true, armor: true }, patterns: ['spiral', 'chase', 'aim', 'teleport'] },
  ],
  intro: [
    { speaker: 'The Wall-less Wraith', text: 'You carry drugs that break cell walls. How charming. I have none.' },
    { speaker: 'The Wall-less Wraith', text: 'No peptidoglycan. No PBPs. No target. Your penicillins and cephalosporins will drift through me like fog. Hit the RIBOSOME, if you know how.' },
  ],
  lesson: { title: 'Atypicals: no wall, no β-lactam', bullets: [
    '<b>Mycoplasma</b> has no cell wall — β-lactams and vancomycin have literally nothing to bind. It is the smallest free-living organism and won’t Gram stain or grow on routine media.',
    'Atypical coverage means <b>macrolides, tetracyclines, or respiratory fluoroquinolones</b> — drugs that hit the ribosome or DNA gyrase.',
    'The other atypicals hide <b>inside cells</b>: Chlamydia (obligate intracellular energy parasite) and Legionella (in alveolar macrophages). β-lactams can’t follow them in.',
    'Macrolide resistance (23S rRNA mutation) is now common in East Asia and rising elsewhere → doxycycline or levofloxacin.',
    'Clinically: "walking pneumonia" in a young adult, patchy infiltrates that look worse than the patient, cold agglutinins, sometimes erythema multiforme or encephalitis.',
  ] },
  reward: { heartContainer: true, drug: 'clindamycin', pearls: 3 },
});

// ───────────────────────── D3: Proteus → swarming, urease ─────────────────────────
def({
  id: 'proteus_d3', bug: 'proteus', name: 'THE SWARM KING', title: 'Proteus mirabilis · urease-positive, swarming',
  hp: 34, size: 30, speed: 0.8, dmg: 1, resist: [], traits: ['flagella', 'urease', 'swarm'],
  vis: { shape: 'rod', color: '#ffafcc', dark: '#c9184a', flagella: 10, swarm: true },
  patterns: ['chase', 'spawn', 'ring', 'dash'], shootKind: 'stone', shootEvery: 110,
  minion: { bug: 'proteus', n: 2, cap: 5, text: 'SWARMING!' },
  phases: [
    { at: 0.66, text: 'STRUVITE STONES', sub: 'Urease splits urea → alkaline urine → stones', patterns: ['chase', 'aim', 'spawn'], speedMult: 1.1 },
    { at: 0.33, text: 'STONE FORTRESS', sub: 'Bacteria hide inside the stone — source control matters here too', patterns: ['ring', 'dash', 'spawn', 'aim'], speedMult: 1.15, spawn: { bug: 'ecoli_tem', n: 2 } },
  ],
  intro: [
    { speaker: 'The Swarm King', text: 'Smell that ammonia? My urease splits urea and turns this whole bladder alkaline. Stones grow in my wake — and I live inside them, where your drugs cannot follow.' },
    { speaker: 'The Swarm King', text: 'Your little urinary antiseptic? Nitrofurantoin needs ACID. Try again, Doctor.' },
  ],
  lesson: { title: 'UTI: the right drug in the right place', bullets: [
    '<b>Uncomplicated cystitis</b>: nitrofurantoin ×5 days, TMP-SMX ×3 days (if local resistance <20%), or single-dose fosfomycin. Do NOT use fluoroquinolones — FDA warns the harms outweigh benefits here.',
    '<b>Nitrofurantoin and fosfomycin only work in URINE.</b> No tissue levels: never for pyelonephritis, prostatitis, or bacteremia. And Proteus is intrinsically nitrofurantoin-resistant (alkaline urine).',
    '<b>Pyelonephritis</b>: ceftriaxone or a fluoroquinolone (if susceptible); ESBL → carbapenem.',
    '<b>Urease-positive organisms</b> (Proteus, Klebsiella, Staph saprophyticus, Ureaplasma) make struvite stones. The stone must come out; antibiotics alone will not sterilize it.',
    '<b>Asymptomatic bacteriuria</b>: do NOT treat — except in pregnancy and before urologic procedures. Treating it is one of the most common stewardship failures in hospitals.',
  ] },
  reward: { heartContainer: true, drug: 'nitrofurantoin', pearls: 3 },
});

// ───────────────────────── D4: Pseudomonas → intrinsic + biofilm ─────────────────────────
def({
  id: 'pseudomonas_d4', bug: 'pseudomonas', name: 'THE VERDANT SLIME LORD', title: 'Pseudomonas aeruginosa · impermeable, efflux-pumped, biofilmed',
  hp: 44, size: 34, speed: 0.85, dmg: 1, resist: [], traits: ['flagella', 'biofilm', 'pigment', 'toxin'],
  vis: { shape: 'rod', color: '#2ec4b6', dark: '#0b6e4f', flagella: 1, slime: '#80ffdb', glow: '#9ef01a' },
  patterns: ['chase', 'slime', 'dash', 'ring'], shootKind: 'toxin', shootEvery: 120,
  phases: [
    { at: 0.7, text: 'BIOFILM MATRIX', sub: 'Slime halves your damage — rifampin or debridement cuts through', patterns: ['slime', 'chase', 'ring'], speedMult: 1.1 },
    { at: 0.45, text: 'OprD PORIN LOSS', sub: 'Carbapenems can no longer get in', resistAdd: ['porin'], vis: { armor: true }, patterns: ['dash', 'slime', 'aim', 'ring'] },
    { at: 0.2, text: 'EFFLUX PUMPS UP', sub: 'MexAB-OprM ejects β-lactams and quinolones', resistAdd: ['efflux_bl', 'efflux'], vis: { spikes: true }, patterns: ['dash', 'ring', 'aim', 'chase'], speedMult: 1.15 },
  ],
  intro: [
    { speaker: 'The Verdant Slime Lord', text: 'Ceftriaxone? Ertapenem? Ampicillin? Doxycycline? Bactrim? All useless. I am not resistant because I acquired something — I was BORN this way.' },
    { speaker: 'The Verdant Slime Lord', text: 'A low-permeability outer membrane. Constitutive efflux pumps. A chromosomal AmpC. And when things get bad, I build a city of slime. Only a handful of drugs on earth touch me.' },
  ],
  lesson: { title: 'Pseudomonas: the anti-pseudomonal short list', bullets: [
    'Memorize the list: <b>pip-tazo, cefepime, ceftazidime, meropenem/imipenem (NOT ertapenem), cipro/levofloxacin, aminoglycosides, aztreonam</b>, plus newer agents (ceftolozane-tazo, ceftaz-avi, cefiderocol, imipenem-relebactam) and colistin.',
    '<b>Intrinsic resistance</b> = the organism was always resistant (structure, pumps, chromosomal enzymes). <b>Acquired</b> = new mutation or plasmid. Pseudomonas has both.',
    'Three stacking mechanisms: <b>less in</b> (OprD porin loss), <b>more out</b> (MexAB-OprM efflux), <b>destroyed inside</b> (AmpC). Cefiderocol’s siderophore trick bypasses the first two.',
    '<b>Biofilms</b> raise MICs 100-1000×: device removal, debridement, and rifampin combinations exist because of them.',
    'Think Pseudomonas in: ventilator pneumonia, cystic fibrosis, neutropenic fever, burns, malignant otitis externa in diabetics, hot-tub folliculitis, contact-lens keratitis.',
  ] },
  reward: { heartContainer: true, drug: 'piptazo', pearls: 4 },
});

// ───────────────────────── D5: Polymicrobial abscess ─────────────────────────
def({
  id: 'abscess_d5', bug: 'bfrag', name: 'THE POLYMICROBIAL ABSCESS', title: 'Bacteroides fragilis + friends · anaerobic, walled off',
  hp: 46, size: 36, speed: 0.4, dmg: 1, resist: [], traits: ['capsule', 'anaerobic'],
  vis: { shape: 'rod', color: '#7f5539', dark: '#3f2410', capsuleThick: true, shadowy: true },
  patterns: ['wander', 'spawn', 'ring', 'chase'], shootKind: 'toxin', shootEvery: 160, capsuleRegen: 420,
  minion: { bug: 'ecoli', n: 2, cap: 5, text: 'MIXED FLORA!' },
  phases: [
    { at: 0.7, text: 'AEROBE PARTNERS', sub: 'Real abscesses are polymicrobial — you need both halves covered', spawn: { bug: 'ecoli_tem', n: 2 }, patterns: ['spawn', 'wander', 'ring'] },
    { at: 0.4, text: 'CAPSULE THICKENS', sub: 'The B. fragilis capsule is what makes abscesses form at all', capsule: true, patterns: ['chase', 'spawn', 'ring', 'aim'], speedMult: 1.2 },
    { at: 0.15, text: 'ENTEROCOCCUS JOINS', sub: 'Cephalosporins select for it — no ceph covers Enterococcus', spawn: { bug: 'efaecalis', n: 2 }, patterns: ['ring', 'aim', 'spawn', 'chase'] },
  ],
  intro: [
    { speaker: 'The Polymicrobial Abscess', text: 'A perforated gut spills everything: aerobes, anaerobes, enterococci, all of us together behind a wall of fibrin and pus.' },
    { speaker: 'The Polymicrobial Abscess', text: 'One drug will never be enough. And no drug at all reaches the middle of me. You will need a scalpel and a strategy.' },
  ],
  lesson: { title: 'Anaerobes, abscesses & source control', bullets: [
    '<b>Bacteroides fragilis</b> is the gold-standard anaerobe below the diaphragm. It makes cepA β-lactamase (so penicillin and most cephalosporins fail) and its capsule is directly abscessogenic.',
    'Anaerobic coverage: <b>metronidazole</b> (gold standard, prodrug activated only in low-redox conditions — invisible to aerobes), pip-tazo, carbapenems, amox-clav, cefoxitin. Clindamycin is ~30% resistant now.',
    '<b>Aminoglycosides never work on anaerobes</b>: uptake is oxygen-dependent. They also underperform in abscesses (low pH, low O₂).',
    'Intra-abdominal infection = aerobic gram-negatives + anaerobes: ceftriaxone + metronidazole, or pip-tazo, or a carbapenem.',
    '<b>Source control beats antibiotics.</b> An undrained abscess is the #1 reason a "correctly treated" patient fails to improve. Drain it, remove the device, debride the tissue.',
  ] },
  reward: { heartContainer: true, drug: 'amoxclav', item: 'compass', pearls: 4 },
});

// ───────────────────────── D6a: MRSA → target change ─────────────────────────
def({
  id: 'mrsa_d6', bug: 'mrsa', name: 'THE METHICILLIN-RESISTANT MONARCH', title: 'MRSA · mecA / PBP2a — the target itself changed',
  hp: 52, size: 34, speed: 0.85, dmg: 1, resist: ['penicillinase', 'pbp2a'], traits: ['toxin', 'biofilm'],
  vis: { shape: 'cluster', color: '#ff9f1c', dark: '#7a4400', n: 6, aura: '#ffe066', armor: true, spikes: true },
  patterns: ['chase', 'dash', 'ring', 'spawn', 'slime'], shootKind: 'toxin', shootEvery: 110,
  minion: { bug: 'sepi', n: 2, cap: 4, text: 'COAG-NEGATIVE ESCORT!' },
  phases: [
    { at: 0.7, text: 'VEGETATION', sub: 'On a valve: bacteriostatic drugs won’t clear it', patterns: ['chase', 'ring', 'spawn'], speedMult: 1.1 },
    { at: 0.45, text: 'FQ + MACROLIDE RESISTANCE', sub: 'Hospital MRSA carries a whole cassette of resistance', resistAdd: ['gyrA', 'erm'], patterns: ['dash', 'aim', 'ring', 'spawn'] },
    { at: 0.2, text: 'VISA — THICKENED WALL', sub: 'Vancomycin gets trapped in excess D-Ala-D-Ala decoys', resistAdd: ['visa'], vis: { capsuleThick: true }, patterns: ['dash', 'ring', 'aim', 'chase'], speedMult: 1.1 },
  ],
  intro: [
    { speaker: 'The Monarch', text: 'The Golden Cluster made an ENZYME. Amateur work — you built inhibitors and moved on.' },
    { speaker: 'The Monarch', text: 'I changed the TARGET. mecA encodes PBP2a: a transpeptidase your β-lactams cannot bind, at any dose, with any inhibitor. Methicillin, nafcillin, cefazolin, even the carbapenems — all of them slide off.' },
    { speaker: 'The Monarch', text: 'Bring a drug that doesn’t need a PBP at all.' },
  ],
  lesson: { title: 'MRSA: when the target changes', bullets: [
    '<b>mecA → PBP2a</b>: an alternative transpeptidase with near-zero β-lactam affinity. "Methicillin-resistant" means resistant to ALL β-lactams — except ceftaroline, which was designed to bind PBP2a.',
    'Inhibitors (clavulanate, tazobactam, avibactam) fix ENZYME resistance. They do nothing for TARGET resistance. That distinction is the whole lesson.',
    'MRSA drugs: <b>vancomycin</b> (D-Ala-D-Ala, AUC-guided), <b>daptomycin</b> (membrane — never for pneumonia, surfactant inactivates it), <b>linezolid</b> (50S, oral, good lung levels), <b>ceftaroline</b>. Community strains often also respond to TMP-SMX, doxycycline, clindamycin.',
    '<b>VISA</b>: a thickened wall of false D-Ala-D-Ala targets soaks up vancomycin before it reaches the membrane. <b>VRSA</b> (rare) acquired vanA from enterococcus.',
    'Endocarditis needs <b>bactericidal</b> therapy for weeks — vegetations are avascular biofilms the immune system cannot enter.',
  ] },
  reward: { heartContainer: true, drug: 'linezolid', pearls: 5 },
  onDefeat: (g) => { g.flags.nexus_hint = true; },
});

// ───────────────────────── D6b: VRE → D-Ala-D-Lac ─────────────────────────
def({
  id: 'vre_d6', bug: 'vre', name: 'THE VANCOMYCIN-RESISTANT HEIR', title: 'Enterococcus faecium · vanA — D-Ala-D-Lac',
  hp: 38, size: 30, speed: 0.7, dmg: 1, resist: ['vanA', 'pbp5'], traits: [],
  vis: { shape: 'diplo', color: '#40916c', dark: '#1b4332', armor: true, spikes: true },
  patterns: ['chase', 'ring', 'teleport', 'spawn'], shootKind: 'toxin', shootEvery: 140,
  minion: { bug: 'efaecalis', n: 2, cap: 4, text: 'GUT COLONIZATION!' },
  phases: [
    { at: 0.5, text: 'AMPICILLIN RESISTANCE', sub: 'PBP5 mutation — E. faecium is not E. faecalis', patterns: ['chase', 'ring', 'aim'], speedMult: 1.15 },
    { at: 0.25, text: 'DAPTOMYCIN PRESSURE', sub: 'mprF membrane-charge change is emerging in real ICUs', resistAdd: ['dapNS'], patterns: ['teleport', 'ring', 'aim', 'chase'] },
  ],
  intro: [
    { speaker: 'The Heir', text: 'The Monarch changed a protein. I changed a CHEMICAL BOND.' },
    { speaker: 'The Heir', text: 'My peptidoglycan ends in D-Ala-D-LACTATE, not D-Ala-D-Ala. One hydrogen bond gone; vancomycin binds a thousand times worse. Your cephalosporins never worked on my kind anyway.' },
  ],
  lesson: { title: 'Enterococcus & VRE', bullets: [
    '<b>Enterococci are intrinsically resistant to ALL cephalosporins</b> (low-affinity PBP5) and to TMP-SMX in vivo. Ceftriaxone therapy SELECTS for them.',
    '<b>E. faecalis</b>: ampicillin is the drug of choice (± gentamicin or ceftriaxone synergy for endocarditis). <b>E. faecium</b>: usually ampicillin-resistant → vancomycin → if vanA, daptomycin or linezolid.',
    '<b>vanA/vanB</b> swap the D-Ala-D-Ala terminus for D-Ala-D-Lac — 1000-fold loss of vancomycin binding. This same operon jumped into S. aureus to create VRSA.',
    'Aminoglycosides can’t enter enterococci alone — a wall-active drug must open the door (<b>synergy</b>). High-level gentamicin resistance abolishes that trick.',
    'VRE in urine: nitrofurantoin or fosfomycin still work. VRE bacteremia: daptomycin (high dose) or linezolid, and remove the line.',
  ] },
  reward: { drug: 'daptomycin', item: 'heartPiece', pearls: 4 },
});

// ───────────────────────── D7: Listeria → cephalosporin gap ─────────────────────────
def({
  id: 'listeria_d7', bug: 'listeria', name: 'THE COLD-LOVING LURKER', title: 'Listeria monocytogenes · the gap in your meningitis regimen',
  hp: 46, size: 32, speed: 1.0, dmg: 1, resist: [], traits: ['flagella', 'coldGrowth', 'intracellular'],
  vis: { shape: 'rod', color: '#c3b1e1', dark: '#6b4fa0', flagella: 4, frost: true },
  patterns: ['dash', 'hide', 'chase', 'ring'], shootKind: 'toxin', shootEvery: 130,
  phases: [
    { at: 0.66, text: 'ACTIN ROCKETS', sub: 'It spreads cell to cell without ever touching your antibodies', patterns: ['dash', 'teleport', 'chase'], speedMult: 1.25 },
    { at: 0.33, text: 'INTRACELLULAR', sub: 'Ampicillin still reaches it — cephalosporins never could', patterns: ['hide', 'dash', 'ring', 'aim'], speedMult: 1.1 },
  ],
  intro: [
    { speaker: 'The Lurker', text: 'Ceftriaxone and vancomycin. The standard meningitis regimen. It covers pneumococcus, meningococcus, H. influenzae…' },
    { speaker: 'The Lurker', text: '…and misses ME entirely. No cephalosporin on earth binds my PBP3. I grow in the refrigerator, I ride in soft cheese and deli meat, and I hunt the old, the pregnant, the immunosuppressed.' },
  ],
  lesson: { title: 'CNS infection: the barrier and the gaps', bullets: [
    '<b>Empiric bacterial meningitis</b>: ceftriaxone + vancomycin, PLUS <b>ampicillin</b> if age >50, pregnant, or immunocompromised (Listeria). Dexamethasone before/with the first dose for suspected pneumococcus.',
    '<b>Listeria is intrinsically resistant to every cephalosporin.</b> Ampicillin (± gentamicin) is the drug of choice; TMP-SMX if penicillin-allergic.',
    'Which drugs cross the blood-brain barrier? <b>Yes</b>: ceftriaxone/cefotaxime, cefepime, meropenem, ampicillin/penicillin (high dose), vancomycin (inflamed meninges), TMP-SMX, metronidazole, linezolid, fluoroquinolones, rifampin. <b>No</b>: 1st/2nd-gen cephalosporins, aminoglycosides, daptomycin, macrolides, clindamycin.',
    'Inflammation opens the barrier — which is why doses must stay high and why some drugs work early in meningitis but fail as inflammation resolves.',
    '"LAME" — the organisms cephalosporins miss: <b>L</b>isteria, <b>A</b>typicals, <b>M</b>RSA, <b>E</b>nterococci.',
  ] },
  reward: { heartContainer: true, drug: 'ampicillin', pearls: 5 },
  onDefeat: (g) => { g.flags.nexus_open = true; },
});

// ───────────────────────── TB: mycobacteria & combination therapy ─────────────────────────
def({
  id: 'tb_mtn', bug: 'tb', name: 'THE WAXY TITAN', title: 'Mycobacterium tuberculosis · one drug is never enough',
  hp: 60, size: 38, speed: 0.35, dmg: 1, resist: [], traits: ['waxy', 'intracellular', 'slow'],
  vis: { shape: 'tbrod', color: '#f4d35e', dark: '#8a5a00', beaded: true, armor: true },
  patterns: ['wander', 'hide', 'ring', 'chase'], shootKind: 'spore', shootEvery: 150,
  phases: [
    { at: 0.75, text: 'CAVITATION', sub: '10⁸ bacilli — a resistant mutant to any single drug already exists', patterns: ['ring', 'wander', 'aim'] },
    { at: 0.5, text: 'GRANULOMA', sub: 'Dormant persisters in an acidic phagosome — pyrazinamide’s niche', patterns: ['hide', 'ring', 'chase'], speedMult: 1.3 },
    { at: 0.25, text: 'DRUG PRESSURE', sub: 'Keep cycling all four drugs or it will mutate', patterns: ['chase', 'ring', 'aim', 'teleport'], speedMult: 1.2 },
  ],
  intro: [
    { speaker: 'The Waxy Titan', text: 'I have killed more humans than any other organism in history. A billion in two centuries. A quarter of your species carries me right now.' },
    { speaker: 'The Waxy Titan', text: 'My wall is mycolic wax — your ordinary antibiotics slide off. I divide once a day, so drugs that need growth barely touch me. And I keep 10⁸ copies of myself in a single cavity.' },
    { speaker: 'The Waxy Titan', text: 'Use one drug and I will simply become resistant to it. Use two and I will take longer. You know what you must do.' },
  ],
  lesson: { title: 'TB: why four drugs for six months', bullets: [
    '<b>RIPE</b>: Rifampin (rpoB → RNA polymerase), Isoniazid (katG-activated prodrug → mycolic acid), Pyrazinamide (pncA-activated, works in ACIDIC phagosomes on persisters), Ethambutol (embB → arabinogalactan). 2 months RIPE, then 4 months RI.',
    'A cavity holds ~10⁸ bacilli. Spontaneous resistance is ~10⁻⁶ to 10⁻⁸ per drug — so a mutant resistant to ANY single drug already exists before you treat. Two drugs: 10⁻¹⁴. Four: essentially zero. <b>That arithmetic is why monotherapy is malpractice in TB.</b>',
    'Different drugs reach different niches: rapidly-dividing extracellular bacilli (INH), intracellular acidic persisters (PZA), slow semi-dormant populations (RIF). "Sterilizing activity" is why PZA shortened therapy from 9 months to 6.',
    'MDR-TB = resistant to INH + RIF. XDR adds fluoroquinolone + injectable/bedaquiline/linezolid resistance. Modern MDR regimen: <b>BPaL</b> (bedaquiline, pretomanid, linezolid) ± moxifloxacin — 6 months, oral.',
    'Toxicities to know: INH → hepatitis + peripheral neuropathy (give B6); RIF → orange fluids + massive CYP induction; PZA → hepatitis + hyperuricemia; EMB → optic neuritis (red-green).',
  ] },
  reward: { heartContainer: true, drug: 'rifampin', pearls: 6 },
});

// ───────────────────────── D8: NDM Klebsiella — final boss ─────────────────────────
def({
  id: 'ndm_d8', bug: 'klebsiella_ndm', name: 'THE CARBAPENEMASE COLOSSUS', title: 'Klebsiella pneumoniae · NDM-1 · pan-resistant',
  hp: 90, size: 42, speed: 0.6, dmg: 1, resist: ['shv', 'esbl', 'dfr', 'gyrA', 'ame'], traits: ['capsule', 'lps'],
  vis: { shape: 'rod', color: '#e5383b', dark: '#370617', capsuleThick: true, armor: true, aura: '#ff9f1c', crown: true },
  patterns: ['chase', 'ring', 'spawn', 'dash'], shootKind: 'toxin', shootEvery: 100, capsuleRegen: 480,
  minion: { bug: 'klebsiella_esbl', n: 2, cap: 4, text: 'PLASMID TRANSFER!' },
  phases: [
    { at: 0.85, text: 'ESBL ACTIVE', sub: 'CTX-M eats every cephalosporin — reach for a carbapenem', patterns: ['chase', 'ring', 'spawn'] },
    { at: 0.65, text: 'KPC CARBAPENEMASE', sub: 'Class A serine enzyme — avibactam can still inhibit it', resistAdd: ['kpc'], vis: { spikes: true }, patterns: ['dash', 'ring', 'spawn', 'aim'], speedMult: 1.1 },
    { at: 0.42, text: 'NDM-1 METALLO-β-LACTAMASE', sub: 'Zinc enzyme — avibactam fails. Aztreonam survives it… if shielded', resistAdd: ['ndm'], vis: { color: '#9d0208', aura: '#7209b7' }, patterns: ['ring', 'dash', 'aim', 'spawn'], speedMult: 1.1 },
    { at: 0.2, text: 'mcr-1 — COLISTIN RESISTANCE', sub: 'Lipid A modified. The last line falls. Only the siderophore remains', resistAdd: ['mcr', 'lipidA'], vis: { crown: true, spikes: true }, patterns: ['dash', 'ring', 'aim', 'teleport', 'spawn'], speedMult: 1.15 },
  ],
  intro: [
    { speaker: 'The Colossus', text: 'You have walked through my kingdom, Doctor. Every enemy you met taught you one mechanism. I carry them ALL — on a single plasmid, ready to hand to anyone.' },
    { speaker: 'The Colossus', text: 'β-lactamase. Extended spectrum. Carbapenemase. Aminoglycoside-modifying enzymes. Quinolone protection. Folate bypass. And when you reach for colistin — the drug you abandoned in the 1970s for being too toxic — I have mcr-1 waiting.' },
    { speaker: 'The Colossus', text: 'I was not born. I was CULTIVATED. Every unnecessary prescription, every course stopped early, every antibiotic poured into livestock feed built me, one selection event at a time.' },
    { speaker: 'The Colossus', text: 'Show me what is left in your formulary.' },
  ],
  lesson: { title: 'The end of the line — and how to hold it', bullets: [
    '<b>Ambler classes</b>: A (KPC, ESBL, TEM/SHV — serine), B (NDM, VIM, IMP — <b>metallo</b>, zinc), C (AmpC — serine), D (OXA — serine). Avibactam/vaborbactam/relebactam inhibit serine enzymes only. <b>Metallo-β-lactamases are the reason NDM is so feared.</b>',
    'The NDM answer: <b>ceftazidime-avibactam + aztreonam</b> (aztreonam survives the metallo-enzyme; avibactam protects it from the co-carried serine enzymes), or <b>cefiderocol</b>, whose siderophore hijacks bacterial iron transport to walk straight through the outer membrane.',
    '<b>mcr-1</b> (2015, Chinese pigs → worldwide within a year) put colistin resistance on a plasmid. Agricultural antibiotic use created it. One Health is not a slogan.',
    'CDC urgent threats: CRE, carbapenem-resistant Acinetobacter, drug-resistant Neisseria gonorrhoeae, Candida auris, C. difficile. ~2.8 million resistant infections and 35,000 deaths per year in the US; ~1.27 million deaths worldwide attributable to resistance.',
    '<b>What actually works</b>: hand hygiene, vaccines, isolation, culturing before treating, choosing the narrowest active drug, shortest effective duration, IV→PO conversion, and NOT treating viruses or asymptomatic bacteriuria. The pipeline is thin — stewardship is how you buy time.',
  ] },
  reward: { heartContainer: true, pearls: 12 },
  onDefeat: (g) => { g.flags.won = true; },
});
