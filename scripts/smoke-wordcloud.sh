#!/bin/bash
# Wordcloud-focused smoke test: normalization, aggregation, presenter reveal.
set -e
BASE=${BASE:-https://live-polling.pengbai.workers.dev}
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

CREATE=$(curl -s -X POST $BASE/api/presentations -H 'Content-Type: application/json' -d '{"title":"WC Test","questions":[{"type":"wordcloud","prompt":"One word for today"}]}')
CODE=$(echo "$CREATE" | J "['code']")
KEY=$(echo "$CREATE" | J "['presenterKey']")
ALICE=$(curl -s -X POST $BASE/api/presentations/$CODE/join -H 'Content-Type: application/json' -d '{"nickname":"alice"}' | J "['participantId']")
BOB=$(curl -s -X POST $BASE/api/presentations/$CODE/join -H 'Content-Type: application/json' -d '{"nickname":"bob"}' | J "['participantId']")

curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"start\"}" > /dev/null
QID=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")

curl -s -o /dev/null -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$ALICE\",\"questionId\":$QID,\"value\":\"  Sunny  \"}"
curl -s -o /dev/null -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$BOB\",\"questionId\":$QID,\"value\":\"SUNNY\"}"
echo "--- empty word (expect 400):"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$ALICE\",\"questionId\":$QID,\"value\":\"   \"}"

curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"reveal\"}" > /dev/null
echo "--- presenter results (expect sunny x2, total 2):"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['results']"
echo "WORDCLOUD SMOKE DONE"
