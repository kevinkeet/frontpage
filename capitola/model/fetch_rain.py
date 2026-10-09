"""Rain-flood inputs: daily rainfall (NCEI GHCN-D), Soquel Creek flow/stage (USGS 11160000)."""
import pandas as pd, requests, io, sys
D='data'
def ncei(st,b,e):
    u=('https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries'
       f'&stations={st}&startDate={b}&endDate={e}&dataTypes=PRCP&format=csv&units=standard')
    df=pd.read_csv(io.StringIO(requests.get(u,timeout=300).text),parse_dates=['DATE'])
    return df.set_index('DATE').PRCP
if 'rain' in sys.argv:
    out={}
    for st,name in [('USC00040673','ben_lomond'),('USC00047916','santa_cruz'),('USW00023277','watsonville_ap')]:
        parts=[ncei(st,f'{y}-01-01',f'{min(y+9,2026)}-12-31') for y in range(1950,2027,10)]
        s=pd.concat(parts); s=s[~s.index.duplicated()]; out[name]=s; print(name,s.index.min().date(),s.index.max().date(),s.notna().sum())
    pd.DataFrame(out).to_csv(f'{D}/rain_daily.csv.gz')
if 'flow' in sys.argv:
    # daily mean discharge since 1951
    u='https://waterservices.usgs.gov/nwis/dv/?format=rdb&sites=11160000&parameterCd=00060&startDT=1951-01-01&endDT=2026-10-09'
    t=[l for l in requests.get(u,timeout=300).text.splitlines() if not l.startswith('#')]
    dv=pd.read_csv(io.StringIO('\n'.join([t[0]]+t[2:])),sep='\t')
    dv=dv.rename(columns={dv.columns[2]:'date',dv.columns[3]:'q_mean'})[['date','q_mean']]
    dv['q_mean']=pd.to_numeric(dv.q_mean,errors='coerce'); dv['date']=pd.to_datetime(dv.date); dv.set_index('date').to_csv(f'{D}/soquel_dv.csv.gz')
    print('dv',dv.date.min(),dv.date.max(),dv.q_mean.notna().sum())
    # instantaneous discharge + gage height since 2007 -> daily max
    parts=[]
    for y in range(2007,2027):
        u=('https://waterservices.usgs.gov/nwis/iv/?format=rdb&sites=11160000&parameterCd=00060,00065'
           f'&startDT={y}-01-01&endDT={y}-12-31')
        t=[l for l in requests.get(u,timeout=300).text.splitlines() if not l.startswith('#')]
        if len(t)<3: print(y,'none'); continue
        df=pd.read_csv(io.StringIO('\n'.join([t[0]]+t[2:])),sep='\t')
        qc=[c for c in df.columns if c.endswith('_00060')][0]; hc=[c for c in df.columns if c.endswith('_00065')]
        x=pd.DataFrame({'t':pd.to_datetime(df.datetime),'q':pd.to_numeric(df[qc],errors='coerce'),
                        'h':pd.to_numeric(df[hc[0]],errors='coerce') if hc else float('nan')})
        parts.append(x); print(y,len(x))
    iv=pd.concat(parts).set_index('t')
    iv.to_csv(f'{D}/soquel_iv.csv.gz')
