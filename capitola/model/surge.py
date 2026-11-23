"""Storm-surge forecast for the Monterey tide gauge, from NOAA's STOFS-2D-Global model.

Until Nov 23, 2026 the forecast held the offset (observed minus predicted water level, which carries the Kelvin wave,
warm water and any storm surge) at its last-72-h mean for all ten days, so it missed the surge from incoming storms:
before the Nov 14 swell the gauge ran 1.7-1.8 ft above the tide table while the forecasts 1-2 days out held 1.05 ft.

STOFS-2D-Global (NOAA/NOS, run every 6 h, 7.5 days ahead) forecasts the sub-tidal water level at Monterey (station
MEYC1) in a small SHEF text file on NOAA's public AWS bucket, posted about 7.3 h after each cycle. Its level runs about
0.1 ft high at Monterey, so it is re-anchored to the gauge: the bias is the mean of observed minus STOFS over the last
24 h, each hour taken from the newest cycle that covered it. Scored over Oct 28 - Nov 22, 2026 (52 cycles, 7,768 hours):
at daily high tides the error was 0.16-0.22 ft (RMS) at 0-6 days ahead vs 0.21-0.25 ft for holding the 72-h mean; in
the Nov 13 surge it had 1.5-1.7 ft 1-2 days ahead where holding had 1.05.
"""
import re
import pandas as pd
import net

BUCKET = 'https://noaa-gestofs-pds.s3.amazonaws.com'
STATION = 'MEYC1'           # NOAA 9413450, Monterey
BIAS_HOURS = 24


def cycle_url(t):
    return f'{BUCKET}/stofs_2d_glo.{t:%Y%m%d}/stofs_2d_glo.t{t:%H}z.points.swl.shef'


def parse_shef(text, station=STATION):
    """The station's series from a SHEF .E file (ft, UTC, naive index), or None if the station is missing."""
    vals, t0, step, on = [], None, None, False
    for line in text.splitlines():
        if line.startswith('.E '):
            on = False
            m = re.match(r'\.E (\S+) (\d{8}) Z DH(\d{4})/.*?DIN(\d+)/(.*)', line)
            if m and m.group(1) == station:
                on, t0, step = True, pd.Timestamp(m.group(2) + m.group(3)), int(m.group(4))
                vals += m.group(5).split('/')
        elif on and re.match(r'\.E\d+\s', line):
            vals += line.split(None, 1)[1].split('/')
        elif line.startswith('.'):
            on = False
    vals = [v.strip() for v in vals if v.strip()]
    if not vals:
        return None
    s = pd.to_numeric(pd.Series(vals), errors='coerce')
    s = s.where(s > -90)    # SHEF missing values (-9999)
    return pd.Series(s.values, index=t0 + pd.to_timedelta(range(len(s)), unit='m') * step).dropna()


def fetch_cycles(now, n=3, look_back_days=3):
    """The newest n STOFS cycles posted by `now` (naive UTC), as {cycle time: hourly series}."""
    out, t = {}, now.floor('6h')
    while len(out) < n and t > now - pd.Timedelta(days=look_back_days):
        r = net.get(cycle_url(t), timeout=60, tries=2)
        if r.status_code == 200:
            s = parse_shef(r.text)
            if s is not None and len(s):
                out[t] = s.resample('h').mean().dropna()
        t -= pd.Timedelta(hours=6)
    return out


def offset_path(resid, now, index):
    """Offset (ft) for each forecast hour in `index` (naive UTC), from STOFS re-anchored to the gauge.
    resid: hourly observed minus predicted water level through `now` (naive UTC index).
    Returns (pandas Series aligned to index, info dict), or (None, info) when STOFS can't be used."""
    cyc = fetch_cycles(now)
    if not cyc:
        return None, {'source': 'held', 'why': 'no STOFS cycle found'}
    keys = sorted(cyc)
    # analysis: each hour from the newest cycle that covered it within its first 12 h
    an = pd.concat([cyc[k][(cyc[k].index >= k) & (cyc[k].index < k + pd.Timedelta(hours=12))] for k in keys])
    an = an[~an.index.duplicated(keep='last')].sort_index()
    d = (resid - an).dropna()
    d = d[d.index > now - pd.Timedelta(hours=BIAS_HOURS)]
    if len(d) < 12:
        return None, {'source': 'held', 'why': f'only {len(d)} h of gauge overlap with STOFS'}
    bias = float(d.mean())
    fc = cyc[keys[-1]] + bias
    tail = float(fc[fc.index > fc.index.max() - pd.Timedelta(hours=24)].mean())   # past STOFS's 7.5 days: hold its last day
    path = fc.reindex(index).interpolate(limit_area='inside').fillna(tail)
    return path, {'source': 'stofs', 'cycle': keys[-1].strftime('%Y-%m-%d %HZ'), 'bias_ft': round(bias, 2),
                  'overlap_h': int(len(d))}
