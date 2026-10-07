#!/bin/bash
# v3 smoke: passcode rate limit, live vote counts, quiz image, hidden feedback,
# export content types. Requires PRESENTER_PASSCODE=dev-passcode in .dev.vars (local)
# or a real passcode for prod via PASS env var.
set -e
BASE=${BASE:-http://localhost:5173}
PASS=${PASS:-dev-passcode}
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }
POST() { curl -s -X POST "$1" -H 'Content-Type: application/json' -d "$2"; }

echo "=== rate limit: 5 bad attempts then 429"
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "attempt $i: %{http_code}\n" -X POST $BASE/api/presentations -H 'Content-Type: application/json' \
    -d '{"title":"x","questions":[{"type":"mc","prompt":"Q?","options":["A","B"]}],"passcode":"wrong"}'
done
curl -s -w " [attempt 6: %{http_code}]\n" -X POST $BASE/api/presentations -H 'Content-Type: application/json' \
  -d '{"title":"x","questions":[{"type":"mc","prompt":"Q?","options":["A","B"]}],"passcode":"wrong"}'
echo "--- even the CORRECT passcode is blocked while locked (expect 429):"
curl -s -w " [%{http_code}]\n" -X POST $BASE/api/presentations -H 'Content-Type: application/json' \
  -d "{\"title\":\"x\",\"questions\":[{\"type\":\"mc\",\"prompt\":\"Q?\",\"options\":[\"A\",\"B\"]}],\"passcode\":\"$PASS\"}"

echo "=== clear the lockout for subsequent tests (local only)"
if [ "$BASE" = "http://localhost:5173" ]; then
  npx wrangler d1 execute live-polling-db --local --command "DELETE FROM passcode_attempts" > /dev/null 2>&1
  echo "cleared"
else
  echo "SKIPPED (prod — waiting out lockout not implemented in test)"
fi

echo "=== create quiz with image + feedback question"
IMG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
CREATE=$(POST $BASE/api/presentations "{\"title\":\"V3\",\"questions\":[{\"type\":\"quiz\",\"prompt\":\"What is this?\",\"options\":[\"dot\",\"square\"],\"correctIndex\":0,\"image\":\"$IMG\"},{\"type\":\"feedback\",\"prompt\":\"Thoughts?\"}],\"passcode\":\"$PASS\"}")
CODE=$(echo "$CREATE" | J "['code']")
KEY=$(echo "$CREATE" | J "['presenterKey']")
echo "code=$CODE"
P=$(POST $BASE/api/presentations/$CODE/join '{"nickname":"alice"}' | J "['participantId']")

POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"start\"}" > /dev/null
Q1=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")
POST $BASE/api/presentations/$CODE/respond "{\"participantId\":\"$P\",\"questionId\":$Q1,\"value\":0}" > /dev/null

echo "--- image present in voter state? (expect True)"
curl -s "$BASE/api/presentations/$CODE/state?participantId=$P" | J "['currentQuestion']['image'] is not None"
echo "--- voteCount visible BEFORE reveal (expect 1)"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['voteCount']"
echo "--- distribution still hidden before reveal (expect None)"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['results']"
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"reveal\"}" > /dev/null
echo "--- after reveal: counts + correctIndex"
curl -s "$BASE/api/presentations/$CODE/state?participantId=$P" | J "[['results'], ['currentQuestion']['correctIndex']]" 2>/dev/null || true

echo "=== feedback hidden from state"
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"next\"}" > /dev/null
Q2=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")
POST $BASE/api/presentations/$CODE/respond "{\"participantId\":\"$P\",\"questionId\":$Q2,\"value\":\"nice\"}" > /dev/null
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"reveal\"}" > /dev/null
echo "--- voter results after reveal on feedback (expect None)"
curl -s "$BASE/api/presentations/$CODE/state?participantId=$P" | J "['results']"
echo "--- presenter results on feedback (expect None — panel uses /feedback)"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['results']"
echo "--- feedback endpoint still returns it:"
curl -s "$BASE/api/presentations/$CODE/feedback?presenterKey=$KEY&questionId=$Q2"
echo ""

echo "=== export endpoints return proper content types (not HTML)"
curl -s -o /dev/null -w "json: %{content_type}\n" "$BASE/api/presentations/$CODE/export?presenterKey=$KEY"
curl -s -o /dev/null -w "md:   %{content_type}\n" "$BASE/api/presentations/$CODE/results.md?presenterKey=$KEY"
echo "--- results.md contains feedback:"
curl -s "$BASE/api/presentations/$CODE/results.md?presenterKey=$KEY" | grep -A3 "Thoughts"
echo "V3 SMOKE DONE"
