"""Network access for the model's downloads: every request goes out with a descriptive User-Agent.

CDIP's THREDDS server refuses generic User-Agents coming from shared cloud machines. On Nov 3 and Nov 12, 2026 it answered
the daily run with HTTP 403: "Access to CDIP API has been restricted for this IP address or User-Agent ... Ensure your
request sends a descriptive User-Agent header". netCDF's built-in OPeNDAP client always sends "oc4.9.3" (it ignores
HTTP.USERAGENT in .ncrc and rc_set; checked with netCDF4 1.7.4), so CDIP data now comes through OPeNDAP's plain-text ASCII
service with `requests`, like the page's live panel. That also retires the netCDF CA-bundle workaround.
"""
import re, time, urllib.parse
import numpy as np, requests

USER_AGENT = 'CapitolaFloodModel/1.2 (+https://kevinkeet.com/capitola/)'
HEADERS = {'User-Agent': USER_AGENT}


def get(url, timeout=60, tries=3, headers=None, **kw):
    """requests.get with our User-Agent, retrying connection errors, timeouts, 429 and 5xx answers."""
    h = {**HEADERS, **(headers or {})}
    for i in range(tries):
        try:
            r = requests.get(url, timeout=timeout, headers=h, **kw)
            if r.status_code not in (429, 500, 502, 503, 504) or i == tries - 1:
                return r
            err = f'HTTP {r.status_code}'
        except (requests.ConnectionError, requests.Timeout) as e:
            if i == tries - 1:
                raise
            err = repr(e)
        print(f'GET {url[:90]} failed ({err}); retrying', flush=True)
        time.sleep(10 * (i + 1))


def _text(r):
    if r.status_code == 403:   # waiting on the same machine never lifted this; the workflow starts a fresh run elsewhere
        raise RuntimeError(f'CDIP refused this machine (HTTP 403): {r.text[:300]}')
    r.raise_for_status()
    return r.text


def opendap(url, names, last=None):
    """1-D variables along `waveTime` from a THREDDS OPeNDAP dataset, through its ASCII service.
    last: only the last N time steps. Returns {name: float array}, with CDIP's fill value (-999.99) as NaN."""
    n = int(re.search(r'waveTime\[waveTime = (\d+)\]', _text(get(url + '.dds'))).group(1))
    a = 0 if not last else max(0, n - last)
    query = ','.join(f'{v}[{a}:1:{n - 1}]' for v in names)
    txt = _text(get(url + '.ascii?' + urllib.parse.quote(query, safe=',:'), timeout=180))
    out = {}
    for m in re.finditer(r'^(\w+)\[(\d+)\]\n([^\n]*)', txt, re.M):
        v = np.array(m.group(3).split(','), dtype=float)
        if len(v) != int(m.group(2)):
            raise ValueError(f'{url}: {m.group(1)} has {len(v)} values, expected {m.group(2)}')
        v[v <= -999] = np.nan
        out[m.group(1)] = v
    missing = [v for v in names if v not in out]
    if missing:
        raise ValueError(f'{url}: {missing} missing from the response')
    return out
