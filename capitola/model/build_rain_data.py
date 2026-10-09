import pandas as pd, numpy as np, json
from rain_model import *
out='dash/'
fj=json.load(open('data/rain_model_fit.json')); b=np.array(fj['b']); sd=fj['sd']
EN=[1958,1966,1969,1973,1983,1987,1992,1995,1998,2010,2016,2024]
# 1 forecast
rf=json.load(open('rain_forecast.json')); fc=json.load(open('forecast.json'))
d=pd.DataFrame(rf['days'])
d['still_water_ft']=(d.high_tide_ft+fc['offset_ft']).round(2)
d['compound']=(d.p_minor>=0.25)&(d.still_water_ft>=5.0)
d['creek_now_stage_ft']=rf['creek_now_stage_ft']; d['creek_now_flow_cfs']=rf['creek_now_flow_cfs']; d['wetness_now_in']=rf['wetness_now_in']
for k,v in rf['rain_needed_in'].items(): d[f'rain_needed_{k.lower()}_in']=v
d.to_csv(out+'creek_forecast.csv',index=False)
# 2 levels + winter odds
pk=pd.read_csv('data/soquel_annual_peaks.csv',parse_dates=['date']).dropna(subset=['stage'])
imp={'Action':'Three feet below flood stage; NWS may issue a Flash Flood Watch.',
     'Minor':'Water reaches creekside properties in Soquel; flooding possible in Capitola, especially at high tide.',
     'Moderate':'Several feet of water in downtown Soquel; creekside areas of Capitola and the Esplanade flood.',
     'Major':'Capitola and the Esplanade flooded (1955, 1982 levels).'}
rows=[]
for k,h in STAGES.items():
    rows.append({'level':k,'stage_ft':h,'flow_cfs':int(round(FLOWS[k],-1)),'impact':imp[k],
                 'p_winter_all':round(float((pk.stage>=h).mean()),3),'p_winter_elnino':round(float((pk[pk.wy.isin(EN)].stage>=h).mean()),3)})
pd.DataFrame(rows).to_csv(out+'creek_levels.csv',index=False)
# 3 rain needed by month
R=basin_rain(); A=features(R).A30
rows=[]
for mo,name in [(10,'Oct'),(11,'Nov'),(12,'Dec'),(1,'Jan'),(2,'Feb'),(3,'Mar')]:
    a=A[(A.index.month==mo)&(A.index.day==15)].dropna(); wy=np.where(a.index.month>=10,a.index.year+1,a.index.year)
    w=float(a[np.isin(wy,EN)].median())
    rows.append({'month':name,'order':len(rows),'wetness_in':round(w,1),
                 **{f'rain_{k.lower()}_in':round(rain_needed(w,b,sd,k),1) for k in ['Action','Minor','Moderate']}})
pd.DataFrame(rows).to_csv(out+'creek_rain_needed.csv',index=False)
# 4 validation events (model run on observed rain)
dm=pd.read_csv('data/soquel_dailymax.csv.gz',parse_dates=['t'],index_col='t')
F=features(R).join(dm,how='inner')
notes={'2022-12-31':'Creek overtopped in downtown Soquel; third-highest crest on record',
       '2023-01-09':'Moderate flood stage',
       '2016-03-05':'Minor flood from a dry start; heavier mountain rain than Ben Lomond caught (model missed it)',
       '2023-01-14':'Minor flood stage',
       '2012-12-23':'Near flood stage',
       '2023-03-10':'Minor flood stage',
       '2011-03-24':'Noble Gulch pipe failed; Capitola Village flooded and closed (Mar 24 and 26)',
       '2023-01-04':'Capitola Village and Riverview evacuation ordered as the creek rose'}
ev=F.loc[[pd.Timestamp(x) for x in notes]].copy()
P=predict(ev.R0,ev.R1,ev.A30,b,sd)
ev=pd.DataFrame({'date':ev.index.strftime('%Y-%m-%d'),'what_happened':[notes[x] for x in ev.index.strftime('%Y-%m-%d')],
                 'peak_stage_ft':ev.hmax.round(1).values,'rain_peak_day_in':ev.R0.round(2).values,'rain_day_before_in':ev.R1.round(2).values,
                 'wetness_in':ev.A30.round(1).values,'model_stage_ft':[None if not np.isfinite(q) else round(float(flow_to_stage(q)),1) for q in P['q_median']],
                 'p_action':P['p_action'].round(2),'p_minor':P['p_minor'].round(2)})
ev.sort_values('peak_stage_ft',ascending=False).to_csv(out+'creek_events.csv',index=False)
# 5 annual peak history
pk['el_nino']=pk.wy.isin(EN); pk[['wy','date','stage','flow','el_nino']].assign(date=pk.date.dt.strftime('%Y-%m-%d')).to_csv(out+'creek_annual_peaks.csv',index=False)
print(pd.read_csv(out+'creek_levels.csv').to_string()); print(pd.read_csv(out+'creek_rain_needed.csv').to_string()); print(pd.read_csv(out+'creek_events.csv').to_string())
print(json.dumps({k:fj[k] for k in ['r2','n','sd']}))
