"""Weekly (or any-time) refresh: live forecasts + outlook + dashboard CSVs + alert summary.
Usage: python3 run_weekly.py            -> writes forecast.json, rain_forecast.json, season files, dash/*.csv
                                           and prints ALERT / NO ALERT with a short summary.
Needs data/ built (fetch_data.py, fetch_rain.py, build_tables.py) at least once.
"""
import json, os, pandas as pd, numpy as np
import forecast as F, offsets as O
from build_tables import kelvin_analogs

def kelvin_paths(today, resid7):
    order = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
    nums = [7, 8, 9, 10, 11, 12, 1, 2, 3]
    m = pd.read_pickle('data/resid_all.pkl').resid.resample('MS').mean()
    y0, A = O.season_year(today), resid7 - O.BASELINE
    cur = nums.index(today.month) if today.month in nums else len(nums)      # Apr-Jun: the season is over
    this, scen = [], {k: [] for k in O.SHAPES}
    for i, mo in enumerate(nums):
        yr = y0 if mo >= 7 else y0 + 1
        # a normal year = the same month in the neutral seasons 2022-23, 2024-25 and 2025-26
        base = np.mean([m.get(pd.Timestamp(year=y if mo >= 7 else y + 1, month=mo, day=1), np.nan) for y in [2022, 2024, 2025]])
        this.append(round(float(m.get(pd.Timestamp(year=yr, month=mo, day=1), np.nan) - base), 2) if i < cur else round(A, 2) if i == cur else None)
        for k in O.SHAPES:
            scen[k].append(None if i < cur else round(A, 2) if i == cur
                           else round(float(O.offset_path([O.month_mid(mo, today)], k, resid7, today)[0] - O.BASELINE), 2))
    return pd.DataFrame({'month': order, 'order': range(len(order)), **kelvin_analogs(), 'this_year_observed': this,
                         **{f'scenario_{k}': v for k, v in scen.items()}})


def main():
    os.makedirs('dash', exist_ok=True)
    # 1 coastal 10-day forecast (measured offset = last 72 h observed minus predicted at Monterey)
    r = F.run(); json.dump(r, open('forecast.json', 'w'), indent=1)
    # 2 long-range outlook through Mar 31 with receding Kelvin-wave scenarios (start from 7-day offset)
    h, day, offs = F.outlook(r['resid7_ft'])
    h.index.name = 't'; day.index.name = 'date'
    # the page only draws hourly detail for the next two weeks; daily values cover the rest of the winter
    h = h.drop(columns=['runup_typical', 'runup_big'])
    if len(h): h = h.loc[:h.index[0] + pd.Timedelta(days=16)]
    h.to_csv('dash/outlook_hourly.csv', date_format='%Y-%m-%dT%H:%M')
    day.to_csv('dash/outlook_daily.csv', date_format='%Y-%m-%d')
    today = pd.Timestamp(os.environ['CAPITOLA_TODAY']) if os.environ.get('CAPITOLA_TODAY') else pd.Timestamp.now(F.TZ).tz_localize(None).normalize()
    rows = []
    for k in O.SHAPES:
        v = O.offset_path([O.month_mid(12, today), O.month_mid(2, today)], k, r['resid7_ft'], today)
        rows.append({'key': k, 'label': {'hold': 'Stays', 'recede': 'Recedes', 'fast': 'Recedes fast'}[k], 'description': O.LABELS[k],
                     'offset_now_ft': round(r['resid7_ft'], 2), 'offset_dec15_ft': round(v[0], 2), 'offset_feb15_ft': round(v[1], 2)})
    pd.DataFrame(rows).to_csv('dash/offsets.csv', index=False)
    # Kelvin paths chart data (anomaly above a normal year): observed months so far this season, this week's
    # anomaly in the current month, then each scenario at mid-month
    kp = kelvin_paths(today, r['resid7_ft'])
    kp.to_csv('dash/kelvin_paths.csv', index=False)
    # 3 winter calendar + scenario totals (season.py uses data/resid_all.pkl for the 7-day offset)
    import subprocess; subprocess.run(['python3', 'season.py'], check=True, stdout=subprocess.DEVNULL)
    # 4 creek forecast (needs day max tide)
    p = F.noaa('predictions', pd.Timestamp.now('UTC').strftime('%Y%m%d'), (pd.Timestamp.now('UTC') + pd.Timedelta(days=10)).strftime('%Y%m%d'), '&interval=h')
    p.index = p.index.tz_localize('UTC').tz_convert(F.TZ).tz_localize(None)
    rf = F.rain_forecast(p.groupby(p.index.normalize()).max()); json.dump(rf, open('rain_forecast.json', 'w'), indent=1)
    # 5 dashboard CSVs
    subprocess.run(['python3', 'build_dash_data.py'], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['python3', 'build_rain_data.py'], check=True, stdout=subprocess.DEVNULL)
    # 6 alert summary
    coast = [d for d in r['days'] if d['level'] != 'Low']
    creek = [d for d in rf['days'] if d['p_action'] >= 0.25 or d.get('compound')]
    alert = bool(coast or creek)
    print('ALERT' if alert else 'NO ALERT')
    print('Coast:', r['summary'])
    for d in coast: print(f"  {d['date']} {d['peak_time']}: {d['level']} (index {d['twl']} ft; waves {d['hs_capitola_ft']} ft @ {d['period_s']} s)")
    print(f"Creek: Soquel Creek {rf['creek_now_stage_ft']} ft now; 30-day rain {rf['wetness_now_in']} in.")
    for d in creek: print(f"  {d['date']}: {d['rain_in']} in rain, chance of flood stage {d['p_minor']:.0%}{' (compound with high tide)' if d['compound'] else ''}")
    return alert

if __name__ == '__main__':
    main()
