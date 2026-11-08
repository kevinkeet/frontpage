# Capitola parking model ("Cruising the Esplanade")

Source for **kevinkeet.com/capitola/parking/** (the interactive model) and **/capitola/parking/summer-rate/** (the one-page
case). Built in November 2026, modeled on Paul Supawanich's "Cruising the Block" (CivicMotion, CC BY-NC 4.0; credited on
both pages). The repo is public and Pages serves this folder, so keep personal notes out of it.

## Build

`python3 build.py` writes `../index.html` and `../summer-rate/index.html`. Edit the parts, never the built pages:

- `engine.js`: the traffic and parking simulation (1-D lanes, 1-second steps). Parameters in `P` at the top.
- `world.js`: geometry. The loop, San Jose Ave, the angled leg (diag), approach lanes and the 130 spaces.
- `app.js`: the page (canvas map, controls, trend chart, rate sweep). `PRESET` holds the default 135/hr sweep.
- `css_part.html`, `body_part.html`: page styles and markup. `onepager.html`: the one-pager (its chart is drawn by `build.py`
  from `SWEEP`).
- `osm/geo.json`, `osm/paths.json`: OpenStreetMap streets, buildings, shoreline, crosswalks, projected to meters
  (x east, y north, origin near 36.9725 N, 121.95 W).

`--artifact <path>` also writes a claude.ai artifact copy with absolute links.

## Checking the model

- `node test5.js '{"param":value}' 60,135 2,3,4,5 11,23`: results by demand and rate (occupancy, trip time, circling, revenue).
- `node prof.js '{}' 2,4.5 135`: where cars spend time, and the queue behind the Monterey Ave stop.
- `node verify.js 2 135`: follows drivers who miss a space, splits traffic at the Monterey stop by type, and reruns with
  drivers giving up after one miss.

If `engine.js`, `world.js` or the presets change, re-run the 135/hr sweep (seeds 11 and 23, warm 60, measure 120) and update
both `PRESET` in `app.js` and `SWEEP` in `build.py`, plus the numbers typed in `onepager.html`.

## What is measured and what is tuned

- Measured: meter and lot rates and history (city records), street layout, one-way directions, crosswalks and stop signs
  (OpenStreetMap), 130 spaces (counted from Esri aerial imagery), walk from the lots (~1/4 mile).
- Calibrated: drivers' price response, elasticity about -0.4 between $2 and $4 (Pierce and Shoup 2013).
- Tuned to local observation (a summer loop at $2 takes 10 to 15 minutes and backs up from the Monterey/Capitola stop):
  other traffic, drop-offs at the corner, pedestrian crossings, stop-sign service times (Monterey ~8 s, Stockton ~3 s).
- Assumed: demand presets (20 / 60 / 135 drivers an hour), stays, value of time, patience, route shares, destinations.
- The result is sensitive to the Monterey stop's capacity: at $2 it runs near 96% busy, so circling (about 6% of its
  traffic) is what tips the loop into a long queue.

## Engine lessons

- An all-way stop's queue must skip a car that has no room past the stop, or the loop gridlocks.
- Cars may only enter a packed loop when there is room (`ringCap`); otherwise the line stays on the approach street.
- With 1-second steps, stop service times round up to whole seconds.
