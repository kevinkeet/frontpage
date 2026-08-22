// ============================================================================
// DUNGEONS, CAVES & SHOPS
// Each area: { name, theme, music, env, rooms: { id: {gx, gy, name, rows, exits, ents, onClear, env, alts} } }
// Dungeon conventions: 'entry' room at the bottom, boss at the top; exit warp '<' at bottom-left of entry.
// ============================================================================
import { genRoom } from './gen.js';

const E = (bug, x, y, o = {}) => ({ type: 'enemy', bug, x, y, ...o });
const N = (id, sprite, x, y, dialog, o = {}) => ({ type: 'npc', id, sprite, x, y, dialog, ...o });
const I = (item, x, y, flag, o = {}) => ({ type: 'item', item, x, y, flag, ...o });
const DRUG = (drug, x, y, o = {}) => ({ type: 'drug', drug, x, y, ...o });
const SIGN = (x, y, dialog) => N('sign', 'sign', x, y, dialog);
const BOSS = (boss, x, y) => ({ type: 'boss', boss, x, y });
const EXIT = (room, tile) => ({ type: 'warp', x: 2, y: 10, to: { area: 'overworld', room, tile } });
const dropDrug = (id) => ({ drop: { item: 'drug', data: { id }, flag: `drug_${id}` } });
const dropKey = () => ({ drop: { item: 'key' } });
const dropBossKey = () => ({ drop: { item: 'bosskey' } });
const D = (gx, gy, name, rows, exits, ents = [], extra = {}) => ({ gx, gy, name, rows, exits, ents, ...extra });

// Common room shapes
const ENTRY_ROWS = [
  '..................',
  '..TT..........TT..',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..TT..........TT..',
  '<.................',
];
const ARENA_ROWS = [
  '..................',
  '.T..............T.',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '.T..............T.',
  '..................',
];
const PEDESTAL_ROWS = [
  '..................',
  '..TT..........TT..',
  '..................',
  '......T....T......',
  '..................',
  '..................',
  '......T....T......',
  '..................',
  '..TT..........TT..',
  '..................',
];
const LAB_ROWS = [
  '..................',
  '.TT............TT.',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '.TT............TT.',
  '<.................',
];

export const DUNGEONS = {
  // ───────────────────────── caves & houses ─────────────────────────
  fleming_cave: { name: "Fleming's Laboratory", theme: 'cave', music: 'town', rooms: {
    cave: D(0, 0, "Fleming's Laboratory", [
      '..................',
      '..TT..........TT..',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..TT..........TT..',
      '<.................',
    ], {}, [N('fleming', 'fleming', 10, 3, 'fleming'), N('microscope', 'microscope', 5, 3, 'fleming_scope'), EXIT('ov_1_3', [3, 3])], { props: [['monitor', 2, 5], ['bed', 14, 6]] }),
  } },
  pharmacy: { name: 'Village Pharmacy', theme: 'village', music: 'town', rooms: {
    shop: D(0, 0, 'Village Pharmacy', LAB_ROWS, {}, [N('pharmacist', 'pharmacist', 9, 3, 'pharmacist_village'), SIGN(14, 6, 'sign_pharmacy'), EXIT('ov_0_2', [3, 4])], { props: [['bed', 3, 2], ['monitor', 15, 2], ['ivpole', 13, 6]] }),
  } },
  lab: { name: 'Microbiology Lab', theme: 'village', music: 'town', rooms: {
    lab: D(0, 0, 'Microbiology Lab', LAB_ROWS, {}, [N('labtech', 'labtech', 9, 3, 'labtech_lens'), N('microscope2', 'microscope', 5, 3, 'lab_scope'), N('microscope3', 'microscope', 13, 3, 'lab_culture'), N('id_consult', 'attending', 9, 7, 'id_consult', { label: 'ID consult' }), EXIT('ov_0_2', [4, 7])], { props: [['monitor', 2, 5], ['monitor', 16, 5]] }),
  } },
  inn: { name: 'Infirmary', theme: 'village', music: 'town', rooms: {
    inn: D(0, 0, 'Infirmary', [
      '..................',
      '.TT...+......+.TT.',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '.TT............TT.',
      '<.................',
    ], {}, [N('innkeeper', 'nurse', 9, 5, 'innkeeper'), EXIT('ov_0_2', [15, 7])], { props: [['bed', 3, 2], ['bed', 8, 2], ['bed', 13, 2], ['ivpole', 6, 2], ['ivpole', 11, 2], ['monitor', 16, 5]] }),
  } },
  marrow_shop: { name: 'Marrow Apothecary', theme: 'bone', music: 'town', rooms: {
    shop: D(0, 0, 'Marrow Apothecary', LAB_ROWS, {}, [N('pharmacist2', 'pharmacist', 9, 3, 'pharmacist_marrow'), EXIT('ov_6_6', [8, 5])], { props: [['bone', 3, 5], ['bone', 14, 5], ['monitor', 16, 2]] }),
  } },

  // ───────────────────────── D1: THE ABSCESS CAVE ─────────────────────────
  abscess: { name: 'The Abscess Cave', theme: 'cave', music: 'dungeon', dungeon: 1, rooms: {
    entry: D(1, 3, 'Abscess Cave — Entrance', ENTRY_ROWS, { n: 'open' }, [E('gas', 5, 4), E('gas', 13, 6), SIGN(14, 2, 'sign_d1_entry'), EXIT('ov_1_2', [10, 5])]),
    hub: D(1, 2, 'Abscess Cave — Pus Chamber', genRoom('d1hub', { density: 0.4, pillars: true }), { n: 'locked', w: 'open', e: 'open', s: 'open' }, [E('mssa', 4, 3), E('mssa', 13, 7), E('gas', 9, 8)], { props: [['crystal', 2, 1], ['crystal', 15, 1]] }),
    west: D(0, 2, 'Abscess Cave — Strep Nest', genRoom('d1west', { density: 0.5 }), { e: 'open' }, [E('gas', 4, 3), E('gas', 12, 3), E('gas', 6, 8), E('mssa', 13, 7)], { props: [['crystal', 2, 1], ['crystal', 15, 1]], onClear: dropKey() }),
    east: D(2, 2, 'Abscess Cave — Culture Room', PEDESTAL_ROWS, { w: 'open' }, [E('mssa', 4, 3), E('mssa', 13, 7), I('culture', 9, 5, 'item_culture'), I('potion', 15, 9, 'pot_d1')]),
    mid: D(1, 1, 'Abscess Cave — Golden Hall', genRoom('d1mid', { density: 0.3, pillars: true }), { s: 'locked', n: 'boss', e: 'open' }, [E('mssa', 5, 3), E('mssa', 12, 3), E('gas', 8, 8), E('gas', 11, 8)], { props: [['crystal', 2, 1], ['crystal', 15, 1]], onClear: dropDrug('cephalexin') }),
    bosskey: D(2, 1, 'Abscess Cave — Fibrin Vault', genRoom('d1key', { density: 0.5 }), { w: 'open' }, [E('mssa', 4, 4), E('mssa', 13, 4), E('mssa', 9, 8)], { props: [['crystal', 2, 1], ['crystal', 15, 1]], onClear: dropBossKey() }),
    boss: D(1, 0, 'Abscess Cave — The Golden Cluster', ARENA_ROWS, { s: 'boss' }, [BOSS('mssa_d1', 9, 4), N('attending_d1', 'attending', 15, 2, 'attending_d1', { requireFlag: 'boss_mssa_d1' })], { env: { abscess: true } }),
  } },

  // ───────────────────────── D2: PHARYNX CAVERNS ─────────────────────────
  pharynx: { name: 'Pharynx Caverns', theme: 'throat', music: 'dungeon', dungeon: 2, rooms: {
    entry: D(1, 3, 'Pharynx Caverns — Vestibule', ENTRY_ROWS, { n: 'open' }, [E('rhinovirus', 5, 4), E('rhinovirus', 13, 5), E('gas', 9, 3), SIGN(14, 2, 'sign_d2_entry'), EXIT('ov_3_1', [10, 3])]),
    hub: D(1, 2, 'Pharynx Caverns — Tonsillar Crypt', genRoom('d2hub', { density: 0.4, pond: true }), { n: 'open', w: 'open', e: 'locked', s: 'open' }, [E('gas', 4, 3), E('pneumo', 13, 7), E('hflu', 9, 8)], { props: [['villus', 2, 1], ['villus', 15, 1]] }),
    key: D(0, 2, 'Pharynx Caverns — Strep Choir', genRoom('d2key', { density: 0.5 }), { e: 'open' }, [E('gas', 4, 3), E('gas', 12, 3), E('gas', 7, 8), E('pneumo', 13, 7)], { props: [['villus', 2, 1]], onClear: dropKey() }),
    azithro: D(2, 2, 'Pharynx Caverns — Lancet Hall', PEDESTAL_ROWS, { w: 'locked' }, [E('pneumo', 4, 3), E('pneumo', 13, 7), E('pneumo', 9, 8)], { onClear: dropDrug('azithromycin') }),
    pre: D(1, 1, 'Pharynx Caverns — Wall-less Wing', genRoom('d2pre', { density: 0.3, pillars: true }), { s: 'open', n: 'boss', w: 'open', e: 'open' }, [E('mycoplasma', 5, 3), E('mycoplasma', 13, 7), E('hflu_bl', 9, 8)], { props: [['villus', 2, 1]] }),
    bosskey: D(2, 1, 'Pharynx Caverns — Inclusion Bodies', genRoom('d2bk', { density: 0.45 }), { w: 'open' }, [E('chlamydia', 4, 3), E('chlamydia', 13, 7), E('chlamydia', 9, 8), E('hflu_bl', 14, 3)], { props: [['villus', 2, 1], ['villus', 15, 1]], onClear: dropBossKey() }),
    hp: D(0, 1, 'Pharynx Caverns — Tetracycline Alcove', PEDESTAL_ROWS, { e: 'open' }, [E('rhinovirus', 5, 4), E('rhinovirus', 13, 5), E('mycoplasma', 14, 8), DRUG('doxycycline', 9, 5), I('heartPiece', 4, 8, 'hp_d2'), I('potion', 3, 3, 'pot_d2'), SIGN(15, 8, 'sign_virus')], { props: [['alveolus', 2, 6]] }),
    boss: D(1, 0, 'Pharynx Caverns — The Wall-less Wraith', ARENA_ROWS, { s: 'boss' }, [BOSS('mycoplasma_d2', 9, 4), N('attending_d2', 'attending', 15, 2, 'attending_d2', { requireFlag: 'boss_mycoplasma_d2' })]),
  } },

  // ───────────────────────── D3: BLADDER DEPTHS ─────────────────────────
  bladder: { name: 'Bladder Depths', theme: 'bladder', music: 'dungeon', dungeon: 3, env: { urine: true }, rooms: {
    entry: D(1, 3, 'Bladder Depths — Trigone', ENTRY_ROWS, { n: 'open' }, [E('ecoli_tem', 5, 4), E('ecoli_tem', 13, 5), SIGN(14, 2, 'sign_d3_entry'), EXIT('ov_4_5', [10, 5])]),
    hub: D(1, 2, 'Bladder Depths — Detrusor Hall', genRoom('d3hub', { density: 0.4, pond: true }), { n: 'open', w: 'open', e: 'locked', s: 'open' }, [E('ecoli_tem', 4, 3), E('ecoli_tem', 13, 7), E('efaecalis', 9, 8), E('proteus', 14, 3)], { props: [['crystal', 15, 1]] }),
    key: D(0, 2, 'Bladder Depths — Colony Count', genRoom('d3key', { density: 0.5 }), { e: 'open' }, [E('ecoli_tem', 4, 3), E('ecoli_tem', 12, 3), E('ecoli_tem', 7, 8), E('klebsiella', 13, 7)], { props: [['crystal', 2, 1], ['crystal', 15, 1]], onClear: dropKey() }),
    cipro: D(2, 2, 'Bladder Depths — Gyrase Gallery', PEDESTAL_ROWS, { w: 'locked' }, [E('klebsiella', 4, 3), E('klebsiella', 13, 7), E('proteus', 9, 8)], { onClear: dropDrug('ciprofloxacin') }),
    pre: D(1, 1, 'Bladder Depths — Struvite Steps', genRoom('d3pre', { density: 0.35, pillars: true, hazard: true }), { s: 'open', n: 'boss', w: 'open', e: 'open' }, [E('proteus', 5, 3), E('proteus', 13, 7), E('efaecalis', 9, 8)], { props: [['crystal', 2, 1], ['crystal', 15, 1]] }),
    bosskey: D(2, 1, 'Bladder Depths — Catheter Cove', genRoom('d3bk', { density: 0.45 }), { w: 'open' }, [E('efaecalis', 4, 3), E('efaecalis', 13, 7), E('klebsiella', 9, 8), E('ecoli_tem', 14, 3)], { props: [['crystal', 2, 1], ['crystal', 15, 1]], onClear: dropBossKey() }),
    esbl: D(0, 1, 'Bladder Depths — Extended Spectrum Pool', PEDESTAL_ROWS, { e: 'open', n: 'open' }, [E('ecoli_esbl', 5, 3), E('ecoli_esbl', 13, 7), DRUG('fosfomycin', 9, 5), SIGN(15, 8, 'sign_esbl_urine')]),
    hp: D(0, 0, 'Bladder Depths — Calyx', PEDESTAL_ROWS, { s: 'open' }, [E('proteus', 5, 3), E('proteus', 13, 7), I('heartPiece', 9, 5, 'hp_d3'), I('potion', 3, 8, 'pot_d3')]),
    boss: D(1, 0, 'Bladder Depths — The Swarm King', ARENA_ROWS, { s: 'boss' }, [BOSS('proteus_d3', 9, 4), N('attending_d3', 'attending', 15, 2, 'attending_d3', { requireFlag: 'boss_proteus_d3' })]),
  } },

  // ───────────────────────── D4: LUNG FORTRESS ─────────────────────────
  lung: { name: 'Lung Fortress', theme: 'lung', music: 'dungeon', dungeon: 4, env: { lung: true }, rooms: {
    entry: D(1, 3, 'Lung Fortress — Trachea', ENTRY_ROWS, { n: 'open' }, [E('pneumo', 5, 4), E('hflu_bl', 13, 5), SIGN(14, 2, 'sign_d4_entry'), EXIT('ov_3_2', [10, 5])]),
    hub: D(1, 2, 'Lung Fortress — Bronchial Hall', genRoom('d4hub', { density: 0.4 }), { n: 'locked', w: 'open', e: 'open', s: 'open' }, [E('pneumo', 4, 3), E('pneumo_r', 13, 7), E('hflu_bl', 9, 8), E('mycoplasma', 14, 3)]),
    key: D(0, 2, 'Lung Fortress — Alveolar Sacs', genRoom('d4key', { density: 0.5, pond: true }), { e: 'open', n: 'open' }, [E('mssa', 4, 3), E('mssa', 12, 3), E('pneumo_r', 7, 8), E('klebsiella', 13, 7)], { props: [['alveolus', 14, 1]], onClear: dropKey() }),
    cro: D(2, 2, 'Lung Fortress — Currant Jelly Grotto', PEDESTAL_ROWS, { w: 'open', n: 'open' }, [E('klebsiella', 4, 3), E('klebsiella', 13, 7), E('pneumo', 9, 8)], { onClear: dropDrug('ceftriaxone') }),
    ampc: D(0, 1, 'Lung Fortress — Inducible Ward', genRoom('d4ampc', { density: 0.35, pillars: true }), { s: 'open', n: 'open', e: 'open' }, [E('enterobacter', 5, 3), E('enterobacter', 13, 7), E('mssa', 9, 8), DRUG('gentamicin', 9, 5), SIGN(15, 2, 'sign_ampc')], { props: [['alveolus', 2, 1]] }),
    pre: D(1, 1, 'Lung Fortress — Cooling Tower', genRoom('d4pre', { density: 0.3, pond: true }), { s: 'locked', n: 'boss', e: 'open', w: 'open' }, [E('legionella', 5, 3), E('legionella', 13, 7), E('chlamydia', 9, 8), DRUG('levofloxacin', 9, 5), SIGN(15, 8, 'sign_legionella')], { props: [['alveolus', 2, 1], ['alveolus', 14, 1]] }),
    bosskey: D(2, 1, 'Lung Fortress — Macrophage Hideout', genRoom('d4bk', { density: 0.45, pond: true }), { w: 'open', s: 'open', n: 'open' }, [E('legionella', 4, 3), E('legionella', 13, 7), E('legionella', 9, 8), E('pneumo_r', 14, 3)], { onClear: dropBossKey() }),
    fep: D(0, 0, 'Lung Fortress — Fourth Generation', PEDESTAL_ROWS, { s: 'open' }, [E('enterobacter', 4, 3), E('enterobacter', 13, 7), E('klebsiella', 9, 8)], { onClear: dropDrug('cefepime') }),
    hp: D(2, 0, 'Lung Fortress — Biofilm Nook', [
      '..................',
      '..TT..........TT..',
      '..................',
      '......XXXXXX......',
      '......X....X......',
      '......X....X......',
      '......XXXXXX......',
      '..................',
      '..TT..........TT..',
      '..................',
    ], { s: 'open' }, [E('pseudomonas', 4, 3), E('pseudomonas', 13, 8), I('heartPiece', 9, 5, 'hp_d4'), SIGN(15, 3, 'sign_biofilm')]),
    boss: D(1, 0, 'Lung Fortress — The Verdant Slime Lord', ARENA_ROWS, { s: 'boss' }, [BOSS('pseudomonas_d4', 9, 4), N('attending_d4', 'attending', 15, 2, 'attending_d4', { requireFlag: 'boss_pseudomonas_d4' })]),
  } },

  // ───────────────────────── D5: GUT LABYRINTH ─────────────────────────
  gut: { name: 'Gut Labyrinth', theme: 'gut', music: 'dungeon', dungeon: 5, rooms: {
    entry: D(1, 3, 'Gut Labyrinth — Pylorus', ENTRY_ROWS, { n: 'open', w: 'open', e: 'open' }, [E('ecoli', 5, 4), E('ecoli', 13, 5), SIGN(14, 2, 'sign_d5_entry'), EXIT('ov_3_4', [10, 5])]),
    key1: D(0, 3, 'Gut Labyrinth — Anaerobe Alcove', genRoom('d5key1', { density: 0.45 }), { e: 'open' }, [E('bfrag', 4, 3), E('bfrag', 12, 3), E('ecoli', 7, 8)], { onClear: dropKey(), env: { abscess: true } }, { props: [['villus', 2, 1]] }),
    soap: D(2, 3, 'Gut Labyrinth — Spore Cellar', PEDESTAL_ROWS, { w: 'open' }, [E('cdiff', 4, 3), E('cdiff', 13, 7), I('soap', 9, 5, 'item_soap'), I('probiotic', 15, 9, 'prob_d5a'), SIGN(15, 2, 'sign_spores')]),
    hub: D(1, 2, 'Gut Labyrinth — Jejunal Junction', genRoom('d5hub', { density: 0.4 }), { n: 'locked', w: 'open', e: 'open', s: 'open' }, [E('ecoli_tem', 4, 3), E('ecoli_tem', 13, 7), E('efaecalis', 9, 8), E('salmonella', 14, 3)], { props: [['villus', 2, 1], ['villus', 15, 1]] }),
    metro: D(0, 2, 'Gut Labyrinth — Oxygen-Free Zone', PEDESTAL_ROWS, { e: 'open', n: 'open' }, [E('bfrag', 4, 3), E('bfrag', 13, 7), E('bfrag', 9, 8)], { onClear: dropDrug('metronidazole'), env: { abscess: true } }),
    key2: D(2, 2, 'Gut Labyrinth — Poultry Pond', genRoom('d5key2', { density: 0.4, pond: true }), { w: 'open', n: 'open' }, [E('campylobacter', 4, 3), E('campylobacter', 12, 3), E('campylobacter', 7, 8), E('salmonella', 13, 7)], { props: [['villus', 2, 1]], onClear: dropKey() }),
    esbl: D(0, 1, 'Gut Labyrinth — Plasmid Pit', genRoom('d5esbl', { density: 0.35, pillars: true }), { s: 'open', n: 'open', e: 'open' }, [E('ecoli_esbl', 5, 3), E('ecoli_esbl', 13, 7), E('klebsiella', 9, 8)], { props: [['villus', 2, 1], ['villus', 15, 1]], onClear: dropDrug('ertapenem') }),
    pre: D(1, 1, 'Gut Labyrinth — Peritoneal Bridge', genRoom('d5pre', { density: 0.3, pond: true }), { s: 'locked', n: 'boss', w: 'open', e: 'open' }, [E('ecoli', 5, 3), E('bfrag', 13, 7), E('efaecalis', 9, 8)], { props: [['villus', 15, 1]] }),
    bosskey: D(2, 1, 'Gut Labyrinth — Mixed Flora Market', genRoom('d5bk', { density: 0.45 }), { w: 'open', s: 'open', n: 'open' }, [E('klebsiella', 4, 3), E('enterobacter', 13, 7), E('ecoli_tem', 9, 8), E('efaecalis', 14, 3)], { props: [['villus', 2, 1], ['villus', 15, 1]], onClear: dropBossKey() }),
    cdiff: D(2, 0, 'Gut Labyrinth — Pseudomembrane Nest', PEDESTAL_ROWS, { s: 'open' }, [E('cdiff', 4, 3), E('cdiff', 13, 7), E('cdiff', 9, 8), E('cdiff', 14, 3), DRUG('oralvanc', 9, 5), I('probiotic', 3, 8, 'prob_d5b'), SIGN(15, 8, 'sign_cdiff_nest')]),
    hp: D(0, 0, 'Gut Labyrinth — Walled-off Collection', [
      '..................',
      '..TT..........TT..',
      '..................',
      '......%%%%%%......',
      '......%....%......',
      '......%....%......',
      '......%%%%%%......',
      '..................',
      '..TT..........TT..',
      '..................',
    ], { s: 'open' }, [E('bfrag', 4, 3), E('ecoli', 13, 8), I('heartPiece', 9, 5, 'hp_d5'), I('potion', 15, 9, 'pot_d5')], { env: { abscess: true } }),
    boss: D(1, 0, 'Gut Labyrinth — The Polymicrobial Abscess', ARENA_ROWS, { s: 'boss' }, [BOSS('abscess_d5', 9, 4), N('attending_d5', 'attending', 15, 2, 'attending_d5', { requireFlag: 'boss_abscess_d5' })], { env: { abscess: true } }),
  } },

  // ───────────────────────── D6: HEART CITADEL ─────────────────────────
  heart: { name: 'Heart Citadel', theme: 'heart', music: 'dungeon', dungeon: 6, rooms: {
    entry: D(1, 3, 'Heart Citadel — Vena Cava', ENTRY_ROWS, { n: 'open' }, [E('viridans', 5, 4), E('viridans', 13, 5), SIGN(14, 2, 'sign_d6_entry'), EXIT('ov_4_2', [9, 5])]),
    hub: D(1, 2, 'Heart Citadel — Right Atrium', genRoom('d6hub', { density: 0.4, pond: true }), { n: 'locked', w: 'open', e: 'locked', s: 'open' }, [E('viridans', 4, 3), E('viridans', 13, 7), E('efaecalis', 9, 8), E('mssa', 14, 3)], { props: [['vessel', 2, 1]] }),
    key1: D(0, 2, 'Heart Citadel — Tricuspid Hall', genRoom('d6key1', { density: 0.5 }), { e: 'open', n: 'open' }, [E('mssa', 4, 3), E('mssa', 12, 3), E('viridans', 7, 8), E('efaecalis', 13, 7)], { props: [['vessel', 2, 1], ['vessel', 13, 1]], onClear: dropKey() }),
    vanco: D(2, 2, 'Heart Citadel — Glycopeptide Vault', PEDESTAL_ROWS, { w: 'locked', n: 'open' }, [E('efaecalis', 4, 3), E('efaecalis', 13, 7), E('viridans', 9, 8)], { onClear: dropDrug('vancomycin') }),
    key2: D(0, 1, 'Heart Citadel — Biofilm Ventricle', genRoom('d6key2', { density: 0.35, pillars: true }), { s: 'open', e: 'open', n: 'open' }, [E('sepi', 5, 3), E('sepi', 13, 7), E('sepi', 9, 8), { type: 'slime', x: 9, y: 5 }, { type: 'slime', x: 6, y: 6 }], { props: [['vessel', 2, 1], ['vessel', 13, 1]], onClear: dropKey() }),
    pre: D(1, 1, 'Heart Citadel — Mitral Gate', genRoom('d6pre', { density: 0.3, pond: true }), { s: 'locked', n: 'boss', w: 'open', e: 'open' }, [E('mrsa', 5, 3), E('mrsa', 13, 7), E('mssa', 9, 8)], { env: { endocarditis: true } }, { props: [['vessel', 13, 1]] }),
    bosskey: D(2, 1, 'Heart Citadel — Candle Line', genRoom('d6bk', { density: 0.4 }), { w: 'open', s: 'open' }, [E('candida', 4, 3), E('candida', 13, 7), E('mssa', 9, 8), E('candida', 14, 3), DRUG('fluconazole', 9, 5)], { props: [['vessel', 2, 1], ['vessel', 13, 1]], onClear: dropBossKey() }),
    secret: D(0, 0, 'Heart Citadel — Fifth Generation', [
      '..................',
      '..TT..........TT..',
      '..................',
      '......XXXXXX......',
      '......X....X......',
      '......X....X......',
      '......XXXXXX......',
      '..................',
      '..TT..........TT..',
      '..................',
    ], { s: 'open' }, [E('mrsa', 4, 3), E('mrsa', 13, 8), DRUG('ceftaroline', 9, 5), SIGN(15, 3, 'sign_ceftaroline')], { env: { endocarditis: true } }),
    boss: D(1, 0, 'Heart Citadel — The Methicillin-Resistant Monarch', ARENA_ROWS, { s: 'boss', e: 'open' }, [BOSS('mrsa_d6', 9, 4), N('attending_d6', 'attending', 3, 2, 'attending_d6', { requireFlag: 'boss_vre_d6' })], { env: { endocarditis: true } }, { props: [['vessel', 13, 1]] }),
    treasure: D(2, 0, 'Heart Citadel — Vancomycin’s Grave', ARENA_ROWS, { w: 'open' }, [{ type: 'boss', boss: 'vre_d6', x: 9, y: 4, requireFlag: 'boss_mrsa_d6' }, SIGN(15, 8, 'sign_vre')], { env: { endocarditis: true } }, { props: [['vessel', 13, 1]] }),
  } },

  // ───────────────────────── D7: BRAIN CITADEL ─────────────────────────
  brain: { name: 'Brain Citadel', theme: 'brain', music: 'dungeon', dungeon: 7, env: { cns: true }, rooms: {
    entry: D(1, 3, 'Brain Citadel — Blood-Brain Barrier', ENTRY_ROWS, { n: 'open' }, [E('meningococcus', 5, 4), E('pneumo', 13, 5), SIGN(14, 2, 'sign_d7_entry'), EXIT('ov_3_0', [10, 3])]),
    hub: D(1, 2, 'Brain Citadel — Subarachnoid Hall', genRoom('d7hub', { density: 0.4, pond: true }), { n: 'locked', w: 'open', e: 'locked', s: 'open' }, [E('meningococcus', 4, 3), E('meningococcus', 13, 7), E('pneumo_r', 9, 8)]),
    key1: D(0, 2, 'Brain Citadel — Petechial Passage', genRoom('d7key1', { density: 0.5 }), { e: 'open', n: 'open' }, [E('meningococcus', 4, 3), E('meningococcus', 12, 3), E('meningococcus', 7, 8), E('hflu', 13, 7)], { props: [['neuron', 14, 1]], onClear: dropKey() }),
    mero: D(2, 2, 'Brain Citadel — Carbapenem Cistern', PEDESTAL_ROWS, { w: 'locked', n: 'open' }, [E('pneumo_r', 4, 3), E('pneumo_r', 13, 7), E('hflu_bl', 9, 8)], { onClear: dropDrug('meropenem') }),
    key2: D(0, 1, 'Brain Citadel — Cold Cut Cellar', genRoom('d7key2', { density: 0.35, pillars: true }), { s: 'open', e: 'open', n: 'open' }, [E('listeria', 5, 3), E('listeria', 13, 7), E('meningococcus', 9, 8)], { props: [['neuron', 2, 1], ['neuron', 14, 1]], onClear: dropKey() }),
    pre: D(1, 1, 'Brain Citadel — Ventricle', genRoom('d7pre', { density: 0.3, pond: true }), { s: 'locked', n: 'boss', w: 'open', e: 'open' }, [E('listeria', 5, 3), E('pneumo_r', 13, 7), E('meningococcus', 9, 8)], { props: [['neuron', 14, 1]] }),
    bosskey: D(2, 1, 'Brain Citadel — Choroid Plexus', genRoom('d7bk', { density: 0.4 }), { w: 'open', s: 'open' }, [E('pneumo_r', 4, 3), E('meningococcus', 13, 7), E('hflu_bl', 9, 8), E('listeria', 14, 3)], { onClear: dropBossKey() }),
    vaccine: D(0, 0, 'Brain Citadel — Herd Immunity Shrine', PEDESTAL_ROWS, { s: 'open' }, [E('pneumo', 4, 3), E('hflu', 13, 8), E('meningococcus', 9, 8), I('vaccine', 9, 5, 'item_vaccine'), I('heartPiece', 15, 9, 'hp_d7'), SIGN(3, 8, 'sign_vaccine')]),
    boss: D(1, 0, 'Brain Citadel — The Cold-Loving Lurker', ARENA_ROWS, { s: 'boss' }, [BOSS('listeria_d7', 9, 4), N('attending_d7', 'attending', 15, 2, 'attending_d7', { requireFlag: 'boss_listeria_d7' })]),
  } },

  // ───────────────────────── D8: RESISTANCE NEXUS ─────────────────────────
  nexus: { name: 'Resistance Nexus', theme: 'icu', music: 'icu', dungeon: 8, rooms: {
    entry: D(1, 3, 'Resistance Nexus — Triage', ENTRY_ROWS, { n: 'open', w: 'open', e: 'open' }, [E('klebsiella_esbl', 5, 4), E('acinetobacter', 13, 5), SIGN(14, 2, 'sign_d8_entry'), N('id_consult2', 'attending', 4, 2, 'id_consult', { label: 'ID consult' }), EXIT('ov_8_4', [9, 6])], { props: [['ivpole', 2, 1]] }),
    key1: D(0, 3, 'Resistance Nexus — Isolation Room 1', genRoom('d8key1', { density: 0.45, pillars: true }), { e: 'open' }, [E('klebsiella_esbl', 4, 3), E('klebsiella_esbl', 12, 3), E('vre', 7, 8)], { props: [['monitor', 2, 1]], onClear: dropKey() }),
    atm: D(2, 3, 'Resistance Nexus — Monobactam Closet', PEDESTAL_ROWS, { w: 'open' }, [E('klebsiella_esbl', 4, 3), E('pseudomonas', 13, 7), E('acinetobacter', 9, 8)], { onClear: dropDrug('aztreonam') }),
    hub: D(1, 2, 'Resistance Nexus — Central Station', genRoom('d8hub', { density: 0.4 }), { n: 'locked', w: 'open', e: 'locked', s: 'open' }, [E('acinetobacter', 4, 3), E('klebsiella_esbl', 13, 7), E('mrsa', 9, 8), E('candida', 14, 3)], { props: [['bed', 14, 1]] }),
    steno: D(0, 2, 'Resistance Nexus — Ventilator Bay', genRoom('d8steno', { density: 0.35, pillars: true }), { e: 'open', n: 'open' }, [E('steno', 5, 3), E('steno', 13, 7), E('pseudomonas_mdr', 9, 8)], { onClear: dropKey(), env: { neutropenic: true } }),
    cza: D(2, 2, 'Resistance Nexus — Serine Lock', PEDESTAL_ROWS, { w: 'locked', n: 'open' }, [E('klebsiella_kpc', 4, 3), E('klebsiella_kpc', 13, 7), E('klebsiella_esbl', 9, 8)], { onClear: dropDrug('ceftazavi') }),
    crab: D(0, 1, 'Resistance Nexus — Desiccation Ward', genRoom('d8crab', { density: 0.3, pillars: true }), { s: 'open', n: 'open', e: 'open' }, [E('acinetobacter', 5, 3, { hp: 14, name: 'CRAB cluster' }), E('acinetobacter', 13, 7), E('acinetobacter', 9, 8)], { props: [['monitor', 15, 1]], onClear: dropDrug('colistin') }),
    pre: D(1, 1, 'Resistance Nexus — Oncology Wing', genRoom('d8pre', { density: 0.3 }), { s: 'locked', n: 'boss', w: 'open', e: 'open' }, [E('vre', 5, 3), E('mrsa', 13, 7), E('candida', 9, 8), E('cdiff', 14, 3)], { env: { neutropenic: true } }, { props: [['bed', 2, 1], ['monitor', 15, 1]] }),
    bosskey: D(2, 1, 'Resistance Nexus — Difficult-to-Treat Bay', genRoom('d8bk', { density: 0.4, pond: true }), { w: 'open', s: 'open', n: 'open' }, [E('pseudomonas_mdr', 4, 3, { hp: 14 }), E('pseudomonas_mdr', 13, 7), E('pseudomonas', 9, 8)], { props: [['monitor', 2, 1]], onClear: dropBossKey() }),
    fdc: D(0, 0, 'Resistance Nexus — Trojan Horse Stable', PEDESTAL_ROWS, { s: 'open' }, [E('steno', 4, 3), E('klebsiella_kpc', 13, 7), E('acinetobacter', 9, 8)], { onClear: dropDrug('cefiderocol') }),
    hp: D(2, 0, 'Resistance Nexus — Pharmacy Vault', PEDESTAL_ROWS, { s: 'open' }, [E('vre', 4, 3), E('mrsa', 13, 8), I('heartPiece', 9, 5, 'hp_d8'), I('potion', 15, 9, 'pot_d8'), I('probiotic', 3, 9, 'prob_d8')], { props: [['ivpole', 2, 1]] }),
    boss: D(1, 0, 'Resistance Nexus — The Carbapenemase Colossus', ARENA_ROWS, { s: 'boss' }, [BOSS('ndm_d8', 9, 4), N('attending_d8', 'attending', 15, 2, 'attending_d8', { requireFlag: 'boss_ndm_d8' })]),
  } },

  // ───────────────────────── TB: GRANULOMA PEAK ─────────────────────────
  tb: { name: 'Granuloma Peak', theme: 'bone', music: 'dungeon', dungeon: 9, rooms: {
    entry: D(1, 2, 'Granuloma Peak — Base Camp', ENTRY_ROWS, { n: 'open', w: 'open', e: 'open' }, [N('tb_guide', 'labtech', 9, 3, 'tb_guide'), SIGN(14, 2, 'sign_tb_entry'), EXIT('ov_6_2', [9, 3])]),
    inh: D(0, 2, 'Granuloma Peak — Mycolic Mine', genRoom('tbinh', { density: 0.5, pillars: true }), { e: 'open' }, [E('tb', 5, 3, { hp: 8 }), E('mssa', 13, 7)], { props: [['bone', 2, 1], ['bone', 14, 1]], onClear: dropDrug('isoniazid') }),
    pza: D(2, 2, 'Granuloma Peak — Acid Cavern', genRoom('tbpza', { density: 0.5, pillars: true, hazard: true }), { w: 'open' }, [E('tb', 5, 3, { hp: 8 }), E('nocardia', 13, 7)], { props: [['bone', 2, 1]], onClear: dropDrug('pyrazinamide') }),
    emb: D(1, 1, 'Granuloma Peak — Upper Lobe Ledge', genRoom('tbemb', { density: 0.4, pillars: true }), { s: 'open', n: 'open' }, [E('tb', 5, 3, { hp: 8 }), E('tb', 13, 7, { hp: 8 })], { props: [['bone', 2, 1], ['bone', 14, 1]], onClear: dropDrug('ethambutol') }),
    boss: D(1, 0, 'Granuloma Peak — The Waxy Titan', ARENA_ROWS, { s: 'open' }, [BOSS('tb_mtn', 9, 4), N('attending_tb', 'attending', 15, 2, 'attending_tb', { requireFlag: 'boss_tb_mtn' })]),
  } },
};
