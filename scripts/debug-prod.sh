#!/bin/bash
# Debug production API response
BASE=https://live-polling.pengbai.workers.dev
echo "--- GET / (SPA)"
curl -s -o /dev/null -w "%{http_code}\n" $BASE/
echo "--- POST /api/presentations"
curl -s -X POST $BASE/api/presentations -H 'Content-Type: application/json' -d '{"title":"Debug","questions":[{"type":"mc","prompt":"Test?","options":["A","B"]}]}'
echo ""
