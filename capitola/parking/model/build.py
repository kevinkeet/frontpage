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

SWEEP = [  # rate, minutes for a trip around the loop, share of meters full
    (1, 16.3, 0.983), (1.5, 15.9, 0.984), (2, 15.9, 0.978), (2.5, 14.8, 0.987), (3, 14.4, 0.987), (3.5, 9.2, 0.981),
    (4, 5.0, 0.972), (4.5, 4.3, 0.904), (5, 4.2, 0.842), (5.5, 4.6, 0.771), (6, 4.2, 0.606), (6.5, 4.2, 0.532),
    (7, 4.3, 0.443), (7.5, 4.3, 0.452), (8, 4.2, 0.391)]


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


def chart_svg():
    pw, ph, y0, ax, bx = 300, 150, 104, 56, 440
    xa = lambda v: ax + (v - 1) / 7 * pw
    xb = lambda v: bx + (v - 1) / 7 * pw
    yt = lambda v: y0 + ph - v / 20 * ph
    yo = lambda v: y0 + ph - v * ph
    today = next(r for r in SWEEP if r[0] == 2)
    prop = next(r for r in SWEEP if r[0] == 5)
    pt = ' '.join(('M' if i == 0 else 'L') + f'{xa(r[0]):.1f} {yt(r[1]):.1f}' for i, r in enumerate(SWEEP))
    po = ' '.join(('M' if i == 0 else 'L') + f'{xb(r[0]):.1f} {yo(r[2]):.1f}' for i, r in enumerate(SWEEP))
    o = [f"<svg viewBox='0 0 760 310' role='img' aria-label='A $5 summer rate cuts a trip around the loop from 16 minutes to 4'>"]
    o.append("<text class='c-title' x='0' y='24'>A $5 summer rate cuts a trip around the loop from 16 minutes to 4</text>")
    o.append("<text class='c-sub' x='0' y='46'>Model estimate for a busy summer Saturday, by hourly rate on the loop meters</text>")
    o.append(f"<text class='c-panel' x='{ax}' y='80'>Minutes to drive the loop</text>")
    o.append(f"<text class='c-panel' x='{bx}' y='80'>Loop meters full</text><text class='c-note' x='{bx + 112}' y='80'>shaded: target, 80 to 90%</text>")
    for v in (0, 10, 20):
        o.append(f"<line class='c-grid' x1='{ax}' x2='{ax + pw}' y1='{yt(v):.1f}' y2='{yt(v):.1f}'/><text class='c-tick' x='{ax - 8}' y='{yt(v) + 4:.1f}' text-anchor='end'>{v}</text>")
    for v in (0, .5, 1):
        o.append(f"<line class='c-grid' x1='{bx}' x2='{bx + pw}' y1='{yo(v):.1f}' y2='{yo(v):.1f}'/><text class='c-tick' x='{bx - 8}' y='{yo(v) + 4:.1f}' text-anchor='end'>{round(v * 100)}%</text>")
    o.append(f"<rect class='c-band' x='{bx}' width='{pw}' y='{yo(.9):.1f}' height='{yo(.8) - yo(.9):.1f}'/>")
    for f in (xa, xb):
        o.append(f"<line class='c-today-line' x1='{f(2):.1f}' x2='{f(2):.1f}' y1='{y0}' y2='{y0 + ph}'/><line class='c-prop-line' x1='{f(5):.1f}' x2='{f(5):.1f}' y1='{y0}' y2='{y0 + ph}'/>")
    o.append(f"<text class='c-note' x='{xa(2):.1f}' y='{y0 - 6}' text-anchor='middle'>today</text><text class='c-prop-text' x='{xa(5):.1f}' y='{y0 - 6}' text-anchor='middle'>summer rate</text>")
    o.append(f"<path class='c-line' d='{pt}'/><path class='c-line' d='{po}'/>")
    for r in SWEEP:
        o.append(f"<circle class='c-dot' cx='{xa(r[0]):.1f}' cy='{yt(r[1]):.1f}' r='2.5'><title>${r[0]:.2f}: {r[1]} minutes</title></circle>")
        o.append(f"<circle class='c-dot' cx='{xb(r[0]):.1f}' cy='{yo(r[2]):.1f}' r='2.5'><title>${r[0]:.2f}: {round(r[2] * 100)}% full</title></circle>")
    o.append(f"<circle class='c-today' cx='{xa(2):.1f}' cy='{yt(today[1]):.1f}' r='5'/><text class='c-val' x='{xa(2) + 9:.1f}' y='{yt(today[1]) - 9:.1f}'>{round(today[1])} min</text>")
    o.append(f"<circle class='c-prop' cx='{xa(5):.1f}' cy='{yt(prop[1]):.1f}' r='5'/><text class='c-prop-text' x='{xa(5) + 9:.1f}' y='{yt(prop[1]) - 9:.1f}'>{round(prop[1])} min</text>")
    o.append(f"<circle class='c-today' cx='{xb(2):.1f}' cy='{yo(today[2]):.1f}' r='5'/><text class='c-val' x='{xb(2) + 9:.1f}' y='{yo(today[2]) - 9:.1f}'>{round(today[2] * 100)}%</text>")
    o.append(f"<circle class='c-prop' cx='{xb(5):.1f}' cy='{yo(prop[2]):.1f}' r='5'/><text class='c-prop-text' x='{xb(5) + 9:.1f}' y='{yo(prop[2]) - 9:.1f}'>{round(prop[2] * 100)}%</text>")
    for v in range(1, 9):
        o.append(f"<text class='c-tick' x='{xa(v):.1f}' y='{y0 + ph + 18}' text-anchor='middle'>${v}</text><text class='c-tick' x='{xb(v):.1f}' y='{y0 + ph + 18}' text-anchor='middle'>${v}</text>")
    o.append(f"<text class='c-sub' x='380' y='{y0 + ph + 44}' text-anchor='middle'>Hourly rate on the loop meters</text></svg>")
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
