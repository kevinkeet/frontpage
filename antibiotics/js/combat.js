// ============================================================================
// Combat resolution: does DRUG hurt BUG, and if not, WHY? (the teaching core)
// ============================================================================
import { DRUG_BY_ID, GENERIC_REASONS as R } from './data/drugs.js';
import { BUG_BY_ID } from './data/bugs.js';

const WALL_TARGETS = new Set(['wall']);

/** Base spectrum multiplier by scanning bug tags general -> specific (last match wins). */
export function baseSpectrum(drug, bug) {
  let mult = 0, matched = null;
  for (const t of bug.tags) {
    if (drug.spectrum[t] !== undefined) { mult = drug.spectrum[t]; matched = t; }
  }
  return { mult, matched };
}

/** Educational reason for zero base coverage. */
export function zeroReason(drug, bug) {
  // drug-specific reasons (most specific tag first)
  if (drug.noCover) {
    for (let i = bug.tags.length - 1; i >= 0; i--) {
      const t = bug.tags[i];
      if (drug.noCover[t]) return drug.noCover[t];
    }
  }
  const tags = new Set(bug.tags);
  if (tags.has('virus')) return R.virus;
  if (tags.has('fungus')) return drug.flags?.antifungal ? R.notSpectrum : R.fungus;
  if (drug.flags?.antifungal) return 'ANTIFUNGAL — bacteria have no ergosterol';
  if (tags.has('mycoplasma') && (WALL_TARGETS.has(drug.target))) return R.wallNoWall;
  if (tags.has('afb') && !drug.flags?.tbCombo) return R.afb;
  if (drug.flags?.anaerobeOnly && !tags.has('anaerobe')) return R.anaerobeOnly;
  if (drug.flags?.needsO2 && tags.has('anaerobe')) return R.needsO2;
  if (drug.flags?.tbCombo) return 'TB-SPECIFIC drug';
  if (tags.has('intracellular') || bug.traits?.includes('intracellular')) {
    if (!drug.flags?.intracellular) return R.intracell;
  }
  if (tags.has('gn') && ['vancomycin', 'daptomycin', 'linezolid', 'nafcillin', 'clindamycin', 'oralvanc'].includes(drug.id)) return R.outerMembrane;
  if (tags.has('gn') && drug.spectrum.gp > 0 && (drug.spectrum.gn === 0 || drug.spectrum.gn === undefined)) return R.gpOnly;
  if (tags.has('gp') && drug.spectrum.gn > 0 && (drug.spectrum.gp === 0 || drug.spectrum.gp === undefined)) return R.gnOnly;
  if (tags.has('enterococcus') && drug.cls === 'cephalosporin') return R.entCeph;
  if (tags.has('listeria') && drug.cls === 'cephalosporin') return R.listeriaCeph;
  if (tags.has('pseudomonas')) return R.pseudo;
  if (tags.has('steno') && drug.cls === 'carbapenem') return R.stenoCarb;
  if (tags.has('cdiff')) return R.cdiffLumen;
  if (tags.has('atyp') && WALL_TARGETS.has(drug.target)) return 'ATYPICAL — cell-wall drugs useless';
  return R.notSpectrum;
}

/**
 * Resolve an attack.
 * @param {object} drug  drug definition
 * @param {object} bug   bug definition
 * @param {object} opts  { resist: string[] (current, may include dynamic), env: { cns, lung, urine, abscess, neutropenic, endocarditis }, synergy: bool, charge: 0..1 }
 * @returns {{mult:number, reason:string|null, kind:'hit'|'partial'|'blocked'|'immune'|'env'}}
 */
export function resolve(drug, bug, opts = {}) {
  const resist = opts.resist || bug.resist || [];
  const env = opts.env || {};
  const tags = new Set(bug.tags);

  // 1. Environment gates (where the drug can't physically act)
  if (env.cns && drug.flags?.bbb === false) return { mult: 0, reason: R.bbb, kind: 'env' };
  if (env.lung && drug.flags?.lungBlocked) return { mult: 0, reason: R.surfactant, kind: 'env' };
  if (!env.urine && drug.flags?.urineOnly) return { mult: 0, reason: R.urineOnly, kind: 'env' };

  // 2. Base spectrum
  let { mult } = baseSpectrum(drug, bug);
  if (mult <= 0) return { mult: 0, reason: zeroReason(drug, bug), kind: 'immune' };

  // 3. Resistance mechanisms
  let partialText = null;
  for (const m of resist) {
    const b = drug.blockedBy?.[m];
    if (b === undefined || b === null) continue;
    if (typeof b === 'string') return { mult: 0, reason: b, kind: 'blocked' };
    if (b.mult !== undefined) { mult *= b.mult; partialText = b.text; }
  }

  // 4. Environment modifiers (partial)
  if (env.abscess && drug.flags?.abscessPenalty) { mult *= drug.flags.abscessPenalty; partialText = partialText || 'ABSCESS — low pH/O₂ weakens it'; }
  if (env.lung && drug.flags?.lungPenalty) { mult *= drug.flags.lungPenalty; partialText = partialText || 'POOR LUNG PENETRATION'; }
  if (env.urine && drug.flags?.urineOnly) mult *= 1.3; // concentrates in urine

  // 5. Synergy: aminoglycoside after a wall-active hit on gram-positives
  if (drug.flags?.synergy && opts.synergy && tags.has('gp')) { mult = Math.max(mult * 4, 1.2); partialText = 'SYNERGY — wall opened for the aminoglycoside'; return { mult, reason: partialText, kind: 'hit' }; }

  if (partialText) return { mult, reason: partialText, kind: 'partial' };
  return { mult, reason: null, kind: 'hit' };
}

/** Convenience by id */
export function resolveIds(drugId, bugId, opts) {
  return resolve(DRUG_BY_ID[drugId], BUG_BY_ID[bugId], opts);
}

/** Category for the antibiogram grid: 'S' (>=0.8), 'I' (0.3-0.8), 'R' (<0.3 but >0), 'X' (0) */
export function sirCategory(mult) {
  if (mult >= 0.8) return 'S';
  if (mult >= 0.3) return 'I';
  if (mult > 0) return 'R';
  return 'X';
}
