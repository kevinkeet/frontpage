# Hold'em Coach — handoff notes

Poker training app for a novice Texas Hold'em player (Kevin Keet, kevinkeet@gmail.com).
Live at **https://kevinkeet.com/poker/** (GitHub Pages, served from `main` of the
`kevinkeet/frontpage` repo). Keep it out of the actingintern.com repo.

## Layout
- `poker/index.html` — the whole app: CSS, markup and three `<script>` blocks
  (engine `window.Poker`; UI/home/learn/drills `window.HC`; play/tournaments `window.Play`).
  No build step, no framework, no dependencies except Google Fonts.
- `poker/worker/` — Cloudflare Worker that holds the shared Anthropic key and checks a
  table password. `src/index.js`, `wrangler.toml`, `README.md`.
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
  (coach note timing, bot speed, AI review toggle, personal API key, reset).

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
1. **Play with friends remotely.** Design: "Home game" tab; host creates a table and gets
   a room code; friends join at kevinkeet.com/poker; empty seats filled by bots. Run the
   existing engine inside a Cloudflare Durable Object per room (deals cards, holds the
   deck, pushes each player their own cards over WebSockets); per-player coach notes and
   reviews stay private. Cash and tournament formats. Cloudflare free plan covers it; the
   only spend is AI coach calls (billed to the shared key), so consider making the auto
   review opt-in per player or using a cheaper model for guests.
2. **Avatars and chip stacks.** Pre-drawn avatar per bot matching its type; pick-or-make
   avatar for the player (and friends); a chip stack graphic beside each seat that scales
   with the stack, colored by denomination.
3. Show "10" instead of "T" on card faces (keep T in shorthand like T9s).
4. Nice-to-haves: scrollable hand history, "hands like this" drill from a review,
   haptics on the phone when it is your turn.

## Known gotchas
- `[hidden]{display:none!important}` is in the CSS on purpose (flex classes otherwise
  override the hidden attribute).
- Seat layouts are per player count in `LAYOUT` (2–6); board sits at ~52% height, keep
  side seats above ~40% or below ~65%.
- `preflopBaseline` scenarios: open, vslimp, vsraise, vsraise+call, vs3bet, cold3bet,
  vs4bet, committed, walk. Short-stack branches at ≤15bb and ≤10bb; heads-up uses
  `OPEN_HU` for the button.
- The coach's opponent model narrows ranges after postflop bets/calls/raises and by
  player type (`oppSpec` in the play block). Bot raises are modeled as strong.
