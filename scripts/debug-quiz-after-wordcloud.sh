#!/bin/bash
# Reproduce: quiz respond fails after wordcloud step in the full flow.
set -e
BASE=${BASE:-https://live-polling.pengbai.workers.dev}
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

CREATE=$(curl -s -X POST $BASE/api/presentations -H 'Content-Type: application/json' -d '{"title":"Dbg","questions":[{"type":"mc","prompt":"C?","options":["A","B"]},{"type":"wordcloud","prompt":"W?"},{"type":"quiz","prompt":"Q?","options":["1","2"],"correctIndex":0}]}')
CODE=$(echo "$CREATE" | J "['code']")
KEY=$(echo "$CREATE" | J "['presenterKey']")
ALICE=$(curl -s -X POST $BASE/api/presentations/$CODE/join -H 'Content-Type: application/json' -d '{"nickname":"alice"}' | J "['participantId']")

echo "--- start"; curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"start\"}" > /dev/null
echo "--- next (wordcloud)"; curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"next\"}" > /dev/null
echo "--- next (quiz)"; curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"next\"}" > /dev/null

echo "--- full presenter state:"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | python3 -m json.tool
echo "--- respond with that question id:"
QID=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")
echo "QID=$QID"
curl -s -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$ALICE\",\"questionId\":$QID,\"value\":0}"
echo ""
