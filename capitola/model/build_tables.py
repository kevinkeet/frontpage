"""Rebuild every derived table from the raw downloads in data/.
Run after fetch_data.py (mop, wl, pred) and fetch_rain.py (rain, flow).
Produces: merged_hourly.csv.gz, hourly_model.pkl, daily_max.pkl, winter_hours.pkl, winter_days.pkl,
          swell_climate.csv, resid_all.pkl, soquel_dailymax.csv.gz, soquel_annual_peaks.csv, rain_model_fit.json
"""
import pandas as pd, numpy as np, json, requests, io
from model import *
D = 'data/'
TZ = 'America/Los_Angeles'
ELNINO_WAVE_WINTERS = [2002, 2009, 2015, 2023]          # El Nino seasons inside the CDIP wave record (start year)


def to_local(idx):
    return idx.tz_localize('UTC').tz_convert(TZ).tz_localize(None)


def coastal():
    wl = pd.read_csv(D + 'monterey_wl_obs.csv.gz', parse_dates=['time_utc'], index_col='time_utc')
    m = []
    for s in ['SC111', 'SC112', 'SC113']:
        df = pd.concat([pd.read_csv(f'{D}{s}_{k}.csv.gz', parse_dates=['time_utc'], index_col='time_utc') for k in ['hindcast', 'nowcast']])
        df.index = df.index.round('h'); df = df[~df.index.duplicated()]
        m.append(df.add_prefix(s + '_'))
    w = pd.concat(m, axis=1)
    w['Hs'] = w[[c for c in w if c.endswith('_Hs')]].mean(axis=1)
    w['Tp'] = w[[c for c in w if c.endswith('_Tp')]].mean(axis=1)
    w['Dp'] = w['SC112_Dp']
    d = wl.join(w[['Hs', 'Tp', 'Dp']], how='inner')
    d.to_csv(D + 'merged_hourly.csv.gz')
    # hourly model in local time
    d.index = to_local(d.index); d.index.name = 'time_local'
    d = d.dropna(subset=['wl_mllw_ft', 'Hs', 'Tp'])
    d['R'] = runup_ft(d.Hs.values, d.Tp.values); d['TWL'] = twl_ft(d.wl_mllw_ft.values, d.Hs.values, d.Tp.values)
    d.to_pickle(D + 'hourly_model.pkl')
    g = d.groupby(d.index.normalize())
    day = d.loc[g.TWL.idxmax().values, ['TWL', 'wl_mllw_ft', 'R', 'Hs', 'Tp', 'Dp']].copy()
    day['time'] = day.index.strftime('%H:%M'); day.index = day.index.normalize()
    day.to_pickle(D + 'daily_max.pkl')
    # winter hours/days: residual anomaly + runup, per-winter mean offset C
    p = pd.read_csv(D + 'monterey_pred.csv.gz', parse_dates=['time_utc'], index_col='time_utc').pred_mllw_ft
    p.index = to_local(p.index)
    d = d.join(p.rename('pred'), how='left'); d['resid'] = d.wl_mllw_ft - d.pred
    win = d[d.index.month.isin([11, 12, 1, 2, 3])].copy()
    win['wy'] = np.where(win.index.month >= 11, win.index.year, win.index.year - 1)
    win['C'] = win.groupby('wy').resid.transform('mean')
    win['X'] = win.resid - win.C + win.R
    win['base'] = win.pred + MLLW_TO_NAVD88_FT + win.C
    win.to_pickle(D + 'winter_hours.pkl')
    dd = win.groupby(win.index.normalize()).agg(base=('base', 'max'), twl=('TWL', 'max'), wy=('wy', 'first'))
    dd['Y'] = dd.twl - dd.base
    dd.to_pickle(D + 'winter_days.pkl')
    # swell climate by month in El Nino seasons (Oct-Mar)
    wy = np.where(d.index.month >= 10, d.index.year, d.index.year - 1)
    x = d[pd.Series(wy, index=d.index).isin(ELNINO_WAVE_WINTERS).values & d.index.month.isin([10, 11, 12, 1, 2, 3])]
    dm = x.R.groupby(x.index.normalize()).max()
    rows = []
    for mth in [10, 11, 12, 1, 2, 3]:
        h = x[x.index.month == mth]; ddm = dm[dm.index.month == mth]
        rows.append({'month': mth, 'typical_runup_ft': round(h.R.median(), 2), 'big_runup_ft': round(ddm.quantile(0.9), 2),
                     'typical_hs_ft': round(h.Hs.median() * M2FT, 1), 'typical_tp_s': round(h.Tp.median(), 1)})
    pd.DataFrame(rows).to_csv(D + 'swell_climate.csv', index=False)
    # full residual series 1979-present (for Kelvin wave analogs)
    o = pd.read_csv(D + 'monterey_wl_obs.csv.gz', parse_dates=['time_utc'], index_col='time_utc').wl_mllw_ft
    pu = pd.read_csv(D + 'monterey_pred.csv.gz', parse_dates=['time_utc'], index_col='time_utc').pred_mllw_ft
    old = pd.read_csv(D + 'monterey_resid_1979_1999.csv.gz', parse_dates=[0], index_col=0).iloc[:, 0]
    r = pd.concat([old, (o - pu).dropna()]).sort_index(); r = r[~r.index.duplicated()]
    r.to_frame('resid').to_pickle(D + 'resid_all.pkl')
    print('coastal tables rebuilt:', len(d), 'hours')


def kelvin_analogs():
    """Monthly anomaly (observed-minus-predicted minus same months in 3 prior years), Jul..Mar."""
    m = pd.read_pickle(D + 'resid_all.pkl').resid.resample('MS').mean()
    out = {}
    for ev, base in [(1982, [1979, 1980, 1981]), (1997, [1994, 1995, 1996]), (2015, [2011, 2012, 2013])]:
        vals = []
        for t in pd.date_range(f'{ev}-07-01', f'{ev + 1}-03-01', freq='MS'):
            b = np.mean([m.get(pd.Timestamp(year=y if t.month >= 7 else y + 1, month=t.month, day=1), np.nan) for y in base])
            vals.append(round(float(m.get(t, np.nan) - b), 2))
        out[f'el_nino_{ev}_{str(ev + 1)[2:]}'] = vals
    return out


def creek():
    import rain_model as RM
    iv = pd.read_csv(D + 'soquel_iv.csv.gz', parse_dates=['t'], index_col='t')
    dmx = iv.resample('D').max(); dmx.columns = ['qmax', 'hmax']; dmx.to_csv(D + 'soquel_dailymax.csv.gz')
    t = [l for l in requests.get('https://nwis.waterdata.usgs.gov/nwis/peak?site_no=11160000&agency_cd=USGS&format=rdb', timeout=60).text.splitlines() if not l.startswith('#')]
    pk = pd.read_csv(io.StringIO('\n'.join([t[0]] + t[2:])), sep='\t')[['peak_dt', 'peak_va', 'gage_ht']]
    pk.columns = ['date', 'flow', 'stage']
    pk['flow'] = pd.to_numeric(pk.flow, errors='coerce'); pk['stage'] = pd.to_numeric(pk.stage, errors='coerce')
    pk['date'] = pd.to_datetime(pk.date, errors='coerce'); pk['wy'] = np.where(pk.date.dt.month >= 10, pk.date.dt.year + 1, pk.date.dt.year)
    pk.to_csv(D + 'soquel_annual_peaks.csv', index=False)
    R = RM.basin_rain()
    df = RM.features(R).join(dmx.qmax.rename('q'), how='inner').dropna()
    df = df[df.index.month.isin([10, 11, 12, 1, 2, 3, 4])]
    b, sd, r2, n = RM.fit(df)
    rain = pd.read_csv(D + 'rain_daily.csv.gz', parse_dates=[0], index_col=0)
    mk = (rain.ben_lomond > 0.1) & (rain.watsonville_ap > 0.1)
    k_wvi = float(rain.ben_lomond[mk].sum() / rain.watsonville_ap[mk].sum())
    json.dump({'b': b.tolist(), 'sd': sd, 'sd_scale': RM.SD_SCALE, 'r2': r2, 'n': n, 'flows': RM.FLOWS, 'stages': RM.STAGES, 'k_wvi': k_wvi},
              open(D + 'rain_model_fit.json', 'w'), indent=1)
    print('creek model refit: R2 %.2f n %d' % (r2, n))


if __name__ == '__main__':
    import sys
    parts = [a for a in sys.argv[1:] if a in ('coastal', 'creek')] or ['coastal', 'creek']   # daily job: coastal only
    if 'coastal' in parts: coastal()
    if 'creek' in parts: creek()
    print('Kelvin analogs:', kelvin_analogs())
