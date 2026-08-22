// ============================================================================
// Input: keyboard + gamepad + touch, mapped to abstract actions
// ============================================================================
const KEYMAP = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  fire: ['KeyZ', 'KeyJ', 'Space'], tool: ['KeyX', 'KeyK', 'ShiftLeft', 'ShiftRight'],
  prev: ['KeyQ', 'BracketLeft', 'Comma'], next: ['KeyE', 'BracketRight', 'Period'],
  menu: ['Tab', 'KeyI'], pause: ['Escape', 'KeyP'], map: ['KeyM'],
  confirm: ['KeyZ', 'KeyJ', 'Space', 'Enter'], cancel: ['KeyX', 'KeyK', 'Escape', 'Backspace'],
  slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'], slot5: ['Digit5'], slot6: ['Digit6'], slot7: ['Digit7'], slot8: ['Digit8'], slot9: ['Digit9'],
};
const CODE_TO_ACTIONS = {};
for (const [a, codes] of Object.entries(KEYMAP)) for (const c of codes) (CODE_TO_ACTIONS[c] ||= []).push(a);
// Fallback: some automation/virtual keyboards send `key` without a usable `code`
const KEY_TO_CODE = { Enter: 'Enter', ' ': 'Space', Spacebar: 'Space', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Shift: 'ShiftLeft', ',': 'Comma', '.': 'Period', '[': 'BracketLeft', ']': 'BracketRight' };
function codeOf(e) {
  if (e.code && CODE_TO_ACTIONS[e.code]) return e.code;
  const k = e.key || '';
  if (KEY_TO_CODE[k]) return KEY_TO_CODE[k];
  if (/^[a-zA-Z]$/.test(k)) return 'Key' + k.toUpperCase();
  if (/^[0-9]$/.test(k)) return 'Digit' + k;
  return e.code || '';
}

export class Input {
  constructor() {
    this.down = new Set();      // actions currently held
    this.pressedSet = new Set(); // edge this frame
    this.releasedSet = new Set();
    this.touchActive = false;
    this.touch = { dx: 0, dy: 0, fire: false, tool: false, menu: false, prev: false, next: false, pause: false };
    this.gamepadIndex = null;
    this.lastGamepad = {};
    this.anyKey = false;
    this.textTyped = '';
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const acts = CODE_TO_ACTIONS[codeOf(e)];
      if (acts) { for (const a of acts) { if (!this.down.has(a)) this.pressedSet.add(a); this.down.add(a); } }
      this.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const acts = CODE_TO_ACTIONS[codeOf(e)];
      if (acts) for (const a of acts) { this.down.delete(a); this.releasedSet.add(a); }
    });
    window.addEventListener('blur', () => { this.down.clear(); });
    window.addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
  }
  /** Call once per frame BEFORE update; merges gamepad + touch */
  poll() {
    // Gamepad
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null; for (const g of gps) if (g) { gp = g; break; }
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, dz = 0.35;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const map = {
        up: ay < -dz || b(12), down: ay > dz || b(13), left: ax < -dz || b(14), right: ax > dz || b(15),
        fire: b(0), tool: b(1) || b(2), prev: b(4), next: b(5), menu: b(3), pause: b(9), map: b(8),
        confirm: b(0), cancel: b(1),
      };
      for (const [a, v] of Object.entries(map)) {
        const was = !!this.lastGamepad[a];
        if (v && !was) { this.pressedSet.add(a); this.down.add('gp_' + a); }
        if (!v && was) { this.down.delete('gp_' + a); this.releasedSet.add(a); }
        this.lastGamepad[a] = v;
      }
    }
    // Touch (set by TouchControls each frame)
    if (this.touchActive) {
      const t = this.touch;
      const map = { up: t.dy < -0.4, down: t.dy > 0.4, left: t.dx < -0.4, right: t.dx > 0.4, fire: t.fire, tool: t.tool, menu: t.menu, prev: t.prev, next: t.next, pause: t.pause, confirm: t.fire, cancel: t.tool };
      for (const [a, v] of Object.entries(map)) {
        const key = 'tc_' + a, was = this.down.has(key);
        if (v && !was) { this.pressedSet.add(a); this.down.add(key); }
        if (!v && was) { this.down.delete(key); this.releasedSet.add(a); }
      }
    }
  }
  held(a) { return this.down.has(a) || this.down.has('gp_' + a) || this.down.has('tc_' + a); }
  pressed(a) { return this.pressedSet.has(a); }
  released(a) { return this.releasedSet.has(a); }
  /** Call at end of frame */
  endFrame() { this.pressedSet.clear(); this.releasedSet.clear(); this.anyKey = false; }
  /** movement vector (-1..1, -1..1) normalized for diagonals */
  moveVec() {
    let x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let y = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    if (this.touchActive && (Math.abs(this.touch.dx) > 0.25 || Math.abs(this.touch.dy) > 0.25)) { x = this.touch.dx; y = this.touch.dy; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return [x, y];
  }
  consume(a) { this.pressedSet.delete(a); }
}

// ----------------------------------------------------------------------------
// On-screen touch controls (created only when a touch device is detected)
// ----------------------------------------------------------------------------
export function createTouchControls(input, root) {
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) return null;
  const el = document.createElement('div');
  el.id = 'touch-controls';
  el.innerHTML = `
    <div class="tc-pad" id="tc-pad"><div class="tc-knob" id="tc-knob"></div></div>
    <div class="tc-buttons">
      <button class="tc-btn tc-b" id="tc-tool" aria-label="Tool">B</button>
      <button class="tc-btn tc-a" id="tc-fire" aria-label="Fire">A</button>
    </div>
    <div class="tc-top">
      <button class="tc-small" id="tc-prev" aria-label="Previous drug">◀</button>
      <button class="tc-small" id="tc-menu" aria-label="Menu">☰</button>
      <button class="tc-small" id="tc-next" aria-label="Next drug">▶</button>
    </div>`;
  root.appendChild(el);
  input.touchActive = true;
  const pad = el.querySelector('#tc-pad'), knob = el.querySelector('#tc-knob');
  let padId = null;
  const setPad = (cx, cy) => {
    const r = pad.getBoundingClientRect();
    let dx = (cx - (r.left + r.width / 2)) / (r.width / 2), dy = (cy - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    input.touch.dx = dx; input.touch.dy = dy;
    knob.style.transform = `translate(${dx * 28}px, ${dy * 28}px)`;
  };
  pad.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; padId = t.identifier; setPad(t.clientX, t.clientY); }, { passive: false });
  pad.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === padId) setPad(t.clientX, t.clientY); }, { passive: false });
  const endPad = (e) => { for (const t of e.changedTouches) if (t.identifier === padId) { padId = null; input.touch.dx = 0; input.touch.dy = 0; knob.style.transform = ''; } };
  pad.addEventListener('touchend', endPad); pad.addEventListener('touchcancel', endPad);
  const bind = (id, key) => {
    const b = el.querySelector('#' + id);
    const on = (e) => { e.preventDefault(); input.touch[key] = true; b.classList.add('on'); };
    const off = (e) => { e.preventDefault(); input.touch[key] = false; b.classList.remove('on'); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off);
  };
  bind('tc-fire', 'fire'); bind('tc-tool', 'tool'); bind('tc-menu', 'menu'); bind('tc-prev', 'prev'); bind('tc-next', 'next');
  return el;
}
