#!/bin/bash
# Descarga los CSV gratuitos de football-data.co.uk (LaLiga y Premier, 2019-20 a 2026-27).
# Uso: bash scripts/download-football-data.sh <carpeta>
set -e
dir=${1:-data/football-data}; mkdir -p "$dir"
for s in 1920 2021 2122 2223 2324 2425 2526 2627; do
  for l in SP1 E0; do curl -sSfL -o "$dir/${l}_$s.csv" "https://football-data.co.uk/mmz4281/$s/$l.csv"; done
done
echo "Descargado en $dir"
