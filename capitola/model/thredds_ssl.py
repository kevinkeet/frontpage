"""Reliable OPeNDAP over https for CDIP THREDDS.
netCDF4 wheels point libcurl at certifi's CA bundle, but netCDF-C strips spaces from that path, so
every THREDDS open fails ("NetCDF: I/O failure") when the venv sits under a folder with spaces
(e.g. 'Claude applications folder'). Point it at the system bundle instead. Import before opening URLs."""
import os, netCDF4
for _p in ('/etc/ssl/cert.pem', '/etc/ssl/certs/ca-certificates.crt'):
    if os.path.exists(_p):
        netCDF4.rc_set('HTTP.SSL.CAINFO', _p)
        break


def open_dataset(url, tries=4, wait=20):
    """xarray.open_dataset with retries. CDIP's server occasionally refuses a request (netCDF reports
    "Authorization failure"); on 26 Oct 2026 that failed the daily run and the same request worked a minute later."""
    import time, xarray as xr
    for i in range(tries):
        try:
            return xr.open_dataset(url)
        except OSError as e:
            if i == tries - 1:
                raise
            print(f'THREDDS open failed ({e}); retrying in {wait * (i + 1)} s')
            time.sleep(wait * (i + 1))
