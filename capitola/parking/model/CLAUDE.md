# Capitola parking model ("Cruising the Esplanade")

Source for **kevinkeet.com/capitola/parking/** (the interactive model) and **/capitola/parking/summer-rate/** (the one-page
case). Built in November 2026, modeled on Paul Supawanich's "Cruising the Block" (CivicMotion, CC BY-NC 4.0; credited on
both pages). The repo is public and Pages serves this folder, so keep personal notes out of it.

## Build

`python3 build.py` writes `../index.html` and `../summer-rate/index.html`. Edit the parts, never the built pages:

- `engine.js`: the traffic and parking simulation (1-D lanes, 1-second steps). Parameters in `P` at the top.
- `world.js`: geometry. The loop, San Jose Ave, the angled leg (diag), the three ways in (Capitola Ave `spur`, Monterey Ave
  `amPath`, the Stockton Ave bridge `br`) and the 130 spaces.
- `app.js`: the page (canvas map with stopped-traffic shading, controls, day chart, rate sweep). `build.py` writes `sweeps.json`
  into `SWEEPS` and `recommend.json` into `REC` (placeholders `/*SWEEPS*/{}` and `/*REC*/[]`); nothing to paste by hand.
- `css_part.html`, `body_part.html`: page styles and markup. `onepager.html`: the one-pager (its chart is drawn by `build.py`
  from `sweeps.json`; the numbers in its text and table are typed and come from `sweeps.json` too).
- `sweeps.json`: whole-day results by crowd size and rate ($1 to $12 by $0.50, 1-3 PM window), from
  `node bake.js <crowds> <runs> [out.json]`. Every visitor-slider step (500 to 12,000 by 500) is baked with 6 runs (~7 min on
  12 cores: 12 processes of two crowds each, pairing low with high, into separate files, then `node bake.js merge a.json ...`
  after moving the old sweeps.json aside, since merge adds to it).
- `recommend.js` -> `recommend.json`: the recommended rate for each crowd (rule in the file's header: lowest rate with <1 car
  circling and <10% of the loop stopped at that rate and $0.50 more, smoothed so bigger crowds never get lower rates, rounded to
  $0.50, floored at $2.00). The model page's "Recommended" button, its rate-chart rings, the #recs section (chart + table drawn
  by `build.py`) and the one-pager's schedule table all read it.
- `osm/geo.json`, `osm/paths.json`: OpenStreetMap streets, buildings, shoreline, crosswalks, projected to meters
  (x east, y north, origin near 36.9725 N, 121.95 W).

`--artifact <path>` also writes a claude.ai artifact copy with absolute links.

## Checking the model

- `node study.js 9000 2 11,23,37,53 '{"param":value}'`: the model next to the city's counts (2008 study: Village 99% full
  11-5, visits 3.4 h; city 2022: lots fill a few hours on ~25 days a year; RTC July 2007: Esplanade 3,055 vehicles a day),
  plus merge waits (a wait over ~3 minutes means something is stuck).
- `node day.js '{"param":value}' 6000,9000 2,4,6,8 11,23`: whole days, 1-3 PM results (occupancy, trip, standstill, circling).
- `node where.js '{}' 2 9000`: which streets are stopped at 1-3 PM.
- `node calib.js '[{"gearMean":10}]'`: drivers' price response (target about -0.4 between $2 and $4).
- `node verify.js`, `prof.js`, `test5.js`: older constant-demand checks (`runHeadless`).

If `engine.js`, `world.js` or settings change, re-bake every crowd (6 runs), run `node recommend.js`, rebuild, and update the
typed numbers in `onepager.html` and `body_part.html` from `sweeps.json` / `recommend.json`.

## What is measured and what is tuned

- Measured: meter and lot rates and history (city records), street layout, one-way directions, crosswalks and stop signs
  (OpenStreetMap), 130 spaces (counted from Esri aerial imagery; the city says 195 on-street Village spaces in all), walk from
  the lots (~1/4 mile), 455 lot spaces (city 2022; 458 in the 2025-26 fee schedule). From the 2008 RBF study (the only one with
  counts; DocumentCenter/View/883): 82% arrive by car, 2.8 per car, visits 3.4 h (lot stays 3.3 h), Village 99% full 11-5 on a
  summer Saturday.
- Calibrated: drivers' price response, elasticity about -0.4 between $2 and $4 (Pierce and Shoup 2013).
- Tuned to local observation (on a busy summer Saturday at $2 the whole loop is at a standstill by midday, backing up from the
  Monterey/Capitola stop): other traffic, drop-offs, pedestrian crossings, stop-sign service times (Monterey ~8 s,
  Stockton ~5 s), drivers waiting on Capitola Ave to turn onto a backed-up San Jose Ave.
- Lots: `lotOther` 0.3 (three in ten non-loop arrivals park in the lots), tuned so the lots peak ~90% and don't fill at 9,000
  visitors and $2 (city 2022: "rarely full"; Kevin: the upper lots are almost never full). `lotAware` 0.57 from the 2008 survey
  (57% of summer-Saturday visitors knew the Pacific Cove lot): unaware drivers compare the meter with the 15-minute walk, which
  is why demand holds up at higher rates.
  Checked, not tuned: Esplanade ~2,600 vehicles 8 AM-8 PM at 9,000 vs RTC 3,055/24 h (July 2007).
- Estimated: visitors (1,500 / 4,500 / 9,000 a day; 9,000 puts ~1,050 visitor cars in the Village at 2 PM vs the 2008 study's
  calculated 1,212 peak incl. residents/workers), 45% look for a loop space first, arrivals by hour in `P.profile`.
- Driver types (`P.types`, Kevin's idea Nov 8: higher rates sort all-day beachgoers to the lots and free spaces for shoppers):
  shares from the 2008 survey's main reason for the visit (beach 53%, shopping 21%, restaurants 12%, other 14%); stays by type
  assumed (medians 4.5 / 1 / 1.5 / 2.5 h) so the mean visit is the survey's 3.4 h; gear $10 / $1 / $1 / $3. Parked cars are
  colored by type; tiles show shoppers & diners parked per hour and the share of spaces held by beachgoers. With types the
  overall price response is -0.41 between $2 and $4 (no retuning needed).
- Assumed: meters charge for at most 3 h; overstaying costs $10 on average; value of time, patience, route shares, destinations, turning away from a long line; when the lots are full, free parking a
  15-minute walk out with 1.5x the hauling (`farWalkMin`, `farGear`); destinations are a random space (`c.tsp`), so they
  spread like the spaces; each driver decides once on arrival whether to grab the first open space (share `takeEarly` 0.08,
  rising to 1 from 90% to 98% full: `choosyFull`, `grabFull`) or hold out for one within `nearWin` 0.03 of the loop before
  the destination (or anything past it), and takes the triangle side / San Jose if the destination is there; drivers spot
  open spaces down the angled leg / San Jose 90% of the time (`seeSide`). Per-space grab chances compounded and a wide window
  front-loaded each stretch, which left upper Monterey (the end of the route) mostly open; `node openwhere.js 9000 8` checks
  open share by street.
- Results at 1-3 PM (Nov 8, v9 rebake): matched rate ~$3.50 at 4,500, ~$4.50 at 6,000, ~$6 at 7,500, ~$7 at 9,000 (90-95%
  full). 9,000: $2 -> 100% full, 12-min trip, 36% stopped, ~14 circling, beachgoers hold 77% of spaces, ~13 shoppers & diners
  park/hr; $7 -> 92%, 4 min, 4%, <1 circling, 64%, ~22/hr. Above ~$7.50 the rate starts pricing off shoppers too. Above
  ~10,000 visitors through traffic and drop-offs alone back up the loop. The study's 1.63 cars/space turnover isn't comparable
  (it includes private residential and business lots).

## Engine lessons

- An all-way stop's queue must skip a car that has no room past the stop, or the loop gridlocks.
- Three ways in (Nov 8, Kevin: ~60% of non-Monterey arrivals come over the Stockton bridge, 40% down Capitola Ave; `viaStockton`).
  Bridge cars join the Esplanade at its start (`espS0`) by zipper with traffic coming down Stockton. When the loop is packed
  (`ringCap`), free slots go to the ways in by the arrival time of each line's front car (`entryRank`, `_entryOK`); a bridge car
  first claims a slot (`merge.ST.res`, counted against the cap) and only then do Stockton cars hold back for it. Holding them
  back without a claimed slot gridlocked the loop; a fixed check order starved whichever way in was checked last.
- Approach lines must be first-in, first-out: new arrivals join behind the last car (negative `s`, off the map). Stacking them
  all at s = 0 let the newest car go first and left one car waiting hours (the old Capitola Ave line had this too).
- Cars may only enter a packed loop when there is room (`ringCap`); otherwise the line stays on the approach street.
- With 1-second steps, stop service times round up to whole seconds.
- Merges zipper: when it's the merging car's turn, main-lane cars stop one car length (`carLen`) short of the merge point and
  the merging car needs only [s - carLen, s + gap) clear. Holding them a full gap back absorbs the ring's spare room and
  gridlocks it.
- Cars waiting at the foot of San Jose count against the ring cap for new entries (circling cars go first).
- A driver hovering for a departing car must drop it when it changes lanes or passes it (`_hoverLimit`), or it freezes in place
  on the new lane and blocks the loop (this caused the long stalls found Nov 8).
