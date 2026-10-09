"""Capitola flood-risk forecast: run weekly (or any time).
Days 0-6 : CDIP MOP nearshore wave forecast off Capitola (SC111-113) + NOAA tide prediction + current offset
Days 7-15: Open-Meteo offshore wave forecast, scaled to Capitola by swell direction (lower confidence)
Offset   : mean observed-minus-predicted water level at Monterey over the last 72 h (Kelvin wave + surge)
Usage    : python3 forecast.py  -> writes forecast.json and prints an alert summary
"""
import pandas as pd, numpy as np, requests, io, json, datetime as dt, xarray as xr
import thredds_ssl  # noqa: F401  (CA bundle fix for OPeNDAP)
from model import *
TZ='America/Los_Angeles'
NOAA='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=9413450&datum=MLLW&units=english&time_zone=gmt&format=csv&application=capitola_flood'
def noaa(prod,b,e,extra=''):
    df=pd.read_csv(io.StringIO(requests.get(f'{NOAA}&product={prod}&begin_date={b}&end_date={e}{extra}',timeout=60).text))
    df.columns=[c.strip() for c in df.columns]; df['Date Time']=pd.to_datetime(df['Date Time'])
    return df.set_index('Date Time').iloc[:,0].astype(float)

def run(now=None):
    now=pd.Timestamp.now('UTC').tz_localize(None) if now is None else now
    b=(now-pd.Timedelta(days=3)).strftime('%Y%m%d'); e=(now+pd.Timedelta(days=17)).strftime('%Y%m%d')
    pred=noaa('predictions',b,e,'&interval=h')
    obs=noaa('water_level',b,now.strftime('%Y%m%d')); obs=obs[obs.index.minute==0]
    resid=(obs-pred).dropna(); offset=float(resid[-72:].mean())
    b7=(now-pd.Timedelta(days=7)).strftime('%Y%m%d')
    o7=noaa('water_level',b7,now.strftime('%Y%m%d')); o7=o7[o7.index.minute==0]
    p7=noaa('predictions',b7,now.strftime('%Y%m%d'),'&interval=h'); resid7=float((o7-p7).dropna()[-168:].mean())
    # nearshore forecast (MOP)
    mop=[]
    for s in ['SC111','SC112','SC113']:
        ds=xr.open_dataset(f'https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/{s}_forecast.nc')
        mop.append(pd.DataFrame({'Hs':ds.waveHs.values,'Tp':ds.waveTp.values,'Dp':ds.waveDp.values},index=pd.to_datetime(ds.waveTime.values)))
    m=pd.concat(mop).groupby(level=0).mean().resample('h').interpolate()
    m['src']='CDIP nearshore'
    # extended offshore forecast (Open-Meteo), scaled by direction ratio
    try:
        j=requests.get('https://marine-api.open-meteo.com/v1/marine?latitude=37.0&longitude=-122.5'
                       '&hourly=wave_height,wave_direction,wave_period,swell_wave_peak_period&forecast_days=16&timezone=GMT',timeout=60).json()
        o=pd.DataFrame(j['hourly']); o.index=pd.to_datetime(o.pop('time')); o=o.dropna(subset=['wave_height','wave_direction','wave_period'])
    except Exception:   # extended outlook is optional (free API has a daily cap); fall back to CDIP days only
        o=pd.DataFrame(columns=['wave_height','wave_direction','wave_period','swell_wave_peak_period'],dtype=float)
    bins=np.array(sorted(DIR_RATIO)); ratio=np.array([DIR_RATIO[b] for b in bins])
    o['Hs']=o.wave_height*np.interp(o.wave_direction,bins,ratio)
    o['Tp']=pd.to_numeric(o.swell_wave_peak_period,errors='coerce').fillna(o.wave_period*1.3); o['Dp']=o.wave_direction; o['src']='Open-Meteo offshore (scaled)'
    o=o[o.index>m.index.max()][['Hs','Tp','Dp','src']]
    w=pd.concat([m[['Hs','Tp','Dp','src']],o])
    f=w.join(pred.rename('tide'),how='inner'); f=f[f.index>=now.floor('h')]
    f['still']=f.tide+offset
    f['runup']=runup_ft(f.Hs.values,f.Tp.values)
    f['twl']=f.still+MLLW_TO_NAVD88_FT+f.runup
    f['level']=level(f.twl.values)
    f.index=f.index.tz_localize('UTC').tz_convert(TZ).tz_localize(None)
    days=[]
    for d,g in f.dropna(subset=['twl']).groupby(f.dropna(subset=['twl']).index.normalize()):
        k=g.twl.idxmax(); r=g.loc[k]
        days.append({'date':d.strftime('%Y-%m-%d'),'peak_time':k.strftime('%-I %p'),'twl':round(float(r.twl),2),
                     'level':str(r.level),'tide_ft':round(float(r.tide),2),'hs_capitola_ft':round(float(r.Hs)*M2FT,1),
                     'period_s':round(float(r.Tp),1),'source':r.src})
    res={'run_at_utc':now.strftime('%Y-%m-%d %H:%M'),'offset_ft':round(offset,2),'resid7_ft':round(resid7,2),
         'thresholds':{'watch':WATCH,'flood':FLOOD,'severe':SEVERE},'days':days,
         'hourly':[{'t':t.strftime('%Y-%m-%dT%H:%M'),'twl':round(float(r.twl),2),'tide':round(float(r.tide),2),'still_navd':round(float(r.still)+MLLW_TO_NAVD88_FT,2),'runup':round(float(r.runup),2),
                    'hs_ft':round(float(r.Hs)*M2FT,1),'tp':round(float(r.Tp),1)} for t,r in f.iterrows()]}
    worst=max(days,key=lambda x:x['twl'])
    alerts=[x for x in days if x['level']!='Low']
    res['summary']=(f"Highest risk: {worst['date']} around {worst['peak_time']} ({worst['level']}, index {worst['twl']} ft vs flood {FLOOD} ft). "
                    f"Water level offset now {offset:+.2f} ft.")
    res['alert']=bool(alerts)
    return res

if __name__=='__main__':
    r=run(); json.dump(r,open('forecast.json','w'),indent=1)
    print(r['summary'])
    for x in r['days']: print(x['date'],x['peak_time'],x['level'],x['twl'],'tide',x['tide_ft'],'Hs',x['hs_capitola_ft'],'ft @',x['period_s'],'s',x['source'])

# ---------------- Long-range outlook (no swell forecast) ----------------
# Still water = NOAA predicted tide + an assumed offset; swell lines add the typical (median hour) and
# big-day (90th percentile daily max) runup for that month, from El Nino seasons 2002-03, 2009-10, 2015-16, 2023-24.
OUTLOOK_END='2027-03-31 23:00'
def outlook(offset_today, now=None, climate_csv='data/swell_climate.csv'):
    """offset_today: last-7-day mean observed-minus-predicted (ft); offsets then follow offsets.py scenarios."""
    now=pd.Timestamp.now('UTC').tz_localize(None) if now is None else now
    end_local=pd.Timestamp(OUTLOOK_END)
    pred=noaa('predictions',now.strftime('%Y%m%d'),(end_local+pd.Timedelta(days=1)).strftime('%Y%m%d'),'&interval=h')
    pred.index=pred.index.tz_localize('UTC').tz_convert(TZ).tz_localize(None)
    pred=pred[(pred.index>=pd.Timestamp.now(TZ).tz_localize(None).floor('h'))&(pred.index<=end_local)]
    clim=pd.read_csv(climate_csv).set_index('month')
    h=pd.DataFrame({'tide_mllw':pred})
    h['tide_navd']=h.tide_mllw+MLLW_TO_NAVD88_FT
    h['runup_typical']=clim.typical_runup_ft.reindex(h.index.month).values
    h['runup_big']=clim.big_runup_ft.reindex(h.index.month).values
    import offsets as O
    start=pd.Timestamp.now(TZ).tz_localize(None).normalize()
    offs={}
    for k in O.SHAPES:
        off=O.offset_path(h.index,k,offset_today,start)
        offs[k]=off
        h[f'offset_{k}']=off
        h[f'still_{k}']=h.tide_navd+off
        h[f'avg_{k}']=h[f'still_{k}']+h.runup_typical
        h[f'big_{k}']=h[f'still_{k}']+h.runup_big
    h=h.round(2)
    cols=[c for c in h.columns if c not in ('runup_typical','runup_big')]
    g=h.groupby(h.index.normalize())
    day=g[cols].max()
    day['high_tide_time']=g.tide_mllw.idxmax().dt.strftime('%-I:%M %p').values
    day['runup_typical']=g.runup_typical.first(); day['runup_big']=g.runup_big.first()
    for k in offs:
        day[f'level_avg_{k}']=level(day[f'avg_{k}'].values); day[f'level_big_{k}']=level(day[f'big_{k}'].values)
    return h, day, offs

# ---------------- Rain: Soquel Creek forecast (next ~8 days) ----------------
# Observed rain: NCEI Ben Lomond COOP (lags ~1 week), most recent days from Watsonville airport (IEM) x k_wvi.
# Forecast rain: NWS gridded QPF at Ben Lomond (MTR 91,73), 6-hourly, ~8 days.
# Creek now: USGS 11160000 latest 15-minute stage and flow.
UA={'User-Agent':'capitola-flood-model'}
def _ncei(st,b,e):
    u=('https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries'
       f'&stations={st}&startDate={b}&endDate={e}&dataTypes=PRCP&format=csv&units=standard')
    d=pd.read_csv(io.StringIO(requests.get(u,timeout=120).text),parse_dates=['DATE'])
    return d.set_index('DATE').PRCP if len(d) else pd.Series(dtype=float)

def rain_forecast(tide_daily_max=None):
    import rain_model as RM
    fj=json.load(open('data/rain_model_fit.json')); b=np.array(fj['b']); sd=fj['sd']
    today=pd.Timestamp.now(TZ).tz_localize(None).normalize()
    b0=today-pd.Timedelta(days=40)
    bl=_ncei('USC00040673',b0.strftime('%Y-%m-%d'),today.strftime('%Y-%m-%d'))
    u=('https://mesonet.agron.iastate.edu/cgi-bin/request/daily.py?network=CA_ASOS&stations=WVI'
       f'&year1={b0.year}&month1={b0.month}&day1={b0.day}&year2={today.year}&month2={today.month}&day2={today.day}&format=csv')
    w=pd.read_csv(io.StringIO(requests.get(u,timeout=120).text),parse_dates=['day']).set_index('day')
    wv=pd.to_numeric(w.precip_in,errors='coerce')
    obs=pd.Series(np.nan,index=pd.date_range(b0,today-pd.Timedelta(days=1)))
    obs.update(wv*fj['k_wvi']); obs.update(bl)        # Ben Lomond wins where it exists
    obs=obs.fillna(0.0)
    # NWS QPF (mm per 6 h, UTC intervals) -> inches per local day
    g=requests.get('https://api.weather.gov/gridpoints/MTR/91,73',headers=UA,timeout=60).json()['properties']['quantitativePrecipitation']['values']
    q=[]
    for v in g:
        t0,dur=v['validTime'].split('/'); hrs=int(dur.replace('PT','').replace('P','').replace('H','') or 0) if 'D' not in dur else 24*int(dur.split('D')[0].replace('P',''))
        t=pd.Timestamp(t0).tz_convert(TZ).tz_localize(None)+pd.Timedelta(hours=hrs/2)
        q.append((t.normalize(),(v['value'] or 0)/25.4))
    qpf=pd.Series(dict(pd.DataFrame(q).groupby(0)[1].sum()))
    qpf=qpf[qpf.index>=today]
    R=pd.concat([obs,qpf]); R=R[~R.index.duplicated(keep='last')].sort_index()
    F=RM.features(R).loc[today:]
    P=RM.predict(F.R0,F.R1,F.A30.fillna(0),b,sd)
    # creek now
    t=[l for l in requests.get('https://waterservices.usgs.gov/nwis/iv/?format=rdb&sites=11160000&parameterCd=00060,00065&period=P1D',timeout=60).text.splitlines() if not l.startswith('#')]
    iv=pd.read_csv(io.StringIO('\n'.join([t[0]]+t[2:])),sep='\t')
    qc=[c for c in iv.columns if c.endswith('_00060')][0]; hc=[c for c in iv.columns if c.endswith('_00065')][0]
    now_q=float(pd.to_numeric(iv[qc],errors='coerce').dropna().iloc[-1]); now_h=float(pd.to_numeric(iv[hc],errors='coerce').dropna().iloc[-1])
    A_now=float(R.loc[today-pd.Timedelta(days=30):today-pd.Timedelta(days=1)].sum())
    days=[]
    for i,(d,r) in enumerate(F.iterrows()):
        qm=P['q_median'][i]; st=float(RM.flow_to_stage(qm)) if np.isfinite(qm) else None
        lvl='None'
        for k in ['Moderate','Minor','Action']:
            if P['p_'+k.lower()][i]>=0.5: lvl=k; break
        tide=float(tide_daily_max.get(d,np.nan)) if tide_daily_max is not None else np.nan
        compound=bool(P['p_minor'][i]>=0.25 and tide>=5.0)
        days.append({'date':d.strftime('%Y-%m-%d'),'rain_in':round(float(r.R0),2),'wetness_in':round(float(r.A30),1),
                     'peak_flow_cfs':None if not np.isfinite(qm) else int(round(qm)),'peak_stage_ft':None if st is None else round(st,1),
                     'p_action':round(float(P['p_action'][i]),3),'p_minor':round(float(P['p_minor'][i]),3),'p_moderate':round(float(P['p_moderate'][i]),3),
                     'likely_level':lvl,'high_tide_ft':None if not np.isfinite(tide) else round(tide,2),'compound':compound,
                     'source':'Observed' if d<today else 'NWS rain forecast'})
    needed={k:round(RM.rain_needed(A_now,b,sd,k),1) for k in ['Action','Minor','Moderate']}
    return {'creek_now_stage_ft':round(now_h,2),'creek_now_flow_cfs':now_q,'wetness_now_in':round(A_now,1),
            'rain_needed_in':needed,'days':days}
