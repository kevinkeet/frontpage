"""Build the public parking pages from the parts in this folder.

    python3 build.py              -> ../index.html (the model) and ../summer-rate/index.html (the one-pager)
    python3 build.py --artifact X -> also writes a claude.ai artifact copy to X (absolute links, no html/head/body wrapper)

The default summer sweep (SWEEP below) is also baked into app.js as PRESET; both come from
`node test5.js`-style runs: runHeadless(world, rate, 135, seed 11 and 23, warm 60, measure 120), averaged.
If the engine or its settings change, re-run the sweep and update both.
"""
import json, pathlib, sys

HERE = pathlib.Path(__file__).parent
SITE = 'https://kevinkeet.com'

SWEEPS = json.loads((HERE / 'sweeps.json').read_text())  # bake.js output: whole days, 1-3 PM, by crowd size and rate
CHART_CROWDS = ['6000', '7500', '9000']


def model_body():
    css = (HERE / 'css_part.html').read_text()
    body = (HERE / 'body_part.html').read_text()
    geo = (HERE / 'osm/geo.json').read_text()
    paths = json.loads((HERE / 'osm/paths.json').read_text())
    eng = (HERE / 'engine.js').read_text()
    wld = (HERE / 'world.js').read_text()
    app = (HERE / 'app.js').read_text()
    scripts = ('\n<script>\nvar GEO = ' + geo + ';\nvar PATHS = ' + json.dumps(paths, separators=(',', ':')) + ';\n' +
               wld + '\n' + eng + '\n</script>\n<script>\n' + app + '</script>\n')
    return css, body, scripts


def best_row(rows):
    for r in rows:
        if r['circ'] < 1.5 and r['standstill'] < 0.1:
            return r
    return None


def chart_svg():
    x0, pw, y0, ph, ymax = 64, 660, 92, 190, 30
    xs = lambda v: x0 + (v - 1) / 7 * pw
    ys = lambda v: y0 + ph - v / ymax * ph
    o = ["<svg viewBox='0 0 760 340' role='img' aria-label='The bigger the crowd, the higher the rate it takes to keep the loop moving'>"]
    o.append("<text class='c-title' x='0' y='24'>The bigger the crowd, the higher the rate it takes to keep the loop moving</text>")
    o.append("<text class='c-sub' x='0' y='46'>Minutes for a trip around the loop at 1 to 3 PM on a summer day, by all-day meter rate. Ringed: the lowest rate that keeps traffic moving.</text>")
    for v in (0, 10, 20, 30):
        o.append(f"<line class='c-grid' x1='{x0}' x2='{x0 + pw}' y1='{ys(v):.1f}' y2='{ys(v):.1f}'/><text class='c-tick' x='{x0 - 8}' y='{ys(v) + 4:.1f}' text-anchor='end'>{v}{' min' if v == 30 else ''}</text>")
    o.append(f"<line class='c-today-line' x1='{xs(2):.1f}' x2='{xs(2):.1f}' y1='{y0 - 4}' y2='{y0 + ph}'/><text class='c-note' x='{xs(2):.1f}' y='{y0 - 10}' text-anchor='middle'>today</text>")
    for k, crowd in enumerate(CHART_CROWDS):
        rows = SWEEPS[crowd]
        d = ' '.join(('M' if i == 0 else 'L') + f"{xs(r['p']):.1f} {ys(r['trip']):.1f}" for i, r in enumerate(rows))
        o.append(f"<path class='c-s{k + 1}' d='{d}'/>")
        for r in rows:
            o.append(f"<circle class='c-d{k + 1}' cx='{xs(r['p']):.1f}' cy='{ys(r['trip']):.1f}' r='2.3'><title>{int(crowd):,} visitors, ${r['p']:.2f}: {r['trip']} minutes, {round(r['standstill'] * 100)}% of the loop stopped</title></circle>")
        at3 = next(r for r in rows if r['p'] == 3)   # the lines sit furthest apart at $3
        o.append(f"<text class='c-lab{k + 1}' x='{xs(3) + 6:.1f}' y='{ys(at3['trip']) - 9:.1f}'>{int(crowd):,} visitors</text>")
    for k, crowd in enumerate(CHART_CROWDS):
        b = best_row(SWEEPS[crowd])
        if b:
            o.append(f"<circle class='c-ring' cx='{xs(b['p']):.1f}' cy='{ys(b['trip']):.1f}' r='6.5'/><text class='c-ringlab' x='{xs(b['p']):.1f}' y='{ys(b['trip']) - 12 - (k % 2) * 14:.1f}' text-anchor='middle'>${b['p']:.2f}</text>")
    for v in range(1, 9):
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
    one = (HERE / 'onepager.html').read_text().replace('/*CHART*/', chart_svg())
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
