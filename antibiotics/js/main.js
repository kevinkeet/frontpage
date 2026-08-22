// ============================================================================
// ANTIBIOTIC QUEST — main game orchestrator
// ============================================================================
import { TILE, ROOM_W, ROOM_H, HUD_H, VIEW_W, VIEW_H, PLAY_Y, SAVE_KEY, SETTINGS_KEY, VERSION } from './const.js';
import { Input, createTouchControls } from './input.js';
import { AudioSys, SONGS } from './audio.js';
import { World, DIRS, OPP, exitTiles } from './world.js';
import { WORLD } from './data/world.js';
import { Player, Enemy, Projectile, Pickup, NPC, Companion, Particle, FloatText, Ring, Bolt, Slime, Spore } from './entities.js';
import { UI } from './ui.js';
import { DRUGS, DRUG_BY_ID, microbiomeCost, TARGETS } from './data/drugs.js';
import { BUGS, BUG_BY_ID, GRAM } from './data/bugs.js';
import { DIALOGS } from './data/dialog.js';
import { BOSSES } from './data/bosses.js';
import { QUIZZES } from './data/quiz.js';
import { SITES, SITE_BY_ID, SITE_BRIEFS } from './data/sites.js';
import { text, drawHeart, bar, drawItemIcon, drawTargetIcon, THEMES, T, mkCanvas, rgba } from './gfx.js';
import { clamp, dist, TAU, rand, randInt, choice, deepClone } from './util.js';

const PW = ROOM_W * TILE, PH = ROOM_H * TILE;
const DIFF_MULT = { Student: 0.75, Resident: 1, Attending: 1.4 };

class Game {
  constructor() {
    this.canvas = document.getElementById('game'); this.ctx = this.canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.stage = document.getElementById('stage'); this.uiRoot = document.getElementById('ui');
    this.input = new Input(); this.audio = new AudioSys(); this.ui = new UI(this, this.uiRoot);
    this.world = new World(WORLD);
    this.settings = Object.assign({ music: 0.5, sfx: 0.8, shake: true, difficulty: 'Resident' }, this.loadJSON(SETTINGS_KEY) || {});
    this.state = 'title'; this.frame = 0; this.shakeT = 0; this.flashCol = null; this.flashT = 0;
    this.resetState();
    this.touch = createTouchControls(this.input, document.body);
    window.addEventListener('resize', () => this.resize()); this.resize();
    const unlock = () => { this.audio.init(); this.applySettings(); }; ['keydown', 'pointerdown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { once: false }));
    document.getElementById('fallback-note')?.classList.add('hidden');
    this.toTitle();
    this.last = performance.now(); this.acc = 0; this.lastRaf = 0;
    requestAnimationFrame((t) => this.loop(t));
    // Fallback ticker: if requestAnimationFrame is starved (hidden/offscreen tab), keep simulating + drawing via timer
    setInterval(() => { const now = performance.now(); if (now - this.lastRaf > 120) this.loop(now, true); }, 1000 / 60);
    window.__abq = this.debugApi();
  }
  // ---------------- setup / state ----------------
  resetState() {
    this.hp = 3; this.maxHp = 3; this.microbiome = 100; this.microRegenT = 0;
    this.inv = { drugs: [], current: null, tools: {}, keys: {}, bossKeys: {}, pearls: 0, doses: {}, potions: 0, heartPieces: 0, maps: {}, compasses: {} };
    this.flags = {}; this.discovered = { bugs: new Set(), drugs: new Set() }; this.antibiogram = {};
    this.stats = { kills: 0, shots: 0, deaths: 0, resistEvents: 0, broadShots: 0, narrowKills: 0, cdiffBlooms: 0, playFrames: 0, bossesBeaten: 0 };
    this.hasCompanion = true; this.lockPlayer = false; this.godMode = false; this.debugAll = false; this.lensOn = false;
    this.enemies = []; this.projectiles = []; this.pickups = []; this.npcs = []; this.particles = []; this.texts = []; this.rings = []; this.bolts = []; this.slimes = []; this.spores = []; this.warps = [];
    this.room = null; this.areaId = null; this.player = new Player(this); this.companion = new Companion(this);
    this.boss = null; this.lastDamageTip = null; this.visited = {};
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    let s = Math.min(w / VIEW_W, h / VIEW_H);
    if (s >= 1) s = Math.floor(s * 2) / 2; // half-integer steps keep pixels mostly crisp
    if (this.touch) s = Math.min(s, (h - 40) / VIEW_H);
    this.scale = Math.max(0.5, s);
    this.stage.style.transform = `scale(${this.scale})`;
    this.stage.style.marginLeft = `${-VIEW_W / 2 * this.scale + 0}px`; // handled by flex center: use translate instead
    this.stage.style.position = 'absolute'; this.stage.style.left = `${(w - VIEW_W * this.scale) / 2}px`; this.stage.style.top = `${(h - VIEW_H * this.scale) / 2}px`; this.stage.style.marginLeft = '0';
  }
  applySettings() { this.audio.setVolumes(this.settings.sfx, this.settings.music); this.difficultyMult = DIFF_MULT[this.settings.difficulty] || 1; this.saveJSON(SETTINGS_KEY, this.settings); }
  loadJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
  saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  hasSave() { return !!this.loadJSON(SAVE_KEY); }
  save(manual = false) {
    if (!this.room) return;
    const s = { version: VERSION, areaId: this.areaId, roomId: this.room.id, x: this.player.x, y: this.player.y, hp: this.hp, maxHp: this.maxHp, microbiome: this.microbiome,
      inv: this.inv, flags: this.flags, discovered: { bugs: [...this.discovered.bugs], drugs: [...this.discovered.drugs] }, antibiogram: this.antibiogram, stats: this.stats, visited: this.visited, hasCompanion: this.hasCompanion, savedAt: Date.now() };
    this.saveJSON(SAVE_KEY, s); if (manual) this.toast('Progress saved.');
  }
  load() {
    const s = this.loadJSON(SAVE_KEY); if (!s) return false;
    this.resetState();
    this.hp = s.hp; this.maxHp = s.maxHp; this.microbiome = s.microbiome ?? 100; this.inv = Object.assign(this.inv, s.inv); this.flags = s.flags || {}; this.stats = Object.assign(this.stats, s.stats || {});
    this.discovered = { bugs: new Set(s.discovered?.bugs || []), drugs: new Set(s.discovered?.drugs || []) }; this.antibiogram = s.antibiogram || {}; this.visited = s.visited || {}; this.hasCompanion = s.hasCompanion !== false;
    this.enterRoom(s.areaId, s.roomId, { x: s.x, y: s.y }, { silent: true });
    return true;
  }
  toTitle() {
    this.state = 'title'; this.ui.closeAll(); this.audio.play('title', SONGS);
    this.ui.title(this.hasSave(), (choice) => {
      if (choice === 'new') { this.newGame(); }
      else if (choice === 'continue') { if (this.load()) { this.state = 'play'; this.ui.banner(this.room.name, 'Welcome back, Doctor.'); } else this.toTitle(); }
      else if (choice === 'codex') { this.debugAllPrev = this.debugAll; this.ui.menu('bugs'); const check = setInterval(() => { if (!this.ui.open) { clearInterval(check); this.toTitle(); } }, 200); }
      else if (choice === 'how') { this.ui.howTo(() => this.toTitle()); }
    });
  }
  newGame() {
    if (location.search.includes('debug')) console.log('newGame called', new Error().stack);
    this.resetState(); this.ui.closeAll(); this.state = 'play';
    const st = WORLD.start; this.enterRoom(st.area, st.room, { x: st.x, y: st.y });
    this.runDialog('intro');
  }
  gameOver() {
    this.state = 'dead'; this.stats.deaths++; this.audio.play('gameover', SONGS); this.audio.sfx('gameover');
    setTimeout(() => { this.ui.gameOver(() => { if (!this.load()) this.newGame(); else { this.hp = Math.max(3, Math.ceil(this.maxHp / 2)); this.state = 'play'; this.player.dead = false; } }); }, 900);
  }
  deathTip() {
    const tips = ['When a shot says RESISTANT, read why — then switch drug. The reason is the answer.', 'Bacteriostatic drugs (doxy, azithro, clinda, linezolid) freeze bugs so your neutrophil can eat them — they won’t finish the job alone in neutropenic rooms.', 'Gram-negatives have an outer membrane: vancomycin, daptomycin, nafcillin and clindamycin can’t get in.', 'Capsules absorb the first hit and block your neutrophil. Hit encapsulated bugs twice.', 'Hold the fire button — time-dependent β-lactams want constant exposure.', 'Your microbiome bar empties with broad-spectrum drugs; C. diff blooms when it hits zero. Use the narrowest drug that works.', 'IV fluids (potions) are in the ITEMS tab of the menu. Pharmacies sell them.', 'Hearts drop from enemies. Heart pieces are hidden in side rooms — four make a container.'];
    return choice(tips);
  }
  // ---------------- rooms ----------------
  enterRoom(areaId, roomId, pos, opts = {}) {
    const area = this.world.areas[areaId]; const room = area?.rooms.get(roomId);
    if (!room) { console.error('No room', areaId, roomId); return; }
    const prevArea = this.areaId; this.areaId = areaId; this.room = room;
    room.build(this.flags); // fresh tiles (doors restore below), flag-dependent layouts
    for (const d of DIRS) if (this.flags[`door_${room.id}_${d}`]) room.openExit(d);
    for (const k of Object.keys(this.flags)) if (k.startsWith(`tile_${room.id}_`)) { const [, , tx, ty] = k.split('_'); room.setTile(+tx, +ty, T.FLOOR); }
    this.enemies = []; this.projectiles = []; this.pickups = []; this.npcs = []; this.particles = []; this.texts = []; this.rings = []; this.bolts = []; this.slimes = []; this.spores = []; this.warps = []; this.boss = null;
    // player position
    const p = this.player;
    if (pos && pos.from) { const e = room.entryPos(pos.from, p.w, p.h); p.x = e.x; p.y = e.y; }
    else if (pos && pos.x !== undefined) { p.x = pos.x; p.y = pos.y; }
    else if (pos && pos.tile) { p.x = pos.tile[0] * TILE + 2; p.y = pos.tile[1] * TILE + 2; }
    p.kbx = p.kby = 0; p.charging = false; p.charge = 0;
    this.companion.x = p.cx; this.companion.y = p.cy;
    this.spawnEntities(room);
    // shutter rooms: close if enemies present
    if (room.onClear && this.enemies.some((e) => !e.minion) && !this.flags[`clear_${room.id}`]) room.shutAll();
    this.visited[room.id] = true;
    if (!opts.silent && (prevArea !== areaId || opts.bannerAlways)) this.ui.banner(area.name || room.name, room.name !== area.name ? room.name : '');
    const music = this.boss ? 'boss' : room.music; this.audio.play(music, SONGS);
    this.save();
    this.onEnter?.(room);
    if (room.spec.onEnter && !this.flags[`enter_${room.id}`]) { this.flags[`enter_${room.id}`] = true; this.runDialog(room.spec.onEnter); }
    // First visit to an organ dungeon: the site brief (who lives here, what you start empirically)
    const brief = SITE_BRIEFS[areaId];
    if (brief && !this.flags[`brief_${areaId}`] && !opts.silent) { this.flags[`brief_${areaId}`] = true; const site = SITE_BY_ID[brief.site]; if (site) setTimeout(() => this.ui.siteCard(site, null, brief.intro), 500); }
  }
  spawnEntities(room) {
    for (const e of room.ents) {
      if (e.requireFlag && !this.flags[e.requireFlag]) continue;
      if (e.unlessFlag && this.flags[e.unlessFlag]) continue;
      if (e.requireDrug && !this.inv.drugs.includes(e.requireDrug)) continue;
      let ex = e.x, ey = e.y;
      if (e.type !== 'warp') { const nf = room.nearestFree(ex, ey); if (nf) { ex = nf[0]; ey = nf[1]; } }
      const px = ex * TILE + (TILE - 12) / 2, py = ey * TILE + (TILE - 12) / 2;
      switch (e.type) {
        case 'enemy': { const en = new Enemy(this, e.bug, px, py, e); if (e.resist) en.resist = [...e.resist]; this.enemies.push(en); break; }
        case 'npc': this.npcs.push(new NPC(this, { ...e, x: ex, y: ey })); break;
        case 'item': if (e.flag && this.flags[e.flag]) break; this.pickups.push(new Pickup(this, e.item, ex * TILE + 8, ey * TILE + 8, { permanent: true, flag: e.flag, data: e.data })); break;
        case 'drug': if (e.flag && this.flags[e.flag]) break; { const d = DRUG_BY_ID[e.drug]; this.pickups.push(new Pickup(this, 'drug', ex * TILE + 8, ey * TILE + 8, { permanent: true, flag: e.flag || `drug_${e.drug}`, data: { id: e.drug, color: d?.color } })); } break;
        case 'warp': this.warps.push(e); break;
        case 'boss': { const spec = BOSSES[e.boss]; if (!spec) break; if (this.flags[`boss_${e.boss}`]) { this.spawnBossRewards(spec, false); break; } this.pendingBoss = { spec, e: { ...e, x: ex, y: ey } }; break; }
        case 'slime': this.slimes.push(new Slime(ex * TILE + 8, ey * TILE + 8)); this.slimes[this.slimes.length - 1].life = 1e9; break;
        default: break;
      }
    }
    // boss: start encounter
    if (this.pendingBoss) { const { spec, e } = this.pendingBoss; this.pendingBoss = null; this.startBoss(spec, e); }
  }
  startBoss(spec, e) {
    const px = e.x * TILE, py = e.y * TILE;
    const begin = () => {
      const b = new Enemy(this, spec.bug, px, py, { hp: spec.hp, size: spec.size, speed: spec.speed, ai: 'boss', boss: deepClone(spec), name: spec.name, resist: spec.resist, traits: spec.traits, vis: spec.vis, dmg: spec.dmg ?? 1, noDrops: true, ignoreShut: true, scale: 1 });
      b.phasePatterns = null; this.enemies.push(b); this.boss = b; this.room.shutAll(); this.audio.play('boss', SONGS); this.audio.sfx('bossRoar'); this.shake(8);
      this.ui.banner(spec.name, spec.title, 3200); this.discover(spec.bug);
    };
    if (spec.intro && !this.flags[`bossintro_${spec.id}`]) { this.flags[`bossintro_${spec.id}`] = true; this.lockPlayer = true; this.ui.dialog(spec.intro, () => { this.lockPlayer = false; begin(); }); }
    else begin();
  }
  bossPhase(boss, ph) {
    if (ph.resistAdd) for (const m of ph.resistAdd) if (!boss.resist.includes(m)) boss.resist.push(m);
    if (ph.resistRemove) boss.resist = boss.resist.filter((m) => !ph.resistRemove.includes(m));
    if (ph.vis) boss.vis = Object.assign({}, boss.vis, ph.vis);
    if (ph.speedMult) boss.speed *= ph.speedMult;
    if (ph.patterns) boss.phasePatterns = ph.patterns;
    if (ph.heal) boss.hp = Math.min(boss.hpMax, boss.hp + ph.heal);
    if (ph.capsule) boss.capsule = 1;
    if (ph.spawn) for (let i = 0; i < (ph.spawn.n || 2); i++) { const a = rand(0, TAU); this.enemies.push(new Enemy(this, ph.spawn.bug, boss.cx + Math.cos(a) * 24, boss.cy + Math.sin(a) * 24, { minion: true, noDrops: true })); }
    if (ph.text) { this.ui.banner(ph.text, ph.sub || '', 2800); this.addText(boss.cx, boss.y - 16, ph.text, '#ff4d6d'); }
    this.audio.sfx('mutate'); this.shake(6); this.addRing(boss.cx, boss.cy, 40, '#ff4d6d');
    if (ph.env) Object.assign(this.room.env, ph.env);
  }
  victory() {
    this.state = 'won'; this.audio.play('ending', SONGS); this.lockPlayer = true;
    const bugsKnown = this.discovered.bugs.size, drugsKnown = this.inv.drugs.length;
    const abg = Object.keys(this.antibiogram).length;
    const mins = Math.round(this.stats.playFrames / 3600);
    const grade = this.stats.cdiffBlooms === 0 && this.stats.broadShots < this.stats.shots * 0.4 ? 'ANTIMICROBIAL STEWARD' : this.stats.cdiffBlooms <= 2 ? 'ATTENDING PHYSICIAN' : 'ENTHUSIASTIC PRESCRIBER';
    setTimeout(() => {
      this.ui.card({ title: 'THE KINGDOM HOLDS', subtitle: 'Antibiotic Quest complete', foot: 'Z/ENTER: continue playing · your save keeps everything',
        html: `<p>The Colossus falls. Its plasmid — the one carrying every mechanism you fought — is destroyed before it can be handed to anything else.</p>
<p><b>But the lesson stands.</b> No drug you carried was invented faster than resistance to it appeared. Penicillin: 2 years. Methicillin: 2 years. Vancomycin: 30. Ceftazidime-avibactam: months. The pipeline is thin; the selection pressure is us.</p>
<h3>Your record</h3>
<p>Organisms identified: <b>${bugsKnown}</b> · Antibiotics mastered: <b>${drugsKnown}</b> · Antibiogram cells filled: <b>${abg}</b><br>
Doses given: <b>${this.stats.shots}</b> · Broad-spectrum doses: <b>${this.stats.broadShots}</b> · C. difficile blooms caused: <b>${this.stats.cdiffBlooms}</b><br>
Bosses defeated: <b>${this.stats.bossesBeaten}</b> · Deaths: <b>${this.stats.deaths}</b> · Time: <b>~${mins} min</b></p>
<h3>Final title: ${grade}</h3>
<p>Free play continues — the codex, the antibiogram and every dungeon stay open. Try a run with fewer broad-spectrum doses and no C. difficile blooms.</p>
<p style="color:var(--blue)"><b>Real-world coda:</b> hand hygiene, vaccines, culturing before treating, the narrowest active drug, the shortest effective course, and not treating viruses or asymptomatic bacteriuria. That is the whole game.</p>` }, () => { this.lockPlayer = false; this.state = 'play'; this.audio.play(this.room.music, SONGS); });
    }, 1200);
    this.save();
  }
  /** Spawn a boss's uncollected rewards (called at defeat and again on re-entry if still uncollected) */
  spawnBossRewards(spec, fresh = false) {
    const cx = PW / 2, cy = PH / 2; const r = spec.reward || {};
    if (r.heartContainer && !this.flags[`hc_${spec.id}`]) this.pickups.push(new Pickup(this, 'heartContainer', cx - 12, cy, { permanent: true, flag: `hc_${spec.id}` }));
    if (r.drug && !this.flags[`drug_${r.drug}`] && !this.inv.drugs.includes(r.drug)) { const d = DRUG_BY_ID[r.drug]; this.pickups.push(new Pickup(this, 'drug', cx + 12, cy, { permanent: true, flag: `drug_${r.drug}`, data: { id: r.drug, color: d?.color } })); }
    if (r.item && !this.flags[`item_${spec.id}_${r.item}`]) this.pickups.push(new Pickup(this, r.item, cx + 12, cy + 14, { permanent: true, flag: `item_${spec.id}_${r.item}` }));
    if (fresh && r.pearls) for (let i = 0; i < r.pearls; i++) this.pickups.push(new Pickup(this, 'pearl5', cx + rand(-30, 30), cy + rand(-20, 20), { life: 0 }));
  }
  bossDefeated(boss) {
    const spec = boss.boss; this.flags[`boss_${spec.id}`] = true; this.stats.bossesBeaten++; this.boss = null;
    this.room.unshutAll();
    for (const d of DIRS) if (this.room.exits[d] !== 'wall' && this.room.exits[d] !== 'open') this.openDoor(d); // the boss chamber stays open afterwards
    this.flags[`clear_${this.room.id}`] = true; this.shake(10); this.flashScreen('rgba(255,255,255,0.6)');
    for (const e of this.enemies) if (!e.dead && e.minion) e.die(true);
    this.audio.play('victory', SONGS);
    const cx = PW / 2, cy = PH / 2;
    const after = () => {
      this.spawnBossRewards(spec, true);
      setTimeout(() => { if (this.room) this.audio.play(this.room.music, SONGS); }, 4000);
      if (spec.onDefeat) spec.onDefeat(this);
      this.save();
      if (spec.id === 'ndm_d8') this.victory();
      else if (spec.id === 'listeria_d7' && !this.flags.nexusAnnounced) { this.flags.nexusAnnounced = true; setTimeout(() => this.ui.card({ title: 'THE NEXUS OPENS', subtitle: 'Resistance Nexus — east side of the kingdom', html: '<p>With the organ dungeons cleared, the hospital gate unseals. Inside the ICU, something has been collecting every resistance gene you have met.</p><p>Bring everything you have. And check your dose counts — the last-resort drugs are limited.</p>' }), 1400); }
    };
    setTimeout(() => { if (spec.lesson) this.ui.lessonCard(spec.lesson.title, spec.lesson.bullets, after, 'Boss defeated — rounds recap'); else after(); }, 700);
  }
  // ---------------- loop ----------------
  loop(now, fromTimer = false) {
    if (!fromTimer) { this.lastRaf = now; }
    const dt = Math.min(250, now - this.last); this.last = now; this.acc += dt;
    let steps = 0;
    while (this.acc >= 1000 / 60 && steps < 8) { this.update(); this.acc -= 1000 / 60; steps++; }
    if (steps === 8) this.acc = 0;
    this.draw();
    if (!fromTimer) requestAnimationFrame((t) => this.loop(t));
  }
  update() {
    this.input.poll(); this.frame++;
    if (this.ui.open) { this.ui.update(); this.input.endFrame(); this.tickFx(); return; }
    if (this.state === 'play') {
      this.stats.playFrames++;
      const inp = this.input;
      if (inp.pressed('menu') || inp.pressed('pause')) { inp.consume('menu'); inp.consume('pause'); this.audio.sfx('menuSel'); this.ui.menu('drugs'); this.input.endFrame(); return; }
      if (inp.pressed('prev')) this.cycleDrug(-1); if (inp.pressed('next')) this.cycleDrug(1);
      for (let i = 1; i <= 9; i++) if (inp.pressed('slot' + i)) { const id = this.inv.drugs[i - 1]; if (id) this.equip(id); }
      if (inp.pressed('map')) { this.lensOn = !this.lensOn; }
      this.updateWorld();
    } else if (this.state === 'transition') { this.updateTransition(); }
    this.tickFx();
    this.input.endFrame();
  }
  tickFx() {
    if (this.shakeT > 0) this.shakeT--; if (this.flashT > 0) this.flashT--;
    for (const p of this.particles) p.update(); this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) t.update(); this.texts = this.texts.filter((t) => t.life > 0);
    for (const r of this.rings) r.update(); this.rings = this.rings.filter((r) => r.life > 0);
    for (const b of this.bolts) b.update(); this.bolts = this.bolts.filter((b) => b.life > 0);
  }
  updateWorld() {
    const p = this.player, room = this.room;
    p.update();
    // NPC interaction
    if ((this.input.pressed('confirm') || this.input.pressed('fire')) && !this.lockPlayer) {
      const n = this.npcs.find((n) => n.near && this.facingToward(n));
      if (n) { this.input.consume('confirm'); this.input.consume('fire'); p.charging = false; p.charge = 0; this.runDialog(n.dialog, n); return; }
    }
    this.companion.update();
    for (const e of this.enemies) if (!e.dead) e.update();
    for (const pr of this.projectiles) if (!pr.dead) pr.update();
    for (const pk of this.pickups) if (!pk.dead) pk.update();
    for (const n of this.npcs) n.update();
    for (const s of this.slimes) s.update(); this.slimes = this.slimes.filter((s) => s.life > 0);
    for (const s of this.spores) if (!s.dead) s.update(); this.spores = this.spores.filter((s) => !s.dead);
    this.enemies = this.enemies.filter((e) => !e.dead); this.projectiles = this.projectiles.filter((x) => !x.dead); this.pickups = this.pickups.filter((x) => !x.dead);
    // NPC solidity: push player out
    for (const n of this.npcs) { const dx = p.cx - n.cx, dy = p.cy - n.cy; const d = Math.hypot(dx, dy); if (d < 11 && d > 0) { p.x += dx / d * (11 - d); p.y += dy / d * (11 - d); } }
    // microbiome regen
    if (this.microRegenT > 0) this.microRegenT--; else if (this.microbiome < 100) this.microbiome = Math.min(100, this.microbiome + 0.012);
    // room clear
    if (room.onClear && !this.flags[`clear_${room.id}`] && !this.enemies.some((e) => !e.dead && !e.minion)) {
      this.flags[`clear_${room.id}`] = true; room.unshutAll(); this.audio.sfx('unlock');
      if (room.onClear.drop) { const d = room.onClear.drop; this.pickups.push(new Pickup(this, d.item, PW / 2, PH / 2, { permanent: true, flag: d.flag || `drop_${room.id}`, data: d.data })); this.audio.sfx('secret'); }
      if (room.onClear.open) for (const dir of room.onClear.open) room.openExit(dir);
      if (room.onClear.flag) this.flags[room.onClear.flag] = true;
    }
    // doors (locked / boss / biofilm)
    this.checkDoors();
    // warps
    for (const w of this.warps) { if (Math.floor(p.cx / TILE) === w.x && Math.floor((p.cy + 2) / TILE) === w.y) { this.audio.sfx('stairs'); const to = w.to; this.enterRoom(to.area, to.room, to.from ? { from: to.from } : to.tile ? { tile: to.tile } : { x: to.x, y: to.y }, { bannerAlways: true }); return; } }
    // exits
    const dir = room.exitDir(p.x, p.y, p.w, p.h);
    if (dir) { const nb = this.world.neighbor(room, dir); if (nb && room.exits[dir] === 'open') this.startTransition(dir, nb); else { p.x = clamp(p.x, 2, PW - p.w - 2); p.y = clamp(p.y, 2, PH - p.h - 2); } }
  }
  facingToward(n) { const p = this.player; const dx = n.cx - p.cx, dy = n.cy - p.cy; const f = p.facing; if (Math.abs(dx) > Math.abs(dy)) return (dx > 0 && f === 3) || (dx < 0 && f === 1) || Math.abs(dy) < 8; return (dy > 0 && f === 0) || (dy < 0 && f === 2) || Math.abs(dx) < 8; }
  checkDoors() {
    const p = this.player, room = this.room;
    for (const d of DIRS) {
      const type = room.exits[d]; if (type === 'open' || type === 'wall' || type === 'shut') continue;
      const tiles = exitTiles(d); const [tx, ty] = tiles[0];
      const rx = tx * TILE - 4, ry = ty * TILE - 4, rw = (d === 'n' || d === 's') ? TILE * 2 + 8 : TILE + 8, rh = (d === 'n' || d === 's') ? TILE + 8 : TILE * 2 + 8;
      if (p.x < rx + rw && p.x + p.w > rx && p.y < ry + rh && p.y + p.h > ry) {
        if (type === 'locked') { if ((this.inv.keys[this.areaId] || 0) > 0) { this.inv.keys[this.areaId]--; this.openDoor(d); } else if (this.frame % 40 === 0) this.toast('Locked. Find a small key in this dungeon.'); }
        else if (type === 'boss') { if (this.inv.bossKeys[this.areaId]) this.openDoor(d); else if (this.frame % 40 === 0) this.toast('The boss door. You need the BOSS KEY.'); }
        else if (type === 'biofilm' || type === 'abscess') { if (this.frame % 40 === 0) this.toast(this.inv.tools.scalpel ? 'Biofilm-sealed. Use the scalpel (X) to debride it.' : 'Sealed by biofilm. Antibiotics can’t cut through — you need SOURCE CONTROL.'); }
      }
    }
  }
  openDoor(d) { this.room.openExit(d); this.flags[`door_${this.room.id}_${d}`] = true; const nb = this.world.neighbor(this.room, d); if (nb) this.flags[`door_${nb.id}_${OPP[d]}`] = true; this.audio.sfx('unlock'); this.shake(3); }
  startTransition(dir, nb) {
    this.state = 'transition'; this.trans = { dir, nb, t: 0, dur: 22 };
    const old = mkCanvas(PW, PH); const c = old.getContext('2d'); this.drawWorld(c); this.trans.old = old;
    this.enterRoom(nb.areaId, nb.id, { from: OPP[dir] }, { silent: this.areaId === nb.areaId });
    const nw = mkCanvas(PW, PH); const c2 = nw.getContext('2d'); this.room.render(c2, this.frame); this.trans.nw = nw;
    this.lockPlayer = true;
  }
  updateTransition() { const tr = this.trans; tr.t++; if (tr.t >= tr.dur) { this.state = 'play'; this.lockPlayer = false; this.trans = null; } }
  // ---------------- drugs / firing ----------------
  currentDrug() { return this.inv.current ? DRUG_BY_ID[this.inv.current] : null; }
  equip(id) { if (!this.inv.drugs.includes(id)) return; this.inv.current = id; this.audio.sfx('menuMove'); this.player.charging = false; this.player.charge = 0; }
  cycleDrug(d) { const n = this.inv.drugs.length; if (!n) return; const i = this.inv.drugs.indexOf(this.inv.current); this.equip(this.inv.drugs[(i + d + n) % n]); }
  canFire(drug) { if (this.inv.doses[drug.id] !== undefined && this.inv.doses[drug.id] <= 0) { if (this.frame % 30 === 0) this.toast(`No ${drug.short} doses left — it’s a last-resort drug. Find or buy vials.`); return false; } return true; }
  onFire(drug) {
    this.stats.shots++; if (this.inv.doses[drug.id] !== undefined) this.inv.doses[drug.id]--;
    // Combination-therapy timers
    this.comboT = this.comboT || {};
    this.comboT[drug.id] = this.frame;
    if (drug.id === 'ceftazavi') this.avibactamUntil = this.frame + 480;       // avibactam shields aztreonam (8 s)
    if (drug.flags?.tbCombo || drug.id === 'rifampin') this.tbRecent = { ...(this.tbRecent || {}), [drug.id]: this.frame };
    const cost = microbiomeCost(drug); if (cost > 0) { this.microbiomeHit(cost, drug); if (drug.tier >= 3) this.stats.broadShots++; }
    if (drug.proj.selfTox && this.frame % 4 === 0) { /* nephrotoxicity flavor: slow */ this.player.slow = 30; if (Math.random() < 0.15) this.addText(this.player.cx, this.player.y - 12, 'nephrotoxic…', '#ff8787', { small: true }); }
  }
  microbiomeHit(amount, drug) {
    this.microbiome -= amount; this.microRegenT = 180;
    if (this.microbiome <= 0) { this.microbiome = 45; this.cdiffBloom(); }
    else if (this.microbiome < 25 && this.frame % 90 === 0) this.toast('Microbiome low — C. difficile risk rising. Narrow your spectrum!');
  }
  cdiffBloom() {
    this.stats.cdiffBlooms++; this.audio.sfx('cdiff'); this.shake(8); this.flashScreen('rgba(120,80,0,0.4)');
    this.ui.banner('C. DIFFICILE BLOOM', 'Broad-spectrum overuse wiped out your microbiome', 3200);
    for (let i = 0; i < 3; i++) { let tries = 0; while (tries++ < 30) { const x = rand(24, PW - 36), y = rand(24, PH - 36); if (this.room.rectFree(x, y, 12, 12) && dist(x, y, this.player.x, this.player.y) > 50) { this.enemies.push(new Enemy(this, 'cdiff', x, y, { noDrops: false })); break; } } }
    this.discover('cdiff');
    if (!this.flags.cdiffLesson) { this.flags.cdiffLesson = true; setTimeout(() => this.ui.lessonCard('Collateral damage', ['Every dose of a broad-spectrum antibiotic kills gut commensals too. C. difficile spores survive, germinate, and bloom into toxin-producing colonies.', 'Highest-risk drugs: clindamycin, fluoroquinolones, 3rd/4th-gen cephalosporins, carbapenems, pip-tazo. Lowest: nitrofurantoin, doxycycline, narrow β-lactams.', 'Treat with ORAL vancomycin or fidaxomicin (IV vanc never reaches the colon). Metronidazole still works a little; it’s no longer first-line.', 'Spores laugh at alcohol gel: soap & water. And the best treatment is prevention — stop the antibiotic you didn’t need.', 'Probiotic pickups (yogurt) restore the bar. Narrow-spectrum shots let it regenerate.'], null, 'Stewardship lesson'), 600); }
  }
  // ---------------- tools ----------------
  useTool() {
    const p = this.player;
    if (!this.inv.tools.scalpel) { if (this.inv.tools.lens) { this.lensOn = !this.lensOn; this.toast(this.lensOn ? 'Gram stain lens ON' : 'Gram stain lens OFF'); } else this.toast('No tool yet. The scalpel waits in the Abscess Cave.'); return; }
    if (p.toolAnim > 0) return;
    p.toolAnim = 12; this.audio.sfx('scalpel');
    const [fx, fy] = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.facing];
    const tx = Math.floor((p.cx + fx * 14) / TILE), ty = Math.floor((p.cy + fy * 14) / TILE);
    const hitTile = (x, y) => { const t = this.room.tileAt(x, y); if (t === T.ABSCESS || t === T.BIOFILM) { this.room.setTile(x, y, T.FLOOR); this.flags[`tile_${this.room.id}_${x}_${y}`] = true; this.addParticles(x * TILE + 8, y * TILE + 8, t === T.ABSCESS ? '#f7ede2' : '#2ec4b6', 18, { speed: 2 }); this.addText(x * TILE + 8, y * TILE, t === T.ABSCESS ? 'DRAINED — source control!' : 'DEBRIDED!', '#ffd166'); this.audio.sfx('hitBig'); return true; } return false; };
    hitTile(tx, ty); if (fx) { hitTile(tx, ty - 1); hitTile(tx, ty + 1); } else { hitTile(tx - 1, ty); hitTile(tx + 1, ty); }
    // biofilm/abscess exit doors
    for (const d of DIRS) { const type = this.room.exits[d]; if (type !== 'biofilm' && type !== 'abscess') continue; const tiles = exitTiles(d); for (const [ex, ey] of tiles) { if (Math.abs(ex - tx) <= 1 && Math.abs(ey - ty) <= 1) { this.openDoor(d); this.addText(PW / 2, PH / 2 - 20, 'DEBRIDED — passage open', '#ffd166'); this.audio.sfx('hitBig'); } } }
    // enemies: source control damage to abscess-formers / biofilm jelly
    for (const e of this.enemies) { if (e.dead) continue; if (dist(e.cx, e.cy, p.cx + fx * 12, p.cy + fy * 12) < e.size / 2 + 8) { if (e.traits.includes('biofilm') || e.bug.tags.includes('bfrag') || e.bug.tags.includes('staph')) { e.takeDamage(1.5, null, null); this.addText(e.cx, e.y - 10, 'SOURCE CONTROL', '#ffd166', { small: true }); } else { e.takeDamage(0.5, null, null); } } }
    // clear slime / spores nearby
    this.slimes = this.slimes.filter((s) => !(dist(s.x, s.y, p.cx + fx * 12, p.cy + fy * 12) < 16 && s.life < 1e8));
    for (const s of this.spores) if (dist(s.x, s.y, p.cx + fx * 12, p.cy + fy * 12) < 14) { s.dead = true; this.addText(s.x, s.y - 6, 'scrubbed', '#caf0f8', { small: true }); }
  }
  usePotion() { if (this.inv.potions <= 0) { this.toast('No IV fluids.'); return false; } if (this.hp >= this.maxHp) { this.toast('Already at full health.'); return false; } this.inv.potions--; this.hp = this.maxHp; this.audio.sfx('heal'); this.addText(this.player.cx, this.player.y - 12, 'RESUSCITATED', '#52b788'); return true; }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
  // ---------------- events ----------------
  collect(pk) {
    const t = pk.type; const p = this.player;
    if (pk.flag) this.flags[pk.flag] = true;
    switch (t) {
      case 'heart': this.heal(1); this.audio.sfx('heart'); break;
      case 'pearl': this.inv.pearls++; this.audio.sfx('pearl'); break;
      case 'pearl5': this.inv.pearls += 5; this.audio.sfx('pearl'); this.addText(p.cx, p.y - 10, '+5', '#caf0f8', { small: true }); break;
      case 'dose': { const id = pk.data?.id || Object.keys(this.inv.doses)[0]; if (id) { this.inv.doses[id] = (this.inv.doses[id] || 0) + (pk.data?.n || 3); this.addText(p.cx, p.y - 10, `+${pk.data?.n || 3} ${DRUG_BY_ID[id]?.short || ''} doses`, '#fff', { small: true }); } this.audio.sfx('pickup'); break; }
      case 'probiotic': this.microbiome = Math.min(100, this.microbiome + 35); this.audio.sfx('heal'); this.addText(p.cx, p.y - 10, 'MICROBIOME +35', '#52b788', { small: true }); break;
      case 'key': this.inv.keys[this.areaId] = (this.inv.keys[this.areaId] || 0) + 1; this.audio.sfx('key'); this.addText(p.cx, p.y - 10, 'SMALL KEY', '#ffd166'); break;
      case 'bosskey': this.inv.bossKeys[this.areaId] = true; this.audio.sfx('key'); this.ui.banner('BOSS KEY', 'The boss chamber is open to you'); break;
      case 'heartContainer': this.maxHp++; this.hp = this.maxHp; this.audio.sfx('itemGet'); this.ui.banner('IMMUNITY CONTAINER', 'Max health +1 — your defenses grow'); break;
      case 'heartPiece': this.inv.heartPieces++; this.audio.sfx('secret'); if (this.inv.heartPieces % 4 === 0) { this.maxHp++; this.hp = this.maxHp; this.ui.banner('HEART CONTAINER', 'Four pieces made a whole!'); } else this.ui.banner('PIECE OF HEART', `${this.inv.heartPieces % 4}/4 — find ${4 - this.inv.heartPieces % 4} more`); break;
      case 'potion': this.inv.potions++; this.audio.sfx('pickup'); this.addText(p.cx, p.y - 10, 'IV FLUIDS (menu → items)', '#52b788', { small: true }); break;
      case 'drug': this.acquireDrug(pk.data.id); break;
      case 'scalpel': this.inv.tools.scalpel = true; this.audio.sfx('itemGet'); this.ui.itemCard('SCALPEL — Source Control', 'Tool (X / K)', '<p>Antibiotics cannot penetrate an abscess: no blood supply, low pH, high bacterial load, and a wall of fibrin. <b>Pus must be drained.</b></p><p>Swing the scalpel at <b>abscess blobs</b> and <b>biofilm-sealed passages</b> to open them, and at biofilm-formers to hurt them. "Source control" — removing infected lines, draining collections, debriding dead tissue — is half of infectious disease.</p><p style="color:var(--blue)">Pearl: a patient not improving on the right antibiotic usually has undrained pus or a retained device.</p>', null, 'scalpel'); break;
      case 'lens': this.inv.tools.lens = true; this.lensOn = true; this.audio.sfx('itemGet'); this.ui.itemCard('GRAM STAIN LENS', 'Passive: labels every organism', '<p>Hans Christian Gram, 1884. Crystal violet + iodine, alcohol wash, safranin counterstain. <b>Purple</b> = thick peptidoglycan wall (gram-positive). <b>Pink</b> = thin wall behind an outer membrane (gram-negative).</p><p>The first question in every infection: gram-positive or gram-negative? It decides which half of your formulary is even relevant. Press <b>M</b> to toggle the labels.</p>', null, 'lens'); break;
      case 'culture': this.inv.tools.culture = true; this.audio.sfx('itemGet'); this.ui.itemCard('CULTURE & SENSITIVITY KIT', 'Passive: bestiary shows active drugs', '<p>Cultures take 24-72 hours, but they turn empiric guessing into targeted therapy. Your Bestiary entries now list which of your drugs are active against each organism.</p><p style="color:var(--blue)">Pearl: ALWAYS culture before antibiotics when you safely can — one dose can sterilize blood cultures and leave you treating blind for weeks.</p>', null, 'culture'); break;
      case 'clavulanate': this.inv.tools.clavulanate = true; this.audio.sfx('itemGet'); if (this.inv.drugs.includes('ampicillin')) { this.acquireDrug('amoxclav', 'Clavulanate binds to your aminopenicillin: Amoxicillin-clavulanate (Augmentin)!'); } else { this.ui.itemCard('CLAVULANATE', 'β-lactamase inhibitor', '<p>A suicide inhibitor of class A β-lactamases. Pair it with an aminopenicillin to make amoxicillin-clavulanate.</p>', null, 'clavulanate'); } break;
      case 'vaccine': this.inv.tools.vaccine = true; this.audio.sfx('itemGet'); this.ui.itemCard('VACCINE CARD', 'Passive: encapsulated organisms hurt you less', '<p>Conjugate vaccines (PCV20, Hib, MenACWY/MenB) teach B cells to make antibody against capsular polysaccharide. Opsonized capsules get eaten.</p><p>Vaccines are the ultimate antibiotic-sparing drug: Hib vaccine nearly eliminated childhood H. flu meningitis; PCV cut pediatric pneumococcal disease — and adult disease through herd effect.</p>', null, 'vaccine'); break;
      case 'soap': this.inv.tools.soap = true; this.audio.sfx('itemGet'); this.ui.itemCard('SOAP & WATER', 'Passive: spores no longer hurt you', '<p>Alcohol gel kills vegetative bacteria but <b>not spores</b>. C. difficile rooms mean soap, water, gloves, and a gown. Semmelweis was right in 1847; hand hygiene is still the most cost-effective infection control there is.</p>', null, 'soap'); break;
      case 'map': this.inv.maps[this.areaId] = true; this.audio.sfx('pickup'); this.toast('Dungeon MAP — the layout appears on your minimap.'); break;
      case 'compass': this.inv.compasses[this.areaId] = true; this.audio.sfx('pickup'); this.toast('COMPASS — the boss chamber is marked.'); break;
      case 'ripe': this.audio.sfx('itemGet'); break;
      default: this.audio.sfx('pickup');
    }
  }
  acquireDrug(id, intro) {
    const d = DRUG_BY_ID[id]; if (!d) return;
    const isNew = !this.inv.drugs.includes(id);
    if (isNew) { this.inv.drugs.push(id); this.discovered.drugs.add(id); if (d.flags?.doses) this.inv.doses[id] = d.flags.doses; }
    this.equip(id); this.audio.sfx('itemGet');
    this.flags[`drug_${id}`] = true;
    this.ui.drugCard(id, null, intro || (isNew ? `You got ${d.name}! Equipped as your active antibiotic. Q/E to switch.` : `Restocked ${d.name}.`));
    if (id === 'ampicillin' && this.inv.tools.clavulanate && !this.inv.drugs.includes('amoxclav')) setTimeout(() => this.acquireDrug('amoxclav', 'Your clavulanate binds the aminopenicillin: Amoxicillin-clavulanate!'), 400);
    // combo weapons
    if (this.inv.drugs.includes('ceftazavi') && this.inv.drugs.includes('aztreonam') && !this.flags.comboCZA) { this.flags.comboCZA = true; setTimeout(() => this.ui.lessonCard('Combination unlocked: CZA + Aztreonam', ['Ceftazidime-avibactam alone fails against NDM (a metallo-β-lactamase — zinc, not serine).', 'Aztreonam is NOT hydrolyzed by metallo-enzymes… but NDM strains also carry ESBL/KPC, which DO chew up aztreonam.', 'Avibactam inhibits those serine enzymes → aztreonam survives → the pair kills NDM producers.', 'In this game: firing ceftazidime-avibactam now also protects aztreonam — switch between them and the avibactam shield applies to both for 8 s.'], null, 'Advanced therapeutics'), 500); }
    if (['isoniazid', 'pyrazinamide', 'ethambutol', 'rifampin'].every((x) => this.inv.drugs.includes(x)) && !this.flags.comboRIPE) { this.flags.comboRIPE = true; setTimeout(() => this.ui.lessonCard('Combination unlocked: RIPE', ['You hold all four first-line TB drugs: Rifampin, Isoniazid, Pyrazinamide, Ethambutol.', 'Alone, each selects resistant mutants within days. Together, the odds of a bacillus resisting all four are ~1 in 10²⁴.', 'In this game: TB drugs fired within 6 seconds of each other stack a COMBINATION bonus — cycle through all four to hurt TB without breeding resistance.', 'Real regimen: 2 months RIPE, then 4 months RI. Stop early and you make MDR-TB.'], null, 'Advanced therapeutics'), 500); }
  }
  enemyKilled(e, silent) {
    this.stats.kills++; this.discover(e.bugId);
    if (e.flagOnDeath) this.flags[e.flagOnDeath] = true;
    if (e.boss) { this.bossDefeated(e); return; }
    if (!e.noDrops && !silent) {
      const r = Math.random(); let type = null;
      if (r < 0.33) type = 'pearl'; else if (r < 0.47) type = 'heart'; else if (r < 0.53) type = 'pearl5'; else if (r < 0.58 && Object.keys(this.inv.doses).length) type = 'dose'; else if (r < 0.64 && this.microbiome < 70) type = 'probiotic';
      if (type) { const data = type === 'dose' ? { id: choice(Object.keys(this.inv.doses)), n: 3 } : undefined; this.pickups.push(new Pickup(this, type, e.cx, e.cy, { life: 600, vx: rand(-1, 1), vy: rand(-1, 1), data })); }
      if (e.drops) for (const d of e.drops) this.pickups.push(new Pickup(this, d.item, e.cx, e.cy, { permanent: true, flag: d.flag, data: d.data }));
    }
    if (e.bug.tags.includes('cdiff') && !silent && Math.random() < 0.35) this.pickups.push(new Pickup(this, 'probiotic', e.cx, e.cy, { life: 600 }));
  }
  discover(bugId) {
    const b = BUG_BY_ID[bugId]; if (!b) return;
    if (!this.discovered.bugs.has(bugId)) { this.discovered.bugs.add(bugId); this.toast(`New organism: ${b.aka || b.name} — Bestiary updated`, 2600); this.quirkT = this.frame + 200; }
    else if (b.edu.quirks?.length && this.frame > (this.quirkT || 0) && Math.random() < 0.35) { this.quirkT = this.frame + 900; const q = choice(b.edu.quirks); this.toast(`${b.aka || b.name}: ${q.length > 150 ? q.slice(0, 147) + '…' : q}`, 5200); }
  }
  recordAntibiogram(drugId, bugId, cat) { const k = `${drugId}|${bugId}`; if (this.antibiogram[k] !== cat && cat === 'X') this.stats.resistEvents++; if (!this.antibiogram[k] || cat === 'S' || (cat === 'I' && this.antibiogram[k] !== 'S')) this.antibiogram[k] = cat; else if (!this.antibiogram[k]) this.antibiogram[k] = cat; }
  onMutation() {}
  /** Safety net: an overlay closing while nothing else holds the player must release movement */
  onOverlayClosed() { if (!this.ui.open && this.state === 'play' && !this.trans) this.lockPlayer = false; }
  /** How many distinct TB drugs were fired in the last 6 seconds (RIPE combination bonus) */
  tbComboCount() { if (!this.tbRecent) return 0; return Object.values(this.tbRecent).filter((f) => this.frame - f < 360).length; }
  avibactamActive() { return (this.avibactamUntil || 0) > this.frame; }
  gramColor(b) { return (GRAM[b.edu?.gram] || GRAM[b.tags[0]])?.color || '#fff'; }
  // dialogs (data-driven)
  runDialog(id, npc) {
    const def = DIALOGS[id]; if (!def) { console.warn('no dialog', id); return; }
    const res = typeof def === 'function' ? def(this, npc) : def;
    if (!res) return;
    if (res.action) { res.action(this); return; }
    const pages = res.pages || res;
    this.lockPlayer = true;
    this.ui.dialog(pages, (val) => { this.lockPlayer = false; res.onDone?.(this, val); });
  }
  // ---------------- fx helpers ----------------
  spawnProjectile(p) { this.projectiles.push(p); }
  addParticles(x, y, color, n, o = {}) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(0.3, o.speed || 1.5); this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, randInt(8, o.life || 20), color, rand(1, 2.2))); } }
  addText(x, y, str, color = '#fff', o = {}) { if (this.texts.length > 14) this.texts.shift(); this.texts.push(new FloatText(x, y, str, color, o)); }
  addRing(x, y, r, color) { this.rings.push(new Ring(x, y, r, color)); }
  addBolt(x1, y1, x2, y2, color) { this.bolts.push(new Bolt(x1, y1, x2, y2, color)); }
  addSlime(x, y) { if (this.slimes.filter((s) => s.life < 1e8).length > 14) this.slimes.shift(); this.slimes.push(new Slime(x, y)); }
  addSpore(x, y) { if (this.inv.tools.soap) { this.addParticles(x, y, '#caf0f8', 4, { speed: 1 }); return; } this.spores.push(new Spore(this, x, y)); }
  slimeAt(x, y) { return this.slimes.some((s) => s.contains(x, y)); }
  shake(n) { if (this.settings.shake) this.shakeT = Math.max(this.shakeT, n); }
  flashScreen(col) { this.flashCol = col; this.flashT = 6; }
  toast(m, ms) { this.ui.toast(m, ms); }
  // ---------------- drawing ----------------
  draw() {
    const c = this.ctx; c.save(); c.imageSmoothingEnabled = false;
    c.fillStyle = '#000'; c.fillRect(0, 0, VIEW_W, VIEW_H);
    if (this.state === 'title') { this.drawTitleBg(c); c.restore(); return; }
    if (!this.room) { c.restore(); return; }
    let sx = 0, sy = 0; if (this.shakeT > 0) { sx = randInt(-2, 2); sy = randInt(-2, 2); }
    c.translate(sx, PLAY_Y + sy);
    if (this.state === 'transition' && this.trans) {
      const tr = this.trans, f = tr.t / tr.dur, e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      const dx = (tr.dir === 'e' ? -PW : tr.dir === 'w' ? PW : 0) * e, dy = (tr.dir === 's' ? -PH : tr.dir === 'n' ? PH : 0) * e;
      c.drawImage(tr.old, dx, dy); c.drawImage(tr.nw, dx + (tr.dir === 'e' ? PW : tr.dir === 'w' ? -PW : 0), dy + (tr.dir === 's' ? PH : tr.dir === 'n' ? -PH : 0));
      // player slides in
      const p = this.player; const prog = e; const startX = tr.dir === 'e' ? -p.w - 2 : tr.dir === 'w' ? PW + 2 : p.x, startY = tr.dir === 's' ? -p.h - 2 : tr.dir === 'n' ? PH + 2 : p.y;
      c.save(); const ox = p.x, oy = p.y; p.x = startX + (ox - startX) * prog; p.y = startY + (oy - startY) * prog; p.draw(c); p.x = ox; p.y = oy; c.restore();
    } else {
      this.drawWorld(c);
    }
    c.restore();
    this.drawHUD(c);
    if (this.flashT > 0 && this.flashCol) { c.fillStyle = this.flashCol; c.globalAlpha = this.flashT / 6; c.fillRect(0, 0, VIEW_W, VIEW_H); c.globalAlpha = 1; }
  }
  drawWorld(c) {
    const room = this.room; room.render(c, this.frame);
    for (const s of this.slimes) s.draw(c);
    for (const s of this.spores) s.draw(c);
    for (const pk of this.pickups) pk.draw(c);
    for (const w of this.warps) { /* stairs tiles already drawn */ }
    const drawables = [...this.npcs, ...this.enemies.filter((e) => !e.dead), this.player].sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const d of drawables) d.draw(c);
    this.companion.draw(c);
    for (const p of this.projectiles) p.draw(c);
    for (const b of this.bolts) b.draw(c);
    for (const r of this.rings) r.draw(c);
    for (const p of this.particles) p.draw(c);
    for (const t of this.texts) t.draw(c);
    // darkness
    if (room.env.dark) { const p = this.player; const g = c.createRadialGradient(p.cx, p.cy, 20, p.cx, p.cy, 90); g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(1, 'rgba(0,0,10,0.85)'); c.fillStyle = g; c.fillRect(0, 0, PW, PH); }
    // boss bar
    if (this.boss && !this.boss.dead) { const b = this.boss; const w = 160, x = (PW - w) / 2, y = PH - 14; text(c, b.name, PW / 2, y - 9, { size: 6, align: 'center', color: '#ffd166' }); bar(c, x, y, w, 7, b.hp / b.hpMax, '#e63946', '#1b1b2f', '#000'); for (const ph of b.boss.phases || []) { c.fillStyle = '#fff'; c.fillRect(Math.round(x + w * ph.at), y, 1, 7); } }
    // env tag
    const envTags = []; if (room.env.cns) envTags.push('CNS: blood-brain barrier'); if (room.env.lung) envTags.push('LUNG: surfactant'); if (room.env.urine) envTags.push('URINE: concentrating drugs'); if (room.env.abscess) envTags.push('ABSCESS: low O₂ / pH'); if (room.env.neutropenic) envTags.push('NEUTROPENIC: no immune help'); if (room.env.endocarditis) envTags.push('VEGETATION: needs cidal drugs');
    if (envTags.length) text(c, envTags.join(' · '), PW - 3, PH - 8, { size: 5, align: 'right', color: '#90e0ef' });
    if (this.lockPlayer && !this.ui.open && this.state === 'play') {}
  }
  drawHUD(c) {
    c.save(); c.fillStyle = '#10102a'; c.fillRect(0, 0, VIEW_W, HUD_H); c.fillStyle = '#2a2a55'; c.fillRect(0, HUD_H - 2, VIEW_W, 2);
    // minimap (left)
    this.drawMinimap(c, 3, 3);
    // counters
    const x0 = 54;
    drawItemIcon(c, 'pearl', x0 + 4, 9, 0); text(c, String(this.inv.pearls).padStart(3, '0'), x0 + 11, 6, { size: 6, color: '#caf0f8' });
    drawItemIcon(c, 'key', x0 + 4, 22, 0); text(c, 'x' + (this.inv.keys[this.areaId] || 0), x0 + 11, 19, { size: 6, color: this.inv.bossKeys[this.areaId] ? '#ff4d6d' : '#ffd166' });
    drawItemIcon(c, 'potion', x0 + 4, 36, 0); text(c, 'x' + this.inv.potions, x0 + 11, 33, { size: 6, color: '#52b788' });
    // weapon box
    const wx = 96, wy = 4, ww = 100, wh = HUD_H - 8;
    c.fillStyle = '#0a0a22'; c.fillRect(wx, wy, ww, wh); c.strokeStyle = '#3a3a6e'; c.strokeRect(wx + 0.5, wy + 0.5, ww - 1, wh - 1);
    const d = this.currentDrug();
    if (d) {
      drawItemIcon(c, 'drug', wx + 10, wy + 12, 0, { color: d.color });
      text(c, d.short, wx + 20, wy + 4, { size: 7, color: d.color });
      text(c, d.name.split(' / ')[0].slice(0, 17), wx + 20, wy + 13, { size: 5, color: '#fff' });
      text(c, d.clsName.slice(0, 24), wx + 20, wy + 20, { size: 4, color: '#a9a6c9' });
      drawTargetIcon(c, d.target, wx + 10, wy + 30, TARGETS[d.target]?.color || '#fff');
      text(c, d.kill === 'cidal' ? 'CIDAL' : 'STATIC', wx + 20, wy + 28, { size: 5, color: d.kill === 'cidal' ? '#ff758f' : '#90e0ef' });
      for (let i = 0; i < 4; i++) { c.fillStyle = i < d.tier ? ['#52b788', '#ffd166', '#f8961e', '#e63946'][d.tier - 1] : '#333'; c.fillRect(wx + 56 + i * 6, wy + 30, 5, 4); }
      text(c, 'SPECTRUM', wx + 56, wy + 35, { size: 4, color: '#a9a6c9' });
      if (this.inv.doses[d.id] !== undefined) text(c, `x${this.inv.doses[d.id]}`, wx + ww - 3, wy + 4, { size: 6, align: 'right', color: this.inv.doses[d.id] > 5 ? '#fff' : '#ff4d6d' });
      else text(c, `${this.inv.drugs.indexOf(d.id) + 1}/${this.inv.drugs.length}`, wx + ww - 3, wy + 4, { size: 5, align: 'right', color: '#a9a6c9' });
      if (d.proj.type === 'charge' && this.player.charging) bar(c, wx + 20, wy + 37, 30, 4, this.player.charge, '#f9c74f');
    } else text(c, 'NO DRUG', wx + 8, wy + 14, { size: 6, color: '#666' });
    // hearts (right)
    const hx = 204, hy = 6; const n = this.maxHp;
    for (let i = 0; i < n; i++) { const row = Math.floor(i / 8), col = i % 8; const frac = clamp(this.hp - i, 0, 1); drawHeart(c, hx + col * 11, hy + row * 10, 9, '#ff4d6d', frac); }
    text(c, 'IMMUNITY', hx, hy + 21, { size: 4, color: '#a9a6c9' });
    // microbiome bar
    bar(c, hx, hy + 27, 88, 6, this.microbiome / 100, this.microbiome > 50 ? '#52b788' : this.microbiome > 25 ? '#ffd166' : '#e63946');
    text(c, 'MICROBIOME', hx, hy + 34, { size: 4, color: this.microbiome < 25 && Math.floor(this.frame / 15) % 2 ? '#ff4d6d' : '#a9a6c9' });
    c.restore();
  }
  drawMinimap(c, x, y) {
    const area = this.world.areas[this.areaId]; if (!area) return;
    const rooms = [...area.rooms.values()]; let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const r of rooms) { minx = Math.min(minx, r.gx); maxx = Math.max(maxx, r.gx); miny = Math.min(miny, r.gy); maxy = Math.max(maxy, r.gy); }
    const cols = maxx - minx + 1, rows = maxy - miny + 1; const cw = Math.min(6, Math.floor(46 / cols)), ch = Math.min(5, Math.floor(40 / rows));
    c.fillStyle = '#0a0a22'; c.fillRect(x, y, 48, 42);
    const hasMap = this.inv.maps[this.areaId] || this.areaId === 'overworld';
    for (const r of rooms) {
      const vis = this.visited[r.id]; if (!vis && !hasMap) continue;
      const rx = x + 1 + (r.gx - minx) * cw, ry = y + 1 + (r.gy - miny) * ch;
      c.fillStyle = vis ? (THEMES[r.theme]?.floor || '#666') : '#333'; c.fillRect(rx, ry, cw - 1, ch - 1);
      if (r.spec.ents?.some((e) => e.type === 'boss') && (this.inv.compasses[this.areaId] || vis)) { c.fillStyle = '#e63946'; c.fillRect(rx + 1, ry + 1, Math.max(1, cw - 3), Math.max(1, ch - 3)); }
    }
    if (Math.floor(this.frame / 20) % 2 === 0) { const r = this.room; c.fillStyle = '#fff'; c.fillRect(x + 1 + (r.gx - minx) * cw, y + 1 + (r.gy - miny) * ch, cw - 1, ch - 1); }
    text(c, (area.name || '').slice(0, 12), x, y + 43 - 5, { size: 4, color: '#a9a6c9' });
  }
  drawTitleBg(c) {
    // animated petri-dish background with drifting bugs
    const t = this.frame;
    const grd = c.createRadialGradient(160, 110, 10, 160, 110, 200); grd.addColorStop(0, '#1d1d47'); grd.addColorStop(1, '#07071a'); c.fillStyle = grd; c.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!this.titleBugs) { this.titleBugs = []; const ids = ['gas', 'ecoli', 'mssa', 'pneumo', 'pseudomonas', 'mycoplasma', 'klebsiella', 'cdiff', 'borrelia', 'vre', 'hflu', 'candida']; for (let i = 0; i < 14; i++) this.titleBugs.push({ id: ids[i % ids.length], x: rand(0, VIEW_W), y: rand(0, VIEW_H), a: rand(0, TAU), s: rand(0.2, 0.5) }); }
    for (const b of this.titleBugs) { b.x += Math.cos(b.a) * b.s; b.y += Math.sin(b.a) * b.s; b.a += Math.sin(t * 0.01 + b.x) * 0.02; if (b.x < -20) b.x = VIEW_W + 20; if (b.x > VIEW_W + 20) b.x = -20; if (b.y < -20) b.y = VIEW_H + 20; if (b.y > VIEW_H + 20) b.y = -20; const bug = BUG_BY_ID[b.id]; c.globalAlpha = 0.55; import('./gfx.js').then?.(() => {}); this._drawBug ||= null; }
    c.globalAlpha = 1;
    // We draw bugs via entities' drawBug import
    for (const b of this.titleBugs) { const bug = BUG_BY_ID[b.id]; c.globalAlpha = 0.5; drawBugTitle(c, bug, b.x, b.y, t, b.a); c.globalAlpha = 1; }
    // hero in the middle bottom
    const { HERO } = heroRef; c.drawImage(HERO[0][Math.floor(t / 12) % 4], 152, 150);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 150, VIEW_W, 90);
  }
  // ---------------- debug ----------------
  debugApi() {
    return {
      game: this, warp: (area, room, tx, ty) => { this.ui.closeAll(); this.state = 'play'; this.enterRoom(area, room, tx !== undefined ? { tile: [tx, ty] } : undefined); },
      give: (id) => this.acquireDrug(id), giveAll: () => { for (const d of DRUGS) { if (!this.inv.drugs.includes(d.id)) { this.inv.drugs.push(d.id); if (d.flags?.doses) this.inv.doses[d.id] = d.flags.doses; this.discovered.drugs.add(d.id); } } this.inv.current = this.inv.drugs[0]; this.inv.tools = { scalpel: true, lens: true, culture: true, clavulanate: true, soap: true, vaccine: true }; this.lensOn = true; },
      god: () => { this.godMode = !this.godMode; return this.godMode; }, flags: () => this.flags, all: () => { this.debugAll = true; }, kill: () => { for (const e of this.enemies) e.die(true); }, heal: () => { this.maxHp = 10; this.hp = 10; }, pearls: (n) => { this.inv.pearls += n; }, keys: (n) => { this.inv.keys[this.areaId] = n; this.inv.bossKeys[this.areaId] = true; },
      spawn: (bugId, x, y, o) => { const e = new Enemy(this, bugId, x, y, o || {}); this.enemies.push(e); return e; },
      sim: (n) => { for (let i = 0; i < n; i++) { this.input.poll(); this.frame++; if (this.ui.open) { this.ui.update(); this.input.endFrame(); continue; } if (this.state === 'play') this.updateWorld(); this.tickFx(); this.input.endFrame(); } },
      hold: (action, n) => { this.input.down.add(action); window.__abq.sim(n); this.input.down.delete(action); },
      press: (action) => { this.input.pressedSet.add(action); this.input.down.add(action); window.__abq.sim(1); this.input.down.delete(action); },
      texts: () => this.texts.map((t) => t.str),
      state: () => ({ state: this.state, area: this.areaId, room: this.room?.id, x: this.player.x, y: this.player.y, hp: this.hp, enemies: this.enemies.length, drugs: this.inv.drugs, open: this.ui.open }),
      closeUI: () => this.ui.closeAll(),
    };
  }
}

// title-screen helpers (avoid circular import weirdness)
import { drawBug as _drawBug, HERO as _HERO } from './gfx.js';
const heroRef = { HERO: _HERO };
function drawBugTitle(c, bug, x, y, t, a) { _drawBug(c, bug, x, y, { t, angle: a, size: bug.size * 1.4 }); }

window.addEventListener('DOMContentLoaded', () => { try { new Game(); } catch (e) { console.error(e); const n = document.getElementById('fallback-note'); if (n) { n.classList.remove('hidden'); n.textContent = 'Failed to start: ' + e.message; } } });
