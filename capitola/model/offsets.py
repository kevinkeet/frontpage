"""How far Monterey Bay sits above the tide tables this winter (ft), by scenario.
offset(t) = BASELINE + A_now * s(t)
  BASELINE : mean observed-minus-predicted level in recent neutral winters (2021-22, 2022-23, 2024-25)
  A_now    : today's El Nino anomaly = last-7-day mean residual at Monterey - BASELINE
  s(t)     : how the anomaly changed from this point of the season in the three strong El Ninos on record
             (1982-83, 1997-98, 2015-16). Each analog's anomaly, normalised to its Sep-Nov peak, sits at mid-month
             knots with mid-October as the peak (1.0); its path from today is shape_a(t) / shape_a(today), so every
             scenario starts at the measured level. 'recede' = the analogs' average path from today, 'fast' = the
             fastest of them month by month, 'hold' = no change (stays at today's level).
Taking each analog's change from today before averaging keeps 'fast' at or below 'recede' all winter. (Until Nov 13,
2026 the averaged shape was divided by its own value today; once the offset held through mid-November that made
'Recedes fast' flatter than 'Recedes', because its fast analog's drop was due in October-November.) For runs before
Oct 15, 'recede' matches the original averaged shape; 'fast' matches the month-by-month minimum at mid-month and runs up
to 0.1 ft higher between them, since it now follows whichever real analog path is lowest.
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

def _from_today(x, shape, start):
    """One analog's anomaly at times x (ns) relative to its value at `start`."""
    ref=[(month_mid(10,start),1.0)]+[(month_mid(m,start),shape[m]) for m in MONTHS]   # knots this season
    s0=float(np.interp(start.as_unit('ns').value,_ns([k[0] for k in ref]),[k[1] for k in ref]))
    knots=[(start,1.0)]+[(d,v/s0) for d,v in ref[1:] if d>start]
    return np.interp(x,_ns([k[0] for k in knots]),np.array([k[1] for k in knots]))

def offset_path(index, scenario, resid7, start):
    """Daily/hourly offset (ft) for timestamps `index` (naive local), starting at `start` (today)."""
    A=resid7-BASELINE
    start=pd.Timestamp(start).normalize()
    x=pd.DatetimeIndex(index).as_unit('ns').asi8.astype(float)
    if scenario=='hold':
        s=np.ones(len(x))
    else:
        paths=np.array([_from_today(x,a,start) for a in ANALOG_PEAK_NORM.values()])
        s=paths.mean(axis=0) if scenario=='recede' else paths.min(axis=0)
    return BASELINE+A*s
