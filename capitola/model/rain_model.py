"""Soquel Creek (USGS 11160000) flood model for Capitola Village.
Peak flow on day d is predicted from
  S  = basin storm rain over days d-1..d+1 (Ben Lomond COOP; gaps filled from Santa Cruz / Watsonville, scaled)
  Qb = creek flow before the storm (daily mean on day d-2), a live measure of how wet the watershed is
log10(Qpeak) = b0 + b1*log10(S) + b2*log10(Qb) + b3*log10(S)*log10(Qb), residual sd -> exceedance probability.
Stage thresholds (NWS SOQC1) converted to flow with the current USGS rating (2017+ data)."""
import pandas as pd, numpy as np
from math import erf, sqrt
STAGES={'Action':13.0,'Minor':16.0,'Moderate':18.0,'Major':22.0}
RATING=(1.0,np.array([1.77396571,3.86752482]))   # q = exp(polyval(c, ln(h-h0)))
def stage_to_flow(h): h0,c=RATING; return float(np.exp(np.polyval(c,np.log(h-h0))))
def flow_to_stage(q):
    h0,c=RATING; q=np.asarray(q,float); return h0+np.exp((np.log(np.maximum(q,1e-3))-c[1])/c[0])
FLOWS={k:stage_to_flow(v) for k,v in STAGES.items()}

def basin_rain():
    rain=pd.read_csv('data/rain_daily.csv.gz',parse_dates=[0],index_col=0)
    R=rain.ben_lomond.copy()
    for alt in ['santa_cruz','watsonville_ap']:
        m=(rain.ben_lomond>0.1)&(rain[alt]>0.1); k=rain.ben_lomond[m].sum()/rain[alt][m].sum()
        R[R.isna()]=rain[alt][R.isna()]*k
    return R.asfreq('D')

def features(R):
    """R0 = rain on day d, R1 = day d-1, A30 = rain over days d-31..d-2 (watershed wetness)."""
    return pd.DataFrame({'R0':R,'R1':R.shift(1),'A30':R.shift(2).rolling(30,min_periods=25).sum()})

MIN_RAIN=1.0   # model applies when R0+R1 >= 1 in; below that a flood-level peak has not occurred since 2007
SD_SCALE=0.8   # residual spread shrunk so 2007-2026 expected flood-level days match observed (Action 13.8 vs 15, Minor 6.7 vs 7)

def design(R0,R1,A30):
    R0=np.asarray(R0,float); R1=np.asarray(R1,float); A30=np.asarray(A30,float)
    return np.column_stack([np.ones_like(R0),np.log10(R0+0.5*R1+0.1),np.log10(A30+1)])

def fit(df):
    d=df[(df.R0+df.R1)>=MIN_RAIN]
    X=design(d.R0,d.R1,d.A30); y=np.log10(d.q.values)
    b,*_=np.linalg.lstsq(X,y,rcond=None); res=y-X@b
    return b, float(res.std(ddof=X.shape[1])), float(1-res.var()/y.var()), len(d)

def predict(R0,R1,A30,b,sd):
    """Median peak flow (cfs) and P(exceed) for each flood level."""
    R0=np.atleast_1d(np.asarray(R0,float)); R1=np.atleast_1d(np.asarray(R1,float)); A30=np.atleast_1d(np.asarray(A30,float))
    mu=design(R0,R1,A30)@b; ok=(R0+R1)>=MIN_RAIN
    out={'q_median':np.where(ok,10**mu,np.nan)}
    for k,q in FLOWS.items():
        z=(np.log10(q)-mu)/(sd*SD_SCALE)
        out['p_'+k.lower()]=np.where(ok,[0.5*(1-erf(v/sqrt(2))) for v in z],0.0)
    return out

def rain_needed(A30,b,sd,level,p=0.5):
    """One-day rain (in) giving probability p of reaching `level`, given 30-day antecedent rain A30 (in)."""
    lo,hi=MIN_RAIN,25.0
    for _ in range(60):
        mid=(lo+hi)/2
        if predict(mid,0.0,A30,b,sd)['p_'+level.lower()][0]>p: hi=mid
        else: lo=mid
    return (lo+hi)/2
