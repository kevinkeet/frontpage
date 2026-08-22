// ============================================================================
// Entities: Player, Enemy (+Boss), Projectile, Pickup, NPC, Companion, FX
// ============================================================================
import { TILE, ROOM_W, ROOM_H } from './const.js';
import { clamp, dist, TAU, rand, randInt, choice, angleTo, rectsOverlap } from './util.js';
import { HERO, NPCS, drawBug, drawItemIcon, drawHeart, text as gtext, COMPANION, rgba, mix } from './gfx.js';
import { T, SOLID } from './gfx.js';
import { DRUG_BY_ID } from './data/drugs.js';
import { BUG_BY_ID } from './data/bugs.js';
import { resolve } from './combat.js';

const PW = ROOM_W * TILE, PH = ROOM_H * TILE;

// ---------------------------------------------------------------------------
export class Player {
  constructor(game) {
    this.g = game; this.x = PW / 2 - 6; this.y = PH / 2 - 6; this.w = 12; this.h = 12;
    this.facing = 0; this.moving = false; this.walkT = 0; this.speed = 1.35;
    this.cool = 0; this.charge = 0; this.charging = false; this.inv = 0; this.kbx = 0; this.kby = 0;
    this.toolT = 0; this.toolAnim = 0; this.dead = false; this.slow = 0; this.fireAnim = 0;
  }
  get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
  update() {
    const g = this.g, inp = g.input;
    if (this.dead) return;
    if (this.inv > 0) this.inv--;
    if (this.cool > 0) this.cool--;
    if (this.toolAnim > 0) this.toolAnim--;
    if (this.fireAnim > 0) this.fireAnim--;
    if (this.slow > 0) this.slow--;
    // movement
    let [mx, my] = inp.moveVec();
    if (g.lockPlayer) { mx = 0; my = 0; }
    const inSlime = g.slimeAt(this.cx, this.cy);
    let sp = this.speed * (inSlime ? 0.55 : 1) * (this.slow > 0 ? 0.6 : 1);
    if (this.kbx || this.kby) { mx += this.kbx; my += this.kby; this.kbx *= 0.8; this.kby *= 0.8; if (Math.abs(this.kbx) < 0.05) this.kbx = 0; if (Math.abs(this.kby) < 0.05) this.kby = 0; sp = 1; }
    this.moving = (mx !== 0 || my !== 0);
    if (this.moving) {
      if (!this.charging || true) {
        if (Math.abs(mx) > Math.abs(my)) this.facing = mx > 0 ? 3 : 1; else if (my !== 0) this.facing = my > 0 ? 0 : 2;
      }
      this.move(mx * sp, my * sp);
      this.walkT += 0.18;
    }
    // hazards
    const tt = g.room.typeAtPx(this.cx, this.cy + 3);
    if (tt === T.HAZARD && this.inv === 0) this.hurt(0.5, null, { kb: true });
    if (tt === T.HEAL && g.frame % 30 === 0 && g.hp < g.maxHp) { g.heal(0.5); }
    // fire
    const drug = g.currentDrug();
    if (drug && !g.lockPlayer) {
      if (drug.proj.type === 'charge') {
        if (inp.held('fire')) { this.charging = true; this.charge = Math.min(1, this.charge + 1 / 50); if (g.frame % 10 === 0 && this.charge < 1) g.audio.sfx('charge', { level: this.charge }); }
        else if (this.charging) { this.fire(drug, this.charge); this.charging = false; this.charge = 0; }
      } else if (inp.held('fire') && this.cool === 0) this.fire(drug, 0);
    } else if (!drug && inp.pressed('fire') && !g.lockPlayer) { g.toast('No antibiotic yet! Find Professor Fleming.'); }
    // tool
    if (inp.pressed('tool') && !g.lockPlayer) g.useTool();
  }
  move(dx, dy) {
    const r = this.g.room;
    // X
    if (dx !== 0) {
      const nx = this.x + dx;
      if (r.rectFree(nx, this.y, this.w, this.h)) this.x = nx;
      else { // slide: try nudging vertically a bit for smooth cornering
        const s = Math.sign(dx); let moved = false;
        for (const ny of [this.y - 1, this.y + 1, this.y - 2, this.y + 2]) { if (r.rectFree(this.x + s, ny, this.w, this.h)) { this.y = ny; this.x += s; moved = true; break; } }
        if (!moved) { let step = Math.abs(dx); while (step > 0.2) { step *= 0.5; if (r.rectFree(this.x + s * step, this.y, this.w, this.h)) { this.x += s * step; break; } } }
      }
    }
    if (dy !== 0) {
      const ny = this.y + dy;
      if (r.rectFree(this.x, ny, this.w, this.h)) this.y = ny;
      else {
        const s = Math.sign(dy); let moved = false;
        for (const nx of [this.x - 1, this.x + 1, this.x - 2, this.x + 2]) { if (r.rectFree(nx, this.y + s, this.w, this.h)) { this.x = nx; this.y += s; moved = true; break; } }
        if (!moved) { let step = Math.abs(dy); while (step > 0.2) { step *= 0.5; if (r.rectFree(this.x, this.y + s * step, this.w, this.h)) { this.y += s * step; break; } } }
      }
    }
    this.x = clamp(this.x, -6, PW - this.w + 6); this.y = clamp(this.y, -6, PH - this.h + 6);
  }
  fire(drug, charge) {
    const g = this.g;
    if (!g.canFire(drug)) return;
    const p = drug.proj;
    this.cool = p.rate; this.fireAnim = 8;
    const [fx, fy] = [[0, 1], [-1, 0], [0, -1], [1, 0]][this.facing];
    // 8-dir aiming if moving diagonally
    let ax = fx, ay = fy;
    const [mx, my] = g.input.moveVec();
    if (mx && my) { ax = Math.sign(mx); ay = Math.sign(my); }
    const l = Math.hypot(ax, ay); ax /= l; ay /= l;
    const ox = this.cx + ax * 7, oy = this.cy + ay * 7;
    const mk = (extra = {}) => g.spawnProjectile(new Projectile(g, { x: ox, y: oy, vx: ax * p.speed, vy: ay * p.speed, drug, owner: 'player', ...extra }));
    switch (p.type) {
      case 'twin': { const px = -ay * 3, py = ax * 3; mk({ x: ox + px, y: oy + py }); mk({ x: ox - px, y: oy - py }); break; }
      case 'spray': { const n = p.pellets || 3; for (let i = 0; i < n; i++) { const a = Math.atan2(ay, ax) + (i - (n - 1) / 2) * 0.28; mk({ vx: Math.cos(a) * p.speed, vy: Math.sin(a) * p.speed, life: Math.round(p.range / p.speed) }); } break; }
      case 'charge': { const lvl = charge; mk({ dmgMult: 1 + lvl * ((p.maxDmg / p.dmg) - 1), size: 3 + lvl * 4, charge: lvl }); break; }
      default: mk();
    }
    g.audio.sfx({ bolt: 'shoot', heavy: 'shootHeavy', pierce: 'shootPierce', stun: 'shootStun', aoe: 'shootAoe', chain: 'shootChain', twin: 'shoot', beam: 'shootBeam', spray: 'shootSpray', charge: 'shootHeavy', homing: 'shootBeam' }[p.type] || 'shoot');
    g.onFire(drug);
  }
  hurt(dmg, src, opts = {}) {
    const g = this.g;
    if (this.inv > 0 || this.dead || g.godMode) return false;
    g.hp = Math.max(0, g.hp - dmg); this.inv = 60;
    g.audio.sfx('hurt'); g.shake(4); g.flashScreen('rgba(255,0,0,0.25)');
    if (src) { const a = angleTo(src.x ?? src.cx, src.y ?? src.cy, this.cx, this.cy); this.kbx = Math.cos(a) * 3.2; this.kby = Math.sin(a) * 3.2; }
    if (g.hp <= 0) { this.dead = true; g.gameOver(); }
    return true;
  }
  draw(c) {
    const g = this.g;
    if (this.inv > 0 && Math.floor(g.frame / 3) % 2 === 0 && !this.dead) return;
    const frames = HERO[this.facing];
    const f = this.moving ? Math.floor(this.walkT) % 4 : 0;
    const spr = frames[f];
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(this.cx, this.y + this.h + 1, 6, 2, 0, 0, TAU); c.fill();
    c.drawImage(spr, Math.round(this.x - 2), Math.round(this.y - 4));
    // syringe when firing / charging
    const drug = g.currentDrug();
    if ((this.fireAnim > 0 || this.charging) && drug) {
      const [fx, fy] = [[0, 1], [-1, 0], [0, -1], [1, 0]][this.facing];
      c.save(); c.translate(Math.round(this.cx + fx * 8), Math.round(this.cy + fy * 8)); c.rotate(Math.atan2(fy, fx));
      c.fillStyle = '#dee2e6'; c.fillRect(-2, -2, 6, 4); c.fillStyle = drug.color; c.fillRect(-1, -1, 3, 2); c.fillStyle = '#adb5bd'; c.fillRect(4, -0.5, 4, 1);
      if (this.charging) { c.fillStyle = rgba(drug.color, 0.5 + this.charge * 0.5); c.beginPath(); c.arc(8, 0, 2 + this.charge * 5, 0, TAU); c.fill(); }
      c.restore();
    }
    if (this.toolAnim > 0) {
      const [fx, fy] = [[0, 1], [-1, 0], [0, -1], [1, 0]][this.facing];
      c.save(); c.translate(Math.round(this.cx + fx * 10), Math.round(this.cy + fy * 10)); c.rotate(Math.atan2(fy, fx) + (this.toolAnim / 12 - 0.5) * 2);
      c.fillStyle = '#e9ecef'; c.fillRect(0, -1, 10, 2); c.fillStyle = '#343a40'; c.fillRect(-4, -1.5, 4, 3); c.restore();
    }
  }
}

// ---------------------------------------------------------------------------
export class Projectile {
  constructor(g, o) {
    this.g = g; Object.assign(this, { x: 0, y: 0, vx: 0, vy: 0, owner: 'player', drug: null, kind: 'bolt', dmgMult: 1, size: 3, life: 0, dead: false, hitSet: new Set(), color: '#fff', t: 0, charge: 0 }, o);
    if (this.drug) { this.kind = this.drug.proj.type; this.color = this.drug.color; if (!this.life) this.life = Math.round(this.drug.proj.range / this.drug.proj.speed); if (this.kind === 'heavy' || this.kind === 'charge') this.size = Math.max(this.size, this.drug.proj.size || 5); if (this.kind === 'beam') this.size = (this.drug.proj.width || 8) / 2; }
    this.trail = [];
  }
  update() {
    const g = this.g; this.t++;
    if (this.kind === 'homing' && this.owner === 'player') {
      let best = null, bd = 80; for (const e of g.enemies) { if (e.dead || e.untargetable) continue; const d = dist(this.x, this.y, e.cx, e.cy); if (d < bd) { bd = d; best = e; } }
      if (best) { const a = angleTo(this.x, this.y, best.cx, best.cy); const sp = Math.hypot(this.vx, this.vy); const ca = Math.atan2(this.vy, this.vx); let da = a - ca; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; const na = ca + clamp(da, -0.12, 0.12); this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp; }
    }
    this.trail.push([this.x, this.y]); if (this.trail.length > 5) this.trail.shift();
    this.x += this.vx; this.y += this.vy;
    if (--this.life <= 0) { this.dead = true; if (this.kind === 'aoe') this.explode(); return; }
    // walls
    const solid = g.room.solidAt(this.x, this.y);
    if (solid || this.x < 0 || this.y < 0 || this.x > PW || this.y > PH) {
      const tt = g.room.typeAtPx(this.x, this.y);
      if (this.owner === 'player' && (tt === T.ABSCESS || tt === T.BIOFILM)) { g.addText(this.x, this.y - 6, tt === T.ABSCESS ? 'ABSCESS — drugs can’t penetrate pus. Drain it!' : 'BIOFILM — needs debridement (scalpel)', '#ffd166', { small: true }); }
      this.dead = true; if (this.kind === 'aoe') this.explode(); g.addParticles(this.x, this.y, this.color, 4, { speed: 1.2, life: 14 });
      if (this.kind === 'heavy' || this.kind === 'charge') g.audio.sfx('hit');
      return;
    }
    // collisions
    if (this.owner === 'player') {
      for (const e of g.enemies) {
        if (e.dead || this.hitSet.has(e)) continue;
        const r = e.size / 2 + this.size;
        if (dist(this.x, this.y, e.cx, e.cy) < r) {
          this.hitSet.add(e);
          if (this.kind === 'aoe') { this.explode(); this.dead = true; return; }
          e.hitBy(this);
          if (this.kind === 'chain') this.chain(e);
          if (this.kind !== 'pierce' && this.kind !== 'beam') { this.dead = true; return; }
        }
      }
    } else {
      const p = g.player;
      if (!p.dead && dist(this.x, this.y, p.cx, p.cy) < this.size + 5) { p.hurt(this.dmg || 0.5, this); this.dead = true; g.addParticles(this.x, this.y, this.color, 6, { speed: 1.5 }); }
    }
  }
  explode() {
    const g = this.g, R = this.drug?.proj.radius || 20;
    g.addParticles(this.x, this.y, this.color, 16, { speed: 2.2, life: 22 });
    g.addRing(this.x, this.y, R, this.color);
    g.audio.sfx('hitBig');
    for (const e of g.enemies) { if (e.dead) continue; if (dist(this.x, this.y, e.cx, e.cy) < R + e.size / 2) e.hitBy(this, true); }
  }
  chain(from) {
    const g = this.g, p = this.drug.proj; let cur = from; const hit = new Set([from]);
    for (let j = 0; j < (p.jumps || 2); j++) {
      let best = null, bd = p.jumpRange || 40;
      for (const e of g.enemies) { if (e.dead || hit.has(e)) continue; const d = dist(cur.cx, cur.cy, e.cx, e.cy); if (d < bd) { bd = d; best = e; } }
      if (!best) break;
      hit.add(best); g.addBolt(cur.cx, cur.cy, best.cx, best.cy, this.color); best.hitBy(this, true); cur = best;
    }
  }
  draw(c) {
    c.save();
    const col = this.color;
    if (this.owner === 'player') {
      // trail
      for (let i = 0; i < this.trail.length; i++) { const [tx, ty] = this.trail[i]; c.fillStyle = rgba(col, (i + 1) / this.trail.length * 0.35); c.beginPath(); c.arc(tx, ty, Math.max(1, this.size * (i + 1) / this.trail.length * 0.8), 0, TAU); c.fill(); }
      switch (this.kind) {
        case 'beam': { const a = Math.atan2(this.vy, this.vx); c.translate(this.x, this.y); c.rotate(a); c.fillStyle = rgba(col, 0.45); c.fillRect(-10, -this.size, 14, this.size * 2); c.fillStyle = col; c.fillRect(-8, -this.size + 2, 12, this.size * 2 - 4); c.fillStyle = '#fff'; c.fillRect(-4, -1, 6, 2); break; }
        case 'pierce': { const a = Math.atan2(this.vy, this.vx); c.translate(this.x, this.y); c.rotate(a); c.fillStyle = col; c.fillRect(-7, -1.5, 12, 3); c.fillStyle = '#fff'; c.fillRect(0, -0.5, 5, 1); break; }
        case 'heavy': case 'charge': { c.fillStyle = rgba(col, 0.35); c.beginPath(); c.arc(this.x, this.y, this.size + 2, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(this.x, this.y, this.size, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(this.x - 1, this.y - 1, Math.max(1, this.size * 0.35), 0, TAU); c.fill(); break; }
        case 'stun': { c.fillStyle = col; c.beginPath(); c.arc(this.x, this.y, 3, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.arc(this.x, this.y, 4.5, this.t * 0.3, this.t * 0.3 + 3); c.stroke(); break; }
        case 'aoe': { c.fillStyle = col; c.beginPath(); c.arc(this.x, this.y, 4, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(this.x - 1, this.y - 1, 2, 2); const s = 1 + Math.sin(this.t * 0.5) * 0.5; c.strokeStyle = rgba(col, 0.6); c.beginPath(); c.arc(this.x, this.y, 5 + s, 0, TAU); c.stroke(); break; }
        case 'chain': { c.fillStyle = '#fff'; c.beginPath(); c.arc(this.x, this.y, 2.5, 0, TAU); c.fill(); c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(this.x - 4, this.y - 3); c.lineTo(this.x - 1, this.y); c.lineTo(this.x - 3, this.y + 3); c.lineTo(this.x + 3, this.y - 1); c.stroke(); break; }
        case 'spray': { c.fillStyle = col; c.beginPath(); c.arc(this.x, this.y, 2, 0, TAU); c.fill(); break; }
        case 'homing': { c.fillStyle = col; c.beginPath(); c.arc(this.x, this.y, 3.5, 0, TAU); c.fill(); c.strokeStyle = '#ffd166'; c.beginPath(); c.arc(this.x, this.y, 5.5, this.t * 0.4, this.t * 0.4 + 2); c.stroke(); break; }
        default: { c.fillStyle = col; c.beginPath(); c.arc(this.x, this.y, 3, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(this.x - 1, this.y - 1, 1.5, 1.5); }
      }
    } else {
      // enemy shots
      switch (this.kind) {
        case 'stone': c.fillStyle = '#9c9a8a'; c.beginPath(); c.arc(this.x, this.y, 3.5, 0, TAU); c.fill(); c.fillStyle = '#d6d3c4'; c.fillRect(this.x - 1, this.y - 2, 2, 1); break;
        case 'spore': c.fillStyle = '#495057'; c.beginPath(); c.ellipse(this.x, this.y, 3, 2, this.t * 0.2, 0, TAU); c.fill(); break;
        default: c.fillStyle = rgba(col, 0.4); c.beginPath(); c.arc(this.x, this.y, 4.5, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(this.x, this.y, 2.5, 0, TAU); c.fill();
      }
    }
    c.restore();
  }
}

// ---------------------------------------------------------------------------
export class Enemy {
  constructor(g, bugId, x, y, o = {}) {
    this.g = g; this.bug = BUG_BY_ID[bugId]; this.bugId = bugId;
    const b = this.bug;
    this.x = x; this.y = y; this.size = o.size || b.size; this.w = this.size; this.h = this.size;
    this.scale = o.scale || 1;
    this.hpMax = Math.round((o.hp || b.hp) * (g.difficultyMult || 1)); this.hp = this.hpMax;
    this.speed = (o.speed ?? b.speed); this.ai = o.ai || b.ai; this.dmg = o.dmg ?? b.dmg;
    this.resist = [...(o.resist || b.resist)]; this.traits = [...(o.traits || b.traits)];
    this.vis = Object.assign({}, b.vis, o.vis || {});
    this.angle = rand(0, TAU); this.vx = 0; this.vy = 0; this.dirT = 0; this.state = 'wander'; this.stateT = 0;
    this.flash = 0; this.stasis = 0; this.kbx = 0; this.kby = 0; this.dead = false; this.seed = Math.random() * 100;
    this.capsule = this.traits.includes('capsule') ? 1 : 0; this.toxinT = randInt(90, 200); this.toxinSuppressed = 0;
    this.replT = randInt(400, 700); this.slimeT = randInt(60, 140); this.hiding = this.ai === 'hider'; this.hideT = randInt(60, 180);
    this.lastDrug = null; this.sameDrugCount = 0; this.ampcHits = 0; this.lastWallHit = -999; this.flying = this.ai === 'hover'; this.dot = 0; this.dotT = 0;
    this.isVirus = this.traits.includes('virus'); this.lifeT = this.isVirus ? 60 * 22 : 0; this.untargetable = this.isVirus;
    this.telegraph = 0; this.spawnT = 0; this.boss = o.boss || null; this.name = o.name || b.name; this.drops = o.drops; this.flagOnDeath = o.flag; this.minion = !!o.minion;
    this.generation = o.generation || 0; this.noDrops = !!o.noDrops; this.dormant = this.resist.includes('ampc_ind'); this.ignoreShut = !!o.ignoreShut;
    this.shootKind = o.shootKind || (this.traits.includes('urease') ? 'stone' : this.traits.includes('spores') ? 'spore' : 'toxin');
    this.birth = g.frame; this.spawnScale = 0.2;
  }
  get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
  update() {
    const g = this.g, p = g.player;
    if (this.spawnScale < 1) this.spawnScale = Math.min(1, this.spawnScale + 0.06);
    if (this.flash > 0) this.flash--;
    if (this.toxinSuppressed > 0) this.toxinSuppressed--;
    if (this.telegraph > 0) this.telegraph--;
    if (this.dot > 0 && this.dotT > 0) { this.dotT--; if (this.dotT % 20 === 0) this.takeDamage(this.dot, null, 'PAE'); }
    if (this.lifeT > 0) { this.lifeT--; if (this.lifeT === 0) { g.addText(this.cx, this.y - 8, 'SELF-LIMITED — it faded on its own', '#caf0f8'); this.die(true); return; } }
    // stasis (bacteriostatic): frozen, does not act; recovers without immune finishing
    if (this.stasis > 0) {
      this.stasis--;
      if (this.stasis === 0) { if (g.room.env.neutropenic || g.room.env.endocarditis) { g.addText(this.cx, this.y - 8, g.room.env.neutropenic ? 'RECOVERED — no neutrophils to finish it' : 'RECOVERED — vegetation shields it', '#ffd166'); this.hp = Math.min(this.hpMax, this.hp + 1); } }
      this.applyKnockback(); return;
    }
    const d = dist(this.cx, this.cy, p.cx, p.cy);
    const toP = angleTo(this.cx, this.cy, p.cx, p.cy);
    const sp = this.speed * (g.slimeAt(this.cx, this.cy) && !this.traits.includes('biofilm') ? 0.7 : 1);
    this.stateT++;
    switch (this.ai) {
      case 'wander': this.wander(sp); break;
      case 'chase': if (d < 110 && this.stateT > 20) { this.vx = Math.cos(toP) * sp; this.vy = Math.sin(toP) * sp; this.angle = toP; this.jitter(); } else this.wander(sp); break;
      case 'bounce': { if (this.vx === 0 && this.vy === 0) { this.vx = Math.cos(this.angle) * sp; this.vy = Math.sin(this.angle) * sp; } const s = Math.hypot(this.vx, this.vy) || sp; this.vx = this.vx / s * sp; this.vy = this.vy / s * sp; break; }
      case 'dash': {
        if (this.state === 'dash') { if (this.stateT > 26) { this.state = 'wander'; this.stateT = 0; this.vx *= 0.3; this.vy *= 0.3; } }
        else if (this.state === 'tele') { this.vx = 0; this.vy = 0; if (this.stateT > 22) { this.state = 'dash'; this.stateT = 0; this.vx = Math.cos(toP) * sp * 3.2; this.vy = Math.sin(toP) * sp * 3.2; this.angle = toP; g.audio.sfx('toxin'); } }
        else { this.wander(sp); if (d < 120 && this.stateT > randInt(90, 160)) { this.state = 'tele'; this.stateT = 0; this.telegraph = 22; } }
        break;
      }
      case 'swarm': this.wander(sp); this.replicate(); break;
      case 'spiral': { const a = toP + Math.sin(this.stateT * 0.15) * 1.2; this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp; this.angle = a; break; }
      case 'hover': { const a = toP + Math.sin(this.stateT * 0.05 + this.seed) * 0.8; this.vx += (Math.cos(a) * sp * 0.6 - this.vx) * 0.05; this.vy += (Math.sin(a) * sp * 0.6 - this.vy) * 0.05; break; }
      case 'turret': { if (this.stateT % 90 < 30) this.wander(sp * 0.6); else { this.vx = 0; this.vy = 0; } break; }
      case 'hider': {
        if (this.hiding) { this.vx = 0; this.vy = 0; if (--this.hideT <= 0) { this.hiding = false; this.hideT = randInt(80, 150); } }
        else { this.vx = Math.cos(toP) * sp * 1.6; this.vy = Math.sin(toP) * sp * 1.6; this.angle = toP; if (--this.hideT <= 0) { this.hiding = true; this.hideT = randInt(100, 200); } }
        break;
      }
      case 'jelly': { this.wander(sp); if (this.traits.includes('biofilm') && --this.slimeT <= 0) { this.slimeT = randInt(90, 160); g.addSlime(this.cx, this.cy + 4); } break; }
      case 'boss': this.bossUpdate(d, toP, sp); break;
      default: this.wander(sp);
    }
    // toxin shooting
    if ((this.traits.includes('toxin') || this.ai === 'turret' || this.traits.includes('urease')) && this.toxinSuppressed === 0 && !this.hiding) {
      if (--this.toxinT <= 0 && d < 150 && !this.boss) {
        this.toxinT = randInt(150, 260); this.shoot(toP);
      }
    }
    // move
    this.applyKnockback();
    this.moveWith(this.vx + this.kbx, this.vy + this.kby);
    // contact damage
    if (!p.dead && p.inv === 0 && dist(this.cx, this.cy, p.cx, p.cy) < this.size / 2 + 5 && this.spawnScale >= 1) { if (p.hurt(this.dmg, this)) { if (this.isVirus) g.addText(p.cx, p.y - 10, 'Sniffles…', '#caf0f8'); } }
  }
  jitter() { if (this.stateT % 30 === 0) { const a = Math.atan2(this.vy, this.vx) + rand(-0.6, 0.6); const s = Math.hypot(this.vx, this.vy); this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s; } }
  wander(sp) {
    if (--this.dirT <= 0) { this.dirT = randInt(40, 100); if (Math.random() < 0.25) { this.vx = 0; this.vy = 0; } else { this.angle = rand(0, TAU); this.vx = Math.cos(this.angle) * sp; this.vy = Math.sin(this.angle) * sp; } }
  }
  applyKnockback() { this.kbx *= 0.8; this.kby *= 0.8; if (Math.abs(this.kbx) < 0.05) this.kbx = 0; if (Math.abs(this.kby) < 0.05) this.kby = 0; if (this.kbx || this.kby) this.moveWith(this.kbx, this.kby, true); }
  moveWith(dx, dy, kbOnly = false) {
    if (kbOnly) { dx = 0; dy = 0; } // knockback applied by caller through vx path; kept simple
    const r = this.g.room, opts = { flying: this.flying };
    const hs = this.w * 0.7, off = (this.w - hs) / 2;
    if (dx) { const nx = this.x + dx; if (r.rectFree(nx + off, this.y + off, hs, hs, opts)) this.x = nx; else { this.vx = -this.vx; this.angle = Math.atan2(this.vy, this.vx); this.dirT = Math.min(this.dirT, 10); if (this.state === 'dash') { this.state = 'wander'; this.stateT = 0; } } }
    if (dy) { const ny = this.y + dy; if (r.rectFree(this.x + off, ny + off, hs, hs, opts)) this.y = ny; else { this.vy = -this.vy; this.angle = Math.atan2(this.vy, this.vx); this.dirT = Math.min(this.dirT, 10); if (this.state === 'dash') { this.state = 'wander'; this.stateT = 0; } } }
    this.x = clamp(this.x, TILE - 2, PW - TILE - this.w + 2); this.y = clamp(this.y, TILE - 2, PH - TILE - this.h + 2);
    if (Math.abs(this.vx) + Math.abs(this.vy) > 0.05) this.angle = Math.atan2(this.vy, this.vx);
  }
  shoot(a, kind) {
    const g = this.g; kind = kind || this.shootKind;
    const sp = kind === 'stone' ? 1.6 : 1.3;
    g.spawnProjectile(new Projectile(g, { x: this.cx, y: this.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, owner: 'enemy', kind, color: kind === 'toxin' ? '#ff4d6d' : '#adb5bd', size: 3, dmg: 0.5, life: 120 }));
    g.audio.sfx(kind === 'spore' ? 'spore' : 'toxin');
    if (kind === 'toxin' && Math.random() < 0.3) g.addText(this.cx, this.y - 8, 'TOXIN!', '#ff4d6d', { small: true });
  }
  replicate() {
    const g = this.g;
    if (--this.replT > 0) return;
    this.replT = randInt(420, 720);
    const same = g.enemies.filter((e) => !e.dead && e.bugId === this.bugId).length;
    if (same >= (g.room.env.swarmCap || 6) || this.generation >= 3) return;
    const e = new Enemy(g, this.bugId, this.x + rand(-8, 8), this.y + rand(-8, 8), { generation: this.generation + 1, noDrops: true });
    e.resist = [...this.resist]; g.enemies.push(e);
    g.addText(this.cx, this.y - 10, 'DIVIDING ×2', '#ffd166', { small: true }); g.addParticles(this.cx, this.cy, this.vis.color, 6, { speed: 1 });
  }
  /** A projectile (or area) hits this enemy */
  hitBy(proj, area = false) {
    const g = this.g, drug = proj.drug;
    if (!drug) return;
    if (this.isVirus) { g.addText(this.cx, this.y - 10, 'VIRUS — antibiotics do nothing!', '#caf0f8'); g.microbiomeHit(0.6, drug); g.audio.sfx('immune'); g.recordAntibiogram(drug.id, this.bugId, 'X'); return; }
    if (this.hiding && !drug.flags?.intracellular) { g.addText(this.cx, this.y - 10, 'HIDING in host cell', '#ffd166'); g.audio.sfx('resist'); return; }
    const env = Object.assign({}, g.room.env);
    const synergy = drug.flags?.synergy && (g.frame - this.lastWallHit) < 240;
    // Aztreonam shielded by recent ceftazidime-avibactam survives serine β-lactamases (the real NDM combo)
    let resist = this.resist;
    if (drug.id === 'aztreonam' && g.avibactamActive?.()) {
      resist = resist.filter((m) => !['esbl', 'ampc', 'kpc', 'oxa48', 'shv'].includes(m));
      if (Math.random() < 0.25) g.addText(this.cx, this.y - 16, 'AVIBACTAM shields aztreonam', '#20c997', { small: true });
    }
    const res = resolve(drug, this.bug, { resist, env, synergy });
    g.recordAntibiogram(drug.id, this.bugId, res.mult >= 0.8 ? 'S' : res.mult >= 0.3 ? 'I' : res.mult > 0 ? 'R' : 'X');
    if (res.mult <= 0) {
      g.addText(this.cx, this.y - 10, res.reason || 'RESISTANT', res.kind === 'env' ? '#90e0ef' : '#ff6b6b');
      g.audio.sfx(res.kind === 'blocked' ? 'resist' : 'immune'); g.addParticles(proj.x, proj.y, '#888', 4, { speed: 1 });
      if (res.kind === 'blocked' && this.vis.aura) g.addRing(this.cx, this.cy, this.size, this.vis.aura);
      return;
    }
    let dmg = drug.proj.dmg * res.mult * (proj.dmgMult || 1);
    // RIPE combination bonus: cycling ≥3 TB drugs within 6 s hits much harder and suppresses mutation
    let tbCombo = 0;
    if (drug.flags?.tbCombo || drug.id === 'rifampin') {
      tbCombo = g.tbComboCount?.() || 0;
      if (tbCombo >= 3) { dmg *= 1 + (tbCombo - 2) * 0.9; if (Math.random() < 0.2) g.addText(this.cx, this.y - 16, `COMBINATION ×${tbCombo}`, '#ffd166', { small: true }); }
    }
    if (area) dmg *= 0.8;
    if (drug.proj.biofilmBonus && this.traits.includes('biofilm')) dmg *= drug.proj.biofilmBonus;
    if (g.slimeAt(this.cx, this.cy) && !drug.proj.biofilmBonus) { dmg *= 0.5; if (Math.random() < 0.3) g.addText(this.cx, this.y - 10, 'BIOFILM ×½', '#80ffdb', { small: true }); }
    if (res.reason && (res.kind === 'partial' || synergy)) { g.addText(this.cx, this.y - 10, res.reason, synergy ? '#ffd166' : '#ffb347', { small: !synergy }); if (synergy) g.audio.sfx('synergy'); }
    // capsule absorbs the first hit
    if (this.capsule > 0 && !this.boss) { this.capsule = 0; g.addText(this.cx, this.y - 10, 'CAPSULE cracked', '#fff', { small: true }); g.addRing(this.cx, this.cy, this.size * 0.8, '#fff'); g.audio.sfx('hit'); this.flash = 6; return; }
    // dynamic resistance: inducible AmpC
    if (this.resist.includes('ampc_ind') && ((drug.cls === 'cephalosporin' && (drug.gen || 0) <= 3) || drug.id === 'amoxclav' || drug.id === 'piptazo' || drug.id === 'ampicillin')) {
      this.ampcHits++; if (this.ampcHits >= 2) { this.resist = this.resist.filter((m) => m !== 'ampc_ind'); this.resist.push('ampc'); this.dormant = false; this.vis = Object.assign({}, this.vis, { aura: '#ff9f1c', armor: true }); g.addText(this.cx, this.y - 14, 'AmpC INDUCED — now resistant!', '#ff9f1c'); g.audio.sfx('mutate'); g.onMutation(this, 'ampc'); }
    }
    // mutation under monotherapy (rifampin, TB drugs)
    if (drug.proj.mutates && tbCombo < 3) {
      if (this.lastDrug === drug.id) this.sameDrugCount++; else { this.lastDrug = drug.id; this.sameDrugCount = 1; }
      if (this.sameDrugCount >= 3) {
        const mech = { rifampin: 'rpoB', isoniazid: 'katG', pyrazinamide: 'pncA', ethambutol: 'embB' }[drug.id];
        if (mech && !this.resist.includes(mech)) { this.resist.push(mech); g.addText(this.cx, this.y - 14, `MUTATION: ${mech} — monotherapy bred resistance!`, '#ff4d6d'); g.audio.sfx('mutate'); this.vis = Object.assign({}, this.vis, { spikes: true }); g.onMutation(this, mech); }
      }
    } else { this.lastDrug = drug.id; this.sameDrugCount = 0; }
    if (drug.target === 'wall') this.lastWallHit = g.frame;
    if (drug.proj.toxinSuppress) { this.toxinSuppressed = 600; if (this.traits.includes('toxin')) g.addText(this.cx, this.y - 16, 'TOXIN production OFF', '#caf0f8', { small: true }); }
    if (drug.proj.dot) { this.dot = dmg * 0.25; this.dotT = drug.proj.dot; }
    // bacteriostatic
    const isStatic = drug.kill === 'static' && !(drug.flags?.staticVs || []).some((t) => this.bug.tags.includes(t));
    this.takeDamage(dmg, drug, null, isStatic, proj);
  }
  takeDamage(dmg, drug, label, isStatic = false, proj = null) {
    const g = this.g;
    if (this.dead) return;
    this.flash = 6;
    if (proj && proj.vx !== undefined && !this.boss) { const k = (proj.kind === 'heavy' || proj.kind === 'charge') ? 2.5 : 1.2; const a = Math.atan2(proj.vy, proj.vx); this.kbx = Math.cos(a) * k; this.kby = Math.sin(a) * k; }
    if (isStatic) {
      const newHp = Math.max(1, this.hp - dmg);
      this.hp = newHp; this.stasis = Math.max(this.stasis, drug.proj.stasis || 120);
      g.addParticles(this.cx, this.cy, '#90e0ef', 5, { speed: 1 });
      if (this.hp <= 1 && Math.random() < 0.5) g.addText(this.cx, this.y - 10, 'STASIS — immune cells must finish it', '#90e0ef', { small: true });
      g.audio.sfx('hit');
      return;
    }
    this.hp -= dmg;
    g.addParticles(this.cx, this.cy, this.vis.color, 5, { speed: 1.4 });
    if (label === 'PAE' && Math.random() < 0.4) g.addText(this.cx, this.y - 10, 'post-antibiotic effect', '#ffd166', { small: true });
    g.audio.sfx(this.boss ? 'bossHit' : 'hit');
    if (this.hp <= 0) this.die();
  }
  /** Neutrophil companion contact */
  phagocytose(amount) {
    const g = this.g;
    if (this.dead || this.isVirus) return;
    if (this.capsule > 0 || this.traits.includes('capsule')) { if (g.frame % 40 === 0) g.addText(this.cx, this.y - 10, 'CAPSULE — can’t be eaten', '#fff', { small: true }); return; }
    if (this.traits.includes('intracellular') || this.hiding) return;
    if (this.boss) return;
    if (this.stasis > 0) { g.addText(this.cx, this.y - 10, 'PHAGOCYTOSED!', '#caf0f8'); this.die(); return; }
    this.hp -= amount; if (this.hp <= 0) { g.addText(this.cx, this.y - 10, 'PHAGOCYTOSED!', '#caf0f8'); this.die(); }
  }
  die(silent = false) {
    const g = this.g;
    if (this.dead) return; this.dead = true;
    g.addParticles(this.cx, this.cy, this.vis.color, this.boss ? 40 : 12, { speed: this.boss ? 3 : 1.8, life: this.boss ? 40 : 24 });
    if (!silent) g.audio.sfx(this.boss ? 'dieBig' : 'die');
    if (this.traits.includes('lps') && !silent) { g.addRing(this.cx, this.cy, 24, '#ff4d6d'); g.addText(this.cx, this.y - 12, 'LPS ENDOTOXIN released!', '#ff4d6d'); g.audio.sfx('lps'); const p = g.player; if (dist(this.cx, this.cy, p.cx, p.cy) < 26) p.hurt(0.5, this); }
    if (this.traits.includes('spores') && !silent && !this.minion) { for (let i = 0; i < 2; i++) g.addSpore(this.cx + rand(-10, 10), this.cy + rand(-10, 10)); }
    if (this.traits.includes('swarm') && !silent && !this.boss && this.generation < 2 && Math.random() < 0.5) { /* swarm splits handled by replicate */ }
    g.enemyKilled(this, silent);
  }
  // ---- Boss behavior (pattern-driven) ----
  bossUpdate(d, toP, sp) {
    const g = this.g, B = this.boss;
    this.bossT = (this.bossT || 0) + 1;
    const phaseFrac = this.hp / this.hpMax;
    // phase transitions
    for (const ph of B.phases || []) { if (!ph.done && phaseFrac <= ph.at) { ph.done = true; g.bossPhase(this, ph); } }
    if (!this.pattern || this.patT <= 0) {
      const list = this.phasePatterns || B.patterns || ['chase'];
      this.pattern = choice(list); this.patT = randInt(120, 220); this.stateT = 0; this.patInit = true;
    }
    this.patT--;
    const tele = () => { if (this.patInit) { this.telegraph = 25; this.patInit = false; this.vx = 0; this.vy = 0; } return this.telegraph > 0; };
    switch (this.pattern) {
      case 'chase': this.vx = Math.cos(toP) * sp; this.vy = Math.sin(toP) * sp; this.angle = toP; break;
      case 'wander': this.wander(sp); break;
      case 'dash': if (tele()) break; if (this.stateT === 0) { this.dashA = toP; } this.stateT++; if (this.stateT < 30) { this.vx = Math.cos(this.dashA) * sp * 3.5; this.vy = Math.sin(this.dashA) * sp * 3.5; } else { this.patT = 0; this.vx = 0; this.vy = 0; } break;
      case 'ring': if (tele()) break; if (this.stateT === 0) { for (let i = 0; i < 8; i++) this.shoot(i * TAU / 8, B.shootKind || this.shootKind); } this.stateT++; if (this.stateT > 60) this.patT = 0; break;
      case 'aim': if (tele()) break; if (this.stateT % 20 === 0 && this.stateT < 60) this.shoot(toP + rand(-0.2, 0.2), B.shootKind || this.shootKind); this.stateT++; if (this.stateT > 70) this.patT = 0; break;
      case 'spawn': if (tele()) break; if (this.stateT === 0 && B.minion) { const n = B.minion.n || 2; const alive = g.enemies.filter((e) => !e.dead && e.minion).length; if (alive < (B.minion.cap || 4)) { for (let i = 0; i < n; i++) { const a = rand(0, TAU); const e = new Enemy(g, B.minion.bug, this.cx + Math.cos(a) * 22, this.cy + Math.sin(a) * 22, { minion: true, noDrops: true, hp: B.minion.hp }); g.enemies.push(e); } g.addText(this.cx, this.y - 14, B.minion.text || 'SPAWNING!', '#ffd166'); } } this.stateT++; if (this.stateT > 40) this.patT = 0; break;
      case 'slime': if (this.stateT % 15 === 0) g.addSlime(this.cx + rand(-10, 10), this.cy + rand(-6, 10)); this.vx = Math.cos(toP) * sp * 0.7; this.vy = Math.sin(toP) * sp * 0.7; this.stateT++; if (this.stateT > 90) this.patT = 0; break;
      case 'spiral': { const a = toP + Math.sin(this.stateT * 0.1) * 1.3; this.vx = Math.cos(a) * sp * 1.3; this.vy = Math.sin(a) * sp * 1.3; this.angle = a; this.stateT++; break; }
      case 'hide': if (this.patInit) { this.hiding = true; this.patInit = false; this.vx = 0; this.vy = 0; } this.stateT++; if (this.stateT > 120) { this.hiding = false; this.patT = 0; } break;
      case 'teleport': if (this.stateT === 0) { g.addParticles(this.cx, this.cy, this.vis.color, 20, { speed: 2 }); let tries = 0; while (tries++ < 20) { const nx = rand(24, PW - 24 - this.w), ny = rand(24, PH - 24 - this.h); if (g.room.rectFree(nx, ny, this.w, this.h) && dist(nx, ny, g.player.x, g.player.y) > 50) { this.x = nx; this.y = ny; break; } } g.addParticles(this.cx, this.cy, '#fff', 20, { speed: 2 }); g.audio.sfx('stairs'); } this.stateT++; if (this.stateT > 30) this.patT = 0; break;
      default: this.wander(sp);
    }
    // boss regenerates capsule periodically
    if (B.capsuleRegen && this.bossT % B.capsuleRegen === 0 && this.capsule === 0) { this.capsule = 1; g.addText(this.cx, this.y - 14, 'CAPSULE regrown', '#fff', { small: true }); }
    if (B.shootEvery && this.bossT % B.shootEvery === 0 && this.toxinSuppressed === 0 && d < 170) this.shoot(toP, B.shootKind || this.shootKind);
  }
  draw(c) {
    const g = this.g;
    const sc = this.spawnScale * this.scale;
    drawBug(c, this.bug, this.cx, this.cy, { t: g.frame, vis: this.vis, angle: this.angle, flash: this.flash > 0, stasis: this.stasis > 0, hiding: this.hiding, dormant: this.dormant, scale: sc, seed: this.seed, size: this.size, boss: !!this.boss });
    if (this.telegraph > 0 && Math.floor(g.frame / 3) % 2 === 0) { c.strokeStyle = '#ff4d6d'; c.lineWidth = 1; c.beginPath(); c.arc(this.cx, this.cy, this.size / 2 * sc + 3, 0, TAU); c.stroke(); }
    if (this.capsule > 0 && !this.traits.includes('capsule')) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(this.cx, this.cy, this.size / 2 * sc + 2, 0, TAU); c.stroke(); }
    // mini HP bar (non-boss) when damaged
    if (!this.boss && this.hp < this.hpMax && !this.isVirus) { const w = Math.max(10, this.size); const x = Math.round(this.cx - w / 2), y = Math.round(this.y - 5 * sc - 2); c.fillStyle = '#000'; c.fillRect(x, y, w, 3); c.fillStyle = this.stasis > 0 ? '#90e0ef' : '#ff4d6d'; c.fillRect(x + 1, y + 1, Math.round((w - 2) * this.hp / this.hpMax), 1); }
    if (g.lensOn) { gtext(c, this.bug.aka || this.bug.name, this.cx, this.y + this.size + 2, { size: 5, align: 'center', color: g.gramColor(this.bug) }); }
  }
}

// ---------------------------------------------------------------------------
export class Pickup {
  constructor(g, type, x, y, o = {}) {
    this.g = g; this.type = type; this.x = x; this.y = y; this.o = o; this.t = rand(0, 100); this.dead = false;
    this.life = o.permanent ? 0 : (o.life || 0); this.magnet = ['heart', 'pearl', 'pearl5', 'dose', 'probiotic'].includes(type);
    this.vx = o.vx || 0; this.vy = o.vy || 0; this.flag = o.flag; this.data = o.data;
  }
  update() {
    const g = this.g, p = g.player; this.t++;
    if (this.vx || this.vy) { this.x += this.vx; this.y += this.vy; this.vx *= 0.85; this.vy *= 0.85; if (Math.abs(this.vx) < 0.05) this.vx = 0; if (Math.abs(this.vy) < 0.05) this.vy = 0; if (g.room.solidAt(this.x, this.y)) { this.x -= this.vx * 2; this.y -= this.vy * 2; this.vx = 0; this.vy = 0; } }
    if (this.life > 0) { this.life--; if (this.life === 0) { this.dead = true; return; } }
    const d = dist(this.x, this.y, p.cx, p.cy);
    if (this.magnet && d < 34) { const a = angleTo(this.x, this.y, p.cx, p.cy); this.x += Math.cos(a) * 2.2; this.y += Math.sin(a) * 2.2; }
    if (d < 9 && !p.dead) { this.dead = true; g.collect(this); }
  }
  draw(c) {
    if (this.life > 0 && this.life < 120 && Math.floor(this.t / 4) % 2 === 0) return;
    const g = this.g;
    // glow for important items
    if (['drug', 'heartContainer', 'heartPiece', 'scalpel', 'lens', 'culture', 'bosskey', 'map', 'compass', 'clavulanate', 'vaccine', 'ripe', 'soap'].includes(this.type)) { c.fillStyle = rgba('#ffd166', 0.18 + 0.1 * Math.sin(this.t * 0.1)); c.beginPath(); c.arc(this.x, this.y, 10, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(this.x, this.y + 6, 4, 1.5, 0, 0, TAU); c.fill();
    drawItemIcon(c, this.type, this.x, this.y, this.t, { color: this.data?.color });
    if (this.type === 'drug' && this.data?.id) { const d = DRUG_BY_ID[this.data.id]; if (d && g.lensOn) gtext(c, d.short, this.x, this.y + 9, { size: 5, align: 'center', color: d.color }); }
  }
}

// ---------------------------------------------------------------------------
export class NPC {
  constructor(g, spec) { this.g = g; this.spec = spec; this.id = spec.id; this.x = spec.x * TILE + 2; this.y = spec.y * TILE + 2; this.w = 12; this.h = 12; this.sprite = NPCS[spec.sprite || spec.id] || NPCS.villager; this.dialog = spec.dialog; this.t = 0; this.near = false; this.solid = true; }
  get cx() { return this.x + 6; } get cy() { return this.y + 6; }
  update() { this.t++; const p = this.g.player; this.near = dist(this.cx, this.cy, p.cx, p.cy) < 22; }
  draw(c) {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(this.cx, this.y + 13, 6, 2, 0, 0, TAU); c.fill();
    const bob = this.near ? 0 : 0;
    c.drawImage(this.sprite, Math.round(this.x - 2), Math.round(this.y - 4 + bob));
    if (this.near && !this.g.dialogOpen) { gtext(c, '!', this.cx - 2, this.y - 14 + Math.sin(this.t * 0.15) * 1.5, { size: 7, color: '#ffd166' }); }
    if (this.spec.label) gtext(c, this.spec.label, this.cx, this.y + 14, { size: 5, align: 'center', color: '#fff' });
  }
}

// ---------------------------------------------------------------------------
export class Companion {
  constructor(g) { this.g = g; this.x = 0; this.y = 0; this.a = 0; this.target = null; this.active = true; this.t = 0; }
  update() {
    const g = this.g, p = g.player; this.t++;
    this.active = !g.room.env.neutropenic && g.hasCompanion;
    if (!this.active) { this.x = p.cx; this.y = p.cy; return; }
    // find a target: stasis enemies first, else nearest non-capsule
    let best = null, bd = 52;
    for (const e of g.enemies) { if (e.dead || e.isVirus || e.boss || e.capsule > 0 || e.traits.includes('capsule') || e.traits.includes('intracellular') || e.hiding) continue; const d = dist(p.cx, p.cy, e.cx, e.cy); const score = e.stasis > 0 ? d - 60 : d; if (score < bd) { bd = score; best = e; } }
    if (best) {
      const a = angleTo(this.x, this.y, best.cx, best.cy); this.x += Math.cos(a) * 1.9; this.y += Math.sin(a) * 1.9;
      if (dist(this.x, this.y, best.cx, best.cy) < best.size / 2 + 4) { best.phagocytose(best.stasis > 0 ? 99 : 0.012); if (this.t % 8 === 0) g.addParticles(this.x, this.y, '#caf0f8', 2, { speed: 0.7, life: 10 }); }
    } else {
      this.a += 0.06; const tx = p.cx + Math.cos(this.a) * 17, ty = p.cy + Math.sin(this.a) * 11 - 4;
      this.x += (tx - this.x) * 0.15; this.y += (ty - this.y) * 0.15;
    }
  }
  draw(c) {
    if (!this.active) return;
    const g = this.g; c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(this.x, this.y + 6, 4, 1.5, 0, 0, TAU); c.fill();
    const bob = Math.sin(this.t * 0.2) * 1;
    c.drawImage(COMPANION, Math.round(this.x - 5), Math.round(this.y - 5 + bob));
  }
}

// ---------------------------------------------------------------------------
export class Particle { constructor(x, y, vx, vy, life, color, size = 1.5) { Object.assign(this, { x, y, vx, vy, life, maxLife: life, color, size }); } update() { this.x += this.vx; this.y += this.vy; this.vx *= 0.92; this.vy *= 0.92; this.life--; } draw(c) { c.globalAlpha = Math.max(0, this.life / this.maxLife); c.fillStyle = this.color; c.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size); c.globalAlpha = 1; } }
export class FloatText { constructor(x, y, str, color, o = {}) { Object.assign(this, { x, y, str, color, life: o.life || (o.small ? 55 : 95), maxLife: 0, small: !!o.small, vy: -0.35 }); this.maxLife = this.life; this.x = clamp(x, 40, PW - 40); } update() { this.y += this.vy; this.vy *= 0.97; this.life--; } draw(c) { const a = this.life < 20 ? this.life / 20 : 1; c.globalAlpha = a; const size = this.small ? 5 : 6; let str = this.str; if (str.length > 34 && !this.small) { /* wrap into two lines */ const i = str.lastIndexOf(' ', 34); if (i > 0) { gtext(c, str.slice(0, i), this.x, this.y - 7, { size, align: 'center', color: this.color }); str = str.slice(i + 1); } } gtext(c, str, this.x, this.y, { size, align: 'center', color: this.color }); c.globalAlpha = 1; } }
export class Ring { constructor(x, y, r, color) { Object.assign(this, { x, y, r, color, life: 18, maxLife: 18 }); } update() { this.life--; } draw(c) { const f = 1 - this.life / this.maxLife; c.globalAlpha = 1 - f; c.strokeStyle = this.color; c.lineWidth = 2; c.beginPath(); c.arc(this.x, this.y, this.r * (0.3 + 0.7 * f), 0, TAU); c.stroke(); c.globalAlpha = 1; } }
export class Bolt { constructor(x1, y1, x2, y2, color) { Object.assign(this, { x1, y1, x2, y2, color, life: 10 }); this.pts = []; const n = 5; for (let i = 0; i <= n; i++) { const t = i / n; this.pts.push([x1 + (x2 - x1) * t + (i && i < n ? rand(-4, 4) : 0), y1 + (y2 - y1) * t + (i && i < n ? rand(-4, 4) : 0)]); } } update() { this.life--; } draw(c) { c.globalAlpha = this.life / 10; c.strokeStyle = this.color; c.lineWidth = 2; c.beginPath(); this.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); c.globalAlpha = 1; } }
export class Slime { constructor(x, y) { this.x = x; this.y = y; this.r = 11; this.life = 60 * 14; this.t = rand(0, 9); } update() { this.life--; this.t++; } draw(c) { const a = Math.min(1, this.life / 90) * 0.55; c.fillStyle = rgba('#2ec4b6', a); c.beginPath(); c.ellipse(this.x, this.y, this.r, this.r * 0.6, 0, 0, TAU); c.fill(); c.fillStyle = rgba('#80ffdb', a); c.fillRect(this.x - 3 + Math.sin(this.t * 0.1) * 2, this.y - 2, 2, 1); c.fillRect(this.x + 3, this.y + 1, 2, 1); } contains(x, y) { const dx = (x - this.x) / this.r, dy = (y - this.y) / (this.r * 0.6); return dx * dx + dy * dy < 1; } }
export class Spore { constructor(g, x, y) { this.g = g; this.x = x; this.y = y; this.t = 0; this.hatch = 60 * 9; this.dead = false; } update() { this.t++; const p = this.g.player; if (dist(this.x, this.y, p.cx, p.cy) < 7 && p.inv === 0) { p.hurt(0.5, this); this.g.addText(p.cx, p.y - 10, 'SPORES — wash with soap & water', '#adb5bd', { small: true }); } if (--this.hatch <= 0) { this.dead = true; const e = new Enemy(this.g, 'cdiff', this.x - 6, this.y - 6, { noDrops: true, minion: true }); this.g.enemies.push(e); this.g.addText(this.x, this.y - 10, 'SPORE germinated!', '#adb5bd', { small: true }); } } draw(c) { c.fillStyle = '#495057'; c.beginPath(); c.ellipse(this.x, this.y, 3, 2, this.t * 0.05, 0, TAU); c.fill(); c.fillStyle = '#adb5bd'; c.fillRect(this.x - 1, this.y - 1, 1, 1); if (this.hatch < 120 && Math.floor(this.t / 6) % 2 === 0) { c.strokeStyle = '#adb5bd'; c.beginPath(); c.arc(this.x, this.y, 5, 0, TAU); c.stroke(); } } }
