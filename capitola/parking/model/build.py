"""Build the public parking pages from the parts in this folder.

    python3 build.py              -> ../index.html (the model) and ../summer-rate/index.html (the one-pager)
    python3 build.py --artifact X -> also writes a claude.ai artifact copy to X (absolute links, no html/head/body wrapper)

The rate sweeps come from sweeps.json (node bake.js, whole days, 1 to 3 PM) and the recommended rate for each crowd from
recommend.json (node recommend.js); both are written into app.js here. If the engine or its settings change, re-bake,
run recommend.js, rebuild, and update the typed numbers in onepager.html and body_part.html.
"""
import json, math, pathlib, sys

HERE = pathlib.Path(__file__).parent
SITE = 'https://kevinkeet.com'

SWEEPS = json.loads((HERE / 'sweeps.json').read_text())  # bake.js output: whole days, 1-3 PM, by crowd size and rate
REC = json.loads((HERE / 'recommend.json').read_text())   # recommend.js output: the recommended rate for each crowd
REC_BY = {str(o['v']): o for o in REC}
DAY_NAMES = {1500: 'Winter weekday', 4500: 'Spring weekend', 9000: 'Busy summer Saturday'}
TABLE_CROWDS = [1500, 3000, 4500, 6000, 7500, 9000, 10500, 12000]
CHART_CROWDS = ['6000', '7500', '9000']


def model_body():
    css = (HERE / 'css_part.html').read_text()
    body = (HERE / 'body_part.html').read_text()
    geo = (HERE / 'osm/geo.json').read_text()
    paths = json.loads((HERE / 'osm/paths.json').read_text())
    eng = (HERE / 'engine.js').read_text()
    wld = (HERE / 'world.js').read_text()
    app = (HERE / 'app.js').read_text()
    app = app.replace('/*SWEEPS*/{}', json.dumps(SWEEPS, separators=(',', ':'))).replace('/*REC*/[]', json.dumps(REC, separators=(',', ':')))
    body = body.replace('<!--RECS-->', "<figure class='recfig'>" + rec_chart_svg('page') + '</figure>' + rec_table('page'))
    scripts = ('\n<script>\nvar GEO = ' + geo + ';\nvar PATHS = ' + json.dumps(paths, separators=(',', ':')) + ';\n' +
               wld + '\n' + eng + '\n</script>\n<script>\n' + app + '</script>\n')
    return css, body, scripts


def rec_row(crowd):
    """The recommended rate's row (recommend.js) for this crowd, or None if no rate works."""
    o = REC_BY.get(str(crowd))
    if not o or o['rate'] is None:
        return None
    return next((r for r in SWEEPS[str(crowd)] if abs(r['p'] - o['rate']) < 1e-6), None)


def rnd(x):
    """Round halves up, as the page's Math.round does (Python's round() rounds 92.5 to 92)."""
    return int(math.floor(x + 0.5))


def money(p):
    return f'${p:.2f}'


def rec_chart_svg(where):
    """Step chart: the recommended rate for each crowd size, 500 to 12,000 visitors. Colors from the page's own tokens."""
    page = where == 'page'
    ink, ink2, ink3, grid, line = (('var(--ink)', 'var(--ink2)', 'var(--ink3)', 'var(--rule2)', 'var(--good)') if page else
                                   ('var(--ink)', 'var(--ink2)', 'var(--ink3)', 'var(--rule2)', 'var(--good)'))
    W, H, x0, x1, y0, y1 = 760, 300, 56, 740, 40, 240
    vmax = 12000
    xs = lambda v: x0 + v / vmax * (x1 - x0)
    ys = lambda p: y1 - p / 12 * (y1 - y0)
    t = lambda x, y, s, anchor='start', size=12, fill=ink2, weight=400: f"<text x='{x:.1f}' y='{y:.1f}' text-anchor='{anchor}' style='font:{weight} {size}px var(--f-body);fill:{fill}'>{s}</text>"
    o = [f"<svg viewBox='0 0 {W} {H}' role='img' aria-label='Recommended meter rate by the number of visitors that day' style='display:block;width:100%;height:auto'>"]
    for p in (0, 2, 4, 6, 8, 10, 12):
        o.append(f"<line x1='{x0}' x2='{x1}' y1='{ys(p):.1f}' y2='{ys(p):.1f}' style='stroke:{grid}'/>" + t(x0 - 8, ys(p) + 4, f'${p}', 'end', 11, ink3))
    for v in range(0, 12001, 2000):
        o.append(t(xs(v), y1 + 18, f'{v:,}', 'middle', 11, ink3))
    o.append(t((x0 + x1) / 2, y1 + 40, 'Visitors to Capitola that day', 'middle', 12, ink2))
    pts = [(o2['v'], o2['rate']) for o2 in REC if o2['rate'] is not None]
    none = [o2['v'] for o2 in REC if o2['rate'] is None]
    a = xs((max(v for v, _ in pts) + min(none)) / 2) if none and pts else x1
    o.append(f"<line x1='{x0}' x2='{x1}' y1='{ys(2):.1f}' y2='{ys(2):.1f}' style='stroke:{ink3};stroke-dasharray:3 3'/>" + t(a - 8, ys(2) - 6, 'today $2.00', 'end', 11, ink3))
    if none:   # crowds where no rate works: shade from halfway past the last workable crowd
        o.append(f"<rect x='{a:.1f}' y='{y0}' width='{x1 - a:.1f}' height='{y1 - y0}' style='fill:{grid};opacity:.7'/>")
        o.append(t((a + x1) / 2, y0 + 16, 'no rate', 'middle', 11, ink2, 600) + t((a + x1) / 2, y0 + 30, 'keeps it moving', 'middle', 11, ink2, 600))
    d, prev = [], None
    for i, (v, p) in enumerate(pts):   # steps: each crowd's rate holds 250 visitors either side
        xa, xb = xs(max(0, v - 250)), xs(min(vmax, v + 250))
        d.append(('M' if i == 0 else 'L') + f'{xa:.1f} {ys(p):.1f} L{xb:.1f} {ys(p):.1f}')
    o.append(f"<path d='{' '.join(d)}' style='fill:none;stroke:{line};stroke-width:2.5;stroke-linejoin:round'/>")
    for o2 in REC:
        if o2['rate'] is None:
            continue
        v, p, r, td = o2['v'], o2['rate'], o2['rec'], o2['today']
        tip = f"{v:,} visitors: {money(p)}" + (' (today\'s rate)' if p <= 2 else '') + f". At 1 to 3 PM the loop is {rnd(r['occ'] * 100)}% full and a trip around takes about {rnd(r['trip'])} min (at $2.00: {rnd(td['occ'] * 100)}%, {rnd(td['trip'])} min)."
        o.append(f"<circle cx='{xs(v):.1f}' cy='{ys(p):.1f}' r='4' style='fill:{line};stroke:var(--card);stroke-width:2'><title>{tip}</title></circle>")
        o.append(f"<circle cx='{xs(v):.1f}' cy='{ys(p):.1f}' r='11' style='fill:transparent'><title>{tip}</title></circle>")
    for v, name in DAY_NAMES.items():   # label the three preset days
        o2 = REC_BY.get(str(v))
        if not o2 or o2['rate'] is None:
            continue
        x, y = xs(v), ys(o2['rate'])
        o.append(f"<circle cx='{x:.1f}' cy='{y:.1f}' r='7' style='fill:none;stroke:{ink};stroke-width:1.5'/>")
        if o2['rate'] <= 2:   # on the flat $2.00 stretch: above the point
            o.append(t(x, y - 24, name, 'middle', 11.5, ink2, 600) + t(x, y - 11, money(o2['rate']), 'middle', 12, ink, 700))
        else:   # below: the line climbs to the right
            o.append(t(x, y + 22, money(o2['rate']), 'middle', 12, ink, 700) + t(x, y + 36, name, 'middle', 11.5, ink2, 600))
    o.append('</svg>')
    return ''.join(o)


def rec_table(where):
    """The recommended rate at key crowd sizes, with what changes from today's $2.00."""
    rows = []
    for v in TABLE_CROWDS:
        o = REC_BY.get(str(v))
        if not o:
            continue
        td, r = o['today'], o['rec']
        day = DAY_NAMES.get(v, '')
        if o['rate'] is None:
            rate, full, trip, shop = 'none works', f"{rnd(td['occ'] * 100)}%", f"{rnd(td['trip'])} min", '&ndash;'
        elif o['rate'] <= 2:
            rate = '$2.00 <span class="small">today</span>'
            full, trip, shop = f"{rnd(td['occ'] * 100)}%", f"{rnd(td['trip'])} min", f"{rnd(td['shopDine'])}"
        else:
            rate = f"<b>{money(o['rate'])}</b>"
            full = f"{rnd(td['occ'] * 100)}% &rarr; {rnd(r['occ'] * 100)}%"
            trip = f"{rnd(td['trip'])} min" if rnd(td['trip']) == rnd(r['trip']) else f"{rnd(td['trip'])} &rarr; {rnd(r['trip'])} min"
            shop = f"{rnd(td['shopDine'])} &rarr; {rnd(r['shopDine'])}"
        rows.append(f"<tr><td>{v:,}<span class='small'>{(' &middot; ' + day) if day else ''}</span></td><td>{rate}</td><td>{full}</td><td>{trip}</td><td>{shop}</td></tr>")
    head = ("<thead><tr><th>Visitors that day</th><th>Recommended rate</th><th>Loop full, 1&ndash;3 PM</th><th>Trip around the loop</th>"
            "<th>Shoppers &amp; diners parked per hour</th></tr></thead>")
    cls = 'rec'
    return f"<div class='tablewrap'><table class='{cls}'>{head}<tbody>{''.join(rows)}</tbody></table></div>"


def chart_svg():
    x0, pw, y0, ph, ymax = 64, 660, 92, 190, 20
    xs = lambda v: x0 + (v - 1) / 11 * pw
    ys = lambda v: y0 + ph - v / ymax * ph
    o = ["<svg viewBox='0 0 760 340' role='img' aria-label='The bigger the crowd, the higher the rate it takes to keep the loop moving'>"]
    o.append("<text class='c-title' x='0' y='24'>The bigger the crowd, the higher the rate it takes to keep the loop moving</text>")
    o.append("<text class='c-sub' x='0' y='46'>Minutes for a trip around the loop at 1 to 3 PM on a summer day, by all-day meter rate. Ringed: the recommended rate.</text>")
    for v in (0, 5, 10, 15, 20):
        o.append(f"<line class='c-grid' x1='{x0}' x2='{x0 + pw}' y1='{ys(v):.1f}' y2='{ys(v):.1f}'/><text class='c-tick' x='{x0 - 8}' y='{ys(v) + 4:.1f}' text-anchor='end'>{v}{' min' if v == 20 else ''}</text>")
    o.append(f"<line class='c-today-line' x1='{xs(2):.1f}' x2='{xs(2):.1f}' y1='{y0 - 4}' y2='{y0 + ph}'/><text class='c-note' x='{xs(2):.1f}' y='{y0 - 10}' text-anchor='middle'>today</text>")
    for k, crowd in enumerate(CHART_CROWDS):
        rows = SWEEPS[crowd]
        d = ' '.join(('M' if i == 0 else 'L') + f"{xs(r['p']):.1f} {ys(r['trip']):.1f}" for i, r in enumerate(rows))
        o.append(f"<path class='c-s{k + 1}' d='{d}'/>")
        for r in rows:
            o.append(f"<circle class='c-d{k + 1}' cx='{xs(r['p']):.1f}' cy='{ys(r['trip']):.1f}' r='2.3'><title>{int(crowd):,} visitors, ${r['p']:.2f}: {r['trip']} minutes, {rnd(r['standstill'] * 100)}% of the loop stopped</title></circle>")
        ly = y0 + 6 + (len(CHART_CROWDS) - 1 - k) * 18   # legend in the empty top-right corner, biggest crowd first
        o.append(f"<line class='c-s{k + 1}' x1='{xs(9.3):.1f}' x2='{xs(9.9):.1f}' y1='{ly:.1f}' y2='{ly:.1f}'/><text class='c-lab{k + 1}' x='{xs(9.9) + 8:.1f}' y='{ly + 4:.1f}'>{int(crowd):,} visitors</text>")
    for k, crowd in enumerate(CHART_CROWDS):
        b = rec_row(crowd)
        if b:
            o.append(f"<circle class='c-ring' cx='{xs(b['p']):.1f}' cy='{ys(b['trip']):.1f}' r='6.5'/><text class='c-ringlab' x='{xs(b['p']):.1f}' y='{ys(b['trip']) + (22 if k % 2 else -12):.1f}' text-anchor='middle'>${b['p']:.2f}</text>")
    for v in range(1, 13):
        o.append(f"<text class='c-tick' x='{xs(v):.1f}' y='{y0 + ph + 18}' text-anchor='middle'>${v}</text>")
    o.append(f"<text class='c-sub' x='{x0 + pw / 2:.0f}' y='{y0 + ph + 44}' text-anchor='middle'>Hourly rate on the loop meters, all day</text></svg>")
    return ''.join(o)

def main():
    css, body, scripts = model_body()
    head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="description" content="A live model of Capitola Village\'s beach loop: change the meter rate and watch circling, the backup at the Monterey Avenue stop, and meter revenue respond.">\n'
            '<link rel="icon" href="/capitola/favicon.svg">\n')
    site = head + css + '\n</head>\n<body>\n' + body + scripts + '</body>\n</html>\n'
    (HERE.parent / 'index.html').write_text(site)
    one = (HERE / 'onepager.html').read_text().replace('/*CHART*/', chart_svg()).replace('<!--RECTABLE-->', rec_table('one')).replace('<!--RECCHART-->', rec_chart_svg('one'))
    (HERE.parent / 'summer-rate').mkdir(exist_ok=True)
    (HERE.parent / 'summer-rate/index.html').write_text(one)
    print('wrote', HERE.parent / 'index.html', len(site), 'and', HERE.parent / 'summer-rate/index.html', len(one))
    if '--artifact' in sys.argv:
        out = pathlib.Path(sys.argv[sys.argv.index('--artifact') + 1])
        art = (css + body + scripts).replace('href="/"', 'href="' + SITE + '/"').replace('href="/capitola', 'href="' + SITE + '/capitola')
        out.write_text(art)
        print('wrote artifact copy', out, len(art))


if __name__ == '__main__':
    main()
