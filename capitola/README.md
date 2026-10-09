# Capitola flood risk (kevinkeet.com/capitola)

- `index.html`: the page (markup, CSS and script in one file; d3 v7.9.0 vendored in `vendor/`).
- `data/`: the model's CSVs, which the page fetches on load. Rewritten every morning by the
  "Refresh Capitola flood data" GitHub Action (`.github/workflows/capitola-refresh.yml`).
- `model/`: the Python model the Action runs. Start with `model/CLAUDE.md`.

The page also pulls live conditions straight from NOAA, CDIP, USGS and the National Weather Service
in the visitor's browser, so the "Right now" panel is current even between model runs.
