"""Capitola Village coastal flood-risk model.

Total water level (TWL, ft NAVD88) = still water level + wave runup
  still water level : Monterey tide gauge (observed, or predicted tide + offset)
  wave runup        : Stockdon et al. (2006) R2% from nearshore waves off Capitola Beach
                      (CDIP MOP points SC111-SC113, 15 m depth), de-shoaled to deep water.
Swell direction enters through the MOP model, which refracts offshore swell into Monterey Bay
and so already shrinks sheltered (NW/WNW) swells and keeps exposed (SW/S/W) ones.
"""
import numpy as np, pandas as pd
G=9.81; M2FT=3.28084
MLLW_TO_NAVD88_FT=0.14          # Monterey 9413450: NAVD88 sits 0.14 ft below MLLW
BEACH_SLOPE=0.06                # foreshore slope assumed for Capitola Beach (winter)

def wavenumber(T,h):
    w=2*np.pi/np.asarray(T,float); k=w**2/G
    for _ in range(50): k=k-(w**2-G*k*np.tanh(k*h))/(-G*np.tanh(k*h)-G*k*h/np.cosh(k*h)**2)
    return k

def deshoal(Hs,T,h=15.0):
    """Equivalent deep-water height from height at depth h (linear shoaling)."""
    Hs=np.asarray(Hs,float); T=np.asarray(T,float)
    k=wavenumber(T,h); n=0.5*(1+2*k*h/np.sinh(2*k*h))
    c=(2*np.pi/np.asarray(T))/k; c0=G*np.asarray(T)/(2*np.pi)
    Ks=np.sqrt(c0/(2*n*c)); return np.asarray(Hs)/Ks

def runup_ft(Hs15,Tp,beta=BEACH_SLOPE):
    Hs15=np.asarray(Hs15,float); Tp=np.asarray(Tp,float)
    H0=deshoal(Hs15,Tp); L0=G*np.asarray(Tp)**2/(2*np.pi); HL=np.sqrt(H0*L0)
    setup=0.35*beta*HL; swash=np.sqrt(HL**2*(0.563*beta**2+0.004))/2
    return 1.1*(setup+swash)*M2FT

def twl_ft(wl_mllw_ft,Hs15,Tp,beta=BEACH_SLOPE):
    return np.asarray(wl_mllw_ft,float)+MLLW_TO_NAVD88_FT+runup_ft(Hs15,Tp,beta)

# ---- Thresholds on the TWL index (ft NAVD88), calibrated on documented Capitola events ----
#   2014-03-01 (Esplanade closed, car afloat)  -> 12.5
#   2024-12-23 (Village closed, seawater in)    -> 13.2
#   2023-12-28 (condos/restaurants flooded)     -> 15.8
#   2023-01-05 (wharf broken, Esplanade gutted) -> 17.5
WATCH, FLOOD, SEVERE = 11.0, 12.5, 15.5

def level(twl):
    return np.select([twl>=SEVERE, twl>=FLOOD, twl>=WATCH],['Severe','Flood','Watch'],'Low')

# Offshore -> Capitola wave height ratio by offshore mean direction (ERA5 vs CDIP MOP, 2000-2024, Hs>2 m)
DIR_RATIO={180:0.49,195:0.54,210:0.57,225:0.58,240:0.56,255:0.50,270:0.42,285:0.33,300:0.25,315:0.20}

def hs15_for_runup(R_ft,Tp,beta=BEACH_SLOPE):
    """Nearshore (15 m) Hs that produces runup R_ft at period Tp (bisection)."""
    lo,hi=0.05,15.0
    for _ in range(60):
        mid=(lo+hi)/2
        if runup_ft(mid,Tp,beta)>R_ft: hi=mid
        else: lo=mid
    return (lo+hi)/2
