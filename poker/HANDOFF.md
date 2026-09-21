# Hold'em Coach — handoff notes

Poker training app for a novice Texas Hold'em player (Kevin Keet, kevinkeet@gmail.com).
Live at **https://kevinkeet.com/poker/** (GitHub Pages, served from `main` of the
`kevinkeet/frontpage` repo). Keep it out of the actingintern.com repo.

## Layout
- `poker/index.html` — the whole app: CSS, markup and three `<script>` blocks
  (engine `window.Poker`; UI/home/learn/drills `window.HC`; play/tournaments `window.Play`).
  No build step, no framework, no dependencies except Google Fonts.
- `poker/worker/` — Cloudflare Worker that holds the shared Anthropic key, checks a
  table password, and hosts home-game tables. `src/index.js` (routes), `src/room.js`
  (one Durable Object per table), `scripts/build-engine.mjs`, `wrangler.toml`, `README.md`.
- `.github/workflows/deploy-worker.yml` — deploys the worker, sets its secrets, and
  writes the worker URL into `window.__COACH_SERVER` in `poker/index.html`.
- Progress is stored in `localStorage` under `holdem-coach-v1`; the personal API key
  under `holdem-coach-api-key`; the table password under `holdem-coach-pass`.

## What the app does (all built and pushed)
- Learn: 8 lessons incl. an interactive 13×13 starting-hand chart.
- Drill: preflop decisions, bet math, hand reading; adaptive (misses come back).
- Play: cash hands (100bb, stacks reset) and tournaments (sit & go 6 players; multi-table
  18 players with simulated outer tables, antes from level 5). Bots have types
  (station, nit, maniac, normal). Every hero decision is graded against a
  tight-aggressive baseline with pot odds / equity (Monte Carlo) / outs.
- After each hand: summary, hand review (everyone's cards, street-by-street replay with
  each bot's reasoning), rule-based opponent "reads", replay-from-any-street practice,
  and, when the AI coach is enabled, an AI review (Well done / To improve / Reading the
  table / Lesson) plus an "Ask the coach" chat.
- Hint button during play: your spot, the exact range chart for the situation with your
  hand outlined, pot-odds and outs tables, opponent reads, optional AI read, and an
  optional reveal of the coach's advice (marks the decision as hinted).
- Home: curriculum, stats, leak report built from a log of graded decisions, settings
  (avatar, coach note timing, bot speed, AI review toggle, personal API key, reset).
- Avatars and chip stacks: every seat shows an inline-SVG avatar and a chip stack.
  An avatar is a small spec object `{bg,skin,hair,hc,acc,eyes,mouth,shirt}` drawn by
  `HC.avatarSVG(spec,size)`. The five regular bots are hand-made (`AV_BOTS`); other bots
  get a look from their style plus a hash of their name (`HC.botAvatar`): station =
  headphones on yellow, nit = glasses/visor on grey-blue, maniac = shades and a grin on
  red, normal = plain or cap on green/teal. The player's avatar is
  `HC.S.settings.avatar` (8 presets or custom, edited in Settings); specs are tiny so
  they can be sent to other players in the home game. `HC.chipStackSVG(units,ref)` draws
  a stack in casino colors (1 white, 5 red, 25 green, 100 black, 500 purple, 1000
  yellow, 5000 orange): fewest chips first, then big chips are broken down until the
  pile is about 10 chips per `ref` (100bb in cash, the table average in tournaments).
  `HC.chipDot(units)` is the single chip shown in bet pills.
- Card faces show "10"; shorthand (T9s, Ts) still uses T.
- Friends tab (home game): create a table (cash or sit & go) and get a 5-character code
  and an invite link (`kevinkeet.com/poker/#CODE`); friends join with the code; the host
  starts the game and empty seats are filled by bots. Table chat in the lobby and at the
  table, with a speech bubble at the speaker's seat. Cash: 100bb, stacks carry over, auto
  rebuy, join/leave any time (a newcomer takes a bot's chair at the next hand, a leaver's
  chair goes to a bot). Sit & go: 1,500 chips, levels every 8 hands, ends when one player
  is left or every human is out. 45s to act (5s if disconnected), then check/fold.

## Home game architecture
- The server is authoritative. `room.js` deals, holds the deck, runs the betting and the
  showdown, and plays the bots. It imports the engine **extracted from `index.html`**
  (`scripts/build-engine.mjs` writes `src/engine.generated.js`, run by wrangler's
  `[build]`; not committed). So the second script block (engine + "table logic shared…"
  section: `oppSpec`, `assignRange`, `preflopSituation`, `botDecide`, `totalPot`) must
  stay free of DOM access, and **after changing it, redeploy the worker**.
- After every change the room sends each player a `state` message: the hand rotated so
  that the viewer is seat 0, with only their own hole cards plus cards shown at
  showdown, third-person log lines ("You call" for the viewer). The client (`R`,
  `onState` at the end of the play block) copies that view into `G`, so `render()`, the
  coach (`decorate`), hints, reads and `showSummary` are the same code as solo play.
  Client-only data (graded decisions, AI chat) lives in `R` and is re-attached to each
  new `G`. Anything that touches `p.cards` of an opponent must allow `null`.
- Trust boundary: names, avatar specs and chat are cleaned in `room.js` (`cleanName`,
  `cleanAvatar`, `cleanChat`) and chat/avatars are escaped/cleaned again in the client
  (`esc`, `HC.cleanAvatar`). The table password travels in the first WebSocket message
  (`hello`), never in the URL. Player identity is a random `pid` kept in localStorage
  (`holdem-coach-pid`); reconnecting with it returns you to your seat.
- AI cost: at a home game the automatic AI review runs for the host only; guests get a
  button per hand, or can opt in under Settings. The AI is told that hidden cards are
  unknown.
- Room state (seats, stacks, level, chat) is saved to Durable Object storage between
  hands; a hand interrupted by a restart is void and stacks return to their pre-hand
  values. Rooms delete themselves 24h after the last hand.
- Local testing: `.claude/launch.json` has `holdem-worker` (wrangler dev, :8787) and
  `holdem-site` (:8090). `poker/worker/.dev.vars` (ignored) needs `SITE_PASSWORD`,
  a dummy `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS=http://localhost:8090`, and optionally
  `FAST_TIMERS=1`. In the browser set localStorage `holdem-coach-dev-server` to
  `http://localhost:8787` (honoured on localhost only) and `holdem-coach-pass`.
  Tests used: a Node WebSocket script (privacy, chip conservation, bad password, name and
  avatar cleaning, reconnect), a sit & go played to the end, and two Playwright browsers
  playing each other.

## AI coach plumbing
- Calls go to the Claude API (`claude-opus-5`, `output_config.effort: medium`,
  `fallbacks: "default"` with beta header `server-side-fallback-2026-07-01`).
- Two modes: personal key from the browser (header
  `anthropic-dangerous-direct-browser-access: true`), or, when `window.__COACH_SERVER`
  is set, through the worker with header `X-Poker-Pass`. With a server configured the
  site shows a password screen on load; the password is verified by `POST /auth`.
- The worker allowlists models, caps `max_tokens` at 2000, rate-limits per IP, and only
  accepts requests from kevinkeet.com origins (see `ALLOWED_ORIGINS` in wrangler.toml).

## Immediate task: deploy the worker (not yet done)
The Action already exists and ran once; it stopped at "Check secrets are present"
because the repo has no secrets. To finish:
1. In Cloudflare (dash.cloudflare.com): profile → API Tokens → Create Token →
   "Edit Cloudflare Workers" template → create → copy the token.
   Workers & Pages → copy the Account ID from the right-hand sidebar.
2. In GitHub → https://github.com/kevinkeet/frontpage/settings/secrets/actions add:
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, `SITE_PASSWORD`.
3. Actions tab → "Deploy Hold'em Coach worker" → Run workflow. It deploys, attaches the
   secrets, and commits the worker URL into `poker/index.html` as a github-actions commit.
4. Verify: open https://kevinkeet.com/poker/ in a private window → password screen →
   enter the password → play a cash hand → the summary should show an "AI review".
   If the AI call fails with a CORS/origin error, check `ALLOWED_ORIGINS`.
Earlier a local `npx wrangler login` on Kevin's Mac succeeded but nothing was deployed
(commands ran in the home folder). That login is harmless and not needed for the Action.

## Conventions and testing
- Edit `poker/index.html` directly (python/sed patches were used; the file is ~180 KB).
  Keep the three script blocks parseable: `new Function(block)` on each block is a quick
  syntax check.
- Headless tests were done with Playwright: shorten `setTimeout` via `addInitScript`,
  set `window.HC.S.settings.coachLive=false` to skip coach pauses, drive `#act-fold`,
  `#act-check`, `#act-bet` + `#size-presets .btn` + `#act-confirm`, and click `#sum-next`
  on the summary sheet. Mock `https://api.anthropic.com/v1/messages` (or the worker URL)
  with `page.route` to test AI features.
- Commit style: short summary line, detail paragraph, `Co-Authored-By` trailer. Push to
  `main` of `kevinkeet/frontpage`; Pages redeploys in a minute or two.
- A private artifact copy exists at https://claude.ai/artifact/Ljz9fipranv4D4xQUboSPS
  (built by stripping the doctype/html/head/body wrapper lines); it cannot reach the API.

## Backlog (agreed, not started)
1. Home game follow-ups: sit-out button, host controls (kick, pause, table size, bot
   mix), showing a folded hand voluntarily, a chat drawer that stays visible on phones,
   sound/notification on your turn, multi-table tournaments.
2. Nice-to-haves: scrollable hand history, "hands like this" drill from a review,
   haptics on the phone when it is your turn.

## Known gotchas
- `[hidden]{display:none!important}` is in the CSS on purpose (flex classes otherwise
  override the hidden attribute).
- Seat layouts are per player count in `LAYOUT` (2–6); board sits at ~52% height (pot
  line ~41%, board 45–64%). A seat is avatar + hole cards over the name box, ~92px tall,
  so side seats sit at y≈33% or y≈77%. Chips go beside the box, except upper side seats
  (y<50) where they hang below it. Bet pills (`bet` in `LAYOUT`) must dodge the pot line,
  which is wide in tournaments; check all five layouts after moving anything.
- `preflopBaseline` scenarios: open, vslimp, vsraise, vsraise+call, vs3bet, cold3bet,
  vs4bet, committed, walk. Short-stack branches at ≤15bb and ≤10bb; heads-up uses
  `OPEN_HU` for the button.
- The coach's opponent model narrows ranges after postflop bets/calls/raises and by
  player type (`oppSpec` in the play block). Bot raises are modeled as strong.
