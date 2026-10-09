"""Download inputs for the Capitola flood model.
- CDIP MOP nearshore waves (15 m depth) off Capitola Beach: SC111-SC113
- NOAA CO-OPS Monterey (9413450) hourly observed water level + datums
"""
import xarray as xr, pandas as pd, numpy as np, requests, io, sys, os
import thredds_ssl  # noqa: F401  (CA bundle fix for OPeNDAP)
D='data'
MOP='https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/{}_{}.nc'
def mop(site, kind):
    ds=xr.open_dataset(MOP.format(site,kind))
    df=pd.DataFrame({'Hs':ds.waveHs.values,'Tp':ds.waveTp.values,'Dp':ds.waveDp.values,'Dm':ds.waveDm.values},
                    index=pd.to_datetime(ds.waveTime.values))
    df.index.name='time_utc'
    return df
if 'mop' in sys.argv:
    for s in ['SC111','SC112','SC113']:
        for k in ['hindcast','nowcast']:
            if k=='hindcast' and os.path.exists(f'{D}/{s}_{k}.csv.gz'): continue   # 2000-2025, never changes
            df=mop(s,k); df.to_csv(f'{D}/{s}_{k}.csv.gz'); print(s,k,df.index.min(),df.index.max(),len(df))
if 'wlrecent' in sys.argv:
    # Append the latest preliminary Monterey water levels (6-minute product, kept on the hour) so the monthly
    # offset and Kelvin-wave charts stay current. The API serves 6-minute data about a month at a time.
    f=f'{D}/monterey_wl_obs.csv.gz'
    wl=pd.read_csv(f,parse_dates=['time_utc'],index_col='time_utc').wl_mllw_ft
    t=wl.index.max().normalize(); end=pd.Timestamp.now('UTC').tz_localize(None); parts=[]
    while t<=end:
        e=min(t+pd.Timedelta(days=30),end)
        u=('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&station=9413450'
           f'&begin_date={t:%Y%m%d}&end_date={e:%Y%m%d}&datum=MLLW&units=english&time_zone=gmt&format=csv&application=capitola_flood')
        df=pd.read_csv(io.StringIO(requests.get(u,timeout=60).text)); df.columns=[c.strip() for c in df.columns]
        if 'Water Level' in df:
            s=pd.Series(pd.to_numeric(df['Water Level'],errors='coerce').values,index=pd.to_datetime(df['Date Time'])).dropna()
            parts.append(s[s.index.minute==0])
        t=e+pd.Timedelta(days=1)
    if parts:
        new=pd.concat([wl]+parts); new=new[~new.index.duplicated(keep='last')].sort_index()
        new.rename('wl_mllw_ft').rename_axis('time_utc').to_frame().to_csv(f)
        print('Monterey water levels through',new.index.max(),f'(+{len(new)-len(wl)} hours)')
if 'wl' in sys.argv:
    out=[]
    for y in range(2000,2027):
        u=('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=hourly_height&station=9413450'
           f'&begin_date={y}0101&end_date={y}1231&datum=MLLW&units=english&time_zone=gmt&format=csv&application=capitola_flood')
        if y==2026:
            u=u.replace('product=hourly_height','product=water_level').replace(f'{y}1231','20261009')
        r=requests.get(u,timeout=60); df=pd.read_csv(io.StringIO(r.text))
        df.columns=[c.strip() for c in df.columns]
        if 'Water Level' not in df: print(y,'no data',r.text[:200]); continue
        df=df[['Date Time','Water Level']].rename(columns={'Date Time':'time_utc','Water Level':'wl_mllw_ft'})
        out.append(df); print(y,len(df))
    wl=pd.concat(out); wl['time_utc']=pd.to_datetime(wl.time_utc); wl=wl.set_index('time_utc')
    if 2026: wl=wl[~wl.index.duplicated()]
    wl.to_csv(f'{D}/monterey_wl_obs.csv.gz')
    r=requests.get('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/9413450/datums.json?units=english',timeout=60)
    open(f'{D}/monterey_datums.json','w').write(r.text)
if 'pred' in sys.argv:
    out=[]
    for y in range(2000,2028):
        u=('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&interval=h&station=9413450'
           f'&begin_date={y}0101&end_date={y}1231&datum=MLLW&units=english&time_zone=gmt&format=csv&application=capitola_flood')
        df=pd.read_csv(io.StringIO(requests.get(u,timeout=60).text)); df.columns=[c.strip() for c in df.columns]
        out.append(df.rename(columns={'Date Time':'time_utc','Prediction':'pred_mllw_ft'})); print(y,len(df))
    p=pd.concat(out); p['time_utc']=pd.to_datetime(p.time_utc); p.set_index('time_utc').to_csv(f'{D}/monterey_pred.csv.gz')
