// ============================================================================
// SITES OF INFECTION — syndrome → usual organisms → empiric therapy → pearls
// Used by: the ID-consult NPC, the Principles codex, and dungeon "site briefs".
// ============================================================================
export const SITES = [
  {
    id: 'skin', name: 'Skin & soft tissue', dungeon: 'abscess',
    bugs: 'Group A strep (non-purulent cellulitis, erysipelas, impetigo); S. aureus incl. MRSA (purulent: abscess, furuncle); anaerobes + enteric GNRs in diabetic foot/decubitus; Pasteurella (cat/dog bites); Vibrio vulnificus (salt water, cirrhosis); Aeromonas (fresh water); Pseudomonas (hot tub, nail through sneaker); Clostridium perfringens (gas gangrene).',
    empiric: 'Non-purulent cellulitis → cephalexin or cefazolin (strep + MSSA). Purulent/abscess → incision & drainage, then TMP-SMX or doxycycline if antibiotics are needed (community MRSA). Severe or necrotizing → vancomycin + pip-tazo + clindamycin (toxin suppression) + urgent surgery. Bites → amoxicillin-clavulanate. Diabetic foot → amp-sulbactam / pip-tazo ± MRSA coverage.',
    pearls: 'Mark the edge of erythema with a pen. Abscess = drainage first; many small abscesses need no antibiotic at all. Necrotizing fasciitis: pain out of proportion, crepitus, systemic toxicity — surgery is the treatment, antibiotics are the adjunct.',
  },
  {
    id: 'pharyngitis', name: 'Pharyngitis & upper respiratory infection', dungeon: 'pharynx',
    bugs: 'Mostly VIRUSES (rhinovirus, adenovirus, EBV, influenza). Group A strep (~15-30% of sore throats in children, 5-15% in adults). Rarely: Fusobacterium (Lemierre syndrome), N. gonorrhoeae, diphtheria (unvaccinated).',
    empiric: 'Viral URI/bronchitis → NO antibiotics. Strep pharyngitis (confirmed by rapid test/culture; Centor/McIsaac to decide who to test) → penicillin V or amoxicillin ×10 days; cephalexin, clindamycin, or azithromycin if allergic. Sinusitis: watchful waiting unless >10 days, severe, or double-worsening → amoxicillin-clavulanate. Otitis media: high-dose amoxicillin; amox-clav if recent amoxicillin/β-lactamase concern.',
    pearls: 'Treat strep to prevent rheumatic fever and suppurative complications, not to shorten symptoms (~1 day). Cough + runny nose argue AGAINST strep. EBV + amoxicillin = rash (not an allergy).',
  },
  {
    id: 'uti', name: 'Urinary tract infection', dungeon: 'bladder',
    bugs: 'E. coli (~80%), Klebsiella, Proteus (stones, alkaline urine), Enterococcus (catheters), Staph saprophyticus (young women), Pseudomonas (catheters, hospital), Candida (catheters — usually colonization).',
    empiric: 'Uncomplicated cystitis → nitrofurantoin ×5 d, TMP-SMX ×3 d (if local resistance <20%), or fosfomycin ×1. Pyelonephritis → ceftriaxone (or ciprofloxacin if local resistance <10%); ESBL → ertapenem/meropenem; oral step-down when able. Catheter UTI → remove/replace the catheter, treat only if symptomatic. Prostatitis → FQ or TMP-SMX ×4-6 weeks (penetration).',
    pearls: 'Do NOT treat asymptomatic bacteriuria (exceptions: pregnancy, before urologic procedures). Nitrofurantoin/fosfomycin = urine-only drugs; never for pyelonephritis or bacteremia. Avoid FQs for uncomplicated cystitis (FDA boxed warnings).',
  },
  {
    id: 'pneumonia', name: 'Pneumonia (CAP · HAP/VAP · aspiration)', dungeon: 'lung',
    bugs: 'CAP: Strep pneumoniae, H. influenzae, Moraxella, atypicals (Mycoplasma, Chlamydia pneumoniae, Legionella), viruses (influenza, RSV, COVID), S. aureus post-influenza. HAP/VAP: Pseudomonas, Enterobacterales (incl. ESBL/AmpC), MRSA, Acinetobacter. Aspiration: oral flora, anaerobes (abscess/empyema). Alcoholics: Klebsiella. CF: Pseudomonas, Burkholderia.',
    empiric: 'Outpatient healthy → amoxicillin (high dose) or doxycycline (or a macrolide where pneumococcal resistance <25%). Outpatient with comorbidities → amox-clav + macrolide/doxy, or a respiratory FQ. Inpatient non-ICU → ceftriaxone + azithromycin, or levofloxacin/moxifloxacin. ICU → ceftriaxone + azithromycin (or + FQ); add vancomycin/linezolid if MRSA risk; use pip-tazo/cefepime/meropenem if Pseudomonas risk. HAP/VAP → anti-pseudomonal β-lactam ± MRSA coverage, de-escalate at 48-72 h. Aspiration → amp-sulbactam or ceftriaxone (routine anaerobic coverage no longer recommended unless abscess/empyema).',
    pearls: 'Every CAP regimen covers BOTH typicals and atypicals — that is why it is two drugs or one FQ. Daptomycin never (surfactant). Legionella: urine antigen, hyponatremia, GI symptoms. Procalcitonin helps stop antibiotics, not start them. 5 days is enough for most CAP.',
  },
  {
    id: 'intraabdominal', name: 'Intra-abdominal infection & diarrhea', dungeon: 'gut',
    bugs: 'Perforation/appendicitis/diverticulitis: E. coli & other enterics + Bacteroides fragilis ± Enterococcus; cholangitis/cholecystitis: E. coli, Klebsiella, Enterococcus; SBP: E. coli, Klebsiella, pneumococcus; H. pylori (ulcers); infectious diarrhea: viruses, Salmonella, Campylobacter, Shigella, EHEC, C. difficile; travelers’: ETEC.',
    empiric: 'Community intra-abdominal → ceftriaxone + metronidazole, or pip-tazo alone, or ertapenem; source control (drain/resect). Hospital-acquired/severe → pip-tazo or meropenem (+ vancomycin if MRSA/enterococcal risk, antifungal if Candida). SBP → ceftriaxone + albumin. Cholangitis → drain the duct + ceftriaxone/metronidazole or pip-tazo. C. difficile → fidaxomicin or oral vancomycin. Infectious diarrhea → usually none; azithromycin for severe Campylobacter/travelers’; NEVER antibiotics for suspected EHEC.',
    pearls: 'If you are on pip-tazo, amox-clav/amp-sulbactam, or a carbapenem you ALREADY cover anaerobes — adding metronidazole is redundant. Enterococcus matters in healthcare-associated and post-operative infection, not in community appendicitis.',
  },
  {
    id: 'endocarditis', name: 'Bacteremia & endocarditis', dungeon: 'heart',
    bugs: 'S. aureus (acute; IV drug use → tricuspid; lines; prosthetic valves), viridans strep (subacute, dental), Enterococcus (older men, GU/GI), coagulase-negative staph (prosthetic valves, lines), HACEK (culture-negative-ish), Candida (IVDU, TPN), S. gallolyticus (colon cancer), Coxiella/Bartonella (culture-negative).',
    empiric: 'Empiric native-valve endocarditis → vancomycin (+ ceftriaxone). Prosthetic valve → vancomycin + gentamicin + rifampin. MSSA → nafcillin/cefazolin (NOT vancomycin); MRSA → vancomycin or daptomycin (high dose); viridans/S. gallolyticus → penicillin G or ceftriaxone; Enterococcus faecalis → ampicillin + ceftriaxone (or + gentamicin); VRE → daptomycin/linezolid; Candida → echinocandin + surgery. Durations 4-6 weeks IV (POET trial: oral step-down for selected stable patients).',
    pearls: 'S. aureus bacteremia: repeat cultures q24-48 h, echocardiogram (TEE), remove lines, look for metastatic foci, ID consult (lowers mortality), ≥14 days IV from first negative culture. Bacteriostatic drugs and short courses fail here — vegetations are avascular biofilms.',
  },
  {
    id: 'meningitis', name: 'Meningitis & CNS infection', dungeon: 'brain',
    bugs: 'Neonates: GBS, E. coli K1, Listeria. Children/adults: Strep pneumoniae, N. meningitidis (+ H. influenzae if unvaccinated). >50 y / immunocompromised / pregnant: + Listeria. Post-neurosurgery/shunt: staph (incl. MRSE), Pseudomonas, Acinetobacter. Brain abscess: strep anginosus, anaerobes, Nocardia (immunocompromised). Viral: enteroviruses, HSV (encephalitis → acyclovir).',
    empiric: 'Adults → ceftriaxone + vancomycin + dexamethasone (before/with first dose); add ampicillin if >50, immunocompromised, or pregnant (Listeria). Neonates → ampicillin + cefotaxime (or gentamicin). Post-neurosurgical → vancomycin + cefepime/meropenem. Brain abscess → ceftriaxone + metronidazole (± vancomycin). HSV suspected → acyclovir until PCR returns.',
    pearls: 'Never delay antibiotics for CT/LP. Drugs that cross the BBB: ceftriaxone/cefotaxime, cefepime, meropenem, ampicillin/penicillin (high dose), vancomycin (inflamed), TMP-SMX, metronidazole, linezolid, FQs, rifampin. NOT: 1st/2nd-gen cephalosporins, aminoglycosides, daptomycin, macrolides, clindamycin. Meningococcal contacts → prophylaxis.',
  },
  {
    id: 'neutropenic', name: 'Neutropenic fever & the immunocompromised host', dungeon: 'nexus',
    bugs: 'Gram-negatives incl. Pseudomonas (the killers), viridans strep (mucositis), S. aureus/CoNS (lines), Enterococcus/VRE, Candida (after broad antibiotics), Aspergillus (prolonged neutropenia), Stenotrophomonas (after carbapenems), C. difficile. Transplant/steroids: Nocardia, PJP, Listeria, CMV, Cryptococcus.',
    empiric: 'Fever + ANC <500 → anti-pseudomonal β-lactam within 60 minutes: cefepime, pip-tazo, or meropenem. Add vancomycin only for line infection, skin/soft tissue, hemodynamic instability, MRSA colonization, or severe mucositis. Persistent fever at 4-7 days → add an antifungal (echinocandin or voriconazole). De-escalate when cultures and counts allow.',
    pearls: 'No neutrophils = no bacteriostatic backup — favor bactericidal drugs. Low-risk patients (MASCC ≥21) can get oral cipro + amox-clav. Every unnecessary broad course here breeds the next pan-resistant organism.',
  },
  {
    id: 'bone', name: 'Bone & joint', dungeon: 'tb',
    bugs: 'S. aureus (#1 overall), streptococci, gram-negatives (elderly, IVDU, post-op), Salmonella (sickle cell), Pseudomonas (puncture wounds, IVDU, diabetic foot), coag-negative staph (prosthetic joints), N. gonorrhoeae (sexually active young adults), Kingella (young children), TB (Pott disease), Brucella (unpasteurized dairy).',
    empiric: 'Septic arthritis → aspirate first, then vancomycin (+ ceftriaxone if gram-negative/gonococcal risk); drain the joint. Osteomyelitis → culture/biopsy before antibiotics if stable; vancomycin + ceftriaxone or cefepime empirically; MSSA → cefazolin/nafcillin; 4-6 weeks (oral options with good bone penetration: FQ, TMP-SMX, clindamycin, linezolid — OVIVA trial). Prosthetic joint → surgery (debridement/exchange) + rifampin combination for retained hardware.',
    pearls: 'Bone needs long courses and drugs that reach it; retained hardware needs rifampin or removal. Sickle cell + osteomyelitis = Salmonella AND S. aureus. Diabetic foot osteomyelitis: probe-to-bone, MRI, and vascular supply matter as much as the antibiotic.',
  },
  {
    id: 'sti', name: 'Sexually transmitted infections', dungeon: null,
    bugs: 'Chlamydia trachomatis (most common reportable), N. gonorrhoeae, Treponema pallidum, Trichomonas, HSV, Mycoplasma genitalium, HPV, HIV; PID = gonococcus + chlamydia + anaerobes.',
    empiric: 'Chlamydia → doxycycline ×7 d (azithromycin 1 g in pregnancy). Gonorrhea → ceftriaxone 500 mg IM ×1 (+ doxycycline if chlamydia not excluded). Syphilis → benzathine penicillin G (1 dose early; 3 weekly late latent; IV for neuro). PID → ceftriaxone + doxycycline + metronidazole. Trichomonas → metronidazole. Treat partners; test for HIV/syphilis with every STI; doxy-PEP for high-risk MSM.',
    pearls: 'Gonorrhea is down to one reliable drug — the clearest living example of sequential resistance. Syphilis is still universally penicillin-susceptible after 80 years. Desensitize pregnant penicillin-allergic patients; there is no substitute.',
  },
  {
    id: 'sepsis', name: 'Sepsis of unknown source', dungeon: null,
    bugs: 'Community: E. coli (urine), pneumococcus (lung), S. aureus (skin/line), GAS; Hospital: Pseudomonas, ESBL/CRE Enterobacterales, MRSA, VRE, Candida; Asplenic: encapsulated organisms; Cirrhosis: Vibrio, SBP organisms.',
    empiric: 'Cultures ×2 BEFORE antibiotics, then broad therapy within the hour: community → ceftriaxone (+ vancomycin if MRSA risk, + metronidazole if abdominal); hospital/MDR risk → pip-tazo or cefepime or meropenem + vancomycin; septic shock → consider double gram-negative coverage initially (aminoglycoside) and antifungal if risk factors. Reassess at 48-72 h: narrow to culture results, stop vancomycin if MRSA screen negative, IV→PO, shortest effective course.',
    pearls: 'Broad early, narrow fast. The two mortal sins: delaying the first dose, and never de-escalating. Source control (drain, remove the line, debride) is part of the resuscitation.',
  },
];
export const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]));

// Shown the first time the player enters each dungeon
export const SITE_BRIEFS = {
  abscess: { site: 'skin', title: 'SITE BRIEF: Skin & soft tissue', intro: 'You are entering an abscess. Expect S. aureus (clusters) and Group A strep (chains).' },
  pharynx: { site: 'pharyngitis', title: 'SITE BRIEF: Pharynx & upper airway', intro: 'Most of what you meet here is viral. Strep is the exception; Mycoplasma and H. flu wait deeper in.' },
  bladder: { site: 'uti', title: 'SITE BRIEF: Urinary tract', intro: 'Gram-negative rods rule the bladder. Urine concentrates nitrofurantoin and fosfomycin — they work ONLY here.' },
  lung: { site: 'pneumonia', title: 'SITE BRIEF: Pneumonia', intro: 'Typicals and atypicals in the same air. Daptomycin is useless in this dungeon; Legionella hides inside macrophages.' },
  gut: { site: 'intraabdominal', title: 'SITE BRIEF: Intra-abdominal infection', intro: 'Enterics plus anaerobes plus enterococci — polymicrobial. Cover both halves and drain the pus. C. difficile is watching your microbiome bar.' },
  heart: { site: 'endocarditis', title: 'SITE BRIEF: Bacteremia & endocarditis', intro: 'Vegetations shield organisms from your immune system: bactericidal drugs only, and the biggest resistance bosses of the game.' },
  brain: { site: 'meningitis', title: 'SITE BRIEF: Meningitis', intro: 'The blood-brain barrier decides your formulary. Check each drug card before you fire — and remember who covers Listeria.' },
  nexus: { site: 'neutropenic', title: 'SITE BRIEF: The ICU & the immunocompromised host', intro: 'Neutropenic rooms, multidrug-resistant organisms, and limited doses of last-resort drugs. Everything in here was selected by somebody’s prescription.' },
  tb: { site: 'bone', title: 'SITE BRIEF: Tuberculosis & chronic infection', intro: 'Slow-growing, waxy, intracellular. Combination therapy or nothing.' },
};

// Quick rules of thumb — the heuristics residents actually use
export const RULES = [
  { title: 'MRSA → vancomycin first', text: 'Vancomycin is first line for serious MRSA infection; daptomycin for bacteremia/endocarditis (never lung — surfactant); linezolid for pneumonia or oral step-down; ceftaroline as the β-lactam exception. Community MRSA skin infections: drain, then TMP-SMX or doxycycline or clindamycin.' },
  { title: 'MSSA → a β-lactam, not vancomycin', text: 'Nafcillin/oxacillin or cefazolin beat vancomycin for MSSA bacteremia (lower mortality). Oral: cephalexin or dicloxacillin. The moment the lab says MSSA, switch.' },
  { title: 'Atypicals → azithromycin or doxycycline', text: 'Mycoplasma (no wall), Chlamydia and Legionella (intracellular) never respond to β-lactams. Macrolide, tetracycline, or a respiratory fluoroquinolone. Legionella: levofloxacin or azithromycin.' },
  { title: 'Anaerobes → metronidazole or clindamycin… unless you already have them', text: 'Below the diaphragm (B. fragilis) add metronidazole; above (oral flora) clindamycin or penicillin. BUT pip-tazo, amox-clav/amp-sulbactam, and carbapenems already cover anaerobes — adding metronidazole to them is redundant. Cephalosporins, FQs, aminoglycosides and TMP-SMX do NOT cover anaerobes.' },
  { title: 'Pseudomonas → the short list', text: 'Pip-tazo, cefepime, ceftazidime, meropenem/imipenem (not ertapenem), cipro/levofloxacin (only oral options), aminoglycosides, aztreonam, plus ceftolozane-tazo, ceftaz-avi, cefiderocol, colistin. Nothing else works.' },
  { title: 'Enterococcus → ampicillin or vancomycin, never a cephalosporin', text: 'E. faecalis: ampicillin (+ ceftriaxone or gentamicin synergy for endocarditis). E. faecium: usually vancomycin; VRE: daptomycin or linezolid. Cystitis: nitrofurantoin/fosfomycin even for VRE.' },
  { title: 'ESBL → carbapenem', text: 'Ertapenem (once daily, no Pseudomonas pressure) or meropenem for invasive ESBL infection; pip-tazo failed in the MERINO trial. ESBL cystitis: nitrofurantoin or fosfomycin — no carbapenem needed.' },
  { title: 'CRE → enzyme-specific', text: 'KPC/OXA-48 → ceftazidime-avibactam (or meropenem-vaborbactam, imipenem-relebactam). NDM/VIM/IMP (metallo) → ceftazidime-avibactam + aztreonam, or cefiderocol. Colistin combinations as last resort. Always with ID.' },
  { title: 'Listeria → ampicillin', text: 'No cephalosporin covers it. Add ampicillin to meningitis regimens for age >50, pregnancy, or immunosuppression; TMP-SMX if allergic.' },
  { title: 'CAP → cover typicals AND atypicals', text: 'Ceftriaxone + azithromycin, or a respiratory FQ alone. Outpatient: amoxicillin or doxycycline (healthy), amox-clav + macrolide (comorbid). Add MRSA/Pseudomonas coverage only for risk factors.' },
  { title: 'Meningitis → ceftriaxone + vancomycin (+ ampicillin)', text: 'Plus dexamethasone before/with the first dose. Never wait for the CT or the LP. Neonates: ampicillin + cefotaxime.' },
  { title: 'Neutropenic fever → anti-pseudomonal β-lactam in the first hour', text: 'Cefepime, pip-tazo, or meropenem. Vancomycin only for specific reasons. Antifungal if fever persists 4-7 days.' },
  { title: 'Endocarditis & bacteremia → bactericidal, IV, weeks', text: 'No bacteriostatic drugs; repeat blood cultures; echocardiogram; remove lines; S. aureus bacteremia gets an ID consult.' },
  { title: 'Culture before you treat, then narrow', text: 'Blood cultures ×2 before the first dose whenever safe. At 48-72 h: stop, narrow, switch IV→PO (FQ, TMP-SMX, linezolid, metronidazole, doxycycline, fluconazole are ~100% bioavailable), and set a stop date.' },
  { title: 'Don’t treat these', text: 'Viral URIs, bronchitis, most sinusitis and pharyngitis, asymptomatic bacteriuria (except pregnancy/urologic procedures), uncomplicated Salmonella gastroenteritis, suspected EHEC (antibiotics → HUS), Candida in urine/sputum (colonization), a single coag-negative staph blood culture bottle.' },
  { title: 'Penicillin allergy is usually not', text: '~90% of labeled penicillin allergies are not real; cephalosporin cross-reactivity is ~1-2% and side-chain dependent (cefazolin shares none). Aztreonam is safe (except with ceftazidime). Delabel when you can — the alternatives (vancomycin, FQs, clindamycin) cause more harm.' },
  { title: 'Drug-specific reflexes', text: 'Daptomycin: not lung, check CPK. Linezolid: serotonin syndrome, thrombocytopenia. FQs: tendons, aorta, QT, C. diff. Vanc + pip-tazo: AKI. Aminoglycosides: once daily, ears & kidneys. Metronidazole: no alcohol. Rifampin: orange, CYP inducer, never alone. TMP-SMX: hyperkalemia, creatinine bump. Nitrofurantoin: not if CrCl <30. Ceftriaxone: not with calcium in neonates. Clindamycin: highest C. diff risk.' },
];
