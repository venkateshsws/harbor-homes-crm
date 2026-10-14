#!/usr/bin/env bash
# Start the Harbor Homes CRM frontend on http://127.0.0.1:5173/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d frontend/node_modules ]]; then
  npm --prefix frontend install
fi

echo "Starting the CRM frontend on http://127.0.0.1:5173/"
npm --prefix frontend run dev
