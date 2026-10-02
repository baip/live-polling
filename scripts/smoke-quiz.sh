#!/bin/bash
# Quiz-focused smoke test: scoring, speed bonus, reveal gating.
set -e
BASE=${BASE:-http://localhost:5173}
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

CREATE=$(curl -s -X POST $BASE/api/presentations -H 'Content-Type: application/json' -d '{"title":"Quiz Test","questions":[{"type":"quiz","prompt":"2+2?","options":["3","4","5"],"correctIndex":1,"timeLimitSec":20}]}')
CODE=$(echo "$CREATE" | J "['code']")
KEY=$(echo "$CREATE" | J "['presenterKey']")
ALICE=$(curl -s -X POST $BASE/api/presentations/$CODE/join -H 'Content-Type: application/json' -d '{"nickname":"alice"}' | J "['participantId']")
BOB=$(curl -s -X POST $BASE/api/presentations/$CODE/join -H 'Content-Type: application/json' -d '{"nickname":"bob"}' | J "['participantId']")

curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"start\"}" > /dev/null
QID=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")

echo "--- alice correct+fast (expect points ~950-1000)"
curl -s -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$ALICE\",\"questionId\":$QID,\"value\":1}"
echo ""
sleep 3
echo "--- bob wrong (expect points 0)"
curl -s -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$BOB\",\"questionId\":$QID,\"value\":0}"
echo ""

echo "--- audience results BEFORE reveal (expect None)"
curl -s "$BASE/api/presentations/$CODE/state?participantId=$ALICE" | J "['results']"

curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"reveal\"}" > /dev/null

echo "--- audience correctIndex AFTER reveal (expect 1)"
curl -s "$BASE/api/presentations/$CODE/state?participantId=$BOB" | J "['currentQuestion']['correctIndex']"
echo "--- leaderboard (alice first, bob 0)"
curl -s "$BASE/api/presentations/$CODE/state?participantId=$BOB" | J "['leaderboard']"
echo "QUIZ SMOKE DONE"
