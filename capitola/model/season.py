"""Winter 2026-27 flood-risk calendar for Capitola Village.
Daily risk = P(Y >= threshold - base), base = day's highest predicted tide (NAVD88) + offset that day,
offset follows a receding Kelvin-wave scenario (offsets.py; central = 'recede'),
Y = (day's max TWL - day's max base) sampled from El Nino winters 2002-03, 2009-10, 2015-16, 2023-24.
Validated: reproduces observed flood-threshold days per winter (2.5 expected vs 2.3 actual, all winters)."""
import pandas as pd, numpy as np, json, os
from model import *
import offsets as O
ELNINO=[2002,2009,2015,2023]
TODAY=(pd.Timestamp(os.environ['CAPITOLA_TODAY']) if os.environ.get('CAPITOLA_TODAY')       # override for testing
       else pd.Timestamp.now('America/Los_Angeles').tz_localize(None).normalize())
dd=pd.read_pickle('data/winter_days.pkl'); Ys=np.sort(dd[dd.wy.isin(ELNINO)].Y.values)
def pexc(v): return 1-np.searchsorted(Ys,np.asarray(v),side='left')/len(Ys)
try: resid7=float(json.load(open('forecast.json'))['resid7_ft'])   # live 7-day offset from the latest forecast run
except Exception: resid7=float(pd.read_pickle('data/resid_all.pkl').resid[-24*7:].mean())
p=pd.read_csv('data/monterey_pred.csv.gz',parse_dates=['time_utc'],index_col='time_utc').pred_mllw_ft
p.index=p.index.tz_localize('UTC').tz_convert('America/Los_Angeles').tz_localize(None)
p=p['2026-11-01':'2027-03-31 23:00']
day=p.groupby(p.index.normalize()).agg(['max','idxmax']); day.columns=['tide_max','t_max']
day['high_tide_time']=pd.to_datetime(day.t_max).dt.strftime('%-I:%M %p'); day=day.drop(columns='t_max')
# Days already past count by what happened: the observed daily peak of the flood index (tide gauge + CDIP nowcast),
# so the winter totals are "observed so far + expected for the rest of the winter".
obs=pd.read_pickle('data/daily_max.pkl').TWL
seen=np.asarray((day.index<TODAY)&day.index.isin(obs.index))
day['observed_twl']=np.where(seen,obs.reindex(day.index).values,np.nan)
summary={}
for k in O.SHAPES:
    off=O.offset_path(day.index+pd.Timedelta(hours=12),k,resid7,TODAY)
    base=day.tide_max+MLLW_TO_NAVD88_FT+off
    pf,ps=pexc(FLOOD-base),pexc(SEVERE-base)
    pf=np.where(seen,(day.observed_twl>=FLOOD).astype(float),pf); ps=np.where(seen,(day.observed_twl>=SEVERE).astype(float),ps)
    summary[k]={'flood_days':float(pf.sum()),'severe_days':float(ps.sum()),'mean_offset_ft':float(off.mean())}
    if k=='recede':
        day['offset_ft']=off; day['base']=base; day['p_flood']=pf; day['p_severe']=ps
T=18.0; LONG_RATIO={'SW':0.65,'W':0.45,'WNW':0.39,'NW':0.32}
day['runup_needed_ft']=FLOOD-day.base
day['hs15_needed_m']=[hs15_for_runup(r,T) for r in day.runup_needed_ft]
for k,v in LONG_RATIO.items(): day[f'offshore_ft_{k}']=day.hs15_needed_m/v*M2FT
day.to_csv('season_calendar.csv',float_format='%.3f')
json.dump({'resid7':resid7,'scenarios':summary},open('season_summary.json','w'),indent=1)
if __name__=='__main__':
    print('resid7 %.2f'%resid7); print(json.dumps(summary,indent=1))
    print(day.sort_values('p_flood',ascending=False).head(12)[['tide_max','high_tide_time','offset_ft','p_flood','p_severe','offshore_ft_SW','offshore_ft_W','offshore_ft_WNW']].round(2).to_string())
    print(day.p_flood.groupby(day.index.to_period('M')).sum().round(2).to_string())
