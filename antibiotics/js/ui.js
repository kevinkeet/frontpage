// ============================================================================
// UI: DOM overlays — dialog, cards, menus, codex, antibiogram, quiz, shop, title
// ============================================================================
import { DRUGS, DRUG_BY_ID, TARGETS, CLASS_COLORS, SPECTRUM_GROUPS } from './data/drugs.js';
import { BUGS, BUG_BY_ID, GRAM, MECHANISMS } from './data/bugs.js';
import { PRINCIPLES } from './data/lessons.js';
import { resolve, sirCategory } from './combat.js';
import { esc, clamp } from './util.js';
import { drawBug, drawItemIcon, drawTargetIcon, mkCanvas, NPCS } from './gfx.js';
import { VERSION } from './const.js';

const gramColor = (b) => (GRAM[b.edu.gram] || GRAM[b.tags[0]])?.color || '#fff';

export class UI {
  constructor(game, root) {
    this.g = game; this.root = root; this.stack = []; // overlay stack: {el, type, onInput, onClose}
    this.toastEl = null; this.toastT = null;
  }
  get open() { return this.stack.length > 0; }
  get top() { return this.stack[this.stack.length - 1]; }
  push(el, o = {}) { this.root.appendChild(el); const ov = { el, ...o }; this.stack.push(ov); return ov; }
  pop() { const ov = this.stack.pop(); if (!ov) return; ov.el.remove(); if (ov.onClose) ov.onClose(); this.g.onOverlayClosed?.(); }
  closeAll() { while (this.stack.length) this.pop(); }
  /** called every frame while an overlay is open; returns true if input consumed */
  update() {
    const ov = this.top; if (!ov) return false;
    if (ov.onInput) ov.onInput(this.g.input);
    return true;
  }

  // ---------------- Dialog ----------------
  dialog(pages, cb, opts = {}) {
    const g = this.g; const el = document.createElement('div'); el.className = 'panel'; el.id = 'dialog';
    let i = 0, charT = 0, shown = 0, choiceIdx = 0, done = false, result = null;
    const render = () => {
      const p = pages[i]; const txt = p.text.slice(0, shown);
      el.innerHTML = `${p.speaker ? `<div class="speaker">${esc(p.speaker)}</div>` : ''}<div class="dtext">${esc(txt)}</div>${shown >= p.text.length && !p.choices ? '<div class="dmore">▼</div>' : ''}`;
      if (p.portrait && NPCS[p.portrait]) { const c = mkCanvas(32, 32); c.getContext('2d').drawImage(NPCS[p.portrait], 0, 0, 16, 16, 0, 0, 32, 32); c.className = 'portrait'; el.appendChild(c); }
      if (p.choices && shown >= p.text.length) {
        const ch = document.createElement('div'); ch.className = 'choices';
        p.choices.forEach((c, k) => { const d = document.createElement('div'); d.className = 'choice' + (k === choiceIdx ? ' sel' : ''); d.textContent = c.label; d.onclick = () => { choiceIdx = k; pick(); }; ch.appendChild(d); });
        el.appendChild(ch);
        const selEl = ch.querySelector('.choice.sel'); if (selEl) { const top = selEl.offsetTop - ch.offsetTop; if (top < ch.scrollTop) ch.scrollTop = top; else if (top + selEl.offsetHeight > ch.scrollTop + ch.clientHeight) ch.scrollTop = top + selEl.offsetHeight - ch.clientHeight; }
      }
    };
    const pick = () => { const p = pages[i]; const c = p.choices[choiceIdx]; result = c.value; if (c.next) { pages = c.next; i = 0; shown = 0; charT = 0; choiceIdx = 0; render(); } else advance(true); };
    const advance = (force) => {
      const p = pages[i];
      if (shown < p.text.length && !force) { shown = p.text.length; render(); return; }
      if (p.choices && !force) { pick(); return; }
      if (i < pages.length - 1) { i++; shown = 0; charT = 0; choiceIdx = 0; render(); }
      else { done = true; this.pop(); if (cb) cb(result); }
    };
    const ov = this.push(el, { type: 'dialog', onInput: (inp) => {
      const p = pages[i];
      if (shown < p.text.length) { charT += opts.fast ? 3 : 1.6; if (charT >= 1) { shown = Math.min(p.text.length, shown + Math.floor(charT)); charT = 0; if (shown % 3 === 0) g.audio.sfx('blip'); render(); } }
      if (p.choices && shown >= p.text.length) {
        if (inp.pressed('up')) { choiceIdx = (choiceIdx + p.choices.length - 1) % p.choices.length; g.audio.sfx('menuMove'); render(); }
        if (inp.pressed('down')) { choiceIdx = (choiceIdx + 1) % p.choices.length; g.audio.sfx('menuMove'); render(); }
      }
      if (inp.pressed('confirm') || inp.pressed('fire')) { inp.consume('confirm'); inp.consume('fire'); g.audio.sfx('menuSel'); advance(); }
      if (inp.pressed('cancel') && !p.choices) { inp.consume('cancel'); shown = p.text.length; render(); }
    } });
    el.onclick = () => advance();
    render();
    return ov;
  }

  // ---------------- Generic card ----------------
  card({ title, subtitle, iconCanvas, html, foot, cls }, cb) {
    const g = this.g; const el = document.createElement('div'); el.className = 'panel card ' + (cls || '');
    el.innerHTML = `<div class="title">${iconCanvas ? '<span class="ic"></span>' : ''}<div><h2>${title}</h2>${subtitle ? `<span class="sub">${subtitle}</span>` : ''}</div></div><div class="body">${html}</div><div class="foot">${foot || 'Z / SPACE / ENTER to continue · ↑↓ scroll'}</div>`;
    if (iconCanvas) el.querySelector('.ic').appendChild(iconCanvas);
    const body = el.querySelector('.body');
    this.push(el, { type: 'card', onInput: (inp) => {
      if (inp.held('down')) body.scrollTop += 3; if (inp.held('up')) body.scrollTop -= 3;
      if (inp.pressed('confirm') || inp.pressed('fire') || inp.pressed('cancel')) { inp.consume('confirm'); inp.consume('fire'); inp.consume('cancel'); g.audio.sfx('menuSel'); this.pop(); if (cb) cb(); }
    } });
    el.onclick = (e) => { if (e.target.closest('.body')) return; this.pop(); if (cb) cb(); };
  }
  drugIcon(d, size = 32) { const c = mkCanvas(size, size); const x = c.getContext('2d'); x.scale(size / 16, size / 16); drawItemIcon(x, 'drug', 8, 8, 0, { color: d.color }); drawTargetIcon(x, d.target, 8, 14, TARGETS[d.target]?.color || '#fff'); return c; }
  bugIcon(b, size = 36) { const c = mkCanvas(size, size); const x = c.getContext('2d'); x.scale(size / 24, size / 24); drawBug(x, b, 12, 12, { t: 30, size: Math.min(14, b.size) }); return c; }
  spectrumChips(d) {
    const g = this.g; const chips = [];
    for (const grp of SPECTRUM_GROUPS) {
      // representative bug per group
      const rep = { gp: 'gas', mrsa: 'mrsa', entero: 'efaecalis', vre: 'vre', gn: 'ecoli', pseudo: 'pseudomonas', anaerobe: 'bfrag', atyp: 'mycoplasma', esbl: 'ecoli_esbl', cre: 'klebsiella_kpc' }[grp.key];
      const b = BUG_BY_ID[rep]; if (!b) continue;
      const env = d.flags?.urineOnly ? { urine: true } : {};
      const r = resolve(d, b, { env }); const cat = sirCategory(r.mult);
      chips.push(`<span class="chip ${cat}" title="${esc(r.reason || '')}">${grp.label}</span>`);
    }
    return `<div class="chips">${chips.join('')}</div>`;
  }
  drugHtml(d, full = true) {
    const tcol = TARGETS[d.target]?.color || '#fff';
    const pk = d.pk === 'time' ? 'Time-dependent (keep levels above MIC)' : 'Concentration-dependent (big peak, post-antibiotic effect)';
    const tier = ['', 'Narrow — low collateral damage', 'Moderate spectrum', 'Broad — significant microbiome cost', 'Last resort — limited doses'][d.tier];
    const tags = `<span class="tag" style="background:${CLASS_COLORS[d.cls] || '#555'};color:#000">${esc(d.clsName)}</span><span class="tag" style="background:${tcol};color:#000">${esc(TARGETS[d.target]?.name || d.target)}</span><span class="tag" style="background:${d.kill === 'cidal' ? '#e63946' : '#90e0ef'};color:#000">${d.kill === 'cidal' ? 'Bactericidal' : 'Bacteriostatic'}</span><span class="tag" style="background:#ffd166;color:#000">Tier ${d.tier}</span>`;
    let h = `<div>${tags}</div>${this.spectrumChips(d)}<p><b>Mechanism:</b> ${esc(d.edu.mech)}</p>`;
    if (full) h += `<p><b>Spectrum:</b> ${esc(d.edu.spec)}</p><p><b>Resistance:</b> ${esc(d.edu.res)}</p><p><b>Clinical uses:</b> ${esc(d.edu.uses)}</p><p><b>Toxicity:</b> ${esc(d.edu.tox)}</p><p><b>PK/PD:</b> ${pk}. <b>Stewardship:</b> ${tier}.</p><p style="color:var(--blue)"><b>Pearl:</b> ${esc(d.edu.pearl)}</p>`;
    const blocked = Object.keys(d.blockedBy || {}).filter((m) => MECHANISMS[m]).map((m) => esc(MECHANISMS[m].name));
    if (full && blocked.length) h += `<p><small><b>Defeated by:</b> ${blocked.join(' · ')}</small></p>`;
    return h;
  }
  drugCard(id, cb, intro) {
    const d = DRUG_BY_ID[id]; if (!d) { cb?.(); return; }
    const html = (intro ? `<p style="color:var(--gold)">${esc(intro)}</p>` : '') + this.drugHtml(d);
    this.card({ title: esc(d.name), subtitle: `${esc(d.clsName)} · ${d.kill === 'cidal' ? 'bactericidal' : 'bacteriostatic'}`, iconCanvas: this.drugIcon(d), html }, cb);
  }
  bugHtml(b, full = true) {
    const gc = gramColor(b); const gl = (GRAM[b.edu.gram] || {}).label || b.edu.gram;
    let h = `<div><span class="tag" style="background:${gc};color:#000">${esc(gl)}</span>${(b.traits || []).filter((t) => MECHANISMS[t]).map((t) => `<span class="tag" style="background:#555">${esc(MECHANISMS[t].name)}</span>`).join('')}${(b.resist || []).map((m) => `<span class="tag" style="background:#9e2a2b">${esc(MECHANISMS[m]?.name || m)}</span>`).join('')}</div>`;
    h += `<p><b>Morphology:</b> ${esc(b.edu.morph)}</p>`;
    if (full) h += `<p><b>Diseases:</b> ${esc(b.edu.diseases)}</p><p><b>Treatment:</b> ${esc(b.edu.first)}</p><p><b>Resistance:</b> ${esc(b.edu.resistance)}</p><p style="color:var(--blue)"><b>Pearl:</b> ${esc(b.edu.pearl)}</p>`;
    if (full && b.edu.sites?.length) h += `<p><b>Sites of infection:</b> ${b.edu.sites.map((x) => esc(x)).join(' · ')}</p>`;
    if (full && b.edu.mnemonic) h += `<p style="color:var(--gold)"><b>Remember:</b> ${esc(b.edu.mnemonic)}</p>`;
    if (full && b.edu.quirks?.length) h += `<h3>Board details</h3><ul class="quirks">${b.edu.quirks.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>`;
    if (full) {
      // what works (from the engine) — S drugs
      const env = ['ecoli', 'ecoli_tem', 'ecoli_esbl', 'proteus', 'klebsiella', 'efaecalis', 'vre'].includes(b.id) ? {} : {};
      const S = DRUGS.filter((d) => resolve(d, b, { env }).mult >= 0.8 && !d.flags?.urineOnly).map((d) => d.short);
      const U = DRUGS.filter((d) => d.flags?.urineOnly && resolve(d, b, { env: { urine: true } }).mult >= 0.8).map((d) => d.short);
      h += `<p><small><b>Active in-game:</b> ${S.join(', ') || 'nothing you carry'}${U.length ? ` · <b>in urine:</b> ${U.join(', ')}` : ''}</small></p>`;
    }
    return h;
  }
  bugCard(id, cb) { const b = BUG_BY_ID[id]; if (!b) { cb?.(); return; } this.card({ title: esc(b.name), subtitle: esc(b.aka), iconCanvas: this.bugIcon(b), html: this.bugHtml(b) }, cb); }
  siteCard(site, cb, intro) {
    const html = `${intro ? `<p style="color:var(--gold)">${esc(intro)}</p>` : ''}<p><b>Usual organisms:</b> ${esc(site.bugs)}</p><p><b>Empiric therapy:</b> ${esc(site.empiric)}</p><p style="color:var(--blue)"><b>Pearls:</b> ${esc(site.pearls)}</p>`;
    this.card({ title: esc(site.name), subtitle: 'Site of infection — who lives there and what to start', html, cls: 'lesson' }, cb);
  }
  lessonCard(title, bullets, cb, sub) { this.card({ title: esc(title), subtitle: sub || 'Rounds recap — what you just learned', html: `<div class="lesson"><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul></div>`, cls: 'lesson' }, cb); }
  itemCard(title, sub, html, cb, iconType, color) { const c = mkCanvas(32, 32); const x = c.getContext('2d'); x.scale(2, 2); drawItemIcon(x, iconType || 'star', 8, 8, 0, { color }); this.card({ title: esc(title), subtitle: sub, iconCanvas: c, html }, cb); }

  // ---------------- Toast / banner ----------------
  toast(msg, ms = 2200) {
    if (this.toastEl) this.toastEl.remove();
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; this.root.appendChild(el); this.toastEl = el;
    clearTimeout(this.toastT); this.toastT = setTimeout(() => { el.remove(); if (this.toastEl === el) this.toastEl = null; }, ms);
  }
  banner(title, sub, ms = 2600) {
    const el = document.createElement('div'); el.className = 'banner'; el.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`; this.root.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  // ---------------- Title ----------------
  title(hasSave, cb) {
    const el = document.createElement('div'); el.id = 'title';
    const items = [{ id: 'continue', label: 'CONTINUE', disabled: !hasSave }, { id: 'new', label: 'NEW GAME' }, { id: 'codex', label: 'CODEX' }, { id: 'how', label: 'HOW TO PLAY' }];
    let idx = hasSave ? 0 : 1;
    const render = () => { el.innerHTML = `<div class="logo"><div class="l1">ANTIBIOTIC QUEST</div><div class="l2">A LEGEND OF RESISTANCE</div></div><div class="menu-items">${items.map((it, i) => `<div class="mi ${i === idx ? 'sel' : ''} ${it.disabled ? 'disabled' : ''}" data-i="${i}">${it.label}</div>`).join('')}</div><div class="version">v${VERSION}</div><div class="credit">kevinkeet.com</div>`; el.querySelectorAll('.mi').forEach((m) => m.onclick = () => { idx = +m.dataset.i; choose(); }); };
    const choose = () => { const it = items[idx]; if (it.disabled) { this.g.audio.sfx('error'); return; } this.g.audio.sfx('menuSel'); cb(it.id); };
    this.push(el, { type: 'title', onInput: (inp) => {
      if (inp.pressed('up')) { do { idx = (idx + items.length - 1) % items.length; } while (items[idx].disabled); this.g.audio.sfx('menuMove'); render(); }
      if (inp.pressed('down')) { do { idx = (idx + 1) % items.length; } while (items[idx].disabled); this.g.audio.sfx('menuMove'); render(); }
      if (inp.pressed('confirm') || inp.pressed('fire')) { inp.consume('confirm'); inp.consume('fire'); choose(); }
    } });
    render();
  }
  howTo(cb) {
    const html = `<p><b>Move</b> <span class="kbd">WASD</span>/<span class="kbd">↑↓←→</span> &nbsp; <b>Fire antibiotic</b> <span class="kbd">Z</span>/<span class="kbd">J</span>/<span class="kbd">SPACE</span> (hold to keep dosing)</p>
<p><b>Tool</b> (scalpel / lens) <span class="kbd">X</span>/<span class="kbd">K</span> &nbsp; <b>Switch drug</b> <span class="kbd">Q</span>/<span class="kbd">E</span> or <span class="kbd">1-9</span> &nbsp; <b>Menu / Codex</b> <span class="kbd">TAB</span>/<span class="kbd">I</span>/<span class="kbd">ENTER</span> &nbsp; <b>Pause</b> <span class="kbd">ESC</span></p>
<p>Gamepads and touch screens work too.</p>
<p><b>The idea:</b> every enemy is a real bacterium and every weapon is a real antibiotic. When a shot bounces off, the game tells you <b>why</b> — that reason is the lesson. Your <b>neutrophil</b> companion eats bugs you’ve frozen with bacteriostatic drugs.</p>
<p><b>Stewardship:</b> broad-spectrum drugs drain the <b>microbiome</b> bar. Empty it and <b>C. difficile</b> blooms. Narrow is beautiful.</p>
<p><b>Goal:</b> clear the eight infected organs, collect the formulary, fill in your <b>antibiogram</b>, and defeat the pan-resistant Klebsiella in the Resistance Nexus.</p>`;
    this.card({ title: 'HOW TO PLAY', subtitle: 'It’s dangerous to go alone — take this tutorial', html }, cb);
  }

  // ---------------- Pause / inventory menu ----------------
  menu(startTab = 'drugs') {
    const g = this.g; const el = document.createElement('div'); el.className = 'panel menu';
    const tabs = [['drugs', 'DRUGS'], ['tools', 'ITEMS'], ['bugs', 'BUGS'], ['abg', 'ABG'], ['learn', 'LEARN'], ['settings', 'OPTS']];
    let tab = startTab, sel = 0, lists = {};
    const render = () => {
      el.innerHTML = `<div class="tabs">${tabs.map(([id, l]) => `<div class="tab ${tab === id ? 'on' : ''}" data-t="${id}">${l}</div>`).join('')}</div><div class="content"></div><div class="hint">◀ ▶ tabs · ↑↓ select · Z/ENTER details · X/ESC close</div>`;
      el.querySelectorAll('.tab').forEach((t) => t.onclick = () => { tab = t.dataset.t; sel = 0; render(); });
      const content = el.querySelector('.content');
      const mk = (html) => { content.innerHTML = html; };
      if (tab === 'drugs') {
        const owned = g.inv.drugs.map((id) => DRUG_BY_ID[id]).filter(Boolean);
        const cur = owned[sel] || null;
        mk(`<div class="list">${owned.map((d, i) => `<div class="row ${i === sel ? 'sel' : ''} ${d.id === g.inv.current ? 'cur' : ''}" data-i="${i}"><span class="sw" style="background:${d.color}"></span>${d.id === g.inv.current ? '▸ ' : ''}${esc(d.short)} <small>${esc(d.name.split(' / ')[0].slice(0, 18))}</small>${g.inv.doses[d.id] !== undefined ? ` <small>×${g.inv.doses[d.id]}</small>` : ''}</div>`).join('') || '<div class="row">No antibiotics yet.</div>'}</div><div class="detail">${cur ? `<h2>${esc(cur.name)}</h2>${this.drugHtml(cur, true)}<p><small>ENTER/Z: equip</small></p>` : '<p>Find Professor Fleming in the Dermis Plains.</p>'}</div>`);
        content.querySelectorAll('.row').forEach((r) => { r.onclick = () => { sel = +r.dataset.i; if (owned[sel]) { g.equip(owned[sel].id); } render(); }; });
        lists.n = owned.length; lists.enter = () => { if (owned[sel]) { g.equip(owned[sel].id); g.audio.sfx('menuSel'); render(); } };
      } else if (tab === 'tools') {
        const items = [];
        const T = g.inv.tools;
        if (T.scalpel) items.push(['Scalpel (source control)', 'Tool: X. Drains abscesses, cuts biofilm-sealed passages. Antibiotics can’t penetrate pus — drain it.', 'scalpel']);
        if (T.lens) items.push(['Gram Stain Lens', 'Tool: X toggles labels over every organism. Purple = gram-positive, pink = gram-negative, blue = atypical.', 'lens']);
        if (T.culture) items.push(['Culture & Sensitivity Kit', 'When you open the bestiary from the menu, susceptible drugs are listed. Cultures turn guessing into knowing.', 'culture']);
        if (T.clavulanate) items.push(['β-lactamase inhibitor (clavulanate)', 'Bound to your aminopenicillin → Amoxicillin-clavulanate. Suicide inhibitor of class A β-lactamases.', 'clavulanate']);
        if (T.vaccine) items.push(['Vaccine card', 'Pneumococcal/meningococcal/Hib vaccines: encapsulated organisms do 50% less contact damage to you.', 'vaccine']);
        if (T.soap) items.push(['Soap & water', 'Spores die to soap, not alcohol gel. Spores you walk over are scrubbed instead of hurting you.', 'soap']);
        items.push([`Pearls: ${g.inv.pearls}`, 'Clinical pearls — currency at the pharmacy.', 'pearl']);
        items.push([`IV fluids: ${g.inv.potions}`, 'Use from this menu (ENTER) to restore all hearts.', 'potion']);
        items.push([`Heart pieces: ${g.inv.heartPieces % 4}/4`, 'Four pieces make a new heart container.', 'heartPiece']);
        const keys = Object.entries(g.inv.keys).filter(([k, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', ');
        if (keys) items.push([`Keys: ${keys}`, 'Small keys open locked doors in their dungeon.', 'key']);
        const cur = items[sel] || items[0];
        mk(`<div class="list">${items.map((it, i) => `<div class="row ${i === sel ? 'sel' : ''}" data-i="${i}">${esc(it[0])}</div>`).join('')}</div><div class="detail">${cur ? `<h2>${esc(cur[0])}</h2><p>${esc(cur[1])}</p>` : ''}</div>`);
        content.querySelectorAll('.row').forEach((r) => { r.onclick = () => { sel = +r.dataset.i; render(); }; });
        lists.n = items.length; lists.enter = () => { const it = items[sel]; if (it && it[2] === 'potion') { if (g.usePotion()) render(); } };
      } else if (tab === 'bugs') {
        const seen = BUGS.filter((b) => g.discovered.bugs.has(b.id) || g.debugAll);
        const all = BUGS.filter((b) => !b.codexOnly || g.discovered.bugs.has(b.id) || g.debugAll);
        const list = all.map((b) => ({ b, known: seen.includes(b) }));
        const cur = list[sel];
        mk(`<div class="list">${list.map((it, i) => `<div class="row ${i === sel ? 'sel' : ''} ${it.known ? '' : 'locked'}" data-i="${i}"><span class="sw" style="background:${gramColor(it.b)}"></span>${it.known ? esc(it.b.aka || it.b.name) : '???'}</div>`).join('')}</div><div class="detail">${cur ? (cur.known ? `<h2>${esc(cur.b.name)}</h2>${this.bugHtml(cur.b, true)}` : '<p>Not yet encountered.</p>') : ''}</div>`);
        content.querySelectorAll('.row').forEach((r) => { r.onclick = () => { sel = +r.dataset.i; render(); }; });
        lists.n = list.length; lists.enter = () => {};
      } else if (tab === 'abg') {
        const drugs = DRUGS.filter((d) => g.inv.drugs.includes(d.id) || g.debugAll);
        const bugs = BUGS.filter((b) => (g.discovered.bugs.has(b.id) || g.debugAll) && !b.tags.includes('virus'));
        let rows = bugs.map((b) => `<tr><th class="rowh">${esc((b.aka || b.name).slice(0, 18))}</th>${drugs.map((d) => { const k = `${d.id}|${b.id}`; const v = g.antibiogram[k]; return `<td class="${v || 'u'}" title="${esc(d.short)} vs ${esc(b.aka || b.name)}: ${v ? ({ S: 'Susceptible', I: 'Intermediate', R: 'Resistant', X: 'Immune / no activity' })[v] : 'untested — try it!'}">${v || '·'}</td>`; }).join('')}</tr>`).join('');
        const filled = Object.keys(g.antibiogram).length, total = drugs.length * bugs.length;
        mk(`<div style="display:flex;flex-direction:column;flex:1;min-height:0"><div class="abg-wrap"><table class="abg"><tr><th></th>${drugs.map((d) => `<th title="${esc(d.name)}">${esc(d.short)}</th>`).join('')}</tr>${rows}</table></div><div class="legend">Your antibiogram fills in as you fire drugs at bugs: ${filled}/${total || 0} cells known. <span style="background:#2d8a5a"></span>S <span style="background:#b58900"></span>I <span style="background:#9e2a2b"></span>R <span style="background:#3a3a3a"></span>no activity</div></div>`);
        lists.n = 0; lists.enter = () => {};
      } else if (tab === 'learn') {
        const cur = PRINCIPLES[sel];
        mk(`<div class="list">${PRINCIPLES.map((p, i) => `<div class="row ${i === sel ? 'sel' : ''}" data-i="${i}">${esc(p.title)}</div>`).join('')}</div><div class="detail">${cur ? `<h2>${esc(cur.title)}</h2>${cur.html}` : ''}</div>`);
        content.querySelectorAll('.row').forEach((r) => { r.onclick = () => { sel = +r.dataset.i; render(); }; });
        lists.n = PRINCIPLES.length; lists.enter = () => {};
      } else if (tab === 'settings') {
        const s = g.settings;
        const rows = [['Music volume', `${Math.round(s.music * 100)}%`], ['Sound volume', `${Math.round(s.sfx * 100)}%`], ['Screen shake', s.shake ? 'ON' : 'OFF'], ['Difficulty', s.difficulty], ['Save game', 'ENTER'], ['Quit to title', 'ENTER']];
        mk(`<div class="settings" style="flex:1">${rows.map((r, i) => `<div class="srow ${i === sel ? 'sel' : ''}" data-i="${i}"><span>${r[0]}</span><span class="val">${r[1]}</span></div>`).join('')}<p style="margin-top:10px"><small>◀ ▶ to change values. Progress auto-saves when you change rooms.</small></p></div>`);
        content.querySelectorAll('.srow').forEach((r) => { r.onclick = () => { sel = +r.dataset.i; lists.enter(); render(); }; });
        lists.n = rows.length;
        lists.left = (d) => { if (sel === 0) s.music = clamp(Math.round((s.music + d * 0.1) * 10) / 10, 0, 1); if (sel === 1) s.sfx = clamp(Math.round((s.sfx + d * 0.1) * 10) / 10, 0, 1); if (sel === 2) s.shake = !s.shake; if (sel === 3) { const ds = ['Student', 'Resident', 'Attending']; s.difficulty = ds[(ds.indexOf(s.difficulty) + d + 3) % 3]; } g.applySettings(); render(); };
        lists.enter = () => { if (sel === 2) { s.shake = !s.shake; g.applySettings(); render(); } if (sel === 4) { g.save(true); this.toast('Saved.'); } if (sel === 5) { this.closeAll(); g.toTitle(); } };
      }
    };
    const ov = this.push(el, { type: 'menu', onInput: (inp) => {
      const ti = tabs.findIndex(([id]) => id === tab);
      if (inp.pressed('right') && !(tab === 'settings')) { tab = tabs[(ti + 1) % tabs.length][0]; sel = 0; g.audio.sfx('menuMove'); render(); }
      if (inp.pressed('left') && !(tab === 'settings')) { tab = tabs[(ti + tabs.length - 1) % tabs.length][0]; sel = 0; g.audio.sfx('menuMove'); render(); }
      if (tab === 'settings') { if (inp.pressed('right')) lists.left?.(1); if (inp.pressed('left')) lists.left?.(-1); }
      if (inp.pressed('next')) { tab = tabs[(ti + 1) % tabs.length][0]; sel = 0; render(); }
      if (inp.pressed('prev')) { tab = tabs[(ti + tabs.length - 1) % tabs.length][0]; sel = 0; render(); }
      if (inp.pressed('down') && lists.n) { sel = (sel + 1) % lists.n; g.audio.sfx('menuMove'); render(); }
      if (inp.pressed('up') && lists.n) { sel = (sel + lists.n - 1) % lists.n; g.audio.sfx('menuMove'); render(); }
      if (inp.pressed('confirm') || inp.pressed('fire')) { inp.consume('confirm'); inp.consume('fire'); lists.enter?.(); }
      if (inp.pressed('cancel') || inp.pressed('menu') || inp.pressed('pause')) { inp.consume('cancel'); inp.consume('menu'); inp.consume('pause'); g.audio.sfx('menuBack'); this.pop(); }
    } });
    render();
    return ov;
  }

  // ---------------- Quiz ----------------
  quiz(set, cb) {
    const g = this.g; const el = document.createElement('div'); el.className = 'panel card quiz';
    let qi = 0, sel = 0, answered = false, correct = 0;
    const render = () => {
      const q = set.questions[qi];
      el.innerHTML = `<div class="title"><div><h2>${esc(set.title || 'ATTENDING ROUNDS')}</h2><span class="sub">Question ${qi + 1} of ${set.questions.length} · ${correct} correct</span></div></div><div class="body"><div class="q">${esc(q.q)}</div>${q.opts.map((o, i) => `<div class="opt ${i === sel ? 'sel' : ''} ${answered ? (i === q.a ? 'right' : (i === sel ? 'wrong' : '')) : ''}" data-i="${i}">${String.fromCharCode(65 + i)}. ${esc(o)}</div>`).join('')}${answered ? `<div class="expl">${sel === q.a ? '✔ Correct. ' : '✘ Not quite. '}${esc(q.why)}</div>` : ''}</div><div class="foot">${answered ? 'Z/ENTER: next' : '↑↓ choose · Z/ENTER answer'}</div>`;
      el.querySelectorAll('.opt').forEach((o) => o.onclick = () => { if (answered) return; sel = +o.dataset.i; answer(); });
    };
    const answer = () => { const q = set.questions[qi]; answered = true; if (sel === q.a) { correct++; g.audio.sfx('quizRight'); } else g.audio.sfx('quizWrong'); render(); };
    const next = () => { if (qi < set.questions.length - 1) { qi++; sel = 0; answered = false; render(); } else { this.pop(); cb(correct, set.questions.length); } };
    this.push(el, { type: 'quiz', onInput: (inp) => {
      const q = set.questions[qi];
      if (!answered) {
        if (inp.pressed('down')) { sel = (sel + 1) % q.opts.length; g.audio.sfx('menuMove'); render(); }
        if (inp.pressed('up')) { sel = (sel + q.opts.length - 1) % q.opts.length; g.audio.sfx('menuMove'); render(); }
        if (inp.pressed('confirm') || inp.pressed('fire')) { inp.consume('confirm'); inp.consume('fire'); answer(); }
      } else if (inp.pressed('confirm') || inp.pressed('fire')) { inp.consume('confirm'); inp.consume('fire'); next(); }
    } });
    render();
  }

  // ---------------- Shop ----------------
  shop(title, items, cb) {
    const g = this.g; const el = document.createElement('div'); el.className = 'panel card shop'; let sel = 0;
    const render = () => {
      el.innerHTML = `<div class="title"><div><h2>${esc(title)}</h2><span class="sub">You have ${g.inv.pearls} pearls · ↑↓ choose · Z buy · X leave</span></div></div><div class="body">${items.map((it, i) => `<div class="item ${i === sel ? 'sel' : ''} ${it.price > g.inv.pearls || it.soldOut?.() ? 'cant' : ''}" data-i="${i}"><span>${esc(it.label)}${it.soldOut?.() ? ' (sold out)' : ''}</span><span class="price">${it.price} ◆</span></div>`).join('')}<div class="desc">${esc(items[sel]?.desc || '')}</div></div><div class="foot">Pearls drop from defeated organisms.</div>`;
      el.querySelectorAll('.item').forEach((o) => o.onclick = () => { sel = +o.dataset.i; buy(); });
    };
    const buy = () => { const it = items[sel]; if (!it) return; if (it.soldOut?.()) { g.audio.sfx('error'); return; } if (g.inv.pearls < it.price) { g.audio.sfx('error'); this.toast('Not enough pearls.'); return; } g.inv.pearls -= it.price; g.audio.sfx('pickup'); it.buy(); render(); };
    this.push(el, { type: 'shop', onInput: (inp) => {
      if (inp.pressed('down')) { sel = (sel + 1) % items.length; g.audio.sfx('menuMove'); render(); }
      if (inp.pressed('up')) { sel = (sel + items.length - 1) % items.length; g.audio.sfx('menuMove'); render(); }
      if (inp.pressed('confirm') || inp.pressed('fire')) { inp.consume('confirm'); inp.consume('fire'); buy(); }
      if (inp.pressed('cancel')) { inp.consume('cancel'); this.pop(); cb?.(); }
    } });
    render();
  }

  // ---------------- Game over ----------------
  gameOver(cb) {
    const el = document.createElement('div'); el.className = 'panel card'; el.style.background = 'rgba(20,0,0,0.95)';
    el.innerHTML = `<div class="title"><div><h2 style="color:var(--red)">THE INFECTION WON</h2><span class="sub">Sepsis. But medicine is iterative — try again.</span></div></div><div class="body"><p>You fall. The organisms multiply unopposed.</p><p><b>Tip:</b> ${esc(this.g.deathTip())}</p></div><div class="foot">Z/ENTER: continue from last room · saves are kept</div>`;
    this.push(el, { type: 'gameover', onInput: (inp) => { if (inp.pressed('confirm') || inp.pressed('fire')) { inp.consume('confirm'); inp.consume('fire'); this.pop(); cb(); } } });
  }
}
