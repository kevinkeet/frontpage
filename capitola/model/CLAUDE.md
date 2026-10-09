# Capitola Village flood-risk model

Model behind **kevinkeet.com/capitola**: when is Capitola Village (Esplanade, creekside streets) most likely to
flood in the 2026–27 El Niño winter, from the **ocean** (tide + Kelvin-wave sea-level anomaly + swell) and from
**rain** (Soquel Creek). Built in a claude.ai chat for Kevin Keet on Oct 9, 2026, then moved here so a GitHub
Action can rerun it every morning. This folder is the canonical copy (the old local `capitola-flood/` folder is
superseded). The repo is public and GitHub Pages serves this folder, so keep personal notes out of it.

## How the site stays current

- `.github/workflows/capitola-refresh.yml` runs daily at 13:23 UTC (6:23 AM PDT / 5:23 AM PST) and on demand
  (Actions tab → "Refresh Capitola flood data" → Run workflow, or `gh workflow run capitola-refresh.yml`):
  `fetch_data.py mop wlrecent` → `build_tables.py coastal` → `run_weekly.py` → copies `dash/*.csv` into
  `../data/` → commits "Capitola: model run … UTC" as github-actions[bot] and pushes. Pages redeploys in ~1 min.
  The run summary (ALERT / NO ALERT and the day list) shows on the workflow run page.
- The CDIP hindcast (~9 MB, static) is cached by actions/cache; nowcasts and recent water levels are fetched each run.
  Only `capitola/data/*.csv` is committed; the refreshed water-level file and all build products stay in the runner.
- The workflow stops itself after 2027-04-30 (the model's dates cover this winter only). For next winter: update the
  hardcoded season windows (`season.py`, `build_dash_data.py`, `forecast.OUTLOOK_END`), the cutoff in the workflow,
  and refetch tide predictions past 2027 (`fetch_data.py pred`).
- If a run fails, GitHub emails the account that last edited the workflow; the page keeps the last good numbers and
  marks the forecasts "Out of date" after 36 hours.
- Run locally from this folder: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`, then the same
  three commands with `.venv/bin/python`, then `cp dash/*.csv ../data/`. Preview with the `holdem-site` entry in
  `Claude applications folder/.claude/launch.json` (serves `frontpage/` on :8090 → http://localhost:8090/capitola/).
- Testing hook: `CAPITOLA_TODAY=YYYY-MM-DD` makes `season.py` and `run_weekly.kelvin_paths` act as if it were that day.

## The page (../index.html)

Plain HTML + d3 v7.9.0 (vendored in `../vendor/`). Two kinds of data:
- **Model CSVs** in `../data/` (this folder's output), fetched with `cache: 'no-cache'`.
- **Live data fetched in the visitor's browser** (all CORS-enabled, checked Oct 9, 2026): NWS active alerts for the
  Capitola point, NOAA CO-OPS 9413450 water level + predictions, CDIP MOP nowcast SC112 via OPeNDAP ASCII
  (`thredds.cdip.ucsd.edu/thredds/dodsC/…/SC112_nowcast.nc.ascii`), USGS 11160000 IV JSON, NWPS SOQC1 stage/flow,
  NWS gridpoint QPF. NDBC realtime files are NOT CORS-enabled. Each live card fails on its own.
- The live flood index = latest observed Monterey water level + 0.14 + Stockdon runup from the latest CDIP nowcast,
  i.e. the same formula as `model.py` (the page carries a JS port; keep the two in step).

## Files

| File | What it does |
|---|---|
| `model.py` | Coastal physics: deshoaling, Stockdon runup, TWL, thresholds, direction ratios |
| `offsets.py` | Kelvin-wave offset scenarios (baseline + anomaly × recession shape from past El Niños), season-aware |
| `season.py` | Winter calendar Nov 1–Mar 31: daily P(flood), P(severe), swell needed by direction; scenario totals. Past days count by the observed flood index |
| `forecast.py` | `run()` 10-day coastal forecast; `outlook()` tide+offset+avg/big swell through Mar 31; `rain_forecast()` 8-day creek forecast |
| `rain_model.py` | Soquel Creek peak model (rain → peak flow/stage), rating curve, NWS levels |
| `build_tables.py` | Rebuilds derived tables/fits from raw data (`coastal`, `creek`, or both) + `kelvin_analogs()` |
| `build_dash_data.py`, `build_rain_data.py` | Write the page's CSVs into `dash/` |
| `run_weekly.py` | One run: forecasts + outlook + CSVs; prints ALERT / NO ALERT |
| `fetch_data.py`, `fetch_rain.py` | Downloaders (`mop` skips the hindcast if present; `wlrecent` appends recent water levels) |
| `thredds_ssl.py` | Points netCDF's libcurl at the system CA bundle (see gotchas) |
| `data/` | Raw inputs committed here; hindcasts, nowcasts, pickles and `soquel_iv` are fetched/built (see `.gitignore`) |

## Data sources (all free, no keys)

| Source | Use | Notes / quirks |
|---|---|---|
| NOAA CO-OPS Monterey **9413450** `api.tidesandcurrents.noaa.gov/api/prod/datagetter` | Observed water level, predictions | `hourly_height` max 1 yr/request; `water_level` (6-min) ~31 days; `predictions` hourly 1 yr. **NAVD88 = MLLW − 0.14 ft** here (MHHW 5.34 ft above MLLW) |
| CDIP MOP alongshore **SC111–SC113** (THREDDS OPeNDAP `thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/SC11x_{hindcast,nowcast,forecast}.nc`) | Nearshore waves at 15 m depth just off Capitola Beach | Hindcast 2000-01-01 → 2025-03-31, nowcast after (hourly, ~2 h latency), forecast ~6 days. Vars `waveHs` (m), `waveTp`, `waveDp`, `waveTime`. MOP refracts offshore swell into the bay, so direction is built in |
| Open-Meteo marine | 10-day offshore forecast for days 7–10 (scaled by direction ratio) | Free tier rate-limits; `forecast.py` falls back gracefully |
| USGS **11160000** Soquel Creek at Soquel | Creek flow/stage (15-min since 2007), daily since 1951, annual peaks since 1937 | |
| NWS NWPS gauge **SOQC1** | Flood levels | Action 13, Minor (flood stage) 16, Moderate 18, Major 22 ft |
| NCEI GHCN-D daily rain | Ben Lomond **USC00040673** (primary), Santa Cruz USC00047916, Watsonville AP USW00023277 | Ben Lomond lags ~1 week |
| IEM ASOS daily (Watsonville WVI) | Most recent days of rain (× 2.12 ≈ Ben Lomond) | |
| NWS gridpoint QPF `api.weather.gov/gridpoints/MTR/91,73` | 8-day rain forecast at Ben Lomond | Needs a generic User-Agent header |

## Coastal model (model.py)

**Flood index (TWL, ft NAVD88) = still water + wave runup**
- Still water = Monterey water level (observed for history; predicted tide + offset for forecasts) + 0.14.
- Runup = Stockdon et al. (2006) R2%, beach slope β = 0.06, using CDIP MOP Hs/Tp at 15 m (mean of SC111–113)
  de-shoaled to deep water with linear theory. Long-period swell dominates: R ∝ √(H0·L0).

| Level | Index ft | Evidence |
|---|---|---|
| Watch | 11.0 | waves reaching the seawall |
| Flood | 12.5 | 2014-03-01 Esplanade closed, car floated (index 12.5, rank 61 of 9,780 days); 2024-12-23 Village closed, seawater in (13.2, rank 28) |
| Severe | 15.5 | 2023-12-28 condos/restaurants flooded (15.8, rank 5); 2023-01-05 wharf broken (17.5, rank 1); 2008-01-05 surf over wharf (15.9, rank 4) |

Beach slope 0.04–0.15 keeps Jan 2023 #1 and Dec 2023 #5. Mar 2014 was a short-period storm that Stockdon
under-weights; minor overtopping is under-reported, so the Flood line may be slightly conservative.

**Swell direction**: median share of offshore height reaching Capitola (ERA5 vs MOP, 2000–2024, Hs > 2 m):
S 0.49, SSW 0.54–0.57, SW 0.58, WSW 0.50–0.56, W 0.42, WNW 0.33/0.25, NW 0.20. Long periods (≥13 s) refract in
more: SW ~0.65, W 0.45, WNW 0.39, NW 0.32 (used for "swell needed").

**Winter probabilities (season.py)**: P(flood) = P(Y ≥ threshold − base), base = day's highest predicted tide + 0.14
+ offset that day; Y = (day's max TWL − day's max base) from the El Niño winters in the wave record (2002–03,
2009–10, 2015–16, 2023–24). Back-test: all winters 2.53 expected vs 2.30 actual flood days; El Niño winters 6.7 vs 6.25.
Days before today use the observed daily peak instead (1 if it crossed the line, else 0), so totals read
"observed so far + expected for the rest of the winter".

**Kelvin-wave offset (offsets.py)**: offset(t) = 0.12 + A_now × shape(t) / shape(today), A_now = last-7-day mean
(observed − predicted) − 0.12. Shapes = anomaly after its Sep–Nov peak in 1982–83, 1997–98, 2015–16, peak = mid-Oct:
`recede` = their mean (Nov .87, Dec .66, Jan .69, Feb .59, Mar .38), `fast` = month-by-month minimum (Nov .60,
Dec .56, Jan .56, Feb .57, Mar .19), `hold` = 1.0. Dividing by shape(today) makes later runs start from the
measured level (runs before Oct 15 are unchanged). Quirk: because `fast` is flat Dec–Feb, a run in December can
give "Recedes fast" slightly more flood days than "Recedes".

## Creek model (rain_model.py)

- Daily peak flow at the Soquel gauge: `log10(Q) = 1.108 + 1.739·log10(R0 + 0.5·R1 + 0.1) + 0.920·log10(A30 + 1)`,
  R0 = rain on the day, R1 = day before (Ben Lomond, in), A30 = rain over days d−31..d−2. Applies when R0+R1 ≥ 1 in.
  Residual sd 0.42 (log10), shrunk ×0.8 for exceedance probabilities. R² 0.64, n 562 wet days.
- Rating (2017+): q = exp(1.774·ln(h − 1) + 3.868): Action 13 ft ≈ 3,930 cfs, flood stage 16 ≈ 5,830, Moderate 18 ≈ 7,280, Major 22 ≈ 10,600.
- Validation: 2022-12-31 (19.8 ft) P(flood stage) 0.59; 2023-01-09 (18.6) 0.49; 2016-03-05 (16.0) missed (dry start,
  heavier mountain rain than Ben Lomond caught). Compound flag: P(flood stage) ≥ 25% and high tide + offset ≥ 5 ft.
- Not modeled: Noble Gulch storm drain (the March 2011 flood came from a failed culvert).

## Gotchas

- **THREDDS SSL**: netCDF4 points libcurl at certifi's CA bundle and netCDF-C strips spaces from that path, so every
  OPeNDAP open fails ("NetCDF: I/O failure") when the venv sits under a folder with spaces ("Claude applications
  folder"). `thredds_ssl.py` re-points it at the system bundle; import it in any script that opens THREDDS URLs.
- pandas datetime units (µs vs ns): `offsets.offset_path` converts everything to ns.
- The NWS gridpoint API needs a User-Agent (use a generic one).
- `fetch_data.py wl` / `fetch_rain.py flow` have fixed end dates (2026-10-09); they're only for full rebuilds.

## Ideas not built

- Alerts: `run_weekly.py` already decides ALERT (any coastal day ≥ Watch, or a creek day with P(Action) ≥ 25% or a
  compound flag). The workflow could open a GitHub issue on ALERT (emails the repo owner, no secrets needed).
- More rain gauges or gridded rain (PRISM/MRMS) for the creek model; storm surge forecasts (NOAA ETSS) instead of
  persisting the 3-day offset; beach-width/sand state.
