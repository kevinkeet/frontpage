# Capitola parking model ("Cruising the Esplanade")

Source for **kevinkeet.com/capitola/parking/** (the interactive model) and **/capitola/parking/summer-rate/** (the one-page
case). Built in November 2026, modeled on Paul Supawanich's "Cruising the Block" (CivicMotion, CC BY-NC 4.0; credited on
both pages). The repo is public and Pages serves this folder, so keep personal notes out of it.

## Build

`python3 build.py` writes `../index.html` and `../summer-rate/index.html`. Edit the parts, never the built pages:

- `engine.js`: the traffic and parking simulation (1-D lanes, 1-second steps). Parameters in `P` at the top.
- `world.js`: geometry. The loop, San Jose Ave, the angled leg (diag), approach lanes and the 130 spaces.
- `app.js`: the page (canvas map with stopped-traffic shading, controls, day chart, rate sweep). `SWEEPS` holds the baked
  sweeps from `sweeps.json`; other visitor numbers are computed live (8 rates, 1 run each).
- `css_part.html`, `body_part.html`: page styles and markup. `onepager.html`: the one-pager (its chart is drawn by `build.py`
  from `sweeps.json`; the numbers in its text and table are typed and come from `sweeps.json` too).
- `sweeps.json`: whole-day results by crowd size and rate (1-3 PM window), from `node bake.js 6000,7500,9000 4`
  (crowd sizes, runs per rate). 1,500 and 4,500 use 2 runs; 6,000, 7,500 and 9,000 use 4.
- `osm/geo.json`, `osm/paths.json`: OpenStreetMap streets, buildings, shoreline, crosswalks, projected to meters
  (x east, y north, origin near 36.9725 N, 121.95 W).

`--artifact <path>` also writes a claude.ai artifact copy with absolute links.

## Checking the model

- `node day.js '{"param":value}' 6000,9000 2,4,6,8 11,23`: whole days, 1-3 PM results (occupancy, trip, standstill, circling).
- `node where.js '{}' 2 9000`: which streets are stopped at 1-3 PM.
- `node calib.js '[{"gearMean":10}]'`: drivers' price response (target about -0.4 between $2 and $4).
- `node verify.js`, `prof.js`, `test5.js`: older constant-demand checks (`runHeadless`).

If `engine.js`, `world.js` or settings change, re-run `bake.js` for 1500,4500 (2 runs) and 6000,7500,9000 (4 runs), rebuild, and
update the typed numbers in `onepager.html` and `body_part.html` from `sweeps.json`.

## What is measured and what is tuned

- Measured: meter and lot rates and history (city records), street layout, one-way directions, crosswalks and stop signs
  (OpenStreetMap), 130 spaces (counted from Esri aerial imagery), walk from the lots (~1/4 mile).
- Calibrated: drivers' price response, elasticity about -0.4 between $2 and $4 (Pierce and Shoup 2013).
- Tuned to local observation (on a busy summer Saturday at $2 the whole loop is at a standstill by midday, backing up from the
  Monterey/Capitola stop): other traffic, drop-offs, pedestrian crossings, stop-sign service times (Monterey ~8 s,
  Stockton ~5 s), drivers waiting on Capitola Ave to turn onto a backed-up San Jose Ave.
- Estimated: visitors (1,500 / 4,500 / 9,000 a day; the summer figure sized from the 2008 study's peak demand of ~1,212 cars),
  85% by car, 2.7 per car, 45% look for a loop space first, arrivals by hour in `P.profile`.
- Assumed: stays (median 3 h; meters charge for at most 3 h; overstaying costs $10 on average), value of time, gear ($10),
  patience, route shares, destinations, turning away from a long line into the Village.
- Results at 1-3 PM: the rate that keeps the loop moving is ~$5.50 at 6,000 visitors, ~$6 at 7,500, ~$7.50 at 9,000; above
  ~10,000 through traffic and drop-offs alone fill the loop. Sensitive to the visitor estimate and the tuned stop capacities.

## Engine lessons

- An all-way stop's queue must skip a car that has no room past the stop, or the loop gridlocks.
- Cars may only enter a packed loop when there is room (`ringCap`); otherwise the line stays on the approach street.
- With 1-second steps, stop service times round up to whole seconds.
