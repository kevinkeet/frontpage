"""How well have the published forecasts matched what happened? Run locally after `build_tables.py coastal`.

Each daily run's forecast_daily.csv / forecast_hourly.csv is in git history; "observed" is the model's own flood index on
observed inputs (Monterey tide gauge + CDIP nowcast) from data/hourly_model.pkl and data/daily_max.pkl. Errors are
forecast minus observed, in feet, split into still water (tide + offset) and wave runup.

Usage: python skill.py [--since YYYY-MM-DD] [--fit]
  --since 2026-11-16   runs since the wave calibration (2026-11-13 for runs since the switch to ECMWF waves)
  --fit                refit the wave-height calibration in forecast.py (WAVE_EXP, WAVE_SCALE) from the raw forecasts
"""
import argparse, io, subprocess
import numpy as np, pandas as pd
from model import M2FT, WATCH

ap = argparse.ArgumentParser(); ap.add_argument('--since', default='2026-10-09'); ap.add_argument('--fit', action='store_true'); a = ap.parse_args()
git = lambda *x: subprocess.run(['git', *x], check=True, capture_output=True, text=True).stdout
commits = git('log', '--since=' + a.since, '--format=%H', '--', '../data/forecast_daily.csv').split()
H = pd.read_pickle('data/hourly_model.pkl'); last = H.index.max()
runs = {}
for c in reversed(commits):
    fd = pd.read_csv(io.StringIO(git('show', f'{c}:capitola/data/forecast_daily.csv')))
    fh = pd.read_csv(io.StringIO(git('show', f'{c}:capitola/data/forecast_hourly.csv')), parse_dates=['t'])
    run = pd.Timestamp(fd.run_at_utc.iloc[0]).tz_localize('UTC').tz_convert('America/Los_Angeles').tz_localize(None)
    fh['src'] = fh.t.dt.strftime('%Y-%m-%d').map(dict(zip(fd.date, fd.source)))
    runs[run] = fh.assign(run=run)
if not runs: raise SystemExit('no runs since ' + a.since)
F = pd.concat(runs.values()).set_index('t').join(H[['wl_mllw_ft', 'Hs', 'Tp', 'R', 'TWL']], how='inner')
F = F[F.index <= last]
F['lead'] = ((F.index - F.run) / pd.Timedelta(days=1)).astype(int)
F['e_twl'] = F.twl - F.TWL; F['e_still'] = F.still_navd - (F.wl_mllw_ft + 0.14); F['e_runup'] = F.runup - F.R
F['e_hs'] = F.hs_ft - F.Hs * M2FT
print(f'{len(runs)} runs {min(runs):%b %d} .. {max(runs):%b %d}; observations through {last:%b %d %H:%M}')
print('wave sources:', F.groupby(F.src.fillna('?')).run.nunique().to_dict())
mae = lambda x: x.abs().mean()
print('\nHourly errors by lead day (ft): flood index = still water + runup; waves = height at the 15 m line')
print(F.groupby('lead').agg(hours=('e_twl', 'size'), index_bias=('e_twl', 'mean'), index_mae=('e_twl', mae), still_bias=('e_still', 'mean'),
                            still_mae=('e_still', mae), runup_bias=('e_runup', 'mean'), runup_mae=('e_runup', mae), waves_bias=('e_hs', 'mean')).round(2).to_string())
D = F.assign(day=F.index.normalize()).groupby(['run', 'day']).agg(fc=('twl', 'max'), obs=('TWL', 'max'), n=('TWL', 'size')).reset_index()
D = D[D.n >= 20]; D['lead'] = (D.day - D.run.dt.normalize()).dt.days; D = D[D.lead >= 1]
print('\nDaily peak index by lead (ft) and Watch-level days (index >= %.1f) caught / missed / false alarms:' % WATCH)
for lo, hi in [(1, 3), (4, 6), (7, 9)]:
    g = D[(D.lead >= lo) & (D.lead <= hi)]
    if not len(g): continue
    ow, fw = g.obs >= WATCH, g.fc >= WATCH
    print(f'  {lo}-{hi} days: n={len(g)} bias {(g.fc - g.obs).mean():+.2f} MAE {(g.fc - g.obs).abs().mean():.2f} r={g.fc.corr(g.obs):.2f} | '
          f'caught {int((ow & fw).sum())}, missed {int((ow & ~fw).sum())}, false {int((fw & ~ow).sum())}')
if a.fit:
    # Raw wave-model heights (runs before Nov 16, 2026 published them uncorrected) against the nowcast, leads 1-6 days.
    # Plain arrays: F's index repeats (one row per run and hour), which pandas won't align.
    raw = (F.hs_raw_ft.fillna(F.hs_ft) if 'hs_raw_ft' in F else F.hs_ft).to_numpy()
    fam = F.src.fillna('').map(lambda s: 'ecmwf' if s.startswith('CDIP') and 'ECMWF' in s else 'noaa' if s.startswith('CDIP')
                               else 'open-meteo ecmwf' if 'ECMWF' in s else 'open-meteo (old)').to_numpy()
    obs, lead, run = (F.Hs * M2FT).to_numpy(), F.lead.to_numpy(), F.run.to_numpy()
    use = (lead >= 1) & (lead <= 6) & (raw >= 1) & (obs > 0)
    cdip = use & np.isin(fam, ['ecmwf', 'noaa'])
    b = np.polyfit(np.log(raw[cdip]), np.log(obs[cdip]), 1)[0]
    print(f'\nWave-height calibration for forecast.py (raw forecast vs nowcast, leads 1-6): WAVE_EXP = {b:.3f}')
    for k in ['ecmwf', 'noaa', 'open-meteo ecmwf', 'open-meteo (old)']:
        g = use & (fam == k)
        if g.any(): print(f'  {k}: scale {np.exp(np.mean(np.log(obs[g]) - b * np.log(raw[g]))):.3f} ({len(np.unique(run[g]))} runs, {int(g.sum())} hours)')
