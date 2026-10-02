#!/bin/bash
# End-to-end smoke test against the local dev server (http://localhost:5173).
set -e
BASE=${BASE:-http://localhost:5173}
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

echo "--- create presentation"
CREATE=$(curl -s -X POST $BASE/api/presentations -H 'Content-Type: application/json' -d '{
  "title": "Smoke Test",
  "questions": [
    {"type":"mc","prompt":"Best color?","options":["Red","Blue","Green"]},
    {"type":"wordcloud","prompt":"One word for today"},
    {"type":"quiz","prompt":"2+2?","options":["3","4","5"],"correctIndex":1,"timeLimitSec":20}
  ]}')
echo "$CREATE"
CODE=$(echo "$CREATE" | J "['code']")
KEY=$(echo "$CREATE" | J "['presenterKey']")

echo "--- join (alice + bob)"
ALICE=$(curl -s -X POST $BASE/api/presentations/$CODE/join -H 'Content-Type: application/json' -d '{"nickname":"alice"}' | J "['participantId']")
BOB=$(curl -s -X POST $BASE/api/presentations/$CODE/join -H 'Content-Type: application/json' -d '{"nickname":"bob"}' | J "['participantId']")
echo "alice=$ALICE bob=$BOB"

echo "--- join with bad code (expect 404)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/presentations/ZZZZZZ/join -H 'Content-Type: application/json' -d '{"nickname":"x"}'

echo "--- start without key (expect 403)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d '{"presenterKey":"wrong","action":"start"}'

echo "--- respond before start (expect 409)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$ALICE\",\"questionId\":1,\"value\":0}"

echo "--- start"
curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"start\"}"
echo ""

echo "--- audience state: correctIndex hidden? (expect None)"
curl -s "$BASE/api/presentations/$CODE/state?participantId=$ALICE" | J "['currentQuestion'].get('correctIndex')"
echo "--- presenter state: correctIndex visible? (expect 1... q1 is mc so None)"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion'].get('correctIndex')"
QID=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")

echo "--- alice votes option 1 (expect 201)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$ALICE\",\"questionId\":$QID,\"value\":1}"
echo "--- alice votes again (expect 409 already_answered)"
curl -s -w " [%{http_code}]\n" -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$ALICE\",\"questionId\":$QID,\"value\":0}"
echo "--- bob votes option 1 (expect 201)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$BOB\",\"questionId\":$QID,\"value\":1}"

echo "--- reveal, presenter state counts (expect [0,2,0], total 2)"
curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"reveal\"}" > /dev/null
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['results']"

echo "--- next (wordcloud); alice submits '  Sunny  ' twice"
curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"next\"}" > /dev/null
QID2=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")
curl -s -o /dev/null -w "first: %{http_code}\n" -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$ALICE\",\"questionId\":$QID2,\"value\":\"  Sunny  \"}"
curl -s -w " second: %{http_code}\n" -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$ALICE\",\"questionId\":$QID2,\"value\":\"rainy\"}"
curl -s -o /dev/null -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$BOB\",\"questionId\":$QID2,\"value\":\"sunny\"}"

echo "--- next (quiz); alice correct+fast, bob wrong"
curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"next\"}" > /dev/null
QID3=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")
echo "alice: $(curl -s -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$ALICE\",\"questionId\":$QID3,\"value\":1}")"
sleep 3
echo "bob:   $(curl -s -X POST $BASE/api/presentations/$CODE/respond -H 'Content-Type: application/json' -d "{\"participantId\":\"$BOB\",\"questionId\":$QID3,\"value\":0}")"

echo "--- reveal quiz; leaderboard (alice should lead with ~900-1000)"
curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"reveal\"}" > /dev/null
curl -s "$BASE/api/presentations/$CODE/state?participantId=$ALICE" | J "['leaderboard']"

echo "--- wordcloud aggregates visible after reveal of quiz? (presenter, prev question not current) -- checking current only"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['results']"

echo "--- next past end -> closed"
curl -s -X POST $BASE/api/presentations/$CODE/control -H 'Content-Type: application/json' -d "{\"presenterKey\":\"$KEY\",\"action\":\"next\"}"
echo ""
echo "--- join after close (expect 410)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/presentations/$CODE/join -H 'Content-Type: application/json' -d '{"nickname":"late"}'
echo "--- SPA fallback: /play/$CODE serves HTML?"
curl -s "$BASE/play/$CODE" | head -c 80
echo ""
echo "SMOKE TEST DONE"
