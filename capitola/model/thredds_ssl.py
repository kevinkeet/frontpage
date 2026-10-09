"""Make OPeNDAP over https work for CDIP THREDDS.
netCDF4 wheels point libcurl at certifi's CA bundle, but netCDF-C strips spaces from that path, so
every THREDDS open fails ("NetCDF: I/O failure") when the venv sits under a folder with spaces
(e.g. 'Claude applications folder'). Point it at the system bundle instead. Import before opening URLs."""
import os, netCDF4
for _p in ('/etc/ssl/cert.pem', '/etc/ssl/certs/ca-certificates.crt'):
    if os.path.exists(_p):
        netCDF4.rc_set('HTTP.SSL.CAINFO', _p)
        break
