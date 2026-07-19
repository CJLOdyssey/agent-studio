#!/bin/bash
# Run mutation testing on critical modules
# Usage: ./scripts/run_mutmut.sh

set -e

echo "Running mutmut..."
python3 -m mutmut run --paths-to-mutate=backend/core/ --tests-dir=tests/ || true

echo "Generating results..."
python3 -m mutmut results || true

echo "Done. Check html/ for detailed report."
