// ============================================================================
// Organism "board details" — the Sketchy-style quirks students memorize:
// lab identification, virulence factors, toxins, classic associations,
// mnemonics, and SITES of infection. Merged into BUGS[id].edu at load.
// Variants (e.g. mrsa_ca) inherit their base organism's entries via `base`.
// ============================================================================
export const BUG_EXTRA = {
  gas: {
    mnemonic: 'JONES criteria for rheumatic fever: Joints, ♥ (carditis), Nodules, Erythema marginatum, Sydenham chorea.',
    quirks: [
      'Gram-positive cocci in CHAINS; catalase-negative; β-hemolytic (clear zone); bacitracin-SENSITIVE; PYR-positive; Lancefield group A.',
      'M protein: anti-phagocytic + molecular mimicry with heart/joint tissue → rheumatic fever (2-4 weeks after PHARYNGITIS only). Treating the pharyngitis prevents rheumatic fever.',
      'Post-streptococcal glomerulonephritis (PSGN) follows pharyngitis OR impetigo (~2 weeks, cola urine, low C3) — antibiotics do NOT prevent it.',
      'Streptolysin O → ASO titer (recent infection); anti-DNase B rises after skin infections.',
      'Pyrogenic exotoxins SpeA/SpeC are SUPERANTIGENS → scarlet fever (sandpaper rash, strawberry tongue, circumoral pallor, Pastia lines) and streptococcal toxic shock.',
      'Hyaluronic acid capsule looks like human connective tissue — poorly immunogenic.',
      'Necrotizing fasciitis: surgery + penicillin + clindamycin (clindamycin turns off toxin production even at high inoculum — the "Eagle effect").',
    ],
    sites: ['Pharynx (strep throat)', 'Skin: impetigo (honey crusts), erysipelas (raised, sharp border), cellulitis', 'Deep soft tissue: necrotizing fasciitis', 'Post-infectious: heart/joints (rheumatic fever), kidney (PSGN)', 'Bloodstream: toxic shock'],
  },
  pneumo: {
    mnemonic: 'MOPS: Meningitis, Otitis media, Pneumonia, Sinusitis. Encapsulated: "Some Killers Have Pretty Nice Capsules" — Strep pneumo, Klebsiella, H. flu b, Pseudomonas, Neisseria, Cryptococcus (+ E. coli K1, Salmonella, GBS).',
    quirks: [
      'LANCET-shaped gram-positive diplococci; α-hemolytic (green); optochin-SENSITIVE; bile-SOLUBLE (autolysin) — the opposite of viridans strep.',
      'Polysaccharide CAPSULE is the main virulence factor: Quellung reaction (capsule swells with antiserum); vaccines target capsule types (PCV15/20 conjugate, PPSV23 polysaccharide).',
      'IgA protease for mucosal colonization; pneumolysin; "rusty" sputum; classic LOBAR pneumonia.',
      'Asplenia / sickle cell → overwhelming post-splenectomy sepsis with encapsulated organisms. Vaccinate, and keep penicillin prophylaxis in children with sickle cell.',
      '#1 cause of otitis media, CAP, and bacterial meningitis in adults; common sinusitis pathogen.',
      'Penicillin resistance is via mosaic PBPs from viridans strep — NOT β-lactamase — so inhibitors don’t help but higher doses do (except in the CNS).',
    ],
    sites: ['Lung (lobar community-acquired pneumonia)', 'Meninges (adult bacterial meningitis #1)', 'Middle ear & sinuses', 'Bloodstream (esp. asplenia)', 'Conjunctiva, peritoneum (SBP in nephrotic kids)'],
  },
  pneumo_r: { base: 'pneumo', quirks: ['Drug-resistant pneumococcus: altered PBPs + macrolide mef/erm. Risk factors: recent β-lactam, daycare, age extremes, nursing home. High-dose amoxicillin or ceftriaxone still wins outside the CNS; vancomycin in meningitis until susceptibilities return.'] },
  viridans: {
    mnemonic: 'Viridans = "living in the mouth": S. mutans (caries), S. sanguinis (endocarditis), S. anginosus/milleri group (abscesses).',
    quirks: [
      'α-hemolytic, optochin-RESISTANT, bile-INSOLUBLE, catalase-negative; normal oral flora.',
      'Dextrans (from sucrose) let S. mutans/S. sanguinis stick to fibrin-platelet aggregates on damaged valves → subacute endocarditis after dental work; and to teeth → caries.',
      'S. anginosus group: "if you see it in blood, look for an abscess" (brain, liver, lung).',
      'Usually penicillin-susceptible; endocarditis: penicillin G or ceftriaxone ×4 weeks (± gentamicin synergy ×2 weeks).',
    ],
    sites: ['Heart valves (subacute native-valve endocarditis)', 'Teeth (caries)', 'Deep abscesses (anginosus group)', 'Bloodstream in neutropenia (S. mitis)'],
  },
  mssa: {
    mnemonic: 'Staph aureus toxins: TSST-1 (toxic shock), exfoliatin (scalded skin), enterotoxin (food poisoning — PREFORMED, fast), PVL (necrotizing).',
    quirks: [
      'Gram-positive cocci in CLUSTERS; CATALASE-positive (vs strep); COAGULASE-positive (vs S. epidermidis/saprophyticus); β-hemolytic; golden colonies; ferments mannitol (yellow on mannitol-salt agar).',
      'Protein A binds the Fc portion of IgG → blocks opsonization and phagocytosis.',
      'Enterotoxin is heat-stable and preformed: vomiting 2-6 h after mayonnaise/custard/potato salad — too fast for bacteria to grow in you.',
      'TSST-1 superantigen (tampons, nasal packing): fever, hypotension, diffuse rash → desquamation; cultures often negative (it is a toxin disease).',
      'Exfoliative toxin cleaves desmoglein-1 → scalded skin syndrome in infants (Nikolsky sign).',
      '#1 cause of osteomyelitis, septic arthritis, acute endocarditis (tricuspid in IV drug use), post-influenza pneumonia, and skin abscesses. Colonizes the nares of ~30% of people.',
      'Coagulase walls off infection → abscesses. S. aureus in blood is NEVER a contaminant.',
    ],
    sites: ['Skin & soft tissue (abscess, furuncle, cellulitis, impetigo)', 'Bone & joint (osteomyelitis, septic arthritis)', 'Heart valves (acute endocarditis, tricuspid in IVDU)', 'Lung (post-influenza necrotizing pneumonia, empyema)', 'Bloodstream, lines & prosthetic devices', 'Toxin syndromes: TSS, scalded skin, food poisoning'],
  },
  mrsa_ca: { base: 'mssa', quirks: ['Community MRSA (USA300): small SCCmec IV cassette, often PVL-positive → recurrent furunculosis/"spider bites" and necrotizing pneumonia in the young and healthy (athletes, military, prisons, daycare). Still usually susceptible to TMP-SMX, doxycycline, clindamycin.'] },
  mrsa: { base: 'mssa', quirks: ['Hospital MRSA: large SCCmec II/III cassettes carrying extra resistance (macrolide, FQ, aminoglycoside). Vancomycin AUC/MIC-guided; VISA (thick wall) and VRSA (vanA from enterococcus) are the next steps in the arms race.'] },
  sepi: {
    mnemonic: 'Coag-negative staph: S. EPIdermidis = novobiocin-SENSITIVE (devices); S. SAPROphyticus = novobiocin-RESISTANT (UTI in young women, #2 after E. coli).',
    quirks: [
      'Coagulase-NEGATIVE, catalase-positive gram-positive cocci in clusters; white colonies; urease-positive.',
      'Polysaccharide intercellular adhesin ("slime") → BIOFILM on catheters, prosthetic valves, joints, shunts, pacemakers.',
      'The #1 blood culture CONTAMINANT (skin flora): one bottle of two = contaminant; two of two with a device in place = real infection.',
      'Most are methicillin-resistant (mecA) → vancomycin; add rifampin for prosthetic valves; the cure is device removal.',
    ],
    sites: ['Prosthetic valves & pacemaker leads', 'Central venous catheters', 'Prosthetic joints, CSF shunts', 'Blood cultures (as a contaminant)'],
  },
  efaecalis: {
    mnemonic: 'Group D that grows in 6.5% NaCl AND bile = Enterococcus. "LAME" organisms cephalosporins miss: Listeria, Atypicals, MRSA, Enterococcus.',
    quirks: [
      'Gram-positive cocci in pairs/short chains; catalase-negative; γ-hemolytic; PYR-positive; Lancefield group D; grows in bile and 6.5% NaCl (non-enterococcal group D, S. gallolyticus/bovis, grows in bile only).',
      'Normal colon flora; hospital UTI (catheters), biliary/intra-abdominal infection, line bacteremia, subacute endocarditis in older men after GU/GI procedures.',
      'Intrinsically resistant to ALL cephalosporins (PBP5) and clinically to TMP-SMX; aminoglycosides can’t get in alone — ampicillin or vancomycin opens the wall (synergy) unless high-level gentamicin resistance.',
      'S. gallolyticus (bovis) bacteremia/endocarditis → colonoscopy (colon cancer association) — the group D cousin pearl.',
    ],
    sites: ['Urinary tract (catheter-associated)', 'Biliary tract & intra-abdominal abscess', 'Heart valves (subacute endocarditis, older men)', 'Bloodstream via lines'],
  },
  vre: { base: 'efaecalis', quirks: ['E. faecium is the resistant species: ampicillin-resistant (PBP5 mutations), vanA/vanB (D-Ala-D-Lac) → daptomycin or linezolid; selected by vancomycin and cephalosporin exposure; spreads on hands in ICUs/oncology wards; colonizes the gut for months.'] },
  listeria: {
    mnemonic: 'Listeria = the gram-positive rod that grows in your fridge and hunts the pregnant, the newborn, the old, and the immunosuppressed.',
    quirks: [
      'Gram-positive rod; catalase-positive (vs strep); narrow β-hemolysis; CAMP-test positive; TUMBLING motility at 25°C; grows at 4°C (cold enrichment).',
      'Facultative intracellular: listeriolysin O escapes the phagosome; ACTIN ROCKETS ("comet tails") push it cell-to-cell, dodging antibodies.',
      'Foods: deli meats, hot dogs, soft cheeses/queso fresco, unpasteurized milk, cantaloupe, ice cream. Pregnant women: mild flu-like illness → amnionitis, stillbirth, preterm labor.',
      'Neonates: granulomatosis infantiseptica; 3rd most common neonatal meningitis (after GBS and E. coli K1).',
      'Meningitis in >50 y or immunocompromised: ADD AMPICILLIN — no cephalosporin binds its PBP3. TMP-SMX if allergic. Gentamicin for synergy.',
    ],
    sites: ['Meninges & brain (meningitis, rhombencephalitis)', 'Bloodstream (pregnancy, elderly, immunosuppressed)', 'Placenta / fetus (stillbirth)', 'GI (febrile gastroenteritis outbreaks)'],
  },
  cdiff: {
    mnemonic: 'C. diff risk: the "C-FUCK" list — Clindamycin, Fluoroquinolones, third-gen cephalosporins (Unasyn-ish broad β-lactams), Carbapenems, plus PPIs, age and hospitalization. (Or simply: the broader, the worse.)',
    quirks: [
      'Gram-positive anaerobic spore-forming rod; "difficult" to culture → diagnose by toxin EIA/PCR (only test diarrheal stool; don’t test for cure).',
      'Toxin A (enterotoxin → watery diarrhea) and Toxin B (cytotoxin → pseudomembranes); hypervirulent NAP1/027 strain (binary toxin, FQ-resistant).',
      'Pseudomembranous colitis, toxic megacolon, striking leukocytosis (>15,000, sometimes 30-50,000) and rising creatinine mark severe disease.',
      'Spores survive alcohol gel and persist on surfaces for months: soap & water, bleach, contact precautions.',
      'Treat: fidaxomicin > oral vancomycin (IV vanc does nothing); fulminant: high-dose oral vanc + IV metronidazole ± rectal vanc; recurrences: fidaxomicin, bezlotoxumab, fecal microbiota transplant.',
    ],
    sites: ['Colon (antibiotic-associated colitis, pseudomembranous colitis, toxic megacolon)'],
  },
  meningococcus: {
    mnemonic: 'MeninGococcus ferments Maltose + Glucose; Gonococcus ferments Glucose only.',
    quirks: [
      'Gram-negative kidney-bean diplococci; oxidase-positive; grows on chocolate/Thayer-Martin; polysaccharide capsule (serogroups A, B, C, W, Y).',
      'Serogroup B capsule mimics neural cell adhesion molecules → poorly immunogenic → protein-based MenB vaccines. MenACWY at 11-12 with booster at 16.',
      'LOS endotoxin → petechiae → purpura fulminans, DIC, Waterhouse-Friderichsen (bilateral adrenal hemorrhage, shock).',
      'Respiratory droplets; crowding (dorms, barracks); asplenia and terminal COMPLEMENT (C5-C9) deficiency → recurrent Neisseria infections (think of eculizumab patients too).',
      'Droplet precautions for the first 24 h of therapy; close contacts get rifampin, ciprofloxacin, or ceftriaxone prophylaxis.',
    ],
    sites: ['Meninges (fulminant meningitis)', 'Bloodstream (meningococcemia, purpura)', 'Adrenals (Waterhouse-Friderichsen)', 'Joints (septic arthritis)'],
  },
  ecoli: {
    mnemonic: 'E. coli pathotypes: ETEC = Travelers’ (Toxin, watery); EHEC = Hemorrhagic, HUS, no fever, sorbitol-NEGATIVE, NO antibiotics; EIEC = Invasive (dysentery); EPEC = Pediatric.',
    quirks: [
      'Gram-negative rod; LACTOSE fermenter (pink on MacConkey, green sheen on EMB); oxidase-negative; motile (H antigen), capsule (K antigen — K1 → neonatal meningitis), LPS O antigen.',
      'P-fimbriae → pyelonephritis; #1 cause of UTI, #1 gram-negative bacteremia, #2 neonatal meningitis (K1), cholangitis, intra-abdominal infection, travelers’ diarrhea.',
      'EHEC O157:H7: Shiga-like toxin (inactivates 60S ribosome) → bloody diarrhea WITHOUT fever → HUS (hemolytic anemia, thrombocytopenia, AKI). Antibiotics increase toxin release — don’t treat.',
      'Doubling time ~20 minutes: an untreated infection outgrows everything (watch the swarm mechanic).',
      'Half of isolates make TEM-1 β-lactamase (ampicillin useless); 20-30% resistant to TMP-SMX and FQs; ESBL (CTX-M) rising.',
    ],
    sites: ['Urinary tract (cystitis, pyelonephritis — #1 cause)', 'Bloodstream (urosepsis)', 'Peritoneum & intra-abdominal abscess', 'Neonatal meninges (K1)', 'Gut (travelers’ diarrhea, EHEC/HUS)'],
  },
  ecoli_tem: { base: 'ecoli', quirks: ['TEM-1 (1965, Athens — named after patient Temoneira) was the first plasmid-borne β-lactamase. It made ampicillin-for-everything obsolete and started the inhibitor and cephalosporin races.'] },
  ecoli_esbl: { base: 'ecoli', quirks: ['CTX-M-15 (named for cefotaxime hydrolysis) on a plasmid that also carries FQ (qnr, aac(6’)-Ib-cr), TMP-SMX (dfr) and aminoglycoside genes; the pandemic ST131 clone; risk factors: prior antibiotics, travel to South Asia, healthcare. Carbapenem for invasive disease; nitrofurantoin/fosfomycin for cystitis.'] },
  klebsiella: {
    mnemonic: 'Klebsiella: the 4 A’s — Aspiration pneumonia, Alcoholics, Abscess in lungs (cavitary), and "currAnt-jelly" sputum.',
    quirks: [
      'Gram-negative rod; lactose fermenter; NON-motile; urease-positive; huge polysaccharide capsule → mucoid colonies and "currant-jelly" sputum.',
      'Hypermucoviscous K1/K2 strains (positive string test): liver abscess + endophthalmitis in diabetics, East Asia.',
      'Cavitary upper-lobe pneumonia in alcoholics/diabetics; hospital UTI and bacteremia; neonatal sepsis.',
      'Intrinsically ampicillin-resistant (chromosomal SHV-1); the organism in which KPC (1996, North Carolina) and NDM-1 (2008, New Delhi) were first described.',
    ],
    sites: ['Lung (aspiration/alcoholic cavitary pneumonia)', 'Urinary tract (hospital)', 'Liver abscess (hypervirulent strains)', 'Bloodstream & ICU devices'],
  },
  klebsiella_esbl: { base: 'klebsiella', quirks: ['ESBL Klebsiella outbreaks spread on healthcare workers’ hands; co-resistance to FQ and TMP-SMX; carbapenem therapy → the next step is KPC.'] },
  klebsiella_kpc: { base: 'klebsiella', quirks: ['KPC = Klebsiella pneumoniae carbapenemase, a class A serine enzyme on a plasmid (ST258 clone); ceftazidime-avibactam, meropenem-vaborbactam, imipenem-relebactam; mortality of CRE bacteremia ~40-50%.'] },
  klebsiella_ndm: { base: 'klebsiella', quirks: ['NDM-1 (2008, a Swedish patient hospitalized in New Delhi): class B zinc metallo-β-lactamase — hydrolyzes everything but aztreonam, ignores avibactam. Answer: ceftazidime-avibactam + aztreonam, or cefiderocol.'] },
  proteus: {
    mnemonic: 'Proteus: swarms, smells like burnt chocolate, and builds staghorns (urease → alkaline urine → struvite).',
    quirks: [
      'Gram-negative rod; lactose NON-fermenter; SWARMING motility (concentric waves on agar); UREASE-positive; H₂S-positive (black on TSI); "burnt chocolate"/fishy odor.',
      'Urease splits urea → ammonia → urine pH >8 → magnesium-ammonium-phosphate (struvite) staghorn calculi that harbor bacteria — the stone must be removed.',
      'Catheter-associated and complicated UTI; wound infections; OX-19 antigen cross-reacts in the Weil-Felix test for rickettsia.',
      'Intrinsically resistant to nitrofurantoin, tetracyclines, colistin/polymyxins, tigecycline; usually susceptible to ampicillin/cephalosporins/TMP-SMX/FQ.',
    ],
    sites: ['Urinary tract (stones, catheters)', 'Kidney (staghorn calculi, pyelonephritis)', 'Wounds & decubitus ulcers'],
  },
  enterobacter: {
    mnemonic: 'Inducible AmpC ("SPICE / HECK-Yes" organisms): Serratia, Providencia, Indole-positive Proteus, Citrobacter freundii, Enterobacter, (Hafnia, Klebsiella aerogenes). Treat with cefepime or a carbapenem, not ceftriaxone.',
    quirks: [
      'Gram-negative rod, lactose fermenter, motile; hospital-acquired pneumonia, UTI, line and surgical infections.',
      'Chromosomal inducible AmpC β-lactamase: 3rd-gen cephalosporins and pip-tazo can test susceptible and then fail as derepressed mutants (1 in 10⁶-10⁷) take over within days.',
      'Cefepime is a poor AmpC substrate (stable); carbapenems are stable; FQ/TMP-SMX if susceptible.',
      'Serratia marcescens (red pigment — "red diaper syndrome", contact-lens keratitis) is the same AmpC family.',
    ],
    sites: ['Lung (ventilator/hospital pneumonia)', 'Urinary tract (catheters)', 'Bloodstream via lines', 'Surgical wounds'],
  },
  salmonella: {
    mnemonic: 'Salmon swim (motile) and make H₂S (black on Hektoen). Salmonella in sickle cell → osteomyelitis. Don’t treat the uncomplicated gastroenteritis.',
    quirks: [
      'Gram-negative rod; lactose NON-fermenter; motile (flagella); H₂S-positive (black colonies on Hektoen/TSI); acid-labile → needs a large inoculum; PPIs/achlorhydria increase risk.',
      'Non-typhoidal (S. Enteritidis/Typhimurium): poultry, eggs, reptiles (pet turtles), peanut butter → gastroenteritis 12-72 h; invasive disease in sickle cell (osteomyelitis) and the elderly (endovascular/aortitis); antibiotics PROLONG carriage in uncomplicated cases.',
      'S. Typhi (humans only): typhoid fever — stepwise fever, relative bradycardia (Faget sign), ROSE SPOTS on the abdomen, constipation then "pea-soup" diarrhea, hepatosplenomegaly; chronic gallbladder carriage ("Typhoid Mary"); Vi capsule; vaccines (Vi polysaccharide IM, Ty21a oral live).',
      'Invades through M cells of Peyer’s patches; survives inside macrophages (facultative intracellular).',
    ],
    sites: ['Gut (gastroenteritis, enteric fever)', 'Bone (sickle cell osteomyelitis)', 'Bloodstream & endovascular (aortitis in the elderly)', 'Gallbladder (chronic carriage)'],
  },
  campylobacter: {
    mnemonic: 'Campylobacter = "camp fire hot" — grows at 42°C; comma/gull-wing shaped; Guillain-Barré follows.',
    quirks: [
      'Gram-negative curved/comma/"gull-wing" rods; oxidase-positive; microaerophilic; grows at 42°C; darting motility.',
      '#1 bacterial gastroenteritis worldwide: undercooked poultry, unpasteurized milk, puppies; bloody diarrhea, fever, abdominal pain that mimics appendicitis.',
      'Post-infectious Guillain-Barré syndrome (molecular mimicry with GM1 gangliosides) and reactive arthritis (HLA-B27).',
      'Usually self-limited; azithromycin if severe — fluoroquinolone resistance is common (poultry FQ use).',
    ],
    sites: ['Gut (inflammatory diarrhea)', 'Peripheral nerves (post-infectious GBS)', 'Joints (reactive arthritis)'],
  },
  pseudomonas: {
    mnemonic: 'PSEUDOMONAS: Pneumonia (CF, vent), Sepsis, Ecthyma gangrenosum, UTI (catheter), Diabetic osteomyelitis (nail through the sneaker), Otitis externa (swimmer’s; malignant in diabetics), Mucoid (CF), Osteomyelitis, Nosocomial, Aeruginosa = green, Sepsis in burns… plus hot-tub folliculitis and contact-lens keratitis.',
    quirks: [
      'Gram-negative rod; lactose NON-fermenter; OXIDASE-positive; obligate aerobe; single polar flagellum; grape/tortilla odor; blue-green pigments PYOCYANIN (blue) + PYOVERDIN (fluorescent green).',
      'Lives in water and wet places: sinks, ventilator circuits, hot tubs, contact-lens solution, flower vases — the ICU’s environmental organism.',
      'Exotoxin A ADP-ribosylates EF-2 (same mechanism as diphtheria toxin) → protein synthesis halts; elastase, phospholipase C, endotoxin; alginate biofilm in cystic fibrosis (mucoid).',
      'Ecthyma gangrenosum: black necrotic skin lesion in neutropenic bacteremia. Hot-tub folliculitis. Malignant otitis externa in diabetics (skull-base osteomyelitis).',
      'Intrinsic resistance (low-permeability OM, MexAB-OprM efflux, chromosomal AmpC) + acquired (OprD porin loss, efflux up-regulation, metallo-β-lactamases).',
    ],
    sites: ['Lung (ventilator pneumonia, cystic fibrosis)', 'Bloodstream in neutropenia & burns', 'Urinary tract (catheters)', 'Ear (otitis externa; malignant in diabetics)', 'Bone (puncture wounds, diabetic foot)', 'Eye (contact-lens keratitis), skin (hot-tub folliculitis)'],
  },
  pseudomonas_mdr: { base: 'pseudomonas', quirks: ['Difficult-to-treat (DTR) Pseudomonas: carbapenem + β-lactam + FQ non-susceptible. Options: ceftolozane-tazobactam, ceftazidime-avibactam, imipenem-relebactam, cefiderocol; aminoglycoside/colistin combinations. Often follows years of therapy in CF or prolonged ICU stays.'] },
  acinetobacter: {
    mnemonic: '"Iraqibacter": a coccobacillus that survives on dry surfaces for weeks and collects carbapenemases.',
    quirks: [
      'Gram-negative COCCOBACILLUS (looks like Neisseria on a smear), non-fermenter, oxidase-NEGATIVE, strictly aerobic, non-motile.',
      'Desiccation-resistant: bedrails, ventilators, keyboards → ICU outbreaks; war/trauma wounds ("Iraqibacter").',
      'Ventilator pneumonia, line bacteremia, meningitis after neurosurgery, burn wounds; low virulence, high survivability.',
      'OXA-23/OXA-51 carbapenemases, porin loss, AdeABC efflux, aminoglycoside-modifying enzymes → often pan-resistant. Sulbactam-durlobactam (2023), high-dose ampicillin-sulbactam, cefiderocol, colistin, minocycline.',
    ],
    sites: ['Lung (ventilator pneumonia)', 'Bloodstream via lines', 'Wounds & burns', 'CNS after neurosurgery'],
  },
  steno: {
    mnemonic: 'Steno appears when carbapenems clear the field — treat with TMP-SMX.',
    quirks: [
      'Gram-negative non-fermenting rod; oxidase-negative; yellow-green colonies; environmental water organism (ventilator circuits, faucets).',
      'Intrinsically carbapenem-resistant: L1 metallo-β-lactamase + L2 cephalosporinase — selected FOR during carbapenem therapy in ICU/oncology patients.',
      'Pneumonia, line bacteremia in ventilated or neutropenic patients; colonizer vs pathogen can be hard to tell.',
      'TMP-SMX (high dose) is the drug of choice; levofloxacin, minocycline, cefiderocol, ceftazidime alternatives/combinations.',
    ],
    sites: ['Lung (ICU pneumonia)', 'Bloodstream via central lines', 'Mucositis/neutropenia'],
  },
  hflu: {
    mnemonic: 'HaEMOPhilus: Epiglottitis, Meningitis, Otitis media, Pneumonia. Needs factor X (hematin) and V (NAD⁺) → chocolate agar; satellites around staph.',
    quirks: [
      'Gram-negative pleomorphic COCCOBACILLUS; requires factors X (hemin) and V (NAD⁺) → grows on chocolate agar (heated blood releases them) or as satellites around S. aureus on blood agar.',
      'Type b capsule (PRP) → epiglottitis (drooling, tripod, "thumbprint sign", cherry-red epiglottis — don’t examine the throat), meningitis, septic arthritis, buccal cellulitis. Hib conjugate vaccine (PRP + carrier protein for T-cell help) nearly eliminated it.',
      'Nontypeable H. flu (NTHi): otitis media, sinusitis, COPD exacerbations, CAP; IgA protease.',
      '~30% make TEM-1 β-lactamase (amox-clav, ceftriaxone); rare BLNAR strains alter PBP3. Rifampin prophylaxis for unvaccinated close contacts of invasive Hib.',
    ],
    sites: ['Epiglottis (Hib)', 'Meninges (Hib, unvaccinated children)', 'Middle ear, sinuses, bronchi (NTHi)', 'Lung (CAP, COPD exacerbations)'],
  },
  hflu_bl: { base: 'hflu', quirks: ['β-lactamase-positive H. flu: the reason amoxicillin fails in otitis/sinusitis and Augmentin exists. Clavulanate (a suicide inhibitor) restores the amoxicillin.'] },
  bfrag: {
    mnemonic: 'Below the diaphragm think B. fragilis → metronidazole; above it, oral anaerobes → penicillin/clindamycin. Aminoglycosides NEVER (no O₂, no uptake).',
    quirks: [
      'Gram-negative anaerobic bacillus, pleomorphic; bile-resistant (black colonies on BBE agar); the dominant colonic anaerobe (10¹¹/g stool).',
      'Polysaccharide capsule is directly abscessogenic; produces cepA β-lactamase (penicillin and most cephalosporins fail; cefoxitin/cefotetan are the exceptions).',
      'Polymicrobial abscesses after perforation (appendicitis, diverticulitis), pelvic abscess, diabetic foot, aspiration empyema (mixed); foul-smelling pus and gas.',
      'Metronidazole gold standard; pip-tazo, carbapenems, amox-clav; clindamycin ~30% resistant; the other half of the treatment is DRAINAGE.',
    ],
    sites: ['Peritoneum & intra-abdominal abscess', 'Pelvis (tubo-ovarian abscess)', 'Diabetic foot & decubitus ulcers', 'Bloodstream from a gut source'],
  },
  hpylori: {
    mnemonic: 'H. pylori: urease-positive (breath test), ulcers + gastric cancer + MALT lymphoma; quadruple therapy because monotherapy always fails.',
    quirks: [
      'Gram-negative curved/spiral rod; oxidase-, catalase- and UREASE-positive (urea breath test; CLO rapid urease test on biopsy; stool antigen); 4-6 polar flagella; lives in the antral mucus layer under an ammonia cloud.',
      'Duodenal ulcers (>90%), gastric ulcers (~70%), chronic gastritis, gastric adenocarcinoma (class I carcinogen) and MALT lymphoma (regresses with eradication).',
      'Bismuth quadruple (PPI + bismuth + metronidazole + tetracycline ×14 d) or clarithromycin triple (PPI + clarithromycin + amoxicillin) only where clarithromycin resistance <15%; confirm eradication with breath/stool test ≥4 weeks later, off PPI for 2 weeks.',
      'CagA/VacA virulence; transmission fecal-oral/oral-oral in childhood; no vaccine.',
    ],
    sites: ['Stomach (antral gastritis, ulcers, cancer, MALT lymphoma)', 'Duodenum (ulcers)'],
  },
  mycoplasma: {
    mnemonic: 'Mycoplasma: no wall, no Gram stain, no β-lactams; cold agglutinins; "walking pneumonia" on a fried-egg colony.',
    quirks: [
      'The only bacteria WITHOUT a cell wall (sterols/cholesterol in the membrane); smallest free-living organisms; slow "fried-egg" colonies on Eaton’s agar; invisible on Gram stain.',
      '"Walking pneumonia" in teens/young adults, dorms, military recruits: insidious dry cough, headache, low-grade fever; CXR looks worse than the patient.',
      'COLD AGGLUTININS (IgM vs the I antigen on RBCs → agglutination at 4°C, mild hemolysis); bullous myringitis; erythema multiforme / Stevens-Johnson; Raynaud; encephalitis; arthritis.',
      'P1 adhesin attaches to ciliated epithelium; PCR diagnosis now; treat macrolide/doxycycline/FQ — macrolide resistance (23S rRNA) common in East Asia.',
    ],
    sites: ['Lung (atypical/walking pneumonia)', 'Trachea & bronchi', 'Skin/mucosa (erythema multiforme, SJS)', 'RBCs (cold agglutinin hemolysis), CNS (encephalitis)'],
  },
  chlamydia: {
    mnemonic: 'Chlamydia trachomatis serotypes: A-C = Africa/Blindness/Chronic (trachoma); D-K = everything Down there (urethritis, PID, neonatal conjunctivitis/pneumonia); L1-L3 = Lymphogranuloma venereum.',
    quirks: [
      'Obligate INTRACELLULAR "energy parasite" (can’t make its own ATP); no classic peptidoglycan (no muramic acid) → β-lactams fail; Giemsa-stained cytoplasmic inclusions.',
      'Two forms: ELEMENTARY body (small, infectious, enters by endocytosis) ↔ RETICULATE body (replicates by binary fission inside the inclusion).',
      'C. trachomatis: most common reportable STI; urethritis/cervicitis (often asymptomatic), PID, Fitz-Hugh-Curtis, infertility/ectopic; reactive arthritis ("can’t see, can’t pee, can’t climb a tree"); neonatal conjunctivitis at 5-14 days and staccato-cough pneumonia; LGV: painless ulcer → painful buboes.',
      'C. pneumoniae: atypical pneumonia; C. psittaci: psittacosis from birds. Treat doxycycline ×7 d (preferred) or azithromycin 1 g (pregnancy); treat partners; test of cure in pregnancy.',
    ],
    sites: ['Urethra, cervix, fallopian tubes (STI, PID)', 'Eye (trachoma, neonatal conjunctivitis)', 'Lung (atypical pneumonia; neonatal pneumonia)', 'Lymph nodes (LGV)', 'Joints (reactive arthritis)'],
  },
  legionella: {
    mnemonic: 'Legionella: pneumonia + diarrhea + confusion + HYPONATREMIA, from a water source, silver stain, charcoal yeast agar, urine antigen — macrolide or FQ.',
    quirks: [
      'Gram-negative rod that stains POORLY (use silver stain); grows only on BCYE agar (buffered charcoal yeast extract — needs iron and cysteine); facultative INTRACELLULAR in alveolar macrophages (and in amoebae in water).',
      'Aerosolized water: cooling towers, hot tubs, hospital plumbing, cruise ships — NO person-to-person spread. 1976 American Legion convention, Philadelphia.',
      'Legionnaires’ disease: severe pneumonia with GI symptoms (diarrhea), confusion, HIGH fever with relative bradycardia, hyponatremia, elevated LFTs/CK; smokers, COPD, elderly, immunosuppressed. Pontiac fever = mild flu-like, no pneumonia.',
      'Urine antigen detects serogroup 1 only; PCR/culture for the rest. Levofloxacin or azithromycin — every β-lactam fails (intracellular + β-lactamase).',
    ],
    sites: ['Lung (severe atypical pneumonia)', 'GI & CNS symptoms (systemic)', 'Water systems (environmental reservoir)'],
  },
  borrelia: {
    mnemonic: 'Lyme by stage: 1 = bull’s-eye (erythema migrans) · 2 = Bell’s palsy, AV block, meningitis · 3 = knee arthritis, encephalopathy. Ixodes tick, ≥36 h attached, northeastern US.',
    quirks: [
      'Large spirochete visible with Wright/Giemsa stain (unlike Treponema); vector Ixodes scapularis (deer tick, nymph stage); reservoir white-footed mouse; northeast & upper Midwest; summer.',
      'Erythema migrans (≥5 cm expanding ring, days to weeks) = clinical diagnosis, serology negative early; later: 2-tier ELISA → Western blot.',
      'Early disseminated: bilateral facial (Bell’s) palsy, AV block (carditis), meningitis, migratory arthralgias. Late: monoarthritis of the knee, acrodermatitis chronica atrophicans.',
      'Doxycycline for all ages (also covers co-transmitted Anaplasma); amoxicillin/cefuroxime in pregnancy; ceftriaxone for carditis/neuro disease; single-dose doxycycline prophylaxis within 72 h of a tick bite. Co-infection with Babesia (atovaquone + azithromycin) — doxy doesn’t cover it.',
    ],
    sites: ['Skin (erythema migrans)', 'Heart (AV block)', 'Nerves & meninges (facial palsy, meningitis)', 'Joints (late monoarthritis)'],
  },
  treponema: {
    mnemonic: 'Syphilis stages: 1° painless chancre · 2° palms/soles rash + condylomata lata · 3° gummas, aortitis, tabes, Argyll Robertson pupil. VDRL false positives: Viruses, Drugs, Rheumatic/Lupus.',
    quirks: [
      'Thin spirochete invisible on light microscopy → darkfield; cannot be cultured; nontreponemal tests (RPR/VDRL — titers track disease, false positives in SLE/antiphospholipid/pregnancy/viral illness) then treponemal (FTA-ABS/TP-PA — positive for life).',
      'Primary: painless indurated CHANCRE (3 weeks) that heals alone. Secondary: maculopapular rash on PALMS and SOLES, condylomata lata (very infectious), patchy alopecia, lymphadenopathy. Latent. Tertiary: gummas, aortitis (vasa vasorum endarteritis → ascending aortic aneurysm), tabes dorsalis (dorsal columns, Argyll Robertson pupil — accommodates but doesn’t react), general paresis.',
      'Congenital: snuffles, saddle nose, Hutchinson teeth, mulberry molars, saber shins, deafness, interstitial keratitis — screen every pregnancy.',
      'Benzathine penicillin G IM (1 dose early; 3 weekly doses late latent); IV penicillin G for neurosyphilis; desensitize penicillin-allergic pregnant patients; Jarisch-Herxheimer reaction after the first dose.',
    ],
    sites: ['Genital skin/mucosa (chancre)', 'Skin (palms & soles), lymph nodes', 'Aorta (aortitis), CNS (tabes, paresis), eyes', 'Placenta/fetus (congenital syphilis)'],
  },
  tb: {
    mnemonic: 'TB = apices, cavities, caseating granulomas, acid-fast, RIPE for 6 months; TST cutoffs 5/10/15 mm; anti-TNF reactivates it.',
    quirks: [
      'Acid-fast (Ziehl-Neelsen, auramine-rhodamine) due to mycolic acids; cord factor (serpentine cords, TNF-α release); sulfatides block phagolysosome fusion; obligate aerobe (loves the apices); doubling time ~20 HOURS; Löwenstein-Jensen culture takes weeks → Xpert MTB/RIF PCR for speed and rifampin resistance.',
      'Primary: Ghon focus + hilar node = Ghon complex (calcified = Ranke). Latent: caseating granuloma with Langhans giant cells, held by TNF-α (anti-TNF drugs and HIV reactivate). Reactivation: apical cavities, night sweats, weight loss, hemoptysis.',
      'Extrapulmonary: miliary ("millet seeds"), Pott disease (spine), scrofula (cervical nodes), basilar meningitis (CN palsies), Addison disease (adrenals), sterile pyuria (GU TB).',
      'TST: ≥5 mm (HIV, contacts, immunosuppressed, old TB on CXR), ≥10 mm (immigrants, IVDU, healthcare workers, prisons, diabetes), ≥15 mm (everyone). BCG causes false-positive TST, not IGRA.',
      'Airborne isolation (N95, negative pressure). RIPE ×2 months then RI ×4 months, B6 with INH, directly observed therapy; 4 drugs because resistant mutants pre-exist in every cavity.',
    ],
    sites: ['Lung apices (cavitary reactivation)', 'Lymph nodes (scrofula)', 'Spine (Pott disease), bone & joint', 'Meninges (basilar meningitis)', 'Kidney/GU, adrenals, pericardium, miliary everywhere'],
  },
  candida: {
    mnemonic: 'Candida: germ tubes at 37°C, pseudohyphae, thrush you can scrape off; candidemia after broad antibiotics + TPN + lines — echinocandin, pull the line, eye exam.',
    quirks: [
      'Oval budding YEAST; pseudohyphae at 20°C and true GERM TUBES at 37°C (germ tube test = C. albicans); catalase-positive; stains gram-positive but is a eukaryote.',
      'Oral thrush (scrapes off — hairy leukoplakia doesn’t; think HIV/inhaled steroids), esophagitis (AIDS-defining, CD4 <100), vulvovaginitis (cottage-cheese discharge, normal pH, pseudohyphae on KOH — after antibiotics, diabetes, pregnancy), intertrigo, diaper rash; chronic mucocutaneous candidiasis = T-cell defect.',
      'Candidemia (4th most common bloodstream isolate in hospitals): neutropenia, central lines, TPN, broad-spectrum antibiotics, abdominal surgery → endophthalmitis (dilated eye exam!), endocarditis (IV drug use, huge vegetations), hepatosplenic candidiasis in neutropenia recovery.',
      'Treat: nystatin/topical azoles; fluconazole; ECHINOCANDIN for candidemia; remove lines. C. glabrata (dose-dependent fluconazole), C. krusei (intrinsically azole-resistant), C. auris (multidrug-resistant, hospital outbreaks, CDC urgent threat).',
    ],
    sites: ['Mouth & esophagus (thrush, esophagitis)', 'Vagina, skin folds, diaper area', 'Bloodstream via lines/TPN (candidemia)', 'Eyes (endophthalmitis), heart valves (IVDU), liver/spleen (neutropenia)'],
  },
  rhinovirus: {
    mnemonic: 'Colds are viruses. Bronchitis is (almost always) a virus. Antibiotics for either: all risk, no benefit.',
    quirks: [
      'Rhinovirus: picornavirus, naked +ssRNA, ACID-LABILE (so it doesn’t infect the gut, unlike enteroviruses), grows best at 33°C — the temperature of the nose; >100 serotypes → no vaccine; ICAM-1 receptor; #1 cause of the common cold.',
      'Influenza: orthomyxovirus, segmented −ssRNA (8 segments → reassortment = antigenic SHIFT → pandemics; point mutations = DRIFT → yearly vaccine). Hemagglutinin binds sialic acid; neuraminidase releases virions (oseltamivir/zanamivir within 48 h).',
      'Influenza complications: post-viral S. aureus or pneumococcal pneumonia, Reye syndrome with aspirin in children, myositis, Guillain-Barré.',
      '"Acute bronchitis" is viral >90% of the time; sinusitis is viral unless symptoms last >10 days, "double-worsen", or are severe. Neither needs antibiotics.',
    ],
    sites: ['Nose & pharynx (common cold)', 'Bronchi (acute bronchitis)', 'Lung (influenza pneumonia, then bacterial superinfection)'],
  },
  gonococcus: {
    mnemonic: 'Gonococcus: glucose only, no capsule, no vaccine (pilus antigenic variation), intracellular diplococci in PMNs; ceftriaxone 500 mg IM — the last reliable drug.',
    quirks: [
      'Gram-negative kidney-bean diplococci INSIDE neutrophils on a urethral smear (diagnostic in men); ferments glucose only; no capsule; grows on Thayer-Martin (VPN: vancomycin, polymyxin, nystatin + trimethoprim suppress competitors); oxidase-positive.',
      'Pili with antigenic/phase variation → no lasting immunity, no vaccine; IgA protease; Opa proteins.',
      'Urethritis/cervicitis (purulent), PID (chandelier sign, Fitz-Hugh-Curtis, infertility), epididymitis, disseminated gonococcal infection (triad: migratory polyarthralgia, tenosynovitis, pustular dermatitis — or a purulent monoarthritis; most common septic arthritis in sexually active young adults), neonatal ophthalmia at 2-5 days (erythromycin eye ointment prophylaxis). Terminal complement deficiency → DGI.',
      'Ceftriaxone 500 mg IM ×1 (1 g if ≥150 kg) + doxycycline if chlamydia not excluded; treat partners (expedited partner therapy). Resistance timeline: sulfonamides → penicillin (PPNG) → tetracycline → FQ (2007) → azithromycin (dropped 2020) → rising ceftriaxone MICs.',
    ],
    sites: ['Urethra, cervix, pharynx, rectum', 'Fallopian tubes (PID), epididymis', 'Joints, tendons & skin (disseminated infection)', 'Neonatal eye (ophthalmia neonatorum)'],
  },
  nocardia: {
    mnemonic: 'SNAP: Sulfa for Nocardia; Actinomyces gets Penicillin. Nocardia = aerobe, partially acid-fast, immunocompromised lungs + brain.',
    quirks: [
      'Gram-positive branching filamentous rods, weakly/PARTIALLY acid-fast (modified Kinyoun), strict AEROBE, soil organism. (Actinomyces: not acid-fast, ANAEROBE, normal oral flora, sulfur granules, "lumpy jaw" after dental work / IUD-associated pelvic disease → penicillin.)',
      'Immunocompromised (transplant, chronic steroids, HIV): cavitary/nodular pneumonia + BRAIN abscess (always image the head); immunocompetent: cutaneous/lymphocutaneous infection after a gardening scratch (mycetoma).',
      'TMP-SMX (high dose) is the drug of choice, often with imipenem or amikacin for severe disease; linezolid alternative; months of therapy; TMP-SMX PJP prophylaxis also prevents it.',
    ],
    sites: ['Lung (nodules, cavities)', 'Brain (abscess)', 'Skin (mycetoma, lymphocutaneous)'],
  },
  pjp: {
    mnemonic: 'PJP: CD4 <200, dry cough, hypoxia out of proportion, ↑LDH, ground-glass — TMP-SMX, steroids if PaO₂ <70.',
    quirks: [
      'A FUNGUS (formerly "P. carinii" — that name now belongs to the rat species; jirovecii infects humans) that can’t be cultured; methenamine SILVER stain of BAL/induced sputum shows "crushed ping-pong ball" cysts; lacks ergosterol → azoles and amphotericin are useless.',
      'HIV with CD4 <200, transplant, high-dose steroids: subacute dyspnea, dry cough, fever, exertional desaturation, high LDH, bilateral interstitial/ground-glass infiltrates, pneumothorax; BAL diagnosis.',
      'TMP-SMX ×21 days (+ prednisone if PaO₂ <70 or A-a gradient >35); alternatives: IV pentamidine (pancreatitis, hypoglycemia, nephrotoxicity), atovaquone, clindamycin + primaquine, dapsone + TMP.',
      'Prophylaxis: TMP-SMX when CD4 <200 (also covers Toxoplasma <100 and Nocardia); stop when CD4 >200 for 3 months on ART.',
    ],
    sites: ['Lung (diffuse interstitial pneumonia in the immunocompromised)'],
  },
};

/** Resolve inheritance: returns { quirks, sites, mnemonic } for a bug id */
export function bugExtra(id) {
  const e = BUG_EXTRA[id]; if (!e) return null;
  if (!e.base) return e;
  const b = BUG_EXTRA[e.base] || {};
  return { mnemonic: e.mnemonic || b.mnemonic, quirks: [...(e.quirks || []), ...(b.quirks || [])], sites: e.sites || b.sites || [] };
}
