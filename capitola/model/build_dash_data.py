import pandas as pd, numpy as np, json, subprocess
from model import *
out='dash/'
# 1 season calendar
s=pd.read_csv('season_calendar.csv',parse_dates=['time_utc']).rename(columns={'time_utc':'date'})
s['date']=s.date.dt.strftime('%Y-%m-%d')
s=s[['date','tide_max','high_tide_time','p_flood','p_severe','runup_needed_ft','offshore_ft_SW','offshore_ft_W','offshore_ft_WNW','offshore_ft_NW','observed_twl']]
s=s.rename(columns={'tide_max':'high_tide_ft','observed_twl':'observed_twl_ft'}).round(3)
s.to_csv(out+'winter_calendar.csv',index=False)
# 2 scenarios
ELNINO=[2002,2009,2015,2023]
dd=pd.read_pickle('data/winter_days.pkl')
act_all=((dd.twl>=FLOOD).groupby(dd.wy).sum().mean(),(dd.twl>=SEVERE).groupby(dd.wy).sum().mean())
sub=dd[dd.wy.isin(ELNINO)]
act_en=((sub.twl>=FLOOD).groupby(sub.wy).sum().mean(),(sub.twl>=SEVERE).groupby(sub.wy).sum().mean())
Ys=np.sort(sub.Y.values); pe=lambda v: 1-np.searchsorted(Ys,np.asarray(v),side='left')/len(Ys)
p=pd.read_csv('data/monterey_pred.csv.gz',parse_dates=['time_utc'],index_col='time_utc').pred_mllw_ft
p.index=p.index.tz_localize('UTC').tz_convert('America/Los_Angeles').tz_localize(None)
tm=p['2026-11-01':'2027-03-31 23:00']; tm=tm.groupby(tm.index.normalize()).max()
rows=[{'scenario':'Average winter, 2000-2025 (observed)','offset_ft':None,
       'flood_days':round(act_all[0],1),'severe_days':round(act_all[1],2)},
      {'scenario':'Past El Niño winters (observed)','offset_ft':None,'flood_days':round(act_en[0],1),'severe_days':round(act_en[1],2)}]
import offsets as O
ss=json.load(open('season_summary.json'))['scenarios']
for k,lab in [('hold',"Kelvin offset stays at today's level"),('recede','Offset recedes like past El Niños (central)'),('fast','Offset recedes fast')]:
    rows.append({'scenario':lab,'offset_ft':round(ss[k]['mean_offset_ft'],2),'flood_days':round(ss[k]['flood_days'],1),'severe_days':round(ss[k]['severe_days'],2)})
sc=pd.DataFrame(rows); sc['p_any_severe']=(1-np.exp(-sc.severe_days)).round(3)
sc.to_csv(out+'scenarios.csv',index=False); print(sc)
# 3 forecast
f=json.load(open('forecast.json'))
fd=pd.DataFrame(f['days']); fd['offset_ft']=f['offset_ft']; fd['run_at_utc']=f['run_at_utc']
fd.to_csv(out+'forecast_daily.csv',index=False)
fh=pd.DataFrame(f['hourly']); fh.to_csv(out+'forecast_hourly.csv',index=False)
# 4 events (validation)
d=pd.read_pickle('data/daily_max.pkl'); n=len(d)
ev=[('2023-01-05','Wharf broken, Esplanade restaurants gutted','KTVU, Santa Cruz Local'),
    ('2023-12-28','Seawater into condos and restaurants; evacuation warning','City of Capitola, SF Chronicle'),
    ('2008-01-05','Surf over the wharf; old bathhouse battered','multer.com, Capitola hazard plan'),
    ('2024-12-23','Village closed; seawater flooded parts of the Village','Patch'),
    ('2014-03-01','Waves over seawall; Esplanade closed, car floated','Latitude 38')]
er=[]
for t,impact,src in ev:
    r=d.loc[t]; er.append({'date':t,'impact':impact,'source':src,'twl_index_ft':round(float(r.TWL),1),'water_level_ft':round(float(r.wl_mllw_ft),1),
       'hs_capitola_ft':round(float(r.Hs)*M2FT,1),'period_s':round(float(r.Tp),0),'rank':int((d.TWL>r.TWL).sum()+1),'of_days':n,'peak_time':r.time})
pd.DataFrame(er).to_csv(out+'validation_events.csv',index=False)
# 5 direction ratio
lab={180:'S',195:'SSW',210:'SSW',225:'SW',240:'WSW',255:'WSW',270:'W',285:'WNW',300:'WNW',315:'NW'}
pd.DataFrame([{'direction_deg':k,'compass':lab[k],'share_reaching_capitola':v} for k,v in DIR_RATIO.items()]).to_csv(out+'direction_ratio.csv',index=False)
# 6 offset history (monthly mean observed minus predicted)
o=pd.read_csv('data/monterey_wl_obs.csv.gz',parse_dates=['time_utc'],index_col='time_utc').wl_mllw_ft
pu=pd.read_csv('data/monterey_pred.csv.gz',parse_dates=['time_utc'],index_col='time_utc').pred_mllw_ft
m=(o-pu).dropna().resample('MS').mean()['2014-01':]
pd.DataFrame({'month':m.index.strftime('%Y-%m'),'offset_ft':m.values.round(2)}).to_csv(out+'offset_monthly.csv',index=False)
th=pd.DataFrame([{'level':'Watch','index_ft':WATCH,'meaning':'Waves reaching the seawall at high tide'},
                 {'level':'Flood','index_ft':FLOOD,'meaning':'Water and sand over the seawall onto the Esplanade (Mar 2014, Dec 2024)'},
                 {'level':'Severe','index_ft':SEVERE,'meaning':'Damaging flood of Esplanade businesses (Dec 2023, Jan 2023)'}])
th.to_csv(out+'thresholds.csv',index=False)
print(pd.DataFrame(er)); print(fd)
# 7 swell climate table for the dashboard
c=pd.read_csv('data/swell_climate.csv')[['month','typical_runup_ft','big_runup_ft','typical_hs_ft','typical_tp_s']]
c['month_name']=c.month.map({10:'Oct',11:'Nov',12:'Dec',1:'Jan',2:'Feb',3:'Mar'}); c.to_csv(out+'swell_climate.csv',index=False)
