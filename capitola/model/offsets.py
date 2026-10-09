"""How far Monterey Bay sits above the tide tables this winter (ft), by scenario.
offset(t) = BASELINE + A_now * shape(t) / shape(today)
  BASELINE : mean observed-minus-predicted level in recent neutral winters (2021-22, 2022-23, 2024-25)
  A_now    : today's El Nino anomaly = last-7-day mean residual at Monterey - BASELINE
  shape    : how the anomaly evolved after its Sep-Nov peak in the three strong El Ninos on record
             (1982-83, 1997-98, 2015-16), normalised to that peak. 'recede' = their average,
             'fast' = the fastest of them month by month, 'hold' = no recession (stays at today's level).
Shape knots sit mid-month in the current season, with mid-October as the peak (1.0). Dividing by the shape's
value today makes every path start at the measured level and then follow the analogs' relative recession,
so a run in December does not apply the November drop a second time. Runs before Oct 15 are unaffected.
"""
import pandas as pd, numpy as np
BASELINE=0.12
ANALOG_PEAK_NORM={  # month -> anomaly / Sep-Nov peak
    '1982-83':{11:1.00,12:0.56,1:0.81,2:0.63,3:0.41},
    '1997-98':{11:1.00,12:0.73,1:0.56,2:0.57,3:0.19},
    '2015-16':{11:0.60,12:0.70,1:0.70,2:0.57,3:0.55},
}
MONTHS=[11,12,1,2,3]
SHAPES={
  'hold':  {m:1.0 for m in MONTHS},
  'recede':{m:round(np.mean([a[m] for a in ANALOG_PEAK_NORM.values()]),2) for m in MONTHS},
  'fast':  {m:min(a[m] for a in ANALOG_PEAK_NORM.values()) for m in MONTHS},
}
LABELS={'hold':"Stays at today's level",'recede':'Recedes like past El Niños','fast':'Recedes fast'}

def season_year(t):
    """First calendar year of the July-June season containing t (Jan 2027 -> 2026)."""
    t=pd.Timestamp(t); return t.year if t.month>=7 else t.year-1

def month_mid(m, start):
    """Mid-month date of month m in the season containing start."""
    y0=season_year(start); return pd.Timestamp(year=y0 if m>=7 else y0+1, month=m, day=15)

def _ns(ts): return np.array([pd.Timestamp(t).as_unit('ns').value for t in ts],float)

def offset_path(index, scenario, resid7, start):
    """Daily/hourly offset (ft) for timestamps `index` (naive local), starting at `start` (today)."""
    A=resid7-BASELINE; sh=SHAPES[scenario]
    start=pd.Timestamp(start).normalize()
    ref=[(month_mid(10,start),1.0)]+[(month_mid(m,start),sh[m]) for m in MONTHS]   # shape knots this season
    s0=float(np.interp(start.as_unit('ns').value,_ns([k[0] for k in ref]),[k[1] for k in ref]))
    knots=[(start,1.0)]+[(d,v/s0) for d,v in ref[1:] if d>start]
    kx=_ns([k[0] for k in knots]); ky=np.array([k[1] for k in knots])
    s=np.interp(pd.DatetimeIndex(index).as_unit('ns').asi8.astype(float),kx,ky)
    return BASELINE+A*s
