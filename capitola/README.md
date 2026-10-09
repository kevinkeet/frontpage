# Capitola flood risk (kevinkeet.com/capitola)

Static page. `index.html` holds the markup, CSS and script; d3 v7.9.0 is vendored in `vendor/`;
the numbers come from the CSVs in `data/`, which the page fetches on load.

The CSVs are written by Kevin's Python model, which lives outside this repo in
`Claude applications folder/capitola-flood/` (its `CLAUDE.md` has the method, data sources and known issues).
To refresh the page:

    cd capitola-flood
    .venv/bin/python run_weekly.py   # live tide, swell and rain forecasts -> dash/*.csv
    ./publish.sh                     # copies dash/*.csv into frontpage/capitola/data/

then commit `capitola/data/` here and push. The page shows the model run time under the title and marks
the 10-day and creek forecasts "Out of date" once the run is more than 36 hours old.
