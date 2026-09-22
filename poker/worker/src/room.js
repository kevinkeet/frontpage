/**
 * Hold'em Coach home game: one Durable Object per table.
 *
 * The room deals the cards, holds the deck and runs the hand. Each player gets a
 * view of the hand over a WebSocket that contains only their own hole cards (and
 * cards shown at showdown). Empty seats are played by the same bots as the solo
 * game: the engine (evaluator, charts, bot decisions) is extracted from
 * poker/index.html at build time, see scripts/build-engine.mjs.
 *
 * Client -> server   {t:'hello',pass,pid,name,avatar}  first message, required
 *                    {t:'start'}                       host: leave the lobby and deal
 *                    {t:'act',seq,type,to}             fold | check | call | bet | raise
 *                    {t:'next'}                        ready for the next hand
 *                    {t:'chat',text}                   table chat
 *                    {t:'leave'}                       give up the seat (a bot takes it)
 *                    {t:'again'}                       host: back to the lobby after a sit & go
 *                    {t:'ping'}
 * Server -> client   {t:'room',...}  roster, phase, chat backlog
 *                    {t:'state',G,turn}  the hand as this player may see it (they are seat 0)
 *                    {t:'chat',...}  {t:'error',code,msg}  {t:'pong'}
 */
import P from './engine.generated.js';

const BOTS = [{ n: 'Maya', style: 'normal' }, { n: 'Dev', style: 'station' }, { n: 'Rosa', style: 'nit' }, { n: 'Ken', style: 'normal' }, { n: 'Lou', style: 'maniac' }];
const POS_BY_N = { 6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'], 5: ['BTN', 'SB', 'BB', 'HJ', 'CO'], 4: ['BTN', 'SB', 'BB', 'CO'], 3: ['BTN', 'SB', 'BB'], 2: ['BTN', 'BB'] };
const LEVELS = [[10, 20, 0], [15, 30, 0], [20, 40, 0], [30, 60, 0], [50, 100, 10], [75, 150, 15], [100, 200, 25], [150, 300, 30], [200, 400, 50], [300, 600, 75], [400, 800, 100], [500, 1000, 125], [700, 1400, 175], [1000, 2000, 250], [1500, 3000, 400], [2000, 4000, 500], [3000, 6000, 750]];
const SNG = { chips: 1500, handsPerLevel: 8 };
const SEATS = 6, CASH_STACK = 100;
const TURN_MS = 45_000, AWAY_TURN_MS = 5_000, BOT_MS = 1_100, STREET_MS = 900, NEXT_HAND_MS = 20_000, ROOM_TTL_MS = 24 * 3600_000;
const AV = {
  hair: ['short', 'bob', 'long', 'bun', 'curly', 'spiky', 'bald'], acc: ['none', 'glasses', 'shades', 'cap', 'headphones', 'visor'],
  eyes: ['open', 'happy', 'narrow'], mouth: ['smile', 'flat', 'grin', 'smirk'],
};

const r1 = x => Math.round(x * 10) / 10;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function timingSafeEqual(a, b) {
  const enc = new TextEncoder(); const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
/* Everything a player sends is shown to other players, so it is reduced to safe values here. */
function cleanName(s) {
  s = String(s || '').normalize('NFKC').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  if (!s || /^you$/i.test(s)) s = 'Player';
  return s;
}
function cleanAvatar(a) {
  const hex = v => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : null;
  const pick = (v, list) => list.includes(v) ? v : list[0];
  a = a && typeof a === 'object' ? a : {};
  return { bg: hex(a.bg) || '#b98a2a', skin: hex(a.skin) || '#eebf98', hc: hex(a.hc) || '#4a2f1d', shirt: hex(a.shirt) || '#2e6b4e', hair: pick(a.hair, AV.hair), acc: pick(a.acc, AV.acc), eyes: pick(a.eyes, AV.eyes), mouth: pick(a.mouth, AV.mouth) };
}
function cleanChat(s) { return String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200); }

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.conns = new Map();      // WebSocket -> {authed, pid, name, avatar, chatAt:[]}
    this.room = null; this.G = null; this.looping = false; this.pending = null; this.turn = null; this.seq = 0; this.ready = new Set(); this.wakeNext = null;
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || null;
      if (this.room) for (const s of this.room.seats) s.connected = false;
    });
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/init') {
      if (this.room) return new Response('exists', { status: 409 });
      const b = await req.json();
      this.room = { code: b.code, format: b.format === 'sng' ? 'sng' : 'cash', phase: 'lobby', hostPid: null, created: Date.now(), handNo: 0, dealerSid: -1, T: null, out: [], chat: [], joins: [],
        seats: Array.from({ length: SEATS }, (_, id) => ({ id, kind: 'empty' })) };
      await this.save();
      return new Response('ok');
    }
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      const pair = new WebSocketPair(); const client = pair[0], server = pair[1];
      server.accept(); this.attach(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('not found', { status: 404 });
  }
  async alarm() { /* rooms clean themselves up a day after the last hand */
    for (const ws of this.conns.keys()) { try { ws.close(1000, 'table closed'); } catch (e) {} }
    this.room = null; await this.ctx.storage.deleteAll();
  }
  nap(ms) { return sleep(this.env.FAST_TIMERS ? ms * 0.02 : ms); }   /* FAST_TIMERS is for local tests only (.dev.vars) */
  async save() { if (!this.room) return; this.room.touched = Date.now(); await this.ctx.storage.put('room', this.room); await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS); }

  /* ---------- connections ---------- */
  attach(ws) {
    const c = { authed: false, pid: null, name: '', avatar: null, chatAt: [] }; this.conns.set(ws, c);
    const hello = setTimeout(() => { if (!c.authed) this.drop(ws, 'hello', 'Did not say hello in time.'); }, 10_000);
    ws.addEventListener('message', e => { try { this.onMessage(ws, c, e.data); } catch (err) { console.error('message failed', err && err.stack || err); } });
    const gone = () => { clearTimeout(hello); this.onClose(ws, c); };
    ws.addEventListener('close', gone); ws.addEventListener('error', gone);
  }
  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }
  drop(ws, code, msg) { this.send(ws, { t: 'error', code, msg }); try { ws.close(1008, code); } catch (e) {} this.conns.delete(ws); }
  seatOf(pid) { return this.room ? this.room.seats.find(s => s.kind === 'human' && s.pid === pid) || null : null; }
  humansConnected() { return this.room.seats.some(s => s.kind === 'human' && s.connected); }

  onMessage(ws, c, raw) {
    if (typeof raw !== 'string' || raw.length > 4000) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') return this.send(ws, { t: 'pong' });
    if (m.t === 'hello') return this.onHello(ws, c, m);
    if (!c.authed) return;
    const seat = this.seatOf(c.pid);
    if (m.t === 'chat') return this.onChat(c, seat, m);
    if (m.t === 'start') { if (c.pid === this.room.hostPid && this.room.phase === 'lobby') this.startGame(); return; }
    if (m.t === 'again') { if (c.pid === this.room.hostPid && this.room.phase === 'over') this.backToLobby(); return; }
    if (m.t === 'next') { if (seat) { this.ready.add(seat.id); if (this.wakeNext) this.wakeNext(); } return; }
    if (m.t === 'leave') { if (seat) this.leave(seat); try { ws.close(1000, 'left'); } catch (e) {} return; }
    if (m.t === 'act') { if (seat) this.onAct(seat, m); return; }
  }
  onHello(ws, c, m) {
    if (c.authed) return;
    if (!this.env.SITE_PASSWORD || typeof m.pass !== 'string' || !timingSafeEqual(m.pass, this.env.SITE_PASSWORD)) return this.drop(ws, 'bad-pass', 'Wrong table password.');
    if (!this.room) return this.drop(ws, 'no-room', 'There is no table with that code. Check the code, or ask the host for a new one.');
    if (typeof m.pid !== 'string' || !/^[A-Za-z0-9_-]{8,40}$/.test(m.pid)) return this.drop(ws, 'bad-id', 'Bad player id.');
    c.pid = m.pid; c.avatar = cleanAvatar(m.avatar); c.authed = true;
    for (const [other, oc] of this.conns) if (other !== ws && oc.pid === c.pid) { this.conns.delete(other); try { other.close(1000, 'replaced'); } catch (e) {} }
    const R = this.room; let seat = this.seatOf(c.pid);
    if (seat) { seat.connected = true; seat.missed = 0; seat.avatar = c.avatar; c.name = seat.name; }
    else {
      c.name = this.uniqueName(cleanName(m.name));
      if (!R.hostPid) R.hostPid = c.pid;
      if (R.phase === 'lobby') {
        const free = R.seats.find(s => s.kind === 'empty');
        if (!free) return this.drop(ws, 'full', 'This table is full.');
        Object.assign(free, this.humanSeat(c));
      } else if (R.phase === 'playing' && R.format === 'cash') {
        if (R.joins.length >= R.seats.filter(s => s.kind !== 'human').length) return this.drop(ws, 'full', 'This table is full.');
        if (!R.joins.some(j => j.pid === c.pid)) R.joins.push({ pid: c.pid, name: c.name, avatar: c.avatar });
      } /* a sit & go in progress can only be watched */
    }
    /* someone came back while it was their turn: give them time to act */
    if (seat && this.pending && this.pending.sid === seat.id) this.armTurn(TURN_MS);
    this.save(); this.broadcastRoom(); if (this.G) this.send(ws, this.stateFor(c.pid));
    if (R.phase === 'playing') this.runLoop();
  }
  humanSeat(c) { return { kind: 'human', pid: c.pid, name: c.name, avatar: c.avatar, style: 'human', stack: CASH_STACK, chips: SNG.chips, buyins: 1, connected: true, missed: 0, out: false }; }
  uniqueName(name) {
    const taken = new Set(this.room.seats.filter(s => s.kind !== 'empty').map(s => s.name.toLowerCase()).concat(BOTS.map(b => b.n.toLowerCase()), this.room.joins.map(j => j.name.toLowerCase())));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 99; i++) { const n = name.slice(0, 10) + i; if (!taken.has(n.toLowerCase())) return n; }
    return 'Player' + Math.floor(Math.random() * 1000);
  }
  onClose(ws, c) {
    if (!this.conns.has(ws)) return; this.conns.delete(ws);
    if (!c.authed || !this.room) return;
    if ([...this.conns.values()].some(o => o.pid === c.pid)) return;
    this.room.joins = this.room.joins.filter(j => j.pid !== c.pid);
    const seat = this.seatOf(c.pid); if (!seat) return;
    seat.connected = false;
    if (this.room.phase === 'lobby') { this.freeSeat(seat); if (this.room.hostPid === c.pid) this.passHost(); }
    else if (this.pending && this.pending.sid === seat.id) this.armTurn(AWAY_TURN_MS);
    if (this.wakeNext) this.wakeNext();
    this.broadcastRoom();
  }
  passHost() { const next = this.room.seats.find(s => s.kind === 'human' && s.connected); this.room.hostPid = next ? next.pid : null; }
  freeSeat(seat) { const id = seat.id; for (const k of Object.keys(seat)) delete seat[k]; seat.id = id; seat.kind = 'empty'; }
  leave(seat) {
    const R = this.room; const wasHost = R.hostPid === seat.pid;
    if (R.phase === 'lobby' || R.phase === 'over') this.freeSeat(seat);
    else { seat.connected = false; seat.leaving = true; if (this.pending && this.pending.sid === seat.id) this.resolveTurn(null); }
    if (wasHost) this.passHostFrom(seat);
    this.save(); this.broadcastRoom();
  }
  passHostFrom(old) { const next = this.room.seats.find(s => s.kind === 'human' && s.connected && s !== old && !s.leaving); this.room.hostPid = next ? next.pid : null; }

  onChat(c, seat, m) {
    const text = cleanChat(m.text); if (!text) return;
    const now = Date.now(); c.chatAt = c.chatAt.filter(t => now - t < 10_000); if (c.chatAt.length >= 6) return; c.chatAt.push(now);
    const msg = { t: 'chat', name: c.name, sid: seat ? seat.id : null, text, ts: now };
    this.room.chat.push({ name: msg.name, sid: msg.sid, text, ts: now }); if (this.room.chat.length > 50) this.room.chat.splice(0, this.room.chat.length - 50);
    for (const [ws, oc] of this.conns) if (oc.authed) this.send(ws, msg);
  }

  /* ---------- lobby ---------- */
  roomFor(pid) {
    const R = this.room; const me = this.seatOf(pid);
    return { t: 'room', code: R.code, format: R.format, phase: R.phase, host: R.hostPid === pid, you: me ? me.id : null, waiting: R.joins.some(j => j.pid === pid), handNo: R.handNo,
      seats: R.seats.map(s => s.kind === 'empty' ? { id: s.id, kind: 'empty' } : { id: s.id, kind: s.kind, name: s.name, style: s.style, avatar: s.avatar || null, connected: s.kind === 'bot' || !!s.connected, host: s.kind === 'human' && s.pid === R.hostPid, stack: s.stack, chips: s.chips, buyins: s.buyins || 1, out: !!s.out }),
      standings: R.phase === 'over' ? R.standings : null, chat: R.chat.slice(-50) };
  }
  broadcastRoom() { if (!this.room) return; for (const [ws, c] of this.conns) if (c.authed) this.send(ws, this.roomFor(c.pid)); }
  startGame() {
    const R = this.room; let b = 0;
    for (const s of R.seats) {
      if (s.kind === 'empty') { const bot = BOTS[b++ % BOTS.length]; Object.assign(s, { kind: 'bot', name: bot.n, style: bot.style, stack: CASH_STACK, chips: SNG.chips, buyins: 1, out: false }); }
      else Object.assign(s, { stack: CASH_STACK, chips: SNG.chips, buyins: 1, out: false, missed: 0 });
    }
    R.phase = 'playing'; R.handNo = 0; R.out = []; R.standings = null; R.dealerSid = -1;
    R.T = R.format === 'sng' ? { level: 0, handsAtLevel: 0, hands: 0 } : null;
    this.save(); this.broadcastRoom(); this.runLoop();
  }
  backToLobby() {
    const R = this.room;
    for (const s of R.seats) if (s.kind === 'bot' || (s.kind === 'human' && !s.connected)) this.freeSeat(s);
    R.phase = 'lobby'; R.T = null; R.standings = null; this.G = null; if (!this.seatOf(R.hostPid)) this.passHost();
    /* anyone who was watching gets a seat now */
    for (const c of this.conns.values()) if (c.authed && !this.seatOf(c.pid)) { const free = R.seats.find(s => s.kind === 'empty'); if (free) Object.assign(free, this.humanSeat(c)); }
    this.save(); this.broadcastRoom();
  }

  /* ---------- the game loop ---------- */
  async runLoop() {
    if (this.looping) return; this.looping = true; let errors = 0;
    try {
      while (this.room && this.room.phase === 'playing' && this.humansConnected()) {
        try { await this.playHand(); errors = 0; }
        catch (e) { console.error('hand failed', e && e.stack || e); this.G = null; this.pending = null; this.turn = null; if (++errors >= 3) break; await this.nap(1500); }
      }
    } finally { this.looping = false; }
  }
  level() { return LEVELS[Math.min(this.room.T.level, LEVELS.length - 1)]; }
  bbChips() { return this.room.format === 'sng' ? this.level()[1] : 1; }
  money(bb) { return this.room.format === 'sng' ? Math.round(bb * this.bbChips()).toLocaleString('en-US') : P.fmt(bb) + 'bb'; }

  seatChanges() { /* cash game, between hands: leavers become bots, newcomers take a bot's chair, short stacks reload */
    const R = this.room;
    for (const s of R.seats) {
      if (s.kind === 'human' && (s.leaving || (!s.connected && (s.missed || 0) >= 3))) {
        const used = new Set(R.seats.filter(x => x.kind === 'bot').map(x => x.name)); const bot = BOTS.find(x => !used.has(x.n)) || BOTS[0];
        const id = s.id; this.freeSeat(s); Object.assign(s, { id, kind: 'bot', name: bot.n, style: bot.style, stack: CASH_STACK, chips: 0, buyins: 1, out: false });
      }
    }
    while (R.joins.length) {
      const j = R.joins.shift(); if (this.seatOf(j.pid)) continue;
      const bots = R.seats.filter(s => s.kind === 'bot'); const spot = R.seats.find(s => s.kind === 'empty') || bots[bots.length - 1]; if (!spot) break;
      const id = spot.id; this.freeSeat(spot); Object.assign(spot, this.humanSeat(j), { id });
    }
    for (const s of R.seats) {
      if (s.kind === 'empty') continue;
      if (s.stack < 1) { s.stack = CASH_STACK; s.buyins = (s.buyins || 1) + 1; }
      else if (s.kind === 'bot' && (s.stack < 40 || s.stack > 300)) { s.stack = CASH_STACK; s.buyins = 1; }
    }
    if (!this.seatOf(R.hostPid)) this.passHost();
  }

  async playHand() {
    const R = this.room; const sng = R.format === 'sng';
    if (!sng) this.seatChanges();
    const inSeats = R.seats.filter(s => s.kind !== 'empty' && (sng ? s.chips > 0 : true));
    if (sng && (inSeats.length < 2 || !inSeats.some(s => s.kind === 'human'))) return this.finishTournament();
    const bb = this.bbChips(); const n = inSeats.length;
    /* the button moves to the next occupied seat */
    const ids = inSeats.map(s => s.id); let next = ids.find(id => id > R.dealerSid); if (next === undefined) next = ids[0]; R.dealerSid = next; const dealer = ids.indexOf(next);
    const deck = P.shuffle(P.makeDeck());
    const players = inSeats.map((s, i) => ({ sid: s.id, seat: i, name: s.name, style: s.style, isBot: s.kind === 'bot', isHero: false, avatar: s.avatar || null, stack: sng ? r1(s.chips / bb) : r1(s.stack),
      bet: 0, total: 0, folded: false, allIn: false, cards: [deck.pop(), deck.pop()], range: null, pfAction: '', pos: POS_BY_N[n][(i - dealer + n) % n], show: false, agg: false, calledPost: false, raisedPost: false, foldedOn: '' }));
    for (const p of players) p.startStack = p.stack;
    const G = this.G = { hand: ++R.handNo, players, n, deck, dealer, board: [], pot: 0, street: 'preflop', currentBet: 0, minRaise: 1, pf: { raises: [], callers: 0, limpers: 0 }, pfr: null, log: [], msg: null, acting: -1, winners: [], history: [], finished: false, shown: false };
    const sbIdx = n === 2 ? dealer : (dealer + 1) % n, bbIdx = (sbIdx + 1) % n; G.sbIdx = sbIdx; G.bbIdx = bbIdx;
    if (sng && this.level()[2]) { const ante = r1(this.level()[2] / bb); for (const p of players) { const a = Math.min(ante, p.stack); p.stack = r1(p.stack - a); p.total = r1(p.total + a); G.pot = r1(G.pot + a); if (p.stack <= 0) { p.stack = 0; p.allIn = true; } } }
    this.post(players[sbIdx], 0.5); this.post(players[bbIdx], 1); G.currentBet = 1; G.minRaise = 1;
    const L = sng ? this.level() : null;
    this.say(null, sng ? `Hand ${R.T.hands + 1}. Blinds ${L[0]}/${L[1]}${L[2] ? ' ante ' + L[2] : ''}.` : `Hand ${G.hand}. Blinds 0.5/1.`);
    this.ready = new Set(); await this.save(); this.broadcastRoom(); this.broadcastState(); await this.nap(STREET_MS);

    await this.bettingRound('preflop', (bbIdx + 1) % n);
    const order = ['preflop', 'flop', 'turn', 'river'];
    if (this.alive().length > 1) for (let i = 1; i < 4; i++) {
      const street = order[i]; G.street = street; this.collect(); for (let j = 0; j < (street === 'flop' ? 3 : 1); j++) G.board.push(deck.pop());
      this.say(null, `${street[0].toUpperCase() + street.slice(1)}: ${G.board.map(P.cardStr).join(' ')}`); G.msg = null; this.broadcastState();
      if (this.canAct().length >= 2) { await this.nap(STREET_MS); await this.bettingRound(street, (dealer + 1) % n); if (this.alive().length === 1) break; }
      else await this.nap(STREET_MS * 1.3);
    }
    this.collect(); await this.showdown();

    /* write the result back to the seats */
    for (const p of players) { const s = R.seats[p.sid]; if (!s || s.kind === 'empty') continue; if (sng) s.chips = Math.round(p.stack * bb); else s.stack = p.stack; }
    if (sng) {
      const busted = players.filter(p => p.stack <= 0).sort((a, b) => a.startStack - b.startStack);
      for (const p of busted) { R.out.push(p.name); R.seats[p.sid].out = true; this.say(null, `${p.name} is out.`); }
      R.T.hands++; R.T.handsAtLevel++; if (R.T.handsAtLevel >= SNG.handsPerLevel) { R.T.handsAtLevel = 0; R.T.level++; }
    }
    for (const p of players) if (p.isBot) p.show = true;   /* bots show their cards once the hand is over; people's mucked cards stay private */
    G.finished = true; G.acting = -1; await this.save(); this.broadcastRoom(); this.broadcastState();
    /* next hand when every connected player at the table is ready, or after a pause */
    const waitFor = () => R.seats.filter(s => s.kind === 'human' && s.connected && !s.leaving && players.some(p => p.sid === s.id));
    const t0 = Date.now(); await this.nap(2500);
    while (Date.now() - t0 < NEXT_HAND_MS && waitFor().some(s => !this.ready.has(s.id))) { await new Promise(res => { this.wakeNext = res; setTimeout(res, 1000); }); this.wakeNext = null; }
  }
  async finishTournament() {
    const R = this.room; const left = R.seats.filter(s => s.kind !== 'empty' && s.chips > 0).sort((a, b) => b.chips - a.chips).map(s => s.name);
    const order = left.concat(R.out.slice().reverse()); R.standings = order.map((name, i) => ({ place: i + 1, name })); R.phase = 'over'; this.G = null;
    await this.save(); this.broadcastRoom();
  }

  /* ---------- one hand ---------- */
  alive() { return this.G.players.filter(p => !p.folded); }
  canAct() { return this.G.players.filter(p => !p.folded && !p.allIn); }
  totalPot() { return P.totalPot(this.G); }
  post(p, amt) { amt = Math.min(amt, p.stack); p.stack = r1(p.stack - amt); p.bet = r1(p.bet + amt); p.total = r1(p.total + amt); if (p.stack <= 0) { p.stack = 0; p.allIn = true; } }
  collect() { const G = this.G; for (const p of G.players) { G.pot = r1(G.pot + p.bet); p.bet = 0; } G.currentBet = 0; G.minRaise = 1; }
  /* a line for the log: `they` is how others read it, `you` how the player reads it */
  say(seat, they, you) { const line = { seat, they, you: you || they }; this.G.log.push(line); if (this.G.log.length > 40) this.G.log.shift(); return line; }

  async bettingRound(street, startIdx) {
    const G = this.G; G.street = street; if (street !== 'preflop') { G.currentBet = 0; G.minRaise = 1; }
    let need = new Set(this.canAct().map(p => p.seat)); if (need.size <= 1 && street !== 'preflop') return;
    if (need.size === 1 && street === 'preflop') { const only = [...need][0]; const others = this.alive().filter(p => p.seat !== only); if (others.every(o => o.allIn) && G.players[only].bet >= G.currentBet) return; }
    if (need.size === 0) return;
    let idx = startIdx, guard = 0;
    while (need.size > 0 && guard++ < 80) {
      const p = G.players[idx];
      if (!p.folded && !p.allIn && need.has(idx)) {
        G.acting = idx; const before = G.currentBet;
        const act = p.isBot ? await this.botAct(p) : await this.humanAct(p);
        this.apply(p, act); need.delete(idx);
        if (G.currentBet > before) need = new Set(this.canAct().filter(q => q.seat !== idx).map(q => q.seat));
        G.acting = -1; this.broadcastState();
        if (this.alive().length === 1) return;
      }
      idx = (idx + 1) % G.n;
    }
  }
  async botAct(p) { this.broadcastState(); await this.nap(BOT_MS); const a = P.botDecide(this.G, p, Math.random); return this.legal(p, a) || { type: r1(this.G.currentBet - p.bet) > 0 ? 'fold' : 'check' }; }
  armTurn(ms) { if (!this.pending) return; clearTimeout(this.pending.timer); this.turn.deadline = Date.now() + ms; this.pending.timer = setTimeout(() => this.resolveTurn(null), ms); this.broadcastState(); }
  resolveTurn(act) { const pd = this.pending; if (!pd) return; clearTimeout(pd.timer); this.pending = null; this.turn = null; pd.resolve(act); }
  async humanAct(p) {
    const seat = this.room.seats[p.sid]; const ms = seat.connected && !seat.leaving ? TURN_MS : AWAY_TURN_MS;
    const act = await new Promise(resolve => { this.pending = { sid: p.sid, seq: ++this.seq, resolve, timer: null }; this.turn = { sid: p.sid, seq: this.seq, deadline: 0 }; this.armTurn(ms); });
    if (act) { seat.missed = 0; return act; }
    seat.missed = (seat.missed || 0) + 1;
    return { type: r1(this.G.currentBet - p.bet) > 0 ? 'fold' : 'check', auto: true };
  }
  onAct(seat, m) {
    const pd = this.pending; if (!pd || pd.sid !== seat.id || m.seq !== pd.seq) return;
    const p = this.G.players.find(x => x.sid === seat.id); const act = p && this.legal(p, m); if (act) this.resolveTurn(act);
  }
  /* turn whatever was asked for into a legal action, or null */
  legal(p, a) {
    const G = this.G; const toCall = r1(G.currentBet - p.bet); const stackTo = r1(p.bet + p.stack); const type = a && a.type;
    if (type === 'fold') return toCall > 0 ? { type: 'fold', reason: a.reason } : { type: 'check', reason: a.reason };
    if (type === 'check' || type === 'call') return toCall > 0 ? { type: 'call', reason: a.reason } : { type: 'check', reason: a.reason };
    if (type === 'bet' || type === 'raise') {
      let to = Number(a.to); if (!isFinite(to)) return null;
      if (toCall >= p.stack || this.canAct().length < 2) return toCall > 0 ? { type: 'call', reason: a.reason } : { type: 'check', reason: a.reason };
      const minTo = Math.min(stackTo, r1(G.currentBet + G.minRaise)); to = Math.min(stackTo, Math.max(minTo, r1(to)));
      return { type: G.currentBet > 0 ? 'raise' : 'bet', to, reason: a.reason };
    }
    return null;
  }
  apply(p, act) {
    const G = this.G; const toCall = r1(G.currentBet - p.bet); let they, you;
    if (act.type === 'fold') { p.folded = true; p.foldedOn = G.street; they = 'folds'; you = 'fold'; }
    else if (act.type === 'check') { they = 'checks'; you = 'check'; }
    else if (act.type === 'call') {
      const amt = Math.min(toCall, p.stack); this.post(p, amt); const tail = ` ${this.money(amt)}${p.allIn ? ' (all in)' : ''}`; they = 'calls' + tail; you = 'call' + tail;
      if (G.street === 'preflop') { if (G.pf.raises.length === 0) { G.pf.limpers++; p.pfAction = 'limp'; } else { G.pf.callers++; p.pfAction = 'call'; } } else p.calledPost = true;
    } else {
      const to = Math.min(act.to, r1(p.bet + p.stack)); const amt = r1(to - p.bet); const prev = G.currentBet; this.post(p, amt);
      if (p.bet > prev) { const inc = r1(p.bet - prev); if (inc >= G.minRaise || p.allIn) G.minRaise = Math.max(G.minRaise, inc); G.currentBet = p.bet; }
      const tail = ` ${this.money(p.bet)}${p.allIn ? ' (all in)' : ''}`; they = (prev === 0 ? 'bets' : 'raises to') + tail; you = (prev === 0 ? 'bet' : 'raise to') + tail;
      if (G.street === 'preflop') { G.pf.raises.push({ seat: p.seat, pos: p.pos, to: p.bet }); G.pf.callers = 0; p.pfAction = G.pf.raises.length === 1 ? 'open' : G.pf.raises.length === 2 ? '3bet' : '4bet+'; G.pfr = p.seat; }
      else { G.lastAggressor = p.seat; p.agg = true; if (prev > 0) p.raisedPost = true; }
    }
    if (act.auto) { they += ' (timed out)'; you += ' (timed out)'; }
    G.msg = this.say(p.seat, they, you);
    G.history.push({ street: G.street, seat: p.seat, they, you, board: G.board.slice() });
  }
  async showdown() {
    const G = this.G; const live = this.alive();
    if (live.length === 1) { const w = live[0]; w.stack = r1(w.stack + G.pot); G.msg = this.say(w.seat, `wins ${this.money(G.pot)}`, `win ${this.money(G.pot)}`); G.winners = [w.seat]; G.result = { uncontested: true, pot: G.pot, won: { [w.seat]: G.pot } }; }
    else {
      for (const p of live) p.show = true; G.shown = true; this.broadcastState(); await this.nap(STREET_MS);
      const levels = [...new Set(live.map(p => p.total))].sort((a, b) => a - b); let prev = 0; const won = {};
      for (const L of levels) {
        let share = 0; for (const p of G.players) share += Math.max(0, Math.min(p.total, L) - prev);
        const elig = live.filter(p => p.total >= L); let best = -1, ws = [];
        for (const p of elig) { const sc = P.evaluate(p.cards.concat(G.board)); if (sc > best) { best = sc; ws = [p]; } else if (sc === best) ws.push(p); }
        const each = r1(share / ws.length); for (const w of ws) { w.stack = r1(w.stack + each); won[w.seat] = r1((won[w.seat] || 0) + each); } prev = L;
      }
      let first = null;
      for (const s of Object.keys(won)) { const p = G.players[s]; const desc = P.describeHand(p.cards, G.board).desc; const line = this.say(p.seat, `wins ${this.money(won[s])} with ${desc}`, `win ${this.money(won[s])} with ${desc}`); first = first || line; }
      G.msg = first; G.winners = Object.keys(won).map(Number); G.result = { uncontested: false, won };
    }
    G.pot = 0;
  }

  /* ---------- what one player may see ---------- */
  stateFor(pid) {
    const G = this.G, R = this.room; if (!G) return { t: 'state', G: null };
    const seat = this.seatOf(pid); const me = seat ? G.players.findIndex(p => p.sid === seat.id) : -1; const rot = me >= 0 ? me : 0; const n = G.n;
    const ix = i => (i == null || i < 0) ? i : (i - rot + n) % n;
    const nameOf = i => i === me ? 'You' : G.players[i].name;
    const line = l => l.seat == null ? l.they : l.seat === me ? `You ${l.you}` : `${G.players[l.seat].name} ${l.they}`;
    const players = []; for (let k = 0; k < n; k++) {
      const p = G.players[(k + rot) % n]; const mine = p.seat === me; const s = R.seats[p.sid];
      players.push({ seat: k, sid: p.sid, name: mine ? 'You' : p.name, realName: p.name, style: mine ? 'hero' : p.style, isHero: mine, isBot: p.isBot, avatar: p.avatar, connected: p.isBot || !!(s && s.connected),
        stack: p.stack, bet: p.bet, total: p.total, folded: p.folded, allIn: p.allIn, pos: p.pos, show: p.show && !mine, cards: (mine || p.show) ? p.cards : null, startStack: p.startStack,
        pfAction: p.pfAction, agg: p.agg, calledPost: p.calledPost, raisedPost: p.raisedPost, foldedOn: p.foldedOn });
    }
    let resultText = '';
    if (G.finished && G.result) {
      const wonTxt = Object.keys(G.result.won).map(s => `${nameOf(+s)} won ${P.fmt(G.result.won[s])}bb`).join('; ');
      resultText = G.result.uncontested ? `${wonTxt} uncontested.` : 'Showdown: ' + this.alive().map(p => `${nameOf(p.seat)} ${p.cards.map(P.cardStr).join(' ')} (${P.describeHand(p.cards, G.board).desc})`).join('; ') + '. ' + wonTxt + '.';
    }
    const view = { hand: G.hand, n, spectator: me < 0, players, dealer: ix(G.dealer), sbIdx: ix(G.sbIdx), bbIdx: ix(G.bbIdx), board: G.board, pot: G.pot, street: G.street, currentBet: G.currentBet, minRaise: G.minRaise,
      pf: { raises: G.pf.raises.map(r => ({ seat: ix(r.seat), pos: r.pos, to: r.to })), callers: G.pf.callers, limpers: G.pf.limpers }, pfr: ix(G.pfr), lastAggressor: ix(G.lastAggressor), acting: ix(G.acting),
      msg: G.msg ? line(G.msg) : '', log: G.log.map(line), winners: G.winners.map(ix), finished: G.finished, resultText,
      history: G.history.map(h => ({ street: h.street, seat: ix(h.seat), name: nameOf(h.seat), isHero: h.seat === me, text: h.seat === me ? h.you : h.they, reason: '', board: h.board })),
      format: R.format, T: R.format === 'sng' ? { level: R.T.level, blinds: this.level(), handsAtLevel: R.T.handsAtLevel, handsPerLevel: SNG.handsPerLevel, hands: R.T.hands, left: R.seats.filter(s => s.kind !== 'empty' && s.chips > 0).length, total: SEATS } : null };
    const turn = this.turn && seat && this.turn.sid === seat.id ? { seq: this.turn.seq, ms: Math.max(0, this.turn.deadline - Date.now()) } : null;
    const waitingOn = this.turn ? { sid: this.turn.sid, ms: Math.max(0, this.turn.deadline - Date.now()) } : null;
    return { t: 'state', G: view, turn, waitingOn };
  }
  broadcastState() { for (const [ws, c] of this.conns) if (c.authed) this.send(ws, this.stateFor(c.pid)); }
}
