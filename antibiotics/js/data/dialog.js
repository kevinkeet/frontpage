// ============================================================================
// DIALOGS — id -> pages[] | (game, npc) => { pages, onDone } | { action(game) }
// Page: { speaker, text, portrait, choices:[{label, value, next}] }
// ============================================================================
import { QUIZZES } from './quiz.js';
import { DRUG_BY_ID } from './drugs.js';
import { SITES, RULES } from './sites.js';

export const DIALOGS = {};
const def = (id, v) => { DIALOGS[id] = v; };
const P = (speaker, text, portrait) => ({ speaker, text, portrait });
const sign = (id, ...lines) => def(id, lines.map((t) => P('Sign', t, null)));

// ───────────────────────── opening ─────────────────────────
def('intro', () => ({ pages: [
  P('Narrator', 'The Kingdom of Corpus is under siege. Infections spread through skin and lung, gut and blood and brain — and the old medicines are failing.'),
  P('Narrator', 'In the Resistance Nexus, something is collecting every defence bacteria have ever evolved onto a single plasmid.'),
  P('Narrator', 'You are the new Resident. Your weapons are antibiotics. Your enemies are real organisms, with real defences.'),
  P('Narrator', 'Move: WASD / arrows. Talk & fire: Z (or SPACE). Menu & codex: TAB. To the north lies a laboratory, and an old professor with the first weapon ever forged.'),
] }));

// ───────────────────────── Fleming ─────────────────────────
def('fleming', (g) => {
  if (!g.inv.drugs.includes('penicillin')) return { pages: [
    P('Professor Fleming', 'Ah — the new Resident! Come in, mind the plates.', 'fleming'),
    P('Professor Fleming', 'In 1928 I left a staphylococcus plate by an open window and went on holiday. I came back to find a mold growing on it — and a clear ring where every colony had dissolved.', 'fleming'),
    P('Professor Fleming', 'It took Florey and Chain another twelve years to turn it into medicine. Take it: PENICILLIN. It binds the penicillin-binding proteins that stitch the bacterial cell wall together. The wall fails; the cell bursts under its own pressure.', 'fleming'),
    P('Professor Fleming', 'Two warnings, Doctor. First: hold the fire button. β-lactams kill by TIME above the minimum inhibitory concentration, not by one big dose.', 'fleming'),
    P('Professor Fleming', 'Second: in 1942 — two years after the first patient — staphylococci that destroy penicillin were already reported. When a shot bounces off an enemy, the game will tell you WHY. That reason is the entire lesson.', 'fleming'),
  ], onDone: (g) => g.acquireDrug('penicillin') };
  if (!g.flags.fleming2 && g.inv.drugs.length >= 3) return { pages: [
    P('Professor Fleming', 'You are collecting a formulary. Good. But remember what I said at my Nobel lecture in 1945:', 'fleming'),
    P('Professor Fleming', '"It is not difficult to make microbes resistant to penicillin in the laboratory by exposing them to concentrations not sufficient to kill them."', 'fleming'),
    P('Professor Fleming', 'I warned that the thoughtless man who underdoses himself is morally responsible for the death of the man who finally succumbs to the resistant organism. Eighty years later, they still quote it — and still overprescribe.', 'fleming'),
  ], onDone: (g) => { g.flags.fleming2 = true; g.inv.pearls += 2; } };
  return { pages: [P('Professor Fleming', 'Time above MIC for the β-lactams. A big peak for the aminoglycosides. And read the reason on every failed shot — that is how you learn an organism.', 'fleming')] };
});
def('fleming_scope', [P('Microscope', 'Under the lens: purple grape-clusters (staphylococci), purple chains (streptococci), pink rods (enteric gram-negatives). Gram’s stain, 1884 — still the first question in every infection.')]);

// ───────────────────────── village & shops ─────────────────────────
def('nurse_hint', (g) => ({ pages: [
  P('Nurse Nightingale', g.inv.drugs.length ? 'Streptococci roam the plains — purple chains. Penicillin still kills every Group A strep on Earth: not one resistant isolate in eighty years.' : 'The cave to the northwest is Professor Fleming’s laboratory. Go see him before you wander off unarmed!', 'nurse'),
  P('Nurse Nightingale', 'West of here is Keratin Village — a pharmacy, a microbiology lab, and beds if you need patching up. Hand hygiene saves more lives than any drug, by the way. Semmelweis said so in 1847 and they mocked him for it.', 'nurse'),
] }));
def('attending_village', (g) => ({ pages: [
  P('The Attending', 'New Resident. Four questions before every prescription — the Four Moments:', 'attending'),
  P('The Attending', 'One: does this patient actually need an antibiotic? Two: have I cultured, and chosen the right empiric drug? Three: at 48-72 hours, can I stop, narrow, or switch to oral? Four: what is the SHORTEST effective duration?', 'attending'),
  P('The Attending', 'Watch your MICROBIOME bar. Every broad-spectrum shot drains it. Empty it and Clostridioides difficile blooms — and you will have made that patient sicker than the infection did.', 'attending'),
] }));
def('villager_1', [P('Villager', 'My cousin took leftover antibiotics from a drawer for a cold. Now every bug in his gut shrugs at amoxicillin, and the cold got better on its own anyway. Viruses do that.')]);
def('villager_kid', [P('Kid', 'The nurse says my ear infection needs "amoxicillin with the extra bit". The extra bit is clavulanate! It eats the enzyme that eats the medicine. I know things.')]);
def('villager_elder', [P('Elder', 'I remember when penicillin was magic. One shot and a dying man sat up. We poured it on everything — throats, colds, cattle feed. The bugs were listening the whole time.')]);
sign('sign_village', 'KERATIN VILLAGE — Pharmacy (northwest), Microbiology Lab (southwest), Infirmary (southeast). Rest heals; pearls buy supplies.');
sign('sign_pharmacy', 'PHARMACY. Pearls buy IV fluids, probiotics, and vials of the restricted drugs. Stewardship note: the narrow shelf is cheaper than the broad shelf — as it should be.');

def('pharmacist_village', (g) => ({ action: (g) => {
  g.ui.shop('VILLAGE PHARMACY', [
    { label: 'IV fluids (full heal, carried)', price: 8, desc: 'Restores all hearts when used from the ITEMS menu. Resuscitation buys time; source control fixes the problem.', buy: () => { g.inv.potions++; } },
    { label: 'Probiotic yogurt (+35 microbiome)', price: 5, desc: 'Restores your microbiome bar. Real-world evidence for probiotics is mixed — the best prevention is not taking the unnecessary antibiotic.', buy: () => { g.microbiome = Math.min(100, g.microbiome + 35); } },
    { label: 'Heart piece (one per game)', price: 40, desc: 'A permanent piece of a heart container. Four pieces make a whole heart.', soldOut: () => !!g.flags.shop_hp1, buy: () => { g.flags.shop_hp1 = true; g.collect({ type: 'heartPiece' }); } },
    { label: 'Colistin vials ×5', price: 14, desc: 'Last-resort polymyxin doses. Nephrotoxic in ~50% of real patients — the game slows you down when you fire it.', soldOut: () => !g.inv.drugs.includes('colistin'), buy: () => { g.inv.doses.colistin = (g.inv.doses.colistin || 0) + 5; } },
    { label: 'Ceftazidime-avibactam vials ×5', price: 16, desc: 'Restricted. Requires ID approval in most hospitals — and in this pharmacy, pearls.', soldOut: () => !g.inv.drugs.includes('ceftazavi'), buy: () => { g.inv.doses.ceftazavi = (g.inv.doses.ceftazavi || 0) + 5; } },
    { label: 'Cefiderocol vials ×4', price: 18, desc: 'The siderophore cephalosporin. Reserve of reserves.', soldOut: () => !g.inv.drugs.includes('cefiderocol'), buy: () => { g.inv.doses.cefiderocol = (g.inv.doses.cefiderocol || 0) + 4; } },
  ]);
} }));
def('pharmacist_marrow', (g) => ({ action: (g) => {
  g.ui.shop('MARROW APOTHECARY', [
    { label: 'IV fluids', price: 8, desc: 'Full heal, carried in your bag.', buy: () => { g.inv.potions++; } },
    { label: 'Probiotic yogurt', price: 5, desc: '+35 microbiome.', buy: () => { g.microbiome = Math.min(100, g.microbiome + 35); } },
    { label: 'Heart piece (one per game)', price: 40, desc: 'Four pieces make a heart container.', soldOut: () => !!g.flags.shop_hp2, buy: () => { g.flags.shop_hp2 = true; g.collect({ type: 'heartPiece' }); } },
    { label: 'Colistin vials ×5', price: 14, desc: 'Salvage therapy for pan-resistant gram-negatives.', soldOut: () => !g.inv.drugs.includes('colistin'), buy: () => { g.inv.doses.colistin = (g.inv.doses.colistin || 0) + 5; } },
    { label: 'Cefiderocol vials ×4', price: 18, desc: 'Trojan-horse cephalosporin.', soldOut: () => !g.inv.drugs.includes('cefiderocol'), buy: () => { g.inv.doses.cefiderocol = (g.inv.doses.cefiderocol || 0) + 4; } },
  ]);
} }));
def('labtech_lens', (g) => {
  if (!g.inv.tools.lens) return { pages: [
    P('Lab Tech', 'You’re fighting things you can’t identify. That’s how people end up on vancomycin for a virus.', 'labtech'),
    P('Lab Tech', 'Take the GRAM STAIN LENS. Crystal violet, iodine, alcohol, safranin. Purple means a thick peptidoglycan wall. Pink means a thin wall behind an outer membrane — and that membrane is a gate half your drugs can’t pass.', 'labtech'),
  ], onDone: (g) => g.collect({ type: 'lens' }) };
  return { pages: [P('Lab Tech', 'Press M to toggle the labels. Purple = gram-positive, pink = gram-negative, blue = atypical, yellow = acid-fast, green = fungus, grey = virus (put the syringe down).', 'labtech')] };
});
def('lab_scope', [P('Microscope', 'Ziehl-Neelsen stain: red beaded rods on a blue field. Acid-fast — the mycolic wax holds the carbol fuchsin through an acid-alcohol wash. That is Mycobacterium tuberculosis.')]);
def('lab_culture', (g) => {
  if (!g.inv.tools.culture) return { pages: [P('Culture plates', 'A blood agar plate with β-hemolysis, a MacConkey plate blushing pink with lactose fermenters, and a susceptibility panel with clean zones of inhibition. Take the CULTURE & SENSITIVITY KIT.')], onDone: (g) => g.collect({ type: 'culture' }) };
  return { pages: [P('Culture plates', 'Culture BEFORE antibiotics whenever you safely can. One dose can sterilize blood cultures and leave you treating a ghost for six weeks.')] };
});
def('innkeeper', (g) => ({ pages: [
  P('Infirmary Nurse', 'Rest a while? Fluids, a warm bed, and no unnecessary antibiotics.', 'nurse'),
], onDone: (g) => { g.hp = g.maxHp; g.microbiome = Math.min(100, g.microbiome + 20); g.audio.sfx('heal'); g.toast('Fully rested. Microbiome recovering.'); g.save(); } }));
def('bed', [P('Bed', 'Clean linen. Contact precautions posted on the wall: gown, gloves, and SOAP AND WATER for C. difficile — alcohol gel does not kill spores.')]);

// ───────────────────────── overworld NPCs & signs ─────────────────────────
sign('sign_start', 'DERMIS PLAINS. North: Fleming’s laboratory. West: Keratin Village. East: the Boil. Everything with a purple chain is a streptococcus.');
sign('sign_abscess', 'THE BOIL. A walled-off collection of pus. Antibiotics do not penetrate — you will need a scalpel from inside. "Ubi pus, ibi evacua."');
sign('sign_pharynx', 'PHARYNX CAVERNS. Most sore throats are viral. Centor criteria: fever, tonsillar exudate, tender nodes, NO cough. Treat strep to prevent rheumatic fever.');
sign('sign_lung', 'LUNG FORTRESS. The gate is sealed with BIOFILM. Community pneumonia: ceftriaxone + azithromycin, or a respiratory fluoroquinolone.');
sign('sign_bladder', 'BLADDER DEPTHS. Nitrofurantoin and fosfomycin work ONLY here, where urine concentrates them. Do not carry them into the bloodstream.');
sign('sign_cdiff', 'COLON. Spore warning. Clindamycin, fluoroquinolones, cephalosporins and carbapenems all clear the way for C. difficile.');
sign('sign_brain', 'FRONTAL LOBE. Beyond the blood-brain barrier only some drugs pass: ceftriaxone, meropenem, ampicillin, vancomycin (inflamed), TMP-SMX, metronidazole, linezolid, fluoroquinolones, rifampin.');
sign('sign_listeria', 'CAUTION: LISTERIA. Grows at refrigerator temperature. NO cephalosporin binds its PBP3 — ampicillin is the answer.');
sign('sign_tb', 'GRANULOMA PEAK. Acid-fast country. Bring four drugs or bring none: one drug at a time only breeds resistance.');
sign('sign_hpylori', 'STOMACH SHORE. Helicobacter pylori: urease-positive, lives under the mucus. Quadruple therapy — a PPI plus three agents — because monotherapy always fails here.');
sign('sign_salmonella', 'CECUM. Do NOT treat uncomplicated Salmonella gastroenteritis: antibiotics prolong shedding. And never treat bloody diarrhea empirically — antibiotics worsen Shiga-toxin HUS.');
sign('sign_appendix', 'APPENDIX. Where a perforation seeds the peritoneum with everything at once: aerobes, anaerobes, and enterococci.');
sign('sign_camrsa', 'THE CARBUNCLE. Community MRSA (USA300, often PVL+): recurrent "spider-bite" abscesses. Drain first; TMP-SMX, doxycycline or clindamycin after.');
sign('sign_sickle', 'FEMUR CAVES. Osteomyelitis in sickle-cell disease: think Salmonella as well as S. aureus.');
sign('sign_osteo', 'MARROW. Bone infections need long courses and drugs that penetrate bone: fluoroquinolones, clindamycin, linezolid, TMP-SMX, high-dose β-lactams. Retained hardware needs rifampin — or removal.');
def('patient_pharyngitis', (g) => ({ pages: [
  P('Patient', 'Doctor, I have had a runny nose, a cough, and a scratchy throat for two days. My neighbour says I need an antibiotic.', 'patient'),
  P('Patient', 'What do you say?', 'patient', ),
].map((p, i) => i === 1 ? { ...p, choices: [
  { label: 'Cough + runny nose = viral. Rest and fluids.', value: 'right' },
  { label: 'Take amoxicillin, just in case.', value: 'wrong' },
  { label: 'Take azithromycin — it is stronger.', value: 'wrong2' },
] } : p), onDone: (g, v) => {
  if (v === 'right') { g.inv.pearls += 3; g.ui.lessonCard('Viral pharyngitis', ['Cough and rhinorrhea point AWAY from strep. The Centor criteria (fever, tonsillar exudate, tender anterior nodes, absence of cough) guide testing — and you should test, not guess.', 'We treat strep throat mainly to prevent rheumatic fever; it shortens symptoms by only about a day.', 'Roughly 30% of outpatient antibiotic prescriptions in the US are unnecessary — mostly for viral respiratory infections.', 'Saying "no" IS a clinical intervention. Explain the diagnosis, give a symptom plan, and offer a safety net for worsening.'], null, 'Well judged — +3 pearls'); }
  else { g.microbiome = Math.max(5, g.microbiome - 20); g.ui.lessonCard('That was a virus', ['Antibiotics do nothing for viral URIs. You bought: microbiome damage, a 1-in-1000 risk of C. difficile, rash, and selection pressure.', 'Azithromycin "stronger"? It is a bacteriostatic macrolide with a 68-hour half-life and QT effects. Broader ≠ better.', 'Your microbiome bar took the hit. That is exactly what happens to the patient.'], null, 'A costly prescription'); }
} }));
def('lyme_ranger', [P('Ranger', 'Ixodes ticks need about 36 hours attached to transmit Borrelia. Bull’s-eye rash? Doxycycline — it also covers Anaplasma, which rides in on the same tick.'), P('Ranger', 'One dose of doxycycline within 72 hours of a bite prevents Lyme in endemic areas. Don’t test after a bite — serology is negative that early.')]);
def('labtech_field', [P('Field Tech', 'Mycoplasma out here — no cell wall, invisible to Gram stain, immune to every β-lactam you own. Try the ribosome instead.', 'labtech')]);
def('osler', [P('Old Physician', 'Endocarditis. Vegetations are avascular biofilms — no blood vessels, no neutrophils, ten billion organisms per gram.', 'elder'), P('Old Physician', 'That is why we use bactericidal drugs, at high dose, intravenously, for four to six weeks. Bacteriostatic drugs are for hosts with an immune system that can finish the job.', 'elder')]);
def('nurse_bladder', [P('Nurse', 'Down here, nitrofurantoin and fosfomycin become powerful — urine concentrates them a hundredfold. Carry them anywhere else and they are useless.', 'nurse'), P('Nurse', 'And remember: asymptomatic bacteriuria is not an infection. Do not treat it. Pregnancy and pre-urologic-procedure are the exceptions.', 'nurse')]);
def('iv_nurse', [P('IV Nurse', 'Central line day 12. Coagulase-negative staph on one bottle is usually a contaminant; two bottles with a line in place is a real infection.', 'nurse'), P('IV Nurse', 'Biofilm on plastic cannot be cured with drugs alone. Pull the line.', 'nurse')]);
def('icu_nurse', [P('ICU Nurse', 'Neutropenic patients have no immune backup, so bacteriostatic drugs underperform here — the game will show you organisms recovering from stasis.', 'nurse'), P('ICU Nurse', 'Febrile neutropenia: anti-pseudomonal β-lactam within an hour. Cefepime, pip-tazo, or meropenem.', 'nurse')]);
def('steward', (g) => ({ pages: [
  P('Antimicrobial Steward', g.flags.nexus_open ? 'The Nexus is open. Whatever is in there has been collecting resistance genes from every ward in the kingdom.' : 'The Resistance Nexus is sealed. Clear the organ dungeons first — especially the Brain Citadel. You are not ready.', 'pharmacist'),
  P('Antimicrobial Steward', `Your record so far: ${g.stats.shots} doses given, ${g.stats.kills} organisms cleared, ${g.stats.cdiffBlooms} C. difficile blooms caused. Every unnecessary dose builds what waits inside.`, 'pharmacist'),
] }));
def('brain_guard', (g) => ({ pages: [
  P('Neurology Attending', 'The Brain Citadel is the last organ dungeon and the barrier is unforgiving. Half your formulary cannot cross it at all.', 'attending'),
  P('Neurology Attending', g.flags.boss_mrsa_d6 ? 'You have faced the Monarch and the Heir. Go — the meninges are open to you.' : 'Come back when you have cleared the Heart Citadel. You will want the drugs that live in there.', 'attending'),
] }));
def('gut_gate', (g) => ({ pages: [
  P('GI Attending', 'Below this gate the flora is mixed: aerobic gram-negatives, anaerobes, enterococci, all together.', 'attending'),
  P('GI Attending', 'Bring anaerobic coverage or bring a body bag. Do you know what covers Bacteroides fragilis?', 'attending', ),
].map((p, i) => i === 1 ? { ...p, choices: [
  { label: 'Metronidazole, pip-tazo, carbapenems, amox-clav', value: 'right' },
  { label: 'Ceftriaxone and gentamicin', value: 'wrong' },
  { label: 'Vancomycin', value: 'wrong' },
] } : p), onDone: (g, v) => {
  if (v === 'right') { g.flags.gate_gut = true; g.inv.pearls += 3; g.toast('The gate opens. +3 pearls.'); }
  else { g.ui.lessonCard('Not quite', ['B. fragilis makes cepA β-lactamase: penicillin and most cephalosporins fail. Cefoxitin/cefotetan are the cephalosporin exceptions.', 'Aminoglycosides never work on anaerobes — uptake is oxygen-dependent.', 'Vancomycin is a gram-positive drug; the outer membrane keeps it out of gram-negatives entirely.', 'Answers: metronidazole (gold standard), pip-tazo, carbapenems, amoxicillin-clavulanate.'], () => { g.flags.gate_gut = true; g.toast('The gate opens anyway. Read the room, Doctor.'); }, 'Study, then pass'); }
} }));
def('gut_gate_passed', [P('GI Attending', 'Metronidazole is a prodrug — it only becomes a DNA-shredding radical in a low-oxygen environment. Aerobes literally cannot activate it. That is why it is invisible to half the kingdom.', 'attending')]);
def('tb_guide', [P('TB Nurse', 'Directly observed therapy. Six months. Four drugs at the start, two at the end, and nobody stops early — that is how MDR-TB is made.', 'labtech'), P('TB Nurse', 'The three drug rooms here hold isoniazid, pyrazinamide and ethambutol. You will need rifampin too. All four, cycled together, or the Titan mutates.', 'labtech')]);

// ───────────────────────── dungeon signs ─────────────────────────
sign('sign_d1_entry', 'ABSCESS CAVE. Golden clusters ahead — Staphylococcus aureus, penicillinase-positive. Bring a penicillinase-stable drug.');
sign('sign_d2_entry', 'PHARYNX CAVERNS. Grey wraiths here are VIRUSES. Nothing you carry will touch them; they fade on their own. Save your ammunition and your microbiome.');
sign('sign_d3_entry', 'BLADDER DEPTHS. Urine concentrates certain drugs. Watch your weapon card: the urinary agents come alive down here.');
sign('sign_d4_entry', 'LUNG FORTRESS. Surfactant inactivates DAPTOMYCIN — it will do nothing in this dungeon. Remember that for the rest of your career.');
sign('sign_d5_entry', 'GUT LABYRINTH. Anaerobes below. Also: every broad-spectrum shot you fire in here is an invitation to C. difficile.');
sign('sign_d6_entry', 'HEART CITADEL. Vegetations shield organisms from your immune system: bacteriostatic drugs will freeze bugs but never finish them here.');
sign('sign_d7_entry', 'BRAIN CITADEL. Blood-brain barrier ACTIVE. Cefazolin, aminoglycosides, daptomycin, macrolides and clindamycin cannot cross. Check your weapon before you fire.');
sign('sign_d8_entry', 'RESISTANCE NEXUS — ICU. Contact precautions. Everything in here was selected by an antibiotic somebody prescribed.');
sign('sign_tb_entry', 'GRANULOMA PEAK. Fire ONE drug repeatedly at the same organism and watch it mutate. Cycle your four TB drugs instead.');
sign('sign_virus', 'A quiet cove. The grey ones drift and cough and fade. Not every enemy is a target.');
sign('sign_ampc', 'INDUCIBLE WARD. Hit these organisms twice with ceftriaxone or pip-tazo and their AmpC derepresses — resistance in real time. Cefepime and carbapenems are stable.');
sign('sign_legionella', 'COOLING TOWER. Legionella lives in warm water systems and inside your alveolar macrophages. Levofloxacin or azithromycin — no β-lactam can follow it into a cell.');
sign('sign_biofilm', 'BIOFILM. Slime halves your damage. Rifampin penetrates it; the scalpel debrides it; removing the device cures it.');
sign('sign_esbl_urine', 'ESBL cystitis does NOT need a carbapenem. Nitrofurantoin and fosfomycin still work in urine. Stewardship in one pill.');
sign('sign_spores', 'SPORES survive alcohol gel for months. Soap and water. Gowns and gloves. Bleach the room.');
sign('sign_cdiff_nest', 'C. DIFFICILE. IV vancomycin never reaches the colon. Take the ORAL vancomycin from the pedestal — it is not absorbed, which is exactly the point.');
sign('sign_ceftaroline', 'CEFTAROLINE: the one β-lactam engineered to bind PBP2a. Proof that a target change can be answered by redesigning the key.');
sign('sign_vre', 'Beyond this door lies what vancomycin overuse created. D-Ala-D-Lactate.');
sign('sign_vaccine', 'HERD IMMUNITY SHRINE. Hib vaccine took H. influenzae type b from the leading cause of childhood meningitis to a rarity. The best antibiotic is the infection that never happens.');

// ───────────────────────── attending rounds (quizzes) ─────────────────────────
const rounds = (id, quizId, intro) => def(id, (g) => {
  if (g.flags[`quiz_${quizId}`]) return { pages: [P('The Attending', 'Good rounds today. Keep reading — the organisms certainly are.', 'attending')] };
  return { pages: [P('The Attending', intro, 'attending'), P('The Attending', 'Rounds. A few questions.', 'attending')],
    onDone: (g) => { g.ui.quiz(QUIZZES[quizId], (right, total) => {
      g.flags[`quiz_${quizId}`] = true;
      const pearls = right * 2 + (right === total ? 5 : 0);
      g.inv.pearls += pearls;
      g.ui.lessonCard(right === total ? 'Perfect rounds' : 'Rounds complete', [`You answered <b>${right} of ${total}</b> correctly.`, `+${pearls} pearls${right === total ? ' (perfect-score bonus included)' : ''}.`, 'Every question here is a real decision point on a real ward. The explanations stay in your codex under PRINCIPLES.'], null, `${right}/${total}`);
    }); } };
});
rounds('attending_d1', 'd1', 'You drained the abscess and killed the cluster. Now tell me you understand why.');
rounds('attending_d2', 'd2', 'A wall-less organism and a room full of viruses. Let us see what stuck.');
rounds('attending_d3', 'd3', 'Urinary tract. The most over-treated infection in medicine.');
rounds('attending_d4', 'd4', 'Pseudomonas. The organism that shrinks your formulary to a short list.');
rounds('attending_d5', 'd5', 'Polymicrobial abdominal sepsis. Two halves of coverage and a scalpel.');
rounds('attending_d6', 'd6', 'MRSA and VRE — a changed protein and a changed chemical bond.');
rounds('attending_d7', 'd7', 'Meningitis. The barrier decides your formulary here.');
rounds('attending_tb', 'tb', 'Tuberculosis. The arithmetic of combination therapy.');
rounds('attending_d8', 'd8', 'You beat the Colossus. Final exam, Doctor — then you can teach.');

// ───────────────────────── ID consult (syndrome → empiric therapy) ─────────────────────────
def('id_consult', (g) => ({ pages: [
  P('ID Consult', 'Infectious Diseases. Tell me the SITE of infection and I will tell you who lives there and what to start — then we narrow when the cultures come back.', 'attending'),
  { speaker: 'ID Consult', portrait: 'attending', text: 'Which syndrome?', choices: SITES.map((x) => ({ label: x.name, value: x.id })).concat([{ label: 'Just give me the rules of thumb', value: 'rules' }]) },
], onDone: (g, v) => {
  if (v === 'rules') { g.ui.card({ title: 'RULES OF THUMB', subtitle: 'The heuristics residents actually use', html: RULES.map((r) => `<p><b>${r.title}.</b> ${r.text}</p>`).join(''), cls: 'lesson' }); return; }
  const site = SITES.find((x) => x.id === v); if (site) { g.ui.siteCard(site); g.flags[`consult_${v}`] = true; const n = SITES.filter((x) => g.flags[`consult_${x.id}`]).length; if (n === SITES.length && !g.flags.consult_all) { g.flags.consult_all = true; g.inv.pearls += 10; setTimeout(() => g.toast('You have consulted on every syndrome. +10 pearls.'), 600); } }
} }));
