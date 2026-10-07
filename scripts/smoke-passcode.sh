#!/bin/bash
# Passcode guard smoke test (requires PRESENTER_PASSCODE=dev-passcode in .dev.vars).
set -e
BASE=${BASE:-http://localhost:5173}
BODY='{"title":"Guard Test","questions":[{"type":"mc","prompt":"Q?","options":["A","B"]}]}'

echo "--- config endpoint (expect requiresPasscode: true)"
curl -s $BASE/api/config
echo ""
echo "--- create without passcode (expect 403)"
curl -s -w " [%{http_code}]\n" -X POST $BASE/api/presentations -H 'Content-Type: application/json' -d "$BODY"
echo "--- create with wrong passcode (expect 403)"
curl -s -w " [%{http_code}]\n" -X POST $BASE/api/presentations -H 'Content-Type: application/json' -d '{"title":"G","questions":[{"type":"mc","prompt":"Q?","options":["A","B"]}],"passcode":"wrong"}'
echo "--- create with correct passcode (expect 201)"
curl -s -w " [%{http_code}]\n" -X POST $BASE/api/presentations -H 'Content-Type: application/json' -d '{"title":"G","questions":[{"type":"mc","prompt":"Q?","options":["A","B"]}],"passcode":"dev-passcode"}'
echo "--- import without passcode (expect 403)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/presentations/import -H 'Content-Type: application/json' -d "$BODY"
echo "--- audience join unaffected (use code from correct-passcode create)"
CODE=$(curl -s -X POST $BASE/api/presentations -H 'Content-Type: application/json' -d '{"title":"G2","questions":[{"type":"mc","prompt":"Q?","options":["A","B"]}],"passcode":"dev-passcode"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['code'])")
curl -s -o /dev/null -w "join: %{http_code}\n" -X POST $BASE/api/presentations/$CODE/join -H 'Content-Type: application/json' -d '{"nickname":"anon"}'
echo "PASSCODE SMOKE DONE"
