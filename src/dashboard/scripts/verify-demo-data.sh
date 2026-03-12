#!/usr/bin/env bash
set -euo pipefail

echo "Generating demo DB..."
npm run dashboard:generate-demo-db

echo "Running ETL..."
npm run dashboard:etl

OUT_DIR=src/dashboard/public/data

# --- file existence checks ---
if [[ ! -f "$OUT_DIR/overall-stats.json" ]]; then
  echo "ERROR: Missing overall-stats.json"
  exit 2
fi
if [[ ! -f "$OUT_DIR/convoy-list.json" ]]; then
  echo "ERROR: Missing convoy-list.json"
  exit 2
fi

# --- content quality checks via node ---
node - << 'EOF'
const fs = require('node:fs')
const outDir = 'src/dashboard/public/data'

const stats = JSON.parse(fs.readFileSync(`${outDir}/overall-stats.json`, 'utf8'))
const list  = JSON.parse(fs.readFileSync(`${outDir}/convoy-list.json`, 'utf8'))

const errors = []

if (!stats.convoyCounts || stats.convoyCounts.total === 0)
  errors.push('overall-stats.json: convoyCounts.total is 0 — did generate-demo-db run?')

if (stats.durationStats?.avg_sec == null)
  errors.push('overall-stats.json: durationStats.avg_sec is null — completed convoy needs started_at + finished_at')

if (!stats.tokenCostTotals || stats.tokenCostTotals.total_tokens === 0)
  errors.push('overall-stats.json: total_tokens is 0 — tasks need token data')

if (!Array.isArray(list) || list.length === 0)
  errors.push('convoy-list.json: array is empty')

if (errors.length > 0) {
  for (const e of errors) console.error('ERROR:', e)
  process.exit(2)
}
console.log(`OK: ${list.length} convoy(s), avg_sec=${stats.durationStats.avg_sec}, tokens=${stats.tokenCostTotals.total_tokens}`)
EOF

echo "OK: demo data verified in $OUT_DIR"
