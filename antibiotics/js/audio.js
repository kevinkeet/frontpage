// ============================================================================
// Audio: synthesized SFX + a tiny chiptune sequencer (no external assets)
// ============================================================================
const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteHz(n) {
  if (!n || n === '-' || n === '.') return 0;
  const m = NOTE_RE.exec(n); if (!m) return 0;
  let s = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
  return 440 * Math.pow(2, (s - 69) / 12);
}

export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.sfxGain = null; this.musGain = null;
    this.enabled = true; this.musicOn = true; this.sfxVol = 0.8; this.musVol = 0.5;
    this.song = null; this.songId = null; this.nextTime = 0; this.step = 0; this.timer = null;
    this.noiseBuf = null;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.master);
    this.musGain = this.ctx.createGain(); this.musGain.gain.value = this.musVol; this.musGain.connect(this.master);
    // noise buffer
    const len = this.ctx.sampleRate * 1;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.songId) this._startSequencer();
  }
  setVolumes(sfx, mus) { this.sfxVol = sfx; this.musVol = mus; if (this.sfxGain) this.sfxGain.gain.value = sfx; if (this.musGain) this.musGain.gain.value = mus; }

  // ---- SFX primitives ----
  _osc(type, f0, f1, t, dur, vol = 0.3, curve = 'exp', dest) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) { if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); else o.frequency.linearRampToValueAtTime(f1, t + dur); }
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  _noise(t, dur, vol = 0.3, filterHz = 1200, q = 1) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterHz; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(t); s.stop(t + dur + 0.02);
  }
  sfx(name, p = {}) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'shoot': this._osc('square', 880, 440, t, 0.08, 0.12); break;
      case 'shootHeavy': this._osc('sawtooth', 220, 80, t, 0.18, 0.18); this._noise(t, 0.08, 0.08, 600); break;
      case 'shootPierce': this._osc('square', 1400, 2200, t, 0.1, 0.1); break;
      case 'shootStun': this._osc('sine', 600, 900, t, 0.12, 0.14); this._osc('sine', 900, 600, t + 0.06, 0.1, 0.1); break;
      case 'shootAoe': this._osc('triangle', 300, 150, t, 0.15, 0.18); break;
      case 'shootSpray': this._noise(t, 0.1, 0.18, 2500, 0.8); break;
      case 'shootChain': this._osc('sawtooth', 1200, 300, t, 0.12, 0.12); this._noise(t, 0.06, 0.1, 4000); break;
      case 'shootBeam': this._osc('sawtooth', 200, 600, t, 0.16, 0.14); this._osc('square', 400, 1200, t, 0.12, 0.06); break;
      case 'charge': this._osc('sine', 200 + (p.level || 0) * 400, 300 + (p.level || 0) * 500, t, 0.08, 0.08); break;
      case 'hit': this._noise(t, 0.06, 0.25, 900, 2); this._osc('square', 300, 150, t, 0.06, 0.12); break;
      case 'hitBig': this._noise(t, 0.12, 0.3, 500, 2); this._osc('sawtooth', 200, 60, t, 0.15, 0.2); break;
      case 'resist': this._osc('square', 240, 240, t, 0.05, 0.15); this._osc('square', 180, 180, t + 0.06, 0.12, 0.15); this._noise(t, 0.05, 0.15, 3000, 3); break;
      case 'immune': this._osc('triangle', 500, 120, t, 0.25, 0.15); break;
      case 'die': this._noise(t, 0.25, 0.3, 700, 1); this._osc('square', 400, 40, t, 0.3, 0.18); break;
      case 'dieBig': this._noise(t, 0.6, 0.4, 300, 1); this._osc('sawtooth', 300, 30, t, 0.7, 0.25); this._osc('square', 150, 20, t + 0.1, 0.6, 0.2); break;
      case 'hurt': this._osc('square', 200, 90, t, 0.25, 0.25); this._noise(t, 0.15, 0.2, 400); break;
      case 'pickup': this._osc('square', 880, 880, t, 0.06, 0.15); this._osc('square', 1320, 1320, t + 0.07, 0.12, 0.15); break;
      case 'heart': this._osc('square', 660, 660, t, 0.07, 0.15); this._osc('square', 880, 880, t + 0.08, 0.07, 0.15); this._osc('square', 1320, 1320, t + 0.16, 0.15, 0.15); break;
      case 'pearl': this._osc('sine', 1568, 2093, t, 0.12, 0.15); break;
      case 'key': this._osc('square', 988, 988, t, 0.08, 0.15); this._osc('square', 1319, 1319, t + 0.09, 0.08, 0.15); this._osc('square', 1760, 1760, t + 0.18, 0.2, 0.15); break;
      case 'door': this._noise(t, 0.3, 0.3, 250, 1); this._osc('square', 120, 60, t, 0.3, 0.15); break;
      case 'unlock': this._osc('square', 523, 523, t, 0.08, 0.15); this._osc('square', 784, 784, t + 0.1, 0.2, 0.15); this._noise(t + 0.1, 0.2, 0.15, 300); break;
      case 'stairs': this._osc('triangle', 400, 200, t, 0.3, 0.15); this._osc('triangle', 300, 150, t + 0.15, 0.3, 0.15); break;
      case 'menuMove': this._osc('square', 700, 700, t, 0.04, 0.1); break;
      case 'menuSel': this._osc('square', 900, 1200, t, 0.08, 0.12); break;
      case 'menuBack': this._osc('square', 500, 300, t, 0.1, 0.1); break;
      case 'blip': this._osc('square', 1000 + Math.random() * 300, 1000, t, 0.03, 0.06); break;
      case 'error': this._osc('sawtooth', 200, 150, t, 0.2, 0.15); break;
      case 'itemGet': { const n = [659, 784, 988, 1319]; n.forEach((f, i) => this._osc('square', f, f, t + i * 0.12, 0.14, 0.16)); this._osc('square', 1568, 1568, t + 0.48, 0.5, 0.16); break; }
      case 'secret': { const n = [784, 740, 622, 440, 415, 659, 831, 1047]; n.forEach((f, i) => this._osc('square', f, f, t + i * 0.09, 0.1, 0.14)); break; }
      case 'bossRoar': this._osc('sawtooth', 90, 40, t, 0.8, 0.35); this._noise(t, 0.7, 0.35, 200, 0.7); this._osc('square', 60, 30, t + 0.1, 0.7, 0.2); break;
      case 'bossHit': this._noise(t, 0.1, 0.3, 400, 1); this._osc('square', 180, 90, t, 0.12, 0.2); break;
      case 'mutate': this._osc('sawtooth', 300, 1200, t, 0.35, 0.2); this._osc('square', 150, 600, t + 0.05, 0.3, 0.12); break;
      case 'toxin': this._osc('sine', 500, 200, t, 0.15, 0.12); break;
      case 'spore': this._noise(t, 0.15, 0.12, 2000, 1); break;
      case 'lps': this._noise(t, 0.3, 0.3, 300, 0.8); this._osc('sawtooth', 120, 40, t, 0.3, 0.2); break;
      case 'heal': this._osc('sine', 523, 1047, t, 0.3, 0.15); this._osc('sine', 659, 1319, t + 0.1, 0.3, 0.12); break;
      case 'scalpel': this._noise(t, 0.12, 0.25, 5000, 2); this._osc('square', 1800, 900, t, 0.08, 0.08); break;
      case 'synergy': this._osc('square', 660, 1320, t, 0.15, 0.15); this._osc('square', 990, 1980, t + 0.05, 0.15, 0.1); break;
      case 'quizRight': [784, 988, 1175].forEach((f, i) => this._osc('square', f, f, t + i * 0.08, 0.12, 0.15)); break;
      case 'quizWrong': this._osc('square', 300, 200, t, 0.25, 0.15); this._osc('square', 200, 120, t + 0.15, 0.3, 0.15); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this._osc('square', f, f, t + i * 0.07, 0.2, 0.14)); break;
      case 'gameover': [440, 415, 392, 370, 349, 330].forEach((f, i) => this._osc('triangle', f, f, t + i * 0.18, 0.3, 0.2)); break;
      case 'cdiff': this._osc('sawtooth', 100, 60, t, 0.5, 0.2); this._noise(t, 0.4, 0.2, 150); break;
      case 'companion': this._osc('sine', 1200, 1600, t, 0.05, 0.08); break;
      default: break;
    }
  }

  // ---- Music sequencer ----
  // song: { bpm, loop:true, tracks:[{wave:'square', vol, notes:[['C4',1],['-',1],...]}] } notes in steps (16ths)
  play(songId, songs) {
    if (this.songId === songId) return;
    this.songId = songId; this.song = songs[songId] || null; this.step = 0;
    if (this.ctx) this._startSequencer();
  }
  stop() { this.songId = null; this.song = null; if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  _startSequencer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (!this.song || !this.ctx) return;
    // pre-expand tracks into per-step arrays
    this.expanded = this.song.tracks.map((tr) => {
      const steps = [];
      for (const n of tr.notes) { const [note, len] = Array.isArray(n) ? n : [n, 1]; steps.push({ note, len }); for (let i = 1; i < len; i++) steps.push(null); }
      return { ...tr, steps };
    });
    this.songLen = Math.max(...this.expanded.map((t) => t.steps.length));
    this.stepDur = 60 / this.song.bpm / 4;
    this.nextTime = this.ctx.currentTime + 0.05; this.step = 0;
    this.timer = setInterval(() => this._tick(), 40);
  }
  _tick() {
    if (!this.song || !this.ctx || !this.musicOn) return;
    const ahead = 0.15;
    while (this.nextTime < this.ctx.currentTime + ahead) {
      const s = this.step % this.songLen;
      for (const tr of this.expanded) {
        const ev = tr.steps[s % tr.steps.length];
        if (ev && ev.note && ev.note !== '-' && ev.note !== '.') {
          const hz = noteHz(ev.note); if (!hz) continue;
          const dur = ev.len * this.stepDur * (tr.gate || 0.9);
          if (tr.wave === 'noise') { this._noiseAt(this.nextTime, dur, tr.vol || 0.1, tr.filter || 3000); }
          else this._tone(tr.wave || 'square', hz, this.nextTime, dur, tr.vol || 0.12, tr.decay);
        }
      }
      this.nextTime += this.stepDur; this.step++;
    }
  }
  _tone(type, hz, t, dur, vol, decay) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    if (decay) g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(dur, decay)); else { g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + dur); }
    o.connect(g); g.connect(this.musGain); o.start(t); o.stop(t + dur + 0.03);
  }
  _noiseAt(t, dur, vol, filterHz) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = filterHz;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.musGain); s.start(t); s.stop(t + dur + 0.02);
  }
}

// ----------------------------------------------------------------------------
// Songs (original chiptune loops). Notes are 16th-steps: [note, length]
// ----------------------------------------------------------------------------
const seq = (str, len = 1) => str.trim().split(/\s+/).map((n) => { const m = /^(.+?)(?:\*(\d+))?$/.exec(n); return [m[1], m[2] ? parseInt(m[2], 10) : len]; });

export const SONGS = {
  title: { bpm: 112, tracks: [
    { wave: 'square', vol: 0.10, gate: 0.85, notes: seq('E4*2 G4*2 B4*2 E5*4 D5*2 B4*2 A4*2 G4*4 E4*2 G4*2 A4*2 B4*4 C5*2 B4*2 A4*2 G4*4 F#4*2 G4*2 A4*2 B4*4 A4*2 G4*2 F#4*2 E4*8') },
    { wave: 'triangle', vol: 0.16, gate: 0.9, notes: seq('E2*4 E2*4 C2*4 C2*4 A1*4 A1*4 B1*4 B1*4 E2*4 E2*4 C2*4 C2*4 D2*4 D2*4 E2*4 E2*4') },
    { wave: 'square', vol: 0.05, gate: 0.5, notes: seq('E3 G3 B3 G3 E3 G3 B3 G3 C3 E3 G3 E3 C3 E3 G3 E3 A2 C3 E3 C3 A2 C3 E3 C3 B2 D3 F#3 D3 B2 D3 F#3 D3 E3 G3 B3 G3 E3 G3 B3 G3 C3 E3 G3 E3 C3 E3 G3 E3 D3 F#3 A3 F#3 D3 F#3 A3 F#3 E3 G3 B3 G3 E3 G3 B3 G3') },
  ] },
  overworld: { bpm: 132, tracks: [
    { wave: 'square', vol: 0.10, gate: 0.8, notes: seq('G4*2 G4 A4 B4*2 D5*2 B4*2 A4 G4 A4*4 E4*2 E4 F#4 G4*2 B4*2 A4*2 G4 F#4 E4*4 G4*2 G4 A4 B4*2 D5*2 E5*2 D5 B4 C5*4 B4*2 A4 G4 A4*2 F#4*2 G4*8') },
    { wave: 'triangle', vol: 0.16, gate: 0.9, notes: seq('G2*2 G2*2 D3*2 D3*2 E2*2 E2*2 B2*2 B2*2 C3*2 C3*2 G2*2 G2*2 D3*2 D3*2 G2*2 G2*2 G2*2 G2*2 D3*2 D3*2 E2*2 E2*2 B2*2 B2*2 C3*2 C3*2 D3*2 D3*2 G2*4 G2*4') },
    { wave: 'noise', vol: 0.05, filter: 5000, notes: seq('C5 - C5 - C5 - C5 - C5 - C5 - C5 - C5 C5') },
    { wave: 'square', vol: 0.045, gate: 0.4, notes: seq('G3 B3 D4 B3 D3 F#3 A3 F#3 E3 G3 B3 G3 B2 D3 F#3 D3 C3 E3 G3 E3 G2 B2 D3 B2 D3 F#3 A3 F#3 G3 B3 D4 B3') },
  ] },
  town: { bpm: 100, tracks: [
    { wave: 'triangle', vol: 0.12, gate: 0.8, notes: seq('C4*2 E4*2 G4*4 A4*2 G4*2 E4*4 F4*2 E4*2 D4*4 E4*2 D4*2 C4*4 C4*2 E4*2 G4*4 C5*2 B4*2 A4*4 G4*2 F4*2 E4*2 D4*2 C4*8') },
    { wave: 'sine', vol: 0.18, gate: 0.9, notes: seq('C3*4 G2*4 F2*4 G2*4 C3*4 A2*4 F2*4 G2*4 C3*4 G2*4 F2*4 G2*4 C3*4 A2*4 G2*4 C3*4') },
    { wave: 'square', vol: 0.035, gate: 0.5, notes: seq('E4 G4 C5 G4 E4 G4 C5 G4 D4 F4 A4 F4 D4 F4 A4 F4 F4 A4 C5 A4 F4 A4 C5 A4 D4 G4 B4 G4 D4 G4 B4 G4') },
  ] },
  dungeon: { bpm: 120, tracks: [
    { wave: 'square', vol: 0.09, gate: 0.7, notes: seq('A3*2 C4*2 E4*2 A4*4 G#4*2 E4*2 C4*4 A3*2 C4*2 E4*2 A4*4 B4*2 C5*2 B4*4 A3*2 C4*2 E4*2 A4*4 G#4*2 E4*2 C4*4 F4*2 E4*2 D4*2 C4*2 B3*2 C4*2 A3*6') },
    { wave: 'triangle', vol: 0.17, gate: 0.9, notes: seq('A1*4 A1*4 A1*4 A1*4 F1*4 F1*4 G1*4 G1*4 A1*4 A1*4 A1*4 A1*4 F1*4 E1*4 A1*4 A1*4') },
    { wave: 'noise', vol: 0.04, filter: 6000, notes: seq('C5 - - - C5 - - - C5 - - - C5 - C5 -') },
    { wave: 'sawtooth', vol: 0.025, gate: 0.3, decay: 0.08, notes: seq('A2 - A2 - A2 - A2 - F2 - F2 - G2 - G2 -') },
  ] },
  boss: { bpm: 150, tracks: [
    { wave: 'square', vol: 0.10, gate: 0.6, notes: seq('D4 D4 F4 D4 G#4 D4 F4 D4 D4 D4 F4 D4 A4 G#4 F4 D4 D4 D4 F4 D4 G#4 D4 F4 D4 C5 A#4 A4 G#4 F4 D4 C#4 D4') },
    { wave: 'sawtooth', vol: 0.12, gate: 0.9, notes: seq('D2*2 D2*2 D2*2 D2*2 D2*2 D2*2 D2*2 D2*2 A#1*2 A#1*2 A#1*2 A#1*2 C2*2 C2*2 C#2*2 C#2*2') },
    { wave: 'noise', vol: 0.07, filter: 4000, notes: seq('C5 - C5 C5 C5 - C5 - C5 - C5 C5 C5 - C5 C5') },
    { wave: 'square', vol: 0.05, gate: 0.4, notes: seq('D5 - - - - - - - A4 - - - - - - - D5 - - - - - - - F5 - - - E5 - C#5 -') },
  ] },
  icu: { bpm: 126, tracks: [
    { wave: 'square', vol: 0.08, gate: 0.6, notes: seq('E4*3 E4 G4*2 A#4*2 E4*3 E4 D4*2 C4*2 E4*3 E4 G4*2 A#4*2 B4*2 A#4*2 G4*2 E4*2 E4*3 E4 G4*2 A#4*2 E4*3 E4 D4*2 C4*2 C5*2 B4*2 A#4*2 G4*2 F4*2 E4*2 D#4*2 E4*2') },
    { wave: 'sawtooth', vol: 0.10, gate: 0.9, notes: seq('E1*4 E1*4 E1*4 E1*4 C1*4 C1*4 D1*4 D1*4 E1*4 E1*4 E1*4 E1*4 C1*4 C1*4 B0*4 E1*4') },
    { wave: 'noise', vol: 0.05, filter: 7000, notes: seq('C5 - - C5 - - C5 - C5 - - C5 - - C5 -') },
    { wave: 'sine', vol: 0.06, gate: 0.2, notes: seq('E6 - - - - - - - - - - - - - - - B5 - - - - - - - - - - - - - - -') },
  ] },
  victory: { bpm: 140, loop: false, tracks: [
    { wave: 'square', vol: 0.12, gate: 0.9, notes: seq('C5*2 C5 C5 C5*2 G#4*2 A#4*2 C5*2 - A#4 C5*8') },
    { wave: 'triangle', vol: 0.15, notes: seq('C3*4 C3*4 F2*4 G2*4 C3*8') },
  ] },
  gameover: { bpm: 80, loop: false, tracks: [
    { wave: 'triangle', vol: 0.15, gate: 0.9, notes: seq('E4*3 E4 E4*4 C4*3 C4 C4*4 B3*2 A3*2 G3*8') },
  ] },
  ending: { bpm: 96, tracks: [
    { wave: 'square', vol: 0.10, gate: 0.85, notes: seq('C5*4 B4*2 A4*2 G4*4 E4*4 F4*4 G4*2 A4*2 G4*8 E4*4 G4*2 C5*2 D5*4 E5*4 D5*4 C5*2 A4*2 G4*8') },
    { wave: 'triangle', vol: 0.17, gate: 0.9, notes: seq('C3*4 C3*4 G2*4 G2*4 F2*4 F2*4 G2*4 G2*4 C3*4 C3*4 E2*4 E2*4 F2*4 G2*4 C3*8') },
    { wave: 'square', vol: 0.04, gate: 0.5, notes: seq('E4 G4 C5 G4 E4 G4 C5 G4 D4 G4 B4 G4 D4 G4 B4 G4 F4 A4 C5 A4 F4 A4 C5 A4 D4 G4 B4 G4 D4 G4 B4 G4 E4 G4 C5 G4 E4 G4 C5 G4 E4 G#4 B4 G#4 E4 G#4 B4 G#4 F4 A4 C5 A4 G4 B4 D5 B4 C5 E5 G5 E5 C5 E5 G5 E5') },
  ] },
};
